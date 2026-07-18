// ------------------------- حالة عامة للتطبيق -------------------------
const state = {
  currentUser: null,      // بيانات المستخدم المسجل دخوله 
  currentProfile: null,   // صف profiles الخاص بالمستخدم الحالي
  adminProfile: null,     // (لواجهة المستخدم العادي) بيانات الأدمن الذي يراسله
  conversations: {},      // (للأدمن) خريطة userId -> { profile, lastMessage, unread, messages: [] }
  selectedUserId: null,   // (للأدمن) هوية المستخدم المحادَث حالياً
  mediaRecorder: null,
  recordedChunks: [],
  recordTimerInterval: null,
  pollingInterval: null,  // مؤقت التحديث الدوري (Polling)
  userIsScrolledUp: false // لمراقبة ما إذا كان المستخدم يقرأ الرسائل بالأعلى
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
  } catch (e) { }
}

// دالة مساعدة موحدة لإرسال الطلبات للسيرفر الخاص بك
async function apiFetch(endpoint, options = {}) {
  options.headers = {
    ...options.headers,
    'Content-Type': 'application/json'
  };
  if (state.currentUser) {
    options.headers['x-user-id'] = state.currentUser.id;
  }
  
  const response = await fetch(`/api/${endpoint}`, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'حدث خطأ في الاتصال بالسيرفر');
  return result;
}

// =====================================================================
// تسجيل الدخول واستعادة الجلسة
// =====================================================================

async function init() {
  setupLightbox(); // تهيئة نافذة معاينة الصور
  setupScrollListeners(); // تهيئة مراقبة التمرير العلوي
  
  try {
    const savedUser = localStorage.getItem('chat_user');
    const savedProfile = localStorage.getItem('chat_profile');
    
    if (savedUser && savedProfile) {
      state.currentUser = JSON.parse(savedUser);
      state.currentProfile = JSON.parse(savedProfile);
      
      if (state.currentProfile.role === "admin") {
        await bootAdminInterface();
      } else {
        await bootUserInterface();
      }
    } else {
      showScreen("login-screen");
    }
  } catch (e) {
    showScreen("login-screen");
  }
}

let authMode = "login"; 

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

  try {
    if (authMode === "signup") {
      btn.textContent = "جاري إنشاء الحساب...";
      await apiFetch('auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'register', email, password })
      });
      btn.disabled = false;
      btn.textContent = "إنشاء الحساب";
      successEl.textContent = "تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.";
      authMode = "login";
      $("#login-btn").textContent = "تسجيل الدخول";
      return;
    }

    btn.textContent = "جاري الدخول...";
    const result = await apiFetch('auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'login', email, password })
    });

    btn.disabled = false;
    btn.textContent = "تسجيل الدخول";

    localStorage.setItem('chat_user', JSON.stringify(result.user));
    localStorage.setItem('chat_profile', JSON.stringify(result.profile));
    
    state.currentUser = result.user;
    state.currentProfile = result.profile;

    if (result.profile.role === "admin") {
      await bootAdminInterface();
    } else {
      await bootUserInterface();
    }
  } catch (error) {
    btn.disabled = false;
    btn.textContent = authMode === "login" ? "تسجيل الدخول" : "إنشاء الحساب";
    errorEl.textContent = error.message;
  }
});

async function logout() {
  localStorage.clear();
  if (state.pollingInterval) clearInterval(state.pollingInterval);
  location.reload();
}
$("#user-logout-btn").addEventListener("click", logout);
$("#admin-logout-btn").addEventListener("click", logout);

// =====================================================================
// شريط الإدخال المشترك والرفع عبر السيرفر
// =====================================================================

