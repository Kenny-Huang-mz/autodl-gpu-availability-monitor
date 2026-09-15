import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const required = [
  'background.js', 'content.js', 'content.css', 'popup.html', 'popup.js', 'popup.css',
  'global-alert.js', 'offscreen.html', 'offscreen.js',
  ...Object.values(manifest.icons || {}),
];

for (const file of required) await access(file);
for (const file of ['background.js', 'content.js', 'popup.js', 'global-alert.js', 'offscreen.js']) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

if (manifest.manifest_version !== 3) throw new Error('manifest_version must be 3');
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('manifest version must be x.y.z');
if (manifest.permissions?.includes('tabs')) throw new Error('tabs permission is intentionally not allowed');

console.log(`OK: ${manifest.name} v${manifest.version}`);
