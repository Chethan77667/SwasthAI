from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import os
from pathlib import Path
from flask import Flask, jsonify, render_template, request
import requests
from dotenv import load_dotenv


load_dotenv(dotenv_path=Path(__file__).with_name(".env"))
app = Flask(__name__)


@dataclass(frozen=True)
class ChatReply:
    title: str
    possible_causes: list[str]
    precautions: list[str]
    seek_care_if: list[str]


def _basic_symptom_triage(message: str) -> ChatReply:
    text = (message or "").lower()
    causes: list[str] = []
    precautions: list[str] = []
    seek: list[str] = []

    # Extremely basic heuristic triage (non-diagnostic).
    if any(k in text for k in ["fever", "temperature", "high temp"]):
        causes += ["Viral infection (common cold/flu)", "Seasonal infection", "Dehydration/heat-related illness"]
        precautions += ["Drink plenty of fluids", "Rest and monitor temperature", "Use light clothing; avoid overheating"]
        seek += ["Fever > 102°F (38.9°C) lasting > 2 days", "Severe weakness, confusion, or fainting"]

    if any(k in text for k in ["headache", "migraine"]):
        causes += ["Tension headache", "Dehydration", "Sinus congestion"]
        precautions += ["Hydrate and rest eyes", "Avoid loud noise/bright screens", "Try gentle neck/shoulder stretching"]
        seek += ["Sudden 'worst headache' of life", "Headache with neck stiffness, confusion, or seizures"]

    if any(k in text for k in ["cough", "sore throat", "cold"]):
        causes += ["Upper respiratory infection", "Allergies", "Irritation from dust/smoke"]
        precautions += ["Warm fluids; gargle with warm salt water", "Avoid smoke/dust; wear a mask if needed"]
        seek += ["Breathing difficulty", "Chest pain", "Cough lasting > 2 weeks"]

    if any(k in text for k in ["chest pain", "tightness", "pressure"]):
        causes += ["Acidity/GERD (sometimes)", "Muscle strain (sometimes)"]
        precautions += ["Stop activity and sit down", "Avoid heavy meals; note triggers"]
        seek += ["Any chest pain with breathlessness, sweating, or radiating pain (urgent)"]

    if any(k in text for k in ["diarrhea", "loose motion", "vomit", "vomiting", "nausea"]):
        causes += ["Food-borne infection", "Stomach virus", "Medication side effect"]
        precautions += ["Oral rehydration solution (ORS)", "Eat light foods (rice/banana/toast)"]
        seek += ["Blood in stool/vomit", "Signs of dehydration (very dry mouth, low urine)"]

    if not causes:
        causes = ["I may need more details to help"]
        precautions = [
            "Tell me symptoms, duration, age group (child/adult/elder), and any known conditions",
            "If symptoms are severe or worsening, consult a clinician",
        ]
        seek = ["Severe pain, trouble breathing, confusion, or fainting (urgent)"]

    # De-dup while preserving order.
    def dedup(items: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for it in items:
            if it not in seen:
                seen.add(it)
                out.append(it)
        return out

    return ChatReply(
        title="Health guidance (not a diagnosis)",
        possible_causes=dedup(causes)[:6],
        precautions=dedup(precautions)[:6],
        seek_care_if=dedup(seek)[:6],
    )


@app.get("/")
def home():
    return render_template("index.html", build_time=datetime.utcnow().isoformat() + "Z")


@app.post("/api/chat")
def chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    reply = _basic_symptom_triage(message)
    return jsonify(
        {
            "reply": {
                "title": reply.title,
                "possible_causes": reply.possible_causes,
                "precautions": reply.precautions,
                "seek_care_if": reply.seek_care_if,
            }
        }
    )


@app.get("/api/doctors")
def doctors():
    # Sample data; replace with MongoDB later.
    return jsonify(
        {
            "doctors": [
                {
                    "name": "Dr. Asha Verma",
                    "specialty": "General Physician",
                    "availability": "Mon–Sat • 10:00–18:00",
                    "phone": "+91 90000 00001",
                    "mode": ["Call", "WhatsApp"],
                },
                {
                    "name": "Dr. Rohan Iyer",
                    "specialty": "Pediatrics",
                    "availability": "Mon–Fri • 09:00–15:00",
                    "phone": "+91 90000 00002",
                    "mode": ["Call"],
                },
                {
                    "name": "Dr. Meera Khan",
                    "specialty": "Gynecology",
                    "availability": "Tue–Sun • 11:00–19:00",
                    "phone": "+91 90000 00003",
                    "mode": ["Call", "WhatsApp"],
                },
            ]
        }
    )


@app.get("/api/schemes")
def schemes():
    # Sample data; replace with live/government sources later.
    return jsonify(
        {
            "schemes": [
                {
                    "title": "Ayushman Bharat (PM-JAY)",
                    "summary": "Health insurance coverage for eligible families for secondary/tertiary care hospitalization.",
                    "how_to_use": "Check eligibility and nearest empanelled hospital; carry ID and Ayushman card if available.",
                },
                {
                    "title": "Jan Aushadhi Kendras",
                    "summary": "Affordable generic medicines through dedicated stores.",
                    "how_to_use": "Ask doctor for generic prescription; locate nearby Jan Aushadhi Kendra.",
                },
                {
                    "title": "National Health Mission (NHM)",
                    "summary": "Strengthens public health services including maternal and child health programs.",
                    "how_to_use": "Visit nearest PHC/CHC; ask for immunization and maternal care services.",
                },
            ]
        }
    )


def _gmaps_key() -> str | None:
    key = (os.getenv("GOOGLE_MAPS_API_KEY") or "").strip()
    return key or None


@app.get("/api/geocode")
def geocode():
    key = _gmaps_key()
    if not key:
        return jsonify({"error": "Google Maps API key not configured"}), 501

    address = (request.args.get("address") or "").strip()
    if not address:
        return jsonify({"error": "address is required"}), 400

    r = requests.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        params={"address": address, "key": key},
        timeout=12,
    )
    data = r.json()
    if data.get("status") != "OK" or not data.get("results"):
        return (
            jsonify(
                {
                    "error": "geocode failed",
                    "details": data.get("status"),
                    "error_message": data.get("error_message"),
                }
            ),
            400,
        )

    top = data["results"][0]
    loc = top["geometry"]["location"]
    return jsonify(
        {
            "query": address,
            "formatted_address": top.get("formatted_address"),
            "location": {"lat": loc["lat"], "lng": loc["lng"]},
        }
    )


