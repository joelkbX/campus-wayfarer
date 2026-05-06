/**
 * Campus Wayfarer – Graph & Dijkstra
 */

const fs = require("fs");
const path = require("path");

const geojsonData = (() => {
  try {
    const data = fs.readFileSync(path.join(__dirname, "../frontend/campus.geojson"), "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Error loading geojson:", e);
    return { features: [] };
  }
})();

const coordsOf = {};
for (const f of geojsonData.features) {
  const { name } = f.properties ?? {};
  const { type, coordinates } = f.geometry ?? {};
  if (!name || !coordinates) continue;

  if (type === "Point") {
    coordsOf[name] = [coordinates[1], coordinates[0]];
  } else if (type === "Polygon") {
    const ring = coordinates[0];
    coordsOf[name] = [
      ring.reduce((s, c) => s + c[1], 0) / ring.length,
      ring.reduce((s, c) => s + c[0], 0) / ring.length
    ];
  }
}

function haversine(c1, c2) {
  if (!c1 || !c2) return null;
  const toRad = Math.PI / 180, R = 6371000;
  const dLat = (c2[0] - c1[0]) * toRad, dLon = (c2[1] - c1[1]) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(c1[0] * toRad) * Math.cos(c2[0] * toRad) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function buildGraph() {
  const g = {};
  const segments = [];

  for (const f of geojsonData.features) {
    if (f.geometry?.type === "LineString") {
      const coords = f.geometry.coordinates;
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = [coords[i][1], coords[i][0]], p2 = [coords[i+1][1], coords[i+1][0]];
        segments.push([p1, p2]);
        const id1 = `${p1[0].toFixed(6)},${p1[1].toFixed(6)}`, id2 = `${p2[0].toFixed(6)},${p2[1].toFixed(6)}`;
        const w = haversine(p1, p2) ?? 0;
        (g[id1] ??= {})[id2] = w;
        (g[id2] ??= {})[id1] = w;
      }
    }
  }

  // Stitch disjoint paths that are very close (e.g., < 10m)
  const pathNodes = Object.keys(g);
  for (let i = 0; i < pathNodes.length; i++) {
    for (let j = i + 1; j < pathNodes.length; j++) {
      const id1 = pathNodes[i], id2 = pathNodes[j];
      if (g[id1][id2] !== undefined) continue;
      const c1 = id1.split(",").map(Number), c2 = id2.split(",").map(Number);
      const dist = haversine(c1, c2);
      if (dist !== null && dist < 10) {
        g[id1][id2] = dist;
        g[id2][id1] = dist;
      }
    }
  }

  function getProjectedPoint(P, A, B) {
    const abLat = B[0] - A[0], abLng = B[1] - A[1];
    const abSq = abLat * abLat + abLng * abLng;
    if (abSq === 0) return A;
    let t = ((P[0] - A[0]) * abLat + (P[1] - A[1]) * abLng) / abSq;
    t = Math.max(0, Math.min(1, t));
    return [A[0] + t * abLat, A[1] + t * abLng];
  }

  if (segments.length) {
    for (const [name, coord] of Object.entries(coordsOf)) {
      let minDist = Infinity, bestQ = null, bestA = null, bestB = null;
      for (const [A, B] of segments) {
        const Q = getProjectedPoint(coord, A, B);
        const d = haversine(coord, Q);
        if (d !== null && d < minDist) {
          minDist = d;
          bestQ = Q; bestA = A; bestB = B;
        }
      }
      if (bestQ && minDist < 200) {
        const idQ = `${bestQ[0].toFixed(6)},${bestQ[1].toFixed(6)}`;
        const idA = `${bestA[0].toFixed(6)},${bestA[1].toFixed(6)}`;
        const idB = `${bestB[0].toFixed(6)},${bestB[1].toFixed(6)}`;

        (g[name] ??= {})[idQ] = minDist;
        (g[idQ] ??= {})[name] = minDist;

        const dAQ = haversine(bestA, bestQ) ?? 0;
        const dBQ = haversine(bestB, bestQ) ?? 0;
        (g[idA] ??= {})[idQ] = dAQ;
        (g[idQ] ??= {})[idA] = dAQ;
        (g[idB] ??= {})[idQ] = dBQ;
        (g[idQ] ??= {})[idB] = dBQ;
      }
    }
  }
  return g;
}

const graph = buildGraph();

function shortestPath(start, end) {
  if (!graph[start] || !graph[end]) return { path: [], distance: null, error: "Unknown location" };
  if (start === end) return { path: [start], distance: 0, unit: "m" };

  const distances = { [start]: 0 }, previous = {}, visited = new Set(), nodes = Object.keys(graph);

  while (true) {
    let closest = null;
    for (const n of nodes) {
      if (!visited.has(n) && distances[n] !== undefined) {
        if (closest === null || distances[n] < distances[closest]) closest = n;
      }
    }
    if (!closest || closest === end) break;
    visited.add(closest);

    for (const [neighbor, weight] of Object.entries(graph[closest])) {
      if (!visited.has(neighbor)) {
        const alt = distances[closest] + weight;
        if (distances[neighbor] === undefined || alt < distances[neighbor]) {
          distances[neighbor] = alt;
          previous[neighbor] = closest;
        }
      }
    }
  }

  if (distances[end] === undefined) return { path: [], distance: null, error: "No route found" };

  const path = [];
  for (let curr = end; curr; curr = previous[curr]) path.unshift(curr);
  return { path, distance: distances[end], walkingMins: Math.ceil(distances[end] / 1.4 / 60), unit: "m" };
}

module.exports = { graph, shortestPath, coordsOf };