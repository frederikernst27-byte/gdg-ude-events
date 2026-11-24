// Shared loader for the gdg.community.dev public API.
// Used by the browser (app.js, live data) and by Node (scripts/update-events.mjs, snapshot).
// The API sends `Access-Control-Allow-Origin: *`, so the browser can call it directly.

export const BASE = "https://gdg.community.dev";
export const CHAPTER_SLUG = "gdg-on-campus-university-of-duisburg-essen-essen-germany";
export const CHAPTER_ID = 3426;
export const CHAPTER_URL = `${BASE}/${CHAPTER_SLUG}/`;

async function getJSON(path, { signal } = {}) {
  const res = await fetch(BASE + path, { headers: { Accept: "application/json" }, signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

// The list endpoint is paginated; follow `links.next` until done.
async function getAllEvents(opts) {
  const events = [];
  let path = `/api/event_slim/for_chapter/${CHAPTER_ID}/?page_size=50`;
  while (path) {
    const page = await getJSON(path, opts);
    events.push(...page.results);
    const next = page.links?.next && new URL(page.links.next);
    path = next ? next.pathname + next.search : null;
  }
  return events;
}

// Venue, tags and the canonical URL only exist on the detail endpoint.
async function getDetails(id, opts) {
  try {
    return await getJSON(`/api/event/${id}/`, opts);
  } catch {
    return {};
  }
}

function slimEvent(e, d) {
  return {
    id: e.id,
    title: e.title,
    description_short: e.description_short || "",
    start_date: e.start_date,
    end_date: e.end_date,
    timezone: e.event_timezone || "Europe/Berlin",
    audience_type: e.audience_type,
    is_virtual: Boolean(e.is_virtual_event),
    picture: e.cropped_picture_url || e.picture || "",
    url: d.url || e.static_url,
    venue_name: d.venue_name || "",
    venue_address: d.venue_address || "",
    venue_city: d.venue_city || "",
    tags: d.tags || [],
  };
}

export async function loadAll(opts = {}) {
  const [chapter, team, rawEvents] = await Promise.all([
    getJSON(`/api/chapter_slim/${CHAPTER_SLUG}/`, opts),
    getJSON(`/api/chapter_slim/${CHAPTER_SLUG}/team/`, opts),
    getAllEvents(opts),
  ]);

  const visible = rawEvents.filter((e) => !e.is_hidden);
  const details = await Promise.all(visible.map((e) => getDetails(e.id, opts)));
  const events = visible
    .map((e, i) => slimEvent(e, details[i]))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  return {
    updated_at: new Date().toISOString(),
    chapter: {
      id: chapter.id,
      title: chapter.title,
      url: chapter.url || CHAPTER_URL,
      members_count: chapter.members_count,
      instagram_handle: chapter.instagram_handle,
      website: chapter.website,
    },
    team: team.map((m) => ({
      name: m.user.full_name,
      role: m.title,
      avatar: m.user.cropped_avatar_url || m.user.avatar?.thumbnail_url || "",
      profile_url: m.user.profile_url ? BASE + m.user.profile_url : "",
    })),
    events,
  };
}
