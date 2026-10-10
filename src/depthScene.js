import { displayProfile } from './displayQuality.js';
import * as THREE from 'three';
import { createFirePlane } from './fireShader.js';

export function createDepthScene(scene) {
  let avatarSourceRevision = null;let textureSize=1536;
  const root = new THREE.Group();
  root.name = 'depth-room';
  scene.add(root);

  const fire = createFirePlane(7.2, 12.8);
  fire.position.set(0, -0.25, -5.8);
  root.add(fire);

  const corridor = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x8a5cc7,
    transparent: true,
    opacity: 0.19,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  for (let z = -5.4; z <= 0.2; z += 0.48) {
    const depthScale = 1 + Math.abs(z) * 0.08;
    corridor.add(rectangleLine(3.2 * depthScale, 5.6 * depthScale, z, lineMaterial));
  }

  const vanishing = [
    [-1.65, -2.9], [1.65, -2.9], [-1.65, 2.9], [1.65, 2.9],
    [0, -2.9], [0, 2.9], [-1.65, 0], [1.65, 0]
  ];
  for (const [x, y] of vanishing) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, y, 0.2),
      new THREE.Vector3(x * 1.42, y * 1.35, -5.4)
    ]);
    corridor.add(new THREE.Line(geometry, lineMaterial));
  }
  root.add(corridor);
  const chamber = createChamber(); root.add(chamber.group);

  // This is intentionally a real bounded volume, not an abstract tunnel: its
  // front, side and top planes make the virtual-window illusion legible before
  // head tracking even begins to move it.
  const cube = new THREE.Group();
  cube.name = 'depth-cube';
  const cubeGeometry = new THREE.BoxGeometry(2.9, 4.85, 2.45);
  const cubeMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x78ffd1, transparent: true, opacity: .11, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0x593eaf, transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xb6ffdc, transparent: true, opacity: .09, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0x26194e, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xb5ffd4, transparent: true, opacity: .075, side: THREE.DoubleSide, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0x101626, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false })
  ];
  const cubeFaces = new THREE.Mesh(cubeGeometry, cubeMaterials);
  cubeFaces.position.set(0, .1, -2.25);
  cubeFaces.visible = false;
  cube.add(cubeFaces);
  const cubeEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cubeGeometry),
    new THREE.LineBasicMaterial({ color: 0xb5ffd4, transparent: true, opacity: .24, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  cubeEdges.position.copy(cubeFaces.position);
  cubeEdges.visible = false;
  cube.add(cubeEdges);
  cube.visible = false;
  root.add(cube);
  const faceDecorations = [
    makeLattice(1.86, 3.7, new THREE.Vector3(-1.43, .1, -2.25), new THREE.Euler(0, Math.PI / 2, 0)),
    makeLattice(1.86, 3.7, new THREE.Vector3(1.43, .1, -2.25), new THREE.Euler(0, -Math.PI / 2, 0)),
    makeLattice(2.25, 2.05, new THREE.Vector3(0, 2.47, -2.25), new THREE.Euler(Math.PI / 2, 0, 0)),
    makeLattice(2.25, 2.05, new THREE.Vector3(0, -2.47, -2.25), new THREE.Euler(-Math.PI / 2, 0, 0))
  ];
  faceDecorations.forEach((wall) => { wall.visible = false; cube.add(wall); });
  const avatarPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide }));
  avatarPlane.name = 'cube-avatar';
  avatarPlane.position.set(0, -.05, -2.16); avatarPlane.visible = false; cube.add(avatarPlane);
  let avatarSource = null; let avatarStage = null; let avatarStageContext = null; let avatarTexture = null;

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.08, 1.115, 96),
    new THREE.MeshBasicMaterial({
      color: 0xe0bd70,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  halo.position.set(0, 0.45, -1.55);
  halo.visible = false;

  const innerHalo = new THREE.Mesh(
    new THREE.RingGeometry(1.27, 1.285, 96),
    new THREE.MeshBasicMaterial({
      color: 0x8056cb,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  innerHalo.position.copy(halo.position);
  innerHalo.visible = false;

  const particles = makeParticles(180);
  root.add(particles);

  let mode = 'portal';
  let depthEnabled = false;
  let avatarAnchor = { x: 0, y: -.05 };
  return {
    root,
    fire,
    setMode(nextMode) {
      mode = nextMode;
      avatarPlane.visible = Boolean(depthEnabled && avatarSource && nextMode === 'portal');
      root.visible = nextMode !== 'ar';
      lineMaterial.opacity = nextMode === 'mirror' ? 0.035 : 0.055;
    },
    setDepthEnabled(enabled) {
      depthEnabled = Boolean(enabled);
      avatarPlane.visible = Boolean(depthEnabled && avatarSource && mode === 'portal');
      cube.visible = depthEnabled;
      corridor.visible = false;
      chamber.group.visible = depthEnabled;
      halo.visible = false;
      innerHalo.visible = false;
    },
    setQuality(id) {
      const next=displayProfile(id).depthTexture;if(next===textureSize)return;textureSize=next;avatarSourceRevision=null;
      if(avatarStage){avatarStage.width=textureSize;avatarStage.height=textureSize;avatarTexture.needsUpdate=true;}
    },
    setCubeContent() {}, // Information lives in the plain HTML overlay, not a 3D panel.
    setAvatarPosition(position) {
      avatarAnchor = { center: { x: 0, y: -.05 }, left: { x: -.95, y: -.26 }, right: { x: .95, y: -.26 }, upper: { x: 0, y: .72 }, lower: { x: 0, y: -1.2 } }[position] || { x: 0, y: -.05 };
    },
    setAvatarCanvas(canvas) {
      avatarSourceRevision = null;
      avatarSource = canvas || null;
      if (!avatarSource) { avatarPlane.visible = false; return; }
      // Copy into a fixed-size staging surface. Uploading a resizing DOM canvas
      // directly caused Chromium texture-overflow errors in the remote build.
      // The portrait assets are ~1.2K square. A 1K staging surface retains
      // their detail on a 4K TV while avoiding a resizing texture each frame.
      avatarStage = document.createElement('canvas'); avatarStage.width = textureSize; avatarStage.height = textureSize;
      avatarStageContext = avatarStage.getContext('2d');
      avatarTexture?.dispose(); avatarTexture = new THREE.CanvasTexture(avatarStage); avatarTexture.colorSpace = THREE.SRGBColorSpace;
      avatarPlane.material.map = avatarTexture; avatarPlane.material.needsUpdate = true; avatarPlane.visible = depthEnabled && mode === 'portal';
    },
    update(dt, elapsed, head) {
      fire.material.uniforms.uTime.value += dt;
      corridor.rotation.z = depthEnabled ? 0 : Math.sin(elapsed * 0.09) * 0.008;
      chamber.update(elapsed);
      cube.rotation.y = head.x * -.045;
      cube.rotation.x = head.y * .025;

      avatarPlane.position.x = avatarAnchor.x + head.x * -.035;
      avatarPlane.position.y = avatarAnchor.y - head.y * .025;
      avatarPlane.rotation.y = head.x * .055;
      avatarPlane.rotation.x = -head.y * .025;
      if (depthEnabled && avatarPlane.visible && avatarSource?.width && avatarStageContext && avatarTexture
        && (avatarSource._mirrorRevision == null || avatarSource._mirrorRevision !== avatarSourceRevision)) {
        avatarStageContext.clearRect(0, 0, textureSize, textureSize);
        const scale=Math.min(textureSize/avatarSource.width,textureSize/avatarSource.height),w=avatarSource.width*scale,h=avatarSource.height*scale;
        avatarStageContext.drawImage(avatarSource,(textureSize-w)/2,(textureSize-h)/2,w,h);
        avatarTexture.needsUpdate = true;
        avatarSourceRevision = avatarSource._mirrorRevision;
      }
      halo.rotation.z = elapsed * 0.035;
      innerHalo.rotation.z = -elapsed * 0.025;
      halo.material.opacity = 0.28 + Math.sin(elapsed * 1.2) * 0.08;
      particles.rotation.y = elapsed * 0.018;
      particles.position.x = head.x * -0.06;
      particles.position.y = head.y * 0.04;
      if (mode === 'mirror') fire.material.uniforms.uIntensity.value = 0.16;
      else fire.material.uniforms.uIntensity.value = .28;
    }
  };
}

function makeLattice(width, height, position, rotation) {
  const points = []; const columns = 5; const rows = 9;
  for (let i = 0; i <= columns; i += 1) { const x = -width / 2 + (i / columns) * width; points.push(x, -height / 2, 0, x, height / 2, 0); }
  for (let i = 0; i <= rows; i += 1) { const y = -height / 2 + (i / rows) * height; points.push(-width / 2, y, 0, width / 2, y, 0); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x9b7bff, transparent: true, opacity: .46, blending: THREE.AdditiveBlending, depthWrite: false }));
  mesh.position.copy(position); mesh.rotation.copy(rotation); return mesh;
}

function drawWrapped(ctx, text, x, y, width, lineHeight, maxLines) {
  const words = text.split(/\s+/); let line = ''; let lines = 0;
  for (const word of words) { const next = `${line} ${word}`.trim(); if (ctx.measureText(next).width > width && line) { ctx.fillText(line, x, y); y += lineHeight; lines += 1; if (lines >= maxLines) return; line = word; } else line = next; }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
}

function rectangleLine(width, height, z, material) {
  const hw = width / 2;
  const hh = height / 2;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-hw, -hh, z), new THREE.Vector3(hw, -hh, z),
    new THREE.Vector3(hw, hh, z), new THREE.Vector3(-hw, hh, z),
    new THREE.Vector3(-hw, -hh, z)
  ]);
  return new THREE.Line(geometry, material);
}

