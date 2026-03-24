import { useEffect, useState } from "react";

import type { Role, User, Session, AuthSession } from "@snc/shared";

import { authClient } from "./auth-client.js";
import { apiGet } from "./fetch-utils.js";

// ── Public API: Re-exports ──

export type { Role, User, Session, AuthSession };

export const useSession = authClient.useSession;

// ── Public API: fetchAuthState ──

export interface AuthState {
  readonly user: User | null;
  readonly roles: Role[];
  readonly isPatron: boolean;
}

export async function fetchAuthState(): Promise<AuthState> {
  try {
    const body = await apiGet<{ user: User | null; roles?: Role[]; isPatron?: boolean }>("/api/me");
    return { user: body.user ?? null, roles: body.roles ?? [], isPatron: body.isPatron ?? false };
  } catch {
    return { user: null, roles: [], isPatron: false };
  }
}

// ── Public API: hasRole ──

export function hasRole(roles: readonly Role[], role: Role): boolean {
  return roles.includes(role);
}

// ── Public API: useAuthExtras Hook ──

interface AuthExtras {
  readonly roles: Role[];
  readonly isPatron: boolean;
}

export function useAuthExtras(): AuthExtras {
  const session = useSession();
  const [extras, setExtras] = useState<AuthExtras>({ roles: [], isPatron: false });

  useEffect(() => {
    const fetchExtras = async () => {
      if (!session.data) {
        setExtras({ roles: [], isPatron: false });
        return;
      }
      const state = await fetchAuthState();
      setExtras({ roles: state.roles, isPatron: state.isPatron });
    };

    void fetchExtras();
  }, [session.data]);

  return extras;
}
