import { loadAll, CHAPTER_URL } from "./lib/gdg.js";
import { fmt, timeRange, venue, safeUrl } from "./lib/format.js";
import { pickEvent, present, upcomingOf } from "./lib/select.js";
import { track } from "./lib/track.js";
import { CONFIG } from "./events.config.js";

// Event landing page: hook → one-click sign-up → "Mehr von uns".
// Without ?e= it always shows the next upcoming event, so a single QR code
// on every poster keeps working. ?e=<slug|id> pins one event.
// Data: bundled snapshot first, then live from gdg.community.dev.

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const icon = (id) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<use href="#${id}"/>`;
  return svg;
};

const key = new URLSearchParams(location.search).get("e");
const state = { data: null, current: null, viewTracked: false };

const dayLabel = (e) => fmt(e.start_date, e.timezone, { weekday: "short", day: "numeric", month: "long" });
const shortDay = (e) => fmt(e.start_date, e.timezone, { day: "numeric", month: "short" });

function renderEvent(event, mode) {
  const card = $("#event");
  card.setAttribute("aria-busy", "false");

  if (!event) {
    card.classList.add("is-empty");
    $("#kicker").textContent = "Bald geht's weiter";
    $("#hook").textContent = "Gerade ist kein Event geplant";
    $("#text").textContent = "Das nächste Event erscheint hier automatisch, sobald es veröffentlicht ist. Werde Mitglied, dann bekommst du Bescheid.";
    $("#facts").replaceChildren();
    $("#event-img").hidden = true;
    const btn = $("#register");
    btn.href = safeUrl(state.data?.chapter.url);
    btn.firstChild.textContent = "Mitglied werden ";
    $(".hint").textContent = "Kostenlos auf gdg.community.dev.";
    document.title = "GDG on Campus UDE";
    return;
  }

  const p = present(event);
  $("#kicker").textContent = mode === "fallback" ? "Nächstes Event" : p.kicker;
  $("#hook").textContent = p.hook;
  $("#text").textContent = p.text;
  $("#facts").replaceChildren(
    el("li", {}, icon("i-calendar"), dayLabel(event)),
    el("li", {}, icon("i-clock"), `${timeRange(event)} Uhr`),
    el("li", {}, icon("i-pin"), venue(event))
  );
  const img = $("#event-img");
  if (event.picture) Object.assign(img, { src: event.picture, hidden: false });

  const url = safeUrl(event.url);
  $("#register").href = url;
  $("#register-again").href = url;
  document.title = `${p.hook} · GDG on Campus UDE`;
}

function renderMore(events, current) {
  const others = upcomingOf(events).filter((e) => e.id !== current?.id).slice(0, 3);
  $("#more-intro").textContent = others.length
    ? "Wir hosten noch mehr Events – schau rein:"
    : "GDG on Campus ist die studentische Tech-Community an der UDE: Talks, Workshops und Leute, die gerne bauen.";
  $("#next-list").replaceChildren(
    ...others.map((e) => {
      const a = el(
        "a",
        { className: "next-item", href: `?e=${encodeURIComponent(present(e).slug)}` },
        el("span", { className: "next-date", textContent: shortDay(e) }),
        el("span", { className: "next-title", textContent: present(e).hook }),
        icon("i-arrow")
      );
      a.addEventListener("click", () => track("more_event_click", { event_id: e.id }));
      return el("li", {}, a);
    })
  );

  const members = state.data?.chapter.members_count;
  if (members) $("#members").textContent = `${members} Mitglieder auf gdg.community.dev`;
}

function render() {
  const { event, mode } = pickEvent(state.data.events, key);
  state.current = event;
  renderEvent(event, mode);
  renderMore(state.data.events, event);

  // Count the view once, after we know which event it was.
  if (!state.viewTracked) {
    state.viewTracked = true;
    track("page_view", { event_id: event?.id ?? null, mode });
  }
}

function wire() {
  $("#register").addEventListener("click", () => {
    track("register_click", { event_id: state.current?.id ?? null });
    if (!state.current) return;
    // The sign-up itself happens on gdg.community.dev (new tab); this tab
    // stays here and points to the other events.
    $("#signup").hidden = true;
    $("#done").hidden = false;
    $("#done").focus({ preventScroll: true });
  });
  document.querySelectorAll("[data-more]").forEach((a) => a.addEventListener("click", () => track("more_link_click", { target: a.dataset.more })));
  $('[data-more="linktree"]').href = CONFIG.links.linktree;
  $('[data-more="instagram"]').href = CONFIG.links.instagram;
}

async function boot() {
  wire();
  const snapshot = fetch("data/gdg.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => {
      if (!state.data) {
        state.data = data;
        render();
      }
    })
    .catch(() => {});

  try {
    state.data = await loadAll({ signal: AbortSignal.timeout(10000) });
    render();
  } catch (err) {
    console.warn("Live GDG data unavailable, using snapshot:", err);
    await snapshot;
    if (!state.data) {
      $("#hook").textContent = "Events konnten gerade nicht geladen werden";
      $("#text").replaceChildren(el("a", { href: CHAPTER_URL, textContent: "Direkt auf gdg.community.dev ansehen" }));
      $("#event").setAttribute("aria-busy", "false");
    }
  }
}

boot();
