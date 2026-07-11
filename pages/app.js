const SUPABASE_URL = "https://nyelvtrxahtoxfomgdyq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZWx2dHJ4YWh0b3hmb21nZHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTAzNTIsImV4cCI6MjA5OTMyNjM1Mn0.7LCJwYh74ro_eWpjPDxZJG2dReu6JA_j-AP-k9tk--s";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true } // حفظ الجلسة تلقائياً
});

// ------------------------- حالة عامة للتطبيق -------------------------
const state = {
  currentUser: null,      // بيانات المستخدم المسجل دخوله (auth)
  currentProfile: null,   // صف profiles الخاص بالمستخدم الحالي
  adminProfile: null,     // (لواجهة المستخدم العادي) بيانات الأدمن الذي يراسله
  conversations: {},      // (للأدمن) خريطة userId -> { profile, lastMessage, unread, messages: [] }
  selectedUserId: null,   // (للأدمن) هوية المستخدم المحادَث حالياً
  mediaRecorder: null,
  recordedChunks: [],
  recordTimerInterval: null,
};

const EMOJIS = ["😀","😁","😂","🤣","😊","😍","😘","😜","🤔","😎",
                "😢","😭","😡","👍","👏","🙏","🔥","🎉","❤️","💯",
                "😅","🥰","😴","🤗","😬","🤝","👋","✅","⭐","💬"];

// =====================================================================
// أدوات مساعدة عامة
// =====================================================================

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return ctx.querySelectorAll(sel); }

function showScreen(id) {
  $all(".screen").forEach(s => s.classList.remove("active"));
  $(`#${id}`).classList.add("active");
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const isSameDay = d.toDateString() === today.toDateString();
  if (isSameDay) return "اليوم";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
}

// تشغيل صوت تنبيه قصير عبر Web Audio API (بدون الحاجة لملف صوتي خارجي)
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) { /* المتصفح لا يدعم AudioContext - تجاهل بصمت */ }
}

// =====================================================================
// تسجيل الدخول واستعادة الجلسة
// =====================================================================

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await handleAuthenticatedUser(session.user);
  } else {
    showScreen("login-screen");
  }
}

// ------------------------- وضع النموذج: تسجيل دخول أو إنشاء حساب -------------------------
let authMode = "login"; // "login" | "signup"

$("#toggle-mode-link").addEventListener("click", (e) => {
  e.preventDefault();
  authMode = authMode === "login" ? "signup" : "login";
  $("#login-btn").textContent = authMode === "login" ? "تسجيل الدخول" : "إنشاء الحساب";
  $("#mode-question").textContent = authMode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟";
  $("#toggle-mode-link").textContent = authMode === "login" ? "إنشاء حساب جديد" : "تسجيل الدخول";
  $("#login-error").textContent = "";
  $("#login-success").textContent = "";
});

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const btn = $("#login-btn");
  const errorEl = $("#login-error");
  const successEl = $("#login-success");
  errorEl.textContent = "";
  successEl.textContent = "";
  btn.disabled = true;

  if (authMode === "signup") {
    btn.textContent = "جاري إنشاء الحساب...";
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    btn.disabled = false;
    btn.textContent = "إنشاء الحساب";

    if (error) {
      errorEl.textContent = "تعذر إنشاء الحساب: " + error.message;
      return;
    }

    // إذا كان تأكيد البريد مفعّلاً في إعدادات Supabase، لن تُوجد جلسة فورية
    if (!data.session) {
      successEl.textContent = "تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتأكيده قبل تسجيل الدخول.";
      return;
    }
    // تأكيد البريد معطّل: الحساب مسجَّل دخوله فوراً
    await handleAuthenticatedUser(data.user);
    return;
  }

  btn.textContent = "جاري الدخول...";
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = "تسجيل الدخول";

  if (error) {
    errorEl.textContent = "بيانات الدخول غير صحيحة، حاول مرة أخرى.";
    return;
  }
  await handleAuthenticatedUser(data.user);
});