@app.get("/api/nearby_hospitals")
def nearby_hospitals():
    key = _gmaps_key()
    if not key:
        return jsonify({"error": "Google Maps API key not configured"}), 501

    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)
    radius = request.args.get("radius", default=6000, type=int)
    if lat is None or lng is None:
        return jsonify({"error": "lat and lng are required"}), 400

    radius = max(500, min(int(radius), 20000))

    r = requests.get(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        params={
            "location": f"{lat},{lng}",
            "radius": radius,
            "type": "hospital",
            "key": key,
        },
        timeout=12,
    )
    data = r.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        return (
            jsonify(
                {
                    "error": "places search failed",
                    "details": data.get("status"),
                    "error_message": data.get("error_message"),
                }
            ),
            400,
        )

    results = []
    for it in data.get("results", [])[:12]:
        gloc = (it.get("geometry") or {}).get("location") or {}
        results.append(
            {
                "name": it.get("name"),
                "address": it.get("vicinity") or it.get("formatted_address"),
                "rating": it.get("rating"),
                "user_ratings_total": it.get("user_ratings_total"),
                "open_now": ((it.get("opening_hours") or {}).get("open_now")),
                "location": {"lat": gloc.get("lat"), "lng": gloc.get("lng")},
                "place_id": it.get("place_id"),
            }
        )

    return jsonify({"center": {"lat": lat, "lng": lng}, "radius": radius, "results": results})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
