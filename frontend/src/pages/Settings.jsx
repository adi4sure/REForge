import { useEffect, useState } from 'react'
import { settingsApi } from '../api'
import { Key, Trash2, Check, AlertCircle, ExternalLink, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-opus-4-5'],
    defaultModel: 'claude-3-5-sonnet-20241022',
    color: 'var(--amber)',
    desc: 'Best for long code analysis and reasoning. Recommended for binary RE.',
    docsUrl: 'https://console.anthropic.com/keys',
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    defaultModel: 'gpt-4o',
    color: 'var(--green)',
    desc: 'Great for structured output and report generation.',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'bedrock',
    name: 'AWS Bedrock',
    models: ['anthropic.claude-3-5-sonnet-20241022-v2:0'],
    defaultModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    color: 'var(--cyan)',
    desc: 'Enterprise option. Uses AWS credentials.',
    docsUrl: 'https://aws.amazon.com/bedrock/',
  },
]

function ProviderCard({ provider, savedKey, onSave, onDelete }) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(provider.defaultModel)
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await onSave(provider.id, apiKey, model)
      setApiKey('')
      toast.success(`${provider.name} key saved`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ borderColor: savedKey ? provider.color + '33' : 'var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: provider.color + '18', border: `1px solid ${provider.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Key size={16} color={provider.color} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{provider.name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{provider.desc}</div>
          </div>
        </div>
        {savedKey ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontSize: '0.75rem', fontFamily: 'var(--font-code)' }}>
            <Check size={14} />
            <span>…{savedKey.key_hint}</span>
          </div>
        ) : (
          <AlertCircle size={14} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 5 }}>
            API Key
            <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, fontSize: '0.68rem' }}>
              <ExternalLink size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> Get key
            </a>
          </label>
          <div style={{ position: 'relative' }}>
            <input
              className="input input-code"
              type={showKey ? 'text' : 'password'}
              placeholder={savedKey ? `Saved (ends in …${savedKey.key_hint}) — enter new to replace` : `Enter ${provider.name} API key…`}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ paddingRight: '2.5rem', fontSize: '0.8rem' }}
            />
            <button type="button" onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 5 }}>Model</label>
          <select
            className="input"
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{ fontFamily: 'var(--font-code)', fontSize: '0.8rem' }}
          >
            {provider.models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !apiKey.trim()}>
            {saving ? <><span className="spinner" style={{ width: 11, height: 11 }} /> Saving…</> : <><Key size={11} /> Save Key</>}
          </button>
          {savedKey && (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(provider.id)}>
              <Trash2 size={11} /> Remove
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default function Settings() {
  const [savedKeys, setSavedKeys] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    settingsApi.listKeys()
      .then(d => setSavedKeys(d.keys || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (provider, apiKey, model) => {
    await settingsApi.saveKey({ provider, apiKey, model })
    const data = await settingsApi.listKeys()
    setSavedKeys(data.keys || [])
  }

  const handleDelete = async (provider) => {
    if (!confirm(`Remove ${provider} key?`)) return
    await settingsApi.deleteKey(provider)
    setSavedKeys(k => k.filter(x => x.provider !== provider))
    toast.success('Key removed')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
          Manage your BYOK (Bring Your Own Key) AI providers. Keys are AES-256 encrypted at rest.
        </p>

        <div style={{ background: 'rgba(0,255,136,.06)', border: '1px solid var(--border-accent)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--green)' }}>How it works:</strong> Your API key is encrypted with AES-256 before storage. When you ask a question, the key is decrypted server-side, used for that single request, and never logged. You pay the AI provider directly — REForge charges $0.
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <span className="spinner" style={{ width: 20, height: 20, margin: '0 auto', display: 'block' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PROVIDERS.map(p => (
              <ProviderCard
                key={p.id}
                provider={p}
                savedKey={savedKeys.find(k => k.provider === p.id)}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
