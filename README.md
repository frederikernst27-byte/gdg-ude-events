# GDG on Campus UDE – Event-Landingpage

Schlanke Landingpage für Plakate und Social Media: **Hook → Anmeldung mit einem Klick → Mehr von uns.**
Keine zweite Community-Seite, sondern nur der kürzeste Weg vom Plakat zur Anmeldung.

**Live:** https://frederikernst27-byte.github.io/gdg-ude-events/
**QR-Codes:** https://frederikernst27-byte.github.io/gdg-ude-events/qr.html
**Statistiken:** https://frederikernst27-byte.github.io/gdg-ude-events/dashboard.html

## So funktioniert's

| Link | zeigt |
| --- | --- |
| `/` | immer das **nächste** Event (fester QR-Code, nie austauschen) |
| `/?e=devfest` | genau dieses Event (Slug aus `events.config.js` oder die Event-ID) |
| `…&src=plakat-mensa` | Herkunft fürs Tracking (welches Plakat / welcher Kanal) |

- **Daten:** Titel, Datum, Ort, Bild und Anmelde-Link kommen automatisch von gdg.community.dev
  (öffentliche API, live im Browser; `data/gdg.json` ist der Fallback und wird alle 6 h per GitHub Action aktualisiert).
- **Anmeldung:** Der Button leitet zur Event-Seite auf gdg.community.dev weiter (neuer Tab), dort bestätigt man per „RSVP“.
  Die Landingpage zeigt danach „Fast geschafft!“ und die weiteren Events.
- **Mehrere Events gleichzeitig:** `/` nimmt das nächste nach Startdatum; die anderen stehen unter „Mehr von uns“.
  Für ein bestimmtes Event einfach einen eigenen QR-Code mit `?e=…` erzeugen.

## Hook für ein Event ändern

In [`events.config.js`](events.config.js) unter `events`, Schlüssel = Event-ID von gdg.community.dev
(steht auch im QR-Tool bzw. in `data/gdg.json`):

```js
135836: {
  slug: "devfest",                 // → ?e=devfest
  kicker: "DevFest 2026",          // kleines Label
  hook: "Ein Nachmittag voller …", // große Überschrift
  text: "Ein, zwei Sätze …",
},
```

Ohne Eintrag nimmt die Seite einfach Titel und Kurzbeschreibung des Events.

## Statistiken & Tracking

**Dashboard** (`dashboard.html`): Aufrufe, Besucher, Anmelde-Klicks und Conversion für 7 / 30 / 90 Tage,
Verlauf pro Tag und Tabellen nach Quelle (QR-Code / Plakat), Event und „Mehr von uns“-Links.
Aus jeder Quellen-Zeile kommt man mit einem Klick zum passenden QR-Code. Umgekehrt zeigt das QR-Tool
unter jedem Code dessen Zahlen der letzten 30 Tage.

**Backend:** Supabase, Projekt `hhkddsjttsxbqqsfmcci`, eigenes Schema `gdg_events` (keine Verbindung zu anderen Tabellen).

| Teil | Datei | Aufgabe |
| --- | --- | --- |
| Tabelle `gdg_events.track` + `gdg_track()` / `gdg_stats()` | `supabase/migrations/…_gdg_tracking.sql` | Rohdaten + Auswertung (nicht direkt über die API erreichbar) |
| Edge Function `gdg-track` | `supabase/functions/gdg-track` | nimmt Ereignisse an, prüft sie, nur von unseren Origins |
| Edge Function `gdg-stats` | `supabase/functions/gdg-stats` | liefert nur Summen, keine Einzeldaten |

Neu deployen: `supabase functions deploy gdg-track --no-verify-jwt` (bzw. `gdg-stats`).

Die Landingpage schickt jedes Ereignis als JSON per `POST` an `trackingEndpoint`
(`navigator.sendBeacon`, Content-Type `text/plain`, also ohne CORS-Preflight). Keine Cookies, keine personenbezogenen Daten.

```json
{
  "name": "register_click",
  "event_id": 134899,
  "src": "plakat-mensa",
  "path": "/?src=plakat-mensa",
  "referrer": null,
  "session": "8f0c…",
  "ts": "2026-11-24T15:02:11.123Z"
}
```

| `name` | wann | Extra-Felder |
| --- | --- | --- |
| `page_view` | Seite geladen | `event_id`, `mode` (`auto` / `pinned` / `fallback`) |
| `register_click` | Klick auf „Kostenlos anmelden“ | `event_id` |
| `more_event_click` | Klick auf ein weiteres Event | `event_id` |
| `more_link_click` | Community / Instagram / Linktree / Logo | `target` |

`session` ist eine zufällige ID pro Browser-Tab (sessionStorage). Mit `?debug` in der URL werden alle Ereignisse in der Konsole ausgegeben.
Vergleich mit dem Linktree: Linktree-Link auf `…/?src=linktree` setzen und Plakate mit eigenen `src`-Werten erzeugen.
Wer die Daten zusätzlich in einer Workflow-App braucht, kann `gdg-track` erweitern (z. B. Webhook nach dem Insert).

## Offen

- [x] Dashboard für die Klickzahlen
- [ ] Workflow-App, die die Daten weiterverarbeitet (Robin) – Ansatzpunkt: `supabase/functions/gdg-track`
- [ ] RSVP direkt auf der Landingpage statt Weiterleitung – nur wenn gdg.community.dev das erlaubt (bei den Betreibern anfragen)

## Lokal

```bash
npm run update   # Event-Snapshot neu ziehen (Node ≥ 20)
npm run dev      # http://localhost:5180
```

Kein Build-Schritt: reines HTML/CSS/JS. `lib/gdg.js` lädt die Daten, `lib/select.js` wählt das Event, `lib/track.js` trackt,
`dashboard.js` zeigt die Statistiken. Auch lokal (`localhost`) getestete Klicks landen im echten Dashboard – zum Testen `?src=test` nutzen.
