// GENERATED from verse-map.jsx by scripts/build-jsx.mjs — do not edit; edit the .jsx and run `npm run build`.
(function () {
// CODEX — verse map · sci-fi geo + chronological context for any verse.
//
// On open: looks up cached map data; if absent, asks Claude (Haiku, cheap)
// for a JSON profile of the verse's setting:
//   { place, modernEquivalent, region, era, century, lat, lng,
//     summary, populations, structures, neighbours, period }
//
// Renders a stylised coordinate field — a hex-grid Levant/Mediterranean
// projection — with a pulsing marker at the verse's lat/lng plus an
// info panel of period context. Cached forever in localStorage by verse key
// (`codex.maps.${bookId}.${chapter}.${verse}`) so re-opens are instant and
// offline-safe.
//
// Sci-fi treatment: corner brackets, scanlines, monospace coordinates,
// cyan accent, faint grid + concentric rings around the marker.

const MAP_PROMPT = `You are CODEX MAP — a scholarly cartographer for biblical passages. Given a verse reference and its text, identify the PRIMARY geographic and historical setting and return a single JSON object. No prose, no fences, only the JSON.

Schema:
{
  "place":            "Best-known historical name (e.g. 'Jerusalem', 'Galilee of the Gentiles', 'Babylon', 'Patmos')",
  "modernEquivalent": "Modern country / city if useful (e.g. 'Israel', 'Iraq')",
  "region":           "Broader region (e.g. 'Judea', 'Asia Minor', 'Mesopotamia')",
  "era":              "Era label (e.g. 'Late Bronze Age', 'Second Temple period', 'Pax Romana')",
  "century":          "Approx century in BCE/CE (e.g. '1st cent. CE', 'c. 6th cent. BCE')",
  "verseYear":        <single approximate year for the verse itself, integer; negative = BCE>,
  "lat":              <decimal degrees, north positive>,
  "lng":              <decimal degrees, east positive>,

  "pointsOfInterest": [
    // 4–10 specific named places mentioned in OR directly relevant to this
    // verse: cities, mountains, seas, rivers, sites. Real lat/lng only.
    // Do NOT repeat the main location. Keep names short (1–3 words).
    // 'kind' is one of: city · town · mountain · river · sea · lake · region · ruin · road · island
    // 'from' / 'to' are years (negative=BCE) bounding when this place was
    // KNOWN BY THIS NAME. The reader's year-slider will hide a POI when the
    // current year falls outside [from, to]. For natural features that
    // existed throughout (mountains, rivers, seas) use { from: -3000, to: 2026 }.
    // For cities that were renamed, set 'to' to the rename date and add a
    // SEPARATE entry for the later name (e.g. Constantinople 330–1453,
    // Istanbul 1453–2026).
    { "name": "Bethsaida",   "lat": 32.91, "lng": 35.63, "kind": "city",     "from": -1000, "to": 1100, "wiki": "Bethsaida" },
    { "name": "Sea of Galilee", "lat": 32.83, "lng": 35.59, "kind": "lake",  "from": -3000, "to": 2026, "wiki": "Sea_of_Galilee" },
    { "name": "Mt. Hermon",  "lat": 33.42, "lng": 35.85, "kind": "mountain", "from": -3000, "to": 2026, "wiki": "Mount_Hermon" }
    // 'wiki' = optional Wikipedia article slug. When present, the map popup
    // fetches the page summary thumbnail from the Wikipedia REST API and
    // renders it as a preview image. Always use the EN-Wikipedia slug.
  ],

  "summary":          "2 sentences situating the passage geographically and historically.",
  "populations":      "1 sentence on who lived there at that time.",
  "structures":       "1 sentence on notable buildings / sites of the period.",
  "neighbours":       "1 sentence on adjacent powers or peoples.",
  "period":           "1 sentence on the political/religious climate at the time.",

  "polities": [
    // Full chronological history of polities/powers controlling THIS lat/lng.
    // From the earliest reasonable record to 2026 CE. Years are integers.
    // 'from' and 'to' are years (negative = BCE). Use real, attested names.
    // 8–18 entries typical. Include borderland / occupation / mandate periods.
    { "from": -2000, "to": -1200, "name": "Canaan" },
    { "from": -1200, "to":  -930, "name": "Israelite tribal confederacy" },
    { "from":  -930, "to":  -722, "name": "Kingdom of Israel (Northern)" }
    // … continue through the present, ending with the current 2020s polity.
  ],

  "theoryNames": [
    // Optional. 0–3 fringe / disputed / esoteric / theoretical historical
    // names sometimes attached to the broader region by alternative
    // historians, perennialists, or curious cartographers (e.g. 'Tartaria',
    // 'Cush', 'Hyperborea'). Each entry: { name, note }. note is a short
    // SCHOLARLY explanation that this is non-mainstream — never endorse.
    { "name": "Tartaria", "note": "speculative 18th-c. cartographic label sometimes applied to Eurasian interior; not historically accurate for this site" }
  ]
}

Rules:
- If the verse is non-geographic (a parable, doxology, etc.), use the most likely physical setting where it was spoken/written.
- Coordinates must be real-world lat/lng. No invented numbers.
- pointsOfInterest: 3–7 specific places relevant to the verse (excluding the main location). Use real lat/lng. Mix kinds when sensible (city + landmark + body of water). Each POI should include a 'wiki' field with the EN-Wikipedia article slug (underscored, e.g. "Mount_Hermon", "Sea_of_Galilee", "Bethsaida") whenever you are confident the article exists. Empty string if unsure — a fallback image search will run.
- Polities array: cover from earliest known to 2026 CE for the location. No gaps. Use accurate names per period (e.g. 'Roman Judea' 6–135 CE, 'Syria Palaestina' 135–390, 'Byzantine Palaestina Prima' 390–636, 'Rashidun/Umayyad/Abbasid' periods, 'Crusader Kingdom of Jerusalem' 1099–1291, 'Mamluk Sultanate', 'Ottoman Empire' 1517–1917, 'British Mandate of Palestine' 1920–1948, 'State of Israel' 1948–present, etc.). For Mesopotamia chain Sumer→Akkad→Babylon→Assyria→Neo-Babylon→Achaemenid Persia→Seleucid→Parthian→Sasanian→Caliphates→Ottoman→Iraq. Adapt for the actual location.
- theoryNames: 0–3 only, MUST include scholarly note marking as speculative. Skip if none plausible.
- verseYear: best estimate of when the verse's events happened (or the book was written for non-narrative texts).
- Calm scholarly tone. No exclamations. No emoji.
- Return ONLY the JSON object.`;

// AI-activity beacon — window.CODEX_AI_BUSY (artifacts.jsx) is an object:
// begin(label) → id / end(id). One outstanding id per source; typed-guarded
// so a missing/older surface never throws.
const _mapBusyIds = new Map();
function mapAiBusy(on, source) {
  try {
    const bus = window.CODEX_AI_BUSY;
    if (!bus || typeof bus.begin !== "function" || typeof bus.end !== "function") return;
    if (on) {
      if (_mapBusyIds.has(source)) return;
      _mapBusyIds.set(source, bus.begin("MAP · " + (source || "intel")));
    } else {
      const id = _mapBusyIds.get(source);
      if (id != null) {bus.end(id);_mapBusyIds.delete(source);}
    }
  } catch {}
}

function prefersReducedMotion() {
  try {return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;}
  catch {return false;}
}

// Significance by kind — settlements (where the story happens) outrank the
// standing furniture of the earth. Drives the marker pulse cadence.
function poiSignificance(kind) {
  switch ((kind || "").toLowerCase()) {
    case "city":return 3;
    case "town":case "ruin":
    case "region":case "island":return 2;
    default:return 1; // mountain · river · sea · lake · road
  }
}

function VerseMap({ verse, refStr, verseText, passage, primary, onClose }) {
  // `verse` arrives as a verse object ({n}) from the verse menu but as a
  // bare NUMBER from the keyboard "m" shortcut — normalise or the cache key
  // ends in "undefined".
  const initV = typeof verse === "number" ? verse : verse && verse.n || 1;

  // Live cursor — the map FOLLOWS the reader. Every codex:now (chip click,
  // keyboard nav, any surface) retargets the camera: cinematic fly-to.
  const [cur, setCur] = useState({
    bookId: passage.bookId, chapter: passage.chapter, verse: initV,
    refStr, verseText: verseText || ""
  });
  useEffect(() => {
    const onNow = (e) => {
      const n = e.detail || window.CODEX_NOW;
      if (!n || !n.bookId) return;
      setCur((c) => c.bookId === n.bookId && c.chapter === n.chapter && c.verse === n.verse ?
      c :
      { bookId: n.bookId, chapter: n.chapter, verse: n.verse, refStr: n.ref || c.refStr, verseText: "" });
    };
    window.addEventListener("codex:now", onNow);
    return () => window.removeEventListener("codex:now", onNow);
  }, []);

  const key = `codex.maps.${cur.bookId}.${cur.chapter}.${cur.verse}`;
  // Mirror cache key for the same verse — the RESONANCE layer plots the
  // Mirror console's geocoded events on this map.
  const mirrorKey = `codex.mirrors.${cur.bookId}.${cur.chapter}.${cur.verse}`;

  const [data, setData] = useState(() => {
    try {const raw = localStorage.getItem(key);if (raw) return JSON.parse(raw);}
    catch {}
    return null;
  });
  const dataRef = useRef(data);dataRef.current = data;
  const [err, setErr] = useState(null); // fatal: nothing to show
  const [softErr, setSoftErr] = useState(null); // refetch failed: keep last fix
  const [loading, setLoading] = useState(!data); // first light only
  const [refetching, setRefetching] = useState(false); // verse changed under an open map

  // Self-injected styles for the v2 surface (dossier, scrub, orb, a11y list).
  // styles.css is owned by a parallel build — idempotent <style id> pattern.
  useEffect(() => {injectMapXCSS();}, []);

  useEffect(() => {
    let cancelled = false;
    setSoftErr(null);
    // Cache-first: re-opens and revisited verses are instant + offline-safe.
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const obj = JSON.parse(raw);
        setData(obj);setErr(null);setLoading(false);setRefetching(false);
        return;
      }
    } catch {}
    (async () => {
      if (dataRef.current) setRefetching(true);else setLoading(true);
      mapAiBusy(true, "map");
      try {
        // Canonical AI pipeline (intel.jsx): engine resolution, fence-strip,
        // tolerant parse, and — critically — readable error strings instead
        // of "[object Object]" when the provider returns a structured error.
        const obj = await window.CODEX_INTEL.intelAI({
          system: MAP_PROMPT,
          user: `Verse: ${cur.refStr}\nText: ${cur.verseText}\n\nReturn the JSON object.`,
          maxTokens: 2400
        });
        if (typeof obj.lat !== "number" || typeof obj.lng !== "number") throw new Error("Map response missing coordinates");
        if (cancelled) return;
        try {localStorage.setItem(key, JSON.stringify(obj));} catch {}
        setData(obj);
        setErr(null);
      } catch (e) {
        if (cancelled) return;
        // Keep the last fix on screen when a NEW verse fails to resolve —
        // blanking a working map is worse than an honest "last fix" chip.
        if (dataRef.current) setSoftErr(String(e.message || e));else
        setErr(String(e.message || e));
      } finally {
        mapAiBusy(false, "map");
        if (!cancelled) {setLoading(false);setRefetching(false);}
      }
    })();
    return () => {cancelled = true;mapAiBusy(false, "map");};
  }, [key]);

  // ESC closes the modal
  useEffect(() => {
    const onKey = (e) => {if (e.key === "Escape") onClose();};
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-map-backdrop", onClick: onClose, role: "dialog", "aria-label": "Verse map" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-map", onClick: (e) => e.stopPropagation() }, /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tl" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-tr" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-bl" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-corner cx-br" }), /*#__PURE__*/

    React.createElement("header", { className: "cx-map-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-map-h-tag" }, "CODEX \xB7 MAP"), /*#__PURE__*/
    React.createElement("span", { className: "cx-map-h-ref" }, cur.refStr), /*#__PURE__*/
    React.createElement("button", { className: "cx-map-x", onClick: onClose, "aria-label": "Close", title: "Close (ESC)" }, "\xD7")
    ),

    loading && !data ? /*#__PURE__*/
    React.createElement("div", { className: "cx-map-loading" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-map-spin" }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null)), /*#__PURE__*/
    React.createElement("span", null, "TRIANGULATING \xB7 ", cur.refStr), /*#__PURE__*/
    React.createElement("span", { className: "cx-map-loading-sub" }, "resolving place \xB7 era \xB7 context across cartographic record\u2026")
    ) :
    err && !data ? /*#__PURE__*/
    React.createElement("div", { className: "cx-map-err" }, /*#__PURE__*/
    React.createElement("b", null, "MAP ORACLE OFFLINE"), /*#__PURE__*/
    React.createElement("code", null, err)
    ) :
    data ? /*#__PURE__*/
    React.createElement(MapBody, {
      data: data,
      mirrorKey: mirrorKey,
      refStr: cur.refStr,
      cur: cur,
      refetching: refetching,
      softErr: softErr,
      onRefresh: () => {
        try {localStorage.removeItem(key);} catch {}
        setData(null);
        setLoading(true);
        setErr(null);
      } }
    ) :
    null
    )
    ));

}

// Tolerant JSON parsing now lives in the shared intel layer (intel.jsx) —
// one canonical implementation for map/mirror/art instead of three copies.
function parseMapJSON(s) {return window.CODEX_INTEL.intelParseJSON(s);}

// Glyph per POI kind — keeps the map legible without needing icon assets.
function poiGlyph(kind) {
  switch ((kind || "").toLowerCase()) {
    case "city":return "▣";
    case "town":return "◇";
    case "mountain":return "△";
    case "river":return "≈";
    case "sea":
    case "lake":return "◯";
    case "region":return "▭";
    case "ruin":return "◰";
    case "road":return "—";
    case "island":return "◐";
    default:return "•";
  }
}

// Year formatting + HTML escaping delegate to the shared intel layer.
function fmtYear(y) {return window.CODEX_INTEL.intelFmtYear(y);}

