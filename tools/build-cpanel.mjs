/**
 * Packs the website for cPanel: cpanel/website-upload.zip, ready to extract into the site folder
 * (File Manager → sreevaaraahifarms.in).
 * Cloudflare-only files (_redirects, _headers) are left out; cPanel uses cpanel/htaccess-rules.txt.
 *   npm run cpanel
 * On Windows this uses the built-in tar.exe, which writes zip paths with "/" so they unpack into
 * folders on the Linux host. (Windows PowerShell's Compress-Archive writes "\" and breaks them.)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const site = join(root, 'site');
const out = join(root, 'cpanel');
const zip = join(out, 'website-upload.zip');

mkdirSync(out, { recursive: true });
if (existsSync(zip)) rmSync(zip);

const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : null;
if (tar && existsSync(tar)) {
  execFileSync(tar, ['-a', '-c', '-f', zip, '--exclude', '_redirects', '--exclude', '_headers', '-C', site, '.']);
} else {
  execFileSync('zip', ['-r', '-q', zip, '.', '-x', '_redirects', '_headers'], { cwd: site });
}
console.log(`cpanel/website-upload.zip: ${(statSync(zip).size / 1024 / 1024).toFixed(1)} MB`);
console.log('Next: in File Manager → sreevaaraahifarms.in, upload and extract it, then paste cpanel/htaccess-rules.txt at the top of .htaccess.');
