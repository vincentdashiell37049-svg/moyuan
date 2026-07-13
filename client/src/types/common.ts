/** 通用 API 响应 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/** 分页请求参数 */
export interface PaginationParams {
  page: number
  pageSize: number
}

/** 通用选项类型 */
export interface Option {
  label: string
  value: string
}

/** 文件上传结果 */
export interface UploadResult {
  url: string
  filename: string
  size: number
  mimeType: string
}

/** OCR 识别结果 */
export interface OcrResult {
  text: string
  confidence: number
  blocks: OcrBlock[]
}

/** OCR 文本块 */
export interface OcrBlock {
  text: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  confidence: number
}

/** 差异比对结果项 */
export interface DiffItem {
  type: 'equal' | 'add' | 'remove' | 'modify'
  oldText?: string
  newText?: string
  index: number
}

/** 差异比对请求 */
export interface DiffRequest {
  leftText: string
  rightText: string
  sensitivity?: 'char' | 'word' | 'line'
}