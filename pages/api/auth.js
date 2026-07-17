import { supabaseServer } from './supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { action, email, password } = req.body;

  try {
    if (action === 'signup') {
      const { data, error } = await supabaseServer.auth.signUp({ email, password });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ message: 'تم إنشاء الحساب بنجاح! تحقق من بريدك الإلكتروني.' });
    } 
    
    if (action === 'login') {
      const { data, error } = await supabaseServer.auth.signInWithPassword({ email, password });
      if (error) return res.status(400).json({ error: 'بيانات الدخول غير صحيحة.' });

      // جلب البروفايل
      const { data: profile } = await supabaseServer.from('profiles').eq('id', data.user.id).single();
      return res.status(200).json({ user: data.user, profile });
    }
  } catch (e) {
    return res.status(500).json({ error: 'خطأ داخلي بالسيرفر' });
  }
}
