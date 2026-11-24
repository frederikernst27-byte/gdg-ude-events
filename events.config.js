// Everything the team edits lives here.
//
// Event data (date, place, picture, sign-up link) comes automatically from
// gdg.community.dev. This file only adds the marketing layer on top: a hook
// per event and an optional short slug for event-specific QR codes.

export const CONFIG = {
  // Every page view and click is POSTed here as JSON (see README → Tracking).
  // Leave empty to send nothing. Backend: supabase/functions/gdg-track.
  trackingEndpoint: "https://hhkddsjttsxbqqsfmcci.supabase.co/functions/v1/gdg-track",

  // Aggregated numbers for dashboard.html and the QR tool (supabase/functions/gdg-stats).
  statsEndpoint: "https://hhkddsjttsxbqqsfmcci.supabase.co/functions/v1/gdg-stats",

  links: {
    linktree: "https://tinyurl.com/gdg-link-stack",
    instagram: "https://www.instagram.com/gdg_ude/",
  },

  // Keyed by the gdg.community.dev event id (the number in /api/event/<id>/,
  // also shown on the QR page). All fields are optional; without an entry the
  // page uses the event's own title and short description.
  //   slug:   short name for links/QR codes  → ?e=devfest
  //   kicker: small label above the hook
  //   hook:   the big headline
  //   text:   one or two sentences under it
  events: {
    134899: {
      slug: "digital-twins",
      kicker: "Tech Talk · Gerrit Rolofs, TE Connectivity",
      hook: "Wie Fabriken mit Digital Twins Energie sparen",
      text: "Echtzeitdaten, Simulation und smarte Optimierung: Gerrit zeigt, wie Fabriken erneuerbare Energie flexibel nutzen. Der Talk ist auf Deutsch.",
    },
    135836: {
      slug: "devfest",
      kicker: "DevFest 2026",
      hook: "Ein Nachmittag voller Tech, Talks und Community",
      text: "Unser DevFest an der UDE. Das Programm kommt bald – sichere dir jetzt schon deinen Platz.",
    },
  },
};
