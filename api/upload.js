import { supabaseServer } from './supabase'; // حرف i صغير هنا

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
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

    const buffer = Buffer.from(fileBase64, 'base64');
    const uniqueFileName = `${Math.random()}_${Date.now()}_${fileName}`;

    const { data, error } = await supabaseServer
      .storage
      .from('chat-media')
      .upload(uniqueFileName, buffer, {
        contentType: fileType,
        upsert: false
      });

    if (error) throw error;

    const { data: urlData } = supabaseServer
      .storage
      .from('chat-media')
      .getPublicUrl(uniqueFileName);

    return res.status(200).json({ success: true, publicUrl: urlData.publicUrl });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
