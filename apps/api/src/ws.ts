import { createNodeWebSocket } from "@hono/node-ws";
import type { Hono } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import type { ServerType } from "@hono/node-server";

// ── Module-Level State ──

let _nodeWs: ReturnType<typeof createNodeWebSocket> | null = null;

// ── Public API ──

/**
 * Initialize the WebSocket transport with the Hono app instance.
 * Called from app.ts after creating the Hono instance — breaks the circular
 * import chain: app.ts → chat.routes.ts → ws.ts → app.ts.
 */
export const initWebSocket = (app: Hono) => {
  _nodeWs = createNodeWebSocket({ app });
};

/**
 * Upgrade a Hono route to a WebSocket endpoint.
 * Delegates to @hono/node-ws upgradeWebSocket — must be called after initWebSocket().
 */
export const upgradeWebSocket: UpgradeWebSocket = ((...args: Parameters<UpgradeWebSocket>) => {
  if (!_nodeWs) throw new Error("WebSocket not initialized — call initWebSocket(app) first");
  return _nodeWs.upgradeWebSocket(...args);
}) as UpgradeWebSocket;

/**
 * Inject WebSocket handling into the Node.js HTTP server.
 * Must be called after initWebSocket().
 */
export const injectWebSocket = (server: ServerType) => {
  if (!_nodeWs) throw new Error("WebSocket not initialized — call initWebSocket(app) first");
  _nodeWs.injectWebSocket(server);
};
