# ghidra_export.py — Ghidra post-analysis script
# Runs inside Ghidra headless, exports analysis data as JSON
# Usage: analyzeHeadless ... -postScript ghidra_export.py /output/dir

import json
import os
import sys

from ghidra.app.decompiler import DecompInterface, DecompileOptions
from ghidra.util.task import ConsoleTaskMonitor
from ghidra.program.model.symbol import SymbolType

def run():
    output_dir = getScriptArgs()[0] if len(getScriptArgs()) > 0 else "/tmp/ghidra_out"
    os.makedirs(output_dir, exist_ok=True)

    program = getCurrentProgram()
    listing = program.getListing()
    monitor = ConsoleTaskMonitor()

    # ── Program info ──────────────────────────────────────────────────────────
    lang = program.getLanguage()
    arch = str(lang.getProcessor())
    bits = lang.getLanguageDescription().getSize()
    endian = "little" if lang.isBigEndian() == False else "big"
    os_type = detectOsType(program)
    compiler = str(program.getCompilerSpec().getCompilerSpecID()) if program.getCompilerSpec() else None
    entry_point = str(program.getMinAddress()) if program.getMinAddress() else None

    # ── Imports ───────────────────────────────────────────────────────────────
    imports = []
    ext_funcs = program.getSymbolTable().getExternalSymbols()
    for sym in ext_funcs:
        imports.append({"name": str(sym.getName()), "lib": str(sym.getParentNamespace())})

    # ── Exports ───────────────────────────────────────────────────────────────
    exports = []
    for sym in program.getSymbolTable().getAllSymbols(True):
        if sym.isExternalEntryPoint():
            exports.append({"name": str(sym.getName()), "addr": str(sym.getAddress())})

    # ── Sections ──────────────────────────────────────────────────────────────
    sections = []
    memory = program.getMemory()
    for block in memory.getBlocks():
        data = None
        try:
            data = block.getData()
            entropy = calculateEntropy(data.read(block.getSize())) if block.getSize() < 1024*1024 else 0
        except:
            entropy = 0
        sections.append({
            "name": str(block.getName()),
            "vaddr": str(block.getStart()),
            "size": block.getSize(),
            "entropy": entropy,
            "executable": block.isExecute(),
            "writable": block.isWrite()
        })

    # ── Strings ───────────────────────────────────────────────────────────────
    strings = []
    defined_data = listing.getDefinedData(True)
    for data in defined_data:
        if data.hasStringValue():
            val = str(data.getValue())
            if len(val) >= 4:
                strings.append({"addr": str(data.getAddress()), "value": val[:200]})
        if len(strings) >= 5000:
            break

    # ── Decompile Functions ───────────────────────────────────────────────────
    decomp = DecompInterface()
    options = DecompileOptions()
    decomp.setOptions(options)
    decomp.openProgram(program)

    functions = []
    func_manager = program.getFunctionManager()
    all_funcs = func_manager.getFunctions(True)
    func_count = 0

    for func in all_funcs:
        if func_count >= 500:  # Limit to 500 functions for MVP
            break
        func_count += 1

        fname = str(func.getName())
        faddr = str(func.getEntryPoint())
        fsig = str(func.getSignature())

        # Decompile
        decomp_result = None
        decompiled_c = ""
        try:
            decomp_result = decomp.decompileFunction(func, 30, monitor)
            if decomp_result.decompileCompleted():
                decompiled_c = str(decomp_result.getDecompiledFunction().getC())
        except:
            pass

        # Disassembly
        asm_lines = []
        try:
            func_body = func.getBody()
            code_units = listing.getCodeUnits(func_body, True)
            count = 0
            for cu in code_units:
                asm_lines.append(f"{cu.getAddressString(False, True)}  {cu.toString()}")
                count += 1
                if count >= 200:
                    break
        except:
            pass

        complexity = len(decompiled_c.split('\n')) if decompiled_c else 0

        functions.append({
            "name": fname,
            "address": faddr,
            "signature": fsig,
            "decompiled_c": decompiled_c,
            "asm_listing": "\n".join(asm_lines),
            "complexity": complexity
        })

    decomp.dispose()

    # ── Detect packing ────────────────────────────────────────────────────────
    high_entropy_sections = [s for s in sections if s.get('entropy', 0) > 7.0]
    is_packed = len(high_entropy_sections) > 0 and len(imports) < 5

    # ── Output JSON ───────────────────────────────────────────────────────────
    result = {
        "arch": arch,
        "bits": bits,
        "endian": endian,
        "os_type": os_type,
        "compiler": compiler,
        "entry_point": entry_point,
        "linked_libs": list(set([i["lib"] for i in imports if i["lib"] != "<EXTERNAL>"])),
        "sections": sections,
        "imports": imports[:300],
        "exports": exports[:300],
        "strings": strings,
        "functions": functions,
        "is_packed": is_packed,
        "is_stripped": len([f for f in functions if f["name"].startswith("FUN_")]) > len(functions) * 0.8
    }

    output_path = os.path.join(output_dir, "analysis.json")
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"[ghidra_export] Exported {len(functions)} functions, {len(strings)} strings to {output_path}")

def detectOsType(program):
    exe_format = str(program.getExecutableFormat()).lower()
    if "elf" in exe_format: return "linux"
    if "portable executable" in exe_format or "pe" in exe_format: return "windows"
    if "mach-o" in exe_format: return "macos"
    return "unknown"

def calculateEntropy(data):
    if not data or len(data) == 0:
        return 0
    import math
    freq = {}
    for b in data:
        freq[b] = freq.get(b, 0) + 1
    entropy = 0
    n = len(data)
    for count in freq.values():
        p = count / n
        if p > 0:
            entropy -= p * math.log2(p)
    return round(entropy, 2)

run()
