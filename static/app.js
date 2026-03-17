const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nowLabel() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function appendMessage({ role, html }) {
  const log = $("#chatLog");
  const wrap = document.createElement("div");
  wrap.className = "msg";
  wrap.innerHTML = `
    <div class="meta">${role === "user" ? "You" : "SwasthAI"} • ${nowLabel()}</div>
    <div class="bubble ${role === "user" ? "user" : "assistant"}">${html}</div>
  `;
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
}

function formatAssistantReply(reply) {
  const causes = (reply.possible_causes || []).map((x) => `<div class="li">${escapeHtml(x)}</div>`).join("");
  const precautions = (reply.precautions || []).map((x) => `<div class="li">${escapeHtml(x)}</div>`).join("");
  const seek = (reply.seek_care_if || []).map((x) => `<div class="li">${escapeHtml(x)}</div>`).join("");

  return `
    <div class="font-semibold">${escapeHtml(reply.title || "Guidance")}</div>
    <div class="mt-2 text-white/80">Here’s a general guide based on your message:</div>
    <div class="list mt-3">
      <div class="text-xs text-white/60 uppercase tracking-wide">Possible causes</div>
      ${causes || `<div class="li">Share more details for better guidance.</div>`}
    </div>
    <div class="list mt-3">
      <div class="text-xs text-white/60 uppercase tracking-wide">Precautions</div>
      ${precautions || `<div class="li">Rest and monitor symptoms.</div>`}
    </div>
    <div class="list mt-3">
      <div class="text-xs text-white/60 uppercase tracking-wide">Seek care if</div>
      ${seek || `<div class="li">Symptoms are severe, worsening, or unusual.</div>`}
    </div>
  `;
}

async function sendChat(message) {
  appendMessage({ role: "user", html: escapeHtml(message) });

  const thinkingId = `thinking-${Math.random().toString(16).slice(2)}`;
  const log = $("#chatLog");
  const thinking = document.createElement("div");
  thinking.className = "msg";
  thinking.id = thinkingId;
  thinking.innerHTML = `
    <div class="meta">SwasthAI • ${nowLabel()}</div>
    <div class="bubble assistant">Thinking…</div>
  `;
  log.appendChild(thinking);
  log.scrollTop = log.scrollHeight;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    thinking.remove();

    if (!res.ok) {
      appendMessage({
        role: "assistant",
        html: `<div class="font-semibold">Couldn’t process</div><div class="mt-2 text-white/80">${escapeHtml(
          data?.error || "Please try again."
        )}</div>`,
      });
      return;
    }

    appendMessage({ role: "assistant", html: formatAssistantReply(data.reply || {}) });
  } catch (e) {
    thinking.remove();
    appendMessage({
      role: "assistant",
      html: `<div class="font-semibold">Network issue</div><div class="mt-2 text-white/80">Please check your connection and try again.</div>`,
    });
  }
}

function initChat() {
  const log = $("#chatLog");
  if (!log) return;

  appendMessage({
    role: "assistant",
    html: `<div class="font-semibold">Hi! I’m SwasthAI.</div>
      <div class="mt-2 text-white/80">Tell me your symptoms and I’ll share possible causes, precautions, and red flags.</div>`,
  });

  $("#chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#chatInput");
    const msg = (input.value || "").trim();
    if (!msg) return;
    input.value = "";
    await sendChat(msg);
  });

  const promptButtons = $$(".chip, .prompt-chip");
  for (const btn of promptButtons) {
    btn.addEventListener("click", async () => {
      const prompt = btn.getAttribute("data-prompt");
      if (!prompt) return;
      $("#chatInput").value = prompt;
      $("#chatInput").focus();
      await sendChat(prompt);
      location.hash = "#chat";
    });
  }
}

