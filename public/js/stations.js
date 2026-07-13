// Shared station-registry helpers used by all weather/climate pages.
// Reads public/data/stations.json, which maps a location key to an ECCC
// station configuration: { name, province, startYear, segments }.
// Each segment is { id, from?, until? } — from is inclusive, until is
// exclusive, in calendar years. The last segment (no "until") is the
// currently active station for that location.

async function loadStations() {
  const res = await fetch('data/stations.json');
  return res.json();
}

function currentStationKey(stations) {
  const key = new URLSearchParams(location.search).get('station');
  return (key && stations[key]) ? key : Object.keys(stations)[0];
}

function stationIdForYear(cfg, year) {
  for (const seg of cfg.segments) {
    if (seg.from !== undefined && year < seg.from) continue;
    if (seg.until !== undefined && year >= seg.until) continue;
    return seg.id;
  }
  return cfg.segments[cfg.segments.length - 1].id;
}

function weatherDataURL(cfg, year) {
  return `data/weather-${stationIdForYear(cfg, year)}-${year}.csv`;
}

function stationLabel(cfg) {
  if (cfg.virtual && cfg.mergeSources) return `Merged ${cfg.mergeSources.join(' + ')}`;
  const ids = cfg.segments.map(s => s.id);
  return ids.length > 1 ? `Stations ${ids.join(' / ')}` : `Station ${ids[0]}`;
}

// A short note for status lines flagging when a location's record is
// composed of more than one underlying ECCC station — either day-by-day
// merged (a virtual entry) or spliced end-to-end across eras (multiple
// segments). Returns '' for an ordinary single-station location, since
// there's nothing worth calling out.
function stationCompositionNote(cfg) {
  if (cfg.virtual && cfg.mergeSources) {
    return ` — merged day-by-day from stations ${cfg.mergeSources.join(' + ')}`;
  }
  const ids = cfg.segments.map(s => s.id);
  if (ids.length > 1) {
    return ` — spliced from ${ids.length} stations (${ids.join(' → ')})`;
  }
  return '';
}

// Some older ECCC records (notably Toronto's 1840s) leave Total Precip blank
// while recording Total Rain and Total Snow separately. ECCC's own convention
// for those stations is Total Precip = rain (mm) + snow (cm, counted as mm of
// water at the standard 10:1 ratio) — verified to hold on ~100% of their rows
// where all three columns are populated — so reconstruct the combined value
// when the column is blank rather than dropping the day.
function precipFrom(cols, precipIdx, rainIdx, snowIdx) {
  const p = precipIdx !== -1 ? parseFloat(cols[precipIdx]) : NaN;
  if (isFinite(p)) return p;
  const r = rainIdx !== -1 ? parseFloat(cols[rainIdx]) : NaN;
  const s = snowIdx !== -1 ? parseFloat(cols[snowIdx]) : NaN;
  if (!isFinite(r) && !isFinite(s)) return NaN;
  return (isFinite(r) ? r : 0) + (isFinite(s) ? s : 0);
}

const PROVINCE_NAMES = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',
};

// Groups [key, cfg] entries by province/territory, sorted by full province
// name, with locations within each group sorted alphabetically by display name.
function groupStationsByProvince(stations) {
  const groups = {};
  for (const [key, cfg] of Object.entries(stations)) {
    const prov = cfg.province || '?';
    if (!groups[prov]) groups[prov] = [];
    groups[prov].push([key, cfg]);
  }
  const provCodes = Object.keys(groups).sort((a, b) =>
    (PROVINCE_NAMES[a] || a).localeCompare(PROVINCE_NAMES[b] || b));
  for (const prov of provCodes) {
    groups[prov].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }
  return provCodes.map(code => ({ code, name: PROVINCE_NAMES[code] || code, items: groups[code] }));
}

// Short marker for option text flagging a composed location (merged or
// spliced from multiple stations), so it's visible in the dropdown itself
// without having to select the station first. '' for an ordinary location.
function stationCompositionTag(cfg) {
  if (cfg.virtual && cfg.mergeSources) return ' (merged)';
  const n = cfg.segments.length;
  return n > 1 ? ` (${n} stations)` : '';
}

// Builds <optgroup>s (one per province) inside the given <select>.
function buildProvinceOptions(selectEl, stations, activeKey) {
  for (const { name, items } of groupStationsByProvince(stations)) {
    const group = document.createElement('optgroup');
    group.label = name;
    for (const [key, cfg] of items) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = cfg.name + stationCompositionTag(cfg);
      if (key === activeKey) opt.selected = true;
      group.appendChild(opt);
    }
    selectEl.appendChild(group);
  }
}

// Populates a <select> with one option per registered location, grouped by
// province/territory, and wires it to navigate to the same page with
// ?station=<key> on change.
function initStationNav(selectEl, stations, activeKey) {
  selectEl.textContent = '';
  buildProvinceOptions(selectEl, stations, activeKey);
  selectEl.addEventListener('change', () => {
    const params = new URLSearchParams(location.search);
    params.set('station', selectEl.value);
    location.search = params.toString();
  });
}
