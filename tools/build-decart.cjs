const path = require('path');
const sdkEntry = require.resolve('@decartai/sdk');
Promise.all([
  require('esbuild').build({
    entryPoints: [sdkEntry],
    outfile: path.join(__dirname, '../src/vendor/decart-sdk.js'),
    bundle: true, platform: 'browser', format: 'esm', target: 'chrome126',
    minify: true, legalComments: 'linked'
  }),
  require('esbuild').build({
    entryPoints: [path.join(path.dirname(sdkEntry), 'realtime/browser/frame-metadata-worker.js')],
    outfile: path.join(__dirname, '../src/vendor/frame-metadata-worker.js'),
    bundle: true, platform: 'browser', format: 'iife', target: 'chrome126',
    minify: true, legalComments: 'linked'
  })
]).catch(error => { console.error(error.message); process.exitCode = 1; });
