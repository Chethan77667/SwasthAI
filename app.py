from __future__ import annotations

from datetime import datetime
import os
import json
import random
import string
from flask import Flask, jsonify, render_template, request, redirect, url_for, flash, session
import requests
import google.generativeai as genai
from dotenv import load_dotenv
from bson.objectid import ObjectId
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_bcrypt import Bcrypt
from flask_mail import Mail, Message
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

# Load environment variables from .env or env
if os.path.exists("env"):
    load_dotenv("env")
else:
    load_dotenv()


app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "dev-secret-key-123")

# Mail configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get("MAIL_USERNAME")
app.config['MAIL_PASSWORD'] = os.environ.get("MAIL_PASSWORD")
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get("MAIL_USERNAME")

bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
mail = Mail(app)

# --- MongoDB (users/auth/profile) ---
_mongo: MongoClient | None = None
_mongo_initialized = False


def _mongo_client() -> MongoClient:
    global _mongo
    if _mongo is None:
        uri = (os.getenv("MONGODB_URI") or "mongodb://localhost:27017").strip()
        _mongo = MongoClient(uri, serverSelectionTimeoutMS=3000)
    return _mongo


def _mongo_db_name() -> str:
    return (os.getenv("MONGODB_DB") or "swasthai").strip()


def _users_col():
    return _mongo_client()[_mongo_db_name()]["users"]


def _init_mongo() -> None:
    global _mongo_initialized
    if _mongo_initialized:
        return
    # ensure connection is attempted and indexes exist
    _mongo_client().admin.command("ping")
    _users_col().create_index("email", unique=True)
    _mongo_initialized = True


@app.before_request
def _ensure_mongo_ready():
    _init_mongo()


class User(UserMixin):
    def __init__(self, doc: dict):
        self._doc = doc
        self.id = str(doc["_id"])
        self.email = doc.get("email")
        self.password = doc.get("password")
        self.is_verified = bool(doc.get("is_verified", False))
        self.name = doc.get("name")
        self.blood_group = doc.get("blood_group")
        self.area = doc.get("area")
        self.age = doc.get("age")
        self.contact_no = doc.get("contact_no")
        self.is_profile_complete = bool(doc.get("is_profile_complete", False))
        self.user_type = doc.get("user_type") or "user"

    @staticmethod
    def from_email(email: str) -> "User | None":
        doc = _users_col().find_one({"email": email})
        return User(doc) if doc else None

    @staticmethod
    def from_id(user_id: str) -> "User | None":
        try:
            oid = ObjectId(user_id)
        except Exception:
            return None
        doc = _users_col().find_one({"_id": oid})
        return User(doc) if doc else None

    def refresh(self) -> None:
        doc = _users_col().find_one({"_id": ObjectId(self.id)})
        if doc:
            self.__init__(doc)

@login_manager.user_loader
def load_user(user_id):
    return User.from_id(user_id)

# Configure Gemini API
api_key = os.environ.get("GEMINI_API_KEY", "").strip()
genai.configure(api_key=api_key)
# Using model version requested by user
model = genai.GenerativeModel("gemini-2.5-flash")

SYSTEM_PROMPT = """
You are SwasthAI — an intelligent healthcare and assistance chatbot.

Your responsibilities include:
1. Answering medical questions (medicines, symptoms, diseases)
2. Helping users with platform features:
   - Finding doctors
   - Government schemes
   - Blood donor system
   - Hospital search
3. Answering general user questions (basic guidance)

LANGUAGE RULE:
- Detect user language (English, Hindi, Kannada)
- Respond FULLY in same language

RESPONSE FORMAT (STRICT JSON ONLY):
{
  "type": "medical / feature / general",
  "title": "Short heading",
  "description": "Main explanation",
  "points": ["point1", "point2", "point3"],
  "action": "What user should do next",
  "warning": "Medical disclaimer if needed, else general note"
}

LOGIC:

1. If user asks about MEDICINE / SYMPTOMS:
- type = "medical"
- Provide safe, accurate info
- Always include disclaimer

2. If user asks about PLATFORM FEATURES:
Examples:
- "find doctor"
- "blood donor"
- "schemes"
Then:
- type = "feature"
- Guide user clearly step-by-step

3. If GENERAL QUESTION:
- type = "general"
- Give helpful answer

IMPORTANT RULES:
- Keep answers short, clear, and structured
- Max 5 points
- No long paragraphs
- Always helpful and user-friendly

SPECIAL FEATURE:
If user asks:
- "find doctor near me" → suggest using doctor search
- "need blood" → guide to blood donor system
- "government help" → suggest schemes section

You are not just a chatbot.
You are a smart assistant guiding users through the entire platform.
"""


