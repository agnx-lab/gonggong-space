#!/usr/bin/env node
// 场景：daemon 托管的共工空间进程 — 本机 Postgres（可选）+ Fastify + Vite，退出时收回子进程。
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { findNode24, findOnPath, loadRuntimeConfig } from "./lib/gonggong-runtime.mjs";

const cfg = loadRuntimeConfig(process.argv.slice(2), process.env, { honorProcessEnv: true });
const children = [];
let shuttingDown = false;
let startedPg = false;
let pgCtl = null;
let pgData = null;

function fail(message) {
  console.error(`[gonggong] ${message}`);
  process.exit(1);
}

const localeEnv = { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" };

function runSync(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, ...localeEnv },
  });
  if (result.status !== 0) {
    const detail = `${result.stderr || ""}${result.stdout || ""}`.trim();
    throw new Error(`${path.basename(command)} 失败${detail ? `: ${detail.slice(0, 500)}` : ""}`);
  }
}

async function ensureDatabaseUrl() {
  if (cfg.databaseUrl) {
    return cfg.databaseUrl;
  }
  pgCtl = findOnPath("pg_ctl", ["/usr/local/bin", "/opt/homebrew/bin"]);
  if (!pgCtl) {
    fail("未找到 pg_ctl。请安装 PostgreSQL，或在详情配置填写数据库 URL。");
  }
  const binDir = path.dirname(pgCtl);
  pgData = path.join(cfg.dataRoot, "pg");
  const logFile = path.join(cfg.dataRoot, "pg.log");
  await mkdir(cfg.dataRoot, { recursive: true });
  if (!existsSync(path.join(pgData, "PG_VERSION"))) {
    await mkdir(pgData, { recursive: true });
    runSync(path.join(binDir, "initdb"), [
      "-D",
      pgData,
      "-U",
      "gonggong",
      "--auth=trust",
      "-E",
      "UTF8",
    ]);
  }
  const status = spawnSync(pgCtl, ["-D", pgData, "status"], { encoding: "utf8" });
  if (status.status !== 0) {
    runSync(pgCtl, ["-D", pgData, "-l", logFile, "-o", `-p ${cfg.pgPort} -k /tmp`, "-w", "start"]);
    startedPg = true;
  }
  const psql = path.join(binDir, "psql");
  const createdb = path.join(binDir, "createdb");
  const check = spawnSync(
    psql,
    [
      "-h",
      "/tmp",
      "-p",
      String(cfg.pgPort),
      "-U",
      "gonggong",
      "-d",
      "postgres",
      "-tAc",
      "SELECT 1 FROM pg_database WHERE datname='gonggong'",
    ],
    { encoding: "utf8" },
  );
  if (check.status !== 0 || !String(check.stdout).includes("1")) {
    runSync(createdb, ["-h", "/tmp", "-p", String(cfg.pgPort), "-U", "gonggong", "gonggong"]);
  }
  return `postgres://gonggong@127.0.0.1:${cfg.pgPort}/gonggong`;
}

function stopPostgres() {
  if (!startedPg || !pgCtl || !pgData) {
    return;
  }
  spawnSync(pgCtl, ["-D", pgData, "-w", "-m", "fast", "stop"], { encoding: "utf8" });
}

function shutdown(code) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode == null && child.signalCode == null) {
      child.kill("SIGTERM");
    }
  }
  stopPostgres();
  process.exit(code);
}

function spawnLogged(name, command, args, env, cwd = cfg.repoRoot) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  const write = (stream, chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\n/)) {
      if (line.length > 0) {
        stream.write(`[${name}] ${line}\n`);
      }
    }
  };
  child.stdout?.on("data", (chunk) => write(process.stdout, chunk));
  child.stderr?.on("data", (chunk) => write(process.stderr, chunk));
  child.on("exit", (exitCode, signal) => {
    if (shuttingDown) {
      return;
    }
    console.error(`[gonggong] ${name} 退出 code=${exitCode} signal=${signal ?? ""}`);
    shutdown(exitCode && exitCode !== 0 ? exitCode : 1);
  });
  return child;
}

const nodeBin = findNode24();
if (!nodeBin) {
  fail("未找到 Node.js 24+。");
}
const tsxCli = path.join(cfg.repoRoot, "apps/server/node_modules/tsx/dist/cli.mjs");
const viteCli = path.join(cfg.repoRoot, "apps/web/node_modules/vite/bin/vite.js");
const serverEntry = path.join(cfg.repoRoot, "apps/server/src/main.ts");
if (!existsSync(tsxCli) || !existsSync(viteCli) || !existsSync(serverEntry)) {
  fail("未安装依赖。在项目根用 Node 24 执行：corepack pnpm install");
}

let databaseUrl;
try {
  databaseUrl = await ensureDatabaseUrl();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
const nodeDir = path.dirname(nodeBin);
const env = {
  ...process.env,
  ...localeEnv,
  PATH: `${nodeDir}${path.delimiter}${process.env.PATH || ""}`,
  PORT: String(cfg.serverPort),
  HOST: "127.0.0.1",
  WEB_PORT: String(cfg.webPort),
  WEB_HOST: "127.0.0.1",
  GONGGONG_SERVER: `http://127.0.0.1:${cfg.serverPort}`,
  GONGGONG_PUBLIC_URL: `http://127.0.0.1:${cfg.webPort}`,
  GONGGONG_DATABASE_URL: databaseUrl,
  GONGGONG_ADMIN_PASSWORD: cfg.adminPassword,
  GONGGONG_PG_PORT: String(cfg.pgPort),
  GONGGONG_DATA_ROOT: cfg.dataRoot,
  GONGGONG_PREVIEW_HOST: "127.0.0.1",
  GONGGONG_PREVIEW_PORTS: process.env.GONGGONG_PREVIEW_PORTS || "41000-41019",
};

console.error(
  `[gonggong] 启动 web=127.0.0.1:${cfg.webPort} server=127.0.0.1:${cfg.serverPort} node=${nodeBin}`,
);

spawnLogged("gonggong-server", nodeBin, [tsxCli, serverEntry], env, path.join(cfg.repoRoot, "apps/server"));
spawnLogged(
  "gonggong-web",
  nodeBin,
  [viteCli, "--host", "127.0.0.1", "--port", String(cfg.webPort), "--strictPort"],
  env,
  path.join(cfg.repoRoot, "apps/web"),
);

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => shutdown(0));
}
