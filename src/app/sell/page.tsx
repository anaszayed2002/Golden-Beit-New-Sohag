"use client";

import { useState } from "react";
import Link from "next/link";
import Sketch from "@/components/Sketch";
import CloseButton from "@/components/CloseButton";
import { supabaseBrowser } from "@/lib/supabase";
import { OPT, PHONE_RE, ZONES, cleanPhone, digitsOnly, parseMoney, tierName, zoneOf, type Tier, type ZoneId } from "@/lib/site";
import { landRows } from "@/lib/landText";

const STEPS = ["الموقع", "المواصفات", "الحالة والملكية", "السعر وبياناتك", "المراجعة"];
const LAST = STEPS.length - 1;
// Which review rows belong to which step, so each block on the review screen can jump back to its step.
const SECTION_KEYS: string[][] = [
  ["الفئة", "المنطقة", "المجاورة", "البلوك"],
  ["المساحة", "موقع القطعة", "الاتجاه", "الإطلالة", "عرض الواجهة"],
  ["المرحلة البنائية", "الاستلام", "مهلة البناء", "تسلسل الملكية", "تفاصيل الحالة", "المرافق"],
  ["المطلوب", "المدفوع", "ملاحظات"],
];

type Form = {
  tier: Tier; zone: ZoneId; hood: string; block: string; plot_no: string;
  area: string; pos: string; dir: string; view: string; front_m: string;
  stage: string; legal: string; grace_months: string; ownership: string; ownership_note: string; utilities: string;
  price: number | null; paid: number | null; description: string; seller_name: string; seller_phone: string;
};
const initial: Form = {
  tier: "mm", zone: "z455", hood: "", block: "", plot_no: "", area: "", pos: "", dir: "", view: "", front_m: "",
  stage: "", legal: "", grace_months: "", ownership: "", ownership_note: "", utilities: "", price: null, paid: null, description: "", seller_name: "", seller_phone: "",
};

