import { CONFIG } from "./events.config.js";

// Team dashboard: reads aggregated numbers from the gdg-stats edge function.

const $ = (sel) => document.querySelector(sel);
const NS = "http://www.w3.org/2000/svg";
const nf = new Intl.NumberFormat("de-DE");
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : "–");
const state = { days: 30, stats: null, titles: new Map() };

const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};
const cell = (text, className) => Object.assign(document.createElement("td"), { textContent: text, className: className || "" });

// ---------- data ----------

async function loadStats() {
  $("#updated").textContent = "Lädt …";
  try {
    const res = await fetch(`${CONFIG.statsEndpoint}?days=${state.days}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    state.stats = await res.json();
    render();
  } catch (err) {
    console.error(err);
    $("#updated").textContent = "Statistiken konnten nicht geladen werden. Später nochmal versuchen.";
  }
}

async function loadTitles() {
  try {
    const data = await (await fetch("data/gdg.json")).json();
    for (const e of data.events) state.titles.set(e.id, e.title);
    if (state.stats) render();
  } catch {}
}

// Every day of the range, zeros included, as Berlin calendar dates.
function series(daily, days) {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const todayBerlin = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const [y, m, d] = todayBerlin.split("-").map(Number);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1, d - (days - 1 - i)));
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key) || {};
    return { date, key, views: row.views || 0, register: row.register || 0 };
  });
}

// ---------- render ----------

function render() {
  const s = state.stats;
  const t = s.totals;
  $("#k-views").textContent = nf.format(t.views);
  $("#k-views-sub").textContent = `in den letzten ${s.days} Tagen`;
  $("#k-visitors").textContent = nf.format(t.visitors);
  $("#k-register").textContent = nf.format(t.register);
  $("#k-conv").textContent = pct(t.registered_visitors, t.visitors);
  $("#updated").textContent = `Stand ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s.generated_at))} · aktualisiert sich jede Minute`;

  drawChart(series(s.daily, s.days));
  renderSources(s.by_source);
  renderEvents(s.by_event);
  renderLinks(s.links);
}

function emptyRow(tbody, cols, text) {
  const td = cell(text, "empty");
  td.colSpan = cols;
  const tr = document.createElement("tr");
  tr.append(td);
  tbody.replaceChildren(tr);
}

function renderSources(rows) {
  const tbody = $("#t-source");
  if (!rows.length) return emptyRow(tbody, 6, "Noch keine Aufrufe in diesem Zeitraum.");
  const max = Math.max(...rows.map((r) => r.views), 1);
  tbody.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      const wrap = Object.assign(document.createElement("div"), { className: "bar-cell" });
      const bar = Object.assign(document.createElement("span"), { className: "bar" });
      bar.style.width = `${Math.max(2, (r.views / max) * 100)}%`;
      wrap.append(Object.assign(document.createElement("code"), { textContent: r.src }), bar);
      name.append(wrap);

      const qr = document.createElement("td");
      if (!["direct", "referrer"].includes(r.src)) {
        qr.append(Object.assign(document.createElement("a"), { className: "qr-link", href: `qr.html?src=${encodeURIComponent(r.src)}`, textContent: "QR-Code" }));
      }
      tr.append(name, cell(nf.format(r.views), "num"), cell(nf.format(r.visitors), "num"), cell(nf.format(r.register), "num"), cell(pct(r.register, r.visitors), "num"), qr);
      return tr;
    })
  );
}

function renderEvents(rows) {
  const tbody = $("#t-event");
  if (!rows.length) return emptyRow(tbody, 3, "Noch keine Daten.");
  tbody.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement("tr");
      tr.append(cell(state.titles.get(r.event_id) || `Event ${r.event_id}`), cell(nf.format(r.views), "num"), cell(nf.format(r.register), "num"));
      return tr;
    })
  );
}

const LINK_NAMES = { community: "Alle Events & Community", instagram: "Instagram", linktree: "Alle Links (Linktree)", brand: "Logo → Community" };

function renderLinks(rows) {
  const tbody = $("#t-links");
  if (!rows.length) return emptyRow(tbody, 2, "Noch keine Klicks.");
  tbody.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement("tr");
      tr.append(cell(LINK_NAMES[r.target] || r.target), cell(nf.format(r.clicks), "num"));
      return tr;
    })
  );
}

// ---------- chart: two lines (views, register clicks), one y-axis ----------

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * pow * 4 >= v) * pow;
  return step * 4;
}

function drawChart(points) {
  const box = $("#chart");
  const tip = $("#tooltip");
  tip.hidden = true;
  const total = points.reduce((n, p) => n + p.views + p.register, 0);
  if (!total) {
    box.innerHTML = `<div class="empty-chart">Noch keine Aufrufe in diesem Zeitraum.<br>Sobald jemand die Seite über einen QR-Code öffnet, erscheint hier der Verlauf.</div>`;
    return;
  }

  const W = box.clientWidth, H = box.clientHeight;
  const m = { top: 12, right: W < 520 ? 16 : 120, bottom: 26, left: 36 };
  const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
  const yMax = niceMax(Math.max(...points.map((p) => Math.max(p.views, p.register))));
  const x = (i) => m.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => m.top + ih - (v / yMax) * ih;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Aufrufe und Anmelde-Klicks pro Tag, letzte ${points.length} Tage` });

  const grid = svgEl("g", { class: "grid" });
  const axis = svgEl("g", { class: "axis" });
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i;
    grid.append(svgEl("line", { x1: m.left, x2: m.left + iw, y1: y(v), y2: y(v) }));
    const label = svgEl("text", { x: m.left - 8, y: y(v) + 4, "text-anchor": "end" });
    label.textContent = nf.format(v);
    axis.append(label);
  }
  const dayFmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "UTC" });
  const ticks = Math.min(points.length, W < 520 ? 4 : 7);
  for (let k = 0; k < ticks; k++) {
    const i = Math.round((k / Math.max(ticks - 1, 1)) * (points.length - 1));
    const label = svgEl("text", { x: x(i), y: H - 6, "text-anchor": k === 0 ? "start" : k === ticks - 1 ? "end" : "middle" });
    label.textContent = dayFmt.format(points[i].date);
    axis.append(label);
  }
  svg.append(grid, axis);

  const line = (key) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  svg.append(
    svgEl("path", { d: `${line("views")}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`, fill: "var(--views)", "fill-opacity": 0.1 }),
    svgEl("path", { d: line("views"), fill: "none", stroke: "var(--views)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }),
    svgEl("path", { d: line("register"), fill: "none", stroke: "var(--register)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" })
  );

  // End dots + direct labels (nudged apart when they would collide)
  const last = points.length - 1;
  const ends = [
    { key: "views", name: "Aufrufe", color: "var(--views)" },
    { key: "register", name: "Anmelde-Klicks", color: "var(--register)" },
  ].map((s) => ({ ...s, cy: y(points[last][s.key]), v: points[last][s.key] }));
  for (const e of ends) svg.append(svgEl("circle", { cx: x(last), cy: e.cy, r: 4, fill: e.color, stroke: "#fff", "stroke-width": 2 }));
  if (m.right > 40) {
    const [a, b] = ends;
    let ya = a.cy, yb = b.cy;
    if (Math.abs(ya - yb) < 14) (ya <= yb ? ((ya -= 7), (yb += 7)) : ((ya += 7), (yb -= 7)));
    for (const [e, ly] of [[a, ya], [b, yb]]) {
      const t = svgEl("text", { class: "end-label", x: x(last) + 10, y: ly + 4 });
      t.textContent = `${e.name} ${nf.format(e.v)}`;
      svg.append(t);
    }
  }

  // Hover layer: crosshair + tooltip for the nearest day
  const cross = svgEl("line", { class: "crosshair", y1: m.top, y2: m.top + ih, visibility: "hidden" });
  const dv = svgEl("circle", { r: 4, fill: "var(--views)", stroke: "#fff", "stroke-width": 2, visibility: "hidden" });
  const dr = svgEl("circle", { r: 4, fill: "var(--register)", stroke: "#fff", "stroke-width": 2, visibility: "hidden" });
  const hit = svgEl("rect", { x: m.left, y: m.top, width: iw, height: ih, fill: "transparent" });
  svg.append(cross, dv, dr, hit);

  const longFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
  hit.addEventListener("pointermove", (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(last, Math.round(((px - m.left) / iw) * last)));
    const p = points[i];
    for (const [node, cy] of [[dv, y(p.views)], [dr, y(p.register)]]) {
      node.setAttribute("cx", x(i));
      node.setAttribute("cy", cy);
      node.setAttribute("visibility", "visible");
    }
    cross.setAttribute("x1", x(i));
    cross.setAttribute("x2", x(i));
    cross.setAttribute("visibility", "visible");
    tip.innerHTML = `<strong>${longFmt.format(p.date)}</strong>
      <div><span class="sw" style="background:var(--views)"></span>Aufrufe: ${nf.format(p.views)}</div>
      <div><span class="sw" style="background:var(--register)"></span>Anmelde-Klicks: ${nf.format(p.register)}</div>`;
    tip.hidden = false;
    const panel = box.parentElement.getBoundingClientRect();
    const left = rect.left - panel.left + (x(i) / W) * rect.width;
    tip.style.left = `${Math.min(Math.max(left - tip.offsetWidth / 2, 8), panel.width - tip.offsetWidth - 8)}px`;
    tip.style.top = `${rect.top - panel.top + (Math.min(y(p.views), y(p.register)) / H) * rect.height - tip.offsetHeight - 12}px`;
  });
  hit.addEventListener("pointerleave", () => {
    tip.hidden = true;
    for (const node of [cross, dv, dr]) node.setAttribute("visibility", "hidden");
  });

  box.replaceChildren(svg);
}

// ---------- wiring ----------

document.querySelectorAll(".range button").forEach((btn) =>
  btn.addEventListener("click", () => {
    state.days = Number(btn.dataset.days);
    document.querySelectorAll(".range button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    loadStats();
  })
);

let resizeTimer;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => state.stats && drawChart(series(state.stats.daily, state.stats.days)), 150);
});

loadStats();
loadTitles();
setInterval(loadStats, 60_000);
