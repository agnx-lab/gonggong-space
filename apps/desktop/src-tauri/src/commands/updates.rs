use super::Result;
use gonggong::config::Config;
use serde::Serialize;
use std::time::Duration;
use tauri::{Manager, Runtime, Url, Webview};
use tauri_plugin_updater::UpdaterExt;

const GITHUB_FEED: &str = "https://github.com/yoqu/gonggong-space/releases/latest/download/latest.json";

/// Update feeds in the order the updater tries them: the bound server first, which answers 404 while it hosts no
/// signed update for this platform (and old servers without the route answer 404 too), so the app falls through to
/// GitHub; once it hosts one, its 200 / 204 is final.
fn endpoints(server: Option<&str>) -> Vec<Url> {
    let server = server.map(|s| {
        format!("{}/api/desktop-update/{{{{target}}}}/{{{{arch}}}}/{{{{current_version}}}}", s.trim_end_matches('/'))
    });
    server.iter().map(String::as_str).chain([GITHUB_FEED]).filter_map(|u| Url::parse(u).ok()).collect()
}

/// What `@tauri-apps/plugin-updater`'s `new Update(…)` takes: the update stays in the resources table, where the
/// plugin's download / install commands find it by `rid`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMetadata {
    rid: tauri::ResourceId,
    current_version: String,
    version: String,
    body: Option<String>,
    raw_json: serde_json::Value,
}

#[tauri::command]
pub async fn check_update<R: Runtime>(webview: Webview<R>) -> Result<Option<UpdateMetadata>> {
    let server = Config::load().ok().flatten().map(|c| c.server);
    let updater = webview
        .updater_builder()
        .endpoints(endpoints(server.as_deref()))
        .and_then(|b| b.timeout(Duration::from_secs(30)).build())
        .map_err(|e| e.to_string())?;
    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else { return Ok(None) };
    Ok(Some(UpdateMetadata {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        body: update.body.clone(),
        raw_json: update.raw_json.clone(),
        rid: webview.resources_table().add(update),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asks_the_bound_server_before_github() {
        let urls: Vec<String> = endpoints(Some("https://gg.example.com/")).iter().map(Url::to_string).collect();
        assert_eq!(
            urls,
            [
                "https://gg.example.com/api/desktop-update/%7B%7Btarget%7D%7D/%7B%7Barch%7D%7D/%7B%7Bcurrent_version%7D%7D",
                GITHUB_FEED,
            ]
        );
        assert_eq!(endpoints(None).iter().map(Url::as_str).collect::<Vec<_>>(), [GITHUB_FEED]);
    }
}
