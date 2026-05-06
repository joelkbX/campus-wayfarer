/* ─────────────────────────────────────────────────────────
   Campus Wayfarer – Frontend Script
───────────────────────────────────────────────────────── */

const API = "http://localhost:5000";

const UI = {
  start: document.getElementById("start"),
  end: document.getElementById("end"),
  findBtn: document.getElementById("find-btn"),
  resultCard: document.getElementById("result-card"),
  errorCard: document.getElementById("error-card"),
  errorMsg: document.getElementById("error-message"),
  pathList: document.getElementById("path-list"),
  resDist: document.getElementById("result-distance"),
  resTime: document.getElementById("result-time"),
  resStops: document.getElementById("result-stops"),
  loader: document.getElementById("map-loader"),
  statusDot: document.getElementById("status-dot"),
  statusLbl: document.getElementById("status-label"),
  swapBtn: document.getElementById("swap-btn"),
};

// ── Map initialisation ────────────────────────────────────
const map = L.map("map", { center: [13.0842, 77.4849], zoom: 17, zoomControl: false, attributionControl: true });
L.control.zoom({ position: "bottomright" }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
}).addTo(map);

const coordsMap = {};
let routeLine = null, markerFrom = null, markerTo = null;

const makeIcon = color => L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.5);"></div>`,
  className: "", iconSize: [16, 16], iconAnchor: [8, 8]
});
const iconFrom = makeIcon("#10b981");
const iconTo = makeIcon("#ef4444");

const typeColors = {
  "entry/exit_point": "#10b981",
  parking: "#f59e0b", landmark: "#6366f1"
};

async function loadGeoJSON() {
  try {
    const res = await fetch("campus.geojson");
    if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status}`);
    
    L.geoJSON(await res.json(), {
      style: f => ({ color: typeColors[f.properties?.type] ?? "#94a3b8", weight: 2, opacity: 0.85, fillColor: typeColors[f.properties?.type] ?? "#94a3b8", fillOpacity: 0.25 }),
      pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 7, color: "#fff", weight: 1.5, fillColor: typeColors[f.properties?.type] ?? "#94a3b8", fillOpacity: 1 }),
      onEachFeature: (f, layer) => {
        const { name, type } = f.properties ?? {};
        if (f.geometry?.type === "Point") {
          coordsMap[name] = [f.geometry.coordinates[1], f.geometry.coordinates[0]];
        }
        if (name) {
          const tL = type ? type.replace(/_/g, " ") : "location";
          const safeName = name.replace(/'/g, "\\'");
          layer.bindPopup(`
            <div class="popup-title">${name}</div><div class="popup-type">${tL}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
              <button class="popup-btn" onclick="setDropdown('start','${safeName}')">Set as Start</button>
              <button class="popup-btn" onclick="setDropdown('end','${safeName}')">Set Destination</button>
            </div>
          `);
        }
      }
    }).addTo(map);
  } catch (err) {
    console.error("GeoJSON load error:", err);
    showError("Could not load campus map data. Please refresh.");
  } finally {
    UI.loader?.classList.add("hidden");
  }
}

async function loadLocations() {
  try {
    const res = await fetch(`${API}/locations`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    
    (await res.json()).sort().forEach(loc => {
      UI.start.add(new Option(loc, loc));
      UI.end.add(new Option(loc, loc));
    });
    setServerStatus(true);
  } catch (err) {
    console.warn("Backend offline:", err.message);
    setServerStatus(false);
    showError("Backend server is offline. Start the server with: cd backend && node server.js");
  }
}

async function findRoute() {
  const { value: startVal } = UI.start, { value: endVal } = UI.end;
  UI.errorCard.classList.add("hidden");
  UI.resultCard.classList.add("hidden");

  if (!startVal || !endVal) return showError("Please select both a starting point and a destination.");
  if (startVal === endVal) return showError("Starting point and destination are the same location.");

  setFindBtnLoading(true);
  try {
    const res = await fetch(`${API}/route`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: startVal, end: endVal }), signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();

    if (!data.path?.length) return showError("No route found between these locations.");
    if (data.distance === Infinity || data.distance == null) return showError("These locations are not reachable from each other.");

    renderResult(data.path, data.distance, data.walkingMins);
    drawRoute(data.path);
    const latlngs = data.path.map(resolveCoord).filter(Boolean);
    if (latlngs.length) map.fitBounds(L.latLngBounds(latlngs), { padding: [60, 60], maxZoom: 18 });
  } catch (err) {
    console.error("Route error:", err);
    showError(err.name === "TimeoutError" ? "Request timed out. Is backend running?" : "Failed to get route.");
  } finally {
    setFindBtnLoading(false);
  }
}

// Ensure findRoute is available globally for the HTML button
window.findRoute = findRoute;

function resolveCoord(node) {
  if (coordsMap[node]) return coordsMap[node];
  if (node.includes(",")) {
    const [lat, lng] = node.split(",").map(Number);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  }
  return null;
}

function renderResult(path, distance, walkingMins) {
  UI.resDist.textContent = distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${distance} m`;
  if (UI.resTime) UI.resTime.textContent = walkingMins != null ? `~${walkingMins} min` : "—";
  
  // Only show named locations in the textual list (skip coordinate nodes)
  const namedStops = path.filter(p => !p.includes(","));
  UI.resStops.textContent = namedStops.length;
  
  UI.pathList.innerHTML = namedStops.map((stop, i) => `<li><span class="step-num">${i + 1}</span><span>${stop}</span></li>`).join('');
  UI.resultCard.classList.remove("hidden");
}

function drawRoute(path) {
  if (routeLine) map.removeLayer(routeLine);
  if (markerFrom) map.removeLayer(markerFrom);
  if (markerTo) map.removeLayer(markerTo);

  const latlngs = path.map(resolveCoord).filter(Boolean);
  if (latlngs.length < 2) return showError("Route drawn, but some waypoints lack coordinates.");

  routeLine = L.polyline(latlngs, { color: "#ef4444", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round", dashArray: "1, 10" }).addTo(map);
  
  // Use first and last named stops for markers and tooltips
  const namedStops = path.filter(p => !p.includes(","));
  const startName = namedStops[0] || "Start";
  const endName = namedStops[namedStops.length - 1] || "Destination";

  markerFrom = L.marker(latlngs[0], { icon: iconFrom }).bindTooltip(startName, { permanent: false }).addTo(map);
  markerTo = L.marker(latlngs[latlngs.length - 1], { icon: iconTo }).bindTooltip(endName, { permanent: false }).addTo(map);
}

// Global for map popup buttons
window.setDropdown = function(id, value) {
  const el = UI[id];
  if (!el) return;
  if ([...el.options].some(o => o.value === value)) {
    el.value = value;
    el.style.borderColor = id === "start" ? "#10b981" : "#6366f1";
    setTimeout(() => (el.style.borderColor = ""), 1200);
  }
  map.closePopup();
};

UI.swapBtn.addEventListener("click", () => [UI.start.value, UI.end.value] = [UI.end.value, UI.start.value]);

function showError(msg) {
  UI.errorMsg.textContent = msg;
  UI.errorCard.classList.remove("hidden");
}

function setFindBtnLoading(loading) {
  UI.findBtn.disabled = loading;
  UI.findBtn.classList.toggle("loading", loading);
  UI.findBtn.innerHTML = loading 
    ? `<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Finding…`
    : `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Find Route`;
}

function setServerStatus(online) {
  UI.statusDot.className = `status-dot ${online ? "online" : "offline"}`;
  UI.statusLbl.textContent = `Server ${online ? "online" : "offline"}`;
}

loadGeoJSON();
loadLocations();