"""
Unified Relational SQL Database for SecureTour AI (securetour.db).
Maintains:
1. `users`: Registered traveler accounts & personal emergency contacts
2. `trips`: Group trips (e.g., Goa Beach Roadtrip, Manali Snow Expedition, Ooty Tour)
3. `trip_members`: Active travelers & co-travelers linked to each trip
4. `trip_invitations`: Real-time invitations dispatched to registered users
5. `expenses`: Splitwise expenses logged per trip
6. `settlements`: Minimized debt transfers & 1-click UPI payments per trip
7. `return_contracts`: Sentinel return contracts & autonomous watchdog check-ins

When any new user logs in or registers, their profile and personalized trip
are automatically added to this SQL database in real time.
"""

import sqlite3
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

DB_FILE = Path(__file__).parent / "data" / "securetour.db"
AUTH_DB_FILE = DB_FILE


def hash_password(password: str) -> str:
    salt = "securetour_ai_salt_2026"
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()


def verify_password(plain_password: str, hashed: str) -> bool:
    return hash_password(plain_password) == hashed


def get_db_connection() -> sqlite3.Connection:
    """Connects to the central, unified SQLite relational database."""
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


# Compatibility aliases
get_auth_db_connection = get_db_connection


def get_user_db_connection(user_id: Optional[str] = None, user_name: Optional[str] = None) -> sqlite3.Connection:
    """
    Returns the unified SQL database connection.
    Ensures that newly registered or logged-in users have their initial SQL records.
    """
    conn = get_db_connection()
    if user_id:
        ensure_user_default_trip(conn, user_id, user_name)
    return conn


def resolve_user_db_conn(user: Optional[Dict[str, Any]] = None, trip_id: Optional[str] = None) -> sqlite3.Connection:
    """Returns the unified SQL database connection for any trip or user query."""
    return get_db_connection()


