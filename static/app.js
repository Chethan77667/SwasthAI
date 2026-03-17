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
  if (!log) return;
  appendMessageToLog(log, { role, html, imageSrc });
}

function appendMessageToLog(log, { role, html, imageSrc }) {
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

function isNewFormat(reply) {
  return reply && (typeof reply.type === "string" || typeof reply.title === "string" || Array.isArray(reply.points));
}

function normalizeReply(reply) {
  if (isNewFormat(reply)) {
    return {
      type: reply.type || "general",
      title: reply.title || "SwasthAI",
      description: reply.description || "",
      points: Array.isArray(reply.points) ? reply.points : [],
      action: reply.action || "",
      warning: reply.warning || "",
    };
  }

  // Backward-compat (older schema)
  return {
    type: "medical",
    title: reply?.medicine_name || "Medical Guidance",
    description: reply?.dosage || "",
    points: Array.isArray(reply?.uses) ? reply.uses : [],
    action: "",
    warning: reply?.warnings || "This information is for guidance only. Consult a qualified doctor for medical advice.",
  };
}

function formatAssistantReply(reply) {
  const r = normalizeReply(reply || {});
  const pts = (r.points || []).slice(0, 5).map((x) => `<div class="li">${escapeHtml(x)}</div>`).join("");

  return `
    <div class="flex items-center justify-between gap-3">
      <div class="font-semibold text-mint-300 font-display text-lg">${escapeHtml(r.title || "SwasthAI")}</div>
      <div class="badge">${escapeHtml((r.type || "general").toLowerCase())}</div>
    </div>
    ${r.description ? `<div class="mt-2 text-white/90 leading-relaxed">${escapeHtml(r.description)}</div>` : ""}
    
    ${pts ? `
    <div class="list mt-4">
      <div class="text-[10px] text-white/40 uppercase tracking-[0.1em] font-bold">Key points</div>
      ${pts}
    </div>` : ""}

    ${r.action ? `
      <div class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-sm text-white/80">
        <div class="text-[10px] text-white/40 uppercase tracking-[0.1em] font-bold">Next action</div>
        <div class="mt-1">${escapeHtml(r.action)}</div>
      </div>
    ` : ""}

    ${r.warning ? `
    <div class="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs text-rose-200/80 leading-snug">
      <div class="flex items-center gap-2 mb-1.5 text-rose-400 font-bold uppercase tracking-wider text-[10px]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
        Note
      </div>
      ${escapeHtml(r.warning)}
    </div>
    ` : ""}
  `;
}

function typingDotsHtml(label = "Typing") {
  return `
    <div class="typing">
      <span class="typing-label">${escapeHtml(label)}</span>
      <span class="typing-dots" aria-hidden="true">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      </span>
    </div>
  `;
}

function tryPlayPing() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 740;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    const t0 = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.stop(t0 + 0.2);
    setTimeout(() => ctx.close?.(), 250);
  } catch {
    // ignore
  }
}

function getQuickLocalReply(message) {
  const t = String(message || "").trim().toLowerCase();
  if (!t) return null;

  const isHi = /^(hi|hello|hey|hii|hlo)\b/.test(t) || t === "hi" || t === "hello";
  if (isHi) {
    return {
      type: "general",
      title: "Hi 👋 I'm SwasthAI Assistant.",
      description: "I can help you with:",
      points: ["Find doctors 🏥", "Blood donors 🩸", "Government schemes 📄", "Health questions 💊"],
      action: "Tell me what you need today (doctor / blood / schemes / symptoms).",
      warning: "For emergencies, visit the nearest hospital or call local emergency services.",
      _intent: "greeting",
    };
  }

  if (t.includes("doctor")) {
    return {
      type: "feature",
      title: "Find a doctor 🏥",
      description: "You can use the Doctors section to contact available doctors.",
      points: ["Open the Doctors section", "Choose specialty", "Call or WhatsApp"],
      action: "Scroll to the Doctors section now.",
      warning: "For severe symptoms, seek urgent medical care.",
      _intent: "doctor",
    };
  }

  if (t.includes("blood") || t.includes("donor")) {
    return {
      type: "feature",
      title: "Need blood 🩸",
      description: "Use the Blood Donor system to request donors and share your details.",
      points: ["Mention blood group", "Share location/area", "Add contact number", "Urgency + hospital name (if available)"],
      action: "Tell me: blood group + city/area + contact number.",
      warning: "If it’s an emergency, go to the nearest hospital immediately.",
      _intent: "blood",
    };
  }

  if (t.includes("scheme") || t.includes("schemes") || t.includes("government") || t.includes("govt")) {
    return {
      type: "feature",
      title: "Government schemes 📄",
      description: "You can check the Schemes section for available programs and how to use them.",
      points: ["Open Schemes section", "Read eligibility/summary", "Follow the ‘How to use’ steps"],
      action: "Scroll to the Schemes section now.",
      warning: "Always verify the latest eligibility at official sources or your nearest health center.",
      _intent: "schemes",
    };
  }

  return null;
}

