import client from "prom-client";

export const register = new client.Registry();

// Standard process metrics (CPU/memory/etc)
client.collectDefaultMetrics({ register });

export const httpRequestDurationMs = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status"],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
});

register.registerMetric(httpRequestDurationMs);

export function observeHttpRequest(params: {
  method: string;
  route: string;
  status: number;
  durationMs: number;
}) {
  httpRequestDurationMs
    .labels(params.method, params.route, String(params.status))
    .observe(params.durationMs);
}
