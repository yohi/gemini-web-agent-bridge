#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
mkdir -p task01-logs
status_file=task01-logs/STATUS.txt
: > "$status_file"
printf 'Task 01 scoped command verification; not an Execution Gate authorization.\n' | tee -a "$status_file"

save_result() {
  code="$1"
  printf 'EXIT_CODE=%s\n' "$code" >> "$status_file"
  echo "Result status: $code" | tee -a "$status_file"
  # Prefer Python's standard library: some CI/devcontainers have no zip binary.
  # Exclude dependencies, symlinks, auth material, and git internals.
  if command -v python3 >/dev/null 2>&1; then
    printf 'RESULT_ZIP=/tmp/gemini-web-agent-bridge-task01-remediation-result.zip\n' >> "$status_file"
    python3 - <<'PYZIP' || printf 'RESULT_ZIP_CREATION_FAILED\n' >> "$status_file"
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path.cwd()
output = Path('/tmp/gemini-web-agent-bridge-task01-remediation-result.zip')
excluded_dirs = {'node_modules', '.git', '.npm', '.cache', 'coverage'}
excluded_names = {'.env', '.npmrc'}
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(root.rglob('*')):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(root)
        if any(part in excluded_dirs for part in relative.parts):
            continue
        if path.name in excluded_names or path.name.startswith('.env.'):
            continue
        if path.suffix in {'.pem', '.key', '.p12'}:
            continue
        archive.write(path, arcname=f'{root.name}/{relative.as_posix()}')
print(f'Result ZIP: {output}')
PYZIP
  else
    printf 'RESULT_ZIP_UNAVAILABLE: python3 command missing.\n' >> "$status_file"
  fi
}
trap 'save_result "$?"' EXIT

run() {
  label="$1"; shift
  printf '\n=== %s ===\n' "$label" | tee -a "$status_file"
  "$@" > "task01-logs/${label}.log" 2>&1 || { c="$?"; cat "task01-logs/${label}.log"; printf '%s FAIL code=%s\n' "$label" "$c" | tee -a "$status_file"; return "$c"; }
  cat "task01-logs/${label}.log"
  printf '%s PASS\n' "$label" | tee -a "$status_file"
}
run node-version node --version
run npm-version npm --version
run node22-environment node scripts/assert-node22.mjs
run red-security-fixtures node --test tests/unit/manifest-policy.node.test.mjs
# Do not invent a lockfile; obtain registry metadata from the approved npm endpoint.
run lockfile-generation npm install --package-lock-only --no-audit --no-fund
run clean-npm-ci npm ci --no-audit --no-fund
run typecheck npm run typecheck
run lint npm run lint
run vitest npx --no-install vitest run tests/unit/harness.test.ts
run build npm run build:extension
run manifest-negative-tests node --test tests/unit/manifest-policy.node.test.mjs
printf '\nAll listed commands passed. Candidate PASS only; primary ChatGPT review required.\n' | tee -a "$status_file"
