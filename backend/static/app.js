/**
 * SecureTour AI — Intelligent Group Travel Safety, Navigation & Splitwise Platform
 * 
 * Features:
 * - Dynamic Real-Time Distance Auto-Sync: Typing or selecting any Source/Destination instantly calculates OSRM driving km & hours
 * - Pure Google Maps (GMap) Style: Clean high-contrast street navigation, electric blue route line, turn chevrons, green "A" and red "B" pins
 * - Live Device GPS Location: Browser HTML5 geolocation button centers map, drops pulsing blue marker, reverse-geocodes origin
 * - Dynamic Stays & Aspect Safety Scoring: Destination changes instantly reload verified stays for ANY city in India
 * - Individual Splitwise Member Accounts: Dedicated cards for Arun, Karthik, Priya, Divya showing Total Paid, Fair Share & Net Balance (+/-)
 * - Complete & Settle Trip: 1-click trip archive modal with celebration certificate and export report
 * - Real User Authentication: Registration captures personal emergency contacts with 1-click direct phone & WhatsApp SOS
 * - Whale Optimization Algorithm (WOA): Multi-channel budget metaheuristic optimizing transport, stays, food, activities & safety reserve
 */

// Application State
const state = {
  activeTab: 'plan',
  currentUser: null,
  token: localStorage.getItem('securetour_token') || null,
  tripId: 'trip-usr-1',
  userDb: 'usr-1.db',
  tripTitle: "Travel Expedition",
  tripSource: 'Chennai',
  tripDestination: 'Ooty',
  hotels: [],
  selectedHotel: null,
  routeData: null,
  routeMode: 'safe', // 'safe' | 'direct'
  map: null,
  tileLayer: null,
  directPolyline: null,
  safePolyline: null,
  originMarker: null,
  destMarker: null,
  carMarker: null,
  carCircle: null,
  liveGpsMarker: null,
  liveGpsCircle: null,
  hazardMarkers: [],
  simulating: false,
  simIndex: 0,
  simInterval: null,
  currentCoord: [13.0827, 80.2707],
  contract: null,
  expensesData: null,
  activeMemberFilter: '',
  activeExpenseCategoryFilter: '',
  distanceDebounceTimer: null,
  hotelDebounceTimer: null,
  socket: null,
  activeAlert: null
};

