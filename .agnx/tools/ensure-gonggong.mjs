#!/usr/bin/env node
// 场景：共工空间 ensure --supervised — 只输出 daemon 启动计划，不在这里拉起 Vite。
import http from "node:http";
import { existsSync } from "node:fs";
import {
  LAUNCHER,
  dependencyWarnings,
  findNode24,
  fingerprint,
  loadRuntimeConfig,
} from "./lib/gonggong-runtime.mjs";

function httpGetJson(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const statusCode = res.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
  });
}

function buildPlan(cfg, warnings) {
  const nodeBin = findNode24();
  if (!nodeBin) {
    return {
      ok: false,
      error: "未找到 Node.js 24+。请安装后再打开共工空间。",
      warnings,
    };
  }
  if (!existsSync(LAUNCHER)) {
    return { ok: false, error: `找不到启动器 ${LAUNCHER}`, warnings };
  }
  const healthUrl = `http://127.0.0.1:${cfg.webPort}/api/health`;
  return {
    ok: true,
    plan: {
      command: nodeBin,
      args: [LAUNCHER],
      cwd: cfg.repoRoot,
      env: {
        WEB_PORT: String(cfg.webPort),
        WEB_HOST: "127.0.0.1",
        PORT: String(cfg.serverPort),
        HOST: "127.0.0.1",
        GONGGONG_SERVER: `http://127.0.0.1:${cfg.serverPort}`,
        GONGGONG_PUBLIC_URL: `http://127.0.0.1:${cfg.webPort}`,
        GONGGONG_PG_PORT: String(cfg.pgPort),
        GONGGONG_ADMIN_PASSWORD: cfg.adminPassword,
        GONGGONG_DATABASE_URL: cfg.databaseUrl,
        GONGGONG_DATA_ROOT: cfg.dataRoot,
        GONGGONG_PREVIEW_HOST: "127.0.0.1",
        GONGGONG_PREVIEW_PORTS: "41000-41019",
      },
      fingerprint: fingerprint(cfg),
      healthUrl,
      port: cfg.webPort,
      launchMode: cfg.mode || "dev",
    },
  };
}

async function main() {
  const cfg = loadRuntimeConfig(process.argv.slice(2));
  const warnings = dependencyWarnings();
  const healthUrl = `http://127.0.0.1:${cfg.webPort}/api/health`;
  if (cfg.supervised && !cfg.forceRestart) {
    const body = await httpGetJson(healthUrl);
    if (body && body.ok === true && body.protocol != null) {
      console.log(
        JSON.stringify({
          ok: true,
          reused: true,
          origin: `http://127.0.0.1:${cfg.webPort}`,
          port: cfg.webPort,
          mode: cfg.mode,
          warnings,
          healthUrl,
        }),
      );
      return;
    }
  }
  if (!cfg.supervised) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "共工空间只支持 daemon 托管。请加 --supervised，由 Agnx 拉起 sidecar。",
        warnings,
      }),
    );
    process.exitCode = 1;
    return;
  }
  const planned = buildPlan(cfg, warnings);
  console.log(
    JSON.stringify({
      ...planned,
      reused: false,
      origin: planned.ok ? `http://127.0.0.1:${cfg.webPort}` : undefined,
      port: cfg.webPort,
      mode: cfg.mode,
      warnings,
      repoRoot: cfg.repoRoot,
    }),
  );
  if (!planned.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.log(
    JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
  );
  process.exitCode = 1;
});
