// 场景：详情保存运行参数后通知面板 force-restart sidecar。
const listeners = new Set<() => void>();

export function requestGonggongRestart(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeGonggongRestart(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
