import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api'
import { Shield, UserPlus, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const { token, user } = await authApi.register({
        email: form.email, username: form.username, password: form.password
      })
      setAuth(token, user)
      toast.success('Account created! Add your AI key in Settings.')
      navigate('/settings')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const field = (key, label, type = 'text', placeholder = '') => (
    <div>
      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="input"
          type={key.includes('password') || key === 'confirm' ? (showPw ? 'text' : 'password') : type}
          placeholder={placeholder}
          value={form[key]}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
          required
          style={(key === 'password' || key === 'confirm') ? { paddingRight: '2.5rem' } : {}}
        />
        {key === 'password' && (
          <button type="button" onClick={() => setShowPw(!showPw)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-root)' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 12, background: 'var(--green-dark)', border: '1px solid var(--border-accent)', marginBottom: 16 }}>
            <Shield size={24} color="var(--green)" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 6 }}>Create Your Account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Already have one? <Link to="/login" style={{ color: 'var(--green)' }}>Sign In</Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {field('email',    'Email',            'email',    'analyst@example.com')}
          {field('username', 'Username',          'text',     'h4ck3r')}
          {field('password', 'Password',          'password', '••••••••')}
          {field('confirm',  'Confirm Password',  'password', '••••••••')}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading
              ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Creating account…</>
              : <><UserPlus size={14} /> Create Account</>}
          </button>

          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            By registering, you agree to use this platform responsibly.
          </p>
        </form>
      </div>
    </div>
  )
}