function mountInputBar(containerEl, onSend) {
  const tpl = $("#input-bar-template").content.cloneNode(true);
  containerEl.innerHTML = "";
  containerEl.appendChild(tpl);

  const textInput = $(".text-input", containerEl);
  const fileInput = $(".file-input", containerEl);
  const emojiPanel = $(".emoji-panel", containerEl);

  emojiPanel.innerHTML = EMOJIS.map(e => `<span class="emoji-item">${e}</span>`).join("");
  emojiPanel.addEventListener("click", (e) => {
    if (e.target.classList.contains("emoji-item")) {
      textInput.value += e.target.textContent;
      textInput.focus();
    }
  });

  $(".emoji-toggle", containerEl).addEventListener("click", () => emojiPanel.classList.toggle("hidden"));

  $(".send-btn", containerEl).addEventListener("click", () => sendText());
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendText(); }
  });

  function sendText() {
    const val = textInput.value.trim();
    if (!val) return;
    onSend({ text: val }); 
    textInput.value = "";
    emojiPanel.classList.add("hidden");
    state.userIsScrolledUp = false; // إجبار النزول لأسفل عند إرسال رسالة جديدة
  }

  $(".attach-toggle", containerEl).addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Data = reader.result.split(',')[1];
      try {
        const uploadResult = await apiFetch('upload', {
          method: 'POST',
          body: JSON.stringify({ fileName: file.name, fileBase64: base64Data, fileType: file.type })
        });
        const mediaType = file.type.startsWith("image/") ? "image" : "file";
        onSend({ text: "", media_url: uploadResult.publicUrl, media_type: mediaType });
        state.userIsScrolledUp = false;
      } catch (err) {
        alert("فشل رفع الملف: " + err.message);
      }
    };
    fileInput.value = "";
  });

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
  } catch (err) {
    alert("تعذر الوصول إلى الميكروفون.");
  }
}

function stopRecording(containerEl, shouldSend, onSend) {
  clearInterval(state.recordTimerInterval);
  $(".recording-indicator", containerEl).classList.add("hidden");
  $(".input-bar-inner", containerEl).style.display = "flex";
  $(".rec-timer", containerEl).textContent = "00:00";

  if (!state.mediaRecorder) return;

  state.mediaRecorder.onstop = async () => {
    if (shouldSend && state.recordedChunks.length) {
      const blob = new Blob(state.recordedChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        try {
          const uploadResult = await apiFetch('upload', {
            method: 'POST',
            body: JSON.stringify({ fileName: `voice_${Date.now()}.webm`, fileBase64: base64Data, fileType: "audio/webm" })
          });
          onSend({ text: "", media_url: uploadResult.publicUrl, media_type: "audio" });
          state.userIsScrolledUp = false;
        } catch (err) {
          alert("فشل رفع التسجيل الصوتي");
        }
      };
    }
    state.mediaRecorder.stream.getTracks().forEach(t => t.stop());
    state.mediaRecorder = null;
    state.recordedChunks = [];
  };
  state.mediaRecorder.stop();
}

// =====================================================================
// عرض الرسائل ومعاينة الصور (مشترك)
// =====================================================================

function setupLightbox() {
  // إنشاء عنصر الـ Lightbox ديناميكياً إذا لم يكن موجوداً بالـ HTML
  if ($("#image-lightbox")) return;
  const lb = document.createElement("div");
  lb.id = "image-lightbox";
  lb.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:99999; display:none; flex-direction:column; align-items:center; justify-content:center;";
  
  lb.innerHTML = `
    <button id="close-lightbox-btn" style="position:absolute; top:20px; right:20px; background:#e74c3c; color:white; border:none; padding:10px 20px; font-size:16px; border-radius:5px; cursor:pointer; font-weight:bold;">✕ العودة للمحادثة</button>
    <img id="lightbox-img" src="" style="max-width:90%; max-height:80%; border-radius:8px; box-shadow:0 5px 15px rgba(0,0,0,0.5); object-fit:contain;">
  `;
  document.body.appendChild(lb);

  $("#close-lightbox-btn").addEventListener("click", () => {
    lb.style.display = "none";
  });
}

function openImagePreview(url) {
  const lb = $("#image-lightbox");
  const img = $("#lightbox-img");
  if (lb && img) {
    img.src = url;
    lb.style.display = "flex";
  }
}

