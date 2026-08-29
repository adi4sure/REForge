import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  Shield, Upload, LayoutDashboard, Users,
  Settings, LogOut, LogIn, Terminal
} from 'lucide-react'

export default function TopBar() {
  const { user, token, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <header className="topbar">
      {/* Logo */}
      <Link to="/" className="topbar-logo">
        <span className="bracket">[</span>
        <Shield size={14} />
        REForge
        <span className="bracket">]</span>
        <span className="cursor" aria-hidden />
      </Link>

      {/* Nav */}
      <nav className="topbar-nav">
        {token && (
          <>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
              <LayoutDashboard size={13} /> Dashboard
            </NavLink>
            <NavLink to="/upload" className={({ isActive }) => isActive ? 'active' : ''}>
              <Upload size={13} /> Analyze
            </NavLink>
          </>
        )}
        <NavLink to="/community" className={({ isActive }) => isActive ? 'active' : ''}>
          <Users size={13} /> Community
        </NavLink>
      </nav>

      {/* Actions */}
      <div className="topbar-actions">
        {token ? (
          <>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              <Terminal size={11} style={{ display: 'inline', marginRight: 4 }} />
              {user?.username}
            </span>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>
              <button className="btn btn-ghost btn-sm" title="Settings">
                <Settings size={14} />
              </button>
            </NavLink>
            <button className="btn btn-ghost btn-sm" onClick={logout} title="Sign out">
              <LogOut size={14} />
            </button>
          </>
        ) : (
          <>
            <Link to="/login">
              <button className="btn btn-ghost btn-sm">
                <LogIn size={13} /> Sign In
              </button>
            </Link>
            <Link to="/register">
              <button className="btn btn-primary btn-sm">
                Get Started
              </button>
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
