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
  $("#locBtn")?.addEventListener("click", () => {
    navigator.geolocation.getCurrentPosition(p => {
      const { latitude: lat, longitude: lng } = p.coords;
      $("#mapFrame").src = `https://www.google.com/maps?q=hospital+near+${lat},${lng}&output=embed`;
    });
  });
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
    const res = await fetch("/api/doctors"); const data = await res.json();
    grid.innerHTML = data.doctors.map(doctorCard).join("");
  } catch(e) {}
}

async function loadSchemes() {
  const grid = $("#schemesGrid"); if (!grid) return;
  try {
    const res = await fetch("/api/schemes"); const data = await res.json();
    grid.innerHTML = data.schemes.map(schemeCard).join("");
  } catch(e) {}
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
  const currentUserId = document.body.getAttribute("data-user-id");
  const isSelf = d.id === currentUserId;
  const area = d.area ? `<div class="text-xs text-white/50">${escapeHtml(d.area)}</div>` : "";
  
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

function openRequestModal(d) {
  const m = $("#requestModal");
  const o = $("#requestOverlay");
  const p = $("#requestPanel");
  if (!m || !o || !p) return;
  
  $("#requestDonorId").value = d.id;
  $("#requestDonorName").textContent = d.name;
  $("#requestDonorMeta").textContent = `${d.blood_group || '--'} • ${d.area || 'No location'}`;
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
    grid.innerHTML = donors.map(donorCard).join("") || `<div class="text-xs text-white/40 text-center py-8 uppercase tracking-widest">No donors found</div>`;
    
    // Add event listeners for Request Blood buttons
    grid.querySelectorAll("button[data-donor-id]:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        openRequestModal({
          id: btn.dataset.donorId,
          name: btn.dataset.donorName,
          blood_group: btn.dataset.donorBg,
          area: btn.dataset.donorArea
        });
      });
    });
  } catch(e) {
    grid.innerHTML = `<div class="text-xs text-rose-500/60 text-center py-8">Couldn't load donors</div>`;
  }
}

async function submitDonorRequest(e) {
  e.preventDefault();
  const form = e.target;
  const btn = $("#submitRequestBtn");
  btn.disabled = true; 
  btn.textContent = "Sending...";
  try {
    const res = await fetch("/api/donor_requests", { method: "POST", body: new FormData(form) });
    const data = await res.json();
    if (res.ok) { 
      closeRequestModal(); 
      loadInbox(); 
      if ($("#requestsList")) loadDonorRequests();
    }
    else { alert(data.error || "Error"); }
  } catch(e) {} finally { btn.disabled = false; btn.textContent = "Request Blood"; }
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

async function updateAccountType(type) {
  try {
    const res = await fetch("/update-user-type", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_type: type }) });
    if (res.ok) window.location.reload();
  } catch(e) {}
}

function toggleProfileEdit(on) {
  $("#profileViewMode")?.classList.toggle("hidden", on);
  $("#profileEditMode")?.classList.toggle("hidden", !on);
}

