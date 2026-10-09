/**
 * Pure (react-native-free) HTTP client for the School ERP API.
 * - Attaches Bearer tokens, refreshes once on 401 (single-flight), then retries.
 * - Normalizes every failure into ApiError kinds the UI can render reliably.
 * - No optimistic updates: callers only treat a mutation as done when this resolves.
 */

export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'network'
  | 'server';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  details?: unknown;

  constructor(kind: ApiErrorKind, message: string, opts?: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.kind = kind;
    this.status = opts?.status;
    this.code = opts?.code;
    this.details = opts?.details;
  }
}

export interface ClientOpts {
  baseUrl: string;
  getAccessToken: () => string | null;
  /** Return a fresh access token, or null when the session cannot be renewed. */
  refreshAccessToken?: () => Promise<string | null>;
  onAuthFailure?: () => void;
  timeoutMs?: number;
}

interface RequestOpts {
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  /** Send without an Authorization header (login, refresh, public branding). */
  anonymous?: boolean;
}

function encodeQuery(query?: RequestOpts['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function friendlyMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case 'network': return 'No connection. Check your internet and try again.';
      case 'unauthorized': return 'Your session expired. Please sign in again.';
      case 'forbidden': return 'You do not have permission to do that.';
      case 'not-found': return 'That record no longer exists.';
      case 'conflict': return err.message || 'This conflicts with existing data.';
      case 'rate-limited': return 'Too many attempts. Please wait and try again.';
      case 'validation': return err.message || 'Please check the highlighted fields.';
      default: return err.message || 'Something went wrong. Please try again.';
    }
  }
  return 'Something went wrong. Please try again.';
}

export class ApiClient {
  private baseUrl: string;
  private getAccessToken: () => string | null;
  private refreshAccessToken?: () => Promise<string | null>;
  private onAuthFailure?: () => void;
  private timeoutMs: number;
  private inflightRefresh: Promise<string | null> | null = null;

  constructor(opts: ClientOpts) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.getAccessToken = opts.getAccessToken;
    this.refreshAccessToken = opts.refreshAccessToken;
    this.onAuthFailure = opts.onAuthFailure;
    this.timeoutMs = opts.timeoutMs ?? 25000;
  }

  buildUrl(path: string, query?: RequestOpts['query']): string {
    return `${this.baseUrl}${path}${encodeQuery(query)}`;
  }

  authHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  get<T>(path: string, query?: RequestOpts['query'], opts?: RequestOpts): Promise<T> {
    return this.request<T>('GET', path, undefined, { ...opts, query });
  }

  post<T>(path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
    return this.request<T>('POST', path, body, opts);
  }

  patch<T>(path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
    return this.request<T>('PATCH', path, body, opts);
  }

  delete<T>(path: string, query?: RequestOpts['query'], opts?: RequestOpts): Promise<T> {
    return this.request<T>('DELETE', path, undefined, { ...opts, query });
  }

  private async refreshSingleFlight(): Promise<string | null> {
    if (!this.refreshAccessToken) return null;
    if (!this.inflightRefresh) {
      this.inflightRefresh = this.refreshAccessToken().finally(() => {
        this.inflightRefresh = null;
      });
    }
    return this.inflightRefresh;
  }

  private async request<T>(method: string, path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
    const attempt = async (token: string | null): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = { ...(opts?.headers ?? {}) };
        if (token && !opts?.anonymous) headers.Authorization = `Bearer ${token}`;
        let payload: BodyInit | undefined;
        if (body !== undefined) {
          if (typeof FormData !== 'undefined' && body instanceof FormData) {
            payload = body as BodyInit; // fetch sets the multipart boundary itself
          } else {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
          }
        }
        return await fetch(this.buildUrl(path, opts?.query), { method, headers, body: payload, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    let res: Response;
    try {
      res = await attempt(this.getAccessToken());
    } catch {
      throw new ApiError('network', 'Network request failed');
    }

    if (res.status === 401 && !opts?.anonymous) {
      const fresh = await this.refreshSingleFlight();
      if (fresh) {
        try {
          res = await attempt(fresh);
        } catch {
          throw new ApiError('network', 'Network request failed');
        }
      } else {
        this.onAuthFailure?.();
        throw new ApiError('unauthorized', 'Session expired', { status: 401 });
      }
    }

    type Body = { data?: T; error?: { code?: string; message?: string; details?: unknown } };
    let json: Body | null = null;
    try {
      json = (await res.json()) as Body;
    } catch {
      json = null;
    }

    if (res.ok) return (json?.data ?? undefined) as T;

    const code = json?.error?.code;
    const message = json?.error?.message || `Request failed (${res.status})`;
    const details = json?.error?.details;
    if (res.status === 401) {
      this.onAuthFailure?.();
      throw new ApiError('unauthorized', message, { status: res.status, code, details });
    }
    if (res.status === 403) throw new ApiError('forbidden', message, { status: res.status, code, details });
    if (res.status === 404) throw new ApiError('not-found', message, { status: res.status, code, details });
    if (res.status === 409) throw new ApiError('conflict', message, { status: res.status, code, details });
    if (res.status === 422) throw new ApiError('validation', message, { status: res.status, code, details });
    if (res.status === 429) throw new ApiError('rate-limited', message, { status: res.status, code, details });
    if (res.status >= 500) throw new ApiError('server', 'Server error. Please try again later.', { status: res.status, code });
    throw new ApiError('server', message, { status: res.status, code, details });
  }
}
