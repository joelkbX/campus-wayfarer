const express = require("express");
const cors = require("cors");
const path = require("path");
const { graph, shortestPath } = require("./graph");

const app = express();
const PORT = 5000;
const frontendDir = path.join(__dirname, "..", "frontend");

app.use(express.static(frontendDir));
app.use(cors());
app.use(express.json());

app.get("/locations", (_, res) => res.json(Object.keys(graph).sort()));

app.post("/route", (req, res) => {
  const { start, end } = req.body ?? {};
  if (!start || !end) return res.status(400).json({ error: "Missing start or end." });
  const result = shortestPath(start.trim(), end.trim());
  return result.error ? res.status(404).json(result) : res.json(result);
});

app.get("*", (_, res) => res.sendFile(path.join(frontendDir, "index.html")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => console.log(`🗺 Campus Wayfarer running at http://localhost:${PORT}`));