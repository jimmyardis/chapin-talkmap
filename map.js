/* ============================================================
   The Chapin Map — Sessions 1-6
   Mapbox 3D map of Chapin SC + Greater Chapin area, with:
     - Census tract choropleth (switchable across 5 metrics)
     - Place boundaries (Chapin, Irmo, Lake Murray of Richland, ZIP 29036)
     - Colloquial place markers (Ballentine, White Rock)
     - Voice agent integration (handled in voice.js)
   ============================================================ */

// =============================================================
// 1. MAPBOX TOKEN
// =============================================================
mapboxgl.accessToken = 'pk.eyJ1IjoiamltbXlhcmRpcyIsImEiOiJjbW95cDhiOWEwZGNwMnNxNjU5MnNybGdzIn0.kXOm1Xhn4MGll3Z9PNqmbA';

// =============================================================
// 2. CHAPIN, SOUTH CAROLINA
// =============================================================
const CHAPIN_CENTER = [-81.3528, 34.1654];
const DEFAULT_ZOOM = 11;
const DEFAULT_PITCH = 35;
const DEFAULT_BEARING = 0;

// =============================================================
// 3. LANDMARKS
// =============================================================
const LANDMARKS = [
  { name: 'Chapin Town Hall',    coordinates: [-81.3527, 34.1654], description: 'Heart of downtown Chapin.' },
  { name: 'Chapin High School',  coordinates: [-81.3478, 34.1611], description: 'Home of the Eagles.' },
  { name: 'Crooked Creek Park',  coordinates: [-81.3484, 34.1789], description: 'Local recreation hub on the north side.' },
  { name: 'Lake Murray Dam',     coordinates: [-81.2128, 34.0523], description: 'Saluda Hydroelectric Dam at the south end of Lake Murray.' },
];

// =============================================================
// 4. DATA LAYER PATHS
// =============================================================
const CENSUS_GEOJSON_PATH = 'data/chapin-area-tracts.geojson';
const PLACES_GEOJSON_PATH = 'data/chapin-places.geojson';

// =============================================================
// 5. METRICS — each one defines its own choropleth + legend
// -------------------------------------------------------------
// Add a new metric here and it shows up in the dropdown automatically.
// =============================================================
const METRICS = {
  growth_pct: {
    label: 'Population growth, 2010 → 2020',
    property: 'growth_pct',
    nullCheck: ['==', ['get', 'has_2010'], false],
    nullColor: 'rgba(180, 180, 180, 0.55)',
    nullLabel: 'New tract since 2010 (boundary changed)',
    stops: [
      [-15, '#4a4a4a'],
      [ -5, '#888888'],
      [  0, '#f3e8d6'],
      [ 10, '#9bb8d3'],
      [ 25, '#3d6fa3'],
      [ 50, '#1a4d8f'],
      [ 85, '#0a2845'],
    ],
    legendLabels: ['−15%', '0%', '+25%', '+85%'],
    formatPopup: v => v == null ? 'n/a' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
  },

  density_per_sqkm: {
    label: 'Population density',
    property: 'density_per_sqkm',
    nullCheck: ['==', ['get', 'density_per_sqkm'], null],
    nullColor: 'rgba(180, 180, 180, 0.55)',
    nullLabel: 'No data',
    stops: [
      [   0, '#f7fbff'],
      [ 100, '#deebf7'],
      [ 500, '#9ecae1'],
      [1500, '#4292c6'],
      [3000, '#2171b5'],
      [6000, '#08306b'],
    ],
    legendLabels: ['0', '500', '1.5k', '6k+ /km²'],
    formatPopup: v => v == null ? 'n/a' : `${Math.round(v).toLocaleString()} /km²`,
  },

  median_income: {
    label: 'Median household income',
    property: 'median_income',
    nullCheck: ['==', ['get', 'median_income'], null],
    nullColor: 'rgba(180, 180, 180, 0.55)',
    nullLabel: 'No data',
    stops: [
      [ 25000, '#ffffe5'],
      [ 50000, '#d9f0a3'],
      [ 75000, '#78c679'],
      [100000, '#41ab5d'],
      [150000, '#005a32'],
    ],
    legendLabels: ['$25k', '$50k', '$100k', '$150k+'],
    formatPopup: v => v == null ? 'n/a' : `$${v.toLocaleString()}`,
  },

  median_age: {
    label: 'Median age',
    property: 'median_age',
    nullCheck: ['==', ['get', 'median_age'], null],
    nullColor: 'rgba(180, 180, 180, 0.55)',
    nullLabel: 'No data',
    stops: [
      [20, '#fff5eb'],
      [30, '#fdd0a2'],
      [40, '#fd8d3c'],
      [50, '#d94801'],
      [60, '#7f2704'],
    ],
    legendLabels: ['20', '30', '40', '60+'],
    formatPopup: v => v == null ? 'n/a' : `${v.toFixed(1)} yrs`,
  },

  pct_nonwhite: {
    label: 'Racial composition (% non-white)',
    property: 'pct_nonwhite',
    nullCheck: ['==', ['get', 'pct_nonwhite'], null],
    nullColor: 'rgba(180, 180, 180, 0.55)',
    nullLabel: 'No data',
    stops: [
      [  0, '#fcfbfd'],
      [ 25, '#dadaeb'],
      [ 50, '#9e9ac8'],
      [ 75, '#6a51a3'],
      [100, '#3f007d'],
    ],
    legendLabels: ['0%', '25%', '50%', '100%'],
    formatPopup: v => v == null ? 'n/a' : `${v.toFixed(0)}%`,
  },
};