def _get_gemini_response(message: str, image_data: bytes | None = None, mime_type: str | None = None, language: str = "English") -> dict:
    try:
        lang_instruction = f"CRITICAL: You MUST answer EVERYTHING (all fields in JSON) in {language}."
        
        content = []
        if message:
            content.append(f"{SYSTEM_PROMPT}\n\n{lang_instruction}\n\nUser Message: {message}")
        else:
            content.append(f"{SYSTEM_PROMPT}\n\n{lang_instruction}")

        if image_data and mime_type:
            content.append({
                "mime_type": mime_type,
                "data": image_data
            })

        try:
            response = model.generate_content(content)
        except Exception as api_err:
            error_str = str(api_err)
            print(f"Gemini API Error: {error_str}")
            return {
                "type": "general",
                "title": "API Connection Failed",
                "description": "I couldn't connect to the AI service right now.",
                "points": [error_str[:180]],
                "action": "Please try again in a moment (and verify your GEMINI_API_KEY).",
                "warning": "This is a technical message, not medical advice."
            }
        
        # Extract JSON from the response text
        text = response.text.strip()
        # Handle cases where Gemini might wrap JSON in backticks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        
        try:
            return json.loads(text.strip())
        except Exception as json_err:
            print(f"JSON Parse Error: {json_err}\nRaw Text: {text}")
            return {
                "type": "general",
                "title": "AI Parsing Error",
                "description": "The AI returned an invalid format (not strict JSON).",
                "points": ["Try rephrasing your question", "If you uploaded an image, try again with clearer lighting"],
                "action": "Please retry.",
                "warning": "For urgent symptoms, seek medical care immediately."
            }
            
    except Exception as general_err:
        print(f"General Error: {general_err}")
        return {
            "type": "general",
            "title": "System Error",
            "description": "Something went wrong while processing your request.",
            "points": [str(general_err)[:180]],
            "action": "Please try again later.",
            "warning": "For emergencies, call local emergency services or visit the nearest hospital."
        }


@app.get("/")
@login_required
def home():
    return render_template("index.html", build_time=datetime.utcnow().isoformat() + "Z")


@app.get("/chatbot")
@login_required
def chatbot_page():
    return render_template("chatbot.html", build_time=datetime.utcnow().isoformat() + "Z")


@app.get("/hospitals")
@login_required
def hospitals_page():
    return render_template("hospitals.html", build_time=datetime.utcnow().isoformat() + "Z")


@app.get("/doctors")
@login_required
def doctors_page():
    return render_template("doctors.html", build_time=datetime.utcnow().isoformat() + "Z")


@app.get("/schemes")
@login_required
def schemes_page():
    return render_template("schemes.html", build_time=datetime.utcnow().isoformat() + "Z")

@app.route("/profile-setup", methods=["GET", "POST"])
@login_required
def profile_setup():
    if current_user.is_profile_complete:
        return redirect(url_for('home'))
        
    if request.method == "POST":
        update = {
            "name": request.form.get("name"),
            "blood_group": request.form.get("blood_group"),
            "area": request.form.get("area"),
            "age": int(request.form.get("age") or 0),
            "contact_no": request.form.get("contact_no"),
            "user_type": request.form.get("user_type", "user"),
            "is_profile_complete": True,
        }
        _users_col().update_one({"_id": ObjectId(current_user.id)}, {"$set": update})
        current_user.refresh()
        flash("Profile completed successfully!", "success")
        return redirect(url_for('home'))
        
    return render_template("profile_setup.html")

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = (request.form.get("password") or "").strip()
        if "@" not in email or "." not in email:
            flash("Please enter a valid email address", "danger")
            return redirect(url_for('signup'))
        if len(password) < 6:
            flash("Password must be at least 6 characters", "danger")
            return redirect(url_for('signup'))
        
        user_exists = User.from_email(email)
        if user_exists:
            flash("Email already registered", "danger")
            return redirect(url_for('signup'))
        
        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        # If mail isn't configured, allow dev signup without OTP.
        if not (app.config.get("MAIL_USERNAME") and app.config.get("MAIL_PASSWORD")):
            _users_col().insert_one(
                {
                    "email": email,
                    "password": hashed_pw,
                    "is_verified": True,
                    "name": None,
                    "blood_group": None,
                    "area": None,
                    "age": None,
                    "contact_no": None,
                    "is_profile_complete": False,
                    "user_type": "user",
                    "created_at": datetime.utcnow(),
                }
            )
            flash("Account created. Please login.", "success")
            return redirect(url_for('login'))

        # Store temporary data in session for OTP verification
        session['signup_data'] = {'email': email, 'password': hashed_pw}
        
        otp = "".join(random.choices(string.digits, k=6))
        session['otp'] = otp
        
        try:
            msg = Message("SwasthAI - OTP Verification", recipients=[email])
            msg.body = f"Your OTP for SwasthAI registration is: {otp}"
            mail.send(msg)
            return redirect(url_for('verify_otp'))
        except Exception as e:
            print(f"Mail Error: {e}")
            flash("Error sending OTP. Please check your credentials.", "danger")
            
    return render_template("signup.html")

