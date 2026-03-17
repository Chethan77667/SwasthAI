# SwasthAI (demo)

Web-based smart healthcare assistance platform demo with:

- AI-like **symptom guidance chatbot** (demo logic; not a diagnosis)
- **Nearby hospital finder** (geolocation + Google Maps links, no API key needed)
- **Doctors contact** cards (demo data from backend)
- **Government schemes** awareness cards (demo data from backend)

## Run locally (Windows / PowerShell)

```powershell
cd c:\SwasthAI
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Then open `http://localhost:5000`.

## Notes

- `templates/index.html`: Tailwind-based UI
- `static/app.js`: chatbot UX, hospital locator, data loading, animations
- `static/styles.css`: small custom styles + reveal transitions
- `app.py`: Flask backend with demo endpoints

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

