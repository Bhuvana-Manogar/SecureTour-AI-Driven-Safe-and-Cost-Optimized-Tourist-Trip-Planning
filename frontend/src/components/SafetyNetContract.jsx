import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  Send, 
  BellRing, 
  ExternalLink, 
  Radio, 
  PhoneCall, 
  UserCheck 
} from 'lucide-react';
import { safetyAPI } from '../api';

export default function SafetyNetContract({ tripId = 'trip-ooty-01', onTriggerSOS }) {
  const [contractInfo, setContractInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [targetTime, setTargetTime] = useState('');
  const [notes, setNotes] = useState('Reach Ooty cottage before sunset.');
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    fetchContract();
    const interval = setInterval(fetchContract, 8000);
    return () => clearInterval(interval);
  }, [tripId]);

  const fetchContract = async () => {
    try {
      const res = await safetyAPI.getContract(tripId);
      setContractInfo(res.data);
      if (res.data?.contract?.expected_return_time && !targetTime) {
        const d = new Date(res.data.contract.expected_return_time);
        setTargetTime(d.toTimeString().slice(0, 5));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContract = async () => {
    try {
      const today = new Date();
      const [hours, minutes] = targetTime.split(':');
      today.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      await safetyAPI.setContract(tripId, {
        expected_return_time: today.toISOString(),
        notes: notes,
        current_lat: 11.4102,
        current_lng: 76.6958
      });
      setActionMessage('Return-time contract updated successfully!');
      fetchContract();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSafeCheckin = async () => {
    try {
      await safetyAPI.checkinSafe(tripId, {
        notes: 'Group checked in: All 4 friends reached cottage safely.',
        latitude: 11.4102,
        longitude: 76.6958
      });
      // Fire confetti celebration
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
      setActionMessage('Group Safe Check-in Verified! Contract disarmed.');
      fetchContract();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateOverdue = async () => {
    try {
      const res = await safetyAPI.simulateOverdue(tripId);
      setActionMessage('Simulated overdue alarm! Notice the emergency alert with last known GPS.');
      fetchContract();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  const evaluation = contractInfo?.evaluation;
  const isOverdue = evaluation?.contract_status === 'OVERDUE_ALERT';
  const isSafe = evaluation?.contract_status === 'SAFE_COMPLETED';

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-800/40 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">Return-Time Contract & Automated Safety Net</h2>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl">
              Solo apps don’t know when four friends are delayed in the mountains. Here, the group sets a return deadline (&quot;Back by 6 PM&quot;). If no one checks in, the server automatically raises an overdue alert with your last known GPS coordinates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-800">
              Active Server Anomaly Sentinel
            </span>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-sm flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Overdue Critical Banner */}
      {isOverdue && (
        <div className="p-5 rounded-2xl bg-red-950/90 border-2 border-red-500 text-white shadow-2xl shadow-red-950 animate-pulse">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-red-600 text-white">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-900 text-red-200 border border-red-700">
                  CRITICAL ANOMALY DETECTED
                </span>
                <h3 className="text-lg font-extrabold mt-1">
                  {evaluation.message}
                </h3>
                <p className="text-xs text-red-200 mt-1">
                  Expected Return: <strong>{new Date(evaluation.expected_return_time).toLocaleTimeString()}</strong>. 
                  Group failed to check in within safe buffer.
                </p>

                {/* Last Known Coordinates Link */}
                <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-red-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-400" />
                    <span>
                      Last Known GPS Breadcrumb: <strong>{evaluation.last_known_location?.latitude}°N, {evaluation.last_known_location?.longitude}°E</strong>
                    </span>
                  </div>
                  <a
                    href={evaluation.last_known_location?.maps_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 font-bold text-white transition-colors"
                  >
                    <span>View on Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Contract Status & Check-In */}
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              <span>Current Return-Time Contract</span>
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              isSafe 
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : isOverdue
                ? 'bg-red-950 text-red-400 border border-red-800'
                : 'bg-purple-950 text-purple-400 border border-purple-800'
            }`}>
              {isSafe ? 'SAFE CHECKED-IN' : isOverdue ? 'OVERDUE ALERT' : 'ACTIVE COUNTDOWN'}
            </span>
          </div>

          {/* Status Display Card */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-purple-500/10 text-purple-400">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold">Scheduled Group Return Target</span>
              <p className="text-3xl font-black text-white mt-0.5">
                {contractInfo?.contract?.expected_return_time 
                  ? new Date(contractInfo.contract.expected_return_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '18:00 PM'}
              </p>
            </div>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              {evaluation?.message || 'Contract in active monitoring mode.'}
            </p>

            {/* Check-in CTA Button */}
            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={handleSafeCheckin}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-950 flex items-center justify-center gap-2 transition-all transform active:scale-95"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>We&apos;re Safe: Check In Now</span>
              </button>

              <button
                onClick={handleSimulateOverdue}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                title="Test overdue failure simulation"
              >
                <Radio className="w-4 h-4 text-amber-400" />
                <span>Simulate Missed Return Alarm</span>
              </button>
            </div>
          </div>

          {/* Update Contract Form */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Adjust Return Deadline
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Return Time (Today)</label>
                <input
                  type="time"
                  value={targetTime}
                  onChange={e => setTargetTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 block mb-1">Destination / Checkpoint Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <button
              onClick={handleUpdateContract}
              className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs transition-colors"
            >
              Update Contract Target
            </button>
          </div>
        </div>

        {/* Right: Emergency SOS Dispatch Hub */}
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>SOS Emergency Broadcast</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">112 Ready</span>
          </div>

          <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/60 text-xs text-slate-300 space-y-2">
            <p className="font-semibold text-white">Single-Click Emergency Protocol:</p>
            <p>1. Transmits live GPS coordinate pin to all connected group friends.</p>
            <p>2. Prepares emergency SMS broadcast to primary family contacts.</p>
            <p>3. Direct routing to nearest Tamil Nadu Highway Police Unit & Hospital.</p>
          </div>

          {/* Huge SOS Trigger Button */}
          <button
            onClick={onTriggerSOS}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-base shadow-2xl shadow-red-950 border border-red-500/60 flex items-center justify-center gap-3 transition-all transform active:scale-95 animate-pulse"
          >
            <AlertTriangle className="w-6 h-6" />
            <span className="tracking-wider">TRIGGER EMERGENCY SOS</span>
          </button>

          {/* Fast Helplines */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Emergency Hotlines (Tamil Nadu)
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Police ERSS</span>
                <span className="font-bold text-emerald-400">112</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Ambulance</span>
                <span className="font-bold text-red-400">108</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Highway Patrol</span>
                <span className="font-bold text-amber-400">1033</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Women Helpline</span>
                <span className="font-bold text-purple-400">181</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
