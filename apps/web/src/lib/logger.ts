import pino from "pino";

// ── Private Helpers ──

const buildLoggerOptions = (): pino.LoggerOptions => {
  const opts: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? "info",
    name: "web-ssr",
  };

  if (process.env.NODE_ENV === "development") {
    opts.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "hostname,pid",
      },
    };
  }

  return opts;
};

// ── Public API ──

/** SSR-side logger for route loaders and server functions. */
export const ssrLogger = pino(buildLoggerOptions());
