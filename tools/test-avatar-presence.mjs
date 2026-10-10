import assert from 'node:assert/strict';
import { AvatarPresence } from '../src/avatarPresence.js';
const presence = new AvatarPresence();let blinks=0,glances=0,maximum=0;
for(let i=0;i<900;i++){const value=presence.update(i/30);const blink=value.expression.eyeBlinkLeft||0;if(blink>0)blinks++;maximum=Math.max(maximum,blink);if(value.gaze.x!==0)glances++;assert(Math.abs(value.performance.turn)<.12)}
assert(blinks>10&&blinks<60,'Blink must be a brief, occasional event');assert(maximum>.95,'Lids never fully close');assert(glances>30&&glances<180,'Glances failed to settle');
presence.setActivity('thinking');assert(presence.update(30).expression.browOuterUpLeft>.2);
const resumed=presence.update(3600);assert.equal(resumed.expression.eyeBlinkLeft,undefined,'Resume left a frozen blink');assert.equal(resumed.gaze.x,0);
for(let i=0;i<300;i++){const value=presence.update(3600+i/30,{reduced:true,trackedEyes:true});assert.equal(value.expression.eyeBlinkLeft,undefined,'Autonomous blink replaced tracked eyes');assert.equal(value.gaze.x,0,'Reduced motion still glanced');}
console.log('Avatar presence: low duty-cycle full blinks/glances, thoughtful brows, tracked-eye ownership, reduced motion and resume reset passed.');

// Exercise production control ownership after several update frames, rather
// than asserting a setter value that the tracking loop can immediately erase.
const {readFileSync}=await import('node:fs'),{default:vm}=await import('node:vm');
const {ExpressionMixer}=await import('../src/expressionMixer.js');
const sandbox=vm.createContext({AvatarPresence,ExpressionMixer});
vm.runInContext(readFileSync('src/avatarController.js','utf8').replace(/^import .*;$/mg,'').replace('export class','class')+';globalThis.Controller=AvatarController',sandbox);
const host={style:{},closest:()=>({dataset:{reducedMotion:'false'}})},actor=new sandbox.Controller({host});let face;
actor.faceHost={setFace:(values,gaze)=>face={values,gaze},setViseme(){},setPerformance(){},update(){}};
actor.setFacePuppetEnabled(true);actor.setFaceBlendshapes({eyeBlinkLeft:.2,eyeBlinkRight:.85});actor.setExpression({eyeBlinkLeft:1});actor.setGazeOverride({x:1,y:0});
for(let i=0;i<18;i++){actor.setEyeGaze({x:-.5,y:0,confidence:1});actor.update(1/30,i/30,{x:0,y:0});}
assert.equal(face.gaze.x,1,'Tracking overwrote requested look');assert(face.values.eyeBlinkLeft>.9,'Explicit blink failed with camera');assert(face.values.eyeBlinkRight>.8,'Manual blink erased the other tracked eye');
actor.setGazeOverride(null);actor.setExpression({});actor.update(1/30,.7,{x:0,y:0});assert.equal(face.gaze.x,-.5,'Gaze never returned to tracking');
console.log('Avatar control ownership: requested gaze survives tracking frames, explicit closure preserves tracked eyes, clearing returns gaze to camera passed.');
