const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
let count = 0;
let failures = 0;
for (const directory of ['src', 'tools']) {
  for (const filename of fs.readdirSync(path.join(root, directory)).filter((name) => /\.(?:js|mjs|cjs)$/.test(name))) {
    const source = fs.readFileSync(path.join(root, directory, filename), 'utf8');
    // A stray control character (usually a backspace from a mangled \b regex
    // escape) silently changes behaviour; fail loudly instead.
    const control = source.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
    if (control) {
      failures += 1; count += 1;
      console.error(`${directory}/${filename}: contains control character U+${control[0].charCodeAt(0).toString(16).padStart(4, '0')} (mangled escape?).`);
      continue;
    }
    // Renderer .js files are ES modules despite package.json describing the
    // Electron main process as CommonJS. Check stdin with an explicit format:
    // Node's file-based auto detection can otherwise skip module syntax errors.
    const format = filename.endsWith('.mjs') || /^\s*(?:import\s|export\s)/m.test(source) ? 'module' : 'commonjs';
    const result = spawnSync(process.execPath, ['--check', `--input-type=${format}`], { input: source, encoding: 'utf8' });
    count += 1;
    if (result.status !== 0) {
      failures += 1;
      console.error(`${directory}/${filename}:\n${result.stderr || result.error?.message || 'Syntax checker failed.'}`);
    }
  }
}
console.log(`Syntax: ${count - failures}/${count} files passed.`);
process.exitCode = failures ? 1 : 0;
