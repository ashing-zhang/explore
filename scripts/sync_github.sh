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
