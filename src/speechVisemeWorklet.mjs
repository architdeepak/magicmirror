import { HeadWorklet } from './vendor/headaudio/headworklet.mjs';
// Upstream stop pauses inference but keeps the processor alive. Retire the
// application-owned node completely when the utterance or playback bus ends.
class MirrorVisemeWorklet extends HeadWorklet {
 constructor(options){
  super(options);const receive=this.port.onmessage,send=this.port.postMessage.bind(this.port);
  this.flush=()=>{if(!this.retired&&!this.pending&&this.latest){this.pending=true;const value=this.latest;this.latest=null;send(value);}};
  // One in-flight result and one replaceable latest result. A stalled renderer
  // cannot accumulate an unbounded stream of predictions on its message port.
  this.processor.worklet={port:{postMessage:value=>{if(!['viseme','end','ended'].includes(value.event)||this.retired)return;this.latest={...value,audioTime:currentTime};this.flush();}}};
  this.port.onmessage=event=>{if(event.data?.event==='retire'){this.retired=true;this.latest=null;}else if(event.data?.event==='ack'){this.pending=false;this.flush();}else receive(event);};
 }
 process(...args){return !this.retired&&super.process(...args);}
}
registerProcessor('mirror-speech-visemes',MirrorVisemeWorklet);
