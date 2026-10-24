// 场景：共工空间详情配置 — 端口、初始管理员密码、外部数据库。
import { useState, type ComponentType, type ReactElement } from "react";
import { Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import type {
  WorkspaceAppChipProps,
  WorkspaceAppHostApi,
  WorkspaceAppTextFieldProps,
} from "@agnx-lab/app-sdk";
import { requireGonggongHost } from "./host-bind";
import { requestGonggongRestart } from "./restart";
import {
  getCachedGonggongRuntime,
  loadGonggongRuntime,
  normalizeGonggongRuntime,
  saveGonggongRuntime,
  type GonggongRuntimeConfig,
} from "./runtime-config";

function Field(props: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secure?: boolean;
  testID: string;
}): ReactElement {
  const host = requireGonggongHost();
  const { theme } = useUnistyles();
  const TextField = host.ui?.TextField as ComponentType<WorkspaceAppTextFieldProps> | undefined;
  return (
    <View style={{ gap: 4, alignSelf: "stretch" }}>
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{props.label}</Text>
      {TextField ? (
        <TextField
          value={props.value}
          onChangeText={props.onChangeText}
          secureTextEntry={props.secure}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={props.label}
          testID={props.testID}
        />
      ) : (
        <Text style={{ color: theme.colors.foreground }}>{props.value}</Text>
      )}
    </View>
  );
}

function RuntimeDetailField(): ReactElement {
  const host = requireGonggongHost();
  const { theme } = useUnistyles();
  const initial = getCachedGonggongRuntime();
  const [webPort, setWebPort] = useState(String(initial.webPort));
  const [serverPort, setServerPort] = useState(String(initial.serverPort));
  const [pgPort, setPgPort] = useState(String(initial.pgPort));
  const [adminPassword, setAdminPassword] = useState(initial.adminPassword);
  const [databaseUrl, setDatabaseUrl] = useState(initial.databaseUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const Chip = host.ui?.Chip as ComponentType<WorkspaceAppChipProps> | undefined;

  const save = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next: GonggongRuntimeConfig = normalizeGonggongRuntime({
        webPort: Number(webPort),
        serverPort: Number(serverPort),
        pgPort: Number(pgPort),
        adminPassword,
        databaseUrl,
      });
      if (
        next.webPort === next.serverPort ||
        next.webPort === next.pgPort ||
        next.serverPort === next.pgPort
      ) {
        setError("Web、API、数据库端口必须各不相同。");
        return;
      }
      await saveGonggongRuntime(host.config, next);
      requestGonggongRestart();
      setMessage("已保存。正在重启本机服务。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8, alignSelf: "stretch", width: "100%" }}>
      <Field
        label="Web 端口"
        value={webPort}
        onChangeText={setWebPort}
        testID="gonggong-web-port"
      />
      <Field
        label="API 端口"
        value={serverPort}
        onChangeText={setServerPort}
        testID="gonggong-server-port"
      />
      <Field
        label="本机数据库端口"
        value={pgPort}
        onChangeText={setPgPort}
        testID="gonggong-pg-port"
      />
      <Field
        label="初始管理员密码"
        value={adminPassword}
        onChangeText={setAdminPassword}
        secure
        testID="gonggong-admin-password"
      />
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, lineHeight: 16 }}>
        只在数据库还没有用户时创建账号 admin。已有账号后，改这里不会改掉登录密码。
      </Text>
      <Field
        label="外部数据库 URL（可空）"
        value={databaseUrl}
        onChangeText={setDatabaseUrl}
        testID="gonggong-database-url"
      />
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12, lineHeight: 16 }}>
        留空则在本机数据目录起 PostgreSQL。首次打开前需要 Node 24 与 corepack pnpm
        install。绑定机器的 gg 命令行不在这个 Tab 里启动。
      </Text>
      {Chip ? (
        <Chip
          label={busy ? "保存中" : "保存并重启"}
          busy={busy}
          disabled={busy}
          onPress={() => {
            void save();
          }}
          testID="gonggong-save-runtime"
        />
      ) : null}
      {message ? (
        <Text style={{ color: theme.colors.foreground, fontSize: 12 }}>{message}</Text>
      ) : null}
      {error ? (
        <Text style={{ color: theme.colors.statusDanger, fontSize: 12 }}>{error}</Text>
      ) : null}
    </View>
  );
}

export function registerGonggongDetailConfig(host: WorkspaceAppHostApi): () => void {
  if (!host.ui?.registerDetailSheetExtras) {
    return () => undefined;
  }
  void loadGonggongRuntime(host.config);
  return host.ui.registerDetailSheetExtras({
    appId: "gonggong",
    surface: "config",
    buildRows: () => {
      const cfg = getCachedGonggongRuntime();
      return [
        {
          label: "运行",
          value: `Web ${cfg.webPort} · API ${cfg.serverPort}`,
          helpText: "打开 Tab 后在本机 loopback 启动共工 Web。保存后会重启 sidecar。",
          groupId: "gonggong-runtime",
          groupTitle: "运行",
          valueContent: <RuntimeDetailField />,
        },
      ];
    },
  });
}
