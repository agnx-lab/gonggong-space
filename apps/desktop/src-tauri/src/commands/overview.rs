use super::workspaces::{entries, summary};
use crate::host::Host;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct WorkspaceStat {
    count: usize,
    detail: String,
}

#[derive(Serialize)]
pub struct Overview {
    workspaces: WorkspaceStat,
}

#[tauri::command]
pub async fn overview(host: State<'_, Host>) -> super::Result<Overview> {
    let (count, detail) = summary(&entries(&host.home).await.0);
    Ok(Overview { workspaces: WorkspaceStat { count, detail } })
}

/// One run's process for the detail view, from event `since` on (the view polls it); None once it aged out (or the
/// daemon is not running). Async so it runs off the main thread.
#[tauri::command(async)]
pub fn run_process(
    host: State<'_, Host>,
    run_id: String,
    since: Option<u64>,
    rev: Option<u64>,
) -> Option<gonggong::status::ProcessPatch> {
    host.process_since(&run_id, since, rev)
}
