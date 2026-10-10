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
    const thinking=this.activity==='thinking',listening=this.activity==='listening',speaking=this.activity==='speaking';
    const k=reduced?.45:1,t=elapsed;
    // Two slow, unrelated waves read as intention rather than a loop.
    const beat=(Math.sin(t*2.1)+1)*.5,swell=(Math.sin(t*.7+1.3)+1)*.5,slow=Math.sin(t*.35);
    const emphasis=!reduced&&speaking?beat:0;
    // A regal, faintly amused resting face: heavy lids, one lifted brow, a
    // smirk that sits higher on one side.
    const rest={eyeSquintLeft:.1,eyeSquintRight:.1,browOuterUpRight:.1+swell*.06,mouthSmileLeft:.12,mouthSmileRight:.04,mouthPressLeft:.05};
    let act={};
    if(thinking) act={browOuterUpLeft:.5,browInnerUp:.1,browDownRight:.2,eyeSquintLeft:.22,eyeSquintRight:.3,mouthPressLeft:.2,mouthSmileRight:.1,mouthLeft:.2};
    else if(listening) act={browInnerUp:.2,browOuterUpLeft:.14,eyeWideLeft:.05,eyeWideRight:.05,eyeSquintLeft:.04,eyeSquintRight:.04,mouthSmileLeft:.2+swell*.06,mouthSmileRight:.08};
    else if(speaking) act={browOuterUpLeft:.16+emphasis*.3,browOuterUpRight:.06+(1-emphasis)*.12,browDownLeft:.04+emphasis*.06,cheekSquintLeft:.12+emphasis*.1,cheekSquintRight:.06,noseSneerLeft:.06+swell*.1,mouthSmileLeft:.16+emphasis*.12,mouthSmileRight:.05+emphasis*.04,eyeSquintLeft:.1,eyeSquintRight:.14};
    const expression={...(blink?{eyeBlinkLeft:blink,eyeBlinkRight:blink}:{})};
    for(const [name,value] of Object.entries({...rest,...act}))expression[name]=value*k;
    const gaze={x:glance,y:thinking?-.2:speaking?-.02+swell*.04:listening?.03:0,confidence:1};
    const performance={
      turn:glance*.22+((speaking||listening)&&!reduced?slow*.08:0)+(thinking?.05:0),
      nod:(listening?.11+Math.sin(t*.8)*.03:speaking?emphasis*.09-.02:thinking?-.04:0)*k,
      lean:(thinking?-.09:listening?.045:speaking?.02+swell*.03:0)+(reduced?0:Math.sin(t*.5)*.012)
    };
    return { expression, gaze, performance };
  }
}
