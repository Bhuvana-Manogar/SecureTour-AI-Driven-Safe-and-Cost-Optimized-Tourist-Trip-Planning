"""
Hotel Safety Scoring Engine combining Review Aspect Sentiment and NCRB District Crime Metrics.
Scores safety independently of commercial star ratings.
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Any


class HotelSafetyScorer:
    def __init__(self, crime_data_path: str = None):
        if not crime_data_path:
            crime_data_path = str(Path(__file__).parent.parent / "data" / "tamil_nadu_crime_ncrb.json")
            
        with open(crime_data_path, "r", encoding="utf-8") as f:
            self.crime_data = json.load(f)["districts"]

        # Lexicons with domain weights
        self.positive_safety_signals = {
            "security guard": 15,
            "24/7 security": 18,
            "24-hour private security": 18,
            "guarded perimeter": 15,
            "cctv": 12,
            "well-lit": 14,
            "illuminated": 12,
            "safe for female": 20,
            "women travelers": 18,
            "electronic lock": 14,
            "keycard": 12,
            "safe deposit": 10,
            "doctor on call": 10,
            "medical first aid": 10,
            "gated": 12,
            "fenced": 14,
            "wildlife barrier": 15,
            "visitor logging": 12,
            "secure parking": 12,
            "disciplined": 8,
            "reputable": 8
        }

        self.negative_safety_signals = {
            "dark alley": -20,
            "unlit": -18,
            "isolated": -16,
            "broken lock": -25,
            "loose lock": -20,
            "stolen": -30,
            "theft": -30,
            "harassment": -35,
            "shady": -18,
            "drunk": -20,
            "unsafe": -20,
            "nervous": -15,
            "no streetlights": -18,
            "no night security": -22,
            "unreachable": -18,
            "unfenced": -15,
            "wildlife intrusion": -16,
            "creepy": -15
        }

    def analyze_hotel_safety(self, hotel: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates independent Hotel Safety Index (0-100), comparing it against marketing Star Rating.
        """
        district = hotel.get("district", "The Nilgiris")
        
        # Match district in crime database
        crime_info = None
        for d_key, data in self.crime_data.items():
            if d_key.lower() in district.lower() or district.lower() in d_key.lower():
                crime_info = data
                break
        
        if not crime_info:
            crime_info = self.crime_data.get("The Nilgiris", {
                "women_safety_index": 85.0,
                "night_safety_score": 80.0,
                "crime_rate_per_lakh": 200.0
            })

        # Base safety derived from district crime rates (Weight: 30%)
        # Lower crime rate -> higher score
        crime_safety_component = (
            crime_info["women_safety_index"] * 0.5 +
            crime_info["night_safety_score"] * 0.5
        )

        # Amenity safety contribution (Weight: 25%)
        amenities = [a.lower() for a in hotel.get("amenities", [])]
        amenity_score = 50.0
        if any("security" in a or "guard" in a for a in amenities):
            amenity_score += 20
        if any("cctv" in a for a in amenities):
            amenity_score += 15
        if any("safe" in a or "lock" in a for a in amenities):
            amenity_score += 10
        if any("first aid" in a or "doctor" in a or "medical" in a for a in amenities):
            amenity_score += 10
        amenity_score = min(100.0, amenity_score)

        # NLP Review Aspect Analysis (Weight: 45%)
        reviews = hotel.get("reviews", [])
        combined_text = " ".join(reviews).lower()
        
        pos_detected = []
        neg_detected = []
        review_delta = 0
        
        for phrase, weight in self.positive_safety_signals.items():
            if phrase in combined_text:
                pos_detected.append(phrase.title())
                review_delta += weight
                
        for phrase, weight in self.negative_safety_signals.items():
            if phrase in combined_text:
                neg_detected.append(phrase.title())
                review_delta += weight  # negative weight

        # Review base score starts at 70, adjusted by findings
        review_safety_component = max(10.0, min(100.0, 70.0 + review_delta))

        # Overall Weighted Safety Score
        final_safety_score = round(
            0.30 * crime_safety_component +
            0.25 * amenity_score +
            0.45 * review_safety_component,
            1
        )
        final_safety_score = max(5.0, min(99.0, final_safety_score))

        # Determine Tier
        if final_safety_score >= 88.0:
            tier = "SAFE_HAVEN"
            badge = "Shield: High Safety Sanctuary"
            color = "#10B981"  # Emerald
        elif final_safety_score >= 72.0:
            tier = "VERIFIED_SAFE"
            badge = "Verified Safe Group Stay"
            color = "#3B82F6"  # Blue
        elif final_safety_score >= 55.0:
            tier = "CAUTION_ADVISED"
            badge = "Caution: Limited Night Patrol"
            color = "#F59E0B"  # Amber
        else:
            tier = "HIGH_RISK"
            badge = "High Alert: Safety Violations Detected"
            color = "#EF4444"  # Red

        # Safety-to-Star Divergence:
        # Crucial for detecting hotels that have 4 stars due to swimming pool/view,
        # but terrible safety scores due to isolated unlit lanes or broken locks!
        star_expected_safety = hotel.get("star_rating", 3.0) * 20.0
        divergence = round(final_safety_score - star_expected_safety, 1)

        divergence_warning = None
        if divergence < -20:
            divergence_warning = f"High Star Rating ({hotel.get('star_rating')}★) masks severe safety hazards ({final_safety_score}/100)!"
        elif divergence > 15:
            divergence_warning = f"Hidden Gem: High security standard ({final_safety_score}/100) exceeds star expectations."

        return {
            "id": hotel.get("id"),
            "name": hotel.get("name"),
            "city": hotel.get("city"),
            "district": district,
            "address": hotel.get("address"),
            "price_per_night": hotel.get("price_per_night"),
            "latitude": hotel.get("latitude"),
            "longitude": hotel.get("longitude"),
            "star_rating": hotel.get("star_rating"),
            "safety_score": final_safety_score,
            "safety_tier": tier,
            "safety_badge": badge,
            "badge_color": color,
            "star_divergence": divergence,
            "divergence_warning": divergence_warning,
            "detected_safety_features": list(set(pos_detected)),
            "detected_safety_hazards": list(set(neg_detected)),
            "crime_context": {
                "district": district,
                "women_safety_index": crime_info.get("women_safety_index"),
                "night_safety_score": crime_info.get("night_safety_score"),
                "district_tourist_tier": crime_info.get("tourist_safety_tier")
            },
            "reviews_analyzed_count": len(reviews)
        }
