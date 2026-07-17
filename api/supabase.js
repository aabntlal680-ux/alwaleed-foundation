import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

// هذا الكائن مخصص للاستخدام داخل السيرفر فقط لأنه يحمل صلاحيات الأدمن كاملة
export const supabaseServer = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
