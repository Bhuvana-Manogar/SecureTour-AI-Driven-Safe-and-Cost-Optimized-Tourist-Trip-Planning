"""
SecureTour AI - Backend API
Integrates:
- User Auth & Roles (JWT + PBKDF2)
- Whale Optimization Algorithm (WOA) Cost Prediction
- Hotel Safety Scoring (NLP Review Aspect Analysis + NCRB Crime Index)
- ChromaDB Vector Risk Retrieval & OSRM Real Routing
- Geofencing & Return-Time Contract Anomaly Detection
- Splitwise Debt Minimization Algorithm
- Real-time WebSockets for Group Sync & SOS Broadcast
"""

import json
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

import requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.database import get_db_connection, hash_password, verify_password
from backend.auth import create_access_token, get_current_user, get_optional_user
from backend.schemas import (
    UserRegister, UserLogin, AuthResponse, UserResponse,
    TripCreate, TripUpdateLocation, CostOptimizationRequest,
    ReturnContractCreate, SafeCheckinRequest, ExpenseCreate,
    MarkSettlementPaid, SOSBroadcastRequest
)
from backend.services.woa_cost_optimizer import WhaleCostOptimizer
from backend.services.hotel_safety_classifier import HotelSafetyScorer
from backend.services.chroma_risk_engine import ChromaRiskEngine
from backend.services.settlement_algorithm import SettlementOptimizer
from backend.services.geofence_service import GeofenceEmergencyService

app = FastAPI(
    title="SecureTour AI Engine",
    description="Intelligent Safety & Cost Trip Platform for Group Travel (Chennai - Ooty)",
    version="1.0.0"
)

# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Core Services
woa_optimizer = WhaleCostOptimizer(population_size=30, max_iterations=50)
safety_scorer = HotelSafetyScorer()
chroma_engine = ChromaRiskEngine()
geofence_service = GeofenceEmergencyService(hazard_engine=chroma_engine)


# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, trip_id: str, websocket: WebSocket):
        await websocket.accept()
        if trip_id not in self.active_connections:
            self.active_connections[trip_id] = []
        self.active_connections[trip_id].append(websocket)

    def disconnect(self, trip_id: str, websocket: WebSocket):
        if trip_id in self.active_connections:
            if websocket in self.active_connections[trip_id]:
                self.active_connections[trip_id].remove(websocket)
            if not self.active_connections[trip_id]:
                del self.active_connections[trip_id]

    async def broadcast_to_trip(self, trip_id: str, message: dict):
        if trip_id in self.active_connections:
            for connection in self.active_connections[trip_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()


# ==============================================================================
# 1. AUTHENTICATION & DEMO USERS
# ==============================================================================

@app.post("/api/auth/register", response_model=AuthResponse)
def register_user(req: UserRegister):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (req.email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email is already registered")

    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    INSERT INTO users (id, email, full_name, hashed_password, phone, emergency_contact_name, emergency_contact_phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, req.email, req.full_name, hash_password(req.password), req.phone, req.emergency_contact_name, req.emergency_contact_phone, now))
    conn.commit()
    conn.close()

    token = create_access_token({"sub": user_id, "email": req.email, "name": req.full_name})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": req.email,
            "full_name": req.full_name,
            "phone": req.phone,
            "emergency_contact_name": req.emergency_contact_name,
            "emergency_contact_phone": req.emergency_contact_phone
        }
    }


