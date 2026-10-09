// Runs only inside the player frame, without Electron preload or Node access.
class YouTubeAudioDucking {
  constructor(getPlayer){this.getPlayer=getPlayer;this.requested=false;this.original=null;this.applied=null;this.pending=false;this.overridden=false;}
  setActive(active){
    const next=Boolean(active),p=this.getPlayer();
    if(next!==this.requested){
      if(!next&&p&&this.original!==null){const v=p.getVolume();if(v===this.applied||(this.pending&&v===this.original))p.setVolume(this.original);}
      this.original=null;this.applied=null;this.pending=false;this.overridden=false;this.requested=next;
    }
    this.sync();
  }
  sync(){
    const p=this.getPlayer();if(!p)return;const v=p.getVolume();if(!Number.isInteger(v)||v<0||v>100)return;
    if(this.original!==null){
      if(v===this.applied)this.pending=false;
      else if(!(this.pending&&v===this.original)){this.overridden=true;this.original=null;this.applied=null;this.pending=false;}
    }
    if(this.requested&&!this.overridden&&this.original===null){this.original=v;this.applied=Math.round(v*.25);this.pending=true;p.setVolume(this.applied);}
  }
  setUserVolume(value){
    if(!Number.isInteger(value)||value<0||value>100)throw new Error('Set video volume from 0 to 100.');
    const p=this.getPlayer();if(!p)throw new Error('Wait for YouTube to finish connecting.');
    if(this.requested)this.overridden=true;this.original=null;this.applied=null;this.pending=false;p.setVolume(value);
  }
  snapshot(){const p=this.getPlayer();return{supported:true,requested:this.requested,active:this.original!==null&&!this.pending,pending:this.pending,userOverride:this.overridden,volume:p?p.getVolume():null,muted:p?p.isMuted():false};}
}
const parameters = new URLSearchParams(location.search);
const token = parameters.get('token');
const videoId = parameters.get('video');
let player;
let ready = false;
let error = '';
const notice = document.querySelector('#notice');
const ducking = new YouTubeAudioDucking(()=>ready?player:null);
const send = (message) => parent.postMessage({ channel: 'mirror-youtube', token, ...message }, '*');
function snapshot() {
  return { ready, state: ready ? player.getPlayerState() : -1,
    position: ready ? player.getCurrentTime() : 0, duration: ready ? player.getDuration() : 0, error, audioDucking: ducking.snapshot() };
}
function report() { ducking.sync(); send({ type: 'state', state: snapshot() }); }
window.onYouTubeIframeAPIReady = () => {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '') || !token) { notice.textContent = 'Invalid YouTube link.'; return; }
  player = new YT.Player('player', {
    host: 'https://www.youtube-nocookie.com', videoId,
    playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
    events: {
      onReady: () => { ready = true; notice.textContent = ''; report(); },
      onStateChange: () => { if (player.getPlayerState() === 1) { error = ''; notice.textContent = ''; } report(); },
      onAutoplayBlocked: () => { error = 'Select Play in the YouTube player to start playback.'; report(); },
      onError: (event) => {
        error = ({ 2: 'Invalid YouTube link.', 5: 'YouTube could not play this video.', 100: 'This video is unavailable or private.',
          101: 'The owner disabled embedded playback. Open this video in the browser.', 150: 'The owner disabled embedded playback. Open this video in the browser.',
          153: 'YouTube could not identify this mirror app. Open the video in the browser.' })[event.data] || 'YouTube playback failed.';
        notice.textContent = error; report();
      }
    }
  });
};
window.addEventListener('message', (event) => {
  const input = event.data;
  if (event.source !== parent || input?.channel !== 'mirror-youtube' || input.token !== token) return;
  if(input.type==='duck'){if(typeof input.active==='boolean'){ducking.setActive(input.active);report();}return;}
  if(input.type!=='command')return;
  try {
    if (!ready) throw new Error('Wait for YouTube to finish connecting.');
    if (input.action === 'play') player.playVideo();
    else if (input.action === 'pause') player.pauseVideo();
    else if (input.action === 'seek') {
      if (!Number.isFinite(input.seconds) || Math.abs(input.seconds) > 60) throw new Error('Seek must be within 60 seconds.');
      const duration = player.getDuration();
      if (!(duration > 0)) throw new Error('This video is not ready to seek.');
      player.seekTo(Math.max(0, Math.min(duration, player.getCurrentTime() + input.seconds)), true);
    } else if(input.action==='volume')ducking.setUserVolume(input.volume);
    else throw new Error('Unsupported YouTube control.');
    error = '';
    send({ type: 'result', id: input.id, state: snapshot() });
  } catch (failure) { send({ type: 'result', id: input.id, error: failure.message }); }
});
setInterval(() => { if (ready) report(); }, 1000);
setTimeout(() => { if (!player) { error = 'Could not connect to YouTube. Check the network or open the video in the browser.'; notice.textContent = error; report(); } }, 15000);
