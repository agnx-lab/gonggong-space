// 场景：共工空间胶水绑定宿主，面板与详情配置共用同一个 host。
import type { WorkspaceAppHostApi } from "@agnx-lab/app-sdk";

let boundHost: WorkspaceAppHostApi | null = null;

export function bindGonggongHost(host: WorkspaceAppHostApi): void {
  boundHost = host;
}

export function requireGonggongHost(): WorkspaceAppHostApi {
  if (!boundHost) {
    throw new Error("共工空间 host 未绑定");
  }
  return boundHost;
}
