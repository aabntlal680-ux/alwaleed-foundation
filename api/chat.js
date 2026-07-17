const { supabaseServer } = require('./supabase');

// دالة مساعدة لقراءة وتحليل البيانات القادمة من الواجهة الأمامية (JSON)
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', (err) => reject(err));
  });
}

module.exports = async (req, res) => {
  // تفعيل الـ CORS لتتمكن صفحات الـ HTML من الاتصال بالسيرفر بأمان
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-user-id'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // --- أولاً: استقبال وجلب الرسائل (GET Request) ---
    if (req.method === 'GET') {
      const { data: messages, error } = await supabaseServer
        .from('messages')
        .select('*') // التأكد من وجود دالة select
        .order('created_at', { ascending: true });

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(messages);
    }

    // --- ثانياً: إرسال رسالة جديدة (POST Request) ---
    if (req.method === 'POST') {
      // قراءة وتحليل بيانات الـ Body القادمة بأمان لمنع الانهيار
      const body = await parseRequestBody(req);
      const { sender_id, text, media_url, media_type } = body;

      if (!sender_id) {
        return res.status(400).json({ error: 'معرف المرسل مفقود' });
      }

      const { data: newMessage, error } = await supabaseServer
        .from('messages')
        .insert({
          sender_id,
          text: text || '',
          media_url: media_url || null,
          media_type: media_type || null
        })
        .select() // التأكد من إرجاع البيانات المدرجة بنجاح
        .single();

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(newMessage);
    }

    return res.status(405).json({ error: 'الطريقة غير مسموح بها' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