@app.route("/verify-otp", methods=["GET", "POST"])
def verify_otp():
    if 'signup_data' not in session:
        return redirect(url_for('signup'))
        
    if request.method == "POST":
        user_otp = request.form.get("otp")
        if user_otp == session.get('otp'):
            data = session['signup_data']
            try:
                _users_col().insert_one(
                    {
                        "email": data["email"],
                        "password": data["password"],
                        "is_verified": True,
                        "name": None,
                        "blood_group": None,
                        "area": None,
                        "age": None,
                        "contact_no": None,
                        "is_profile_complete": False,
                        "user_type": "user",
                        "created_at": datetime.utcnow(),
                    }
                )
            except DuplicateKeyError:
                flash("Email already registered", "danger")
                return redirect(url_for('signup'))
            session.pop('otp')
            session.pop('signup_data')
            flash("Registration successful! Please login.", "success")
            return redirect(url_for('login'))
        else:
            flash("Invalid OTP", "danger")
            
    return render_template("verify_otp.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        password = (request.form.get("password") or "").strip()
        user = User.from_email(email)
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('home'))
        else:
            flash("Invalid email or password (or account not created yet)", "danger")
    return render_template("login.html")

@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
        
    if request.method == "POST":
        email = (request.form.get("email") or "").strip().lower()
        user = User.from_email(email)
        
        if not user:
            flash("No account found with that email", "danger")
            return redirect(url_for('forgot_password'))

        if not (app.config.get("MAIL_USERNAME") and app.config.get("MAIL_PASSWORD")):
            flash("Password reset OTP email is not configured on this server.", "danger")
            return redirect(url_for('forgot_password'))
            
        otp = "".join(random.choices(string.digits, k=6))
        session['forgot_otp'] = otp
        session['forgot_email'] = email
        
        try:
            msg = Message("SwasthAI - Password Reset OTP", recipients=[email])
            msg.body = f"Your OTP for logging in to SwasthAI is: {otp}"
            mail.send(msg)
            return redirect(url_for('verify_forgot_otp'))
        except Exception as e:
            print(f"Mail Error: {e}")
            flash("Error sending OTP. Please check your credentials.", "danger")
            
    return render_template("forgot_password.html")

@app.route("/verify-forgot-otp", methods=["GET", "POST"])
def verify_forgot_otp():
    if 'forgot_email' not in session:
        return redirect(url_for('forgot_password'))
        
    if request.method == "POST":
        user_otp = request.form.get("otp")
        if user_otp == session.get('forgot_otp'):
            email = session['forgot_email']
            user = User.from_email(email)
            if user:
                login_user(user)
                session.pop('forgot_otp')
                session.pop('forgot_email')
                flash("Logged in successfully!", "success")
                return redirect(url_for('home'))
        else:
            flash("Invalid OTP", "danger")
            
    return render_template("verify_forgot_otp.html")

@app.route("/logout")
def logout():
    logout_user()
    return redirect(url_for('home'))

@app.post("/update-user-type")
@login_required
def update_user_type():
    data = request.get_json()
    new_type = data.get("user_type")
    if new_type in ["user", "donor"]:
        _users_col().update_one({"_id": ObjectId(current_user.id)}, {"$set": {"user_type": new_type}})
        current_user.refresh()
        return jsonify({"success": True, "user_type": new_type})
    return jsonify({"success": False, "error": "Invalid user type"}), 400

@app.post("/api/update-profile")
@login_required
def update_profile():
    data = request.get_json()
    update = {
        "name": data.get("name"),
        "blood_group": data.get("blood_group"),
        "area": data.get("area"),
        "age": int(data.get("age") or 0),
        "contact_no": data.get("contact_no"),
        "is_profile_complete": True,
    }
    _users_col().update_one({"_id": ObjectId(current_user.id)}, {"$set": update})
    current_user.refresh()
    return jsonify({"success": True})


@app.post("/api/chat")
@login_required
def chat():
    # Handle both JSON and Form Data for image support
    if request.is_json:
        data = request.get_json(silent=True) or {}
        message = (data.get("message") or "").strip()
        language = (data.get("language") or "English").strip()
        image_file = None
    else:
        message = (request.form.get("message") or "").strip()
        language = (request.form.get("language") or "English").strip()
        image_file = request.files.get("image")

    if not message and not image_file:
        return jsonify({"error": "message or image is required"}), 400

    image_data = None
    mime_type = None
    if image_file:
        image_data = image_file.read()
        mime_type = image_file.content_type

    reply = _get_gemini_response(message, image_data, mime_type, language)
    return jsonify({"reply": reply})


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
        return jsonify({"error": "geocode failed", "details": data.get("status")}), 400

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
        return jsonify({"error": "places search failed", "details": data.get("status")}), 400

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
    with app.app_context():
        _init_mongo()
    app.run(host="0.0.0.0", port=5000, debug=True)