// ── Map body — coordinate field on the left, info column on the right ──
// Bounds (Iberia → Persia, North Africa → Anatolia) + simplified
// equirectangular projection. The cartography below is a hand-traced
// stylisation: the seas are filled polygons, the major rivers are lines.
// It's not survey-grade — it's there to give the marker physical context
// (you can see whether a place is on a coast, by a river, in the desert).
const BOUNDS = { lngMin: -10, lngMax: 60, latMin: 18, latMax: 48 };
const MAP_W = 520,MAP_H = 280;
function projXY(lat, lng) {
  return [
  (lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin) * MAP_W,
  (BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin) * MAP_H];

}
function pointsAttr(latLngArr) {
  return latLngArr.map(([lat, lng]) => projXY(lat, lng).join(",")).join(" ");
}

// Stylised, rounded outlines of the major water bodies in the frame.
// Coordinates are [lat, lng] pairs traced from real coastline geometry but
// smoothed for legibility at this ~520×280 viewport.
const SEAS = {
  mediterranean: [
  [36, -5], [36.5, -3], [37.2, 0], [38.0, 4], [38.4, 8], [38.8, 12],
  [37.5, 13], [37.0, 15.5], [36.5, 17],
  [37.5, 18.5], [38.5, 19], [40.0, 19.5], [40.5, 20.5],
  [40.0, 23], [38.8, 24.5], [36.5, 27],
  [36.4, 30], [36.1, 32.5], [36.3, 35.5], [35.5, 35.5],
  [33.0, 35.0], [31.4, 34.5], [31.0, 32.5], [31.4, 30.5],
  [32.0, 28], [32.5, 24], [33.0, 20], [33.5, 17], [34.5, 14],
  [37.0, 11], [37.0, 8], [36.5, 4], [36.2, 0], [36.0, -4], [36, -5]],

  blackSea: [
  [41.0, 28], [42.5, 28], [44.5, 31], [46.5, 34], [46.5, 38],
  [45.0, 40.5], [42.0, 41.5], [41.5, 39], [41.5, 35], [41.0, 32], [41.0, 28]],

  redSea: [
  [28.0, 33.0], [27.0, 34.0], [25.5, 35.0], [22.0, 37.5], [19.5, 39.5],
  [18.0, 41.5], [19.5, 42.5], [21.5, 41.0], [24.0, 38.5], [26.5, 36.0],
  [28.0, 34.5], [28.0, 33.0]],

  persianGulf: [
  [30.0, 48.0], [29.0, 49.0], [27.5, 50.0], [25.5, 51.5], [24.0, 53.5],
  [25.5, 56.0], [26.5, 56.0], [27.5, 53.5], [29.0, 50.5], [30.0, 49.0], [30.0, 48.0]],

  caspianSea: [
  [47.0, 47.0], [47.0, 48.5], [46.0, 50.5], [44.0, 52.0], [42.0, 51.0],
  [40.0, 50.0], [38.5, 50.5], [37.0, 51.5], [37.5, 52.5], [40.0, 53.0],
  [42.0, 53.5], [44.5, 51.0], [47.0, 49.0], [47.0, 47.0]]

};

// Major rivers — sequences of [lat, lng]; rendered as polylines.
const RIVERS = {
  nile: [[31.4, 30.4], [29.5, 31.0], [27.5, 31.5], [25.5, 32.5], [24.0, 32.9], [21.0, 31.5], [18.0, 31.0]],
  tigris: [[37.5, 41.5], [36.5, 42.5], [35.0, 43.5], [34.0, 44.4], [32.5, 45.5], [31.0, 46.5], [30.5, 47.5]],
  euphr: [[37.5, 38.5], [36.0, 39.5], [35.0, 40.5], [33.5, 42.0], [32.0, 44.0], [31.0, 45.5], [30.5, 47.5]],
  jordan: [[33.3, 35.6], [32.8, 35.55], [32.2, 35.5], [31.7, 35.5]]
};

function MapBody({ data, mirrorKey, refStr, cur, refetching, softErr, onRefresh }) {
  const [px, py] = projXY(data.lat, data.lng);
  const inBounds = px >= 0 && px <= MAP_W && py >= 0 && py <= MAP_H;
  const cx = inBounds ? px : Math.max(8, Math.min(MAP_W - 8, px));
  const cy = inBounds ? py : Math.max(8, Math.min(MAP_H - 8, py));

  // ── Tourist Mode + overlays state lifted to MapBody so the side panel
  // ("PLACES NEAR YOU") and the Leaflet field share it. The map listens for
  // window events to add/remove its own layers — keeps coupling loose.
  const [touristOn, setTouristOn] = useState(false);
  const [tourist, setTourist] = useState(null); // { your_location, places: [...], ... }
  const [touristErr, setTouristErr] = useState(null);
  const [touristLoading, setTouristLoading] = useState(false);
  const [userPos, setUserPos] = useState(null); // { lat, lng, accuracy }
  const [selectedPlace, setSelectedPlace] = useState(null);
  // ── POI dossier — the click IS the document. Markers and the a11y list
  // both route through the codex:map-poi bus; the card renders IN-SURFACE
  // (no popup, no modal) with wiki intel + ✦ READ chips → codexGoto.
  const [dossier, setDossier] = useState(null);
  useEffect(() => {
    const onPoi = (e) => {if (e.detail && e.detail.poi) setDossier(e.detail.poi);};
    window.addEventListener("codex:map-poi", onPoi);
    return () => window.removeEventListener("codex:map-poi", onPoi);
  }, []);
  // New verse → new theatre; close the stale dossier.
  useEffect(() => {setDossier(null);}, [data.place, data.lat, data.lng]);
  const [overlays, setOverlays] = useState({ biblical: true, pilgrimage: false, manuscripts: false, empires: false, mine: true, resonance: false, network: false });
  const [discoveredCount, setDiscoveredCount] = useState(() => {
    try {return Object.keys(JSON.parse(localStorage.getItem("codex.discovered") || "{}")).length;}
    catch {return 0;}
  });

  // GPS — graceful permission flow. maximumAge 60s = no spam, enableHighAccuracy
  // because the user explicitly opted in. Fail-open with a hint.
  const requestGPS = useCallback(() => {
    setTouristErr(null);
    if (!navigator.geolocation) {
      setTouristErr("Geolocation not supported on this device.");
      return;
    }
    setTouristLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setUserPos(p);
        window.dispatchEvent(new CustomEvent("codex:userpos", { detail: p }));
        fetchTourist(p);
      },
      (err) => {
        setTouristLoading(false);
        setTouristErr(err.code === 1 ?
        "Location denied. Enable location in your browser to use Tourist mode." :
        `Location unavailable (${err.message || "unknown"}).`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const fetchTourist = useCallback(async (pos) => {
    setTouristLoading(true);
    setTouristErr(null);
    const cacheKey = touristCacheKey(pos);
    try {
      const cached = readTouristCache(cacheKey);
      if (cached) {
        setTourist(cached);
        setTouristLoading(false);
        window.dispatchEvent(new CustomEvent("codex:tourist", { detail: { tourist: cached, pos } }));
        return;
      }
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          system: TOURIST_PROMPT,
          messages: [{
            role: "user",
            content: `User location: lat ${pos.lat.toFixed(4)}, lng ${pos.lng.toFixed(4)} (±${Math.round(pos.accuracy || 0)}m).\nList biblical/historical/sacred-text places within 50 km. Return ONLY the JSON object.`
          }],
          max_tokens: 2600
        })
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      const text = (body.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      const i = text.indexOf("{");
      if (i === -1) throw new Error("Tourist response not JSON");
      const obj = parseMapJSON(text.slice(i));
      writeTouristCache(cacheKey, obj);
      setTourist(obj);
      setTouristLoading(false);
      window.dispatchEvent(new CustomEvent("codex:tourist", { detail: { tourist: obj, pos } }));
    } catch (e) {
      setTouristErr(String(e.message || e));
      setTouristLoading(false);
    }
  }, []);

  const onToggleTourist = useCallback(() => {
    const next = !touristOn;
    setTouristOn(next);
    window.dispatchEvent(new CustomEvent("codex:tourist-mode", { detail: { on: next } }));
    if (next && !userPos) requestGPS();else
    if (next && userPos && !tourist) fetchTourist(userPos);
  }, [touristOn, userPos, tourist, requestGPS, fetchTourist]);

  const onSelectPlace = useCallback((place) => {
    setSelectedPlace(place);
    window.dispatchEvent(new CustomEvent("codex:tourist-select", { detail: { place, from: userPos } }));
  }, [userPos]);

  const onToggleOverlay = useCallback((k) => {
    setOverlays((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      window.dispatchEvent(new CustomEvent("codex:overlays", { detail: { ...next, _changed: k, _on: next[k] } }));
      return next;
    });
  }, []);

  // Refresh discovered count when LeafletField broadcasts a new discovery.
  useEffect(() => {
    const onDisc = () => {
      try {setDiscoveredCount(Object.keys(JSON.parse(localStorage.getItem("codex.discovered") || "{}")).length);}
      catch {}
    };
    window.addEventListener("codex:discovered", onDisc);
    return () => window.removeEventListener("codex:discovered", onDisc);
  }, []);

  // Reference cities — anchor your eye whether or not the verse is in view.
  const REF = [
  { name: "Jerusalem", lat: 31.78, lng: 35.22 },
  { name: "Rome", lat: 41.90, lng: 12.50 },
  { name: "Babylon", lat: 32.54, lng: 44.42 },
  { name: "Athens", lat: 37.98, lng: 23.73 },
  { name: "Alexandria", lat: 31.20, lng: 29.92 },
  { name: "Damascus", lat: 33.51, lng: 36.30 },
  { name: "Antioch", lat: 36.20, lng: 36.16 },
  { name: "Patmos", lat: 37.31, lng: 26.55 },
  { name: "Carthage", lat: 36.85, lng: 10.32 },
  { name: "Memphis", lat: 29.84, lng: 31.25 }];

  // Filter out duplicates if the verse marker overlaps a reference.
  const proj = projXY;

  return (/*#__PURE__*/
    React.createElement("div", { className: `cx-map-body ${touristOn ? "is-tourist" : ""}` }, /*#__PURE__*/
    React.createElement("div", { className: "cx-map-field-wrap" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-map-controls" }, /*#__PURE__*/
    React.createElement("button", {
      className: `cx-map-ctrl cx-map-ctrl-tourist ${touristOn ? "is-on" : ""}`,
      onClick: onToggleTourist,
      title: "Tourist mode \u2014 show biblical sites near you" },
    touristOn ? "◉ TOURIST" : "○ TOURIST"), /*#__PURE__*/
    React.createElement("div", { className: "cx-map-ctrl-layers", role: "group", "aria-label": "Map layers" }, /*#__PURE__*/
    React.createElement("button", { className: `cx-map-layer ${overlays.biblical ? "is-on" : ""}`, onClick: () => onToggleOverlay("biblical"), title: "Biblical events" }, "\u2726"), /*#__PURE__*/
    React.createElement("button", { className: `cx-map-layer ${overlays.pilgrimage ? "is-on" : ""}`, onClick: () => onToggleOverlay("pilgrimage"), title: "Pilgrimage routes" }, "\u25EF"), /*#__PURE__*/
    React.createElement("button", { className: `cx-map-layer ${overlays.manuscripts ? "is-on" : ""}`, onClick: () => onToggleOverlay("manuscripts"), title: "Manuscript discoveries" }, "\u2B21"), /*#__PURE__*/
    React.createElement("button", { className: `cx-map-layer ${overlays.empires ? "is-on" : ""}`, onClick: () => onToggleOverlay("empires"), title: "Empire borders (era)" }, "\u2630"), /*#__PURE__*/
    React.createElement("button", { className: `cx-map-layer ${overlays.mine ? "is-on" : ""}`, onClick: () => onToggleOverlay("mine"), title: "My discoveries" }, "\u2690"), /*#__PURE__*/
    React.createElement("button", { className: `cx-map-layer ${overlays.resonance ? "is-on" : ""}`, onClick: () => onToggleOverlay("resonance"), title: "Resonance \u2014 Mirror events plotted with arcs" }, "\u2316"), /*#__PURE__*/
    React.createElement("button", { className: `cx-map-layer ${overlays.network ? "is-on" : ""}`, onClick: () => onToggleOverlay("network"), title: "Known sites \u2014 every verse you've mapped" }, "\u25C8")
    ), /*#__PURE__*/
    React.createElement("span", { className: "cx-map-discovered", title: "Sites you have discovered" }, "\uD83C\uDFDB ", discoveredCount)
    ), /*#__PURE__*/
    React.createElement(LeafletField, { data: data, mirrorKey: mirrorKey }), /*#__PURE__*/


    React.createElement("div", { className: "cx-mapx-eraglow", "aria-hidden": "true" }),


    refetching ? /*#__PURE__*/
    React.createElement("div", { className: "cx-mapx-busy", role: "status" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-mapx-orb" }), /*#__PURE__*/
    React.createElement("span", null, "RESOLVING \xB7 ", refStr)
    ) :
    null,
    softErr ? /*#__PURE__*/
    React.createElement("div", { className: "cx-mapx-softerr", role: "status", title: softErr }, "\u26A0 MAP ORACLE OFFLINE \xB7 showing last fix"

    ) :
    null,


    dossier ? /*#__PURE__*/
    React.createElement(PoiDossier, {
      key: (dossier.name || "") + (dossier.lat || ""),
      poi: dossier,
      cur: cur,
      onClose: () => setDossier(null) }
    ) :
    null, /*#__PURE__*/



    React.createElement("nav", { className: "cx-mapx-alist-wrap", "aria-label": "Points of interest" }, /*#__PURE__*/
    React.createElement("ul", { className: "cx-mapx-alist" }, /*#__PURE__*/
    React.createElement("li", null, /*#__PURE__*/
    React.createElement("button", { onClick: () => {
        window.dispatchEvent(new CustomEvent("codex:map-poi", { detail: { poi: { name: data.place, kind: "site", lat: data.lat, lng: data.lng, wiki: "", main: true } } }));
        window.dispatchEvent(new CustomEvent("codex:map-fly", { detail: { lat: data.lat, lng: data.lng, zoom: 7 } }));
      } }, "\u2316 ", data.place)
    ),
    (data.pointsOfInterest || []).map((p, i) => /*#__PURE__*/
    React.createElement("li", { key: i }, /*#__PURE__*/
    React.createElement("button", { onClick: () => {
        window.dispatchEvent(new CustomEvent("codex:map-poi", { detail: { poi: p } }));
        window.dispatchEvent(new CustomEvent("codex:map-fly", { detail: { lat: p.lat, lng: p.lng, zoom: 8 } }));
      } }, poiGlyph(p.kind), " ", p.name)
    )
    )
    )
    ),


    Array.isArray(data.polities) && data.polities.length > 0 ? /*#__PURE__*/
    React.createElement(FootScrub, { key: `${data.place}:${data.lat}`, polities: data.polities, verseYear: data.verseYear }) :
    null, /*#__PURE__*/

    React.createElement("div", { className: "cx-map-coords" }, /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "LAT"), " ", data.lat?.toFixed(3), "\xB0"), /*#__PURE__*/
    React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "LNG"), " ", data.lng?.toFixed(3), "\xB0"), /*#__PURE__*/
    React.createElement("span", { className: "cx-mapx-coords-era", id: "cx-map-era", "aria-live": "polite" }), /*#__PURE__*/
    React.createElement("span", { className: "cx-map-cursor", id: "cx-map-cursor", "aria-hidden": "true" })
    ),
    touristOn ? /*#__PURE__*/
    React.createElement(TouristPanel, {
      loading: touristLoading,
      err: touristErr,
      tourist: tourist,
      userPos: userPos,
      selected: selectedPlace,
      onSelect: onSelectPlace,
      onRetry: requestGPS }
    ) :
    null
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-map-info" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-map-info-place" }, /*#__PURE__*/
    React.createElement("h3", null, data.place),
    data.modernEquivalent ? /*#__PURE__*/React.createElement("span", { className: "cx-map-info-modern" }, "today: ", data.modernEquivalent) : null,
    data.region ? /*#__PURE__*/React.createElement("span", { className: "cx-map-info-region" }, data.region) : null
    ),

    Array.isArray(data.polities) && data.polities.length > 0 ? /*#__PURE__*/
    React.createElement(PolityTimeline, { polities: data.polities, verseYear: data.verseYear, theoryNames: data.theoryNames }) :
    null, /*#__PURE__*/

    React.createElement("div", { className: "cx-map-info-era" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-map-info-era-tag" }, "ERA"), /*#__PURE__*/
    React.createElement("span", { className: "cx-map-info-era-name" }, data.era),
    data.century ? /*#__PURE__*/React.createElement("span", { className: "cx-map-info-era-c" }, "\xB7 ", data.century) : null
    ), /*#__PURE__*/

    React.createElement("p", { className: "cx-map-info-summary" }, data.summary),

    data.populations ? /*#__PURE__*/React.createElement(MapField, { label: "POPULATIONS", body: data.populations }) : null,
    data.structures ? /*#__PURE__*/React.createElement(MapField, { label: "STRUCTURES", body: data.structures }) : null,
    data.neighbours ? /*#__PURE__*/React.createElement(MapField, { label: "NEIGHBOURS", body: data.neighbours }) : null,
    data.period ? /*#__PURE__*/React.createElement(MapField, { label: "CLIMATE", body: data.period }) : null
    )
    ));

}

