import {
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { clsx } from "clsx/lite";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useEffect } from "react";

import { logClientError } from "../lib/client-logger.js";
import { installGlobalErrorHandlers } from "../lib/global-error-handlers.js";
import { RouteVoiceOutlet } from "../lib/route-voice/route-voice.js";
import { APPEARANCE_BOOTSTRAP_SCRIPT } from "../lib/appearance/appearance-bootstrap.js";
import { AppearanceControllerLifecycle } from "../lib/appearance/appearance.js";
import { useRouteAnnouncer } from "../hooks/use-route-announcer.js";
import type { AuthState } from "../lib/auth.js";

import { ErrorPage } from "../components/error/error-page.js";
import { NavBar } from "../components/layout/nav-bar.js";
import { Footer } from "../components/layout/footer.js";
import { DemoBanner } from "../components/layout/demo-banner.js";
import { GlobalPlayerProvider, useGlobalPlayer } from "../contexts/global-player-context.js";
import { NotificationProvider } from "../contexts/notification-context.js";
import { UploadProvider } from "../contexts/upload-context.js";
import { GlobalPlayer } from "../components/media/global-player.js";
import { MiniUploadIndicator } from "../components/upload/mini-upload-indicator.js";
import { BottomTabBar } from "../components/layout/bottom-tab-bar.js";
import { DEMO_MODE } from "../lib/config.js";
import { fetchAuthStateServer } from "../lib/api-server.js";
import { ToastProvider } from "../components/ui/toast.js";
import globalCss from "../styles/global.css?url";
import sourceSansRomanUrl from "@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url";
import styles from "./__root.module.css";

const siteUrl = (import.meta.env.VITE_SITE_URL ?? "https://s-nc.org").replace(/\/$/, "");
const defaultOgImageUrl = `${siteUrl}/og/default.png`;

export const Route = createRootRoute({
  loader: async () => {
    const authState = await fetchAuthStateServer();
    return { authState };
  },
  errorComponent: RootErrorFallback,
  notFoundComponent: NotFoundPage,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "light dark" },
      { title: "S/NC" },
      { property: "og:title", content: "S/NC" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "S/NC" },
      // No global og:image dimensions: routes override og:image with arbitrary-size
      // media (avatars, thumbnails) and TanStack dedups per-property — global dims
      // would survive those overrides and misdescribe their images (review finding).
      // Scrapers measure dimensionless og:images natively.
      { property: "og:image", content: defaultOgImageUrl },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "S/NC" },
      { name: "twitter:image", content: defaultOgImageUrl },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      {
        rel: "icon",
        href: "/favicon-16-light.png",
        type: "image/png",
        sizes: "16x16",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "icon",
        href: "/favicon-16-dark.png",
        type: "image/png",
        sizes: "16x16",
        media: "(prefers-color-scheme: dark)",
      },
      {
        rel: "icon",
        href: "/favicon-32-light.png",
        type: "image/png",
        sizes: "32x32",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "icon",
        href: "/favicon-32-dark.png",
        type: "image/png",
        sizes: "32x32",
        media: "(prefers-color-scheme: dark)",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon-light.png",
        sizes: "180x180",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon-dark.png",
        sizes: "180x180",
        media: "(prefers-color-scheme: dark)",
      },
      {
        rel: "preload",
        href: sourceSansRomanUrl,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      { rel: "stylesheet", href: globalCss },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return (
    <RootDocument>
      <RootLayout />
    </RootDocument>
  );
}

export function RootLayout(): ReactElement {
  useRouteAnnouncer();
  const { authState } = Route.useLoaderData();

  return (
    <div style={DEMO_MODE ? { "--demo-banner-height": "32px" } as CSSProperties : undefined}>
      <DemoBanner />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <NotificationProvider userId={authState?.user?.id ?? null}>
        <GlobalPlayerProvider>
          <UploadProvider>
            <AppShell serverAuth={authState} />
          </UploadProvider>
        </GlobalPlayerProvider>
      </NotificationProvider>
      <ToastProvider />
    </div>
  );
}

/** Inner shell that consumes GlobalPlayerContext for layout signals. */
function AppShell({ serverAuth }: { readonly serverAuth?: AuthState }) {
  const { state: playerState, chatPortalRef } = useGlobalPlayer();

  const isLiveLayout = playerState.liveLayout !== null;
  const isTheater = playerState.liveLayout === "theater";
  const isChatCollapsed = playerState.chatCollapsed;
  const isMobileChatOpen = playerState.liveMobileChatOpen;

  return (
    <>
      {!isTheater && <NavBar {...(serverAuth !== undefined && { serverAuth })} />}
      <main
        id="main-content"
        className={clsx(
          "main-content",
          isLiveLayout && styles.liveGrid,
          isTheater && styles.liveGridTheater,
          isLiveLayout && isChatCollapsed && styles.liveGridChatCollapsed,
          isLiveLayout && isMobileChatOpen && styles.liveGridMobileChat,
        )}
      >
        <GlobalPlayer />
        <div className={clsx(isLiveLayout && styles.outletColumn)}>
          <RouteVoiceOutlet />
          {isLiveLayout && !isTheater && <Footer />}
        </div>
        <div
          ref={chatPortalRef}
          className={clsx(
            isLiveLayout && styles.chatPortal,
            !isLiveLayout && styles.chatPortalHidden,
          )}
        />
      </main>
      <MiniUploadIndicator />
      {!isTheater && <BottomTabBar />}
      {!isLiveLayout && !isTheater && <Footer />}
    </>
  );
}

export function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* If CSP blocks this inline script, token CSS paints the system mode until hydration. */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <AppearanceControllerLifecycle />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootErrorFallback({ error, reset }: ErrorComponentProps) {
  logClientError({
    source: "error-boundary",
    location: "RootErrorFallback",
    error: error instanceof Error ? error.message : String(error),
    errorType: error instanceof Error ? error.name : undefined,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  });

  const message =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred.";

  return (
    <RootDocument>
      <ErrorPage
        statusCode={500}
        title="Something went wrong"
        description={message}
        showRetry
        onRetry={reset}
      />
    </RootDocument>
  );
}

function NotFoundPage() {
  return (
    <ErrorPage
      statusCode={404}
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved."
    />
  );
}
