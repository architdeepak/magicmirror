// Non-modal dock panels: closed content must leave the keyboard focus order.
export class PopupPanels {
  constructor(entries, document) {
    this.entries = entries;
    this.document = document;
    for (const {panel,button} of entries) {
      panel.inert = true;
      panel.setAttribute('aria-hidden','true');
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-controls',panel.id);
    }
  }
  close(entry, {restoreFocus=true}={}) {
    const {panel,button}=entry;
    const wasOpen=panel.classList.contains('open');
    if(panel.contains(this.document.activeElement)) {
      if(restoreFocus)button.focus({preventScroll:true});
      else this.document.activeElement.blur();
    }
    panel.classList.remove('open');
    panel.inert=true;
    panel.setAttribute('aria-hidden','true');
    button.setAttribute('aria-expanded','false');
    return wasOpen;
  }
  closeAll(options) {
    let closed=false;
    for(const entry of this.entries)closed=this.close(entry,options)||closed;
    return closed;
  }
  closePanel(panel, options) {
    const entry=this.entries.find(entry=>entry.panel===panel);
    return entry ? this.close(entry,options) : false;
  }
  toggle(panel) {
    const entry=this.entries.find(entry=>entry.panel===panel);
    if(!entry)return false;
    if(panel.classList.contains('open')){this.close(entry);return false}
    this.closeAll({restoreFocus:false});
    panel.inert=false;
    panel.setAttribute('aria-hidden','false');
    panel.classList.add('open');
    entry.button.setAttribute('aria-expanded','true');
    panel.querySelector('input:not([disabled]), button:not([disabled]), select:not([disabled]), summary, [tabindex="0"]')?.focus({preventScroll:true});
    return true;
  }
}
