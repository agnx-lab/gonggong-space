//! Secrets of `run.start.env` reach the adapter process env, in memory only (plan 团队密钥 §4), against the mock agent.
#[path = "../support/provider_rig.rs"]
mod provider_rig;

use gonggong::config::Settings;
use gonggong::protocol::*;
use provider_rig::*;
use serde_json::json;
use std::path::Path;
use std::time::Duration;

const TOKEN: &str = "feishu-devops-token-5f3a9c";

fn with_env(s: RunStart, pairs: &[(&str, &str)]) -> RunStart {
    let env = SecretEnv(pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect());
    RunStart { env, ..s }
}

/// Every file under `dir` whose bytes contain `needle`.
fn files_containing(dir: &Path, needle: &str) -> Vec<String> {
    let mut hits = vec![];
    for entry in std::fs::read_dir(dir).unwrap().flatten() {
        let path = entry.path();
        if path.is_dir() {
            hits.extend(files_containing(&path, needle));
        } else if std::fs::read(&path).is_ok_and(|b| b.windows(needle.len()).any(|w| w == needle.as_bytes())) {
            hits.push(path.display().to_string());
        }
    }
    hits
}

#[tokio::test]
async fn claude_and_codex_get_the_secrets_in_their_process_env_and_nothing_is_written() {
    let mut r = rig(Duration::from_secs(60));
    r.add(AgentKind::Claude, "kimi-coding", true);
    r.add(AgentKind::Codex, "zhipu", true);
    for (run, kind) in [("r1", AgentKind::Claude), ("r2", AgentKind::Codex)] {
        let s = with_env(start(run, kind), &[("GG_SECRET_FEISHU", TOKEN)]);
        r.run(RunStart { bot: RunBot { id: run.into(), ..s.bot.clone() }, ..s });
        let e = echo(&r.finish(run).await);
        assert_eq!(e["secretEnv"], json!({ "GG_SECRET_FEISHU": TOKEN }), "{kind:?}");
    }
    assert!(r.home().join("run").read_dir().unwrap().next().is_some(), "Claude's settings file was written");
    assert_eq!(files_containing(r.home(), TOKEN), Vec::<String>::new());
}

#[tokio::test]
async fn secrets_win_over_the_users_env_but_never_over_the_daemons() {
    let mut r = rig(Duration::from_secs(60));
    let mut settings = Settings::default();
    settings.env.insert("GG_SECRET_SHARED".into(), "from-the-user".into());
    settings.save(r.home()).unwrap();
    let git = Some(GitIdentity { name: "小王".into(), email: "b1@bots.gonggong.local".into() });
    for (run, kind) in [("r1", AgentKind::Claude), ("r2", AgentKind::Codex)] {
        let s = start(run, kind);
        let s = RunStart { bot: RunBot { id: run.into(), git: git.clone(), ..s.bot.clone() }, ..s };
        let pairs = [("GG_SECRET_SHARED", "from-the-secret"), ("GIT_AUTHOR_NAME", "intruder"), ("CODEX_CONFIG", "{}")];
        r.run(with_env(s, &pairs));
        let e = echo(&r.finish(run).await);
        assert_eq!(e["secretEnv"]["GG_SECRET_SHARED"], "from-the-secret", "{kind:?}");
        assert_eq!(e["gitEnv"]["GIT_AUTHOR_NAME"], "小王", "{kind:?}");
        if kind == AgentKind::Codex {
            assert!(e["env"]["CODEX_CONFIG"]["developer_instructions"].as_str().unwrap().contains("小王"));
        }
    }
}

async fn step(r: &mut Rig, run: &str, prev: Option<&RunDone>, pairs: &[(&str, &str)]) -> RunDone {
    let s = match prev {
        Some(prev) => follow_up(run, prev, AgentKind::Claude),
        None => start(run, AgentKind::Claude),
    };
    r.run(with_env(s, pairs));
    r.finish(run).await
}

#[tokio::test]
async fn changed_secrets_restart_the_adapter_and_resume_the_session() {
    let mut r = rig(Duration::from_secs(60));
    let first = step(&mut r, "r1", None, &[("GG_SECRET_A", TOKEN)]).await;
    let same = step(&mut r, "r2", Some(&first), &[("GG_SECRET_A", TOKEN)]).await;
    assert_eq!(echo(&same)["pid"], echo(&first)["pid"], "unchanged secrets: the same adapter");

    let mut prev = same;
    for (run, pairs) in [
        ("r3", &[("GG_SECRET_A", "rotated-value-77")][..]),
        ("r4", &[("GG_SECRET_A", "rotated-value-77"), ("GG_SECRET_B", "added-value-88")][..]),
        ("r5", &[][..]),
    ] {
        let done = step(&mut r, run, Some(&prev), pairs).await;
        let e = echo(&done);
        assert_ne!(e["pid"], echo(&prev)["pid"], "{run}: a new adapter process");
        assert_eq!(
            (done.session_id.clone(), done.new_session_reason.clone()),
            (first.session_id.clone(), None),
            "{run}"
        );
        let want: serde_json::Map<_, _> = pairs.iter().map(|(k, v)| (k.to_string(), json!(v))).collect();
        assert_eq!(e["secretEnv"], serde_json::Value::Object(want), "{run}");
        prev = done;
    }
}

#[test]
fn a_logged_run_start_names_its_secrets_without_their_values() {
    let s = with_env(start("r1", AgentKind::Claude), &[("GG_SECRET_FEISHU", TOKEN)]);
    let logged = format!("{s:?}");
    assert!(logged.contains("GG_SECRET_FEISHU") && !logged.contains(TOKEN), "{logged}");
}
