"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FunctionsHttpError } from "@supabase/supabase-js";
import CloseButton from "@/components/CloseButton";
import { supabaseBrowser } from "@/lib/supabase";
import { useAccount } from "@/lib/useAccount";
import { PHONE_RE, normalizeDigits, phoneEmail } from "@/lib/site";

function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/sell";
}

export default function AccountPage() {
  const router = useRouter();
  const { loading, user } = useAccount();
  const [isNew, setIsNew] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace(nextPath());
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const p = normalizeDigits(phone).replace(/\s/g, "");
    if (isNew && name.trim().length < 2) return setError("اكتب اسمك بالكامل");
    if (!PHONE_RE.test(p)) return setError("رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01");
    if (password.length < 6) return setError("كلمة السر لازم تكون 6 حروف أو أرقام على الأقل");

    setBusy(true);
    const sb = supabaseBrowser();
    if (isNew) {
      const { error: fnError } = await sb.functions.invoke("signup", { body: { name: name.trim(), phone: p, password } });
      if (fnError) {
        let msg = "حصلت مشكلة، جرّب تاني";
        if (fnError instanceof FunctionsHttpError) {
          try { msg = (await fnError.context.json()).error || msg; } catch {}
        }
        setBusy(false);
        return setError(msg);
      }
    }
    const { error: signInError } = await sb.auth.signInWithPassword({ email: phoneEmail(p), password });
    setBusy(false);
    if (signInError) return setError(isNew ? "الحساب اتعمل بس الدخول ما نجحش، جرّب من «عندي حساب»" : "رقم الموبايل أو كلمة السر مش صح");
    router.replace(nextPath());
  }

  return (
    <main>
      <div className="wrap narrow">
        <form className="panel" onSubmit={submit} noValidate>
          <CloseButton label="إغلاق" />
          <h1>{isNew ? "اعمل حساب علشان تعرض أرضك" : "ادخل على حسابك"}</h1>
          <p>الحساب بيخليك تتابع إعلانك وتعرف لما يتوافق عليه.</p>
          <div className="seg" role="group" aria-label="نوع الدخول">
            <button type="button" aria-pressed={isNew} onClick={() => { setIsNew(true); setError(""); }}>حساب جديد</button>
            <button type="button" aria-pressed={!isNew} onClick={() => { setIsNew(false); setError(""); }}>عندي حساب</button>
          </div>
          {isNew && (
            <label className="field" htmlFor="aName">الاسم بالكامل
              <input id="aName" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label className="field" htmlFor="aPhone">رقم الموبايل
            <input id="aPhone" className="num ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </label>
          <label className="field" htmlFor="aPass">كلمة السر
            <input id="aPass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isNew ? "new-password" : "current-password"} />
          </label>
          {error && <div className="err" role="alert">{error}</div>}
          <button className="btn dark block" type="submit" disabled={busy}>
            {busy ? "لحظة..." : isNew ? "اعمل الحساب وكمّل" : "ادخل وكمّل"}
          </button>
        </form>
      </div>
    </main>
  );
}
