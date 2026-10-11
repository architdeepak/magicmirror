const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8');let writes=0,cameraActive=false;
function node(){let text='',level;const attributes={};const label={get textContent(){return text},set textContent(value){writes++;text=value}};return{dataset:{get level(){return level},set level(value){writes++;level=value}},querySelector:()=>label,setAttribute(key,value){writes++;attributes[key]=value},getAttribute:key=>attributes[key]}}
const mic=node(),cam=node();
const scope=vm.createContext({hardMuted:false,voiceStarting:false,browserRecognition:null,gemini:{listening:false},wake:{enabled:true,processor:null,stream:null,assistantActive:false},elements:{wakeToggle:{checked:true}},document:{querySelector:selector=>selector==='#privacy-mic'?mic:cam},getTrackingStatus:()=>({cameraActive})});
vm.runInContext(source.slice(source.indexOf('function updatePrivacyChip()'),source.indexOf('async function restoreCameraAfterIdle()')),scope);
scope.updatePrivacyChip();assert.equal(mic.dataset.level,'off','Failed wake startup must not advertise a live microphone');const initial=writes;
for(let update=0;update<10000;update++)scope.updatePrivacyChip();assert.equal(writes,initial);
scope.wake.processor={};scope.wake.stream={active:true};scope.updatePrivacyChip();assert.equal(mic.dataset.level,'device');
scope.wake.stream.active=false;scope.voiceStarting=true;scope.updatePrivacyChip();assert.equal(mic.dataset.level,'pending');
scope.voiceStarting=false;scope.browserRecognition={};scope.updatePrivacyChip();assert.match(mic.querySelector().textContent,/browser/);assert(!mic.querySelector().textContent.includes('Gemini'));
scope.browserRecognition=null;scope.gemini.listening=true;scope.updatePrivacyChip();assert.match(mic.querySelector().textContent,/Gemini/);
scope.hardMuted=true;cameraActive=true;scope.updatePrivacyChip();assert.equal(mic.dataset.level,'off');assert.equal(cam.dataset.level,'on');
assert.match(cam.getAttribute('aria-label'),/stays on device/);assert.equal(cam.querySelector().textContent,'Camera on');
console.log('Privacy display: failed/inactive wake, active local stream, startup, browser/Gemini, hard mute and 10,000 unchanged updates passed.');
