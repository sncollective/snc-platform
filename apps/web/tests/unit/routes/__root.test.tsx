import { describe, it, expect, vi, beforeAll } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

import { createRouterMock } from "../../helpers/router-mock.js";

// ── Hoisted Mocks ──

vi.mock("@tanstack/react-router", () =>
  createRouterMock({
    rootRoute: true,
    outlet: true,
    extras: {
      HeadContent: () => null,
      Scripts: () => null,
    },
  }),
);

vi.mock("../../../src/components/layout/nav-bar.js", () => ({
  NavBar: () => null,
}));

vi.mock("../../../src/components/layout/footer.js", () => ({
  Footer: () => <div data-testid="shell-footer">Footer</div>,
}));

vi.mock("../../../src/components/layout/demo-banner.js", () => ({
  DemoBanner: () => null,
}));

vi.mock("../../../src/contexts/audio-player-context.js", async () => {
  const React = await import("react");
  return {
    AudioPlayerProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

vi.mock("../../../src/contexts/global-player-context.js", async () => {
  const React = await import("react");
  return {
    GlobalPlayerProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useGlobalPlayer: () => ({
      state: { media: null, activeDetailId: null, shouldAutoPlay: false, liveLayout: null, chatCollapsed: false },
      presentation: "hidden",
      actions: {
        play: () => {},
        clear: () => {},
        setActiveDetail: () => {},
        setLiveLayout: () => {},
        setChatCollapsed: () => {},
      },
      chatPortalRef: { current: null },
    }),
  };
});

vi.mock("../../../src/contexts/upload-context.js", async () => {
  const React = await import("react");
  return {
    UploadProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});


vi.mock("../../../src/components/upload/mini-upload-indicator.js", () => ({
  MiniUploadIndicator: () => null,
}));

vi.mock("../../../src/components/media/global-player.js", () => ({
  GlobalPlayer: () => <div data-testid="global-player">Player</div>,
}));

vi.mock("../../../src/routes/__root.module.css", () => ({
  default: {
    outletColumn: "outlet-column",
    chatPortal: "chat-target",
    chatPortalHidden: "chat-target",
  },
}));

vi.mock("../../../src/lib/config.js", () => ({
  DEMO_MODE: false,
}));

vi.mock("../../../src/hooks/use-route-announcer.js", () => ({
  useRouteAnnouncer: vi.fn(),
}));

vi.mock("../../../src/lib/api-server.js", () => ({
  fetchAuthStateServer: vi.fn().mockResolvedValue({ user: null, roles: [] }),
}));

vi.mock("../../../src/styles/global.css?url", () => ({
  default: "global.css",
}));

// ── Component Under Test ──

let RootLayout: () => React.ReactElement;
let RootDocument: React.ComponentType<Readonly<{ children: React.ReactNode }>>;

beforeAll(async () => {
  const mod = await import("../../../src/routes/__root.js");
  RootLayout = mod.RootLayout;
  RootDocument = mod.RootDocument;
});

// ── Tests ──

describe("RootLayout", () => {
  describe("skip-to-content link", () => {
    it("renders a skip-to-content link in the DOM", () => {
      render(<RootLayout />);
      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toBeInTheDocument();
      expect(skipLink.tagName).toBe("A");
    });

    it("skip-to-content link has href targeting #main-content", () => {
      render(<RootLayout />);
      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });

    it("skip-to-content link has the skip-link CSS class", () => {
      render(<RootLayout />);
      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink).toHaveClass("skip-link");
    });

    it("skip-to-content link is the first focusable element in the document", () => {
      const { container } = render(<RootLayout />);
      const allFocusable = container.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      expect(allFocusable.length).toBeGreaterThan(0);
      expect(allFocusable[0]).toHaveTextContent("Skip to main content");
    });
  });

  describe("main content landmark", () => {
    it("main element has id='main-content'", () => {
      render(<RootLayout />);
      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("id", "main-content");
    });

    it("main element retains the main-content CSS class", () => {
      render(<RootLayout />);
      const main = screen.getByRole("main");
      expect(main).toHaveClass("main-content");
    });

    it("outlet content renders inside main", () => {
      render(<RootLayout />);
      const main = screen.getByRole("main");
      expect(main).toHaveTextContent("Page content");
    });

    it("contains route voice on only the outlet boundary", () => {
      const { container } = render(<RootLayout />);
      const boundary = container.querySelector("[data-route]");
      const player = screen.getByTestId("global-player");
      const footer = screen.getByTestId("shell-footer");
      const chatTarget = container.querySelector(".chat-target");

      expect(boundary).toHaveAttribute("data-route", "parent");
      expect(boundary).toHaveStyle({ display: "contents" });
      expect(boundary).toContainElement(screen.getByTestId("outlet"));
      expect(player).not.toHaveAttribute("data-route");
      expect(footer).not.toHaveAttribute("data-route");
      expect(chatTarget).not.toHaveAttribute("data-route");
      expect(boundary).not.toContainElement(player);
      expect(boundary).not.toContainElement(footer);
      expect(boundary).not.toContainElement(chatTarget);
    });
  });

  it("preserves bootstrap-owned appearance attributes through hydration", async () => {
    localStorage.setItem("snc.appearance.theme", "dark");
    const app = (
      <RootDocument>
        <div id="hydration-probe">Hydrated</div>
      </RootDocument>
    );
    const markup = renderToString(app);

    document.open();
    document.write(`<!DOCTYPE html>${markup}`);
    document.close();
    document.documentElement.setAttribute("data-theme-preference", "dark");
    document.documentElement.setAttribute("data-theme", "dark");

    const root = hydrateRoot(document, app);
    await act(async () => {});

    expect(document.documentElement).toHaveAttribute("data-theme-preference", "dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    await act(async () => root.unmount());
    localStorage.removeItem("snc.appearance.theme");
  });
});
