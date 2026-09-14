// No credentials or database access. Node is present in the runtime image.
try {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3001}/health`, {
    signal: AbortSignal.timeout(5000),
  });
  process.exitCode = response.ok ? 0 : 1;
} catch {
  process.exitCode = 1;
}
