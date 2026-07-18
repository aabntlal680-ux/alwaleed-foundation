import { createClient } from '@supabase/supabase-js';

const supabaseServer = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// إيميل احتياطي للأدمن (يُستخدم فقط إذا لم يكن role='admin' مضبوطاً في جدول profiles)
const ADMIN_EMAIL = "almgawell@gmail.com";

// روابط أزرار الرد التلقائي — استبدل القيم بالروابط الفعلية لموقعك
const LINKS = {
  helpRequest: 'https://alwaleed-foundation.vercel.app/pages/us.html',      // صفحة طلب المساعدة
  donate: 'https://alwaleed-foundation.vercel.app/pages/donate.html',                  // صفحة التبرع
  viewAidRequests: 'https://alwaleed-foundation.vercel.app/pages/view-us.html',    // صفحة عرض المساعدات
  viewDonations: 'hhttps://alwaleed-foundation.vercel.app/pages/cases.html'          // صفحة عرض التبرعات
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-user-id'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ---------------------------------------------------------------
  // عزل الجلسات: كل شيء يعتمد على x-user-id + صف profiles المطابق له
  // ---------------------------------------------------------------
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'غير مصرح: لا يوجد معرف مستخدم' });

  const { data: myProfile, error: profileErr } = await supabaseServer
    .from('profiles')
    .select('id, email, role')
    .eq('id', userId)
    .single();

  if (profileErr || !myProfile) {
    return res.status(401).json({ error: 'تعذر التحقق من هوية المستخدم' });
  }

  const isAdmin = myProfile.role === 'admin' || myProfile.email === ADMIN_EMAIL;

  // كل طلب مُصادَق عليه يُحدّث "آخر ظهور" لصاحبه — هذا ما يغذي خاصية آخر ظهور/متصل الآن
  supabaseServer.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});

  // --- جلب الرسائل (GET) ---
  if (req.method === 'GET') {
    try {
      // أي رسالة وصلت لهذا المستخدم وكانت لا تزال 'sent' تصبح 'delivered' بمجرد أن يجلبها
      await supabaseServer
        .from('messages')
        .update({ status: 'delivered' })
        .eq('receiver_id', userId)
        .eq('status', 'sent');

      let query = supabaseServer.from('messages').select('*').order('created_at', { ascending: true });

      if (!isAdmin) {
        // المستخدم العادي لا يرى إلا الرسائل التي هو طرف فيها
        query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      }

      const { data: messages, error } = await query;
      if (error) throw error;

      if (!isAdmin) {
        return res.status(200).json(messages || []);
      }

      // للأدمن فقط: نُرفق البريد الإلكتروني وآخر ظهور لكل طرف حتى تُبنى قائمة المحادثات
      // بأسماء/إيميلات حقيقية وحالة "متصل/آخر ظهور"، دون استدعاء إضافي من الواجهة
      const { data: profiles } = await supabaseServer.from('profiles').select('id, email, full_name, last_seen');
      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      const enriched = (messages || []).map(m => ({
        ...m,
        sender_email: profileMap[m.sender_id]?.email || null,
        receiver_email: profileMap[m.receiver_id]?.email || null
      }));

      return res.status(200).json({ messages: enriched, profiles: profileMap });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- تعليم رسائل كمقروءة (PATCH) ---
  // يُستدعى: من المستخدم العادي بدون otherUserId (كل الوارد إليه من الأدمن)،
  // أو من الأدمن مع otherUserId = هوية العميل المفتوحة محادثته حالياً (لتحديد النطاق بدقة)
  if (req.method === 'PATCH') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { otherUserId } = body;

      let query = supabaseServer
        .from('messages')
        .update({ status: 'read' })
        .eq('receiver_id', userId)
        .neq('status', 'read');

      if (otherUserId) query = query.eq('sender_id', otherUserId);

      const { error } = await query;
      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- إرسال رسالة (POST) ---
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { receiver_id, text, media_url, media_type } = body;

      // لا نثق أبداً بـ sender_id القادم من الواجهة؛ المرسل الحقيقي هو صاحب الجلسة (x-user-id)
      const senderId = userId;
      let finalReceiverId = receiver_id;

      if (!isAdmin) {
        // المستخدم العادي يراسل الأدمن دائماً بغض النظر عمّا وصل في الطلب
        const { data: adminProfile, error: adminErr } = await supabaseServer
          .from('profiles')
          .select('id')
          .or(`role.eq.admin,email.eq.${ADMIN_EMAIL}`)
          .limit(1)
          .single();

        if (adminErr || !adminProfile) {
          return res.status(500).json({ error: 'تعذر تحديد حساب الدعم الفني' });
        }
        finalReceiverId = adminProfile.id;
      } else if (!finalReceiverId) {
        return res.status(400).json({ error: 'يجب تحديد المستخدم المرسل إليه' });
      }

      if (!text && !media_url) {
        return res.status(400).json({ error: 'الرسالة فارغة' });
      }

      // نتحقق مسبقاً (قبل الإدراج) هل هذه أول رسالة يرسلها هذا المستخدم على الإطلاق
      // هذا الفحص يخص المستخدم العادي فقط؛ رسائل الأدمن لا تُفعّل رداً تلقائياً
      let isFirstMessageFromUser = false;
      if (!isAdmin) {
        const { count, error: countErr } = await supabaseServer
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_id', senderId);

        if (countErr) throw countErr;
        isFirstMessageFromUser = (count || 0) === 0;
      }

      const { data, error } = await supabaseServer
        .from('messages')
        .insert({
          sender_id: senderId,
          receiver_id: finalReceiverId,
          text: text || '',
          media_url: media_url || null,
          media_type: media_type || null,
          status: 'sent',
          is_html: false // رسائل المستخدمين تُعرض دائماً كنص عادي محمي من الحقن (escaped)
        })
        .select()
        .single();

      if (error) throw error;

      // --- الرد التلقائي على أول رسالة من المستخدم ---
      if (isFirstMessageFromUser) {
        const AUTO_REPLY_HTML =
`تحية طيبة من مؤسسة الوليد الإنسانية..<br><br>
يسعدنا جداً تواصلك معنا، فوجودك يعني لنا الكثير. نحن هنا لنعرف: كيف يمكننا أن نكون عوناً لك اليوم؟ هل تبحث عن طلب مساعدة، أم ترغب في تقديم دعم ومساندة؟<br><br>
نحن بانتظار ردك لنعرف كيف يمكننا خدمتك.<br><br>
دمت للخير عنواناً.. فريق مؤسسة الوليد الإنسانية
<div class="msg-buttons">
<a href="${LINKS.helpRequest}" class="msg-btn" target="_blank" rel="noopener">📝 طلب مساعدة</a>
<a href="${LINKS.donate}" class="msg-btn" target="_blank" rel="noopener">💝 تبرع الآن</a>
<a href="${LINKS.viewAidRequests}" class="msg-btn" target="_blank" rel="noopener">📋 عرض المساعدات</a>
<a href="${LINKS.viewDonations}" class="msg-btn" target="_blank" rel="noopener">📊 عرض التبرعات</a>
</div>`;

        // لا نُفشل طلب المستخدم لو تعثّر الرد التلقائي لأي سبب؛ فقط نسجّل الخطأ في اللوج
        const { error: autoErr } = await supabaseServer
          .from('messages')
          .insert({
            sender_id: finalReceiverId, // هوية الأدمن (نفس المعرّف الذي تحقّقنا منه أعلاه)
            receiver_id: senderId,      // المستخدم الذي راسل للتو
            text: AUTO_REPLY_HTML,
            media_url: null,
            media_type: null,
            status: 'sent',
            is_html: true // الرسالة الوحيدة الموثوقة كـ HTML لأنها من صياغة السيرفر نفسه، وليست مدخلة من مستخدم
          });

        if (autoErr) console.error('فشل إرسال الرد التلقائي:', autoErr.message);
      }

      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'الطريقة غير مسموح بها' });
}
