const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const scope=vm.createContext({});vm.runInContext(fs.readFileSync('src/popupPanels.js','utf8').replace('export class','class')+';this.PopupPanels=PopupPanels;',scope);
const document={activeElement:null};
const entries=['settings','persona','launcher'].map(id=>{
 const classes=new Set(),attributes={};
 const button={attributes:{},setAttribute(key,value){this.attributes[key]=value},focus(){document.activeElement=this}};
 const input={blur(){document.activeElement=null},focus(){document.activeElement=this}};
 const panel={id,attributes,inert:false,classList:{contains:key=>classes.has(key),add:key=>classes.add(key),remove:key=>classes.delete(key)},contains:node=>node===input,setAttribute(key,value){attributes[key]=value},querySelector:()=>input};
 return{button,panel,input};
});
const popups=new scope.PopupPanels(entries,document);
for(const {panel,button}of entries){assert(panel.inert);assert.equal(panel.attributes['aria-hidden'],'true');assert.equal(button.attributes['aria-expanded'],'false');assert.equal(button.attributes['aria-controls'],panel.id)}
assert(popups.toggle(entries[0].panel));assert.equal(document.activeElement,entries[0].input);assert(!entries[0].panel.inert);
popups.toggle(entries[1].panel);assert(entries[0].panel.inert);assert.equal(document.activeElement,entries[1].input);
assert(popups.closeAll());assert.equal(document.activeElement,entries[1].button);assert.equal(popups.closeAll(),false);
popups.toggle(entries[0].panel);const outside={};document.activeElement=outside;popups.closeAll();assert.equal(document.activeElement,outside,'Outside click must preserve its focus');
popups.toggle(entries[2].panel);popups.closeAll({restoreFocus:false});assert.equal(document.activeElement,null,'Desktop handoff must retire hidden focus without refocusing dock');
for(const entry of entries){popups.toggle(entry.panel);assert(popups.closePanel(entry.panel));assert(entry.panel.inert);assert.equal(entry.panel.attributes['aria-hidden'],'true');assert.equal(entry.button.attributes['aria-expanded'],'false');assert.equal(document.activeElement,entry.button)}
assert.equal(popups.closePanel({}),false);
const renderer=fs.readFileSync('src/renderer.js','utf8');
let submit;
const fixture=vm.createContext({popupPanels:popups,elements:{personaPanel:entries[1].panel,launcherPanel:entries[2].panel,personaToggleImage:{},personaList:{querySelectorAll:()=>[]},voiceSelect:{},assistantTaskForm:{addEventListener:(event,fn)=>submit=fn},assistantTaskInput:{value:'A task'}},localStorage:{setItem(){}},avatar:{setPersona(){}},speech:{setPersona(){}},gemini:{setPersona(){}},showOracle(){},hardMuted:false,agentRunId:null,askMirror(){}});
vm.runInContext(renderer.slice(renderer.indexOf('function setPersona('),renderer.indexOf('function updateRenderQuality(')),fixture);
popups.toggle(entries[1].panel);fixture.setPersona('solenne',false);assert(entries[1].panel.inert);assert.equal(document.activeElement,entries[1].button);
vm.runInContext(renderer.slice(renderer.indexOf("elements.assistantTaskForm.addEventListener('submit'"),renderer.indexOf('elements.quickNoteInput.value',renderer.indexOf("elements.assistantTaskForm.addEventListener('submit'"))),fixture);
popups.toggle(entries[2].panel);submit({preventDefault(){}});assert(entries[2].panel.inert);assert.equal(document.activeElement,entries[2].button);
console.log('Popup focus: inert/ARIA, exclusive opening, focus return, desktop handoff, host selection and assistant submission passed.');
