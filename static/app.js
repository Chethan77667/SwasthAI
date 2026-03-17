const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const I18N = {
  en: {
    "nav.home": "Home",
    "nav.chatbot": "Chatbot",
    "nav.hospitals": "Hospitals",
    "nav.doctors": "Doctors",
    "nav.schemes": "Schemes",
    "cta.try_chatbot": "Try the chatbot",
    "cta.find_hospitals": "Find hospitals",
    "home.kicker": "AI-powered guidance • Nearby hospitals • Doctors • Schemes",
    "home.hero_1": "Healthcare help,",
    "home.hero_2": "anytime",
    "home.subtitle":
      "SwasthAI is a smart healthcare assistance platform built for accessibility—especially helpful for rural communities. Describe symptoms, find hospitals nearby, contact doctors, and learn about government health schemes."
  },
  hi: {
    "nav.home": "होम",
    "nav.chatbot": "चैटबॉट",
    "nav.hospitals": "अस्पताल",
    "nav.doctors": "डॉक्टर",
    "nav.schemes": "योजनाएँ",
    "cta.try_chatbot": "चैटबॉट आज़ಮಾएँ",
    "cta.find_hospitals": "अस्पताल खोजें",
    "home.kicker": "AI सहायता • नज़दीकी अस्पताल • डॉक्टर • योजनाएँ",
    "home.hero_1": "स्वास्थ्य सहायता,",
    "home.hero_2": "कभी भी",
    "home.subtitle":
      "SwasthAI एक स्मार्ट हेल्थकेಯ सहायता प्लेटफ़ॉर्म है—खासकर ग्रामीण समुदायों के लिए उपयोगी। लक्षण बताएँ, नज़दीकी अस्पताल खोजें, डॉक्टरों से संपर्क करें और सरकारी स्वास्थ्य योजनाओं के बारे में जानें।"
  },
  kn: {
    "nav.home": "ಮುಖಪುಟ",
    "nav.chatbot": "ಚಾಟ್‌ಬಾಟ್",
    "nav.hospitals": "ಆಸ್ಪತ್ರೆಗಳು",
    "nav.doctors": "ವೈದ್ಯರು",
    "nav.schemes": "ಯೋಜನೆಗಳು",
    "cta.try_chatbot": "ಚಾಟ್‌ಬಾಟ್ ಪ್ರಯತ್ನಿಸಿ",
    "cta.find_hospitals": "ಆಸ್ಪತ್ರೆ ಹುಡುಕಿ",
    "home.kicker": "AI ಮಾರ್ಗದರ್ಶನ • ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗಳು • ವೈದ್ಯರು • ಯೋಜನೆಗಳು",
    "home.hero_1": "ಆರೋಗ್ಯ ಸಹಾಯ,",
    "home.hero_2": "ಯಾವಾಗಲೂ",
    "home.subtitle":
      "SwasthAI ಒಂದು ಸ್ಮಾರ್ಟ್ ಆರೋಗ್ಯ ಸಹಾಯಕ ವೇದಿಕೆ—ಗ್ರಾಮೀಣ ಸಮುದಾಯಗಳಿಗೆ ವಿಶೇಷವಾಗಿ ಸಹಾಯಕ. ಲಕ್ಷಣಗಳನ್ನು ವಿವರಿಸಿ, ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗಳನ್ನು ಹುಡುಕಿ, ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ ಹಾಗೂ ಸರ್ಕಾರದ ಆರೋಗ್ಯ ಯೋಜನೆಗಳನ್ನು ತಿಳಿದುಕೊಳ್ಳಿ."
  }
};

function getLang() {
  return localStorage.getItem("siteLang") || "en";
}

function setLang(lang) {
  localStorage.setItem("siteLang", lang);
}

function t(key) {
  const lang = getLang();
  return (I18N[lang] && I18N[lang][key]) || (I18N.en[key] || key);
}

function applyI18n() {
  $$("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = t(key);
  });
}

function initSiteLanguage() {
  const sel = $("#siteLang");
  if (!sel) return;
  sel.value = getLang();
  sel.addEventListener("change", () => {
    setLang(sel.value);
    applyI18n();
    const chatSel = $("#languageSelect");
    if (chatSel) {
      chatSel.value = sel.value === "hi" ? "Hindi" : sel.value === "kn" ? "Kannada" : "English";
    }
  });
  applyI18n();
}

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

