import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingDown, 
  ShieldCheck, 
  Fuel, 
  Home, 
  Utensils, 
  Compass, 
  AlertCircle, 
  Play, 
  CheckCircle2, 
  HelpCircle,
  BarChart3
} from 'lucide-react';
import { aiAPI } from '../api';

export default function CostPredictorWOA() {
  const [formData, setFormData] = useState({
    source: 'Chennai',
    destination: 'Ooty',
    distance_km: 540.0,
    duration_days: 4,
    group_size: 4,
    target_budget: 48000.0,
    vehicle_type: 'car'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleOptimize = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiAPI.predictCostWOA(formData);
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to execute Whale Optimization Algorithm. Please verify connection.');
    } finally {
      setLoading(false);
    }
  };

  // Run on mount
  useEffect(() => {
    handleOptimize();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white">Whale Optimization Algorithm (WOA) Cost Predictor</h2>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl">
              Eliminate guesswork before you travel. WOA metaheuristic mimics humpback whale bubble-net spirals to tune predictive regression weights and optimize channel allocations across fuel, lodging, food, and emergency reserves.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">
              5-Channel Multi-Constraint Metaheuristic
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Form & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-4 bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span>Trip Parameters</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Source</label>
              <input
                type="text"
                value={formData.source}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Destination</label>
              <input
                type="text"
                value={formData.destination}
                onChange={e => setFormData({ ...formData, destination: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">One-way Distance (km)</label>
              <input
                type="number"
                value={formData.distance_km}
                onChange={e => setFormData({ ...formData, distance_km: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Duration (Days)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.duration_days}
                onChange={e => setFormData({ ...formData, duration_days: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Group Size (Friends)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.group_size}
                onChange={e => setFormData({ ...formData, group_size: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Vehicle Type</label>
              <select
                value={formData.vehicle_type}
                onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="car">Car (15 km/L)</option>
                <option value="suv">SUV (11 km/L)</option>
                <option value="tempo_traveller">Tempo Traveller (8 km/L)</option>
                <option value="bus">Mini Bus (5 km/L)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-slate-300">Target Group Budget</label>
              <span className="text-xs font-bold text-emerald-400">₹{formData.target_budget.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="15000"
              max="150000"
              step="1000"
              value={formData.target_budget}
              onChange={e => setFormData({ ...formData, target_budget: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>

          <button
            onClick={handleOptimize}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>{loading ? 'Optimizing with WOA...' : 'Run WOA Optimization'}</span>
          </button>

          {/* Algorithm Info pill */}
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5 text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>How WOA Tunes This Trip:</span>
            </div>
            <p>1. <strong>Encircling Prey:</strong> Whales identify best allocation vectors matching budget bounds.</p>
            <p>2. <strong>Bubble-Net Spiral:</strong> Explores non-linear trade-offs between stay comfort and safety fund.</p>
            <p>3. <strong>Exploration:</strong> Random search avoids getting stuck in local suboptimal spending.</p>
          </div>
        </div>

        {/* Right Column: Optimization Output */}
        <div className="lg:col-span-8 space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <>
              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs font-medium text-slate-400">Predicted Total Cost</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-white">
                      ₹{result.predicted_total_cost.toLocaleString()}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      result.budget_status === 'WITHIN_BUDGET'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {result.budget_status === 'WITHIN_BUDGET' ? 'Within Budget' : 'Over Budget'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {result.savings_or_deficit >= 0 
                      ? `₹${result.savings_or_deficit.toLocaleString()} surplus buffer left` 
                      : `Deficit of ₹${Math.abs(result.savings_or_deficit).toLocaleString()}`}
                  </p>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs font-medium text-slate-400">Cost Per Person</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-emerald-400">
                      ₹{result.cost_per_person.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400">/ person</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Evenly split across all {result.group_size} friends
                  </p>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
                  <span className="text-xs font-medium text-slate-400">WOA Optimization Gain</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-teal-400">
                      +{result.comparison.woa_cost_efficiency_gain_pct}%
                    </span>
                    <TrendingDown className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Saves vs heuristic baseline (₹{result.comparison.baseline_heuristic_total.toLocaleString()})
                  </p>
                </div>
              </div>

              {/* 5-Channel Allocation Cards */}
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <span>WOA Optimal Channel Allocation</span>
                  </h4>
                  <span className="text-xs text-slate-400">Tuned with 30 Whales × 50 Iterations</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Transport */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Fuel className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-slate-200">Transport & Tolls</span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        ₹{result.optimized_allocation.transport_and_fuel.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full"
                        style={{ width: `${result.optimized_allocation.transport_and_fuel.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {result.optimized_allocation.transport_and_fuel.details} ({result.optimized_allocation.transport_and_fuel.percentage}%)
                    </p>
                  </div>

                  {/* Stay */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-slate-200">Stay & Accommodation</span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        ₹{result.optimized_allocation.stay_accommodation.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-400 h-full rounded-full"
                        style={{ width: `${result.optimized_allocation.stay_accommodation.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {result.optimized_allocation.stay_accommodation.details} ({result.optimized_allocation.stay_accommodation.percentage}%)
                    </p>
                  </div>

                  {/* Food */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-slate-200">Food & Dining</span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        ₹{result.optimized_allocation.food_and_dining.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full"
                        style={{ width: `${result.optimized_allocation.food_and_dining.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {result.optimized_allocation.food_and_dining.details} ({result.optimized_allocation.food_and_dining.percentage}%)
                    </p>
                  </div>

                  {/* Sightseeing */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-slate-200">Sightseeing & Permits</span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        ₹{result.optimized_allocation.activities_sightseeing.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-400 h-full rounded-full"
                        style={{ width: `${result.optimized_allocation.activities_sightseeing.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {result.optimized_allocation.activities_sightseeing.details} ({result.optimized_allocation.activities_sightseeing.percentage}%)
                    </p>
                  </div>
                </div>

                {/* Emergency Safety Fund Highlight Card */}
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold text-emerald-300">Guaranteed Emergency Safety Reserve Fund</span>
                        <p className="text-[11px] text-emerald-400/80">Protected non-negotiable safety buffer enforced by WOA penalty constraints</p>
                      </div>
                    </div>
                    <span className="text-base font-extrabold text-emerald-300">
                      ₹{result.optimized_allocation.emergency_safety_reserve.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-emerald-950 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full"
                      style={{ width: `${result.optimized_allocation.emergency_safety_reserve.percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {result.optimized_allocation.emergency_safety_reserve.details} ({result.optimized_allocation.emergency_safety_reserve.percentage}% of budget)
                  </p>
                </div>
              </div>

              {/* WOA Convergence History Graph */}
              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">Convergence Curve: Humpback Spiral Optimization</h4>
                    <p className="text-xs text-slate-400">Score minimizes as whales encircle optimal cost bounds</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-2 py-1 rounded-md border border-emerald-800">
                    Iter 50 • Final Loss: {result.woa_convergence.final_score}
                  </span>
                </div>

                <div className="h-28 flex items-end gap-1.5 pt-4 px-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  {result.woa_convergence.sample_curve.map((val, idx) => {
                    const maxVal = Math.max(...result.woa_convergence.sample_curve);
                    const minVal = Math.min(...result.woa_convergence.sample_curve);
                    const range = maxVal - minVal || 1;
                    const heightPct = Math.max(15, 100 - ((val - minVal) / range) * 80);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-sm transition-all group-hover:from-emerald-400 group-hover:to-teal-300"
                          style={{ height: `${heightPct}%` }}
                        ></div>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {idx * 5}
                        </span>
                        {/* Tooltip */}
                        <div className="absolute -top-7 hidden group-hover:block bg-slate-800 text-[10px] text-white px-1.5 py-0.5 rounded shadow z-10 whitespace-nowrap">
                          ₹{Math.round(val)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
