/**
 * SecureTour AI - Single Page Application Core Engine
 * Integrates WOA Cost Optimization, Hotel Safety Scoring, ChromaDB Route Risk Map,
 * Return-Time Contracts, Splitwise Settle Up, and Real-Time WebSockets.
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
  tripId: 'trip-ooty-01',
  hotels: [],
  selectedHotel: null,
  routeData: null,
  map: null,
  carMarker: null,
  carCircle: null,
  simulating: false,
  simIndex: 0,
  simInterval: null,
  currentCoord: [13.0827, 80.2707], // Chennai
  contract: null,
  expensesData: null,
  socket: null,
  activeAlert: null
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
  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto p-3.5 rounded-2xl bg-slate-900/95 border border-emerald-500/80 shadow-2xl shadow-emerald-950 flex items-center gap-3 text-xs font-semibold text-slate-100 transition-all transform duration-300';
  toast.innerHTML = `
    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
    <span class="flex-1">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white px-1">✕</button>
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

  // Update nav buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.className = 'tab-btn flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800';
  });
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) {
    activeBtn.className = 'tab-btn flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-900/40';
  }

  // Update mobile buttons
  document.querySelectorAll('.m-tab').forEach(b => {
    b.className = 'm-tab px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 whitespace-nowrap';
  });
  const activeMBtn = document.getElementById(`m-tab-${tabId}`);
  if (activeMBtn) {
    activeMBtn.className = 'm-tab px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white whitespace-nowrap';
  }

  // Show corresponding view
  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) targetView.classList.remove('hidden');

  // Trigger tab-specific initialization
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
  container.innerHTML = state.demoUsers.map(u => `
    <button onclick="selectDemoUser('${u.id}')" class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${state.currentUser?.id === u.id ? 'bg-emerald-950/60 text-emerald-300 font-bold' : 'text-slate-300 hover:bg-slate-800'}">
      <div>
        <p>${u.full_name}</p>
        <p class="text-[10px] text-slate-400">${u.email}</p>
      </div>
      ${state.currentUser?.id === u.id ? '<span class="w-2 h-2 rounded-full bg-emerald-400"></span>' : ''}
    </button>
  `).join('');
}

function selectDemoUser(userId) {
  const user = state.demoUsers.find(u => u.id === userId);
  if (!user) return;
  state.currentUser = user;
  localStorage.setItem('securetour_token', user.demo_token);

  document.getElementById('user-avatar').innerText = user.full_name.charAt(0);
  document.getElementById('user-display-name').innerText = user.full_name;
  document.getElementById('status-user-name').innerText = user.full_name;

  const dropdown = document.getElementById('user-dropdown-menu');
  if (dropdown) dropdown.classList.add('hidden');
  renderDemoUsers();
}

function toggleUserDropdown() {
  const dropdown = document.getElementById('user-dropdown-menu');
  dropdown.classList.toggle('hidden');
}

// -----------------------------------------------------------------------------
// TAB 1: Whale Optimization Algorithm (WOA) Cost Optimizer
// -----------------------------------------------------------------------------
async function runWOACostOptimizer() {
  const btn = document.getElementById('btn-run-woa');
  btn.disabled = true;
  btn.innerHTML = `<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Optimizing with WOA...`;

  const payload = {
    source: document.getElementById('woa-source').value || 'Chennai',
    destination: document.getElementById('woa-destination').value || 'Ooty',
    distance_km: parseFloat(document.getElementById('woa-distance').value) || 540,
    duration_days: parseInt(document.getElementById('woa-duration').value) || 4,
    group_size: parseInt(document.getElementById('woa-groupsize').value) || 4,
    target_budget: parseFloat(document.getElementById('woa-budget').value) || 48000,
    vehicle_type: document.getElementById('woa-vehicle').value || 'car'
  };

  try {
    const res = await apiCall('/api/ai/predict-cost-woa', 'POST', payload);
    renderWOAResults(res);
  } catch (err) {
    console.error(err);
    alert('WOA Optimization Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Run Whale Optimization (WOA)</span>`;
  }
}

function renderWOAResults(data) {
  const panel = document.getElementById('woa-results-panel');
  const isWithin = data.budget_status === 'WITHIN_BUDGET';

  // SVG Convergence Curve Path
  const curve = data.woa_convergence.sample_curve || [];
  const maxC = Math.max(...curve);
  const minC = Math.min(...curve);
  const rangeC = maxC - minC || 1;

  panel.innerHTML = `
    <!-- Top 3 Metric Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <span class="text-xs font-medium text-slate-400">Predicted Total Cost</span>
        <div class="mt-1 flex items-baseline gap-2">
          <span class="text-2xl font-extrabold text-white">₹${data.predicted_total_cost.toLocaleString()}</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full ${isWithin ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}">
            ${isWithin ? 'Within Budget' : 'Over Budget'}
          </span>
        </div>
        <p class="text-[11px] text-slate-400 mt-1">
          ${data.savings_or_deficit >= 0 ? `₹${data.savings_or_deficit.toLocaleString()} surplus buffer` : `Deficit ₹${Math.abs(data.savings_or_deficit).toLocaleString()}`}
        </p>
      </div>

      <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <span class="text-xs font-medium text-slate-400">Cost Per Person</span>
        <div class="mt-1 flex items-baseline gap-2">
          <span class="text-2xl font-extrabold text-emerald-400">₹${data.cost_per_person.toLocaleString()}</span>
          <span class="text-xs text-slate-400">/ traveler</span>
        </div>
        <p class="text-[11px] text-slate-400 mt-1">Split across ${data.group_size} friends</p>
      </div>

      <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <span class="text-xs font-medium text-slate-400">WOA Efficiency Gain</span>
        <div class="mt-1 flex items-baseline gap-2">
          <span class="text-2xl font-extrabold text-teal-400">+${data.comparison.woa_cost_efficiency_gain_pct}%</span>
          <span class="text-xs text-slate-400 font-bold">vs baseline</span>
        </div>
        <p class="text-[11px] text-slate-400 mt-1">Baseline heuristic: ₹${data.comparison.baseline_heuristic_total.toLocaleString()}</p>
      </div>
    </div>

    <!-- 5-Channel Allocation Grid -->
    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span>Optimal 5-Channel Budget Allocation</span>
        </h4>
        <span class="text-xs text-slate-400 font-mono">30 Whales × 50 Iterations</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <!-- Transport -->
        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-slate-200">Transport & Fastag Tolls</span>
            <span class="font-bold text-white text-sm">₹${data.optimized_allocation.transport_and_fuel.amount.toLocaleString()}</span>
          </div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="bg-amber-400 h-full rounded-full" style="width: ${data.optimized_allocation.transport_and_fuel.percentage}%"></div>
          </div>
          <p class="text-[11px] text-slate-400">${data.optimized_allocation.transport_and_fuel.details} (${data.optimized_allocation.transport_and_fuel.percentage}%)</p>
        </div>

        <!-- Stay -->
        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-slate-200">Stay & Safe Lodging</span>
            <span class="font-bold text-white text-sm">₹${data.optimized_allocation.stay_accommodation.amount.toLocaleString()}</span>
          </div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="bg-blue-400 h-full rounded-full" style="width: ${data.optimized_allocation.stay_accommodation.percentage}%"></div>
          </div>
          <p class="text-[11px] text-slate-400">${data.optimized_allocation.stay_accommodation.details} (${data.optimized_allocation.stay_accommodation.percentage}%)</p>
        </div>

        <!-- Food -->
        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-slate-200">Food & Dining</span>
            <span class="font-bold text-white text-sm">₹${data.optimized_allocation.food_and_dining.amount.toLocaleString()}</span>
          </div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="bg-emerald-400 h-full rounded-full" style="width: ${data.optimized_allocation.food_and_dining.percentage}%"></div>
          </div>
          <p class="text-[11px] text-slate-400">${data.optimized_allocation.food_and_dining.details} (${data.optimized_allocation.food_and_dining.percentage}%)</p>
        </div>

        <!-- Sightseeing -->
        <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-slate-200">Sightseeing & Permits</span>
            <span class="font-bold text-white text-sm">₹${data.optimized_allocation.activities_sightseeing.amount.toLocaleString()}</span>
          </div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="bg-purple-400 h-full rounded-full" style="width: ${data.optimized_allocation.activities_sightseeing.percentage}%"></div>
          </div>
          <p class="text-[11px] text-slate-400">${data.optimized_allocation.activities_sightseeing.details} (${data.optimized_allocation.activities_sightseeing.percentage}%)</p>
        </div>
      </div>

      <!-- Guaranteed Emergency Safety Reserve Fund -->
      <div class="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-emerald-300">Protected Emergency Safety Reserve Fund</span>
            <p class="text-[11px] text-emerald-400/80">Non-negotiable buffer enforced by Whale Optimization penalty functions</p>
          </div>
          <span class="text-base font-extrabold text-emerald-300">₹${data.optimized_allocation.emergency_safety_reserve.amount.toLocaleString()}</span>
        </div>
        <div class="w-full bg-emerald-950 h-2 rounded-full overflow-hidden">
          <div class="bg-emerald-400 h-full rounded-full" style="width: ${data.optimized_allocation.emergency_safety_reserve.percentage}%"></div>
        </div>
        <p class="text-[11px] text-slate-300">${data.optimized_allocation.emergency_safety_reserve.details} (${data.optimized_allocation.emergency_safety_reserve.percentage}%)</p>
      </div>
    </div>

    <!-- WOA Convergence Curve -->
    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h4 class="text-sm font-bold text-white">WOA Convergence Curve: Bubble-Net Spiral Loss</h4>
          <p class="text-xs text-slate-400">Whale fitness optimizes towards Pareto frontier</p>
        </div>
        <span class="text-xs font-mono text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-md border border-emerald-800">
          Loss: ${data.woa_convergence.final_score}
        </span>
      </div>
      <div class="h-28 flex items-end gap-1.5 pt-4 px-2 bg-slate-950/60 rounded-xl border border-slate-800">
        ${curve.map((val, idx) => {
          const heightPct = Math.max(15, 100 - ((val - minC) / rangeC) * 80);
          return `
            <div class="flex-1 flex flex-col items-center gap-1 group relative">
              <div class="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-sm" style="height: ${heightPct}%"></div>
              <span class="text-[9px] text-slate-500 font-mono">${idx * 5}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// TAB 2: Hotel Safety Scoring Engine
// -----------------------------------------------------------------------------
async function loadHotels(city = '', minSafety = 0) {
  const container = document.getElementById('hotels-list-container');
  container.innerHTML = `
    <div class="p-8 text-center text-slate-400 text-sm">
      <span class="inline-block animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full mb-2"></span>
      <p>Analyzing safety signals across 1,200 hotel reviews & NCRB statistics...</p>
    </div>
  `;

  try {
    let url = '/api/hotels';
    const params = [];
    if (city) params.push(`city=${encodeURIComponent(city)}`);
    if (minSafety > 0) params.push(`min_safety=${minSafety}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const res = await apiCall(url);
    state.hotels = res.hotels || [];
    renderHotelsList();
    if (state.hotels.length > 0) {
      inspectHotel(state.hotels[0].id);
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="text-red-400 text-xs p-4">Failed to load hotels: ${err.message}</p>`;
  }
}

function filterHotelsCity(city) {
  document.querySelectorAll('.hotel-city-btn').forEach(b => {
    b.className = 'hotel-city-btn px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium';
  });
  event.target.className = 'hotel-city-btn px-3 py-1.5 rounded-xl bg-blue-600 text-white font-medium';
  loadHotels(city, Number(document.getElementById('hotel-min-safety').value));
}

function filterHotelsSafety(score) {
  const activeCityBtn = document.querySelector('.hotel-city-btn.bg-blue-600');
  const city = activeCityBtn ? activeCityBtn.innerText.replace('All Cities', '') : '';
  loadHotels(city, Number(score));
}

function renderHotelsList() {
  const container = document.getElementById('hotels-list-container');
  if (state.hotels.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs bg-[#111827] rounded-2xl border border-slate-800">No hotels match this safety threshold.</div>`;
    return;
  }

  container.innerHTML = state.hotels.map(h => {
    const isSelected = state.selectedHotel?.id === h.id;
    return `
      <div onclick="inspectHotel('${h.id}')" class="cursor-pointer p-4 rounded-2xl border transition-all ${isSelected ? 'bg-slate-800/90 border-blue-500 shadow-xl ring-1 ring-blue-500' : 'bg-[#111827] border-slate-800 hover:border-slate-700'}">
        <div class="flex flex-col sm:flex-row justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-white text-base">${h.name}</h3>
              <span class="text-xs text-slate-400">📍 ${h.city}</span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">${h.address}</p>
          </div>
          <div class="text-right">
            <span class="text-xs text-slate-400 block">Rate / Night</span>
            <span class="text-base font-extrabold text-white">₹${h.price_per_night?.toLocaleString()}</span>
          </div>
        </div>

        <!-- Dual Star vs Safety Score -->
        <div class="mt-3.5 pt-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
          <div class="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
            <span class="text-amber-400 font-bold text-sm">★ ${h.star_rating}</span>
            <span class="text-slate-400">Marketing Stars</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl border" style="background-color: ${h.badge_color}15; border-color: ${h.badge_color}50;">
            <span class="font-extrabold text-sm" style="color: ${h.badge_color};">🛡️ ${h.safety_score}/100</span>
            <span class="text-slate-300 font-medium">AI Safety Score</span>
          </div>
        </div>

        ${h.divergence_warning ? `
          <div class="mt-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center gap-2 text-xs text-amber-300 font-medium">
            <span>⚠️ ${h.divergence_warning}</span>
          </div>
        ` : ''}
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
  detail.innerHTML = `
    <div class="sticky top-24 bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-400">AI Safety Telemetry</span>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold" style="background-color: ${h.badge_color}20; color: ${h.badge_color}; border: 1px solid ${h.badge_color}60;">
          ${h.safety_badge}
        </span>
      </div>

      <div>
        <h3 class="text-lg font-bold text-white">${h.name}</h3>
        <p class="text-xs text-slate-400">${h.address}</p>
      </div>

      <!-- District Crime Context -->
      <div class="bg-slate-900 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5">
        <div class="flex justify-between">
          <span class="text-slate-400">District:</span>
          <span class="font-semibold text-white">${h.district}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Women Safety Index:</span>
          <span class="font-bold text-emerald-400">${h.crime_context?.women_safety_index}/100</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">Night Street Safety:</span>
          <span class="font-bold text-blue-400">${h.crime_context?.night_safety_score}/100</span>
        </div>
      </div>

      <!-- Positive Signals Detected -->
      <div>
        <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-2">
          Verified Safety Features (${h.detected_safety_features?.length || 0})
        </span>
        <div class="flex flex-wrap gap-1.5">
          ${h.detected_safety_features?.map(feat => `
            <span class="px-2.5 py-1 rounded-lg text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">✓ ${feat}</span>
          `).join('') || '<span class="text-xs text-slate-500">None detected</span>'}
        </div>
      </div>

      <!-- Hazards Detected -->
      <div>
        <span class="text-xs font-bold text-red-400 uppercase tracking-wider block mb-2">
          Safety Red Flags Extracted (${h.detected_safety_hazards?.length || 0})
        </span>
        <div class="flex flex-wrap gap-1.5">
          ${h.detected_safety_hazards?.map(haz => `
            <span class="px-2.5 py-1 rounded-lg text-xs bg-red-950/80 text-red-300 border border-red-800/80 animate-pulse">⚠️ ${haz}</span>
          `).join('') || '<span class="text-xs text-slate-500">No major safety red flags</span>'}
        </div>
      </div>

      <!-- Recommendation -->
      <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
        <span class="font-bold text-white block">Group Travel Verdict:</span>
        <p>${h.safety_score >= 80 ? 'Highly recommended for mixed friend groups. Secure gated perimeter and 24/7 front desk.' : h.safety_score >= 60 ? 'Standard precaution recommended. Keep personal belongings locked; avoid unlit side alleys after 9 PM.' : 'Caution: Significant safety concerns (dark lane, broken lock). Not advised for late check-in or female groups.'}</p>
      </div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// TAB 3: Route Risk & ChromaDB Interactive Map
// -----------------------------------------------------------------------------
async function initOrUpdateMap() {
  if (!state.map) {
    state.map = L.map('route-map').setView([12.2, 78.4], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(state.map);
  }

  if (!state.routeData) {
    try {
      const res = await apiCall('/api/risk/route');
      state.routeData = res;
      renderRouteOnMap(res);
      renderCorridorMetrics(res);
    } catch (err) {
      console.error(err);
    }
  } else {
    setTimeout(() => state.map.invalidateSize(), 200);
  }
}

function renderRouteOnMap(data) {
  const coords = data.route_geometry.coordinates.map(pt => [pt[1], pt[0]]); // [lat, lng]

  // Draw Polyline
  L.polyline(coords, {
    color: '#10B981',
    weight: 4.5,
    opacity: 0.85,
    dashArray: '8, 8'
  }).addTo(state.map);

  // Car Marker
  const carIcon = L.divIcon({
    className: 'car-icon',
    html: `<div style="background: #10B981; border: 2px solid white; border-radius: 50%; width: 30px; height: 30px; display: flex; items-align: center; justify-content: center; box-shadow: 0 0 15px #10B981;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 5px; margin-left: 5px;"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  state.carMarker = L.marker(coords[0], { icon: carIcon }).addTo(state.map);
  state.carCircle = L.circle(coords[0], {
    radius: 3500,
    color: '#10B981',
    fillColor: '#10B981',
    fillOpacity: 0.12
  }).addTo(state.map);

  // Blackspots from ChromaDB
  data.corridor_hazard_analysis.hazards_along_corridor.forEach(spot => {
    const isCritical = spot.risk_level === 'CRITICAL';
    const bg = isCritical ? '#EF4444' : '#F59E0B';

    const hazardIcon = L.divIcon({
      className: 'hazard-icon',
      html: `<div style="background: ${bg}; border: 2px solid #111827; border-radius: 50%; width: 24px; height: 24px; display: flex; items-align: center; justify-content: center; box-shadow: 0 0 10px ${bg};"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 4px; margin-left: 4px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const m = L.marker([spot.latitude, spot.longitude], { icon: hazardIcon }).addTo(state.map);
    m.bindPopup(`
      <div style="font-size: 11px; color: #0F172A; max-width: 220px;">
        <strong style="color: #DC2626; font-size: 12px;">${spot.name}</strong><br/>
        <b>Risk:</b> ${spot.risk_level} (${spot.risk_score}/100)<br/>
        <b>Hazard:</b> ${spot.danger_type}<br/>
        <b>Police:</b> ${spot.police_station} (${spot.emergency_phone})
      </div>
    `);

    if (isCritical) {
      L.circle([spot.latitude, spot.longitude], {
        radius: 4500,
        color: '#EF4444',
        fillColor: '#EF4444',
        fillOpacity: 0.18,
        dashArray: '5, 5'
      }).addTo(state.map);
    }
  });

  state.map.fitBounds(coords, { padding: [40, 40] });
}

function renderCorridorMetrics(data) {
  const grid = document.getElementById('corridor-metrics-grid');
  const haz = data.corridor_hazard_analysis;

  grid.innerHTML = `
    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
      <span class="text-xs text-slate-400">Corridor Safety Score</span>
      <p class="text-2xl font-extrabold text-teal-400 mt-1">${haz.corridor_safety_score}/100</p>
      <span class="text-[11px] text-slate-400">${haz.corridor_status}</span>
    </div>

    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
      <span class="text-xs text-slate-400">Accident Blackspots Flagged</span>
      <p class="text-2xl font-extrabold text-red-400 mt-1">${haz.total_blackspots_detected}</p>
      <span class="text-[11px] text-slate-400">${haz.critical_spots_count} Critical (Thoppur / Kalhatty)</span>
    </div>

    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
      <span class="text-xs text-slate-400">Route Geometry</span>
      <p class="text-2xl font-extrabold text-white mt-1">${data.route_summary.distance_km} km</p>
      <span class="text-[11px] text-slate-400">~${data.route_summary.estimated_drive_time_hours} hours via NH-48/544</span>
    </div>

    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
      <span class="text-xs text-slate-400">State Control Center</span>
      <p class="text-2xl font-extrabold text-emerald-400 mt-1">112 / 1033</p>
      <span class="text-[11px] text-slate-400">Tamil Nadu ERSS Emergency Patrol</span>
    </div>
  `;
}

// Drive Simulation & Geofence Collision Check
function toggleDriveSimulation() {
  if (state.simulating) {
    clearInterval(state.simInterval);
    state.simulating = false;
    document.getElementById('sim-text').innerText = 'Resume Drive';
  } else {
    if (!state.routeData) return;
    const coords = state.routeData.route_geometry.coordinates.map(pt => [pt[1], pt[0]]);
    state.simulating = true;
    document.getElementById('sim-text').innerText = 'Pause Drive';

    state.simInterval = setInterval(() => {
      state.simIndex += 50;
      if (state.simIndex >= coords.length) {
        clearInterval(state.simInterval);
        state.simulating = false;
        state.simIndex = 0;
        document.getElementById('sim-text').innerText = 'Simulate Drive along Route';
        return;
      }

      const pt = coords[state.simIndex];
      state.currentCoord = pt;
      state.carMarker.setLatLng(pt);
      state.carCircle.setLatLng(pt);
      document.getElementById('current-coords-label').innerText = `${pt[0].toFixed(3)}°N, ${pt[1].toFixed(3)}°E`;

      // Update backend location
      apiCall('/api/trips/trip-ooty-01/location', 'POST', {
        latitude: pt[0],
        longitude: pt[1]
      }).then(res => {
        if (res.geofence_alert) {
          triggerGeofenceAlertBanner(res.geofence_alert);
        }
      }).catch(e => {});

    }, 400);
  }
}

function resetSimulation() {
  clearInterval(state.simInterval);
  state.simulating = false;
  state.simIndex = 0;
  if (state.routeData) {
    const pt = [state.routeData.route_geometry.coordinates[0][1], state.routeData.route_geometry.coordinates[0][0]];
    state.carMarker.setLatLng(pt);
    state.carCircle.setLatLng(pt);
    document.getElementById('current-coords-label').innerText = `${pt[0].toFixed(3)}°N, ${pt[1].toFixed(3)}°E`;
  }
  document.getElementById('sim-text').innerText = 'Simulate Drive along Route';
  dismissGeofenceAlert();
}

function triggerGeofenceAlertBanner(alertData) {
  const banner = document.getElementById('geofence-alert-banner');
  document.getElementById('geo-alert-title').innerText = `Approaching ${alertData.blackspot_name} (${alertData.highway})`;
  document.getElementById('geo-alert-distance').innerText = `${alertData.distance_km} km away`;
  document.getElementById('geo-alert-desc').innerText = `${alertData.danger_type}. ${alertData.recommendation}`;
  document.getElementById('geo-alert-police').innerText = `Police: ${alertData.police_station} (${alertData.emergency_phone})`;
  banner.classList.remove('hidden');
}

function dismissGeofenceAlert() {
  document.getElementById('geofence-alert-banner').classList.add('hidden');
}

// -----------------------------------------------------------------------------
// TAB 4: Return-Time Contract & Check-In
// -----------------------------------------------------------------------------
async function loadContract() {
  try {
    const res = await apiCall('/api/safety/contract/trip-ooty-01');
    state.contract = res;
    renderContractUI(res);
  } catch (err) {
    console.error(err);
  }
}

function renderContractUI(data) {
  const evalData = data.evaluation;
  const isOverdue = evalData?.contract_status === 'OVERDUE_ALERT';
  const isSafe = evalData?.contract_status === 'SAFE_COMPLETED';

  const badge = document.getElementById('contract-badge');
  badge.innerText = isSafe ? 'SAFE CHECKED-IN' : isOverdue ? 'OVERDUE ALERT' : 'ACTIVE COUNTDOWN';
  badge.className = `px-3 py-1 rounded-full text-xs font-bold ${isSafe ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : isOverdue ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-purple-950 text-purple-400 border border-purple-800'}`;

  if (data.contract?.expected_return_time) {
    const d = new Date(data.contract.expected_return_time);
    document.getElementById('contract-time-display').innerText = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  document.getElementById('contract-msg-display').innerText = evalData?.message || data.contract?.notes || 'Contract active';

  // Overdue banner
  const overdueBox = document.getElementById('contract-overdue-box');
  if (isOverdue) {
    overdueBox.classList.remove('hidden');
    document.getElementById('overdue-headline').innerText = evalData.message;
    document.getElementById('overdue-gps-label').innerText = `${evalData.last_known_location.latitude}°N, ${evalData.last_known_location.longitude}°E`;
    document.getElementById('overdue-maps-link').href = evalData.last_known_location.maps_link;
  } else {
    overdueBox.classList.add('hidden');
  }
}

async function performSafeCheckin() {
  try {
    await apiCall('/api/safety/checkin/trip-ooty-01', 'POST', {
      notes: 'Group checked in: All friends reached destination safely.'
    });
    confetti({ particleCount: 70, spread: 60 });
    showToast('Safe Check-in verified! Return contract disarmed.');
    loadContract();
  } catch (err) {
    console.error(err);
  }
}

async function simulateOverdueAlarm() {
  try {
    await apiCall('/api/safety/simulate-overdue/trip-ooty-01', 'POST');
    showToast('Missed return alarm triggered! Last known GPS breadcrumb flagged.');
    loadContract();
  } catch (err) {
    console.error(err);
  }
}

async function updateReturnContract() {
  const timeVal = document.getElementById('input-return-time').value;
  const notes = document.getElementById('input-return-notes').value;
  if (!timeVal) return;

  const today = new Date();
  const [h, m] = timeVal.split(':');
  today.setHours(parseInt(h), parseInt(m), 0, 0);

  try {
    await apiCall('/api/safety/contract/trip-ooty-01', 'POST', {
      expected_return_time: today.toISOString(),
      notes: notes
    });
    showToast('Return-time contract updated successfully!');
    loadContract();
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------------------------------------------------------
// TAB 5: Splitwise Settle Up
// -----------------------------------------------------------------------------
async function loadExpenses() {
  try {
    const res = await apiCall('/api/expenses/trip-ooty-01');
    state.expensesData = res;
    renderExpensesUI(res);
  } catch (err) {
    console.error(err);
  }
}

function renderExpensesUI(data) {
  const report = data.settlement_report;

  // 1. Top Metrics
  document.getElementById('expense-metrics-grid').innerHTML = `
    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
      <span class="text-xs text-slate-400">Total Group Spend</span>
      <p class="text-2xl font-extrabold text-white mt-1">₹${report.total_trip_expenses.toLocaleString()}</p>
      <span class="text-[11px] text-slate-400">${report.expense_count} expenses logged</span>
    </div>

    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
      <span class="text-xs text-slate-400">Transactions Simplified</span>
      <p class="text-2xl font-extrabold text-emerald-400 mt-1">${report.transactions_count}</p>
      <span class="text-[11px] text-emerald-400 font-semibold">${report.reduction_efficiency_pct}% payment reduction</span>
    </div>

    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
      <span class="text-xs text-slate-400">Friends Traveling</span>
      <p class="text-2xl font-extrabold text-teal-400 mt-1">${data.members.length}</p>
      <span class="text-[11px] text-slate-400">All balances synchronized</span>
    </div>

    <div class="bg-[#111827] border border-slate-800 rounded-2xl p-4">
      <span class="text-xs text-slate-400">Settlement Algorithm</span>
      <p class="text-sm font-bold text-white mt-2">Min Cash Flow Graph</p>
      <span class="text-[11px] text-slate-400">Greedy creditor-debtor pairing</span>
    </div>
  `;

  // 2. Net Balances
  document.getElementById('net-balances-container').innerHTML = Object.entries(report.net_balances).map(([person, bal]) => {
    const isOwed = bal > 0;
    const isSettled = Math.abs(bal) < 0.01;
    return `
      <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300">
            ${person.charAt(0)}
          </div>
          <div>
            <span class="font-bold text-white block">${person}</span>
            <span class="text-[10px] text-slate-400">${isSettled ? 'Settled up' : isOwed ? 'Gets back' : 'Owes group'}</span>
          </div>
        </div>
        <span class="font-extrabold text-sm ${isSettled ? 'text-slate-400' : isOwed ? 'text-emerald-400' : 'text-red-400'}">
          ${isSettled ? '₹0' : `${isOwed ? '+' : '-'}₹${Math.abs(bal).toLocaleString()}`}
        </span>
      </div>
    `;
  }).join('');

  // 3. Minimized Settlements
  document.getElementById('minimized-settlements-container').innerHTML = report.minimized_settlements.length === 0
    ? `<div class="p-6 text-center text-slate-400 text-xs bg-slate-900 rounded-xl">🎉 All debts settled!</div>`
    : report.minimized_settlements.map(txn => {
      const isPaid = txn.status === 'PAID';
      return `
        <div class="p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-3 ${isPaid ? 'bg-emerald-950/30 border-emerald-800/60 opacity-80' : 'bg-slate-900 border-slate-800'}">
          <div class="flex items-center gap-2 text-xs">
            <span class="px-2.5 py-1 rounded-lg bg-red-950 text-red-300 font-bold border border-red-800/60">${txn.from_member}</span>
            <span class="text-slate-500">→</span>
            <span class="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/60">${txn.to_member}</span>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-base font-extrabold text-white">₹${txn.amount.toLocaleString()}</span>
            <button onclick="toggleMarkPaid('${txn.from_member}', '${txn.to_member}', ${txn.amount}, '${txn.status}')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isPaid ? 'bg-emerald-900 text-emerald-300 border border-emerald-700' : 'bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700'}">
              ${isPaid ? '✓ Paid & Settled' : 'Mark as Paid'}
            </button>
          </div>
        </div>
      `;
    }).join('');

  // 4. Expenses Log
  document.getElementById('expense-log-container').innerHTML = data.expenses.map(exp => `
    <div class="py-3 flex justify-between items-center gap-2 text-xs">
      <div>
        <span class="font-bold text-white text-sm block">${exp.description}</span>
        <div class="flex items-center gap-2 text-slate-400 text-[11px] mt-0.5">
          <span>Paid by <strong>${exp.payer_name}</strong></span>
          <span>•</span>
          <span class="px-1.5 py-0.2 rounded bg-slate-800 font-mono">${exp.category}</span>
          <span>•</span>
          <span>Split across ${exp.split_among.length} members</span>
        </div>
      </div>
      <span class="font-extrabold text-sm text-white">₹${exp.amount.toLocaleString()}</span>
    </div>
  `).join('');
}

async function toggleMarkPaid(fromMember, toMember, amount, currentStatus) {
  const newStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
  try {
    await apiCall('/api/expenses/trip-ooty-01/mark-paid', 'POST', {
      from_member: fromMember,
      to_member: toMember,
      amount: amount,
      status: newStatus
    });
    if (newStatus === 'PAID') confetti({ particleCount: 50, spread: 50 });
    showToast(`Settlement marked as ${newStatus}`);
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
    await apiCall('/api/expenses/trip-ooty-01', 'POST', {
      payer_name: payer,
      description: desc,
      amount: amount,
      category: category
    });
    closeAddExpenseModal();
    confetti({ particleCount: 60, spread: 55 });
    showToast(`Logged expense: ${desc} (₹${amount})`);
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
      trip_name: 'Chennai to Ooty 4-Friends Trip'
    });

    document.getElementById('sos-content-initial').classList.add('hidden');
    document.getElementById('sos-content-success').classList.remove('hidden');
    document.getElementById('sos-dispatch-id').innerText = `Dispatch ID: ${res.dispatch_id}`;
    document.getElementById('sos-maps-url').value = res.coordinates.google_maps_url;
    document.getElementById('sos-unit-name').innerText = res.nearest_local_unit;

    showToast('🚨 SOS DISTRESS BEACON ACTIVE! Broadcast dispatched to contacts & 112 ERSS.');
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
          showToast(`🚨 SOS DISTRESS BEACON from ${data.dispatch.sender}!`);
        } else if (data.event_type === 'OVERDUE_ALERT_TRIGGERED') {
          showToast(`⏰ RETURN CONTRACT OVERDUE ALERT: Group missed check-in!`);
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
// Initialize on Page Load
// -----------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  initUsers();
  initWebSocket();
  runWOACostOptimizer(); // Pre-load Tab 1 results automatically!
});
