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
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_bcrypt import Bcrypt
from flask_mail import Mail, Message

# Load environment variables from .env file
load_dotenv()


app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "dev-secret-key-123")
# Use current directory for the database to keep it simple and visible
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'swasthai.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Mail configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get("MAIL_USERNAME")
app.config['MAIL_PASSWORD'] = os.environ.get("MAIL_PASSWORD")
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get("MAIL_USERNAME")

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
mail = Mail(app)

# User Model
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)
    is_verified = db.Column(db.Boolean, default=False)
    # Profile fields
    name = db.Column(db.String(100), nullable=True)
    blood_group = db.Column(db.String(10), nullable=True)
    area = db.Column(db.String(200), nullable=True)
    age = db.Column(db.Integer, nullable=True)
    contact_no = db.Column(db.String(20), nullable=True)
    is_profile_complete = db.Column(db.Boolean, default=False)
    user_type = db.Column(db.String(20), default="user") # 'user' or 'donor'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Configure Gemini API
api_key = os.environ.get("GEMINI_API_KEY", "").strip()
genai.configure(api_key=api_key)
# Using model version requested by user
model = genai.GenerativeModel("gemini-2.5-flash")

SYSTEM_PROMPT = """
You are an expert Medical Assistant AI. 

If an image is provided, analyze the medicine or medical condition shown. 
If no image is provided, answer the user's questions about health or medicines.

CRITICAL: You must detect the user's language (e.g., English, Hindi, or Kannada) and answer EVERYTHING (all fields in JSON) in that same language.

Return your response EXCLUSIVELY in JSON format with this structure:
{
  "medicine_name": "Name of medicine or Topic title",
  "uses": ["Point 1", "Point 2", ...],
  "dosage": "Main recommendation or dosage info",
  "side_effects": ["List of side effects or symptoms/risks"],
  "warnings": "Medical disclaimer is MANDATORY."
}

If the user asks about a specific medicine:
- Provide its name, uses, dosage, and side effects.

If the user asks a general health or medical question:
- Use 'medicine_name' for the primary topic/answer summary.
- Use 'uses' for detailed advice or steps.
- Use 'dosage' for recommendations.
- Use 'side_effects' for symptoms to watch for or risks.

Keep list items concise (max 6 per list).
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
                "title": "API Connection Failed",
                "possible_causes": [error_str[:100]],
                "precautions": ["Check your GEMINI_API_KEY in .env", "Ensure your internet is working"],
                "seek_care_if": ["This is a technical error, not medical advice"]
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
                "title": "AI Parsing Error",
                "possible_causes": ["AI sent invalid data format", str(json_err)[:50]],
                "precautions": ["Try refreshing or rephrasing your message"],
                "seek_care_if": ["Consult a doctor for clinical concerns"]
            }
            
    except Exception as general_err:
        print(f"General Error: {general_err}")
        return {
            "title": "System Error",
            "possible_causes": [str(general_err)[:100]],
            "precautions": ["Please contact support or try again later"],
            "seek_care_if": ["Always seek professional medical help for emergencies"]
        }


@app.get("/")
@login_required
def home():
    return render_template("index.html", build_time=datetime.utcnow().isoformat() + "Z")

@app.route("/profile-setup", methods=["GET", "POST"])
@login_required
def profile_setup():
    if current_user.is_profile_complete:
        return redirect(url_for('home'))
        
    if request.method == "POST":
        current_user.name = request.form.get("name")
        current_user.blood_group = request.form.get("blood_group")
        current_user.area = request.form.get("area")
        current_user.age = int(request.form.get("age") or 0)
        current_user.contact_no = request.form.get("contact_no")
        current_user.user_type = request.form.get("user_type", "user")
        current_user.is_profile_complete = True
        
        db.session.commit()
        flash("Profile completed successfully!", "success")
        return redirect(url_for('home'))
        
    return render_template("profile_setup.html")

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        
        user_exists = User.query.filter_by(email=email).first()
        if user_exists:
            flash("Email already registered", "danger")
            return redirect(url_for('signup'))
        
        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
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
            user = User(email=data['email'], password=data['password'], is_verified=True)
            db.session.add(user)
            db.session.commit()
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
        email = request.form.get("email")
        password = request.form.get("password")
        user = User.query.filter_by(email=email).first()
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('home'))
        else:
            flash("Invalid email or password", "danger")
    return render_template("login.html")

@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
        
    if request.method == "POST":
        email = request.form.get("email")
        user = User.query.filter_by(email=email).first()
        
        if not user:
            flash("No account found with that email", "danger")
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
            user = User.query.filter_by(email=email).first()
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
        current_user.user_type = new_type
        db.session.commit()
        return jsonify({"success": True, "user_type": new_type})
    return jsonify({"success": False, "error": "Invalid user type"}), 400

@app.post("/api/update-profile")
@login_required
def update_profile():
    data = request.get_json()
    current_user.name = data.get("name")
    current_user.blood_group = data.get("blood_group")
    current_user.area = data.get("area")
    current_user.age = int(data.get("age") or 0)
    current_user.contact_no = data.get("contact_no")
    current_user.is_profile_complete = True
    db.session.commit()
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
        db.create_all()
    app.run(host="0.0.0.0", port=5000, debug=True)
