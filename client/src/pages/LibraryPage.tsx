import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../services/api'

/* ===================== 类型定义 ===================== */

interface MaterialItem {
  id: string
  title: string
  author?: string
  dynasty?: string
  category: string
  content: string
  ocrText?: string
  simplifiedText?: string
  punctuatedText?: string
  finalText?: string
  source?: string
  sourceDb?: string
  bookName?: string
  version?: string
  volumePage?: string
  reliability?: string
  createdAt: string
  updatedAt: string
  tags: Tag[]
  entities?: string[]
}

interface Tag {
  id: string
  name: string
  color?: string
}

interface PaginatedData {
  list: MaterialItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type ViewMode = 'table' | 'card'
type DetailTab = 'original' | 'simplified' | 'punctuated' | 'final'

/* ===================== 常量 ===================== */

const RELIABILITY_OPTIONS = [
  { value: '', label: '全部' },
  { value: '一手史料', label: '一手史料' },
  { value: '二手史料', label: '二手史料' },
  { value: '编纂史料', label: '编纂史料' },
  { value: '存疑', label: '存疑' },
]

const SORT_OPTIONS = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'title', label: '标题' },
]

const RELIABILITY_COLORS: Record<string, { bg: string; text: string }> = {
  '一手史料': { bg: '#dcfce7', text: '#16a34a' },
  '二手史料': { bg: '#dbeafe', text: '#2563eb' },
  '编纂史料': { bg: '#fff7ed', text: '#ea580c' },
  '存疑': { bg: '#fef2f2', text: '#dc2626' },
}

const TAG_COLORS = [
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#e0e7ff', text: '#3730a3' },
  { bg: '#d1fae5', text: '#065f46' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#f3e8ff', text: '#6b21a8' },
  { bg: '#e0f2fe', text: '#075985' },
  { bg: '#fed7aa', text: '#9a3412' },
  { bg: '#d9f99d', text: '#3f6212' },
]

/* ===================== 工具函数 ===================== */

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

function getTagColor(index: number) {
  return TAG_COLORS[index % TAG_COLORS.length]
}

function truncate(str: string, maxLen: number): string {
  if (!str) return ''
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str
}

function getReliabilityColor(reliability?: string) {
  if (!reliability) return { bg: '#f5f5f4', text: '#78716c' }
  return RELIABILITY_COLORS[reliability] || { bg: '#f5f5f4', text: '#78716c' }
}

/* ===================== 图标组件 ===================== */

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="16" height="16" style={{ color: 'var(--muted)', flexShrink: 0 }}>
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function BookshelfIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" width="64" height="64" style={{ color: 'var(--rule)', marginBottom: '16px' }}>
      <rect x="8" y="8" width="48" height="48" rx="4" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="24" x2="56" y2="24" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="40" x2="56" y2="40" stroke="currentColor" strokeWidth="1.5" />
      <line x1="24" y1="8" x2="24" y2="56" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="40" y1="8" x2="40" y2="56" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <rect x="12" y="12" width="8" height="10" rx="1" fill="currentColor" opacity="0.15" />
      <rect x="28" y="28" width="8" height="10" rx="1" fill="currentColor" opacity="0.15" />
      <rect x="44" y="44" width="8" height="10" rx="1" fill="currentColor" opacity="0.15" />
    </svg>
  )
}

/* ===================== 主组件 ===================== */

