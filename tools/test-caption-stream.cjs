const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/renderer.js','utf8');
const row=()=>{const node={textContent:'',scrollLeft:0,scrollWidth:10},visible=new Set();return{node,querySelector:()=>node,classList:{remove:n=>visible.delete(n),toggle(n,on){if(on)visible.add(n);else visible.delete(n)}},visible};};
const user=row(),assistant=row();let stops=0,card='';
const scope=vm.createContext({captionState:{user:'',assistant:''},captionUserTurnActive:false,captionAssistantTurnActive:false,
 elements:{captionUser:user,captionAssistant:assistant,captions:{classList:{toggle(){}}}},hardMuted:false,userCaptionFromLocal:false,localCaptionsAllowed:false,
 wake:{stopCaptionTurn(){}},assistantTranscript:'',stopAssistant:()=>stops++,showOracle:t=>card=t});
vm.runInContext(source.slice(source.indexOf('function appendCaption('),source.indexOf("window.addEventListener('resize'")),scope);
vm.runInContext(source.slice(source.indexOf('function handleTranscript('),source.indexOf('async function toggleVoice(')),scope);
const reset=()=>{scope.captionUserTurnActive=false;scope.captionAssistantTurnActive=false;scope.captionState.user='';scope.captionState.assistant='';scope.userCaptionFromLocal=false;};
for(const [chunks,expected]of [[['Hel','lo',',',' ','world','.'],'Hello, world.'],[['no',' no',' no','.'],'no no no.'],[['你','好','，','世界','。'],'你好，世界。']]){
 reset();for(const chunk of chunks)scope.handleTranscript('assistant',chunk,{delta:true});assert.equal(assistant.node.textContent,expected);assert.equal(card,expected);
}
reset();scope.handleTranscript('user','Show me ',{delta:true});scope.handleTranscript('assistant','Here is your outfit.',{delta:true});scope.handleTranscript('user','the blue shirt.',{delta:true});assert.equal(user.node.textContent,'Show me the blue shirt.');assert.equal(assistant.node.textContent,'Here is your outfit.');assert.equal(card,'Here is your outfit.');
reset();scope.appendCaption('user','tell me a tail',{replace:true});scope.userCaptionFromLocal=true;scope.handleTranscript('user','Tell ',{delta:true});scope.handleTranscript('user','me a tale.',{delta:true});assert.equal(user.node.textContent,'Tell me a tale.');
reset();scope.handleTranscript('user','mirror',{delta:true});assert.equal(stops,0);scope.handleTranscript('user',' stop',{delta:true});assert.equal(stops,1,'Split stop phrase did not cancel');
reset();scope.handleTranscript('assistant','Hello');scope.handleTranscript('assistant','Hello world.');assert.equal(assistant.node.textContent,'Hello world.');assert.equal(card,'Hello world.');
reset();for(let i=0;i<3000;i++)scope.handleTranscript('assistant','👑',{delta:true});assert.equal(Array.from(assistant.node.textContent).length,2000);assert.equal(Array.from(scope.assistantTranscript).length,2000);
console.log('Caption stream: split words/punctuation/whitespace, repetition, Chinese, interleaved roles, local correction, split Stop, cumulative compatibility and bounded Unicode passed.');
