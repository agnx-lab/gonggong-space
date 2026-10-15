//! Opens a bot's workspace in a local app (文件工作区 · 用本地应用打开). Only the workspace directory the daemon
//! resolves itself is ever opened; requests name an app, never a path.

use crate::t;
use std::path::{Path, PathBuf};

/// macOS apps by id, with the bundle names to look for in the Applications folders.
const MAC_APPS: &[(&str, &[&str])] = &[
    ("cursor", &["Cursor.app"]),
    ("idea", &["IntelliJ IDEA.app", "IntelliJ IDEA Ultimate.app", "IntelliJ IDEA CE.app"]),
    ("vscode", &["Visual Studio Code.app"]),
    ("warp", &["Warp.app"]),
    ("iterm", &["iTerm.app"]),
];

/// Where installed apps live on macOS (Terminal sits under /System/Applications/Utilities).
fn mac_roots() -> Vec<PathBuf> {
    let mut roots = vec![PathBuf::from("/Applications")];
    roots.extend(std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Applications")));
    roots
}

/// The bundle of app `id` under one of `roots`.
fn bundle(roots: &[PathBuf], id: &str) -> Option<PathBuf> {
    let (_, names) = MAC_APPS.iter().find(|(i, _)| *i == id)?;
    roots.iter().flat_map(|r| names.iter().map(move |n| r.join(n))).find(|p| p.is_dir())
}

/// Ids of the apps available, in menu order: Finder and Terminal always, the others when installed.
fn available_in(mac: bool, roots: &[PathBuf]) -> Vec<String> {
    if !mac {
        return vec!["files".into()];
    }
    let mut apps = vec!["finder".to_string()];
    apps.extend(MAC_APPS.iter().filter(|(id, _)| bundle(roots, id).is_some()).map(|(id, _)| id.to_string()));
    apps.push("terminal".into());
    apps
}

pub fn available() -> Vec<String> {
    available_in(cfg!(target_os = "macos"), &mac_roots())
}

/// The program and arguments that open `dir` in app `id`.
fn command_for(mac: bool, roots: &[PathBuf], id: &str, dir: &Path) -> Result<(String, Vec<String>), String> {
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
            let app = bundle(roots, id).ok_or_else(|| t!("本机没有安装 {app}", app = id))?;
            Ok(("open".into(), vec!["-a".into(), app.to_string_lossy().to_string(), dir]))
        }
    }
}

/// Opens the workspace `dir` in app `id`; the directory must exist.
pub async fn open(id: &str, dir: &Path) -> Result<(), String> {
    if !dir.is_absolute() || !dir.is_dir() {
        return Err(t!("工作区目录不存在：{path}", path = dir.display()));
    }
    let (program, args) = command_for(cfg!(target_os = "macos"), &mac_roots(), id, dir)?;
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

    #[test]
    fn lists_finder_and_terminal_always_and_the_installed_apps_between() {
        let tmp = tempfile::tempdir().unwrap();
        let roots = [tmp.path().to_path_buf()];
        assert_eq!(available_in(true, &roots), ["finder", "terminal"]);
        std::fs::create_dir(tmp.path().join("Cursor.app")).unwrap();
        std::fs::create_dir(tmp.path().join("IntelliJ IDEA CE.app")).unwrap();
        assert_eq!(available_in(true, &roots), ["finder", "cursor", "idea", "terminal"]);
        assert_eq!(available_in(false, &roots), ["files"]);
    }

    #[test]
    fn builds_the_open_command_for_each_app() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir(tmp.path().join("Cursor.app")).unwrap();
        let roots = [tmp.path().to_path_buf()];
        let dir = Path::new("/Users/wl/pay");
        let cmd = |id| command_for(true, &roots, id, dir);
        assert_eq!(cmd("finder").unwrap(), ("open".into(), vec!["/Users/wl/pay".into()]));
        assert_eq!(cmd("terminal").unwrap().1, ["-a", "Terminal", "/Users/wl/pay"]);
        let cursor = tmp.path().join("Cursor.app").to_string_lossy().to_string();
        assert_eq!(cmd("cursor").unwrap().1, ["-a", &cursor, "/Users/wl/pay"]);
        assert!(cmd("warp").is_err(), "not installed");
        assert!(cmd("rm").is_err());
        assert!(cmd("files").is_err(), "the file manager is for other systems");
        let other = command_for(false, &roots, "files", dir).unwrap();
        assert_eq!(other.1, ["/Users/wl/pay"]);
        assert!(command_for(false, &roots, "finder", dir).is_err());
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
