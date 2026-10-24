// 场景：共工空间 sidecar 共用运行参数 — 默认端口、host.config 落盘、Node 24。
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const APP_ID = "gonggong";
export const REPO_ROOT = path.resolve(here, "../../..");
export const LAUNCHER = path.join(REPO_ROOT, ".agnx/tools/run-gonggong-dev.mjs");

const defaultsPath = path.join(REPO_ROOT, ".agnx/runtime-defaults.json");
export const DEFAULTS = JSON.parse(readFileSync(defaultsPath, "utf8"));

export function resolveAgnxHome(env = process.env) {
  const raw = (env.AGNX_HOME || "").trim() || path.join(os.homedir(), ".agnx-dev");
  if (raw === "~") {
    return os.homedir();
  }
  if (raw.startsWith("~/")) {
    return path.join(os.homedir(), raw.slice(2));
  }
  return path.resolve(raw);
}

export function dataRoot(env = process.env) {
  const explicit = (env.GONGGONG_DATA_ROOT || env.AGNX_APP_DATA_ROOT || "").trim();
  if (explicit) {
    return path.resolve(explicit);
  }
  return path.join(resolveAgnxHome(env), "apps", "data", APP_ID);
}

export function runtimeConfigPath(env = process.env) {
  return path.join(dataRoot(env), "config", "runtime.json");
}

function asPort(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

function readArg(argv, name) {
  const eq = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (eq) {
    return eq.slice(name.length + 3);
  }
  const index = argv.indexOf(`--${name}`);
  if (index >= 0) {
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      return next;
    }
  }
  return undefined;
}

export function parseArgs(argv) {
  return {
    supervised: argv.includes("--supervised"),
    forceRestart: argv.includes("--force-restart") || argv.includes("--forceRestart"),
    mode: readArg(argv, "mode") || "dev",
    webPort: readArg(argv, "web-port"),
    serverPort: readArg(argv, "server-port"),
    pgPort: readArg(argv, "pg-port"),
  };
}

export function loadRuntimeConfig(argv = [], env = process.env, options = {}) {
  const args = parseArgs(argv);
  const honorProcessEnv = options.honorProcessEnv === true;
  let file = {};
  const filePath = runtimeConfigPath(env);
  if (existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8"));
      if (parsed && typeof parsed === "object") {
        file = parsed;
      }
    } catch {
      file = {};
    }
  }
  const webPort = asPort(
    args.webPort ?? (honorProcessEnv ? env.WEB_PORT : undefined) ?? file.webPort,
    DEFAULTS.webPort,
  );
  const serverPort = asPort(
    args.serverPort ?? (honorProcessEnv ? env.PORT : undefined) ?? file.serverPort,
    DEFAULTS.serverPort,
  );
  const pgPort = asPort(
    args.pgPort ?? (honorProcessEnv ? env.GONGGONG_PG_PORT : undefined) ?? file.pgPort,
    DEFAULTS.pgPort,
  );
  const databaseUrl = String(
    (honorProcessEnv ? env.GONGGONG_DATABASE_URL : undefined) ??
      file.databaseUrl ??
      DEFAULTS.databaseUrl ??
      "",
  ).trim();
  const adminPassword = String(
    (honorProcessEnv ? env.GONGGONG_ADMIN_PASSWORD : undefined) ??
      file.adminPassword ??
      DEFAULTS.adminPassword ??
      "",
  );
  return {
    ...args,
    webPort,
    serverPort,
    pgPort,
    databaseUrl,
    adminPassword,
    dataRoot: dataRoot(env),
    repoRoot: REPO_ROOT,
  };
}

export function fingerprint(cfg) {
  const secret = cfg.adminPassword
    ? createHash("sha256").update(cfg.adminPassword).digest("hex")
    : "";
  return createHash("sha256")
    .update(
      JSON.stringify({
        webPort: cfg.webPort,
        serverPort: cfg.serverPort,
        pgPort: cfg.pgPort,
        databaseUrl: cfg.databaseUrl,
        secret,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}

function nodeMajor(version) {
  return Number(String(version).replace(/^v/, "").split(".")[0]);
}

export function findNode24() {
  if (nodeMajor(process.version) >= 24 && existsSync(process.execPath)) {
    return process.execPath;
  }
  const roots = [
    path.join(os.homedir(), ".nvm/versions/node"),
    path.join(os.homedir(), ".local/share/fnm/node-versions"),
  ];
  const hits = [];
  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }
    for (const name of readdirSync(root)) {
      if (!/^v?24\./.test(name)) {
        continue;
      }
      const candidate = path.join(root, name, "bin", "node");
      if (existsSync(candidate)) {
        hits.push(candidate);
      }
    }
  }
  hits.sort();
  return hits.at(-1) ?? null;
}

export function findOnPath(name, extraDirs = []) {
  for (const dir of extraDirs) {
    const candidate = path.join(dir, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  const which = spawnSync("which", [name], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim();
  }
  return null;
}

export function dependencyWarnings() {
  const warnings = [];
  if (!existsSync(path.join(REPO_ROOT, "node_modules"))) {
    warnings.push("未安装依赖。在项目根用 Node 24 执行：corepack pnpm install");
  }
  if (!findNode24()) {
    warnings.push("未找到 Node.js 24+。共工空间 engines 要求 node >= 24");
  }
  if (!findOnPath("pg_ctl", ["/usr/local/bin", "/opt/homebrew/bin"])) {
    warnings.push("未找到 pg_ctl。需要本机 PostgreSQL，或在详情里填写外部数据库 URL");
  }
  return warnings;
}