// ── Leaflet field — explorable globe replacing the prior fixed SVG. Uses
// CartoDB Dark Matter / Voyager tiles so the cartography matches the
// theme. Markers are custom HTML divIcons so they share the sci-fi
// aesthetic. POIs filter by the year slider (via window event from
// PolityTimeline) so as the user scrubs through history, places that
// don't yet exist (or no longer exist) fade away.
function LeafletField({ data, mirrorKey }) {
  const wrapRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ poi: null, marker: null, tile: null });
  const [year, setYear] = useState(typeof data.verseYear === "number" ? data.verseYear : 0);
  const dark = !!document.querySelector('.cx-app.is-dark');

  // Initialise once
  useEffect(() => {
    if (!wrapRef.current || mapRef.current || !window.L) return;
    const L = window.L;
    const map = L.map(wrapRef.current, {
      zoomControl: true,
      worldCopyJump: true,
      attributionControl: false,
      preferCanvas: true
    });
    map.setView([data.lat, data.lng], 5);
    L.control.attribution({ prefix: false }).addAttribution(
      '© <a href="https://openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">Carto</a>'
    ).addTo(map);
    mapRef.current = map;
    addTiles(map, dark);
    addMainMarker(map, data);
    redrawPOIs(map, data, year);
    // Live cursor readout — LAT/LNG under the pointer + great-circle range
    // from the verse site. Written straight to the DOM (no React re-render
    // churn at mousemove frequency).
    map.on("mousemove", (e) => {
      const el = document.getElementById("cx-map-cursor");
      if (!el) return;
      const km = haversineKm(data.lat, data.lng, e.latlng.lat, e.latlng.lng);
      const era = window.__CODEX_MAP_ERA && window.__CODEX_MAP_ERA.name ? ` · ${window.__CODEX_MAP_ERA.name}` : "";
      el.textContent = `⌖ ${e.latlng.lat.toFixed(3)}°, ${e.latlng.lng.toFixed(3)}° · ${km < 10 ? km.toFixed(1) : Math.round(km)} km out${era}`;
    });
    map.on("mouseout", () => {
      const el = document.getElementById("cx-map-cursor");
      if (el) el.textContent = "";
    });
    // Camera telemetry — published on every move so any surface (and the
    // smoke harness) can read where the lens is without touching Leaflet.
    const publishCam = () => {
      try {
        const c = map.getCenter();
        window.__CODEX_MAP_CAM = { lat: c.lat, lng: c.lng, zoom: map.getZoom(), at: Date.now() };
      } catch {}
    };
    map.on("move", publishCam);
    map.on("zoomend", publishCam);
    publishCam();
    // Any surface can request a fly-to (a11y POI list, dossier, future ops).
    const onFlyReq = (e) => {
      const d = e.detail || {};
      if (typeof d.lat !== "number" || typeof d.lng !== "number") return;
      const z = typeof d.zoom === "number" ? d.zoom : Math.max(map.getZoom(), 7);
      if (prefersReducedMotion()) map.setView([d.lat, d.lng], z);else
      map.flyTo([d.lat, d.lng], z, { duration: 1.1, easeLinearity: 0.2 });
    };
    window.addEventListener("codex:map-fly", onFlyReq);
    // Force a redraw next frame in case the modal animated in
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      window.removeEventListener("codex:map-fly", onFlyReq);
      map.remove();mapRef.current = null;
    };
  }, []);

  // Theme switch — swap tile layer
  useEffect(() => {
    if (mapRef.current) addTiles(mapRef.current, dark);
  }, [dark]);

  // Cinematic fly-to when the verse moves under an open map (codex:now →
  // new dossier → new theatre). Ease the camera across the earth to the new
  // site; prefers-reduced-motion gets an honest hard cut instead.
  const firstFlight = useRef(true);
  useEffect(() => {
    if (!mapRef.current) return;
    if (firstFlight.current) {firstFlight.current = false;return;} // init already setView'd
    if (prefersReducedMotion()) {
      mapRef.current.setView([data.lat, data.lng], 5);
    } else {
      mapRef.current.flyTo([data.lat, data.lng], 5, { duration: 1.8, easeLinearity: 0.18 });
    }
    addMainMarker(mapRef.current, data);
    redrawPOIs(mapRef.current, data, year);
  }, [data.lat, data.lng, data.place]);

  // Listen for year-slider broadcasts from the PolityTimeline component
  useEffect(() => {
    const onYr = (e) => {
      if (typeof e.detail?.year === "number") {
        setYear(e.detail.year);
        if (mapRef.current) redrawPOIs(mapRef.current, data, e.detail.year);
      }
    };
    window.addEventListener("codex:year", onYr);
    return () => window.removeEventListener("codex:year", onYr);
  }, [data]);

  // Tourist + overlays + discoveries — listen to events from MapBody. We
  // route all of this through the window bus so MapBody owns state and
  // LeafletField owns Leaflet — no prop-drilling spaghetti.
  useEffect(() => {
    const layers = layersRef.current;
    const L = window.L;
    if (!L) return;

    const ensureLayer = (key) => {
      if (!mapRef.current) return null;
      if (!layers[key]) {layers[key] = L.layerGroup().addTo(mapRef.current);}
      return layers[key];
    };
    const clearLayer = (key) => {
      if (layers[key] && mapRef.current) {mapRef.current.removeLayer(layers[key]);layers[key] = null;}
    };

    const onPos = (e) => {
      const p = e.detail;if (!p || !mapRef.current) return;
      clearLayer("user");
      const grp = L.layerGroup().addTo(mapRef.current);
      layers.user = grp;
      const userIcon = L.divIcon({ className: "cx-map-user", html: '<span class="cx-user-core"></span><span class="cx-user-pulse"></span><span class="cx-user-lbl">YOU</span>', iconSize: [14, 14], iconAnchor: [7, 7] });
      L.marker([p.lat, p.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(grp);
      L.circle([p.lat, p.lng], { radius: Math.min(p.accuracy || 100, 2000), color: "#7cf", weight: 1, opacity: 0.4, fillOpacity: 0.05 }).addTo(grp);
      mapRef.current.flyTo([p.lat, p.lng], 10, { duration: 0.9 });
    };

    const onTourist = (e) => {
      const { tourist, pos } = e.detail || {};
      if (!tourist || !mapRef.current) return;
      clearLayer("tourist");
      const grp = L.layerGroup().addTo(mapRef.current);
      layers.tourist = grp;
      const places = Array.isArray(tourist.places) ? tourist.places : [];
      places.forEach((pl, idx) => {
        if (typeof pl.lat !== "number" || typeof pl.lng !== "number") return;
        const icon = L.divIcon({
          className: "cx-map-tourist-pin",
          html: `<span class="cx-tpin-glyph">⛪</span><span class="cx-tpin-lbl">${escapeHtml(pl.name)}</span><span class="cx-tpin-dist">${pl.distance_km != null ? pl.distance_km.toFixed(1) + " km" : ""}</span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        const m = L.marker([pl.lat, pl.lng], { icon, riseOnHover: true }).
        bindPopup(touristPopupHtml(pl), { maxWidth: 280, className: "cx-poi-popup cx-tourist-pop" }).
        addTo(grp);
        m.on("click", () => window.dispatchEvent(new CustomEvent("codex:tourist-select", { detail: { place: pl, from: pos } })));
      });
    };

    const onSelect = (e) => {
      const { place, from } = e.detail || {};
      if (!place || !mapRef.current) return;
      clearLayer("breadcrumbs");
      if (from && typeof place.lat === "number") {
        const line = L.polyline([[from.lat, from.lng], [place.lat, place.lng]], {
          color: "#7cf", weight: 2, opacity: 0.7, dashArray: "6 8",
          className: "cx-map-breadcrumb"
        });
        layers.breadcrumbs = L.layerGroup([line]).addTo(mapRef.current);
        const b = L.latLngBounds([[from.lat, from.lng], [place.lat, place.lng]]).pad(0.4);
        mapRef.current.flyToBounds(b, { duration: 0.9, maxZoom: 11 });
      } else {
        mapRef.current.flyTo([place.lat, place.lng], 11, { duration: 0.9 });
      }
    };

    const onTouristMode = (e) => {
      if (!e.detail?.on) {
        ["tourist", "breadcrumbs", "discoverable", "discovered"].forEach(clearLayer);
      } else {
        drawDiscoverables();
        drawDiscovered();
      }
    };

    const onOverlays = (e) => {
      const o = e.detail || {};
      if (!o.mine) clearLayer("discovered");else drawDiscovered();
      if (!o.pilgrimage) clearLayer("pilgrimage");else drawPilgrimage();
      if (!o.manuscripts) clearLayer("manuscripts");else drawManuscripts();
      if (!o.empires) clearLayer("empires");else drawEmpires(year);
      if (!o.resonance) clearLayer("resonance");else drawResonance();
      if (!o.network) clearLayer("network");else drawNetwork();
      // Biblical = the existing POI layer; toggle visibility.
      if (layers.poi) {
        if (o.biblical) {try {layers.poi.addTo(mapRef.current);} catch {}} else
        {try {mapRef.current.removeLayer(layers.poi);} catch {}}
      }
      // When a layer is just ENABLED, reveal it — fit the map to its content
      // and report how much it shows. The toggles used to draw far-away data
      // (Holy-Land-centric) off-screen with zero feedback, so they felt dead.
      if (o._changed && o._on && mapRef.current) {
        const groupKey = { mine: "discovered", pilgrimage: "pilgrimage", manuscripts: "manuscripts", empires: "empires", biblical: "poi", resonance: "resonance", network: "network" }[o._changed];
        const label = { mine: "⚐ My discoveries", pilgrimage: "◯ Pilgrimage routes", manuscripts: "⬡ Manuscript sites", empires: "☰ Empire borders", biblical: "✦ Biblical events", resonance: "⌖ Resonance events", network: "◈ Known sites" }[o._changed];
        const toast = (msg, kind = "ok") => {try {window.dispatchEvent(new CustomEvent("codex:toast", { detail: { msg, kind } }));} catch {}};
        const fit = () => {
          const grp = layers[groupKey];
          const feats = grp && typeof grp.getLayers === "function" ? grp.getLayers() : [];
          if (!feats.length) {toast(`${label}: none in this view`, "warn");return;}
          try {
            const b = L.featureGroup(feats).getBounds();
            if (b && b.isValid && b.isValid()) mapRef.current.fitBounds(b, { maxZoom: 6, padding: [40, 40] });
          } catch (_) {}
          toast(`${label}: ${feats.length} shown`);
        };
        if (o._changed === "empires") {toast(`${label}: drawing…`);setTimeout(fit, 600);} else
        fit();
      }
    };

    const onDiscovered = () => {drawDiscovered();drawDiscoverables();};

    // ── Drawers ────────────────────────────────────────────────────────
    function drawDiscoverables() {
      if (!mapRef.current) return;
      clearLayer("discoverable");
      const sites = window.CODEX_BIBLE_SITES || [];
      const grp = L.layerGroup().addTo(mapRef.current);
      layers.discoverable = grp;
      const userMarker = layers.user;
      const userLatLng = userMarker?.getLayers?.()[0]?.getLatLng?.();
      const disc = JSON.parse(localStorage.getItem("codex.discovered") || "{}");
      sites.forEach((s) => {
        if (disc[s.id]) return;
        const near = userLatLng ? haversineKm(userLatLng.lat, userLatLng.lng, s.lat, s.lng) <= 1 : false;
        const icon = L.divIcon({
          className: `cx-map-disc ${near ? "is-near" : ""}`,
          html: near ? `<span class="cx-disc-pulse"></span><span class="cx-disc-lbl">DISCOVERABLE · ${escapeHtml(s.name)}</span>` : `<span class="cx-disc-dot"></span>`,
          iconSize: [8, 8], iconAnchor: [4, 4]
        });
        const m = L.marker([s.lat, s.lng], { icon }).addTo(grp);
        m.on("click", () => discoverSite(s, userLatLng));
      });
    }
    function drawDiscovered() {
      if (!mapRef.current) return;
      clearLayer("discovered");
      const disc = JSON.parse(localStorage.getItem("codex.discovered") || "{}");
      const grp = L.layerGroup().addTo(mapRef.current);
      layers.discovered = grp;
      Object.values(disc).forEach((s) => {
        const icon = L.divIcon({ className: "cx-map-mine", html: `<span class="cx-mine-flag">⚐</span><span class="cx-mine-lbl">${escapeHtml(s.name)}</span>`, iconSize: [12, 12], iconAnchor: [6, 6] });
        L.marker([s.lat, s.lng], { icon }).bindPopup(`<div class="cx-mine-pop"><b>${escapeHtml(s.name)}</b><p>${escapeHtml(s.narrative || "")}</p>${s.refs ? `<small>${escapeHtml(s.refs.join(", "))}</small>` : ""}<button class="cx-mine-tts" onclick="window.codexSpeak(this.parentNode.querySelector('p').textContent)">▶ PLAY TOUR</button></div>`).addTo(grp);
      });
    }
    function drawPilgrimage() {
      if (!mapRef.current) return;
      clearLayer("pilgrimage");
      const grp = L.layerGroup().addTo(mapRef.current);
      layers.pilgrimage = grp;
      (window.CODEX_PILGRIM_ROUTES || []).forEach((r) => {
        L.polyline(r.path, { color: r.color || "#d1a45a", weight: 2.5, opacity: 0.7, dashArray: "2 6" }).
        bindPopup(`<b>${escapeHtml(r.name)}</b><br><small>${escapeHtml(r.note || "")}</small>`).
        addTo(grp);
      });
    }
    function drawManuscripts() {
      if (!mapRef.current) return;
      clearLayer("manuscripts");
      const grp = L.layerGroup().addTo(mapRef.current);
      layers.manuscripts = grp;
      (window.CODEX_MANUSCRIPT_SITES || []).forEach((s) => {
        const icon = L.divIcon({ className: "cx-map-ms", html: `<span class="cx-ms-glyph">⬡</span><span class="cx-ms-lbl">${escapeHtml(s.name)}</span>`, iconSize: [12, 12], iconAnchor: [6, 6] });
        L.marker([s.lat, s.lng], { icon }).bindPopup(`<b>${escapeHtml(s.name)}</b><br><small>${escapeHtml(s.note || "")}</small>`).addTo(grp);
      });
    }
    async function drawEmpires(yr) {
      if (!mapRef.current) return;
      clearLayer("empires");
      try {
        const c = mapRef.current.getCenter();
        const poly = await fetchEmpirePolygon(c.lat, c.lng, yr);
        if (!poly || !poly.coords) return;
        const grp = L.layerGroup().addTo(mapRef.current);
        layers.empires = grp;
        L.polygon(poly.coords, { color: "#b88cff", weight: 1.5, opacity: 0.7, fillOpacity: 0.08, dashArray: "4 4" }).
        bindPopup(`<b>${escapeHtml(poly.name)}</b><br><small>${escapeHtml(poly.note || "")} · ${fmtYear(yr)}</small>`).
        addTo(grp);
      } catch {}
    }

    // ⌖ RESONANCE — plot the Mirror console's geocoded events and connect
    // each back to the verse site with a bowed arc. The cross-domain view:
    // where this verse has echoed, drawn on the real earth.
    function drawResonance() {
      if (!mapRef.current) return;
      clearLayer("resonance");
      let mirror = null;
      try {const raw = localStorage.getItem(mirrorKey);if (raw) mirror = JSON.parse(raw);} catch {}
      const evs = mirror ?
      [
      ...(mirror.historicalParallels || []).map((e) => ({ ...e, _kind: "hist" })),
      ...(mirror.modernResonances || []).map((e) => ({ ...e, _kind: "mod" }))].
      filter((e) => typeof e.lat === "number" && typeof e.lng === "number") :
      [];
      if (!evs.length) {
        try {
          window.dispatchEvent(new CustomEvent("codex:toast", { detail: {
              msg: mirror ?
              "⌖ Resonance: this Mirror analysis predates geo intel — reopen MIRROR and tap ⟲ UPGRADE INTEL" :
              "⌖ Resonance: open MIRROR on this verse first — its analysis feeds this layer",
              kind: "warn"
            } }));
        } catch {}
        return;
      }
      const grp = L.layerGroup().addTo(mapRef.current);
      layers.resonance = grp;
      evs.forEach((ev) => {
        const color = ev._kind === "mod" ? "#e8b465" : "#7ee0ff";
        // Bowed arc: interpolate the verse→event line, lifting latitude by a
        // sine bow proportional to span — reads as a flight-path sweep.
        const pts = [];
        const N = 48;
        const dLat = ev.lat - data.lat,dLng = ev.lng - data.lng;
        const span = Math.hypot(dLat, dLng);
        const bow = Math.min(14, span * 0.18);
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          pts.push([
          data.lat + dLat * t + Math.sin(Math.PI * t) * bow,
          data.lng + dLng * t]
          );
        }
        L.polyline(pts, { color, weight: 1.4, opacity: 0.65, dashArray: "1 6", className: "cx-map-resarc", interactive: false }).addTo(grp);
        const icon = L.divIcon({
          className: `cx-map-res ${ev._kind === "mod" ? "is-mod" : ""}`,
          html: `<span class="cx-res-dot"></span><span class="cx-res-lbl">${escapeHtml(ev.place || ev.event || "")}</span>`,
          iconSize: [10, 10], iconAnchor: [5, 5]
        });
        L.marker([ev.lat, ev.lng], { icon, riseOnHover: true }).
        bindPopup(
          `<div class="cx-res-pop"><b>${escapeHtml(ev.event || "")}</b>` +
          `<div class="cx-res-pop-meta">${escapeHtml(fmtYear(ev.year))} · ${escapeHtml(ev.place || "")}` +
          `${typeof ev.intensity === "number" ? ` · resonance ${ev.intensity}/100` : ""}</div>` +
          `<p>${escapeHtml(ev.connection || "")}</p></div>`,
          { maxWidth: 280, className: "cx-poi-popup" }
        ).
        addTo(grp);
      });
    }

    // ◈ NETWORK — every verse this reader has ever mapped, joined to the
    // current site. The picture grows with study: the user's own atlas of
    // the Word, assembled verse by verse.
    function drawNetwork() {
      if (!mapRef.current) return;
      clearLayer("network");
      const sites = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith("codex.maps.")) continue;
          try {
            const d = JSON.parse(localStorage.getItem(k));
            if (typeof d.lat !== "number" || typeof d.lng !== "number") continue;
            const ref = k.slice("codex.maps.".length).split(".");
            sites.push({ lat: d.lat, lng: d.lng, place: d.place || "", ref: `${ref[0]} ${ref[1]}:${ref[2]}` });
          } catch {}
        }
      } catch {}
      // Dedupe by rounded coordinate so co-located verses stack as one node.
      const seen = new Map();
      sites.forEach((s) => {
        const key2 = `${s.lat.toFixed(2)},${s.lng.toFixed(2)}`;
        if (seen.has(key2)) seen.get(key2).refs.push(s.ref);else
        seen.set(key2, { ...s, refs: [s.ref] });
      });
      const grp = L.layerGroup().addTo(mapRef.current);
      layers.network = grp;
      seen.forEach((s) => {
        const isHere = Math.abs(s.lat - data.lat) < 0.05 && Math.abs(s.lng - data.lng) < 0.05;
        if (!isHere) {
          L.polyline([[data.lat, data.lng], [s.lat, s.lng]], {
            color: "#7ee0ff", weight: 0.6, opacity: 0.18, interactive: false
          }).addTo(grp);
        }
        const icon = L.divIcon({
          className: "cx-map-net",
          html: `<span class="cx-net-dot"></span>${s.refs.length > 1 ? `<span class="cx-net-n">${s.refs.length}</span>` : ""}`,
          iconSize: [8, 8], iconAnchor: [4, 4]
        });
        L.marker([s.lat, s.lng], { icon }).
        bindPopup(
          `<div class="cx-res-pop"><b>${escapeHtml(s.place)}</b>` +
          `<div class="cx-res-pop-meta">${s.refs.length} verse${s.refs.length > 1 ? "s" : ""} studied here</div>` +
          `<p>${escapeHtml(s.refs.slice(0, 8).join(" · "))}${s.refs.length > 8 ? " …" : ""}</p></div>`,
          { maxWidth: 260, className: "cx-poi-popup" }
        ).
        addTo(grp);
      });
    }

    // Notify the engagement engine of a brand-new discovery without ever
    // throwing or duplicating streak/milestone logic. Prefer the engine's
    // own convenience emitter; otherwise dispatch the canonical bus event
    // (the engine listens for codex:depth-action). Per the frozen contract
    // the discovery depth-action type is "discovery-logged" (weight 2,
    // cross-cutting domain) — passing the site ref lets the engine log
    // which case the discovery closed.
    function notifyEngagementDiscovery(site, entry) {
      try {
        const ref = "site:" + (site && site.id || entry && entry.id || site && site.name || "");
        const eng = window.CODEX_ENGAGEMENT;
        if (eng && typeof eng.emit === "function") {
          eng.emit("discovery-logged", ref, 2, null);
          return;
        }
        if (eng && typeof eng.record === "function") {
          eng.record({ type: "discovery-logged", ref: ref, weight: 2, domain: null });
          return;
        }
        // Engine absent / Lite mode: fall back to the bus so a later-loading
        // engine still picks it up via its codex:depth-action listener.
        window.dispatchEvent(new CustomEvent("codex:depth-action", {
          detail: { type: "discovery-logged", ref: ref, weight: 2, domain: null }
        }));
      } catch (_) {/* engagement is best-effort; never break the map */}
    }

    async function discoverSite(s, userLatLng) {
      const disc = JSON.parse(localStorage.getItem("codex.discovered") || "{}");
      if (disc[s.id]) return;
      // Optimistic placeholder; AI fills in narrative.
      const entry = { id: s.id, name: s.name, lat: s.lat, lng: s.lng, refs: s.refs || [], narrative: "Discovering…", at: Date.now() };
      disc[s.id] = entry;
      localStorage.setItem("codex.discovered", JSON.stringify(disc));
      window.dispatchEvent(new CustomEvent("codex:discovered", { detail: { site: entry } }));
      // Route this genuinely-new discovery through the unified engagement
      // engine so it feeds continuity / mastery / the unified milestone
      // system (the 10/25/50/100 discovery thresholds are owned by the
      // engine's counters, NOT duplicated here). Fires exactly once per
      // site thanks to the `if (disc[s.id]) return;` guard above. Fully
      // defensive: no-op if the engine is absent or in Lite mode.
      notifyEngagementDiscovery(s, entry);
      try {
        const r = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            system: "You are CODEX DISCOVERY. The user is physically present at a biblical site. Write a single short evocative paragraph (60-90 words) in second person ('You are standing where…'), naming the verse references, what happened here, and one sensory detail of the place today. No fences. No headings. Just prose.",
            messages: [{ role: "user", content: `Site: ${s.name}\nRefs: ${(s.refs || []).join(", ")}\nNotes: ${s.note || ""}` }],
            max_tokens: 240
          })
        });
        const body = await r.json();
        entry.narrative = (body.text || "").trim() || "Discovered.";
      } catch (e) {entry.narrative = `Discovered ${s.name}.`;}
      disc[s.id] = entry;
      localStorage.setItem("codex.discovered", JSON.stringify(disc));
      window.dispatchEvent(new CustomEvent("codex:discovered", { detail: { site: entry } }));
    }

    window.addEventListener("codex:userpos", onPos);
    window.addEventListener("codex:tourist", onTourist);
    window.addEventListener("codex:tourist-select", onSelect);
    window.addEventListener("codex:tourist-mode", onTouristMode);
    window.addEventListener("codex:overlays", onOverlays);
    window.addEventListener("codex:discovered", onDiscovered);
    return () => {
      window.removeEventListener("codex:userpos", onPos);
      window.removeEventListener("codex:tourist", onTourist);
      window.removeEventListener("codex:tourist-select", onSelect);
      window.removeEventListener("codex:tourist-mode", onTouristMode);
      window.removeEventListener("codex:overlays", onOverlays);
      window.removeEventListener("codex:discovered", onDiscovered);
    };
  }, [data, year, mirrorKey]);

  if (!window.L) {
    return /*#__PURE__*/React.createElement("div", { className: "cx-map-fallback" }, "Leaflet failed to load \u2014 check your network and reload.");
  }
  return /*#__PURE__*/React.createElement("div", { ref: wrapRef, className: "cx-map-leaflet" });

  // ── Helpers (closures over layersRef) ────────────────────────────────
  function addTiles(map, dark) {
    const url = dark ?
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" :
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    if (layersRef.current.tile) map.removeLayer(layersRef.current.tile);
    layersRef.current.tile = window.L.tileLayer(url, {
      maxZoom: 18,
      subdomains: "abcd",
      crossOrigin: true
    }).addTo(map);
  }

  function addMainMarker(map, data) {
    if (layersRef.current.marker) map.removeLayer(layersRef.current.marker);
    const icon = window.L.divIcon({
      className: "cx-map-mark-leaflet",
      html: `<span class="cx-mark-sweep"></span><span class="cx-mark-pulse"></span><span class="cx-mark-core"></span><span class="cx-mark-lbl">${escapeHtml((data.place || "").toUpperCase())}</span>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    const grp = window.L.layerGroup().addTo(map);
    // Range rings — quiet dashed circles so distance reads at a glance.
    [100, 500, 1500].forEach((km) => {
      window.L.circle([data.lat, data.lng], {
        radius: km * 1000,
        color: "#7ee0ff",
        weight: 0.7,
        opacity: 0.28,
        fill: false,
        dashArray: "2 7",
        interactive: false,
        className: "cx-map-ring"
      }).addTo(grp);
    });
    const mk = window.L.marker([data.lat, data.lng], { icon, riseOnHover: true }).addTo(grp);
    // The site itself opens its own dossier — one gesture deep, no popup.
    mk.on("click", () => {
      window.dispatchEvent(new CustomEvent("codex:map-poi", { detail: { poi: {
            name: data.place, kind: "site", lat: data.lat, lng: data.lng, wiki: "", main: true
          } } }));
    });
    layersRef.current.marker = grp;
  }

  function redrawPOIs(map, data, currentYear) {
    if (layersRef.current.poi) map.removeLayer(layersRef.current.poi);
    const group = window.L.layerGroup();
    (data.pointsOfInterest || []).forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
      // Year filter — if the POI carries from/to, hide outside that range.
      if (typeof p.from === "number" && currentYear < p.from) return;
      if (typeof p.to === "number" && currentYear > p.to) return;
      const glyph = poiGlyph(p.kind);
      // Significance pulse — settlements (where the story happens) breathe
      // harder than the standing furniture of the earth. Shape carries the
      // meaning first; the label annotates.
      const sig = poiSignificance(p.kind);
      const icon = window.L.divIcon({
        className: `cx-map-poi-leaflet kind-${p.kind || "default"} cx-mapx-sig-${sig}`,
        html: `<span class="cx-mapx-poi-pulse"></span><span class="cx-poi-dot"></span><span class="cx-poi-lbl">${glyph} ${escapeHtml(p.name)}</span>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });
      // CLICK = in-surface dossier card (wiki intel + ✦ READ chips). The
      // old Leaflet popup is gone — the card is the document now.
      const marker = window.L.marker([p.lat, p.lng], { icon, riseOnHover: true }).addTo(group);
      marker.on("click", () => {
        window.dispatchEvent(new CustomEvent("codex:map-poi", { detail: { poi: p } }));
      });
      marker._codexPOI = p;
    });
    group.addTo(map);
    layersRef.current.poi = group;
  }
}

// Initial popup body — sci-fi skeleton with placeholder image area.
function poiPopupHtml(p) {
  const glyph = poiGlyph(p.kind);
  const yrRange = typeof p.from === "number" && typeof p.to === "number" ?
  `<span class="cx-poi-pop-yr">${p.from < 0 ? Math.abs(p.from) + " BCE" : p.from + " CE"} – ${p.to < 0 ? Math.abs(p.to) + " BCE" : p.to + " CE"}</span>` :
  "";
  return `
    <div class="cx-poi-pop"
         data-pending-fetch="1"
         data-wiki="${escapeHtml(p.wiki || "")}"
         data-name="${escapeHtml(p.name || "")}"
         data-kind="${escapeHtml(p.kind || "place")}">
      <div class="cx-poi-pop-img" data-pending="1">
        <span class="cx-poi-pop-glyph">${glyph}</span>
      </div>
      <h4 class="cx-poi-pop-title">${escapeHtml(p.name)}</h4>
      <div class="cx-poi-pop-meta">
        <span class="cx-poi-pop-kind">${escapeHtml((p.kind || "place").toUpperCase())}</span>
        ${yrRange}
      </div>
      <p class="cx-poi-pop-body">…</p>
      <a class="cx-poi-pop-more" href="" target="_blank" rel="noopener noreferrer" hidden>open on wikipedia ↗</a>
    </div>`;
}

// One-time MutationObserver — watches the document for any newly inserted
// .cx-poi-pop[data-pending="1"] and hydrates it from Wikipedia. This catches
// every code path that opens a popup (marker click, programmatic open, etc.)
// without relying on Leaflet's popupopen event firing reliably.
(function ensurePopupObserver() {
  if (typeof window === "undefined" || window._codexPopupObserver) return;
  const handler = (root) => {
    const candidates = root.querySelectorAll ?
    root.querySelectorAll(".cx-poi-pop[data-pending-fetch='1']") :
    [];
    candidates.forEach((el) => {
      el.removeAttribute("data-pending-fetch");
      const wiki = el.getAttribute("data-wiki") || "";
      const name = el.getAttribute("data-name") || "";
      const kind = el.getAttribute("data-kind") || "place";
      poiHydrateEl(el, { wiki, name, kind });
    });
  };
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.matches?.(".cx-poi-pop[data-pending-fetch='1']")) {
          n.removeAttribute("data-pending-fetch");
          poiHydrateEl(n, {
            wiki: n.getAttribute("data-wiki") || "",
            name: n.getAttribute("data-name") || "",
            kind: n.getAttribute("data-kind") || "place"
          });
        } else handler(n);
      });
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  window._codexPopupObserver = obs;
})();

// Try a sequence of Wikipedia / Commons sources until something has both a
// thumbnail and a summary. Always lands SOME image when one exists anywhere
// on the project. Cached at module scope so subsequent popups for the same
// POI are instant.
const _poiCache = new Map();
async function poiResolve(p) {
  const cacheKey = `${p.wiki || ""}|${p.name || ""}`;
  if (_poiCache.has(cacheKey)) return _poiCache.get(cacheKey);
  const candidates = [];
  if (p.wiki) candidates.push(p.wiki.replace(/ /g, "_"));
  if (p.name) candidates.push(p.name.replace(/ /g, "_"));
  // Stripped variants — drops parenthesised qualifiers, "Mt./Mount" etc.
  if (p.name) {
    const stripped = p.name.
    replace(/\(.*?\)/g, "").trim().
    replace(/^Mt\.?\s+/i, "Mount ").
    replace(/ /g, "_");
    if (stripped && !candidates.includes(stripped)) candidates.push(stripped);
  }
  let summary = "",thumbUrl = null,pageUrl = null;
  for (const slug of candidates) {
    try {
      const r = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
        { headers: { "Accept": "application/json" } }
      );
      if (!r.ok) continue;
      const j = await r.json();
      const tu = j.thumbnail?.source || j.originalimage?.source;
      const sm = (j.extract || "").trim();
      if (!summary && sm) summary = sm;
      if (!thumbUrl && tu) thumbUrl = tu;
      if (!pageUrl) pageUrl = j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
      if (thumbUrl && summary) break;
    } catch {}
  }
  // Last-ditch image: query Commons for any file matching the name
  if (!thumbUrl && p.name) {
    try {
      const q = encodeURIComponent(p.name);
      const r = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${q}&srnamespace=6&format=json&origin=*`,
        { headers: { "Accept": "application/json" } }
      );
      if (r.ok) {
        const j = await r.json();
        const first = j?.query?.search?.[0]?.title;
        if (first) {
          const file = first.replace(/^File:/, "");
          thumbUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`;
        }
      }
    } catch {}
  }
  const out = { summary, thumbUrl, pageUrl };
  _poiCache.set(cacheKey, out);
  return out;
}

async function poiHydrateEl(popupEl, p) {
  if (!popupEl) return;
  const { summary, thumbUrl, pageUrl } = await poiResolve(p);
  const imgBox = popupEl.querySelector(".cx-poi-pop-img");
  const bodyEl = popupEl.querySelector(".cx-poi-pop-body");
  const moreEl = popupEl.querySelector(".cx-poi-pop-more");
  if (thumbUrl && imgBox) {
    imgBox.removeAttribute("data-pending");
    imgBox.innerHTML = `<img loading="lazy" src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(p.name)}" />`;
  }
  if (bodyEl) {
    bodyEl.textContent = summary ?
    summary.length > 220 ? summary.slice(0, 220).trim() + "…" : summary :
    "(no Wikipedia summary)";
  }
  if (moreEl) {
    if (pageUrl) {
      moreEl.href = pageUrl;
      moreEl.textContent = "open on wikipedia ↗";
    } else {
      moreEl.href = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p.name)}`;
      moreEl.textContent = "search images ↗";
    }
    moreEl.hidden = false;
  }
}

function escapeHtml(s) {return window.CODEX_INTEL.intelEscapeHtml(s);}
// Year slider scrubbing through chronological polities. Default position is
// the verse's own year. Shows the active polity name in the foreground and a
// small list of theory / esoteric names below for scholar curiosity.
function PolityTimeline({ polities, verseYear, theoryNames }) {
  // Compute a sane min/max year window from the data, padded a little so the
  // slider has room either side.
  const yMin = useMemo(() => Math.min(-2500, ...polities.map((p) => p.from)), [polities]);
  const yMax = useMemo(() => Math.max(2030, ...polities.map((p) => p.to)), [polities]);
  const initialYear = typeof verseYear === "number" && !Number.isNaN(verseYear) ? verseYear : 0;
  const clampedInitial = Math.max(yMin, Math.min(yMax, initialYear));
  const [year, setYear] = useState(clampedInitial);
  // Broadcast every year change so the Leaflet map (and any other listener)
  // can filter POIs / borders to that era.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("codex:year", { detail: { year } }));
  }, [year]);
  const active = useMemo(() => {
    return polities.find((p) => year >= p.from && year <= p.to) ||
    polities.reduce((closest, p) => {
      if (!closest) return p;
      const dC = Math.min(Math.abs(closest.from - year), Math.abs(closest.to - year));
      const dP = Math.min(Math.abs(p.from - year), Math.abs(p.to - year));
      return dP < dC ? p : closest;
    }, null);
  }, [polities, year]);

  // Major labelled ticks (always shown — round millennia) and minor unlabelled
  // dashes every 250y. Polity boundaries get a tiny accent line, not a label.
  const majorTicks = useMemo(() => {
    const out = [];
    for (let y = -2000; y <= 2000; y += 1000) if (y >= yMin && y <= yMax) out.push(y);
    return out;
  }, [yMin, yMax]);
  const minorTicks = useMemo(() => {
    const out = [];
    for (let y = Math.ceil(yMin / 250) * 250; y <= yMax; y += 250) {
      if (!majorTicks.includes(y)) out.push(y);
    }
    return out;
  }, [yMin, yMax, majorTicks]);
  const boundaryTicks = useMemo(() => {
    return polities.map((p) => p.from).filter((y) => y > yMin && y < yMax);
  }, [polities, yMin, yMax]);

  // Decimate major labels if the slider gets narrow (ResizeObserver).
  const tickWrapRef = useRef(null);
  const [skipEvery, setSkipEvery] = useState(0); // 0 = show all, 1 = every other
  useEffect(() => {
    if (!tickWrapRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || 320;
      // each label ~36px; need ~48px breathing room
      const need = majorTicks.length * 48;
      setSkipEvery(w < need ? w < need / 2 ? 2 : 1 : 0);
    });
    ro.observe(tickWrapRef.current);
    return () => ro.disconnect();
  }, [majorTicks.length]);

  // AI year-context badge — debounced fetch keyed by location+decade.
  const [ctxBadge, setCtxBadge] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => fetchYearContext(year).then(setCtxBadge).catch(() => {}).finally(() => setCtxLoading(false)), 320);
    setCtxLoading(true);
    return () => clearTimeout(t);
  }, [year]);

  const fmtMajor = (y) => {
    if (y === 0) return "0";
    const k = Math.abs(y) / 1000;
    return `${k}K${y < 0 ? " BC" : ""}`;
  };

  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-map-timeline" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-map-timeline-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-map-timeline-tag" }, "CHRONO"), /*#__PURE__*/
    React.createElement("span", { className: "cx-map-timeline-yr" }, fmtYear(year)),
    year === clampedInitial ? /*#__PURE__*/React.createElement("span", { className: "cx-map-timeline-vy" }, "\xB7 verse year") : null, /*#__PURE__*/
    React.createElement("button", {
      className: "cx-map-timeline-reset",
      onClick: () => setYear(clampedInitial),
      title: "Snap back to the verse's own year",
      "aria-label": "Reset to verse year" },
    "\u27F2")
    ), /*#__PURE__*/

    React.createElement("div", { className: `cx-map-timeline-active ${active ? "" : "is-empty"}` },
    active ? /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("span", { className: "cx-map-timeline-active-name" }, active.name), /*#__PURE__*/
    React.createElement("span", { className: "cx-map-timeline-active-range" },
    fmtYear(active.from), " \u2013 ", fmtYear(active.to)
    )
    ) : /*#__PURE__*/
    React.createElement("span", { className: "cx-map-timeline-active-name" }, "\u2014 no recorded polity \u2014")
    ), /*#__PURE__*/

    React.createElement("input", {
      type: "range",
      className: "cx-map-timeline-slider",
      min: yMin,
      max: yMax,
      step: 1,
      value: year,
      onChange: (e) => setYear(parseInt(e.target.value, 10)),
      "aria-label": "Year" }
    ), /*#__PURE__*/

    React.createElement("div", { className: "cx-map-timeline-ticks", ref: tickWrapRef },
    boundaryTicks.map((t, i) => /*#__PURE__*/
    React.createElement("span", { key: `b${i}`, className: "cx-map-timeline-tick is-boundary", style: { left: `${(t - yMin) / (yMax - yMin) * 100}%` }, "aria-hidden": true })
    ),
    minorTicks.map((t) => /*#__PURE__*/
    React.createElement("span", { key: `m${t}`, className: "cx-map-timeline-tick is-minor", style: { left: `${(t - yMin) / (yMax - yMin) * 100}%` }, "aria-hidden": true })
    ),
    majorTicks.map((t, i) => /*#__PURE__*/
    React.createElement("span", {
      key: t,
      className: `cx-map-timeline-tick is-major ${skipEvery && i % (skipEvery + 1) !== 0 ? "is-dim" : ""}`,
      style: { left: `${(t - yMin) / (yMax - yMin) * 100}%` },
      title: fmtYear(t) },
    fmtMajor(t))
    )
    ), /*#__PURE__*/

    React.createElement("div", { className: `cx-map-yrctx ${ctxLoading ? "is-loading" : ""}`, "aria-live": "polite" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-map-yrctx-tag" }, "WHEN"),
    ctxBadge ? /*#__PURE__*/
    React.createElement("div", { className: "cx-map-yrctx-body" }, /*#__PURE__*/
    React.createElement("b", null, ctxBadge.headline),
    Array.isArray(ctxBadge.events) && ctxBadge.events.length ? /*#__PURE__*/
    React.createElement("ul", null, ctxBadge.events.slice(0, 3).map((e, i) => /*#__PURE__*/React.createElement("li", { key: i }, e))) :
    null
    ) : /*#__PURE__*/
    React.createElement("span", { className: "cx-map-yrctx-load" }, "resolving ", fmtYear(year), "\u2026")
    ), /*#__PURE__*/

    React.createElement("details", { className: "cx-map-timeline-list" }, /*#__PURE__*/
    React.createElement("summary", null, "full timeline \xB7 ", polities.length, " polities"), /*#__PURE__*/
    React.createElement("ul", null,
    polities.map((p, i) => /*#__PURE__*/
    React.createElement("li", {
      key: i,
      className: active && active.name === p.name && active.from === p.from ? "is-active" : "",
      onClick: () => setYear(Math.round((p.from + p.to) / 2)),
      role: "button",
      title: `Jump to mid-${p.name}` }, /*#__PURE__*/

    React.createElement("span", { className: "cx-pl-name" }, p.name), /*#__PURE__*/
    React.createElement("span", { className: "cx-pl-range" }, fmtYear(p.from), " \u2013 ", fmtYear(p.to))
    )
    )
    )
    ),

    Array.isArray(theoryNames) && theoryNames.length > 0 ? /*#__PURE__*/
    React.createElement("details", { className: "cx-map-timeline-theory" }, /*#__PURE__*/
    React.createElement("summary", null, "theory + esoterica \xB7 ", theoryNames.length), /*#__PURE__*/
    React.createElement("ul", null,
    theoryNames.map((t, i) => /*#__PURE__*/
    React.createElement("li", { key: i }, /*#__PURE__*/
    React.createElement("b", null, t.name), /*#__PURE__*/
    React.createElement("span", null, t.note)
    )
    )
    )
    ) :
    null
    ));

}

function MapField({ label, body }) {
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-map-field-row" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-map-field-lbl" }, label), /*#__PURE__*/
    React.createElement("span", { className: "cx-map-field-bd" }, body)
    ));

}

// ── Tourist Mode — AI prompt + caching ─────────────────────────────────
const TOURIST_PROMPT = `You are CODEX TOURIST — a scholarly biblical-history guide. Given a user's current GPS coordinates, list places of biblical/sacred-text/historical importance within 50 km, ranked by significance. Return a single JSON object. No prose, no fences.

Schema:
{
  "your_location": "Human-readable nearest known landmark or town",
  "places": [
    {
      "name": "Capernaum",
      "lat": 32.881, "lng": 35.575,
      "distance_km": 12.4,
      "era": "1st century CE",
      "biblical_refs": ["matt.4.13", "mark.1.21"],
      "summary": "1-2 sentences on why this matters.",
      "things_to_see": ["Synagogue ruins", "House of Peter"],
      "best_at": "morning, before tour buses",
      "walking_route_hint": "30-min walk along the lake from Tabgha"
    }
  ],
  "if_you_only_have_an_hour": "Ranked top 3 by accessibility + meaning, 2 sentences.",
  "deeper_rabbit_hole": "1 paragraph on a less-visited but historically rich site nearby."
}

Rules:
- Only real, attested sites with accurate coordinates.
- If nowhere within 50 km has direct biblical relevance, broaden to sacred-text / early-church / pilgrim / archaeological relevance and SAY so in your_location.
- 4-10 places. Sort by significance (most important first).
- Calm scholarly tone. Return ONLY the JSON.`;

const YEAR_CTX_PROMPT = `You are CODEX CHRONO. Given a location centroid and a year, return a single JSON object describing the political/religious situation at that exact year and 3 contemporary nearby events. No prose, no fences.

Schema:
{ "headline": "Babylonian siege under Nebuchadnezzar", "events": ["Temple destroyed", "Lamentations being composed", "Jeremiah in Egypt"] }

Rules: brief, factual, present-tense fragments. Return ONLY the JSON.`;

const EMPIRE_PROMPT = `You are CODEX EMPIRE. Given a location and a year, return the major empire/polity controlling that area as a rough polygon (8-14 lat,lng vertices). JSON only, no fences.

Schema:
{ "name": "Neo-Assyrian Empire", "note": "Sargonid dynasty at peak extent", "coords": [[lat,lng],[lat,lng],...] }
Rules: coords must be real-world plausible. Return ONLY the JSON.`;

function touristCacheKey(p) {
  return `codex.tourist.${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
}
function readTouristCache(k) {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - (obj._at || 0) > 24 * 60 * 60 * 1000) return null;
    return obj.data;
  } catch {return null;}
}
function writeTouristCache(k, data) {
  try {localStorage.setItem(k, JSON.stringify({ _at: Date.now(), data }));} catch {}
}

async function fetchYearContext(year) {
  const decade = Math.round(year / 10) * 10;
  const k = `codex.yrctx.${decade}`;
  try {
    const raw = localStorage.getItem(k);
    if (raw) return JSON.parse(raw);
  } catch {}
  try {
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        system: YEAR_CTX_PROMPT,
        messages: [{ role: "user", content: `Year: ${year} (${year < 0 ? Math.abs(year) + " BCE" : year + " CE"}). Return JSON.` }],
        max_tokens: 220
      })
    });
    const body = await r.json();
    const text = (body.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const i = text.indexOf("{");if (i === -1) throw new Error("no json");
    const obj = parseMapJSON(text.slice(i));
    try {localStorage.setItem(k, JSON.stringify(obj));} catch {}
    return obj;
  } catch {return null;}
}

async function fetchEmpirePolygon(lat, lng, year) {
  const k = `codex.empire.${lat.toFixed(0)},${lng.toFixed(0)},${Math.round(year / 50) * 50}`;
  try {const raw = localStorage.getItem(k);if (raw) return JSON.parse(raw);} catch {}
  try {
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        system: EMPIRE_PROMPT,
        messages: [{ role: "user", content: `Location: lat ${lat.toFixed(2)}, lng ${lng.toFixed(2)}. Year: ${year}. Return JSON polygon.` }],
        max_tokens: 600
      })
    });
    const body = await r.json();
    const text = (body.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const i = text.indexOf("{");if (i === -1) return null;
    const obj = parseMapJSON(text.slice(i));
    try {localStorage.setItem(k, JSON.stringify(obj));} catch {}
    return obj;
  } catch {return null;}
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371,toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1),dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function touristPopupHtml(pl) {
  const things = Array.isArray(pl.things_to_see) ? pl.things_to_see.slice(0, 4).map((t) => `<li>${escapeHtml(t)}</li>`).join("") : "";
  const refs = Array.isArray(pl.biblical_refs) && pl.biblical_refs.length ?
  `<div class="cx-tpop-refs">${pl.biblical_refs.slice(0, 4).map((r) => `<code>${escapeHtml(r)}</code>`).join(" ")}</div>` : "";
  return `<div class="cx-tpop">
    <h4>${escapeHtml(pl.name || "")}</h4>
    <div class="cx-tpop-meta">${escapeHtml(pl.era || "")}${pl.distance_km != null ? ` · ${pl.distance_km.toFixed(1)} km` : ""}</div>
    <p>${escapeHtml(pl.summary || "")}</p>
    ${things ? `<ul class="cx-tpop-things">${things}</ul>` : ""}
    ${pl.best_at ? `<div class="cx-tpop-tip"><b>Best at:</b> ${escapeHtml(pl.best_at)}</div>` : ""}
    ${pl.walking_route_hint ? `<div class="cx-tpop-tip"><b>Route:</b> ${escapeHtml(pl.walking_route_hint)}</div>` : ""}
    ${refs}
    <button class="cx-tpop-tts" onclick="window.codexSpeak(this.parentNode.querySelector('p').textContent)">▶ PLAY TOUR</button>
  </div>`;
}

// Web Speech narration — exposed on window so popup-inline onclick handlers
// (which can't reach React closures) can trigger it.
window.codexSpeak = function (text) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.lang = document.documentElement.lang || navigator.language || "en";
    u.rate = 0.98;u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  } catch {}
};

