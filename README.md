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

## Notes

- `templates/index.html`: landing page UI (links to feature pages)
- `templates/chatbot.html`, `templates/hospitals.html`, `templates/doctors.html`, `templates/schemes.html`: separate detailed pages
- `static/app.js`: chatbot UX, hospital locator, doctors/schemes loading, profile sidebar
- `static/styles.css`: small custom styles + reveal transitions
- `app.py`: Flask backend (auth/profile stored in MongoDB + API endpoints)

## MongoDB setup (required)

This project stores user accounts and profile data in **MongoDB**.

Set environment variables:

```powershell
$env:MONGODB_URI="mongodb://localhost:27017"
$env:MONGODB_DB="swasthai"
```

If you use MongoDB Atlas, set `MONGODB_URI` to your Atlas connection string.

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

