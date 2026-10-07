export class SpotifyDevices {
  constructor({ select, use, refresh, status, bridge, onTransfer = () => {} }) {
    Object.assign(this, { select, use, refreshButton: refresh, status, bridge, onTransfer });
    this.generation = 0; this.devices = []; this.busy = false;
    select.addEventListener('change', () => this.updateControls());
    refresh.addEventListener('click', () => { void this.refresh(); });
    use.addEventListener('click', () => { void this.transfer(); });
    this.clear();
  }
  clear() {
    this.generation++; this.devices = []; this.busy = false;
    this.select.replaceChildren(); this.select.disabled = true; this.use.disabled = true;
    this.refreshButton.disabled = true;
    this.status.textContent = 'Connect Spotify to choose a playback device.';
  }
  updateControls() {
    const selected = this.devices.find(device => device.id === this.select.value);
    this.use.disabled = this.busy || !selected || selected.restricted;
    this.select.disabled = this.busy || !this.devices.length;
    this.refreshButton.disabled = this.busy;
  }
  async refresh() {
    if (this.busy || !this.bridge?.spotifyDevices) return;
    const generation = ++this.generation; this.busy = true; this.updateControls();
    this.status.textContent = 'Finding Spotify devices…';
    try {
      const devices = await this.bridge.spotifyDevices();
      if (generation !== this.generation) return;
      const previous = this.select.value;
      this.devices = devices;
      this.select.replaceChildren(...devices.map(device => {
        const option = document.createElement('option'); option.value = device.id;
        option.textContent = `${device.name}${device.active ? ' · active' : ''}${device.restricted ? ' · unavailable for control' : ''}`;
        option.disabled = device.restricted; return option;
      }));
      this.select.value = devices.find(device => device.id === previous && !device.restricted)?.id
        || devices.find(device => device.active && !device.restricted)?.id || devices.find(device => !device.restricted)?.id || '';
      this.status.textContent = devices.length ? 'Choose the PC/TV to move playback there. Playing or paused state is preserved.' : 'No devices found. Open Spotify on the PC/TV, then Refresh.';
    } catch (error) {
      if (generation !== this.generation) return;
      this.devices = []; this.select.replaceChildren(); this.status.textContent = error.message;
    } finally { if (generation === this.generation) { this.busy = false; this.updateControls(); } }
  }
  async transfer() {
    const device = this.devices.find(candidate => candidate.id === this.select.value);
    if (this.busy || !device || device.restricted) return;
    const generation = ++this.generation; this.busy = true; this.updateControls();
    this.status.textContent = `Switching to ${device.name}…`;
    try {
      const result = await this.bridge.spotifyControl({ action: 'transfer', deviceId: device.id });
      if (generation !== this.generation) return;
      this.status.textContent = result.confirmed ? `Playback device: ${device.name}` : 'Switch requested. Check the playback device shown above; Spotify may take a moment.';
      await this.onTransfer();
    } catch (error) { if (generation === this.generation) this.status.textContent = error.message; }
    finally { if (generation === this.generation) { this.busy = false; this.updateControls(); } }
  }
}
