#!/usr/bin/env bash
# One-command client release (docs/plan/发布与平台说明.md):
#   scripts/release/ship.sh <version>                 bump, tag, push, build every artifact, publish the GitHub release
#   scripts/release/ship.sh verify <version> <server> check that <server> serves <version> to daemons and desktop apps
# Write docs/release-notes/v<version>.md and the CHANGELOG entry (`## v<version> — <date>`) first; they are committed
# with the version bump. Then, without waiting on each other: GitHub Actions builds the Windows desktop installer from
# the pushed tag while this machine runs scripts/release.sh (its Docker builds beside the macOS ones). The assets go to
# a draft release in parallel; once Windows is done its installer is fetched into dist/<version>, the full latest.json
# uploaded and the release published. dist/<version> is then complete for `client_release_publish` (dir), which puts
# it on the space in one go. Every step checks what is already done, so a failed run can simply be started again.
# scripts/release.sh reads its usual environment (TAURI_SIGNING_PRIVATE_KEY, APPLE_NOTARY_PROFILE,
# GONGGONG_SKIP_DOCKER_CAST…) and needs Docker running.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

repo="${GONGGONG_GITHUB_REPO:-yoqu/gonggong-space}"
# Proxies a Bot's environment injects break git pushes and gh (Proxy CONNECT aborted).
direct() { env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy -u ALL_PROXY -u all_proxy "$@"; }
step() { echo "== $(date +%H:%M:%S) $*"; }

valid() { [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "error: not a version: $1" >&2; exit 2; }; }

verify() {
  local v="$1" server="${2%/}" ok=1 platform body
  for platform in darwin/aarch64 windows/x86_64; do
    body="$(curl -sS "$server/api/desktop-update/$platform/0.0.0" || true)"
    if node -e 'const r = JSON.parse(process.argv[1]); process.exit(r.version === process.argv[2] && r.signature ? 0 : 1)' \
      "$body" "$v" 2>/dev/null; then
      echo "ok   desktop $platform → $v"
    else
      echo "FAIL desktop $platform: $body"
      ok=0
    fi
  done
  for platform in macos-aarch64 macos-x86_64 linux-x86_64 linux-aarch64 windows-x86_64.exe; do
    if curl -sSfI -o /dev/null "$server/downloads/gonggong-$v-$platform"; then
      echo "ok   gg $platform"
    else
      echo "FAIL gg $platform: not served"
      ok=0
    fi
  done
  [ "$ok" = 1 ]
}

