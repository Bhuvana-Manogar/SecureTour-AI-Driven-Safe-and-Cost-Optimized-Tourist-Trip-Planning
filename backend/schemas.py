"""
Pydantic Schemas for SecureTour AI.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any


# --- User Schemas ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    phone: Optional[str] = "+91 98401 00000"
    emergency_contact_name: Optional[str] = "Family Contact"
    emergency_contact_phone: Optional[str] = "+91 98400 11111"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --- Trip Schemas ---
class TripCreate(BaseModel):
    title: str = "Chennai to Ooty 4-Friends Trip"
    source: str = "Chennai"
    destination: str = "Ooty"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    group_size: int = 4
    target_budget: float = 48000.0
    member_names: Optional[List[str]] = ["Arun Kumar", "Karthik Rajan", "Priya Sundaram", "Divya Menon"]


class TripUpdateLocation(BaseModel):
    latitude: float
    longitude: float


# --- Cost Prediction & WOA ---
class CostOptimizationRequest(BaseModel):
    source: str = "Chennai"
    destination: str = "Ooty"
    distance_km: float = 540.0
    duration_days: int = 4
    group_size: int = 4
    target_budget: float = 48000.0
    vehicle_type: str = "car"


# --- Return-Time Contract & Check-In ---
class ReturnContractCreate(BaseModel):
    expected_return_time: str  # ISO string or HH:MM
    notes: Optional[str] = "Safe arrival before sunset"
    current_lat: Optional[float] = 11.4102
    current_lng: Optional[float] = 76.6958


class SafeCheckinRequest(BaseModel):
    notes: Optional[str] = "Group safely reached cottage."
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# --- Expense & Splitwise ---
class ExpenseCreate(BaseModel):
    payer_name: str
    description: str
    amount: float
    category: Optional[str] = "GENERAL"
    split_among: Optional[List[str]] = None


class MarkSettlementPaid(BaseModel):
    settlement_id: str


# --- SOS Request ---
class SOSBroadcastRequest(BaseModel):
    latitude: float
    longitude: float
    user_name: Optional[str] = "Arun Kumar"
    trip_name: Optional[str] = "Chennai to Ooty Friends Trip"