function initReveal() {
  const items = $$(".reveal");
  if (!items.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const ent of entries) {
        if (ent.isIntersecting) {
          ent.target.classList.add("in");
          io.unobserve(ent.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  items.forEach((el) => io.observe(el));
}

function initMenu() {
  const btn = $("#menuBtn");
  const closeBtn = $("#closeMenuBtn");
  const menu = $("#mobileMenu");
  if (!btn || !menu) return;

  const open = () => {
    menu.classList.remove("hidden");
    menu.querySelector(".rounded-2xl")?.classList.add("animate-pop");
  };
  const close = () => {
    menu.classList.add("hidden");
  };

  btn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);

  $$("#mobileMenu a").forEach((a) => a.addEventListener("click", close));
}

function initFinder() {
  const locBtn = $("#locBtn");
  const openMapsBtn = $("#openMapsBtn");
  const status = $("#locStatus");
  const mapFrame = $("#mapFrame");
  const placeInput = $("#placeInput");
  const placeSearchBtn = $("#placeSearchBtn");
  const hospitalsList = $("#hospitalsList");
  const apiBadge = $("#apiBadge");
  const hospitalSelect = $("#hospitalSelect");
  const showHospitalBtn = $("#showHospitalBtn");
  if (
    !locBtn ||
    !openMapsBtn ||
    !status ||
    !mapFrame ||
    !placeInput ||
    !placeSearchBtn ||
    !hospitalsList ||
    !apiBadge ||
    !hospitalSelect ||
    !showHospitalBtn
  )
    return;

  let coords = null;
  let lastHospitals = [];
  let lastCenter = null;

  function mapsSearchUrl(lat, lng, q = "hospital near me") {
    const qq = encodeURIComponent(q);
    return `https://www.google.com/maps/search/?api=1&query=${qq}&query_place_id=&center=${lat},${lng}`;
  }

  function setMapsUrl(lat, lng, q = "hospital near me") {
    const url = mapsSearchUrl(lat, lng, q);
    openMapsBtn.disabled = false;
    openMapsBtn.onclick = () => window.open(url, "_blank", "noopener,noreferrer");
    mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(`${q} near ${lat},${lng}`)}&output=embed`;
  }

  function setMapToPoint(lat, lng, label) {
    mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(`${label || "hospital"} @ ${lat},${lng}`)}&output=embed`;
  }

  function setApiMode(mode) {
    apiBadge.textContent = mode;
  }

  function haversineKm(a, b) {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function chooseNearestHospital(center, items) {
    if (!center || !items?.length) return null;
    const c = { lat: center.lat, lng: center.lng };
    let best = null;
    let bestD = Infinity;
    for (const h of items) {
      const lat = h.location?.lat;
      const lng = h.location?.lng;
      if (lat == null || lng == null) continue;
      const d = haversineKm(c, { lat, lng });
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  function showHospitalOnMap(h) {
    if (!h) return;
    const lat = h.location?.lat;
    const lng = h.location?.lng;
    if (lat == null || lng == null) return;
    setMapToPoint(lat, lng, h.name || "hospital");
  }

  function hospitalRow(h) {
    const rating =
      h.rating != null ? `<span class="badge">⭐ ${escapeHtml(h.rating)}${h.user_ratings_total ? ` • ${escapeHtml(h.user_ratings_total)}` : ""}</span>` : "";
    const open =
      h.open_now === true ? `<span class="badge">Open now</span>` : h.open_now === false ? `<span class="badge">Closed</span>` : "";

    const addr = h.address ? `<div class="text-xs text-white/55 mt-0.5">${escapeHtml(h.address)}</div>` : "";
    const mapLink =
      h.location?.lat != null && h.location?.lng != null
        ? mapsSearchUrl(h.location.lat, h.location.lng, h.name || "hospital")
        : null;

    return `
      <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="font-medium truncate">${escapeHtml(h.name || "Hospital")}</div>
            ${addr}
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            ${rating}
            ${open}
          </div>
        </div>
        ${
          mapLink
            ? `<a class="mt-2 inline-flex text-xs text-skyx-200 hover:text-skyx-50 transition" href="${mapLink}" target="_blank" rel="noreferrer">Open in Maps ↗</a>`
            : ""
        }
      </div>
    `;
  }

  function renderHospitals(items) {
    if (!items || !items.length) {
      hospitalSelect.innerHTML = `<option value="">No hospitals found</option>`;
      hospitalSelect.disabled = true;
      showHospitalBtn.disabled = true;
      hospitalsList.innerHTML = `<div class="text-white/55 text-sm">No hospitals found.</div>`;
      return;
    }
    hospitalSelect.innerHTML = items
      .map((h, idx) => {
        const label = [h.name, h.address].filter(Boolean).join(" — ");
        return `<option value="${idx}">${escapeHtml(label || "Hospital")}</option>`;
      })
      .join("");
    hospitalSelect.disabled = false;
    showHospitalBtn.disabled = false;
    hospitalsList.innerHTML = items.map(hospitalRow).join("");
  }

  async function fetchHospitalsByCoords(lat, lng, label) {
    coords = { latitude: lat, longitude: lng };
    lastCenter = { lat, lng };
    status.textContent = label || `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
    setMapsUrl(lat, lng);

    try {
      const res = await fetch(`/api/nearby_hospitals?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=6000`);
      const data = await res.json();
      if (res.ok) {
        setApiMode("Places API");
        lastHospitals = data.results || [];
        renderHospitals(lastHospitals);

        // Default to nearest hospital every time.
        const nearest = chooseNearestHospital(lastCenter, lastHospitals);
        if (nearest) {
          const idx = lastHospitals.indexOf(nearest);
          if (idx >= 0) hospitalSelect.value = String(idx);
          showHospitalOnMap(nearest);
        }
        return;
      }
      setApiMode("Fallback");
      lastHospitals = [];
      hospitalSelect.innerHTML = `<option value="">API key not set</option>`;
      hospitalSelect.disabled = true;
      showHospitalBtn.disabled = true;
      renderHospitals([]);
    } catch {
      setApiMode("Fallback");
      lastHospitals = [];
      hospitalSelect.innerHTML = `<option value="">API unavailable</option>`;
      hospitalSelect.disabled = true;
      showHospitalBtn.disabled = true;
      renderHospitals([]);
    }
  }

  locBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      status.textContent = "Geolocation is not supported in this browser.";
      return;
    }
    status.textContent = "Detecting location…";
    locBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        fetchHospitalsByCoords(
          latitude,
          longitude,
          `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`
        );
        locBtn.disabled = false;
      },
      (err) => {
        status.textContent = `Couldn’t access location: ${err.message}`;
        locBtn.disabled = false;
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });

  openMapsBtn.addEventListener("click", () => {
    if (!coords) return;
    setMapsUrl(coords.latitude, coords.longitude);
  });

  async function searchPlace() {
    const q = (placeInput.value || "").trim();
    if (!q) return;
    hospitalsList.innerHTML = `<div class="text-white/55 text-sm">Searching…</div>`;
    setApiMode("Geocoding");
    hospitalSelect.innerHTML = `<option value="">Searching…</option>`;
    hospitalSelect.disabled = true;
    showHospitalBtn.disabled = true;

    // Try backend Geocoding API (requires GOOGLE_MAPS_API_KEY).
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        const details = data?.details ? ` (${data.details})` : "";
        const gm = data?.error_message ? ` — ${data.error_message}` : "";
        throw new Error(`${data?.error || "geocode failed"}${details}${gm}`);
      }
      const lat = data.location?.lat;
      const lng = data.location?.lng;
      if (lat == null || lng == null) throw new Error("invalid geocode");
      setMapsUrl(lat, lng, "hospital");
      await fetchHospitalsByCoords(lat, lng, data.formatted_address || q);
      return;
    } catch (err) {
      const msg = String(err?.message || "");
      // Fallback: just open Google Maps search for the typed place.
      setApiMode(msg.includes("REQUEST_DENIED") ? "Denied" : "Fallback");
      hospitalsList.innerHTML = `
        <div class="text-white/55 text-sm">${
          msg
            ? `Google API request failed: <span class="text-white/80">${escapeHtml(msg)}</span>`
            : "Google API request failed."
        }</div>
        <div class="mt-1 text-white/55 text-sm">Using Google Maps search link instead.</div>
        <a class="mt-2 inline-flex text-sm text-skyx-200 hover:text-skyx-50 transition" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `hospital in ${q}`
        )}" target="_blank" rel="noreferrer">Search “hospital in ${escapeHtml(q)}” ↗</a>
      `;
      mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(`hospital in ${q}`)}&output=embed`;
      openMapsBtn.disabled = false;
      openMapsBtn.onclick = () =>
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hospital in ${q}`)}`, "_blank", "noopener,noreferrer");
      hospitalSelect.innerHTML = `<option value="">(Set API key to list hospitals here)</option>`;
      hospitalSelect.disabled = true;
      showHospitalBtn.disabled = true;
    }
  }

  placeSearchBtn.addEventListener("click", searchPlace);
  placeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchPlace();
    }
  });

  hospitalSelect.addEventListener("change", () => {
    const idx = Number(hospitalSelect.value);
    const h = lastHospitals?.[idx];
    if (h) showHospitalOnMap(h);
  });

  showHospitalBtn.addEventListener("click", () => {
    const idx = Number(hospitalSelect.value);
    const h = lastHospitals?.[idx];
    if (h) showHospitalOnMap(h);
  });
}

