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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'الطريقة غير مسموح بها' });
  }

  try {
    // قراءة البيانات يدوياً لمنع الانهيار بسبب الـ Body Parser
    const body = await parseRequestBody(req);
    const { fileBase64, fileName, fileType } = body;

    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'بيانات الملف ناقصة' });
    }

    // تحويل الـ Base64 إلى Buffer ليتمكن السيرفر من رفعه إلى Supabase Storage
    const buffer = Buffer.from(fileBase64, 'base64');
    
    // توليد اسم فريد للملف لمنع تداخل الأسماء
    const uniqueFileName = `${Math.random()}_${Date.now()}_${fileName}`;

    // الرفع إلى الـ Bucket المسمى chat-media
    const { data, error } = await supabaseServer
      .storage
      .from('chat-media')
      .upload(uniqueFileName, buffer, {
        contentType: fileType,
        upsert: false
      });

    if (error) throw error;

    // جلب الرابط العام المباشر للملف المرفوع
    const { data: urlData } = supabaseServer
      .storage
      .from('chat-media')
      .getPublicUrl(uniqueFileName);

    return res.status(200).json({ success: true, publicUrl: urlData.publicUrl });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
