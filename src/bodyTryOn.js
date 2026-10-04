import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { garmentSlot } from './starterWardrobe.js';

export function garmentPlacement(pose, item, project) {
  const ids = item.category === 'bottoms' ? [23,24,27,28] : [11,12,23,24];
  if (!pose || ids.some(id => !pose[id] || (pose[id].visibility ?? 1) < .45)) return null;
  let [left,right,bottomLeft,bottomRight] = ids.map(id => project(pose[id]));
  // Normalize the mirrored shoulder axis so garments never flip upside down.
  if (left.x > right.x) [left,right] = [right,left];
  const top = { x: (left.x+right.x)/2, y: (left.y+right.y)/2 };
  const bottom = { x: (bottomLeft.x+bottomRight.x)/2, y: (bottomLeft.y+bottomRight.y)/2 };
  const bodyWidth = Math.hypot(right.x-left.x,right.y-left.y);
  const torso = Math.hypot(bottom.x-top.x,bottom.y-top.y);
  const dress = item.category === 'dress';
  return { x: top.x, y: top.y + torso * (dress ? .68 : .48), width: bodyWidth * (item.category === 'bottoms' ? 1.5 : 2), height: torso * (dress ? 2.05 : 1.6), angle: Math.atan2(right.y-left.y,right.x-left.x) };
}

export class BodyTryOn {
  constructor(video) { this.video=video; this.items=new Map(); this.images=new Map(); this.pose=null; this.lastDetect=-Infinity; this.lastPoseAt=-Infinity; this.lastFrame=-1; this.status='ready'; this.initializing=null; }
  async init() {
    if (this.landmarker) return;
    if (this.initializing) return this.initializing;
    this.initializing=(async () => {
      const vision=await FilesetResolver.forVisionTasks(new URL('../node_modules/@mediapipe/tasks-vision/wasm',import.meta.url).href);
      const options={baseOptions:{modelAssetPath:new URL('./assets/models/pose_landmarker_lite.task',import.meta.url).href,delegate:'GPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.45,minPosePresenceConfidence:.45,minTrackingConfidence:.45};
      try { this.landmarker=await PoseLandmarker.createFromOptions(vision,options); }
      catch { options.baseOptions.delegate='CPU'; this.landmarker=await PoseLandmarker.createFromOptions(vision,options); }
    })().catch(error=>{this.status='unavailable';console.warn('[body tracking]',error.message);}).finally(()=>{this.initializing=null;});
    return this.initializing;
  }
  wear(item) {
    const slot=garmentSlot(item);
    if(slot==='body') this.items.clear(); else this.items.delete('body');
    this.items.set(slot,item);
    if(!this.images.has(item.id)) { const image=new Image();image.src=item.imageUrl;this.images.set(item.id,image); }
    this.init();
    return this.getState();
  }
  remove(item) { if(item) { const slot=garmentSlot(item);if(this.items.get(slot)?.id===item.id)this.items.delete(slot); }else this.items.clear();return this.getState(); }
  getState() { return { garments:[...this.items.values()].map(item=>({id:item.id,name:item.name})),bodyDetected:Boolean(this.pose),trackingStatus:this.status,preview:'local 2D body-tracked garment overlay' }; }
  resetTracking() { this.pose=null;this.lastFrame=-1;this.lastPoseAt=-Infinity; }
  update(now,active) {
    if(now-this.lastPoseAt>350)this.pose=null;
    if(!active || !this.items.size) { this.resetTracking(); return; }
    if(!this.landmarker || this.video.readyState<2 || !this.video.videoWidth || this.video.currentTime===this.lastFrame || now-this.lastDetect<100) return;
    this.lastDetect=now;this.lastFrame=this.video.currentTime;
    try { const pose=this.landmarker.detectForVideo(this.video,now).landmarks?.[0];if(pose){this.pose=pose;this.lastPoseAt=now;}else if(now-this.lastPoseAt>300)this.pose=null;this.status=this.pose?'body lock':'show shoulders and hips'; }
    catch { this.pose=null; }
  }
  draw(ctx,width,height) {
    if(!this.pose) return;
    const scale=Math.max(width/this.video.videoWidth,height/this.video.videoHeight);
    const vw=this.video.videoWidth*scale,vh=this.video.videoHeight*scale;
    const project=point=>({x:(width-vw)/2+(1-point.x)*vw,y:(height-vh)/2+point.y*vh});
    for(const item of this.items.values()) {
      const image=this.images.get(item.id),place=garmentPlacement(this.pose,item,project);
      if(!place||!image?.complete||!image.naturalWidth)continue;
      ctx.save();ctx.translate(place.x,place.y);ctx.rotate(place.angle);ctx.drawImage(image,-place.width/2,-place.height/2,place.width,place.height);ctx.restore();
    }
  }
  dispose(){this.landmarker?.close();this.resetTracking();}
}