// ── Tourist side panel — cards for AI-suggested places. Clicking a card
// recenters the map + drops the dashed breadcrumb line via window event.
function TouristPanel({ loading, err, tourist, userPos, selected, onSelect, onRetry }) {
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-tourist-panel" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-tourist-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-tourist-tag" }, "PLACES NEAR YOU"),
    userPos ? /*#__PURE__*/React.createElement("span", { className: "cx-tourist-pos" }, userPos.lat.toFixed(3), ", ", userPos.lng.toFixed(3), " \xB1", Math.round(userPos.accuracy || 0), "m") : null
    ),
    loading ? /*#__PURE__*/
    React.createElement("div", { className: "cx-tourist-loading" }, "scanning 50 km radius for sacred sites\u2026") :
    err ? /*#__PURE__*/
    React.createElement("div", { className: "cx-tourist-err" }, /*#__PURE__*/
    React.createElement("p", null, err), /*#__PURE__*/
    React.createElement("button", { onClick: onRetry }, "Retry")
    ) :
    tourist ? /*#__PURE__*/
    React.createElement(React.Fragment, null, /*#__PURE__*/
    React.createElement("div", { className: "cx-tourist-here" }, "\uD83D\uDCCD ", tourist.your_location || "—"), /*#__PURE__*/
    React.createElement("ul", { className: "cx-tourist-list" },
    (tourist.places || []).map((p, i) => /*#__PURE__*/
    React.createElement("li", {
      key: i,
      className: selected && selected.name === p.name ? "is-selected" : "",
      onClick: () => onSelect(p),
      role: "button",
      tabIndex: 0 }, /*#__PURE__*/

    React.createElement("div", { className: "cx-tplace-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-tplace-name" }, p.name),
    p.distance_km != null ? /*#__PURE__*/React.createElement("span", { className: "cx-tplace-d" }, p.distance_km.toFixed(1), " km") : null
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-tplace-era" }, p.era), /*#__PURE__*/
    React.createElement("p", { className: "cx-tplace-sum" }, p.summary),
    Array.isArray(p.biblical_refs) && p.biblical_refs.length ? /*#__PURE__*/
    React.createElement("div", { className: "cx-tplace-refs" }, p.biblical_refs.slice(0, 3).map((r, j) => /*#__PURE__*/React.createElement("code", { key: j }, r))) :
    null
    )
    )
    ),
    tourist.if_you_only_have_an_hour ? /*#__PURE__*/
    React.createElement("div", { className: "cx-tourist-hour" }, /*#__PURE__*/React.createElement("b", null, "If you only have an hour"), /*#__PURE__*/React.createElement("p", null, tourist.if_you_only_have_an_hour)) :
    null,
    tourist.deeper_rabbit_hole ? /*#__PURE__*/
    React.createElement("div", { className: "cx-tourist-hole" }, /*#__PURE__*/React.createElement("b", null, "Deeper rabbit hole"), /*#__PURE__*/React.createElement("p", null, tourist.deeper_rabbit_hole)) :
    null
    ) : /*#__PURE__*/

    React.createElement("div", { className: "cx-tourist-empty" }, /*#__PURE__*/
    React.createElement("p", null, "Tourist mode reveals biblical sites around your current location."), /*#__PURE__*/
    React.createElement("button", { onClick: onRetry }, "Enable location")
    )

    ));

}

