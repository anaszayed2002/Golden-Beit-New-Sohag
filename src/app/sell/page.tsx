"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Plot from "@/components/Plot";
import CloseButton from "@/components/CloseButton";
import { supabaseBrowser } from "@/lib/supabase";
import { useAccount } from "@/lib/useAccount";
import { AREAS, FEATURES, PHONE_RE, normalizeDigits, parseMoney, tierName, type Tier } from "@/lib/site";
import type { Neighborhood } from "@/lib/types";

const money = (n: number | null) => (n ? n.toLocaleString("en") : "");

export default function SellPage() {
  const router = useRouter();
  const { loading, user } = useAccount();
  const [hoods, setHoods] = useState<Neighborhood[]>([]);
  const [tier, setTier] = useState<Tier>("mt");
  const [area, setArea] = useState(209);
  const [customArea, setCustomArea] = useState("");
  const [hood, setHood] = useState("");
  const [plotNo, setPlotNo] = useState("");
  const [ask, setAsk] = useState<number | null>(null);
  const [paid, setPaid] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneCode, setDoneCode] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/account?next=/sell");
  }, [loading, user, router]);

  useEffect(() => {
    supabaseBrowser().from("neighborhoods").select("n,tier,label").eq("active", true).order("sort")
      .then(({ data }) => setHoods((data ?? []) as Neighborhood[]));
  }, []);

  const tierHoods = useMemo(() => hoods.filter((h) => h.tier === tier), [hoods, tier]);
  const custom = Number(customArea) || 0;
  const effectiveArea = custom >= 50 && custom <= 5000 ? custom : area;

  function pickTier(t: Tier) {
    setTier(t);
    setArea(AREAS[t][0]);
    setCustomArea("");
    setHood("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const p = normalizeDigits(phone).replace(/\s/g, "");
    if (!hood) return setError("اختار المجاورة");
    if (customArea && !(custom >= 50 && custom <= 5000)) return setError("المساحة لازم تكون بين 50 و5000 متر");
    if (!ask) return setError("اكتب المطلوب");
    if (!PHONE_RE.test(p)) return setError("رقم التليفون لازم يكون 11 رقم ويبدأ بـ 01");
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("submit_listing", {
      p_tier: tier,
      p_neighborhood: Number(hood),
      p_area: effectiveArea,
      p_ask: ask,
      p_paid: paid,
      p_features: features,
      p_description: desc,
      p_contact_phone: p,
      p_plot_no: plotNo,
    });
    setBusy(false);
    if (error) return setError("الإعلان ما اتبعتش، راجع البيانات وجرّب تاني");
    setDoneCode(String(data));
    window.scrollTo({ top: 0 });
  }

  if (loading || !user) return <main><p className="loading">لحظة...</p></main>;

  if (doneCode) {
    return (
      <main>
        <div className="wrap narrow">
          <div className="panel">
            <CloseButton label="إغلاق" />
            <h1>اتبعت للمراجعة</h1>
            <div className="done">إعلانك رقم <span className="num">{doneCode}</span> دلوقتي &quot;في المراجعة&quot;، وهيظهر في الأراضي المعروضة أول ما يتوافق عليه. فريق جولدن بيت هيكلمك.</div>
            <div className="two">
              <Link className="btn dark" href="/my">إعلاناتي</Link>
              <Link className="btn line" href="/">الأراضي المعروضة</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="wrap narrow" style={{ maxWidth: 680 }}>
        <form className="panel" onSubmit={submit} noValidate>
          <CloseButton label="إغلاق" />
          <h1>بيانات أرضك</h1>
          <p>بعد ما تبعت، فريق جولدن بيت هيراجع البيانات ويكلمك، وبعد الموافقة الأرض هتظهر في الموقع.</p>
          <div className="s-prev" aria-hidden="true"><Plot area={effectiveArea} big /></div>
          <div className="two">
            <div className="field">الفئة
              <div className="chips">
                {(["mt", "mm"] as Tier[]).map((t) => (
                  <button key={t} type="button" aria-pressed={tier === t} onClick={() => pickTier(t)}>{tierName(t)}</button>
                ))}
              </div>
            </div>
            <div className="field">المساحة
              <div className="chips">
                {AREAS[tier].map((a) => (
                  <button key={a} type="button" className="num" aria-pressed={!customArea && area === a} onClick={() => { setArea(a); setCustomArea(""); }}>{a} م²</button>
                ))}
              </div>
              <input
                id="sAreaOther"
                aria-label="مساحة تانية بالمتر"
                className="num"
                inputMode="numeric"
                placeholder="أو اكتب المساحة بالمتر"
                value={customArea}
                onChange={(e) => setCustomArea(normalizeDigits(e.target.value).replace(/[^\d]/g, "").slice(0, 4))}
              />
            </div>
          </div>
          <div className="two">
            <label className="field" htmlFor="sHood">المجاورة
              <select id="sHood" value={hood} onChange={(e) => setHood(e.target.value)}>
                <option value="">اختار</option>
                {tierHoods.map((h) => <option key={h.n} value={h.n}>مجاورة {h.n}{h.label ? ` (${h.label})` : ""}</option>)}
              </select>
            </label>
            <label className="field" htmlFor="sPlot">رقم القطعة
              <input id="sPlot" className="num" value={plotNo} onChange={(e) => setPlotNo(e.target.value.slice(0, 20))} autoComplete="off" />
            </label>
          </div>
          <div className="two">
            <label className="field" htmlFor="sAsk">المطلوب (جنيه)
              <input id="sAsk" className="num" inputMode="numeric" value={money(ask)} onChange={(e) => setAsk(parseMoney(normalizeDigits(e.target.value)))} autoComplete="off" />
            </label>
            <label className="field" htmlFor="sPaid">المدفوع (جنيه)
              <input id="sPaid" className="num" inputMode="numeric" value={money(paid)} onChange={(e) => setPaid(parseMoney(normalizeDigits(e.target.value)))} autoComplete="off" />
            </label>
          </div>
          <label className="field" htmlFor="sPhone">رقم التليفون
            <input id="sPhone" className="num ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </label>
          <div className="field">مميزات الأرض
            <div className="chips">
              {FEATURES.map((f) => (
                <button key={f} type="button" aria-pressed={features.includes(f)}
                  onClick={() => setFeatures((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]))}>{f}</button>
              ))}
            </div>
          </div>
          <label className="field" htmlFor="sDesc">وصف إضافي
            <textarea id="sDesc" rows={3} maxLength={1000} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          {error && <div className="err" role="alert">{error}</div>}
          <button className="btn dark block" type="submit" disabled={busy}>{busy ? "بنبعت..." : "ابعت للمراجعة"}</button>
        </form>
      </div>
    </main>
  );
}
