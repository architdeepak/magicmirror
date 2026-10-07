// Shared controls for voice and gestures. Source state comes from the actual
// HTML media element or YouTube's player events, never from command intent.
export class WatchPlaybackController {
  constructor({video,frame,youtube,openWatch}) { Object.assign(this,{video,frame,youtube,openWatch}); }
  snapshot() {
    if(this.youtube.active) return this.youtube.snapshot();
    if(this.video.classList.contains('loaded')) return {
      source:'media',ready:this.video.readyState>=1,playing:!this.video.paused&&!this.video.ended,
      paused:this.video.paused,position:Number.isFinite(this.video.currentTime)?this.video.currentTime:0,
      duration:Number.isFinite(this.video.duration)?this.video.duration:null,error:this.video.error?'The media could not play.':''
    };
    return {source:this.frame.classList.contains('loaded')?'embedded-page':'none',ready:false,playing:false};
  }
  async command(action,seconds=15) {
    if(action==='status')return this.snapshot();
    if(!['play','pause','seek'].includes(action))throw new Error('Watch controls support play, pause, seek, and status.');
    if(action==='seek'&&(!Number.isFinite(seconds)||Math.abs(seconds)>60))throw new Error('Seek by a number of seconds between -60 and 60.');
    if(action==='play')this.openWatch();
    if(this.youtube.active)return this.youtube.command(action,seconds);
    const video=this.video;
    if(!video.classList.contains('loaded'))throw new Error(this.frame.classList.contains('loaded')?'Use this embedded player’s own controls.':'Load a video in Watch first.');
    if(action==='play')await video.play();
    else if(action==='pause')video.pause();
    else {
      if(!video.readyState||!video.seekable.length)throw new Error('Wait for this video to be ready to seek.');
      const start=video.seekable.start(0),end=video.seekable.end(video.seekable.length-1);
      video.currentTime=Math.max(start,Math.min(end,video.currentTime+seconds));
    }
    return {result:action==='seek'?'Seek requested':'Playback control applied',...this.snapshot()};
  }
}
