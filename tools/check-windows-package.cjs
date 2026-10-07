// Static Windows distribution audit. This does not execute a Windows binary.
const assert = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { listPackage, extractFile } = require('@electron/asar');
const root = path.resolve(__dirname, '..');
(async () => {
  const directory = path.join(root, 'dist/win-unpacked');
  const executable = await fs.readFile(path.join(directory, 'Reflect Mirror.exe'));
  assert.equal(executable.toString('ascii', 0, 2), 'MZ');
  const pe = executable.readUInt32LE(0x3c);
  assert.equal(executable.readUInt32LE(pe), 0x00004550);
  assert.equal(executable.readUInt16LE(pe + 4), 0x8664, 'Package is not Windows x64');
  const archive = path.join(directory, 'resources/app.asar');
  const files = listPackage(archive);
  for (const required of ['src/main.js', 'src/preload.js', 'src/nativeDesktop.ps1', 'src/windowsSpotify.cjs', 'src/windowsSpotify.ps1', 'src/wakeModelServer.cjs', 'src/assets/models/vosk-small-en-us-0.15.tar.gz', 'src/assets/models/VOSK-APACHE-2.0.txt', 'src/assistantVision.js', 'src/spotifyDevices.js', 'src/vendor/decart-sdk.js', 'src/vendor/frame-metadata-worker.js', 'src/assets/avatar.glb', 'node_modules/vosk-browser/dist/vosk.js', 'node_modules/three/examples/jsm/loaders/GLTFLoader.js']) assert(files.includes('/' + required), 'Missing ' + required);
  const modelMetadata=JSON.parse(extractFile(archive,'src/assets/models/vosk-model.json'));
  const wakeModel=extractFile(archive,'src/assets/models/vosk-small-en-us-0.15.tar.gz');
  assert.equal(wakeModel.readUInt16BE(0),0x1f8b,'Wake model is not a gzip archive');
  assert.equal(crypto.createHash('sha256').update(wakeModel).digest('hex'),modelMetadata.archiveSha256,'Bundled wake model differs from its manifest');
  const trackingMetadata=JSON.parse(extractFile(archive,'src/assets/models/mediapipe-models.json'));
  for(const model of trackingMetadata.models) {
    const bytes=extractFile(archive,'src/assets/models/'+model.file);
    assert.equal(bytes.length,model.bytes,'Tracking model size differs: '+model.file);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),model.sha256,'Tracking model hash differs: '+model.file);
  }
  assert(!files.some(file => /^\/(?:\.env(?:\.|$)|data\/|\.tools\/|tools\/|artifacts\/)/.test(file)), 'Development data or credentials entered the archive');
  assert(extractFile(archive, 'src/main.js').toString().includes('requestSingleInstanceLock'), 'Repeat-launch guard missing');
  assert.equal(extractFile(archive, 'src/assets/avatar.glb').toString('ascii', 0, 4), 'glTF', 'Avatar is a pointer or invalid GLB');
  for (const name of ['Start Mirror.cmd', 'Open Settings Window.cmd', 'README.txt']) await fs.access(path.join(directory, name));
  const filename = path.join(root, 'dist/Reflect Mirror-1.0.0-win.zip');
  const zipAudit = spawnSync('python3', ['-c', `
import zipfile, hashlib, json, sys
from pathlib import Path
archive=Path(sys.argv[1]); unpacked=Path(sys.argv[2])
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None, 'ZIP CRC validation failed'
    for name in ['Reflect Mirror.exe','resources/app.asar','Start Mirror.cmd','Open Settings Window.cmd','README.txt']:
        with z.open(name) as entry:
            digest=hashlib.file_digest(entry,'sha256').hexdigest()
        with (unpacked/name).open('rb') as source:
            assert digest==hashlib.file_digest(source,'sha256').hexdigest(), name+' differs from audited output'
with archive.open('rb') as stream: digest=hashlib.file_digest(stream,'sha256').hexdigest()
print(json.dumps({'zipSha256':digest,'zipBytes':archive.stat().st_size,'zipIntegrity':'passed'}))
`, filename, directory], { encoding: 'utf8', maxBuffer: 100000 });
  assert.equal(zipAudit.status, 0, zipAudit.stderr || 'ZIP audit failed');
  const result = { ...JSON.parse(zipAudit.stdout), executableArchitecture: 'Windows x64', requiredAssets: 'passed', sourceDataExclusion: 'passed', kioskLauncher: 'included', windowsRuntimeVerified: false };
  await fs.mkdir(path.join(root, 'artifacts/windows-package'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/windows-package/result.json'), JSON.stringify(result, null, 2) + '\n');
  await fs.writeFile(filename + '.sha256', `${result.zipSha256}  ${path.basename(filename)}\n`);
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
