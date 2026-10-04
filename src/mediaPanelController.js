// Media visibility belongs to the user, independent of assistant turn states.
export class MediaPanelController {
  constructor({ bridge, getBounds, onVisibility = () => {} }) {
    this.bridge = bridge;
    this.getBounds = getBounds;
    this.onVisibility = onVisibility;
    this.active = false;
    this.generation = 0;
  }

  async open(action) {
    const generation = ++this.generation;
    this.active = true;
    this.onVisibility(true);
    const result = await this.bridge.openMirrorMedia({ ...action, bounds: this.getBounds() });
    if (generation !== this.generation) return { handled: true, cancelled: true };
    // Sign-in and loading errors stay visible so the user can resolve them.
    return { handled: true, ...result };
  }

  close() {
    this.generation += 1;
    this.active = false;
    this.onVisibility(false);
    return this.bridge?.hideMirrorMedia?.();
  }

  resize() {
    if (this.active) return this.bridge?.resizeMirrorMedia?.(this.getBounds());
  }
}

export function assistantDisplayMode(requestedMode, mediaActive) {
  if (requestedMode === 'ar') return 'ar';
  if (requestedMode === 'watch' || mediaActive) return 'watch';
  return 'portal';
}
