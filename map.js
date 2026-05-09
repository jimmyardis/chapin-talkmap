/* ============================================================
   The Chapin Map — Sessions 1 + 4
   Mapbox 3D map of Chapin SC with landmark pins and
   Census 2010-2020 population growth choropleth for
   Lexington County.
   ============================================================ */

// =============================================================
// 1. MAPBOX TOKEN
// =============================================================
mapboxgl.accessToken = 'pk.eyJ1IjoiamltbXlhcmRpcyIsImEiOiJjbW93d3EzOGowaHBiMnJvZngweWIxZXN6In0.DGI7a-dUV1fphfE4uP-HwQ';

// =============================================================
// 2. CHAPIN, SOUTH CAROLINA
// =============================================================
const CHAPIN_CENTER = [-81.3528, 34.1654];
const DEFAULT_ZOOM = 11;     // wider so the whole county Census layer is visible
const DEFAULT_PITCH = 35;    // gentler tilt — better for reading the choropleth
const DEFAULT_BEARING = 0;

// =============================================================
// 3. LANDMARKS
// =============================================================
const LANDMARKS = [
  {
    name: 'Chapin Town Hall',
    coordinates: [-81.3527, 34.1654],
    description: 'Heart of downtown Chapin.'
  },
  {
    name: 'Chapin High School',
    coordinates: [-81.3478, 34.1611],
    description: 'Home of the Eagles.'
  },
  {
    name: 'Crooked Creek Park',
    coordinates: [-81.3484, 34.1789],
    description: 'Local recreation hub on the north side.'
  },
  {
    name: 'Lake Murray Dam',
    coordinates: [-81.2128, 34.0523],
    description: 'Saluda Hydroelectric Dam at the south end of Lake Murray.'
  }
];

// =============================================================
// 4. DATA LAYER PATHS
// =============================================================
const CENSUS_GEOJSON_PATH = 'data/chapin-area-tracts.geojson';
const PLACES_GEOJSON_PATH = 'data/chapin-places.geojson';

// =============================================================
// 5. INITIALIZE THE MAP
// =============================================================
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/standard',
  center: CHAPIN_CENTER,
  zoom: DEFAULT_ZOOM,
  pitch: DEFAULT_PITCH,
  bearing: DEFAULT_BEARING,
  antialias: true
});

map.addControl(
  new mapboxgl.NavigationControl({ visualizePitch: true }),
  'bottom-right'
);