if [ "${1:-}" = verify ]; then
  [ $# -eq 3 ] || { echo "usage: $0 verify <version> <server-url>" >&2; exit 2; }
  valid "$2"
  verify "$2" "$3"
  exit
fi
[ $# -eq 1 ] || { echo "usage: $0 <version> | verify <version> <server-url>" >&2; exit 2; }
v="$1"
valid "$v"
tag="v$v"
out="$ROOT/dist/$v"
notes="docs/release-notes/$tag.md"
cd "$ROOT"

[ "$(git branch --show-current)" = main ] || { echo "error: release from main" >&2; exit 1; }
[ -f "$notes" ] || { echo "error: write $notes first" >&2; exit 1; }
grep -q "^## $tag " CHANGELOG.md || { echo "error: add a '## $tag — <date>' entry to CHANGELOG.md first" >&2; exit 1; }
direct git fetch -q gitlab main
git merge-base --is-ancestor gitlab/main HEAD || { echo "error: main is behind gitlab/main, pull first" >&2; exit 1; }
# Only the release's own files may be changed (the bump too, when a run is started again): anything else would ship
# uncommitted.
release_files=(CHANGELOG.md "$notes" Cargo.lock crates/gonggong/Cargo.toml apps/desktop/src-tauri/Cargo.toml
  apps/desktop/src-tauri/tauri.conf.json)
stray="$(git status --porcelain --untracked-files=no -- . "${release_files[@]/#/:!}")"
[ -z "$stray" ] || { echo "error: uncommitted changes besides the notes and CHANGELOG:" >&2; echo "$stray" >&2; exit 1; }

if [ "$(gonggong_version)" != "$v" ]; then
  step "bump to $v"
  sed -i '' "1,/^version = /s/^version = \".*\"/version = \"$v\"/" crates/gonggong/Cargo.toml apps/desktop/src-tauri/Cargo.toml
  sed -i '' "s/^  \"version\": \".*\",/  \"version\": \"$v\",/" apps/desktop/src-tauri/tauri.conf.json
  cargo update -q --workspace --offline
fi
git add "${release_files[@]}"
git diff --cached --quiet || git commit -qm "chore(release): $tag——版本号、CHANGELOG 与更新说明"
git rev-parse -q --verify "refs/tags/$tag" >/dev/null || git tag "$tag"
step "push main and $tag"
direct git push -q gitlab HEAD:main
direct git push -q origin HEAD:main "$tag"

if ! direct gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  direct gh release create "$tag" --repo "$repo" --draft --verify-tag --title "共工空间 $tag" --notes-file "$notes"
fi
assets="$(direct gh release view "$tag" --repo "$repo" --json assets -q '.assets[].name')"
win="Gonggong_${v}_x64-setup.exe"
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if ! grep -qx "$win.sig" <<< "$assets"; then
  step "start the Windows desktop build"
  direct gh workflow run desktop-windows.yml --repo "$repo" --ref "$tag" -f tag="$tag"
fi

step "build (scripts/release.sh)"
# The tree holds the bump commit and, at most, untracked files unrelated to the release.
bash scripts/release.sh --allow-dirty

step "upload to the draft release"
cd "$out"
shopt -s nullglob
files=(gonggong-"$v"-* gg-cast-"$v"-* Gonggong_"$v"_*.dmg Gonggong_"$v"_*.app.tar.gz Gonggong_"$v"_*.app.tar.gz.sig
  SHA256SUMS github/manifest.json)
printf '%s\0' "${files[@]}" |
  direct xargs -0 -P 4 -I{} gh release upload "$tag" {} --repo "$repo" --clobber

if ! grep -qx "$win.sig" <<< "$assets"; then
  step "wait for the Windows desktop build"
  run=""
  for _ in $(seq 30); do
    run="$(direct gh run list --repo "$repo" --workflow desktop-windows.yml --event workflow_dispatch -L 20 \
      --json databaseId,headBranch,createdAt \
      -q "[.[] | select(.headBranch == \"$tag\" and .createdAt >= \"$started\")] | last | .databaseId // empty")"
    [ -n "$run" ] && break
    sleep 10
  done
  [ -n "$run" ] || { echo "error: the Windows build did not start (gh run list --workflow desktop-windows.yml)" >&2; exit 1; }
  direct gh run watch "$run" --repo "$repo" --exit-status --interval 30 > /dev/null ||
    { echo "error: the Windows build failed: gh run view $run --repo $repo --log-failed" >&2; exit 1; }
fi
direct gh release download "$tag" --repo "$repo" --pattern "$win" --pattern "$win.sig" --dir . --clobber
for f in "$win" "$win.sig"; do
  size="$(direct gh release view "$tag" --repo "$repo" --json assets -q ".assets[] | select(.name == \"$f\") | .size")"
  [ "$(wc -c < "$f" | tr -d ' ')" = "$size" ] || { echo "error: $f is not the release asset's size ($size)" >&2; exit 1; }
done

step "publish the release"
# The Windows job merges its entry into whatever latest.json the release had; write the full feed here instead.
node -e '
  const fs = require("fs")
  const [file, sig, url] = process.argv.slice(1)
  const feed = JSON.parse(fs.readFileSync(file, "utf8"))
  feed.platforms["windows-x86_64"] = { signature: fs.readFileSync(sig, "utf8").trim(), url }
  fs.writeFileSync(file, JSON.stringify(feed, null, 2))
' github/latest.json "$win.sig" "https://github.com/$repo/releases/download/$tag/$win"
direct gh release upload "$tag" github/latest.json --repo "$repo" --clobber
direct gh release edit "$tag" --repo "$repo" --draft=false --latest
step "released $tag: https://github.com/$repo/releases/tag/$tag"
echo "next: client_release_publish with dir=dist/$v, then $0 verify $v <server-url>"
