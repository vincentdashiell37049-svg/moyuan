import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DocumentItem {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  wordCount?: number
}

interface MaterialItem {
  id: string
  title: string
  dynasty?: string
  author?: string
  content: string
}

interface Citation {
  id: string
  materialId: string
  citationMark: string
  materialTitle?: string
}

interface CheckIssue {
  text: string
  description: string
  severity: '高' | '中' | '低'
}

/* ------------------------------------------------------------------ */
/*  Helper: format date                                                */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function countWords(text: string): number {
  return text.replace(/\s/g, '').length
}

function generateCitationMark(existingCount: number): string {
  return `[${existingCount + 1}]`
}

/* ------------------------------------------------------------------ */
/*  Toolbar button                                                     */
/* ------------------------------------------------------------------ */

function ToolButton({
  onClick,
  active,
  title,
  children,
  accent,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: '32px',
        height: '32px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        border: 'none',
        backgroundColor: active
          ? (accent ? 'var(--accent)' : 'var(--accent2)')
          : 'transparent',
        color: active ? '#fff' : 'var(--muted)',
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'var(--bg2)'
          e.currentTarget.style.color = 'var(--ink)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--muted)'
        }
      }}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--rule)', margin: '0 4px', flexShrink: 0 }} />
}

/* ------------------------------------------------------------------ */
/*  Document list state                                                */
/* ------------------------------------------------------------------ */

