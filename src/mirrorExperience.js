import { LocalTimers, parseMinutes } from './localTimers.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export class MirrorExperience {
  constructor(adapter) {
    this.a = adapter; this.epoch = 0; this.looks = []; this.selected = new Set(); this.draft = null; this.capturing = false; this.saving = false; this.routineActive = false;
    this.dialog = document.createElement('dialog'); this.dialog.id = 'lookbook';
    this.dialog.innerHTML = `<header><div><small>YOUR PRIVATE LOOKBOOK</small><h2>A little wardrobe magic.</h2></div><button type="button" data-look-action="close" aria-label="Close lookbook">✕</button></header><div class="lookbook-voice"><button type="button" data-look-action="listen">Listen</button><button type="button" data-look-action="stop">Stop</button><button type="button" data-look-action="mute">Mute</button></div><p>Keep a look, choose two to compare, or swipe through your saved photos.</p><div class="look-draft" hidden><img alt="Review your captured look"><div><button type="button" data-look-action="save">Save this look</button><button type="button" data-look-action="retake">Retake</button><button type="button" data-look-action="discard">Discard</button></div></div><div class="lookbook-actions"><button type="button" data-look-action="capture">Take look photo</button><button type="button" data-look-action="compare">Compare selected</button><button type="button" data-look-action="view">View selected</button><button type="button" data-look-action="filter" aria-pressed="false">Favorites</button><button type="button" data-look-action="all">All looks</button></div><div class="look-comparison" hidden></div><div class="look-grid"></div><p class="look-status" role="status"></p>`;
    document.body.append(this.dialog);
    this.captionHost = document.createElement('div'); this.captionHost.className = 'lookbook-captions'; this.dialog.append(this.captionHost);
    this.dialog.addEventListener('click', event => {
      const control = event.target.closest('[data-look-action]'); if (!control) return;
      void this.action(control.dataset.lookAction, control.dataset.lookId).catch(error => this.notice(error.message));
    });
    this.dialog.addEventListener('close', () => { this.cancel(); this.restoreCaptions(); });
    this.dialog.addEventListener('cancel', event => { if (this.saving) event.preventDefault(); });
    this.timers = new LocalTimers(localStorage, item => { this.a.notice(`${item.label} · time is up`); });
    this.tickTimer = setInterval(() => this.tick(), 1000); this.tick();
    this.a.bridge?.onSystemResume?.(() => this.tick());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.tick(); });
    for (const button of document.querySelectorAll('[data-experience-action]')) button.addEventListener('click', () => {
      const actions = { capture: () => this.capture(), lookbook: () => this.open(), ready: () => this.routine('ready'), movie: () => this.routine('movie'), help: () => this.help() };
      void Promise.resolve(actions[button.dataset.experienceAction]?.()).catch(error => this.notice(error.message));
    });
    document.querySelector('#local-timer-form').addEventListener('submit', event => { event.preventDefault(); try { this.addTimer(Number(document.querySelector('#local-timer-minutes').value)); } catch (error) { this.notice(error.message); } });
    document.querySelector('#timer-dismiss').addEventListener('click', () => { this.timers.clear(false, document.querySelector('#local-timer-badge').dataset.timer); this.tick(); });
  }
  notice(message) { this.dialog.querySelector('.look-status').textContent = message; this.a.notice(message); }
  restoreCaptions() {
    if (this.captionHome) { this.captionHome.parent.insertBefore(document.querySelector('#live-captions'), this.captionHome.next?.parentNode === this.captionHome.parent ? this.captionHome.next : null); this.captionHome = null; }
  }
  async open() {
    if (!this.a.bridge?.listLooks) { this.notice('Open the mirror app to save and browse your looks.'); return; }
    if (this.a.editorOpen()) { this.notice('Close the garment photo editor before opening your lookbook.'); return; }
    if (!this.dialog.open) {
      this.dialog.showModal(); const captions = document.querySelector('#live-captions');
      if (captions) { this.captionHome = { parent: captions.parentNode, next: captions.nextSibling }; this.captionHost.append(captions); }
    }
    this.syncVoice();
    try { this.looks = await this.a.bridge.listLooks(); this.render(); } catch (error) { this.notice(error.message); }
  }
  syncVoice() {
    this.dialog.querySelector('[data-look-action=listen]').disabled = this.a.context().muted;
    this.dialog.querySelector('[data-look-action=mute]').textContent = this.a.context().muted ? 'Unmute' : 'Mute';
  }
  cancel() {
    this.captureCamera?.abort(); this.captureCamera = null;
    this.epoch++; this.capturing = false; this.routineActive = false; this.a.shell.dataset.capturing = 'false';
    const countdown = document.querySelector('#look-countdown'); countdown.hidden = true;
    void this.a.bridge?.cancelLook?.()?.catch(() => {});
  }
  async capture() {
    if (!this.a.bridge?.saveLook) { this.notice('Look photos can be saved in the mirror app.'); return; }
    if (this.capturing || this.saving) { this.notice('Finish the current photo first.'); return; }
    if (this.a.editorOpen()) { this.notice('Close the garment editor before taking a look photo.'); return; }
    if (this.dialog.open) this.dialog.close();
    const epoch = ++this.epoch;
    const controller = this.captureCamera = new AbortController();
    let abort;
    const stopped = new Promise(resolve => { abort = () => resolve(); controller.signal.addEventListener('abort', abort, { once: true }); });
    this.capturing = true;
    const counter = document.querySelector('#look-countdown'); counter.hidden = false;
    counter.querySelector('strong').textContent = '✧'; counter.querySelector('p').textContent = 'Preparing your camera…';
    this.a.shell.dataset.capturing = 'true';
    try {
      await Promise.race([this.a.prepareCapture(controller.signal), stopped]); if (epoch !== this.epoch || controller.signal.aborted) return;
      const snapshot = this.a.captureContext();
      counter.querySelector('p').textContent = 'Hold your pose. A little magic in three…';
      for (const number of [3, 2, 1]) {
        if (epoch !== this.epoch) return;
        counter.querySelector('strong').textContent = String(number);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (epoch !== this.epoch) return;
      this.draft = this.a.captureLook(snapshot); this.a.magic.play('capture', { muted: this.a.context().muted });
      this.capturing = false; this.a.shell.dataset.capturing = 'false'; counter.hidden = true;
      await this.open(); this.notice('Your look is ready. Save it, retake, or discard.');
    } catch (error) { if (epoch === this.epoch) this.notice(error.message); }
    finally { controller.signal.removeEventListener('abort', abort); if (this.captureCamera === controller) this.captureCamera = null; if (epoch === this.epoch) { this.capturing = false; this.a.shell.dataset.capturing = 'false'; document.querySelector('#look-countdown').hidden = true; } }
  }
  async saveDraft() {
    if (!this.draft || this.saving) return;
    const epoch = this.epoch, draft = this.draft; this.saving = true; this.render();
    try {
      const item = await this.a.bridge.saveLook({ ...draft, requestId: crypto.randomUUID() });
      if (epoch !== this.epoch) return;
      this.draft = null; this.looks = await this.a.bridge.listLooks(); this.selected = new Set([item.id]); this.render(); this.notice('Saved on this mirror.');
    } catch (error) { if (epoch === this.epoch) this.notice(error.message); }
    finally { this.saving = false; this.render(); }
  }
  async action(action, id) {
    if (['close', 'retake', 'discard', 'capture'].includes(action) && this.saving) { this.notice('Saving this look…'); return; }
    if (action === 'close') this.dialog.close();
    else if (action === 'listen') document.querySelector('#mic-btn').click();
    else if (action === 'mute') { document.querySelector('#mute-btn').click(); queueMicrotask(() => this.syncVoice()); }
    else if (action === 'stop') this.a.stop();
    else if (action === 'capture' || action === 'retake') { this.draft = null; await this.capture(); }
    else if (action === 'save') await this.saveDraft();
    else if (action === 'discard') { this.draft = null; this.render(); }
    else if (action === 'filter' || action === 'all') { this.favoritesOnly = action === 'filter' ? !this.favoritesOnly : false; this.viewing = false; this.comparing = false; this.dialog.dataset.viewing = 'false'; this.dialog.querySelector('.look-comparison').hidden = true; this.render(); }
    else if (action === 'select') {
      if (this.selected.has(id)) this.selected.delete(id); else { if (this.selected.size >= 2) this.selected.delete(this.selected.values().next().value); this.selected.add(id); }
      this.render();
    } else if (action === 'compare') this.compare();
    else if (action === 'view') { this.focusId = [...this.selected].at(-1); this.viewIds = [...this.selected]; this.viewSelected(); }
    else if (action === 'favorite' || action === 'delete') {
      this.looks = await this.a.bridge.updateLook({ id, action }); if (action === 'delete') this.selected.delete(id); this.render();
    }
  }
  render() {
    const draft = this.dialog.querySelector('.look-draft'); draft.hidden = !this.draft;
    if (this.draft) draft.querySelector('img').src = this.draft.imageDataUrl;
    draft.querySelector('[data-look-action=save]').disabled = this.saving;
    this.dialog.querySelector('[data-look-action=filter]').setAttribute('aria-pressed', String(Boolean(this.favoritesOnly)));
    const items = this.favoritesOnly ? this.looks.filter(item => item.favorite) : this.looks;
    this.dialog.querySelector('.look-grid').innerHTML = items.length ? items.slice().reverse().map(item => `<article class="look-card"><button type="button" data-look-action="select" data-look-id="${escape(item.id)}" aria-pressed="${this.selected.has(item.id)}"><img src="${escape(item.imageUrl)}" alt="${escape(item.name)}"><b>${escape(item.garment || item.name)}</b><small>${escape(new Date(item.createdAt).toLocaleString())}</small></button><div><button type="button" data-look-action="favorite" data-look-id="${escape(item.id)}" aria-pressed="${item.favorite}">${item.favorite ? '★ Favorite' : '☆ Favorite'}</button><button type="button" data-look-action="delete" data-look-id="${escape(item.id)}">Delete</button></div></article>`).join('') : '<p class="look-empty">Your next favorite look begins here. Take a photo to start.</p>';
    if (this.viewing) this.viewSelected(false); else if (this.comparing) this.compare(false);
  }
  compare(announce = true) {
    this.viewing = false; this.dialog.dataset.viewing = 'false';
    const items = [...this.selected].map(id => this.looks.find(item => item.id === id)).filter(Boolean);
    const stage = this.dialog.querySelector('.look-comparison');
    if (items.length !== 2) { stage.hidden = true; this.comparing = false; if (announce) this.notice('Choose two saved photos to compare.'); return; }
    this.comparing = true; stage.hidden = false;
    stage.dataset.single = 'false';
    stage.innerHTML = items.map((item, i) => `<figure><img src="${escape(item.imageUrl)}" alt="Look ${i ? 'B' : 'A'}: ${escape(item.garment)}"><figcaption>${i ? 'B' : 'A'} · ${escape(item.garment)}</figcaption></figure>`).join('');
    if (announce) stage.scrollIntoView({ block: 'nearest', behavior: this.a.magic.reduced ? 'auto' : 'smooth' });
  }
  viewSelected(announce = true) {
    const item = this.looks.find(item => item.id === this.focusId);
    if (!item) { if (announce) this.notice('Choose a saved photo to view.'); this.viewing = false; this.dialog.dataset.viewing = 'false'; this.dialog.querySelector('.look-comparison').hidden = true; return; }
    this.viewing = true; this.comparing = false; this.dialog.dataset.viewing = 'true';
    const stage = this.dialog.querySelector('.look-comparison'); stage.hidden = false; stage.dataset.single = 'true';
    stage.innerHTML = `<figure><img src="${escape(item.imageUrl)}" alt="${escape(item.garment)}"><figcaption>${escape(item.garment)} · swipe to see the next look</figcaption></figure>`;
    if (announce) stage.scrollIntoView({ block: 'nearest', behavior: this.a.magic.reduced ? 'auto' : 'smooth' });
  }
  gesture(type) {
    if (!this.dialog.open) return false;
    if (type === 'palm') { this.a.stop(); return true; }
    if (type === 'pinch') { void (this.draft ? this.saveDraft() : this.capture()); return true; }
    if (['swipe-left', 'swipe-right'].includes(type)) {
      if (this.comparing || this.viewing) {
        const ids = this.viewing ? this.viewIds : [...this.selected];
        if (ids?.length) { const current = ids.indexOf(this.focusId), index = ((current < 0 ? 0 : current) + (type === 'swipe-left' ? 1 : -1) + ids.length) % ids.length; this.viewIds = ids; this.focusId = ids[index]; this.viewSelected(); }
        return true;
      }
      const items = (this.favoritesOnly ? this.looks.filter(item => item.favorite) : this.looks).slice().reverse();
      if (items.length) { const current = items.findIndex(item => item.id === [...this.selected].at(-1)), next = items[(Math.max(0, current) + (type === 'swipe-left' ? 1 : -1) + items.length) % items.length]; this.selected = new Set([next.id]); this.render(); this.dialog.querySelector(`[data-look-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' }); }
      return true;
    }
    if (['swipe-up', 'swipe-down'].includes(type)) { this.dialog.scrollBy({ top: type === 'swipe-up' ? 220 : -220, behavior: this.a.magic.reduced ? 'auto' : 'smooth' }); return true; }
    return false;
  }
  addTimer(minutes, label = 'Getting ready') { this.timers.add(minutes, label); this.tick(); this.a.notice(`${label} · ${minutes} minute timer started`); }
  tick() {
    const items = this.timers.tick(), item = items.find(item => item.state === 'done') || items.slice().sort((a,b) => a.deadline - b.deadline)[0], badge = document.querySelector('#local-timer-badge');
    badge.hidden = !item;
    if (item) { badge.dataset.timer = item.id; const label = `${item.label} · ${item.state === 'done' ? 'Time is up' : `${Math.floor(item.seconds / 60)}:${String(item.seconds % 60).padStart(2, '0')}`}${items.length > 1 ? ` · ${items.length} timers` : ''}`; if (badge.querySelector('span').textContent !== label) badge.querySelector('span').textContent = label; }
  }
  help() {
    const mode = this.a.context().mode;
    const text = this.dialog.open ? 'Choose two photos to compare. Pinch saves the reviewed photo; swipe browses. Say “compare looks”, “save this look”, or “close lookbook”.'
      : mode === 'ar' ? 'Say “try on my jacket”, “favorite this”, or “take a look photo”. Swipe for garments, pinch for effects. Hold a palm to stop voice. Use the framing guide to center yourself.'
      : mode === 'watch' ? 'Paste a video link or connect your phone. Pinch plays/pauses; swipe seeks. Say “movie time” or “return to mirror”.'
      : mode === 'spotify' ? 'Start music in Spotify on this PC. Pinch plays/pauses; swipe changes tracks. Choose classic or pocket player.'
      : 'Say “getting ready”, “show my lookbook”, “leave a note”, or “set a ten-minute timer”. Say “mirror stop” to stop voice, or use hard mute.';
    this.a.help(text); return text;
  }
  async routine(kind) {
    if (this.a.editorOpen()) { this.notice('Finish the photo editor before starting a routine.'); return; }
    if (this.dialog.open) this.dialog.close(); this.cancel(); const epoch = this.epoch; this.routineActive = true;
    const current = () => { if (epoch !== this.epoch) throw new Error('Routine stopped.'); };
    try {
      if (kind === 'ready') {
        this.a.mode('ar'); current(); this.a.clarity(localStorage.getItem('mirror.routine.clarity') || 'natural');
        const savedId = localStorage.getItem('mirror.routine.garment');
        const garment = this.a.closet.items.find(item => item.id === savedId) || this.a.closet.items.find(item => this.a.closet.favorites.has(item.id)) || this.a.closet.items.find(item => item.id === 'starter-t-shirt-blue');
        if (garment) this.a.closet.select(garment.id);
        await this.a.ensureCamera(); current();
        this.a.magic.play('selection', { muted: this.a.context().muted });
        let status = await this.a.bridge.spotifyCurrent().catch(() => null); current();
        if (localStorage.getItem('mirror.routine.music') === 'true' && status?.connected && !status.isPlaying && status.canResume !== false) {
          await this.a.bridge.spotifyControl('play').catch(() => {}); current();
          status = await this.a.bridge.spotifyCurrent().catch(() => null); current();
        }
        this.a.notice(status?.isPlaying ? 'Ready for your entrance · music is playing in Spotify' : 'Ready for your entrance · start Spotify when you want music');
      } else {
        this.a.mode('watch'); current();
        await this.a.bridge.openService(localStorage.getItem('mirror.routine.movie') === 'netflix' ? 'netflix' : 'youtube'); current();
        this.a.notice('Your private screen is ready · choose something to watch');
      }
    } catch (error) { if (epoch === this.epoch) this.notice(error.message); }
    finally { if (epoch === this.epoch) this.routineActive = false; }
  }
  voice(command) {
    const text = command.trim().replace(/^(?:mirror[, ]+)?/i, '').replace(/^please\s+/i, '').replace(/[.!?]+$/, ''), lower = text.toLowerCase();
    if (/^(?:take|capture|save) (?:a |this )?(?:look|outfit) photo$|^take a look$/.test(lower)) { void this.capture(); return true; }
    if (/^(?:show|open) (?:my |the )?lookbook$/.test(lower)) { void this.open(); return true; }
    if (/^compare (?:my |the )?(?:looks|outfits)$/.test(lower)) { void this.open().then(() => { if (this.selected.size < 2) this.selected = new Set(this.looks.slice(-2).map(item => item.id)); this.compare(); }); return true; }
    if (this.dialog.open && /^save (?:this |my )?look$/.test(lower)) { void this.saveDraft(); return true; }
    if (this.dialog.open && /^(?:favorite|favourite) (?:this|it|this look)$/.test(lower)) {
      const id = this.focusId || [...this.selected].at(-1);
      if (this.draft || !id) this.notice('Save and select a look before favoriting it.');
      else { const item = this.looks.find(item => item.id === id); if (!item?.favorite) void this.action('favorite', id).catch(error => this.notice(error.message)); }
      return true;
    }
    if (this.dialog.open && /^(?:next|previous) (?:look|photo)$/.test(lower)) { this.gesture(lower.startsWith('next') ? 'swipe-left' : 'swipe-right'); return true; }
    if (this.dialog.open && /^(?:show|open) (?:my )?(?:favorites|favourites)$/.test(lower)) { this.favoritesOnly = true; this.viewing = false; this.comparing = false; this.dialog.dataset.viewing = 'false'; this.dialog.querySelector('.look-comparison').hidden = true; this.render(); return true; }
    if (this.dialog.open && /^show look [ab]$/.test(lower)) { this.viewIds = [...this.selected]; this.focusId = this.viewIds[lower.endsWith('a') ? 0 : 1]; this.viewSelected(); return true; }
    if (this.dialog.open && /^show (?:all|favorite|favourite) looks$/.test(lower)) { this.favoritesOnly = !lower.includes('all'); this.viewing = false; this.comparing = false; this.dialog.dataset.viewing = 'false'; this.dialog.querySelector('.look-comparison').hidden = true; this.render(); return true; }
    if (this.dialog.open && /^(?:retake|retake photo)$/.test(lower)) { void this.action('retake'); return true; }
    if (this.dialog.open && /^(?:close lookbook|discard photo)$/.test(lower)) { void this.action(lower.startsWith('close') ? 'close' : 'discard'); return true; }
    if (/^(?:start |i'm |i am )?getting ready$|^dressing room$/.test(lower)) { void this.routine('ready'); return true; }
    if (/^(?:start )?movie time$/.test(lower)) { void this.routine('movie'); return true; }
    if (/^(?:what can (?:i|you) do(?: here)?|help me|show help)$/.test(lower)) { this.help(); return true; }
    if (/^(?:remember|save) (?:this |my )?getting ready setup$/.test(lower)) {
      if (this.a.closet.selectedId) localStorage.setItem('mirror.routine.garment', this.a.closet.selectedId);
      localStorage.setItem('mirror.routine.clarity', this.a.captureContext().clarity || 'natural'); this.a.notice('Getting ready setup saved'); return true;
    }
    const note = text.match(/^(?:leave|save) (?:a )?note[: ]+(.+)$/i);
    if (note) { this.a.note(note[1].trim().slice(0, 140)); return true; }
    if (/^clear (?:my |the )?note$/.test(lower)) { this.a.note(''); return true; }
    if (/^(?:cancel|clear) (?:all )?timers?$/.test(lower)) { this.timers.clear(/all/.test(lower)); this.tick(); this.a.notice('Timer cleared'); return true; }
    if (/^(?:set|start|give me)\b.*\btimer\b|^timer\b|^(?:leaving|leave) in\b|^(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|sixty)[ -].*\btimer\b/.test(lower)) {
      const minutes = parseMinutes(lower);
      if (minutes === null) { this.a.notice('Say “set a timer for ten minutes”, from 1 minute to 6 hours.'); return true; }
      try { this.addTimer(minutes, /leav/.test(lower) ? 'Leaving' : 'Getting ready'); } catch (error) { this.notice(error.message); } return true;
    }
    return false;
  }
}
