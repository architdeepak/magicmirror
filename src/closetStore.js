import { WardrobePhoto } from "./wardrobePhoto.js";
import { starterWardrobe } from "./starterWardrobe.js";
import { matchGarment } from './garmentMatch.js';
// Renderer-side closet view. Live fit remains local; a still-image provider
// receives only an explicit consented request built by the renderer.
export class ClosetStore {
  constructor({ container, importButton, video, onSelect, onNotice, onStopVoice, ensureCamera }) {
    this.container = container;
    this.importButton = importButton;
    this.onSelect = onSelect || (() => {});
    this.onNotice = onNotice || (() => {});
    this.items = [];
    try { this.favorites = new Set(JSON.parse(localStorage.getItem('mirror.closet.favorites') || '[]').filter(id => typeof id === 'string').slice(0, 500)); } catch { this.favorites = new Set(); }
    this.favoritesOnly = false;
    this.photo = new WardrobePhoto({ video, onStopVoice, ensureCamera, suggestName: category => this.nextPhotoName(category), onSave: input => this.savePhoto(input), onNotice: this.onNotice });
    this.selectedId = localStorage.getItem('mirror.closet.selected') || '';
    this.importButton?.addEventListener('click', () => this.importGarment());
    document.querySelector('#closet-edit')?.addEventListener('click',()=>void this.editPhoto());
  }

  async load() {
    try {
      const closet = await window.mirrorBridge?.listCloset();
      this.items = [...(closet?.garments || []), ...starterWardrobe()];
      this.render();
      const selected = this.items.find((item) => item.id === this.selectedId);
      if (selected) this.onSelect(selected);
    } catch (error) {
      this.onNotice(`Closet unavailable: ${error.message}`);
    }
  }

  nextPhotoName(category) {
    const base = `My ${{ top: 'top', outerwear: 'jacket', dress: 'dress', skirt: 'skirt', bottoms: 'trousers' }[category] || 'garment'}`;
    let name = base, number = 2;
    while (this.items.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) name = `${base} ${number++}`;
    return name;
  }

  importGarment() { this.photo.show(); }

  async editPhoto(){const item=this.items.find(item=>item.id===this.selectedId);if(!item||item.starter){this.onNotice('Choose one of your saved garment photos to edit.');return;}await this.photo.showSaved(item);}

  async savePhoto(input) {
    const item = window.mirrorBridge?.saveClosetPhoto
      ? await window.mirrorBridge.saveClosetPhoto(input)
      : { id: `preview-${Date.now()}`, name: input.name, category: input.category, imageUrl: input.imageDataUrl, backImageUrl: input.backImageDataUrl, previewOnly: true };
    const index=this.items.findIndex(current=>current.id===item.id);if(index>=0)this.items[index]=item;else this.items.push(item); if(!input.requestId||this.photo.saveRequestId===input.requestId)this.select(item.id);else this.render();
    return item;
  }

  cycle(delta = 1) {
    const items = this.visibleItems();
    if (!items.length) { this.onNotice('No favorite garments yet. Select a garment and say “favorite this”.'); return null; }
    const index = items.findIndex(item => item.id === this.selectedId);
    return this.select(items[(index < 0 ? 0 : index + delta + items.length) % items.length].id);
  }

  visibleItems() { return this.favoritesOnly ? this.items.filter(item => this.favorites.has(item.id)) : this.items; }
  favoriteCurrent(remove = false) {
    const item = this.items.find(item => item.id === this.selectedId);
    if (!item) { this.onNotice('Choose a garment to favorite.'); return; }
    if (remove) this.favorites.delete(item.id); else this.favorites.add(item.id);
    localStorage.setItem('mirror.closet.favorites', JSON.stringify([...this.favorites])); this.render();
    this.onNotice(`${item.name} ${remove ? 'removed from favorites' : 'saved to favorites'}`);
  }

