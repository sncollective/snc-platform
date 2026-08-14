import { Outlet, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";

export type RouteVoice = "parent" | "studio" | "tv" | "records";

export interface RouteVoiceContextValue {
  readonly routeDefault: RouteVoice;
  readonly effectiveVoice: RouteVoice;
}

const PARENT_ROUTE_VOICE: RouteVoiceContextValue = {
  routeDefault: "parent",
  effectiveVoice: "parent",
};

const RouteVoiceContext = createContext<RouteVoiceContextValue>(PARENT_ROUTE_VOICE);

/** Resolve a pathname to its automatic route voice. Only trailing slashes are normalized. */
export function resolveRouteVoice(pathname: string): RouteVoice {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPathname === "/studio") return "studio";
  if (normalizedPathname === "/live") return "tv";
  if (/^\/creators\/[^/]+\/press(?:\/|$)/.test(normalizedPathname)) return "records";

  return "parent";
}

/** Read the route default and the effective voice reserved for a future user override. */
export function useRouteVoice(): RouteVoiceContextValue {
  return useContext(RouteVoiceContext);
}

/** Attributes for a DOM root that must repeat route identity across a portal boundary. */
export function useRouteVoiceAttributes(): Readonly<{ "data-route": RouteVoice }> {
  const { routeDefault } = useRouteVoice();
  return { "data-route": routeDefault };
}

interface RouteVoiceScopeProps {
  readonly routeDefault: RouteVoice;
  readonly children: ReactNode;
}

/** Transparent inheritance boundary shared by the router outlet and SSR fixtures. */
export function RouteVoiceScope({
  routeDefault,
  children,
}: RouteVoiceScopeProps): ReactElement {
  const value = useMemo<RouteVoiceContextValue>(
    () => ({ routeDefault, effectiveVoice: routeDefault }),
    [routeDefault],
  );

  return (
    <RouteVoiceContext value={value}>
      <div data-route={routeDefault} style={{ display: "contents" }}>
        {children}
      </div>
    </RouteVoiceContext>
  );
}

/** Render the active root outlet inside its deterministic route-voice boundary. */
export function RouteVoiceOutlet(): ReactElement {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const routeDefault = resolveRouteVoice(pathname);

  return (
    <RouteVoiceScope routeDefault={routeDefault}>
      <Outlet />
    </RouteVoiceScope>
  );
}