def ensure_user_default_trip(conn: sqlite3.Connection, user_id: str, user_name: Optional[str] = None):
    """
    Automatically adds a default trip, members, and return contract for a newly registered/logged-in user
    if they do not already belong to any trip in the SQL database.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM trip_members WHERE user_id = ?", (user_id,))
    count = cursor.fetchone()[0]
    
    if count == 0:
        if not user_name:
            cursor.execute("SELECT full_name FROM users WHERE id = ?", (user_id,))
            u_row = cursor.fetchone()
            user_name = u_row["full_name"] if u_row else "Traveler"
            
        now = datetime.now(timezone.utc).isoformat()
        trip_id = f"trip-{user_id}"
        trip_title = f"{user_name}'s Travel Expedition"
        
        # Check if trip_id already exists
        cursor.execute("SELECT id FROM trips WHERE id = ?", (trip_id,))
        if not cursor.fetchone():
            cursor.execute("""
            INSERT INTO trips (id, title, source, destination, start_date, end_date, group_size, target_budget, owner_id, status, current_lat, current_lng, created_at)
            VALUES (?, ?, 'Chennai', 'Ooty', ?, ?, 4, 48000.0, ?, 'ACTIVE', 13.0827, 80.2707, ?)
            """, (
                trip_id,
                trip_title,
                (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
                (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
                user_id,
                now
            ))
            
            # Add user as Organizer
            cursor.execute("""
            INSERT INTO trip_members (trip_id, user_id, member_name, role, joined_at)
            VALUES (?, ?, ?, 'ORGANIZER', ?)
            """, (trip_id, user_id, user_name, now))
            
            # Default companions
            companions = ["Karthik", "Priya", "Divya"]
            for idx, comp in enumerate(companions):
                cursor.execute("""
                INSERT INTO trip_members (trip_id, user_id, member_name, role, joined_at)
                VALUES (?, ?, ?, 'MEMBER', ?)
                """, (trip_id, f"guest-{idx+1}", comp, now))
                
            members_json = json.dumps([user_name] + companions)
            
            # Starter sample expenses
            cursor.execute("""
            INSERT INTO expenses (id, trip_id, payer_id, payer_name, description, amount, category, split_members_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (f"exp-{user_id}-1", trip_id, user_id, user_name, "Resort Accommodation Booking", 16800.0, "STAY", members_json, now))
            
            cursor.execute("""
            INSERT INTO expenses (id, trip_id, payer_id, payer_name, description, amount, category, split_members_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (f"exp-{user_id}-2", trip_id, "guest-1", "Karthik", "Highway Fuel & Fastag Tolls", 7400.0, "TRANSPORT", members_json, now))
            
            # Return contract
            expected_return = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
            cursor.execute("""
            INSERT OR REPLACE INTO return_contracts (trip_id, expected_return_time, is_safe_checked_in, last_known_lat, last_known_lng, notes, updated_at)
            VALUES (?, ?, 0, 13.0827, 80.2707, ?, ?)
            """, (trip_id, expected_return, f"Group Sentinel active for {user_name}'s trip.", now))
            
            conn.commit()


def init_db():
    """Initializes the complete SQL schema and seeds initial demo users and trips."""
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users table
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

    # 2. Trips table
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

    # 3. Trip Members table
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

    # 4. Trip Invitations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trip_invitations (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL,
        trip_title TEXT NOT NULL,
        source TEXT NOT NULL,
        destination TEXT NOT NULL,
        from_user_id TEXT NOT NULL,
        from_user_name TEXT NOT NULL,
        to_user_email TEXT NOT NULL,
        to_user_id TEXT,
        to_user_name TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at TEXT NOT NULL
    )
    """)

    # 5. Expenses table
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

    # 6. Settlements table
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

    # 7. Return Contracts table
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
    conn.commit()

    # Seed demo users if empty
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

    # Ensure demo trip exists
    cursor.execute("SELECT id FROM trips WHERE id = 'trip-ooty-01'")
    if not cursor.fetchone():
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
        INSERT INTO trips (id, title, source, destination, start_date, end_date, group_size, target_budget, owner_id, status, current_lat, current_lng, created_at)
        VALUES ('trip-ooty-01', 'Chennai to Ooty 4-Friends Trip', 'Chennai', 'Ooty', '2026-10-28', '2026-11-01', 4, 48000.0, 'usr-1', 'ACTIVE', 13.0827, 80.2707, ?)
        """, (now,))
        
        members = [
            ('trip-ooty-01', 'usr-1', 'Arun Kumar', 'ORGANIZER', now),
            ('trip-ooty-01', 'usr-2', 'Karthik Rajan', 'MEMBER', now),
            ('trip-ooty-01', 'usr-3', 'Priya Sundaram', 'MEMBER', now),
            ('trip-ooty-01', 'usr-4', 'Divya Menon', 'MEMBER', now)
        ]
        cursor.executemany("""
        INSERT OR IGNORE INTO trip_members (trip_id, user_id, member_name, role, joined_at)
        VALUES (?, ?, ?, ?, ?)
        """, members)
        
        all_split = json.dumps(["Arun Kumar", "Karthik Rajan", "Priya Sundaram", "Divya Menon"])
        expenses = [
            ("exp-1", "trip-ooty-01", "usr-1", "Arun Kumar", "Chennai-Salem Fuel & NH-48 Fastag Tolls", 6800.0, "TRANSPORT", all_split, now),
            ("exp-2", "trip-ooty-01", "usr-2", "Karthik Rajan", "Sterling Fern Hill Advance Booking (2 Rooms)", 18600.0, "STAY", all_split, now),
            ("exp-3", "trip-ooty-01", "usr-3", "Priya Sundaram", "Highway Breakfast & Snacks at Ambur Star Biryani", 3200.0, "FOOD", all_split, now),
            ("exp-4", "trip-ooty-01", "usr-4", "Divya Menon", "Ooty Lake Boating & Botanical Gardens Group Tickets", 2400.0, "SIGHTSEEING", all_split, now),
        ]
        cursor.executemany("""
        INSERT OR IGNORE INTO expenses (id, trip_id, payer_id, payer_name, description, amount, category, split_members_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, expenses)
        
        expected_return = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
        cursor.execute("""
        INSERT OR REPLACE INTO return_contracts (trip_id, expected_return_time, is_safe_checked_in, last_known_lat, last_known_lng, notes, updated_at)
        VALUES ('trip-ooty-01', ?, 0, 13.0827, 80.2707, 'Group Sentinel active for Ooty trip.', ?)
        """, (expected_return, now))
        
        conn.commit()

    conn.close()


# Ensure DB is initialized on import
init_db()
