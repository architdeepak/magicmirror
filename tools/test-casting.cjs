const assert = require('assert/strict');
const http = require('http');
const dgram = require('dgram');
const { createCastReceiver, TYPES, DEVICE } = require('../src/castReceiver.cjs');

async function main() {
  const commands = [];
  let receiver;
  receiver = createCastReceiver({ host: '127.0.0.1', discoveryPort: 0, multicast: false, onCommand: async (command) => {
    commands.push(command);
    if (command.action === 'play') receiver.update({ transport: 'PLAYING', duration: 180, position: 1 });
  } });
  const peer = dgram.createSocket('udp4');
  const events = [];
  const callback = http.createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    events.push({ body, sequence: request.headers.seq }); response.writeHead(200); response.end();
  });
  try {
    const details = await receiver.start();
    const base = new URL(details.url).origin;
    await new Promise((resolve) => peer.bind(0, '127.0.0.1', resolve));
    const discovered = new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('SSDP discovery timed out')), 2000); peer.once('message', (message) => { clearTimeout(timeout); resolve(message.toString()); }); });
    peer.send(Buffer.from(`M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nST: ${DEVICE}\r\nMX: 1\r\n\r\n`), details.discoveryPort, '127.0.0.1');
    assert((await discovered).includes(`LOCATION: ${details.url}`));
    const device = await (await fetch(details.url)).text();
    assert(device.includes('Reflect Mirror') && device.includes(TYPES.AVTransport));
    const controls = await (await fetch(`${base}/RenderingControl/scpd.xml`)).text();
    assert(controls.includes('<maximum>100</maximum>'));
    const soap = async (service, action, args = {}, origin) => {
      const body = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:${action} xmlns:u="${TYPES[service]}">${Object.entries(args).map(([key, value]) => `<${key}>${value}</${key}>`).join('')}</u:${action}></s:Body></s:Envelope>`;
      const response = await fetch(`${base}/${service}/control`, { method: 'POST', headers: { 'Content-Type': 'text/xml', SOAPAction: `"${TYPES[service]}#${action}"`, ...(origin ? { Origin: origin } : {}) }, body });
      return { status: response.status, body: await response.text() };
    };
    assert((await soap('ConnectionManager', 'GetProtocolInfo')).body.includes('video/webm'));
    assert.equal((await soap('AVTransport', 'SetAVTransportURI', { InstanceID: 0, CurrentURI: 'https://media.example/video.mp4?a=1&amp;b=2', CurrentURIMetaData: '&lt;item&gt;Film&lt;/item&gt;' })).status, 200);
    assert.equal(commands[0].uri, 'https://media.example/video.mp4?a=1&b=2');
    assert.equal((await soap('AVTransport', 'Play', { InstanceID: 0, Speed: 1 })).status, 200);
    assert((await soap('AVTransport', 'GetTransportInfo', { InstanceID: 0 })).body.includes('<CurrentTransportState>PLAYING</CurrentTransportState>'), 'Player feedback was overwritten by optimistic buffering state');
    await soap('AVTransport', 'Seek', { InstanceID: 0, Unit: 'REL_TIME', Target: '00:01:12' });
    assert.equal(commands.at(-1).position, 72);
    await soap('AVTransport', 'Pause', { InstanceID: 0 });
    assert((await soap('AVTransport', 'GetTransportInfo', { InstanceID: 0 })).body.includes('PAUSED_PLAYBACK'));
    await soap('RenderingControl', 'SetVolume', { InstanceID: 0, Channel: 'Master', DesiredVolume: 37 });
    assert.equal(commands.at(-1).volume, 37);
    assert((await soap('RenderingControl', 'GetVolume', { InstanceID: 0, Channel: 'Master' })).body.includes('<CurrentVolume>37</CurrentVolume>'));
    await soap('RenderingControl', 'SelectPreset', { InstanceID: 0, PresetName: 'FactoryDefaults' });
    assert.equal(commands.at(-2).volume, 100); assert.equal(commands.at(-1).muted, false);
    assert.equal((await soap('AVTransport', 'SetAVTransportURI', { InstanceID: 0, CurrentURI: 'file:///private.mp4', CurrentURIMetaData: '' })).status, 500);
    assert.equal((await soap('AVTransport', 'Play', { InstanceID: 3, Speed: 1 })).status, 500);
    assert.equal((await soap('AVTransport', 'Play', { InstanceID: 0, Speed: 1 }, 'https://evil.example')).status, 403);

    await new Promise((resolve) => callback.listen(0, '127.0.0.1', resolve));
    const eventUrl = `${base}/AVTransport/event`;
    const subscribed = await fetch(eventUrl, { method: 'SUBSCRIBE', headers: { NT: 'upnp:event', CALLBACK: `<http://127.0.0.1:${callback.address().port}/event>`, TIMEOUT: 'Second-300' } });
    assert.equal(subscribed.status, 200);
    const sid = subscribed.headers.get('sid');
    const waitFor = async (count) => { const started = Date.now(); while (events.length < count) { if (Date.now() - started > 2000) throw new Error('Event notification timed out'); await new Promise((resolve) => setTimeout(resolve, 10)); } };
    await waitFor(1); assert.equal(events[0].sequence, '0');
    receiver.update({ transport: 'PLAYING', position: 80 }); await waitFor(2);
    assert(events[1].body.includes('PLAYING'));
    assert.equal((await fetch(eventUrl, { method: 'UNSUBSCRIBE', headers: { SID: sid } })).status, 200);
    assert.equal((await fetch(eventUrl, { method: 'SUBSCRIBE', headers: { NT: 'upnp:event', CALLBACK: '<http://192.0.2.1/private>' } })).status, 412);
    receiver.update({ transport: 'NO_MEDIA_PRESENT' });
    assert((await soap('AVTransport', 'GetMediaInfo', { InstanceID: 0 })).body.includes('<NrTracks>0</NrTracks>'));
    console.log('Casting protocol passed: real UDP discovery, SOAP media controls, player feedback, event subscriptions, and stop state.');
  } finally { await receiver.stop(); peer.close(); callback.closeAllConnections(); if (callback.listening) await new Promise((resolve) => callback.close(resolve)); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
