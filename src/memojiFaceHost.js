const PERSONAS = Object.freeze({
  velora: { skin: '#f1c0aa', skinShade: '#d98d76', hair: '#1e1420', eye: '#bd7a22', lip: '#761a38', accent: '#d6a746', crown: true, brow: 'arched' },
  solenne: { skin: '#f6cbb6', skinShade: '#e9a48f', hair: '#292128', eye: '#68442f', lip: '#cf6570', accent: '#3979dc', bow: true, brow: 'soft' },
  rowan: { skin: '#ae7358', skinShade: '#8a513f', hair: '#161418', eye: '#513020', lip: '#875147', accent: '#b76b37', brow: 'soft', shortHair: true }
});

// Original face-only SVG puppet: unlike the retired primitive scene, all of
// its features are intentional graphic forms and every expressive part is a
// separate animated layer. There is never a neck, shoulder, or body.
export class MemojiFaceHost {
  constructor(host) {
    this.host = host; this.persona = 'velora'; this.expression = {}; this.gaze = {}; this.speech = 0; this.viewer = {};
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('memoji-face-host'); this.svg.setAttribute('viewBox', '0 0 240 240'); this.svg.setAttribute('aria-hidden', 'true');
    host.appendChild(this.svg); this.setPersona(this.persona);
  }

  setPersona(persona) { this.persona = PERSONAS[persona] ? persona : 'velora'; this.render(); }
  setFace(blendshapes, gaze, speech, viewer) { this.expression = blendshapes || {}; this.gaze = gaze || {}; this.speech = speech || 0; this.viewer = viewer || {}; }

  render() {
    const p = PERSONAS[this.persona];
    const uid = `host-${this.persona}`;
    const hair = p.shortHair ? shortHair(p.hair, uid) : longHair(p.hair, uid);
    const accessory = p.crown ? crown(p.accent) : p.bow ? bow(p.accent) : '';
    this.svg.innerHTML = `
      <defs>
        <radialGradient id="skin-${uid}" cx="34%" cy="24%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset=".42" stop-color="${p.skin}"/><stop offset="1" stop-color="${p.skinShade}"/></radialGradient>
        <linearGradient id="hair-${uid}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".18"/><stop offset=".35" stop-color="${p.hair}"/><stop offset="1" stop-color="#09070a"/></linearGradient>
        <linearGradient id="lip-${uid}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f59aa1"/><stop offset="1" stop-color="${p.lip}"/></linearGradient>
        <filter id="shadow-${uid}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#000" flood-opacity=".3"/></filter>
      </defs>
      <g id="head" filter="url(#shadow-${uid})">
        <ellipse cx="120" cy="124" rx="76" ry="88" fill="url(#skin-${uid})"/>
        <ellipse cx="43" cy="126" rx="12" ry="19" fill="${p.skinShade}" opacity=".72"/><ellipse cx="197" cy="126" rx="12" ry="19" fill="${p.skinShade}" opacity=".72"/>
        <g id="hair">${hair}</g>${accessory}
        <path id="brow-left" d="M73 102 Q89 94 103 100" fill="none" stroke="${p.hair}" stroke-width="6" stroke-linecap="round"/>
        <path id="brow-right" d="M137 100 Q151 94 167 102" fill="none" stroke="${p.hair}" stroke-width="6" stroke-linecap="round"/>
        ${eye('left', 89, 124, p.skin, p.eye)}${eye('right', 151, 124, p.skin, p.eye)}
        <ellipse cx="76" cy="151" rx="17" ry="8" fill="#ee8690" opacity=".22"/><ellipse cx="164" cy="151" rx="17" ry="8" fill="#ee8690" opacity=".22"/>
        <path d="M116 132 Q112 146 120 148 Q128 146 124 132" fill="none" stroke="${p.skinShade}" stroke-width="3" stroke-linecap="round" opacity=".65"/>
        <g id="mouth-group"><path d="M99 169 Q120 160 141 169 Q120 189 99 169Z" fill="url(#lip-${uid})"/><ellipse id="mouth" cx="120" cy="171" rx="15" ry="2.8" fill="#32101b"/><path d="M101 170 Q120 174 139 170" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.4"/></g>
      </g>`;
    this.parts = {
      head: this.svg.querySelector('#head'), mouth: this.svg.querySelector('#mouth'), mouthGroup: this.svg.querySelector('#mouth-group'),
      pupils: [...this.svg.querySelectorAll('.pupil')], lids: [...this.svg.querySelectorAll('.lid')], brows: [this.svg.querySelector('#brow-left'), this.svg.querySelector('#brow-right')]
    };
  }

