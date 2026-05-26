# Inventory Scenario Planner — Tableau Extension
## Implementation Guide

---

## What This Is

A Tableau Dashboard Extension that gives users Excel-like editing of inventory
data directly inside Tableau. Users can:

- Edit cells inline (units, destination, ETA)
- Move inventory between locations via the Transfer panel (split or full reroute)
- Add or remove shipment rows
- See real-time deltas vs. the baseline
- Commit scenarios that persist to a backend (file or database)
- Tableau then refreshes and reflects the changes

---

## Architecture Overview

```
Tableau Dashboard
    │
    ├── Worksheet (reads from DB/CSV)
    │
    └── Extension Zone
            │
            └── index.html  ──── Tableau Extensions API ──▶ reads worksheet data
                    │
                    └── POST /api/writeback ──▶ server.js ──▶ DB / CSV
                                                                    │
                                                      Tableau refreshes data source ◀──┘
```

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | The full extension UI (self-contained) |
| `inventory-planner.trex` | Tableau manifest — how Tableau loads the extension |
| `server.js` | Node.js writeback backend (optional but recommended) |
| `README.md` | This file |

---

## Quick Start (Demo Mode — No Backend)

1. Open Tableau Desktop (2020.4 or later)
2. Create or open a workbook
3. Add a Dashboard
4. Drag an **Extension** object onto the dashboard
5. Click **"My Extensions"** → browse to `inventory-planner.trex`
6. The extension loads in demo mode with seed data
7. Edit cells, use the Transfer panel, click "Commit Scenario"

---

## Full Setup (Reads Real Tableau Data + Writes Back)

### Step 1 — Prepare your Tableau data source

Your worksheet should have these fields (column names are flexible):

| Field | Example |
|-------|---------|
| Material | Corn |
| Origin | Iowa |
| Destination | Kansas |
| Transport | Rail |
| Units | 400 |
| ETA | 2024-06-12 |
| Capacity | 88 |

### Step 2 — Start the backend server

```bash
cd tableau-inventory-extension
npm install express cors body-parser
node server.js
```

Server starts at `http://localhost:3001`

### Step 3 — Point the extension at your server

In `index.html`, find the `pushToTableau()` function and uncomment:

```javascript
fetch('http://localhost:3001/api/writeback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scenario, timestamp, data: workingData, changes: changelog })
})
```

### Step 4 — Connect Tableau to the writeback output

**Option A — CSV (simplest):**
- In Tableau, add a Text File connection to `inventory_scenario.csv`
- After each commit, click the Refresh button in Tableau

**Option B — Live HTTP (Web Data Connector):**
- Create a Tableau WDC pointing to `http://localhost:3001/api/data.csv`
- Tableau will pull fresh data on each extract refresh

**Option C — Database (production):**
- Uncomment the PostgreSQL block in `server.js`
- Set `DATABASE_URL` environment variable
- Connect Tableau directly to your database table `inventory_scenarios`

### Step 5 — Name your worksheet "Inventory"

The extension auto-detects a worksheet named "Inventory". If your worksheet
has a different name, update this line in `index.html`:

```javascript
const ws = worksheets.find(w => w.name.toLowerCase().includes('inventory')) || worksheets[0];
```

---

## Customization

### Add more materials or locations

In `index.html`, update the `<select>` filter options and the `SEED_DATA` array.

### Change capacity thresholds

```javascript
const CAPACITY_THRESHOLD = { warn: 70, over: 85 };
```

### Add more editable fields

In `renderTable()`, add `class="editable" data-field="yourField"` to any `<td>`.

### Connect to a real authentication layer

Wrap `server.js` routes with JWT middleware (e.g. `express-jwt`) before
deploying to production.

---

## Tableau Sandbox Allowlist

When deploying to Tableau Server or Tableau Cloud, you must allowlist the
extension URL under **Settings → Extensions**.

For local development, Tableau Desktop allows any localhost URL.

---

## InfoTopics Writeback Reference

This extension follows the same pattern as InfoTopics' Writeback + Super Tables:

| InfoTopics Feature | This Extension Equivalent |
|-------------------|--------------------------|
| Inline cell editing | `td.editable` click handler |
| Row add/delete | `btn-add-row` / `deleteRow()` |
| Writeback to DB | `POST /api/writeback` in `server.js` |
| Scenario management | Changelog + Commit button |
| Tableau refresh trigger | `dashboard.refreshDataAsync()` call |

---

## Deployment to Production

1. Host `index.html` on any static host (S3, Netlify, IIS, nginx)
2. Host `server.js` on any Node host (EC2, Azure App Service, Render)
3. Update the `<url>` in `inventory-planner.trex` to the hosted URL
4. Allowlist the URL in Tableau Server/Cloud admin settings
5. Distribute the `.trex` file to your users

---

*Built for Tableau Extensions API v1.7+*
