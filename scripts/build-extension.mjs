import { build } from 'esbuild';
import { assertManifestLeastPrivilege } from './manifest-policy.mjs';
export { assertManifestLeastPrivilege } from './manifest-policy.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src/extension');
const out = join(root, 'dist');
function assertNoRemoteCode(text, filename) {
  // Task 01 scripts have no network/DOM or dynamic JS execution permissions.
  if (/\b(?:eval|Function|importScripts)\s*\(/u.test(text) ||
      /\bimport\s*\(/u.test(text) ||
      /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/u.test(text) ||
      /https?:\/\//u.test(text)) {
    throw new Error(`${filename}: dynamic/remote execution or network access disallowed`);
  }
}

async function compile(entry, outfile, format) {
  const result = await build({
    entryPoints: [join(source, entry)],
    outfile: join(out, outfile),
    bundle: true,
    platform: 'browser',
    target: 'es2022',
    format,
    write: false,
    metafile: true,
    logLevel: 'silent',
    // Preserve a non-executable audit marker even when esbuild tree-shakes
    // an intentionally empty background/content module to zero bytes.
    banner: { js: `/* Phase 0 Task 01 inert bundle: ${outfile} */` },
    legalComments: 'none',
    sourcemap: false
  });
  if (result.errors.length || result.outputFiles?.length !== 1) {
    throw new Error(`Unexpected build result for ${entry}`);
  }
  const bundled = result.outputFiles[0];
  if (!bundled) throw new Error(`Missing bundle: ${outfile}`);
  const bytes = bundled.contents;
  if (bytes.byteLength === 0) {
    throw new Error(`Empty built script: ${outfile}`);
  }
  assertNoRemoteCode(Buffer.from(bytes).toString('utf8'), outfile);
  return { outfile, bytes, digest: createHash('sha256').update(bytes).digest('hex') };
}

export async function buildExtension() {
  const manifestText = await readFile(join(source, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  assertManifestLeastPrivilege(manifest);
  const popup = await readFile(join(source, 'popup.html'), 'utf8');
  if (!/\bid="start"[^>]*\bdisabled\b/u.test(popup) ||
      !/\bid="cancel"[^>]*\bdisabled\b/u.test(popup) ||
      !/<script src="ui\.js" defer><\/script>/u.test(popup) ||
      /<script(?! src="ui\.js" defer>)/u.test(popup)) {
    throw new Error('Popup must have disabled controls and one local script');
  }
  const compiled = await Promise.all([
    compile('background.ts', 'background.js', 'esm'),
    compile('content.ts', 'content.js', 'iife'),
    compile('ui.ts', 'ui.js', 'iife')
  ]);
  // Only replace dist after manifest + all bundles have passed the audit.
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await Promise.all([
    writeFile(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    writeFile(join(out, 'popup.html'), popup),
    ...compiled.map(({ outfile, bytes }) => writeFile(join(out, outfile), bytes))
  ]);
  return Object.fromEntries(compiled.map(({ outfile, digest }) => [outfile, digest]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const hashes = await buildExtension();
    process.stdout.write(`MV3 inactive build OK: ${JSON.stringify(hashes)}\n`);
  } catch (error) {
    process.stderr.write(`MV3 build BLOCKED: ${String(error)}\n`);
    process.exitCode = 1;
  }
}