function makeParticles(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const ember = new THREE.Color(0xe35b38);
  const violet = new THREE.Color(0x8b64ce);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 4.6;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 7.2;
    positions[i * 3 + 2] = -Math.random() * 5.2;
    const color = Math.random() > 0.42 ? ember : violet;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.025,
    transparent: true,
    opacity: 0.72,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
}

// Sculpted architecture and distant lights create depth without a bright wall
// behind the mirror. No extra render loop, textures, or postprocessing passes.
function createChamber() {
  const group = new THREE.Group(); group.name = 'enchanted-chamber';
  const stone = new THREE.MeshStandardMaterial({ color: 0x171424, roughness: .84, metalness: .2 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x514336, roughness: .5, metalness: .65, emissive: 0x140b20, emissiveIntensity: .25 });
  for (const depth of [-4.8,-3.4]) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.46,.065,8,64,Math.PI), trim);
    arch.scale.y=1.55; arch.position.set(0,.15,depth); group.add(arch);
    for (const side of [-1,1]) {
      const column=new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,2.6,8),stone);
      column.position.set(side*1.46,-1.15,depth);group.add(column);
      const capital=new THREE.Mesh(new THREE.BoxGeometry(.27,.14,.24),trim);
      capital.position.set(side*1.46,.14,depth);group.add(capital);
    }
  }
  const crystalMaterial = new THREE.MeshStandardMaterial({color:0x665493,roughness:.28,metalness:.4,emissive:0x35205b,emissiveIntensity:.4,flatShading:true});
  const crystals=[];
  for (const [x,y,z,size] of [[-1.24,.7,-2.9,.15],[1.2,-.8,-2.8,.19],[-1.12,-1.8,-4,.1],[1.14,1.35,-4.1,.1]]) {
    const gem=new THREE.Mesh(new THREE.IcosahedronGeometry(size,0),crystalMaterial);gem.scale.y=1.7;gem.position.set(x,y,z);group.add(gem);crystals.push({gem,y});
  }
  // A painted castle-hall backdrop: one static texture, so it costs one quad.
  const backdropMaterial=new THREE.MeshBasicMaterial({map:paintCastleHall(),transparent:false,depthWrite:false,color:0xffffff});
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(7.6,13.5),backdropMaterial);
  backdrop.position.set(0,-.2,-5.95);backdrop.renderOrder=-10;group.add(backdrop);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(.15,16,12),new THREE.MeshBasicMaterial({color:0xb4bdab}));
  moon.position.set(.91,2.15,-5.1);group.add(moon);
  return {group,update(elapsed){
    for(const [index,{gem,y}] of crystals.entries()){gem.position.y=y+Math.sin(elapsed*.45+index)*.028;gem.rotation.y=elapsed*.10+index;}
    // Torchlight breathes: a tiny, slow tint change on the shared backdrop.
    const flicker=.92+Math.sin(elapsed*3.1)*.03+Math.sin(elapsed*7.3+1.2)*.02;
    backdropMaterial.color.setScalar(flicker);
  }};
}

