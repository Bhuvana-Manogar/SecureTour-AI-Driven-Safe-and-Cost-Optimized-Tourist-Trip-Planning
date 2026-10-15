# SecureTour AI 🛡️🗺️
> **Trip Safety & Cost Intelligence Platform for Group Travel (Chennai to Ooty)**

SecureTour AI is a unified trip-planning platform for groups of friends travelling to destinations like Ooty that integrates safety telemetry and cost prediction in the same place as the hotel booking and interactive map, eliminating the need to cross-check multiple disconnected apps.

---

## 📌 The Problem It Solves

When four friends plan a trip from Chennai to Ooty today:
1. **Hotel Booking apps** only show star ratings and customer service reviews, offering zero signal about whether the approach road is an unlit isolated forest path or has broken door locks.
2. **Navigation apps** prioritize the fastest route, ignoring critical accident blackspots like the steep downhill curves of Thoppur Ghat or the 36 treacherous hairpin bends of Kalhatty Ghat.
3. **Expense splitters** force groups to manually reconcile receipts after the trip, only guessing at total costs beforehand.
4. **Safety net is fragmented:** No shared monitor exists to alert emergency contacts if the group fails to return from a mountain excursion before dark.

SecureTour AI unifies all four pillars into an automated, real-time platform.

---

## 🧠 AI Components & Core Algorithms

| Component | Function | Technique / Algorithm |
| :--- | :--- | :--- |
| **Cost Prediction & Resource Allocation** | Predicts group trip cost and divides budget across 5 channels | **Whale Optimization Algorithm (WOA)** tuning non-linear regression weights subject to hard budget and emergency safety constraints |
| **Hotel Safety Scoring** | Scores stay safety independently of commercial star ratings | **NLP Aspect-Based Sentiment & Lexical Classifier** combined with **NCRB Tamil Nadu District Crime Statistics** |
| **Route Risk & Hazard Lookup** | Detects danger zones along road corridors | **ChromaDB Vector Retrieval** + **Haversine Geographic Distance Re-ranking** |
| **Geofencing & Return Contract Sentinel** | Detects hazard perimeter breaches & missed check-ins | **Spatial Proximity Collision Engine** + **Scheduled Return-Time Countdown Job** |
| **Expense Debt Settle-Up** | Simplifies cross-debts to fewest payments | **Splitwise-Style Minimum Cash Flow Graph Simplification** (Greedy matching) |
| **Real-Time Group Sync** | Synchronizes GPS, geofence alarms, and expenses | **FastAPI WebSockets (`/ws/trip/{trip_id}`)** |

---

## 🏗️ Architecture & 100% Free Resources

```
┌─────────────────────────────────────────────────────────────┐
│                       SecureTour AI                         │
│       Frontend (Tailwind + Leaflet + OpenStreetMap)         │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / WebSockets
┌──────────────────────────────▼──────────────────────────────┐
│                    FastAPI Backend Engine                   │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │  WOA Cost Optimizer   │       │ Hotel Safety Scorer   │  │
│  └───────────────────────┘       └───────────────────────┘  │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ ChromaDB Risk Engine  │       │ Splitwise Cash Flow   │  │
│  └───────────────────────┘       └───────────────────────┘  │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │ Geofence / SOS Hub    │       │ SQLite DB + JWT Auth  │  │
│  └───────────────────────┘       └───────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Free APIs & Datasets
  ┌────────────────────────────┴───────────────────────────┐
  │ • Open Source Routing Machine (OSRM) Turn-by-Turn      │
  │ • OpenStreetMap & CartoDB Dark Tiles                   │
  │ • Tamil Nadu Police Accident Blackspots Corridor Data  │
  │ • NCRB District-Level Crime Indices (Volume I & II)    │
  │ • 1,200 Curated Hotel Safety Review Aspects            │
  └────────────────────────────────────────────────────────┘
```

1. **Free Routing:** Turn-by-turn driving polyline between Chennai and Ooty fetched via the free public **OSRM Engine** (`router.project-osrm.org`).
2. **Free Mapping:** Interactive maps rendered via **Leaflet** with **OpenStreetMap / CartoDB** dark tiles.
3. **Free Local Vector DB:** **ChromaDB** runs locally on disk with deterministic semantic hash embeddings, requiring zero cloud API keys or external downloads.
4. **Free Persistence:** Zero-cloud **SQLite** database storing users, trip collaborations, return contracts, and expenses.

