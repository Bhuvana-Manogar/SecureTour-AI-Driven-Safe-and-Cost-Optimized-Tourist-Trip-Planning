import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CostPredictorWOA from './components/CostPredictorWOA';
import HotelSafetyExplorer from './components/HotelSafetyExplorer';
import RouteRiskMap from './components/RouteRiskMap';
import SafetyNetContract from './components/SafetyNetContract';
import SplitwiseSettleUp from './components/SplitwiseSettleUp';
import SOSModal from './components/SOSModal';
import { authAPI, createTripWebSocket } from './api';
import { Shield, Sparkles, Bell } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('plan');
  const [currentUser, setCurrentUser] = useState(null);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [liveGeofenceAlert, setLiveGeofenceAlert] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);

  // Load default demo user on mount
  useEffect(() => {
    authAPI.getDemoUsers()
      .then(res => {
        const users = res.data.demo_users || [];
        if (users.length > 0) {
          const defaultUser = users[0]; // Arun Kumar
          localStorage.setItem('securetour_token', defaultUser.demo_token);
          setCurrentUser(defaultUser);
        }
      })
      .catch(err => console.error('Failed to load demo users', err));
  }, []);

  // Initialize Real-time WebSocket Radar
  useEffect(() => {
    const ws = createTripWebSocket(
      'trip-ooty-01',
      (data) => {
        console.log('[Live Event Received]:', data);
        if (data.event_type === 'LOCATION_UPDATED' && data.geofence_alert) {
          setLiveGeofenceAlert(data.geofence_alert);
          showToast(`⚠️ GEOFENCE ALERT: Approaching ${data.geofence_alert.blackspot_name}!`);
        } else if (data.event_type === 'EXPENSE_ADDED') {
          showToast(`💰 ₹${data.expense.amount} logged by ${data.expense.payer_name}: ${data.expense.description}`);
        } else if (data.event_type === 'EMERGENCY_SOS_TRIGGERED') {
          showToast(`🚨 SOS DISTRESS BEACON triggered by ${data.dispatch.sender}!`);
        } else if (data.event_type === 'OVERDUE_ALERT_TRIGGERED') {
          showToast(`⏰ RETURN CONTRACT OVERDUE ALERT: Group missed return check-in deadline!`);
        } else if (data.event_type === 'SAFE_CHECKIN_PERFORMED') {
          showToast(`✅ Safe group arrival checked in!`);
        }
      },
      (err) => console.log('WebSocket connection info:', err)
    );

    return () => {
      try { ws.close(); } catch (e) {}
    };
  }, []);

  const showToast = (msg) => {
    setToastNotification(msg);
    setTimeout(() => setToastNotification(null), 6000);
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 flex flex-col font-sans">
      {/* Toast Notification Bar */}
      {toastNotification && (
        <div className="fixed top-16 right-4 z-50 max-w-md p-3.5 rounded-2xl bg-slate-900/95 border border-emerald-500/80 shadow-2xl shadow-emerald-950 flex items-center gap-3 animate-in slide-in-from-top-3 duration-200">
          <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Bell className="w-4 h-4 animate-bounce" />
          </div>
          <span className="text-xs font-semibold text-slate-100 flex-1">{toastNotification}</span>
          <button
            onClick={() => setToastNotification(null)}
            className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onTriggerSOS={() => setShowSOSModal(true)}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />

      {/* Sub-Header Journey Progress */}
      <div className="bg-[#0F1420] border-b border-slate-800/60 px-4 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-slate-400">Current Trip:</span>
            <span className="font-bold text-white">Chennai to Ooty 4-Friends Trip</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
              ₹48,000 Target • 4 Travelers
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="hidden sm:inline">Active User: <strong className="text-emerald-400">{currentUser?.full_name}</strong></span>
            <span>Emergency Dispatch: <strong className="text-white">112 Ready</strong></span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {activeTab === 'plan' && <CostPredictorWOA />}
        {activeTab === 'stay' && <HotelSafetyExplorer />}
        {activeTab === 'travel' && <RouteRiskMap liveGeofenceAlert={liveGeofenceAlert} />}
        {activeTab === 'protected' && (
          <SafetyNetContract tripId="trip-ooty-01" onTriggerSOS={() => setShowSOSModal(true)} />
        )}
        {activeTab === 'settle' && (
          <SplitwiseSettleUp tripId="trip-ooty-01" currentUser={currentUser} />
        )}
      </main>

      {/* SOS Modal */}
      <SOSModal
        isOpen={showSOSModal}
        onClose={() => setShowSOSModal(false)}
        currentUser={currentUser}
      />

      {/* Footer */}
      <footer className="bg-[#0F1420] border-t border-slate-800/80 px-4 lg:px-8 py-5 mt-auto text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white">SecureTour AI</span>
            <span>— The Unified Group Travel Safety & Cost Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>Whale Optimization (WOA)</span>
            <span>•</span>
            <span>ChromaDB Vector Retrieval</span>
            <span>•</span>
            <span>Splitwise Cash-Flow Graph</span>
            <span>•</span>
            <span>OSRM Open Routing</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