// =============================================================
// 6. ON LOAD: LIGHTING, CENSUS LAYER, LANDMARKS
// =============================================================
map.on('load', async () => {
  // -------- 6a. Lighting preset --------
  try {
    map.setConfigProperty('basemap', 'lightPreset', 'day');
  } catch (e) {
    console.log('Light preset not supported on this style — that\'s OK.');
  }

  // -------- 6b. Census choropleth layer --------
  try {
    map.addSource('chapin-area-tracts', {
      type: 'geojson',
      data: CENSUS_GEOJSON_PATH,
      promoteId: 'GEOID'  // enables hover state via feature-state
    });

    // Fill layer — color encodes growth_pct (2010 -> 2020)
    // Using slot: 'bottom' for Mapbox Standard v3 — places the choropleth
    // under road labels but above the basemap.
    map.addLayer({
      id: 'census-fill',
      type: 'fill',
      source: 'chapin-area-tracts',
      slot: 'bottom',
      paint: {
        'fill-color': [
          'case',
          // tracts that didn't exist in 2010 (boundary splits) -> neutral grey
          ['==', ['get', 'has_2010'], false], 'rgba(180, 180, 180, 0.55)',
          // otherwise, gradient from grey (decline) -> cream (flat) -> navy (growth)
          [
            'interpolate', ['linear'],
            ['coalesce', ['get', 'growth_pct'], 0],
            -15, '#4a4a4a',
             -5, '#888888',
              0, '#f3e8d6',
             10, '#9bb8d3',
             25, '#3d6fa3',
             50, '#1a4d8f',
             85, '#0a2845'
          ]
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false], 0.85,
          0.65
        ]
      }
    });

    // Outline layer — thin white tract boundaries
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
          0.6
        ]
      }
    });

    console.log('🏘️  Census 2010-2020 layer loaded.');
  } catch (err) {
    console.error('Could not load Census layer:', err);
    console.log('Make sure data/chapin-area-tracts.geojson exists in your project folder.');
  }

  // -------- 6c. Place boundaries (towns, CDPs, ZIP 29036, colloquial centroids) --------
  try {
    map.addSource('chapin-places', {
      type: 'geojson',
      data: PLACES_GEOJSON_PATH,
    });

    // ZIP 29036 fill — very subtle gold tint = the "Chapin mailing footprint"
    map.addLayer({
      id: 'zip-fill',
      type: 'fill',
      source: 'chapin-places',
      filter: ['==', ['get', 'kind'], 'zip'],
      slot: 'middle',
      paint: {
        'fill-color': '#c9a55a',
        'fill-opacity': 0.07,
      },
    });

    // ZIP 29036 dashed outline
    map.addLayer({
      id: 'zip-outline',
      type: 'line',
      source: 'chapin-places',
      filter: ['==', ['get', 'kind'], 'zip'],
      slot: 'top',
      paint: {
        'line-color': '#c9a55a',
        'line-width': 2,
        'line-dasharray': [3, 2],
      },
    });

    // Town + CDP outlines (Chapin, Irmo, Lake Murray of Richland)
    map.addLayer({
      id: 'place-outline',
      type: 'line',
      source: 'chapin-places',
      filter: ['any',
        ['==', ['get', 'kind'], 'incorporated_town'],
        ['==', ['get', 'kind'], 'cdp']
      ],
      slot: 'top',
      paint: {
        'line-color': '#a07d2e',
        'line-width': 2.4,
      },
    });

    // Colloquial centroids (Ballentine, White Rock — no official boundary)
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

    // Place labels — for towns, CDPs, and colloquial points (skip ZIP)
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
    console.error('Could not load place layer:', err);
    console.log('Make sure data/chapin-places.geojson exists in your project folder.');
  }

  // -------- 6d. Landmark pins --------
  LANDMARKS.forEach((landmark) => {
    const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
      .setHTML(`
        <div class="marker-popup">
          <h3>${landmark.name}</h3>
          <p>${landmark.description}</p>
        </div>
      `);

    new mapboxgl.Marker({ color: '#c1392b' })  // landmarks are red now to pop against navy
      .setLngLat(landmark.coordinates)
      .setPopup(popup)
      .addTo(map);
  });

  console.log('🗺️  Chapin map loaded — Session 4 (Census).');
});

// =============================================================
// 7. CENSUS TRACT INTERACTION (hover + click popup)
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
  const countyTag = p.county_name ? `<div class="tract-county">${p.county_name} County, SC</div>` : '';

  let body;
  if (p.has_2010 === true || p.has_2010 === 'true') {
    const growth = parseFloat(p.growth_pct);
    const arrow = growth > 0 ? '▲' : (growth < 0 ? '▼' : '▬');
    const sign = growth > 0 ? '+' : '';
    body = `
      <div class="tract-popup">
        <h3>${name}</h3>
        ${countyTag}
        <div class="tract-stat">
          <span class="label">2010</span>
          <span class="value">${Number(p.pop_2010).toLocaleString()}</span>
        </div>
        <div class="tract-stat">
          <span class="label">2020</span>
          <span class="value">${Number(p.pop_2020).toLocaleString()}</span>
        </div>
        <div class="tract-growth ${growth >= 0 ? 'positive' : 'negative'}">
          ${arrow} ${sign}${growth.toFixed(1)}% growth
        </div>
      </div>`;
  } else {
    body = `
      <div class="tract-popup">
        <h3>${name}</h3>
        ${countyTag}
        <div class="tract-stat">
          <span class="label">2020</span>
          <span class="value">${Number(p.pop_2020).toLocaleString()}</span>
        </div>
        <div class="tract-note">New tract since 2010 — boundary changed, no clean comparison.</div>
      </div>`;
  }

  new mapboxgl.Popup({ offset: 4, maxWidth: '260px' })
    .setLngLat(e.lngLat)
    .setHTML(body)
    .addTo(map);
});

