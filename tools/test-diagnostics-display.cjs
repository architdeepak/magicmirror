const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8');let writes=0;
const elements={};for(const key of ['diagRender','diagTracking','diagRig','diagBlendshapes','diagGaze']){let value='';elements[key]={get textContent(){return value},set textContent(next){writes++;value=next}}}
const tracking={faceDetected:false,cameraActive:false},gaze={confidence:0},blends={},video={active:false};
const scope=vm.createContext({elements,getTrackingStatus:()=>tracking,getFaceBlendshapes:()=>blends,getEyeGaze:()=>gaze,renderQuality:{fps:30,pixelRatio:1},avatar:{persona:'velora',faceHost:{},getAvatarVideoStatus:()=>video}});
const start=source.indexOf('function updateDiagnostics()');vm.runInContext(source.slice(start,source.indexOf("window.addEventListener('resize'",start)),scope);
scope.updateDiagnostics();assert.equal(writes,5);
for(let i=0;i<10000;i++)scope.updateDiagnostics();assert.equal(writes,5,'Unchanged diagnostics wrote DOM');
tracking.faceDetected=true;scope.updateDiagnostics();assert.equal(writes,6);assert.equal(elements.diagTracking.textContent,'Face lock');
video.active=true;video.state='playing';video.width=1080;video.height=1920;scope.updateDiagnostics();assert.equal(writes,7);assert(elements.diagRig.textContent.includes('1080'));
gaze.confidence=.75;blends.jawOpen=.5;scope.renderQuality.fps=24;scope.updateDiagnostics();assert.equal(writes,10);assert.equal(elements.diagGaze.textContent,'75% confidence');
elements.diagRig.textContent='';const before=writes;scope.updateDiagnostics();assert.equal(writes,before+1,'Externally cleared label was not repaired');
console.log('Diagnostics budget: 10,000 unchanged samples avoid DOM writes; tracking/video/gaze/channel/FPS updates and external repair passed.');
