import { WardrobePhoto } from "./wardrobePhoto.js";
import { starterWardrobe } from "./starterWardrobe.js";
// Renderer-side closet view. Live fit remains local; a still-image provider
// receives only an explicit consented request built by the renderer.
export class ClosetStore {
  constructor({ container, importButton, video, onSelect, onNotice }) {
    this.container = container;
    this.importButton = importButton;
    this.onSelect = onSelect || (() => {});
    this.onNotice = onNotice || (() => {});
    this.items = [];
    this.photo = new WardrobePhoto({ video, onSave: input => this.savePhoto(input), onNotice: this.onNotice });
    this.selectedId = localStorage.getItem('mirror.closet.selected') || '';
    this.importButton?.addEventListener('click', () => this.importGarment());
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

  importGarment() { this.photo.show(); }

  async savePhoto(input) {
    const item = window.mirrorBridge?.saveClosetPhoto
      ? await window.mirrorBridge.saveClosetPhoto(input)
      : { id: `preview-${Date.now()}`, name: input.name, category: input.category, imageUrl: input.imageDataUrl, previewOnly: true };
    this.items.push(item); this.select(item.id);
    return item;
  }

  cycle(delta = 1) {
    if (!this.items.length) return null;
    const index = this.items.findIndex(item => item.id === this.selectedId);
    return this.select(this.items[(Math.max(0, index) + delta + this.items.length) % this.items.length].id);
  }

  voice(command) {
    const text = String(command).trim().toLowerCase().replace(/[.!?]+$/, '');
    if (this.photo.voice(command.trim().replace(/[.!?]+$/, ''))) return true;
    if (/^(?:add|scan|upload)(?: a| my| new)? (?:garment|clothes|clothing|photo)$/.test(text)) { this.importGarment(); return true; }
    if (/^(?:next|previous)(?: garment|outfit|clothes|style)$/.test(text)) { this.cycle(text.startsWith('previous') ? -1 : 1); return true; }
    const color = text.match(/^(?:make it|change (?:the )?color to) (black|white|blue|red|green|purple)$/);
    const style = text.match(/^(?:change (?:the )?style to|show|try on) (?:a |an )?(t-shirt|t shirt|blouse|long sleeve|dress|skirt)$/);
    const current = this.items.find(item => item.id === this.selectedId);
    if (color || style) {
      if (color && !current?.starter) { this.onNotice('Color changes apply to starter clothes. Your garment photo keeps its original colors.'); return true; }
      const selectedStyle = style ? style[1].replace('t shirt', 't-shirt') : current.style;
      const selectedColor = color ? color[1] : current?.color || 'blue';
      const item = this.items.find(item => item.starter && item.style === selectedStyle && item.color === selectedColor);
      if (item) this.select(item.id);
      return true;
    }
    return false;
  }

  select(id) {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) return null;
    this.selectedId = item.id;
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
    this.container.innerHTML = this.items.map((item) => `
      <button class="closet-item${item.id === this.selectedId ? ' selected' : ''}" type="button" data-closet-id="${escapeAttribute(item.id)}">
        <img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.name)}">
        <span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.category)} · local</small></span>
      </button>`).join('');
    this.container.querySelector('.selected')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    this.container.querySelectorAll('[data-closet-id]').forEach((button) => button.addEventListener('click', () => {
      this.select(button.dataset.closetId);
    }));
  }
}

function escapeHtml(value = '') { const node = document.createElement('span'); node.textContent = String(value); return node.innerHTML; }
function escapeAttribute(value = '') { return escapeHtml(value).replaceAll('\"', '&quot;').replaceAll("'", '&#39;').replace(/`/g, '&#96;'); }
