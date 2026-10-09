const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
let source=fs.readFileSync('src/avatarController.js','utf8').replace(/^import .*;$/gm,'').replace('export class AvatarController','class AvatarController');source+='\nglobalThis.AvatarController=AvatarController;';
class Rig{constructor(host,options){this.canvas={style:{}};this.options=options;this.ready=false;}setQuality(q){this.quality=q;}async setPersona(p){if(p==='rowan')throw new Error('No rig');this.persona=p;if(this.wait)await this.wait;this.ready=true;}}
const context={console,RigFaceHost:Rig,ExpressionMixer:class{setMood(){}},AvatarPresence:class{},};vm.createContext(context);vm.runInContext(source,context);
(async()=>{
 const a=new context.AvatarController({host:{dataset:{},style:{}}});a.faceHost={canvas:{style:{}},setPersona(){},setQuality(){}};a.rigHost=new Rig();let surface;a.onSurfaceChange=c=>surface=c;
 await a.setRenderStyle('rig');assert.equal(a.faceHost.canvas.style.display,'none');assert.equal(surface,a.rigHost.canvas);a.setDepthEnabled(true);assert.equal(a.rigHost.canvas.style.opacity,'.001');
 await a.setRenderStyle('portrait');assert.equal(a.rigHost.canvas.style.display,'none');assert.equal(surface,a.faceHost.canvas);
 a.rigHost.ready=false;let resolve;a.rigHost.wait=new Promise(r=>resolve=r);const pending=a.setRenderStyle('rig');await a.setRenderStyle('portrait');resolve();await pending;assert.equal(a.renderStyle,'portrait');assert.equal(a.rigHost.canvas.style.display,'none');
 a.rigHost.wait=null;await a.setRenderStyle('rig');a.videoHost={active:true};a._syncAvatarSourceVisibility();assert.equal(surface,null);assert.equal(a.rigHost.canvas.style.display,'none');a.videoHost.active=false;a._syncAvatarSourceVisibility();assert.equal(surface,a.rigHost.canvas);
 await a.setPersona('rowan');assert.equal(a.renderStyle,'portrait');assert.equal(a.rigHost.canvas.style.display,'none');assert.equal(surface,a.faceHost.canvas);
 const energy=[];for(const fps of[30,60]){const b=new context.AvatarController({host:{style:{},closest:()=>null}});b.presence.update=()=>({expression:{},gaze:{x:0,y:0,confidence:1},performance:{turn:0,nod:0,lean:0}});b.expressionMixer.update=()=>({});b.setSpeechLevel(.8);for(let frame=0;frame<fps;frame++)b.update(1/fps,frame/fps,{x:0,y:0,z:1});energy.push(b.speechLevel);}assert(Math.abs(energy[0]-energy[1])<1e-12,'Speech envelope changes with display cadence');
 console.log('Rig lifecycle: atomic surface ownership, depth source, late-load cancellation, video exclusivity and missing-persona fallback passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
