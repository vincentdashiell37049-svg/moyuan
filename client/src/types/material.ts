/** 史料条目 */
export interface Material {
  id: string
  title: string
  author?: string
  dynasty?: string
  category: string
  content: string
  source?: string
  createdAt: string
  updatedAt: string
  tags: string[]
}

/** 史料分类 */
export interface MaterialCategory {
  id: string
  name: string
  parentId?: string
  children?: MaterialCategory[]
}

/** 史料查询参数 */
export interface MaterialQuery {
  keyword?: string
  dynasty?: string
  author?: string
  category?: string
  page: number
  pageSize: number
  sortBy?: 'createdAt' | 'updatedAt' | 'title'
  sortOrder?: 'asc' | 'desc'
}

/** 分页结果 */
export interface PaginatedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}