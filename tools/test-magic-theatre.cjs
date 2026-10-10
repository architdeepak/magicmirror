const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
let id = 0, draws = 0, oscillators = 0, resume;
const frames = new Map(), timers = [];
const canvas = { getContext: () => ({ createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)}},putImageData(){},drawImage(){draws++},clearRect() {}, beginPath() {}, arc() { draws++; }, fill() {}, fillRect() {}, moveTo() {}, bezierCurveTo() {}, stroke() {}, createLinearGradient() { return { addColorStop() {} }; } }) };
const shell = { dataset: {}, append() {}, getBoundingClientRect: () => ({ width: 1080, height: 1920 }) };
const scope = vm.createContext({ performance: { now: () => 0 }, document: { hidden: false, createElement: () => canvas }, localStorage: { getItem: () => null }, matchMedia: () => ({ matches: false }), requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id), setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, AudioContext: class { constructor() { this.state = 'suspended'; } resume() { return new Promise(resolve => resume = resolve); } createOscillator() { oscillators++; } } });
vm.runInContext(fs.readFileSync('src/displayQuality.js','utf8').replace(/export /g,'')+'\n'+fs.readFileSync('src/mirrorFog.js','utf8').replace('export class','class')+'\n'+fs.readFileSync('src/magicTheatre.js','utf8').replace(/^import .*;$/mg,'').replace('export class','class') + ';globalThis.Theatre=MagicTheatre;globalThis.Fog=MirrorFog', scope);
(async () => {
  const theatre = new scope.Theatre(shell); theatre.play('wake', { muted: true });
  assert(canvas.width*canvas.height<=1_500_000);
  for (let now = 0; now < 3100; now += 1000 / 60) { const entry = frames.entries().next().value; if (entry) { frames.delete(entry[0]); entry[1](now); } }
  assert.equal(frames.size, 0); assert(canvas.hidden); assert(draws <= 92, 'Fog frame budget exceeded');assert.equal(theatre.fog.noise.length,16384);
  const fog=new scope.Fog(24,36);
  fog.render(1);const end=Array.from(fog.image.data);
  fog.render(0,true);assert.deepEqual(Array.from(fog.image.data),end,'Wake and arrival fields jumped at their shared boundary');
  fog.render(0);assert(fog.image.data.filter((_,i)=>i%4===3).every(a=>a===0),'Wake did not begin transparent');
  fog.render(1,true);assert(fog.image.data.filter((_,i)=>i%4===3).every(a=>a===0),'Arrival did not end transparent');
  theatre.play(); theatre.cancel(); assert.equal(frames.size, 0); assert.equal(shell.dataset.magicCue, undefined);
  theatre.reduced = true; theatre.play(); assert.equal(frames.size, 0); assert(canvas.hidden); timers.at(-1)();
  theatre.sound = true; theatre.reduced = false; theatre.play('wake'); theatre.cancel(); resume(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(oscillators, 0, 'Stopped chime started after AudioContext resumed');
  console.log('Magic theatre: bounded canvas/fog/frame rate/duration, immediate cancellation, reduced motion and late audio-resume cancellation passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
