import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { assertManifestLeastPrivilege, buildExtension } from '../../scripts/build-extension.mjs';

const manifestPath = new URL('../../src/extension/manifest.json', import.meta.url);
let good: Record<string, unknown>;

beforeAll(async () => {
  good = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
});

const mutated = (edit: (m: Record<string, unknown>) => void): Record<string, unknown> => {
  const copy = structuredClone(good);
  edit(copy);
  return copy;
};

describe('Task 01: least-privilege manifest', () => {
  it('accepts only the strict inert Gemini MV3 manifest', () => {
    expect(assertManifestLeastPrivilege(good)).toBe(true);
  });

  it('rejects broad matches and host permissions', () => {
    expect(() => assertManifestLeastPrivilege(mutated(m => {
      const scripts = m.content_scripts as Array<{ matches: string[] }>;
      scripts[0]!.matches = ['<all_urls>'];
    }))).toThrow();
    expect(() => assertManifestLeastPrivilege(mutated(m => { m.host_permissions = ['<all_urls>']; }))).toThrow();
  });

  it('rejects native messaging, cookie/tabs privileges and remote code', () => {
    expect(() => assertManifestLeastPrivilege(mutated(m => { m.permissions = ['nativeMessaging']; }))).toThrow();
    expect(() => assertManifestLeastPrivilege(mutated(m => { m.permissions = ['cookies', 'tabs']; }))).toThrow();
    expect(() => assertManifestLeastPrivilege(mutated(m => {
      m.content_security_policy = { extension_pages: "script-src 'self' https://evil.example; object-src 'self'" };
    }))).toThrow();
  });

  it('rejects unexpected manifest capabilities', () => {
    expect(() => assertManifestLeastPrivilege(mutated(m => { m.externally_connectable = {}; }))).toThrow();
    expect(() => assertManifestLeastPrivilege(mutated(m => { m.web_accessible_resources = []; }))).toThrow();
  });
});

describe('Task 01: reproducible inert output', () => {
  it('emits all audited artifacts after a successful build', async () => {
    // buildExtension() must create every artifact or throw; never accepts partial build.
    const digest = await buildExtension();
    expect(Object.keys(digest).sort()).toEqual(['background.js', 'content.js', 'ui.js']);
    for (const name of ['background.js', 'content.js', 'ui.js', 'manifest.json', 'popup.html']) {
      const contents = await readFile(new URL(`../../dist/${name}`, import.meta.url));
      expect(contents.length).toBeGreaterThan(0);
      if (name.endsWith('.js')) {
        const text = contents.toString('utf8');
        expect(text).toContain(`/* Phase 0 Task 01 inert bundle: ${name} */`);
      }
    }
  });

  it('build output is byte-identical on repeated builds', async () => {
    const first = await buildExtension();
    const second = await buildExtension();
    expect(first).toEqual(second);
    const html = await readFile(new URL('../../dist/popup.html', import.meta.url), 'utf8');
    expect(html).toMatch(/id="start"[^>]*disabled/u);
    expect(html).toMatch(/id="cancel"[^>]*disabled/u);
  });
});
