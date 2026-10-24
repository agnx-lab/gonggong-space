// 场景：共工空间面板 — 贴边 host.guest.mount，首帧品牌扫光，失败展示 GUEST 错误。
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactElement,
} from "react";
import { Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import type { WorkspaceAppBrandLogoLoaderPanelProps } from "@agnx-lab/app-sdk";
import { GONGGONG_APP_ID, GONGGONG_ENSURE_TOOL_REL } from "./constants";
import { requireGonggongHost } from "./host-bind";
import { subscribeGonggongRestart } from "./restart";
import { getCachedGonggongRuntime, loadGonggongRuntime } from "./runtime-config";

const WEB_ROOT_STYLE: CSSProperties = {
  flex: "1 1 0%",
  alignSelf: "stretch",
  minHeight: 0,
  minWidth: 0,
  width: "100%",
  height: "100%",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  backgroundColor: "transparent",
};

const GUEST_HOST_STYLE: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  minWidth: 0,
  width: "100%",
  height: "100%",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  position: "relative",
};

const BOOT_LAYER_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  background: "transparent",
};

const ERROR_LAYER_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 3,
  display: "flex",
  flexDirection: "column",
  background: "transparent",
};

export function GonggongPanel(): ReactElement {
  const guestHostRef = useRef<HTMLDivElement | null>(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountGeneration = useRef(0);

  useEffect(() => {
    const host = requireGonggongHost();
    host.background?.requestRetain?.({
      appId: GONGGONG_APP_ID,
      active: true,
      reason: "gonggong-open",
    });
    return () => {
      host.background?.requestRetain?.({
        appId: GONGGONG_APP_ID,
        active: false,
        reason: "gonggong-open",
      });
    };
  }, []);

  useEffect(() => {
    const host = requireGonggongHost();
    let cancelled = false;
    let unmountGuest: (() => void) | null = null;

    const mountGuest = async (forceRestart: boolean) => {
      const generation = mountGeneration.current + 1;
      mountGeneration.current = generation;
      const container = guestHostRef.current;
      if (!container || cancelled) {
        return;
      }
      if (typeof document === "undefined" || !host.platform.isWeb || !host.guest?.mount) {
        setBooting(false);
        setError("共工空间需要在本机 Agnx 网页或桌面打开。手机上访问不到这台机器的 loopback。");
        return;
      }
      unmountGuest?.();
      unmountGuest = null;
      setBooting(true);
      setError(null);
      const cfg = await loadGonggongRuntime(host.config);
      if (cancelled || generation !== mountGeneration.current || !guestHostRef.current) {
        return;
      }
      const args = [
        "--web-port",
        String(cfg.webPort),
        "--server-port",
        String(cfg.serverPort),
        "--pg-port",
        String(cfg.pgPort),
        "--mode",
        "dev",
      ];
      if (forceRestart) {
        args.push("--force-restart");
      }
      unmountGuest = host.guest.mount({
        container: guestHostRef.current,
        ensureTool: GONGGONG_ENSURE_TOOL_REL,
        ensureArgs: args,
        timeoutMs: 180_000,
        bootOverlay: false,
        onReady: () => {
          if (cancelled || generation !== mountGeneration.current) {
            return;
          }
          setError(null);
          window.setTimeout(() => {
            if (!cancelled && generation === mountGeneration.current) {
              setBooting(false);
            }
          }, 320);
        },
        onError: (detail) => {
          if (cancelled || generation !== mountGeneration.current) {
            return;
          }
          setBooting(false);
          setError(`${detail.code}: ${detail.message}`);
        },
      });
    };

    void mountGuest(false);
    const unsubscribe = subscribeGonggongRestart(() => {
      void mountGuest(true);
    });
    return () => {
      cancelled = true;
      unsubscribe();
      unmountGuest?.();
    };
  }, []);

  const BrandPanel = requireGonggongHost().ui?.BrandLogoLoaderPanel as
    | ComponentType<WorkspaceAppBrandLogoLoaderPanelProps>
    | undefined;
  const cfg = getCachedGonggongRuntime();
  const { theme } = useUnistyles();

  if (typeof document === "undefined") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
          padding: 24,
        }}
      >
        <Text style={{ color: theme.colors.foreground, fontSize: 14, textAlign: "center" }}>
          {error ?? "共工空间需要在本机 Agnx 网页或桌面打开。"}
        </Text>
      </View>
    );
  }

  return (
    <div style={WEB_ROOT_STYLE} aria-label="共工空间 panel">
      <div
        ref={guestHostRef}
        data-agnx-guest-surface-host="true"
        data-testid="workspace-mini-app-gonggong-root"
        style={GUEST_HOST_STYLE}
      />
      {booting && !error && BrandPanel ? (
        <div data-agnx-guest-boot-overlay="true" style={BOOT_LAYER_STYLE} role="status">
          <BrandPanel title="正在启动共工空间…" testID="gonggong-boot-overlay" />
        </div>
      ) : null}
      {booting && !error && !BrandPanel ? (
        <div data-agnx-guest-boot-overlay="true" style={BOOT_LAYER_STYLE} role="status">
          正在启动共工空间…
        </div>
      ) : null}
      {error && BrandPanel ? (
        <div style={ERROR_LAYER_STYLE} role="alert">
          <BrandPanel
            title={error}
            description={`Web ${cfg.webPort}。打开命令面板 → 共工空间 → 详情，可改端口或复制 Guest Surface。`}
            testID="gonggong-mount-error"
          />
        </div>
      ) : null}
      {error && !BrandPanel ? (
        <div style={ERROR_LAYER_STYLE} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
