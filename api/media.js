export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'الطريقة غير مسموح بها' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'رابط الملف مفقود' });

  let target;
  try {
    target = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'رابط غير صالح' });
  }

  // نسمح فقط بجلب ملفات من نطاق مشروع Supabase الخاص بك، لمنع استخدام الوسيط لجلب أي رابط خارجي (SSRF)
  const allowedHost = new URL(process.env.SUPABASE_URL).host;
  if (target.host !== allowedHost) {
    return res.status(403).json({ error: 'مصدر الملف غير مسموح به' });
  }

  try {
    const upstream = await fetch(target.toString());
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'تعذر جلب الملف من التخزين' });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // الملف لا يتغير أبداً بعد رفعه
    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(500).json({ error: 'فشل الاتصال بخادم التخزين: ' + e.message });
  }
}
