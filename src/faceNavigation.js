export class FaceNavigation {
  constructor() { this.reset(); }
  reset() { this.center=null;this.pending=null;this.startedAt=0;this.armed=true;this.lastActionAt=-Infinity; }
  update({ viewer, pitch=null, faceDetected, active },now) {
    if(!active||!faceDetected){this.center=null;this.pending=null;return null;}
    if(!this.center){this.center={y:viewer.y,pitch};return null;}
    const shift=viewer.y-this.center.y;
    const tilt=pitch!=null&&this.center.pitch!=null?pitch-this.center.pitch:0;
    if(Math.abs(shift)<.10&&Math.abs(tilt)<.15){this.armed=true;this.pending=null;return null;}
    if(!this.armed||now-this.lastActionAt<1400)return null;
    const direction=shift>.24||tilt>.35?'next':shift<-.24||tilt<-.35?'previous':null;
    if(!direction){this.pending=null;return null;}
    if(this.pending!==direction){this.pending=direction;this.startedAt=now;return null;}
    if(now-this.startedAt<450)return null;
    this.armed=false;this.lastActionAt=now;this.pending=null;return direction;
  }
}