export default function SellPage() {
  const [f, setF] = useState<Form>(initial);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const zone = zoneOf(f.zone);
  const area = Number(f.area);
  const areaOk = area >= 50 && area <= 5000;

  function check(s: number) {
    if (s === 0 && zone.hoods.length && !f.hood.trim()) return "اكتب المجاورة";
    if (s === 1 && !areaOk) return "اكتب المساحة (من 50 لـ 5000 متر)";
    if (s === 2 && f.ownership === "حالة تفصيلية" && !f.ownership_note.trim()) return "اكتب تفاصيل الحالة";
    if (s === 3) {
      if (!f.price) return "اكتب المطلوب";
      if (f.seller_name.trim().length < 2) return "اكتب اسمك";
      if (!PHONE_RE.test(f.seller_phone)) return "رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01";
    }
    return "";
  }

  async function next() {
    const err = check(step);
    setError(err);
    if (err) return;
    if (step < LAST) { setStep(step + 1); window.scrollTo({ top: 0 }); return; }
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("submit_land", {
      p: { ...f, hood: zone.hoods.length ? f.hood : "", grace_months: f.legal === "مستلمة" ? f.grace_months : "" },
    });
    setBusy(false);
    if (error) return setError(/too many/.test(error.message) ? "بعت إعلانات كتير النهارده من الرقم ده، كلّمنا واتساب" : "الإعلان ما اتبعتش، راجع البيانات وجرّب تاني");
    setCode(String(data));
    window.scrollTo({ top: 0 });
  }

  const chips = (k: "pos" | "dir" | "view" | "stage" | "legal" | "ownership" | "utilities", label: string) => (
    <div className="field">{label}
      <div className="opts">
        {OPT[k].map((v) => (
          <button key={v} type="button" className="opt" aria-pressed={f[k] === v} onClick={() => set(k, f[k] === v ? "" : v)}>{v}</button>
        ))}
      </div>
    </div>
  );
  const num = (k: "block" | "plot_no" | "area" | "front_m" | "grace_months", label: string, ph = "", max = 4) => (
    <label className="field" htmlFor={`f_${k}`}>{label}
      <input id={`f_${k}`} className="num" inputMode="numeric" placeholder={ph} value={f[k]} autoComplete="off"
        onChange={(e) => set(k, digitsOnly(e.target.value).slice(0, max))} />
    </label>
  );
  const money = (k: "price" | "paid", label: string) => (
    <label className="field" htmlFor={`f_${k}`}>{label}
      <input id={`f_${k}`} className="num" inputMode="numeric" value={f[k] ? f[k]!.toLocaleString("en") : ""} autoComplete="off"
        onChange={(e) => set(k, parseMoney(e.target.value))} />
    </label>
  );

  if (code) {
    return (
      <main>
        <div className="wrap wiz">
          <div className="panel">
            <CloseButton label="إغلاق" />
            <h1>اتبعت للمراجعة</h1>
            <div className="done">إعلانك كوده <span className="num">{code}</span>. فريق جولدن بيت هيكلمك يراجع البيانات، وبعد الموافقة الأرض هتظهر في النتايج.</div>
            <div className="two">
              <Link className="btn dark" href="/">الأراضي المعروضة</Link>
              <button type="button" className="btn line" onClick={() => { setF(initial); setStep(0); setCode(""); }}>اعرض أرض تانية</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="wrap wiz">
        <form className="panel" onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
          <CloseButton label="إغلاق" />
          <h1>اعرض أرضك</h1>
          <div className="steps">{STEPS.map((s, i) => <div key={s} className={i <= step ? "on" : ""}><i />{s}</div>)}</div>
          <div className="prev"><Sketch area={areaOk ? area : f.tier === "mm" ? 500 : 276} pos={f.pos || null} dir={f.dir || null} front={Number(f.front_m) || null} big /></div>

          {step === 0 && (
            <>
              <div className="field">الفئة
                <div className="opts">
                  {(["mm", "mt"] as Tier[]).map((t) => (
                    <button key={t} type="button" className="opt" aria-pressed={f.tier === t}
                      onClick={() => setF((c) => ({ ...c, tier: t, zone: ZONES.find((z) => z.tier === t)!.id, hood: "" }))}>{tierName(t)}</button>
                  ))}
                </div>
              </div>
              <div className="field">المنطقة
                <div className="opts">
                  {ZONES.filter((z) => z.tier === f.tier).map((z) => (
                    <button key={z.id} type="button" className="opt" aria-pressed={f.zone === z.id} onClick={() => setF((c) => ({ ...c, zone: z.id, hood: "" }))}>{z.short}</button>
                  ))}
                </div>
              </div>
              {zone.hoods.length > 0 && (
                <label className="field" htmlFor="f_hood">المجاورة
                  <input id="f_hood" list="hoodList" placeholder="اكتب رقم أو اسم المجاورة" value={f.hood} autoComplete="off"
                    onChange={(e) => set("hood", e.target.value.slice(0, 40))} />
                  <datalist id="hoodList">{zone.hoods.map((h) => <option key={h} value={h} />)}</datalist>
                </label>
              )}
              <div className="two">{num("block", "البلوك")}{num("plot_no", "رقم القطعة (مش هيظهر)", "", 6)}</div>
            </>
          )}

          {step === 1 && (
            <>
              {num("area", "المساحة (م²)", f.tier === "mm" ? "مثلًا 500" : "مثلًا 276")}
              {chips("pos", "موقع القطعة")}
              {chips("dir", "الاتجاه")}
              {chips("view", "الإطلالة")}
              {num("front_m", "عرض الواجهة (م)", "", 3)}
            </>
          )}

          {step === 2 && (
            <>
              {chips("stage", "المرحلة البنائية")}
              {chips("legal", "الاستلام")}
              {f.legal === "مستلمة" && num("grace_months", "فاضل كام شهر في مهلة البناء؟", "", 3)}
              {chips("ownership", "تسلسل الملكية")}
              {f.ownership === "حالة تفصيلية" && (
                <label className="field" htmlFor="f_onote">اكتب تفاصيل الحالة *
                  <textarea id="f_onote" rows={3} maxLength={500} placeholder="مثلًا: الأرض باسم الوالد والبيع بتوكيل من الورثة..." value={f.ownership_note} onChange={(e) => set("ownership_note", e.target.value)} />
                </label>
              )}
              {chips("utilities", "المرافق")}
            </>
          )}

          {step === 3 && (
            <>
              <div className="two">{money("price", "المطلوب (جنيه) *")}{money("paid", "المدفوع (جنيه)")}</div>
              <label className="field" htmlFor="f_desc">ملاحظات
                <textarea id="f_desc" rows={3} maxLength={1000} value={f.description} onChange={(e) => set("description", e.target.value)} />
              </label>
              <div className="you">
                <b>بياناتك</b>
                <span>مش هتظهر في الإعلان. فريقنا بيستخدمها يكلمك بس.</span>
                <label className="field" htmlFor="f_name">الاسم *<input id="f_name" value={f.seller_name} onChange={(e) => set("seller_name", e.target.value.slice(0, 80))} autoComplete="name" /></label>
                <label className="field" htmlFor="f_phone">رقم الموبايل *
                  <input id="f_phone" className="num ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={f.seller_phone} onChange={(e) => set("seller_phone", cleanPhone(e.target.value))} autoComplete="tel" />
                </label>
              </div>
            </>
          )}

          {step === LAST && <Review f={f} onEdit={(s) => { setError(""); setStep(s); window.scrollTo({ top: 0 }); }} />}

          {error && <div className="err" role="alert">{error}</div>}
          <div className="wnav">
            {step > 0 && <button type="button" className="btn line" onClick={() => { setError(""); setStep(step === LAST ? 0 : step - 1); }}>{step === LAST ? "تعديل" : "رجوع"}</button>}
            <button type="submit" className="btn dark" disabled={busy}>{busy ? "بنبعت..." : step === LAST ? "تأكيد وابعت" : step === LAST - 1 ? "راجع البيانات" : "التالي"}</button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Review({ f, onEdit }: { f: Form; onEdit: (step: number) => void }) {
  const rows = landRows({
    tier: f.tier, zone: f.zone, hood: zoneOf(f.zone).hoods.length ? f.hood.trim() || null : null, block: f.block || null,
    area: Number(f.area), pos: f.pos || null, dir: f.dir || null, view: f.view || null, front_m: Number(f.front_m) || null,
    stage: f.stage || null, legal: f.legal || null, grace_months: f.grace_months ? Number(f.grace_months) : null,
    ownership: f.ownership || null, ownership_note: f.ownership_note.trim() || null, utilities: f.utilities || null,
    price: f.price ?? 0, paid: f.paid, description: f.description.trim() || null,
  });
  const extra: [string, string][][] = [[["رقم القطعة", f.plot_no]], [], [], [["الاسم", f.seller_name], ["رقم الموبايل", f.seller_phone]]];
  return (
    <div className="review">
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>راجع بيانات أرضك قبل ما تبعت. لو فيه حاجة غلط دوس «تعديل» جنبها.</p>
      {SECTION_KEYS.map((keys, i) => {
        const list = [...rows.filter(([k]) => keys.includes(k)), ...extra[i].filter(([, v]) => v)];
        return (
          <section className="rv" key={i}>
            <div className="rv-h"><b>{STEPS[i]}</b><button type="button" className="linkish" onClick={() => onEdit(i)}>تعديل</button></div>
            {list.length ? (
              <dl>{list.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
            ) : <p className="muted" style={{ margin: 0, fontSize: 13 }}>ما اخترتش حاجة هنا</p>}
          </section>
        );
      })}
    </div>
  );
}