async function handleAuthenticatedUser(user) {
  state.currentUser = user;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    $("#login-error").textContent = "تعذر العثور على بيانات الحساب.";
    return;
  }
  state.currentProfile = profile;

  if (profile.role === "admin") {
    await bootAdminInterface();
  } else {
    await bootUserInterface();
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  state.currentUser = null;
  state.currentProfile = null;
  location.reload(); // إعادة تحميل بسيطة لتصفير كل الاشتراكات الفورية
}
$("#user-logout-btn").addEventListener("click", logout);
$("#admin-logout-btn").addEventListener("click", logout);

// =====================================================================
// شريط الإدخال المشترك (نص، إيموجي، ملفات، تسجيل صوتي)
// يُستنسخ من <template> لكل واجهة (المستخدم/الأدمن) مع ربط أحداثه
// =====================================================================

function mountInputBar(containerEl, onSend) {
  const tpl = $("#input-bar-template").content.cloneNode(true);
  containerEl.innerHTML = "";
  containerEl.appendChild(tpl);

  const inner = $(".input-bar-inner", containerEl);
  const emojiPanel = $(".emoji-panel", containerEl);
  const recIndicator = $(".recording-indicator", containerEl);
  const textInput = $(".text-input", containerEl);
  const fileInput = $(".file-input", containerEl);

  // تعبئة لوحة الإيموجي
  emojiPanel.innerHTML = EMOJIS
    .map(e => `<span class="emoji-item">${e}</span>`)
    .join("");
  emojiPanel.addEventListener("click", (e) => {
    if (e.target.classList.contains("emoji-item")) {
      textInput.value += e.target.textContent;
      textInput.focus();
    }
  });

  $(".emoji-toggle", containerEl).addEventListener("click", () => {
    emojiPanel.classList.toggle("hidden");
  });

  // إرسال نص عند الضغط على زر الإرسال أو Enter
  $(".send-btn", containerEl).addEventListener("click", () => sendText());
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendText(); }
  });
  function sendText() {
    const val = textInput.value.trim();
    if (!val) return;
    onSend({ content: val });
    textInput.value = "";
    emojiPanel.classList.add("hidden");
  }

  // رفع صورة أو ملف
  $(".attach-toggle", containerEl).addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const url = await uploadMedia(file);
    if (url) {
      const mediaType = file.type.startsWith("image/") ? "image" : "file";
      onSend({ content: "", media_url: url, media_type: mediaType });
    }
    fileInput.value = "";
  });

  // تسجيل صوتي
  const micBtn = $(".mic-btn", containerEl);
  micBtn.addEventListener("click", () => startRecording(containerEl, onSend));
  $(".cancel-rec-btn", containerEl).addEventListener("click", () => stopRecording(containerEl, false, onSend));
  $(".send-rec-btn", containerEl).addEventListener("click", () => stopRecording(containerEl, true, onSend));
}

async function startRecording(containerEl, onSend) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recordedChunks = [];
    state.mediaRecorder = new MediaRecorder(stream);
    state.mediaRecorder.ondataavailable = (e) => state.recordedChunks.push(e.data);
    state.mediaRecorder.start();

    $(".input-bar-inner", containerEl).style.display = "none";
    const recIndicator = $(".recording-indicator", containerEl);
    recIndicator.classList.remove("hidden");

    let seconds = 0;
    const timerEl = $(".rec-timer", containerEl);
    state.recordTimerInterval = setInterval(() => {
      seconds++;
      const m = String(Math.floor(seconds / 60)).padStart(2, "0");
      const s = String(seconds % 60).padStart(2, "0");
      timerEl.textContent = `${m}:${s}`;
    }, 1000);

    // حفظ مرجع onSend للاستخدام عند الإرسال
    containerEl._pendingSendCb = onSend;
  } catch (err) {
    alert("تعذر الوصول إلى الميكروفون. تأكد من منح الإذن اللازم.");
  }
}