// Static seed list of well-known biblical sites — the "Pokemon GO" overlay
// pool. Lat/lng are real. Kept compact; AI fills narrative on discover.
window.CODEX_BIBLE_SITES = [
{ id: "jerusalem-temple-mount", name: "Temple Mount", lat: 31.7780, lng: 35.2354, refs: ["2chr.3.1", "matt.24.1"], note: "Site of Solomon's and Herod's Temples." },
{ id: "garden-of-gethsemane", name: "Gethsemane", lat: 31.7796, lng: 35.2398, refs: ["matt.26.36"], note: "Olive grove where Jesus prayed before his arrest." },
{ id: "via-dolorosa", name: "Via Dolorosa", lat: 31.7790, lng: 35.2330, refs: ["luke.23.26"], note: "Traditional route Jesus walked to crucifixion." },
{ id: "bethlehem", name: "Bethlehem", lat: 31.7054, lng: 35.2024, refs: ["luke.2.4"], note: "Birthplace of Jesus and King David." },
{ id: "nazareth", name: "Nazareth", lat: 32.7019, lng: 35.2972, refs: ["matt.2.23"], note: "Boyhood home of Jesus." },
{ id: "capernaum", name: "Capernaum", lat: 32.8810, lng: 35.5750, refs: ["matt.4.13"], note: "Jesus' Galilean ministry base." },
{ id: "sea-of-galilee", name: "Sea of Galilee", lat: 32.8333, lng: 35.5900, refs: ["matt.4.18"], note: "Waters Jesus walked on; many miracles here." },
{ id: "mount-of-beatitudes", name: "Mt. of Beatitudes", lat: 32.8806, lng: 35.5536, refs: ["matt.5.1"], note: "Hill of the Sermon on the Mount." },
{ id: "jericho", name: "Jericho", lat: 31.8569, lng: 35.4442, refs: ["josh.6.20"], note: "Walls fell to Joshua; oldest continuously inhabited city." },
{ id: "jordan-river-baptism", name: "Qasr al-Yahud", lat: 31.8378, lng: 35.5300, refs: ["matt.3.13"], note: "Traditional baptism site of Jesus." },
{ id: "qumran", name: "Qumran", lat: 31.7414, lng: 35.4592, refs: [], note: "Dead Sea Scrolls discovery site." },
{ id: "masada", name: "Masada", lat: 31.3158, lng: 35.3535, refs: [], note: "Herodian fortress; last Jewish stand against Rome 73 CE." },
{ id: "mount-sinai", name: "Mt. Sinai (Jebel Musa)", lat: 28.5392, lng: 33.9750, refs: ["exod.19.20"], note: "Traditional site of the giving of the Law." },
{ id: "athens-areopagus", name: "Areopagus", lat: 37.9716, lng: 23.7233, refs: ["acts.17.22"], note: "Where Paul addressed the philosophers." },
{ id: "ephesus", name: "Ephesus", lat: 37.9395, lng: 27.3417, refs: ["acts.19.1"], note: "Major Pauline mission city; Temple of Artemis." },
{ id: "rome-mamertine", name: "Mamertine Prison", lat: 41.8930, lng: 12.4845, refs: [], note: "Traditional site of Peter's and Paul's imprisonment." },
{ id: "patmos", name: "Patmos", lat: 37.3081, lng: 26.5500, refs: ["rev.1.9"], note: "Where John received the Apocalypse." },
{ id: "antioch", name: "Antioch", lat: 36.2021, lng: 36.1604, refs: ["acts.11.26"], note: "Disciples first called Christians here." },
{ id: "damascus-straight-st", name: "Straight Street", lat: 33.5118, lng: 36.3070, refs: ["acts.9.11"], note: "Paul's conversion led him here." },
{ id: "babylon-ruins", name: "Babylon", lat: 32.5424, lng: 44.4209, refs: ["dan.1.1"], note: "Nebuchadnezzar's capital; Jewish exile." },
{ id: "nineveh", name: "Nineveh", lat: 36.3590, lng: 43.1530, refs: ["jonah.3.3"], note: "Assyrian capital Jonah preached to." },
{ id: "ur", name: "Ur", lat: 30.9626, lng: 46.1030, refs: ["gen.11.31"], note: "Abraham's birthplace." },
{ id: "mt-ararat", name: "Mt. Ararat", lat: 39.7019, lng: 44.2983, refs: ["gen.8.4"], note: "Traditional resting place of the Ark." },
{ id: "tabgha", name: "Tabgha", lat: 32.8731, lng: 35.5483, refs: ["john.21.9"], note: "Multiplication of loaves and fishes." },
{ id: "caesarea-maritima", name: "Caesarea Maritima", lat: 32.5018, lng: 34.8920, refs: ["acts.10.1"], note: "Roman provincial capital; Cornelius converted." },
{ id: "hebron-machpelah", name: "Cave of Machpelah", lat: 31.5246, lng: 35.1108, refs: ["gen.23.19"], note: "Burial place of Abraham, Sarah, Isaac, Rebekah." }];