const DEFAULT_METRIC = 'growth_pct';
let currentMetric = DEFAULT_METRIC;

function buildFillColorExpression(metricKey) {
  const m = METRICS[metricKey];
  const interpolation = ['interpolate', ['linear'], ['coalesce', ['get', m.property], 0]];
  for (const [stop, color] of m.stops) interpolation.push(stop, color);
  return ['case', m.nullCheck, m.nullColor, interpolation];
}

function gradientCss(metricKey) {
  const m = METRICS[metricKey];
  const segments = m.stops.map(([_, color], i) => {
    const pct = (i / (m.stops.length - 1)) * 100;
    return `${color} ${pct}%`;
  });
  return `linear-gradient(to right, ${segments.join(', ')})`;
}

function updateLegend(metricKey) {
  const m = METRICS[metricKey];
  const titleEl   = document.querySelector('.legend-title');
  const gradEl    = document.querySelector('.legend-gradient');
  const labelsEl  = document.querySelector('.legend-labels');
  const nullDescr = document.querySelector('.legend-null-label');

  if (titleEl)  titleEl.textContent = m.label;
  if (gradEl)   gradEl.style.background = gradientCss(metricKey);
  if (labelsEl) labelsEl.innerHTML = m.legendLabels.map(l => `<span>${l}</span>`).join('');
  if (nullDescr) nullDescr.textContent = m.nullLabel;
}

function setMetric(metricKey) {
  if (!METRICS[metricKey]) return;
  currentMetric = metricKey;
  if (map.getLayer('census-fill')) {
    map.setPaintProperty('census-fill', 'fill-color', buildFillColorExpression(metricKey));
  }
  updateLegend(metricKey);
}

// =============================================================
// 6. INITIALIZE THE MAP
// =============================================================
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  center: CHAPIN_CENTER,
  zoom: DEFAULT_ZOOM,
  pitch: DEFAULT_PITCH,
  bearing: DEFAULT_BEARING,
  antialias: true,
});

map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');

