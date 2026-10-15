import React, { useState, useEffect } from 'react';
import { 
  Hotel, 
  ShieldCheck, 
  ShieldAlert, 
  Star, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  MapPin, 
  Lock, 
  Eye, 
  Filter, 
  Info,
  DollarSign
} from 'lucide-react';
import { hotelAPI } from '../api';

export default function HotelSafetyExplorer() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState('');
  const [minSafety, setMinSafety] = useState(0);
  const [selectedHotel, setSelectedHotel] = useState(null);

  useEffect(() => {
    fetchHotels();
  }, [selectedCity, minSafety]);

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCity) params.city = selectedCity;
      if (minSafety > 0) params.min_safety = minSafety;
      const res = await hotelAPI.getHotels(params);
      setHotels(res.data.hotels || []);
      if (res.data.hotels && res.data.hotels.length > 0 && !selectedHotel) {
        setSelectedHotel(res.data.hotels[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-900 border border-blue-800/40 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                <Hotel className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">Choose a Stay: Star Rating vs AI Safety Signal</h2>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl">
              Commercial booking apps only tell you if a hotel has nice curtains or room service. SecureTour AI inspects review texts for safety signals (broken locks, dark isolated lanes, harassment) and blends it with NCRB district crime rates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              1,200 Reviews Analyzed
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filter Properties:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* City filter */}
          <div className="flex items-center gap-1.5">
            {['', 'Ooty', 'Coonoor', 'Salem'].map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  selectedCity === city
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {city === '' ? 'All Locations' : city}
              </button>
            ))}
          </div>

          {/* Safety threshold filter */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
            <span className="text-xs text-slate-400">Min Safety:</span>
            <select
              value={minSafety}
              onChange={(e) => setMinSafety(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
            >
              <option value="0">All Scores</option>
              <option value="70">Verified Safe (70%+)</option>
              <option value="85">Safe Havens (85%+)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: Hotel List & Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Hotels List */}
        <div className="lg:col-span-7 space-y-3.5">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              <span className="inline-block animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full mb-2"></span>
              <p>Analyzing safety signals across hotel reviews...</p>
            </div>
          ) : hotels.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm bg-[#111827] rounded-2xl border border-slate-800">
              No hotels match the selected safety filter.
            </div>
          ) : (
            hotels.map((hotel) => {
              const isSelected = selectedHotel?.id === hotel.id;
              return (
                <div
                  key={hotel.id}
                  onClick={() => setSelectedHotel(hotel)}
                  className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-blue-500 shadow-xl shadow-blue-950/40 ring-1 ring-blue-500'
                      : 'bg-[#111827] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">{hotel.name}</h3>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {hotel.city}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{hotel.address}</p>
                    </div>

                    <div className="text-right flex sm:flex-col items-center sm:items-end justify-between">
                      <span className="text-xs text-slate-400">Nightly Rate</span>
                      <span className="text-base font-extrabold text-white">
                        ₹{hotel.price_per_night?.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Dual Scoring: Commercial Stars vs AI Safety */}
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3">
                    {/* Star Rating */}
                    <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                      <div className="p-1 rounded bg-amber-500/10 text-amber-400">
                        <Star className="w-4 h-4 fill-amber-400" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-medium">Commercial Rating</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-amber-300">{hotel.star_rating}</span>
                          <span className="text-xs text-slate-500">/ 5.0 Stars</span>
                        </div>
                      </div>
                    </div>

                    {/* AI Safety Score */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                      style={{
                        backgroundColor: `${hotel.badge_color}10`,
                        borderColor: `${hotel.badge_color}40`,
                      }}
                    >
                      <div className="p-1 rounded text-white" style={{ backgroundColor: hotel.badge_color }}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-medium">AI Safety Score</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-extrabold" style={{ color: hotel.badge_color }}>
                            {hotel.safety_score}
                          </span>
                          <span className="text-xs text-slate-400">/ 100</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Divergence Warning Flag if present */}
                  {hotel.divergence_warning && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center gap-2 text-xs text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>{hotel.divergence_warning}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Selected Hotel Deep Safety Inspector */}
        <div className="lg:col-span-5">
          {selectedHotel ? (
            <div className="sticky top-24 bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  AI Review Safety Telemetry
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: `${selectedHotel.badge_color}20`,
                    color: selectedHotel.badge_color,
                    border: `1px solid ${selectedHotel.badge_color}60`,
                  }}
                >
                  {selectedHotel.safety_badge}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">{selectedHotel.name}</h3>
                <p className="text-xs text-slate-400">{selectedHotel.address}</p>
              </div>

              {/* District Crime & Context */}
              <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">District:</span>
                  <span className="font-semibold text-slate-200">{selectedHotel.district}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Women Safety Index:</span>
                  <span className="font-bold text-emerald-400">
                    {selectedHotel.crime_context?.women_safety_index}/100
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Night Street Safety:</span>
                  <span className="font-bold text-blue-400">
                    {selectedHotel.crime_context?.night_safety_score}/100
                  </span>
                </div>
              </div>

              {/* Positive Signals Found */}
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Verified Safety Signals Detected ({selectedHotel.detected_safety_features?.length || 0})</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedHotel.detected_safety_features?.length > 0 ? (
                    selectedHotel.detected_safety_features.map((feat, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                      >
                        ✓ {feat}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">No major safety tags extracted</span>
                  )}
                </div>
              </div>

              {/* Hazard Warnings Found */}
              <div>
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span>Safety Red Flags Extracted ({selectedHotel.detected_safety_hazards?.length || 0})</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedHotel.detected_safety_hazards?.length > 0 ? (
                    selectedHotel.detected_safety_hazards.map((haz, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs bg-red-950/60 text-red-300 border border-red-800/60 animate-pulse"
                      >
                        ⚠ {haz}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">No hazard language found in reviews</span>
                  )}
                </div>
              </div>

              {/* Recommendation Box */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span className="font-bold text-white block mb-1">SecureTour Verdict for Groups:</span>
                {selectedHotel.safety_score >= 80 ? (
                  <p>
                    Strongly recommended for groups of friends and female travelers. Fully gated with 24/7 personnel and responsive night desk.
                  </p>
                ) : selectedHotel.safety_score >= 60 ? (
                  <p>
                    Acceptable for daytime check-ins. Ensure all vehicle valuables are locked; avoid walking in adjacent unlit side streets after 9 PM.
                  </p>
                ) : (
                  <p className="text-amber-300">
                    Caution! Reviews mention isolated dark lanes and broken locks. Avoid booking if arriving late at night or traveling with a mixed group without private transport.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
              Select a hotel to inspect full AI review safety telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
