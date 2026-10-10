// Local, quiet atmosphere. Its own graph ducks under speech/media and is
// retired immediately on mute, sleep, disabling, or renderer shutdown.
export class MirrorAmbience {
  constructor() { this.enabled=false;this.volume=.02;this.epoch=0;this.nodes=[];this.context={muted:false,duck:false}; }
  async setEnabled(enabled) {
    this.enabled=Boolean(enabled);
    if(!this.enabled){this.stop();return;}
    const epoch=++this.epoch;
    try {
      this.audio ||= new AudioContext();await this.audio.resume();
      if(epoch!==this.epoch||!this.enabled||this.context.muted)return;
      if(!this.master){
        this.master=this.audio.createGain();this.master.gain.value=0;this.master.connect(this.audio.destination);this.nodes.push(this.master);
        for(const frequency of [130.81,196,261.62]){
          const tone=this.audio.createOscillator(),level=this.audio.createGain();tone.type='sine';tone.frequency.value=frequency;level.gain.value=.13;
          tone.connect(level);level.connect(this.master);tone.start();this.nodes.push(tone,level);
        }
        const data=this.audio.createBuffer(1,this.audio.sampleRate*4,this.audio.sampleRate),samples=data.getChannelData(0);
        let smooth=0;for(let i=0;i<samples.length;i++){smooth=.97*smooth+.03*(Math.random()*2-1);samples[i]=smooth;}
        const wind=this.audio.createBufferSource(),filter=this.audio.createBiquadFilter();wind.buffer=data;wind.loop=true;filter.type='lowpass';filter.frequency.value=800;
        wind.connect(filter);filter.connect(this.master);wind.start();this.nodes.push(wind,filter);
      }
      this.sync();
    } catch { this.stop(); }
  }
  setContext(context) {
    const wasMuted=this.context.muted;Object.assign(this.context,context);
    if(this.context.muted){this.stop();return;}
    if(wasMuted&&this.enabled)void this.setEnabled(true);else this.sync();
  }
  sync() { if(this.master)this.master.gain.setTargetAtTime(this.enabled&&!this.context.duck?this.volume:0,this.audio.currentTime,.25); }
  stop() {
    this.epoch++;if(this.master)this.master.gain.value=0;
    for(const node of this.nodes){try{node.stop?.();node.disconnect();}catch{}}
    this.nodes=[];this.master=null;if(this.audio?.state==='running')void this.audio.suspend().catch(()=>{});
  }
  destroy(){this.enabled=false;this.stop();void this.audio?.close().catch(()=>{});}
}
