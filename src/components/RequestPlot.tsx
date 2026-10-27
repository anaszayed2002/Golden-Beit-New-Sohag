"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { useAccount } from "@/lib/useAccount";
import { PHONE_RE, normalizeDigits, waLink } from "@/lib/site";
import { WhatsAppIcon } from "./Icons";

export default function RequestPlot({ listingId, code, waText }: { listingId: string; code: string; waText: string }) {
  const { loading, profile } = useAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function send(n: string, p: string) {
    setError("");
    if (n.trim().length < 2) return setError("اكتب اسمك");
    if (!PHONE_RE.test(p)) return setError("رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01");
    setBusy(true);
    const { error } = await supabaseBrowser().from("plot_requests").insert({ listing_id: listingId, name: n.trim(), phone: p });
    setBusy(false);
    if (error) return setError("الطلب ما اتبعتش، جرّب تاني أو كلّمنا واتساب");
    setDone(true);
  }

  if (done) {
    return (
      <>
        <div className="done">تمام، اتسجل طلبك للقطعة دي. فريق جولدن بيت هيكلمك خلال 24 ساعة.</div>
        <a className="btn line block" href={waLink(`طلبت القطعة ${code} من الموقع. ${waText}`)} target="_blank" rel="noopener">
          <WhatsAppIcon />ابعت لنا على واتساب كمان
        </a>
      </>
    );
  }

  // Signed-in buyers already gave name and phone with their account.
  if (!loading && profile && profile.phone) {
    return (
      <>
        <button className="btn green block" disabled={busy} onClick={() => send(profile.full_name || "عميل", profile.phone)}>
          {busy ? "بنبعت..." : "اطلب القطعة"}
        </button>
        {error && <div className="err">{error}</div>}
      </>
    );
  }

  if (!open) {
    return <button className="btn green block" onClick={() => setOpen(true)}>اطلب القطعة</button>;
  }

  return (
    <form
      style={{ display: "grid", gap: 10 }}
      onSubmit={(e) => { e.preventDefault(); send(name, normalizeDigits(phone).replace(/\s/g, "")); }}
    >
      <label className="field" htmlFor="rqName">الاسم<input id="rqName" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
      <label className="field" htmlFor="rqPhone">رقم الموبايل
        <input id="rqPhone" className="num ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
      </label>
      {error && <div className="err">{error}</div>}
      <button className="btn green block" type="submit" disabled={busy}>{busy ? "بنبعت..." : "ابعت الطلب"}</button>
    </form>
  );
}
