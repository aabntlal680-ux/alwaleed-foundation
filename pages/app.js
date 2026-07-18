// =====================================================================
// تحديث دالة عرض الرسالة لتتوافق مع حقل 'text' في جدول messages
// =====================================================================

function renderMessageBubble(msg, isOutgoing) {
  const row = document.createElement("div");
  row.className = `msg-row ${isOutgoing ? "out" : "in"}`;
  row.dataset.id = msg.id;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${isOutgoing ? "out" : "in"}`;

  // مطابقة أسماء الحقول حسب مخطط قاعدة البيانات لديك
  const actualMediaUrl = msg.media_url; 
  const actualMediaType = msg.media_type;
  const messageText = msg.text || ""; // استخدام حقل 'text' مباشرة

  let mediaHtml = "";
  if (actualMediaUrl) {
    if (actualMediaType === "image") {
      mediaHtml = `<img src="${actualMediaUrl}" class="previewable-img" onclick="openImagePreview('${actualMediaUrl}')" style="max-width:100%; border-radius:8px; cursor:pointer;">`;
    } else if (actualMediaType === "audio") {
      // preload="metadata" يمنع إعادة التحميل ويحافظ على استقرار الصوت
      mediaHtml = `<audio controls preload="metadata" src="${actualMediaUrl}" style="max-width:100%; display:block;"></audio>`;
    }
  }

  bubble.innerHTML = `${mediaHtml}${messageText ? `<div class="text">${escapeHtml(messageText)}</div>` : ""}<div class="meta"><span class="time">${formatTime(msg.created_at)}</span></div>`;
  row.appendChild(bubble);
  return row;
}

// =====================================================================
// تحديث دالة الإضافة الذكية (تمنع إعادة رسم الشاشة وانقطاع الصوت)
// =====================================================================

function appendMessagesWithDayDividers(container, messages) {
  if (!messages || !Array.isArray(messages)) return;
  
  const existingIds = Array.from(container.querySelectorAll('.msg-row')).map(r => r.dataset.id);
  const newMessages = messages.filter(m => !existingIds.includes(m.id.toString()));

  // لا نقوم بمسح innerHTML، فقط نضيف الجديد، مما يمنع انقطاع الصوت!
  newMessages.forEach(msg => {
    const isOutgoing = msg.sender_id === state.currentUser?.id;
    container.appendChild(renderMessageBubble(msg, isOutgoing));
  });

  if (!state.userIsScrolledUp && newMessages.length > 0) {
    scrollToBottom(container);
  }
}

// =====================================================================
// تحديث دوال الإرسال لتتوافق مع حقل 'text'
// =====================================================================

async function sendUserMessage(payload) {
  try {
    const data = await apiFetch('chat', {
      method: 'POST',
      body: JSON.stringify({ 
        sender_id: state.currentUser.id, 
        text: payload.text, // التوافق مع حقل text
        media_url: payload.media_url, 
        media_type: payload.media_type 
      })
    });
    state.userIsScrolledUp = false;
    $("#user-messages").appendChild(renderMessageBubble(data, true));
    scrollToBottom($("#user-messages"));
  } catch (err) { alert(err.message); }
}
