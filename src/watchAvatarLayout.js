// Reserve a companion band around the actual Watch/caption controls. Layout
// changes are event-driven; there is no polling or per-frame geometry work.
export function computeWatchAvatarLayout({ width, height, top, bottom, position = 'center' }) {
  if (![width,height,top,bottom].every(Number.isFinite) || width <= 0 || height <= 0 || bottom-top < 160) return null;
  const gap=Math.max(12,width*.025), avatarHeight=Math.min(height*.19,(bottom-top)*.32), avatarWidth=Math.min(width*.28,avatarHeight*.88);
  const upper=position==='upper', y=upper?top:bottom-avatarHeight;
  const x=position==='left'?width*.05:position==='right'?width-avatarWidth-width*.05:(width-avatarWidth)/2;
  return { x,y,width:avatarWidth,height:avatarHeight,panelTop:upper?y+avatarHeight+gap:top,panelBottom:upper?bottom:y-gap,gap };
}
export class WatchAvatarLayout {
  constructor({ shell, panel, host, getState }) {
    Object.assign(this,{shell,panel,host,getState});this.frame=null;this.disposed=false;this.layout=null;
    const document=shell.ownerDocument;this.window=document.defaultView;this.document=document;
    this.schedule=this.schedule.bind(this);
    this.resize=new this.window.ResizeObserver(this.schedule);
    for(const element of [shell,panel.querySelector('.watch-card'),document.querySelector('.topbar'),document.querySelector('#live-captions'),document.querySelector('#oracle-card'),document.querySelector('#prompt-form')])if(element)this.resize.observe(element);
    this.mutations=new this.window.MutationObserver(this.schedule);
    this.mutations.observe(shell,{attributes:true,attributeFilter:['data-mode','data-desktop','data-avatar-position','data-sleeping']});
    for(const element of [document.querySelector('#live-captions'),document.querySelector('#oracle-card')])if(element)this.mutations.observe(element,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    this.window.addEventListener('resize',this.schedule);document.addEventListener('visibilitychange',this.schedule);
  }
  schedule() {
    if(this.disposed||this.frame!==null)return;
    this.frame=this.window.requestAnimationFrame(()=>{this.frame=null;this.update();});
  }
  update() {
    if(this.disposed)return;
    const state=this.getState();
    if(!state.active||this.document.hidden||this.shell.dataset.sleeping==='true') { delete this.shell.dataset.watchCompanion;this.layout=null;return; }
    const rect=this.shell.getBoundingClientRect(), header=this.document.querySelector('.topbar').getBoundingClientRect();
    const gap=Math.max(12,rect.width*.025);let bottom=rect.height-gap;
    for(const selector of ['#live-captions','#oracle-card','#prompt-form','.wake-status']) {
      const element=this.document.querySelector(selector);if(!element)continue;
      if(selector==='#oracle-card'&&element.classList.contains('empty'))continue;
      if(selector==='#live-captions'&&!element.classList.contains('visible'))continue;
      const bounds=element.getBoundingClientRect();if(bounds.height>0)bottom=Math.min(bottom,bounds.top-rect.top-gap);
    }
    const top=Math.max(header.bottom-rect.top+gap,95);
    const layout=computeWatchAvatarLayout({width:rect.width,height:rect.height,top,bottom,position:state.position});
    if(!layout){delete this.shell.dataset.watchCompanion;this.layout=null;return;}
    this.layout=layout;
    const values={'--watch-avatar-x':layout.x,'--watch-avatar-y':layout.y,'--watch-avatar-width':layout.width,'--watch-avatar-height':layout.height,'--watch-content-top':layout.panelTop,'--watch-content-bottom':rect.height-layout.panelBottom};
    for(const [key,value]of Object.entries(values)){const px=value.toFixed(2)+'px';if(this.shell.style.getPropertyValue(key)!==px)this.shell.style.setProperty(key,px);}
    this.shell.dataset.watchCompanion='true';
  }
  snapshot(){return this.layout?{active:true,...this.layout}:{active:false};}
  destroy(){this.disposed=true;this.resize.disconnect();this.mutations.disconnect();this.window.removeEventListener('resize',this.schedule);this.document.removeEventListener('visibilitychange',this.schedule);if(this.frame!==null)this.window.cancelAnimationFrame(this.frame);this.frame=null;delete this.shell.dataset.watchCompanion;}
}
