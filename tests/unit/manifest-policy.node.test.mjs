import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { assertManifestLeastPrivilege } from '../../scripts/manifest-policy.mjs';

const safe = JSON.parse(await readFile(new URL('../../src/extension/manifest.json', import.meta.url), 'utf8'));
const change = edit => { const copy = structuredClone(safe); edit(copy); return copy; };

test('inert Gemini-only MV3 manifest is accepted', () => {
  assert.equal(assertManifestLeastPrivilege(safe), true);
});
test('<all_urls> content match is denied', () => {
  assert.throws(() => assertManifestLeastPrivilege(change(m => { m.content_scripts[0].matches = ['<all_urls>']; })));
});
test('nativeMessaging is denied', () => {
  assert.throws(() => assertManifestLeastPrivilege(change(m => { m.permissions = ['nativeMessaging']; })));
});
test('remote CSP script and unintended host permission are denied', () => {
  assert.throws(() => assertManifestLeastPrivilege(change(m => { m.content_security_policy.extension_pages = "script-src https://invalid.example; object-src 'self'"; })));
  assert.throws(() => assertManifestLeastPrivilege(change(m => { m.host_permissions = ['https://example.com/*']; })));
});
test('additional manifest capabilities are denied', () => {
  assert.throws(() => assertManifestLeastPrivilege(change(m => { m.externally_connectable = {}; })));
});
