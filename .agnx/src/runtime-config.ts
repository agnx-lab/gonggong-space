// 场景：共工空间运行参数 — 与 .agnx/runtime-defaults.json、详情 host.config 对齐。
import type { WorkspaceAppConfigApi } from "@agnx-lab/app-sdk";
import defaults from "../runtime-defaults.json";
import { GONGGONG_APP_ID, GONGGONG_CONFIG_KEY } from "./constants";

export interface GonggongRuntimeConfig {
  webPort: number;
  serverPort: number;
  pgPort: number;
  adminPassword: string;
  databaseUrl: string;
}

const fallback: GonggongRuntimeConfig = {
  webPort: defaults.webPort,
  serverPort: defaults.serverPort,
  pgPort: defaults.pgPort,
  adminPassword: defaults.adminPassword,
  databaseUrl: defaults.databaseUrl,
};

let cached: GonggongRuntimeConfig = { ...fallback };

export function defaultGonggongRuntime(): GonggongRuntimeConfig {
  return { ...fallback };
}

export function getCachedGonggongRuntime(): GonggongRuntimeConfig {
  return cached;
}

export function setCachedGonggongRuntime(next: GonggongRuntimeConfig): void {
  cached = next;
}

function port(value: unknown, fallbackPort: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return fallbackPort;
  }
  return parsed;
}

export function normalizeGonggongRuntime(value: unknown): GonggongRuntimeConfig {
  const raw = value && typeof value === "object" ? (value as Partial<GonggongRuntimeConfig>) : {};
  return {
    webPort: port(raw.webPort, fallback.webPort),
    serverPort: port(raw.serverPort, fallback.serverPort),
    pgPort: port(raw.pgPort, fallback.pgPort),
    adminPassword:
      typeof raw.adminPassword === "string" ? raw.adminPassword : fallback.adminPassword,
    databaseUrl:
      typeof raw.databaseUrl === "string" ? raw.databaseUrl.trim() : fallback.databaseUrl,
  };
}

export async function loadGonggongRuntime(
  config: WorkspaceAppConfigApi | undefined,
): Promise<GonggongRuntimeConfig> {
  if (!config) {
    return cached;
  }
  const value = await config.get<unknown>({
    scope: "app",
    appId: GONGGONG_APP_ID,
    key: GONGGONG_CONFIG_KEY,
    defaultValue: fallback,
  });
  const next = normalizeGonggongRuntime(value);
  cached = next;
  return next;
}

export async function saveGonggongRuntime(
  config: WorkspaceAppConfigApi | undefined,
  value: GonggongRuntimeConfig,
): Promise<GonggongRuntimeConfig> {
  const next = normalizeGonggongRuntime(value);
  if (!config) {
    throw new Error("宿主未提供 host.config");
  }
  await config.set({
    scope: "app",
    appId: GONGGONG_APP_ID,
    key: GONGGONG_CONFIG_KEY,
    value: next,
  });
  cached = next;
  return next;
}
