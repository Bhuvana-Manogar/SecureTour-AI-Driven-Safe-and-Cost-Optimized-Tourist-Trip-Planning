import axios from 'axios';

const API_BASE = '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('securetour_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  getDemoUsers: () => api.get('/auth/demo-users'),
};

export const tripAPI = {
  listTrips: () => api.get('/trips'),
  getTrip: (tripId) => api.get(`/trips/${tripId}`),
  createTrip: (data) => api.post('/trips', data),
  updateLocation: (tripId, data) => api.post(`/trips/${tripId}/location`, data),
};

export const aiAPI = {
  predictCostWOA: (data) => api.post('/ai/predict-cost-woa', data),
};

export const hotelAPI = {
  getHotels: (params) => api.get('/hotels', { params }),
  getHotelDetail: (hotelId) => api.get(`/hotels/${hotelId}`),
};

export const riskAPI = {
  getRouteAndRisk: (params) => api.get('/risk/route', { params }),
  getNearbyHazards: (lat, lng, radius_km = 20) => api.get('/risk/nearby', { params: { lat, lng, radius_km } }),
  getCrimeStats: () => api.get('/risk/crime-stats'),
};

export const safetyAPI = {
  getContract: (tripId) => api.get(`/safety/contract/${tripId}`),
  setContract: (tripId, data) => api.post(`/safety/contract/${tripId}`, data),
  checkinSafe: (tripId, data) => api.post(`/safety/checkin/${tripId}`, data),
  simulateOverdue: (tripId) => api.post(`/safety/simulate-overdue/${tripId}`),
  triggerSOS: (data) => api.post('/safety/sos', data),
};

export const expenseAPI = {
  getExpenses: (tripId) => api.get(`/expenses/${tripId}`),
  addExpense: (tripId, data) => api.post(`/expenses/${tripId}`, data),
  markSettlementPaid: (tripId, data) => api.post(`/expenses/${tripId}/mark-paid`, data),
};

export function createTripWebSocket(tripId, onMessage, onError) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws/trip/${tripId}`;

  const socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log(`[WebSocket] Connected to SecureTour live radar: ${tripId}`);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (e) {
      console.error('[WebSocket] Parse error:', e);
    }
  };

  socket.onerror = (err) => {
    console.warn('[WebSocket] Error, will retry...', err);
    if (onError) onError(err);
  };

  return socket;
}
