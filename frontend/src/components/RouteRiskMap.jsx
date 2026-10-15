import React, { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Polyline, 
  Marker, 
  Popup, 
  Circle 
} from 'react-leaflet';
import L from 'leaflet';
import { 
  Compass, 
  ShieldAlert, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw, 
  Navigation, 
  PhoneCall, 
  Activity,
  Layers,
  MapPin
} from 'lucide-react';
import { riskAPI, tripAPI } from '../api';

// Custom icons using Lucide SVG data URIs
const createCarIcon = () => {
  return L.divIcon({
    className: 'custom-car-icon',
    html: `
      <div style="background: #10B981; border: 2px solid white; border-radius: 50%; width: 32px; height: 32px; display: flex; items-align: center; justify-content: center; box-shadow: 0 0 15px rgba(16, 185, 129, 0.8);">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 5px; margin-left: 5px;"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const createHazardIcon = (riskLevel) => {
  const bg = riskLevel === 'CRITICAL' ? '#EF4444' : riskLevel === 'HIGH' ? '#F97316' : '#F59E0B';
  return L.divIcon({
    className: 'custom-hazard-icon',
    html: `
      <div style="background: ${bg}; border: 2px solid #111827; border-radius: 50%; width: 26px; height: 26px; display: flex; items-align: center; justify-content: center; box-shadow: 0 0 10px ${bg};">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 4px; margin-left: 4px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13]
  });
};