async function saveProfileDetails(e) {
  e.preventDefault();
  const btn = $("#saveProfileBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";
  try {
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    const res = await fetch("/api/update-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) {
      $("#view_name").textContent = data.name;
      $("#view_blood_group").textContent = data.blood_group;
      $("#view_age").textContent = data.age;
      $("#view_contact_no").textContent = data.contact_no;
      $("#view_area").textContent = data.area;
      toggleProfileEdit(false);
    } else {
      alert("Failed to save profile.");
    }
  } catch(e) {} finally {
    btn.disabled = false;
    btn.textContent = "Save Changes";
  }
}

function switchSidebarTab(tab) {
  const isProfile = tab === 'profile';
  const profileMode = $("#profileViewMode");
  const inboxMode = $("#inboxView");
  const slider = $("#sidebarTabSlider");
  const profileBtn = $("#profileTabBtn");
  const inboxBtn = $("#inboxTabBtn");

  if (profileMode) profileMode.classList.toggle("hidden", !isProfile);
  if (inboxMode) inboxMode.classList.toggle("hidden", isProfile);
  if (slider) slider.classList.toggle("translate-x-full", !isProfile);
  
  if (profileBtn && inboxBtn) {
    if (isProfile) {
      profileBtn.classList.add("text-ink-950");
      profileBtn.classList.remove("text-white/50", "hover:text-white");
      inboxBtn.classList.remove("text-ink-950");
      inboxBtn.classList.add("text-white/50", "hover:text-white");
    } else {
      inboxBtn.classList.add("text-ink-950");
      inboxBtn.classList.remove("text-white/50", "hover:text-white");
      profileBtn.classList.remove("text-ink-950");
      profileBtn.classList.add("text-white/50", "hover:text-white");
    }
  }

  if (!isProfile) loadInbox();
}

async function loadInbox() {
  const c = $("#inboxMessages"); if (!c) return;
  c.innerHTML = `<div class="text-[10px] text-white/40 text-center py-8 uppercase tracking-widest">Updating inbox...</div>`;
  try {
    const res = await fetch("/api/donor_requests");
    const data = await res.json();
    if (!data.requests || data.requests.length === 0) {
      c.innerHTML = `<div class="text-[10px] text-white/40 text-center py-8">No messages yet</div>`;
      return;
    }
    c.innerHTML = data.requests.map(r => {
      const isDonor = r.is_for_me;
      const status = r.status;
      const other = isDonor ? r.requester_name : r.donor?.name;
      const num = status === 'accepted' ? (isDonor ? r.requester?.contact_no : r.donor?.contact_no) : null;
      
      let feedbackHtml = '';
      if (!isDonor && status === 'accepted') {
        if (r.feedback) {
          feedbackHtml = `<div class="mt-3 flex items-center justify-end gap-2 text-[9px] font-bold text-mint-400 bg-mint-400/5 py-1 px-3 rounded-lg border border-mint-400/10">
            <span>Rated: ${r.feedback.toUpperCase()}</span>
            ${r.feedback === 'like' ? '👍' : '👎'}
          </div>`;
        } else {
          feedbackHtml = `
          <div class="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
            <span class="text-[9px] text-white/30 uppercase font-bold tracking-wider">Rate donor experience:</span>
            <div class="flex gap-2">
              <button onclick="submitFeedback('${r.id}', 'like')" class="h-7 w-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-mint-500/20 hover:border-mint-500/50 transition group" title="Like">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="text-mint-500 group-hover:scale-110 transition"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <button onclick="submitFeedback('${r.id}', 'dislike')" class="h-7 w-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-rose-500/20 hover:border-rose-500/50 transition group" title="Dislike">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="text-rose-400 group-hover:scale-110 transition" style="transform: scaleY(-1)"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>`;
        }
      }

      return `
      <div class="p-4 rounded-2xl bg-white/5 mb-3 border border-white/10 transition-all duration-300 hover:bg-white/[0.08] hover:-translate-y-0.5 shadow-lg shadow-black/20">
        <div class="flex justify-between items-start text-[10px] mb-2.5">
          <span class="px-2 py-0.5 rounded-full bg-white/5 text-white/40 uppercase font-black tracking-widest text-[8px]">${isDonor ? 'Received' : 'Sent'}</span>
          <span class="font-bold uppercase tracking-widest ${status === 'accepted' ? 'text-mint-500' : status === 'rejected' ? 'text-rose-500' : 'text-skyx-500'} bg-${status === 'accepted' ? 'mint' : status === 'rejected' ? 'rose' : 'skyx'}-500/10 px-2 py-0.5 rounded-full">${status}</span>
        </div>
        <div class="text-[13px] font-bold text-white/95 truncate mb-1 uppercase tracking-tight">${escapeHtml(other || "User")}</div>
        <div class="text-[11px] text-white/45 italic leading-relaxed line-clamp-3 mb-3">"${escapeHtml(r.reason)}"</div>
        ${num ? `<div class="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
          <span class="text-[10px] text-white/30 font-medium uppercase tracking-wider">Contact Number</span>
          <a href="tel:${num}" class="text-mint-400 bg-mint-400/10 px-3 py-1 rounded-xl border border-mint-400/20 font-bold text-[11px] transition-colors hover:bg-mint-400/20">${num}</a>
        </div>` : ''}
        ${isDonor && status === 'pending' ? `<div class="mt-3 flex gap-2 pt-3 border-t border-white/5">
          <button onclick="handleRequestStatus('${r.id}','accepted')" class="btn-primary py-2 px-3 text-[10px] flex-1 justify-center rounded-xl shadow-lg shadow-mint-500/20 font-black uppercase tracking-widest">Accept</button>
          <button onclick="handleRequestStatus('${r.id}','rejected')" class="btn-ghost py-2 px-3 text-[10px] flex-1 justify-center rounded-xl font-black uppercase tracking-widest">Reject</button>
        </div>` : ''}
        ${feedbackHtml}
      </div>`;
    }).join("");
  } catch(e) {
    c.innerHTML = `<div class="text-[10px] text-rose-500/60 text-center py-8">Error loading inbox content</div>`;
  }
}

async function submitFeedback(rid, type) {
  try {
    const res = await fetch(`/api/donor_requests/${rid}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: type })
    });
    if (res.ok) {
      loadInbox();
    } else {
      const d = await res.json();
      alert(d.error || "Could not submit feedback");
    }
  } catch(e) {
    alert("System error. Please try again.");
  }
}

async function handleRequestStatus(id, status) {
  try {
    const res = await fetch(`/api/donor_requests/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) loadInbox();
  } catch(e) {}
}

document.addEventListener("DOMContentLoaded", () => {
  initSiteLanguage(); initMenu(); initReveal(); initChat(); initFloatingChat(); initFinder(); initData(); initProfile(); initBottomNav(); initDonorsPage();
});
