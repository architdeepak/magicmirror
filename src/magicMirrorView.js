const CITIES = {
  'San Francisco': { lat: 37.7749, lon: -122.4194 },
  'New York': { lat: 40.7128, lon: -74.006 },
  London: { lat: 51.5074, lon: -0.1278 },
  Tokyo: { lat: 35.6762, lon: 139.6503 },
  Paris: { lat: 48.8566, lon: 2.3522 }
};

const WEATHER = {
  0: ['CLEAR', '☼'], 1: ['MOSTLY CLEAR', '◔'], 2: ['PARTLY CLOUDY', '◒'], 3: ['OVERCAST', '●'],
  45: ['MIST', '≋'], 48: ['FROSTED MIST', '≋'], 51: ['DRIZZLE', '⌇'], 61: ['LIGHT RAIN', '☂'],
  63: ['RAIN', '☂'], 65: ['HEAVY RAIN', '☂'], 71: ['SNOW', '✣'], 80: ['SHOWERS', '☂'], 95: ['THUNDER', 'ϟ']
};

export class MagicMirrorView {
  constructor(container, { city = 'San Francisco', units = 'imperial' } = {}) {
    this.container = container;
    this.city = CITIES[city] ? city : 'San Francisco';
    this.units = units;
    this.quotes = [
      'Clarity begins where certainty ends.',
      'The future enters quietly, disguised as an ordinary morning.',
      'What you seek is also moving toward you.',
      'A mirror reflects the face; stillness reveals the person.'
    ];
    this._render();
    this._startClock();
    this.fetchWeather();
    this.refreshNow();
  }

  _render() {
    this.container.innerHTML = `
      <div class="mirror-clock">
        <div class="clock-time" id="clock-time"><span class="clock-value">00:00</span><small class="clock-period"></small></div>
        <div class="clock-date" id="clock-date">—</div>
      </div>
      <div class="mirror-weather">
        <div class="weather-icon" id="weather-icon">◔</div>
        <div><strong id="weather-temp">--°</strong><span id="weather-condition">READING THE SKY</span><small id="weather-city">${this.city}</small></div>
      </div>
      <div class="mirror-center">
        <div class="celestial-dial"><i></i><i></i><i></i><b>✦</b></div>
        <p id="mirror-greeting">Good evening</p>
        <span>Step closer. The mirror is awake.</span>
      </div>
      <div class="mirror-lower">
        <section class="glass-widget"><label>NOW</label><div class="now-card" id="now-card"></div></section>
        <section class="glass-widget quote-widget"><label>FROM THE GLASS</label><p id="mirror-quote">“${this.quotes[0]}”</p></section>
      </div>`;
  }

  refreshNow() {
    const card = this.container.querySelector('#now-card');
    if (!card) return;
    const note = localStorage.getItem('mirror.quick-note')?.trim();
    if (note) {
      card.innerHTML = `<span class="now-kicker">YOUR NOTE</span><p>${escapeHtml(note)}</p><small>Saved on this mirror</small>`;
      return;
    }
    card.innerHTML = '<span class="now-kicker">YOUR DAY</span><p>Your private services are one touch away.</p><small>Open Command Center for Calendar, Maps, and Find My.</small>';
  }

  _startClock() {
    const update = () => {
      const now = new Date();
      const parts = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).formatToParts(now);
      this.container.querySelector('.clock-value').textContent = parts.filter(part => part.type !== 'dayPeriod').map(part => part.value).join('').trim();
      this.container.querySelector('.clock-period').textContent = parts.find(part => part.type === 'dayPeriod')?.value || '';
      this.container.querySelector('#clock-time').setAttribute('aria-label', now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      this.container.querySelector('#clock-date').textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
      const hour = now.getHours();
      this.container.querySelector('#mirror-greeting').textContent = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    };
    update();
    this.clockTimer = setInterval(update, 1000);
    this.quoteTimer = setInterval(() => {
      const index = Math.floor(Date.now() / 20000) % this.quotes.length;
      this.container.querySelector('#mirror-quote').textContent = `“${this.quotes[index]}”`;
    }, 20000);
  }

  async setCity(city) {
    if (!CITIES[city]) return;
    this.city = city;
    return this.fetchWeather();
  }

  async fetchWeather() {
    const cityNode = this.container.querySelector('#weather-city');
    cityNode.textContent = this.city.toUpperCase();
    const { lat, lon } = CITIES[this.city];
    try {
      const temperatureUnit = this.units === 'metric' ? 'celsius' : 'fahrenheit';
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=${temperatureUnit}&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Weather ${response.status}`);
      const data = await response.json();
      const info = WEATHER[data.current?.weather_code] || ['UNSETTLED', '◔'];
      this.container.querySelector('#weather-temp').textContent = `${Math.round(data.current?.temperature_2m)}°`;
      this.container.querySelector('#weather-condition').textContent = info[0];
      this.container.querySelector('#weather-icon').textContent = info[1];
    } catch (error) {
      this.container.querySelector('#weather-condition').textContent = 'WEATHER OFFLINE';
      console.warn('[weather]', error.message);
    }
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
