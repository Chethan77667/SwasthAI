from __future__ import annotations

from datetime import datetime, timedelta
import io
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
from gridfs import GridFS
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

# Load environment variables from .env
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

def _donor_requests_col():
    return _mongo_client()[_mongo_db_name()]["donor_requests"]

def _fs() -> GridFS:
    return GridFS(_mongo_client()[_mongo_db_name()])


def _init_mongo() -> None:
    global _mongo_initialized
    if _mongo_initialized:
        return
    # ensure connection is attempted and indexes exist
    _mongo_client().admin.command("ping")
    _users_col().create_index("email", unique=True)
    _donor_requests_col().create_index([("donor_id", 1), ("status", 1), ("created_at", -1)])
    _donor_requests_col().create_index([("requester_id", 1), ("created_at", -1)])
    # Auto-delete handled requests after 24 hours
    _donor_requests_col().create_index("expires_at", expireAfterSeconds=0)
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
        
        content: list = []
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
                "points": [str(error_str)[:180]],
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
    return render_template("hospitals.html", build_time=datetime.utcnow().isoformat() + "Z", gapi_key=_gmaps_key())


@app.get("/doctors")
@login_required
def doctors_page():
    return render_template("doctors.html", build_time=datetime.utcnow().isoformat() + "Z")


@app.get("/schemes")
@login_required
def schemes_page():
    return render_template("schemes.html", build_time=datetime.utcnow().isoformat() + "Z")

@app.get("/donors")
@login_required
def donors_page():
    return render_template("donors.html", build_time=datetime.utcnow().isoformat() + "Z")

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


def _public_user_view(doc: dict) -> dict:
    name = doc.get("name") or (doc.get("email", "").split("@")[0] if doc.get("email") else "Donor")
    return {
        "id": str(doc.get("_id")),
        "name": name,
        "blood_group": doc.get("blood_group"),
        "area": doc.get("area"),
        "contact_no": doc.get("contact_no"),
        "user_type": doc.get("user_type") or "user",
    }


@app.get("/api/donors")
@login_required
def donors_api():
    blood_group = (request.args.get("blood_group") or "").strip()
    area = (request.args.get("area") or "").strip()

    q: dict = {"user_type": "donor", "is_profile_complete": True}
    if blood_group:
        q["blood_group"] = blood_group
    if area:
        q["area"] = {"$regex": area, "$options": "i"}

    donors = list(_users_col().find(q, {"password": 0}).sort("name", 1).limit(50))
    return jsonify({"donors": [_public_user_view(d) for d in donors]})