@app.post("/api/auth/login", response_model=AuthResponse)
def login_user(req: UserLogin):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, full_name, hashed_password, phone, emergency_contact_name, emergency_contact_phone FROM users WHERE email = ?", (req.email,))
    row = cursor.fetchone()
    conn.close()

    if not row or not verify_password(req.password, row["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": row["id"], "email": row["email"], "name": row["full_name"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
            "phone": row["phone"],
            "emergency_contact_name": row["emergency_contact_name"],
            "emergency_contact_phone": row["emergency_contact_phone"]
        }
    }


@app.get("/api/auth/me", response_model=UserResponse)
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    return user


@app.get("/api/auth/demo-users")
def get_demo_users():
    """Returns pre-configured demo users to test multi-user group interaction effortlessly."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, full_name, phone, emergency_contact_name, emergency_contact_phone FROM users LIMIT 10")
    rows = cursor.fetchall()
    conn.close()
    
    users_list = []
    for r in rows:
        token = create_access_token({"sub": r["id"], "email": r["email"], "name": r["full_name"]})
        users_list.append({
            "id": r["id"],
            "email": r["email"],
            "full_name": r["full_name"],
            "phone": r["phone"],
            "emergency_contact_name": r["emergency_contact_name"],
            "emergency_contact_phone": r["emergency_contact_phone"],
            "demo_token": token
        })
    return {"demo_users": users_list}


# ==============================================================================
# 2. TRIP MANAGEMENT
# ==============================================================================

@app.get("/api/trips")
def list_trips(user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT t.*, u.full_name as owner_name,
    (SELECT COUNT(*) FROM trip_members WHERE trip_id = t.id) as member_count
    FROM trips t
    JOIN users u ON t.owner_id = u.id
    ORDER BY t.created_at DESC
    """)
    rows = cursor.fetchall()
    trips = [dict(r) for r in rows]
    conn.close()
    return {"trips": trips}


@app.get("/api/trips/{trip_id}")
def get_trip_details(trip_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT t.*, u.full_name as owner_name 
    FROM trips t
    JOIN users u ON t.owner_id = u.id
    WHERE t.id = ?
    """, (trip_id,))
    trip = cursor.fetchone()
    if not trip:
        conn.close()
        raise HTTPException(status_code=404, detail="Trip not found")

    cursor.execute("SELECT * FROM trip_members WHERE trip_id = ?", (trip_id,))
    members = [dict(m) for m in cursor.fetchall()]

    cursor.execute("SELECT * FROM return_contracts WHERE trip_id = ?", (trip_id,))
    contract_row = cursor.fetchone()
    contract = dict(contract_row) if contract_row else None

    conn.close()

    # Evaluate contract status
    contract_status_eval = None
    if contract:
        contract_status_eval = geofence_service.evaluate_return_contract({
            "expected_return_time": contract["expected_return_time"],
            "is_safe_checked_in": bool(contract["is_safe_checked_in"]),
            "last_check_in": contract["last_check_in"],
            "last_known_coords": {
                "lat": contract["last_known_lat"] or trip["current_lat"] or 11.4102,
                "lng": contract["last_known_lng"] or trip["current_lng"] or 76.6958
            }
        })

    return {
        "trip": dict(trip),
        "members": members,
        "return_contract": contract,
        "contract_live_evaluation": contract_status_eval
    }


@app.post("/api/trips")
def create_trip(req: TripCreate, user: Optional[Dict[str, Any]] = Depends(get_optional_user)):
    user_id = user["id"] if user else "usr-1"
    trip_id = f"trip-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO trips (id, title, source, destination, start_date, end_date, group_size, target_budget, owner_id, status, current_lat, current_lng, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        trip_id, req.title, req.source, req.destination,
        req.start_date, req.end_date, req.group_size, req.target_budget,
        user_id, "PLANNING", 13.0827, 80.2707, now
    ))

    # Add owner and requested members
    cursor.execute("""
    INSERT INTO trip_members (trip_id, user_id, member_name, role, joined_at)
    VALUES (?, ?, ?, ?, ?)
    """, (trip_id, user_id, user["full_name"] if user else "Arun Kumar", "OWNER", now))

    if req.member_names:
        for m_name in req.member_names:
            if m_name != (user["full_name"] if user else "Arun Kumar"):
                cursor.execute("""
                INSERT INTO trip_members (trip_id, user_id, member_name, role, joined_at)
                VALUES (?, ?, ?, ?, ?)
                """, (trip_id, f"guest-{uuid.uuid4().hex[:6]}", m_name, "MEMBER", now))

    # Create default return contract 1 day ahead 18:00
    default_return = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=18, minute=0, second=0).isoformat()
    cursor.execute("""
    INSERT INTO return_contracts (trip_id, expected_return_time, is_safe_checked_in, last_known_lat, last_known_lng, notes, updated_at)
    VALUES (?, ?, 0, 13.0827, 80.2707, 'Default group return target 18:00', ?)
    """, (trip_id, default_return, now))

    conn.commit()
    conn.close()

    return {"message": "Trip created successfully", "trip_id": trip_id}


# ==============================================================================
# 3. REAL-TIME LOCATION & GEOFENCE TRIGGER
# ==============================================================================

@app.post("/api/trips/{trip_id}/location")
async def update_trip_location(trip_id: str, loc: TripUpdateLocation):
    """
    Receives live traveler coordinates, checks for geofence breach against accident blackspots,
    updates DB, and broadcasts event to WebSocket peers.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE trips SET current_lat = ?, current_lng = ? WHERE id = ?
    """, (loc.latitude, loc.longitude, trip_id))
    
    # Also update return contract last known location
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    UPDATE return_contracts SET last_known_lat = ?, last_known_lng = ?, updated_at = ? WHERE trip_id = ?
    """, (loc.latitude, loc.longitude, now, trip_id))
    conn.commit()
    conn.close()

    # Query hazards nearby
    nearby_hazards = chroma_engine.query_location_hazards(loc.latitude, loc.longitude, radius_km=15.0)
    
    # Check immediate Geofence breach within 3.5 km
    geofence_alert = geofence_service.check_geofence_breach(
        loc.latitude, loc.longitude,
        danger_spots=nearby_hazards,
        proximity_threshold_km=3.5
    )

    broadcast_data = {
        "event_type": "LOCATION_UPDATED",
        "trip_id": trip_id,
        "latitude": loc.latitude,
        "longitude": loc.longitude,
        "timestamp": now,
        "geofence_alert": geofence_alert,
        "closest_hazard": nearby_hazards[0] if nearby_hazards else None
    }

    # Broadcast in real time
    await manager.broadcast_to_trip(trip_id, broadcast_data)

    return {
        "status": "LOCATION_RECORDED",
        "geofence_alert": geofence_alert,
        "nearby_hazards": nearby_hazards
    }


