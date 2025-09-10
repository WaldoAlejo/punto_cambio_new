// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "punto-cambio-api",
      cwd: "/home/cevallos_oswaldo/punto_cambio_new",
      // script: "server-dist/index.js", // ← si compilas a ./server-dist
      script: "dist/index.js", // ← usa esta línea si decides compilar a ./dist
      instances: 1,
      exec_mode: "fork",
      watch: false,
      time: true,
      node_args: "--enable-source-maps",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
