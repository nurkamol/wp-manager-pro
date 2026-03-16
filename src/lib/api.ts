// Get WordPress configuration from global variable
declare global {
  interface Window {
    wpManagerPro: {
      apiUrl: string
      nonce: string
      siteUrl: string
      adminUrl: string
      version: string
      user: {
        name: string
        email: string
        avatar: string
      }
      branding?: {
        pluginName: string
        menuLabel: string
        logoUrl: string
      }
      permalinks?: {
        isPlain: boolean
      }
    }
  }
}

/** Extended error that carries the WP REST API error code alongside the message. */
export class ApiError extends Error {
  code: string
  constructor(message: string, code = 'unknown_error') {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export function getBranding() {
  const b = typeof window !== 'undefined' ? window.wpManagerPro?.branding : undefined
  return {
    pluginName: b?.pluginName || '',
    menuLabel:  b?.menuLabel  || '',
    logoUrl:    b?.logoUrl    || '',
  }
}

const getConfig = () => {
  if (typeof window !== 'undefined' && window.wpManagerPro) {
    return window.wpManagerPro
  }
  // Fallback for development
  return {
    apiUrl: '/wp-json/wp-manager-pro/v1',
    nonce: '',
    siteUrl: '',
    adminUrl: '',
    version: '1.0.0',
    user: { name: 'Admin', email: '', avatar: '' },
  }
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const config = getConfig()
  const url = `${config.apiUrl}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': config.nonce,
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(data.message || `HTTP error! status: ${response.status}`, data.code || 'http_error')
  }

  return data as T
}

export const api = {
  get: <T = unknown>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'GET' }),

  post: <T = unknown>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: <T = unknown>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: <T = unknown>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    }),

  // For multipart/form-data uploads — do NOT set Content-Type (browser sets boundary automatically).
  upload: <T = unknown>(endpoint: string, formData: FormData) => {
    const config = getConfig()
    return fetch(`${config.apiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'X-WP-Nonce': config.nonce },
      body: formData,
    }).then(async (res) => {
      const data = await res.json()
      if (!res.ok) throw new ApiError(data.message || `HTTP ${res.status}`, data.code || 'http_error')
      return data as T
    })
  },
}

export { getConfig }
