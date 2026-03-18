# SwasthAI

Web-based smart healthcare assistance platform demo with:

- AI-powered **symptom guidance chatbot** (not a diagnosis) + optional medicine image support
- **Nearby hospital finder** (geolocation + Google Maps links, no API key needed)
- **Doctors contact** directory
- **Government schemes** awareness

## Run locally (Windows / PowerShell)

```powershell
cd c:\SwasthAI
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# If you're using MongoDB locally
$env:MONGODB_URI="mongodb://localhost:27017"
$env:MONGODB_DB="swasthai"

python app.py
```

Then open `http://localhost:5000`.

## Pages / Routes

- Home (landing): `/`
- Chatbot: `/chatbot`
- Hospitals: `/hospitals`
- Doctors: `/doctors`
- Schemes: `/schemes`
- Blood donors: `/donors`

## API Endpoints

- **Chatbot**: `POST /api/chat`
  - Multipart form fields: `message` (optional if image is provided), `language` (optional), `image` (optional)
- **Doctors**: `GET /api/doctors`
- **Schemes**: `GET /api/schemes`
- **Geocode (requires key)**: `GET /api/geocode?address=...`
- **Nearby hospitals (requires key)**: `GET /api/nearby_hospitals?lat=...&lng=...&radius=...`
- **Profile update (logged-in)**: `POST /api/update-profile`
- **Account type update (logged-in)**: `POST /update-user-type`
- **Donors**
  - `GET /api/donors?blood_group=...&area=...` — search donors (only donors with completed profiles and `user_type='donor'`)
  - `POST /api/donor_requests` — create a request to a donor (form fields: `donor_id`, `reason` (required), `message` (optional), `slip` (optional file))
  - `GET /api/donor_requests` — for donors: inbox; for users: sent requests
  - `POST /api/donor_requests/<id>/status` — donors accept/reject (`{"status": "accepted"|"rejected"}`)
  - `GET /api/donor_requests/<id>/slip` — download/view attached doctor slip (donor or requester only)

## Notes

- `templates/index.html`: landing page UI (links to feature pages)
- `templates/chatbot.html`, `templates/hospitals.html`, `templates/doctors.html`, `templates/schemes.html`, `templates/donors.html`: separate detailed pages
- `static/app.js`: chatbot UX, hospital locator, doctors/schemes loading, profile sidebar, blood donor flows (search + requests), language toggle, bottom navigation
- `static/styles.css`: small custom styles + reveal transitions
- `app.py`: Flask backend (auth/profile stored in MongoDB + API endpoints)

## Environment variables

- **Required**
  - `MONGODB_URI`: MongoDB connection string
  - `MONGODB_DB`: database name (default: `swasthai`)
- **Optional (feature-dependent)**
  - `GEMINI_API_KEY`: enables Gemini responses for `/api/chat`
  - `GOOGLE_MAPS_API_KEY`: enables typed place search (Geocoding + Places APIs)
  - `MAIL_USERNAME`, `MAIL_PASSWORD`: required for OTP emails (signup / forgot password)
  - `SECRET_KEY`: Flask session secret (recommended to set in production)

## MongoDB setup (required)

This project stores user accounts and profile data in **MongoDB**.

Set environment variables:

```powershell
$env:MONGODB_URI="mongodb://localhost:27017"
$env:MONGODB_DB="swasthai"
```

If you use MongoDB Atlas, set `MONGODB_URI` to your Atlas connection string.

## Working status

- **Working now (with MongoDB running)**:
  - Separate pages: Home / Chatbot / Hospitals / Doctors / Schemes / Donors
  - Login / logout
  - Profile sidebar + edit profile + account type toggle (User/Donor)
  - Doctors + schemes load from backend APIs
  - Hospitals: GPS-based map + open Google Maps links (no API key needed)
  - Donors:
    - Users can search donors by blood group + area and send requests (with optional slip upload)
    - Donors can see incoming requests, view slips, and Accept/Reject
  - Language selector: basic English / Hindi / Kannada labels for main landing content + synced with chatbot language
  - Mobile bottom navigation: Home / Chatbot / Hospitals / Doctors / Schemes / Donors

- **Works when keys/credentials are configured**:
  - Chatbot AI responses: set `GEMINI_API_KEY`
  - Typed place → hospitals list via backend: set `GOOGLE_MAPS_API_KEY`
  - Signup OTP + forgot-password OTP emails: set `MAIL_USERNAME` and `MAIL_PASSWORD`

## Enable Google Maps APIs (typed location search)

Hospital search by a typed location uses:

- Google **Geocoding API** (`/api/geocode`)
- Google **Places Nearby Search** (`/api/nearby_hospitals`)

Set an environment variable before running the server:

```powershell
$env:GOOGLE_MAPS_API_KEY="YOUR_KEY_HERE"
python app.py
```

If the key is not set, the UI falls back to opening Google Maps search links.