window.CODEX_MANUSCRIPT_SITES = [
{ name: "Qumran (Dead Sea Scrolls)", lat: 31.7414, lng: 35.4592, note: "Scrolls found 1947–1956." },
{ name: "Nag Hammadi", lat: 26.0500, lng: 32.2400, note: "Gnostic codices found 1945." },
{ name: "St. Catherine's Monastery", lat: 28.5559, lng: 33.9760, note: "Codex Sinaiticus discovered here 1844." },
{ name: "Cairo Geniza", lat: 30.0050, lng: 31.2330, note: "Vast medieval Jewish manuscript cache." },
{ name: "Oxyrhynchus", lat: 28.5333, lng: 30.6500, note: "Greek papyri including early Gospel fragments." }];


window.CODEX_PILGRIM_ROUTES = [
{ name: "Via Dolorosa", color: "#d1a45a", note: "Jerusalem — Stations of the Cross", path: [[31.7811, 35.2347], [31.7803, 35.2338], [31.7790, 35.2330], [31.7785, 35.2320], [31.7783, 35.2304]] },
{ name: "Camino de Santiago", color: "#7cf", note: "Pyrenees → Santiago de Compostela", path: [[43.1626, -1.2380], [42.8125, -1.6458], [42.5520, -2.8550], [42.5460, -5.6700], [42.8800, -8.5448]] },
{ name: "Jesus Trail", color: "#9bd66b", note: "Nazareth → Capernaum (~65 km)", path: [[32.7019, 35.2972], [32.7600, 35.3500], [32.8200, 35.4500], [32.8731, 35.5483], [32.8810, 35.5750]] },
{ name: "Hajj approach", color: "#e29b6b", note: "Historical pilgrim route to Mecca (Damascus branch)", path: [[33.5118, 36.3070], [31.9500, 35.9100], [29.5320, 35.0060], [25.2854, 39.0900], [21.4225, 39.8262]] }];


