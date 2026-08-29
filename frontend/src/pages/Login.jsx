import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api'
import { Shield, LogIn, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { token, user } = await authApi.login(form)
      setAuth(token, user)
      toast.success(`Welcome back, ${user.username}`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-root)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 12, background: 'var(--green-dark)', border: '1px solid var(--border-accent)', marginBottom: 16 }}>
            <Shield size={24} color="var(--green)" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 6 }}>Sign In to REForge</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Don't have an account? <Link to="/register" style={{ color: 'var(--green)' }}>Register free</Link>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>Email</label>
            <input
              className="input"
              type="email"
              placeholder="analyst@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                style={{ paddingRight: '2.5rem' }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Signing in…</> : <><LogIn size={14} /> Sign In</>}
          </button>
        </form>

        {/* Terminal hint */}
        <div className="terminal" style={{ marginTop: 16, fontSize: '0.72rem' }}>
          <span className="prompt" style={{ color: 'var(--text-muted)' }}>// </span>
          <span style={{ color: 'var(--green)' }}>Your API keys are AES-256 encrypted at rest</span>
        </div>
      </div>
    </div>
  )
}
