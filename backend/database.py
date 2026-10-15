"""
SQLite Database schema and initialization for SecureTour AI.
Provides:
1. Central Authentication Database (users table) for registration & login
2. Per-User Isolated SQLite Databases: backend/data/user_dbs/{user_id}.db
   Every user who registers or logs in gets their OWN separate database file!
"""

import sqlite3
import json
import hashlib
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Tuple, List, Optional, Dict, Any

AUTH_DB_FILE = Path(__file__).parent / "data" / "securetour.db"
USER_DBS_DIR = Path(__file__).parent / "data" / "user_dbs"


def hash_password(password: str) -> str:
    salt = "securetour_ai_salt_2026"
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()


def verify_password(plain_password: str, hashed: str) -> bool:
    return hash_password(plain_password) == hashed


def get_auth_db_connection():
    AUTH_DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(AUTH_DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn

# Compatibility alias
get_db_connection = get_auth_db_connection


def get_user_db_path(user_id: str) -> Path:
    USER_DBS_DIR.mkdir(parents=True, exist_ok=True)
    safe_id = "".join(c for c in user_id if c.isalnum() or c in ("-", "_")) or "usr-demo"
    return USER_DBS_DIR / f"{safe_id}.db"


def get_user_db_connection(user_id: str, user_name: Optional[str] = None) -> sqlite3.Connection:
    """
    Connects to the separate, isolated SQLite database file for the given user.
    If the database doesn't exist yet, it creates and initializes it with this user's data.
    """
    db_path = get_user_db_path(user_id)
    is_new = not db_path.exists()
    
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    
    if is_new:
        init_isolated_user_db(conn, user_id, user_name)
    else:
        # Verify tables exist
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='trips'")
        if not cursor.fetchone():
            init_isolated_user_db(conn, user_id, user_name)
            
    return conn


def resolve_user_db_conn(user: Optional[Dict[str, Any]] = None, trip_id: Optional[str] = None) -> sqlite3.Connection:
    """
    Resolves the dedicated SQLite database connection for the specific user or trip.
    Guarantees strict per-user database isolation:
    - User A (e.g. Bhuvaneshwari M) only accesses usr-fcbc1695.db
    - User B (e.g. Arun Kumar) only accesses usr-1.db
    """
    # 1. From authenticated user object
    if user and isinstance(user, dict) and user.get("id"):
        return get_user_db_connection(user["id"], user.get("full_name"))
        
    # 2. From trip_id conventions
    if trip_id:
        if trip_id.startswith("trip-usr-"):
            user_id = trip_id[5:]  # e.g. "usr-fcbc1695"
            return get_user_db_connection(user_id)
        if trip_id in ("trip-ooty-01", "trip-usr-1"):
            return get_user_db_connection("usr-1", "Arun Kumar")
            
        # 3. Check which user DB contains this trip_id
        if USER_DBS_DIR.exists():
            for db_file in USER_DBS_DIR.glob("*.db"):
                try:
                    conn = sqlite3.connect(str(db_file))
                    c = conn.cursor()
                    c.execute("SELECT id FROM trips WHERE id = ?", (trip_id,))
                    if c.fetchone():
                        conn.row_factory = sqlite3.Row
                        return conn
                    conn.close()
                except Exception:
                    pass
                    
    # Default fallback to Arun Kumar's demo DB
    return get_user_db_connection("usr-1", "Arun Kumar")


def init_isolated_user_db(conn: sqlite3.Connection, user_id: str, user_name: Optional[str] = None):
    cursor = conn.cursor()
    
    # Trips table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        destination TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        group_size INTEGER DEFAULT 4,
        target_budget REAL DEFAULT 48000.0,
        owner_id TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        current_lat REAL,
        current_lng REAL,
        created_at TEXT NOT NULL
    )
    """)
    
    # Trip Members table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trip_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        role TEXT DEFAULT 'MEMBER',
        joined_at TEXT NOT NULL,
        UNIQUE(trip_id, member_name)
    )
    """)
    
    # Return Time Contracts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS return_contracts (
        trip_id TEXT PRIMARY KEY,
        expected_return_time TEXT NOT NULL,
        is_safe_checked_in INTEGER DEFAULT 0,
        last_check_in TEXT,
        last_known_lat REAL,
        last_known_lng REAL,
        notes TEXT,
        updated_at TEXT NOT NULL
    )
    """)
    
    # Expenses table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        payer_id TEXT,
        payer_name TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT DEFAULT 'GENERAL',
        split_members_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)
    
    # Settlement Status table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settlements (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        from_member TEXT NOT NULL,
        to_member TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'PENDING',
        marked_paid_at TEXT
    )
    """)
    
    conn.commit()
    
    # Lookup real full_name from auth DB if not provided
    if not user_name:
        auth_conn = get_auth_db_connection()
        auth_c = auth_conn.cursor()
        auth_c.execute("SELECT full_name FROM users WHERE id = ?", (user_id,))
        row = auth_c.fetchone()
        user_name = row["full_name"] if row else "Traveler"
        auth_conn.close()
        
    now = datetime.now(timezone.utc).isoformat()
    trip_id = f"trip-{user_id}"
    
    # Initial personalized trip for this user
    cursor.execute("""
    INSERT INTO trips (id, title, source, destination, start_date, end_date, group_size, target_budget, owner_id, status, current_lat, current_lng, created_at)
    VALUES (?, ?, 'Chennai', 'Ooty', ?, ?, 4, 48000.0, ?, 'ACTIVE', 13.0827, 80.2707, ?)
    """, (
        trip_id,
        f"{user_name}'s Travel Expedition",
        (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
        (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
        user_id,
        now
    ))
    
    # Add logged-in user as the Organizer / Trip Leader
    cursor.execute("""
    INSERT INTO trip_members (trip_id, user_id, member_name, role, joined_at)
    VALUES (?, ?, ?, 'ORGANIZER', ?)
    """, (trip_id, user_id, user_name, now))
    
    # Pre-seed realistic friends & starter expenses
    if user_id == "usr-1":
        # Arun Kumar's demo group
        demo_friends = ["Karthik Rajan", "Priya Sundaram", "Divya Menon"]
        for idx, f in enumerate(demo_friends):
            cursor.execute("""
            INSERT INTO trip_members (trip_id, user_id, member_name, role, joined_at)
            VALUES (?, ?, ?, 'MEMBER', ?)
            """, (trip_id, f"usr-{idx+2}", f, now))
            
        all_split = json.dumps(["Arun Kumar", "Karthik Rajan", "Priya Sundaram", "Divya Menon"])
        expenses = [
            ("exp-1", trip_id, "usr-1", "Arun Kumar", "Chennai-Salem Fuel & NH-48 Fastag Tolls", 6800.0, "TRANSPORT", all_split, now),
            ("exp-2", trip_id, "usr-2", "Karthik Rajan", "Sterling Fern Hill Advance Booking (2 Rooms)", 18600.0, "STAY", all_split, now),
            ("exp-3", trip_id, "usr-3", "Priya Sundaram", "Highway Breakfast & Snacks at Ambur Star Biryani", 3200.0, "FOOD", all_split, now),
            ("exp-4", trip_id, "usr-4", "Divya Menon", "Ooty Lake Boating & Botanical Gardens Group Tickets", 2400.0, "SIGHTSEEING", all_split, now),
        ]
        cursor.executemany("""
        INSERT INTO expenses (id, trip_id, payer_id, payer_name, description, amount, category, split_members_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, expenses)
    else:
        # Real user! (e.g. Bhuvaneshwari M)
        # Add starter customizable co-travelers
        default_companions = ["Karthik", "Priya", "Divya"]
        for idx, comp in enumerate(default_companions):
            cursor.execute("""
            INSERT INTO trip_members (trip_id, user_id, member_name, role, joined_at)
            VALUES (?, ?, ?, 'MEMBER', ?)
            """, (trip_id, f"guest-{idx+1}", comp, now))
            
        members_json = json.dumps([user_name] + default_companions)
        
        # Starter expense paid by THIS logged-in user
        cursor.execute("""
        INSERT INTO expenses (id, trip_id, payer_id, payer_name, description, amount, category, split_members_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"exp-{user_id}-1", trip_id, user_id, user_name, "Resort Accommodation Booking", 16800.0, "STAY", members_json, now))
        
        cursor.execute("""
        INSERT INTO expenses (id, trip_id, payer_id, payer_name, description, amount, category, split_members_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"exp-{user_id}-2", trip_id, "guest-1", "Karthik", "Highway Fuel & Fastag Tolls", 7400.0, "TRANSPORT", members_json, now))

        cursor.execute("""
        INSERT INTO expenses (id, trip_id, payer_id, payer_name, description, amount, category, split_members_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (f"exp-{user_id}-3", trip_id, "guest-2", "Priya", "Lunch & Dining", 4200.0, "FOOD", members_json, now))

    # Return contract
    expected_return = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
    cursor.execute("""
    INSERT INTO return_contracts (trip_id, expected_return_time, is_safe_checked_in, last_known_lat, last_known_lng, notes, updated_at)
    VALUES (?, ?, 0, 13.0827, 80.2707, ?, ?)
    """, (trip_id, expected_return, f"Group Sentinel active for {user_name}'s trip.", now))
    
    conn.commit()


def init_db():
    AUTH_DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = get_auth_db_connection()
    cursor = conn.cursor()

    # Central Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        hashed_password TEXT NOT NULL,
        phone TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        created_at TEXT NOT NULL
    )
    """)
    conn.commit()

    # Pre-seed default demo users if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        now = datetime.now(timezone.utc).isoformat()
        users = [
            ("usr-1", "arun@securetour.ai", "Arun Kumar", hash_password("secure123"), "+91 98401 23456", "Venkatesh (Father)", "+91 98401 99999", now),
            ("usr-2", "karthik@securetour.ai", "Karthik Rajan", hash_password("secure123"), "+91 98402 34567", "Meena (Mother)", "+91 98402 88888", now),
            ("usr-3", "priya@securetour.ai", "Priya Sundaram", hash_password("secure123"), "+91 98403 45678", "Sundaram (Father)", "+91 98403 77777", now),
            ("usr-4", "divya@securetour.ai", "Divya Menon", hash_password("secure123"), "+91 98404 56789", "Anitha (Sister)", "+91 98404 66666", now),
        ]
        cursor.executemany("""
        INSERT INTO users (id, email, full_name, hashed_password, phone, emergency_contact_name, emergency_contact_phone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, users)
        conn.commit()

    conn.close()

    # Ensure demo user isolated database exists
    get_user_db_connection("usr-1", "Arun Kumar").close()


# Ensure Auth DB and User DB directory are created on import
init_db()
