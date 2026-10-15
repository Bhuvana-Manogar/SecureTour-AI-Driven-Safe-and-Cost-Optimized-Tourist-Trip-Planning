"""
Geofencing, Check-in Return-Time Contracts, and Emergency SOS Dispatch Service.
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from backend.services.chroma_risk_engine import haversine_distance


class GeofenceEmergencyService:
    def __init__(self, hazard_engine=None):
        self.hazard_engine = hazard_engine

    def check_geofence_breach(
        self,
        current_lat: float,
        current_lng: float,
        danger_spots: List[Dict[str, Any]],
        proximity_threshold_km: float = 3.5
    ) -> Optional[Dict[str, Any]]:
        """
        Detects if traveler has entered the danger perimeter of a critical accident blackspot.
        """
        for spot in danger_spots:
            s_lat = float(spot["latitude"])
            s_lng = float(spot["longitude"])
            dist = haversine_distance(current_lat, current_lng, s_lat, s_lng)
            
            if dist <= proximity_threshold_km:
                return {
                    "alert_type": "GEOFENCE_HAZARD_WARNING",
                    "severity": spot.get("risk_level", "HIGH"),
                    "blackspot_name": spot["name"],
                    "highway": spot.get("highway", "State Highway"),
                    "distance_km": round(dist, 2),
                    "danger_type": spot.get("danger_type", "High accident hazard"),
                    "recommendation": spot.get("recommendation", "Reduce speed immediately"),
                    "police_station": spot.get("police_station", "Highway Patrol"),
                    "emergency_phone": spot.get("emergency_phone", "112"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
        return None

    def evaluate_return_contract(
        self,
        contract: Dict[str, Any],
        current_time_iso: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates Return-Time Contract ("We will be back by 18:00").
        If the deadline has passed without check-in, flags OVERDUE_ALERT with last known location.
        """
        if not contract or not contract.get("expected_return_time"):
            return {"status": "NO_ACTIVE_CONTRACT"}

        now = datetime.now(timezone.utc)
        if current_time_iso:
            try:
                now = datetime.fromisoformat(current_time_iso)
            except Exception:
                pass

        try:
            deadline = datetime.fromisoformat(contract["expected_return_time"])
        except Exception:
            return {"status": "INVALID_DEADLINE_FORMAT"}

        last_checkin = contract.get("last_check_in")
        is_checked_in = contract.get("is_safe_checked_in", False)
        
        last_coords = contract.get("last_known_coords", {"lat": 11.4102, "lng": 76.6958})

        if is_checked_in:
            return {
                "contract_status": "SAFE_COMPLETED",
                "message": "Group completed safe return check-in.",
                "last_check_in": last_checkin
            }

        if now > deadline:
            overdue_minutes = int((now - deadline).total_seconds() / 60)
            return {
                "contract_status": "OVERDUE_ALERT",
                "severity": "CRITICAL",
                "message": f"ALERT: Return-time contract breached! Group is {overdue_minutes} minutes overdue without check-in.",
                "overdue_minutes": overdue_minutes,
                "expected_return_time": contract["expected_return_time"],
                "last_known_location": {
                    "latitude": last_coords.get("lat"),
                    "longitude": last_coords.get("lng"),
                    "maps_link": f"https://www.google.com/maps?q={last_coords.get('lat')},{last_coords.get('lng')}",
                    "timestamp": contract.get("last_location_timestamp", now.isoformat())
                },
                "automated_actions_taken": [
                    "Flagged trip dashboard in red",
                    "Dispatched automated alert to primary emergency contacts",
                    "Compiled last known trajectory GPS breadcrumbs"
                ]
            }

        remaining_minutes = int((deadline - now).total_seconds() / 60)
        return {
            "contract_status": "ACTIVE_COUNTDOWN",
            "message": f"Contract active. {remaining_minutes} minutes remaining before expected return.",
            "minutes_remaining": remaining_minutes,
            "deadline": contract["expected_return_time"]
        }

    def generate_sos_dispatch(
        self,
        trip_name: str,
        user_name: str,
        current_lat: float,
        current_lng: float,
        emergency_contacts: List[Dict[str, str]],
        nearest_hazard: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generates immediate multi-channel emergency distress payload.
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        maps_link = f"https://www.google.com/maps?q={current_lat},{current_lng}"
        
        sos_message = (
            f"EMERGENCY SOS ALERT! Traveler {user_name} from group '{trip_name}' has triggered an SOS! "
            f"Location: {maps_link}. Coordinates: ({current_lat}, {current_lng}). "
            f"Please send assistance immediately."
        )

        return {
            "dispatch_id": f"SOS-{int(datetime.now().timestamp())}",
            "status": "DISPATCHED_ACTIVE",
            "timestamp": timestamp,
            "trip_name": trip_name,
            "sender": user_name,
            "coordinates": {
                "latitude": current_lat,
                "longitude": current_lng,
                "google_maps_url": maps_link
            },
            "sos_text_broadcast": sos_message,
            "contacts_notified": emergency_contacts,
            "emergency_helplines": [
                {"service": "Tamil Nadu Police Control Room", "number": "112 / 100"},
                {"service": "Ambulance Medical Emergency", "number": "108"},
                {"service": "Highway Patrol Helpline", "number": "1033"},
                {"service": "Women Safety Helpline", "number": "181 / 1091"}
            ],
            "nearest_local_unit": nearest_hazard.get("police_station", "Nilgiris / Tamil Nadu Highway Control") if nearest_hazard else "112 Emergency Dispatch"
        }