function stopRecording(containerEl, shouldSend, onSend) {
  clearInterval(state.recordTimerInterval);
  const recIndicator = $(".recording-indicator", containerEl);
  recIndicator.classList.add("hidden");
  $(".input-bar-inner", containerEl).style.display = "flex";
  $(".rec-timer", containerEl).textContent = "00:00";

  if (!state.mediaRecorder) return;

  state.mediaRecorder.onstop = async () => {
    if (shouldSend && state.recordedChunks.length) {
      const blob = new Blob(state.recordedChunks, { type: "audio/webm" });
      const fileName = `voice_${Date.now()}.webm`;
      const file = new File([blob], fileName, { type: "audio/webm" });
      const url = await uploadMedia(file);
      if (url) onSend({ content: "", media_url: url, media_type: "audio" });
    }
    state.mediaRecorder.stream.getTracks().forEach(t => t.stop());
    state.mediaRecorder = null;
    state.recordedChunks = [];
  };
  state.mediaRecorder.stop();
}

// رفع ملف إلى Supabase Storage وإرجاع الرابط العام
async function uploadMedia(file) {
  const path = `${state.currentUser.id}/${Date.now()}_${file.name}`;
  const { error } = await supabaseClient.storage.from("chat-media").upload(path, file);
  if (error) {
    alert("فشل رفع الملف: " + error.message);
    return null;
  }
  const { data } = supabaseClient.storage.from("chat-media").getPublicUrl(path);
  return data.publicUrl;
}

// =====================================================================
// عرض فقاعة رسالة واحدة (مشترك بين الواجهتين)
// =====================================================================

function renderMessageBubble(msg, isOutgoing) {
  const row = document.createElement("div");
  row.className = `msg-row ${isOutgoing ? "out" : "in"}`;
  row.dataset.id = msg.id;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${isOutgoing ? "out" : "in"}`;

  let mediaHtml = "";
  if (msg.media_url) {
    if (msg.media_type === "image") {
      mediaHtml = `<img src="${msg.media_url}" alt="صورة">`;
    } else if (msg.media_type === "audio") {
      mediaHtml = `<audio controls src="${msg.media_url}"></audio>`;
    } else {
      mediaHtml = `<a href="${msg.media_url}" target="_blank" rel="noopener">📎 فتح الملف</a>`;
    }
  }

  const textHtml = msg.content ? `<div class="text">${escapeHtml(msg.content)}</div>` : "";

  let ticksHtml = "";
  if (isOutgoing) {
    const tickChar = msg.status === "sent" ? "✓" : "✓✓";
    const readClass = msg.status === "read" ? "read" : "";
    ticksHtml = `<span class="ticks ${readClass}">${tickChar}</span>`;
  }

  bubble.innerHTML = `
    ${mediaHtml}
    ${textHtml}
    <div class="meta">
      <span class="time">${formatTime(msg.created_at)}</span>
      ${ticksHtml}
    </div>
  `;
  row.appendChild(bubble);
  return row;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function appendMessagesWithDayDividers(container, messages) {
  container.innerHTML = "";
  let lastDay = null;
  messages.forEach(msg => {
    const dayLabel = formatDayLabel(msg.created_at);
    if (dayLabel !== lastDay) {
      const divider = document.createElement("div");
      divider.className = "day-divider";
      divider.textContent = dayLabel;
      container.appendChild(divider);
      lastDay = dayLabel;
    }
    const isOutgoing = msg.sender_id === state.currentUser.id;
    container.appendChild(renderMessageBubble(msg, isOutgoing));
  });
  scrollToBottom(container);
}

function scrollToBottom(container) {
  container.scrollTop = container.scrollHeight;
}

// =====================================================================
// واجهة المستخدم العادي
// =====================================================================

async function bootUserInterface() {
  $("#my-identity").textContent = state.currentProfile.email;

  // العثور على الأدمن (نفترض وجود أدمن واحد رئيسي للمراسلة)
  const { data: admin, error: adminError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (adminError || !admin) {
    console.error("تعذر العثور على حساب الأدمن:", adminError);
    alert("تعذر العثور على حساب الأدمن. تأكد أن هناك صفاً واحداً في profiles بقيمة role = 'admin'.");
    return;
  }

  state.adminProfile = admin;

  showScreen("user-screen");
  mountInputBar($("#user-input-bar"), (payload) => sendUserMessage(payload));

  await loadUserMessages();
  subscribeUserRealtime();
}

async function loadUserMessages() {
  const me = state.currentUser.id;
  const admin = state.adminProfile.id;

  const { data: messages, error } = await supabaseClient
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${me},receiver_id.eq.${admin}),and(sender_id.eq.${admin},receiver_id.eq.${me})`)
    .order("created_at", { ascending: true });

  if (error) console.error("فشل جلب الرسائل (user):", error);

  appendMessagesWithDayDividers($("#user-messages"), messages || []);

  // تحديث حالة الرسائل الواردة غير المقروءة إلى "read" فور فتح الشاشة
  await markIncomingAsRead(admin, me);
}

