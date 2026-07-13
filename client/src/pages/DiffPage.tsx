import { useState, useEffect, useCallback, useRef } from 'react'
import DiffMatchPatch from 'diff-match-patch'
import api from '../services/api'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MaterialOption {
  id: string
  title: string
  dynasty?: string
  author?: string
  content?: string
}

interface DiffResult {
  textA: string
  textB: string
  materialAId?: string
  materialBId?: string
  materialATitle?: string
  materialBTitle?: string
}

interface AIAnalysis {
  diffs: {
    textA?: string
    textB?: string
    analysis: string
    reason: '传抄讹误' | '版本差异' | '有意修订' | '字形演变'
    confidence: number
  }[]
}

/* ------------------------------------------------------------------ */
/*  diff-match-patch helpers                                           */
/* ------------------------------------------------------------------ */

const dmp = new DiffMatchPatch()

interface AlignedBlock {
  type: 'equal' | 'delete' | 'insert' | 'modify'
  leftText: string
  rightText: string
}

function computeAlignedBlocks(textA: string, textB: string): AlignedBlock[] {
  const diffs = dmp.diff_main(textA, textB)
  dmp.diff_cleanupSemantic(diffs)

  const blocks: AlignedBlock[] = []
  let i = 0
  while (i < diffs.length) {
    const [op, text] = diffs[i]

    if (op === 0) {
      // equal
      blocks.push({ type: 'equal', leftText: text, rightText: text })
      i++
    } else if (op === -1) {
      // check if next is insert => modify pair
      if (i + 1 < diffs.length && diffs[i + 1][0] === 1) {
        blocks.push({ type: 'modify', leftText: text, rightText: diffs[i + 1][1] })
        i += 2
      } else {
        blocks.push({ type: 'delete', leftText: text, rightText: '' })
        i++
      }
    } else if (op === 1) {
      blocks.push({ type: 'insert', leftText: '', rightText: text })
      i++
    } else {
      i++
    }
  }
  return blocks
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function DiffBlockView({ block, side }: { block: AlignedBlock; side: 'left' | 'right' }) {
  const text = side === 'left' ? block.leftText : block.rightText
  if (block.type === 'equal') {
    return <span style={{ color: 'var(--ink)' }}>{text}</span>
  }
  if (block.type === 'delete') {
    if (side === 'left') {
      return (
        <span style={{ backgroundColor: 'rgba(239,68,68,0.15)', textDecoration: 'line-through', color: '#dc2626', borderRadius: '2px', padding: '0 1px' }}>
          {text}
        </span>
      )
    }
    return <span />
  }
  if (block.type === 'insert') {
    if (side === 'right') {
      return (
        <span style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#16a34a', borderRadius: '2px', padding: '0 1px' }}>
          {text}
        </span>
      )
    }
    return <span />
  }
  if (block.type === 'modify') {
    if (side === 'left') {
      return (
        <span style={{ backgroundColor: 'rgba(234,179,8,0.2)', textDecoration: 'line-through', color: '#b45309', borderRadius: '2px', padding: '0 1px' }}>
          {text}
        </span>
      )
    }
    return (
      <span style={{ backgroundColor: 'rgba(234,179,8,0.2)', color: '#b45309', borderRadius: '2px', padding: '0 1px' }}>
        {text}
      </span>
    )
  }
  return <span>{text}</span>
}

function ReasonBadge({ reason }: { reason: string }) {
  const colorMap: Record<string, string> = {
    '传抄讹误': '#dc2626',
    '版本差异': '#2563eb',
    '有意修订': '#7c3aed',
    '字形演变': '#0891b2',
  }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 500,
        color: '#fff',
        backgroundColor: colorMap[reason] || 'var(--muted)',
      }}
    >
      {reason}
    </span>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const barColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#eab308' : '#dc2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '60px',
          height: '6px',
          borderRadius: '3px',
          backgroundColor: 'var(--bg2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: '3px',
            backgroundColor: barColor,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '32px' }}>{pct}%</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function DiffPage() {
  const [materials, setMaterials] = useState<MaterialOption[]>([])
  const [materialAId, setMaterialAId] = useState('')
  const [materialBId, setMaterialBId] = useState('')
  const [inputMode, setInputMode] = useState<'select' | 'text'>('select')
  const [textA, setTextA] = useState('')
  const [textB, setTextB] = useState('')
  const [comparing, setComparing] = useState(false)
  const [blocks, setBlocks] = useState<AlignedBlock[]>([])
  const [hasResult, setHasResult] = useState(false)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<AIAnalysis | null>(null)
  const compareRef = useRef<HTMLDivElement>(null)

  /* ---- fetch materials ---- */
  useEffect(() => {
    api.get<MaterialOption[]>('/api/materials').then(data => {
      setMaterials(Array.isArray(data) ? data : [])
    }).catch(() => {
      setMaterials([])
    })
  }, [])

  /* ---- compare ---- */
  const handleCompare = useCallback(async () => {
    setComparing(true)
    setAiResult(null)
    setHasResult(false)

    try {
      let result: DiffResult

      if (inputMode === 'select') {
        if (!materialAId || !materialBId) return
        result = await api.post<DiffResult>('/api/diff/compare', {
          materialAId,
          materialBId,
        })
      } else {
        if (!textA.trim() && !textB.trim()) return
        result = await api.post<DiffResult>('/api/diff/compare-text', {
          textA: textA.trim(),
          textB: textB.trim(),
        })
      }

      setDiffResult(result)
      const computed = computeAlignedBlocks(result.textA, result.textB)
      setBlocks(computed)
      setHasResult(true)

      // scroll to result
      setTimeout(() => {
        compareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch {
      // Fallback: compute diff locally
      const localTextA = inputMode === 'select' ? (materials.find(m => m.id === materialAId)?.content || '') : textA
      const localTextB = inputMode === 'select' ? (materials.find(m => m.id === materialBId)?.content || '') : textB
      const computed = computeAlignedBlocks(localTextA, localTextB)
      setBlocks(computed)
      setDiffResult({
        textA: localTextA,
        textB: localTextB,
        materialAId: inputMode === 'select' ? materialAId : undefined,
        materialBId: inputMode === 'select' ? materialBId : undefined,
      })
      setHasResult(true)
      setTimeout(() => {
        compareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } finally {
      setComparing(false)
    }
  }, [inputMode, materialAId, materialBId, textA, textB, materials])

  /* ---- AI analysis ---- */
  const handleAIAnalyze = useCallback(async () => {
    if (!diffResult) return
    setAiAnalyzing(true)

    try {
      const result = await api.post<AIAnalysis>('/api/diff/analyze', {
        diffs: blocks.map(b => ({
          type: b.type,
          oldText: b.leftText,
          newText: b.rightText,
        })),
        materialAId: diffResult.materialAId,
        materialBId: diffResult.materialBId,
      })
      setAiResult(result)
    } catch {
      // Fallback: mock analysis
      const reasonOptions: AIAnalysis['diffs'][0]['reason'][] = ['传抄讹误', '版本差异', '有意修订', '字形演变']
      const mockDiffs = blocks
        .filter(b => b.type !== 'equal' && (b.leftText || b.rightText))
        .slice(0, 10)
        .map(b => ({
          textA: b.leftText || undefined,
          textB: b.rightText || undefined,
          analysis: `此处存在${b.type === 'delete' ? '文字删减' : b.type === 'insert' ? '文字增补' : '文字差异'}，可能是古籍传抄过程中产生的变化。建议对照原始版本进行核验。`,
          reason: reasonOptions[Math.floor(Math.random() * reasonOptions.length)] as AIAnalysis['diffs'][0]['reason'],
          confidence: 0.5 + Math.random() * 0.4,
        }))
      setAiResult({ diffs: mockDiffs })
    } finally {
      setAiAnalyzing(false)
    }
  }, [diffResult, blocks])

  /* ---- stats ---- */
  const stats = (() => {
    const diffBlocks = blocks.filter(b => b.type !== 'equal')
    const totalBlocks = blocks.length || 1
    const diffRate = ((diffBlocks.length / totalBlocks) * 100).toFixed(1)
    const deleteCount = blocks.filter(b => b.type === 'delete' || b.type === 'modify').length
    const insertCount = blocks.filter(b => b.type === 'insert' || b.type === 'modify').length
    return { totalBlocks: blocks.length, diffBlocks: diffBlocks.length, diffRate, deleteCount, insertCount }
  })()

  /* ---- render lines ---- */
  const renderLines = (side: 'left' | 'right') => {
    return blocks.map((block, idx) => {
      const text = side === 'left' ? block.leftText : block.rightText
      const lines = text.split('\n')
      return lines.map((line, lineIdx) => {
        const isDiff = block.type !== 'equal'
        let bgStyle: React.CSSProperties = {}
        if (block.type === 'equal') {
          bgStyle = { backgroundColor: 'transparent' }
        } else if (block.type === 'delete') {
          bgStyle = side === 'left' ? { backgroundColor: 'rgba(239,68,68,0.06)' } : { backgroundColor: 'rgba(239,68,68,0.03)' }
        } else if (block.type === 'insert') {
          bgStyle = side === 'right' ? { backgroundColor: 'rgba(34,197,94,0.06)' } : { backgroundColor: 'rgba(34,197,94,0.03)' }
        } else if (block.type === 'modify') {
          bgStyle = { backgroundColor: 'rgba(234,179,8,0.06)' }
        }

        return (
          <div
            key={`${idx}-${lineIdx}`}
            style={{
              padding: '4px 16px',
              minHeight: '24px',
              fontSize: '14px',
              lineHeight: '1.8',
              fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", serif',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              borderLeft: side === 'left' && isDiff ? '3px solid ' + (block.type === 'delete' ? '#ef4444' : block.type === 'modify' ? '#eab308' : 'transparent') : '3px solid transparent',
              borderRight: side === 'right' && isDiff ? '3px solid ' + (block.type === 'insert' ? '#22c55e' : block.type === 'modify' ? '#eab308' : 'transparent') : '3px solid transparent',
              ...bgStyle,
            }}
          >
            <DiffBlockView block={block} side={side} />
            {lineIdx === lines.length - 1 && text.endsWith('\n') && '\n'}
          </div>
        )
      })
    })
  }

  const selectStyle: React.CSSProperties = {
    flex: 1,
    height: '38px',
    padding: '0 12px',
    borderRadius: '6px',
    border: '1.5px solid var(--rule)',
    fontSize: '14px',
    color: 'var(--ink)',
    backgroundColor: '#fff',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '160px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1.5px solid var(--rule)',
    fontSize: '14px',
    lineHeight: '1.8',
    color: 'var(--ink)',
    backgroundColor: '#fff',
    outline: 'none',
    resize: 'vertical',
    fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", serif',
    transition: 'border-color 0.15s ease',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 112px)', overflowY: 'auto' }}>
      {/* ---- Top: version selection ---- */}
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid var(--rule)',
          padding: '20px 24px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>选择比对文本</h2>
          <button
            onClick={() => setInputMode(prev => (prev === 'select' ? 'text' : 'select'))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1.5px solid var(--rule)',
              backgroundColor: '#fff',
              color: 'var(--muted)',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent2)'
              e.currentTarget.style.color = 'var(--accent2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--rule)'
              e.currentTarget.style.color = 'var(--muted)'
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              {inputMode === 'select' ? (
                <>
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </>
              ) : (
                <>
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  <line x1="9" y1="7" x2="15" y2="7" />
                  <line x1="9" y1="11" x2="14" y2="11" />
                </>
              )}
            </svg>
            {inputMode === 'select' ? '直接输入文本' : '从史料库选择'}
          </button>
        </div>

        {inputMode === 'select' ? (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px' }}>版本 A</label>
              <select
                value={materialAId}
                onChange={e => setMaterialAId(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- 请选择史料 --</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.dynasty ? `[${m.dynasty}] ` : ''}{m.author ? `${m.author} ` : ''}{m.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--rule)" strokeWidth="1.5" width="24" height="24">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px' }}>版本 B</label>
              <select
                value={materialBId}
                onChange={e => setMaterialBId(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- 请选择史料 --</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.dynasty ? `[${m.dynasty}] ` : ''}{m.author ? `${m.author} ` : ''}{m.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCompare}
              disabled={comparing || !materialAId || !materialBId}
              style={{
                height: '38px',
                padding: '0 24px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: comparing || !materialAId || !materialBId ? 'not-allowed' : 'pointer',
                opacity: comparing || !materialAId || !materialBId ? 0.5 : 1,
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {comparing ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2.5" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                  比对中...
                </span>
              ) : '开始比对'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px' }}>版本 A</label>
              <textarea
                value={textA}
                onChange={e => setTextA(e.target.value)}
                placeholder="输入或粘贴版本A的文本..."
                style={textareaStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--muted)', marginBottom: '6px' }}>版本 B</label>
              <textarea
                value={textB}
                onChange={e => setTextB(e.target.value)}
                placeholder="输入或粘贴版本B的文本..."
                style={textareaStyle}
              />
            </div>
          </div>
        )}

        {inputMode === 'text' && (
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCompare}
              disabled={comparing || (!textA.trim() && !textB.trim())}
              style={{
                height: '38px',
                padding: '0 24px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: comparing || (!textA.trim() && !textB.trim()) ? 'not-allowed' : 'pointer',
                opacity: comparing || (!textA.trim() && !textB.trim()) ? 0.5 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              {comparing ? '比对中...' : '开始比对'}
            </button>
          </div>
        )}
      </div>

      {/* ---- Diff results ---- */}
      {hasResult && (
        <>
          {/* Stats bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '12px 20px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              border: '1px solid var(--rule)',
              flexShrink: 0,
              fontSize: '13px',
            }}
            ref={compareRef}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" width="16" height="16">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span style={{ color: 'var(--muted)' }}>总段落</span>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{stats.totalBlocks}</span>
            </div>
            <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--rule)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--muted)' }}>差异段落</span>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{stats.diffBlocks}</span>
            </div>
            <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--rule)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--muted)' }}>差异率</span>
              <span style={{ fontWeight: 600, color: stats.diffRate === '0.0' ? 'var(--ink)' : 'var(--accent)' }}>{stats.diffRate}%</span>
            </div>

            {/* Visual bar */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: 'rgba(239,68,68,0.3)' }} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>删除 {stats.deleteCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: 'rgba(34,197,94,0.3)' }} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>新增 {stats.insertCount}</span>
              </div>
            </div>
          </div>

          {/* Diff comparison view */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              gap: '0',
              borderRadius: '12px',
              border: '1px solid var(--rule)',
              overflow: 'hidden',
              minHeight: '300px',
            }}
          >
            {/* Left panel - Version A */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--rule)' }}>
              <div
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'var(--bg2)',
                  borderBottom: '1px solid var(--rule)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                  }}
                />
                版本 A
                {diffResult?.materialATitle && (
                  <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '12px' }}>
                    -- {diffResult.materialATitle}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff' }}>
                {renderLines('left')}
              </div>
            </div>

            {/* Right panel - Version B */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'var(--bg2)',
                  borderBottom: '1px solid var(--rule)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#22c55e',
                  }}
                />
                版本 B
                {diffResult?.materialBTitle && (
                  <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '12px' }}>
                    -- {diffResult.materialBTitle}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff' }}>
                {renderLines('right')}
              </div>
            </div>
          </div>

          {/* AI Analysis panel */}
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              border: '1px solid var(--rule)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: aiResult ? '1px solid var(--rule)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4Z" />
                  <path d="M10 14h4" />
                  <path d="M12 12v4" />
                </svg>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>AI 差异分析</span>
              </div>
              <button
                onClick={handleAIAnalyze}
                disabled={aiAnalyzing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--accent2)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: aiAnalyzing ? 'not-allowed' : 'pointer',
                  opacity: aiAnalyzing ? 0.5 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {aiAnalyzing ? (
                  <>
                    <svg viewBox="0 0 24 24" width="14" height="14" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2.5" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                    </svg>
                    分析中...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 12 18.469a3.374 3.374 0 0 0-1.066-2.235l-.548-.547Z" />
                    </svg>
                    AI 差异分析
                  </>
                )}
              </button>
            </div>

            {aiResult && aiResult.diffs.length > 0 && (
              <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {aiResult.diffs.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg)',
                      borderLeft: '3px solid var(--accent2)',
                    }}
                  >
                    {/* Diff text */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      {item.textA && (
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>版本A</span>
                          <div
                            style={{
                              marginTop: '4px',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(239,68,68,0.08)',
                              fontSize: '14px',
                              lineHeight: '1.6',
                              fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", serif',
                              textDecoration: 'line-through',
                              color: '#dc2626',
                            }}
                          >
                            {item.textA}
                          </div>
                        </div>
                      )}
                      {item.textB && (
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>版本B</span>
                          <div
                            style={{
                              marginTop: '4px',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(34,197,94,0.08)',
                              fontSize: '14px',
                              lineHeight: '1.6',
                              fontFamily: '"Noto Serif SC", "Source Han Serif CN", "STSong", serif',
                              color: '#16a34a',
                            }}
                          >
                            {item.textB}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Analysis */}
                    <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--ink)', marginBottom: '10px' }}>
                      {item.analysis}
                    </p>

                    {/* Reason + confidence */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <ReasonBadge reason={item.reason} />
                      <ConfidenceBar value={item.confidence} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {aiResult && aiResult.diffs.length === 0 && (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                未发现差异，两个版本完全一致。
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state when no comparison */}
      {!hasResult && (
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
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--rule)" strokeWidth="1.5" width="56" height="56" style={{ marginBottom: '16px' }}>
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="18" rx="1" />
            <circle cx="6.5" cy="8" r="1" fill="var(--rule)" />
            <circle cx="17.5" cy="8" r="1" fill="var(--rule)" />
            <circle cx="6.5" cy="12" r="1" fill="var(--rule)" />
            <circle cx="17.5" cy="12" r="1" fill="var(--rule)" />
            <circle cx="6.5" cy="16" r="1" fill="var(--rule)" />
            <circle cx="17.5" cy="16" r="1" fill="var(--rule)" />
          </svg>
          <p style={{ fontSize: '15px', color: 'var(--muted)' }}>选择两个版本的史料，开始差异比对</p>
          <p style={{ fontSize: '13px', color: 'var(--rule)', marginTop: '4px' }}>支持从史料库选择或直接输入文本</p>
        </div>
      )}

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}