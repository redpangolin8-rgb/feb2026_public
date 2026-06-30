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
  const ids = cfg.segments.map(s => s.id);
  return ids.length > 1 ? `Stations ${ids.join(' / ')}` : `Station ${ids[0]}`;
}

// Populates a <select> with one option per registered location and wires
// it to navigate to the same page with ?station=<key> on change.
function initStationNav(selectEl, stations, activeKey) {
  selectEl.textContent = '';
  for (const [key, cfg] of Object.entries(stations)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = cfg.name;
    if (key === activeKey) opt.selected = true;
    selectEl.appendChild(opt);
  }
  selectEl.addEventListener('change', () => {
    const params = new URLSearchParams(location.search);
    params.set('station', selectEl.value);
    location.search = params.toString();
  });
}