async function sendUserMessage({ content = "", media_url = null, media_type = null }) {
  if (!state.adminProfile || !state.adminProfile.id) {
    alert("تعذر إرسال الرسالة: لا يوجد حساب أدمن محدَّد حالياً.");
    return;
  }

  const { data, error } = await supabaseClient.from("messages").insert({
    sender_id: state.currentUser.id,
    receiver_id: state.adminProfile.id,
    content,
    media_url,
    media_type,
    status: "sent",
  }).select().single();

  if (error) {
    console.error("فشل إرسال الرسالة (user):", error);
    alert("فشل إرسال الرسالة: " + error.message);
    return;
  }

  if (data) {
    $("#user-messages").appendChild(renderMessageBubble(data, true));
    scrollToBottom($("#user-messages"));
  }
}

function subscribeUserRealtime() {
  // ---------------------------------------------------------------
  // Realtime: نشترك في قناة واحدة تستمع لكل التغييرات على جدول
  // messages، ثم نُصفّي داخل رد النداء (callback) فقط الرسائل
  // الخاصة بمحادثتنا مع الأدمن (لأن فلاتر Supabase تدعم عمود واحد
  // فقط، ومحادثتنا تعتمد على عمودين sender/receiver معاً).
  // ---------------------------------------------------------------
  const channel = supabaseClient
    .channel("user-messages-channel")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
      const msg = payload.new;
      const me = state.currentUser.id;
      const admin = state.adminProfile.id;
      const belongsToThisChat =
        (msg.sender_id === admin && msg.receiver_id === me) ||
        (msg.sender_id === me && msg.receiver_id === admin);
      if (!belongsToThisChat) return;

      // إذا كانت الرسالة واردة من الأدمن
      if (msg.sender_id === admin) {
        $("#user-messages").appendChild(renderMessageBubble(msg, false));
        scrollToBottom($("#user-messages"));

        if (document.hidden) {
          // نشغل صوت التنبيه فقط إذا كانت الصفحة/الشاشة غير مرئية حالياً
          playNotificationSound();
        } else {
          // الشاشة مفتوحة ومرئية: نعلّم الرسالة كمقروءة فوراً في قاعدة البيانات
          await supabaseClient.from("messages").update({ status: "read" }).eq("id", msg.id);
        }
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
      // تحديث علامات الصح (ticks) لرسائلنا الصادرة عند تغيّر حالتها
      const msg = payload.new;
      const row = $(`#user-messages .msg-row[data-id="${msg.id}"]`);
      if (row) {
        const ticksEl = $(".ticks", row);
        if (ticksEl) {
          ticksEl.textContent = msg.status === "sent" ? "✓" : "✓✓";
          ticksEl.classList.toggle("read", msg.status === "read");
        }
      }
    })
    .subscribe();
}

async function markIncomingAsRead(fromId, toId) {
  await supabaseClient
    .from("messages")
    .update({ status: "read" })
    .eq("sender_id", fromId)
    .eq("receiver_id", toId)
    .neq("status", "read");
}