// =============================================================
// 8. BUTTON HANDLERS
// =============================================================
document.getElementById('resetView').addEventListener('click', () => {
  map.flyTo({
    center: CHAPIN_CENTER,
    zoom: DEFAULT_ZOOM,
    pitch: DEFAULT_PITCH,
    bearing: DEFAULT_BEARING,
    duration: 1800,
    essential: true
  });
});

let in3DMode = true;
document.getElementById('toggle3D').addEventListener('click', (e) => {
  in3DMode = !in3DMode;
  map.easeTo({
    pitch: in3DMode ? DEFAULT_PITCH : 0,
    bearing: in3DMode ? DEFAULT_BEARING : 0,
    duration: 1200
  });
  e.target.textContent = in3DMode ? 'Toggle 3D' : 'Toggle 2D';
});

const LIGHT_PRESETS = ['day', 'dusk', 'dawn', 'night'];
let lightIndex = 0;
document.getElementById('cycleLight').addEventListener('click', (e) => {
  lightIndex = (lightIndex + 1) % LIGHT_PRESETS.length;
  const preset = LIGHT_PRESETS[lightIndex];
  try {
    map.setConfigProperty('basemap', 'lightPreset', preset);
    e.target.textContent = `Lighting: ${preset}`;
  } catch (err) {
    console.log('Light preset switching needs Mapbox style v3.');
  }
});

let censusVisible = true;
const censusBtn = document.getElementById('toggleCensus');
if (censusBtn) {
  censusBtn.addEventListener('click', (e) => {
    censusVisible = !censusVisible;
    const visibility = censusVisible ? 'visible' : 'none';
    if (map.getLayer('census-fill'))    map.setLayoutProperty('census-fill', 'visibility', visibility);
    if (map.getLayer('census-outline')) map.setLayoutProperty('census-outline', 'visibility', visibility);
    e.target.textContent = censusVisible ? 'Hide Census' : 'Show Census';
  });
}

// Toggle places overlay
let placesVisible = true;
const placesBtn = document.getElementById('togglePlaces');
if (placesBtn) {
  placesBtn.addEventListener('click', (e) => {
    placesVisible = !placesVisible;
    const visibility = placesVisible ? 'visible' : 'none';
    ['zip-fill', 'zip-outline', 'place-outline', 'colloquial-points', 'place-labels']
      .forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
      });
    e.target.textContent = placesVisible ? 'Hide Places' : 'Show Places';
  });
}

// Click handlers for places — show popup with the tooltip
['zip-fill', 'place-outline', 'colloquial-points'].forEach((layerId) => {
  map.on('click', layerId, (e) => {
    if (e.features.length === 0) return;
    const p = e.features[0].properties;
    new mapboxgl.Popup({ offset: 8, maxWidth: '280px' })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="place-popup">
          <h3>${p.display_name}</h3>
          <p>${p.tooltip || ''}</p>
        </div>
      `)
      .addTo(map);
    e.originalEvent.stopPropagation();
  });

  // pointer cursor on hover
  map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
});

// =============================================================
// 9. ERROR HANDLING
// =============================================================
map.on('error', (err) => {
  if (mapboxgl.accessToken === 'PASTE_YOUR_MAPBOX_TOKEN_HERE') {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                  font-family:system-ui;background:#0a0a0a;color:#f5f5f5;padding:24px;text-align:center;">
        <div style="max-width:480px;">
          <h1 style="font-family:'Libre Baskerville',serif;font-size:28px;margin-bottom:12px;">
            Almost there
          </h1>
          <p style="line-height:1.5;color:#ccc;">
            Open <code style="background:#222;padding:2px 6px;border-radius:3px;">map.js</code>
            and paste your Mapbox public token (starts with
            <code style="background:#222;padding:2px 6px;border-radius:3px;">pk.</code>) at the top.
          </p>
        </div>
      </div>
    `;
  } else {
    console.error('Mapbox error:', err);
  }
});
