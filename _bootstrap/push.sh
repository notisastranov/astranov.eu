#!/usr/bin/env bash
# push.sh — Bootstrap all AstranoV lab repos with starter files.
# Run from the _bootstrap/ directory.
# Requires: git with push access to notisastranov/* repos.
#
# Usage:
#   cd _bootstrap && bash push.sh
#   bash push.sh claude        # push only one lab
#   bash push.sh grok chatgpt  # push specific labs

set -euo pipefail

OWNER="notisastranov"
LABS=(claude grok chatgpt gemini deepseek)
SHARED_DIR="shared"

if [[ $# -gt 0 ]]; then
  LABS=("$@")
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

for lab in "${LABS[@]}"; do
  REPO="astranov.eu-${lab}"
  LAB_DIR="labs/${lab}"
  echo "=== Bootstrapping ${REPO} ==="

  if [[ ! -d "$LAB_DIR" ]]; then
    echo "  ERROR: ${LAB_DIR} not found, skipping"
    continue
  fi

  CLONE_DIR="${TMPDIR}/${REPO}"
  git clone --depth 1 "https://github.com/${OWNER}/${REPO}.git" "$CLONE_DIR" 2>/dev/null || {
    echo "  Clone failed — repo may not exist yet. Skipping."
    continue
  }

  # Copy shared files
  cp "${SHARED_DIR}/vercel.json" "${CLONE_DIR}/vercel.json"
  cp "${SHARED_DIR}/sw.js" "${CLONE_DIR}/sw.js"

  # Copy lab-specific files
  cp "${LAB_DIR}/index.html" "${CLONE_DIR}/index.html"
  cp "${LAB_DIR}/manifest.json" "${CLONE_DIR}/manifest.json"
  cp "${LAB_DIR}/CLAUDE.md" "${CLONE_DIR}/CLAUDE.md"

  cd "$CLONE_DIR"
  git add -A
  if git diff --cached --quiet; then
    echo "  No changes to push."
  else
    git commit -m "Bootstrap lab with starter kit from main astranov repo"
    git push origin main
    echo "  Pushed to ${OWNER}/${REPO}"
  fi
  cd - > /dev/null

  echo ""
done

echo "Done. Each lab repo now has: index.html, CLAUDE.md, vercel.json, manifest.json, sw.js"
