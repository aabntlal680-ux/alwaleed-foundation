import { supabaseServer } from './supabase'; // أو العميل العام حسب إعدادك للفرونت إند

export async function uploadChatMedia(file) {
  try {
    // 1. توليد اسم فريد للملف لتجنب تكرار الأسماء
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // 2. عملية الرفع إلى الـ Bucket المفتوح أمامك (chat-media)
    const { data, error } = await supabaseServer
      .storage
      .from('chat-media') // نفس الاسم الظاهر في شاشتك تماماً
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // 3. جلب رابط الملف المباشر (Public URL) لكي ترسل الرابط في رسالة الشات
    const { data: urlData } = supabaseServer
      .storage
      .from('chat-media')
      .getPublicUrl(filePath);

    return { 
      success: true, 
      publicUrl: urlData.publicUrl 
    };

  } catch (error) {
    console.error('خطأ أثناء رفع الملف:', error.message);
    return { success: false, error: error.message };
  }
}
