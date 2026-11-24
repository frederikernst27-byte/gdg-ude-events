import { loadAll } from "./lib/gdg.js";
import { fmt } from "./lib/format.js";
import { present, upcomingOf } from "./lib/select.js";

// Builds poster QR codes for the landing page. Uses `qrcode` from qrcode-generator (global).

const $ = (sel) => document.querySelector(sel);
const base = new URL("./", location.href);

function landingUrl() {
  const url = new URL(base);
  const target = $("#target").value;
  const src = $("#src").value.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-|-$/g, "");
  if (target) url.searchParams.set("e", target);
  if (src) url.searchParams.set("src", src);
  return url.toString();
}

function makeQr(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr;
}

function draw() {
  const url = landingUrl();
  const qr = makeQr(url);
  $("#qr").innerHTML = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
  $("#qr-url").textContent = url;
}

function download(name, blob) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const fileName = (ext) => `gdg-qr-${$("#target").value || "naechstes-event"}${$("#src").value.trim() ? "-" + $("#src").value.trim() : ""}.${ext}`;

$("#dl-svg").addEventListener("click", () => {
  const svg = makeQr(landingUrl()).createSvgTag({ cellSize: 10, margin: 4, scalable: true });
  download(fileName("svg"), new Blob([svg], { type: "image/svg+xml" }));
});

$("#dl-png").addEventListener("click", () => {
  const qr = makeQr(landingUrl());
  const n = qr.getModuleCount();
  const margin = 4;
  const scale = Math.ceil(1200 / (n + margin * 2));
  const size = (n + margin * 2) * scale;
  const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
  canvas.toBlob((blob) => download(fileName("png"), blob), "image/png");
});

$("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(landingUrl());
    $("#copy").textContent = "Kopiert ✓";
  } catch {
    $("#copy").textContent = "Kopieren nicht möglich";
  }
  setTimeout(() => ($("#copy").textContent = "Link kopieren"), 1800);
});

$("#target").addEventListener("change", draw);
$("#src").addEventListener("input", draw);

function fillEvents(events) {
  const select = $("#target");
  const keep = select.value;
  select.length = 1;
  for (const e of upcomingOf(events)) {
    const p = present(e);
    const day = fmt(e.start_date, e.timezone, { day: "numeric", month: "short" });
    select.add(new Option(`Nur: ${p.hook} (${day})`, p.slug));
  }
  select.value = [...select.options].some((o) => o.value === keep) ? keep : "";
  draw();
}

draw();
fetch("data/gdg.json")
  .then((r) => r.json())
  .then((d) => fillEvents(d.events))
  .catch(() => {});
loadAll({ signal: AbortSignal.timeout(10000) })
  .then((d) => fillEvents(d.events))
  .catch(() => {});