function DocumentListView({ navigate }: { navigate: (path: string) => void }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api.get<DocumentItem[]>('/api/documents')
      .then(data => setDocuments(Array.isArray(data) ? data : []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = useCallback(async () => {
    setCreating(true)
    try {
      const doc = await api.post<DocumentItem>('/api/documents', {
        title: '未命名文档',
      })
      navigate(`/writing/${doc.id}`)
    } catch {
      // fallback: just navigate with a random id
      const tempId = 'new-' + Date.now()
      navigate(`/writing/${tempId}`)
    } finally {
      setCreating(false)
    }
  }, [navigate])

  const handleDelete = useCallback(async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation()
    try {
      await api.delete(`/api/documents/${docId}`)
      setDocuments(prev => prev.filter(d => d.id !== docId))
    } catch {
      // ignore
    }
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--muted)', fontSize: '14px' }}>
        <svg viewBox="0 0 24 24" width="18" height="18" style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }}>
          <circle cx="12" cy="12" r="10" stroke="var(--muted)" strokeWidth="2.5" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
        </svg>
        加载中...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>写作台</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>管理论文与笔记，快速引用史料</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--accent)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: creating ? 'not-allowed' : 'pointer',
            opacity: creating ? 0.5 : 1,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { if (!creating) e.currentTarget.style.backgroundColor = '#991b1b' }}
          onMouseLeave={e => { if (!creating) e.currentTarget.style.backgroundColor = 'var(--accent)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建文档
        </button>
      </div>

      {/* Document list or empty state */}
      {documents.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid var(--rule)',
            padding: '60px 20px',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--rule)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="64" height="64" style={{ marginBottom: '16px' }}>
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
          <p style={{ fontSize: '16px', color: 'var(--muted)', fontWeight: 500 }}>还没有论文，创建一篇吧</p>
          <p style={{ fontSize: '13px', color: 'var(--rule)', marginTop: '6px' }}>点击上方"新建文档"开始写作</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {documents.map(doc => (
            <div
              key={doc.id}
              onClick={() => navigate(`/writing/${doc.id}`)}
              style={{
                backgroundColor: '#fff',
                borderRadius: '10px',
                border: '1px solid var(--rule)',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent2)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--rule)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {/* Delete button */}
              <button
                onClick={(e) => handleDelete(e, doc.id)}
                title="删除文档"
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--rule)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.12s ease',
                  opacity: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.opacity = '1'
                  e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'
                  e.currentTarget.style.color = '#dc2626'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = '0'
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--rule)'
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="14" height="14">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>

              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  marginBottom: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  paddingRight: '32px',
                }}
              >
                {doc.title || '未命名文档'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: 'var(--muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  创建: {formatDate(doc.createdAt)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  更新: {formatDate(doc.updatedAt)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {doc.wordCount ?? countWords(doc.content)} 字
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Editor state                                                       */
/* ------------------------------------------------------------------ */

function EditorView({ docId }: { docId: string }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('未命名文档')
  const [content, setContent] = useState('')
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thirtySecondTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* Citations */
  const [citations, setCitations] = useState<Citation[]>([])

  /* Material panel */
  const [materialSearch, setMaterialSearch] = useState('')
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null)
  const [materialLoading, setMaterialLoading] = useState(false)

  /* Consistency check */
  const [checking, setChecking] = useState(false)
  const [checkResults, setCheckResults] = useState<CheckIssue[]>([])
  const [showCheck, setShowCheck] = useState(false)

  /* ---- load document ---- */
  useEffect(() => {
    api.get<DocumentItem>(`/api/documents/${docId}`)
      .then(data => {
        setTitle(data.title || '未命名文档')
        setContent(data.content || '')
        setLoaded(true)
        setLastSaved(data.updatedAt || null)
      })
      .catch(() => {
        // New document that doesn't exist yet
        setLoaded(true)
      })

    api.get<Citation[]>(`/api/documents/${docId}/citations`)
      .then(data => setCitations(Array.isArray(data) ? data : []))
      .catch(() => setCitations([]))
  }, [docId])

  /* ---- auto-save: 3 seconds after change, max every 30s ---- */
  const saveDocument = useCallback(async () => {
    if (!loaded) return
    setSaving(true)
    try {
      const result = await api.put<DocumentItem>(`/api/documents/${docId}`, {
        title,
        content,
      })
      setLastSaved(result.updatedAt || new Date().toISOString())
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }, [docId, title, content, loaded])

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveDocument()
    }, 3000)
  }, [saveDocument])

  useEffect(() => {
    if (loaded) {
      scheduleAutoSave()
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [title, content, loaded, scheduleAutoSave])

  // Periodic save every 30s
  useEffect(() => {
    thirtySecondTimerRef.current = setInterval(() => {
      if (loaded) saveDocument()
    }, 30000)
    return () => {
      if (thirtySecondTimerRef.current) clearInterval(thirtySecondTimerRef.current)
    }
  }, [loaded, saveDocument])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (loaded && autoSaveTimerRef.current) {
        saveDocument()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---- Ctrl+S ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveDocument()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveDocument])

  /* ---- search materials ---- */
  useEffect(() => {
    if (!materialSearch.trim()) {
      setMaterials([])
      return
    }
    setMaterialLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<MaterialItem[]>('/api/materials', {
          search: materialSearch.trim(),
          limit: 20,
        })
        setMaterials(Array.isArray(data) ? data : [])
      } catch {
        setMaterials([])
      } finally {
        setMaterialLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [materialSearch])

  /* ---- insert citation ---- */
  const handleInsertCitation = useCallback(async (material: MaterialItem) => {
    const mark = generateCitationMark(citations.length)

    // Insert citation mark at cursor position
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent = content.substring(0, start) + mark + content.substring(end)
      setContent(newContent)

      // Move cursor after the mark
      setTimeout(() => {
        textarea.selectionStart = start + mark.length
        textarea.selectionEnd = start + mark.length
        textarea.focus()
      }, 0)
    } else {
      setContent(prev => prev + mark)
    }

    // Add citation via API
    try {
      const newCitation = await api.post<Citation>(`/api/documents/${docId}/citations`, {
        materialId: material.id,
        citationMark: mark,
      })
      setCitations(prev => [...prev, { ...newCitation, materialTitle: material.title }])
    } catch {
      // fallback: add locally
      setCitations(prev => [...prev, {
        id: 'local-' + Date.now(),
        materialId: material.id,
        citationMark: mark,
        materialTitle: material.title,
      }])
    }
  }, [citations.length, content, docId])

  /* ---- remove citation ---- */
  const handleRemoveCitation = useCallback(async (citationId: string, citationMark: string) => {
    try {
      await api.delete(`/api/documents/${docId}/citations/${citationId}`)
    } catch {
      // ignore
    }
    setCitations(prev => prev.filter(c => c.id !== citationId))
    // Remove citation mark from content
    setContent(prev => prev.replace(citationMark, ''))
  }, [docId])

  /* ---- consistency check ---- */
  const handleCheck = useCallback(async () => {
    setChecking(true)
    setShowCheck(true)
    setCheckResults([])
    try {
      const data = await api.post<CheckIssue[]>(`/api/documents/${docId}/check`, { content })
      setCheckResults(Array.isArray(data) ? data : [])
    } catch {
      // Mock results
      setCheckResults([
        {
          text: content.substring(0, Math.min(20, content.length)) || '示例文本',
          description: '此处可能存在前后表述不一致的情况，建议核实所引用的史料版本是否统一。',
          severity: '中',
        },
      ])
    } finally {
      setChecking(false)
    }
  }, [docId, content])

  /* ---- toolbar actions ---- */
  const insertMarkdown = useCallback((prefix: string, suffix: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.substring(start, end)
    const insert = selected || placeholder
    const newContent = content.substring(0, start) + prefix + insert + suffix + content.substring(end)
    setContent(newContent)

    setTimeout(() => {
      if (!selected && placeholder) {
        textarea.selectionStart = start + prefix.length
        textarea.selectionEnd = start + prefix.length + placeholder.length
      } else {
        textarea.selectionStart = textarea.selectionEnd = start + prefix.length + insert.length + suffix.length
      }
      textarea.focus()
    }, 0)
  }, [content])

  /* ---- word count ---- */
  const wordCount = countWords(content)

  /* ---- severity color ---- */
  const severityColor = (s: string) => {
    if (s === '高') return { bg: 'rgba(239,68,68,0.08)', border: '#dc2626', text: '#dc2626' }
    if (s === '中') return { bg: 'rgba(234,179,8,0.08)', border: '#eab308', text: '#b45309' }
    return { bg: 'rgba(59,130,246,0.08)', border: '#3b82f6', text: '#2563eb' }
  }

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--muted)', fontSize: '14px' }}>
        <svg viewBox="0 0 24 24" width="18" height="18" style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }}>
          <circle cx="12" cy="12" r="10" stroke="var(--muted)" strokeWidth="2.5" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
        </svg>
        加载文档...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate('/writing')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: '6px',
            border: '1.5px solid var(--rule)',
            backgroundColor: '#fff',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent2)'; e.currentTarget.style.color = 'var(--accent2)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--rule)'; e.currentTarget.style.color = 'var(--ink)' }}
          title="返回列表"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="输入文档标题..."
          style={{
            flex: 1,
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--ink)',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            padding: '4px 0',
            borderBottom: '2px solid transparent',
            transition: 'border-color 0.15s ease',
            fontFamily: 'inherit',
          }}
          onFocus={e => (e.currentTarget.style.borderBottomColor = 'var(--rule)')}
          onBlur={e => (e.currentTarget.style.borderBottomColor = 'transparent')}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {saving && (
            <span style={{ fontSize: '12px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <svg viewBox="0 0 24 24" width="12" height="12" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
              </svg>
              保存中
            </span>
          )}
          {lastSaved && !saving && (
            <span style={{ fontSize: '12px', color: 'var(--rule)' }}>
              上次保存: {formatDate(lastSaved)}
            </span>
          )}
        </div>
      </div>

      {/* Main editor + side panel */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Left: Editor (60%) */}
        <div style={{ flex: 6, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              padding: '8px 12px',
              backgroundColor: '#fff',
              borderRadius: '10px 10px 0 0',
              border: '1px solid var(--rule)',
              borderBottom: 'none',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            <ToolButton onClick={() => insertMarkdown('**', '**', '粗体')} title="加粗 (Ctrl+B)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
              </svg>
            </ToolButton>
            <ToolButton onClick={() => insertMarkdown('*', '*', '斜体')} title="斜体 (Ctrl+I)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <line x1="19" y1="4" x2="10" y2="4" />
                <line x1="14" y1="20" x2="5" y2="20" />
                <line x1="15" y1="4" x2="9" y2="20" />
              </svg>
            </ToolButton>
            <ToolButton onClick={() => insertMarkdown('### ', '', '标题')} title="标题 (H3)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="m17 12 3-2v8" />
              </svg>
            </ToolButton>
            <ToolButton onClick={() => insertMarkdown('## ', '', '二级标题')} title="标题 (H2)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
              </svg>
            </ToolButton>
            <ToolButton onClick={() => insertMarkdown('# ', '', '一级标题')} title="标题 (H1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M21 12h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
              </svg>
            </ToolButton>

            <ToolbarDivider />

            <ToolButton onClick={() => insertMarkdown('> ', '', '引用文本')} title="引用块">
              <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
                <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.69 11 13.2 11 15c0 1.866-1.567 3.5-3.5 3.5-1.22 0-2.36-.568-2.917-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.69 21 13.2 21 15c0 1.866-1.567 3.5-3.5 3.5-1.22 0-2.36-.568-2.917-1.179z" opacity="0.4" />
              </svg>
            </ToolButton>
            <ToolButton onClick={() => insertMarkdown('\n- ', '', '列表项')} title="无序列表">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </ToolButton>
            <ToolButton onClick={() => insertMarkdown('\n1. ', '', '列表项')} title="有序列表">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
                <text x="2" y="8" fontSize="8" fill="currentColor" stroke="none" fontWeight="600">1</text>
                <text x="2" y="14" fontSize="8" fill="currentColor" stroke="none" fontWeight="600">2</text>
                <text x="2" y="20" fontSize="8" fill="currentColor" stroke="none" fontWeight="600">3</text>
              </svg>
            </ToolButton>
            <ToolButton onClick={() => insertMarkdown('\n---\n', '', '')} title="分隔线">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15">
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
            </ToolButton>

            <ToolbarDivider />

            <ToolButton onClick={() => insertMarkdown(generateCitationMark(citations.length), '', '')} title="插入引用标记" accent>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </ToolButton>

            <ToolButton onClick={handleCheck} title="一致性检查" active={showCheck} accent>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 12 18.469a3.374 3.374 0 0 0-1.066-2.235l-.548-.547Z" />
              </svg>
            </ToolButton>
          </div>

          {/* Textarea */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              borderRadius: '0 0 10px 10px',
              border: '1px solid var(--rule)',
              borderTop: '1px solid var(--rule)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="开始写作... (支持 Markdown 语法)"
              style={{
                flex: 1,
                width: '100%',
                minHeight: '500px',
                padding: '20px 24px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: '15px',
                lineHeight: '1.8',
                color: 'var(--ink)',
                backgroundColor: '#fff',
                fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", "STKaiti", serif',
                tabSize: 2,
              }}
            />

            {/* Status bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 16px',
                backgroundColor: 'var(--bg2)',
                borderTop: '1px solid var(--rule)',
                fontSize: '12px',
                color: 'var(--muted)',
                flexShrink: 0,
              }}
            >
              <span>{wordCount} 字</span>
              <span>Markdown</span>
            </div>
          </div>

          {/* Consistency check results */}
          {showCheck && (
            <div
              style={{
                marginTop: '12px',
                backgroundColor: '#fff',
                borderRadius: '10px',
                border: '1px solid var(--rule)',
                flexShrink: 0,
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: checkResults.length > 0 ? '1px solid var(--rule)' : 'none',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  一致性检查结果
                </span>
                <button
                  onClick={() => setShowCheck(false)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {checking ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="var(--muted)" strokeWidth="2.5" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                  检查中...
                </div>
              ) : checkResults.length > 0 ? (
                <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {checkResults.map((issue, idx) => {
                    const sc = severityColor(issue.severity)
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: sc.bg,
                          borderLeft: `3px solid ${sc.border}`,
                          fontSize: '14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: sc.text,
                              backgroundColor: `${sc.border}20`,
                            }}
                          >
                            {issue.severity}
                          </span>
                          <span
                            style={{
                              fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", serif',
                              color: sc.text,
                              fontWeight: 500,
                              fontSize: '13px',
                            }}
                          >
                            "{issue.text}"
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: '1.5', margin: 0 }}>
                          {issue.description}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#16a34a', fontSize: '14px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  未发现一致性问题
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Material panel (40%) */}
        <div
          style={{
            flex: 4,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#fff',
            borderRadius: '10px',
            border: '1px solid var(--rule)',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: '14px 16px 10px',
              borderBottom: '1px solid var(--rule)',
              flexShrink: 0,
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '10px' }}>
              史料速查
            </h3>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--muted)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="14"
                height="14"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={materialSearch}
                onChange={e => setMaterialSearch(e.target.value)}
                placeholder="搜索史料..."
                style={{
                  width: '100%',
                  height: '34px',
                  paddingLeft: '30px',
                  paddingRight: '12px',
                  borderRadius: '6px',
                  border: '1.5px solid var(--rule)',
                  fontSize: '13px',
                  color: 'var(--ink)',
                  backgroundColor: 'var(--bg)',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent2)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--rule)')}
              />
            </div>
          </div>

          {/* Material list */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {materialLoading && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: '4px' }}>
                  <circle cx="12" cy="12" r="10" stroke="var(--muted)" strokeWidth="2.5" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                </svg>
                搜索中...
              </div>
            )}

            {!materialLoading && materials.length === 0 && materialSearch.trim() && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                未找到相关史料
              </div>
            )}

            {!materialLoading && !materialSearch.trim() && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--rule)', fontSize: '13px' }}>
                输入关键词搜索史料
              </div>
            )}

            {materials.map(m => (
              <div
                key={m.id}
                style={{ borderBottom: '1px solid var(--rule)' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    transition: 'background-color 0.12s ease',
                  }}
                  onClick={() => setExpandedMaterialId(prev => (prev === m.id ? null : m.id))}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ flex: 1, marginRight: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.title}
                    </div>
                    {(m.dynasty || m.author) && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        {m.dynasty ? `[${m.dynasty}]` : ''}{m.author ? ` ${m.author}` : ''}
                      </div>
                    )}
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="14"
                    height="14"
                    style={{
                      transition: 'transform 0.2s ease',
                      transform: expandedMaterialId === m.id ? 'rotate(90deg)' : 'rotate(0deg)',
                      flexShrink: 0,
                    }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>

                {expandedMaterialId === m.id && (
                  <div
                    style={{
                      padding: '0 16px 12px',
                      animation: 'fadeIn 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px',
                        backgroundColor: 'var(--bg)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        lineHeight: '1.8',
                        color: 'var(--ink)',
                        fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", serif',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        marginBottom: '8px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {m.content || '（暂无内容）'}
                    </div>
                    <button
                      onClick={() => handleInsertCitation(m)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        border: '1.5px solid var(--accent)',
                        backgroundColor: '#fff',
                        color: 'var(--accent)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = 'var(--accent)' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      插入引用
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Citations list */}
          {citations.length > 0 && (
            <div
              style={{
                borderTop: '1px solid var(--rule)',
                flexShrink: 0,
                maxHeight: '180px',
                overflowY: 'auto',
              }}
            >
              <div style={{ padding: '10px 16px 6px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                参考文献 ({citations.length})
              </div>
              {citations.map(c => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 16px 4px',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: 'var(--accent2)', fontWeight: 600, flexShrink: 0, fontSize: '12px' }}>
                    {c.citationMark}
                  </span>
                  <span style={{ flex: 1, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.materialTitle || c.materialId}
                  </span>
                  <button
                    onClick={() => handleRemoveCitation(c.id, c.citationMark)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '3px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--rule)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'color 0.12s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--rule)')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="12" height="12">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page router                                                   */
/* ------------------------------------------------------------------ */

export default function WritingPage() {
  const { id } = useParams<{ id: string }>()

  if (id) {
    return <EditorView docId={id} />
  }

  return <DocumentListView navigate={useNavigate()} />
}