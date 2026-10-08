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
    const savedCity = localStorage.getItem('mirror.weather-city');
    this.city = CITIES[savedCity] ? savedCity : CITIES[city] ? city : 'San Francisco';
    this.units = units;
    this.weatherEpoch = 0; this.weatherAt = 0; this.weatherFor = ''; this.weatherFailed = false;
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
    this.weatherTimer = setInterval(() => { void this.fetchWeather(); }, 15 * 60 * 1000);
    this.ageTimer = setInterval(() => this.updateWeatherAge(), 60000);
    this.onResume = () => { if (!document.hidden && Date.now() - this.weatherAt > 5 * 60 * 1000) void this.fetchWeather(); };
    document.addEventListener('visibilitychange', this.onResume);
    window.mirrorBridge?.onSystemResume?.(this.onResume);
    window.addEventListener('beforeunload', () => { this.weatherController?.abort(); clearInterval(this.weatherTimer); clearInterval(this.ageTimer); clearInterval(this.clockTimer); clearInterval(this.quoteTimer); });
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
        <section class="glass-widget"><label>NOW</label><div class="now-card" id="now-card"></div><p class="weather-advice" id="weather-advice">Reading the next few hours…</p><small class="weather-age" id="weather-age"></small></section>
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
    localStorage.setItem('mirror.weather-city', city);
    return this.fetchWeather();
  }

  updateWeatherAge() {
    const node = this.container.querySelector('#weather-age');
    if (!node) return;
    node.textContent = this.weatherAt && this.weatherFor === this.city
      ? `${this.weatherFailed || Date.now() - this.weatherAt > 30 * 60000 ? 'Forecast may be stale · ' : ''}Updated ${Math.max(0, Math.floor((Date.now() - this.weatherAt) / 60000))} min ago · ${this.city}`
      : 'Forecast unavailable';
  }

  async fetchWeather() {
    const epoch = ++this.weatherEpoch, city = this.city;
    this.weatherController?.abort(); const controller = new AbortController(); this.weatherController = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    const cityNode = this.container.querySelector('#weather-city');
    cityNode.textContent = this.city.toUpperCase();
    if (this.weatherFor !== city) { this.container.querySelector('#weather-temp').textContent = '--°'; this.container.querySelector('#weather-advice').textContent = 'Reading the next few hours…'; }
    const { lat, lon } = CITIES[this.city];
    try {
      const temperatureUnit = this.units === 'metric' ? 'celsius' : 'fahrenheit';
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=apparent_temperature,precipitation_probability&forecast_days=2&timeformat=unixtime&temperature_unit=${temperatureUnit}&timezone=auto`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Weather ${response.status}`);
      const data = await response.json();
      if (epoch !== this.weatherEpoch) return;
      if (!Number.isFinite(data.current?.temperature_2m) || !Number.isFinite(data.current?.weather_code)) throw new Error('Weather data is unavailable');
      const info = WEATHER[data.current?.weather_code] || ['UNSETTLED', '◔'];
      this.container.querySelector('#weather-temp').textContent = `${Math.round(data.current?.temperature_2m)}°`;
      this.container.querySelector('#weather-condition').textContent = info[0];
      this.container.querySelector('#weather-icon').textContent = info[1];
      const times = data.hourly?.time, temps = data.hourly?.apparent_temperature, rain = data.hourly?.precipitation_probability;
      const now = Date.now() / 1000;
      const next = Array.isArray(times) ? times.map((time, index) => ({ time, temp: temps?.[index], rain: rain?.[index] })).filter(row => Number.isFinite(row.time) && row.time >= now - 3600 && row.time <= now + 3 * 3600 && Number.isFinite(row.temp) && Number.isFinite(row.rain) && row.rain >= 0 && row.rain <= 100) : [];
      const advice = this.container.querySelector('#weather-advice');
      if (next.length) {
        const coldest = Math.min(...next.map(row => row.temp)), chance = Math.max(...next.map(row => row.rain));
        advice.textContent = `Next few hours · feels like ${Math.round(coldest)}° · ${Math.round(chance)}% rain chance. ${chance >= 45 ? 'Consider an umbrella.' : coldest < (this.units === 'metric' ? 16 : 61) ? 'A light layer may help.' : 'A good time to choose your look.'}`;
      } else advice.textContent = 'Current weather available · hourly forecast unavailable.';
      this.weatherAt = Date.now(); this.weatherFor = city; this.weatherFailed = false; this.updateWeatherAge();
    } catch (error) {
      if (epoch !== this.weatherEpoch) return;
      this.weatherFailed = true;
      this.container.querySelector('#weather-condition').textContent = 'WEATHER OFFLINE';
      if (this.weatherFor !== city) this.container.querySelector('#weather-advice').textContent = 'Forecast unavailable. Your local wardrobe is ready.';
      this.updateWeatherAge();
      console.warn('[weather]', error.message);
    } finally { clearTimeout(timeout); }
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
