// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "punto-cambio-api",
      cwd: "/home/cevallos_oswaldo/punto_cambio_new",
      script: "dist-server/server/index.js",
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
