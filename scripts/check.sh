#!/usr/bin/env bash
# Pre-push self-check: typecheck + lint, then only the suites the change can affect (Jenkins still runs everything).
# Usage: scripts/check.sh [--all] [base]   base defaults to origin/main; uncommitted and untracked files count too.
set -euo pipefail
cd "$(dirname "$0")/.."

all=false
[ "${1:-}" = "--all" ] && { all=true; shift; }
base="$(git merge-base HEAD "${1:-origin/main}")"
changed="$( { git diff --name-only "$base"; git ls-files --others --exclude-standard; } | sort -u)"

web=false desktop=false server=false protocol=false cargo=false tools=false
for f in $changed; do
  case "$f" in
    docs/* | *.md | e2e/* | videos/* | website/*) ;;
    apps/web/*) web=true desktop=true ;; # desktop imports web's src through @web
    apps/desktop/src-tauri/*) cargo=true ;;
    apps/desktop/*) desktop=true ;;
    apps/server/*) server=true ;;
    packages/protocol/*) all=true ;; # every side speaks the protocol, the daemon through its fixtures
    crates/* | Cargo.toml | Cargo.lock | rust-toolchain.toml | rustfmt.toml) cargo=true ;;
    tools/*.mjs) tools=true ;;
    tools/*) cargo=true ;; # the daemon's tests drive tools/mock-agent and tools/mcp-echo
    *) all=true ;; # lockfile, root config, scripts: no telling what they reach
  esac
done
$all && web=true desktop=true server=true protocol=true cargo=true tools=true

run() { echo "▶ $*"; "$@"; }
run pnpm typecheck
run pnpm lint
$tools && run node --test tools/*.test.mjs
$protocol && run pnpm --filter @gonggong/protocol test
$desktop && run pnpm --filter @gonggong/desktop test
$web && run pnpm --filter @gonggong/web test
$server && run pnpm --filter @gonggong/server test
# Bot shells export git identity and proxies, which the daemon's git and TLS tests must not see.
$cargo && run env -u GIT_AUTHOR_NAME -u GIT_AUTHOR_EMAIL -u GIT_COMMITTER_NAME -u GIT_COMMITTER_EMAIL \
  -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy cargo test --workspace
echo "✓ check passed"
