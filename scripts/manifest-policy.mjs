/* Task 01: independently testable, fail-closed manifest validator. */
const allowedKeys = new Set([
  'manifest_version', 'name', 'version', 'description', 'permissions',
  'host_permissions', 'background', 'content_scripts', 'action',
  'content_security_policy'
]);

function strictKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: expected object`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) throw new Error(`${label}: disallowed key ${key}`);
  }
}

export function assertManifestLeastPrivilege(manifest) {
  strictKeys(manifest, allowedKeys, 'manifest');
  if (manifest.manifest_version !== 3) throw new Error('MV3 only');
  if (typeof manifest.name !== 'string' || manifest.name.length === 0 || manifest.name.length > 75) {
    throw new Error('Manifest name must contain 1–75 characters');
  }
  if (typeof manifest.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/u.test(manifest.version) ||
      manifest.version.split('.').some(part => Number(part) > 65535)) {
    throw new Error('Manifest version must contain 1–4 integers from 0 to 65535');
  }
  if (!Array.isArray(manifest.permissions) || manifest.permissions.length !== 0) {
    throw new Error('Task 01 forbids extension permissions');
  }
  if (!Array.isArray(manifest.host_permissions) || manifest.host_permissions.length !== 0) {
    throw new Error('Task 01 forbids host permissions');
  }
  strictKeys(manifest.background, new Set(['service_worker', 'type']), 'background');
  if (manifest.background.service_worker !== 'background.js' || manifest.background.type !== 'module') {
    throw new Error('Unexpected service worker entry');
  }
  if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length !== 1) {
    throw new Error('Exactly one inert Gemini content script expected');
  }
  const [script] = manifest.content_scripts;
  strictKeys(script, new Set(['matches', 'js', 'run_at', 'all_frames', 'world']), 'content_script');
  if (JSON.stringify(script.matches) !== JSON.stringify(['https://gemini.google.com/*']) ||
      JSON.stringify(script.js) !== JSON.stringify(['content.js']) ||
      script.run_at !== 'document_idle' || script.all_frames !== false ||
      script.world !== 'ISOLATED') {
    throw new Error('Gemini-only isolated script contract violated');
  }
  strictKeys(manifest.action, new Set(['default_popup']), 'action');
  if (manifest.action.default_popup !== 'popup.html') throw new Error('Unexpected popup');
  strictKeys(manifest.content_security_policy, new Set(['extension_pages']), 'content_security_policy');
  if (manifest.content_security_policy.extension_pages !== "script-src 'self'; object-src 'self'") {
    throw new Error('Remote code or non-self CSP forbidden');
  }
  return true;
}
