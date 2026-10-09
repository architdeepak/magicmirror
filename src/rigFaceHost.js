import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { boundedSurface, displayProfile } from './displayQuality.js';
import { authorFaceMorphs, buildRigAccessories } from './rigGeometry.js';
const RIGS={velora:'assets/personas/velora-3d-v1.glb',solenne:'assets/personas/solenne-3d-v1.glb'};
function disposeTree(root){const textures=new Set();root?.traverse(n=>{n.geometry?.dispose();for(const m of(Array.isArray(n.material)?n.material:[n.material])){if(!m)continue;for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}});textures.forEach(t=>t.dispose());}
export class RigFaceHost {
 constructor(host,{onFailure=()=>{},softwareGraphics=false,antialias=!softwareGraphics}={}){
  this.host=host;this.onFailure=onFailure;this.canvas=document.createElement('canvas');this.canvas.className='rig-face-canvas';this.canvas.style.display='none';host.append(this.canvas);
  this.quality='auto';this.ready=false;this.generation=0;this.frames=0;this.reuses=0;this.signature=null;this.width=0;this.height=0;this.smooth={turn:0,nod:0,lean:0,x:0,y:0};
  try{this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:true,antialias,preserveDrawingBuffer:true,powerPreference:'low-power'});}catch(e){this.canvas.remove();throw e;}

  const gl=this.renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');this.graphics={renderer:String(info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)),samples:gl.getParameter(gl.SAMPLES)};
  this.renderer.info.autoReset=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
  this.scene=new THREE.Scene();const environment=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(environment,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.45;environment.dispose();pmrem.dispose();this.camera=new THREE.PerspectiveCamera(28,1,.1,30);this.loader=new GLTFLoader();
  this.antialiasing=softwareGraphics?'fxaa':'msaa';
  if(softwareGraphics){this.composer=new EffectComposer(this.renderer);this.beautyPass=new RenderPass(this.scene,this.camera);this.outputPass=new OutputPass();this.fxaaPass=new ShaderPass(FXAAShader);this.composer.addPass(this.beautyPass);this.composer.addPass(this.outputPass);this.composer.addPass(this.fxaaPass);}

  this.scene.add(new THREE.HemisphereLight(0xfff4e8,0x242238,1.5));
  const key=new THREE.DirectionalLight(0xffeedc,2.4);key.position.set(-2,3,4);this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xc6d5ee,.8);fill.position.set(2,.5,3);this.scene.add(fill);
  const rim=new THREE.DirectionalLight(0xb397e0,1.8);rim.position.set(2,2,-3);this.scene.add(rim);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.ready=false;this.onFailure(new Error('3D face graphics context lost'));});
 }
 setQuality(id){this.quality=displayProfile(id)===displayProfile('auto')?'auto':id;this.resize();}
 resize(){
  const w=Math.max(1,this.host.clientWidth),h=Math.max(1,this.host.clientHeight),p=displayProfile(this.quality),size=boundedSurface(w,h,window.devicePixelRatio||1,p.avatarPixels,p.avatarDpr);
  if(size.width===this.width&&size.height===this.height)return;
  this.width=size.width;this.height=size.height;this.renderer.setPixelRatio(1);this.renderer.setSize(size.width,size.height,false);this.composer?.setSize(size.width,size.height);this.fxaaPass?.uniforms.resolution.value.set(1/size.width,1/size.height);this.canvas.style.width='100%';this.canvas.style.height='100%';this.camera.aspect=w/h;
  if(this.root){const fov=THREE.MathUtils.degToRad(this.camera.fov/2);const distance=Math.max(3.25/(2*Math.tan(fov)*.83),2.65/(2*Math.tan(fov)*this.camera.aspect*.86));this.camera.position.set(0,.18,distance);this.camera.lookAt(0,.18,0);}
  this.camera.updateProjectionMatrix();this.signature=null;
 }
 async setPersona(persona){
  if(this.persona===persona&&this.ready)return true;
  if(!RIGS[persona])throw new Error('This persona has no authored 3D face yet');
  const generation=++this.generation;this.ready=false;
  const gltf=await this.loader.loadAsync(RIGS[persona]);if(generation!==this.generation){disposeTree(gltf.scene);return false;}
  const face=gltf.scene.getObjectByName('faceMesh');if(!face?.isMesh||face.geometry.attributes.position.count!==478){disposeTree(gltf.scene);throw new Error('3D face topology is unsupported');}
  face.removeFromParent();disposeTree(gltf.scene);face.rotation.set(0,0,0);face.position.set(0,0,0);face.scale.set(1,1,1);
  face.material.transparent=false;face.material.depthWrite=true;face.material.alphaTest=0;face.material.roughness=.7;face.material.side=THREE.DoubleSide;face.material.needsUpdate=true;
  const supported=authorFaceMorphs(face),accessories=buildRigAccessories(face,persona);
  if(generation!==this.generation){disposeTree(face);return false;}
  if(this.root){this.scene.remove(this.root);disposeTree(this.root);}
  this.root=new THREE.Group();this.root.add(face);this.scene.add(this.root);this.face=face;this.accessories=accessories;this.supported=supported;this.persona=persona;this.width=0;this.smooth={turn:0,nod:0,lean:0,x:0,y:0};this.resize();
  this.renderer.compile(this.scene,this.camera);this.ready=true;return true;
 }
 update(blend={},gaze={},performance={},dt=1/30,viewer={}){
  if(!this.ready)return false;
  const clamp=THREE.MathUtils.clamp,alpha=1-Math.exp(-clamp(dt,.001,.06)*12);
  const target={turn:clamp((performance.turn||0)*.35+(viewer.x||0)*.10,-.60,.60),nod:clamp((performance.nod||0)*.18-(viewer.y||0)*.06,-.20,.20),lean:clamp((performance.lean||0)*.08,-.08,.08),x:clamp(gaze.x||0,-1,1),y:clamp(gaze.y||0,-1,1)};
  for(const k of Object.keys(target))this.smooth[k]+=(target[k]-this.smooth[k])*alpha;
  this.root.rotation.set(this.smooth.nod,this.smooth.turn,this.smooth.lean);
  for(const[name,index]of Object.entries(this.face.morphTargetDictionary)){const value=clamp(Number(blend[name])||0,0,1);this.face.morphTargetInfluences[index]=value;this.accessories.headVolume.morphTargetInfluences[index]=value;}
  for(const eye of this.accessories.eyes){eye.group.rotation.y=this.smooth.x*.24;eye.group.rotation.x=this.smooth.y*.18;}
  const jaw=clamp(blend.jawOpen||0,0,1);this.accessories.cavity.scale.y=.10+jaw*.18;this.accessories.cavity.position.y=-.56-jaw*.08;this.accessories.teeth.visible=jaw>.08;
  const sig=[...Object.values(this.smooth),...this.face.morphTargetInfluences].map(v=>Math.round(v*1000)).join(',');
  if(sig===this.signature){this.reuses++;return false;}this.signature=sig;
  this.renderer.info.reset();if(this.composer)this.composer.render();else this.renderer.render(this.scene,this.camera);
  this.frames++;this.canvas._mirrorRevision=this.frames;this.updateAnchor();return true;
 }
 updateAnchor(){const point=new THREE.Vector3(0,-.15,.1).applyMatrix4(this.root.matrixWorld).project(this.camera),w=this.host.clientWidth,h=this.host.clientHeight;this.faceAnchor={x:(point.x*.5+.5)*w,y:(-.5*point.y+.5)*h,size:w*.82};this.host.style.setProperty('--face-center-x',this.faceAnchor.x+'px');this.host.style.setProperty('--face-center-y',this.faceAnchor.y+'px');this.host.style.setProperty('--face-glow-size',w*1.18+'px');}
 snapshot(){return{ready:this.ready,persona:this.persona,quality:this.quality,graphics:this.graphics,antialiasing:this.antialiasing,resolution:[this.width,this.height],frames:this.frames,reuses:this.reuses,supported:this.supported||[],triangles:this.renderer.info.render.triangles,drawCalls:this.renderer.info.render.calls};}
 dispose(){++this.generation;this.ready=false;this.observer.disconnect();disposeTree(this.root);this.environment.dispose();this.composer?.dispose();this.beautyPass?.dispose();this.outputPass?.dispose();this.fxaaPass?.dispose();this.renderer.dispose();if(!this.renderer.getContext().isContextLost())this.renderer.forceContextLoss();this.canvas.remove();}
}