export default function LibraryPage() {
  /* ---------- 列表状态 ---------- */
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)

  /* ---------- 筛选/搜索 ---------- */
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [reliabilityFilter, setReliabilityFilter] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  /* ---------- 标签列表 ---------- */
  const [tags, setTags] = useState<Tag[]>([])

  /* ---------- 详情面板 ---------- */
  const [detailItem, setDetailItem] = useState<MaterialItem | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('original')
  const [showDetail, setShowDetail] = useState(false)
  const [editingSource, setEditingSource] = useState(false)
  const [editSourceData, setEditSourceData] = useState({
    sourceDb: '',
    bookName: '',
    version: '',
    volumePage: '',
  })

  /* ---------- 引用弹窗 ---------- */
  const [showCitation, setShowCitation] = useState(false)
  const [citationFormat, setCitationFormat] = useState<'gbt7714' | 'chicago'>('gbt7714')
  const [citationText, setCitationText] = useState('')
  const [citationLoading, setCitationLoading] = useState(false)
  const [citationCopied, setCitationCopied] = useState(false)
  const [citationMaterial, setCitationMaterial] = useState<MaterialItem | null>(null)

  /* ---------- 删除确认 ---------- */
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  /* ---------- 防抖搜索 ---------- */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchText)
      setPage(1)
    }, 300)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [searchText])

  /* ---------- 加载标签 ---------- */
  useEffect(() => {
    api
      .get<Tag[]>('/api/tags')
      .then((data) => setTags(data || []))
      .catch(() => setTags([]))
  }, [])

  /* ---------- 加载列表 ---------- */
  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        search: debouncedSearch || undefined,
        tagId: tagFilter || undefined,
        page,
        limit: pageSize,
        sortBy,
        sortOrder: 'desc',
      }
      if (reliabilityFilter) {
        params.reliability = reliabilityFilter
      }
      const data = await api.get<PaginatedData>('/api/materials', params)
      setMaterials(data?.list || [])
      setTotal(data?.total || 0)
    } catch {
      setMaterials([])
      setTotal(0)
    }
    setLoading(false)
  }, [debouncedSearch, tagFilter, reliabilityFilter, page, pageSize, sortBy])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  /* ---------- 查看详情 ---------- */
  const handleViewDetail = useCallback(async (item: MaterialItem) => {
    try {
      const detail = await api.get<MaterialItem>(`/api/materials/${item.id}`)
      setDetailItem(detail)
      setDetailTab('original')
      setEditingSource(false)
      setEditSourceData({
        sourceDb: detail.sourceDb || '',
        bookName: detail.bookName || '',
        version: detail.version || '',
        volumePage: detail.volumePage || '',
      })
      setShowDetail(true)
    } catch {
      setDetailItem(item)
      setDetailTab('original')
      setEditingSource(false)
      setEditSourceData({
        sourceDb: item.sourceDb || '',
        bookName: item.bookName || '',
        version: item.version || '',
        volumePage: item.volumePage || '',
      })
      setShowDetail(true)
    }
  }, [])

  const closeDetail = useCallback(() => {
    setShowDetail(false)
    setTimeout(() => setDetailItem(null), 300)
  }, [])

  /* ---------- 保存来源信息 ---------- */
  const handleSaveSource = useCallback(async () => {
    if (!detailItem) return
    try {
      const updated = await api.put<MaterialItem>(`/api/materials/${detailItem.id}`, {
        sourceDb: editSourceData.sourceDb,
        bookName: editSourceData.bookName,
        version: editSourceData.version,
        volumePage: editSourceData.volumePage,
      })
      setDetailItem(updated)
      setEditingSource(false)
      fetchMaterials()
    } catch {
      /* 保留编辑状态 */
    }
  }, [detailItem, editSourceData, fetchMaterials])

  /* ---------- 删除 ---------- */
  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(true)
      try {
        await api.delete(`/api/materials/${id}`)
        setDeleteConfirm(null)
        if (detailItem?.id === id) {
          closeDetail()
        }
        fetchMaterials()
      } catch {
        /* 提示失败 */
      }
      setDeleting(false)
    },
    [detailItem, closeDetail, fetchMaterials],
  )

  /* ---------- 生成引用 ---------- */
  const handleCitation = useCallback(async (item: MaterialItem) => {
    setCitationMaterial(item)
    setCitationFormat('gbt7714')
    setCitationText('')
    setCitationCopied(false)
    setShowCitation(true)
    setCitationLoading(true)
    try {
      const text = await api.get<string>(`/api/materials/${item.id}/citation`, {
        format: 'gbt7714',
      })
      setCitationText(text || '')
    } catch {
      setCitationText('生成引用失败，请重试')
    }
    setCitationLoading(false)
  }, [])

  const handleCitationFormatChange = useCallback(
    async (format: 'gbt7714' | 'chicago') => {
      if (!citationMaterial) return
      setCitationFormat(format)
      setCitationLoading(true)
      setCitationCopied(false)
      try {
        const text = await api.get<string>(`/api/materials/${citationMaterial.id}/citation`, {
          format,
        })
        setCitationText(text || '')
      } catch {
        setCitationText('生成引用失败，请重试')
      }
      setCitationLoading(false)
    },
    [citationMaterial],
  )

  const handleCopyCitation = useCallback(() => {
    navigator.clipboard.writeText(citationText).then(() => {
      setCitationCopied(true)
      setTimeout(() => setCitationCopied(false), 2000)
    })
  }, [citationText])

  /* ---------- 获取详情 tab 文本 ---------- */
  const getDetailTabText = useCallback((): string => {
    if (!detailItem) return ''
    switch (detailTab) {
      case 'original':
        return detailItem.ocrText || detailItem.content || ''
      case 'simplified':
        return detailItem.simplifiedText || detailItem.content || ''
      case 'punctuated':
        return detailItem.punctuatedText || detailItem.content || ''
      case 'final':
        return detailItem.finalText || detailItem.content || ''
    }
  }, [detailItem, detailTab])

  /* ---------- 分页 ---------- */
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  /* ===================== 渲染 ===================== */

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '20px' }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--ink)',
            marginBottom: '8px',
            fontFamily: '"STKaiti", "KaiTi", "楷体", serif',
          }}
        >
          史料库
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6' }}>
          集中管理所有已识别的古籍文献资料，支持按朝代、作者、类别等多维度检索与分类浏览。
        </p>
      </div>

      {/* ===== 顶部工具栏 ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {/* 搜索框 */}
        <div
          style={{
            position: 'relative',
            flex: '1 1 240px',
            maxWidth: '360px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <SearchIcon />
          </div>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索史料标题、内容..."
            style={{
              width: '100%',
              padding: '9px 14px 9px 36px',
              border: '1px solid var(--rule)',
              borderRadius: '8px',
              fontSize: '14px',
              color: 'var(--ink)',
              outline: 'none',
              transition: 'border-color 0.15s',
              backgroundColor: '#fff',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
          />
        </div>

        {/* 标签筛选 */}
        <select
          value={tagFilter}
          onChange={(e) => {
            setTagFilter(e.target.value)
            setPage(1)
          }}
          style={{
            padding: '9px 14px',
            border: '1px solid var(--rule)',
            borderRadius: '8px',
            fontSize: '14px',
            color: 'var(--ink)',
            backgroundColor: '#fff',
            outline: 'none',
            cursor: 'pointer',
            minWidth: '120px',
          }}
        >
          <option value="">全部标签</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {/* 可信度筛选 */}
        <select
          value={reliabilityFilter}
          onChange={(e) => {
            setReliabilityFilter(e.target.value)
            setPage(1)
          }}
          style={{
            padding: '9px 14px',
            border: '1px solid var(--rule)',
            borderRadius: '8px',
            fontSize: '14px',
            color: 'var(--ink)',
            backgroundColor: '#fff',
            outline: 'none',
            cursor: 'pointer',
            minWidth: '120px',
          }}
        >
          {RELIABILITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* 排序 */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{
            padding: '9px 14px',
            border: '1px solid var(--rule)',
            borderRadius: '8px',
            fontSize: '14px',
            color: 'var(--ink)',
            backgroundColor: '#fff',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* 视图切换 */}
        <div
          style={{
            display: 'flex',
            border: '1px solid var(--rule)',
            borderRadius: '8px',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setViewMode('table')}
            title="表格视图"
            style={{
              padding: '8px 12px',
              backgroundColor: viewMode === 'table' ? 'var(--bg2)' : '#fff',
              border: 'none',
              borderRight: viewMode === 'table' ? '1px solid var(--rule)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.1s',
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" width="16" height="16" style={{ color: viewMode === 'table' ? 'var(--accent)' : 'var(--muted)' }}>
              <rect x="2" y="4" width="16" height="3" rx="1" fill="currentColor" />
              <rect x="2" y="9" width="16" height="3" rx="1" fill="currentColor" />
              <rect x="2" y="14" width="16" height="3" rx="1" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('card')}
            title="卡片视图"
            style={{
              padding: '8px 12px',
              backgroundColor: viewMode === 'card' ? 'var(--bg2)' : '#fff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.1s',
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" width="16" height="16" style={{ color: viewMode === 'card' ? 'var(--accent)' : 'var(--muted)' }}>
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" />
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" />
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" />
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {/* ===== 表格视图 ===== */}
      {viewMode === 'table' && (
        <div>
          {/* 表头统计 */}
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '12px' }}>
            共 {total} 条史料
          </div>

          {loading ? (
            <LoadingState />
          ) : materials.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid var(--rule)',
                overflow: 'hidden',
              }}
            >
              {/* 表格 */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '2px solid var(--rule)',
                      }}
                    >
                      <th style={thStyle}>标题</th>
                      <th style={{ ...thStyle, width: '140px' }}>来源</th>
                      <th style={{ ...thStyle, width: '100px' }}>可信度</th>
                      <th style={{ ...thStyle, width: '180px' }}>标签</th>
                      <th style={{ ...thStyle, width: '140px' }}>创建时间</th>
                      <th style={{ ...thStyle, width: '160px', textAlign: 'center' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((item, idx) => (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: idx < materials.length - 1 ? '1px solid var(--rule)' : 'none',
                          transition: 'background 0.1s',
                          cursor: 'default',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(185,28,28,0.02)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ ...tdStyle, fontWeight: 500, maxWidth: '260px' }}>
                          <div
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={item.title}
                          >
                            {item.title}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div
                            style={{
                              fontSize: '13px',
                              color: 'var(--muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={item.sourceDb || item.source || ''}
                          >
                            {item.sourceDb || item.source || '-'}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {item.reliability ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 10px',
                                borderRadius: '10px',
                                fontSize: '12px',
                                fontWeight: 500,
                                backgroundColor: getReliabilityColor(item.reliability).bg,
                                color: getReliabilityColor(item.reliability).text,
                              }}
                            >
                              {item.reliability}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '14px' }}>-</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {(item.tags || []).map((tag, ti) => {
                              const tc = getTagColor(ti)
                              return (
                                <span
                                  key={tag.id || ti}
                                  style={{
                                    display: 'inline-block',
                                    padding: '1px 8px',
                                    borderRadius: '10px',
                                    fontSize: '12px',
                                    backgroundColor: tc.bg,
                                    color: tc.text,
                                  }}
                                >
                                  {tag.name}
                                </span>
                              )
                            })}
                            {(!item.tags || item.tags.length === 0) && (
                              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>-</span>
                            )}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, fontSize: '13px', color: 'var(--muted)' }}>
                          {formatDate(item.createdAt)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                          >
                            <ActionLink onClick={() => handleViewDetail(item)}>
                              <EyeIcon /> 查看
                            </ActionLink>
                            <ActionLink onClick={() => handleCitation(item)}>
                              <CitationIcon /> 引用
                            </ActionLink>
                            <ActionLink
                              onClick={() => setDeleteConfirm(item.id)}
                              color="#dc2626"
                            >
                              <DeleteIcon /> 删除
                            </ActionLink>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div
                  style={{
                    padding: '14px 20px',
                    borderTop: '1px solid var(--rule)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                  }}
                >
                  <span style={{ color: 'var(--muted)' }}>
                    第 {page} / {totalPages} 页
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <PageButton
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      上一页
                    </PageButton>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (page <= 3) {
                        pageNum = i + 1
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = page - 2 + i
                      }
                      return (
                        <PageButton
                          key={pageNum}
                          active={pageNum === page}
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </PageButton>
                      )
                    })}
                    <PageButton
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      下一页
                    </PageButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== 卡片视图 ===== */}
      {viewMode === 'card' && (
        <div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '12px' }}>
            共 {total} 条史料
          </div>

          {loading ? (
            <LoadingState />
          ) : materials.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
              }}
            >
              {materials.map((item) => (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    border: '1px solid var(--rule)',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* 标题 */}
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--ink)',
                      marginBottom: '8px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.title}
                  >
                    {item.title}
                  </h3>

                  {/* 来源 */}
                  {(item.sourceDb || item.source) && (
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--muted)',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                        <path d="M8 1a5 5 0 00-5 5v3l-1 2h12l-1-2V6a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item.sourceDb || item.source}
                    </div>
                  )}

                  {/* 标签 */}
                  {(item.tags || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                      {(item.tags || []).map((tag, ti) => {
                        const tc = getTagColor(ti)
                        return (
                          <span
                            key={tag.id || ti}
                            style={{
                              padding: '1px 8px',
                              borderRadius: '10px',
                              fontSize: '12px',
                              backgroundColor: tc.bg,
                              color: tc.text,
                            }}
                          >
                            {tag.name}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* 预览文字 */}
                  <div
                    style={{
                      flex: 1,
                      fontSize: '14px',
                      color: 'var(--muted)',
                      lineHeight: '1.7',
                      marginBottom: '14px',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      fontFamily: '"STSong", "SimSun", "宋体", serif',
                    }}
                  >
                    {truncate(item.content || '', 100)}
                  </div>

                  {/* 底部操作 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--rule)',
                    }}
                  >
                    {item.reliability ? (
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: getReliabilityColor(item.reliability).bg,
                          color: getReliabilityColor(item.reliability).text,
                        }}
                      >
                        {item.reliability}
                      </span>
                    ) : (
                      <span />
                    )}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => handleViewDetail(item)}
                        style={{
                          fontSize: '13px',
                          color: 'var(--accent)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 500,
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <EyeIcon /> 查看
                      </button>
                      <button
                        onClick={() => handleCitation(item)}
                        style={{
                          fontSize: '13px',
                          color: 'var(--muted)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CitationIcon /> 引用
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 卡片视图分页 */}
          {!loading && materials.length > 0 && totalPages > 1 && (
            <div
              style={{
                marginTop: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <PageButton
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </PageButton>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <PageButton
                    key={pageNum}
                    active={pageNum === page}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </PageButton>
                )
              })}
              <PageButton
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </PageButton>
            </div>
          )}
        </div>
      )}

      {/* ===== 右侧详情面板 ===== */}
      {detailItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: showDetail ? 0 : '-400px',
            width: '400px',
            height: '100vh',
            backgroundColor: '#fff',
            boxShadow: showDetail ? '-4px 0 24px rgba(0,0,0,0.12)' : 'none',
            zIndex: 150,
            transition: 'right 0.3s ease, box-shadow 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 面板头部 */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--rule)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                marginRight: '12px',
              }}
              title={detailItem.title}
            >
              {detailItem.title}
            </h2>
            <button
              onClick={closeDetail}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* 面板内容（可滚动） */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
            {/* 文本版本 Tab */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '16px',
                borderBottom: '1px solid var(--rule)',
                paddingBottom: '0',
              }}
            >
              {[
                { key: 'original' as const, label: '原文' },
                { key: 'simplified' as const, label: '转换' },
                { key: 'punctuated' as const, label: '标点' },
                { key: 'final' as const, label: '最终' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: detailTab === tab.key ? 'var(--accent)' : 'var(--muted)',
                    background: 'none',
                    border: 'none',
                    borderBottom: detailTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontWeight: detailTab === tab.key ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 文本内容 */}
            <div
              style={{
                fontSize: '14px',
                lineHeight: '2',
                color: 'var(--ink)',
                fontFamily: '"STSong", "SimSun", "宋体", serif',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                marginBottom: '24px',
                minHeight: '200px',
              }}
            >
              {getDetailTabText() || '暂无文本内容'}
            </div>

            {/* 来源信息 */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                  来源信息
                </h3>
                {!editingSource && (
                  <button
                    onClick={() => setEditingSource(true)}
                    style={{
                      fontSize: '13px',
                      color: 'var(--accent)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <EditIcon /> 编辑
                  </button>
                )}
              </div>

              {editingSource ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <FormInput
                    label="来源数据库"
                    value={editSourceData.sourceDb}
                    onChange={(v) => setEditSourceData((p) => ({ ...p, sourceDb: v }))}
                  />
                  <FormInput
                    label="书名"
                    value={editSourceData.bookName}
                    onChange={(v) => setEditSourceData((p) => ({ ...p, bookName: v }))}
                  />
                  <FormInput
                    label="版本"
                    value={editSourceData.version}
                    onChange={(v) => setEditSourceData((p) => ({ ...p, version: v }))}
                  />
                  <FormInput
                    label="卷/页码"
                    value={editSourceData.volumePage}
                    onChange={(v) => setEditSourceData((p) => ({ ...p, volumePage: v }))}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={handleSaveSource}
                      style={{
                        padding: '7px 18px',
                        backgroundColor: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingSource(false)}
                      style={{
                        padding: '7px 18px',
                        backgroundColor: '#fff',
                        color: 'var(--ink)',
                        border: '1px solid var(--rule)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '8px 12px', fontSize: '14px' }}>
                  <span style={{ color: 'var(--muted)' }}>数据库</span>
                  <span style={{ color: 'var(--ink)' }}>{detailItem.sourceDb || '-'}</span>
                  <span style={{ color: 'var(--muted)' }}>书名</span>
                  <span style={{ color: 'var(--ink)' }}>{detailItem.bookName || '-'}</span>
                  <span style={{ color: 'var(--muted)' }}>版本</span>
                  <span style={{ color: 'var(--ink)' }}>{detailItem.version || '-'}</span>
                  <span style={{ color: 'var(--muted)' }}>卷/页码</span>
                  <span style={{ color: 'var(--ink)' }}>{detailItem.volumePage || '-'}</span>
                </div>
              )}
            </div>

            {/* 标签 */}
            {(detailItem.tags || []).length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '10px' }}>
                  标签
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(detailItem.tags || []).map((tag, ti) => {
                    const tc = getTagColor(ti)
                    return (
                      <span
                        key={tag.id || ti}
                        style={{
                          padding: '3px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          backgroundColor: tc.bg,
                          color: tc.text,
                        }}
                      >
                        {tag.name}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 关联实体 */}
            {(detailItem.entities || []).length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '10px' }}>
                  关联实体
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(detailItem.entities || []).map((entity, ei) => (
                    <span
                      key={ei}
                      style={{
                        padding: '3px 12px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        backgroundColor: 'var(--bg2)',
                        color: 'var(--accent2)',
                      }}
                    >
                      {entity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 创建时间 */}
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              创建于 {formatDate(detailItem.createdAt)}
              {detailItem.updatedAt !== detailItem.createdAt && (
                <span style={{ marginLeft: '12px' }}>更新于 {formatDate(detailItem.updatedAt)}</span>
              )}
            </div>
          </div>

          {/* 面板底部 */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--rule)',
              display: 'flex',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => handleCitation(detailItem)}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <CitationIcon />
              生成引用
            </button>
          </div>
        </div>
      )}

      {/* 遮罩层（详情面板打开时） */}
      {showDetail && (
        <div
          onClick={closeDetail}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.2)',
            zIndex: 140,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* ===== 删除确认弹窗 ===== */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteConfirm(null)
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              width: '400px',
              maxWidth: '90vw',
              padding: '28px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              animation: 'slideUp 0.25s ease',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" width="24" height="24" style={{ color: '#dc2626' }}>
                <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>
              确认删除
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6', marginBottom: '24px' }}>
              删除后将无法恢复，确定要删除这条史料吗？
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#fff',
                  color: 'var(--ink)',
                  border: '1px solid var(--rule)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: deleting ? 'wait' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* ===== 引用生成弹窗 ===== */}
      {showCitation && citationMaterial && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCitation(false)
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              width: '560px',
              maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              animation: 'slideUp 0.25s ease',
              overflow: 'hidden',
            }}
          >
            {/* 头部 */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--rule)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                生成引用
              </h2>
              <button
                onClick={() => setShowCitation(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                }}
              >
                <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 格式选择 */}
            <div style={{ padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <FormatButton
                  active={citationFormat === 'gbt7714'}
                  onClick={() => handleCitationFormatChange('gbt7714')}
                >
                  GB/T 7714
                </FormatButton>
                <FormatButton
                  active={citationFormat === 'chicago'}
                  onClick={() => handleCitationFormatChange('chicago')}
                >
                  Chicago
                </FormatButton>
              </div>
            </div>

            {/* 引用文本 */}
            <div style={{ padding: '0 24px 20px' }}>
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg2)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  lineHeight: '1.8',
                  color: 'var(--ink)',
                  fontFamily: '"STSong", "SimSun", "宋体", serif',
                  minHeight: '80px',
                  position: 'relative',
                }}
              >
                {citationLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)' }}>
                    <svg viewBox="0 0 20 20" fill="none" width="16" height="16" style={{ color: 'var(--accent)' }}>
                      <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite" />
                      </path>
                    </svg>
                    生成中...
                  </div>
                ) : (
                  citationText
                )}
              </div>
            </div>

            {/* 底部 */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--rule)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
              }}
            >
              <button
                onClick={() => setShowCitation(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#fff',
                  color: 'var(--ink)',
                  border: '1px solid var(--rule)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                关闭
              </button>
              <button
                onClick={handleCopyCitation}
                disabled={citationLoading || !citationText}
                style={{
                  padding: '10px 20px',
                  backgroundColor: citationCopied ? '#16a34a' : 'var(--accent2)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: citationLoading || !citationText ? 'not-allowed' : 'pointer',
                  opacity: citationLoading || !citationText ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s',
                }}
              >
                {citationCopied ? (
                  <>
                    <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                      <path d="M5 10l3 3 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    已复制
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                      <rect x="6" y="6" width="11" height="11" rx="2" stroke="#fff" strokeWidth="1.5" />
                      <path d="M13 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v7a2 2 0 002 2h2" stroke="#fff" strokeWidth="1.5" />
                    </svg>
                    一键复制
                  </>
                )}
              </button>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* 全局动画 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/* ===================== 子组件 ===================== */

/* 表格/单元格样式 */
const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--muted)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  backgroundColor: 'var(--bg)',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '14px',
  color: 'var(--ink)',
  verticalAlign: 'middle',
}

/* 操作链接 */
function ActionLink({
  onClick,
  color,
  children,
}: {
  onClick: () => void
  color?: string
  children: React.ReactNode
}) {
  const c = color || 'var(--accent2)'
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: '13px',
        color: c,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        transition: 'opacity 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
    >
      {children}
    </button>
  )
}

/* 分页按钮 */
function PageButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        fontSize: '14px',
        borderRadius: '6px',
        border: '1px solid',
        borderColor: active ? 'var(--accent)' : 'var(--rule)',
        backgroundColor: active ? 'var(--accent)' : '#fff',
        color: active ? '#fff' : disabled ? 'var(--rule)' : 'var(--ink)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

/* 格式选择按钮 */
function FormatButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 18px',
        fontSize: '14px',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: active ? 'var(--accent2)' : 'var(--rule)',
        backgroundColor: active ? 'var(--accent2)' : '#fff',
        color: active ? '#fff' : 'var(--ink)',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

/* 表单输入 */
function FormInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: '13px',
          color: 'var(--muted)',
          marginBottom: '4px',
        }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid var(--rule)',
          borderRadius: '6px',
          fontSize: '14px',
          color: 'var(--ink)',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
      />
    </div>
  )
}

/* 加载状态 */
function LoadingState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 20px',
        color: 'var(--muted)',
      }}
    >
      <svg viewBox="0 0 20 20" fill="none" width="32" height="32" style={{ color: 'var(--accent)', marginBottom: '16px' }}>
        <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite" />
        </path>
      </svg>
      <div style={{ fontSize: '14px' }}>加载中...</div>
    </div>
  )
}

/* 空状态 */
function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 20px',
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid var(--rule)',
      }}
    >
      <BookshelfIcon />
      <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--ink)', marginBottom: '8px' }}>
        还没有史料
      </div>
      <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
        去识读页面添加
      </div>
    </div>
  )
}

/* ===== 图标 ===== */

function EyeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
      <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function CitationIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
      <path d="M6 2v7l3-2 3 2V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 13v-1.5a4 4 0 014-4h6a4 4 0 014 4V13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
      <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4M12 4v8a1.333 1.333 0 01-1.333 1.333H5.333A1.333 1.333 0 014 12V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
      <path d="M10.5 2.5l3 3L5 14H2v-3L10.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}