// =============================================================
// 7. ON LOAD
// =============================================================
map.on('load', async () => {
  // -------- 7a. Lighting preset --------
  try { map.setConfigProperty('basemap', 'lightPreset', 'day'); } catch (e) {}

  // -------- 7b. Census choropleth --------
  try {
    map.addSource('chapin-area-tracts', {
      type: 'geojson',
      data: CENSUS_GEOJSON_PATH,
      promoteId: 'GEOID',
    });

    map.addLayer({
      id: 'census-fill',
      type: 'fill',
      source: 'chapin-area-tracts',
      slot: 'bottom',
      paint: {
        'fill-color': buildFillColorExpression(DEFAULT_METRIC),
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false], 0.85,
          0.65,
        ],
      },
    });

    map.addLayer({
      id: 'census-outline',
      type: 'line',
      source: 'chapin-area-tracts',
      slot: 'middle',
      paint: {
        'line-color': 'rgba(255, 255, 255, 0.7)',
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false], 2.5,
          0.6,
        ],
      },
    });

    console.log('🏘️  Census layer loaded.');
  } catch (err) {
    console.error('Census layer failed:', err);
  }

  // -------- 7c. Place boundaries --------
  try {
    map.addSource('chapin-places', { type: 'geojson', data: PLACES_GEOJSON_PATH });

    map.addLayer({
      id: 'zip-fill',
      type: 'fill',
      source: 'chapin-places',
      filter: ['==', ['get', 'kind'], 'zip'],
      slot: 'middle',
      paint: { 'fill-color': '#c9a55a', 'fill-opacity': 0.07 },
    });

    map.addLayer({
      id: 'zip-outline',
      type: 'line',
      source: 'chapin-places',
      filter: ['==', ['get', 'kind'], 'zip'],
      slot: 'top',
      paint: { 'line-color': '#c9a55a', 'line-width': 2, 'line-dasharray': [3, 2] },
    });

    map.addLayer({
      id: 'place-outline',
      type: 'line',
      source: 'chapin-places',
      filter: ['any',
        ['==', ['get', 'kind'], 'incorporated_town'],
        ['==', ['get', 'kind'], 'cdp'],
      ],
      slot: 'top',
      paint: { 'line-color': '#a07d2e', 'line-width': 2.4 },
    });

    map.addLayer({
      id: 'colloquial-points',
      type: 'circle',
      source: 'chapin-places',
      filter: ['==', ['get', 'kind'], 'colloquial'],
      slot: 'top',
      paint: {
        'circle-radius': 7,
        'circle-color': '#c9a55a',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });

    map.addLayer({
      id: 'place-labels',
      type: 'symbol',
      source: 'chapin-places',
      filter: ['!=', ['get', 'kind'], 'zip'],
      slot: 'top',
      layout: {
        'text-field': ['get', 'display_name'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 14, 14],
        'text-offset': [0, 1.0],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#5a4015',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.6,
      },
    });

    console.log('🏛️  Place boundaries loaded.');
  } catch (err) {
    console.error('Place layer failed:', err);
  }

  // -------- 7d. Landmark pins --------
  LANDMARKS.forEach((landmark) => {
    const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
      <div class="marker-popup">
        <h3>${landmark.name}</h3>
        <p>${landmark.description}</p>
      </div>`);
    new mapboxgl.Marker({ color: '#c1392b' })
      .setLngLat(landmark.coordinates).setPopup(popup).addTo(map);
  });

  console.log('🗺️  Chapin map loaded — Session 6 (Demographics).');
});

// =============================================================
// 8. CENSUS TRACT INTERACTION
// =============================================================
let hoveredTractId = null;

map.on('mousemove', 'census-fill', (e) => {
  if (e.features.length === 0) return;
  map.getCanvas().style.cursor = 'pointer';
  const newId = e.features[0].id;
  if (hoveredTractId !== null && hoveredTractId !== newId) {
    map.setFeatureState({ source: 'chapin-area-tracts', id: hoveredTractId }, { hover: false });
  }
  hoveredTractId = newId;
  map.setFeatureState({ source: 'chapin-area-tracts', id: hoveredTractId }, { hover: true });
});

map.on('mouseleave', 'census-fill', () => {
  map.getCanvas().style.cursor = '';
  if (hoveredTractId !== null) {
    map.setFeatureState({ source: 'chapin-area-tracts', id: hoveredTractId }, { hover: false });
  }
  hoveredTractId = null;
});

map.on('click', 'census-fill', (e) => {
  if (e.features.length === 0) return;
  const p = e.features[0].properties;
  const name = p.NAME || `Tract ${p.TRACT}`;
  const countyTag = p.county_name ? `<div class="tract-county">${p.county_name} County, SC${p.is_greater_chapin === true || p.is_greater_chapin === 'true' ? ' &middot; <span class="ga-tag">Greater Chapin</span>' : ''}</div>` : '';

  const fmt = (key) => {
    const m = METRICS[key];
    if (!m) return 'n/a';
    const raw = p[m.property];
    return m.formatPopup(raw == null ? null : (typeof raw === 'string' && /^-?\d+(\.\d+)?$/.test(raw) ? parseFloat(raw) : raw));
  };

  const stat = (label, value) => `<div class="tract-stat"><span class="label">${label}</span><span class="value">${value}</span></div>`;

  const body = `
    <div class="tract-popup">
      <h3>${name}</h3>
      ${countyTag}
      <div class="tract-stat-grid">
        ${stat('Pop 2020', p.pop_2020 != null ? Number(p.pop_2020).toLocaleString() : 'n/a')}
        ${stat('Growth', fmt('growth_pct'))}
        ${stat('Density', fmt('density_per_sqkm'))}
        ${stat('Median income', fmt('median_income'))}
        ${stat('Median age', fmt('median_age'))}
        ${stat('% Non-white', fmt('pct_nonwhite'))}
      </div>
    </div>`;

  new mapboxgl.Popup({ offset: 4, maxWidth: '300px' }).setLngLat(e.lngLat).setHTML(body).addTo(map);
});

// =============================================================
// 9. PLACES INTERACTION
// =============================================================
['zip-fill', 'place-outline', 'colloquial-points'].forEach((layerId) => {
  map.on('click', layerId, (e) => {
    if (e.features.length === 0) return;
    const p = e.features[0].properties;
    new mapboxgl.Popup({ offset: 8, maxWidth: '280px' })
      .setLngLat(e.lngLat)
      .setHTML(`<div class="place-popup"><h3>${p.display_name}</h3><p>${p.tooltip || ''}</p></div>`)
      .addTo(map);
    e.originalEvent.stopPropagation();
  });
  map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
});

// =============================================================
// 10. CONTROLS
// =============================================================
document.getElementById('resetView').addEventListener('click', () => {
  map.flyTo({ center: CHAPIN_CENTER, zoom: DEFAULT_ZOOM, pitch: DEFAULT_PITCH, bearing: DEFAULT_BEARING, duration: 1800, essential: true });
});

let in3DMode = true;
document.getElementById('toggle3D').addEventListener('click', (e) => {
  in3DMode = !in3DMode;
  map.easeTo({ pitch: in3DMode ? DEFAULT_PITCH : 0, bearing: in3DMode ? DEFAULT_BEARING : 0, duration: 1200 });
  e.target.textContent = in3DMode ? 'Toggle 3D' : 'Toggle 2D';
});

const LIGHT_PRESETS = ['day', 'dusk', 'dawn', 'night'];
let lightIndex = 0;
document.getElementById('cycleLight').addEventListener('click', (e) => {
  lightIndex = (lightIndex + 1) % LIGHT_PRESETS.length;
  const preset = LIGHT_PRESETS[lightIndex];
  try { map.setConfigProperty('basemap', 'lightPreset', preset); e.target.textContent = `Lighting: ${preset}`; }
  catch (err) {}
});

let placesVisible = true;
const placesBtn = document.getElementById('togglePlaces');
if (placesBtn) {
  placesBtn.addEventListener('click', (e) => {
    placesVisible = !placesVisible;
    const visibility = placesVisible ? 'visible' : 'none';
    ['zip-fill', 'zip-outline', 'place-outline', 'colloquial-points', 'place-labels'].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
    });
    e.target.textContent = placesVisible ? 'Hide Places' : 'Show Places';
  });
}

// Metric selector dropdown
const metricSelector = document.getElementById('metricSelector');
if (metricSelector) {
  // Populate options dynamically from METRICS
  metricSelector.innerHTML = Object.keys(METRICS).map(key =>
    `<option value="${key}"${key === DEFAULT_METRIC ? ' selected' : ''}>${METRICS[key].label}</option>`
  ).join('');
  metricSelector.addEventListener('change', (e) => setMetric(e.target.value));
}

// Initialize legend on load
window.addEventListener('DOMContentLoaded', () => updateLegend(DEFAULT_METRIC));

// =============================================================
// 11. ERROR HANDLING (token missing nudge)
// =============================================================
map.on('error', (err) => {
  if (mapboxgl.accessToken === 'PASTE_YOUR_MAPBOX_TOKEN_HERE') {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                  font-family:system-ui;background:#0a0a0a;color:#f5f5f5;padding:24px;text-align:center;">
        <div style="max-width:480px;">
          <h1 style="font-family:'Libre Baskerville',serif;font-size:28px;margin-bottom:12px;">Almost there</h1>
          <p style="line-height:1.5;color:#ccc;">Open <code>map.js</code> and paste your Mapbox public token (starts with <code>pk.</code>) at the top.</p>
        </div>
      </div>`;
  } else {
    console.error('Mapbox error:', err);
  }
});