// ════════════════════════════════════════════════════════════════════════
// v2 surface — TIME SCRUB · POI DOSSIER · era recolor · self-injected CSS
// ════════════════════════════════════════════════════════════════════════

// Era tint — tokens only. Each polity sits on a mix line between the two
// accent tokens; no raw palette enters the codebase.
function eraTint(i, n) {
  const p = n > 1 ? Math.round(i / (n - 1) * 100) : 50;
  return `color-mix(in srgb, var(--cx-accent, #7ee0ff) ${100 - p}%, var(--cx-accent-2, #ffc46b) ${p}%)`;
}

// OSIS-ish ref ("gen.11.31") → app navigation + display label.
function mapResolveBook(osisBook) {
  const want = String(osisBook || "").toLowerCase();
  const books = window.CODEX_DATA && window.CODEX_DATA.books || [];
  return books.find((b) => (b.id || "").toLowerCase() === want) ||
  books.find((b) => (b.id || "").toLowerCase().startsWith(want) || want.startsWith((b.id || "").toLowerCase())) ||
  null;
}
function osisDisplay(osis) {
  const parts = String(osis || "").split("-")[0].split(".");
  const b = mapResolveBook(parts[0]);
  const name = b ? b.name : (parts[0] || "").toUpperCase();
  if (parts[2]) return `${name} ${parts[1]}:${parts[2]}`;
  return parts[1] ? `${name} ${parts[1]}` : name;
}
function mapGotoOsis(osis) {
  const parts = String(osis || "").split("-")[0].split(".");
  const b = mapResolveBook(parts[0]);
  if (b && typeof window.codexGoto === "function") {
    window.codexGoto(b.id, parseInt(parts[1], 10) || 1, parseInt(parts[2], 10) || 1);
    return true;
  }
  if (typeof window.codexJumpToRef === "function") {window.codexJumpToRef(osisDisplay(osis));return true;}
  return false;
}

// ── Gazetteer — scripture refs for a POI. Cache → local atlas → AI. ──────
const POI_REFS_PROMPT = `You are CODEX GAZETTEER. Given a place name from biblical geography, return a single JSON object: {"refs":["gen.11.31","neh.9.7"]} — 2 to 5 OSIS-style verse references (lowercase book.chapter.verse) where this place appears or is most directly relevant in the Protestant canon. Books: gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sng isa jer lam eze dan hos joe amo oba jon mic nah hab zep hag zec mal mat mrk luk jhn act rom 1co 2co gal eph php col 1th 2th 1ti 2ti tit phm heb jas 1pe 2pe 1jn 2jn 3jn jud rev. If the place never appears in scripture, return {"refs":[]}. JSON only, no prose, no fences.`;

async function poiRefsResolve(poi) {
  const name = String(poi && poi.name || "").trim();
  if (!name) return { refs: [], src: "none" };
  const ck = "codex.poirefs." + name.toLowerCase();
  try {const raw = localStorage.getItem(ck);if (raw) return { refs: JSON.parse(raw), src: "cache" };} catch {}
  // Local atlas first — instant, offline, zero tokens.
  const lower = name.toLowerCase();
  const atlas = (window.CODEX_BIBLE_SITES || []).find((s) =>
  s.name.toLowerCase() === lower || lower.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(lower));
  if (atlas && Array.isArray(atlas.refs) && atlas.refs.length) {
    try {localStorage.setItem(ck, JSON.stringify(atlas.refs));} catch {}
    return { refs: atlas.refs, src: "atlas" };
  }
  mapAiBusy(true, "gazetteer");
  try {
    const obj = await window.CODEX_INTEL.intelAI({
      system: POI_REFS_PROMPT,
      user: `Place: ${name} (${poi && poi.kind || "place"}). Return the JSON object.`,
      maxTokens: 220
    });
    const refs = Array.isArray(obj.refs) ? obj.refs.slice(0, 5).filter((r) => typeof r === "string") : [];
    try {localStorage.setItem(ck, JSON.stringify(refs));} catch {}
    return { refs, src: "ai" };
  } catch (e) {
    return { refs: [], src: "offline" };
  } finally {
    mapAiBusy(false, "gazetteer");
  }
}

// ── POI DOSSIER — the click IS the document. In-surface card, never a
// popup/modal: wiki intel (summary + thumb) + ✦ READ chips → codexGoto. ──
function PoiDossier({ poi, cur, onClose }) {
  const [wiki, setWiki] = useState(null); // { summary, thumbUrl, pageUrl }
  const [refs, setRefs] = useState(null); // null = resolving
  const [refsSrc, setRefsSrc] = useState("");
  useEffect(() => {
    let live = true;
    setWiki(null);setRefs(null);setRefsSrc("");
    poiResolve(poi).then((w) => {if (live) setWiki(w);}).catch(() => {if (live) setWiki({ summary: "", thumbUrl: null, pageUrl: null });});
    poiRefsResolve(poi).then((r) => {if (live) {setRefs(r.refs);setRefsSrc(r.src);}});
    return () => {live = false;};
  }, [poi.name, poi.lat]);

  const yrRange = typeof poi.from === "number" && typeof poi.to === "number" ?
  `${fmtYear(poi.from)} – ${fmtYear(poi.to)}` : null;
  const resolving = wiki === null || refs === null;

  return (/*#__PURE__*/
    React.createElement("aside", { className: "cx-mapx-dossier", role: "region", "aria-label": `Dossier: ${poi.name}` }, /*#__PURE__*/
    React.createElement("header", { className: "cx-mapx-dossier-h" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-mapx-dossier-glyph", "aria-hidden": "true" }, poi.main ? "⌖" : poiGlyph(poi.kind)), /*#__PURE__*/
    React.createElement("span", { className: "cx-mapx-dossier-name" }, poi.name), /*#__PURE__*/
    React.createElement("button", {
      className: "cx-mapx-dossier-fly",
      title: "Center the map here",
      "aria-label": `Center map on ${poi.name}`,
      onClick: () => window.dispatchEvent(new CustomEvent("codex:map-fly", { detail: { lat: poi.lat, lng: poi.lng, zoom: poi.main ? 7 : 8 } })) },
    "\u2316"), /*#__PURE__*/
    React.createElement("button", { className: "cx-mapx-dossier-x", onClick: onClose, "aria-label": "Close dossier" }, "\xD7")
    ), /*#__PURE__*/
    React.createElement("div", { className: "cx-mapx-dossier-meta" }, /*#__PURE__*/
    React.createElement("span", null, (poi.kind || "site").toUpperCase()),
    yrRange ? /*#__PURE__*/React.createElement("span", null, "\xB7 known ", yrRange) : null,
    typeof poi.lat === "number" ? /*#__PURE__*/React.createElement("span", null, "\xB7 ", poi.lat.toFixed(2), "\xB0, ", poi.lng.toFixed(2), "\xB0") : null
    ),

    wiki && wiki.thumbUrl ? /*#__PURE__*/
    React.createElement("img", { className: "cx-mapx-dossier-img", loading: "lazy", src: wiki.thumbUrl, alt: poi.name }) :
    null,

    resolving ? /*#__PURE__*/
    React.createElement("div", { className: "cx-mapx-dossier-busy", role: "status" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-mapx-orb" }), /*#__PURE__*/
    React.createElement("span", null, "CONSULTING ARCHIVES\u2026")
    ) :
    null,

    wiki !== null ? /*#__PURE__*/
    React.createElement("p", { className: "cx-mapx-dossier-sum" },
    wiki.summary ?
    wiki.summary.length > 320 ? wiki.summary.slice(0, 320).trim() + "…" : wiki.summary :
    "No encyclopedia summary found for this site."
    ) :
    null,

    refs && refs.length ? /*#__PURE__*/
    React.createElement("div", { className: "cx-mapx-dossier-refs" },
    refs.map((r, i) => /*#__PURE__*/
    React.createElement("button", {
      key: i,
      className: "cx-mapx-readchip",
      "data-osis": r,
      onClick: () => mapGotoOsis(r),
      title: `Open the reader at ${osisDisplay(r)}` },
    "\u2726 READ ", osisDisplay(r))
    )
    ) :
    refs && refs.length === 0 ? /*#__PURE__*/
    React.createElement("div", { className: "cx-mapx-dossier-norefs" },
    refsSrc === "offline" ? "gazetteer offline · no cached refs" : "no direct scripture refs on record"
    ) :
    null, /*#__PURE__*/

    React.createElement("footer", { className: "cx-mapx-dossier-foot" }, /*#__PURE__*/
    React.createElement("span", null, "intel: wikipedia",

    refsSrc === "ai" ? " · refs: AI-suggested" : refsSrc === "atlas" ? " · refs: atlas" : refsSrc === "cache" ? " · refs: cached" : ""
    ),
    wiki && wiki.pageUrl ? /*#__PURE__*/
    React.createElement("a", { href: wiki.pageUrl, target: "_blank", rel: "noopener noreferrer" }, "wikipedia \u2197") :
    null
    )
    ));

}

// ── FOOT SCRUB — drag across the polity chronology at the map's foot. The
// active era recolors the map (label tint + glow wash via CSS var), writes
// the mono era readout, and broadcasts codex:year so POIs filter live. ──
function FootScrub({ polities, verseYear }) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const list = useMemo(
    () => polities.
    filter((p) => typeof p.from === "number" && typeof p.to === "number" && p.to > p.from && p.name).
    slice().
    sort((a, b) => a.from - b.from),
    [polities]
  );
  const yMin = useMemo(() => list.length ? Math.min(...list.map((p) => p.from)) : -2000, [list]);
  const yMax = useMemo(() => list.length ? Math.max(...list.map((p) => p.to)) : 2030, [list]);
  const vy = typeof verseYear === "number" && !Number.isNaN(verseYear) ?
  Math.max(yMin, Math.min(yMax, verseYear)) : yMin;
  const [year, setYear] = useState(vy);

  const activeIdx = useMemo(() => {
    let idx = list.findIndex((p) => year >= p.from && year <= p.to);
    if (idx === -1 && list.length) {
      let best = 0,bd = Infinity;
      list.forEach((p, i) => {
        const d = Math.min(Math.abs(p.from - year), Math.abs(p.to - year));
        if (d < bd) {bd = d;best = i;}
      });
      idx = best;
    }
    return idx;
  }, [list, year]);
  const active = list[activeIdx] || null;

  // Broadcast + recolor on every change (and once on mount, so the era
  // readout and glow are live before any interaction).
  useEffect(() => {
    try {
      window.__CODEX_MAP_ERA = active ? { name: active.name, from: active.from, to: active.to, year } : null;
      const ro = document.getElementById("cx-map-era");
      if (ro) ro.textContent = active ? `ERA ${active.name.toUpperCase()} · ${fmtYear(year)}` : "";
      const wrap = trackRef.current && trackRef.current.closest(".cx-map-field-wrap");
      if (wrap) wrap.style.setProperty("--cx-mapx-era-tint", eraTint(activeIdx, list.length));
      window.dispatchEvent(new CustomEvent("codex:year", { detail: { year } }));
    } catch {}
  }, [year, activeIdx, active && active.name, list.length]);

  const pct = (y) => (y - yMin) / Math.max(1, yMax - yMin) * 100;
  const yearAtX = (clientX) => {
    const el = trackRef.current;
    if (!el) return year;
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
    return Math.round(yMin + t * (yMax - yMin));
  };

  const onDown = (e) => {
    draggingRef.current = true;
    try {trackRef.current.setPointerCapture(e.pointerId);} catch {}
    setYear(yearAtX(e.clientX));
  };
  const onMove = (e) => {if (draggingRef.current) setYear(yearAtX(e.clientX));};
  const onUp = () => {draggingRef.current = false;};
  const onKey = (e) => {
    if (!list.length) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const ni = Math.max(0, Math.min(list.length - 1, activeIdx + dir));
      const p = list[ni];
      setYear(Math.round((p.from + p.to) / 2));
    } else if (e.key === "Home") {e.preventDefault();setYear(vy);}
  };

  if (!list.length) return null;
  return (/*#__PURE__*/
    React.createElement("div", { className: "cx-mapx-scrub", role: "group", "aria-label": "Time scrub \u2014 polity chronology" }, /*#__PURE__*/
    React.createElement("div", { className: "cx-mapx-scrub-ro", "aria-hidden": "true" }, /*#__PURE__*/
    React.createElement("span", { className: "cx-mapx-scrub-tag" }, "\u29D6 TIME"), /*#__PURE__*/
    React.createElement("span", { className: "cx-mapx-scrub-era" }, active ? active.name : "—"), /*#__PURE__*/
    React.createElement("span", { className: "cx-mapx-scrub-yr" }, fmtYear(year))
    ), /*#__PURE__*/
    React.createElement("div", {
      className: "cx-mapx-scrub-track",
      ref: trackRef,
      role: "slider",
      tabIndex: 0,
      "aria-label": "Year \u2014 drag across the chronology",
      "aria-valuemin": yMin,
      "aria-valuemax": yMax,
      "aria-valuenow": year,
      "aria-valuetext": active ? `${fmtYear(year)} — ${active.name}` : fmtYear(year),
      onPointerDown: onDown,
      onPointerMove: onMove,
      onPointerUp: onUp,
      onPointerCancel: onUp,
      onKeyDown: onKey },

    list.map((p, i) => /*#__PURE__*/
    React.createElement("span", {
      key: i,
      className: "cx-mapx-scrub-seg" + (i === activeIdx ? " is-active" : ""),
      style: {
        left: pct(p.from) + "%",
        width: Math.max(0.4, pct(p.to) - pct(p.from)) + "%",
        background: `color-mix(in srgb, ${eraTint(i, list.length)} ${i === activeIdx ? 72 : 30}%, transparent)`
      },
      title: `${p.name} · ${fmtYear(p.from)} – ${fmtYear(p.to)}` }
    )
    ), /*#__PURE__*/
    React.createElement("span", { className: "cx-mapx-scrub-vy", style: { left: pct(vy) + "%" }, title: "verse year", "aria-hidden": "true" }, "\u2726"), /*#__PURE__*/
    React.createElement("span", { className: "cx-mapx-scrub-cursor", style: { left: pct(year) + "%" }, "aria-hidden": "true" })
    )
    ));

}