// =====================================================================
// واجهة الأدمن
// =====================================================================

async function bootAdminInterface() {
  showScreen("admin-screen");
  await loadAllConversations();
  subscribeAdminRealtime();

  $("#back-to-list").addEventListener("click", () => {
    $("#admin-chat-window").classList.remove("mobile-open");
    // مهم: نُصفّر هوية المحادثة المفتوحة حتى لا يُعامل النظام أي رسالة
    // جديدة من هذا المستخدم على أنها "مقروءة تلقائياً" بعد الرجوع للقائمة
    state.selectedUserId = null;
    $("#admin-active-chat").style.display = "none";
    $("#no-chat-selected").style.display = "flex";
    renderConversationList($("#conversation-search").value.trim().toLowerCase());
  });

  $("#conversation-search").addEventListener("input", (e) => {
    renderConversationList(e.target.value.trim().toLowerCase());
  });
}

async function loadAllConversations() {
  const adminId = state.currentProfile.id;

  // جلب كل المستخدمين (غير الأدمن)
  const { data: users, error: usersError } = await supabaseClient
    .from("profiles")
    .select("*")
    .neq("role", "admin");

  if (usersError) console.error("فشل جلب قائمة المستخدمين:", usersError);

  // جلب كل الرسائل التي للأدمن علاقة بها (كمرسل أو مستقبل)
  const { data: messages, error: messagesError } = await supabaseClient
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${adminId},receiver_id.eq.${adminId}`)
    .order("created_at", { ascending: true });

  if (messagesError) console.error("فشل جلب الرسائل (admin):", messagesError);

  state.conversations = {};
  (users || []).forEach(u => {
    state.conversations[u.id] = { profile: u, lastMessage: null, unread: 0, messages: [] };
  });

  (messages || []).forEach(msg => {
    const otherId = msg.sender_id === adminId ? msg.receiver_id : msg.sender_id;
    if (!state.conversations[otherId]) return;
    const convo = state.conversations[otherId];
    convo.messages.push(msg);
    convo.lastMessage = msg;
    if (msg.sender_id === otherId && msg.status !== "read") {
      convo.unread++;
    }
  });

  renderConversationList();
}

function renderConversationList(filterText = "") {
  const listEl = $("#conversation-list");
  listEl.innerHTML = "";

  const sorted = Object.values(state.conversations)
    .filter(c => !filterText || c.profile.email.toLowerCase().includes(filterText))
    .sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return tb - ta; // الأحدث أولاً (تُقفز المحادثة الجديدة لأعلى القائمة)
    });

  sorted.forEach(convo => {
    const item = document.createElement("div");
    item.className = "conversation-item" + (convo.profile.id === state.selectedUserId ? " selected" : "");
    item.dataset.userId = convo.profile.id;

    const lastMsgPreview = convo.lastMessage
      ? (convo.lastMessage.content || mediaPreviewLabel(convo.lastMessage.media_type))
      : "لا توجد رسائل بعد";
    const lastTime = convo.lastMessage ? formatTime(convo.lastMessage.created_at) : "";

    item.innerHTML = `
      <div class="avatar">${(convo.profile.full_name || convo.profile.email)[0].toUpperCase()}</div>
      <div class="conv-info">
        <div class="conv-top-row">
          <span class="conv-name">${escapeHtml(convo.profile.full_name || convo.profile.email)}</span>
          <span class="conv-time">${lastTime}</span>
        </div>
        <div class="conv-bottom-row">
          <span class="conv-last-msg">${escapeHtml(lastMsgPreview)}</span>
          ${convo.unread > 0 ? `<span class="unread-badge">${convo.unread}</span>` : ""}
        </div>
      </div>
    `;
    item.addEventListener("click", () => selectConversation(convo.profile.id));
    listEl.appendChild(item);
  });
}

function mediaPreviewLabel(mediaType) {
  if (mediaType === "image") return "📷 صورة";
  if (mediaType === "audio") return "🎤 رسالة صوتية";
  if (mediaType === "file") return "📎 ملف";
  return "";
}

async function selectConversation(userId) {
  state.selectedUserId = userId;
  const convo = state.conversations[userId];
  if (!convo) return;

  $("#no-chat-selected").style.display = "none";
  $("#admin-active-chat").style.display = "flex";
  $("#admin-chat-window").classList.add("mobile-open");

  $("#admin-chat-name").textContent = convo.profile.full_name || convo.profile.email;
  $("#admin-chat-avatar").textContent = (convo.profile.full_name || convo.profile.email)[0].toUpperCase();
  $("#admin-chat-status").textContent = convo.profile.email;

  appendMessagesWithDayDividers($("#admin-messages"), convo.messages);
  mountInputBar($("#admin-input-bar"), (payload) => sendAdminMessage(userId, payload));

  // تعليم الرسائل الواردة من هذا المستخدم كمقروءة، وتصفير عداد غير المقروء
  await markIncomingAsRead(userId, state.currentProfile.id);
  convo.unread = 0;
  renderConversationList($("#conversation-search").value.trim().toLowerCase());

  renderConversationList();
}

async function sendAdminMessage(receiverId, { content = "", media_url = null, media_type = null }) {
  const { data, error } = await supabaseClient.from("messages").insert({
    sender_id: state.currentProfile.id,
    receiver_id: receiverId,
    content,
    media_url,
    media_type,
    status: "sent",
  }).select().single();

  if (error) {
    console.error("فشل إرسال الرسالة (admin):", error);
    alert("فشل إرسال الرسالة: " + error.message);
    return;
  }

  if (data) {
    state.conversations[receiverId].messages.push(data);
    state.conversations[receiverId].lastMessage = data;
    if ($("#admin-messages")) {
      $("#admin-messages").appendChild(renderMessageBubble(data, true));
      scrollToBottom($("#admin-messages"));
    }
    renderConversationList();
  }
}

function subscribeAdminRealtime() {
  const adminId = state.currentProfile.id;

  supabaseClient
    .channel("admin-messages-channel")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
      const msg = payload.new;
      const isRelevant = msg.sender_id === adminId || msg.receiver_id === adminId;
      if (!isRelevant) return;

      const otherId = msg.sender_id === adminId ? msg.receiver_id : msg.sender_id;
      if (!state.conversations[otherId]) {
        // مستخدم جديد لم يكن موجوداً في القائمة (نادر) - أعد تحميل القائمة كاملة
        await loadAllConversations();
        return;
      }

      const convo = state.conversations[otherId];
      convo.messages.push(msg);
      convo.lastMessage = msg; // تُقفز المحادثة تلقائياً لأعلى القائمة عند إعادة الترتيب

      const isChatCurrentlyOpen = state.selectedUserId === otherId && !document.hidden;

      if (msg.sender_id === otherId) {
        if (isChatCurrentlyOpen) {
          // المحادثة مفتوحة ومرئية: نعرض الرسالة ونعلمها كمقروءة فوراً
          $("#admin-messages").appendChild(renderMessageBubble(msg, false));
          scrollToBottom($("#admin-messages"));
          await supabaseClient.from("messages").update({ status: "read" }).eq("id", msg.id);
        } else {
          // المحادثة غير مفتوحة حالياً: نزيد عداد الرسائل غير المقروءة ونشغل التنبيه الصوتي
          convo.unread++;
          playNotificationSound();
        }
      }
      renderConversationList($("#conversation-search").value.trim().toLowerCase());
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
      const msg = payload.new;
      const row = $(`#admin-messages .msg-row[data-id="${msg.id}"]`);
      if (row) {
        const ticksEl = $(".ticks", row);
        if (ticksEl) {
          ticksEl.textContent = msg.status === "sent" ? "✓" : "✓✓";
          ticksEl.classList.toggle("read", msg.status === "read");
        }
      }
    })
    .subscribe();
}

// =====================================================================
// نقطة انطلاق التطبيق
// =====================================================================
init();