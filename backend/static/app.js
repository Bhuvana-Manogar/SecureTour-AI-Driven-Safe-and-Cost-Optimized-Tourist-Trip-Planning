/**
 * SecureTour AI — Real-Time Group Travel Safety & Cost Intelligence Engine
 * Consumer UI (MakeMyTrip / Booking.com / Uber Navigation style)
 * 
 * Features:
 * - Real Street Map (CartoDB Voyager / OSM / Satellite)
 * - Turn-by-Turn Driving Directions Drawer with Live Maneuvers & Hazard Warnings
 * - Real Hotel Photography with AI Safety vs Star Divergence Telemetry
 * - Whale Optimization Algorithm (WOA) 5-Channel Cost Predictor
 * - Autonomous Group Sentinel & Return-Time Anomaly Alarm
 * - Splitwise Graph Cash Flow Debt Minimizer
 * - Real-Time WebSockets Sync & Emergency SOS Beacon
 */

// Application State
const state = {
  activeTab: 'plan',
  currentUser: {
    id: 'usr-1',
    email: 'arun@securetour.ai',
    full_name: 'Arun Kumar',
    phone: '+91 98401 23456'
  },
  demoUsers: [],
  activeCorridor: {
    id: 'corridor-01',
    origin: 'Chennai',
    destination: 'Ooty',
    distance_km: 540,
    duration_days: 4,
    recommended_budget: 48000
  },
  tripId: 'trip-ooty-01',
  hotels: [],
  selectedHotel: null,
  routeData: null,
  routeMode: 'safe', // 'safe' | 'direct'
  map: null,
  tileLayer: null,
  currentTileType: 'voyager',
  directPolyline: null,
  safePolyline: null,
  originMarker: null,
  destMarker: null,
  carMarker: null,
  carCircle: null,
  hazardMarkers: [],
  simulating: false,
  simIndex: 0,
  simInterval: null,
  currentCoord: [13.0827, 80.2707],
  contract: null,
  expensesData: null,
  socket: null,
  activeAlert: null
};