  voice(command) {
    const text = String(command).trim().toLowerCase().replace(/[.!?]+$/, '');
    if (this.photo.voice(command.trim().replace(/[.!?]+$/, ''))) return true;
    if (/^(?:favorite|favourite|pin) (?:this|it|this garment)$/.test(text)) { this.favoriteCurrent(); return true; }
    if (/^(?:unfavorite|unfavourite|unpin|remove from favorites)(?: this| it)?$/.test(text)) { this.favoriteCurrent(true); return true; }
    if (/^(?:show|open) (?:my )?(?:favorites|favourites|all clothes|all garments|wardrobe)$/.test(text)) { this.favoritesOnly = /favou?rites/.test(text); this.render(); return true; }
    if (/^(?:edit|adjust|recrop)(?: my| this| the)? (?:garment|garment photo|photo)$/.test(text)) { void this.editPhoto();return true; }
    if (/^(?:add|scan|upload)(?: a| my| new)? (?:garment|clothes|clothing|photo)$/.test(text)) { this.importGarment(); return true; }
    if (/^(?:next|previous)(?: garment|outfit|clothes|style)$/.test(text)) { this.cycle(text.startsWith('previous') ? -1 : 1); return true; }
    const color = text.match(/^(?:make it|change (?:the )?color to) (black|white|blue|red|green|purple)$/);
    const style = text.match(/^(?:change (?:the )?style to|show|try on) (?:a |an )?(t-shirt|t shirt|blouse|long sleeve|dress|skirt)$/);
    const current = this.items.find(item => item.id === this.selectedId);
    if (color || style) {
      if (color && !current?.starter) { this.onNotice('Color changes apply to starter clothes. Your garment photo keeps its original colors.'); return true; }
      const selectedStyle = style ? style[1].replace('t shirt', 't-shirt') : current?.style;
      const selectedColor = color ? color[1] : current?.color || 'blue';
      const item = this.items.find(item => item.starter && item.style === selectedStyle && item.color === selectedColor);
      if (item) this.select(item.id);
      return true;
    }
    const recall = text.match(/^(?:try(?: on)?|wear|put on) (.+)$/);
    if (recall) {
      const { item, choices } = matchGarment(this.items, recall[1]);
      if (item) { this.select(item.id); return true; }
      if (choices.length) { this.onNotice(`Which garment: ${choices.slice(0, 3).map(item => item.name).join(', ')}?`); return true; }
    }
    return false;
  }

  select(id) {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) return null;
    this.selectedId = item.id;
    if (this.favoritesOnly && !this.favorites.has(id)) this.favoritesOnly = false;
    localStorage.setItem('mirror.closet.selected', item.id);
    this.render();
    this.onSelect(item);
    return item;
  }

  render() {
    if (!this.container) return;
    if (!this.items.length) {
      this.container.innerHTML = '<div class="closet-empty">Your closet is local and empty. Add a front-facing garment PNG, JPG, or WebP to begin.</div>';
      return;
    }
    const visible = this.visibleItems();
    const edit=document.querySelector('#closet-edit');if(edit)edit.disabled=!this.items.some(item=>item.id===this.selectedId&&!item.starter);
    document.querySelector('#closet-favorite')?.setAttribute('aria-pressed', String(this.favorites.has(this.selectedId)));
    document.querySelector('#closet-filter')?.setAttribute('aria-pressed', String(this.favoritesOnly));
    this.container.innerHTML = visible.length ? visible.map((item) => `
      <button class="closet-item${item.id === this.selectedId ? ' selected' : ''}" type="button" data-closet-id="${escapeAttribute(item.id)}">
        <img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.name)}">
        <span><b>${this.favorites.has(item.id) ? '★ ' : ''}${escapeHtml(item.name)}</b><small>${escapeHtml(item.category)} · ${item.backImageUrl ? 'front + back · ' : ''}local</small></span>
      </button>`).join('') : '<div class="closet-empty">Favorite a garment to keep it close at hand.</div>';
    this.container.querySelector('.selected')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    this.container.querySelectorAll('[data-closet-id]').forEach((button) => button.addEventListener('click', () => {
      this.select(button.dataset.closetId);
    }));
  }
}

function escapeHtml(value = '') { const node = document.createElement('span'); node.textContent = String(value); return node.innerHTML; }
function escapeAttribute(value = '') { return escapeHtml(value).replaceAll('\"', '&quot;').replaceAll("'", '&#39;').replace(/`/g, '&#96;'); }
