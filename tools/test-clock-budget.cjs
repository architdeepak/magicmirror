const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('src/magicMirrorView.js','utf8');let now=new Date(2026,0,1,11,59,0).getTime(),writes=0,formatters=0;const intervals=[],nodes=new Map();
class ClockDate extends Date{constructor(){super(now)}static now(){return now}}
const scope=vm.createContext({Date:ClockDate,document:{hidden:false},Intl:{DateTimeFormat:class{constructor(...args){formatters++;this.format=new Intl.DateTimeFormat(...args)}formatToParts(date){return this.format.formatToParts(date)}}},setInterval:fn=>{intervals.push(fn);return intervals.length}});
vm.runInContext('this.start=function '+source.slice(source.indexOf('_startClock() {'),source.indexOf('  async setCity(')),scope);
const host={quotes:['First','Second'],container:{querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,{_text:'',get textContent(){return this._text},set textContent(value){writes++;this._text=value},setAttribute(){writes++}});return nodes.get(selector)}}};
scope.start.call(host);assert.equal(formatters,1);assert.equal(writes,5);
for(let second=1;second<60;second++){now+=1000;intervals[0]()}
assert.equal(writes,5,'Same-minute clock rewrote the DOM');
assert.equal(formatters,1,'Same-minute clock rebuilt formatting');
now+=1000;intervals[0]();assert.equal(writes,10);assert.equal(nodes.get('#mirror-greeting').textContent,'Good afternoon');
scope.document.hidden=true;now+=3600000;intervals[0]();intervals[1]();assert.equal(writes,10);
assert.equal(formatters,2,'Hidden clock rebuilt formatting');
scope.document.hidden=false;host.refreshClock();host.refreshQuote();assert.equal(writes,16);assert.equal(formatters,3);
now-=7200000;host.refreshClock();assert.equal(nodes.get('#mirror-greeting').textContent,'Good morning','Clock rollback did not refresh');
console.log('Clock budget: no same-minute formatting/writes, minute/noon transitions, hidden clock/quotes, foreground refresh and time rollback passed.');
vm.runInContext('this.age=function '+source.slice(source.indexOf('updateWeatherAge() {'),source.indexOf('  fetchWeather() {')),scope);
host.city='Tokyo';host.weatherFor='Tokyo';host.weatherAt=now;host.weatherFailed=false;
scope.age.call(host);const ageWrites=writes;for(let i=0;i<10000;i++)scope.age.call(host);assert.equal(writes,ageWrites);
scope.document.hidden=true;now+=31*60000;scope.age.call(host);assert.equal(writes,ageWrites,'Hidden weather age wrote DOM');
scope.document.hidden=false;scope.age.call(host);assert.match(nodes.get('#weather-age').textContent,/stale/);assert.match(nodes.get('#weather-age').textContent,/31 min/);
host.weatherFor='London';scope.age.call(host);assert.equal(nodes.get('#weather-age').textContent,'Forecast unavailable');
console.log('Weather age: unchanged/hidden writes suppressed, foreground stale age and city mismatch passed.');
