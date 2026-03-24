import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { logClientError } from "../lib/client-logger.js";
import { installGlobalErrorHandlers } from "../lib/global-error-handlers.js";
import { useRouteAnnouncer } from "../hooks/use-route-announcer.js";

import { ErrorPage } from "../components/error/error-page.js";
import { NavBar } from "../components/layout/nav-bar.js";
import { Footer } from "../components/layout/footer.js";
import { DemoBanner } from "../components/layout/demo-banner.js";
import { AudioPlayerProvider } from "../contexts/audio-player-context.js";
import { UploadProvider } from "../contexts/upload-context.js";
import { MiniPlayer } from "../components/media/mini-player.js";
import { MiniUploadIndicator } from "../components/upload/mini-upload-indicator.js";
import { DEMO_MODE } from "../lib/config.js";
import { fetchAuthStateServer } from "../lib/api-server.js";
import globalCss from "../styles/global.css?url";

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
      { name: "color-scheme", content: "dark" },
      { title: "S/NC" },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
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

export function RootLayout() {
  useRouteAnnouncer();
  const { authState } = Route.useLoaderData();

  return (
    <div style={DEMO_MODE ? { "--demo-banner-height": "32px" } as React.CSSProperties : undefined}>
      <DemoBanner />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <AudioPlayerProvider>
        <UploadProvider>
          <NavBar serverAuth={authState} />
          <main id="main-content" className="main-content">
            <Outlet />
          </main>
          <MiniPlayer />
          <MiniUploadIndicator />
          <Footer />
        </UploadProvider>
      </AudioPlayerProvider>
    </div>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
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
