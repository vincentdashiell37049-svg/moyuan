import { useState, useRef, useCallback, useEffect } from 'react'
import api from '../services/api'
import PdfPageViewer from '../components/PdfPageViewer'

/* ===================== 类型定义 ===================== */

type PageState = 'idle' | 'uploaded' | 'processing' | 'done' | 'saving'

type StageStatus = 'waiting' | 'running' | 'done' | 'error'

interface UploadedFile {
  file: File
  previewUrl?: string
}

interface ProcessStage {
  key: string
  label: string
  status: StageStatus
  progress: number
}

interface OcrBlockResult {
  text: string
  confidence: number
}

interface OcrResultData {
  ocrText: string
  simplifiedText: string
  punctuatedText: string
  finalText: string
  blocks: OcrBlockResult[]
}

interface AiPunctuationResult {
  punctuated: string
  translation: string
  reasoning: string
  mode: 'ai' | 'rule'
  fallback?: boolean
}

interface Tag {
  id: string
  name: string
  color?: string
}

interface SaveForm {
  title: string
  sourceDb: string
  bookName: string
  version: string
  volumePage: string
  reliability: string
  tagIds: string[]
}

/* ===================== 常量 ===================== */

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/tiff',
  'image/tif',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024

const SOURCE_DB_OPTIONS = [
  { value: '中国基本古籍库', label: '中国基本古籍库' },
  { value: '四库全书', label: '四库全书' },
  { value: '其他', label: '其他' },
]

const RELIABILITY_OPTIONS = [
  { value: '一手史料', label: '一手史料' },
  { value: '二手史料', label: '二手史料' },
  { value: '编纂史料', label: '编纂史料' },
  { value: '存疑', label: '存疑' },
]

const INITIAL_STAGES: ProcessStage[] = [
  { key: 'upload', label: '上传', status: 'waiting', progress: 0 },
  { key: 'ocr', label: 'OCR识别', status: 'waiting', progress: 0 },
  { key: 'convert', label: '繁简转换', status: 'waiting', progress: 0 },
  { key: 'punctuate', label: '自动标点', status: 'waiting', progress: 0 },
  { key: 'layout', label: '版式转换', status: 'waiting', progress: 0 },
]

/* ===================== 工具函数 ===================== */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getConfidenceColor(confidence: number): string {
  if (confidence > 0.85) return '#16a34a'
  if (confidence >= 0.7) return '#ca8a04'
  return '#dc2626'
}

function getConfidenceLabel(confidence: number): string {
  if (confidence > 0.85) return '高'
  if (confidence >= 0.7) return '中'
  return '低'
}

function generateSaveTitle(files: UploadedFile[]): string {
  if (files.length === 0) return ''
  const name = files[0].file.name
  const dotIndex = name.lastIndexOf('.')
  return dotIndex > 0 ? name.substring(0, dotIndex) : name
}

/* ===================== 状态图标 ===================== */

