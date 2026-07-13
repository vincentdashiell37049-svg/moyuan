/** 图谱节点 */
export interface GraphNode {
  id: string
  label: string
  type: 'person' | 'event' | 'place' | 'text' | 'concept'
  properties: Record<string, string | number | boolean>
}

/** 图谱边 */
export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
  weight?: number
  properties?: Record<string, string | number | boolean>
}

/** 图谱数据 */
export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** 图谱查询参数 */
export interface GraphQuery {
  keyword?: string
  nodeType?: GraphNode['type']
  depth?: number
  centerNodeId?: string
  limit?: number
}