// Gothic hall behind the mirror: moonlit pointed windows, stone courses,
// hanging banners, torch glow and a polished floor, in the gold and amethyst
// palette of the interface. Painted once; no per-frame work.
function paintCastleHall() {
  const w=768,h=1366,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const g=canvas.getContext('2d');
  const sky=g.createLinearGradient(0,0,0,h);
  sky.addColorStop(0,'#0b0618');sky.addColorStop(.55,'#150a2a');sky.addColorStop(1,'#07040e');g.fillStyle=sky;g.fillRect(0,0,w,h);
  // Stone courses with irregular blocks.
  let seed=90211;const rnd=()=>(seed=(Math.imul(seed,1664525)+1013904223)|0,(seed>>>0)/4294967296);
  for(let y=0,row=0;y<h*.78;y+=46,row++){
    for(let x=-(row%2)*60;x<w;x+=120){
      const shade=14+rnd()*14;g.fillStyle=`rgba(${shade+10},${shade+4},${shade+26},.55)`;g.fillRect(x+2,y+2,116,42);
    }
  }
  g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=2;
  for(let y=0;y<h*.78;y+=46){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
  // Pointed arched windows with moon and stained-glass mullions.
  const window=(cx,top,width,height)=>{
    g.save();g.beginPath();g.moveTo(cx-width/2,top+height);g.lineTo(cx-width/2,top+width*.7);
    g.quadraticCurveTo(cx-width/2,top+width*.1,cx,top);g.quadraticCurveTo(cx+width/2,top+width*.1,cx+width/2,top+width*.7);
    g.lineTo(cx+width/2,top+height);g.closePath();
    const glow=g.createLinearGradient(0,top,0,top+height);glow.addColorStop(0,'#6f5bd0');glow.addColorStop(.5,'#3a2a86');glow.addColorStop(1,'#1a1048');
    g.fillStyle=glow;g.fill();g.clip();
    const moon=g.createRadialGradient(cx+width*.12,top+height*.28,0,cx+width*.12,top+height*.28,width*.55);
    moon.addColorStop(0,'rgba(255,248,214,.95)');moon.addColorStop(.25,'rgba(230,220,255,.45)');moon.addColorStop(1,'rgba(120,90,220,0)');
    g.fillStyle=moon;g.fillRect(cx-width,top,width*2,height);
    g.strokeStyle='rgba(20,12,40,.85)';g.lineWidth=5;
    g.beginPath();g.moveTo(cx,top);g.lineTo(cx,top+height);
    for(let k=1;k<4;k++){const yy=top+height*k/4;g.moveTo(cx-width/2,yy);g.lineTo(cx+width/2,yy);}g.stroke();
    g.restore();
    g.strokeStyle='#8a6d3a';g.lineWidth=7;g.beginPath();g.moveTo(cx-width/2,top+height);g.lineTo(cx-width/2,top+width*.7);
    g.quadraticCurveTo(cx-width/2,top+width*.1,cx,top);g.quadraticCurveTo(cx+width/2,top+width*.1,cx+width/2,top+width*.7);g.lineTo(cx+width/2,top+height);g.stroke();
  };
  window(w*.5,120,230,430);window(w*.14,260,120,300);window(w*.86,260,120,300);
  // Banners with gold trim and a crest diamond.
  for(const [bx,by] of [[w*.3,60],[w*.7,60],[w*.06,520],[w*.94,520]]){
    const bw=62,bh=300;g.fillStyle='#4a1030';g.beginPath();g.moveTo(bx-bw/2,by);g.lineTo(bx+bw/2,by);g.lineTo(bx+bw/2,by+bh);g.lineTo(bx,by+bh-40);g.lineTo(bx-bw/2,by+bh);g.closePath();g.fill();
    g.strokeStyle='#c9a24c';g.lineWidth=3;g.stroke();
    g.fillStyle='#d9b45a';g.beginPath();g.moveTo(bx,by+80);g.lineTo(bx+16,by+115);g.lineTo(bx,by+150);g.lineTo(bx-16,by+115);g.closePath();g.fill();
  }
  // Wall torches: warm pools of light on the stone.
  for(const [tx,ty] of [[w*.2,760],[w*.8,760],[w*.5,330]]){
    const pool=g.createRadialGradient(tx,ty,4,tx,ty,230);pool.addColorStop(0,'rgba(255,170,70,.55)');pool.addColorStop(.35,'rgba(240,110,50,.2)');pool.addColorStop(1,'rgba(240,110,50,0)');
    g.fillStyle=pool;g.fillRect(tx-240,ty-240,480,480);
    g.fillStyle='#2b1c10';g.fillRect(tx-5,ty,10,40);g.fillStyle='#ffd27a';g.beginPath();g.ellipse(tx,ty-8,8,16,0,0,Math.PI*2);g.fill();
  }
  // Polished chequered floor fading into mist.
  const horizon=h*.78;
  for(let r=0;r<14;r++){
    const y0=horizon+(h-horizon)*Math.pow(r/14,1.6),y1=horizon+(h-horizon)*Math.pow((r+1)/14,1.6);
    for(let c=-8;c<8;c++){
      const xs=(w/2)+c*(w/6)*(.35+.65*(y0-horizon)/(h-horizon)*1.0),xe=(w/2)+(c+1)*(w/6)*(.35+.65*(y1-horizon)/(h-horizon));
      g.fillStyle=(r+c)%2===0?'rgba(40,26,70,.9)':'rgba(14,8,30,.95)';g.fillRect(Math.min(xs,xe)-1,y0,Math.abs(xe-xs)+2,y1-y0+1);
    }
  }
  const mist=g.createLinearGradient(0,horizon-80,0,h);mist.addColorStop(0,'rgba(120,90,200,0)');mist.addColorStop(.5,'rgba(120,90,200,.18)');mist.addColorStop(1,'rgba(10,4,24,.7)');
  g.fillStyle=mist;g.fillRect(0,horizon-80,w,h-horizon+80);
  // Heavy vignette keeps the centre dark for the host.
  const vig=g.createRadialGradient(w/2,h*.5,h*.12,w/2,h*.5,h*.72);vig.addColorStop(0,'rgba(0,0,0,.55)');vig.addColorStop(.6,'rgba(0,0,0,.15)');vig.addColorStop(1,'rgba(0,0,0,.65)');
  g.fillStyle=vig;g.fillRect(0,0,w,h);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
