import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analysisApi, filesApi, aiApi, reportApi } from '../api'
import { useAuthStore } from '../store/authStore'
import MonacoEditor from '@monaco-editor/react'
import {
  FolderOpen, File, ChevronRight, ChevronDown,
  Shield, AlertTriangle, Globe, Key, Code2,
  MessageSquare, FileText, Download, Share2,
  Loader, RefreshCw, Cpu, Package, Search, X, Send
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Utility helpers ───────────────────────────────────────────────────────────
const LANG_MAP = { java:'java', kotlin:'kotlin', xml:'xml', c:'c', cpp:'cpp', asm:'asm', python:'python', javascript:'javascript', powershell:'powershell', shell:'shell', smali:'plaintext', json:'json', yaml:'yaml', plaintext:'plaintext', markdown:'markdown', groovy:'groovy' }
const SEV_COLOR = { CRITICAL: 'var(--red)', HIGH: 'var(--amber)', MEDIUM: 'var(--cyan)', LOW: 'var(--green)', INFO: 'var(--text-muted)' }
const TYPE_ICONS = { apk: <Package size={12} color="var(--purple)" />, elf: <Cpu size={12} color="var(--green)" />, pe: <Cpu size={12} color="var(--cyan)" />, macho: <Cpu size={12} color="var(--amber)" /> }

function formatBytes(b) {
  if (!b) return '?'
  if (b < 1024) return `${b}B`
  if (b < 1024**2) return `${(b/1024).toFixed(1)}KB`
  return `${(b/1024**2).toFixed(2)}MB`
}

// ── File Tree Node ────────────────────────────────────────────────────────────
function TreeNode({ node, children, depth, selectedId, onSelect }) {
  const [open, setOpen] = useState(depth < 2)
  const isDir = node.type === 'dir'
  const ext = node.name.split('.').pop()
  const langColors = { java:'#f89820', kt:'#7c52ff', xml:'#e74c3c', c:'#3498db', h:'#3498db', py:'#306998', js:'#f1c40f', json:'#a8b9cc', ps1:'#012456', sh:'#4eaa25', md:'#083fa1', gradle:'#02303a', smali:'#a8b9cc' }
  const col = langColors[ext] || 'var(--text-muted)'

  return (
    <div>
      <div
        className={`tree-item${selectedId === node.id ? ' selected' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 6}px`, gap: 4 }}
        onClick={() => isDir ? setOpen(o => !o) : onSelect(node)}
      >
        {isDir
          ? open ? <ChevronDown size={11} style={{ flexShrink: 0 }} /> : <ChevronRight size={11} style={{ flexShrink: 0 }} />
          : <span style={{ width: 11, flexShrink: 0 }} />}
        {isDir
          ? <FolderOpen size={13} color="var(--amber)" style={{ flexShrink: 0 }} />
          : <File size={13} color={col} style={{ flexShrink: 0 }} />}
        <span className="truncate" style={{ fontSize: '0.76rem' }}>{node.name}</span>
      </div>
      {isDir && open && children}
    </div>
  )
}

function FileTree({ files, selectedId, onSelect }) {
  // Build tree from flat list
  const byId = {}
  const roots = []
  for (const f of files) byId[f.id] = { ...f, _children: [] }
  for (const f of files) {
    if (f.parent_id && byId[f.parent_id]) byId[f.parent_id]._children.push(byId[f.id])
    else roots.push(byId[f.id])
  }
  const renderNode = (node, depth = 0) => (
    <TreeNode key={node.id} node={node} depth={depth} selectedId={selectedId} onSelect={onSelect}>
      {node._children.sort((a, b) => (a.type === 'dir' ? -1 : 1) || a.name.localeCompare(b.name)).map(c => renderNode(c, depth + 1))}
    </TreeNode>
  )
  return (
    <div className="file-tree">
      {roots.sort((a, b) => (a.type === 'dir' ? -1 : 1) || a.name.localeCompare(b.name)).map(r => renderNode(r))}
    </div>
  )
}

