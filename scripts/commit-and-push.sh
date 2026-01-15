#!/usr/bin/env bash
set -euo pipefail
BRANCH=${1:-clean-start}
MSG=${2:-"chore: add fresh seed and clear-migrations script"}

echo "Using branch: $BRANCH"
# create branch if not exists
if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git checkout -b "$BRANCH"
else
  git checkout "$BRANCH"
fi

# add files we created/modified
git add prisma/seed.ts prisma/seed-complete.ts prisma/seed-admin.ts prisma/seed-production.ts scripts/clear-migrations.ts scripts/commit-and-push.sh package.json

git commit -m "$MSG" || echo "Nothing to commit"

# push and set upstream if needed
if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  git push
else
  git push -u origin "$BRANCH"
fi

echo "Pushed branch $BRANCH to origin." 
