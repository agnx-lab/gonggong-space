use super::Result;
use crate::host::{Host, Snapshot};
use crate::i18n::tr;
use gonggong::config::Config;
use gonggong::protocol::{AgentKind, MachineInfo, PROTOCOL_VERSION};
use serde::Serialize;
use tauri::{AppHandle, State};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    version: &'static str,
    protocol: u32,
    machine: MachineInfo,
    /// `None` until bound.
    owner_name: Option<String>,
    server: Option<String>,
    workspaces_dir: String,
    backups_dir: String,
    adapters: Vec<Adapter>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Adapter {
    kind: AgentKind,
    package: &'static str,
    version: &'static str,
}

#[tauri::command]
pub fn app_info(host: State<'_, Host>) -> Result<AppInfo> {
    let config = Config::load().map_err(|e| e.to_string())?;
    Ok(AppInfo {
        version: gonggong::upgrade::CURRENT,
        protocol: PROTOCOL_VERSION,
        machine: gonggong::bind::machine_info(),
        owner_name: config.as_ref().map(|c| c.owner_name.clone()),
        server: config.as_ref().map(|c| c.server.clone()),
        workspaces_dir: host.home.join("workspaces").display().to_string(),
        backups_dir: host.home.join("backups").display().to_string(),
        adapters: gonggong::engine::ADAPTERS
            .iter()
            .map(|&(kind, package, version)| Adapter { kind, package, version })
            .collect(),
    })
}

/// The frontend's language (`gg.locale`), sent at startup: native texts and the in-process daemon follow it.
#[tauri::command]
pub fn set_locale(locale: String, app: AppHandle) -> Result<()> {
    gonggong::i18n::set_locale(gonggong::i18n::resolve(&locale));
    crate::localize(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn snapshot(host: State<'_, Host>) -> Snapshot {
    host.snapshot()
}

/// 已连接 pill: the bound server's web app in the default browser (its own sign-in, no token handed over).
#[tauri::command]
pub fn open_web(app: AppHandle) -> Result<()> {
    use tauri_plugin_opener::OpenerExt;
    let config = Config::load().map_err(|e| e.to_string())?.ok_or(tr!("尚未绑定"))?;
    app.opener().open_url(format!("{}/", config.server.trim_end_matches('/')), None::<&str>).map_err(|e| e.to_string())
}