  update(elapsed) {
    if (!this.parts) return;
    const gazeX = clamp((this.gaze.x || 0) * (this.gaze.confidence || 0), -.8, .8);
    const gazeY = clamp((this.gaze.y || 0) * (this.gaze.confidence || 0), -.7, .7);
    const yaw = (this.viewer.x || 0) * -1.8; const pitch = (this.viewer.y || 0) * .8; const bob = Math.sin(elapsed * 1.1) * .8;
    this.parts.head.setAttribute('transform', `translate(${yaw} ${pitch + bob})`);
    this.parts.pupils.forEach((pupil, index) => pupil.setAttribute('transform', `translate(${gazeX * 3.4} ${-gazeY * 2.4})`));
    const automaticBlink = Math.pow(Math.max(0, Math.sin(elapsed * .64 + 1.4)), 48);
    const leftBlink = Math.max(this.expression.eyeBlinkLeft || 0, automaticBlink);
    const rightBlink = Math.max(this.expression.eyeBlinkRight || 0, automaticBlink);
    this.parts.lids[0]?.setAttribute('height', String(34 * leftBlink)); this.parts.lids[1]?.setAttribute('height', String(34 * rightBlink));
    const brow = Math.max(this.expression.browInnerUp || 0, this.expression.browOuterUpLeft || 0, this.expression.browOuterUpRight || 0);
    this.parts.brows.forEach((node) => node?.setAttribute('transform', `translate(0 ${-brow * 9})`));
    const jaw = clamp(Math.max(this.speech, this.expression.jawOpen || 0), 0, 1);
    const round = Math.max(this.expression.mouthFunnel || 0, this.expression.mouthPucker || 0);
    this.parts.mouth.setAttribute('rx', String(round > .25 ? 7.5 : 15.5 + jaw * 1.5));
    this.parts.mouth.setAttribute('ry', String(2.5 + jaw * 8));
    this.parts.mouthGroup.setAttribute('transform', `translate(0 ${jaw * 2.5})`);
  }
}

function eye(side, x, y, skin, iris) { return `<g><ellipse cx="${x}" cy="${y}" rx="18" ry="15" fill="#fffdfc"/><ellipse class="pupil" cx="${x}" cy="${y + 1}" rx="8.7" ry="10" fill="${iris}"/><ellipse class="pupil" cx="${x}" cy="${y + 2}" rx="4.5" ry="5.5" fill="#171219"/><circle class="pupil" cx="${x + 3}" cy="${y - 3}" r="2.5" fill="#fff"/><rect class="lid" x="${x - 20}" y="${y - 16}" width="40" height="0" rx="10" fill="${skin}"/></g>`; }
function longHair(_color, uid) { return `<path d="M44 131 Q30 57 74 39 Q116 16 161 45 Q205 66 195 136 Q185 109 171 90 Q151 76 128 77 Q95 80 69 93 Q55 111 44 131Z" fill="url(#hair-${uid})"/><path d="M49 107 Q31 155 62 189 Q58 137 85 98" fill="url(#hair-${uid})"/><path d="M191 107 Q209 155 178 189 Q182 137 155 98" fill="url(#hair-${uid})"/>`; }
function shortHair(color, uid) { return `<path d="M44 122 Q37 55 78 39 Q121 18 165 47 Q200 68 194 120 Q175 91 152 82 Q121 74 91 84 Q65 94 44 122Z" fill="url(#hair-${uid})"/><path d="M61 84 Q91 55 110 71 Q127 44 151 71 Q169 55 184 94" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round"/>`; }
function crown(color) { return `<g><path d="M77 59 L90 29 L108 53 L120 21 L132 53 L150 29 L163 59Z" fill="${color}" stroke="#ffe7a0" stroke-width="2" stroke-linejoin="round"/><circle cx="120" cy="48" r="5" fill="#7e1531"/></g>`; }
function bow(color) { return `<g transform="translate(49 59)"><path d="M0 13 Q-19 -3 -21 13 Q-19 31 0 18 Q19 31 21 13 Q19 -3 0 13Z" fill="${color}"/><circle r="6" cy="15" fill="#fff" opacity=".35"/></g>`; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
