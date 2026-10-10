const REACTIONS = Object.freeze({
  ponder:   { duration: 1.8, face: { browOuterUpLeft: .75, browInnerUp: .2, eyeSquintRight: .3, mouthPressLeft: .3, mouthLeft: .3 }, gaze: { x: -.25, y: -.3 }, pose: { turn: .08, nod: -.04 } },
  delight:  { duration: 1.6, face: { mouthSmileLeft: .75, mouthSmileRight: .7, cheekSquintLeft: .45, cheekSquintRight: .4, browInnerUp: .25, browOuterUpLeft: .3, browOuterUpRight: .3 }, pose: { nod: .1, lean: .06 } },
  smug:     { duration: 1.9, face: { mouthSmileLeft: .85, mouthSmileRight: .1, browOuterUpLeft: .6, eyeSquintLeft: .35, eyeSquintRight: .45, noseSneerLeft: .2 }, gaze: { x: .12, y: .05 }, pose: { nod: -.1, turn: -.06 } },
  startle:  { duration: 1.1, face: { eyeWideLeft: .85, eyeWideRight: .85, browInnerUp: .8, browOuterUpLeft: .5, browOuterUpRight: .5, jawOpen: .2 }, pose: { lean: -.12 } },
  dismiss:  { duration: 1.4, face: { eyeBlinkLeft: .4, eyeBlinkRight: .4, mouthPressLeft: .4, mouthPressRight: .4, browDownLeft: .2, mouthFrownLeft: .2, mouthFrownRight: .2 }, gaze: { x: .3, y: -.2 }, pose: { turn: .15, nod: -.06 } },
  scheming: { duration: 2.2, face: { browDownLeft: .5, browDownRight: .5, eyeSquintLeft: .5, eyeSquintRight: .5, mouthSmileLeft: .45, mouthSmileRight: .45, noseSneerLeft: .15, noseSneerRight: .15 }, pose: { lean: .08, nod: .05 } }
});

// Low duty-cycle acting: one blink, a small glance, then a settled pose. No
// separate interval/RAF; the existing visible-performer clock owns all work.
export class AvatarPresence {
  constructor() { this.nextBlink = 4.2; this.blinkAt = -100; this.nextGlance = 7.5; this.glanceAt = -100; this.direction = 1; this.activity = 'ready'; this.lastTime = null; }
  setActivity(activity) { this.activity = activity; }
  // One-shot emotional beats layered on top of the activity pose. The beat is
  // stamped with the clock on the next update so callers need no timebase.
  react(kind) { if (REACTIONS[kind]) this.pendingReaction = kind; }
  update(elapsed, { reduced = false, trackedEyes = false, energy = 0 } = {}) {
    if (this.pendingReaction) { this.reaction = { kind: this.pendingReaction, at: elapsed }; this.pendingReaction = null; }
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
    // Real voice energy drives the beats when available; the slow wave only
    // keeps the face alive between syllables.
    const emphasis=!reduced&&speaking?Math.min(1,beat*(energy>0?.35:1)+energy*1.1):0;
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
    const beatState = this.reaction && elapsed - this.reaction.at < REACTIONS[this.reaction.kind].duration ? this.reaction : null;
    if (beatState) {
      const spec = REACTIONS[beatState.kind], age = (elapsed - beatState.at) / spec.duration;
      // Quick rise, held peak, gentle release.
      const envelope = Math.sin(Math.PI * Math.min(1, age)) ** .7 * (reduced ? .5 : 1);
      for (const [name, value] of Object.entries(spec.face)) expression[name] = Math.min(1, Math.max(expression[name] || 0, value * envelope));
      gaze.x += (spec.gaze?.x || 0) * envelope; gaze.y += (spec.gaze?.y || 0) * envelope;
      performance.turn += (spec.pose?.turn || 0) * envelope; performance.nod += (spec.pose?.nod || 0) * envelope; performance.lean += (spec.pose?.lean || 0) * envelope;
    } else if (this.reaction) this.reaction = null;
    return { expression, gaze, performance };
  }
}