function telLink(phone) {
  const num = String(phone || "").replace(/[^\d+]/g, "");
  return `tel:${num}`;
}

function waLink(phone, text) {
  const num = String(phone || "").replace(/[^\d]/g, "");
  const msg = encodeURIComponent(text || "Hello doctor, I need a consultation.");
  return `https://wa.me/${num}?text=${msg}`;
}

function doctorCard(d) {
  const modes = new Set(d.mode || []);
  const wa = modes.has("WhatsApp")
    ? `<a class="btn-primary w-full justify-center" href="${waLink(d.phone, `Hello ${d.name}, I need help.`)}" target="_blank" rel="noreferrer">WhatsApp</a>`
    : "";
  const call = `<a class="btn-ghost w-full justify-center" href="${telLink(d.phone)}">Call</a>`;

  return `
    <div class="mini-card">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-semibold tracking-tight">${escapeHtml(d.name)}</div>
          <div class="mt-0.5 text-sm text-white/70">${escapeHtml(d.specialty)}</div>
        </div>
        <span class="badge">Available</span>
      </div>
      <div class="mt-3 text-xs text-white/55">${escapeHtml(d.availability || "")}</div>
      <div class="mt-4 grid grid-cols-2 gap-2">
        ${call}
        ${wa || `<div class="btn-ghost w-full justify-center opacity-60 cursor-not-allowed" title="WhatsApp not available">WhatsApp</div>`}
      </div>
      <div class="mt-3 text-xs text-white/55">${escapeHtml(d.phone || "")}</div>
    </div>
  `;
}

