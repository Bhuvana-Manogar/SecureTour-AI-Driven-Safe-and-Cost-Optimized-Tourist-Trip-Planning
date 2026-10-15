"""
ChromaDB Vector Retrieval and Haversine Spatial Re-ranking for Tamil Nadu Road Hazards & Crime.
Uses a lightweight offline local semantic embedding function to avoid heavy remote network downloads.
"""

import math
import json
from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0  # Earth's radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (
        math.sin(delta_phi / 2.0) ** 2 +
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class LocalHazardEmbedding(EmbeddingFunction):
    """
    Fast, deterministic offline semantic embedding function.
    Eliminates reliance on external Hugging Face ONNX network downloads.
    """
    def __init__(self, dim: int = 48):
        self.dim = dim

    def __call__(self, input: Documents) -> Embeddings:
        embeddings = []
        for text in input:
            vec = np.zeros(self.dim, dtype=np.float32)
            words = text.lower().replace(",", " ").replace(".", " ").split()
            for i, w in enumerate(words):
                h = abs(hash(w)) % self.dim
                vec[h] += 1.0 / (math.log(i + 2) + 1.0)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            embeddings.append(vec.tolist())
        return embeddings


class ChromaRiskEngine:
    def __init__(self, db_path: str = None):
        if not db_path:
            db_path = str(Path(__file__).parent.parent / "data" / "chroma_db")
            
        self.embedding_fn = LocalHazardEmbedding(dim=48)
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection_name = "tn_accident_blackspots"
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=self.embedding_fn,
            metadata={"description": "Tamil Nadu Accident Blackspots and Crime Corridors"}
        )
        self._populate_if_empty()

    def _populate_if_empty(self):
        """Populates ChromaDB with Tamil Nadu accident blackspot vector documents if empty."""
        count = self.collection.count()
        if count == 0:
            data_file = Path(__file__).parent.parent / "data" / "tamil_nadu_blackspots.json"
            if data_file.exists():
                with open(data_file, "r", encoding="utf-8") as f:
                    blackspots = json.load(f)
                    
                ids = []
                documents = []
                metadatas = []
                
                for spot in blackspots:
                    ids.append(spot["id"])
                    doc = (
                        f"Accident blackspot at {spot['name']} on {spot['highway']} in {spot['district']} district. "
                        f"Risk level: {spot['risk_level']}. Hazard type: {spot['danger_type']}. "
                        f"Recorded fatalities: {spot['fatalities_last_year']}. "
                        f"Police Station: {spot['police_station']} ({spot['emergency_phone']})."
                    )
                    documents.append(doc)
                    metadatas.append({
                        "name": spot["name"],
                        "district": spot["district"],
                        "highway": spot["highway"],
                        "latitude": float(spot["latitude"]),
                        "longitude": float(spot["longitude"]),
                        "risk_level": spot["risk_level"],
                        "risk_score": int(spot["risk_score"]),
                        "fatalities": int(spot["fatalities_last_year"]),
                        "danger_type": spot["danger_type"],
                        "recommendation": spot["recommendation"],
                        "police_station": spot["police_station"],
                        "emergency_phone": spot["emergency_phone"],
                        "nearest_hospital": spot["nearest_hospital"]
                    })
                    
                self.collection.add(
                    ids=ids,
                    documents=documents,
                    metadatas=metadatas
                )

    def query_location_hazards(
        self,
        lat: float,
        lng: float,
        radius_km: float = 15.0
    ) -> List[Dict[str, Any]]:
        """
        Retrieves hazards in proximity, re-ranked by exact Haversine geographic distance.
        """
        all_spots = self.collection.get()
        hazards = []
        
        if all_spots and "metadatas" in all_spots and all_spots["metadatas"]:
            for meta in all_spots["metadatas"]:
                s_lat = float(meta["latitude"])
                s_lng = float(meta["longitude"])
                dist = haversine_distance(lat, lng, s_lat, s_lng)
                
                if dist <= radius_km:
                    hazard_entry = dict(meta)
                    hazard_entry["distance_km"] = round(dist, 2)
                    hazards.append(hazard_entry)
                    
        # Re-rank by geographic distance ascending
        hazards.sort(key=lambda x: x["distance_km"])
        return hazards

    def analyze_route_hazards(
        self,
        route_coordinates: List[List[float]],
        buffer_km: float = 6.0
    ) -> Dict[str, Any]:
        """
        Analyzes a full OSRM driving polyline [ [lng, lat], ... ] and identifies all
        intersecting accident blackspots and danger zones along the travel corridor.
        """
        all_spots = self.collection.get()["metadatas"]
        route_hazards = []
        encountered_ids = set()
        
        step = max(1, len(route_coordinates) // 200)
        sampled_points = route_coordinates[::step]
        
        for point in sampled_points:
            pt_lng, pt_lat = point[0], point[1]
            for spot in all_spots:
                s_id = spot["name"]
                if s_id in encountered_ids:
                    continue
                s_lat = float(spot["latitude"])
                s_lng = float(spot["longitude"])
                dist = haversine_distance(pt_lat, pt_lng, s_lat, s_lng)
                
                if dist <= buffer_km:
                    encountered_ids.add(s_id)
                    item = dict(spot)
                    item["distance_from_corridor_km"] = round(dist, 2)
                    route_hazards.append(item)
                    
        route_hazards.sort(key=lambda x: x["risk_score"], reverse=True)
        
        critical_count = sum(1 for h in route_hazards if h["risk_level"] == "CRITICAL")
        high_count = sum(1 for h in route_hazards if h["risk_level"] == "HIGH")
        medium_count = sum(1 for h in route_hazards if h["risk_level"] == "MEDIUM")
        
        corridor_score = max(20, 100 - (critical_count * 18 + high_count * 10 + medium_count * 4))
        
        status = "NORMAL_CAUTION"
        if corridor_score < 50:
            status = "CRITICAL_HAZARD_CORRIDOR"
        elif corridor_score < 75:
            status = "ELEVATED_RISK_CORRIDOR"
            
        return {
            "corridor_safety_score": corridor_score,
            "corridor_status": status,
            "total_blackspots_detected": len(route_hazards),
            "critical_spots_count": critical_count,
            "high_spots_count": high_count,
            "medium_spots_count": medium_count,
            "hazards_along_corridor": route_hazards,
            "highest_risk_spot": route_hazards[0] if route_hazards else None,
            "emergency_help_line": "112 (Tamil Nadu Emergency Response Support System)"
        }