---

## ⚡ Quickstart Guide

### 1. Requirements
- Python 3.10+
- Modern Web Browser (Chrome, Firefox, Edge, Safari)

### 2. Start the Application
From the project root:
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 3. Open in Browser
Navigate to:
```
http://127.0.0.1:8000
```

The application opens with pre-seeded demo data for the **Chennai to Ooty 4-Friends Trip** featuring:
- **Arun Kumar** (Trip Owner)
- **Karthik Rajan** (Member)
- **Priya Sundaram** (Member)
- **Divya Menon** (Member)

---

## 🚀 Live Features Walkthrough

### 1. Plan & WOA Cost Optimization (`#plan`)
- Enter source, destination, group size (4), duration (4 days), vehicle type, and budget (₹48,000).
- Click **Run Whale Optimization (WOA)**.
- Whales iteratively explore and encircle optimal weights:
  - Allocates Fuel + Tolls (accounting for NH-48/544 tolls and mountain incline).
  - Stay & lodging in verified safe zones.
  - Food & dining per diem.
  - Sightseeing permits (Doddabetta peak, Botanical gardens, boat house).
  - Non-negotiable **Emergency Safety Reserve Fund** enforced by penalty functions.
- Displays WOA convergence loss curve and efficiency gain vs baseline static heuristic.

### 2. Choose a Stay: Star Rating vs AI Safety (`#stay`)
- Inspect hotels across Ooty, Coonoor, and Salem.
- View the **Dual Score Card**: Commercial Star Rating (e.g., 4.1★) vs AI Safety Score (e.g., 61.2/100).
- Highlights **Divergence Alerts**: e.g. *"High Star Rating masks isolated unlit lane & broken door locks!"*
- Inspect detected safety features (*24/7 Security, Well-Lit, Electronic Card Locks*) vs red flags (*Dark Alley, Broken Lock, Theft, Unresponsive Staff*).

### 3. Travel & Route Risk Map (`#travel`)
- View the 540 km Chennai-Ooty driving corridor.
- Red and amber pins mark real Tamil Nadu accident blackspots:
  - **Thoppur Ghat S-Curve (Dharmapuri NH-44):** 28 fatalities, brake failure down-gradient curve.
  - **Kalhatty Hairpin Bends 1 to 36 (SH-67):** 19 fatalities, steep 18% slope, rollback risk.
  - **Burliar to Marappalam Ghat (NH-181):** Landslides, heavy fog, head-on overtakes.
  - **Vadaputhupatti Junction (Ambur NH-48):** Commercial truck cross-traffic.
- Click **Simulate Drive along Route** to watch the traveler car navigate in real-time.
- Entering within 3.5 km of Thoppur Ghat triggers the **Geofence Hazard Banner** with police contact numbers, nearest hospital distance, and driving instructions.

### 4. Stay Protected & Return-Time Contract (`#protected`)
- Set expected return time (e.g., 18:00).
- When the group returns, click **We're Safe: Check In Now** (triggers confetti celebration and disarms the sentinel).
- Click **Simulate Missed Return Alarm** to demonstrate the automated background sentinel: flags overdue status with last known GPS coordinates (`12.0152°N, 78.1093°E`) and a direct Google Maps link.
- Click **SOS BEACON** from any screen to generate an immediate distress beacon with 112 ERSS routing and a shareable emergency URL.

### 5. Settle Up (Splitwise Debt Minimizer) (`#settle`)
- Log trip expenses (Fuel, Hotel Booking, Meals, Sightseeing).
- View real-time net balances for Arun, Karthik, Priya, and Divya.
- The **Minimum Cash Flow Graph Algorithm** simplifies cross-debts:
  - Reduces 12 messy cross-transfers down to just **3 minimal direct payments** (75% transaction reduction).
  - Click **Mark as Paid** to settle transactions with real-time sync.

---

## 🔒 Authentication & Authorization

- **JWT Tokens:** Issued upon login / registration (`/api/auth/register`, `/api/auth/login`).
- **PBKDF2 Password Hashing:** Salted SHA-256 password protection.
- **Role Switching:** Click the profile icon in the top right navbar to switch between group members in real-time and observe collaborative state sync.