function appendMessageToLog(log, { role, html, imageSrc }) {
  if (!log) return;
  const wrap = document.createElement("div");
  wrap.className = "msg";
  let content = html;
  if (imageSrc) {
    content = `<img src="${imageSrc}" class="mb-2 max-h-48 rounded-lg border border-white/10 object-cover" />` + content;
  }
  wrap.innerHTML = `
    <div class="meta">${role === "user" ? "You" : "SwasthAI"} • ${nowLabel()}</div>
    <div class="bubble ${role === "user" ? "user" : "assistant"}">${content}</div>
  `;
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
}

function normalizeReply(reply) {
  return {
    type: reply?.type || "general",
    title: reply?.title || "SwasthAI",
    description: reply?.description || "",
    points: Array.isArray(reply?.points) ? reply.points : [],
    action: reply?.action || "",
    warning: reply?.warning || "",
  };
}

function formatAssistantReply(reply) {
  const r = normalizeReply(reply || {});
  const pts = (r.points || []).map((x) => `<div class="li">${escapeHtml(x)}</div>`).join("");
  return `
    <div class="flex items-center justify-between gap-3">
      <div class="font-semibold text-mint-300 font-display text-lg">${escapeHtml(r.title)}</div>
      <div class="badge">${escapeHtml((r.type).toLowerCase())}</div>
    </div>
    ${r.description ? `<div class="mt-2 text-white/90 leading-relaxed">${escapeHtml(r.description)}</div>` : ""}
    ${pts ? `<div class="list mt-4"><div class="text-[10px] text-white/40 uppercase tracking-[0.1em] font-bold">Key points</div>${pts}</div>` : ""}
    ${r.action ? `<div class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-sm text-white/80"><div class="text-[10px] text-white/40 uppercase tracking-[0.1em] font-bold">Next action</div><div class="mt-1">${escapeHtml(r.action)}</div></div>` : ""}
    ${r.warning ? `<div class="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs text-rose-200/80 leading-snug"><div class="flex items-center gap-2 mb-1.5 text-rose-400 font-bold uppercase tracking-wider text-[10px]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>Note</div>${escapeHtml(r.warning)}</div>` : ""}
  `;
}

async function sendChat(message, imageFile, opts = {}) {
  const logEl = opts.logEl || $("#chatLog");
  if (!logEl) return;
  let imageSrc = null;
  if (imageFile) {
    imageSrc = await new Promise((res) => {
      const r = new FileReader(); r.onload = (e) => res(e.target.result); r.readAsDataURL(imageFile);
    });
  }
  appendMessageToLog(logEl, { role: "user", html: escapeHtml(message), imageSrc });
  const thinking = document.createElement("div");
  thinking.className = "msg";
  thinking.innerHTML = `<div class="meta">SwasthAI • ${nowLabel()}</div><div class="bubble assistant">Typing...</div>`;
  logEl.appendChild(thinking);
  logEl.scrollTop = logEl.scrollHeight;

  try {
    const fd = new FormData();
    fd.append("message", message);
    fd.append("language", $("#languageSelect")?.value || "English");
    if (imageFile) fd.append("image", imageFile);
    const res = await fetch("/api/chat", { method: "POST", body: fd });
    const data = await res.json();
    thinking.remove();
    appendMessageToLog(logEl, { role: "assistant", html: formatAssistantReply(data.reply) });
  } catch (e) {
    thinking.remove();
  }
}

function initChat() {
  const log = $("#chatLog");
  if (!log) return;
  $("#chatForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#chatInput");
    const msg = (input.value || "").trim();
    if (msg) { input.value = ""; await sendChat(msg); }
  });
}

function initFloatingChat() {
  const btn = $("#floatChatBtn");
  const box = $("#floatChatBox");
  if (!btn || !box) return;
  btn.addEventListener("click", () => box.classList.toggle("hidden"));
  $("#floatChatSend")?.addEventListener("click", async () => {
    const input = $("#floatChatInput");
    const msg = input.value.trim();
    if (msg) { input.value = ""; await sendChat(msg, null, { logEl: $("#floatChatMessages") }); }
  });
}

function initReveal() {
  const io = new IntersectionObserver((es) => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  });
  $$(".reveal").forEach(el => io.observe(el));
}

function initMenu() {
  $("#menuBtn")?.addEventListener("click", () => $("#mobileMenu")?.classList.remove("hidden"));
  $("#closeMenuBtn")?.addEventListener("click", () => $("#mobileMenu")?.classList.add("hidden"));
}

function initFinder() {
  const locBtn = $("#locBtn");
  const openMapsBtn = $("#openMapsBtn");
  const status = $("#locStatus");
  const mapFrame = $("#mapFrame");
  const keywordInput = $("#keywordInput");
  const placeInput = $("#placeInput");
  const hospitalsList = $("#hospitalsList");
  const apiBadge = $("#apiBadge");
  const showMapMobileBtn = $("#showMapMobileBtn");
  const closeMapMobileBtn = $("#closeMapMobileBtn");
  const mapWrapper = $("#mapWrapper");

  // Modal elements
  const hModal = $("#hospitalModal");
  const hModalOverlay = $("#hospitalModalOverlay");
  const closeHModalBtn = $("#closeHospitalModalBtn");

  if (!locBtn || !status || !mapFrame || !placeInput || !hospitalsList) return;

  // Initialize Autocomplete if Places library is loaded (retries if not ready yet)
  function initMapsAutocomplete() {
    if (window.google && google.maps && google.maps.places) {
      const pAuto = new google.maps.places.Autocomplete(placeInput);
      pAuto.addListener('place_changed', () => {
        const place = pAuto.getPlace();
        if (place.geometry) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          fetchHospitalsByCoords(lat, lng, place.formatted_address || place.name);
        } else {
          searchPlace();
        }
      });
      if (keywordInput) {
        new google.maps.places.Autocomplete(keywordInput, { types: ['establishment'] });
      }
    } else {
      setTimeout(initMapsAutocomplete, 200);
    }
  }
  initMapsAutocomplete();

  let coords = null;

  function mapsSearchUrl(lat, lng, q = "hospital near me") {
    const qq = encodeURIComponent(q);
    return `https://www.google.com/maps/search/?api=1&query=${qq}&query_place_id=&center=${lat},${lng}`;
  }

  function setMapsUrl(lat, lng, q = "hospital near me") {
    const url = mapsSearchUrl(lat, lng, q);
    if (openMapsBtn) {
      openMapsBtn.href = url;
      openMapsBtn.classList.remove("hidden");
      openMapsBtn.classList.add("flex");
    }
    mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(`${q} near ${lat},${lng}`)}&output=embed`;
  }

  function setApiMode(mode) {
    if (apiBadge) apiBadge.textContent = mode;
  }

  function showHospitalModal(hMap) {
    if (!hModal || !hModalOverlay) return;

    $("#hospitalModalName").textContent = hMap.name;
    $("#hospitalModalAddr").textContent = hMap.addr;

    const rEl = $("#hospitalModalRating");
    if (hMap.rating && hMap.rating !== "null" && hMap.rating !== "undefined") {
      rEl.innerHTML = `⭐ ${hMap.rating} ${hMap.users && hMap.users !== "undefined" ? `• ${hMap.users}` : ''}`;
      rEl.style.display = 'inline-flex';
    } else {
      rEl.style.display = 'none';
    }

    const oEl = $("#hospitalModalOpen");
    if (hMap.open === 'true') {
      oEl.textContent = 'Open now';
      oEl.className = 'badge bg-mint-500/20 text-mint-400 border-mint-500/20';
      oEl.style.display = 'inline-flex';
    } else if (hMap.open === 'false') {
      oEl.textContent = 'Closed';
      oEl.className = 'badge bg-rose-500/20 text-rose-400 border-rose-500/20';
      oEl.style.display = 'inline-flex';
    } else {
      oEl.style.display = 'none';
    }

    const imgEl = $("#hospitalModalImg");
    const plEl = $("#hospitalModalImgPlaceholder");
    if (hMap.photo && hMap.photo !== "undefined" && hMap.photo !== "null") {
      imgEl.src = hMap.photo;
      imgEl.classList.remove("hidden");
      plEl.classList.add("hidden");
    } else {
      imgEl.src = "";
      imgEl.classList.add("hidden");
      plEl.classList.remove("hidden");
    }

    const mapsBtn = $("#hospitalModalMapsBtn");
    if (hMap.link && hMap.link !== "null") {
      mapsBtn.href = hMap.link;
      mapsBtn.style.display = 'flex';
    } else {
      mapsBtn.style.display = 'none';
    }

    hModalOverlay.classList.remove("hidden");
    hModal.classList.remove("hidden");
    hModal.classList.add("flex");
    setTimeout(() => {
      hModalOverlay.classList.remove("opacity-0");
      hModal.classList.remove("opacity-0", "scale-95");
    }, 10);
  }

  function hideHospitalModal() {
    if (!hModal || !hModalOverlay) return;
    hModalOverlay.classList.add("opacity-0");
    hModal.classList.add("opacity-0", "scale-95");
    setTimeout(() => {
      hModalOverlay.classList.add("hidden");
      hModal.classList.add("hidden");
      hModal.classList.remove("flex");
    }, 300);
  }

  if (closeHModalBtn) closeHModalBtn.addEventListener("click", hideHospitalModal);
  if (hModalOverlay) hModalOverlay.addEventListener("click", hideHospitalModal);

  function hospitalRow(h, isSelected) {
    const rating =
      h.rating != null ? `<span class="badge">⭐ ${escapeHtml(h.rating)}${h.user_ratings_total ? ` • ${escapeHtml(h.user_ratings_total)}` : ""}</span>` : "";
    const open =
      h.open_now === true ? `<span class="badge">Open now</span>` : h.open_now === false ? `<span class="badge">Closed</span>` : "";

    const addr = h.address ? `<div class="text-xs text-white/55 mt-0.5 whitespace-normal break-words">${escapeHtml(h.address)}</div>` : "";
    const dist = h.distance?.text ? `<div class="badge bg-mint-500/10 text-mint-400 border-mint-500/20">🚗 ${h.duration?.text || "?"} (${h.distance.text})</div>` : "";
    const mapLink =
      h.location?.lat != null && h.location?.lng != null
        ? mapsSearchUrl(h.location.lat, h.location.lng, h.name || "hospital")
        : null;

    const bgClass = isSelected ? 'border-mint-500/50 bg-mint-500/10' : 'border-white/10 bg-white/5';

    return `
      <div class="rounded-2xl border ${bgClass} p-3 cursor-pointer hover:border-white/30 transition hospital-card overflow-hidden" 
           data-lat="${h.location?.lat || ''}" 
           data-lng="${h.location?.lng || ''}" 
           data-name="${escapeHtml(h.name || 'hospital')}"
           data-addr="${escapeHtml(h.address || '')}"
           data-rating="${escapeHtml(h.rating)}"
           data-users="${escapeHtml(h.user_ratings_total)}"
           data-open="${h.open_now === true ? 'true' : h.open_now === false ? 'false' : ''}"
           data-photo="${escapeHtml(h.photo_url || '')}"
           data-link="${escapeHtml(mapLink || '')}">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1 pointer-events-none">
            <div class="font-medium truncate" title="${escapeHtml(h.name || "Hospital")}">${escapeHtml(h.name || "Hospital")}</div>
            ${addr}
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0 pointer-events-none whitespace-nowrap">
            ${rating}
            ${open}
            ${dist}
          </div>
        </div>
        ${mapLink
        ? `<a class="mt-2 inline-flex text-xs text-skyx-200 hover:text-skyx-50 transition relative z-10" href="${mapLink}" target="_blank" rel="noreferrer">Open in Maps ↗</a>`
        : ""
      }
      </div>
    `;
  }

  function renderHospitals(items, forceMapFallbackLat, forceMapFallbackLng) {
    if (!items || !items.length) {
      hospitalsList.innerHTML = `<div class="text-white/55 text-sm">No hospitals found.</div>`;
      if (forceMapFallbackLat != null && forceMapFallbackLng != null) {
        setMapsUrl(forceMapFallbackLat, forceMapFallbackLng);
      }
      return;
    }
    hospitalsList.innerHTML = items.map((h, i) => hospitalRow(h, i === 0)).join("");

    const cards = hospitalsList.querySelectorAll('.hospital-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.className = c.className.replace('border-mint-500/50 bg-mint-500/10', 'border-white/10 bg-white/5'));
        card.className = card.className.replace('border-white/10 bg-white/5', 'border-mint-500/50 bg-mint-500/10');

        const lat = card.getAttribute('data-lat');
        const lng = card.getAttribute('data-lng');
        const name = card.getAttribute('data-name');
        if (lat && lng) {
          setMapsUrl(parseFloat(lat), parseFloat(lng), name);
        }

        // Show detailed popup modal
        showHospitalModal({
          name: name,
          addr: card.getAttribute('data-addr'),
          lat: lat,
          lng: lng,
          rating: card.getAttribute('data-rating'),
          users: card.getAttribute('data-users'),
          open: card.getAttribute('data-open'),
          photo: card.getAttribute('data-photo'),
          link: card.getAttribute('data-link')
        });
      });
    });

    const nearest = items[0];
    if (nearest && nearest.location?.lat != null) {
      setMapsUrl(nearest.location.lat, nearest.location.lng, nearest.name || "hospital");
    } else if (forceMapFallbackLat != null && forceMapFallbackLng != null) {
      setMapsUrl(forceMapFallbackLat, forceMapFallbackLng);
    }
  }

  async function fetchHospitalsByCoords(lat, lng, label) {
    coords = { latitude: lat, longitude: lng };
    status.textContent = label || `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
    const keyword = (keywordInput?.value || "").trim();

    try {
      const u = new URLSearchParams({ lat, lng, radius: 6000 });
      if (keyword) u.append("keyword", keyword);
      const res = await fetch(`/api/nearby_hospitals?${u.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setApiMode("Places API");
        renderHospitals(data.results || [], lat, lng);
        return;
      }
      setApiMode("Fallback");
      renderHospitals([], lat, lng);
    } catch {
      setApiMode("Fallback");
      renderHospitals([], lat, lng);
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

  showMapMobileBtn?.addEventListener("click", () => {
    if (mapWrapper) {
      mapWrapper.classList.remove("hidden");
      mapWrapper.classList.add("flex");
    }
  });

  closeMapMobileBtn?.addEventListener("click", () => {
    if (mapWrapper) {
      mapWrapper.classList.add("hidden");
      mapWrapper.classList.remove("flex");
    }
  });

  async function searchPlace() {
    const q = (placeInput.value || "").trim();
    if (!q) return;
    hospitalsList.innerHTML = `<div class="text-white/55 text-sm">Searching…</div>`;
    setApiMode("Geocoding");
    const keyword = (keywordInput?.value || "").trim();
    const searchString = keyword ? `${keyword} in ` : "hospital in ";

    // Try backend Geocoding API (requires GOOGLE_MAPS_API_KEY).
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "geocode failed");
      }
      const lat = data.location?.lat;
      const lng = data.location?.lng;
      if (lat == null || lng == null) throw new Error("invalid geocode");
      setMapsUrl(lat, lng, keyword ? keyword : "hospital");
      await fetchHospitalsByCoords(lat, lng, data.formatted_address || q);
      return;
    } catch {
      // Fallback: just open Google Maps search for the typed place.
      setApiMode("Fallback");
      hospitalsList.innerHTML = `
        <a class="inline-flex text-sm text-skyx-200 hover:text-skyx-50 transition" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${searchString}${q}`
      )}" target="_blank" rel="noreferrer">Search “${escapeHtml(searchString)}${escapeHtml(q)}” ↗</a>
      `;
      mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(`${searchString}${q}`)}&output=embed`;
      openMapsBtn.disabled = false;
      openMapsBtn.onclick = () =>
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${searchString}${q}`)}`, "_blank", "noopener,noreferrer");
    }
  }

  placeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchPlace();
    }
  });
  if (keywordInput) {
    keywordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchPlace();
      }
    });
  }

  // Auto-search current location on page load
  if (!window.__locSearched) {
    window.__locSearched = true;
    setTimeout(() => {
      locBtn?.click();
    }, 600);
  }
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
  return `<div class="mini-card"><div class="flex justify-between"><div><div class="font-bold">${escapeHtml(d.name)}</div><div class="text-xs text-white/60">${escapeHtml(d.specialty)}</div></div><span class="badge">Active</span></div><div class="mt-4 flex gap-2"><a class="btn-primary flex-1 justify-center text-xs" href="tel:${d.phone}">Call</a></div></div>`;
}

function schemeCard(s) {
  return `<div class="mini-card"><div class="font-bold">${escapeHtml(s.title)}</div><div class="mt-2 text-xs text-white/70">${escapeHtml(s.summary)}</div></div>`;
}

async function loadDoctors() {
  const grid = $("#doctorsGrid"); if (!grid) return;
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
  const grid = $("#schemesGrid"); if (!grid) return;
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
  loadDoctors();
  loadSchemes();
}

function initProfile() {
  const btn = $("#profileBtn"), sidebar = $("#profileSidebar"), overlay = $("#profileOverlay"), close = $("#closeProfileBtn");
  if (!btn || !sidebar) return;
  btn.addEventListener("click", () => {
    sidebar.classList.remove("-translate-x-full");
    overlay?.classList.remove("hidden");
    switchSidebarTab('profile');
    loadInbox();
  });
  close?.addEventListener("click", () => {
    sidebar.classList.add("-translate-x-full");
    overlay?.classList.add("hidden");
  });
  overlay?.addEventListener("click", () => {
    sidebar.classList.add("-translate-x-full");
    overlay?.classList.add("hidden");
  });
}

function initBottomNav() {
  const path = window.location.pathname;
  $$("#bottomNav a").forEach(a => {
    if (a.getAttribute("href") === path) a.classList.add("active");
  });
}

function donorCard(d) {
  const bg = d.blood_group ? `<span class="badge">${escapeHtml(d.blood_group)}</span>` : `<span class="badge">--</span>`;
  const area = d.area ? `<div class="text-xs text-white/55 mt-1">${escapeHtml(d.area)}</div>` : "";
  return `
    <div class="mini-card ${isSelf ? 'ring-1 ring-mint-500 border-mint-500/30 bg-mint-500/5' : ''}">
      <div class="flex justify-between items-start">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <div class="font-bold truncate">${escapeHtml(d.name || "Donor")}</div>
            ${isSelf ? '<span class="text-[8px] px-1 py-0.5 rounded bg-mint-500/20 text-mint-400 border border-mint-500/20 font-bold uppercase">You</span>' : ''}
          </div>
          ${area}
        </div>
        <span class="badge shrink-0">${escapeHtml(d.blood_group || "--")}</span>
      </div>
      <button 
        class="mt-4 ${isSelf ? 'btn-ghost opacity-50 cursor-default' : 'btn-primary'} w-full justify-center text-xs" 
        ${isSelf ? 'disabled' : ''}
        data-donor-id="${escapeHtml(d.id)}" 
        data-donor-name="${escapeHtml(d.name || "Donor")}" 
        data-donor-bg="${escapeHtml(d.blood_group || "")}" 
        data-donor-area="${escapeHtml(d.area || "")}"
      >
        ${isSelf ? 'Public listing active' : 'Request Blood'}
      </button>
    </div>
  `;
}

function openRequestModal({ id, name, blood_group, area }) {
  const modal = $("#requestModal");
  const overlay = $("#requestOverlay");
  const panel = $("#requestPanel");
  if (!modal || !overlay || !panel) return;
  $("#requestDonorId").value = id;
  $("#requestDonorName").textContent = name;
  $("#requestDonorMeta").textContent = [blood_group, area].filter(Boolean).join(" • ");
  $("#requestReason").value = "";
  $("#requestMessage").value = "";
  $("#requestStatus").classList.add("hidden");
  $("#requestStatus").textContent = "";

  m.classList.remove("hidden");
  requestAnimationFrame(() => {
    o.classList.add("opacity-100");
    p.classList.remove("opacity-0", "translate-y-2");
  });
}

function closeRequestModal() {
  const m = $("#requestModal");
  const o = $("#requestOverlay");
  const p = $("#requestPanel");
  if (!m || !o || !p) return;

  o.classList.remove("opacity-100");
  p.classList.add("opacity-0", "translate-y-2");
  setTimeout(() => m.classList.add("hidden"), 300);
}

async function loadDonors() {
  const grid = $("#donorsGrid");
  const count = $("#donorsCount");
  if (!grid) return;
  grid.innerHTML = `<div class="text-xs text-white/40 text-center py-8">Searching donors...</div>`;
  const bg = $("#bloodGroupSelect")?.value || "";
  const area = ($("#donorAreaInput")?.value || "").trim();

  const qs = new URLSearchParams();
  if (bg) qs.set("blood_group", bg);
  if (area) qs.set("area", area);

  try {
    const res = await fetch(`/api/donors?${qs.toString()}`);
    const data = await res.json();
    const donors = data.donors || [];
    if (count) count.textContent = String(donors.length);
    grid.innerHTML = donors.map(donorCard).join("") || `<div class="text-sm text-white/70">No donors found.</div>`;

    grid.querySelectorAll("button[data-donor-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openRequestModal({
          id: btn.dataset.donorId,
          name: btn.dataset.donorName,
          blood_group: btn.dataset.donorBg,
          area: btn.dataset.donorArea
        });
      });
    });
  } catch {
    grid.innerHTML = `<div class="text-sm text-white/70">Couldn’t load donors.</div>`;
  }
}

async function submitDonorRequest(e) {
  e.preventDefault();
  const form = e.target;
  const btn = $("#submitRequestBtn");
  const status = $("#requestStatus");
  if (!form || !btn || !status) return;

  const fd = new FormData(form);
  btn.disabled = true;
  btn.textContent = "Sending…";
  status.classList.remove("hidden");
  status.textContent = "Submitting request…";

  try {
    const res = await fetch("/api/donor_requests", { method: "POST", body: new FormData(form) });
    const data = await res.json();
    if (!res.ok) {
      status.textContent = data?.error || "Failed to submit request.";
      return;
    }
    status.textContent = "Request sent successfully.";
    setTimeout(() => closeRequestModal(), 600);
  } catch {
    status.textContent = "Network error. Please try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Send request";
  }
}

function requestRow(r) {
  const who = r.requester?.name || r.requester?.email || "User";
  const meta = r.requester?.area ? ` • ${escapeHtml(r.requester.area)}` : "";
  const slip =
    r.has_slip && r.slip
      ? `<a class="text-xs text-skyx-200 hover:text-skyx-50 transition" href="/api/donor_requests/${escapeHtml(
        r.id
      )}/slip" target="_blank" rel="noreferrer">View slip ↗</a>`
      : `<div class="text-xs text-white/35">No slip</div>`;
  const badge =
    r.status === "pending"
      ? `<span class="badge">Pending</span>`
      : r.status === "accepted"
        ? `<span class="badge">Accepted</span>`
        : `<span class="badge">Rejected</span>`;
  const actions =
    r.status === "pending"
      ? `<div class="mt-3 grid grid-cols-2 gap-2">
          <button class="btn-primary w-full justify-center text-xs" data-action="accept" data-id="${escapeHtml(r.id)}">Accept</button>
          <button class="btn-ghost w-full justify-center text-xs" data-action="reject" data-id="${escapeHtml(r.id)}">Reject</button>
        </div>`
      : "";
  return `
    <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold truncate">${escapeHtml(who)}${meta}</div>
          <div class="mt-1 text-xs text-white/55">${escapeHtml(new Date(r.created_at).toLocaleString())}</div>
        </div>
        <div class="shrink-0 flex items-center gap-2">${badge}${slip}</div>
      </div>
      <div class="mt-3 text-sm text-white/80"><span class="text-white/60">Reason:</span> ${escapeHtml(r.reason || "")}</div>
      ${r.message ? `<div class="mt-2 text-sm text-white/70"><span class="text-white/60">Message:</span> ${escapeHtml(r.message)}</div>` : ""}
      ${actions}
    </div>
  `;
}

