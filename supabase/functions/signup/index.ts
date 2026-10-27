// Creates a confirmed account from name + Egyptian mobile + password.
// Accounts use a synthetic email so no SMS or email provider is needed.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { name?: string; phone?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "البيانات مش مكتملة" }, 400);
  }
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const password = String(body.password ?? "");

  if (name.length < 2 || name.length > 80) return json({ error: "اكتب اسمك بالكامل" }, 400);
  if (!/^01[0125][0-9]{8}$/.test(phone)) return json({ error: "رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01" }, 400);
  if (password.length < 6) return json({ error: "كلمة السر لازم تكون 6 حروف أو أرقام على الأقل" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: existing } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (existing) return json({ error: "الرقم ده عليه حساب بالفعل، ادخل من «عندي حساب»" }, 409);

  const { error } = await admin.auth.admin.createUser({
    email: `${phone}@users.goldenbeit.com`,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, phone },
  });
  if (error) {
    const dup = /already|registered|exists/i.test(error.message);
    return json({ error: dup ? "الرقم ده عليه حساب بالفعل، ادخل من «عندي حساب»" : "حصلت مشكلة، جرّب تاني" }, dup ? 409 : 500);
  }
  return json({ ok: true });
});
