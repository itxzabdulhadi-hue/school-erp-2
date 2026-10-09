import * as SecureStore from 'expo-secure-store';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { ApiClient } from '../api/client';
import { createApi, type Api } from '../api/endpoints';
import type { User } from '../api/types';
import { appConfig } from '../config';
import { registerForPush } from '../utils/push';

const ACCESS_KEY = 'erp.accessToken';
const REFRESH_KEY = 'erp.refreshToken';

export type SessionStatus = 'loading' | 'authed' | 'signed-out';

interface SessionValue {
  status: SessionStatus;
  user: User | null;
  permissions: string[];
  /** Raw client (URL building, authed downloads). */
  client: ApiClient;
  /** Typed endpoint wrappers. */
  api: Api;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadMe: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Bare client for pre-auth calls (login/refresh/public brand) — no refresh loop. */
function bareClient(): ApiClient {
  return new ApiClient({ baseUrl: appConfig.apiUrl, getAccessToken: () => null });
}

export function SessionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const accessRef = useRef<string | null>(null);
  const logoutRef = useRef<(() => Promise<void>) | null>(null);

  const client = useMemo(
    () => new ApiClient({
      baseUrl: appConfig.apiUrl,
      getAccessToken: () => accessRef.current,
      refreshAccessToken: async () => {
        try {
          const rt = await SecureStore.getItemAsync(REFRESH_KEY);
          if (!rt) return null;
          const s = await createApi(bareClient()).auth.refresh(rt);
          accessRef.current = s.accessToken;
          await SecureStore.setItemAsync(ACCESS_KEY, s.accessToken);
          await SecureStore.setItemAsync(REFRESH_KEY, s.refreshToken);
          setUser(s.user);
          setPermissions(s.permissions);
          return s.accessToken;
        } catch {
          return null;
        }
      },
      onAuthFailure: () => {
        void logoutRef.current?.();
      },
    }),
    [],
  );
  const api = useMemo(() => createApi(client), [client]);

  const clearStored = useCallback(async () => {
    accessRef.current = null;
    setUser(null);
    setPermissions([]);
    await SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined);
  }, []);

  const logout = useCallback(async () => {
    try {
      const rt = await SecureStore.getItemAsync(REFRESH_KEY);
      if (rt) await createApi(bareClient()).auth.logout(rt).catch(() => undefined);
    } finally {
      await clearStored();
      setStatus('signed-out');
    }
  }, [clearStored]);

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const s = await createApi(bareClient()).auth.login({
      email: email.trim(), password, schoolSlug: appConfig.schoolSlug,
    });
    accessRef.current = s.accessToken;
    await SecureStore.setItemAsync(ACCESS_KEY, s.accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, s.refreshToken);
    setUser(s.user);
    setPermissions(s.permissions);
    setStatus('authed');
    // Best-effort push registration — never blocks sign-in.
    registerForPush(client).catch(() => undefined);
  }, [client]);

  const reloadMe = useCallback(async () => {
    const me = await api.auth.me();
    setUser(me.user);
    setPermissions(me.permissions);
  }, [api]);

  // Boot: renew the session from the stored refresh token.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rt = await SecureStore.getItemAsync(REFRESH_KEY);
        if (!rt) {
          if (!cancelled) setStatus('signed-out');
          return;
        }
        const s = await createApi(bareClient()).auth.refresh(rt);
        if (cancelled) return;
        accessRef.current = s.accessToken;
        await SecureStore.setItemAsync(ACCESS_KEY, s.accessToken);
        await SecureStore.setItemAsync(REFRESH_KEY, s.refreshToken);
        setUser(s.user);
        setPermissions(s.permissions);
        setStatus('authed');
      } catch {
        await clearStored();
        if (!cancelled) setStatus('signed-out');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearStored]);

  const value = useMemo(
    () => ({ status, user, permissions, client, api, login, logout, reloadMe }),
    [status, user, permissions, client, api, login, logout, reloadMe],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}

/** Typed API endpoints (auth-aware via the session client). */
export function useApi(): Api {
  return useSession().api;
}

/** Raw client for URL building and authed file downloads. */
export function useClient(): ApiClient {
  return useSession().client;
}
