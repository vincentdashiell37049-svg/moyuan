import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import api from '../services/api'

echarts.use([GraphChart, TooltipComponent, LegendComponent, CanvasRenderer])

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type EntityType = 'person' | 'place' | 'event' | 'time' | 'official_title' | 'institution'

interface EChartsNode {
  id: string
  name: string
  symbolSize: number
  itemStyle: { color: string }
  label: { show: boolean; fontSize: number }
  category: number
  x?: number
  y?: number
  value: number
}

interface EChartsEdge {
  source: string
  target: string
  label?: { show: boolean; formatter: string; fontSize: number; color: string }
  lineStyle: { color: string; width: number; curveness: number; opacity: number }
}

interface EChartsGraphData {
  nodes: EChartsNode[]
  edges: EChartsEdge[]
  categories: { name: string }[]
}

interface GraphStats {
  entityCount: number
  edgeCount: number
}

interface EntityDetail {
  id: string
  name: string
  type: EntityType
  description?: string
  relatedMaterials?: { id: string; title: string }[]
  relations?: { source: string; target: string; relationType: string }[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TYPE_CONFIG: Record<EntityType, { label: string; color: string; categoryIndex: number }> = {
  person: { label: '人物', color: '#3b82f6', categoryIndex: 0 },
  place: { label: '地点', color: '#22c55e', categoryIndex: 1 },
  event: { label: '事件', color: '#f97316', categoryIndex: 2 },
  time: { label: '时间', color: '#a855f7', categoryIndex: 3 },
  official_title: { label: '官职', color: '#8b5cf6', categoryIndex: 4 },
  institution: { label: '机构', color: '#06b6d4', categoryIndex: 5 },
}

const ALL_TYPES: EntityType[] = ['person', 'place', 'event', 'time', 'official_title', 'institution']

const ALL_CATEGORIES = ALL_TYPES.map(t => ({ name: TYPE_CONFIG[t].label }))

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GraphPage() {
  const [selectedTypes, setSelectedTypes] = useState<Set<EntityType>>(new Set(ALL_TYPES))
  const [graphData, setGraphData] = useState<EChartsGraphData | null>(null)
  const [stats, setStats] = useState<GraphStats>({ entityCount: 0, edgeCount: 0 })
  const [selectedNode, setSelectedNode] = useState<EntityDetail | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const chartRef = useRef<ReactEChartsCore>(null)

  /* ---- fetch graph data ---- */
  const fetchGraph = useCallback(async () => {
    if (selectedTypes.size === 0) {
      setGraphData({ nodes: [], edges: [], categories: ALL_CATEGORIES })
      return
    }
    setLoading(true)
    try {
      const types = Array.from(selectedTypes).join(',')
      const data = await api.get<EChartsGraphData>('/api/graph/visualize', { types })
      setGraphData(data)
    } catch {
      // If API fails, show empty graph
      setGraphData({ nodes: [], edges: [], categories: ALL_CATEGORIES })
    } finally {
      setLoading(false)
    }
  }, [selectedTypes])

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.get<GraphStats>('/api/graph/stats')
      setStats(data)
    } catch {
      // keep defaults
    }
  }, [])

  const fetchEntityDetail = useCallback(async (nodeId: string, nodeName: string, nodeType: string) => {
    try {
      const data = await api.get<EntityDetail>(`/api/graph/entities`, {
        type: nodeType,
        search: nodeName,
      })
      if (Array.isArray(data) && data.length > 0) {
        setSelectedNode(data[0])
      } else {
        setSelectedNode({
          id: nodeId,
          name: nodeName,
          type: nodeType as EntityType,
          description: '',
          relatedMaterials: [],
          relations: [],
        })
      }
    } catch {
      setSelectedNode({
        id: nodeId,
        name: nodeName,
        type: nodeType as EntityType,
        description: '',
        relatedMaterials: [],
        relations: [],
      })
    }
    setPanelOpen(true)
  }, [])

  useEffect(() => {
    fetchGraph()
  }, [fetchGraph])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  /* ---- toggle type filter ---- */
  const toggleType = (type: EntityType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  /* ---- search entities ---- */
  const handleSearch = useCallback(async () => {
    if (!searchText.trim()) {
      fetchGraph()
      return
    }
    setLoading(true)
    try {
      const types = Array.from(selectedTypes).join(',')
      const data = await api.get<EChartsGraphData>('/api/graph/visualize', {
        types,
        search: searchText.trim(),
      })
      setGraphData(data)
    } catch {
      setGraphData({ nodes: [], edges: [], categories: ALL_CATEGORIES })
    } finally {
      setLoading(false)
    }
  }, [searchText, selectedTypes, fetchGraph])

  /* ---- ECharts option ---- */
  const option = useMemo(() => {
    if (!graphData) return {}

    const nodes = graphData.nodes.map(node => ({
      ...node,
      symbolSize: node.symbolSize || 35,
      label: node.label || { show: true, fontSize: 12 },
    }))

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: 'var(--rule)',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: 'var(--ink)', fontSize: 13 },
        formatter: (params: { dataType: string; data: { name: string; category: number } }) => {
          if (params.dataType === 'node') {
            const catName = ALL_CATEGORIES[params.data.category]?.name || ''
            return `<strong>${params.data.name}</strong><br/><span style="color:var(--muted)">类型：${catName}</span>`
          }
          return ''
        },
      },
      animationDuration: 800,
      animationEasingUpdate: 'quinticInOut',
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: nodes,
          links: graphData.edges,
          categories: graphData.categories.length > 0 ? graphData.categories : ALL_CATEGORIES,
          roam: true,
          draggable: true,
          zoom: 0.9,
          scaleLimit: { min: 0.3, max: 3 },
          label: {
            show: true,
            position: 'right',
            fontSize: 12,
            color: 'var(--ink)',
          },
          edgeLabel: {
            show: true,
            fontSize: 10,
            color: 'var(--muted)',
            formatter: '{b}',
          },
          force: {
            repulsion: 300,
            gravity: 0.1,
            edgeLength: [100, 250],
            layoutAnimation: true,
          },
          emphasis: {
            focus: 'adjacency',
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(0,0,0,0.15)',
            },
            lineStyle: { width: 3 },
          },
          lineStyle: {
            color: 'var(--rule)',
            width: 1.5,
            curveness: 0.15,
            opacity: 0.7,
          },
        },
      ],
      backgroundColor: 'transparent',
    }
  }, [graphData])

  /* ---- chart events ---- */
  const onChartClick = useCallback(
    (params: { dataType: string; data: { id: string; name: string; category: number } }) => {
      if (params.dataType === 'node') {
        const nodeType = ALL_TYPES[params.data.category] || 'person'
        fetchEntityDetail(params.data.id, params.data.name, nodeType)
      }
    },
    [fetchEntityDetail],
  )

  const onChartEvents = useMemo(
    () => ({
      click: onChartClick,
    }),
    [onChartClick],
  )

  /* ---- detail panel close ---- */
  const closePanel = () => {
    setPanelOpen(false)
    setTimeout(() => setSelectedNode(null), 300)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)', position: 'relative' }}>
      {/* ---- Toolbar ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 0',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {/* Type filter buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {ALL_TYPES.map(type => {
            const cfg = TYPE_CONFIG[type]
            const active = selectedTypes.has(type)
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: active ? 'none' : '1.5px solid var(--rule)',
                  backgroundColor: active ? cfg.color : '#fff',
                  color: active ? '#fff' : 'var(--muted)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontWeight: active ? 500 : 400,
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.borderColor = cfg.color
                    e.currentTarget.style.color = cfg.color
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.borderColor = 'var(--rule)'
                    e.currentTarget.style.color = 'var(--muted)'
                  }
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: active ? '#fff' : cfg.color,
                    flexShrink: 0,
                  }}
                />
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginLeft: 'auto',
            gap: '8px',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="16"
              height="16"
              style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="搜索实体..."
              style={{
                width: '180px',
                height: '34px',
                paddingLeft: '32px',
                paddingRight: '12px',
                borderRadius: '6px',
                border: '1.5px solid var(--rule)',
                fontSize: '13px',
                color: 'var(--ink)',
                backgroundColor: '#fff',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent2)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--rule)')}
            />
          </div>

          {/* Stats */}
          <div
            style={{
              fontSize: '13px',
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{stats.entityCount}</span> 个实体，
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{stats.edgeCount}</span> 条关系
          </div>
        </div>
      </div>

      {/* ---- Main graph area ---- */}
      <div
        style={{
          flex: 1,
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--rule)',
          backgroundColor: 'var(--bg)',
          position: 'relative',
          transition: 'margin-right 0.3s ease',
          marginRight: panelOpen ? '316px' : '0',
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--muted)',
              fontSize: '14px',
              backgroundColor: 'rgba(250,248,245,0.9)',
              padding: '12px 20px',
              borderRadius: '8px',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              style={{ animation: 'spin 1s linear infinite' }}
            >
              <circle cx="12" cy="12" r="10" stroke="var(--muted)" strokeWidth="2.5" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round" />
            </svg>
            加载中...
          </div>
        )}
        {graphData && graphData.nodes.length === 0 && !loading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: '14px',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--rule)" strokeWidth="1.5" width="48" height="48" style={{ marginBottom: '12px' }}>
              <circle cx="12" cy="5" r="2.5" />
              <circle cx="5" cy="19" r="2.5" />
              <circle cx="19" cy="19" r="2.5" />
              <line x1="12" y1="7.5" x2="5" y2="16.5" />
              <line x1="12" y1="7.5" x2="19" y2="16.5" />
              <line x1="7.5" y1="19" x2="16.5" y2="19" />
            </svg>
            <p>暂无图谱数据</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>请先在史料库中添加文献</p>
          </div>
        )}
        <ReactEChartsCore
          ref={chartRef}
          echarts={echarts}
          option={option}
          onEvents={onChartEvents}
          style={{ width: '100%', height: '100%' }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>

      {/* ---- Right detail panel ---- */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '300px',
          backgroundColor: '#fff',
          borderLeft: '1px solid var(--rule)',
          borderRadius: '0 0 12px 0',
          transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: panelOpen ? '-4px 0 16px rgba(0,0,0,0.06)' : 'none',
        }}
      >
        {selectedNode && (
          <>
            {/* Panel header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 16px 12px',
                borderBottom: '1px solid var(--rule)',
                flexShrink: 0,
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', flex: 1, marginRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedNode.name}
              </h3>
              <button
                onClick={closePanel}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--bg2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--rule)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg2)')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {/* Type badge */}
              <div style={{ marginBottom: '16px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#fff',
                    backgroundColor: TYPE_CONFIG[selectedNode.type]?.color || 'var(--muted)',
                  }}
                >
                  {TYPE_CONFIG[selectedNode.type]?.label || selectedNode.type}
                </span>
              </div>

              {/* Description */}
              {selectedNode.description && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    描述
                  </h4>
                  <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--ink)' }}>
                    {selectedNode.description}
                  </p>
                </div>
              )}

              {/* Related materials */}
              {selectedNode.relatedMaterials && selectedNode.relatedMaterials.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    关联史料
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedNode.relatedMaterials.map(m => (
                      <a
                        key={m.id}
                        href={`#/library/${m.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          color: 'var(--accent2)',
                          textDecoration: 'none',
                          backgroundColor: 'var(--bg)',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg2)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" flexShrink={0}>
                          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                        </svg>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Relations */}
              {selectedNode.relations && selectedNode.relations.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    关系列表
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedNode.relations.map((rel, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg)',
                          fontSize: '13px',
                          lineHeight: '1.5',
                        }}
                      >
                        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{rel.source}</span>
                        <span style={{ color: 'var(--muted)', margin: '0 4px' }}>--</span>
                        <span style={{ color: TYPE_CONFIG[selectedNode.type]?.color || 'var(--accent)', fontWeight: 500 }}>{rel.relationType}</span>
                        <span style={{ color: 'var(--muted)', margin: '0 4px' }}>--&gt;</span>
                        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{rel.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!selectedNode.description &&
                (!selectedNode.relatedMaterials || selectedNode.relatedMaterials.length === 0) &&
                (!selectedNode.relations || selectedNode.relations.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: '13px' }}>
                    暂无详细数据
                  </div>
                )}
            </div>
          </>
        )}
      </div>

      {/* Spin animation keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}