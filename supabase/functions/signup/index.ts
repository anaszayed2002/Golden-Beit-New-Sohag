// Sign-up is closed: the site has one admin account and customers never sign up.
// Kept as a stub so any old client gets a clear answer instead of a 404.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return new Response(JSON.stringify({ error: "التسجيل مقفول" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
});
