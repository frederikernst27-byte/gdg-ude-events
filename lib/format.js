// Display helpers for events, shared by both page versions.
import { CHAPTER_URL } from "./gdg.js";

export const fmt = (iso, tz, opts) => new Intl.DateTimeFormat(opts.locale || "de-DE", { timeZone: tz, ...opts }).format(new Date(iso));

export function dateParts(e) {
  return {
    month: fmt(e.start_date, e.timezone, { locale: "en-US", month: "short" }).toUpperCase(),
    day: fmt(e.start_date, e.timezone, { day: "numeric" }),
    year: fmt(e.start_date, e.timezone, { year: "numeric" }),
  };
}

export function timeRange(e) {
  const t = (iso) => fmt(iso, e.timezone, { hour: "2-digit", minute: "2-digit" });
  return e.end_date ? `${t(e.start_date)} – ${t(e.end_date)}` : t(e.start_date);
}

export function venue(e) {
  if (e.is_virtual || e.audience_type === "VIRTUAL") return "Online";
  const raw = e.venue_name || "";
  const atUde = /university of duisburg[- ]essen|\bude\b/i.test(raw);
  const room = raw.replace(/^room\s+/i, "").replace(/\s+at\s+university of duisburg[- ]essen/i, "").trim();
  if (atUde || /^S[A-Z]-?\d|^R\d/i.test(room)) return `UDE, ${room}`;
  return [room, e.venue_city].filter(Boolean).join(", ") || e.venue_city || "Essen";
}

export const isUpcoming = (e, now = Date.now()) => Date.parse(e.end_date || e.start_date) >= now;
export const safeUrl = (u) => (/^https:\/\//.test(u || "") ? u : CHAPTER_URL);