function StageStatusIcon({ status }: { status: StageStatus }) {
  if (status === 'waiting') {
    return (
      <svg viewBox="0 0 20 20" fill="none" width="18" height="18" style={{ color: 'var(--rule)' }}>
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    )
  }
  if (status === 'running') {
    return (
      <svg viewBox="0 0 20 20" fill="none" width="18" height="18" style={{ color: 'var(--accent)' }}>
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
        <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite" />
        </path>
      </svg>
    )
  }
  if (status === 'done') {
    return (
      <svg viewBox="0 0 20 20" fill="none" width="18" height="18" style={{ color: '#16a34a' }}>
        <circle cx="10" cy="10" r="8" fill="#16a34a" fillOpacity="0.1" stroke="#16a34a" strokeWidth="1.5" />
        <path d="M7 10l2 2 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" width="18" height="18" style={{ color: '#dc2626' }}>
      <circle cx="10" cy="10" r="8" fill="#dc2626" fillOpacity="0.1" stroke="#dc2626" strokeWidth="1.5" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/* ===================== 主组件 ===================== */

export default function RecognizePage() {
  /* ---------- 状态 ---------- */
  const [pageState, setPageState] = useState<PageState>('idle')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [stages, setStages] = useState<ProcessStage[]>([])
  const [overallProgress, setOverallProgress] = useState(0)
  const [taskId, setTaskId] = useState<string>('')
  const [result, setResult] = useState<OcrResultData | null>(null)
  const [activeTab, setActiveTab] = useState<'ocr' | 'simplified' | 'final'>('ocr')
  const [editableText, setEditableText] = useState<Record<string, string>>({})
  const [error, setError] = useState<string>('')

  const [aiPunctuationResult, setAiPunctuationResult] = useState<AiPunctuationResult | null>(null)
  const [aiPunctuationLoading, setAiPunctuationLoading] = useState(false)
  const [aiPunctuationError, setAiPunctuationError] = useState<string>('')

  /* 保存弹窗 */
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [saveForm, setSaveForm] = useState<SaveForm>({
    title: '',
    sourceDb: '',
    bookName: '',
    version: '',
    volumePage: '',
    reliability: '',
    tagIds: [],
  })
  const [saveError, setSaveError] = useState('')

  /* 导出下拉 */
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  /* 文件输入 */
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* 轮询定时器 */
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ---------- 清理轮询 ---------- */
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
      }
    }
  }, [])

  /* ---------- 关闭导出下拉 ---------- */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  /* ---------- 文件选择 ---------- */
  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const validFiles: UploadedFile[] = []
    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i]
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setError(`文件 "${f.name}" 格式不支持，请上传 PDF / JPG / PNG / TIF 格式`)
        continue
      }
      if (f.size > MAX_FILE_SIZE) {
        setError(`文件 "${f.name}" 超过 50MB 大小限制`)
        continue
      }
      const previewUrl = URL.createObjectURL(f)
      validFiles.push({ file: f, previewUrl })
    }

    if (validFiles.length > 0) {
      setError('')
      setFiles((prev) => [...prev, ...validFiles])
      setPageState('uploaded')
    }
  }, [])

  /* 拖拽处理 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect],
  )

  /* 移除文件 */
  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => {
      const removed = prev[index]
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
    if (files.length <= 1) {
      setPageState('idle')
    }
  }, [files.length])

  /* ---------- 开始处理 ---------- */
  const handleStartProcess = useCallback(async () => {
    if (files.length === 0) return
    setError('')
    setPageState('processing')
    setStages(INITIAL_STAGES.map((s) => ({ ...s })))
    setOverallProgress(0)

    try {
      /* 上传文件 */
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f.file))

      setStages((prev) => updateStage(prev, 'upload', 'running', 30))

      const uploadRes = await fetch('/api/ocr/upload', {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) throw new Error('上传失败')
      const uploadJson = await uploadRes.json()
      const tid = uploadJson.taskId || uploadJson.data?.taskId || uploadJson.data?.id
      if (!tid) throw new Error('上传响应缺少 taskId')
      setTaskId(String(tid))

      setStages((prev) => updateStage(prev, 'upload', 'done', 100))

      /* 触发处理 */
      setStages((prev) => updateStage(prev, 'ocr', 'running', 10))
      await fetch(`/api/ocr/process/${tid}`, { method: 'POST' })

      /* 开始轮询 */
      pollTimerRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/ocr/status/${tid}`)
          if (!statusRes.ok) return
          const statusJson = await statusRes.json()
          const sd = statusJson.data || statusJson

          if (!sd) return

          /* 根据阶段更新进度 */
          const currentStage = sd.stage || sd.currentStage || 'ocr'
          const stageProgress = sd.progress ?? 0

          setStages((prev) => {
            const next = [...prev]
            /* 完成上传阶段 */
            next[0] = { ...next[0], status: 'done' as StageStatus, progress: 100 }

            /* 更新当前阶段 */
            const stageMap: Record<string, number> = {
              upload: 0, ocr: 1, convert: 2, punctuate: 3, layout: 4,
            }
            const idx = stageMap[currentStage] ?? 1

            for (let i = 1; i < idx; i++) {
              next[i] = { ...next[i], status: 'done' as StageStatus, progress: 100 }
            }
            next[idx] = {
              ...next[idx],
              status: 'running' as StageStatus,
              progress: Math.min(stageProgress, 99),
            }

            /* 计算总体进度 */
            const total = next.reduce((sum, s) => sum + s.progress, 0) / next.length
            setOverallProgress(Math.round(total))

            return next
          })

          /* 检查是否完成 */
          if (sd.status === 'done' || sd.status === 'completed' || sd.finished === true) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current)
            pollTimerRef.current = null

            setStages((prev) => prev.map((s) => ({ ...s, status: 'done' as StageStatus, progress: 100 })))
            setOverallProgress(100)

            /* 获取结果 */
            const resultRes = await fetch(`/api/ocr/result/${tid}`)
            if (!resultRes.ok) throw new Error('获取结果失败')
            const resultJson = await resultRes.json()
            const rd = resultJson.data || resultJson.result || resultJson

            const ocrResult: OcrResultData = {
              ocrText: rd.ocrText || rd.originalText || rd.rawText || rd.text || '',
              simplifiedText: rd.simplifiedText || rd.convertedText || rd.simplified || '',
              punctuatedText: rd.punctuatedText || rd.punctuated || '',
              finalText: rd.finalText || rd.result || rd.text || '',
              blocks: (rd.blocks || []).map((b: { text?: string; confidence?: number }) => ({
                text: b.text || '',
                confidence: b.confidence ?? 0.8,
              })),
            }

            setResult(ocrResult)
            setEditableText({
              ocr: ocrResult.ocrText,
              simplified: ocrResult.simplifiedText,
              final: ocrResult.finalText,
            })
            setPageState('done')
          }
        } catch {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
          setError('处理过程中发生错误，请重试')
          setPageState('uploaded')
        }
      }, 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '处理失败'
      setError(msg)
      setPageState('uploaded')
    }
  }, [files])

  /* ---------- 重新处理 ---------- */
  const handleReprocess = useCallback(() => {
    setResult(null)
    setEditableText({})
    setActiveTab('ocr')
    setOverallProgress(0)
    setAiPunctuationResult(null)
    setAiPunctuationError('')
    setAiPunctuationLoading(false)
    setPageState('uploaded')
  }, [])

  /* ---------- 导出 ---------- */
  const handleExport = useCallback(
    (format: 'markdown' | 'text') => {
      if (!result) return
      const text = result.finalText || result.ocrText
      let content = ''
      let filename = '识读结果'

      if (format === 'markdown') {
        content = `# ${generateSaveTitle(files)}\n\n${text}`
        filename += '.md'
      } else {
        content = text
        filename += '.txt'
      }

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setShowExportMenu(false)
    },
    [result, files],
  )

  /* ---------- 保存相关 ---------- */
  const openSaveModal = useCallback(async () => {
    try {
      const tagList = await api.get<Tag[]>('/api/tags')
      setTags(tagList || [])
    } catch {
      setTags([])
    }
    setSaveForm({
      title: generateSaveTitle(files),
      sourceDb: '',
      bookName: '',
      version: '',
      volumePage: '',
      reliability: '',
      tagIds: [],
    })
    setSaveError('')
    setShowSaveModal(true)
  }, [files])

  const handleSave = useCallback(async () => {
    if (!saveForm.title.trim()) {
      setSaveError('请输入标题')
      return
    }
    if (!result) return

    setSaveError('')
    setPageState('saving')

    try {
      await api.post('/api/ocr/save', {
        taskId,
        title: saveForm.title,
        sourceDb: saveForm.sourceDb,
        bookName: saveForm.bookName,
        version: saveForm.version,
        volumePage: saveForm.volumePage,
        reliability: saveForm.reliability,
        tagIds: saveForm.tagIds,
        ocrText: editableText.ocr,
        simplifiedText: editableText.simplified,
        finalText: editableText.final,
      })
      setShowSaveModal(false)
      setPageState('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败'
      setSaveError(msg)
      setPageState('done')
    }
  }, [saveForm, result, taskId, editableText])

  const toggleTag = useCallback((tagId: string) => {
    setSaveForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }))
  }, [])

  /* ---------- 重置 ---------- */
  const handleReset = useCallback(() => {
    files.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
    })
    setFiles([])
    setStages([])
    setOverallProgress(0)
    setTaskId('')
    setResult(null)
    setEditableText({})
    setActiveTab('ocr')
    setError('')
    setAiPunctuationResult(null)
    setAiPunctuationError('')
    setAiPunctuationLoading(false)
    setPageState('idle')
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [files])

  /* ---------- 当前 tab 文本 ---------- */
  const currentTabText = result
    ? activeTab === 'ocr'
      ? editableText.ocr
      : activeTab === 'simplified'
      ? editableText.simplified
      : editableText.final
    : ''

  const handleTabTextChange = useCallback(
    (val: string) => {
      setEditableText((prev) => ({ ...prev, [activeTab]: val }))
    },
    [activeTab],
  )

  /* ---------- AI 自动标点 ---------- */
  const handleAiPunctuate = useCallback(async () => {
    if (!result) return
    setAiPunctuationLoading(true)
    setAiPunctuationError('')
    setAiPunctuationResult(null)

    try {
      const sourceText = editableText.simplified || result.simplifiedText || result.ocrText
      const res = await fetch('/api/ai/punctuate-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText }),
      })
      if (!res.ok) throw new Error('请求失败')
      const data = await res.json()
      const pr: AiPunctuationResult = {
        punctuated: data.punctuated || data.text || '',
        translation: data.translation || data.vernacular || '',
        reasoning: data.reasoning || data.explanation || '',
        mode: data.mode || 'rule',
        fallback: data.fallback,
      }
      setAiPunctuationResult(pr)
      setEditableText((prev) => ({ ...prev, simplified: pr.punctuated }))
    } catch (err) {
      setAiPunctuationError(err instanceof Error ? err.message : 'AI 标点请求失败')
    } finally {
      setAiPunctuationLoading(false)
    }
  }, [result, editableText.simplified])

  /* ===================== 渲染 ===================== */

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--ink)',
            marginBottom: '8px',
            fontFamily: '"STKaiti", "KaiTi", "楷体", serif',
          }}
        >
          古籍识读
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.6' }}>
          上传古籍文献图片，通过 OCR 技术自动识别文字内容，支持繁体、异体字的智能识别与校正。
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg viewBox="0 0 20 20" fill="none" width="18" height="18" style={{ flexShrink: 0 }}>
            <circle cx="10" cy="10" r="9" stroke="#dc2626" strokeWidth="1.5" />
            <path d="M10 6v5M10 13.5v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
          <button
            onClick={() => setError('')}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#dc2626',
              padding: '0',
              fontSize: '14px',
            }}
          >
            <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* ===== idle 状态：上传区域 ===== */}
      {pageState === 'idle' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            border: '2px dashed var(--rule)',
            borderRadius: '16px',
            padding: '80px 40px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: 'rgba(255,255,255,0.5)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.backgroundColor = 'rgba(185,28,28,0.03)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--rule)'
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          {/* 上传图标 */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg2)',
              marginBottom: '20px',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p
            style={{
              fontSize: '16px',
              color: 'var(--ink)',
              marginBottom: '8px',
              fontWeight: 500,
            }}
          >
            拖拽古籍图片或PDF到此处，或点击选择文件
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '12px',
            }}
          >
            {['PDF', 'JPG', 'PNG', 'TIF'].map((fmt) => (
              <span
                key={fmt}
                style={{
                  fontSize: '12px',
                  padding: '2px 10px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg2)',
                  color: 'var(--muted)',
                  fontWeight: 500,
                  letterSpacing: '0.5px',
                }}
              >
                {fmt}
              </span>
            ))}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
            单文件最大 50MB
          </p>
        </div>
      )}

      {/* ===== uploaded 状态：文件列表 ===== */}
      {pageState === 'uploaded' && (
        <div>
          {/* 文件列表 */}
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              border: '1px solid var(--rule)',
              overflow: 'hidden',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--rule)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--ink)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg viewBox="0 0 20 20" fill="none" width="16" height="16" style={{ color: 'var(--accent)' }}>
                <path d="M4 4a2 2 0 012-2h4l2 2h4a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              已选择 {files.length} 个文件
            </div>
            {files.map((f, idx) => (
              <div
                key={`${f.file.name}-${idx}`}
                style={{
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderTop: idx > 0 ? '1px solid var(--rule)' : 'none',
                  fontSize: '14px',
                }}
              >
                {/* 文件图标 */}
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {f.file.type === 'application/pdf' ? (
                    <svg viewBox="0 0 20 20" fill="none" width="20" height="20" style={{ color: '#dc2626' }}>
                      <path d="M6 2h5l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M11 2l4 4h-4V2z" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M7 11h6M7 14h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="none" width="20" height="20" style={{ color: 'var(--accent2)' }}>
                      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="7.5" cy="8" r="1.5" stroke="currentColor" strokeWidth="1" />
                      <path d="M3 14l4-4 3 3 2-2 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.file.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    {formatFileSize(f.file.size)}
                  </div>
                </div>
                {/* 移除按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile(idx)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                  title="移除"
                >
                  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleStartProcess}
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                <polygon points="6,4 16,10 6,16" fill="#fff" />
              </svg>
              开始处理
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#fff',
                color: 'var(--ink)',
                border: '1px solid var(--rule)',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
            >
              <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                <line x1="10" y1="4" x2="10" y2="16" stroke="currentColor" strokeWidth="1.5" />
                <line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              继续添加
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '10px 20px',
                backgroundColor: '#fff',
                color: 'var(--muted)',
                border: '1px solid var(--rule)',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            >
              清空
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
      )}

      {/* ===== processing 状态：处理进度 ===== */}
      {pageState === 'processing' && (
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid var(--rule)',
            padding: '32px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '28px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(185,28,28,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 20 20" fill="none" width="22" height="22" style={{ color: 'var(--accent)' }}>
                <path d="M10 2a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite" />
                </path>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
                正在处理中...
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '2px' }}>
                {files.map((f) => f.file.name).join('、')}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>
              {overallProgress}%
            </div>
          </div>

          {/* 总进度条 */}
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'var(--bg2)',
              borderRadius: '3px',
              overflow: 'hidden',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                width: `${overallProgress}%`,
                height: '100%',
                backgroundColor: 'var(--accent)',
                borderRadius: '3px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>

          {/* 各阶段 */}
          {stages.map((stage, idx) => (
            <div
              key={stage.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '12px 0',
                borderTop: idx > 0 ? '1px solid var(--bg2)' : 'none',
              }}
            >
              <StageStatusIcon status={stage.status} />
              <div style={{ width: '80px', fontSize: '14px', fontWeight: 500, color: 'var(--ink)', flexShrink: 0 }}>
                {stage.label}
              </div>
              <div
                style={{
                  flex: 1,
                  height: '4px',
                  backgroundColor: 'var(--bg2)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${stage.progress}%`,
                    height: '100%',
                    backgroundColor:
                      stage.status === 'done'
                        ? '#16a34a'
                        : stage.status === 'running'
                        ? 'var(--accent)'
                        : stage.status === 'error'
                        ? '#dc2626'
                        : 'var(--rule)',
                    borderRadius: '2px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <div
                style={{
                  width: '40px',
                  textAlign: 'right',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  flexShrink: 0,
                }}
              >
                {stage.progress}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== done 状态：对照视图 ===== */}
      {pageState === 'done' && result && (
        <div>
          {/* 工具栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
              识别完成，共 {result.blocks.length} 个文本块
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={openSaveModal}
                disabled={pageState === 'saving'}
                style={{
                  padding: '8px 20px',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: pageState === 'saving' ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'opacity 0.15s',
                  opacity: pageState === 'saving' ? 0.7 : 1,
                }}
              >
                {pageState === 'saving' ? (
                  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M10 2a8 8 0 0 1 8 8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round">
                      <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite" />
                    </path>
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="9" cy="7" r="4" stroke="#fff" strokeWidth="1.5" />
                    <line x1="19" y1="8" x2="19" y2="14" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="22" y1="11" x2="16" y2="11" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
                {pageState === 'saving' ? '保存中...' : '保存到史料库'}
              </button>

              {/* 导出下拉 */}
              <div ref={exportMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#fff',
                    color: 'var(--ink)',
                    border: '1px solid var(--rule)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
                >
                  <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                    <path d="M6 2v9l4-3 4 3V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 17v-2a5 5 0 015-5h6a5 5 0 015 5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  导出
                  <svg viewBox="0 0 12 12" fill="none" width="12" height="12">
                    <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {showExportMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: '#fff',
                      border: '1px solid var(--rule)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 20,
                      minWidth: '140px',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => handleExport('markdown')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '10px 16px',
                        fontSize: '14px',
                        color: 'var(--ink)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      Markdown
                    </button>
                    <button
                      onClick={() => handleExport('text')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '10px 16px',
                        fontSize: '14px',
                        color: 'var(--ink)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      纯文本
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleReprocess}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#fff',
                  color: 'var(--muted)',
                  border: '1px solid var(--rule)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
                  <path d="M4 10a6 6 0 0111.5-2M16 10a6 6 0 01-11.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M16 4v4h-4M4 16v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                重新处理
              </button>
            </div>
          </div>

          {/* 左右分栏对照视图 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
              minHeight: '500px',
            }}
          >
            {/* 左栏 - 原始图片 */}
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid var(--rule)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--rule)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16" style={{ color: 'var(--accent2)' }}>
                  <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="7" cy="8" r="1.5" stroke="currentColor" strokeWidth="1" />
                  <path d="M2 14l4.5-4.5L10 13l2.5-3L18 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                原始图片
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'auto',
                  backgroundColor: 'var(--bg2)',
                }}
              >
              {files[0]?.previewUrl ? (
                  files[0]?.file.type === 'application/pdf' ? (
                    <PdfPageViewer pdfUrl={files[0].previewUrl} />
                  ) : (
                    <img
                      src={files[0].previewUrl}
                      alt="原始图片"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        borderRadius: '4px',
                      }}
                    />
                  )
                ) : (
                  <div
                    style={{
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: '14px',
                    }}
                  >
                    <svg viewBox="0 0 20 20" fill="none" width="48" height="48" style={{ color: 'var(--rule)', marginBottom: '12px' }}>
                      <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M7 11l3-3 3 3M10 8v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>{files[0]?.file.name || 'PDF 文件'}</div>
                    <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--muted)' }}>
                      图片文件支持预览
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 右栏 - 识读结果 */}
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid var(--rule)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--rule)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <svg viewBox="0 0 20 20" fill="none" width="16" height="16" style={{ color: 'var(--accent)' }}>
                  <path d="M4 4h12a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 7h10M5 10h8M5 13h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                  识读结果
                </span>
              </div>

              {/* Tab 切换 */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--rule)',
                  padding: '0 20px',
                }}
              >
                {[
                  { key: 'ocr' as const, label: 'OCR原文' },
                  { key: 'simplified' as const, label: '简体标点' },
                  { key: 'final' as const, label: '最终文本' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '10px 16px',
                      fontSize: '14px',
                      color: activeTab === tab.key ? 'var(--accent)' : 'var(--muted)',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                      cursor: 'pointer',
                      fontWeight: activeTab === tab.key ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 文本编辑区 + AI 结果 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                {/* 可编辑文本行 */}
                <div style={{ display: 'flex', minHeight: '280px', flex: '1 0 auto' }}>
                  {/* 置信度色条 */}
                  <div
                    style={{
                      width: '6px',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '16px 0',
                    }}
                  >
                    {result.blocks.length > 0
                      ? result.blocks.map((block, i) => (
                          <div
                            key={i}
                            title={`置信度: ${(block.confidence * 100).toFixed(0)}% (${getConfidenceLabel(block.confidence)})`}
                            style={{
                              flex: 1,
                              backgroundColor: getConfidenceColor(block.confidence),
                              opacity: 0.8,
                              borderRadius: '1px',
                              cursor: 'help',
                            }}
                          />
                        ))
                      : Array.from({ length: 10 }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              backgroundColor: getConfidenceColor(0.85),
                              opacity: 0.3,
                              borderRadius: '1px',
                            }}
                          />
                        ))}
                  </div>
                  {/* 可编辑文本 */}
                  <textarea
                    value={currentTabText}
                    onChange={(e) => handleTabTextChange(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '16px',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      fontSize: '15px',
                      lineHeight: '2',
                      color: 'var(--ink)',
                      fontFamily: '"STSong", "SimSun", "宋体", serif',
                      backgroundColor: 'transparent',
                    }}
                    placeholder="暂无识别结果"
                  />
                </div>

                {/* AI 自动标点（仅简体标点 Tab） */}
                {activeTab === 'simplified' && (
                  <div
                    style={{
                      padding: '16px 20px',
                      borderTop: '1px solid var(--rule)',
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                        AI 智能处理
                      </span>
                      <button
                        onClick={handleAiPunctuate}
                        disabled={aiPunctuationLoading}
                        style={{
                          padding: '8px 18px',
                          backgroundColor: aiPunctuationLoading ? 'var(--rule)' : 'var(--accent)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: aiPunctuationLoading ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!aiPunctuationLoading) e.currentTarget.style.opacity = '0.85'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1'
                        }}
                      >
                        {aiPunctuationLoading ? (
                          <>
                            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                              <path d="M10 2a8 8 0 0 1 8 8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round">
                                <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite" />
                              </path>
                            </svg>
                            AI 处理中...
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                              <path d="M10 2a2 2 0 0 1 2 2v4.5l2.6-1.5a2 2 0 0 1 2.7 2.7l-2.6 1.5 2.6 1.5a2 2 0 1 1-2.7 2.7L12 13.5V18a2 2 0 1 1-4 0v-4.5l-2.6 1.5a2 2 0 1 1-2.7-2.7l2.6-1.5-2.6-1.5a2 2 0 1 1 2.7-2.7L8 8.5V4a2 2 0 0 1 2-2z" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            AI 自动标点
                          </>
                        )}
                      </button>
                    </div>

                    {aiPunctuationError && (
                      <div
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#fef2f2',
                          borderRadius: '6px',
                          color: '#dc2626',
                          fontSize: '13px',
                          marginBottom: '12px',
                        }}
                      >
                        {aiPunctuationError}
                      </div>
                    )}

                    {aiPunctuationResult && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div
                          style={{
                            padding: '12px',
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            border: '1px solid var(--rule)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--accent)',
                              fontWeight: 600,
                              marginBottom: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                              <path d="M5 3h10a2 2 0 0 1 2 2v12l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L5 17V5a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            标点文本
                            {aiPunctuationResult.mode === 'rule' && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--muted)',
                                  fontWeight: 400,
                                  marginLeft: 'auto',
                                }}
                              >
                                规则模式
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '14px',
                              lineHeight: '1.8',
                              color: 'var(--ink)',
                              fontFamily: '"STSong", "SimSun", "宋体", serif',
                            }}
                          >
                            {aiPunctuationResult.punctuated}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '12px',
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            border: '1px solid var(--rule)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--accent2)',
                              fontWeight: 600,
                              marginBottom: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                              <path d="M7 9h6M7 12h4M5 3h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            白话文翻译
                          </div>
                          <div
                            style={{
                              fontSize: '14px',
                              lineHeight: '1.8',
                              color: 'var(--ink)',
                            }}
                          >
                            {aiPunctuationResult.translation}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '12px',
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            border: '1px solid var(--rule)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--accent2)',
                              fontWeight: 600,
                              marginBottom: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                              <path d="M9.5 3a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM2 9.5a7.5 7.5 0 1 1 14.7 2.5M15 15l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            断句理由
                          </div>
                          <div
                            style={{
                              fontSize: '13px',
                              lineHeight: '1.7',
                              color: 'var(--muted)',
                            }}
                          >
                            {aiPunctuationResult.reasoning}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 保存弹窗 ===== */}
      {showSaveModal && (
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
            if (e.target === e.currentTarget) setShowSaveModal(false)
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              width: '560px',
              maxWidth: '90vw',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              animation: 'slideUp 0.25s ease',
            }}
          >
            {/* 弹窗头部 */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--rule)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)' }}>
                保存到史料库
              </h2>
              <button
                onClick={() => setShowSaveModal(false)}
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

            {/* 弹窗内容 */}
            <div style={{ padding: '24px' }}>
              {saveError && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '10px 14px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#dc2626',
                    fontSize: '14px',
                  }}
                >
                  {saveError}
                </div>
              )}

              {/* 标题 */}
              <div style={{ marginBottom: '18px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--ink)',
                    marginBottom: '6px',
                  }}
                >
                  标题 <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={saveForm.title}
                  onChange={(e) => setSaveForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="请输入标题"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid var(--rule)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--ink)',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
                />
              </div>

              {/* 来源于数据库 + 可信度 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--ink)',
                      marginBottom: '6px',
                    }}
                  >
                    来源数据库
                  </label>
                  <select
                    value={saveForm.sourceDb}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, sourceDb: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid var(--rule)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: 'var(--ink)',
                      backgroundColor: '#fff',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">请选择</option>
                    {SOURCE_DB_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--ink)',
                      marginBottom: '6px',
                    }}
                  >
                    可信度
                  </label>
                  <select
                    value={saveForm.reliability}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, reliability: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid var(--rule)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: 'var(--ink)',
                      backgroundColor: '#fff',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">请选择</option>
                    {RELIABILITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 书名 + 版本 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--ink)',
                      marginBottom: '6px',
                    }}
                  >
                    书名
                  </label>
                  <input
                    type="text"
                    value={saveForm.bookName}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, bookName: e.target.value }))}
                    placeholder="请输入书名"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid var(--rule)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: 'var(--ink)',
                      outline: 'none',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--ink)',
                      marginBottom: '6px',
                    }}
                  >
                    版本
                  </label>
                  <input
                    type="text"
                    value={saveForm.version}
                    onChange={(e) => setSaveForm((prev) => ({ ...prev, version: e.target.value }))}
                    placeholder="如：明万历刻本"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid var(--rule)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: 'var(--ink)',
                      outline: 'none',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
                  />
                </div>
              </div>

              {/* 卷/页码 */}
              <div style={{ marginBottom: '18px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--ink)',
                    marginBottom: '6px',
                  }}
                >
                  卷/页码
                </label>
                <input
                  type="text"
                  value={saveForm.volumePage}
                  onChange={(e) => setSaveForm((prev) => ({ ...prev, volumePage: e.target.value }))}
                  placeholder="如：卷三 第12页"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid var(--rule)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
                />
              </div>

              {/* 标签选择 */}
              {tags.length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--ink)',
                      marginBottom: '8px',
                    }}
                  >
                    标签
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {tags.map((tag) => {
                      const isSelected = saveForm.tagIds.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          style={{
                            padding: '5px 14px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            border: isSelected
                              ? '1px solid var(--accent)'
                              : '1px solid var(--rule)',
                            backgroundColor: isSelected ? 'rgba(185,28,28,0.08)' : '#fff',
                            color: isSelected ? 'var(--accent)' : 'var(--muted)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {tag.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
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
                onClick={() => setShowSaveModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#fff',
                  color: 'var(--ink)',
                  border: '1px solid var(--rule)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={pageState === 'saving'}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: pageState === 'saving' ? 'wait' : 'pointer',
                  opacity: pageState === 'saving' ? 0.7 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {pageState === 'saving' ? '保存中...' : '确认保存'}
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
    </div>
  )
}

/* ===================== 辅助函数 ===================== */

function updateStage(
  stages: ProcessStage[],
  key: string,
  status: StageStatus,
  progress: number,
): ProcessStage[] {
  return stages.map((s) => (s.key === key ? { ...s, status, progress } : s))
}