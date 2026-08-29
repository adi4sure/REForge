import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { analysisApi } from '../api'
import {
  Plus, Trash2, Clock, CheckCircle, XCircle, Loader,
  FileCode2, Package, Cpu, FileText, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_ICON = {
  apk: <Package size={14} color="var(--purple)" />,
  aab: <Package size={14} color="var(--purple)" />,
  elf: <Cpu size={14} color="var(--green)" />,
  pe:  <Cpu size={14} color="var(--cyan)" />,
  macho: <Cpu size={14} color="var(--amber)" />,
  powershell: <FileText size={14} color="var(--amber)" />,
  shell:      <FileText size={14} color="var(--amber)" />,
  python:     <FileCode2 size={14} color="var(--cyan)" />,
  javascript: <FileCode2 size={14} color="var(--amber)" />,
}

const STATUS_ICON = {
  pending:    <span className="status-dot status-pending" />,
  processing: <span className="status-dot status-processing" />,
  complete:   <CheckCircle size={13} color="var(--green)" />,
  error:      <XCircle size={13} color="var(--red)" />,
}

function formatBytes(b) {
  if (!b) return '?'
  if (b < 1024) return `${b}B`
  if (b < 1024**2) return `${(b/1024).toFixed(1)}KB`
  return `${(b/1024**2).toFixed(2)}MB`
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`
  return `${Math.floor(diff/86400000)}d ago`
}

export default function Dashboard() {
  const user = useAuthStore(s => s.user)
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadAnalyses = async () => {
    try {
      const data = await analysisApi.list()
      setAnalyses(data.analyses || [])
    } catch {
      toast.error('Failed to load analyses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalyses()
    // Poll for status updates
    const interval = setInterval(() => {
      if (analyses.some(a => a.status === 'pending' || a.status === 'processing')) {
        loadAnalyses()
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this analysis?')) return
    try {
      await analysisApi.delete(id)
      setAnalyses(a => a.filter(x => x.id !== id))
      toast.success('Analysis deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  const stats = {
    total: analyses.length,
    complete: analyses.filter(a => a.status === 'complete').length,
    processing: analyses.filter(a => a.status === 'processing' || a.status === 'pending').length,
    error: analyses.filter(a => a.status === 'error').length,
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
            Welcome, <span style={{ color: 'var(--green)', fontFamily: 'var(--font-code)' }}>{user?.username}</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
            {stats.total} analyses total · {stats.complete} complete · {stats.processing} in progress
          </p>
        </div>
        <Link to="/upload">
          <button className="btn btn-primary">
            <Plus size={14} /> New Analysis
          </button>
        </Link>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
        {[
          { label: 'Total', value: stats.total, color: 'var(--text-primary)' },
          { label: 'Complete', value: stats.complete, color: 'var(--green)' },
          { label: 'Processing', value: stats.processing, color: 'var(--amber)' },
          { label: 'Errors', value: stats.error, color: 'var(--red)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-code)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Analysis list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <span className="spinner" style={{ margin: '0 auto', display: 'block', width: 24, height: 24 }} />
          <p style={{ marginTop: 12 }}>Loading analyses…</p>
        </div>
      ) : analyses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <FileCode2 size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ marginBottom: 8 }}>No analyses yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.84rem' }}>
            Upload your first sample to get started
          </p>
          <Link to="/upload">
            <button className="btn btn-primary"><Plus size={14} /> Analyze a File</button>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {analyses.map(a => (
            <div
              key={a.id}
              className="card"
              style={{ padding: '0.85rem 1rem', cursor: a.status === 'complete' ? 'pointer' : 'default', transition: 'all 0.15s' }}
              onClick={() => a.status === 'complete' && navigate(`/analysis/${a.id}`)}
            >
              <div className="flex items-center gap-3">
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {TYPE_ICON[a.file_type] || <FileCode2 size={14} color="var(--text-muted)" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', fontFamily: 'var(--font-code)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.original_name}
                    </span>
                    <span className={`badge badge-${a.file_type}`}>{a.file_type?.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                    <span style={{ fontFamily: 'var(--font-code)' }}>{a.sha256?.slice(0, 16)}…</span>
                    <span>{formatBytes(a.file_size)}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(a.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: a.status === 'complete' ? 'var(--green)' : a.status === 'error' ? 'var(--red)' : 'var(--amber)' }}>
                    {STATUS_ICON[a.status]}
                    <span style={{ fontFamily: 'var(--font-code)' }}>{a.status}</span>
                  </div>
                  {a.status === 'complete' && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={e => handleDelete(a.id, e)}
                    style={{ color: 'var(--text-muted)' }}
                    title="Delete analysis"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
