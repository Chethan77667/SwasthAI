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

function appendMessage({ role, html, imageSrc }) {
  const log = $("#chatLog");
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

function formatAssistantReply(reply) {
  const uses = (reply.uses || []).map((x) => `<div class="li">${escapeHtml(x)}</div>`).join("");
  const sideEffects = (reply.side_effects || []).map((x) => `<div class="li">${escapeHtml(x)}</div>`).join("");

  return `
    <div class="font-semibold text-mint-300 font-display text-lg">${escapeHtml(reply.medicine_name || "Medical Guidance")}</div>
    <div class="mt-2 text-white/90 leading-relaxed">${escapeHtml(reply.dosage || "")}</div>
    
    ${uses ? `
    <div class="list mt-4">
      <div class="text-[10px] text-white/40 uppercase tracking-[0.1em] font-bold">Uses / Guidance</div>
      ${uses}
    </div>` : ""}

    ${sideEffects ? `
    <div class="list mt-4">
      <div class="text-[10px] text-white/40 uppercase tracking-[0.1em] font-bold">Precautions / Risks</div>
      ${sideEffects}
    </div>` : ""}

    <div class="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs text-rose-200/80 leading-snug">
      <div class="flex items-center gap-2 mb-1.5 text-rose-400 font-bold uppercase tracking-wider text-[10px]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
        Important Warning
      </div>
      ${escapeHtml(reply.warnings || "This information is for guidance only. Consult a qualified doctor for medical advice.")}
    </div>
  `;
}

async function sendChat(message, imageFile) {
  const language = $("#languageSelect")?.value || "English";
  let imageSrc = null;
  if (imageFile) {
    imageSrc = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(imageFile);
    });
  }

  appendMessage({ role: "user", html: escapeHtml(message), imageSrc });

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
    const formData = new FormData();
    formData.append("message", message);
    formData.append("language", language);
    if (imageFile) {
      formData.append("image", imageFile);
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      body: formData,
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
  if (!log) {
    // If user clicks a prompt chip on landing page, route them to the chatbot page.
    const promptButtons = $$(".chip, .prompt-chip");
    for (const btn of promptButtons) {
      btn.addEventListener("click", () => {
        const prompt = btn.getAttribute("data-prompt");
        const url = new URL("/chatbot", window.location.origin);
        if (prompt) url.searchParams.set("prompt", prompt);
        window.location.href = url.toString();
      });
    }
    return;
  }

  appendMessage({
    role: "assistant",
    html: `<div class="font-semibold">Hi! I’m SwasthAI.</div>
      <div class="mt-2 text-white/80">Tell me your symptoms and I’ll share possible causes, precautions, and red flags.</div>`,
  });

  const imageInput = $("#imageInput");
  const imagePreview = $("#imagePreview");
  const previewImg = $("#previewImg");
  const removeImgBtn = $("#removeImgBtn");

  imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        imagePreview.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    }
  });

  removeImgBtn.addEventListener("click", () => {
    imageInput.value = "";
    imagePreview.classList.add("hidden");
    previewImg.src = "";
  });

  $("#chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#chatInput");
    const msg = (input.value || "").trim();
    const file = imageInput.files[0];

    if (!msg && !file) return;

    input.value = "";
    imageInput.value = "";
    imagePreview.classList.add("hidden");
    previewImg.src = "";

    await sendChat(msg, file);
  });

  const promptButtons = $$(".chip, .prompt-chip");
  for (const btn of promptButtons) {
    btn.addEventListener("click", async () => {
      const prompt = btn.getAttribute("data-prompt");
      if (!prompt) return;
      $("#chatInput").value = prompt;
      $("#chatInput").focus();
      await sendChat(prompt);
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
  if (!locBtn || !openMapsBtn || !status || !mapFrame || !placeInput || !placeSearchBtn || !hospitalsList || !apiBadge) return;

  let coords = null;

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

  function setApiMode(mode) {
    apiBadge.textContent = mode;
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
      hospitalsList.innerHTML = `<div class="text-white/55 text-sm">No hospitals found.</div>`;
      return;
    }
    hospitalsList.innerHTML = items.map(hospitalRow).join("");
  }

  async function fetchHospitalsByCoords(lat, lng, label) {
    coords = { latitude: lat, longitude: lng };
    status.textContent = label || `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
    setMapsUrl(lat, lng);

    try {
      const res = await fetch(`/api/nearby_hospitals?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=6000`);
      const data = await res.json();
      if (res.ok) {
        setApiMode("Places API");
        renderHospitals(data.results || []);
        return;
      }
      setApiMode("Fallback");
      renderHospitals([]);
    } catch {
      setApiMode("Fallback");
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
      setMapsUrl(lat, lng, "hospital");
      await fetchHospitalsByCoords(lat, lng, data.formatted_address || q);
      return;
    } catch {
      // Fallback: just open Google Maps search for the typed place.
      setApiMode("Fallback");
      hospitalsList.innerHTML = `
        <div class="text-white/55 text-sm">API key not set (or request failed). Using Google Maps search link instead.</div>
        <a class="mt-2 inline-flex text-sm text-skyx-200 hover:text-skyx-50 transition" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `hospital in ${q}`
        )}" target="_blank" rel="noreferrer">Search “hospital in ${escapeHtml(q)}” ↗</a>
      `;
      mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(`hospital in ${q}`)}&output=embed`;
      openMapsBtn.disabled = false;
      openMapsBtn.onclick = () =>
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hospital in ${q}`)}`, "_blank", "noopener,noreferrer");
    }
  }

  placeSearchBtn.addEventListener("click", searchPlace);
  placeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchPlace();
    }
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

