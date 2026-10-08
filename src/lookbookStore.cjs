const fs = require('fs/promises'), path = require('path'), crypto = require('crypto');
const { pathToFileURL } = require('url');
const { wardrobePhotoBytes } = require('./wardrobePhotoValidation.cjs');
const validId = id => /^look-[a-f0-9-]{36}$/.test(id || '');
class LookbookStore {
  constructor(directory, decode) { this.directory = directory; this.decode = decode; this.queue = Promise.resolve(); }
  async read() {
    try {
      const data = JSON.parse(await fs.readFile(path.join(this.directory, 'index.json'), 'utf8'));
      if (!Array.isArray(data.looks)) throw new Error('Invalid lookbook index');
      return data.looks.filter(item => validId(item.id)).slice(0, 100);
    } catch (error) { if (error.code === 'ENOENT') return []; throw new Error('The local lookbook could not be read.'); }
  }
  public(item) { return { ...item, imageUrl: pathToFileURL(path.join(this.directory, item.id + '.png')).href }; }
  async list() { return (await this.read()).map(item => this.public(item)); }
  mutate(operation) {
    const job = this.queue.then(operation); this.queue = job.catch(() => {}); return job;
  }
  async write(looks) {
    await fs.mkdir(this.directory, { recursive: true });
    const temporary = path.join(this.directory, 'index.tmp');
    await fs.writeFile(temporary, JSON.stringify({ version: 1, looks }, null, 2));
    await fs.rename(temporary, path.join(this.directory, 'index.json'));
  }
  save(input = {}, signal) {
    return this.mutate(async () => {
      signal?.throwIfAborted();
      const looks = await this.read();
      if (looks.length >= 100) throw new Error('Lookbook full. Remove a saved look before taking another.');
      const bytes = this.decode(wardrobePhotoBytes(input.imageDataUrl));
      if (!bytes?.length) throw new Error('The look photo could not be decoded.');
      const text = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      const item = { id: 'look-' + crypto.randomUUID(), name: text(input.name) || 'My look', garment: text(input.garment), createdAt: new Date().toISOString(), favorite: false };
      const file = path.join(this.directory, item.id + '.png');
      await fs.mkdir(this.directory, { recursive: true }); signal?.throwIfAborted();
      try { await fs.writeFile(file, bytes); signal?.throwIfAborted(); await this.write([...looks, item]); }
      catch (error) { await fs.rm(file, { force: true }); throw error; }
      return this.public(item);
    });
  }
  update(id, action) {
    return this.mutate(async () => {
      if (!validId(id)) throw new Error('Choose a saved look.');
      const looks = await this.read(), item = looks.find(item => item.id === id);
      if (!item) throw new Error('That look is no longer saved.');
      if (action === 'favorite') item.favorite = !item.favorite;
      else if (action === 'delete') looks.splice(looks.indexOf(item), 1);
      else throw new Error('Unknown lookbook action.');
      await this.write(looks);
      if (action === 'delete') await fs.rm(path.join(this.directory, id + '.png'), { force: true });
      return looks.map(item => this.public(item));
    });
  }
}
module.exports = { LookbookStore };