// ── AI Chat Panel ─────────────────────────────────────────────────────────────
function AIChatPanel({ analysisId, onJumpToLine }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const messagesRef = useRef(null)
  const token = useAuthStore(s => s.token)

  useEffect(() => {
    if (!analysisId) return
    aiApi.getHistory(analysisId).then(d => setMessages(d.messages || [])).catch(() => {})
  }, [analysisId])

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages, streamingText])

  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')
    setMessages(m => [...m, { id: Date.now(), role: 'user', content: userMsg }])
    setStreaming(true)
    setStreamingText('')

    try {
      const response = await fetch(aiApi.getChatUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ analysisId, message: userMsg })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'AI request failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let citations = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'token') { fullText += evt.content; setStreamingText(fullText) }
            if (evt.type === 'done') { citations = evt.citations || [] }
            if (evt.type === 'error') throw new Error(evt.error)
          } catch {}
        }
      }

      setMessages(m => [...m, { id: Date.now() + 1, role: 'assistant', content: fullText, citations }])
      setStreamingText('')
    } catch (err) {
      toast.error(err.message || 'AI error')
    } finally {
      setStreaming(false)
      setStreamingText('')
    }
  }

  const renderContent = (content) => {
    // Replace [file:line] citations with clickable spans
    const parts = content.split(/(\[[^\]]+:\d+(?:-\d+)?\])/g)
    return parts.map((part, i) => {
      const citMatch = part.match(/^\[([^\]]+):(\d+)(?:-(\d+))?\]$/)
      if (citMatch) {
        return (
          <button key={i} className="citation-link" onClick={() => onJumpToLine?.(citMatch[1], parseInt(citMatch[2]))}>
            {part}
          </button>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  const SUGGESTIONS = [
    'What does this malware do?',
    'Find C2 communication code',
    'Explain the crypto/encoding used',
    'List all IOCs found',
    'Is there anti-debugging?',
  ]

  return (
    <div className="chat-container">
      <div ref={messagesRef} className="chat-messages">
        {messages.length === 0 && !streaming && (
          <div style={{ padding: '1rem 0' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>
              <MessageSquare size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
              Ask anything about the analyzed code.<br />Answers include <code>file:line</code> citations.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => setInput(s)} style={{ textAlign: 'left', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'all 0.15s' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`chat-msg chat-msg-${m.role}`}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginBottom: 2, paddingLeft: 4 }}>
              {m.role === 'user' ? '▸ you' : '▸ REForge AI'}
            </div>
            <div className="chat-bubble" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {renderContent(m.content)}
            </div>
            {m.citations?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 4 }}>
                {m.citations.map((c, i) => (
                  <button key={i} className="citation-link" onClick={() => onJumpToLine?.(c.file_path, c.line_start)}>
                    {c.file_path?.split('/').pop()}:{c.line_start}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {streaming && streamingText && (
          <div className="chat-msg chat-msg-assistant">
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginBottom: 2, paddingLeft: 4 }}>▸ REForge AI</div>
            <div className="chat-bubble" style={{ whiteSpace: 'pre-wrap' }}>{streamingText}<span style={{ display: 'inline-block', width: 7, height: 13, background: 'var(--green)', animation: 'blink 1s step-end infinite', verticalAlign: 'middle', marginLeft: 2 }} /></div>
          </div>
        )}
        {streaming && !streamingText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <span className="spinner" style={{ width: 12, height: 12 }} /> Thinking…
          </div>
        )}
      </div>
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder="Ask about this code… (Shift+Enter for newline)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          rows={1}
          disabled={streaming}
        />
        <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={streaming || !input.trim()}>
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Findings Panel ────────────────────────────────────────────────────────────
function FindingsPanel({ findings, iocs, onJumpToLine }) {
  const [tab, setTab] = useState('findings')
  const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }
  const sorted = [...findings].sort((a, b) => (sevOrder[a.severity] ?? 5) - (sevOrder[b.severity] ?? 5))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="tabs">
        <button className={`tab ${tab === 'findings' ? 'active' : ''}`} onClick={() => setTab('findings')}>
          <Shield size={11} /> Findings ({findings.length})
        </button>
        <button className={`tab ${tab === 'iocs' ? 'active' : ''}`} onClick={() => setTab('iocs')}>
          <Globe size={11} /> IOCs ({iocs.length})
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'findings' && (
          sorted.length === 0
            ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No findings detected</div>
            : <div style={{ padding: '0.5rem' }}>
                {sorted.map(f => (
                  <div key={f.id} style={{ marginBottom: 8, background: 'var(--bg-elevated)', border: `1px solid ${SEV_COLOR[f.severity]}22`, borderRadius: 6, padding: '0.6rem 0.75rem', cursor: f.file_path ? 'pointer' : 'default' }} onClick={() => f.file_path && onJumpToLine?.(f.file_path, f.line_start)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge badge-${f.severity.toLowerCase()}`}>{f.severity}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{f.title}</span>
                    </div>
                    {f.file_path && <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)', color: 'var(--cyan)', marginBottom: 4 }}>{f.file_path}:{f.line_start}</div>}
                    {f.evidence && <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', background: 'var(--bg-root)', padding: '3px 6px', borderRadius: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.evidence}</div>}
                  </div>
                ))}
              </div>
        )}
        {tab === 'iocs' && (
          iocs.length === 0
            ? <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No IOCs extracted</div>
            : <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Type</th><th>Value</th><th>Location</th></tr></thead>
                <tbody>
                  {iocs.map(i => (
                    <tr key={i.id} style={{ cursor: i.file_path ? 'pointer' : 'default' }} onClick={() => i.file_path && onJumpToLine?.(i.file_path, i.line_number)}>
                      <td><span className="badge badge-medium" style={{ textTransform: 'uppercase', fontSize: '0.62rem' }}>{i.type}</span></td>
                      <td style={{ color: 'var(--cyan)', fontFamily: 'var(--font-code)', fontSize: '0.74rem', maxWidth: 200 }} title={i.value}>{i.value?.slice(0, 40)}{i.value?.length > 40 ? '…' : ''}</td>
                      <td style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>{i.file_path?.split('/').slice(-1)[0]}:{i.line_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
        )}
      </div>
    </div>
  )
}

// ── Main Analysis page ────────────────────────────────────────────────────────
export default function Analysis() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState(null)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [loadingContent, setLoadingContent] = useState(false)
  const [activeTab, setActiveTab] = useState('explorer') // explorer | findings | ai | report
  const [rightTab, setRightTab] = useState('ai')         // ai | findings
  const [reportMarkdown, setReportMarkdown] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)
  const editorRef = useRef(null)

  // Load analysis data
  const load = useCallback(async () => {
    try {
      const [analysisData, filesData] = await Promise.all([
        analysisApi.get(id),
        analysisApi.getFiles(id)
      ])
      setAnalysis(analysisData)
      setFiles(filesData.files || [])
    } catch (err) {
      toast.error('Failed to load analysis')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    // Poll if still processing
    const poll = setInterval(async () => {
      const d = await analysisApi.get(id).catch(() => null)
      if (d) {
        setAnalysis(d)
        if (d.status === 'complete') {
          const fd = await analysisApi.getFiles(id).catch(() => ({ files: [] }))
          setFiles(fd.files || [])
          clearInterval(poll)
        }
        if (d.status === 'error') clearInterval(poll)
      }
    }, 4000)
    return () => clearInterval(poll)
  }, [id])

  // Load file content when selected
  const handleFileSelect = async (file) => {
    if (file.type === 'dir') return
    setSelectedFile(file)
    setLoadingContent(true)
    try {
      const data = await filesApi.getContent(file.id)
      setFileContent(data.content || '')
    } catch {
      setFileContent('// Failed to load file content')
    } finally {
      setLoadingContent(false)
    }
  }

  const handleJumpToLine = useCallback((filePath, lineNum) => {
    // Find file by path
    const file = files.find(f => f.path === filePath || f.path.endsWith(filePath) || filePath.endsWith(f.name))
    if (file) {
      handleFileSelect(file)
      setTimeout(() => {
        editorRef.current?.revealLineInCenter(lineNum)
        editorRef.current?.setPosition({ lineNumber: lineNum, column: 1 })
      }, 500)
    }
  }, [files])

  const handleGenerateReport = async () => {
    setGeneratingReport(true)
    try {
      const { markdown } = await reportApi.generate(id, analysis?.original_name)
      setReportMarkdown(markdown)
      setRightTab('report')
      toast.success('Report generated')
    } catch (err) {
      toast.error('Report generation failed')
    } finally {
      setGeneratingReport(false)
    }
  }

  const downloadReport = () => {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reforge_report_${id.slice(0, 8)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto', display: 'block' }} />
        <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading analysis…</p>
      </div>
    </div>
  )

  const isProcessing = analysis?.status === 'pending' || analysis?.status === 'processing'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
      {/* ── Analysis Header ──────────────────────────────────────────── */}
      <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {TYPE_ICONS[analysis?.file_type] || <Shield size={14} color="var(--green)" />}
          <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{analysis?.original_name}</span>
          <span className={`badge badge-${analysis?.file_type || 'info'}`}>{analysis?.file_type?.toUpperCase()}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontFamily: 'var(--font-code)', color: analysis?.status === 'complete' ? 'var(--green)' : analysis?.status === 'error' ? 'var(--red)' : 'var(--amber)' }}>
            <span className={`status-dot status-${analysis?.status}`} />
            {analysis?.status}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
          <span title={analysis?.sha256}>SHA256: {analysis?.sha256?.slice(0, 12)}…</span>
          <span>·</span>
          <span>{formatBytes(analysis?.file_size)}</span>
          {analysis?.findings?.length > 0 && (
            <>
              <span>·</span>
              <span style={{ color: 'var(--red)' }}>{analysis.findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length} high/crit</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleGenerateReport} disabled={generatingReport || isProcessing}>
            {generatingReport ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Generating…</> : <><FileText size={12} /> Report</>}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={load} title="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ── Processing state ─────────────────────────────────────────── */}
      {isProcessing && (
        <div style={{ padding: '0.4rem 1rem', background: 'rgba(245,158,11,.08)', borderBottom: '1px solid rgba(245,158,11,.2)', fontSize: '0.78rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="spinner" style={{ width: 12, height: 12, borderTopColor: 'var(--amber)', borderColor: 'rgba(245,158,11,.3)' }} />
          Analysis in progress — {analysis?.file_type === 'apk' || analysis?.file_type === 'aab' ? 'JADX decompiling…' : 'Ghidra analyzing…'} This will auto-refresh.
        </div>
      )}

      {/* ── Three-column workspace ───────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 340px', overflow: 'hidden', minHeight: 0 }}>

        {/* ── LEFT: File Tree ──────────────────────────────────────── */}
        <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel-header">
            <FolderOpen size={12} />
            <span className="panel-title">Files ({files.length})</span>
          </div>
          {/* APK Metadata quick view */}
          {analysis?.metadata?.packageName && (
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontFamily: 'var(--font-code)' }}>
              <div style={{ color: 'var(--green)' }}>{analysis.metadata.packageName}</div>
              <div style={{ color: 'var(--text-muted)' }}>v{analysis.metadata.versionName} · API {analysis.metadata.minSdk}+</div>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0' }}>
            {files.length === 0 && !isProcessing
              ? <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>No files yet</div>
              : <FileTree files={files} selectedId={selectedFile?.id} onSelect={handleFileSelect} />}
          </div>
        </div>

        {/* ── CENTER: Code Editor ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
          {/* Tab bar */}
          <div className="panel-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Code2 size={12} />
              <span className="panel-title" style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>
                {selectedFile ? selectedFile.path : '— select a file —'}
              </span>
            </div>
            {selectedFile && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                {selectedFile.language} · {formatBytes(selectedFile.size)}
              </span>
            )}
          </div>

          {/* Monaco */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {loadingContent && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-root)', zIndex: 10 }}>
                <span className="spinner" style={{ width: 24, height: 24 }} />
              </div>
            )}
            {selectedFile ? (
              <MonacoEditor
                height="100%"
                language={LANG_MAP[selectedFile.language] || 'plaintext'}
                value={fileContent}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  fontSize: 12.5,
                  fontFamily: 'JetBrains Mono, Fira Code, monospace',
                  lineNumbers: 'on',
                  wordWrap: 'off',
                  folding: true,
                  scrollBeyondLastLine: false,
                  renderWhitespace: 'none',
                  smoothScrolling: true,
                  cursorSmoothCaretAnimation: 'on',
                  padding: { top: 8 }
                }}
                onMount={editor => { editorRef.current = editor }}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
                <Code2 size={40} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: '0.84rem' }}>Select a file from the tree to view</p>
                {isProcessing && <p style={{ fontSize: '0.78rem' }}>Files will appear when analysis completes</p>}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: AI Chat / Findings / Report ──────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="tabs" style={{ flexShrink: 0 }}>
            <button className={`tab ${rightTab === 'ai' ? 'active' : ''}`} onClick={() => setRightTab('ai')}>
              <MessageSquare size={11} /> AI Chat
            </button>
            <button className={`tab ${rightTab === 'findings' ? 'active' : ''}`} onClick={() => setRightTab('findings')}>
              <Shield size={11} /> Findings {analysis?.findings?.length > 0 && `(${analysis.findings.length})`}
            </button>
            {reportMarkdown && (
              <button className={`tab ${rightTab === 'report' ? 'active' : ''}`} onClick={() => setRightTab('report')}>
                <FileText size={11} /> Report
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {rightTab === 'ai' && (
              analysis?.status !== 'complete'
                ? <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    <MessageSquare size={28} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                    AI chat available once analysis is complete
                  </div>
                : <AIChatPanel analysisId={id} onJumpToLine={handleJumpToLine} />
            )}
            {rightTab === 'findings' && (
              <FindingsPanel
                findings={analysis?.findings || []}
                iocs={analysis?.iocs || []}
                onJumpToLine={handleJumpToLine}
              />
            )}
            {rightTab === 'report' && reportMarkdown && (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={downloadReport}>
                    <Download size={11} /> Download .md
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '1rem', fontSize: '0.74rem', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>
                  {reportMarkdown}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
