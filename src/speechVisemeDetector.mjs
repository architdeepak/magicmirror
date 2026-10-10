import { Training } from './vendor/headaudio/training.mjs';
import { RECORD_OFFSET, RECORD_LEN } from './vendor/headaudio/parameters.mjs';
const registrations=new WeakMap();let modelPromise;
const shapes=['AA','EE','EE','O','OU','MBP','EE','EE','EE','FV','AA','EE','OU','EE','rest'];
export function speechShape(id){return Number.isInteger(id)&&id>=0&&id<shapes.length?shapes[id]:null;}
async function loadModel(){
 if(!modelPromise)modelPromise=(async()=>{const response=await fetch(new URL('./vendor/headaudio/model-en-mixed.bin',import.meta.url));if(!response.ok)throw new Error('Local speech model unavailable');const buffer=await response.arrayBuffer();if(!buffer.byteLength||buffer.byteLength%RECORD_OFFSET)throw new Error('Invalid local speech model');const training=new Training(),model=[];for(let offset=0;offset<buffer.byteLength;offset+=RECORD_OFFSET)model.push(training.decodeBinaryRecord(new Float32Array(buffer,offset,RECORD_LEN)));return model;})().catch(error=>{modelPromise=null;throw error;});
 return modelPromise;
}
export async function createOutputVisemeDetector(source,{current=()=>true,onResult=()=>{},onError=()=>{},register,model,makeNode}={}){
 const context=source.context;
 if(!registrations.has(context))registrations.set(context,(register?register():context.audioWorklet.addModule(new URL('./speechVisemeWorklet.mjs',import.meta.url))).catch(error=>{registrations.delete(context);throw error;}));
 const [,prototypes]=await Promise.all([registrations.get(context),model?model():loadModel()]);
 if(!current())return null;
 const node=makeNode?makeNode():new AudioWorkletNode(context,'mirror-speech-visemes',{numberOfInputs:1,numberOfOutputs:0,channelCount:1,channelCountMode:'explicit',channelInterpretation:'speakers',outputChannelCount:[],parameterData:{silMode:0}});
 let retired=false;
 const retire=()=>{if(retired)return;retired=true;node.port.onmessage=null;node.onprocessorerror=null;try{source.disconnect(node);}catch{}try{node.port.postMessage({event:'retire'});}catch{}node.disconnect();node.port.close();};
 node.port.onmessage=event=>{if(retired||!current())return;try{const data=event.data;if(data?.event==='viseme'){const shape=speechShape(data.viseme);if(shape&&(!Number.isFinite(data.audioTime)||context.currentTime-data.audioTime<.15))onResult({shape,id:data.viseme});}else if(data?.event==='ended'||data?.event==='end')onResult(null);}finally{if(!retired)node.port.postMessage({event:'ack'});}};
 node.onprocessorerror=error=>{retire();if(current())onError(error);};
 try{node.port.postMessage({event:'model',model:prototypes});source.connect(node);if(!current()){retire();return null;}}
 catch(error){retire();throw error;}
 if(retired)return null;
 return {retire};
}
