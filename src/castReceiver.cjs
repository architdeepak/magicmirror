const http = require('http');
const dgram = require('dgram');
const crypto = require('crypto');

const TYPES = Object.freeze({ AVTransport: 'urn:schemas-upnp-org:service:AVTransport:1', RenderingControl: 'urn:schemas-upnp-org:service:RenderingControl:1', ConnectionManager: 'urn:schemas-upnp-org:service:ConnectionManager:1' });
const DEVICE = 'urn:schemas-upnp-org:device:MediaRenderer:1';
const PROTOCOLS = ['video/mp4', 'video/webm', 'video/ogg', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'].map((mime) => `http-get:*:${mime}:*`).join(',');
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const time = (seconds) => { const n = Math.max(0, Math.floor(Number(seconds) || 0)); return `${String(Math.floor(n / 3600)).padStart(2, '0')}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };

// [argument name, direction, state variable]. Descriptions are generated from
// the same tables used to validate action inputs so controller discovery and
// actual SOAP behavior agree.
const SERVICES = {
  AVTransport: {
    vars: { A_ARG_TYPE_InstanceID: 'ui4', A_ARG_TYPE_SeekMode: 'string', A_ARG_TYPE_SeekTarget: 'string', AVTransportURI: 'string', AVTransportURIMetaData: 'string', TransportState: 'string', TransportStatus: 'string', TransportPlaySpeed: 'string', CurrentTrackDuration: 'string', CurrentMediaDuration: 'string', CurrentTrack: 'ui4', NumberOfTracks: 'ui4', CurrentTrackURI: 'string', CurrentTrackMetaData: 'string', RelativeTimePosition: 'string', AbsoluteTimePosition: 'string', RelativeCounterPosition: 'i4', AbsoluteCounterPosition: 'i4', NextAVTransportURI: 'string', NextAVTransportURIMetaData: 'string', PlaybackStorageMedium: 'string', RecordStorageMedium: 'string', PossiblePlaybackStorageMedia: 'string', PossibleRecordStorageMedia: 'string', PossibleRecordQualityModes: 'string', CurrentPlayMode: 'string', CurrentRecordQualityMode: 'string', CurrentTransportActions: 'string', LastChange: 'string' },
    actions: {
      SetAVTransportURI: ['CurrentURI:in:AVTransportURI', 'CurrentURIMetaData:in:AVTransportURIMetaData'],
      Play: ['Speed:in:TransportPlaySpeed'], Pause: [], Stop: [], Next: [], Previous: [],
      Seek: ['Unit:in:A_ARG_TYPE_SeekMode', 'Target:in:A_ARG_TYPE_SeekTarget'],
      SetPlayMode: ['NewPlayMode:in:CurrentPlayMode'],
      GetTransportInfo: ['CurrentTransportState:out:TransportState', 'CurrentTransportStatus:out:TransportStatus', 'CurrentSpeed:out:TransportPlaySpeed'],
      GetPositionInfo: ['Track:out:CurrentTrack', 'TrackDuration:out:CurrentTrackDuration', 'TrackMetaData:out:CurrentTrackMetaData', 'TrackURI:out:CurrentTrackURI', 'RelTime:out:RelativeTimePosition', 'AbsTime:out:AbsoluteTimePosition', 'RelCount:out:RelativeCounterPosition', 'AbsCount:out:AbsoluteCounterPosition'],
      GetMediaInfo: ['NrTracks:out:NumberOfTracks', 'MediaDuration:out:CurrentMediaDuration', 'CurrentURI:out:AVTransportURI', 'CurrentURIMetaData:out:AVTransportURIMetaData', 'NextURI:out:NextAVTransportURI', 'NextURIMetaData:out:NextAVTransportURIMetaData', 'PlayMedium:out:PlaybackStorageMedium', 'RecordMedium:out:RecordStorageMedium', 'WriteStatus:out:TransportStatus'],
      GetDeviceCapabilities: ['PlayMedia:out:PossiblePlaybackStorageMedia', 'RecMedia:out:PossibleRecordStorageMedia', 'RecQualityModes:out:PossibleRecordQualityModes'],
      GetTransportSettings: ['PlayMode:out:CurrentPlayMode', 'RecQualityMode:out:CurrentRecordQualityMode'],
      GetCurrentTransportActions: ['Actions:out:CurrentTransportActions']
    }
  },
  RenderingControl: {
    vars: { A_ARG_TYPE_InstanceID: 'ui4', A_ARG_TYPE_Channel: 'string', A_ARG_TYPE_PresetName: 'string', PresetNameList: 'string', Volume: 'ui2', Mute: 'boolean', LastChange: 'string' },
    actions: { ListPresets: ['CurrentPresetNameList:out:PresetNameList'], SelectPreset: ['PresetName:in:A_ARG_TYPE_PresetName'], GetVolume: ['Channel:in:A_ARG_TYPE_Channel', 'CurrentVolume:out:Volume'], SetVolume: ['Channel:in:A_ARG_TYPE_Channel', 'DesiredVolume:in:Volume'], GetMute: ['Channel:in:A_ARG_TYPE_Channel', 'CurrentMute:out:Mute'], SetMute: ['Channel:in:A_ARG_TYPE_Channel', 'DesiredMute:in:Mute'] }
  },
  ConnectionManager: {
    vars: { SourceProtocolInfo: 'string', SinkProtocolInfo: 'string', CurrentConnectionIDs: 'string', A_ARG_TYPE_ConnectionID: 'i4', A_ARG_TYPE_RcsID: 'i4', A_ARG_TYPE_AVTransportID: 'i4', A_ARG_TYPE_ProtocolInfo: 'string', A_ARG_TYPE_ConnectionManager: 'string', A_ARG_TYPE_Direction: 'string', A_ARG_TYPE_ConnectionStatus: 'string' },
    actions: { GetProtocolInfo: ['Source:out:SourceProtocolInfo', 'Sink:out:SinkProtocolInfo'], GetCurrentConnectionIDs: ['ConnectionIDs:out:CurrentConnectionIDs'], GetCurrentConnectionInfo: ['ConnectionID:in:A_ARG_TYPE_ConnectionID', 'RcsID:out:A_ARG_TYPE_RcsID', 'AVTransportID:out:A_ARG_TYPE_AVTransportID', 'ProtocolInfo:out:A_ARG_TYPE_ProtocolInfo', 'PeerConnectionManager:out:A_ARG_TYPE_ConnectionManager', 'PeerConnectionID:out:A_ARG_TYPE_ConnectionID', 'Direction:out:A_ARG_TYPE_Direction', 'Status:out:A_ARG_TYPE_ConnectionStatus'] }
  }
};
function argsFor(service, action) { return [...(service === 'ConnectionManager' ? [] : ['InstanceID:in:A_ARG_TYPE_InstanceID']), ...SERVICES[service].actions[action]].map((arg) => arg.split(':')); }
function allowedValues(name) {
  if (name === 'Volume') return '<allowedValueRange><minimum>0</minimum><maximum>100</maximum><step>1</step></allowedValueRange>';
  const values = { A_ARG_TYPE_Channel: ['Master'], A_ARG_TYPE_PresetName: ['FactoryDefaults'], A_ARG_TYPE_SeekMode: ['REL_TIME'], TransportState: ['STOPPED', 'PLAYING', 'PAUSED_PLAYBACK', 'TRANSITIONING', 'NO_MEDIA_PRESENT'], TransportStatus: ['OK', 'ERROR_OCCURRED'], TransportPlaySpeed: ['1'], CurrentPlayMode: ['NORMAL'], A_ARG_TYPE_Direction: ['Input'], A_ARG_TYPE_ConnectionStatus: ['OK'] }[name];
  return values ? `<allowedValueList>${values.map((value) => `<allowedValue>${value}</allowedValue>`).join('')}</allowedValueList>` : '';
}
function description(service) {
  const definition = SERVICES[service];
  return `<?xml version="1.0"?><scpd xmlns="urn:schemas-upnp-org:service-1-0"><specVersion><major>1</major><minor>0</minor></specVersion><actionList>${Object.keys(definition.actions).map((action) => `<action><name>${action}</name><argumentList>${argsFor(service, action).map(([name, direction, variable]) => `<argument><name>${name}</name><direction>${direction}</direction><relatedStateVariable>${variable}</relatedStateVariable></argument>`).join('')}</argumentList></action>`).join('')}</actionList><serviceStateTable>${Object.entries(definition.vars).map(([name, type]) => `<stateVariable sendEvents="${['LastChange', 'SourceProtocolInfo', 'SinkProtocolInfo', 'CurrentConnectionIDs'].includes(name) ? 'yes' : 'no'}"><name>${name}</name><dataType>${type}</dataType>${allowedValues(name)}</stateVariable>`).join('')}</serviceStateTable></scpd>`;
}
class Fault extends Error { constructor(code, message) { super(message); this.code = code; } }
function parameter(body, name) {
  const match = body.match(new RegExp(`<(?:(?:[\\w.-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${name}\\s*>`));
  if (!match) { if (new RegExp(`<(?:(?:[\\w.-]+):)?${name}\\s*\\/>`).test(body)) return ''; throw new Fault(402, `Missing ${name}`); }
  const text = match[1];
  if (text.startsWith('<![CDATA[') && text.endsWith(']]>')) return text.slice(9, -3);
  return text.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (entity) => {
    const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }[entity];
    if (named !== undefined) return named;
    const code = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
    if (!code || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new Fault(402, 'Invalid XML character');
    return String.fromCodePoint(code);
  });
}
function envelope(content) { return `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>${content}</s:Body></s:Envelope>`; }
function validMedia(value) {
  let url; try { url = new URL(value); } catch { throw new Fault(714, 'Invalid media URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Fault(714, 'Use an HTTP(S) media URL without credentials');
  return url.href;
}

function createCastReceiver({ host, name = 'Reflect Mirror', id = crypto.randomUUID(), onCommand = async () => {}, discoveryPort = 1900, multicast = true }) {
  const uuid = `uuid:${id}`;
  const state = { uri: '', metadata: '', transport: 'NO_MEDIA_PRESENT', position: 0, duration: 0, volume: 100, muted: false, error: false };
  const subscriptions = new Map();
  const targets = ['upnp:rootdevice', uuid, DEVICE, ...Object.values(TYPES)];
  let server, socket, base, announceTimer, stopping = false;
  const details = () => ({ name, url: `${base}/device.xml`, discoveryPort: socket?.address().port });
  const lastChange = (service) => {
    const variables = service === 'AVTransport' ? { TransportState: state.transport, TransportStatus: state.error ? 'ERROR_OCCURRED' : 'OK', AVTransportURI: state.uri, CurrentTrackURI: state.uri, CurrentTrackDuration: time(state.duration), RelativeTimePosition: time(state.position), CurrentTransportActions: state.uri ? 'Play,Pause,Stop,Seek' : '' } : { Volume: state.volume, Mute: state.muted ? 1 : 0 };
    return `<Event xmlns="urn:schemas-upnp-org:metadata-1-0/${service === 'AVTransport' ? 'AVT' : 'RCS'}/"><InstanceID val="0">${Object.entries(variables).map(([key, value]) => `<${key} val="${escape(value)}"${service === 'RenderingControl' ? ' channel="Master"' : ''}/>`).join('')}</InstanceID></Event>`;
  };
  const notify = (subscription) => {
    if (stopping || subscription.expires < Date.now()) { subscriptions.delete(subscription.sid); return; }
    const properties = subscription.service === 'ConnectionManager' ? { SourceProtocolInfo: '', SinkProtocolInfo: PROTOCOLS, CurrentConnectionIDs: '0' } : { LastChange: lastChange(subscription.service) };
    const body = `<?xml version="1.0"?><e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0">${Object.entries(properties).map(([key, value]) => `<e:property><${key}>${escape(value)}</${key}></e:property>`).join('')}</e:propertyset>`;
    const request = http.request(subscription.callback, { method: 'NOTIFY', timeout: 3000, headers: { 'Content-Type': 'text/xml; charset="utf-8"', 'Content-Length': Buffer.byteLength(body), NT: 'upnp:event', NTS: 'upnp:propchange', SID: subscription.sid, SEQ: subscription.sequence++ } }, (response) => response.resume());
    request.on('error', () => {}); request.on('timeout', () => request.destroy()); request.end(body);
  };
  const update = (next) => {
    if (next.transport && ['NO_MEDIA_PRESENT', 'STOPPED', 'PLAYING', 'PAUSED_PLAYBACK', 'TRANSITIONING'].includes(next.transport)) state.transport = next.transport;
    if (next.transport === 'NO_MEDIA_PRESENT') { state.uri = ''; state.metadata = ''; state.position = 0; state.duration = 0; }
    for (const key of ['position', 'duration', 'volume']) if (Number.isFinite(next[key])) state[key] = Math.max(0, key === 'volume' ? Math.min(100, next[key]) : next[key]);
    if (typeof next.muted === 'boolean') state.muted = next.muted;
    if (typeof next.error === 'boolean') state.error = next.error;
    for (const subscription of subscriptions.values()) if (subscription.service !== 'ConnectionManager') notify(subscription);
  };
  const command = async (action) => { await onCommand(action); };
  const act = async (service, action, args) => {
    if (args.InstanceID !== undefined && args.InstanceID !== '0') throw new Fault(718, 'Invalid InstanceID');
    if (args.Channel !== undefined && args.Channel !== 'Master') throw new Fault(402, 'Only Master channel is supported');
    if (service === 'ConnectionManager') {
      if (action === 'GetProtocolInfo') return { Source: '', Sink: PROTOCOLS };
      if (action === 'GetCurrentConnectionIDs') return { ConnectionIDs: '0' };
      if (args.ConnectionID !== '0') throw new Fault(706, 'Invalid ConnectionID');
      return { RcsID: 0, AVTransportID: 0, ProtocolInfo: 'http-get:*:*:*', PeerConnectionManager: '', PeerConnectionID: -1, Direction: 'Input', Status: 'OK' };
    }
    if (service === 'RenderingControl') {
      if (action === 'ListPresets') return { CurrentPresetNameList: 'FactoryDefaults' };
      if (action === 'SelectPreset') { if (args.PresetName !== 'FactoryDefaults') throw new Fault(701, 'Invalid preset'); await command({ action: 'volume', volume: 100 }); await command({ action: 'mute', muted: false }); update({ volume: 100, muted: false }); return {}; }
      if (action === 'GetVolume') return { CurrentVolume: Math.round(state.volume) };
      if (action === 'GetMute') return { CurrentMute: state.muted ? 1 : 0 };
      if (action === 'SetVolume') { const volume = Number(args.DesiredVolume); if (!Number.isFinite(volume) || volume < 0 || volume > 100) throw new Fault(402, 'Invalid volume'); await command({ action: 'volume', volume }); update({ volume }); }
      if (action === 'SetMute') { if (!['0', '1', 'true', 'false'].includes(args.DesiredMute)) throw new Fault(402, 'Invalid mute'); const muted = ['1', 'true'].includes(args.DesiredMute); await command({ action: 'mute', muted }); update({ muted }); }
      return {};
    }
    if (action === 'SetAVTransportURI') { const uri = validMedia(args.CurrentURI); await command({ action: 'load', uri }); state.uri = uri; state.metadata = args.CurrentURIMetaData; update({ transport: 'STOPPED', position: 0, duration: 0, error: false }); return {}; }
    if (action === 'GetTransportInfo') return { CurrentTransportState: state.transport, CurrentTransportStatus: state.error ? 'ERROR_OCCURRED' : 'OK', CurrentSpeed: '1' };
    if (action === 'GetPositionInfo') return { Track: state.uri ? 1 : 0, TrackDuration: time(state.duration), TrackMetaData: state.metadata, TrackURI: state.uri, RelTime: time(state.position), AbsTime: time(state.position), RelCount: -1, AbsCount: -1 };
    if (action === 'GetMediaInfo') return { NrTracks: state.uri ? 1 : 0, MediaDuration: time(state.duration), CurrentURI: state.uri, CurrentURIMetaData: state.metadata, NextURI: '', NextURIMetaData: '', PlayMedium: 'NETWORK', RecordMedium: 'NOT_IMPLEMENTED', WriteStatus: 'NOT_IMPLEMENTED' };
    if (action === 'GetDeviceCapabilities') return { PlayMedia: 'NETWORK', RecMedia: 'NOT_IMPLEMENTED', RecQualityModes: 'NOT_IMPLEMENTED' };
    if (action === 'GetTransportSettings') return { PlayMode: 'NORMAL', RecQualityMode: 'NOT_IMPLEMENTED' };
    if (action === 'GetCurrentTransportActions') return { Actions: state.uri ? 'Play,Pause,Stop,Seek' : '' };
    if (action === 'SetPlayMode') { if (args.NewPlayMode !== 'NORMAL') throw new Fault(712, 'Only normal playback is supported'); return {}; }
    if (action === 'Next' || action === 'Previous') throw new Fault(711, 'No adjacent track');
    if (!state.uri) throw new Fault(701, 'Load media first');
    if (action === 'Play') { if (args.Speed !== '1') throw new Fault(717, 'Only normal speed is supported'); update({ transport: 'TRANSITIONING', error: false }); try { await command({ action: 'play' }); } catch (error) { update({ transport: 'STOPPED', error: true }); throw error; } }
    if (action === 'Pause') { await command({ action: 'pause' }); update({ transport: 'PAUSED_PLAYBACK' }); }
    if (action === 'Stop') { await command({ action: 'stop' }); update({ transport: 'STOPPED', position: 0 }); }
    if (action === 'Seek') {
      if (args.Unit !== 'REL_TIME') throw new Fault(710, 'Only REL_TIME seek is supported');
      const match = args.Target.match(/^(\d+):([0-5]\d):([0-5]\d)(?:\.\d+)?$/);
      if (!match) throw new Fault(711, 'Invalid seek target');
      const position = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      await command({ action: 'seek', position }); update({ position });
    }
    return {};
  };
  const handle = async (request, response) => {
    if (stopping) { response.writeHead(503); response.end(); return; }
    const pathname = new URL(request.url, base).pathname;
    const xml = (status, body, headers = {}) => { response.writeHead(status, { 'Content-Type': 'text/xml; charset="utf-8"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }); response.end(body); };
    if (request.headers.origin) { response.writeHead(403); response.end('Use a casting app on this Wi-Fi.'); return; }
    if (request.method === 'GET' && pathname === '/device.xml') {
      xml(200, `<?xml version="1.0"?><root xmlns="urn:schemas-upnp-org:device-1-0"><specVersion><major>1</major><minor>0</minor></specVersion><URLBase>${base}/</URLBase><device><deviceType>${DEVICE}</deviceType><friendlyName>${escape(name)}</friendlyName><manufacturer>Reflect</manufacturer><modelName>Magic Mirror</modelName><UDN>${uuid}</UDN><serviceList>${Object.entries(TYPES).map(([service, type]) => `<service><serviceType>${type}</serviceType><serviceId>urn:upnp-org:serviceId:${service}</serviceId><SCPDURL>/${service}/scpd.xml</SCPDURL><controlURL>/${service}/control</controlURL><eventSubURL>/${service}/event</eventSubURL></service>`).join('')}</serviceList></device></root>`); return;
    }
    const route = pathname.match(/^\/(AVTransport|RenderingControl|ConnectionManager)\/(scpd.xml|control|event)$/);
    if (!route) { response.writeHead(404); response.end(); return; }
    const [, service, endpoint] = route;
    if (request.method === 'GET' && endpoint === 'scpd.xml') { xml(200, description(service)); return; }
    if (endpoint === 'event' && ['SUBSCRIBE', 'UNSUBSCRIBE'].includes(request.method)) {
      for (const [id, subscription] of subscriptions) if (subscription.expires < Date.now()) subscriptions.delete(id);
      const sid = String(request.headers.sid || '');
      if (request.method === 'UNSUBSCRIBE') { if (!subscriptions.delete(sid)) { response.writeHead(412); response.end(); return; } response.writeHead(200); response.end(); return; }
      let subscription = subscriptions.get(sid);
      if (sid && (!subscription || subscription.service !== service)) { response.writeHead(412); response.end(); return; }
      if (!sid) {
        let callback; try { callback = new URL(String(request.headers.callback || '').replace(/^<|>$/g, '')); } catch { response.writeHead(412); response.end(); return; }
        const peer = request.socket.remoteAddress.replace(/^::ffff:/, '');
        if (request.headers.nt !== 'upnp:event' || callback.protocol !== 'http:' || callback.hostname !== peer || callback.username || callback.password || subscriptions.size >= 16) { response.writeHead(412); response.end(); return; }
        subscription = { sid: `uuid:${crypto.randomUUID()}`, callback, service, sequence: 0 };
      }
      subscription.expires = Date.now() + 300_000; subscriptions.set(subscription.sid, subscription);
      response.writeHead(200, { SID: subscription.sid, TIMEOUT: 'Second-300' }); response.end();
      setImmediate(() => notify(subscription)); return;
    }
    if (endpoint !== 'control' || request.method !== 'POST') { response.writeHead(405); response.end(); return; }
    try {
      const soapAction = String(request.headers.soapaction || '').replace(/^"|"$/g, '').split('#');
      const action = soapAction[1];
      if (soapAction[0] !== TYPES[service] || !Object.hasOwn(SERVICES[service].actions, action)) throw new Fault(401, 'Invalid action');
      const chunks = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 65536) throw new Fault(402, 'Request too large'); chunks.push(chunk); }
      const body = Buffer.concat(chunks).toString('utf8');
      if (/<!DOCTYPE|<!ENTITY/i.test(body)) throw new Fault(402, 'XML entities are not supported');
      const args = Object.fromEntries(argsFor(service, action).filter(([, direction]) => direction === 'in').map(([name]) => [name, parameter(body, name)]));
      const result = await act(service, action, args);
      xml(200, envelope(`<u:${action}Response xmlns:u="${TYPES[service]}">${Object.entries(result).map(([key, value]) => `<${key}>${escape(value)}</${key}>`).join('')}</u:${action}Response>`));
    } catch (error) { request.resume(); xml(500, envelope(`<s:Fault><faultcode>s:Client</faultcode><faultstring>UPnPError</faultstring><detail><UPnPError xmlns="urn:schemas-upnp-org:control-1-0"><errorCode>${Number.isInteger(error.code) ? error.code : 501}</errorCode><errorDescription>${escape(error.message)}</errorDescription></UPnPError></detail></s:Fault>`)); }
  };
  const advertise = (alive) => {
    if (!multicast || !socket) return;
    for (const target of targets) socket.send(Buffer.from(`NOTIFY * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nNT: ${target}\r\nNTS: ssdp:${alive ? 'alive' : 'byebye'}\r\nUSN: ${uuid}${target === uuid ? '' : `::${target}`}\r\nLOCATION: ${base}/device.xml\r\nCACHE-CONTROL: max-age=120\r\nSERVER: Reflect/1.0 UPnP/1.0\r\n\r\n`), 1900, '239.255.255.250', () => {});
  };
  const stop = async () => {
    stopping = true; clearInterval(announceTimer); advertise(false); subscriptions.clear();
    if (socket) { try { socket.close(); } catch {} socket = null; }
    if (server?.listening) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    server = null;
  };
  const start = async () => {
    if (server) return details();
    stopping = false; server = http.createServer((req, res) => { handle(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }); });
    server.requestTimeout = 10000; server.headersTimeout = 5000;
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, host, resolve); });
      base = `http://${host}:${server.address().port}`;
      socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      socket.on('message', (message, peer) => {
        if (!socket || stopping) return;
        if (message.length > 8192) return;
        const text = message.toString(); if (!/^M-SEARCH \* HTTP\/1\.1\r?\n/i.test(text) || !/MAN:\s*"ssdp:discover"/i.test(text)) return;
        const search = text.match(/(?:^|\r?\n)ST:\s*([^\r\n]+)/i)?.[1]?.trim();
        for (const target of search === 'ssdp:all' ? targets : targets.includes(search) ? [search] : []) socket.send(Buffer.from(`HTTP/1.1 200 OK\r\nCACHE-CONTROL: max-age=120\r\nEXT:\r\nLOCATION: ${base}/device.xml\r\nSERVER: Reflect/1.0 UPnP/1.0\r\nST: ${target}\r\nUSN: ${uuid}${target === uuid ? '' : `::${target}`}\r\n\r\n`), peer.port, peer.address, () => {});
      });
      await new Promise((resolve, reject) => { socket.once('error', reject); socket.bind(discoveryPort, multicast ? '0.0.0.0' : host, resolve); });
      socket.on('error', () => {});
      if (multicast) { socket.addMembership('239.255.255.250', host); socket.setMulticastInterface(host); socket.setMulticastTTL(2); }
      advertise(true); announceTimer = setInterval(() => advertise(true), 60_000); announceTimer.unref();
      return details();
    } catch (error) { await stop(); throw error; }
  };
  return { start, stop, update, details };
}
module.exports = { createCastReceiver, TYPES, DEVICE };
