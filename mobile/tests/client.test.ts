import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../src/api/client';

function res(status: number, json: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => json } as Response;
}

describe('ApiClient', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the bearer token and unwraps {data}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { data: { hello: 'world' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new ApiClient({ baseUrl: 'https://api.test', getAccessToken: () => 'tok123' });
    const out = await client.get<{ hello: string }>('/api/v1/auth/me');
    expect(out).toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe('Bearer tok123');
  });

  it('skips the header for anonymous calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { data: {} }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new ApiClient({ baseUrl: 'https://api.test', getAccessToken: () => 'tok123' });
    await client.post('/api/v1/auth/login', { email: 'a', password: 'b' }, { anonymous: true });
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBeUndefined();
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('maps errors to kinds with server messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(422, { error: { code: 'VALIDATION_ERROR', message: 'Bad date' } })));
    const client = new ApiClient({ baseUrl: 'https://api.test', getAccessToken: () => null });
    try {
      await client.get('/x');
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).kind).toBe('validation');
      expect((err as ApiError).message).toBe('Bad date');
    }
  });

  it('maps 403 and 404', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(res(403, { error: { code: 'FORBIDDEN', message: 'Nope' } }))
      .mockResolvedValueOnce(res(404, { error: { code: 'NOT_FOUND', message: 'Gone' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new ApiClient({ baseUrl: 'https://api.test', getAccessToken: () => 't' });
    await expect(client.get('/a')).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(client.get('/b')).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('maps transport failures to network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const client = new ApiClient({ baseUrl: 'https://api.test', getAccessToken: () => 't' });
    await expect(client.get('/a')).rejects.toMatchObject({ kind: 'network' });
  });

  it('refreshes once on 401 (single-flight) and retries', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(res(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } }))
      .mockResolvedValueOnce(res(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } }))
      .mockResolvedValue(res(200, { data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);
    const refresh = vi.fn().mockResolvedValue('fresh-token');
    let token: string | null = 'stale';
    const client = new ApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: () => token,
      refreshAccessToken: async () => {
        const t = await refresh();
        token = t;
        return t;
      },
    });
    const [a, b] = await Promise.all([client.get('/a'), client.get('/b')]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, { headers: Record<string, string> }];
    expect(lastCall[1].headers.Authorization).toBe('Bearer fresh-token');
  });

  it('calls onAuthFailure when refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } })));
    const onAuthFailure = vi.fn();
    const client = new ApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: () => 'stale',
      refreshAccessToken: async () => null,
      onAuthFailure,
    });
    await expect(client.get('/a')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });
});