# ==============================================================================
# 4. AI COST PREDICTION (WHALE OPTIMIZATION ALGORITHM)
# ==============================================================================

@app.post("/api/ai/predict-cost-woa")
def predict_cost_with_woa(req: CostOptimizationRequest):
    """
    Runs the Whale Optimization Algorithm (WOA) to predict and optimize trip budget distribution.
    """
    res = woa_optimizer.optimize_trip_cost(
        source=req.source,
        destination=req.destination,
        distance_km=req.distance_km,
        duration_days=req.duration_days,
        group_size=req.group_size,
        target_budget=req.target_budget,
        vehicle_type=req.vehicle_type
    )
    return res


# ==============================================================================
# 5. HOTEL SAFETY SCORING (NLP REVIEWS + NCRB CRIME)
# ==============================================================================

@app.get("/api/hotels")
def list_and_score_hotels(
    city: Optional[str] = Query(None, description="Filter by city e.g. Ooty, Coonoor, Salem"),
    min_safety: Optional[float] = Query(None, description="Minimum safety score out of 100")
):
    """
    Loads hotels and computes separate AI Safety Score vs Commercial Star Rating.
    Highlights divergence (e.g. high stars but unsafe location).
    """
    hotels_file = Path(__file__).parent / "data" / "hotels_ooty_tamilnadu.json"
    with open(hotels_file, "r", encoding="utf-8") as f:
        raw_hotels = json.load(f)

    scored_hotels = []
    for h in raw_hotels:
        if city and city.lower() not in h.get("city", "").lower() and city.lower() not in h.get("district", "").lower():
            continue
        scored = safety_scorer.analyze_hotel_safety(h)
        if min_safety and scored["safety_score"] < min_safety:
            continue
        scored_hotels.append(scored)

    # Sort descending by safety score
    scored_hotels.sort(key=lambda x: x["safety_score"], reverse=True)

    return {
        "total_hotels": len(scored_hotels),
        "hotels": scored_hotels,
        "benchmark_note": "Safety scores are computed using NLP keyword/aspect analysis on verified guest reviews and NCRB Tamil Nadu district crime statistics."
    }


