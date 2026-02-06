import { Prisma } from "@prisma/client";

export type IssueLevel = "ERROR" | "WARN";

export type Issue = {
  level: IssueLevel;
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

export type RunResult = {
  name: string;
  startedAt: string;
  finishedAt: string;
  counts: { errors: number; warnings: number };
  issues: Issue[];
};

export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }
  if (typeof v === "object") {
    const anyObj = v as { toNumber?: () => number; toString?: () => string };
    if (typeof anyObj.toNumber === "function") {
      try {
        const n = anyObj.toNumber();
        return typeof n === "number" && Number.isFinite(n) ? n : NaN;
      } catch {
        // ignore
      }
    }
    if (typeof anyObj.toString === "function") {
      const n = Number(anyObj.toString());
      return Number.isFinite(n) ? n : NaN;
    }
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function approxEqual(a: number, b: number, eps = 0.01): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= eps;
}

export function parseDateArg(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export function parseIntArg(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function flagToNpmConfigKey(flag: string): string {
  // "--pointId" -> "npm_config_pointid" (npm lowercases and normalizes)
  const raw = flag.replace(/^--/, "");
  const normalized = raw
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
  return `npm_config_${normalized}`;
}

export function getArgValueWithEnvFallback(flag: string): string | undefined {
  const direct = getArgValue(flag);
  if (direct !== undefined) return direct;
  const envKey = flagToNpmConfigKey(flag);
  const envVal = process.env[envKey];
  return envVal !== undefined && envVal !== "" ? envVal : undefined;
}

export function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

export function pickRangeFromArgs(): {
  from?: Date;
  to?: Date;
  pointId?: string;
  limit?: number;
} {
  const from = parseDateArg(getArgValueWithEnvFallback("--from"));
  const to = parseDateArg(getArgValueWithEnvFallback("--to"));
  const pointId = getArgValueWithEnvFallback("--pointId");
  let limit = parseIntArg(getArgValueWithEnvFallback("--limit"));

  // Positional fallback (useful when npm swallows unknown flags and only forwards values)
  if (limit === undefined) {
    for (const arg of process.argv.slice(2)) {
      if (arg.startsWith("-")) continue;
      const n = Number.parseInt(arg, 10);
      if (Number.isFinite(n)) {
        limit = n;
        break;
      }
    }
  }
  return { from, to, pointId, limit };
}

export function makeCollector(name: string) {
  const startedAt = new Date();
  const issues: Issue[] = [];

  function push(level: IssueLevel, code: string, message: string, context?: Record<string, unknown>) {
    issues.push({ level, code, message, context });
  }

  return {
    error: (code: string, message: string, context?: Record<string, unknown>) =>
      push("ERROR", code, message, context),
    warn: (code: string, message: string, context?: Record<string, unknown>) =>
      push("WARN", code, message, context),
    finish: (): RunResult => {
      const finishedAt = new Date();
      const errors = issues.filter((i) => i.level === "ERROR").length;
      const warnings = issues.filter((i) => i.level === "WARN").length;
      return {
        name,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        counts: { errors, warnings },
        issues,
      };
    },
  };
}

export function printResult(result: RunResult, opts?: { verbose?: boolean }) {
  const { errors, warnings } = result.counts;
  const header = `${result.name}: ${errors} error(es), ${warnings} warning(s)`;

  if (errors === 0 && warnings === 0) {
    console.log(`✅ ${header}`);
    return;
  }

  if (errors > 0) console.error(`❌ ${header}`);
  else console.warn(`⚠️ ${header}`);

  const verbose = opts?.verbose ?? hasFlag("--verbose");
  const max = verbose ? result.issues.length : Math.min(result.issues.length, 50);

  for (let i = 0; i < max; i++) {
    const it = result.issues[i];
    const prefix = it.level === "ERROR" ? "[E]" : "[W]";
    const ctx = it.context ? ` | ${JSON.stringify(it.context)}` : "";
    const line = `${prefix} ${it.code}: ${it.message}${ctx}`;
    if (it.level === "ERROR") console.error(line);
    else console.warn(line);
  }

  if (!verbose && result.issues.length > max) {
    console.log(
      `… ${result.issues.length - max} más. Re-ejecuta con --verbose para ver todo.`
    );
  }
}

export function jsonNullish(v: unknown): v is Prisma.NullableJsonNullValueInput {
  return v === Prisma.DbNull || v === Prisma.JsonNull;
}
