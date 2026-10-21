//! Manual git from the group: views of any ref that never touch the work tree, and the owner's writes (checkout,
//! fast-forward pull, commit, push), never forced.
use crate::explorer::{self, SNIFF_BYTES};
use crate::git::{self, git, git_bytes, git_capped_bytes, git_input};
use crate::protocol::{
    GitBranch, GitBranchKind, GitChange, GitChangeKind, GitCommit, GitIdentity, GitRemote, TreeEntry,
};
use crate::repo::{self, remote_git, remote_output};
use crate::t;
use std::collections::HashSet;
use std::path::{Component, Path};
use std::time::Duration;

const NETWORK_TIMEOUT: Duration = Duration::from_secs(120);

fn repo_dir(dir: &Path) -> Result<(), String> {
    if git::is_repo(dir) { Ok(()) } else { Err(git::not_git().into()) }
}

/// A ref, branch or remote name given to git as an argument: one starting with `-` would be read as an option.
fn arg(name: &str) -> Result<&str, String> {
    match name.starts_with('-') || name.is_empty() {
        true => Err(t!("无效的名称：{name}", name = name)),
        false => Ok(name),
    }
}

/// `rel` inside a tree, `/`-separated without empty or `.` parts ('' = the root); `..` and absolute paths are refused.
fn tree_path(rel: &str) -> Result<String, String> {
    let path = Path::new(rel);
    if path.components().any(|c| !matches!(c, Component::Normal(_) | Component::CurDir)) {
        return Err(t!("路径超出工作区：{path}", path = rel));
    }
    let parts: Vec<_> = path.components().filter_map(|c| c.as_os_str().to_str()).filter(|p| *p != ".").collect();
    Ok(parts.join("/"))
}

