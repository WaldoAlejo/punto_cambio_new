#!/usr/bin/env bash
set -euo pipefail
echo "Cleaning project artifacts..."
rm -rf dist-server
rm -rf backups
rm -rf prisma/migrations
rm -rf node_modules/.cache
echo "Done. Review `git status` to see deletions."
