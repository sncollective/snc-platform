module.exports = {
  apps: [
    {
      name: "api",
      cwd: "./apps/api",
      script: "../../node_modules/.bin/tsx",
      args: "watch --ignore './uploads/**' --import ./src/env.ts src/index.ts",
      env: {
        NODE_ENV: "development",
      },
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
    {
      name: "web",
      cwd: "./apps/web",
      script: "../../node_modules/.bin/vite",
      env: {
        NODE_ENV: "development",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