function setupScrollListeners() {
  // تتبع تمرير المستخدم لمنع النزول التلقائي المزعج
  const userContainer = $("#user-messages");
  const adminContainer = $("#admin-messages");

  const onScroll = (e) => {
    const el = e.target;
    // إذا كان البعد عن القاع أكبر من 150 بكسل، نعتبر أن المستخدم يصعد للأعلى لقراءة الرسائل
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 150) {
      state.userIsScrolledUp = true;
    } else {
      state.userIsScrolledUp = false;
    }
  };

  if (userContainer) userContainer.addEventListener("scroll", onScroll);
  if (adminContainer) adminContainer.addEventListener("scroll", onScroll);
}

function renderMessageBubble(msg, isOutgoing) {
  const row = document.createElement("div");
  row.className = `msg-row ${isOutgoing ? "out" : "in"}`;
  row.dataset.id = msg.id;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${isOutgoing ? "out" : "in"}`;

  const actualMediaUrl = msg.media_url || msg.mediaUrl;
  const actualMediaType = msg.media_type || msg.mediaType;

  let mediaHtml = "";
  if (actualMediaUrl) {
    if (actualMediaType === "image") {
      // إضافة خاصية النقر لتكبير وتكبير الصور بدقة عالية ومعاينتها بشكل خاص
      mediaHtml = `<img src="${actualMediaUrl}" alt="صورة" class="previewable-img" style="max-width:100%; max-height:250px; border-radius:8px; display:block; margin-bottom:5px; cursor:pointer;" onclick="openImagePreview('${actualMediaUrl}')">`;
    } else if (actualMediaType === "audio") {
      mediaHtml = `<audio controls src="${actualMediaUrl}" style="max-width:100%; display:block; margin-bottom:5px;"></audio>`;
    } else {
      mediaHtml = `<a href="${actualMediaUrl}" target="_blank" rel="noopener" style="display:block; margin-bottom:5px;">📎 فتح الملف</a>`;
    }
  }

  const messageText = msg.text || msg.content || "";
  const textHtml = messageText ? `<div class="text">${escapeHtml(messageText)}</div>` : "";
  
  let ticksHtml = "";
  if (isOutgoing) {
    const tickChar = msg.status === "sent" ? "✓" : "✓✓";
    const readClass = msg.status === "read" ? "read" : "";
    ticksHtml = `<span class="ticks ${readClass}">${tickChar}</span>`;
  }

  bubble.innerHTML = `${mediaHtml}${textHtml}<div class="meta"><span class="time">${formatTime(msg.created_at)}</span>${ticksHtml}</div>`;
  row.appendChild(bubble);
  return row;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function appendMessagesWithDayDividers(container, messages) {
  if (!messages || !Array.isArray(messages)) return;
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

  // التمرير الذكي: لا نمرر للأسفل تلقائياً إذا كان المستخدم يقوم بالمراجعة بالأعلى لقراءة الرسائل السابقة
  if (!state.userIsScrolledUp) {
    scrollToBottom(container);
  }
}

function scrollToBottom(container) {
  container.scrollTop = container.scrollHeight;
}

// =====================================================================
// واجهة المستخدم العادي (User Interface)
// =====================================================================

async function bootUserInterface() {
  $("#my-identity").textContent = state.currentProfile.name || state.currentProfile.email;
  showScreen("user-screen");
  mountInputBar($("#user-input-bar"), (payload) => sendUserMessage(payload));

  await loadUserMessages();
  
  if (state.pollingInterval) clearInterval(state.pollingInterval);
  state.pollingInterval = setInterval(loadUserMessages, 3000);
}

async function loadUserMessages() {
  try {
    const messages = await apiFetch('chat'); 
    
    const currentCount = $("#user-messages").querySelectorAll('.msg-row').length;
    if (currentCount > 0 && messages.length > currentCount) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender_id !== state.currentUser.id && document.hidden) {
        playNotificationSound();
      }
    }

    appendMessagesWithDayDividers($("#user-messages"), messages);
  } catch (err) {
    console.error(err);
  }
}

async function sendUserMessage(payload) {
  try {
    const data = await apiFetch('chat', {
      method: 'POST',
      body: JSON.stringify({ sender_id: state.currentUser.id, ...payload })
    });
    state.userIsScrolledUp = false; // النزول لأسفل فور إرسال الرسالة
    $("#user-messages").appendChild(renderMessageBubble(data, true));
    scrollToBottom($("#user-messages"));
  } catch (err) {
    alert(err.message);
  }
}

// =====================================================================
// واجهة الأدمن (Admin Interface)
// =====================================================================

async function bootAdminInterface() {
  showScreen("admin-screen");
  await loadAllConversations();

  if (state.pollingInterval) clearInterval(state.pollingInterval);
  state.pollingInterval = setInterval(loadAllConversations, 3000);

  $("#back-to-list").addEventListener("click", () => {
    $("#admin-chat-window").classList.remove("mobile-open");
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
  try {
    const messages = await apiFetch('chat');
    
    const convos = {};
    messages.forEach(msg => {
      // آلية فرز دقيقة ومحسنة لتحديد هوية العميل المقابل للأدمن
      let otherId = msg.sender_id === state.currentUser.id ? msg.receiver_id : msg.sender_id;
      
      if (!otherId || otherId === state.currentUser.id) {
        otherId = msg.sender_id;
      }
      
      if (!otherId || otherId === state.currentUser.id) return; 

      if (!convos[otherId]) {
        convos[otherId] = {
          profile: { id: otherId, email: `User_${otherId.substring(0,5)}` },
          lastMessage: msg,
          unread: 0,
          messages: []
        };
      }
      convos[otherId].messages.push(msg);
      convos[otherId].lastMessage = msg;
    });

    state.conversations = convos;
    renderConversationList($("#conversation-search").value.trim().toLowerCase());

    if (state.selectedUserId && state.conversations[state.selectedUserId]) {
      appendMessagesWithDayDividers($("#admin-messages"), state.conversations[state.selectedUserId].messages);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderConversationList(filterText = "") {
  const listEl = $("#conversation-list");
  listEl.innerHTML = "";

  const sorted = Object.values(state.conversations)
    .filter(c => !filterText || c.profile.email.toLowerCase().includes(filterText))
    .sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return tb - ta;
    });

  sorted.forEach(convo => {
    const item = document.createElement("div");
    item.className = "conversation-item" + (convo.profile.id === state.selectedUserId ? " selected" : "");
    
    const messageText = convo.lastMessage.text || convo.lastMessage.content;
    const lastMsgPreview = convo.lastMessage
      ? (messageText || mediaPreviewLabel(convo.lastMessage.media_type || convo.lastMessage.mediaType))
      : "لا توجد رسائل بعد";
    const lastTime = convo.lastMessage ? formatTime(convo.lastMessage.created_at) : "";

    item.innerHTML = `
      <div class="avatar">${convo.profile.email[0].toUpperCase()}</div>
      <div class="conv-info">
        <div class="conv-top-row">
          <span class="conv-name">${escapeHtml(convo.profile.email)}</span>
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
  state.userIsScrolledUp = false; // إعادة ضبط التمرير التلقائي عند فتح محادثة جديدة لقراءتها من البداية
  const convo = state.conversations[userId];
  if (!convo) return;

  $("#no-chat-selected").style.display = "none";
  $("#admin-active-chat").style.display = "flex";
  $("#admin-chat-window").classList.add("mobile-open");

  $("#admin-chat-name").textContent = convo.profile.email;
  $("#admin-chat-avatar").textContent = convo.profile.email[0].toUpperCase();
  $("#admin-chat-status").textContent = convo.profile.email;

  appendMessagesWithDayDividers($("#admin-messages"), convo.messages);
  mountInputBar($("#admin-input-bar"), (payload) => sendAdminMessage(userId, payload));
}

async function sendAdminMessage(receiverId, payload) {
  try {
    const data = await apiFetch('chat', {
      method: 'POST',
      body: JSON.stringify({ sender_id: state.currentUser.id, receiver_id: receiverId, ...payload })
    });
    state.userIsScrolledUp = false;
    if(!state.conversations[receiverId]) {
       state.conversations[receiverId] = { messages: [] };
    }
    state.conversations[receiverId].messages.push(data);
    state.conversations[receiverId].lastMessage = data;
    $("#admin-messages").appendChild(renderMessageBubble(data, true));
    scrollToBottom($("#admin-messages"));
    renderConversationList();
  } catch (err) {
    alert(err.message);
  }
}

// بدء تشغيل النظام
init();
