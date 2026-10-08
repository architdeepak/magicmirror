// Animate the existing texture itself. Feathered, bounded feature crops avoid
// duplicate painted eyebrows and skin-colored ellipse eyelids.
export class FaceFeatures {
  constructor(image, spec) {
    this.spec = spec; this.eyes = [-1, 1].map(side => this.crop(image, side * (spec.eyeX ?? .125), spec.eyeY ?? .06, .195, .108));
    this.brows = [-1, 1].map(side => this.crop(image, side * (spec.eyeX ?? .125), (spec.eyeY ?? .06) - .073, .22, .10));
    this.mouth = this.crop(image, 0, spec.mouthY ?? .23, .26, .13);
  }
  crop(image, x, y, width, height) {
    const make = () => { const c = document.createElement('canvas'); c.width = Math.ceil(image.naturalWidth * width); c.height = Math.ceil(image.naturalHeight * height); return c; };
    const source = make(), context = source.getContext('2d');
    context.drawImage(image, image.naturalWidth * (.5 + x - width / 2), image.naturalHeight * (.5 + y - height / 2), image.naturalWidth * width, image.naturalHeight * height, 0, 0, source.width, source.height);
    const mask = make(), m = mask.getContext('2d');
    m.translate(mask.width / 2, mask.height / 2); m.scale(mask.width / 2, mask.height / 2);
    const gradient = m.createRadialGradient(0,0,0,0,0,1);
    gradient.addColorStop(0, '#fff'); gradient.addColorStop(.74, '#fff'); gradient.addColorStop(1, 'rgba(255,255,255,0)');m.fillStyle=gradient;m.fillRect(-1,-1,2,2);
    return { source, pass: make(), output: make(), mask, x, y, width, height };
  }
  warp(ctx, feature, size, { blink = 0, dx = 0, lift = 0, smile = 0, wide = 0 } = {}) {
    const { source, pass, output, mask } = feature, w = source.width, h = source.height;
    const a = pass.getContext('2d'), b = output.getContext('2d'); a.clearRect(0,0,w,h); b.clearRect(0,0,w,h);
    const columns = 20, rows = 28;
    // First pass: gaze in the textured iris / asymmetric mouth corners. At the
    // crop boundary displacement is zero, so the original face stays seamless.
    const mapX = t => t * w + dx * w * Math.sin(t * Math.PI) ** 2;
    for (let i=0;i<columns;i++) { const left=i/columns,right=(i+1)/columns;const x=mapX(left),next=mapX(right);const y=-smile*h*.32*(Math.abs(left-.5)*2)**1.4*Math.sin(left*Math.PI);a.drawImage(source,left*w,0,w/columns,h,x,y,next-x+.5,h); }
    const close = Math.min(.995,Math.max(0,blink)), eyeScale = 1-close;
    const mapY = t => {
      if (close > .001 || wide > .001) {
        const scale = Math.min(1.25,eyeScale+wide*.22);
        if(t<.28)return t/.28*(.5-.22*scale)*h;
        if(t>.72)return (.5+.22*scale+(t-.72)/.28*(.5-.22*scale))*h;
        return (.5+(t-.5)*scale)*h;
      }
      return (t-lift*.29*Math.sin(t*Math.PI)**2)*h;
    };
    for(let i=0;i<rows;i++){const top=i/rows,bottom=(i+1)/rows,y=mapY(top),next=mapY(bottom);b.drawImage(pass,0,top*h,w,h/rows,0,y,w,next-y+.5);}
    b.globalCompositeOperation='destination-in';b.drawImage(mask,0,0);b.globalCompositeOperation='source-over';
    ctx.drawImage(output,(feature.x-feature.width/2)*size,(feature.y-feature.height/2)*size,feature.width*size,feature.height*size);
  }
  draw(ctx,size,values,gaze,jaw) {
    for(let i=0;i<2;i++) {
      const side=i===0?'Left':'Right',blink=Math.max(values['eyeBlink'+side]||0,(values['cheekSquint'+side]||0)*.45),wide=values['eyeWide'+side]||0;
      const gx=Math.max(-1,Math.min(1,(gaze.x||0)*(gaze.confidence||0)))*.06;
      if(blink>.008||Math.abs(gx)>.003||wide>.03)this.warp(ctx,this.eyes[i],size,{blink,wide,dx:gx});
      const lift=Math.max(values.browInnerUp||0,values['browOuterUp'+side]||0)-(values['browDown'+side]||0)*.55;
      if(Math.abs(lift)>.015)this.warp(ctx,this.brows[i],size,{lift});
    }
    const smile=Math.max(values.mouthSmileLeft||0,values.mouthSmileRight||0);
    if(jaw<.055&&smile>.03)this.warp(ctx,this.mouth,size,{smile});
  }
}
