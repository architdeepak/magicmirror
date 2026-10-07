// Fast offline invariants for a mirror deployment: `npm run test:health`.
const fs = require('fs/promises');
const path = require('path');
const root = path.join(__dirname, '..');
const packageMetadata = require('../package.json');
if (packageMetadata.mirrorAppId !== packageMetadata.build.appId) throw new Error('Runtime mirrorAppId must match the packaged application ID');
const required = ['src/index.html', 'src/renderer.js', 'src/main.js', 'src/preload.js', 'src/liveFaceHost.js', 'src/closetStore.js', 'src/assets/avatar.glb'];

async function main() {
  const failures = [];
  await Promise.all(required.map(async (relative) => { try { await fs.access(path.join(root, relative)); } catch { failures.push(`Missing ${relative}`); } }));
  const closetFile = path.join(root, 'data', 'closet.json');
  try {
    const closet = JSON.parse(await fs.readFile(closetFile, 'utf8'));
    if (!Array.isArray(closet.garments)) failures.push('data/closet.json must contain a garments array');
    for (const garment of closet.garments || []) {
      if (!garment.id || !garment.name || !garment.assetPath) failures.push('Closet garment missing id, name, or assetPath');
      else { try { await fs.access(garment.assetPath); } catch { failures.push(`Missing garment image for ${garment.name}`); } }
    }
  } catch (error) { if (error.code !== 'ENOENT') failures.push(`Invalid closet.json: ${error.message}`); }
  if (failures.length) { console.error(`Mirror health check failed:\n- ${failures.join('\n- ')}`); process.exitCode = 1; return; }
  console.log('Mirror health check passed: core UI, live host, and local closet are ready.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
