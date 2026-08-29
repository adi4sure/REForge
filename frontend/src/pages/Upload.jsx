import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { uploadApi } from '../api'
import { Upload as UploadIcon, Shield, FileCode2, AlertTriangle, CheckCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

const ACCEPTED = {
  'application/vnd.android.package-archive': ['.apk'],
  'application/octet-stream': ['.exe','.dll','.elf','.so','.dylib','.dex','.aab','.sys','.macho'],
  'text/x-powershell': ['.ps1','.psm1'],
  'text/x-shellscript': ['.sh','.bash','.zsh'],
  'text/x-python': ['.py'],
  'application/javascript': ['.js'],
}

const FILE_TIPS = [
  '🔒 Your file is uploaded to a sandboxed environment.',
  '🧠 AI never sees your file — only decompiled output.',
  '⚡ APK analysis takes 30–120s, binaries up to 5min.',
  '🔑 Add your AI key in Settings before asking questions.',
]

export default function Upload() {
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('idle') // idle | uploading | done | error
  const [result, setResult] = useState(null)
  const navigate = useNavigate()

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error(`Unsupported file type: ${rejected[0].file.name}`)
      return
    }
    if (accepted.length > 0) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 150 * 1024 * 1024,
    multiple: false,
  })

  const handleUpload = async () => {
    if (!file) return
    setStatus('uploading')
    setProgress(0)
    try {
      const data = await uploadApi.uploadFile(file, setProgress)
      setResult(data)
      setStatus('done')
      toast.success('File uploaded — analysis queued')
    } catch (err) {
      setStatus('error')
      toast.error(err.response?.data?.error || 'Upload failed')
    }
  }

  const resetState = () => {
    setFile(null)
    setStatus('idle')
    setProgress(0)
    setResult(null)
  }

  if (status === 'done' && result) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div className="card card-accent" style={{ textAlign: 'center' }}>
            <CheckCircle size={40} color="var(--green)" style={{ margin: '0 auto 1rem', display: 'block' }} />
            <h2 style={{ marginBottom: 8 }}>Analysis Queued</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: '1.5rem' }}>
              Your file is being processed. This may take 30 seconds to 5 minutes depending on the file type.
            </p>
            <div className="terminal" style={{ textAlign: 'left', marginBottom: '1.5rem', fontSize: '0.75rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>file:   </span><span style={{ color: 'var(--cyan)' }}>{result.original_name}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>type:   </span><span style={{ color: 'var(--green)' }}>{result.file_type?.toUpperCase()}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>sha256: </span><span style={{ color: 'var(--amber)', fontSize: '0.68rem' }}>{result.sha256}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>md5:    </span><span style={{ color: 'var(--purple)', fontSize: '0.68rem' }}>{result.md5}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>status: </span><span style={{ color: 'var(--green)' }}>processing</span></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate(`/analysis/${result.id}`)}>
                <Shield size={14} /> Open Analysis
              </button>
              <button className="btn btn-secondary" onClick={resetState}>
                Upload Another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Analyze a File</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginBottom: '1.5rem' }}>
          Upload a binary, APK, or script. REForge will automatically identify it and decompile.
        </p>

        {/* Dropzone */}
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <FileCode2 size={48} className="dz-icon" />
          {isDragActive ? (
            <p style={{ color: 'var(--green)', fontWeight: 600 }}>Drop it!</p>
          ) : (
            <>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Drag & drop your file here</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>or click to browse</p>
            </>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 16 }}>
            {['APK', 'EXE/DLL', 'ELF/SO', 'Mach-O', 'PS1', 'Shell', 'Python', 'JS'].map(t => (
              <span key={t} style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', color: 'var(--text-muted)' }}>{t}</span>
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>Max 150 MB</p>
        </div>

        {/* Selected file preview */}
        {file && (
          <div className="card" style={{ marginTop: 12, padding: '0.75rem 1rem' }}>
            <div className="flex items-center gap-3">
              <FileCode2 size={20} color="var(--cyan)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-code)', fontSize: '0.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={resetState}><X size={14} /></button>
            </div>
            {status === 'uploading' && (
              <div style={{ marginTop: 10 }}>
                <div className="flex justify-between mb-1" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Uploading…</span><span>{progress}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
              </div>
            )}
          </div>
        )}

        {file && status !== 'uploading' && (
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 12, justifyContent: 'center' }} onClick={handleUpload}>
            <UploadIcon size={15} /> Start Analysis
          </button>
        )}

        {/* Tips */}
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FILE_TIPS.map((t, i) => (
            <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span>{t}</span>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div style={{ marginTop: '1rem', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'var(--amber)', display: 'flex', gap: 8 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Do not upload files containing live credentials. Remove sensitive data from samples before analysis.</span>
        </div>
      </div>
    </div>
  )
}