export default function RouteRiskMap({ liveGeofenceAlert }) {
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentCoord, setCurrentCoord] = useState([13.0827, 80.2707]); // Default Chennai
  const [simulating, setSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const [activeAlert, setActiveAlert] = useState(null);
  const simIntervalRef = useRef(null);

  useEffect(() => {
    fetchRoute();
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  // Update alert if incoming from WebSocket
  useEffect(() => {
    if (liveGeofenceAlert) {
      setActiveAlert(liveGeofenceAlert);
    }
  }, [liveGeofenceAlert]);

  const fetchRoute = async () => {
    setLoading(true);
    try {
      const res = await riskAPI.getRouteAndRisk();
      setRouteData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Convert GeoJSON [[lng, lat], ...] to Leaflet [[lat, lng], ...]
  const polylineCoords = routeData?.route_geometry?.coordinates
    ? routeData.route_geometry.coordinates.map(pt => [pt[1], pt[0]])
    : [];

  // Toggle simulated drive along Chennai-Ooty
  const toggleSimulation = () => {
    if (simulating) {
      clearInterval(simIntervalRef.current);
      setSimulating(false);
    } else {
      if (!polylineCoords.length) return;
      setSimulating(true);

      simIntervalRef.current = setInterval(() => {
        setSimIndex(prev => {
          // Jump ahead 60 points per tick so the full 540km trip runs in ~40 seconds
          const next = prev + 60;
          if (next >= polylineCoords.length) {
            clearInterval(simIntervalRef.current);
            setSimulating(false);
            return 0;
          }
          const pt = polylineCoords[next];
          setCurrentCoord(pt);

          // Update backend location in real-time
          tripAPI.updateLocation('trip-ooty-01', {
            latitude: pt[0],
            longitude: pt[1]
          }).then(res => {
            if (res.data?.geofence_alert) {
              setActiveAlert(res.data.geofence_alert);
            }
          }).catch(e => console.warn(e));

          return next;
        });
      }, 500);
    }
  };

  const resetSimulation = () => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    setSimulating(false);
    setSimIndex(0);
    if (polylineCoords.length > 0) {
      setCurrentCoord(polylineCoords[0]);
    }
    setActiveAlert(null);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900 border border-teal-800/40 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">
                <Compass className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">Route Risk & ChromaDB Hazard Retrieval</h2>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl">
              Unlike ordinary maps that choose only the fastest highway, SecureTour AI samples the turn-by-turn geometry with ChromaDB to locate Tamil Nadu accident blackspots and hazardous mountain descent hairpins in real time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-teal-300 border border-teal-800/50">
              540 km Corridor • NH-48 / 544 / 181
            </span>
          </div>
        </div>
      </div>

      {/* Active Geofence Alert Banner */}
      {activeAlert && (
        <div className="bg-red-950/80 border-2 border-red-500 rounded-2xl p-4 shadow-2xl shadow-red-950 animate-bounce">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-600 text-white flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-widest text-red-400 uppercase">
                    GEOFENCE DANGER PERIMETER BREACH
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-900 text-white">
                    {activeAlert.distance_km} km away
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-white mt-0.5">
                  Caution: Approaching {activeAlert.blackspot_name} ({activeAlert.highway})
                </h4>
                <p className="text-xs text-red-200 mt-1 font-medium">
                  {activeAlert.danger_type}. {activeAlert.recommendation}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-red-300">
                  <span className="flex items-center gap-1 font-semibold">
                    <PhoneCall className="w-3.5 h-3.5" />
                    Police Station: {activeAlert.police_station} ({activeAlert.emergency_phone})
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveAlert(null)}
              className="text-xs text-red-400 hover:text-white px-2 py-1 rounded bg-red-900/50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSimulation}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
              simulating
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
            }`}
          >
            {simulating ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            <span>{simulating ? 'Pause Simulated Drive' : 'Simulate Drive to Ooty'}</span>
          </button>

          <button
            onClick={resetSimulation}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Reset traveler position to Chennai"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 pl-3 border-l border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Current: <strong>{currentCoord[0].toFixed(3)}°N, {currentCoord[1].toFixed(3)}°E</strong></span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500"></span>
            <span className="text-slate-300">Critical Hazard (Thoppur / Kalhatty)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-slate-300">Moderate Risk</span>
          </div>
        </div>
      </div>

      {/* Main Leaflet Map View */}
      <div className="relative h-[540px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        {loading ? (
          <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
            <span className="inline-block animate-spin w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full mr-2"></span>
            Loading turn-by-turn route geometry & ChromaDB hazard index...
          </div>
        ) : (
          <MapContainer
            center={[12.2, 78.4]}
            zoom={8}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            {/* OpenStreetMap Dark CartoDB Tiles (100% Free & Open) */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {/* Turn-by-Turn Driving Route Polyline */}
            {polylineCoords.length > 0 && (
              <Polyline
                positions={polylineCoords}
                pathOptions={{
                  color: '#10B981',
                  weight: 5,
                  opacity: 0.85,
                  dashArray: '8, 8'
                }}
              />
            )}

            {/* Dynamic Traveler Car Marker */}
            <Marker position={currentCoord} icon={createCarIcon()}>
              <Popup className="custom-popup">
                <div className="text-slate-900 text-xs p-1">
                  <strong className="text-emerald-700 block">Traveler Group (4 Friends)</strong>
                  <span>Lat: {currentCoord[0].toFixed(4)}, Lng: {currentCoord[1].toFixed(4)}</span>
                </div>
              </Popup>
            </Marker>

            {/* Geofence Detection Ring around Current Location */}
            <Circle
              center={currentCoord}
              radius={3500}
              pathOptions={{
                color: '#10B981',
                fillColor: '#10B981',
                fillOpacity: 0.12,
                weight: 1.5
              }}
            />

            {/* Accident Blackspots from ChromaDB */}
            {routeData?.corridor_hazard_analysis?.hazards_along_corridor?.map((spot, idx) => {
              const spotLat = spot.latitude;
              const spotLng = spot.longitude;
              const isCritical = spot.risk_level === 'CRITICAL';

              return (
                <React.Fragment key={idx}>
                  <Marker
                    position={[spotLat, spotLng]}
                    icon={createHazardIcon(spot.risk_level)}
                  >
                    <Popup>
                      <div className="text-slate-900 text-xs p-1 max-w-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-red-700 font-bold">{spot.name}</strong>
                          <span className="font-bold text-[10px] px-1.5 py-0.2 rounded bg-red-100 text-red-800">
                            {spot.risk_level}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700">{spot.danger_type}</p>
                        <p className="text-[11px] font-semibold text-slate-800">
                          Recommendation: {spot.recommendation}
                        </p>
                        <div className="pt-1 border-t text-[10px] text-slate-600">
                          Police: {spot.police_station} • {spot.emergency_phone}
                        </div>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Red Geofence Danger Zone around critical blackspots */}
                  {isCritical && (
                    <Circle
                      center={[spotLat, spotLng]}
                      radius={4500}
                      pathOptions={{
                        color: '#EF4444',
                        fillColor: '#EF4444',
                        fillOpacity: 0.18,
                        weight: 2,
                        dashArray: '6, 6'
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </MapContainer>
        )}
      </div>

      {/* Corridor Analysis Cards */}
      {routeData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">Corridor Safety Score</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-teal-400">
                {routeData.corridor_hazard_analysis.corridor_safety_score}/100
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-teal-950 text-teal-300 font-bold border border-teal-800">
                {routeData.corridor_hazard_analysis.corridor_status}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              ChromaDB surveyed {routeData.route_summary.route_points_count} route points
            </p>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">High Danger Zones Identified</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-red-400">
                {routeData.corridor_hazard_analysis.critical_spots_count}
              </span>
              <span className="text-xs text-slate-400">Critical Blackspots</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Thoppur Ghat S-Curve & Kalhatty Hairpin Bends
            </p>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">Drive Metrics</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white">
                {routeData.route_summary.distance_km} km
              </span>
              <span className="text-xs text-slate-400">~{routeData.route_summary.estimated_drive_time_hours} hrs</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Via NH-48, NH-544, and NH-181 hill ghats
            </p>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400">Emergency Dispatch Patrol</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-400">
                112 / 1033
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Tamil Nadu ERSS State Control Room active
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
