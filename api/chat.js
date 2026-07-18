import { createClient } from '@supabase/supabase-js';

const supabaseServer = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// إيميل الأدمن للتحكم في الصلاحيات
const ADMIN_EMAIL = "almgawell@gmail.com"; 

export default async function handler(req, res) {
  // إذا كان الطلب خاصاً بتسجيل الدخول أو التسجيل، اسمح له بالمرور
  if (req.url.includes('/auth') || req.method === 'OPTIONS') {
    return; // انتقل لمعالجة Auth في ملفها الخاص
  }

  // التحقق من الهوية فقط للطلبات الأخرى
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'غير مصرح' });


  // --- جلب الرسائل (GET) ---
  if (req.method === 'GET') {
    try {
      // التحقق مما إذا كان المستخدم هو الأدمن
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      let query = supabaseServer.from('messages').select('*').order('created_at', { ascending: true });

      // إذا لم يكن أدمن، نقوم بفلترة الرسائل لتظهر له فقط ما يخصه
      if (profile?.email !== ADMIN_EMAIL) {
        query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      }

      const { data: messages, error } = await query;
      if (error) throw error;

      const normalizedMessages = messages.map(msg => ({
        ...msg,
        text: msg.content || '', // توحيد الحقل ليعتمد على content
        content: msg.content || ''
      }));

      return res.status(200).json(normalizedMessages);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- إرسال رسالة (POST) ---
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { sender_id, receiver_id, content, media_url, media_type } = body;

      const { data, error } = await supabaseServer
        .from('messages')
        .insert({
          sender_id,
          receiver_id,
          content: content || '', // استخدام حقل content الأساسي
          media_url,
          media_type
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
}