// ── Self-injected CSS — idempotent <style id> (constellation.jsx pattern).
// Tokens only; every color routes through a --cx-* var (with fallback). ──
function injectMapXCSS() {
  if (document.getElementById("cx-mapx-css")) return;
  const el = document.createElement("style");
  el.id = "cx-mapx-css";
  el.textContent = `
    /* era recolor wash — sits above tiles (200/400), below markers (600) */
    .cx-mapx-eraglow { position: absolute; inset: 0; pointer-events: none; z-index: 450;
      background: radial-gradient(ellipse at 50% 62%, color-mix(in srgb, var(--cx-mapx-era-tint, transparent) 20%, transparent), transparent 72%);
      mix-blend-mode: screen; transition: background 0.5s ease; }
    .cx-map-field-wrap .cx-poi-lbl, .cx-map-field-wrap .cx-mark-lbl { color: var(--cx-mapx-era-tint, var(--cx-accent, #7ee0ff)); transition: color 0.5s ease; }
    .cx-mapx-coords-era { color: var(--cx-mapx-era-tint, var(--cx-accent, #7ee0ff)); letter-spacing: 0.12em; }

    /* POI significance pulse — settlements breathe harder */
    .cx-map-poi-leaflet .cx-mapx-poi-pulse { position: absolute; left: 50%; top: 50%; width: 24px; height: 24px;
      transform: translate(-50%,-50%); border-radius: 50%; pointer-events: none; opacity: 0;
      border: 1px solid var(--cx-mapx-era-tint, var(--cx-accent, #7ee0ff));
      animation: cx-mapx-pulse 3.4s ease-out infinite; }
    .cx-mapx-sig-2 .cx-mapx-poi-pulse { animation-duration: 2.4s; width: 28px; height: 28px; }
    .cx-mapx-sig-3 .cx-mapx-poi-pulse { animation-duration: 1.7s; width: 34px; height: 34px; }
    @keyframes cx-mapx-pulse { 0% { transform: translate(-50%,-50%) scale(0.25); opacity: 0.75; } 70% { opacity: 0.12; } 100% { transform: translate(-50%,-50%) scale(1.2); opacity: 0; } }

    /* in-surface busy orb + soft error (honesty furniture) */
    .cx-mapx-busy { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 1250;
      display: flex; align-items: center; gap: 8px; pointer-events: none;
      font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9.5px; letter-spacing: 0.14em;
      color: var(--cx-accent, #7ee0ff);
      background: color-mix(in srgb, var(--cx-bg, #06080e) 84%, transparent);
      border: 1px solid color-mix(in srgb, var(--cx-accent, #7ee0ff) 40%, transparent);
      border-radius: 6px; padding: 5px 10px; }
    .cx-mapx-orb { width: 10px; height: 10px; border-radius: 50%; flex: none;
      background: radial-gradient(circle, var(--cx-accent, #7ee0ff) 0%, color-mix(in srgb, var(--cx-accent, #7ee0ff) 40%, transparent) 60%, transparent 100%);
      animation: cx-mapx-orb 1.1s ease-in-out infinite; }
    @keyframes cx-mapx-orb { 0%, 100% { transform: scale(0.7); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } }
    .cx-mapx-softerr { position: absolute; top: 10px; right: 10px; z-index: 1250; pointer-events: none;
      font-family: var(--cx-mono, ui-monospace, monospace); font-size: 9px; letter-spacing: 0.12em;
      color: var(--cx-accent-2, #ffc46b);
      background: color-mix(in srgb, var(--cx-bg, #06080e) 84%, transparent);
      border: 1px solid color-mix(in srgb, var(--cx-accent-2, #ffc46b) 45%, transparent);
      border-radius: 6px; padding: 5px 9px; }

    /* POI dossier — in-surface card, never a popup */
    .cx-mapx-dossier { position: absolute; top: 46px; left: 8px; width: min(300px, 64%);
      max-height: calc(100% - 116px); overflow-y: auto; z-index: 1200;
      background: color-mix(in srgb, var(--cx-bg, #06080e) 92%, transparent);
      border: 1px solid color-mix(in srgb, var(--cx-accent, #7ee0ff) 35%, transparent);
      border-radius: 8px; padding: 10px 12px;
      font-family: var(--cx-mono, ui-monospace, monospace); color: var(--cx-fg, #dfe9f5);
      box-shadow: var(--cx-shadow, 0 8px 32px rgba(0,0,0,0.55)); }
    .cx-mapx-dossier-h { display: flex; align-items: center; gap: 7px; }
    .cx-mapx-dossier-glyph { color: var(--cx-mapx-era-tint, var(--cx-accent, #7ee0ff)); font-size: 13px; flex: none; }
    .cx-mapx-dossier-name { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cx-mapx-dossier-fly, .cx-mapx-dossier-x { flex: none; background: transparent; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--cx-fg-dim, #8aa) 45%, transparent); border-radius: 6px;
      color: var(--cx-fg-dim, #8aa); font-size: 12px; line-height: 1; padding: 4px 8px; min-width: 28px; min-height: 28px; }
    .cx-mapx-dossier-fly:hover, .cx-mapx-dossier-x:hover { color: var(--cx-accent, #7ee0ff); border-color: var(--cx-accent, #7ee0ff); }
    .cx-mapx-dossier-meta { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px;
      font-size: 8.5px; letter-spacing: 0.12em; color: var(--cx-fg-dim, #8aa); }
    .cx-mapx-dossier-img { width: 100%; height: 110px; object-fit: cover; border-radius: 6px; margin-top: 8px; display: block; }
    .cx-mapx-dossier-busy { display: flex; align-items: center; gap: 8px; margin-top: 8px;
      font-size: 9px; letter-spacing: 0.14em; color: var(--cx-accent, #7ee0ff); }
    .cx-mapx-dossier-sum { margin: 8px 0 0; font-family: var(--cx-serif, Georgia, serif);
      font-size: 12.5px; line-height: 1.55; color: var(--cx-fg, #dfe9f5); }
    .cx-mapx-dossier-refs { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 9px; }
    .cx-mapx-readchip { background: transparent; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--cx-accent, #7ee0ff) 50%, transparent); border-radius: 10px;
      color: var(--cx-accent, #7ee0ff); font-family: var(--cx-mono, ui-monospace, monospace);
      font-size: 9.5px; letter-spacing: 0.05em; padding: 4px 9px; min-height: 28px; }
    .cx-mapx-readchip:hover, .cx-mapx-readchip:focus-visible { background: color-mix(in srgb, var(--cx-accent, #7ee0ff) 16%, transparent); }
    .cx-mapx-dossier-norefs { margin-top: 8px; font-size: 8.5px; letter-spacing: 0.1em; color: var(--cx-fg-dim, #8aa); text-transform: uppercase; }
    .cx-mapx-dossier-foot { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-top: 10px;
      padding-top: 6px; border-top: 1px dotted color-mix(in srgb, var(--cx-fg-dim, #8aa) 40%, transparent);
      font-size: 8px; letter-spacing: 0.1em; color: var(--cx-fg-dim, #8aa); text-transform: uppercase; }
    .cx-mapx-dossier-foot a { color: var(--cx-accent, #7ee0ff); text-decoration: none; }

    /* keyboard mirror of the markers — visually hidden, focus-revealed */
    .cx-mapx-alist-wrap { position: absolute; top: 0; left: 0; right: 0; z-index: 1300; }
    .cx-mapx-alist { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);
      white-space: nowrap; margin: 0; padding: 0; list-style: none; }
    .cx-mapx-alist:focus-within { position: static; width: auto; height: auto; clip-path: none; white-space: normal;
      display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; max-height: 120px; overflow-y: auto;
      background: color-mix(in srgb, var(--cx-bg, #06080e) 90%, transparent); }
    .cx-mapx-alist li { display: inline-block; }
    .cx-mapx-alist button { background: transparent; cursor: pointer;
      border: 1px solid color-mix(in srgb, var(--cx-accent, #7ee0ff) 45%, transparent); border-radius: 10px;
      color: var(--cx-accent, #7ee0ff); font-family: var(--cx-mono, ui-monospace, monospace);
      font-size: 9px; letter-spacing: 0.05em; padding: 4px 9px; min-height: 28px; }

    /* TIME SCRUB at the foot — horizontal drag only; vertical scroll passes */
    .cx-mapx-scrub { position: absolute; left: 8px; right: 8px; bottom: 30px; z-index: 1100;
      font-family: var(--cx-mono, ui-monospace, monospace); pointer-events: none; }
    .cx-mapx-scrub-ro { display: flex; align-items: baseline; gap: 8px; margin-bottom: 3px;
      font-size: 8.5px; letter-spacing: 0.12em; color: var(--cx-fg-dim, #8aa);
      text-shadow: 0 1px 3px var(--cx-bg, #06080e); }
    .cx-mapx-scrub-tag { color: var(--cx-mapx-era-tint, var(--cx-accent, #7ee0ff)); font-weight: 700; }
    .cx-mapx-scrub-era { color: var(--cx-fg, #dfe9f5); text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 55%; }
    .cx-mapx-scrub-yr { margin-left: auto; color: var(--cx-mapx-era-tint, var(--cx-accent, #7ee0ff)); }
    .cx-mapx-scrub-track { position: relative; height: 18px; border-radius: 5px; overflow: hidden; cursor: ew-resize;
      pointer-events: auto; touch-action: pan-y; user-select: none; -webkit-user-select: none;
      background: color-mix(in srgb, var(--cx-bg, #06080e) 78%, transparent);
      border: 1px solid color-mix(in srgb, var(--cx-accent, #7ee0ff) 28%, transparent); }
    .cx-mapx-scrub-track:focus-visible { outline: 2px solid var(--cx-accent, #7ee0ff); outline-offset: 1px; }
    .cx-mapx-scrub-seg { position: absolute; top: 0; bottom: 0; pointer-events: none; transition: background 0.25s ease; }
    .cx-mapx-scrub-seg.is-active { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cx-fg, #dfe9f5) 35%, transparent); }
    .cx-mapx-scrub-vy { position: absolute; top: 50%; transform: translate(-50%, -50%); pointer-events: none;
      font-size: 8px; color: var(--cx-accent-2, #ffc46b); text-shadow: 0 0 4px var(--cx-bg, #06080e); }
    .cx-mapx-scrub-cursor { position: absolute; top: -2px; bottom: -2px; width: 2px; transform: translateX(-50%); pointer-events: none;
      background: var(--cx-fg, #dfe9f5); box-shadow: 0 0 6px color-mix(in srgb, var(--cx-mapx-era-tint, var(--cx-accent, #7ee0ff)) 80%, transparent); }
    @media (pointer: coarse) {
      .cx-mapx-scrub-track { height: 30px; }
      .cx-mapx-readchip, .cx-mapx-alist button, .cx-mapx-dossier-fly, .cx-mapx-dossier-x { min-height: 44px; min-width: 44px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .cx-mapx-orb { animation: none; opacity: 0.9; }
      .cx-mapx-poi-pulse { animation: none !important; opacity: 0.22; }
      .cx-mapx-eraglow, .cx-mapx-scrub-seg, .cx-map-field-wrap .cx-poi-lbl, .cx-mapx-coords-era { transition: none; }
    }
  `;
  document.head.appendChild(el);
}

Object.assign(window, { VerseMap });
})();
