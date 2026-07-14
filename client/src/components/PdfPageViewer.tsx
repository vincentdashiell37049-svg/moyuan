import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

interface PdfPageViewerProps {
  pdfUrl: string
}

export default function PdfPageViewer({ pdfUrl }: PdfPageViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [selectedPage, setSelectedPage] = useState(1)
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({})
  const [mainImage, setMainImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  /* ---------- 加载 PDF ---------- */
  useEffect(() => {
    if (!pdfUrl) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    setPageCount(0)
    setSelectedPage(1)
    setThumbnails({})
    setMainImage(null)

    const load = async () => {
      try {
        const loadingTask = pdfjs.getDocument({ url: pdfUrl })
        loadingTask.onProgress = () => {
          if (controller.signal.aborted) loadingTask.destroy()
        }
        const doc = await loadingTask.promise
        if (controller.signal.aborted) {
          ;(doc as any).destroy?.()
          return
        }
        setPdfDoc(doc)
        setPageCount(doc.numPages)
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'PDF 加载失败')
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      controller.abort()
      abortRef.current = null
    }
  }, [pdfUrl])

  /* ---------- 渲染单页到 data URL ---------- */
  const renderPageToDataUrl = async (
    doc: pdfjs.PDFDocumentProxy,
    pageNum: number,
    scale: number
  ): Promise<string> => {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 canvas 上下文')

    const dpr = window.devicePixelRatio || 1
    canvas.width = viewport.width * dpr
    canvas.height = viewport.height * dpr
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`

    await page.render({
      canvasContext: ctx as any,
      viewport,
      canvas,
      transform: [dpr, 0, 0, dpr, 0, 0],
    }).promise

    page.cleanup()
    return canvas.toDataURL('image/png')
  }

  /* ---------- 生成所有缩略图 ---------- */
  useEffect(() => {
    if (!pdfDoc || pageCount === 0) return

    const controller = new AbortController()
    abortRef.current = controller

    const generate = async () => {
      const thumbs: Record<number, string> = {}
      for (let i = 1; i <= pageCount; i++) {
        if (controller.signal.aborted) return
        try {
          const url = await renderPageToDataUrl(pdfDoc, i, 0.25)
          thumbs[i] = url
          if (i === 1 && !controller.signal.aborted) {
            setThumbnails({ ...thumbs })
          } else if (!controller.signal.aborted) {
            setThumbnails((prev) => ({ ...prev, [i]: url }))
          }
        } catch (err) {
          console.error(`缩略图生成失败（第 ${i} 页）:`, err)
        }
      }
      if (!controller.signal.aborted) setLoading(false)
    }

    generate()
    return () => {
      controller.abort()
    }
  }, [pdfDoc, pageCount])

  /* ---------- 渲染主图 ---------- */
  useEffect(() => {
    if (!pdfDoc || selectedPage < 1 || selectedPage > pageCount) return

    const controller = new AbortController()
    let revoked = false

    const render = async () => {
      try {
        const url = await renderPageToDataUrl(pdfDoc, selectedPage, 1.8)
        if (controller.signal.aborted) return
        setMainImage((prev) => {
          if (prev && !revoked) {
            // data URL 不需要 revoke，直接覆盖即可
          }
          return url
        })
      } catch (err) {
        console.error('主图渲染失败:', err)
      }
    }

    render()
    return () => {
      controller.abort()
      revoked = true
    }
  }, [pdfDoc, selectedPage, pageCount])

  if (error) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#dc2626',
          fontSize: '14px',
        }}
      >
        PDF 预览失败：{error}
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* 左侧缩略图栏 */}
      <div
        style={{
          width: '160px',
          flexShrink: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: 'var(--bg2)',
          borderRight: '1px solid var(--rule)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {loading && pageCount === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: '12px', textAlign: 'center' }}>
            加载 PDF 中...
          </div>
        )}
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => setSelectedPage(pageNum)}
            style={{
              width: '100%',
              padding: '6px',
              borderRadius: '6px',
              border: selectedPage === pageNum ? '2px solid var(--accent)' : '1px solid var(--rule)',
              backgroundColor: selectedPage === pageNum ? '#fff8f8' : '#fff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s',
              boxShadow: selectedPage === pageNum ? '0 2px 8px rgba(185,28,28,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            {thumbnails[pageNum] ? (
              <img
                src={thumbnails[pageNum]}
                alt={`第 ${pageNum} 页`}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '3px',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '3 / 4',
                  borderRadius: '3px',
                  backgroundColor: 'var(--bg2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  fontSize: '12px',
                }}
              >
                {pageNum}
              </div>
            )}
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
              第 {pageNum} 页
            </span>
          </button>
        ))}
      </div>

      {/* 右侧大图 */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#e8e6e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        {mainImage ? (
          <img
            src={mainImage}
            alt={`第 ${selectedPage} 页`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '4px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              backgroundColor: '#fff',
            }}
          />
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: '14px' }}>
            {loading ? '渲染中...' : '选择左侧页码查看大图'}
          </div>
        )}
      </div>
    </div>
  )
}
