import type { ApiResponse } from '../types/common'

const BASE_URL = ''

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseURL}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        `API Error: ${response.status} ${response.statusText} - ${errorBody}`,
      )
    }

    const json: ApiResponse<T> & Record<string, any> = await response.json()

    // 兼容两种后端响应格式：
    // 1) { code: 0, data: T, message?: string }
    // 2) { data: T, message?: string }（无 code 时视为成功）
    // 3) 直接返回数组或对象（如 /api/tags 返回标签数组）
    if (json.code !== undefined && json.code !== 0) {
      throw new Error(json.message || '请求失败')
    }

    if (json.data !== undefined) {
      return json.data
    }

    // 无 code 也无 data 时，直接返回整个响应体（兼容旧接口）
    return json as T
  }

  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      })
    }
    const query = searchParams.toString()
    const fullPath = query ? `${path}?${query}` : path
    return this.request<T>(fullPath, { method: 'GET' })
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }

  async upload<T>(path: string, file: File): Promise<T> {
    const url = `${this.baseURL}${path}`
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        `Upload Error: ${response.status} ${response.statusText} - ${errorBody}`,
      )
    }

    const json: ApiResponse<T> & Record<string, any> = await response.json()

    if (json.code !== undefined && json.code !== 0) {
      throw new Error(json.message || '上传失败')
    }

    if (json.data !== undefined) {
      return json.data
    }

    return json as T
  }
}

const api = new ApiClient(BASE_URL)

export default api