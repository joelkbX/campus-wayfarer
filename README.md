# Campus Wayfarer

## Abstract
**Campus Wayfarer** is a fast, interactive, and highly accurate geospatial navigation system designed specifically for campus environments. Built to eliminate the confusion of navigating large and complex campuses, it calculates and visually plots the optimal walking routes between buildings, gates, and landmarks. Rather than drawing simplistic, straight lines that intersect buildings, Campus Wayfarer leverages a custom implementation of Dijkstra's algorithm running over a dynamically generated network of GeoJSON `LineString` pathways. This allows the routing engine to employ advanced vector projection mathematics, ensuring every requested route snaps perfectly to realistic campus walkways for maximum fidelity.

## Key Features
- 🗺️ **High-Fidelity Routing:** Dynamically builds the routing graph using precise GeoJSON pathways.
- 📐 **Vector Projection Snapping:** Automatically projects named buildings perpendicularly onto nearest physical paths so users are smoothly routed from building entrances directly onto main walkways.
- ⚡ **Lightweight & Fast:** Written in pure Vanilla JavaScript and Node.js with zero bloated routing dependencies.
- 📍 **Interactive UI:** Utilizes Leaflet.js to render a beautiful, highly responsive, mobile-friendly campus map.
- 🚶‍♂️ **Real-Time Estimations:** Instantly calculates accurate walking distances (in meters/kilometers) and estimated walking times based on human walking speed constraints.

---

## Architecture Overview

### Frontend
- **HTML/CSS/JS (Vanilla):** The frontend relies entirely on native browser features for DOM caching and high-performance rendering.
- **Leaflet.js:** Powers the interactive map, polyline plotting, and custom marker rendering.
- **Dynamic Parsers:** Effortlessly parses complex JSON payloads from the backend to construct step-by-step route descriptions while rendering complex coordinate arrays on the map visually.

### Backend
- **Node.js & Express:** A highly condensed API server (~30 lines of code) that serves static files and responds to routing calculations.
- **`graph.js` Routing Engine:** The heart of the project. It consumes `campus.geojson`, dynamically builds an undirected coordinate graph, and calculates the Haversine distance between all intersection nodes. It applies a highly optimized Dijkstra shortest-path algorithm to serve routing requests instantaneously.

---

## Installation & Setup

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/campus-wayfarer.git
   cd campus-wayfarer
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Start the server:**
   ```bash
   npm run dev
   # OR
   npm start
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:5000/`.

---

## Usage
1. Open the application in your browser.
2. Select your **Starting Point** from the "Start Location" dropdown.
3. Select your **Destination** from the "Destination" dropdown.
4. Click **Find Route**.
5. The map will dynamically zoom to fit the route, displaying the total distance, estimated walking time, and the exact path to take!

---

## Data Structure (`campus.geojson`)
The routing relies on a structured GeoJSON file located in `frontend/campus.geojson`. 
- **Point Features:** Represent named landmarks, entrances, and gates.
- **LineString Features:** Represent the detailed, walkable pathways connecting the campus. 
- **Polygon Features:** Can be used to draw buildings, parking lots, and terrain on the map.

*The backend engine will automatically parse these features on startup, meaning the campus network can be seamlessly expanded without writing any new code.*

## License
ISC License
