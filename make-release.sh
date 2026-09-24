#!/usr/bin/env bash
# make-release.sh — builds the buyer-facing zip for this Skilllet.
#
#   ./make-release.sh
#   → release/IndieOps-Skilllet-2026-13-GBPCoach-v1.0.zip   (unzips to  gbpcoach/)
#
# Branded outside, clean inside. Only files git tracks can ship, so an untracked
# .env, a scratch file or a stray zip can't sneak in. Then it REFUSES outright if
# anything that must never reach a buyer made it into the staging folder.
#
# Master copy: IndieOps-Co/indieops-brand/scripts/make-release.sh. Copy it into
# a Skilllet's repo root; it works out the rest from the folder name.
set -euo pipefail
cd "$(dirname "$0")"

SLUG=$(basename "$PWD")
REGISTRY="../../skilllet-registry/catalogue.json"

# Version: the plugin manifest if there is one, else the latest v* tag, else "dev".
VERSION=""
[ -f .claude-plugin/plugin.json ] && VERSION=$(node -p "require('./.claude-plugin/plugin.json').version || ''" 2>/dev/null || true)
[ -n "$VERSION" ] || VERSION=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null | sed 's/^v//' || true)
[ -n "$VERSION" ] || VERSION="dev"

# Branded name from the registry: IndieOps-Skilllet-<id>-<Name>-v<version>.zip
ZIPNAME="$SLUG-v$VERSION.zip"
if [ -f "$REGISTRY" ] && command -v node >/dev/null; then
  BRANDED=$(node -e '
    const c = require(process.argv[1]); const s = c.skilllets.find((x) => x.slug === process.argv[2] || (x.previously || []).includes(process.argv[2]));
    if (s) process.stdout.write(`IndieOps-Skilllet-${s.id}-${s.name.replace(/[^A-Za-z0-9]+/g, "")}`);
  ' "$(cd "$(dirname "$REGISTRY")" && pwd)/catalogue.json" "$SLUG" 2>/dev/null || true)
  [ -n "$BRANDED" ] && ZIPNAME="$BRANDED-v$VERSION.zip"
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "REFUSING: not a git repo. Only tracked files may ship."; exit 1; }
[ -z "$(git status --porcelain)" ] || echo "Note: uncommitted changes are NOT in this release (only committed files ship)."

STAGE="release/.stage/$SLUG"
rm -rf release/.stage "release/$ZIPNAME"
mkdir -p "$STAGE"

# Never ships: sales copy, the guide's Markdown source, repo housekeeping, internal plans.
git ls-files | grep -v -E '^(marketing/|guide\.md$|REPO\.md$|PUSH\.md$|RELEASING\.md$|make-release\.sh$|\.gitignore$|\.github/|release/|PLAN[^/]*\.md$)' > release/.stage/files.txt
rsync -a --files-from=release/.stage/files.txt ./ "$STAGE"/

# Belt and braces: check the staging folder itself, however things got there.
bad=$(cd "$STAGE" && find . \( -path ./marketing -o -name guide.md -o -path ./.env -o -path ./.env.local -o -name node_modules -o -name .git \) -print)
if [ -n "$bad" ]; then
  echo "REFUSING: these must never reach a buyer:"; echo "$bad"; rm -rf release/.stage; exit 1
fi
if grep -rIl -E '(sk-(live|proj)-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' "$STAGE" >/dev/null 2>&1; then
  echo "REFUSING: something that looks like a real secret is in the release:"
  grep -rIl -E '(sk-(live|proj)-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' "$STAGE"
  rm -rf release/.stage; exit 1
fi
[ -f "$STAGE/guide.html" ] || echo "Warning: no guide.html. Every Skilllet should ship its HTML guide (indieops-brand/scripts/build-guide.mjs)."

(cd release/.stage && zip -rqX "../$ZIPNAME" "$SLUG")
rm -rf release/.stage
echo "→ release/$ZIPNAME  ($(unzip -l "release/$ZIPNAME" | tail -1 | awk '{print $2}') files)"
