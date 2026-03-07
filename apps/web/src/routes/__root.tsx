import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { NavBar } from "../components/layout/nav-bar.js";
import { Footer } from "../components/layout/footer.js";
import { DemoBanner } from "../components/layout/demo-banner.js";
import { AudioPlayerProvider } from "../contexts/audio-player-context.js";
import { MiniPlayer } from "../components/media/mini-player.js";
import { DEMO_MODE } from "../lib/config.js";
import { fetchAuthStateServer } from "../lib/api-server.js";
import globalCss from "../styles/global.css?url";

export const Route = createRootRoute({
  loader: async () => {
    const authState = await fetchAuthStateServer();
    return { authState };
  },
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
  return (
    <RootDocument>
      <RootLayout />
    </RootDocument>
  );
}

export function RootLayout() {
  const { authState } = Route.useLoaderData();

  return (
    <div style={DEMO_MODE ? { "--demo-banner-height": "32px" } as React.CSSProperties : undefined}>
      <DemoBanner />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <AudioPlayerProvider>
        <NavBar serverAuth={authState} />
        <main id="main-content" className="main-content">
          <Outlet />
        </main>
        <MiniPlayer />
        <Footer />
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
