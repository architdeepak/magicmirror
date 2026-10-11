const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8');
(async()=>{
 const resumes=[],oscillators=[],gains=[];let created=0,suspends=0;
 class AudioContext{
  constructor(){created++;this.state='suspended';this.currentTime=10;this.destination={}}
  resume(){return new Promise((resolve,reject)=>resumes.push({resolve:()=>{this.state='running';resolve()},reject}))}
  async suspend(){suspends++;this.state='suspended'}
  createOscillator(){const node={frequency:{},start(){this.started=true},stop(){this.stopped=true},connect(){return this},disconnect(){this.disconnected=true}};oscillators.push(node);return node}
  createGain(){const node={gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this},disconnect(){this.disconnected=true}};gains.push(node);return node}
 }
 const scope=vm.createContext({hardMuted:true,AudioContext});
 vm.runInContext(source.slice(source.indexOf('let bellContext ='),source.indexOf('const mirrorTimers =')),scope);
 await scope.ringBell();assert.equal(created,0);
 scope.hardMuted=false;const pending=scope.ringBell();scope.stopBell();resumes[0].resolve();await pending;assert.equal(oscillators.length,0,'Retired resume must not create notes');
 vm.runInContext('if(bellContext.state!=="suspended")throw Error("Stopped resume left context running")',scope);
 const old=scope.ringBell(),fresh=scope.ringBell();resumes[2].resolve();await fresh;assert.equal(oscillators.length,3);resumes[1].reject(Error('Stale resume'));await old;assert(oscillators.every(node=>!node.disconnected),'Stale error stopped current notes');
 for(const node of oscillators)node.onended();assert(oscillators.every(node=>node.disconnected));assert(gains.every(node=>node.disconnected));assert(suspends>=1);
 const playing=scope.ringBell();resumes[3].resolve();await playing;scope.hardMuted=true;scope.stopBell();assert(oscillators.every(node=>node.disconnected));assert(gains.every(node=>node.disconnected));
 scope.hardMuted=false;const failed=scope.ringBell();resumes[4].reject(Error('Resume blocked'));await failed;vm.runInContext('if(bellNodes.size)throw Error("Retained bell nodes")',scope);
 console.log('Timer bell: muted creation guard, Stop during resume, stale failure isolation, ended-node disconnect, playing mute and rejected resume passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
