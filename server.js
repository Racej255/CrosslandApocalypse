const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const entriesFile = path.join(__dirname, "entries.json");
const logFile = path.join(__dirname, "entries-log.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function readEntries() {
  const data = await readJson(entriesFile, []);
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.entries)) {
    return data.entries;
  }
  return [];
}

async function writeEntries(entries) {
  await writeJson(entriesFile, entries);
}

async function appendLog(action, payload) {
  const log = await readJson(logFile, []);
  log.push({
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action,
    ...payload,
  });
  await writeJson(logFile, log);
}

app.get("/api/entries", async (req, res) => {
  const entries = await readEntries();
  res.json(entries);
});

app.post("/api/entries", async (req, res) => {
  const entries = await readEntries();
  const input = req.body || {};
  const newEntry = {
    id: input.id || `entry-${Date.now()}`,
    name: input.name || "Unknown",
    date: input.date || new Date().toISOString().split("T")[0],
    title: input.title || "Untitled",
    contentHtml: input.contentHtml || "",
    read: Boolean(input.read),
  };

  entries.push(newEntry);
  await writeEntries(entries);
  await appendLog("create", { entry: newEntry });
  res.status(201).json(newEntry);
});

app.put("/api/entries/:id", async (req, res) => {
  const entries = await readEntries();
  const index = entries.findIndex((entry) => entry.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const previous = entries[index];
  const updates = req.body || {};
  const updated = {
    ...previous,
    ...updates,
    id: previous.id,
  };

  entries[index] = updated;
  await writeEntries(entries);
  await appendLog("update", { before: previous, after: updated });
  res.json(updated);
});

app.delete("/api/entries/:id", async (req, res) => {
  const entries = await readEntries();
  const index = entries.findIndex((entry) => entry.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const [removed] = entries.splice(index, 1);
  await writeEntries(entries);
  await appendLog("delete", { entry: removed });
  res.json(removed);
});

app.listen(PORT, () => {
  console.log(`Crossland archive server running on http://localhost:${PORT}`);
});
