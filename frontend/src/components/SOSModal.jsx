import React, { useState } from 'react';
import { 
  AlertTriangle, 
  PhoneCall, 
  CheckCircle2, 
  MapPin, 
  Share2, 
  ExternalLink, 
  X,
  Radio
} from 'lucide-react';
import { safetyAPI } from '../api';

export default function SOSModal({ isOpen, onClose, currentUser }) {
  const [dispatchResult, setDispatchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleConfirmSOS = async () => {
    setLoading(true);
    try {
      const res = await safetyAPI.triggerSOS({
        latitude: 12.0152, // Current simulated danger zone coords near Thoppur/Ooty
        longitude: 78.1093,
        user_name: currentUser?.full_name || 'Arun Kumar',
        trip_name: 'Chennai to Ooty 4-Friends Trip'
      });
      setDispatchResult(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyEmergencyLink = () => {
    if (dispatchResult?.coordinates?.google_maps_url) {
      navigator.clipboard.writeText(dispatchResult.coordinates.google_maps_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#111827] border-2 border-red-600 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl shadow-red-950/80 animate-in fade-in zoom-in duration-150">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-red-600 text-white animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">EMERGENCY SOS BEACON</h2>
              <p className="text-xs text-red-400 font-semibold">Tamil Nadu Emergency Response Dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!dispatchResult ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Are you or your travel companions in danger? Pressing the button below will immediately broadcast your last known GPS coordinates to all group members, notify primary emergency contacts, and log a priority beacon for 112 ERSS.
            </p>

            <div className="bg-red-950/40 border border-red-900 rounded-2xl p-4 text-xs space-y-2 text-red-200">
              <div className="flex items-center gap-2 font-bold text-red-300">
                <Radio className="w-4 h-4 text-red-400 animate-spin" />
                <span>Automated Beacon Payload includes:</span>
              </div>
              <p>• Precise GPS Coordinates: 12.0152°N, 78.1093°E</p>
              <p>• Nearest Police Unit: Thoppur / Dharmapuri Highway Police (04342-246230)</p>
              <p>• SMS Ping to: Venkatesh (Arun&apos;s Father) & Meena (Karthik&apos;s Mother)</p>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSOS}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm shadow-xl shadow-red-950 flex items-center justify-center gap-2"
              >
                {loading ? 'Transmitting Beacon...' : 'BROADCAST SOS NOW'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-emerald-300 text-sm">Distress Beacon Broadcast Active!</p>
                <p className="text-emerald-400/90">Dispatch ID: {dispatchResult.dispatch_id}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-1 font-semibold uppercase">Emergency GPS Link:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={dispatchResult.coordinates.google_maps_url}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300 font-mono text-[11px]"
                  />
                  <button
                    onClick={copyEmergencyLink}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 font-semibold uppercase">Nearest Emergency Unit:</span>
                <p className="font-bold text-white">{dispatchResult.nearest_local_unit}</p>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 font-semibold uppercase">Contacts Notified:</span>
                <div className="space-y-1">
                  {dispatchResult.contacts_notified?.map((c, i) => (
                    <div key={i} className="flex justify-between text-slate-300">
                      <span>{c.name}</span>
                      <span className="font-mono text-emerald-400">{c.phone}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Close Distress Console
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
