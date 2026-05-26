/**
 * Inventory Scenario Planner — Writeback Backend
 * Node.js / Express
 *
 * This server is the "missing piece" that makes Tableau writeback real.
 * The extension POSTs scenario changes here; this server writes them to
 * a database (or CSV). Tableau's data source then reads from that same table.
 *
 * Install:  npm install express cors body-parser
 * Run:      node server.js
 * Port:     3001 (configure WRITEBACK_URL in index.html to match)
 */

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const fs         = require('fs');
const path       = require('path');

const app  = express();
const PORT = 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Serve the extension static files
app.use(express.static(path.join(__dirname)));

// ── In-memory store (swap for a real DB in production) ──────────────────────
let scenarios = [];

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/writeback
 * Body: { scenario, timestamp, data: [...rows], changes: [...] }
 *
 * Persists the current scenario to:
 *   1. In-memory array (always)
 *   2. scenarios.json (file-based; Tableau Web Data Connector can read this)
 *   3. Your real DB / REST API (see commented examples below)
 */
// DEAD ROUTE (as of Phase 7 — session-only mode).
// The extension no longer POSTs here. Kept intact for the legacy demo flow
// only; remove when that flow is retired.
app.post('/api/writeback', (req, res) => {
  const { scenario, timestamp, data, changes } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'Missing or invalid data payload' });
  }

  const entry = { scenario, timestamp, data, changes, savedAt: new Date().toISOString() };
  scenarios.push(entry);

  // ── Write to JSON file (Tableau WDC / Hyper extract can read this) ────────
  const outputPath = path.join(__dirname, 'scenarios.json');
  fs.writeFileSync(outputPath, JSON.stringify({ latest: entry, history: scenarios }, null, 2));

  // ── Write to CSV (simple flat-file option) ────────────────────────────────
  const csvPath = path.join(__dirname, 'inventory_scenario.csv');
  const cols    = ['id','material','origin','destination','transport','units','eta','capacity'];
  const csv     = [cols.join(','), ...data.map(r => cols.map(c => r[c] ?? '').join(','))].join('\n');
  fs.writeFileSync(csvPath, csv);

  /*
  // ── PostgreSQL example (uncomment + npm install pg) ──────────────────────
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const client = await pool.connect();
  await client.query('BEGIN');
  await client.query('DELETE FROM inventory_scenarios WHERE scenario_name = $1', [scenario]);
  for (const row of data) {
    await client.query(
      `INSERT INTO inventory_scenarios
         (id, material, origin, destination, transport, units, eta, capacity, scenario_name, saved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [row.id, row.material, row.origin, row.destination, row.transport,
       row.units, row.eta, row.capacity, scenario, entry.savedAt]
    );
  }
  await client.query('COMMIT');
  client.release();
  */

  console.log(`[${entry.savedAt}] Committed scenario "${scenario}" — ${data.length} rows`);
  res.json({ ok: true, rows: data.length, savedAt: entry.savedAt });
});

/**
 * GET /api/scenarios
 * Returns list of committed scenarios (for scenario picker UI)
 */
app.get('/api/scenarios', (_req, res) => {
  const list = scenarios.map(s => ({
    scenario:  s.scenario,
    savedAt:   s.savedAt,
    rowCount:  s.data.length,
    changes:   s.changes?.length ?? 0,
  }));
  res.json(list);
});

/**
 * GET /api/latest
 * Returns the latest committed scenario data (useful as a Tableau WDC endpoint)
 */
app.get('/api/latest', (_req, res) => {
  const latest = scenarios[scenarios.length - 1];
  if (!latest) return res.json({ data: [] });
  res.json(latest);
});

/**
 * GET /api/data.csv
 * Returns latest scenario as CSV — point a Tableau text file connection here
 */
app.get('/api/data.csv', (_req, res) => {
  const latest = scenarios[scenarios.length - 1];
  const data   = latest?.data ?? [];
  const cols   = ['id','material','origin','destination','transport','units','eta','capacity'];
  const csv    = [cols.join(','), ...data.map(r => cols.map(c => r[c] ?? '').join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  Inventory Scenario Planner — Backend Server  ║
╠══════════════════════════════════════════════╣
║  Extension UI:   http://localhost:${PORT}        ║
║  Writeback API:  http://localhost:${PORT}/api    ║
║  Latest data:    http://localhost:${PORT}/api/latest ║
║  CSV feed:       http://localhost:${PORT}/api/data.csv ║
╚══════════════════════════════════════════════╝
  `);
});
