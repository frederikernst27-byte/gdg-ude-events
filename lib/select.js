// Which event a link points to, and how it is presented.
import { CONFIG } from "../events.config.js";
import { isUpcoming } from "./format.js";

export const upcomingOf = (events) => events.filter((e) => isUpcoming(e));

// The page's own copy for an event: config hook if there is one, else the event's data.
export function present(e) {
  const o = CONFIG.events[e.id] || {};
  return {
    kicker: o.kicker || e.tags?.[0] || "Event",
    hook: o.hook || e.title,
    text: o.text || e.description_short,
    slug: o.slug || String(e.id),
  };
}

// `key` comes from ?e=… : a slug from the config or a numeric event id.
// No key → the next upcoming event, so one fixed QR code keeps working.
export function pickEvent(events, key) {
  if (key) {
    const byKey = events.find((e) => String(e.id) === key || CONFIG.events[e.id]?.slug === key);
    if (byKey) return { event: byKey, mode: "pinned" };
  }
  return { event: upcomingOf(events)[0] || null, mode: key ? "fallback" : "auto" };
}