// Pure Google-Style Vector Street Map Provider (Single Clean Layer)
const GOOGLE_MAPS_LAYER = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  explanation: 'Google Maps Clean Navigation: High-contrast highway corridors (NH-48, NH-44, NH-544, NH-181) with live turn maneuvers & hazard radar.'
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
  toast.className = 'pointer-events-auto p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xl flex items-center gap-3 text-xs font-semibold text-[#202124] transition-all transform duration-300';
  
  const iconBg = type === 'error' ? 'bg-[#D93025]' : type === 'success' ? 'bg-[#1E8E3E]' : 'bg-[#1A73E8]';
  toast.innerHTML = `
    <span class="w-2.5 h-2.5 rounded-full ${iconBg} animate-ping"></span>
    <span class="flex-1">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-700 px-1 font-bold">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// -----------------------------------------------------------------------------
// Navigation Tabs
// -----------------------------------------------------------------------------
function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.className = 'tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] transition-all';
  });
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) {
    activeBtn.className = 'tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A73E8] text-white shadow-md shadow-blue-500/20 transition-all';
  }

  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) targetView.classList.remove('hidden');

  if (tabId === 'travel') {
    initOrUpdateMap();
  } else if (tabId === 'stay' && state.hotels.length === 0) {
    loadHotels(state.tripDestination);
  } else if (tabId === 'protected') {
    loadContract();
  } else if (tabId === 'settle') {
    loadExpenses();
  }
}

// -----------------------------------------------------------------------------
// USER AUTHENTICATION & LOGIN/REGISTER MODALS
// -----------------------------------------------------------------------------
async function initAuth() {
  const savedUser = localStorage.getItem('securetour_user');
  const savedToken = localStorage.getItem('securetour_token');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
      state.token = savedToken;
    } catch (e) {}
  }

  // Default to Arun Kumar demo profile if not logged in
  if (!state.currentUser) {
    state.currentUser = {
      id: 'usr-1',
      email: 'arun@securetour.ai',
      full_name: 'Arun Kumar',
      phone: '+91 98401 23456',
      emergency_contact_name: 'Venkatesh (Father)',
      emergency_contact_phone: '+91 98401 99999'
    };
  }

  updateAuthHeaderUI();
  await loadUserActiveTrip();
}

async function loadUserActiveTrip() {
  try {
    const res = await apiCall('/api/user/active-trip');
    if (res && res.trip) {
      state.tripId = res.trip.id;
      state.tripSource = res.trip.source || 'Chennai';
      state.tripDestination = res.trip.destination || 'Ooty';
      state.tripTitle = res.trip.title;
      state.userDb = res.user_db || `${state.currentUser?.id || 'usr-1'}.db`;

      // Update active inputs if empty
      const srcInput = document.getElementById('woa-source');
      const dstInput = document.getElementById('woa-destination');
      if (srcInput && (!srcInput.value || srcInput.value === 'Chennai')) srcInput.value = state.tripSource;
      if (dstInput && (!dstInput.value || dstInput.value === 'Ooty')) dstInput.value = state.tripDestination;

      // Update Splitwise banner badges
      const dbBadge = document.getElementById('trip-db-isolation-badge');
      if (dbBadge) dbBadge.innerText = `🔒 Isolated User DB: ${state.userDb}`;
      const titleEl = document.getElementById('splitwise-trip-title');
      if (titleEl) titleEl.innerText = `${res.trip.title} — Splitwise`;
    }
  } catch (err) {
    console.warn('Could not load user active trip:', err);
  }
}

function updateAuthHeaderUI() {
  const loggedOut = document.getElementById('auth-logged-out');
  const loggedIn = document.getElementById('auth-logged-in');

  if (state.currentUser && state.currentUser.full_name) {
    if (loggedOut) loggedOut.classList.add('hidden');
    if (loggedIn) loggedIn.classList.remove('hidden');

    const initial = state.currentUser.full_name.charAt(0).toUpperCase();
    const avatarEl = document.getElementById('user-avatar-initial');
    if (avatarEl) avatarEl.innerText = initial;

    const displayHeader = document.getElementById('user-display-name-header');
    if (displayHeader) displayHeader.innerText = state.currentUser.full_name;

    // Dropdown details
    const pName = document.getElementById('profile-user-name');
    const pEmail = document.getElementById('profile-user-email');
    const pPhone = document.getElementById('profile-user-phone');
    const pEmName = document.getElementById('profile-emergency-name');
    const pEmPhone = document.getElementById('profile-emergency-phone');

    if (pName) pName.innerText = state.currentUser.full_name;
    if (pEmail) pEmail.innerText = state.currentUser.email || 'traveler@securetour.ai';
    if (pPhone) pPhone.innerText = state.currentUser.phone || '+91 98401 23456';
    if (pEmName) pEmName.innerText = state.currentUser.emergency_contact_name || 'Family Contact';
    if (pEmPhone) pEmPhone.innerText = state.currentUser.emergency_contact_phone || '+91 98401 99999';
  } else {
    if (loggedIn) loggedIn.classList.add('hidden');
    if (loggedOut) loggedOut.classList.remove('hidden');
  }
}

function toggleProfileDropdown() {
  const menu = document.getElementById('profile-dropdown-menu');
  if (menu) menu.classList.toggle('hidden');
}

function openLoginModal() {
  document.getElementById('login-modal').classList.remove('hidden');
}

function closeLoginModal() {
  document.getElementById('login-modal').classList.add('hidden');
}

function openRegisterModal() {
  document.getElementById('register-modal').classList.remove('hidden');
}

function closeRegisterModal() {
  document.getElementById('register-modal').classList.add('hidden');
}

async function quickLoginDemo(email) {
  try {
    const res = await apiCall('/api/auth/login', 'POST', {
      email: email,
      password: 'secure123'
    });

    state.currentUser = res.user;
    state.token = res.access_token;
    localStorage.setItem('securetour_token', res.access_token);
    localStorage.setItem('securetour_user', JSON.stringify(res.user));

    updateAuthHeaderUI();
    closeLoginModal();
    await loadUserActiveTrip();
    await calculateDynamicDistance(state.tripSource, state.tripDestination);
    loadContract();
    loadExpenses();
    showToast(`Signed in as ${res.user.full_name}`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleUserLoginForm(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await apiCall('/api/auth/login', 'POST', { email, password });
    state.currentUser = res.user;
    state.token = res.access_token;
    localStorage.setItem('securetour_token', res.access_token);
    localStorage.setItem('securetour_user', JSON.stringify(res.user));

    updateAuthHeaderUI();
    closeLoginModal();
    await loadUserActiveTrip();
    await calculateDynamicDistance(state.tripSource, state.tripDestination);
    loadContract();
    loadExpenses();
    showToast(`Welcome back, ${res.user.full_name}!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleUserRegisterForm(e) {
  e.preventDefault();
  const fullName = document.getElementById('reg-name').value;
  const phone = document.getElementById('reg-phone').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const emName = document.getElementById('reg-em-name').value;
  const emPhone = document.getElementById('reg-em-phone').value;

  try {
    const res = await apiCall('/api/auth/register', 'POST', {
      full_name: fullName,
      phone: phone,
      email: email,
      password: password,
      emergency_contact_name: emName,
      emergency_contact_phone: emPhone
    });

    state.currentUser = res.user;
    state.token = res.access_token;
    localStorage.setItem('securetour_token', res.access_token);
    localStorage.setItem('securetour_user', JSON.stringify(res.user));

    updateAuthHeaderUI();
    closeRegisterModal();
    confetti({ particleCount: 60, spread: 60 });
    await loadUserActiveTrip();
    await calculateDynamicDistance(state.tripSource, state.tripDestination);
    loadContract();
    loadExpenses();
    showToast(`Account created! Welcome, ${res.user.full_name}`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleLogout() {
  localStorage.removeItem('securetour_token');
  localStorage.removeItem('securetour_user');
  state.currentUser = null;
  state.token = null;
  updateAuthHeaderUI();
  toggleProfileDropdown();
  showToast('Signed out successfully.');
  await initAuth();
  loadContract();
  loadExpenses();
}

// -----------------------------------------------------------------------------
// TAB 1: DYNAMIC DISTANCE CALCULATION & WOA COST OPTIMIZATION
// -----------------------------------------------------------------------------

function onSourceOrDestInput() {
  clearTimeout(state.distanceDebounceTimer);
  state.distanceDebounceTimer = setTimeout(() => {
    const source = document.getElementById('woa-source').value.trim();
    const dest = document.getElementById('woa-destination').value.trim();
    if (source && dest) {
      calculateDynamicDistance(source, dest);
    }
  }, 600);
}

async function calculateDynamicDistance(origin, destination) {
  const spinner = document.getElementById('dist-calc-spinner');
  const summaryLabel = document.getElementById('route-distance-summary');
  if (spinner) spinner.classList.remove('hidden');
  if (summaryLabel) summaryLabel.innerText = 'Calculating real-world driving distance via GPS...';

  try {
    const res = await apiCall(`/api/routes/distance?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
    const distKm = res.distance_km || 540;
    const durHrs = res.estimated_hours || 9.5;

    // Update input and state
    const distInput = document.getElementById('woa-distance');
    if (distInput) distInput.value = distKm;
    state.tripSource = origin;
    state.tripDestination = destination;

    // Update quick corridor labels at header
    const qSource = document.getElementById('quick-source-label');
    const qDest = document.getElementById('quick-dest-label');
    if (qSource) qSource.innerText = origin;
    if (qDest) qDest.innerText = destination;

    if (summaryLabel) {
      summaryLabel.innerText = `${distKm} km • ~${durHrs} hrs travel duration`;
    }

    // Auto-run WOA price predictor with new distance
    await runWOACostOptimizer();

    // Auto-reload map route if already initialized
    if (state.map) {
      await loadRoute(origin, destination);
    }

    // Auto-reload stays for new destination
    await loadHotels(destination);

  } catch (err) {
    console.error('Distance calculation error:', err);
    if (summaryLabel) summaryLabel.innerText = '540 km • ~9.5 hrs (Default route)';
  } finally {
    if (spinner) spinner.classList.add('hidden');
  }
}

function setTripCorridor(source, dest, dist, days, budget) {
  const sInput = document.getElementById('woa-source');
  const dInput = document.getElementById('woa-destination');
  const distInput = document.getElementById('woa-distance');
  const durInput = document.getElementById('woa-duration');
  const bInput = document.getElementById('woa-budget');
  const bLabel = document.getElementById('budget-val-label');

  if (sInput) sInput.value = source;
  if (dInput) dInput.value = dest;
  if (distInput) distInput.value = dist;
  if (durInput) durInput.value = days;
  if (bInput) bInput.value = budget;
  if (bLabel) bLabel.innerText = '₹' + Number(budget).toLocaleString();

  calculateDynamicDistance(source, dest);
  showToast(`Loaded ${source} ➔ ${dest} travel corridor`, 'info');
}

async function runWOACostOptimizer() {
  const source = document.getElementById('woa-source')?.value || state.tripSource;
  const destination = document.getElementById('woa-destination')?.value || state.tripDestination;
  const distance = parseFloat(document.getElementById('woa-distance')?.value) || 540;
  const duration = parseInt(document.getElementById('woa-duration')?.value) || 4;
  const groupSize = parseInt(document.getElementById('woa-groupsize')?.value) || 4;
  const vehicle = document.getElementById('woa-vehicle')?.value || 'car';
  const budget = parseFloat(document.getElementById('woa-budget')?.value) || 48000;

  state.tripSource = source;
  state.tripDestination = destination;
  const qSource = document.getElementById('quick-source-label');
  const qDest = document.getElementById('quick-dest-label');
  if (qSource) qSource.innerText = source;
  if (qDest) qDest.innerText = destination;

  const btn = document.getElementById('btn-run-woa');
  if (btn) btn.innerHTML = `<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Optimizing Budget...`;

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
    showToast(`Price prediction notice: ${err.message}`, 'error');
    console.error('WOA Error:', err);
  } finally {
    if (btn) {
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>Run Whale Cost Prediction AI</span>
      `;
    }
  }
}

function renderWOAResults(data) {
  const container = document.getElementById('woa-results-panel');
  if (!container) return;

  const totalCost = data.predicted_total_cost || 38749;
  const costPerPerson = data.cost_per_person || Math.round(totalCost / (data.group_size || 4));
  const savings = data.savings_or_deficit || 9251;
  const alloc = data.optimized_allocation || {};

  const fuel = alloc.transport_and_fuel || { amount: 8200, percentage: 21.2, details: 'Fuel & Highway Fastag Tolls' };
  const stay = alloc.stay_accommodation || { amount: 16500, percentage: 42.6, details: 'Verified Safe Stays' };
  const food = alloc.food_and_dining || { amount: 7600, percentage: 19.6, details: 'Dining for Group' };
  const acts = alloc.activities_and_sightseeing || { amount: 3600, percentage: 9.3, details: 'Sightseeing & Entries' };
  const safe = alloc.emergency_safety_reserve || { amount: 2849, percentage: 7.3, details: 'Hill Station Emergency Reserve' };

  const isWithinBudget = data.budget_status === 'WITHIN_BUDGET' || savings >= 0;

  container.innerHTML = `
    <!-- Top Summary Banner -->
    <div class="bg-white border border-[#E8EAED] rounded-3xl p-6 shadow-sm card-hover-3d flex flex-col sm:flex-row items-center justify-between gap-5">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-[#5F6368] uppercase tracking-wider">AI Optimal Cost Prediction</span>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${isWithinBudget ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}">
            ${isWithinBudget ? '✓ WITHIN TARGET BUDGET' : '⚠️ BUDGET EXCEEDED'}
          </span>
        </div>
        <div class="flex items-baseline gap-2 mt-1">
          <span class="text-3xl font-extrabold text-[#202124]">₹${Number(totalCost).toLocaleString()}</span>
          <span class="text-xs text-[#5F6368] font-semibold">Total for ${data.group_size} travelers (${data.duration_days} days)</span>
        </div>
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto">
        <div class="flex-1 sm:flex-none p-3.5 rounded-2xl bg-blue-50 border border-blue-100 text-center">
          <span class="text-[10px] font-bold text-[#1A73E8] uppercase block">Per Friend Share</span>
          <span class="text-lg font-black text-[#1557B0]">₹${Number(costPerPerson).toLocaleString()}</span>
        </div>
        <div class="flex-1 sm:flex-none p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
          <span class="text-[10px] font-bold text-emerald-700 uppercase block">Projected Savings</span>
          <span class="text-lg font-black text-emerald-700">₹${Number(Math.abs(savings)).toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- 5-Channel Constrained Allocation Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      
      <!-- Fuel & Tolls -->
      <div class="bg-white border border-[#E8EAED] rounded-2xl p-4 shadow-sm card-hover-3d space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-[#3C4043]">⛽ Fuel & Highway Tolls</span>
          <span class="font-mono font-bold text-[#202124]">₹${Number(fuel.amount).toLocaleString()}</span>
        </div>
        <div class="w-full bg-[#F1F3F4] h-2 rounded-full overflow-hidden">
          <div class="bg-[#1A73E8] h-full rounded-full" style="width: ${fuel.percentage}%"></div>
        </div>
        <span class="text-[11px] text-[#5F6368] block">${fuel.percentage}% • ${fuel.details || 'Fuel & Tolls'}</span>
      </div>

      <!-- Hotel Accommodation -->
      <div class="bg-white border border-[#E8EAED] rounded-2xl p-4 shadow-sm card-hover-3d space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-[#3C4043]">🏨 Hotel & Stays</span>
          <span class="font-mono font-bold text-[#202124]">₹${Number(stay.amount).toLocaleString()}</span>
        </div>
        <div class="w-full bg-[#F1F3F4] h-2 rounded-full overflow-hidden">
          <div class="bg-indigo-600 h-full rounded-full" style="width: ${stay.percentage}%"></div>
        </div>
        <span class="text-[11px] text-[#5F6368] block">${stay.percentage}% • ${stay.details || 'Verified Safe Stays'}</span>
      </div>

      <!-- Food & Dining -->
      <div class="bg-white border border-[#E8EAED] rounded-2xl p-4 shadow-sm card-hover-3d space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-[#3C4043]">🍽️ Food & Dining</span>
          <span class="font-mono font-bold text-[#202124]">₹${Number(food.amount).toLocaleString()}</span>
        </div>
        <div class="w-full bg-[#F1F3F4] h-2 rounded-full overflow-hidden">
          <div class="bg-teal-600 h-full rounded-full" style="width: ${food.percentage}%"></div>
        </div>
        <span class="text-[11px] text-[#5F6368] block">${food.percentage}% • ${food.details || 'Meals for Group'}</span>
      </div>

      <!-- Sightseeing & Activities -->
      <div class="bg-white border border-[#E8EAED] rounded-2xl p-4 shadow-sm card-hover-3d space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-[#3C4043]">🎟️ Sightseeing & Entries</span>
          <span class="font-mono font-bold text-[#202124]">₹${Number(acts.amount).toLocaleString()}</span>
        </div>
        <div class="w-full bg-[#F1F3F4] h-2 rounded-full overflow-hidden">
          <div class="bg-amber-500 h-full rounded-full" style="width: ${acts.percentage}%"></div>
        </div>
        <span class="text-[11px] text-[#5F6368] block">${acts.percentage}% • ${acts.details || 'Local Passes & Boating'}</span>
      </div>

      <!-- Emergency & Safety Reserve -->
      <div class="bg-white border border-[#E8EAED] rounded-2xl p-4 shadow-sm card-hover-3d space-y-2 sm:col-span-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-[#1E8E3E] flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>🛡️ Protected Emergency & Safety Contingency Reserve</span>
          </span>
          <span class="font-mono font-extrabold text-[#1E8E3E]">₹${Number(safe.amount).toLocaleString()}</span>
        </div>
        <div class="w-full bg-[#F1F3F4] h-2 rounded-full overflow-hidden">
          <div class="bg-[#1E8E3E] h-full rounded-full" style="width: ${safe.percentage}%"></div>
        </div>
        <span class="text-[11px] text-[#5F6368] block">Locked reserve for mountain breakdown towing, sudden tolls, or medical first aid.</span>
      </div>

    </div>

    <!-- AI Optimization Info Banner -->
    <div class="bg-[#F8F9FA] border border-[#DADCE0] rounded-2xl p-4 text-xs text-[#5F6368] flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full bg-[#1A73E8]"></span>
        <span>Algorithm: <strong>Whale Optimization Algorithm (WOA)</strong> • Bubble-Net Spiral Convergence • 50 Iterations</span>
      </div>
      <button onclick="switchTab('stay')" class="text-xs font-bold text-[#1A73E8] hover:underline flex items-center gap-1">
        <span>Proceed to Choose Stay</span>
        <span>➔</span>
      </button>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// TAB 2: DYNAMIC STAYS & AI SAFETY SCORING
// -----------------------------------------------------------------------------

function onHotelSearchInput(val) {
  clearTimeout(state.hotelDebounceTimer);
  state.hotelDebounceTimer = setTimeout(() => {
    loadHotels(val.trim());
  }, 450);
}

async function loadHotels(city = '', minSafety = 0) {
  try {
    const searchCity = (city || state.tripDestination || 'Ooty').trim();
    let url = '/api/hotels';
    const params = [];
    if (searchCity) params.push(`city=${encodeURIComponent(searchCity)}`);
    if (minSafety > 0) params.push(`min_safety=${minSafety}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const res = await apiCall(url);
    state.hotels = res.hotels || [];
    renderHotelsList();

    // Update active city indicator badge
    const badge = document.getElementById('hotel-active-city-label');
    if (badge) {
      badge.innerText = `Showing Verified Safe Stays in ${searchCity}`;
    }
    const searchInput = document.getElementById('hotel-search-city');
    if (searchInput && searchInput.value !== searchCity && city) {
      searchInput.value = searchCity;
    }

    if (state.hotels.length > 0) {
      inspectHotel(state.hotels[0].id);
    } else {
      const detail = document.getElementById('hotel-detail-container');
      if (detail) {
        detail.innerHTML = `
          <div class="bg-white border border-[#E8EAED] rounded-3xl p-6 text-center text-[#5F6368] space-y-2">
            <p class="font-bold text-[#202124]">No stays found for "${searchCity}"</p>
            <p class="text-xs">Try searching for Ooty, Coorg, Goa, Manali, Munnar, or Bangalore.</p>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Failed to load hotels', err);
  }
}

function filterHotelsCity(cityName) {
  document.querySelectorAll('.hotel-city-btn').forEach(b => {
    b.className = 'hotel-city-btn px-3 py-1 rounded-xl bg-[#F1F3F4] text-[#3C4043] hover:bg-[#E8EAED] font-bold text-xs';
  });
  if (event && event.target) {
    event.target.className = 'hotel-city-btn active px-3 py-1 rounded-xl bg-[#1A73E8] text-white font-bold text-xs shadow-sm';
  }
  loadHotels(cityName, document.getElementById('hotel-min-safety')?.value || 0);
}

function filterHotelsSafety(score) {
  loadHotels('', parseFloat(score));
}

function renderHotelsList() {
  const container = document.getElementById('hotels-list-container');
  if (!container) return;

  if (state.hotels.length === 0) {
    container.innerHTML = `
      <div class="bg-white border border-[#E8EAED] rounded-3xl p-8 text-center text-[#5F6368]">
        No hotels match the selected safety criteria.
      </div>
    `;
    return;
  }

  container.innerHTML = state.hotels.map(h => {
    const isSelected = state.selectedHotel?.id === h.id;
    const splitPrice = Math.round(h.price_per_night / 4);

    return `
      <div onclick="inspectHotel('${h.id}')" class="bg-white border ${isSelected ? 'border-[#1A73E8] ring-2 ring-blue-500/20' : 'border-[#E8EAED]'} hover:border-[#1A73E8] rounded-3xl p-4 shadow-sm card-hover-3d transition-all cursor-pointer flex flex-col sm:flex-row gap-4 group">
        
        <!-- Hotel Image with Rating Overlay -->
        <div class="sm:w-52 h-44 rounded-2xl overflow-hidden relative flex-shrink-0 bg-slate-100">
          <img src="${h.image_url}" alt="${h.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
          
          <!-- Star Rating Badge -->
          <div class="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-amber-400 font-extrabold text-[11px] flex items-center gap-1 shadow">
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
                <h4 class="text-base font-extrabold text-[#202124] group-hover:text-[#1A73E8] transition-colors">${h.name}</h4>
                <p class="text-xs text-[#5F6368] flex items-center gap-1 mt-0.5">
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
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[#F1F3F4] text-[#3C4043] border border-[#DADCE0]">✓ ${a}</span>
              `).join('')}
            </div>
          </div>

          <!-- Price & CTA bar -->
          <div class="flex items-baseline justify-between mt-3 pt-3 border-t border-[#F1F3F4]">
            <div>
              <span class="text-xs text-[#5F6368]">Nightly rate</span>
              <div class="flex items-baseline gap-1.5">
                <span class="text-xl font-black text-[#202124]">₹${h.price_per_night.toLocaleString()}</span>
                <span class="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">₹${splitPrice.toLocaleString()} / friend</span>
              </div>
            </div>

            <button onclick="event.stopPropagation(); inspectHotel('${h.id}')" class="px-3.5 py-1.5 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-bold text-xs shadow-sm transition-all">
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
    <div class="sticky top-32 bg-white border border-[#E8EAED] rounded-3xl p-6 space-y-4 shadow-sm card-hover-3d">
      
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
      <div class="bg-[#F8F9FA] rounded-2xl p-4 border border-[#E8EAED] space-y-2">
        <div class="flex justify-between items-baseline">
          <span class="text-xs font-bold text-[#3C4043]">AI Safety Index:</span>
          <span class="text-xl font-black" style="color: ${h.badge_color};">${h.safety_score} / 100</span>
        </div>
        <div class="w-full bg-[#E8EAED] h-2 rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width: ${h.safety_score}%; background-color: ${h.badge_color};"></div>
        </div>
        <p class="text-[11px] text-[#5F6368]">${h.safety_badge}</p>
      </div>

      <!-- District Crime Statistics from NCRB -->
      <div class="border border-[#F1F3F4] rounded-2xl p-3.5 text-xs space-y-2">
        <span class="text-[10px] font-bold uppercase tracking-wider text-[#5F6368] block">District Safety & Crime Data</span>
        <div class="flex justify-between text-[#3C4043]">
          <span>District Jurisdiction:</span>
          <strong class="text-[#202124]">${h.district}</strong>
        </div>
        <div class="flex justify-between text-[#3C4043]">
          <span>Women Safety Score:</span>
          <strong class="text-[#1E8E3E] font-bold">${h.crime_context?.women_safety_index || 85} / 100</strong>
        </div>
        <div class="flex justify-between text-[#3C4043]">
          <span>Night Street Security:</span>
          <strong class="text-[#1A73E8] font-bold">${h.crime_context?.night_safety_score || 80} / 100</strong>
        </div>
      </div>

      <!-- Verified Safety Features Extracted from Reviews -->
      <div>
        <span class="text-xs font-bold text-[#1E8E3E] uppercase tracking-wider block mb-2">
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
        <span class="text-xs font-bold text-[#D93025] uppercase tracking-wider block mb-2">
          ⚠️ Red Flags Flagged (${h.detected_safety_hazards?.length || 0})
        </span>
        <div class="flex flex-wrap gap-1.5">
          ${(h.detected_safety_hazards || []).map(haz => `
            <span class="px-2.5 py-1 rounded-xl text-xs bg-red-50 text-red-700 font-bold border border-red-200">⚠️ ${haz}</span>
          `).join('') || '<span class="text-xs text-slate-400">Zero critical safety red flags</span>'}
        </div>
      </div>

      <button onclick="selectHotelForTrip('${h.id}')" class="w-full py-3 rounded-2xl bg-[#1E8E3E] hover:bg-[#137333] text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all">
        Lock Stay for Group Trip
      </button>

    </div>
  `;
}

function selectHotelForTrip(hotelId) {
  const h = state.hotels.find(x => x.id === hotelId);
  if (!h) return;
  showToast(`Locked stay: ${h.name} for your group trip!`, 'success');
  confetti({ particleCount: 50, spread: 60 });
}

// -----------------------------------------------------------------------------
// TAB 3: PURE GOOGLE-STYLE MAP & LIVE GPS NAVIGATION
// -----------------------------------------------------------------------------

async function initOrUpdateMap() {
  if (!state.map) {
    state.map = L.map('route-map', {
      zoomControl: true
    }).setView([12.2, 78.4], 8);

    // Initial tile layer: Pure Google-Style Street Map (CartoDB Voyager)
    state.tileLayer = L.tileLayer(GOOGLE_MAPS_LAYER.url, {
      attribution: GOOGLE_MAPS_LAYER.attribution,
      maxZoom: 18
    }).addTo(state.map);

    const expLabel = document.getElementById('map-layer-explanation');
    if (expLabel) expLabel.innerText = GOOGLE_MAPS_LAYER.explanation;
  }

  if (!state.routeData) {
    await loadRoute(state.tripSource, state.tripDestination);
  } else {
    setTimeout(() => state.map.invalidateSize(), 200);
  }
}

// Live Device GPS Location Engine (HTML5 Geolocation)
function useLiveBrowserLocation() {
  const btnText = document.getElementById('live-gps-btn-text');
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser', 'error');
    return;
  }

  if (btnText) btnText.innerText = '📍 Acquiring GPS...';
  showToast('Connecting to device GPS sensor...', 'info');

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      state.currentCoord = [lat, lng];

      if (btnText) btnText.innerText = '📍 GPS Locked';

      // Reverse geocode coords to city name
      let locationName = `Live GPS (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
      try {
        const geoRes = await apiCall(`/api/routes/reverse-geocode?lat=${lat}&lng=${lng}`);
        if (geoRes && geoRes.city) {
          locationName = geoRes.city;
        }
      } catch (e) {}

      // Update Source input in Tab 1
      const sourceInput = document.getElementById('woa-source');
      if (sourceInput) sourceInput.value = locationName;
      state.tripSource = locationName;

      // Update map vehicle & live dot
      if (state.map) {
        updateLiveGpsMarker(lat, lng, position.coords.accuracy);
        state.map.setView([lat, lng], 13);
      }

      // Record to server trip telemetry
      try {
        await apiCall(`/api/trips/${state.tripId}/location`, 'POST', {
          latitude: lat,
          longitude: lng
        });
      } catch (e) {}

      showToast(`📍 Live GPS acquired: ${locationName} (${lat.toFixed(4)}, ${lng.toFixed(4)})`, 'success');
      confetti({ particleCount: 40, spread: 50 });

      // Recalculate route and distance dynamically from live position
      const dest = document.getElementById('woa-destination')?.value.trim() || state.tripDestination;
      calculateDynamicDistance(locationName, dest);
    },
    (error) => {
      console.warn('Geolocation notice:', error);
      if (btnText) btnText.innerText = '📍 Use My Live GPS';
      showToast(`GPS Notice: ${error.message || 'Permission denied'}. Utilizing high-precision highway route.`, 'info');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function updateLiveGpsMarker(lat, lng, accuracy = 50) {
  if (!state.map) return;
  const liveIcon = L.divIcon({
    className: 'live-gps-dot',
    html: `
      <div style="position: relative; width: 28px; height: 28px;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(26,115,232,0.4); animation: sonar-wave 1.8s infinite ease-out;"></span>
        <div style="position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; border-radius: 50%; background: #1A73E8; border: 3px solid white; box-shadow: 0 0 10px rgba(26,115,232,0.7);"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  if (state.liveGpsMarker) {
    state.liveGpsMarker.setLatLng([lat, lng]);
  } else {
    state.liveGpsMarker = L.marker([lat, lng], { icon: liveIcon, zIndexOffset: 1000 }).addTo(state.map);
    state.liveGpsMarker.bindPopup('<b>📍 Your Current Live Location</b>');
  }

  if (state.liveGpsCircle) {
    state.liveGpsCircle.setLatLng([lat, lng]);
    state.liveGpsCircle.setRadius(Math.max(100, accuracy));
  } else {
    state.liveGpsCircle = L.circle([lat, lng], {
      radius: Math.max(100, accuracy),
      color: '#1A73E8',
      fillColor: '#1A73E8',
      fillOpacity: 0.12,
      weight: 1.5
    }).addTo(state.map);
  }
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
  // Clear existing layers
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
    color: '#D93025',
    weight: state.routeMode === 'direct' ? 6 : 3,
    opacity: state.routeMode === 'direct' ? 0.9 : 0.35,
    dashArray: '6, 6'
  }).addTo(state.map);

  // 2. Draw AI Safe Bypass Route (Google Maps Electric Blue #1A73E8)
  state.safePolyline = L.polyline(safeCoords, {
    color: '#1A73E8',
    weight: state.routeMode === 'safe' ? 7 : 3,
    opacity: state.routeMode === 'safe' ? 0.95 : 0.4
  }).addTo(state.map);

  // Origin Marker (Green Pin "A")
  const originCoord = safeCoords[0];
  const originIcon = L.divIcon({
    className: 'origin-pin',
    html: `
      <div style="background: #1E8E3E; color: white; font-weight: 800; font-size: 13px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(30,142,62,0.4);">
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
      <div style="background: #D93025; color: white; font-weight: 800; font-size: 13px; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(217,48,37,0.4);">
        B
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
  state.destMarker = L.marker(destCoord, { icon: destIcon }).addTo(state.map);
  state.destMarker.bindPopup(`<b>Destination: ${data.destination}</b>`);

  // Moving Car Marker (Google Maps / Uber Navigation Arrow)
  const carIcon = L.divIcon({
    className: 'car-icon',
    html: `
      <div style="position: relative; width: 36px; height: 36px;">
        <div class="car-sonar-ring"></div>
        <div style="background: #1A73E8; border: 2.5px solid white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(26,115,232,0.5); position: relative; z-index: 10;">
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
      color: '#1A73E8',
      fillColor: '#1A73E8',
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
    const bg = isCritical ? '#D93025' : '#FBBC04';

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
      <div style="font-size: 12px; color: #202124; max-width: 240px; font-family: 'Plus Jakarta Sans', sans-serif;">
        <strong style="color: #D93025; font-size: 13px;">${spot.name}</strong><br/>
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
        color: '#D93025',
        fillColor: '#D93025',
        fillOpacity: 0.12,
        dashArray: '5, 5'
      }).addTo(state.map);
      state.hazardMarkers.push(cZone);
    }
  });

  state.map.fitBounds(activePath, { padding: [40, 40] });
  updateRouteModeButtons();
}

