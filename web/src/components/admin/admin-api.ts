const CSRF_COOKIE_NAME = 'atlas_admin_csrf';

export function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

interface AdminFetchOptions {
  method?: string;
  body?: unknown;
}

export async function adminFetch<T>(path: string, options: AdminFetchOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') headers['x-csrf-token'] = getCsrfToken();
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new AdminApiError(0, '无法连接服务器，请检查网络或确认服务已启动。');
  }
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (response.status === 401) {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
      window.location.assign('/admin/login');
    }
    throw new AdminApiError(401, data.error ?? '需要管理员登录');
  }
  if (!response.ok) throw new AdminApiError(response.status, data.error ?? `请求失败（HTTP ${response.status}）`);
  return data as T;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
}
