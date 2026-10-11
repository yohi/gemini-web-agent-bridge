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
  if command -v python3 >/dev/null 2>&1; then
    printf 'RESULT_ZIP=/tmp/gemini-web-agent-bridge-task01-remediation-result.zip\n' >> "$status_file"
    python3 - <<'PYZIP' || printf 'RESULT_ZIP_CREATION_FAILED\n' >> "$status_file"
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path.cwd()
output = Path('/tmp/gemini-web-agent-bridge-task01-remediation-result.zip')
allowed_paths = [
    'LICENSE', 'package.json', 'package-lock.json', 'run-task01-validation.sh',
    'eslint.config.js', 'tsconfig.json', 'vitest.config.ts',
    'docs/reports/phase-0-task-01-blocked.md',
    'docs/reports/phase-0-task-01-verified.md',
    'scripts/assert-node22.mjs', 'scripts/build-extension.mjs',
    'scripts/manifest-policy.mjs',
    'src/extension/background.ts', 'src/extension/content.ts',
    'src/extension/manifest.json', 'src/extension/popup.html', 'src/extension/ui.ts',
    'tests/unit/harness.test.ts', 'tests/unit/manifest-policy.node.test.mjs',
    'task01-logs/STATUS.txt',
    *[f'task01-logs/{name}.log' for name in (
        'node-version', 'npm-version', 'node22-environment',
        'red-security-fixtures', 'lockfile-generation', 'clean-npm-ci',
        'typecheck', 'lint', 'vitest', 'build', 'manifest-negative-tests'
    )],
]
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for relative_name in allowed_paths:
        path = root / relative_name
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(root)
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
if [[ ! -f package-lock.json ]]; then
  run lockfile-generation npm install --package-lock-only --no-audit --no-fund
fi
run clean-npm-ci npm ci --no-audit --no-fund
run typecheck npm run typecheck
run lint npm run lint
run vitest npx --no-install vitest run tests/unit/harness.test.ts
run build npm run build:extension
run manifest-negative-tests node --test tests/unit/manifest-policy.node.test.mjs
printf '\nAll listed commands passed. Candidate PASS only; primary ChatGPT review required.\n' | tee -a "$status_file"