function initProfile() {
  const profileBtn = $("#profileBtn");
  const profileSidebar = $("#profileSidebar");
  const profileOverlay = $("#profileOverlay");
  const closeProfileBtn = $("#closeProfileBtn");

  if (!profileBtn || !profileSidebar || !profileOverlay || !closeProfileBtn) return;

  const openProfile = () => {
    profileSidebar.classList.remove("-translate-x-full");
    profileOverlay.classList.remove("hidden");
    // Force a reflow to trigger transition
    profileOverlay.offsetHeight;
    profileOverlay.classList.add("opacity-100");
    document.body.style.overflow = "hidden";
  };

  const closeProfile = () => {
    profileSidebar.classList.add("-translate-x-full");
    profileOverlay.classList.remove("opacity-100");
    document.body.style.overflow = "";
    setTimeout(() => {
      if (profileSidebar.classList.contains("-translate-x-full")) {
        profileOverlay.classList.add("hidden");
      }
    }, 500);
  };

  profileBtn.addEventListener("click", openProfile);
  closeProfileBtn.addEventListener("click", closeProfile);
  profileOverlay.addEventListener("click", closeProfile);
}

function initBottomNav() {
  const nav = $("#bottomNav");
  if (!nav) return;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  nav.querySelectorAll("a[data-path]").forEach((a) => {
    const p = (a.getAttribute("data-path") || "").replace(/\/+$/, "") || "/";
    if (p === path) a.classList.add("active");
  });
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
      console.error("Failed to update user type");
    }
  } catch (err) {
    console.error("Error updating user type:", err);
  }
}

function toggleProfileEdit(isEdit) {
  const viewMode = $("#profileViewMode");
  const editMode = $("#profileEditMode");
  if (isEdit) {
    viewMode.classList.add("hidden");
    editMode.classList.remove("hidden");
  } else {
    viewMode.classList.remove("hidden");
    editMode.classList.add("hidden");
  }
}

async function saveProfileDetails(event) {
  event.preventDefault();
  const form = event.target;
  const btn = $("#saveProfileBtn");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const res = await fetch("/api/update-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (res.ok) {
      // Update the view fields
      $("#view_name").textContent = data.name;
      $("#view_blood_group").textContent = data.blood_group;
      $("#view_age").textContent = data.age;
      $("#view_contact_no").textContent = data.contact_no;
      $("#view_area").textContent = data.area;
      
      toggleProfileEdit(false);
    } else {
      alert("Failed to save profile. Please try again.");
    }
  } catch (err) {
    console.error("Error saving profile:", err);
    alert("An error occurred. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Changes";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMenu();
  initReveal();
  initChat();
  initFinder();
  initData();
  initProfile();
  initBottomNav();
});

