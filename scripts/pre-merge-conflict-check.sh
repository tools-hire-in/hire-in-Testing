#!/bin/bash
# ---------------------------------------------------------------------------
# Pre-merge conflict check.
#
# Performs a dry-run git merge against the incoming branch and halts if any
# unmerged entries are found. Text conflicts show the first conflict block
# excerpt; binary/structural conflicts are listed with a note.
#
# Usage:
#   bash scripts/pre-merge-conflict-check.sh [<branch-or-ref>]
#
# Branch resolution order:
#   1. First positional argument (or MERGE_BRANCH env var)
#   2. MERGE_HEAD file (already mid-merge)
#   3. origin/main → main (fallback for standalone / CI use)
# ---------------------------------------------------------------------------
set -uo pipefail

BRANCH="${1:-${MERGE_BRANCH:-}}"

# ── Resolve which ref we are merging ────────────────────────────────────────
if [ -z "$BRANCH" ]; then
  GIT_DIR=$(git rev-parse --git-dir 2>/dev/null || true)
  if [ -n "$GIT_DIR" ] && [ -f "$GIT_DIR/MERGE_HEAD" ]; then
    BRANCH=$(cat "$GIT_DIR/MERGE_HEAD")
    echo "ℹ️  Detected active MERGE_HEAD: $BRANCH"
  elif git rev-parse --verify origin/main >/dev/null 2>&1; then
    BRANCH="origin/main"
    echo "ℹ️  No branch supplied; defaulting to origin/main for standalone check."
  elif git rev-parse --verify main >/dev/null 2>&1; then
    BRANCH="main"
    echo "ℹ️  No branch supplied; defaulting to main for standalone check."
  else
    echo "❌ Cannot determine a ref to check against."
    echo "   Supply a branch: bash scripts/pre-merge-conflict-check.sh <branch>"
    exit 1
  fi
fi

CURRENT=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
echo "🔍 Conflict pre-flight: dry-run merge of '$BRANCH' into '$CURRENT' ..."

# ── Stash any local changes (tracked, staged, and untracked) ─────────────────
STASHED=false
HAS_TRACKED=$(git diff --quiet && git diff --cached --quiet && echo "no" || echo "yes")
HAS_UNTRACKED=$(git ls-files --others --exclude-standard | head -1)
if [ "$HAS_TRACKED" = "yes" ] || [ -n "$HAS_UNTRACKED" ]; then
  if git stash push --include-untracked -m "pre-merge-conflict-check-stash" 2>/dev/null; then
    STASHED=true
  else
    echo "⚠️  Could not stash working-tree changes — proceeding anyway (results may be noisy)."
  fi
fi

# ── Cleanup: abort dry-run merge and restore stash ───────────────────────────
CLEANED_UP=false
cleanup() {
  if [ "$CLEANED_UP" = false ]; then
    CLEANED_UP=true
    git merge --abort 2>/dev/null || true
    if [ "$STASHED" = true ]; then
      git stash pop 2>/dev/null || echo "⚠️  Could not restore stash — run 'git stash pop' manually."
    fi
  fi
}
trap cleanup EXIT

# ── Attempt the dry-run merge ────────────────────────────────────────────────
git merge --no-commit --no-ff "$BRANCH" 2>&1 || true

# ── Collect ALL unmerged entries (authoritative — includes binary/structural) ─
# git diff --diff-filter=U lists every file Git considers unresolved.
UNMERGED_FILES=()
while IFS= read -r file; do
  [ -n "$file" ] && UNMERGED_FILES+=("$file")
done < <(git diff --name-only --diff-filter=U 2>/dev/null || true)

# ── For text conflicts, capture first marker block BEFORE aborting ────────────
declare -A CONFLICT_EXCERPTS
for file in "${UNMERGED_FILES[@]}"; do
  if [ -f "$file" ] && grep -qP '^<{7} ' "$file" 2>/dev/null; then
    excerpt=$(awk '
      /^<{7} / { in_block=1; count=0 }
      in_block  { lines[count++] = $0 }
      /^>{7} /  { if (in_block) { in_block=0; found=1; exit } }
      in_block && count >= 25 { lines[count++] = "... (block truncated)"; in_block=0; found=1; exit }
      END {
        if (found || in_block) {
          for (i=0; i<count; i++) print "    " lines[i]
        }
      }
    ' "$file")
    CONFLICT_EXCERPTS["$file"]="$excerpt"
  else
    CONFLICT_EXCERPTS["$file"]="    (no text markers — binary or structural conflict)"
  fi
done

# ── Cleanup now so stash is restored before we print ─────────────────────────
cleanup

# ── Report and exit ──────────────────────────────────────────────────────────
if [ ${#UNMERGED_FILES[@]} -gt 0 ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║         MERGE CONFLICTS DETECTED — DEVELOPER ACTION REQUIRED        ║"
  echo "╚══════════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "The following files have conflicts that must be resolved manually:"
  echo ""

  for file in "${UNMERGED_FILES[@]}"; do
    echo "  ── $file ──────────────────────────────────────────"
    echo "${CONFLICT_EXCERPTS[$file]}"
    echo ""
  done

  echo "MERGE HALTED: conflicts detected — developer manual approval required before this merge can proceed."
  echo ""
  echo "Resolution steps:"
  echo "  1. Check out both branches locally."
  echo "  2. Resolve each conflict block shown above."
  echo "  3. Stage the resolved files (git add <file>)."
  echo "  4. Re-run the merge / post-merge script once all conflicts are cleared."
  exit 1
fi

echo "✅ No merge conflicts detected. Proceeding."
exit 0
