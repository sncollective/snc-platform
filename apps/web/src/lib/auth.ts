import { useCallback, useEffect, useState } from "react";

import type { Role, User, Session, AuthSession } from "@snc/shared";

import { authClient } from "./auth-client.js";

// ── Public API: Re-exports ──

export type { Role, User, Session, AuthSession };

export const useSession = authClient.useSession;

// ── Public API: fetchAuthState ──

interface AuthState {
  readonly user: User | null;
  readonly roles: Role[];
}

export async function fetchAuthState(): Promise<AuthState> {
  let res: Response;
  try {
    res = await fetch("/api/me", { credentials: "include" });
  } catch {
    return { user: null, roles: [] };
  }

  if (!res.ok) {
    return { user: null, roles: [] };
  }

  const body = (await res.json()) as { user: User | null; roles?: Role[] };
  return { user: body.user ?? null, roles: body.roles ?? [] };
}

// ── Public API: hasRole ──

export function hasRole(roles: Role[], role: Role): boolean {
  return roles.includes(role);
}

// ── Public API: useRoles Hook ──

export function useRoles(): Role[] {
  const session = useSession();
  const [roles, setRoles] = useState<Role[]>([]);

  const fetchRoles = useCallback(async () => {
    if (!session.data) {
      setRoles([]);
      return;
    }
    const state = await fetchAuthState();
    setRoles(state.roles);
  }, [session.data]);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  return roles;
}