async function loadDonorRequests() {
  const list = $("#requestsList");
  if (!list) return;
  list.innerHTML = `<div class="text-sm text-white/70">Loading…</div>`;
  try {
    const res = await fetch("/api/donor_requests");
    const data = await res.json();
    const items = data.requests || [];
    list.innerHTML = items.map(requestRow).join("") || `<div class="text-sm text-white/70">No requests yet.</div>`;
    list.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const action = btn.getAttribute("data-action");
        const status = action === "accept" ? "accepted" : "rejected";
        btn.disabled = true;
        try {
          await fetch(`/api/donor_requests/${encodeURIComponent(id)}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });
          await loadDonorRequests();
        } finally {
          btn.disabled = false;
        }
      });
    });
  } catch {
    list.innerHTML = `<div class="text-sm text-white/70">Couldn’t load requests.</div>`;
  }
}

function initDonorsPage() {
  $("#searchDonorsBtn")?.addEventListener("click", loadDonors);
  $("#bloodGroupSelect")?.addEventListener("change", loadDonors);
  $("#donorAreaInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      loadDonors();
    }
  });

  $("#cancelRequestBtn")?.addEventListener("click", closeRequestModal);
  $("#requestForm")?.addEventListener("submit", submitDonorRequest);
  $("#refreshRequestsBtn")?.addEventListener("click", loadDonorRequests);

  if ($("#donorsGrid")) loadDonors();
  if ($("#requestsList")) loadDonorRequests();
}

async function updateAccountType(newType) {
  const slider = $("#typeSlider");
  const userBtn = $("#userTypeBtn");
  const donorBtn = $("#donorTypeBtn");
  const desc = $("#typeDesc");

  if (!slider || !userBtn || !donorBtn || !desc) return;

  try {
    const res = await fetch("/update-user-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_type: newType })
    });

    if (res.ok) {
      // Update UI
      if (newType === 'donor') {
        slider.classList.add("translate-x-full");
        donorBtn.classList.remove("text-white/50", "hover:text-white");
        donorBtn.classList.add("text-ink-950");
        userBtn.classList.remove("text-ink-950");
        userBtn.classList.add("text-white/50", "hover:text-white");
        desc.textContent = "Helping others with aid";
      } else {
        slider.classList.remove("translate-x-full");
        userBtn.classList.remove("text-white/50", "hover:text-white");
        userBtn.classList.add("text-ink-950");
        donorBtn.classList.remove("text-ink-950");
        donorBtn.classList.add("text-white/50", "hover:text-white");
        desc.textContent = "Seeking healthcare help";
      }
    } else {
      inboxBtn.classList.add("text-ink-950");
      inboxBtn.classList.remove("text-white/50", "hover:text-white");
      profileBtn.classList.remove("text-ink-950");
      profileBtn.classList.add("text-white/50", "hover:text-white");
    }
  } catch (err) {
    console.error("Error updating user type:", err);
  }
}

function switchSidebarTab(tab) {
  const profileTab = $("#profileTabBtn");
  const inboxTab = $("#inboxTabBtn");
  const slider = $("#sidebarTabSlider");
  const profileView = $("#profileViewMode");
  const inboxView = $("#inboxView");
  const editMode = $("#profileEditMode");
  const footer = $("#profileActionFooter");

  if (!slider || !profileTab || !inboxTab) return;

  if (tab === 'profile') {
    slider.style.transform = "translateX(0)";
    profileTab.classList.add("text-ink-950");
    profileTab.classList.remove("text-white/50");
    inboxTab.classList.remove("text-ink-950");
    inboxTab.classList.add("text-white/50");
    
    profileView.classList.remove("hidden");
    inboxView.classList.add("hidden");
    editMode.classList.add("hidden");
    footer.classList.remove("hidden");
    updateProfileFooter(false);
  } else {
    slider.style.transform = "translateX(100%)";
    inboxTab.classList.add("text-ink-950");
    inboxTab.classList.remove("text-white/50");
    profileTab.classList.remove("text-ink-950");
    profileTab.classList.add("text-white/50");
    
    profileView.classList.add("hidden");
    inboxView.classList.remove("hidden");
    editMode.classList.add("hidden");
    footer.classList.remove("hidden");
    updateProfileFooter(false);
    loadInbox();
  }
}

function updateProfileFooter(isEdit) {
  const viewActions = $("#viewModeActions");
  const editActions = $("#editModeActions");
  if (!viewActions || !editActions) return;
  
  if (isEdit) {
    viewActions.classList.add("hidden");
    editActions.classList.remove("hidden");
  } else {
    viewActions.classList.remove("hidden");
    editActions.classList.add("hidden");
  }
}

function toggleProfileEdit(isEdit) {
  const viewMode = $("#profileViewMode");
  const editMode = $("#profileEditMode");
  if (isEdit) {
    viewMode.classList.add("hidden");
    editMode.classList.remove("hidden");
    updateProfileFooter(true);
  } else {
    viewMode.classList.remove("hidden");
    editMode.classList.add("hidden");
    updateProfileFooter(false);
  }
}

async function saveProfileDetails(event) {
  event.preventDefault();
  const form = event.target;
  const btn = $("#saveProfileBtnProxy") || $("#saveProfileBtn");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving...";
  }

  try {
    const res = await fetch("/api/update-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    
    if (res.ok) {
      // Update the view mode labels immediately
      $("#view_name").textContent = data.name || "Not provided";
      $("#view_blood_group").textContent = data.blood_group || "--";
      $("#view_age").textContent = data.age || "--";
      $("#view_contact_no").textContent = data.contact_no || "Not provided";
      $("#view_area").textContent = data.area || "Not provided";
      
      toggleProfileEdit(false);
    } else {
      const d = await res.json();
      alert(d.error || "Could not update profile");
    }
  } catch (err) {
    console.error("Error saving profile:", err);
    alert("An error occurred. Please try again.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Save Changes";
    }
  }
}

async function loadInbox() {
  const container = $("#inboxMessages");
  if (!container) return;
  
  try {
    const res = await fetch("/api/donor_requests");
    const data = await res.json();
    const items = data.requests || [];
    
    if (items.length === 0) {
      container.innerHTML = `<div class="text-xs text-white/40 text-center py-8">No messages found.</div>`;
      return;
    }

    container.innerHTML = items.map(r => {
      const isDonor = r.is_for_me;
      const otherPart = isDonor ? (r.requester_name || "User") : (r.donor?.name || "Donor");
      const statusColor = r.status === 'accepted' ? 'text-mint-400' : r.status === 'rejected' ? 'text-rose-400' : 'text-skyx-400';
      
      return `
        <div class="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
          <div class="flex justify-between items-start">
            <div class="text-[10px] text-white/50 uppercase font-bold">${isDonor ? 'Requested By' : 'Request Sent To'}</div>
            <div class="text-[10px] ${statusColor} font-bold uppercase">${r.status}</div>
          </div>
          <div class="text-sm font-medium text-white/90">${escapeHtml(otherPart)}</div>
          <div class="text-[10px] text-white/40">${new Date(r.created_at).toLocaleDateString()}</div>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-400 text-center py-8">Failed to load inbox.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initSiteLanguage(); initMenu(); initReveal(); initChat(); initFloatingChat(); initFinder(); initData(); initProfile(); initBottomNav(); initDonorsPage();
});
