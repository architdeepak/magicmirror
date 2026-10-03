// Renderer-side closet view. Images remain local; this module never uploads a
// garment or a camera frame. A future try-on provider receives an explicit
// consented request built from the selected item and current camera frame.
export class ClosetStore {
  constructor({ container, importButton, onSelect, onNotice }) {
    this.container = container;
    this.importButton = importButton;
    this.onSelect = onSelect || (() => {});
    this.onNotice = onNotice || (() => {});
    this.items = [];
    this.selectedId = localStorage.getItem('mirror.closet.selected') || '';
    this.importButton?.addEventListener('click', () => this.importGarment());
  }

  async load() {
    try {
      const closet = await window.mirrorBridge?.listCloset();
      this.items = closet?.garments || [];
      this.render();
      const selected = this.items.find((item) => item.id === this.selectedId);
      if (selected) this.onSelect(selected);
    } catch (error) {
      this.onNotice(`Closet unavailable: ${error.message}`);
    }
  }

  async importGarment() {
    const name = window.prompt('Name this garment (for example: Black dinner jacket)');
    if (!name?.trim()) return;
    const category = window.prompt('Category: outerwear, top, dress, bottoms, or accessory', 'outerwear') || 'other';
    try {
      let item;
      if (window.mirrorBridge?.importClosetGarment) item = await window.mirrorBridge.importClosetGarment({ name, category });
      else item = await this.importBrowserPreviewGarment(name, category);
      if (!item) return;
      this.items.push(item);
      this.selectedId = item.id;
      localStorage.setItem('mirror.closet.selected', item.id);
      this.render();
      this.onSelect(item);
      this.onNotice(`${item.name} added locally. Select it to prepare a try-on.`);
    } catch (error) {
      this.onNotice(`Could not import garment: ${error.message}`);
    }
  }

  importBrowserPreviewGarment(name, category) {
    return new Promise((resolve) => {
      const picker = document.createElement('input');
      picker.type = 'file'; picker.accept = 'image/png,image/jpeg,image/webp';
      picker.addEventListener('change', () => {
        const file = picker.files?.[0];
        if (!file) { resolve(null); return; }
        resolve({ id: `preview-${Date.now()}`, name, category, imageUrl: URL.createObjectURL(file), createdAt: new Date().toISOString(), previewOnly: true });
      }, { once: true });
      picker.click();
    });
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
    this.container.querySelectorAll('[data-closet-id]').forEach((button) => button.addEventListener('click', () => {
      const item = this.items.find((candidate) => candidate.id === button.dataset.closetId);
      if (!item) return;
      this.selectedId = item.id;
      localStorage.setItem('mirror.closet.selected', item.id);
      this.render();
      this.onSelect(item);
    }));
  }
}

function escapeHtml(value = '') { const node = document.createElement('span'); node.textContent = String(value); return node.innerHTML; }
function escapeAttribute(value = '') { return escapeHtml(value).replace(/`/g, '&#96;'); }