async function sendChat(message, imageFile, opts = {}) {
  const logEl = opts.logEl || $("#chatLog");
  if (!logEl) return;
  const language = $("#languageSelect")?.value || "English";
  let imageSrc = null;
  if (imageFile) {
    imageSrc = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(imageFile);
    });
  }

  appendMessageToLog(logEl, { role: "user", html: escapeHtml(message), imageSrc });

  // Local "real chatbot" behavior for common intents (instant replies)
  if (!imageFile) {
    const local = getQuickLocalReply(message);
    if (local) {
      appendMessageToLog(logEl, { role: "assistant", html: formatAssistantReply(local) });
      if (opts.playSound) tryPlayPing();
      if (local._intent === "doctor") location.hash = "#doctors";
      if (local._intent === "schemes") location.hash = "#schemes";
      return;
    }
  }

  const thinkingId = `thinking-${Math.random().toString(16).slice(2)}`;
  const thinking = document.createElement("div");
  thinking.className = "msg";
  thinking.id = thinkingId;
  thinking.innerHTML = `
    <div class="meta">SwasthAI • ${nowLabel()}</div>
    <div class="bubble assistant"><div class="text-white/80 text-sm mb-1">Typing…</div>${typingDotsHtml("")}</div>
  `;
  logEl.appendChild(thinking);
  logEl.scrollTop = logEl.scrollHeight;

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
      appendMessageToLog(logEl, {
        role: "assistant",
        html: `<div class="font-semibold">Couldn’t process</div><div class="mt-2 text-white/80">${escapeHtml(data?.error || "Please try again.")}</div>`,
      });
      return;
    }

    appendMessageToLog(logEl, { role: "assistant", html: formatAssistantReply(data.reply || {}) });
    if (opts.playSound) tryPlayPing();
  } catch (e) {
    thinking.remove();
    appendMessageToLog(logEl, {
      role: "assistant",
      html: `<div class="font-semibold">Network issue</div><div class="mt-2 text-white/80">Please check your connection and try again.</div>`,
    });
  }
}

function initChat() {
  const log = $("#chatLog");
  if (!log) return;

  appendMessageToLog(log, {
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
      location.hash = "#chat";
    });
  }
}

function initFloatingChat() {
  const btn = $("#floatChatBtn");
  const box = $("#floatChatBox");
  const close = $("#floatChatClose");
  const msgs = $("#floatChatMessages");
  const input = $("#floatChatInput");
  const sendBtn = $("#floatChatSend");
  const sug = $$("#floatChatBox [data-float-prompt]");

  if (!btn || !box || !msgs || !input || !sendBtn) return;

  const open = () => {
    box.classList.remove("hidden");
    box.classList.add("animate-fadeIn");
    input.focus();
  };
  const hide = () => {
    box.classList.add("hidden");
  };

  btn.addEventListener("click", () => {
    if (box.classList.contains("hidden")) open();
    else hide();
  });
  close?.addEventListener("click", hide);

  // Seed greeting once
  if (!msgs.dataset.seeded) {
    msgs.dataset.seeded = "1";
    appendMessageToLog(msgs, {
      role: "assistant",
      html: `
        <div class="font-semibold">Hi 👋 I'm SwasthAI Assistant.</div>
        <div class="mt-2 text-white/80">I can help you with:</div>
        <div class="mt-2 text-white/80">• Find doctors 🏥<br>• Blood donors 🩸<br>• Government schemes 📄<br>• Health questions 💊</div>
        <div class="mt-3 text-white/80">What do you need today?</div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="chip" data-quick="Find doctor">Find Doctor</button>
          <button type="button" class="chip" data-quick="Need blood">Need Blood</button>
          <button type="button" class="chip" data-quick="Government schemes">Schemes</button>
        </div>
      `,
    });
  }

  // Auto open + greeting on site load
  if (!window.__floatChatAutoOpened) {
    window.__floatChatAutoOpened = true;
    setTimeout(() => {
      open();
    }, 1500);
  }

  const doSend = async () => {
    const msg = (input.value || "").trim();
    if (!msg) return;
    input.value = "";
    await sendChat(msg, null, { logEl: msgs, playSound: true });
  };

  sendBtn.addEventListener("click", doSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSend();
    }
  });

  for (const b of sug) {
    b.addEventListener("click", async () => {
      const p = b.getAttribute("data-float-prompt");
      if (!p) return;
      await sendChat(p, null, { logEl: msgs, playSound: true });
    });
  }

  // Smart suggestion buttons inside greeting bubble
  msgs.addEventListener("click", async (e) => {
    const t = e.target?.getAttribute?.("data-quick");
    if (!t) return;
    await sendChat(t, null, { logEl: msgs, playSound: true });
  });
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

document.addEventListener("DOMContentLoaded", () => {
  initMenu();
  initReveal();
  initChat();
  initFloatingChat();
  initFinder();
  initData();
  initProfile();
});