// 100% Free, High-Resolution Real Street Map Providers (Zero Watermark!)
const TILE_PROVIDERS = {
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

// API Helper
async function apiCall(endpoint, method = 'GET', data = null) {
  const token = localStorage.getItem('securetour_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(endpoint, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'API Error' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// -----------------------------------------------------------------------------
// Toast Notifications
// -----------------------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xl flex items-center gap-3 text-xs font-semibold text-slate-800 transition-all transform duration-300';
  
  const iconColor = type === 'error' ? 'bg-red-500' : 'bg-[#0084FF]';
  toast.innerHTML = `
    <span class="w-2.5 h-2.5 rounded-full ${iconColor} animate-ping"></span>
    <span class="flex-1">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-700 px-1 font-bold">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// -----------------------------------------------------------------------------
// Navigation & Tab Switching
// -----------------------------------------------------------------------------
function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.className = 'tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all';
  });
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) {
    activeBtn.className = 'tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0084FF] text-white shadow-md shadow-blue-500/20 transition-all';
  }

  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) targetView.classList.remove('hidden');

  if (tabId === 'travel') {
    initOrUpdateMap();
  } else if (tabId === 'stay' && state.hotels.length === 0) {
    loadHotels();
  } else if (tabId === 'protected') {
    loadContract();
  } else if (tabId === 'settle') {
    loadExpenses();
  }
}

// -----------------------------------------------------------------------------
// Corridor Switcher (Dynamic Travel Across India)
// -----------------------------------------------------------------------------
const CORRIDORS = {
  'corridor-01': { origin: 'Chennai', destination: 'Ooty', distance: 540, days: 4, budget: 48000 },
  'corridor-02': { origin: 'Bangalore', destination: 'Coorg', distance: 265, days: 3, budget: 32000 },
  'corridor-03': { origin: 'Mumbai', destination: 'Goa', distance: 585, days: 5, budget: 55000 },
  'corridor-04': { origin: 'Delhi', destination: 'Manali', distance: 520, days: 5, budget: 52000 },
  'corridor-05': { origin: 'Coimbatore', destination: 'Munnar', distance: 155, days: 3, budget: 28000 }
};

function handleCorridorChange(corridorId) {
  const c = CORRIDORS[corridorId] || CORRIDORS['corridor-01'];
  state.activeCorridor = { id: corridorId, ...c };

  // Update Tab 1 inputs
  document.getElementById('woa-source').value = c.origin;
  document.getElementById('woa-destination').value = c.destination;
  document.getElementById('woa-distance').value = c.distance;
  document.getElementById('woa-duration').value = c.days;
  document.getElementById('woa-budget').value = c.budget;
  document.getElementById('budget-val-label').innerText = '₹' + c.budget.toLocaleString();

  // Update badge info
  document.getElementById('trip-badge-info').innerText = `Target: ₹${c.budget.toLocaleString()} • 4 Friends`;

  showToast(`Switched active corridor: ${c.origin} ➔ ${c.destination}`);

  // Re-run WOA optimization and re-load route
  runWOACostOptimizer();
  loadRoute(c.origin, c.destination);
}

// -----------------------------------------------------------------------------
// User Authentication & Demo Switcher
// -----------------------------------------------------------------------------
async function initUsers() {
  try {
    const data = await apiCall('/api/auth/demo-users');
    state.demoUsers = data.demo_users || [];
    renderDemoUsers();
    if (state.demoUsers.length > 0) {
      selectDemoUser(state.demoUsers[0].id);
    }
  } catch (err) {
    console.error('Failed to init users', err);
  }
}

function renderDemoUsers() {
  const container = document.getElementById('demo-users-list');
  if (!container) return;
  container.innerHTML = state.demoUsers.map(u => `
    <button onclick="selectDemoUser('${u.id}')" class="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 flex items-center justify-between transition-colors">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-full bg-[#0084FF] text-white flex items-center justify-center font-bold text-[10px]">
          ${u.full_name[0]}
        </div>
        <div>
          <p class="text-xs font-semibold text-slate-800">${u.full_name}</p>
          <p class="text-[10px] text-slate-400">${u.phone}</p>
        </div>
      </div>
      ${u.id === state.currentUser?.id ? '<span class="text-[10px] text-emerald-600 font-bold">Active</span>' : ''}
    </button>
  `).join('');
}

function selectDemoUser(userId) {
  const u = state.demoUsers.find(x => x.id === userId);
  if (!u) return;
  state.currentUser = u;
  if (u.demo_token) localStorage.setItem('securetour_token', u.demo_token);

  document.getElementById('user-avatar').innerText = u.full_name[0];
  document.getElementById('user-display-name').innerText = u.full_name;
  renderDemoUsers();

  const menu = document.getElementById('user-dropdown-menu');
  if (menu) menu.classList.add('hidden');
  showToast(`Active traveler: ${u.full_name}`);
}

function toggleUserDropdown() {
  const menu = document.getElementById('user-dropdown-menu');
  if (menu) menu.classList.toggle('hidden');
}

// -----------------------------------------------------------------------------
// TAB 1: Whale Optimization Algorithm (WOA) Cost Optimizer
// -----------------------------------------------------------------------------
async function runWOACostOptimizer() {
  const source = document.getElementById('woa-source').value;
  const destination = document.getElementById('woa-destination').value;
  const distance = parseFloat(document.getElementById('woa-distance').value);
  const duration = parseInt(document.getElementById('woa-duration').value);
  const groupSize = parseInt(document.getElementById('woa-groupsize').value);
  const vehicle = document.getElementById('woa-vehicle').value;
  const budget = parseFloat(document.getElementById('woa-budget').value);

  const btn = document.getElementById('btn-run-woa');
  btn.innerHTML = `<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Optimizing Budget...`;

  try {
    const res = await apiCall('/api/ai/predict-cost-woa', 'POST', {
      source,
      destination,
      distance_km: distance,
      duration_days: duration,
      group_size: groupSize,
      target_budget: budget,
      vehicle_type: vehicle
    });

    renderWOAResults(res);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <span>Run Whale Optimization AI</span>
    `;
  }
}

function renderWOAResults(data) {
  const container = document.getElementById('woa-results-panel');
  if (!container) return;

  const b = data.budget_breakdown;
  const pct = (amt) => Math.round((amt / data.total_predicted_cost) * 100);

  container.innerHTML = `
    <!-- Top Summary Banner -->
    <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-5">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Optimal Prediction</span>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            ${data.feasibility_status.replace('_', ' ')}
          </span>
        </div>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="text-3xl font-extrabold text-slate-900">₹${data.total_predicted_cost.toLocaleString()}</span>
          <span class="text-xs text-slate-500 font-semibold">Total for ${data.group_size} travelers (${data.duration_days} days)</span>
        </div>
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto">
        <div class="flex-1 sm:flex-none p-3.5 rounded-2xl bg-blue-50 border border-blue-100 text-center">
          <span class="text-[10px] font-bold text-blue-700 uppercase block">Per Person Share</span>
          <span class="text-lg font-black text-[#006CE4]">₹${data.cost_per_person.toLocaleString()}</span>
        </div>
        <div class="flex-1 sm:flex-none p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
          <span class="text-[10px] font-bold text-emerald-700 uppercase block">AI Budget Savings</span>
          <span class="text-lg font-black text-emerald-700">₹${data.savings_from_target.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- 5-Channel Constrained Allocation Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      
      <!-- Fuel & Tolls -->
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-slate-700">⛽ Fuel & Highway Tolls</span>
          <span class="font-mono font-bold text-slate-900">₹${b.fuel_and_tolls.toLocaleString()}</span>
        </div>
        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div class="bg-[#0084FF] h-full rounded-full" style="width: ${pct(b.fuel_and_tolls)}%"></div>
        </div>
        <span class="text-[11px] text-slate-400 block">${pct(b.fuel_and_tolls)}% of total • ${data.vehicle_type.toUpperCase()}</span>
      </div>

      <!-- Hotel Accommodation -->
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-slate-700">🏨 Hotel & Stays</span>
          <span class="font-mono font-bold text-slate-900">₹${b.accommodation.toLocaleString()}</span>
        </div>
        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div class="bg-indigo-600 h-full rounded-full" style="width: ${pct(b.accommodation)}%"></div>
        </div>
        <span class="text-[11px] text-slate-400 block">${pct(b.accommodation)}% of total • 2 Verified Rooms</span>
      </div>

      <!-- Food & Dining -->
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-slate-700">🍽️ Food & Dining</span>
          <span class="font-mono font-bold text-slate-900">₹${b.food_and_dining.toLocaleString()}</span>
        </div>
        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div class="bg-teal-600 h-full rounded-full" style="width: ${pct(b.food_and_dining)}%"></div>
        </div>
        <span class="text-[11px] text-slate-400 block">${pct(b.food_and_dining)}% of total • Group Meals</span>
      </div>

      <!-- Sightseeing & Activities -->
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-slate-700">🎟️ Sightseeing & Entries</span>
          <span class="font-mono font-bold text-slate-900">₹${b.activities_and_sightseeing.toLocaleString()}</span>
        </div>
        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div class="bg-amber-500 h-full rounded-full" style="width: ${pct(b.activities_and_sightseeing)}%"></div>
        </div>
        <span class="text-[11px] text-slate-400 block">${pct(b.activities_and_sightseeing)}% of total • Local Passes</span>
      </div>

      <!-- Safety & Contingency Reserve -->
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2 sm:col-span-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-emerald-700 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>🛡️ Emergency & Safety Contingency Reserve</span>
          </span>
          <span class="font-mono font-extrabold text-emerald-700">₹${b.emergency_contingency_reserve.toLocaleString()}</span>
        </div>
        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div class="bg-emerald-500 h-full rounded-full" style="width: ${pct(b.emergency_contingency_reserve)}%"></div>
        </div>
        <span class="text-[11px] text-slate-500 block">Dedicated buffer locked for mountain repairs, medical first aid, and unplanned tolls.</span>
      </div>

    </div>

    <!-- Optimization AI Metaheuristic Insights -->
    <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
        <span>Algorithm: <strong>Whale Optimization Algorithm (WOA)</strong> • Bubble-Net Spiral Convergence • 50 Iterations</span>
      </div>
      <button onclick="switchTab('stay')" class="text-xs font-bold text-[#006CE4] hover:underline flex items-center gap-1">
        <span>Proceed to Choose Stay</span>
        <span>➔</span>
      </button>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// TAB 2: Hotels & AI Safety Scoring (Booking.com / MakeMyTrip style)
// -----------------------------------------------------------------------------
async function loadHotels(city = '', minSafety = 0) {
  try {
    let url = '/api/hotels';
    const params = [];
    if (city) params.push(`city=${encodeURIComponent(city)}`);
    if (minSafety > 0) params.push(`min_safety=${minSafety}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const res = await apiCall(url);
    state.hotels = res.hotels || [];
    renderHotelsList();

    if (state.hotels.length > 0 && !state.selectedHotel) {
      inspectHotel(state.hotels[0].id);
    }
  } catch (err) {
    console.error('Failed to load hotels', err);
  }
}

function filterHotelsCity(cityName) {
  document.querySelectorAll('.hotel-city-btn').forEach(b => {
    b.className = 'hotel-city-btn px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold';
  });
  event.target.className = 'hotel-city-btn px-3.5 py-1.5 rounded-xl bg-[#0084FF] text-white font-bold shadow-sm';
  loadHotels(cityName, document.getElementById('hotel-min-safety').value);
}

function filterHotelsSafety(score) {
  loadHotels('', parseFloat(score));
}

function renderHotelsList() {
  const container = document.getElementById('hotels-list-container');
  if (!container) return;

  if (state.hotels.length === 0) {
    container.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-400">
        No hotels match the selected criteria.
      </div>
    `;
    return;
  }

  container.innerHTML = state.hotels.map(h => {
    const isSelected = state.selectedHotel?.id === h.id;
    const splitPrice = Math.round(h.price_per_night / 4);

    return `
      <div onclick="inspectHotel('${h.id}')" class="bg-white border ${isSelected ? 'border-[#0084FF] ring-2 ring-blue-500/20' : 'border-slate-200'} hover:border-[#0084FF] rounded-3xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row gap-4 group">
        
        <!-- Hotel Image with Rating Overlay -->
        <div class="sm:w-52 h-44 rounded-2xl overflow-hidden relative flex-shrink-0 bg-slate-100">
          <img src="${h.image_url}" alt="${h.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
          
          <!-- Star Rating Badge -->
          <div class="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-amber-400 font-extrabold text-[11px] flex items-center gap-1 shadow">
            <span>⭐</span>
            <span>${h.star_rating}</span>
            <span class="text-slate-300 font-normal text-[10px]">(${h.review_count || 320})</span>
          </div>

          <!-- AI Safety Shield Pill -->
          <div class="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg font-bold text-[11px] shadow flex items-center gap-1" style="background-color: ${h.badge_color}; color: white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Safety: ${h.safety_score}%</span>
          </div>
        </div>

        <!-- Hotel Content -->
        <div class="flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2">
              <div>
                <h4 class="text-base font-extrabold text-slate-800 group-hover:text-[#006CE4] transition-colors">${h.name}</h4>
                <p class="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>${h.address}</span>
                </p>
              </div>
            </div>

            <!-- Star Divergence Alert Warning (if applicable) -->
            ${h.divergence_warning ? `
              <div class="mt-2 p-2 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700 font-bold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>${h.divergence_warning}</span>
              </div>
            ` : ''}

            <!-- Amenities Badges -->
            <div class="flex flex-wrap gap-1 mt-2.5">
              ${(h.amenities || []).slice(0, 3).map(a => `
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">✓ ${a}</span>
              `).join('')}
            </div>
          </div>

          <!-- Price & CTA bar -->
          <div class="flex items-baseline justify-between mt-3 pt-3 border-t border-slate-100">
            <div>
              <span class="text-xs text-slate-400">Total per night</span>
              <div class="flex items-baseline gap-1.5">
                <span class="text-xl font-black text-slate-900">₹${h.price_per_night.toLocaleString()}</span>
                <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">₹${splitPrice.toLocaleString()} / friend</span>
              </div>
            </div>

            <button onclick="event.stopPropagation(); inspectHotel('${h.id}')" class="px-3.5 py-1.5 rounded-xl bg-[#0084FF] hover:bg-[#006CE4] text-white font-bold text-xs shadow-sm transition-all">
              Inspect Safety
            </button>
          </div>

        </div>

      </div>
    `;
  }).join('');
}

function inspectHotel(hotelId) {
  const h = state.hotels.find(x => x.id === hotelId);
  if (!h) return;
  state.selectedHotel = h;
  renderHotelsList();

  const detail = document.getElementById('hotel-detail-container');
  if (!detail) return;

  detail.innerHTML = `
    <div class="sticky top-32 bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
      
      <!-- Top Title with Image Banner -->
      <div class="h-44 rounded-2xl overflow-hidden relative shadow-sm">
        <img src="${h.image_url}" alt="${h.name}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div class="absolute bottom-3 left-3 text-white">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider" style="background-color: ${h.badge_color}">
            ${h.safety_tier.replace('_', ' ')}
          </span>
          <h3 class="text-lg font-black mt-1">${h.name}</h3>
        </div>
      </div>

      <!-- Safety Meter Card -->
      <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
        <div class="flex justify-between items-baseline">
          <span class="text-xs font-bold text-slate-700">AI Safety Index:</span>
          <span class="text-xl font-black" style="color: ${h.badge_color};">${h.safety_score} / 100</span>
        </div>
        <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width: ${h.safety_score}%; background-color: ${h.badge_color};"></div>
        </div>
        <p class="text-[11px] text-slate-500">${h.safety_badge}</p>
      </div>

      <!-- District Crime Statistics from NCRB -->
      <div class="border border-slate-100 rounded-2xl p-3.5 text-xs space-y-2">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">District Safety & Crime Data</span>
        <div class="flex justify-between text-slate-600">
          <span>District Jurisdiction:</span>
          <strong class="text-slate-800">${h.district}</strong>
        </div>
        <div class="flex justify-between text-slate-600">
          <span>Women Safety Score:</span>
          <strong class="text-emerald-700 font-bold">${h.crime_context?.women_safety_index || 85} / 100</strong>
        </div>
        <div class="flex justify-between text-slate-600">
          <span>Night Street Security:</span>
          <strong class="text-blue-700 font-bold">${h.crime_context?.night_safety_score || 80} / 100</strong>
        </div>
      </div>

      <!-- Verified Safety Features Extracted from Reviews -->
      <div>
        <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-2">
          ✓ Verified Safety Signals (${h.detected_safety_features?.length || 0})
        </span>
        <div class="flex flex-wrap gap-1.5">
          ${(h.detected_safety_features || []).map(feat => `
            <span class="px-2.5 py-1 rounded-xl text-xs bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">✓ ${feat}</span>
          `).join('') || '<span class="text-xs text-slate-400">None detected</span>'}
        </div>
      </div>

      <!-- Safety Hazards Detected -->
      <div>
        <span class="text-xs font-bold text-red-600 uppercase tracking-wider block mb-2">
          ⚠️ Red Flags Flagged (${h.detected_safety_hazards?.length || 0})
        </span>
        <div class="flex flex-wrap gap-1.5">
          ${(h.detected_safety_hazards || []).map(haz => `
            <span class="px-2.5 py-1 rounded-xl text-xs bg-red-50 text-red-700 font-bold border border-red-200">⚠️ ${haz}</span>
          `).join('') || '<span class="text-xs text-slate-400">Zero critical safety red flags</span>'}
        </div>
      </div>

      <!-- Guest Review Excerpt -->
      <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 italic">
        "${h.reviews && h.reviews[0] ? h.reviews[0] : 'Excellent stay for group travelers.'}"
      </div>

      <button onclick="selectHotelForTrip('${h.id}')" class="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all">
        Lock Stay for Group Trip
      </button>

    </div>
  `;
}

function selectHotelForTrip(hotelId) {
  const h = state.hotels.find(x => x.id === hotelId);
  if (!h) return;
  showToast(`Locked stay: ${h.name} for your group trip!`);
  confetti({ particleCount: 50, spread: 60 });
}

// -----------------------------------------------------------------------------
// TAB 3: Route Risk, Dual Route & Turn-by-Turn Navigation Engine
// -----------------------------------------------------------------------------
async function initOrUpdateMap() {
  if (!state.map) {
    state.map = L.map('route-map', {
      zoomControl: true
    }).setView([12.2, 78.4], 8);

    // Initial tile layer: CartoDB Voyager (High-definition, colorful real street map)
    setMapLayer('voyager');
  }

  if (!state.routeData) {
    await loadRoute(state.activeCorridor.origin, state.activeCorridor.destination);
  } else {
    setTimeout(() => state.map.invalidateSize(), 200);
  }
}

// Set Map Tiles (Voyager / OSM / Satellite / Dark)
function setMapLayer(type) {
  if (state.tileLayer) {
    state.map.removeLayer(state.tileLayer);
  }
  state.currentTileType = type;
  const cfg = TILE_PROVIDERS[type] || TILE_PROVIDERS.voyager;

  state.tileLayer = L.tileLayer(cfg.url, {
    attribution: cfg.attribution,
    maxZoom: 18
  }).addTo(state.map);

  ['voyager', 'osm', 'satellite', 'dark'].forEach(k => {
    const btn = document.getElementById(`layer-btn-${k}`);
    if (btn) {
      if (k === type) {
        btn.className = 'px-3 py-1 rounded-lg bg-white text-[#006CE4] font-bold shadow-sm';
      } else {
        btn.className = 'px-3 py-1 rounded-lg hover:text-slate-900';
      }
    }
  });
}

// Load Route with Dual Geometry (Direct vs Safe Bypass) + Turn-by-Turn Steps
async function loadRoute(origin = 'Chennai', destination = 'Ooty') {
  try {
    const res = await apiCall(`/api/risk/route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
    state.routeData = res;
    state.routeMode = res.recommended_route_mode || 'safe';

    renderDualRoutesOnMap(res);
    renderTurnByTurnDirections(res);
    renderCorridorMetrics(res);
  } catch (err) {
    console.error('Failed to load route', err);
  }
}

function renderDualRoutesOnMap(data) {
  // Clear existing polylines & markers
  if (state.directPolyline) state.map.removeLayer(state.directPolyline);
  if (state.safePolyline) state.map.removeLayer(state.safePolyline);
  if (state.originMarker) state.map.removeLayer(state.originMarker);
  if (state.destMarker) state.map.removeLayer(state.destMarker);
  state.hazardMarkers.forEach(m => state.map.removeLayer(m));
  state.hazardMarkers = [];

  const directCoords = data.direct_route.geometry.coordinates.map(pt => [pt[1], pt[0]]);
  const safeCoords = data.safe_bypass_route.geometry.coordinates.map(pt => [pt[1], pt[0]]);

  // 1. Draw Direct Route (Red dashed)
  state.directPolyline = L.polyline(directCoords, {
    color: '#EF4444',
    weight: state.routeMode === 'direct' ? 6 : 3,
    opacity: state.routeMode === 'direct' ? 0.9 : 0.4,
    dashArray: '6, 6'
  }).addTo(state.map);

  // 2. Draw AI Safe Bypass Route (Vibrant Emerald Green)
  state.safePolyline = L.polyline(safeCoords, {
    color: '#059669',
    weight: state.routeMode === 'safe' ? 6 : 3,
    opacity: state.routeMode === 'safe' ? 0.95 : 0.4
  }).addTo(state.map);

  // Origin Marker (Green Pin "A")
  const originCoord = safeCoords[0];
  const originIcon = L.divIcon({
    className: 'origin-pin',
    html: `
      <div style="background: #059669; color: white; font-weight: 800; font-size: 13px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(5,150,105,0.4);">
        A
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
  state.originMarker = L.marker(originCoord, { icon: originIcon }).addTo(state.map);
  state.originMarker.bindPopup(`<b>Start Point: ${data.origin}</b>`);

  // Destination Marker (Red Flag Pin "B")
  const destCoord = safeCoords[safeCoords.length - 1];
  const destIcon = L.divIcon({
    className: 'dest-pin',
    html: `
      <div style="background: #EF4444; color: white; font-weight: 800; font-size: 13px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(239,68,68,0.4);">
        B
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
  state.destMarker = L.marker(destCoord, { icon: destIcon }).addTo(state.map);
  state.destMarker.bindPopup(`<b>Destination: ${data.destination}</b>`);

  // Moving Car Marker (Uber style)
  const carIcon = L.divIcon({
    className: 'car-icon',
    html: `
      <div style="position: relative; width: 36px; height: 36px;">
        <div class="car-pulse"></div>
        <div style="background: #0084FF; border: 2.5px solid white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,132,255,0.5); position: relative; z-index: 10;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  const activePath = state.routeMode === 'safe' ? safeCoords : directCoords;
  if (!state.carMarker) {
    state.carMarker = L.marker(activePath[0], { icon: carIcon }).addTo(state.map);
    state.carCircle = L.circle(activePath[0], {
      radius: 4000,
      color: '#0084FF',
      fillColor: '#0084FF',
      fillOpacity: 0.1
    }).addTo(state.map);
  } else {
    state.carMarker.setLatLng(activePath[0]);
    state.carCircle.setLatLng(activePath[0]);
  }

  // Draw Hazards along corridor with danger radius
  const hazards = data.direct_route.hazards || [];
  hazards.forEach(spot => {
    const isCritical = spot.risk_level === 'CRITICAL';
    const bg = isCritical ? '#EF4444' : '#F59E0B';

    const hazardIcon = L.divIcon({
      className: 'hazard-icon',
      html: `
        <div style="background: ${bg}; border: 2px solid white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.25);">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const m = L.marker([spot.latitude, spot.longitude], { icon: hazardIcon }).addTo(state.map);
    m.bindPopup(`
      <div style="font-size: 12px; color: #0F172A; max-width: 240px; font-family: 'Plus Jakarta Sans', sans-serif;">
        <strong style="color: #DC2626; font-size: 13px;">${spot.name}</strong><br/>
        <b>Risk Level:</b> ${spot.risk_level} (${spot.risk_score}/100)<br/>
        <b>Danger:</b> ${spot.danger_type}<br/>
        <b>Safety Advice:</b> ${spot.recommendation}<br/>
        <b>Highway Police:</b> ${spot.police_station} (${spot.emergency_phone})
      </div>
    `);
    state.hazardMarkers.push(m);

    // Hazard danger zone radius
    if (isCritical) {
      const cZone = L.circle([spot.latitude, spot.longitude], {
        radius: 4000,
        color: '#EF4444',
        fillColor: '#EF4444',
        fillOpacity: 0.12,
        dashArray: '5, 5'
      }).addTo(state.map);
      state.hazardMarkers.push(cZone);
    }
  });

  state.map.fitBounds(activePath, { padding: [40, 40] });
  updateRouteModeButtons();
}

// Render Turn-by-Turn Navigation Steps in Right-Hand Drawer
function renderTurnByTurnDirections(data) {
  const container = document.getElementById('directions-step-list');
  if (!container) return;

  const activeRoute = state.routeMode === 'safe' ? data.safe_bypass_route : data.direct_route;
  const steps = activeRoute.steps || [];

  document.getElementById('directions-steps-badge').innerText = `${steps.length} Steps`;
  document.getElementById('directions-summary-text').innerText = `${activeRoute.distance_km} km • ${activeRoute.estimated_hours} hr via ${state.routeMode === 'safe' ? 'AI Safe Bypass (NH-181)' : 'Standard NH-48'}`;

  // Update floating next turn HUD
  if (steps.length > 0) {
    const s0 = steps[0];
    document.getElementById('hud-turn-dist').innerText = `Next: in ${s0.distance_label}`;
    document.getElementById('hud-turn-text').innerText = s0.instruction;
  }

  container.innerHTML = steps.map((s, idx) => {
    let icon = '⬆️';
    if (s.maneuver_type === 'depart') icon = '🚩';
    else if (s.maneuver_type === 'arrive') icon = '🏁';
    else if (s.modifier?.includes('left')) icon = '⬅️';
    else if (s.modifier?.includes('right')) icon = '➡️';
    else if (s.maneuver_type === 'roundabout') icon = '🔄';
    else if (s.maneuver_type === 'merge') icon = '🔀';

    return `
      <div id="nav-step-${idx}" onclick="focusMapOnStep(${s.location[0]}, ${s.location[1]}, ${idx})" class="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 transition-all cursor-pointer flex items-start gap-3 group">
        <div class="w-8 h-8 rounded-xl bg-white text-slate-800 flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm border border-slate-200 group-hover:border-[#0084FF]">
          ${icon}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-900 truncate">${s.road_name || 'Highway'}</span>
            <span class="text-[11px] font-bold text-slate-500 font-mono">${s.distance_label}</span>
          </div>
          <p class="text-[11px] text-slate-600 mt-0.5 leading-snug">${s.instruction}</p>

          ${s.hazard_warning ? `
            <div class="mt-2 p-2 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-800 font-medium">
              <strong class="text-red-700 block">⚠️ HAZARD PERIMETER: ${s.hazard_warning.name}</strong>
              ${s.hazard_warning.recommendation}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function focusMapOnStep(lat, lng, stepIndex) {
  if (!state.map) return;
  state.map.setView([lat, lng], 13);

  // Update floating HUD
  const activeRoute = state.routeMode === 'safe' ? state.routeData.safe_bypass_route : state.routeData.direct_route;
  const s = activeRoute.steps[stepIndex];
  if (s) {
    document.getElementById('hud-turn-dist').innerText = `Step ${s.step_number} • in ${s.distance_label}`;
    document.getElementById('hud-turn-text').innerText = s.instruction;
  }
}

// Switch between Direct & Safe Bypass Route Modes
function switchToSafeBypassRoute(fromBanner = false) {
  state.routeMode = 'safe';
  updateRouteModeButtons();

  if (state.directPolyline) state.directPolyline.setStyle({ weight: 3, opacity: 0.35 });
  if (state.safePolyline) state.safePolyline.setStyle({ weight: 6, opacity: 0.95 });

  const bypassed = state.routeData?.safe_bypass_route?.bypassed_hazards || ['Kalhatty 36 Hairpins'];
  document.getElementById('route-avoidance-status').innerText = `Active Bypass: ${bypassed.join(', ')} (Coonoor Corridor)`;

  if (state.routeData) renderTurnByTurnDirections(state.routeData);
  if (fromBanner) dismissGeofenceAlert();
  showToast('Switched to AI Safe Bypass corridor avoiding mountain descents.');
}

function switchToDirectRoute() {
  state.routeMode = 'direct';
  updateRouteModeButtons();

  if (state.directPolyline) state.directPolyline.setStyle({ weight: 6, opacity: 0.95 });
  if (state.safePolyline) state.safePolyline.setStyle({ weight: 3, opacity: 0.35 });

  document.getElementById('route-avoidance-status').innerText = 'Standard GPS Direct (⚠️ High Fatality Hairpin Stretch)';

  if (state.routeData) renderTurnByTurnDirections(state.routeData);
  showToast('Switched to Direct Route. Caution: 4 blackspot zones along path.', 'error');
}

function updateRouteModeButtons() {
  const btnSafe = document.getElementById('btn-route-safe');
  const btnDirect = document.getElementById('btn-route-direct');

  if (state.routeMode === 'safe') {
    btnSafe.className = 'px-4 py-2 rounded-xl bg-emerald-600 text-white shadow-md flex items-center gap-2 transition-all';
    btnDirect.className = 'px-4 py-2 rounded-xl text-slate-700 hover:text-slate-900 flex items-center gap-2 transition-all';
  } else {
    btnSafe.className = 'px-4 py-2 rounded-xl text-slate-700 hover:text-slate-900 flex items-center gap-2 transition-all';
    btnDirect.className = 'px-4 py-2 rounded-xl bg-red-600 text-white shadow-md flex items-center gap-2 transition-all';
  }
}

// Live Driving Simulation
function toggleDriveSimulation() {
  if (state.simulating) {
    stopSimulation();
  } else {
    startSimulation();
  }
}

function startSimulation() {
  if (!state.routeData) return;
  state.simulating = true;
  document.getElementById('sim-text').innerText = 'Pause Drive';
  document.getElementById('sim-icon').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';

  const activePath = state.routeMode === 'safe'
    ? state.routeData.safe_bypass_route.geometry.coordinates.map(pt => [pt[1], pt[0]])
    : state.routeData.direct_route.geometry.coordinates.map(pt => [pt[1], pt[0]]);

  const steps = state.routeMode === 'safe'
    ? state.routeData.safe_bypass_route.steps
    : state.routeData.direct_route.steps;

  state.simInterval = setInterval(() => {
    if (state.simIndex >= activePath.length) {
      stopSimulation();
      showToast('Group has safely reached destination in Ooty!');
      confetti({ particleCount: 70, spread: 70 });
      return;
    }

    const coord = activePath[state.simIndex];
    state.currentCoord = coord;
    state.carMarker.setLatLng(coord);
    state.carCircle.setLatLng(coord);

    document.getElementById('current-coords-label').innerText = `${coord[0].toFixed(4)}°N, ${coord[1].toFixed(4)}°E`;

    // Speed fluctuation
    const speed = Math.floor(58 + Math.random() * 18);
    const speedLabel = document.getElementById('live-speed-label');
    if (speedLabel) speedLabel.innerText = `${speed} km/h`;

    // Check Geofence breach simulation near Thoppur
    if (state.simIndex > 30 && state.simIndex < 45 && !state.activeAlert) {
      triggerGeofenceAlertUI({
        title: 'Approaching Thoppur Ghat S-Curve',
        distance: '1.4 km ahead',
        description: 'Steep downhill mountain decline with high commercial vehicle brake failure risk. Engage low gear.',
        police: 'Thoppur Highway Patrol Station (04342-246230)'
      });
    }

    // Scroll active step in drawer
    const stepIdx = Math.min(Math.floor((state.simIndex / activePath.length) * steps.length), steps.length - 1);
    const stepEl = document.getElementById(`nav-step-${stepIdx}`);
    if (stepEl) {
      document.querySelectorAll('[id^="nav-step-"]').forEach(el => el.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50'));
      stepEl.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
      stepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      const s = steps[stepIdx];
      if (s) {
        document.getElementById('hud-turn-dist').innerText = `Step ${s.step_number} • in ${s.distance_label}`;
        document.getElementById('hud-turn-text').innerText = s.instruction;
      }
    }

    state.simIndex += 2;
  }, 500);
}

function stopSimulation() {
  state.simulating = false;
  clearInterval(state.simInterval);
  document.getElementById('sim-text').innerText = 'Simulate Live Drive';
  document.getElementById('sim-icon').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
}

function resetSimulation() {
  stopSimulation();
  state.simIndex = 0;
  if (!state.routeData) return;
  const activePath = state.routeMode === 'safe'
    ? state.routeData.safe_bypass_route.geometry.coordinates.map(pt => [pt[1], pt[0]])
    : state.routeData.direct_route.geometry.coordinates.map(pt => [pt[1], pt[0]]);

  state.carMarker.setLatLng(activePath[0]);
  state.carCircle.setLatLng(activePath[0]);
  state.map.setView(activePath[0], 12);
  document.getElementById('current-coords-label').innerText = `${activePath[0][0].toFixed(4)}°N, ${activePath[0][1].toFixed(4)}°E`;
}

function triggerGeofenceAlertUI(alert) {
  state.activeAlert = alert;
  const banner = document.getElementById('geofence-alert-banner');
  if (!banner) return;
  banner.classList.remove('hidden');
  document.getElementById('geo-alert-title').innerText = alert.title;
  document.getElementById('geo-alert-distance').innerText = alert.distance;
  document.getElementById('geo-alert-desc').innerText = alert.description;
  document.getElementById('geo-alert-police').innerText = `Police: ${alert.police}`;
}

function dismissGeofenceAlert() {
  state.activeAlert = null;
  const banner = document.getElementById('geofence-alert-banner');
  if (banner) banner.classList.add('hidden');
}

function renderCorridorMetrics(data) {
  const container = document.getElementById('corridor-metrics-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <span class="text-xs text-slate-400 font-bold block uppercase">Total Distance</span>
      <span class="text-xl font-extrabold text-slate-900 mt-1 block">${data.direct_route.distance_km} km</span>
      <span class="text-[11px] text-slate-500">Via NH-48 & NH-544</span>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <span class="text-xs text-slate-400 font-bold block uppercase">Est. Driving Duration</span>
      <span class="text-xl font-extrabold text-[#006CE4] mt-1 block">${data.direct_route.estimated_hours} Hours</span>
      <span class="text-[11px] text-slate-500">Includes ghat ascent time</span>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <span class="text-xs text-slate-400 font-bold block uppercase">Corridor Safety Score</span>
      <span class="text-xl font-extrabold text-emerald-700 mt-1 block">${data.safe_bypass_route.corridor_safety_score} / 100</span>
      <span class="text-[11px] text-emerald-600 font-bold">Safe Bypass Corridor</span>
    </div>

    <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <span class="text-xs text-slate-400 font-bold block uppercase">Highway Patrol</span>
      <span class="text-xl font-extrabold text-slate-900 mt-1 block">112 / 1033</span>
      <span class="text-[11px] text-slate-500">National Highway Rescue</span>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// TAB 4: Group Sentinel & Return-Time Contract
// -----------------------------------------------------------------------------
async function loadContract() {
  try {
    const res = await apiCall(`/api/safety/contract/${state.tripId}`);
    state.contract = res;
    if (res.contract) {
      document.getElementById('contract-trip-title').innerText = `${state.activeCorridor.origin} to ${state.activeCorridor.destination} Trip Shield`;
      document.getElementById('contract-target-time-label').innerText = new Date(res.contract.expected_return_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      document.getElementById('contract-last-loc-label').innerText = `Last GPS: ${res.contract.last_known_lat || 13.0827}°N, ${res.contract.last_known_lng || 80.2707}°E`;
    }
  } catch (err) {
    console.error('Failed to load contract', err);
  }
}

async function performSafeCheckin() {
  try {
    await apiCall(`/api/safety/checkin/${state.tripId}`, 'POST', {
      notes: 'Group reached safe shelter at resort in Ooty.'
    });
    confetti({ particleCount: 70, spread: 70 });
    showToast('Safe group arrival checked in! Sentinel disarmed.');
    const banner = document.getElementById('overdue-anomaly-banner');
    if (banner) banner.classList.add('hidden');
    loadContract();
  } catch (err) {
    console.error(err);
  }
}

async function simulateOverdueAnomaly() {
  try {
    await apiCall(`/api/safety/simulate-overdue/${state.tripId}`, 'POST');
    const banner = document.getElementById('overdue-anomaly-banner');
    if (banner) banner.classList.remove('hidden');
    showToast('🚨 OVERDUE ALARM SIMULATED: Group 45m past return contract!', 'error');
  } catch (err) {
    console.error(err);
  }
}

async function saveReturnContract() {
  const timeVal = document.getElementById('contract-input-time').value;
  const notes = document.getElementById('contract-input-notes').value;
  if (!timeVal) {
    showToast('Please select return time', 'error');
    return;
  }
  try {
    await apiCall(`/api/safety/contract/${state.tripId}`, 'POST', {
      expected_return_time: new Date(timeVal).toISOString(),
      notes: notes,
      current_lat: state.currentCoord[0],
      current_lng: state.currentCoord[1]
    });
    showToast('Return-time contract locked! Watchdog active.');
    loadContract();
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------------------------------------------------------
// TAB 5: Splitwise Debt Minimizer & Expenses
// -----------------------------------------------------------------------------
async function loadExpenses() {
  try {
    const res = await apiCall(`/api/expenses/${state.tripId}`);
    state.expensesData = res;
    renderExpensesFeed(res.expenses || []);
    renderSettlementReport(res.settlement_report);
  } catch (err) {
    console.error('Failed to load expenses', err);
  }
}

function renderExpensesFeed(expenses) {
  const container = document.getElementById('expenses-history-list');
  if (!container) return;

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  document.getElementById('total-expenses-pill').innerText = `Total: ₹${total.toLocaleString()}`;

  if (expenses.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">No expenses recorded yet.</p>';
    return;
  }

  container.innerHTML = expenses.map(e => `
    <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
      <div>
        <p class="text-xs font-bold text-slate-800">${e.description}</p>
        <p class="text-[10px] text-slate-400">Paid by <strong class="text-slate-600">${e.payer_name}</strong> • ${e.category}</p>
      </div>
      <span class="text-sm font-black text-slate-900 font-mono">₹${e.amount.toLocaleString()}</span>
    </div>
  `).join('');
}

function renderSettlementReport(report) {
  const container = document.getElementById('minimized-settlement-list');
  if (!container) return;

  const txns = report?.minimized_settlements || [];
  if (txns.length === 0) {
    container.innerHTML = '<p class="text-xs text-emerald-700 font-bold p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">✓ All debts are settled! Everyone is completely square.</p>';
    return;
  }

  container.innerHTML = txns.map(t => {
    const isPaid = t.status === 'PAID';
    return `
      <div class="p-4 rounded-2xl bg-slate-50 border ${isPaid ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'} flex items-center justify-between gap-3 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-[#0084FF] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            ${t.from_member[0]}
          </div>
          <div>
            <p class="text-xs font-bold text-slate-800">
              ${t.from_member} <span class="text-slate-400 font-normal">owes</span> ${t.to_member}
            </p>
            <p class="text-[11px] font-black text-slate-900 font-mono">₹${t.amount.toLocaleString()}</p>
          </div>
        </div>

        <div>
          ${isPaid ? `
            <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              ✓ Settled
            </span>
          ` : `
            <button onclick="markPaymentSettled('${t.from_member}', '${t.to_member}', ${t.amount})" class="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-sm transition-all">
              Mark Paid
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

async function markPaymentSettled(fromMember, toMember, amount) {
  try {
    await apiCall(`/api/expenses/${state.tripId}/mark-paid`, 'POST', {
      from_member: fromMember,
      to_member: toMember,
      amount: amount,
      status: 'PAID'
    });
    confetti({ particleCount: 50, spread: 50 });
    showToast(`Payment of ₹${amount} settled: ${fromMember} → ${toMember}`);
    loadExpenses();
  } catch (err) {
    console.error(err);
  }
}

function openAddExpenseModal() {
  document.getElementById('expense-modal').classList.remove('hidden');
}

function closeAddExpenseModal() {
  document.getElementById('expense-modal').classList.add('hidden');
}

async function submitNewExpense(e) {
  e.preventDefault();
  const payer = document.getElementById('exp-payer').value;
  const desc = document.getElementById('exp-desc').value;
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const category = document.getElementById('exp-category').value;

  try {
    await apiCall(`/api/expenses/${state.tripId}`, 'POST', {
      payer_name: payer,
      description: desc,
      amount: amount,
      category: category
    });
    closeAddExpenseModal();
    confetti({ particleCount: 50, spread: 50 });
    showToast(`Logged ₹${amount} for ${desc}`);
    loadExpenses();
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------------------------------------------------------
// SOS Modal & Emergency Broadcast
// -----------------------------------------------------------------------------
function openSOSModal() {
  document.getElementById('sos-modal').classList.remove('hidden');
  document.getElementById('sos-content-initial').classList.remove('hidden');
  document.getElementById('sos-content-success').classList.add('hidden');

  const gpsLabel = document.getElementById('sos-initial-gps-label');
  if (gpsLabel) {
    gpsLabel.innerText = `• Current GPS Coordinates: ${state.currentCoord[0].toFixed(4)}°N, ${state.currentCoord[1].toFixed(4)}°E`;
  }
}

function closeSOSModal() {
  document.getElementById('sos-modal').classList.add('hidden');
}

async function confirmSOSBroadcast() {
  try {
    const res = await apiCall('/api/safety/sos', 'POST', {
      latitude: state.currentCoord[0] || 12.0152,
      longitude: state.currentCoord[1] || 78.1093,
      user_name: state.currentUser?.full_name || 'Arun Kumar',
      trip_name: `${state.activeCorridor.origin} to ${state.activeCorridor.destination} Trip`
    });

    document.getElementById('sos-content-initial').classList.add('hidden');
    document.getElementById('sos-content-success').classList.remove('hidden');
    document.getElementById('sos-dispatch-id').innerText = `Dispatch ID: ${res.dispatch_id}`;
    document.getElementById('sos-maps-url').value = res.coordinates.google_maps_url;
    document.getElementById('sos-unit-name').innerText = res.nearest_local_unit;

    showToast('🚨 SOS DISTRESS BEACON ACTIVE! Dispatched to emergency contacts & 112 ERSS.', 'error');
  } catch (err) {
    console.error(err);
  }
}

function copySOSLink() {
  const input = document.getElementById('sos-maps-url');
  navigator.clipboard.writeText(input.value);
  const btn = document.getElementById('btn-copy-sos');
  btn.innerText = 'Copied!';
  setTimeout(() => btn.innerText = 'Copy', 2500);
}

// -----------------------------------------------------------------------------
// Mountain Signal Offline Mesh Modal
// -----------------------------------------------------------------------------
function openOfflineMeshModal() {
  document.getElementById('offline-mesh-modal').classList.remove('hidden');
  const lat = state.currentCoord[0].toFixed(4);
  const lng = state.currentCoord[1].toFixed(4);
  const msg = `EMERGENCY RESCUE: Group Trip stranded at GPS (${lat}, ${lng}). Maps: https://maps.google.com/?q=${lat},${lng}. Please dispatch local highway/forest police.`;
  document.getElementById('mesh-sms-preview').innerText = msg;
}

function closeOfflineMeshModal() {
  document.getElementById('offline-mesh-modal').classList.add('hidden');
}

function copyMeshSMS() {
  const text = document.getElementById('mesh-sms-preview').innerText;
  navigator.clipboard.writeText(text);
  const btn = document.getElementById('btn-copy-mesh');
  btn.innerText = '✓ SMS Copied to Clipboard!';
  setTimeout(() => btn.innerText = 'Copy SMS to Clipboard', 2500);
}

// -----------------------------------------------------------------------------
// Real-Time WebSocket Listener
// -----------------------------------------------------------------------------
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/trip/trip-ooty-01`;

  try {
    state.socket = new WebSocket(wsUrl);

    state.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event_type === 'EXPENSE_ADDED') {
          showToast(`💰 ₹${data.expense.amount} logged by ${data.expense.payer_name}: ${data.expense.description}`);
          if (state.activeTab === 'settle') loadExpenses();
        } else if (data.event_type === 'EMERGENCY_SOS_TRIGGERED') {
          showToast(`🚨 SOS DISTRESS BEACON from ${data.dispatch.sender}!`, 'error');
        } else if (data.event_type === 'OVERDUE_ALERT_TRIGGERED') {
          showToast(`⏰ RETURN CONTRACT OVERDUE ALERT: Group missed check-in!`, 'error');
          if (state.activeTab === 'protected') loadContract();
        } else if (data.event_type === 'SAFE_CHECKIN_PERFORMED') {
          showToast(`✅ Safe group arrival checked in!`);
          if (state.activeTab === 'protected') loadContract();
        } else if (data.event_type === 'SETTLEMENT_MARKED_PAID') {
          showToast(`✓ Payment of ₹${data.amount} settled: ${data.from_member} → ${data.to_member}`);
          if (state.activeTab === 'settle') loadExpenses();
        }
      } catch (e) {}
    };

    state.socket.onerror = (e) => console.log('WebSocket retry pending...');
  } catch (e) {}
}

// -----------------------------------------------------------------------------
// Initialize on Page Load (Preload all data so NO screen is empty!)
// -----------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  initUsers();
  initWebSocket();
  runWOACostOptimizer();
  loadHotels();
  loadContract();
  loadExpenses();
});
