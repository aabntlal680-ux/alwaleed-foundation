const { supabaseServer } = require('./supabase');

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', (err) => reject(err));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-user-id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // --- جلب الرسائل (GET) ---
    if (req.method === 'GET') {
      const { data: messages, error } = await supabaseServer
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) return res.status(400).json({ error: error.message });
      
      // توحيد الحقول عند الإرجاع لتدعم الكودين (content و text) معاً منعا للفقاعات الفارغة
      const normalizedMessages = messages.map(msg => ({
        ...msg,
        text: msg.text || msg.content || '',
        content: msg.content || msg.text || ''
      }));

      return res.status(200).json(normalizedMessages);
    }

    // --- إرسال رسالة (POST) ---
    if (req.method === 'POST') {
      const body = await parseRequestBody(req);
      const { sender_id, text, content, media_url, media_type } = body;

      if (!sender_id) return res.status(400).json({ error: 'معرف المرسل مفقود' });

      // صياغة النص المدخل أياً كان المسمى القادم من الفرونت إند
      const messageText = text || content || '';

      const { data: newMessage, error } = await supabaseServer
        .from('messages')
        .insert({
          sender_id,
          text: messageText,    // يغذي حقل text في الداتابيز إن وجد
          content: messageText, // يغذي حقل content في الداتابيز إن وجد (احتياطياً)
          media_url: media_url || null,
          media_type: media_type || null
        })
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });

      // تطبيع وتوحيد الحقول للرسالة المرجعة فوراً للفرونت إند
      const normalizedNewMessage = {
        ...newMessage,
        text: newMessage.text || newMessage.content || messageText,
        content: newMessage.content || newMessage.text || messageText
      };

      return res.status(200).json(normalizedNewMessage);
    }

    return res.status(405).json({ error: 'الطريقة غير مسموح بها' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
