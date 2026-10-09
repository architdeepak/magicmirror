// Own only pending managed-browser loads. Cancellation keeps an already visible
// browser available, and retires a hidden window that would otherwise open late.
class DesktopNavigation {
  constructor({onRetire=()=>{}}={}){this.generation=0;this.pending=null;this.onRetire=onRetire;}
  begin(){this.cancel();return this.generation;}
  attach(generation,browser){this.assertCurrent(generation);this.pending={generation,browser};}
  assertCurrent(generation){if(generation!==this.generation)throw new Error('Desktop navigation cancelled or superseded.');}
  finish(generation){this.assertCurrent(generation);this.pending=null;}
  cancel(){
    this.generation++;const pending=this.pending;this.pending=null;
    if(!pending||pending.browser.isDestroyed())return;
    try{pending.browser.webContents.stop();}catch{}
    if(!pending.browser.isVisible()){
      this.onRetire(pending.browser);
      try{pending.browser.close();}catch{}
    }
  }
}
module.exports={DesktopNavigation};
