import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  Shield, Zap, Eye, Lock, GitBranch, FileCode2,
  ChevronRight, Terminal, Cpu, Package, FileText, ArrowRight
} from 'lucide-react'

const FEATURES = [
  { icon: <Cpu size={20} />, title: 'Native Binary Decompile', desc: 'ELF · PE · Mach-O decompiled to pseudo-C via Ghidra headless. Side-by-side with raw disassembly.', color: 'var(--cyan)' },
  { icon: <Package size={20} />, title: 'APK / DEX Analysis', desc: 'JADX-powered decompilation. AndroidManifest decoded, permissions risk-rated, source tree browsable.', color: 'var(--purple)' },
  { icon: <FileCode2 size={20} />, title: 'Script Analysis', desc: 'PowerShell, Bash, Python, JavaScript — static AST + pattern analysis with IOC extraction.', color: 'var(--amber)' },
  { icon: <Eye size={20} />, title: 'AI-Grounded Q&A', desc: 'Every AI answer has file:line citations. No hallucinations — claims backed by actual decompiled code.', color: 'var(--green)' },
  { icon: <Lock size={20} />, title: 'Bring Your Own Key', desc: 'OpenAI GPT-4o · Anthropic Claude. Your key, your cost. AES-256 encrypted at rest. $0 platform fee.', color: 'var(--red)' },
  { icon: <GitBranch size={20} />, title: 'Community Reports', desc: 'Publish findings, cite threat intel, build on other researchers. Open, collaborative RE platform.', color: 'var(--cyan)' },
]

const SUPPORTED = [
  { label: 'ELF / SO', tag: 'Linux' },
  { label: 'PE / DLL', tag: 'Windows' },
  { label: 'Mach-O', tag: 'macOS' },
  { label: 'APK / AAB', tag: 'Android' },
  { label: 'DEX', tag: 'Android' },
  { label: 'PowerShell', tag: 'Script' },
  { label: 'Shell / Bash', tag: 'Script' },
  { label: 'Python', tag: 'Script' },
  { label: 'JavaScript', tag: 'Script' },
]

export default function Landing() {
  const token = useAuthStore(s => s.token)

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-root)' }}>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '5rem 2rem 3rem', textAlign: 'center' }}>
        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--green-dark)', border: '1px solid var(--border-accent)', borderRadius: 999, padding: '4px 14px', fontSize: '0.72rem', fontFamily: 'var(--font-code)', color: 'var(--green)', marginBottom: '2rem', letterSpacing: '0.08em' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)', display: 'inline-block' }} />
          OPEN SOURCE · FREE · AGPL-3.0
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.25rem', letterSpacing: '-0.04em' }}>
          AI-Assisted<br />
          <span style={{ color: 'var(--green)', textShadow: '0 0 40px rgba(0,255,136,.4)' }}>Reverse Engineering</span>
          <br />for Everyone
        </h1>

        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto 2.5rem', lineHeight: 1.8 }}>
          Upload a malware sample → auto-decompile with JADX or Ghidra → extract IOCs →
          browse code → ask AI questions with <code>file:line</code> citations.
          No cloud processing of your keys. Ever.
        </p>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {token ? (
            <Link to="/upload">
              <button className="btn btn-primary btn-lg">
                <Shield size={16} /> Analyze a Sample <ChevronRight size={14} />
              </button>
            </Link>
          ) : (
            <>
              <Link to="/register">
                <button className="btn btn-primary btn-lg">
                  Start Free <ChevronRight size={14} />
                </button>
              </Link>
              <Link to="/community">
                <button className="btn btn-secondary btn-lg">
                  <Eye size={14} /> Browse Reports
                </button>
              </Link>
            </>
          )}
        </div>

        {/* Terminal demo */}
        <div className="terminal" style={{ maxWidth: 620, margin: '3rem auto 0', textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.7rem' }}>// REForge analysis pipeline</div>
          <div className="prompt" style={{ color: 'var(--green)', fontFamily: 'var(--font-code)', fontSize: '0.8rem' }}>reforge analyze implant.elf --ai anthropic</div>
          <div className="output" style={{ marginTop: 8, lineHeight: 2 }}>
            <div>✓ <span style={{ color: 'var(--green)' }}>Identified:</span> ELF 64-bit LSB, x86-64, stripped</div>
            <div>✓ <span style={{ color: 'var(--cyan)' }}>Ghidra:</span> 214 functions decompiled</div>
            <div>✓ <span style={{ color: 'var(--amber)' }}>Scanner:</span> 3 CRITICAL · 7 HIGH findings</div>
            <div>✓ <span style={{ color: 'var(--purple)' }}>IOCs:</span> 2 IPs · 1 C2 domain · XOR key 0x37</div>
            <div>✓ <span style={{ color: 'var(--green)' }}>AI:</span> C2 config extracted from sub_401280</div>
          </div>
        </div>
      </section>

      {/* ── Supported formats ──────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 2rem 3rem' }}>
        <p style={{ textAlign: 'center', fontSize: '0.72rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem' }}>Supported formats</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {SUPPORTED.map(f => (
            <span key={f.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem', fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>
              {f.label}
              <span style={{ fontSize: '0.62rem', background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 3, color: 'var(--text-muted)' }}>{f.tag}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Feature grid ──────────────────────────────────────────── */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 2rem 4rem' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.6rem', marginBottom: '2.5rem', fontWeight: 700 }}>
          Everything a <span style={{ color: 'var(--cyan)' }}>SOC analyst</span> needs
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${f.color}18`, border: `1px solid ${f.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.color, marginBottom: 12 }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</p>
              <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at center, ${f.color}08, transparent)`, pointerEvents: 'none' }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ────────────────────────────────────────────── */}
      <section style={{ maxWidth: 700, margin: '0 auto 5rem', padding: '0 2rem', textAlign: 'center' }}>
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-accent)', borderRadius: 16, padding: '2.5rem', boxShadow: 'var(--shadow-green)' }}>
          <Terminal size={32} style={{ color: 'var(--green)', marginBottom: 16 }} />
          <h2 style={{ fontSize: '1.4rem', marginBottom: 12 }}>Ready to analyze your first sample?</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.88rem' }}>
            Free forever. No credit card. Bring your own LLM key.
          </p>
          <Link to={token ? '/upload' : '/register'}>
            <button className="btn btn-primary btn-lg">
              {token ? 'Analyze Now' : 'Create Free Account'} <ArrowRight size={15} />
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '1.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-code)' }}>
        REForge · AGPL-3.0 · Built with JADX + Ghidra
      </footer>
    </div>
  )
}
