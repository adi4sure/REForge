import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { communityApi } from '../api'
import { Search, Package, Cpu, FileCode2, Eye, ArrowUpRight, Clock, Tag } from 'lucide-react'

const TYPE_ICON = {
  apk: <Package size={14} color="var(--purple)" />,
  elf: <Cpu size={14} color="var(--green)" />,
  pe:  <Cpu size={14} color="var(--cyan)" />,
  macho: <Cpu size={14} color="var(--amber)" />,
}

function timeAgo(ts) {
  const d = Date.now() - ts
  if (d < 60000) return 'just now'
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`
  return `${Math.floor(d/86400000)}d ago`
}

export default function Community() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = async (q = '', p = 1) => {
    setLoading(true)
    try {
      const data = await communityApi.list({ search: q, page: p })
      setPosts(data.posts || [])
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    load(search, 1)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Community Reports</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 2 }}>
              Public reverse engineering findings from the REForge community
            </p>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              placeholder="Search reports, hashes, tags…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2rem' }}
            />
          </div>
          <button className="btn btn-primary" type="submit">Search</button>
        </form>

        {/* Posts */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <span className="spinner" style={{ width: 24, height: 24, margin: '0 auto', display: 'block' }} />
            <p style={{ marginTop: 12 }}>Loading reports…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <FileCode2 size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', display: 'block' }} />
            <h3 style={{ marginBottom: 8 }}>No reports yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              Be the first to publish a reverse engineering report!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {posts.map(post => (
              <div key={post.id} className="card" style={{ padding: '1rem 1.25rem', transition: 'all 0.15s', cursor: 'pointer' }}>
                <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {TYPE_ICON[post.file_type] || <FileCode2 size={14} color="var(--text-muted)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                      <span>by {post.author}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(post.created_at)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Eye size={10} /> {post.views}</span>
                    </div>
                  </div>
                  <ArrowUpRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
                {post.summary && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 8 }}>
                    {post.summary.slice(0, 200)}{post.summary.length > 200 ? '…' : ''}
                  </p>
                )}
                {post.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {post.tags.map(t => (
                      <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 999, padding: '1px 7px', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                        <Tag size={9} /> {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
