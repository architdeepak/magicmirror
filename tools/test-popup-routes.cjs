// The glanceable pop-up phrases must be recognised, and look-alikes must not be.
const assert = require('assert/strict');
const fs = require('fs');
const source = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'renderer.js'), 'utf8');
const grab = needle => { const line = source.split('\n').find(l => l.includes(needle)); assert(line, 'missing route: ' + needle); const m = line.match(/if \((\/.*\/)\.test\(spoken\)\)/); assert(m, 'regex not found for ' + needle); return eval(m[1]); };
const weather = grab('(?:weather|forecast|temperature)');
const news = grab('(?:news|headlines|top stories|latest news)');
const calendar = grab('(?:calendar|schedule|agenda|plans)');
for (const yes of ['whats the weather', 'what is the weather like today', 'forecast', 'do i need an umbrella', 'is it cold outside', 'show me the weather']) assert(weather.test(yes), 'weather should match: ' + yes);
for (const no of ['weather the storm of criticism', 'what is the capital of france', 'set a timer']) assert(!weather.test(no), 'weather must not match: ' + no);
for (const yes of ['whats the news', 'headlines', 'read me the latest news', 'whats happening in the world']) assert(news.test(yes), 'news should match: ' + yes);
for (const no of ['news about my sister', 'open youtube']) assert(!news.test(no), 'news must not match: ' + no);
for (const yes of ['whats on my calendar', 'my schedule', 'what do i have today', 'open the calendar']) assert(calendar.test(yes), 'calendar should match: ' + yes);
for (const no of ['calendar of events for mars', 'schedule a meeting with bob']) assert(!calendar.test(no), 'calendar must not match: ' + no);
console.log('Pop-up routes: weather, news and calendar phrases recognised; look-alikes ignored.');
