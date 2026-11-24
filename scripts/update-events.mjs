#!/usr/bin/env node
// Pulls events, team and chapter info from gdg.community.dev and writes a
// snapshot to data/gdg.json. The website loads live data in the browser and
// uses this snapshot for the first paint and when the live API is unreachable.
//
// Run: node scripts/update-events.mjs   (or: npm run update)

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAll } from "../lib/gdg.js";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../data/gdg.json");

const snapshot = await loadAll();
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(snapshot, null, 2) + "\n");

const now = Date.now();
const upcoming = snapshot.events.filter((e) => Date.parse(e.end_date || e.start_date) >= now).length;
console.log(`✓ ${snapshot.events.length} events (${upcoming} upcoming), ${snapshot.team.length} team members → data/gdg.json`);
