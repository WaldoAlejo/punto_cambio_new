export default {
  apps: [
    {
      name: "punto-cambio-api",
      script: "dist/server/index.js",
      instances: 1, // Reducir a 1 instancia para limitar las conexiones
      exec_mode: "fork", // Cambiar a fork en lugar de cluster
      env: {
        NODE_ENV: "development",
        PORT: 3001,
        LOG_LEVEL: "debug",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
        LOG_LEVEL: "info",
        NODE_OPTIONS: "--max-old-space-size=1024",
      },
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",
      watch: false,
      ignore_watch: ["node_modules", "logs", "dist", "src"],
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: "10s",
      // Configuración de auto-restart
      autorestart: true,
      // Configuración de logs
      log_type: "json",
      time: true,
    },
  ],
};
