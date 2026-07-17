import { supabaseServer } from './supabase'; // تصحيح حرف i الصغير هنا

export default async function handler(req, res) {
  // قراءة الترويسة بالحروف الصغيرة لضمان التوافق التام مع المتصفحات
  const userId = req.headers['x-user-id']; 
  if (!userId) return res.status(401).json({ error: 'غير مصرح بالدخول' });

  // --- إرسال رسالة جديدة ---
  if (req.method === 'POST') {
    const { action, receiver_id, content, media_url, media_type } = req.body;
    if (action === 'send_message') {
      const { data, error } = await supabaseServer.from('messages').insert({
        sender_id: userId,
        receiver_id,
        content,
        media_url,
        media_type,
        status: 'sent'
      }).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(data);
    }
  }

  // --- جلب الرسائل والمحادثات ---
  if (req.method === 'GET') {
    const { action, selectedUserId } = req.query;

    // 1. للمستخدم العادي
    if (action === 'get_user_messages') {
      const { data: admin } = await supabaseServer.from('profiles').eq('role', 'admin').limit(1).maybeSingle();
      if (!admin) return res.status(404).json({ error: 'لم يتم العثور على مدير' });

      // تحويل الرسائل المفتوحة والمستلمة إلى مقروءة تلقائياً
      await supabaseServer.from('messages').update({ status: 'read' }).eq('sender_id', admin.id).eq('receiver_id', userId).neq('status', 'read');

      const { data: messages } = await supabaseServer.from('messages')
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${admin.id}),and(sender_id.eq.${admin.id},receiver_id.eq.${userId})`)
        .order('created_at', { ascending: true });

      return res.status(200).json({ admin, messages: messages || [] });
    }

    // 2. للوحة تحكم المسؤول (Admin)
    if (action === 'get_admin_conversations') {
      if (selectedUserId && selectedUserId !== 'null') {
        // إذا كان المسؤول يفتح محادثة مستخدم محدد حالياً، نجعلها مقروءة
        await supabaseServer.from('messages').update({ status: 'read' }).eq('sender_id', selectedUserId).eq('receiver_id', userId).neq('status', 'read');
      }

      const { data: users } = await supabaseServer.from('profiles').neq('role', 'admin');
      const { data: messages } = await supabaseServer.from('messages')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: true });

      let conversations = {};
      (users || []).forEach(u => {
        conversations[u.id] = { profile: u, lastMessage: null, unread: 0, messages: [] };
      });

      (messages || []).forEach(msg => {
        const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        if (!conversations[otherId]) return;
        
        // جلب الرسائل فقط للمستخدم المحدد لتقليل حجم البيانات المنقولة
        if (selectedUserId && otherId === selectedUserId) {
          conversations[otherId].messages.push(msg);
        }
        conversations[otherId].lastMessage = msg;
        if (msg.sender_id === otherId && msg.status !== 'read') {
          conversations[otherId].unread++;
        }
      });

      return res.status(200).json({ conversations });
    }
  }
}
