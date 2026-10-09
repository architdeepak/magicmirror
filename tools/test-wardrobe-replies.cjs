const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('src/renderer.js', 'utf8');
(async () => {
  for (const action of ['stop', 'mute', 'mode', 'newer', 'none']) {
    for (const outcome of ['success', 'failure']) {
      const pending = [], output = [];
      const context = vm.createContext({
        hardMuted: false, voiceStartGeneration: 0, manualControlGeneration: 0,
        config: {hasGeminiKey: false},
        handleTryOnVoice: () => new Promise((resolve, reject) => pending.push({resolve, reject})),
        appendCaption: (...args) => output.push(['caption', ...args]),
        showOracle: (...args) => output.push(['oracle', ...args]),
        speech: {speak: text => output.push(['speech', text])},
      });
      vm.runInContext(source.slice(source.indexOf('let wardrobeReplyGeneration ='), source.indexOf('function handleGesture(')), context);
      const request = context.requestTryOnFromNavigation({}, 'old');
      if (action === 'stop') context.voiceStartGeneration++;
      if (action === 'mute') context.hardMuted = true;
      if (action === 'mode') context.manualControlGeneration++;
      let replacement;
      if (action === 'newer') replacement = context.requestTryOnFromNavigation({}, 'new');
      if (outcome === 'success') pending[0].resolve({result: 'Old reply'});
      else pending[0].reject(Error('Old error'));
      await request;
      if (action === 'none') assert.equal(output.length, outcome === 'success' ? 3 : 1);
      else assert.deepEqual(output, [], action + '/' + outcome + ' published an obsolete reply');
      if (replacement) {
        pending[1].resolve({result: 'New reply'});
        await replacement;
        assert.equal(output.at(-1)[1], 'New reply');
        assert.equal(output.length, 3);
      }
    }
  }
  console.log('Wardrobe delayed success/error ownership: Stop, mute, mode, newer request and current replies passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
