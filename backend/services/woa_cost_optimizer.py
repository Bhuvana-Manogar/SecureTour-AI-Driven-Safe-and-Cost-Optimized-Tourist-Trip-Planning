"""
Whale Optimization Algorithm (WOA) for Trip Cost Prediction & Multi-Channel Budget Allocation.

WOA is a nature-inspired metaheuristic mimicking the bubble-net hunting behavior of humpback whales:
1. Encircling prey (exploration & exploitation)
2. Bubble-net attacking (spiral movement)
3. Search for prey (exploration with random whale)
"""

import numpy as np
from typing import Dict, List, Any, Tuple


class WhaleCostOptimizer:
    def __init__(
        self,
        population_size: int = 35,
        max_iterations: int = 60,
        random_seed: int = 42
    ):
        self.pop_size = population_size
        self.max_iter = max_iterations
        self.random_seed = random_seed
        np.random.seed(random_seed)

    def optimize_trip_cost(
        self,
        source: str,
        destination: str,
        distance_km: float,
        duration_days: int,
        group_size: int,
        target_budget: float,
        vehicle_type: str = "car"  # car, suv, tempo_traveller, bus
    ) -> Dict[str, Any]:
        """
        Uses WOA to solve the non-linear trip cost minimization & optimal resource allocation problem.
        
        Dimensions (5 Channels):
        x[0]: Transport & Fuel (mileage, tolls, mountain ghat climb penalty)
        x[1]: Stay & Accommodation (room occupancy, comfort multiplier)
        x[2]: Food & Dining (meals/day/person)
        x[3]: Sightseeing & Permits (entry tickets, boat house, hill station entry)
        x[4]: Emergency Safety Fund (essential contingency for hill station medical/breakdown)
        """
        # Defensive edge-case clamping
        group_size = max(1, min(50, int(group_size or 4)))
        duration_days = max(1, min(30, int(duration_days or 4)))
        distance_km = max(10.0, float(distance_km or 540.0))
        target_budget = max(5000.0, float(target_budget or 48000.0))

        dim = 5
        
        # Vehicle fuel efficiency and cost estimation
        fuel_rates = {
            "car": {"km_per_liter": 15.0, "toll_cost": 750, "ghat_penalty": 1.25},
            "suv": {"km_per_liter": 11.0, "toll_cost": 850, "ghat_penalty": 1.30},
            "tempo_traveller": {"km_per_liter": 8.0, "toll_cost": 1200, "ghat_penalty": 1.40},
            "bus": {"km_per_liter": 5.0, "toll_cost": 1800, "ghat_penalty": 1.50}
        }
        veh = fuel_rates.get(str(vehicle_type).lower(), fuel_rates["car"])
        fuel_price_per_liter = 103.0  # Tamil Nadu average petrol/diesel
        
        # Realistic empirical base costs
        base_fuel_liters = (distance_km * 2 / veh["km_per_liter"]) * veh["ghat_penalty"]
        min_transport = (base_fuel_liters * fuel_price_per_liter) + (veh["toll_cost"] * 2)
        
        # Minimum realistic bounds per category
        rooms_needed = max(1, int(np.ceil(group_size / 2.0)))
        min_stay = rooms_needed * duration_days * 1800.0  # safe budget hotel minimum
        min_food = group_size * duration_days * 650.0      # breakfast + lunch + dinner
        min_sightseeing = group_size * 450.0 * duration_days # garden, boat house, viewpoints
        min_safety = max(1500.0, target_budget * 0.08)    # at least 8% safety contingency
        
        lb = np.array([min_transport * 0.9, min_stay * 0.85, min_food * 0.8, min_sightseeing * 0.7, min_safety * 0.9])
        ub = np.array([min_transport * 1.6, min_stay * 3.5, min_food * 2.5, min_sightseeing * 3.0, min_safety * 3.0])
        
        # Adjust upper bounds if target_budget is generous
        if target_budget > np.sum(lb):
            scale = target_budget / np.sum(lb)
            ub = np.maximum(ub, lb * scale * 1.2)
        else:
            # Low budget condition: bounds are tight
            pass

        # Objective function to minimize:
        # Penalizes exceeding total budget, penalizes skimping on safety fund below 8%,
        # and minimizes cost variance to find balanced sweet-spot.
        def objective(x: np.ndarray) -> float:
            total_allocated = np.sum(x)
            budget_penalty = 0.0
            if total_allocated > target_budget:
                budget_penalty = (total_allocated - target_budget) ** 2 * 2.5
            elif total_allocated < target_budget * 0.70:
                # Under-allocation penalty (unrealistic lowballing)
                budget_penalty = (target_budget * 0.70 - total_allocated) ** 1.5
            
            # Safety fund constraint penalty
            safety_ratio = x[4] / (total_allocated + 1e-6)
            safety_penalty = 0.0
            if safety_ratio < 0.07:
                safety_penalty = (0.07 - safety_ratio) * 100000.0
            
            # Non-linear service utility: diminishing returns on ultra-luxury
            utility_cost = (
                (x[0] - min_transport) * 1.1 +
                (x[1] - min_stay) * 0.95 +
                (x[2] - min_food) * 0.90 +
                (x[3] - min_sightseeing) * 0.85 +
                (x[4] - min_safety) * 0.50
            )
            
            return float(total_allocated + budget_penalty + safety_penalty + utility_cost * 0.15)

        # WOA Optimization Loop
        # 1. Initialize whale population randomly within [lb, ub]
        positions = np.zeros((self.pop_size, dim))
        for j in range(dim):
            positions[:, j] = np.random.uniform(lb[j], ub[j], self.pop_size)
            
        best_whale_pos = positions[0].copy()
        best_whale_score = float("inf")
        convergence_curve: List[float] = []
        
        for l in range(self.max_iter):
            # Evaluate fitness of each whale
            for i in range(self.pop_size):
                # Boundary clipping
                positions[i] = np.clip(positions[i], lb, ub)
                score = objective(positions[i])
                if score < best_whale_score:
                    best_whale_score = score
                    best_whale_pos = positions[i].copy()
            
            convergence_curve.append(round(float(best_whale_score), 2))
            
            # Linearly decreasing parameters 'a' from 2 to 0
            a = 2.0 - l * (2.0 / self.max_iter)
            a2 = -1.0 + l * (-1.0 / self.max_iter)  # For spiral
            
            for i in range(self.pop_size):
                r1 = np.random.random()
                r2 = np.random.random()
                
                A = 2.0 * a * r1 - a
                C = 2.0 * r2
                b = 1.0
                l_param = (a2 - 1.0) * np.random.random() + 1.0
                p = np.random.random()
                
                for j in range(dim):
                    if p < 0.5:
                        if abs(A) >= 1.0:
                            # Exploration: search for prey guided by random whale
                            rand_idx = np.random.randint(0, self.pop_size)
                            x_rand = positions[rand_idx, j]
                            d_x = abs(C * x_rand - positions[i, j])
                            positions[i, j] = x_rand - A * d_x
                        else:
                            # Exploitation: encircling best whale
                            d_leader = abs(C * best_whale_pos[j] - positions[i, j])
                            positions[i, j] = best_whale_pos[j] - A * d_leader
                    else:
                        # Exploitation: bubble-net spiral movement
                        dist_to_leader = abs(best_whale_pos[j] - positions[i, j])
                        positions[i, j] = (
                            dist_to_leader * np.exp(b * l_param) * np.cos(l_param * 2.0 * np.pi) +
                            best_whale_pos[j]
                        )

        # Baseline Heuristic for comparison (standard static rules)
        baseline_transport = min_transport * 1.15
        baseline_stay = rooms_needed * duration_days * 2800.0
        baseline_food = group_size * duration_days * 900.0
        baseline_sightseeing = group_size * 700.0 * duration_days
        baseline_safety = target_budget * 0.05
        baseline_total = baseline_transport + baseline_stay + baseline_food + baseline_sightseeing + baseline_safety

        total_optimized = float(np.sum(best_whale_pos))
        cost_per_person = round(total_optimized / max(1, group_size), 2)
        budget_variance = round(target_budget - total_optimized, 2)
        
        status = "WITHIN_BUDGET" if total_optimized <= target_budget else "BUDGET_EXCEEDED"

        return {
            "source": source,
            "destination": destination,
            "distance_roundtrip_km": round(distance_km * 2, 1),
            "group_size": group_size,
            "duration_days": duration_days,
            "vehicle_type": vehicle_type,
            "target_budget": target_budget,
            "predicted_total_cost": round(total_optimized, 2),
            "cost_per_person": cost_per_person,
            "budget_status": status,
            "savings_or_deficit": budget_variance,
            "optimized_allocation": {
                "transport_and_fuel": {
                    "amount": round(float(best_whale_pos[0]), 2),
                    "percentage": round(float(best_whale_pos[0] / total_optimized * 100), 1),
                    "details": f"Fuel ({round(base_fuel_liters, 1)}L) + Tolls on NH-48/544 + Mountain Incline"
                },
                "stay_accommodation": {
                    "amount": round(float(best_whale_pos[1]), 2),
                    "percentage": round(float(best_whale_pos[1] / total_optimized * 100), 1),
                    "details": f"{rooms_needed} Rooms for {duration_days} Nights in verified safe zones"
                },
                "food_and_dining": {
                    "amount": round(float(best_whale_pos[2]), 2),
                    "percentage": round(float(best_whale_pos[2] / total_optimized * 100), 1),
                    "details": f"₹{round(best_whale_pos[2]/(group_size*duration_days), 0)}/day per person across {group_size} travelers"
                },
                "activities_sightseeing": {
                    "amount": round(float(best_whale_pos[3]), 2),
                    "percentage": round(float(best_whale_pos[3] / total_optimized * 100), 1),
                    "details": "Botanical gardens, Ooty lake boat house, Doddabetta peak entry & permits"
                },
                "emergency_safety_reserve": {
                    "amount": round(float(best_whale_pos[4]), 2),
                    "percentage": round(float(best_whale_pos[4] / total_optimized * 100), 1),
                    "details": "Protected safety reserve fund for hill station repairs, medical, or delay contingency"
                }
            },
            "comparison": {
                "baseline_heuristic_total": round(baseline_total, 2),
                "woa_optimized_total": round(total_optimized, 2),
                "woa_cost_efficiency_gain_pct": round(max(0.0, (baseline_total - total_optimized) / baseline_total * 100), 1)
            },
            "woa_convergence": {
                "iterations": len(convergence_curve),
                "initial_score": convergence_curve[0] if convergence_curve else 0,
                "final_score": convergence_curve[-1] if convergence_curve else 0,
                "sample_curve": convergence_curve[::max(1, len(convergence_curve) // 10)]
            }
        }