@app.post("/api/donor_requests")
@login_required
def create_donor_request():
    donor_id = (request.form.get("donor_id") or "").strip()
    reason = (request.form.get("reason") or "").strip()
    message = (request.form.get("message") or "").strip()
    
    # New fields for requester verification
    requester_name = (request.form.get("requester_name") or "").strip()
    requester_phone = (request.form.get("requester_phone") or "").strip()
    requester_location = (request.form.get("requester_location") or "").strip()
    
    slip = request.files.get("slip")

    if not donor_id:
        return jsonify({"error": "Donor ID is required"}), 400
    if not reason:
        return jsonify({"error": "Reason is required"}), 400
    if not requester_name or not requester_phone or not requester_location:
        return jsonify({"error": "Please provide your name, phone and location"}), 400

    try:
        donor_oid = ObjectId(donor_id)
    except Exception:
        return jsonify({"error": "invalid donor_id"}), 400

    donor_doc = _users_col().find_one({"_id": donor_oid})
    if not donor_doc or (donor_doc.get("user_type") or "user") != "donor":
        return jsonify({"error": "donor not found"}), 404

    slip_file_id = None
    slip_meta = None
    if slip and slip.filename:
        data = slip.read()
        if len(data) > 8 * 1024 * 1024:
            return jsonify({"error": "slip too large (max 8MB)"}), 400
        slip_file_id = _fs().put(
            data,
            filename=slip.filename,
            content_type=slip.mimetype,
            uploader_id=ObjectId(current_user.id),
            created_at=datetime.utcnow(),
        )
        slip_meta = {"filename": slip.filename, "content_type": slip.mimetype, "size": len(data)}

    doc = {
        "donor_id": donor_oid,
        "requester_id": ObjectId(current_user.id),
        "requester_name": requester_name,
        "requester_phone": requester_phone,
        "requester_location": requester_location,
        "reason": reason,
        "message": message,
        "slip_file_id": slip_file_id,
        "slip_meta": slip_meta,
        "status": "pending",  # pending|accepted|rejected
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    rid = _donor_requests_col().insert_one(doc).inserted_id

    # Send Email to Donor with all details
    try:
        donor_email = donor_doc.get("email")
        if donor_email and app.config.get("MAIL_USERNAME"):
            msg = Message("SwasthAI - New Blood Request", recipients=[donor_email])
            msg.body = (
                f"Hello,\n\n"
                f"You have received a new blood request from {requester_name}.\n\n"
                f"Details:\n"
                f"- Name: {requester_name}\n"
                f"- Location: {requester_location}\n"
                f"- Reason: {reason}\n"
            )
            if message:
                msg.body += f"- Additional Message: {message}\n"
            
            msg.body += "\nNote: For privacy, contact numbers are only shared after you Accept this request in your SwasthAI profile.\n\nThank you,\nSwasthAI Team"
            
            # Attach slip if it exists
            if slip and slip.filename:
                # Need to seek back to start since it was already read for GridFS
                slip.seek(0)
                msg.attach(
                    slip.filename,
                    slip.content_type,
                    slip.read()
                )
            
            mail.send(msg)
    except Exception as e:
        print(f"Failed to send donor request email: {e}")

    return jsonify({"success": True, "request_id": str(rid)})


@app.get("/api/donor_requests")
@login_required
def list_donor_requests():
    # User can be donor or requester
    q = {"$or": [
        {"donor_id": ObjectId(current_user.id)},
        {"requester_id": ObjectId(current_user.id)}
    ]}

    items = list(_donor_requests_col().find(q).sort("created_at", -1).limit(100))
    user_ids = set()
    for item in items:
        # Use set.update to avoid confusion and discard None values later
        if item.get("donor_id"):
            user_ids.add(item.get("donor_id"))
        if item.get("requester_id"):
            user_ids.add(item.get("requester_id"))
    
    users = {u["_id"]: u for u in _users_col().find({"_id": {"$in": list(user_ids)}}, {"password": 0})}
    
    out = []
    for item in items:
        donor_id = item.get("donor_id")
        req_id = item.get("requester_id")
        donor_doc = users.get(donor_id) or {}
        requester_doc = users.get(req_id) or {}
        
        is_accepted = (item.get("status") == "accepted")
        
        # Public views (don't include sensitive info unless accepted)
        donor_view = _public_user_view(donor_doc) if donor_doc else None
        requester_view = _public_user_view(requester_doc) if requester_doc else None
        
        # Add numbers if accepted
        if is_accepted:
            if donor_view: donor_view["contact_no"] = donor_doc.get("contact_no")
            if requester_view: requester_view["contact_no"] = item.get("requester_phone") # Use phone from request doc
        elif item.get("status") == "rejected":
             # We can add a rejection flag if needed, but status is enough
             pass

        out.append(
            {
                "id": str(item["_id"]),
                "status": item.get("status"),
                "reason": item.get("reason"),
                "message": item.get("message"),
                "requester_name": item.get("requester_name"),
                "requester_location": item.get("requester_location"),
                "created_at": item.get("created_at").isoformat() + "Z",
                "updated_at": item.get("updated_at").isoformat() + "Z",
                "donor": donor_view,
                "requester": requester_view,
                "slip": item.get("slip_meta"),
                "has_slip": bool(item.get("slip_file_id")),
                "is_for_me": (item["donor_id"] == ObjectId(current_user.id)),
                "feedback": item.get("feedback")
            }
        )

    return jsonify({"requests": out})


@app.post("/api/donor_requests/<rid>/status")
@login_required
def update_donor_request_status(rid: str):
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").strip().lower()
    if status not in ("accepted", "rejected"):
        return jsonify({"error": "status must be accepted or rejected"}), 400
    try:
        oid = ObjectId(rid)
    except Exception:
        return jsonify({"error": "invalid request id"}), 400

    # Ensure current user is the donor for this request
    expires_at = datetime.utcnow() + timedelta(hours=24)
    res = _donor_requests_col().update_one(
        {"_id": oid, "donor_id": ObjectId(current_user.id), "status": "pending"},
        {"$set": {
            "status": status, 
            "updated_at": datetime.utcnow(),
            "expires_at": expires_at
        }},
    )
    
    if res.matched_count == 0:
        return jsonify({"error": "request not found (or already handled)"}), 404
    
    # Optional: Send email notification to requester
    try:
        request_doc = _donor_requests_col().find_one({"_id": oid})
        requester_doc = _users_col().find_one({"_id": request_doc["requester_id"]})
        if requester_doc and requester_doc.get("email") and app.config.get("MAIL_USERNAME"):
            msg = Message(f"SwasthAI - Blood Request {status.capitalize()}", recipients=[requester_doc.get("email")])
            msg.body = f"Hello,\n\nYour blood request to {current_user.name} has been {status}.\n\n"
            
            if status == "accepted":
                msg.body += (
                    f"Donor Contact Information:\n"
                    f"- Name: {current_user.name}\n"
                    f"- Phone: {current_user._doc.get('contact_no') or 'Not provided'}\n\n"
                    f"You can also see these details in your SwasthAI inbox.\n"
                )
                
                # Also send a mutual confirmation to the donor
                try:
                    donor_msg = Message("SwasthAI - Request Accepted Successfully", recipients=[current_user.email])
                    donor_msg.body = (
                        f"Hello {current_user.name},\n\n"
                        f"You have accepted the blood request from {request_doc.get('requester_name')}.\n\n"
                        f"Requester Contact Information:\n"
                        f"- Name: {request_doc.get('requester_name')}\n"
                        f"- Phone: {request_doc.get('requester_phone')}\n\n"
                        f"Thank you for your life-saving contribution!\n\nSwasthAI Team"
                    )
                    mail.send(donor_msg)
                except Exception as de:
                    print(f"Failed to send donor confirmation: {de}")
            else:
                msg.body += f"We are sorry, but the donor has rejected your request at this time.\n"
                
            msg.body += "\nThank you,\nSwasthAI Team"
            mail.send(msg)
    except Exception as e:
        print(f"Failed to send requester status email: {e}")

    return jsonify({"success": True, "status": status})


@app.post("/api/donor_requests/<rid>/feedback")
@login_required
def submit_request_feedback(rid: str):
    data = request.get_json(silent=True) or {}
    feedback = (data.get("feedback") or "").strip().lower()
    if feedback not in ("like", "dislike"):
        return jsonify({"error": "feedback must be like or dislike"}), 400
    
    try:
        oid = ObjectId(rid)
    except Exception:
        return jsonify({"error": "invalid request id"}), 400
        
    # User must be the requester and the status must be accepted
    res = _donor_requests_col().find_one_and_update(
        {"_id": oid, "requester_id": ObjectId(current_user.id), "status": "accepted"},
        {"$set": {"feedback": feedback}},
        return_document=True
    )
    
    if not res:
        return jsonify({"error": "Could not submit feedback (must be accepted request)"}), 404
        
    return jsonify({"success": True, "feedback": feedback})


@app.get("/api/donor_requests/<rid>/slip")
@login_required
def download_donor_request_slip(rid: str):
    try:
        oid = ObjectId(rid)
    except Exception:
        return jsonify({"error": "invalid request id"}), 400
    it = _donor_requests_col().find_one({"_id": oid})
    if not it or not it.get("slip_file_id"):
        return jsonify({"error": "slip not found"}), 404

    # only donor or requester can view
    uid = ObjectId(current_user.id)
    if uid not in (it["donor_id"], it["requester_id"]):
        return jsonify({"error": "forbidden"}), 403

    gf = _fs().get(it["slip_file_id"])
    data = gf.read()
    ct = getattr(gf, "content_type", None) or "application/octet-stream"
    filename = getattr(gf, "filename", None) or "slip"
    return app.response_class(
        data,
        mimetype=ct,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


def _gmaps_key() -> str | None:
    for k in ["GOOGLE_MAPS_API_KEY", "GOOGLE_MAP_API_KEY"]:
        val = os.getenv(k, "").strip()
        if val and val != "your_google_maps_api_key_here":
            return val
    return None


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
    keyword = request.args.get("keyword", "").strip()

    if lat is None or lng is None:
        return jsonify({"error": "lat and lng are required"}), 400

    base_radius = max(500, min(int(radius), 50000))
    search_radii = [base_radius, 15000, 30000, 50000]
    search_radii = sorted(list(set([r for r in search_radii if r >= base_radius])))

    data = {}
    for r in search_radii:
        params = {
            "location": f"{lat},{lng}",
            "radius": r,
            "type": "hospital",
            "key": key,
        }
        if keyword:
            params["keyword"] = keyword

        r_out = requests.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params=params,
            timeout=12,
        )
        data = r_out.json()
        if data.get("status") == "OK" and data.get("results"):
            radius = r  # Update returned radius to the successful one
            break
        elif data.get("status") not in ("OK", "ZERO_RESULTS"):
            return jsonify({"error": "places search failed", "details": data.get("status")}), 400

    results = []
    for it in data.get("results", [])[:12]:
        gloc = (it.get("geometry") or {}).get("location") or {}
        photos = it.get("photos", [])
        photo_ref = photos[0].get("photo_reference") if photos else None
        photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference={photo_ref}&key={key}" if photo_ref else None

        results.append(
            {
                "name": it.get("name"),
                "address": it.get("vicinity") or it.get("formatted_address"),
                "rating": it.get("rating"),
                "user_ratings_total": it.get("user_ratings_total"),
                "open_now": ((it.get("opening_hours") or {}).get("open_now")),
                "location": {"lat": gloc.get("lat"), "lng": gloc.get("lng")},
                "place_id": it.get("place_id"),
                "photo_url": photo_url,
            }
        )

    if results and key:
        destinations = "|".join([f"place_id:{r['place_id']}" for r in results if r.get('place_id')])
        if destinations:
            try:
                d_r = requests.get(
                    "https://maps.googleapis.com/maps/api/distancematrix/json",
                    params={
                        "origins": f"{lat},{lng}",
                        "destinations": destinations,
                        "key": key
                    },
                    timeout=12
                )
                d_data = d_r.json()
                if d_data.get("status") == "OK" and "rows" in d_data:
                    elements = d_data["rows"][0]["elements"]
                    for i, el in enumerate(elements):
                        if i < len(results):
                            if el.get("status") == "OK":
                                results[i]["distance"] = el.get("distance", {})
                                results[i]["duration"] = el.get("duration", {})
                                results[i]["distance_value"] = el.get("distance", {}).get("value", 999999)
                            else:
                                results[i]["distance_value"] = 999999
            except Exception as e:
                print("Distance Matrix Error:", e)

    results.sort(key=lambda x: x.get("distance_value", 999999))

    return jsonify({"center": {"lat": lat, "lng": lng}, "radius": radius, "results": results})


if __name__ == "__main__":
    with app.app_context():
        _init_mongo()
    app.run(host="0.0.0.0", port=5000, debug=True)
