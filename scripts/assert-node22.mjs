// Task 01 build reproducibility: use the Node 22 major pinned by package.json.
const actualMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
if (actualMajor !== 22) {
  process.stderr.write(`BLOCKED: Task 01 requires Node 22.x; got ${process.version}.\n`);
  process.stderr.write('Use an approved Node 22 devcontainer or nvm use 22; do not edit package.json.\n');
  process.exitCode = 1;
} else {
  process.stdout.write(`Node 22 environment verified: ${process.version}\n`);
}
