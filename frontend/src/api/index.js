import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000,
})

// Inject JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data).then(r => r.data),
  login:    (data) => api.post('/auth/login', data).then(r => r.data),
  me:       ()     => api.get('/auth/me').then(r => r.data),
}

// ── Upload ────────────────────────────────────────────────────────────────────
export const uploadApi = {
  uploadFile: (file, onProgress) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total))
      },
    }).then(r => r.data)
  },
}

// ── Analysis ──────────────────────────────────────────────────────────────────
export const analysisApi = {
  list:      ()   => api.get('/analysis').then(r => r.data),
  get:       (id) => api.get(`/analysis/${id}`).then(r => r.data),
  getFiles:  (id) => api.get(`/analysis/${id}/files`).then(r => r.data),
  getFns:    (id) => api.get(`/analysis/${id}/functions`).then(r => r.data),
  delete:    (id) => api.delete(`/analysis/${id}`).then(r => r.data),
}

// ── Files ─────────────────────────────────────────────────────────────────────
export const filesApi = {
  getContent: (id)          => api.get(`/files/${id}/content`).then(r => r.data),
  search:     (analysisId, q) => api.get(`/files/${analysisId}/search`, { params: { q } }).then(r => r.data),
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  getHistory: (analysisId) => api.get(`/ai/chat/${analysisId}`).then(r => r.data),

  // Returns the EventSource URL for SSE streaming
  getChatUrl: () => `${API_BASE}/api/ai/chat`,
  getToken:   () => useAuthStore.getState().token,
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportApi = {
  generate: (analysisId, title) => api.post('/report/generate', { analysisId, title }).then(r => r.data),
  get:      (id)                 => api.get(`/report/${id}`).then(r => r.data),
  list:     (analysisId)         => api.get(`/report/analysis/${analysisId}`).then(r => r.data),
}

// ── Community ─────────────────────────────────────────────────────────────────
export const communityApi = {
  list:    (params) => api.get('/community', { params }).then(r => r.data),
  get:     (id)     => api.get(`/community/${id}`).then(r => r.data),
  publish: (data)   => api.post('/community/publish', data).then(r => r.data),
}

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsApi = {
  listKeys:  ()             => api.get('/settings/apikeys').then(r => r.data),
  saveKey:   (data)         => api.post('/settings/apikey', data).then(r => r.data),
  deleteKey: (provider)     => api.delete(`/settings/apikey/${provider}`).then(r => r.data),
}

export default api
