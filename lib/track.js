// Minimal, privacy-friendly click tracking. No cookies, no personal data:
// a random per-tab session id, what happened, and where the visitor came from.
// The receiving side (dashboard / workflow app) is described in README → Tracking.
import { CONFIG } from "../events.config.js";

const params = new URLSearchParams(location.search);
const debug = params.has("debug");

// Where the visitor came from: ?src=plakat-mensa (our QR codes) or utm_source.
export const source = params.get("src") || params.get("utm_source") || (document.referrer ? "referrer" : "direct");

function sessionId() {
  try {
    let id = sessionStorage.getItem("gdg-sid");
    if (!id) sessionStorage.setItem("gdg-sid", (id = crypto.randomUUID()));
    return id;
  } catch {
    return "no-storage";
  }
}

export function track(name, props = {}) {
  const payload = {
    name,
    ...props,
    src: source,
    path: location.pathname + location.search,
    referrer: document.referrer || null,
    session: sessionId(),
    ts: new Date().toISOString(),
  };
  if (debug) console.info("[track]", payload);
  if (!CONFIG.trackingEndpoint) return;

  // text/plain keeps this a "simple" request: no CORS preflight, and
  // sendBeacon still delivers it when the page is being left.
  const body = new Blob([JSON.stringify(payload)], { type: "text/plain;charset=UTF-8" });
  const sent = navigator.sendBeacon?.(CONFIG.trackingEndpoint, body);
  if (!sent) fetch(CONFIG.trackingEndpoint, { method: "POST", body, keepalive: true, mode: "no-cors" }).catch(() => {});
}
