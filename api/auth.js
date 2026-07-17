const { supabaseServer } = require('./supabase');

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
    const { action, email, password, name, role } = req.body;

    // --- أولاً: تسجيل الدخول (Login) ---
    if (action === 'login') {
      const { data, error } = await supabaseServer.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return res.status(400).json({ error: error.message });

      // جلب بيانات الحساب (Profile) لمعرفة الدور (Role)
      const { data: profile } = await supabaseServer
        .from('profiles')
        .eq('id', data.user.id)
        .single();

      return res.status(200).json({ user: data.user, profile });
    }

    // --- ثانياً: إنشاء حساب جديد (Register) ---
    if (action === 'register') {
      const { data, error } = await supabaseServer.auth.signUp({
        email,
        password,
      });

      if (error) return res.status(400).json({ error: error.message });

      // إنشاء السجل في جدول profiles بالدور المحدد
      const { data: profile, error: profileError } = await supabaseServer
        .from('profiles')
        .insert({
          id: data.user.id,
          name: name || email.split('@')[0],
          role: role || 'user', // الافتراضي مستخدم عادي
        })
        .select()
        .single();

      if (profileError) return res.status(400).json({ error: profileError.message });

      return res.status(200).json({ user: data.user, profile });
    }

    return res.status(400).json({ error: 'الإجراء غير معروف' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
