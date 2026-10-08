// Low duty-cycle acting: one blink, a small glance, then a settled pose. No
// separate interval/RAF; the existing visible-performer clock owns all work.
export class AvatarPresence {
  constructor() { this.nextBlink = 4.2; this.blinkAt = -100; this.nextGlance = 7.5; this.glanceAt = -100; this.direction = 1; this.activity = 'ready'; this.lastTime = null; }
  setActivity(activity) { this.activity = activity; }
  update(elapsed, { reduced = false, trackedEyes = false } = {}) {
    if(this.lastTime!==null&&elapsed-this.lastTime>1){this.nextBlink=elapsed+2.5;this.nextGlance=elapsed+5;this.blinkAt=-100;this.glanceAt=-100;}
    this.lastTime=elapsed;
    if(elapsed>=this.nextBlink){this.blinkAt=elapsed;this.nextBlink=elapsed+4.1+(Math.sin(elapsed*1.73)+1)*1.5;}
    if(elapsed>=this.nextGlance){this.glanceAt=elapsed;this.nextGlance=elapsed+7.8;this.direction*=-1;}
    const age=elapsed-this.blinkAt;
    const blink=!trackedEyes&&age>=0&&age<.22?(age<.07?Math.sin(Math.PI*.5*age/.07)**2:age<.11?1:Math.cos(Math.PI*.5*(age-.11)/.11)**2):0;
    const glanceAge=elapsed-this.glanceAt;
    const glance=!reduced&&glanceAge>=0&&glanceAge<1.4?this.direction*Math.sin(Math.PI*glanceAge/1.4)**2*.42:0;
    const thinking=this.activity==='thinking',listening=this.activity==='listening';
    return { expression:{...(blink?{eyeBlinkLeft:blink,eyeBlinkRight:blink}:{}),...(thinking?{browOuterUpLeft:.32,browInnerUp:.08}:listening?{browInnerUp:.12}:{} )},gaze:{x:glance,y:thinking?-.16:0,confidence:1},performance:{turn:glance*.22,nod:listening?.08:0,lean:thinking?-.06:0} };
  }
}
