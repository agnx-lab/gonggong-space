//! Opens a bot's workspace in a local app (文件工作区 · 用本地应用打开). Only the workspace directory the daemon
//! resolves itself is ever opened; requests name an app, never a path.

use crate::t;
use std::path::Path;

/// macOS apps by id, with their bundle ids in order of preference. Apps are found and opened by bundle id so
/// LaunchServices picks the user's preferred install (e.g. JetBrains Toolbox's copy in ~/Applications over a stale
/// one in /Applications) and renamed copies like "Cursor 2.app" still count.
/// Cursor, IntelliJ IDEA (Ultimate) and VS Code were checked with mdls; Warp, iTerm2 and IDEA CE are their published ids.
const MAC_APPS: &[(&str, &[&str])] = &[
    ("cursor", &["com.todesktop.230313mzl4w4u92"]),
    ("idea", &["com.jetbrains.intellij", "com.jetbrains.intellij.ce"]),
    ("vscode", &["com.microsoft.VSCode"]),
    ("warp", &["dev.warp.Warp-Stable"]),
    ("iterm", &["com.googlecode.iterm2"]),
];

/// Prints the given bundle ids LaunchServices knows, one per line. `id of application id` is answered by
/// LaunchServices without launching the app or relying on the Spotlight index (unlike mdfind), and a missing app is a
/// plain error rather than a "Where is …?" dialog.
const PROBE_SCRIPT: &str = r#"on run ids
  set found to {}
  repeat with i in ids
    try
      id of application id (contents of i)
      set end of found to contents of i
    end try
  end repeat
  set AppleScript's text item delimiters to linefeed
  return found as text
end run"#;

fn probe_args() -> Vec<String> {
    let mut args = vec!["-e".to_string(), PROBE_SCRIPT.to_string()];
    args.extend(MAC_APPS.iter().flat_map(|(_, bundles)| bundles.iter().map(|b| b.to_string())));
    args
}

fn parse_installed(stdout: &str) -> Vec<String> {
    stdout.lines().map(str::trim).filter(|l| !l.is_empty()).map(String::from).collect()
}

/// Bundle ids of the known apps installed on this Mac.
async fn installed_bundles() -> Vec<String> {
    let out = crate::proc::async_command("osascript").args(probe_args()).output().await;
    match out {
        Ok(out) if out.status.success() => parse_installed(&String::from_utf8_lossy(&out.stdout)),
        Ok(out) => {
            tracing::warn!("app probe failed: {}", String::from_utf8_lossy(&out.stderr).trim());
            Vec::new()
        }
        Err(e) => {
            tracing::warn!("app probe failed: {e}");
            Vec::new()
        }
    }
}

/// The preferred installed bundle id of app `id`.
fn bundle(installed: &[String], id: &str) -> Option<&'static str> {
    let (_, bundles) = MAC_APPS.iter().find(|(i, _)| *i == id)?;
    bundles.iter().copied().find(|b| installed.iter().any(|i| i == b))
}

/// Ids of the apps available, in menu order: Finder and Terminal always, the others when installed.
fn available_in(mac: bool, installed: &[String]) -> Vec<String> {
    if !mac {
        return vec!["files".into()];
    }
    let mut apps = vec!["finder".to_string()];
    apps.extend(MAC_APPS.iter().filter(|(id, _)| bundle(installed, id).is_some()).map(|(id, _)| id.to_string()));
    apps.push("terminal".into());
    apps
}

async fn mac_installed() -> Vec<String> {
    if cfg!(target_os = "macos") { installed_bundles().await } else { Vec::new() }
}

pub async fn available() -> Vec<String> {
    available_in(cfg!(target_os = "macos"), &mac_installed().await)
}

/// The program and arguments that open `dir` in app `id`.
fn command_for(mac: bool, installed: &[String], id: &str, dir: &Path) -> Result<(String, Vec<String>), String> {
    let dir = dir.to_string_lossy().to_string();
    let unknown = || t!("不支持用 {app} 打开", app = id);
    if !mac {
        return match id {
            "files" if cfg!(windows) => Ok(("explorer".into(), vec![dir])),
            "files" => Ok(("xdg-open".into(), vec![dir])),
            _ => Err(unknown()),
        };
    }
    match id {
        "finder" => Ok(("open".into(), vec![dir])),
        "terminal" => Ok(("open".into(), vec!["-a".into(), "Terminal".into(), dir])),
        _ => {
            MAC_APPS.iter().find(|(i, _)| *i == id).ok_or_else(unknown)?;
            let bundle = bundle(installed, id).ok_or_else(|| t!("本机没有安装 {app}", app = id))?;
            Ok(("open".into(), vec!["-b".into(), bundle.into(), dir]))
        }
    }
}

