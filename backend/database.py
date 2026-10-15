"""
SQLite Database schema and initialization for SecureTour AI.
Provides local zero-cost persistence with pre-seeded demo data for instant real-time usage.
"""

import sqlite3
import json
import hashlib
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta

DB_FILE = Path(__file__).parent / "data" / "securetour.db"


def hash_password(password: str) -> str:
    salt = "securetour_ai_salt_2026"
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()


def verify_password(plain_password: str, hashed: str) -> bool:
    return hash_password(plain_password) == hashed


def get_db_connection():
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users table
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
        target_budget REAL DEFAULT 45000.0,
        owner_id TEXT NOT NULL,
        status TEXT DEFAULT 'PLANNING',
        current_lat REAL,
        current_lng REAL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(owner_id) REFERENCES users(id)
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
        UNIQUE(trip_id, user_id),
        FOREIGN KEY(trip_id) REFERENCES trips(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
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
        updated_at TEXT NOT NULL,
        FOREIGN KEY(trip_id) REFERENCES trips(id)
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
        created_at TEXT NOT NULL,
        FOREIGN KEY(trip_id) REFERENCES trips(id)
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
        marked_paid_at TEXT,
        FOREIGN KEY(trip_id) REFERENCES trips(id)
    )
    """)

    conn.commit()

    # Pre-seed default users and demo trip if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        now = datetime.now(timezone.utc).isoformat()
        
        # 4 Friends
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

        # Demo Trip: Chennai to Ooty Getaway
        trip_id = "trip-ooty-01"
        cursor.execute("""
        INSERT INTO trips (id, title, source, destination, start_date, end_date, group_size, target_budget, owner_id, status, current_lat, current_lng, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            trip_id,
            "Chennai to Ooty 4-Friends Trip",
            "Chennai",
            "Ooty",
            (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
            4,
            48000.0,
            "usr-1",
            "ACTIVE_TRAVEL",
            12.0152,  # Simulated near Thoppur Ghat corridor
            78.1093,
            now
        ))

        # Add all 4 members
        members = [
            (trip_id, "usr-1", "Arun Kumar", "OWNER", now),
            (trip_id, "usr-2", "Karthik Rajan", "MEMBER", now),
            (trip_id, "usr-3", "Priya Sundaram", "MEMBER", now),
            (trip_id, "usr-4", "Divya Menon", "MEMBER", now),
        ]
        cursor.executemany("""
        INSERT INTO trip_members (trip_id, user_id, member_name, role, joined_at)
        VALUES (?, ?, ?, ?, ?)
        """, members)

        # Demo Return-Time Contract (Expected return 18:00 today or tomorrow)
        expected_return = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
        cursor.execute("""
        INSERT INTO return_contracts (trip_id, expected_return_time, is_safe_checked_in, last_check_in, last_known_lat, last_known_lng, notes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            trip_id,
            expected_return,
            0,
            None,
            12.0152,
            78.1093,
            "Reach Ooty cottage before sunset via Salem-Mettupalayam safe corridor.",
            now
        ))

        # Demo Expenses logged by friends
        all_four = json.dumps(["Arun Kumar", "Karthik Rajan", "Priya Sundaram", "Divya Menon"])
        expenses = [
            ("exp-1", trip_id, "usr-1", "Arun Kumar", "Chennai-Salem Fuel & NH-48 Fastag Tolls", 6800.0, "TRANSPORT", all_four, now),
            ("exp-2", trip_id, "usr-2", "Karthik Rajan", "Sterling Fern Hill Advance Booking (2 Rooms)", 18600.0, "STAY", all_four, now),
            ("exp-3", trip_id, "usr-3", "Priya Sundaram", "Highway Breakfast & Snacks at Ambur Star Biryani", 3200.0, "FOOD", all_four, now),
            ("exp-4", trip_id, "usr-4", "Divya Menon", "Ooty Lake Boating & Botanical Gardens Group Tickets", 2400.0, "SIGHTSEEING", all_four, now),
        ]
        cursor.executemany("""
        INSERT INTO expenses (id, trip_id, payer_id, payer_name, description, amount, category, split_members_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, expenses)

        conn.commit()

    conn.close()


# Ensure DB is created on import
init_db()
