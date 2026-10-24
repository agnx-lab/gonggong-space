// 场景：共工空间子应用入口 — 打开上游 Web，并向 Agent 暴露状态与打开 Tab。
import type { WorkspaceAppHostApi, WorkspaceAppModule } from "@agnx-lab/app-sdk";
import {
  GONGGONG_APP_ID,
  GONGGONG_ENSURE_TOOL_REL,
  GONGGONG_OPEN_COMMAND_ID,
  GONGGONG_PANEL_ID,
} from "./constants";
import { registerGonggongDetailConfig } from "./detail-config";
import { bindGonggongHost } from "./host-bind";
import { GonggongPanel } from "./panel";
import { getCachedGonggongRuntime, loadGonggongRuntime } from "./runtime-config";

export const appId = GONGGONG_APP_ID;

function openGonggongTab(
  host: WorkspaceAppHostApi,
  context?: {
    serverId?: string;
    workspaceId?: string;
    currentPathname?: string | null;
  },
): void {
  host.openSubAppTab({
    appId: GONGGONG_APP_ID,
    panelId: GONGGONG_PANEL_ID,
    serverId: context?.serverId,
    workspaceId: context?.workspaceId,
    currentPathname: context?.currentPathname,
  });
}

export function activate(host: WorkspaceAppHostApi): () => void {
  bindGonggongHost(host);
  void loadGonggongRuntime(host.config);
  const unregisterDetail = registerGonggongDetailConfig(host);

  host.registerMiniApp({
    id: GONGGONG_PANEL_ID,
    appId: GONGGONG_APP_ID,
    title: "共工空间",
    component: GonggongPanel,
    iframeShortcutCapture: true,
    isolation: {
      mode: "iframe",
      sidecarTools: [GONGGONG_ENSURE_TOOL_REL],
      note: "Tab 嵌共工 Web；daemon 托管 Postgres + API + Vite",
    },
  });

  host.registerCommand({
    id: GONGGONG_OPEN_COMMAND_ID,
    appId: GONGGONG_APP_ID,
    title: "共工空间",
    keywords: ["gonggong", "共工", "群聊", "space"],
    sidebarAction: {
      defaultVisible: true,
      label: "共工",
      order: 64,
    },
    run: (context) => {
      openGonggongTab(host, context);
    },
  });

  const unregisterTools = host.registerAgentTools({
    appId: GONGGONG_APP_ID,
    availability: "always",
    tools: [
      {
        name: "status",
        description: "检查共工空间 Web 是否已在本机 loopback 就绪（/api/health）",
        groupId: "gonggong-runtime",
        groupTitle: "运行",
        execute: async () => {
          const cfg = getCachedGonggongRuntime();
          const url = `http://127.0.0.1:${cfg.webPort}/api/health`;
          if (!host.http?.fetchJson) {
            return { ok: false, url, error: "宿主未提供 host.http" };
          }
          try {
            const body = await host.http.fetchJson(url, { timeoutMs: 4000 });
            return { ok: true, url, body };
          } catch (error) {
            return {
              ok: false,
              url,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      },
      {
        name: "open",
        description: "在当前工作区打开共工空间 Tab",
        groupId: "gonggong-runtime",
        groupTitle: "运行",
        execute: () => {
          const opened = host.openSubAppTab({
            appId: GONGGONG_APP_ID,
            panelId: GONGGONG_PANEL_ID,
          });
          return { ok: opened };
        },
      },
    ],
  });

  return () => {
    unregisterDetail();
    unregisterTools();
  };
}

const moduleExport: WorkspaceAppModule = {
  appId: GONGGONG_APP_ID,
  activate,
};

export default moduleExport;