@app.get("/api/hotels/{hotel_id}")
def get_hotel_safety_detail(hotel_id: str):
    hotels_file = Path(__file__).parent / "data" / "hotels_ooty_tamilnadu.json"
    with open(hotels_file, "r", encoding="utf-8") as f:
        raw_hotels = json.load(f)

    match = next((h for h in raw_hotels if h["id"] == hotel_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Hotel not found")

    return safety_scorer.analyze_hotel_safety(match)


# ==============================================================================
# 6. ROUTE RISK LOOKUP & CHROMADB SPATIAL RETRIEVAL
# ==============================================================================

@app.get("/api/risk/route")
def get_route_and_risk(
    start_lat: float = 13.0827,
    start_lng: float = 80.2707,
    end_lat: float = 11.4102,
    end_lng: float = 76.6958
):
    """
    Calls free Open Source Routing Machine (OSRM) for turn-by-turn route geometry
    and evaluates corridor accident blackspots from ChromaDB.
    """
    osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}?overview=full&geometries=geojson"
    
    try:
        r = requests.get(osrm_url, timeout=12)
        r.raise_for_status()
        osrm_data = r.json()
        route = osrm_data["routes"][0]
        coordinates = route["geometry"]["coordinates"]  # [[lng, lat], ...]
        distance_km = round(route["distance"] / 1000.0, 1)
        duration_hours = round(route["duration"] / 3600.0, 1)
    except Exception as e:
        # Fallback to realistic interpolated corridor if OSRM is unreachable
        coordinates = [
            [80.2707, 13.0827], [79.8250, 12.9100], [79.3780, 12.9280],
            [78.7180, 12.7845], [78.1093, 12.0152], [77.8640, 11.4820],
            [77.2680, 11.1920], [76.9450, 11.3010], [76.8150, 11.3320],
            [76.6958, 11.4102]
        ]
        distance_km = 540.0
        duration_hours = 9.5

    # Evaluate ChromaDB corridor hazards
    hazard_analysis = chroma_engine.analyze_route_hazards(coordinates, buffer_km=6.0)

    return {
        "route_summary": {
            "origin": "Chennai",
            "destination": "Ooty",
            "distance_km": distance_km,
            "estimated_drive_time_hours": duration_hours,
            "route_points_count": len(coordinates)
        },
        "corridor_hazard_analysis": hazard_analysis,
        "route_geometry": {
            "type": "LineString",
            "coordinates": coordinates
        }
    }


@app.get("/api/risk/nearby")
def get_nearby_hazards(lat: float, lng: float, radius_km: float = 20.0):
    hazards = chroma_engine.query_location_hazards(lat, lng, radius_km=radius_km)
    return {"latitude": lat, "longitude": lng, "radius_km": radius_km, "hazards": hazards}


@app.get("/api/risk/crime-stats")
def get_ncrb_crime_stats():
    crime_file = Path(__file__).parent / "data" / "tamil_nadu_crime_ncrb.json"
    with open(crime_file, "r", encoding="utf-8") as f:
        return json.load(f)


# ==============================================================================
# 7. SAFETY NET: RETURN-TIME CONTRACT & CHECK-IN
# ==============================================================================

@app.get("/api/safety/contract/{trip_id}")
def get_contract_status(trip_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM return_contracts WHERE trip_id = ?", (trip_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return {"status": "NO_CONTRACT"}

    contract_data = dict(row)
    eval_res = geofence_service.evaluate_return_contract({
        "expected_return_time": contract_data["expected_return_time"],
        "is_safe_checked_in": bool(contract_data["is_safe_checked_in"]),
        "last_check_in": contract_data["last_check_in"],
        "last_known_coords": {
            "lat": contract_data["last_known_lat"] or 11.4102,
            "lng": contract_data["last_known_lng"] or 76.6958
        }
    })

    return {
        "contract": contract_data,
        "evaluation": eval_res
    }


@app.post("/api/safety/contract/{trip_id}")
async def set_return_contract(trip_id: str, req: ReturnContractCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    INSERT INTO return_contracts (trip_id, expected_return_time, is_safe_checked_in, last_known_lat, last_known_lng, notes, updated_at)
    VALUES (?, ?, 0, ?, ?, ?, ?)
    ON CONFLICT(trip_id) DO UPDATE SET
        expected_return_time = excluded.expected_return_time,
        is_safe_checked_in = 0,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    """, (trip_id, req.expected_return_time, req.current_lat, req.current_lng, req.notes, now))
    conn.commit()
    conn.close()

    broadcast = {
        "event_type": "RETURN_CONTRACT_SET",
        "trip_id": trip_id,
        "expected_return_time": req.expected_return_time,
        "notes": req.notes,
        "timestamp": now
    }
    await manager.broadcast_to_trip(trip_id, broadcast)

    return {"message": "Return contract established", "expected_return_time": req.expected_return_time}


@app.post("/api/safety/checkin/{trip_id}")
async def perform_safe_checkin(trip_id: str, req: SafeCheckinRequest):
    """
    Group marks safe arrival. Disarms the return-time contract alarm.
    """
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE return_contracts
    SET is_safe_checked_in = 1,
        last_check_in = ?,
        notes = COALESCE(?, notes),
        updated_at = ?
    WHERE trip_id = ?
    """, (now, req.notes, now, trip_id))
    conn.commit()
    conn.close()

    broadcast = {
        "event_type": "SAFE_CHECKIN_PERFORMED",
        "trip_id": trip_id,
        "status": "SAFE",
        "notes": req.notes,
        "checkin_time": now
    }
    await manager.broadcast_to_trip(trip_id, broadcast)

    return {"message": "Safe check-in recorded successfully. Return contract disarmed.", "timestamp": now}


@app.post("/api/safety/simulate-overdue/{trip_id}")
async def simulate_overdue_alarm(trip_id: str):
    """
    Simulates a missed check-in return contract (sets expected return to 45 mins ago).
    Demonstrates the background anomaly detection with last known location flagging!
    """
    past_time = (datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat()
    now = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE return_contracts
    SET expected_return_time = ?,
        is_safe_checked_in = 0,
        updated_at = ?
    WHERE trip_id = ?
    """, (past_time, now, trip_id))
    
    cursor.execute("SELECT * FROM return_contracts WHERE trip_id = ?", (trip_id,))
    contract = dict(cursor.fetchone())
    conn.commit()
    conn.close()

    evaluation = geofence_service.evaluate_return_contract({
        "expected_return_time": contract["expected_return_time"],
        "is_safe_checked_in": False,
        "last_known_coords": {
            "lat": contract["last_known_lat"] or 12.0152,
            "lng": contract["last_known_lng"] or 78.1093
        }
    })

    broadcast = {
        "event_type": "OVERDUE_ALERT_TRIGGERED",
        "trip_id": trip_id,
        "evaluation": evaluation
    }
    await manager.broadcast_to_trip(trip_id, broadcast)

    return {"message": "Overdue contract simulated successfully", "evaluation": evaluation}


# ==============================================================================
# 8. EMERGENCY SOS BROADCAST
# ==============================================================================

@app.post("/api/safety/sos")
async def trigger_sos_broadcast(req: SOSBroadcastRequest):
    """
    Dispatches immediate distress beacon, finds nearest highway police and hospitals,
    and broadcasts to all connected group peers via WebSocket.
    """
    nearby = chroma_engine.query_location_hazards(req.latitude, req.longitude, radius_km=25.0)
    nearest_spot = nearby[0] if nearby else None

    # Fetch emergency contacts for demo trip
    contacts = [
        {"name": "Venkatesh (Arun's Father)", "phone": "+91 98401 99999"},
        {"name": "Meena (Karthik's Mother)", "phone": "+91 98402 88888"},
        {"name": "Tamil Nadu ERSS State Control Room", "phone": "112"}
    ]

    dispatch = geofence_service.generate_sos_dispatch(
        trip_name=req.trip_name,
        user_name=req.user_name,
        current_lat=req.latitude,
        current_lng=req.longitude,
        emergency_contacts=contacts,
        nearest_hazard=nearest_spot
    )

    # Broadcast to all peers in active trip
    trip_id = "trip-ooty-01"
    await manager.broadcast_to_trip(trip_id, {
        "event_type": "EMERGENCY_SOS_TRIGGERED",
        "dispatch": dispatch
    })

    return dispatch


# ==============================================================================
# 9. SPLITWISE EXPENSE TRACKING & DEBT MINIMIZATION
# ==============================================================================

@app.get("/api/expenses/{trip_id}")
def get_trip_expenses(trip_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get members
    cursor.execute("SELECT member_name FROM trip_members WHERE trip_id = ?", (trip_id,))
    members = [r["member_name"] for r in cursor.fetchall()]
    if not members:
        members = ["Arun Kumar", "Karthik Rajan", "Priya Sundaram", "Divya Menon"]

    # Get expenses
    cursor.execute("SELECT * FROM expenses WHERE trip_id = ? ORDER BY created_at DESC", (trip_id,))
    expense_rows = cursor.fetchall()
    
    expenses = []
    for r in expense_rows:
        item = dict(r)
        item["split_among"] = json.loads(item["split_members_json"])
        expenses.append(item)

    # Calculate optimal settlement
    settlement_report = SettlementOptimizer.minimize_cash_flow(members, expenses)

    # Get paid statuses from settlements table
    cursor.execute("SELECT * FROM settlements WHERE trip_id = ?", (trip_id,))
    paid_map = {f"{r['from_member']}->{r['to_member']}": r["status"] for r in cursor.fetchall()}

    for txn in settlement_report["minimized_settlements"]:
        key = f"{txn['from_member']}->{txn['to_member']}"
        txn["status"] = paid_map.get(key, "PENDING")

    conn.close()

    return {
        "members": members,
        "expenses": expenses,
        "settlement_report": settlement_report
    }


@app.post("/api/expenses/{trip_id}")
async def add_expense(trip_id: str, exp: ExpenseCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get members if split_among not provided
    cursor.execute("SELECT member_name FROM trip_members WHERE trip_id = ?", (trip_id,))
    all_members = [r["member_name"] for r in cursor.fetchall()]
    split_members = exp.split_among if exp.split_among else all_members

    expense_id = f"exp-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
    INSERT INTO expenses (id, trip_id, payer_id, payer_name, description, amount, category, split_members_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        expense_id, trip_id, "usr-demo", exp.payer_name, exp.description,
        exp.amount, exp.category, json.dumps(split_members), now
    ))
    conn.commit()
    conn.close()

    broadcast = {
        "event_type": "EXPENSE_ADDED",
        "trip_id": trip_id,
        "expense": {
            "id": expense_id,
            "payer_name": exp.payer_name,
            "description": exp.description,
            "amount": exp.amount,
            "category": exp.category,
            "split_among": split_members,
            "created_at": now
        }
    }
    await manager.broadcast_to_trip(trip_id, broadcast)

    return {"message": "Expense added successfully", "expense_id": expense_id}


@app.post("/api/expenses/{trip_id}/mark-paid")
async def mark_settlement_paid(trip_id: str, payload: Dict[str, Any]):
    from_member = payload.get("from_member")
    to_member = payload.get("to_member")
    amount = payload.get("amount", 0.0)
    status_str = payload.get("status", "PAID")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    settlement_id = f"stl-{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
    INSERT INTO settlements (id, trip_id, from_member, to_member, amount, status, marked_paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
    """, (settlement_id, trip_id, from_member, to_member, amount, status_str, now))
    conn.commit()
    conn.close()

    broadcast = {
        "event_type": "SETTLEMENT_MARKED_PAID",
        "trip_id": trip_id,
        "from_member": from_member,
        "to_member": to_member,
        "amount": amount,
        "status": status_str,
        "marked_at": now
    }
    await manager.broadcast_to_trip(trip_id, broadcast)

    return {"message": f"Settlement of ₹{amount} marked as {status_str}"}


# ==============================================================================
# 10. WEBSOCKET REAL-TIME ENDPOINT
# ==============================================================================

@app.websocket("/ws/trip/{trip_id}")
async def trip_websocket_endpoint(websocket: WebSocket, trip_id: str):
    await manager.connect(trip_id, websocket)
    try:
        # Welcome message
        await websocket.send_json({
            "event_type": "WS_CONNECTED",
            "trip_id": trip_id,
            "message": f"Connected to SecureTour AI real-time radar for trip {trip_id}"
        })
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                # Echo or handle incoming client events
                event_type = payload.get("type", "PING")
                if event_type == "PING":
                    await websocket.send_json({"type": "PONG", "time": datetime.now(timezone.utc).isoformat()})
                else:
                    await manager.broadcast_to_trip(trip_id, payload)
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(trip_id, websocket)


# Mount frontend static files
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    @app.get("/")
    def serve_frontend():
        return FileResponse(str(static_dir / "index.html"))