/// Opens the workspace `dir` in app `id`; the directory must exist.
pub async fn open(id: &str, dir: &Path) -> Result<(), String> {
    if !dir.is_absolute() || !dir.is_dir() {
        return Err(t!("工作区目录不存在：{path}", path = dir.display()));
    }
    let (program, args) = command_for(cfg!(target_os = "macos"), &mac_installed().await, id, dir)?;
    let mut cmd = crate::proc::async_command(&program);
    cmd.args(&args);
    // Explorer exits non-zero even when it opened the folder.
    if cfg!(windows) {
        return cmd.spawn().map(|_| ()).map_err(|e| t!("无法打开：{e}", e = e));
    }
    let out = cmd.output().await.map_err(|e| t!("无法打开：{e}", e = e))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(t!("无法打开：{e}", e = String::from_utf8_lossy(&out.stderr).trim()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(s: &[&str]) -> Vec<String> {
        s.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn probes_every_known_bundle_id_and_parses_the_installed_ones() {
        let args = probe_args();
        assert_eq!(args[0], "-e");
        assert_eq!(args[1], PROBE_SCRIPT);
        let probed = &args[2..];
        for (_, bundles) in MAC_APPS {
            assert!(bundles.iter().all(|b| probed.contains(&b.to_string())));
        }
        assert!(probed.contains(&"com.todesktop.230313mzl4w4u92".to_string()), "Cursor");
        assert!(probed.contains(&"com.jetbrains.intellij".to_string()), "IntelliJ IDEA");
        assert_eq!(
            parse_installed("com.microsoft.VSCode\ncom.jetbrains.intellij.ce\n\n"),
            ["com.microsoft.VSCode", "com.jetbrains.intellij.ce"]
        );
        assert!(parse_installed("").is_empty());
    }

    #[test]
    fn lists_finder_and_terminal_always_and_the_installed_apps_between() {
        assert_eq!(available_in(true, &[]), ["finder", "terminal"]);
        let installed = ids(&["com.jetbrains.intellij.ce", "com.todesktop.230313mzl4w4u92"]);
        assert_eq!(available_in(true, &installed), ["finder", "cursor", "idea", "terminal"]);
        assert_eq!(available_in(false, &installed), ["files"]);
    }

    #[test]
    fn opens_apps_by_bundle_id_so_launch_services_picks_the_preferred_install() {
        let installed = ids(&["com.todesktop.230313mzl4w4u92", "com.jetbrains.intellij.ce", "com.jetbrains.intellij"]);
        let dir = Path::new("/Users/wl/pay");
        let cmd = |id| command_for(true, &installed, id, dir);
        assert_eq!(cmd("finder").unwrap(), ("open".into(), vec!["/Users/wl/pay".into()]));
        assert_eq!(cmd("terminal").unwrap().1, ["-a", "Terminal", "/Users/wl/pay"]);
        assert_eq!(
            cmd("cursor").unwrap(),
            ("open".into(), ids(&["-b", "com.todesktop.230313mzl4w4u92", "/Users/wl/pay"]))
        );
        assert_eq!(cmd("idea").unwrap().1, ["-b", "com.jetbrains.intellij", "/Users/wl/pay"], "Ultimate before CE");
        assert!(cmd("warp").is_err(), "not installed");
        assert!(cmd("rm").is_err());
        assert!(cmd("files").is_err(), "the file manager is for other systems");
        let other = command_for(false, &[], "files", dir).unwrap();
        assert_eq!(other.1, ["/Users/wl/pay"]);
        assert!(command_for(false, &[], "finder", dir).is_err());
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn asks_the_system_which_apps_are_installed() {
        let installed = installed_bundles().await;
        assert!(installed.iter().all(|b| MAC_APPS.iter().any(|(_, bs)| bs.contains(&b.as_str()))));
        let apps = available().await;
        assert_eq!((apps.first().unwrap().as_str(), apps.last().unwrap().as_str()), ("finder", "terminal"));
    }

    #[tokio::test]
    async fn refuses_anything_but_an_existing_workspace_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let file = tmp.path().join("a.txt");
        std::fs::write(&file, "x").unwrap();
        assert!(open("finder", &tmp.path().join("missing")).await.is_err());
        assert!(open("finder", &file).await.is_err());
        assert!(open("finder", Path::new("relative/dir")).await.is_err());
        assert!(open("rm", tmp.path()).await.is_err());
    }
}
