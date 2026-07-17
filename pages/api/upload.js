import { supabaseServer } from './supabase';

// إعداد لتعطيل الـ Body Parser الافتراضي لـ Next.js إذا كنت سترسل ملفات كبيرة
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // الحد الأقصى لحجم الصور أو الصوت
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'الطريقة غير مسموح بها' });
  }

  try {
    const { fileBase64, fileName, fileType } = req.body;

    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'بيانات الملف ناقصة' });
    }

    // تحويل الـ Base64 إلى Buffer ليقبله السيرفر ويقوم برفعه
    const buffer = Buffer.from(fileBase64, 'base64');
    
    // توليد اسم فريد للملف لمنع التداخل
    const uniqueFileName = `${Math.random()}_${Date.now()}_${fileName}`;

    // الرفع إلى مجلد chat-media الموجود في الـ Storage لديك
    const { data, error } = await supabaseServer
      .storage
      .from('chat-media')
      .upload(uniqueFileName, buffer, {
        contentType: fileType,
        upsert: false
      });

    if (error) throw error;

    // جلب الرابط العام للملف
    const { data: urlData } = supabaseServer
      .storage
      .from('chat-media')
      .getPublicUrl(uniqueFileName);

    return res.status(200).json({ success: true, publicUrl: urlData.publicUrl });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
