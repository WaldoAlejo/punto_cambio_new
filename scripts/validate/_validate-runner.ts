export async function run() {
  const { spawn } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");

  const runnerDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(runnerDir, "..", "..");

  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

  const scripts = [
    path.join(repoRoot, "scripts", "validate", "validate-saldos.ts"),
    path.join(repoRoot, "scripts", "validate", "validate-movimiento-saldo.ts"),
    path.join(repoRoot, "scripts", "validate", "validate-exchanges.ts"),
    path.join(repoRoot, "scripts", "validate", "validate-transfers.ts"),
    path.join(repoRoot, "scripts", "validate", "validate-servicios-externos.ts"),
    path.join(repoRoot, "scripts", "validate", "validate-cierres.ts"),
  ];

  const passthroughArgs = process.argv.slice(2);
  let exitCode = 0;

  for (const script of scripts) {
    // eslint-disable-next-line no-await-in-loop
    const code = await new Promise<number>((resolve, reject) => {
      const child = spawn(process.execPath, [tsxCli, script, ...passthroughArgs], {
        stdio: "inherit",
        env: process.env,
        cwd: repoRoot,
      });
      child.on("error", reject);
      child.on("close", (c) => resolve(c ?? 0));
    });
    if (code > exitCode) exitCode = code;
  }

  process.exitCode = exitCode;
  if (exitCode === 0) console.log("\n✅ validate:all OK (sin errores)");
  else console.error("\n❌ validate:all encontró errores. Revisa el log arriba.");
}