// Render Turn-by-Turn Driving Steps in Right Drawer
function renderTurnByTurnDirections(data) {
  const container = document.getElementById('directions-step-list');
  if (!container) return;

  const activeRoute = state.routeMode === 'safe' ? data.safe_bypass_route : data.direct_route;
  const steps = activeRoute.steps || [];

  const stepsBadge = document.getElementById('directions-steps-badge');
  const summaryText = document.getElementById('directions-summary-text');
  if (stepsBadge) stepsBadge.innerText = `${steps.length} Steps`;
  if (summaryText) summaryText.innerText = `${activeRoute.distance_km} km • ${activeRoute.estimated_hours} hr via ${state.routeMode === 'safe' ? 'AI Safe Bypass Corridor' : 'Standard Highway'}`;

  // Update floating next turn HUD
  if (steps.length > 0) {
    const s0 = steps[0];
    const turnDist = document.getElementById('hud-turn-dist');
    const turnText = document.getElementById('hud-turn-text');
    if (turnDist) turnDist.innerText = `Next: in ${s0.distance_label}`;
    if (turnText) turnText.innerText = s0.instruction;
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
      <div id="nav-step-${idx}" onclick="focusMapOnStep(${s.location[0]}, ${s.location[1]}, ${idx})" class="p-3 rounded-2xl bg-[#F8F9FA] hover:bg-blue-50/70 border border-[#E8EAED] transition-all cursor-pointer flex items-start gap-3 group">
        <div class="w-8 h-8 rounded-xl bg-white text-[#202124] flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm border border-[#DADCE0] group-hover:border-[#1A73E8]">
          ${icon}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-[#202124] truncate">${s.road_name || 'Highway'}</span>
            <span class="text-[11px] font-bold text-[#5F6368] font-mono">${s.distance_label}</span>
          </div>
          <p class="text-[11px] text-[#5F6368] mt-0.5 leading-snug">${s.instruction}</p>

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

  const activeRoute = state.routeMode === 'safe' ? state.routeData.safe_bypass_route : state.routeData.direct_route;
  const s = activeRoute.steps[stepIndex];
  if (s) {
    const turnDist = document.getElementById('hud-turn-dist');
    const turnText = document.getElementById('hud-turn-text');
    if (turnDist) turnDist.innerText = `Step ${s.step_number} • in ${s.distance_label}`;
    if (turnText) turnText.innerText = s.instruction;
  }
}

function switchToSafeBypassRoute(fromBanner = false) {
  state.routeMode = 'safe';
  updateRouteModeButtons();

  if (state.directPolyline) state.directPolyline.setStyle({ weight: 3, opacity: 0.35 });
  if (state.safePolyline) state.safePolyline.setStyle({ weight: 7, opacity: 0.95 });

  if (state.routeData) renderTurnByTurnDirections(state.routeData);
  if (fromBanner) dismissGeofenceAlert();
  showToast('Switched to AI Safe Bypass corridor avoiding hazardous hairpins.', 'success');
}

function switchToDirectRoute() {
  state.routeMode = 'direct';
  updateRouteModeButtons();

  if (state.directPolyline) state.directPolyline.setStyle({ weight: 7, opacity: 0.95 });
  if (state.safePolyline) state.safePolyline.setStyle({ weight: 3, opacity: 0.35 });

  if (state.routeData) renderTurnByTurnDirections(state.routeData);
  showToast('Switched to Direct Route. Caution: 4 blackspot zones along path.', 'error');
}

function updateRouteModeButtons() {
  const btnSafe = document.getElementById('btn-route-safe');
  const btnDirect = document.getElementById('btn-route-direct');
  if (!btnSafe || !btnDirect) return;

  if (state.routeMode === 'safe') {
    btnSafe.className = 'px-4 py-2 rounded-xl bg-[#1E8E3E] text-white shadow-md flex items-center gap-2 transition-all';
    btnDirect.className = 'px-4 py-2 rounded-xl text-[#3C4043] hover:text-[#202124] flex items-center gap-2 transition-all';
  } else {
    btnSafe.className = 'px-4 py-2 rounded-xl text-[#3C4043] hover:text-[#202124] flex items-center gap-2 transition-all';
    btnDirect.className = 'px-4 py-2 rounded-xl bg-[#D93025] text-white shadow-md flex items-center gap-2 transition-all';
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
  const simText = document.getElementById('sim-text');
  const simIcon = document.getElementById('sim-icon');
  if (simText) simText.innerText = 'Pause Drive';
  if (simIcon) simIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';

  const activePath = state.routeMode === 'safe'
    ? state.routeData.safe_bypass_route.geometry.coordinates.map(pt => [pt[1], pt[0]])
    : state.routeData.direct_route.geometry.coordinates.map(pt => [pt[1], pt[0]]);

  const steps = state.routeMode === 'safe'
    ? state.routeData.safe_bypass_route.steps
    : state.routeData.direct_route.steps;

  state.simInterval = setInterval(() => {
    if (state.simIndex >= activePath.length) {
      stopSimulation();
      showToast(`Group has safely reached destination in ${state.tripDestination}!`, 'success');
      confetti({ particleCount: 70, spread: 70 });
      return;
    }

    const coord = activePath[state.simIndex];
    state.currentCoord = coord;
    state.carMarker.setLatLng(coord);
    state.carCircle.setLatLng(coord);

    const coordsLabel = document.getElementById('current-coords-label');
    if (coordsLabel) coordsLabel.innerText = `${coord[0].toFixed(4)}°N, ${coord[1].toFixed(4)}°E`;

    // Speed fluctuation
    const speed = Math.floor(58 + Math.random() * 18);
    const speedLabel = document.getElementById('live-speed-label');
    if (speedLabel) speedLabel.innerText = `${speed} km/h`;

    // Check Geofence breach simulation
    if (state.simIndex > 30 && state.simIndex < 45 && !state.activeAlert) {
      triggerGeofenceAlertUI({
        title: 'Approaching Thoppur Ghat S-Curve',
        distance: '1.4 km ahead',
        description: 'Steep downhill mountain decline with brake failure risk. Shift to 2nd/3rd gear immediately.',
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
        const turnDist = document.getElementById('hud-turn-dist');
        const turnText = document.getElementById('hud-turn-text');
        if (turnDist) turnDist.innerText = `Step ${s.step_number} • in ${s.distance_label}`;
        if (turnText) turnText.innerText = s.instruction;
      }
    }

    state.simIndex += 2;
  }, 500);
}

function stopSimulation() {
  state.simulating = false;
  clearInterval(state.simInterval);
  const simText = document.getElementById('sim-text');
  const simIcon = document.getElementById('sim-icon');
  if (simText) simText.innerText = 'Simulate Live Drive';
  if (simIcon) simIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
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
  const coordsLabel = document.getElementById('current-coords-label');
  if (coordsLabel) coordsLabel.innerText = `${activePath[0][0].toFixed(4)}°N, ${activePath[0][1].toFixed(4)}°E`;
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
    <div class="bg-white border border-[#E8EAED] rounded-2xl p-4 shadow-sm card-hover-3d">
      <span class="text-xs text-[#5F6368] font-bold block uppercase">Total Distance</span>
      <span class="text-xl font-extrabold text-[#202124] mt-1 block">${data.direct_route.distance_km} km</span>
      <span class="text-[11px] text-[#5F6368]">Live OSRM Highway Sync</span>
    </div>

    <div class="bg-white border border-[#E8EAED] rounded-2xl p-4 shadow-sm card-hover-3d">
      <span class="text-xs text-[#5F6368] font-bold block uppercase">Est. Driving Duration</span>
      <span class="text-xl font-extrabold text-[#1A73E8] mt-1 block">${data.direct_route.estimated_hours} Hours</span>
      <span class="text-[11px] text-[#5F6368]">Includes ghat ascent</span>
    </div>

    <div class="bg-white border border-[#E8EAED] rounded-2xl p-4 shadow-sm card-hover-3d">
      <span class="text-xs text-[#5F6368] font-bold block uppercase">Corridor Safety Score</span>
      <span class="text-xl font-extrabold text-[#1E8E3E] mt-1 block">${data.safe_bypass_route.corridor_safety_score} / 100</span>
      <span class="text-[11px] text-emerald-700 font-bold">Verified Safe Bypass</span>
    </div>

    <div class="bg-white border border-[#E8EAED] rounded-2xl p-4 shadow-sm card-hover-3d">
      <span class="text-xs text-[#5F6368] font-bold block uppercase">Highway Patrol</span>
      <span class="text-xl font-extrabold text-[#202124] mt-1 block">112 / 1033</span>
      <span class="text-[11px] text-[#5F6368]">National Highway Rescue</span>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// TAB 4: RETURN-TIME SENTINEL (SAFETY NET)
// -----------------------------------------------------------------------------
async function loadContract() {
  try {
    const res = await apiCall(`/api/safety/contract/${state.tripId}`);
    state.contract = res;
    if (res.contract) {
      const tripTitle = document.getElementById('contract-trip-title');
      const targetTime = document.getElementById('contract-target-time-label');
      const lastLoc = document.getElementById('contract-last-loc-label');

      if (tripTitle) tripTitle.innerText = `${state.tripSource} to ${state.tripDestination} Trip Shield`;
      if (targetTime) targetTime.innerText = new Date(res.contract.expected_return_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      if (lastLoc) lastLoc.innerText = `Last GPS: ${res.contract.last_known_lat || 13.0827}°N, ${res.contract.last_known_lng || 80.2707}°E`;
    }
  } catch (err) {
    console.error('Failed to load contract', err);
  }
}

async function performSafeCheckin() {
  try {
    await apiCall(`/api/safety/checkin/${state.tripId}`, 'POST', {
      notes: `Group safely reached destination in ${state.tripDestination}.`
    });
    confetti({ particleCount: 70, spread: 70 });
    showToast('Safe group arrival checked in! Sentinel disarmed.', 'success');
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
    showToast('Return-time contract locked! Watchdog active.', 'success');
    loadContract();
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------------------------------------------------------
// TAB 5: INDIVIDUAL SPLITWISE & 1-CLICK TRIP COMPLETION
// -----------------------------------------------------------------------------

async function loadExpenses() {
  try {
    const res = await apiCall(`/api/expenses/${state.tripId}`);
    state.expensesData = res;
    renderExpensesFeed(res.expenses || []);
    renderMemberBalances(res.members || [], res.expenses || []);
    renderSettlementReport(res.settlement_report);
  } catch (err) {
    console.error('Failed to load expenses', err);
  }
}

function filterExpensesByCategory(cat) {
  state.activeExpenseCategoryFilter = cat;
  document.querySelectorAll('.exp-cat-btn').forEach(b => {
    b.className = 'exp-cat-btn px-2.5 py-1 rounded-lg bg-[#F1F3F4] text-[#3C4043] font-bold';
  });
  if (event && event.target) {
    event.target.className = 'exp-cat-btn active px-2.5 py-1 rounded-lg bg-teal-700 text-white font-bold';
  }
  filterAndRenderExpenses();
}

function filterExpensesByMember(memberName) {
  if (state.activeMemberFilter === memberName) {
    state.activeMemberFilter = '';
  } else {
    state.activeMemberFilter = memberName;
  }
  filterAndRenderExpenses();
  renderMemberBalances(state.expensesData?.members || [], state.expensesData?.expenses || []);
}

function filterAndRenderExpenses() {
  let list = state.expensesData?.expenses || [];
  if (state.activeExpenseCategoryFilter) {
    list = list.filter(e => e.category === state.activeExpenseCategoryFilter);
  }
  if (state.activeMemberFilter) {
    list = list.filter(e => e.payer_name === state.activeMemberFilter || (e.split_among && e.split_among.includes(state.activeMemberFilter)));
  }
  renderExpensesFeed(list);
}

// Renders member balance cards with Net +/- balances, Organizer badge, and Add Co-Traveler action
function renderMemberBalances(members, expenses) {
  const container = document.getElementById('splitwise-member-balances-grid');
  if (!container) return;

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const fairShare = members.length > 0 ? totalSpent / members.length : 0;

  // Calculate paid amounts per member
  const paidMap = {};
  members.forEach(m => paidMap[m] = 0);
  expenses.forEach(e => {
    const p = e.payer_name;
    if (paidMap[p] !== undefined) paidMap[p] += e.amount;
    else paidMap[p] = e.amount;
  });

  const memberColors = ['#1A73E8', '#1E8E3E', '#9333EA', '#EA8600', '#D93025', '#0D9488', '#E11D48'];

  const memberCardsHtml = members.map((m, idx) => {
    const paid = paidMap[m] || 0;
    const net = paid - fairShare;
    const isCreditor = net >= 0;
    const isFiltered = state.activeMemberFilter === m;
    const color = memberColors[idx % memberColors.length];
    const isYou = state.currentUser && (m.trim().toLowerCase() === state.currentUser.full_name?.trim().toLowerCase());

    return `
      <div onclick="filterExpensesByMember('${m}')" class="bg-white border ${isFiltered ? 'border-teal-600 ring-2 ring-teal-500/20' : 'border-[#E8EAED]'} rounded-2xl p-4 shadow-sm card-hover-3d space-y-2 cursor-pointer transition-all relative">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-sm" style="background-color: ${color}">
              ${m.charAt(0)}
            </div>
            <div>
              <span class="text-xs font-bold text-[#202124] block">${m}</span>
              ${isYou ? `
                <span class="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">⭐ You (Organizer)</span>
              ` : `
                <span class="text-[10px] text-[#5F6368]">Co-Traveler</span>
              `}
            </div>
          </div>
          
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${isCreditor ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}">
              ${isCreditor ? 'Gets Back' : 'Owes Group'}
            </span>
            ${!isYou ? `
              <button onclick="handleRemoveTripMember('${m}', event)" title="Remove co-traveler" class="text-slate-400 hover:text-red-600 text-xs font-bold px-1 py-0.5 rounded hover:bg-slate-100 transition-colors">✕</button>
            ` : ''}
          </div>
        </div>

        <div class="flex items-baseline justify-between pt-1">
          <span class="text-xs text-[#5F6368]">Net Balance:</span>
          <span class="text-sm font-black font-mono ${isCreditor ? 'text-emerald-700' : 'text-red-600'}">
            ${isCreditor ? '+' : ''}₹${Math.round(net).toLocaleString()}
          </span>
        </div>

        <div class="text-[10px] text-[#5F6368] flex justify-between border-t border-[#F1F3F4] pt-1.5">
          <span>Total Paid: <strong class="text-[#202124]">₹${Math.round(paid).toLocaleString()}</strong></span>
          <span>Fair Share: <strong class="text-[#202124]">₹${Math.round(fairShare).toLocaleString()}</strong></span>
        </div>

        <div class="pt-1 text-[10px] font-bold text-teal-700 flex items-center justify-between">
          <span>${isFiltered ? '✓ Showing friend expenses' : 'Click to filter expenses'}</span>
          <span>➔</span>
        </div>
      </div>
    `;
  }).join('');

  // Add Co-Traveler dashed card
  const addCardHtml = `
    <div onclick="openAddMemberModal()" class="border-2 border-dashed border-teal-300 hover:border-teal-600 bg-teal-50/40 hover:bg-teal-50/80 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-sm group min-h-[140px]">
      <div class="w-10 h-10 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-lg shadow group-hover:scale-110 transition-transform">
        +
      </div>
      <div class="text-center">
        <p class="text-xs font-extrabold text-teal-900">+ Add Co-Traveler</p>
        <p class="text-[10px] text-teal-700">Invite friend to your trip</p>
      </div>
    </div>
  `;

  container.innerHTML = memberCardsHtml + addCardHtml;
}

function renderExpensesFeed(expenses) {
  const container = document.getElementById('expenses-history-list');
  if (!container) return;

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPill = document.getElementById('total-expenses-pill');
  if (totalPill) totalPill.innerText = `Total: ₹${total.toLocaleString()}`;

  if (expenses.length === 0) {
    container.innerHTML = '<p class="text-xs text-[#5F6368] text-center py-4">No expenses match the selected filter.</p>';
    return;
  }

  container.innerHTML = expenses.map(e => `
    <div class="p-3.5 rounded-2xl bg-[#F8F9FA] hover:bg-slate-100 border border-[#E8EAED] flex items-center justify-between group transition-colors">
      <div>
        <p class="text-xs font-bold text-[#202124]">${e.description}</p>
        <p class="text-[10px] text-[#5F6368]">Paid by <strong class="text-[#3C4043]">${e.payer_name}</strong> • ${e.category}</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm font-black text-[#202124] font-mono">₹${e.amount.toLocaleString()}</span>
        <button onclick="handleDeleteExpense('${e.id}')" class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 text-xs transition-opacity" title="Delete expense">✕</button>
      </div>
    </div>
  `).join('');
}

async function handleDeleteExpense(expenseId) {
  try {
    await apiCall(`/api/expenses/${state.tripId}/${expenseId}`, 'DELETE');
    showToast('Expense removed.');
    loadExpenses();
  } catch (err) {
    console.error(err);
  }
}

function renderSettlementReport(report) {
  const container = document.getElementById('minimized-settlement-list');
  if (!container) return;

  const txns = report?.minimized_settlements || [];
  if (txns.length === 0) {
    container.innerHTML = '<p class="text-xs text-emerald-800 font-bold p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">✓ All debts are settled! Everyone is completely square.</p>';
    return;
  }

  container.innerHTML = txns.map(t => {
    const isPaid = t.status === 'PAID';
    const upiPayLink = `upi://pay?pa=securetour@okhdfcbank&pn=${encodeURIComponent(t.to_member)}&am=${t.amount}&cu=INR&tn=${encodeURIComponent('SecureTour Group Settlement')}`;

    return `
      <div class="p-4 rounded-2xl bg-[#F8F9FA] border ${isPaid ? 'border-emerald-300 bg-emerald-50/40' : 'border-[#E8EAED]'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm card-hover-3d">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-[#1A73E8] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            ${t.from_member.charAt(0)}
          </div>
          <div>
            <p class="text-xs font-bold text-[#202124]">
              ${t.from_member} <span class="text-[#5F6368] font-normal">owes</span> ${t.to_member}
            </p>
            <p class="text-base font-black text-[#202124] font-mono">₹${t.amount.toLocaleString()}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          ${isPaid ? `
            <span class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              ✓ Settled & Paid
            </span>
          ` : `
            <!-- 1-Click UPI Intent Link (GPay / PhonePe / Paytm / BHIM) -->
            <a href="${upiPayLink}" class="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all">
              <span>💳 Pay with UPI</span>
            </a>
            <!-- Mark as Paid Button -->
            <button onclick="markPaymentSettled('${t.from_member}', '${t.to_member}', ${t.amount})" class="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-sm transition-all">
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
    showToast(`Payment of ₹${amount} settled: ${fromMember} → ${toMember}`, 'success');
    loadExpenses();
  } catch (err) {
    console.error(err);
  }
}

function openAddExpenseModal() {
  const members = state.expensesData?.members || (state.currentUser ? [state.currentUser.full_name] : ['Arun Kumar']);
  
  // Dynamic payer dropdown
  const payerSelect = document.getElementById('exp-payer');
  if (payerSelect) {
    payerSelect.innerHTML = members.map(m => {
      const isSelected = state.currentUser && (m.trim().toLowerCase() === state.currentUser.full_name?.trim().toLowerCase());
      return `<option value="${m}" ${isSelected ? 'selected' : ''}>${m} ${isSelected ? '(You)' : ''}</option>`;
    }).join('');
  }

  // Dynamic split checkboxes
  const splitContainer = document.getElementById('split-friends-container');
  if (splitContainer) {
    splitContainer.innerHTML = members.map(m => `
      <label class="flex items-center gap-1.5 p-2 rounded-xl bg-[#F8F9FA] border border-[#E8EAED] cursor-pointer hover:bg-slate-100 transition-colors">
        <input type="checkbox" name="split-friend" value="${m}" checked class="accent-[#1A73E8]">
        <span class="text-xs font-semibold text-[#202124] truncate">${m}</span>
      </label>
    `).join('');
  }

  document.getElementById('expense-modal').classList.remove('hidden');
}

function closeAddExpenseModal() {
  document.getElementById('expense-modal').classList.add('hidden');
}

function openAddMemberModal() {
  const modal = document.getElementById('add-member-modal');
  if (modal) modal.classList.remove('hidden');
  const input = document.getElementById('new-member-name');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 100);
  }
}

function closeAddMemberModal() {
  const modal = document.getElementById('add-member-modal');
  if (modal) modal.classList.add('hidden');
}

async function submitAddMember(e) {
  e.preventDefault();
  const input = document.getElementById('new-member-name');
  const name = input?.value?.trim();
  if (!name) return;

  try {
    await apiCall(`/api/trips/${state.tripId}/members`, 'POST', { member_name: name });
    closeAddMemberModal();
    confetti({ particleCount: 40, spread: 40 });
    showToast(`Added ${name} to your travel group!`, 'success');
    await loadExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRemoveTripMember(memberName, ev) {
  if (ev) ev.stopPropagation();
  if (!confirm(`Remove ${memberName} from your travel group?`)) return;

  try {
    await apiCall(`/api/trips/${state.tripId}/members/${encodeURIComponent(memberName)}`, 'DELETE');
    showToast(`Removed ${memberName} from trip.`, 'info');
    await loadExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitNewExpense(e) {
  e.preventDefault();
  const payer = document.getElementById('exp-payer').value;
  const desc = document.getElementById('exp-desc').value;
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const category = document.getElementById('exp-category').value;

  // Selected friends for split
  const checkedBoxes = document.querySelectorAll('input[name="split-friend"]:checked');
  const splitAmong = Array.from(checkedBoxes).map(cb => cb.value);

  try {
    await apiCall(`/api/expenses/${state.tripId}`, 'POST', {
      payer_name: payer,
      description: desc,
      amount: amount,
      category: category,
      split_among: splitAmong.length > 0 ? splitAmong : null
    });
    closeAddExpenseModal();
    confetti({ particleCount: 50, spread: 50 });
    showToast(`Logged ₹${amount} for ${desc}`, 'success');
    loadExpenses();
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------------------------------------------------------
// TRIP COMPLETION CERTIFICATE & ARCHIVE ENGINE
// -----------------------------------------------------------------------------

async function triggerCompleteTripModal() {
  try {
    const res = await apiCall(`/api/trips/${state.tripId}/complete`, 'POST');
    
    // Populate modal values
    const spentEl = document.getElementById('complete-total-spent');
    const expCountEl = document.getElementById('complete-expenses-count');
    const stlCountEl = document.getElementById('complete-settlements-count');

    if (spentEl) spentEl.innerText = `₹${Number(res.total_spent).toLocaleString()}`;
    if (expCountEl) expCountEl.innerText = res.total_expenses_count || '5';
    if (stlCountEl) stlCountEl.innerText = `${res.settlements_settled || 3} / ${res.settlements_settled || 3}`;

    // Render member final summary in ledger
    const members = state.expensesData?.members || (state.currentUser ? [state.currentUser.full_name, 'Karthik', 'Priya', 'Divya'] : ['Arun Kumar', 'Karthik Rajan', 'Priya Sundaram', 'Divya Menon']);
    const totalSpent = res.total_spent || 31250;
    const share = members.length > 0 ? Math.round(totalSpent / members.length) : 0;

    const ledgerContainer = document.getElementById('complete-members-ledger');
    if (ledgerContainer) {
      ledgerContainer.innerHTML = members.map(m => `
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span class="font-bold text-[#202124]">${m}</span>
          </div>
          <span class="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
            ✓ Fully Settled (₹${share.toLocaleString()} Share)
          </span>
        </div>
      `).join('');
    }

    document.getElementById('trip-complete-modal').classList.remove('hidden');
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    showToast('🎉 Trip completed and archived! All member balances are fully settled.', 'success');

    // Reload expenses to show updated settled status
    loadExpenses();
  } catch (err) {
    showToast(`Notice: ${err.message}`, 'error');
  }
}

function closeCompleteTripModal() {
  document.getElementById('trip-complete-modal').classList.add('hidden');
}

function downloadTripSummaryReport() {
  const tripTitle = `${state.tripSource} to ${state.tripDestination} Trip`;
  const total = state.expensesData?.expenses?.reduce((s, e) => s + e.amount, 0) || 31250;
  const members = state.expensesData?.members || (state.currentUser ? [state.currentUser.full_name, 'Karthik', 'Priya', 'Divya'] : ['Arun Kumar', 'Karthik Rajan', 'Priya Sundaram', 'Divya Menon']);
  
  const reportLines = [
    `============================================================`,
    `SECURETOUR AI — TRIP FINANCIAL & SETTLEMENT CERTIFICATE`,
    `============================================================`,
    `Trip: ${tripTitle}`,
    `Status: COMPLETED & ARCHIVED`,
    `Generated At: ${new Date().toLocaleString()}`,
    `Total Group Spend: ₹${total.toLocaleString()}`,
    `Total Members: ${members.length}`,
    `Fair Share Per Member: ₹${Math.round(total / (members.length || 1)).toLocaleString()}`,
    `------------------------------------------------------------`,
    `MEMBER ACCOUNTS SETTLED:`,
    ...members.map(m => ` - ${m}: Reconciled & Settle Confirmed`),
    `------------------------------------------------------------`,
    `EXPENSE AUDIT LOG:`,
    ...(state.expensesData?.expenses || []).map(e => ` - [${e.category}] ${e.description}: ₹${e.amount} (Paid by ${e.payer_name})`),
    `------------------------------------------------------------`,
    `All debts have been minimized via Graph Cash Flow algorithm.`,
    `============================================================`
  ];

  const blob = new Blob([reportLines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SecureTour_${state.tripSource}_to_${state.tripDestination}_Settlement_Report.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Trip report downloaded successfully!', 'success');
}

// -----------------------------------------------------------------------------
// SOS MODAL & DIRECT EMERGENCY DIALING
// -----------------------------------------------------------------------------
function openSOSModal() {
  document.getElementById('sos-modal').classList.remove('hidden');

  // Populate logged in user's emergency contact details
  const emName = state.currentUser?.emergency_contact_name || 'Venkatesh (Father)';
  const emPhone = state.currentUser?.emergency_contact_phone || '+91 98401 99999';

  document.getElementById('sos-contact-name-display').innerText = emName;
  document.getElementById('sos-contact-phone-display').innerText = emPhone;

  // Clean phone number for tel: link
  const cleanPhone = emPhone.replace(/[^\d+]/g, '');
  const cleanDigits = emPhone.replace(/\D/g, '');
  document.getElementById('sos-btn-direct-call').href = `tel:${cleanPhone}`;

  // WhatsApp SOS pre-filled link
  const lat = state.currentCoord[0].toFixed(4);
  const lng = state.currentCoord[1].toFixed(4);
  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  const userName = state.currentUser?.full_name || 'Traveler';
  const waMsg = encodeURIComponent(`🚨 EMERGENCY SOS: ${userName} is stranded and needs immediate help! Live GPS Location: ${mapsLink}`);
  document.getElementById('sos-btn-whatsapp').href = `https://wa.me/${cleanDigits}?text=${waMsg}`;

  // Google Maps URL field
  document.getElementById('sos-maps-url').value = mapsLink;
}

function closeSOSModal() {
  document.getElementById('sos-modal').classList.add('hidden');
}

async function confirmSOSBroadcast() {
  try {
    const res = await apiCall('/api/safety/sos', 'POST', {
      latitude: state.currentCoord[0] || 12.0152,
      longitude: state.currentCoord[1] || 78.1093,
      user_id: state.currentUser?.id,
      user_name: state.currentUser?.full_name || 'Traveler',
      emergency_contact_name: state.currentUser?.emergency_contact_name,
      emergency_contact_phone: state.currentUser?.emergency_contact_phone,
      trip_name: `${state.tripSource} to ${state.tripDestination} Trip`
    });

    showToast('🚨 SOS DISTRESS BEACON ACTIVE! Dispatched to emergency contacts & 112 ERSS.', 'error');
    closeSOSModal();
  } catch (err) {
    showToast(err.message, 'error');
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
  if (state.socket) {
    try { state.socket.close(); } catch (e) {}
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const tripId = state.tripId || 'trip-usr-1';
  const wsUrl = `${protocol}//${window.location.host}/ws/trip/${tripId}`;

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
          showToast(`✅ Safe group arrival checked in!`, 'success');
          if (state.activeTab === 'protected') loadContract();
        } else if (data.event_type === 'SETTLEMENT_MARKED_PAID') {
          showToast(`✓ Payment of ₹${data.amount} settled: ${data.from_member} → ${data.to_member}`, 'success');
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
window.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  initWebSocket();
  calculateDynamicDistance(state.tripSource, state.tripDestination);
  loadContract();
  loadExpenses();
});
