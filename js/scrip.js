// ---- Configuración ----
const Config = {
  API_KEY: "NUFVETJV68ZJGD7M8JGAFLWVT",
  BASE: "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline"
};

// ---- Traducción de iconos de la API a español ----
const Icons = {
  describe(icon = "") {
    const map = [
      ["thunder", "⛈️", "Tormenta eléctrica"], ["snow", "❄️", "Nieve"], ["sleet", "🌨️", "Aguanieve"],
      ["hail", "🌨️", "Granizo"], ["showers", "🌦️", "Chubascos"], ["rain", "🌧️", "Lluvia"],
      ["fog", "🌫️", "Niebla"], ["wind", "💨", "Ventoso"], ["partly-cloudy", "⛅", "Parcialmente nublado"],
      ["cloudy", "☁️", "Nublado"], ["clear-night", "🌙", "Despejado"], ["clear", "☀️", "Soleado"]
    ];
    const hit = map.find(([k]) => icon.includes(k));
    return hit ? { emoji: hit[1], text: hit[2] } : { emoji: "🌡️", text: "Sin datos" };
  }
};

// ---- API ----
const Api = {
  async fetchWeather(location) {
    if (Config.API_KEY === "TU_API_KEY_AQUI") throw new Error("Falta la API key en script.js");
    const url = `${Config.BASE}/${encodeURIComponent(location)}/yesterday/tomorrow` +
      `?unitGroup=metric&include=hours,current&contentType=json&key=${Config.API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      const msgs = { 400: "Ubicación no encontrada o inválida", 401: "API key inválida", 429: "Se superó el límite diario de la API" };
      throw new Error(msgs[res.status] || `Error del servidor (${res.status})`);
    }
    return res.json();
  }
};

// ---- Interfaz ----
const $ = id => document.getElementById(id);
const UI = {
  setStatus(msg, isError = false) {
    $("status").textContent = msg;
    $("status").classList.toggle("error", isError);
  },
  loading(on) {
    $("loader").hidden = !on;
    $("weather").hidden = true;
    ["refresh", "geo"].forEach(id => $(id).disabled = on || (id === "refresh" && !State.last));
    if (on) UI.setStatus("Cargando clima...");
  },
  hourRows(hours) {
    return hours.map(({ day, h }) => {
      const d = Icons.describe(h.icon);
      const [, m, dd] = day.datetime.split("-");
      const rain = h.precipprob == null ? "–" : `${Math.round(h.precipprob)}%`;
      return `<tr><td>${dd}/${m} ${h.datetime.slice(0, 5)}</td><td>${d.emoji} ${d.text}</td>` +
             `<td>${Math.round(h.temp)}°C</td><td>${Math.round(h.windspeed)} km/h</td><td>💧${rain}</td></tr>`;
    }).join("");
  },
  render(data, label) {
    const now = Math.floor(Date.now() / 1000);
    const all = data.days.flatMap(day => day.hours.map(h => ({ day, h })));
    const past = all.filter(x => x.h.datetimeEpoch <= now && x.h.datetimeEpoch > now - 86400);
    const future = all.filter(x => x.h.datetimeEpoch > now && x.h.datetimeEpoch <= now + 86400);

    const cur = data.currentConditions;
    const nearest = all.reduce((a, b) => Math.abs(b.h.datetimeEpoch - now) < Math.abs(a.h.datetimeEpoch - now) ? b : a).h;
    const d = Icons.describe(cur.icon);
    const rain = cur.precipprob ?? nearest.precipprob;

    $("place").textContent = label || data.resolvedAddress;
    $("cIcon").textContent = d.emoji;
    $("cTemp").textContent = `${Math.round(cur.temp)}°C`;
    $("cCond").textContent = d.text;
    $("cWind").textContent = `${Math.round(cur.windspeed)} km/h`;
    $("cRain").textContent = rain == null ? "–" : `${Math.round(rain)}%`;
    $("updated").textContent = `Actualizado: ${new Date().toLocaleTimeString("es-CO")}`;
    $("past").innerHTML = UI.hourRows(past);
    $("future").innerHTML = UI.hourRows(future);
    $("weather").hidden = false;
    UI.setStatus("");
  }
};

// ---- Estado y controlador ----
const State = { last: null }; // { query, label }
const App = {
  async load(query, label) {
    State.last = { query, label };
    UI.loading(true);
    try {
      const data = await Api.fetchWeather(query);
      UI.loading(false);
      UI.render(data, label);
    } catch (err) {
      UI.loading(false);
      UI.setStatus(err.message === "Failed to fetch" ? "No hay conexión con el servicio del clima" : err.message, true);
    }
  },
  useGeolocation() {
    if (!navigator.geolocation) return UI.setStatus("Su navegador no soporta geolocalización", true);
    UI.setStatus("Obteniendo su ubicación...");
    navigator.geolocation.getCurrentPosition(
      p => this.load(`${p.coords.latitude.toFixed(4)},${p.coords.longitude.toFixed(4)}`, "Mi ubicación actual"),
      () => UI.setStatus("No se pudo obtener su ubicación. Escriba una ciudad.", true),
      { timeout: 8000 }
    );
  }
};

// ---- Eventos ----
$("form").addEventListener("submit", e => {
  e.preventDefault();
  const q = $("location").value.trim();
  if (q) App.load(q, "");
});
$("refresh").onclick = () => State.last && App.load(State.last.query, State.last.label);
$("geo").onclick = () => App.useGeolocation();
App.useGeolocation(); // vista por defecto: ubicación actual