function schemeCard(s) {
  return `
    <div class="mini-card">
      <div class="font-semibold tracking-tight">${escapeHtml(s.title)}</div>
      <div class="mt-2 text-sm text-white/70">${escapeHtml(s.summary)}</div>
      <div class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div class="text-xs text-white/60 uppercase tracking-wide">How to use</div>
        <div class="mt-1 text-sm text-white/75">${escapeHtml(s.how_to_use)}</div>
      </div>
    </div>
  `;
}

async function loadDoctors() {
  const grid = $("#doctorsGrid");
  if (!grid) return;
  grid.innerHTML = `<div class="text-sm text-white/70">Loading…</div>`;
  try {
    const res = await fetch("/api/doctors");
    const data = await res.json();
    const docs = data.doctors || [];
    grid.innerHTML = docs.map(doctorCard).join("") || `<div class="text-sm text-white/70">No doctors found.</div>`;
  } catch {
    grid.innerHTML = `<div class="text-sm text-white/70">Couldn’t load doctors.</div>`;
  }
}

async function loadSchemes() {
  const grid = $("#schemesGrid");
  if (!grid) return;
  grid.innerHTML = `<div class="text-sm text-white/70">Loading…</div>`;
  try {
    const res = await fetch("/api/schemes");
    const data = await res.json();
    const schemes = data.schemes || [];
    grid.innerHTML = schemes.map(schemeCard).join("") || `<div class="text-sm text-white/70">No schemes found.</div>`;
  } catch {
    grid.innerHTML = `<div class="text-sm text-white/70">Couldn’t load schemes.</div>`;
  }
}

function initData() {
  $("#refreshDoctorsBtn")?.addEventListener("click", loadDoctors);
  $("#refreshSchemesBtn")?.addEventListener("click", loadSchemes);
  loadDoctors();
  loadSchemes();
}

document.addEventListener("DOMContentLoaded", () => {
  initMenu();
  initReveal();
  initChat();
  initFinder();
  initData();
});

