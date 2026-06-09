#!/usr/bin/env bash
set -euo pipefail

commit_message="${1:-sync}"
remote="${2:-origin}"

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

branch="$(git rev-parse --abbrev-ref HEAD)"

if ! git remote get-url "$remote" >/dev/null 2>&1; then
  echo "Remote '$remote' does not exist." 1>&2
  echo "Existing remotes:" 1>&2
  git remote -v 1>&2 || true
  exit 1
fi

if [[ -f "sql/config.yaml" ]]; then
  if awk -F'"' '/^[[:space:]]*access_id:[[:space:]]*"/ { if ($2 !~ /^YOUR_/) exit 0 } END { exit 1 }' "sql/config.yaml"; then
    echo "Refusing to sync: sql/config.yaml appears to contain a real access_id." 1>&2
    exit 2
  fi
  if awk -F'"' '/^[[:space:]]*secret_access_key:[[:space:]]*"/ { if ($2 !~ /^YOUR_/) exit 0 } END { exit 1 }' "sql/config.yaml"; then
    echo "Refusing to sync: sql/config.yaml appears to contain a real secret_access_key." 1>&2
    exit 2
  fi
fi

git add -A

if ! git diff --cached --quiet; then
  git commit -m "$commit_message"
fi

if git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
  git pull --rebase "$remote" "$branch"
  git push "$remote" "$branch"
else
  git pull --rebase "$remote" "$branch" || true
  git push -u "$remote" "$branch"
fi