/// `ref:path`, the object git reads.
fn object(r#ref: Option<&str>, rel: &str) -> Result<String, String> {
    Ok(format!("{}:{}", arg(r#ref.unwrap_or("HEAD"))?, tree_path(rel)?))
}

const REFS_FORMAT: &str = "%(refname)%00%(symref)%00%(HEAD)%00%(upstream:short)%00%(upstream:track,nobracket)%00\
                           %(objectname:short)%00%(committerdate:iso-strict)%00%(subject)";

/// Local branches, then remote-tracking ones (without `origin/HEAD`), and the remotes' fetch URLs.
pub async fn refs(dir: &Path) -> Result<(Vec<GitBranch>, Vec<GitRemote>), String> {
    repo_dir(dir)?;
    let format = format!("--format={REFS_FORMAT}");
    let args = ["for-each-ref", &format, "refs/heads", "refs/remotes"];
    let (listing, remotes) = tokio::join!(git(dir, &args), git(dir, &["remote", "-v"]));
    let mut branches = vec![];
    for line in listing?.lines() {
        let f: Vec<&str> = line.split('\0').collect();
        let [refname, symref, head, upstream, track, commit, at, subject] = f[..] else { continue };
        let (name, kind) = match refname.strip_prefix("refs/heads/") {
            Some(name) => (name, GitBranchKind::Local),
            None if symref.is_empty() => (refname.trim_start_matches("refs/remotes/"), GitBranchKind::Remote),
            None => continue,
        };
        let upstream = Some(upstream).filter(|u| !u.is_empty());
        let (ahead, behind) = match (upstream, track) {
            (None, _) | (_, "gone") => (None, None),
            (Some(_), track) => (Some(count(track, "ahead ")), Some(count(track, "behind "))),
        };
        branches.push(GitBranch {
            name: name.into(),
            kind,
            current: head == "*",
            upstream: upstream.map(String::from),
            ahead,
            behind,
            commit: commit.into(),
            subject: subject.into(),
            at: at.into(),
        });
    }
    let remotes = remotes?
        .lines()
        .filter_map(|l| l.strip_suffix(" (fetch)")?.split_once('\t'))
        .map(|(name, url)| GitRemote { name: name.into(), url: repo::redact(url) })
        .collect();
    Ok((branches, remotes))
}

/// N of `ahead N` in `ahead 2, behind 1`; 0 when absent.
fn count(track: &str, label: &str) -> u32 {
    track.split(", ").find_map(|p| p.strip_prefix(label)?.parse().ok()).unwrap_or(0)
}

/// Up to `limit` commits from `ref` after `skip`, and whether there are more.
pub async fn log(dir: &Path, r#ref: Option<&str>, skip: u32, limit: u32) -> Result<(Vec<GitCommit>, bool), String> {
    repo_dir(dir)?;
    let rev = arg(r#ref.unwrap_or("HEAD"))?;
    let (skip, n) = (format!("--skip={skip}"), format!("-n{}", limit + 1));
    let format = "--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%s%x00%P%x00%D%x1e";
    let raw = git(dir, &["log", "--decorate=short", format, &skip, &n, rev, "--"]).await?;
    let mut commits: Vec<GitCommit> = raw
        .split('\x1e')
        .filter_map(|record| {
            let f: Vec<&str> = record.trim_start_matches('\n').split('\0').collect();
            let [hash, short, author, email, at, subject, parents, refs] = f[..] else { return None };
            Some(GitCommit {
                hash: hash.into(),
                short_hash: short.into(),
                author: author.into(),
                email: email.into(),
                at: at.into(),
                subject: subject.into(),
                parents: parents.split_whitespace().map(String::from).collect(),
                refs: refs.split(", ").filter(|r| !r.is_empty()).map(String::from).collect(),
            })
        })
        .collect();
    let more = commits.len() > limit as usize;
    commits.truncate(limit as usize);
    Ok((commits, more))
}

/// One directory of `ref`'s tree, ordered and capped like the work tree browser.
pub async fn tree(dir: &Path, r#ref: Option<&str>, rel: &str) -> Result<(Vec<TreeEntry>, bool), String> {
    repo_dir(dir)?;
    let raw = git(dir, &["ls-tree", "-z", "--long", &object(r#ref, rel)?]).await?;
    let entries = raw
        .split('\0')
        .filter_map(|line| {
            let (meta, name) = line.split_once('\t')?;
            let mut meta = meta.split_whitespace();
            let kind = meta.nth(1)?;
            let size = meta.nth(1)?.parse().unwrap_or(0);
            let dir = kind != "blob";
            Some(TreeEntry { name: name.into(), dir, size, mtime: 0, uncommitted: false, ignored: false })
        })
        .collect();
    Ok(explorer::listing(entries))
}

/// One file of `ref`'s tree, with its content when it is UTF-8 text of at most `max_bytes`.
pub async fn read(dir: &Path, r#ref: Option<&str>, rel: &str, max_bytes: u64) -> Result<explorer::Read, String> {
    repo_dir(dir)?;
    let object = object(r#ref, rel)?;
    if git(dir, &["cat-file", "-t", &object]).await?.trim() != "blob" {
        return Err(t!("不是文件：{path}", path = rel));
    }
    let size: u64 = git(dir, &["cat-file", "-s", &object]).await?.trim().parse().map_err(|e| format!("{e}"))?;
    let (binary, text) = if size <= max_bytes {
        match String::from_utf8(git_bytes(dir, &["cat-file", "blob", &object]).await?) {
            Ok(s) if !s.contains('\0') => (false, Some(s)),
            _ => (true, None),
        }
    } else {
        let head = git_capped_bytes(dir, &["cat-file", "blob", &object], SNIFF_BYTES).await?;
        (!explorer::looks_like_text(&head), None)
    };
    Ok(explorer::Read { size, binary, mime: explorer::mime(Path::new(rel), binary), text })
}

/// What differs from `from` to `to`; `to` None = the work tree with its untracked files (the index is left alone).
pub async fn compare(dir: &Path, from: &str, to: Option<&str>) -> Result<Vec<GitChange>, String> {
    repo_dir(dir)?;
    let to = match to {
        Some(to) => arg(to)?.to_string(),
        None => git::work_tree(dir).await?,
    };
    let raw = git(dir, &["diff", "--name-status", "-z", "-M", arg(from)?, &to, "--"]).await?;
    let mut tokens = raw.split('\0').filter(|t| !t.is_empty());
    let mut changes = vec![];
    while let Some(status) = tokens.next() {
        let Some(path) = tokens.next() else { break };
        let (change, old_path, path) = match status.as_bytes()[0] {
            b'R' => (GitChangeKind::Renamed, Some(path.to_string()), tokens.next().unwrap_or(path)),
            b'C' => (GitChangeKind::Added, None, tokens.next().unwrap_or(path)),
            b'A' => (GitChangeKind::Added, None, path),
            b'D' => (GitChangeKind::Deleted, None, path),
            _ => (GitChangeKind::Modified, None, path),
        };
        changes.push(GitChange { path: path.into(), change, old_path });
    }
    Ok(changes)
}

/// The patch from `from` to `to` (None = the work tree with its untracked files), of `path` only when given, cut at
/// `max_bytes`; true when cut.
pub async fn diff(
    dir: &Path,
    from: &str,
    to: Option<&str>,
    path: Option<&str>,
    max_bytes: usize,
) -> Result<(String, bool), String> {
    repo_dir(dir)?;
    let from = arg(from)?;
    let path = path.map(tree_path).transpose()?;
    let to = match to {
        Some(to) => arg(to)?.to_string(),
        None => git::work_tree(dir).await?,
    };
    let mut args = vec!["--literal-pathspecs", "diff", "--no-color", "--no-ext-diff", "-M", from, &to, "--"];
    args.extend(path.as_deref().filter(|p| !p.is_empty()));
    let out = git_capped_bytes(dir, &args, max_bytes.saturating_add(1)).await?;
    let truncated = out.len() > max_bytes;
    let mut patch = String::from_utf8_lossy(&out).into_owned();
    if truncated {
        let mut cut = max_bytes.min(patch.len());
        while !patch.is_char_boundary(cut) {
            cut -= 1;
        }
        // A whole last line, so the cut patch still parses.
        cut = patch[..cut].rfind('\n').map_or(cut, |i| i + 1);
        patch.truncate(cut);
    }
    Ok((patch, truncated))
}

/// `git fetch --prune` of every remote.
pub async fn fetch(dir: &Path) -> Result<(), String> {
    repo_dir(dir)?;
    remote_git(dir, &["fetch", "--prune", "--all"], Some(NETWORK_TIMEOUT)).await.map(drop).map_err(|f| f.detail)
}

/// `[branch abc1234] subject` of HEAD.
async fn head_line(dir: &Path) -> Result<String, String> {
    let branch = git::branch(dir).await.unwrap_or_else(|| "HEAD".into());
    let head = git(dir, &["log", "-1", "--format=%h %s"]).await?;
    let (short, subject) = head.trim().split_once(' ').unwrap_or((head.trim(), ""));
    Ok(format!("[{branch} {short}] {subject}"))
}

async fn has_ref(dir: &Path, full: &str) -> bool {
    git(dir, &["show-ref", "--verify", "--quiet", full]).await.is_ok()
}

/// Switches to a local branch; `remote/x` without a local `x` creates `x` tracking it. Local changes the switch
/// would overwrite make git refuse.
pub async fn checkout(dir: &Path, branch: &str) -> Result<String, String> {
    repo_dir(dir)?;
    let branch = arg(branch)?;
    if has_ref(dir, &format!("refs/heads/{branch}")).await {
        git(dir, &["switch", branch]).await?;
    } else if has_ref(dir, &format!("refs/remotes/{branch}")).await {
        let remotes = git(dir, &["remote"]).await?;
        let local = remotes
            .lines()
            .find_map(|r| branch.strip_prefix(r)?.strip_prefix('/'))
            .ok_or_else(|| t!("分支不存在：{branch}", branch = branch))?;
        match has_ref(dir, &format!("refs/heads/{local}")).await {
            true => git(dir, &["switch", local]).await?,
            false => git(dir, &["switch", "-c", local, "--track", branch]).await?,
        };
    } else {
        return Err(t!("分支不存在：{branch}", branch = branch));
    }
    head_line(dir).await
}

/// Fast-forwards the current branch from its upstream; anything else is refused.
pub async fn pull(dir: &Path) -> Result<String, String> {
    repo_dir(dir)?;
    if git(dir, &["rev-parse", "--abbrev-ref", "@{upstream}"]).await.is_err() {
        return Err(t!("当前分支没有上游分支，无法拉取").into());
    }
    let out = remote_git(dir, &["pull", "--ff-only", "--no-rebase"], Some(NETWORK_TIMEOUT)).await;
    let out = out.map_err(|f| f.detail)?;
    Ok(out.lines().next().unwrap_or_default().trim().to_string())
}

/// Commits every change of the work tree, or only those of `paths` (work tree relative), but the daemon's private dir,
/// as `identity`, else the machine's config. With `paths`, whatever else was staged stays staged and out of the commit.
pub async fn commit(
    dir: &Path,
    message: &str,
    paths: Option<&[String]>,
    identity: Option<&GitIdentity>,
) -> Result<String, String> {
    repo_dir(dir)?;
    if message.trim().is_empty() {
        return Err(t!("缺少提交说明").into());
    }
    let who = identity.map(|i| [format!("user.name={}", i.name), format!("user.email={}", i.email)]);
    let mut args: Vec<&str> = vec![];
    if let Some([name, email]) = &who {
        args.extend(["-c", name, "-c", email]);
    }
    let out = match paths {
        None => {
            let spec = git::everything(dir).await;
            git(dir, &[&["add", "-A", "--"][..], spec].concat()).await?;
            if git(dir, &["diff", "--cached", "--quiet"]).await.is_ok() {
                return Err(t!("没有可提交的改动").into());
            }
            args.extend(["commit", "-m", message]);
            git(dir, &args).await?
        }
        Some(paths) => {
            let mut picked = vec![];
            for p in paths {
                let p = tree_path(p)?;
                if !p.is_empty() && !format!("{p}/").starts_with(git::PRIVATE_DIR) {
                    picked.push(p);
                }
            }
            let list: Vec<u8> = picked.iter().flat_map(|p| [p.as_bytes(), b"\0"].concat()).collect();
            // update-index takes literal paths, deleted (even already staged as deleted) or untracked ones alike.
            git_input(dir, &["update-index", "--add", "--remove", "-z", "--stdin"], &list).await?;
            let staged = git(dir, &["diff", "--cached", "--no-renames", "--name-only", "-z"]).await?;
            let staged: HashSet<&str> = staged.split('\0').collect();
            if !picked.iter().any(|p| staged.contains(p.as_str())) {
                return Err(t!("没有可提交的改动").into());
            }
            // `--only` (implied by the pathspec) commits these paths alone, leaving the rest of the index as it was.
            args.push("--literal-pathspecs");
            args.extend(["commit", "--only", "--pathspec-from-file=-", "--pathspec-file-nul", "-m", message]);
            git_input(dir, &args, &list).await?
        }
    };
    Ok(out.lines().next().unwrap_or_default().trim().to_string())
}

/// Pushes `branch` to `remote`, setting the upstream when the branch has none. Never forced: a rejection is
/// returned as git reports it.
pub async fn push(dir: &Path, remote: &str, branch: &str) -> Result<String, String> {
    repo_dir(dir)?;
    let (remote, branch) = (arg(remote)?, arg(branch)?);
    let upstream = format!("{branch}@{{upstream}}");
    let mut args = vec!["push", "--porcelain"];
    if git(dir, &["rev-parse", "--abbrev-ref", &upstream]).await.is_err() {
        args.push("-u");
    }
    args.extend([remote, branch]);
    let out = remote_output(dir, &args, Some(NETWORK_TIMEOUT)).await.map_err(|f| f.detail)?;
    // --porcelain: `<flag>\t<from>:<to>\t<summary>` per ref, flag `!` when rejected.
    let stdout = String::from_utf8_lossy(&out.stdout);
    let refs: Vec<(char, &str)> = stdout
        .lines()
        .filter_map(|l| {
            let mut f = l.splitn(3, '\t');
            let flag = f.next()?.chars().next()?;
            let (_, summary) = (f.next()?, f.next()?);
            Some((flag, summary))
        })
        .collect();
    if let Some((_, why)) = refs.iter().find(|(flag, _)| *flag == '!') {
        return Err(format!("{remote}/{branch} {why}"));
    }
    if !out.status.success() {
        return Err(repo::explain(&String::from_utf8_lossy(&out.stderr)));
    }
    let summary = refs.first().map_or("", |(_, s)| s);
    Ok(format!("{remote}/{branch} {summary}"))
}
