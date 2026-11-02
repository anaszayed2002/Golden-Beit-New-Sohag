"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import { useCompare } from "@/lib/compare";
import { PHONE_RE, cleanPhone } from "@/lib/site";

// Buyer leaves name + phone under the WhatsApp button; it lands in the dashboard as a purchase request.
export default function PurchaseBox({ landId, code }: { landId: string; code: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const compare = useCompare();
  const inCompare = compare.has(code);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("اكتب اسمك");
    if (!PHONE_RE.test(phone)) return setError("رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01");
    setBusy(true);
    const { error } = await supabaseBrowser().from("purchase_requests").insert({ land_id: landId, name: name.trim(), phone });
    setBusy(false);
    if (error) return setError("الطلب ما اتبعتش، جرّب تاني أو كلّمنا واتساب");
    setDone(true);
  }

  return (
    <>
      {done ? (
        <div className="done">اتسجل طلب الشراء. فريق جولدن بيت هيكلمك خلال 24 ساعة.</div>
      ) : (
        <form className="buy" onSubmit={submit} noValidate>
          <div className="buy-h">أو اطلب القطعة باسمك</div>
          <label className="field" htmlFor="bName">الاسم<input id="bName" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label className="field" htmlFor="bPhone">رقم الموبايل
            <input id="bPhone" className="num ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(cleanPhone(e.target.value))} autoComplete="tel" />
          </label>
          {error && <div className="err" role="alert">{error}</div>}
          <button className="btn green" type="submit" disabled={busy}>{busy ? "بنبعت..." : "اطلب القطعة"}</button>
        </form>
      )}
      <button type="button" className="btn line" onClick={() => compare.toggle(code)}>{inCompare ? "شيلها من المقارنة" : "أضف للمقارنة"}</button>
      {compare.codes.length >= 2 && <Link className="cmp-link" href={`/compare?c=${compare.codes.join(",")}`}>قارن {compare.codes.length} أراضي ←</Link>}
    </>
  );
}
