"use client";

import { useState } from "react";
import Link from "next/link";
import Sketch from "@/components/Sketch";
import MultiSelect from "@/components/MultiSelect";
import CloseButton from "@/components/CloseButton";
import { CloseIcon } from "@/components/Icons";
import { supabaseBrowser } from "@/lib/supabase";
import { ALL_HOODS, OPT, PHONE_RE, cleanPhone, decimalOnly, digitsOnly, fmtFull, hoodLabel, hoodZone, parseMoney, tierName } from "@/lib/site";
import { landSections, type CardFields } from "@/lib/landText";

const STEPS = ["المكان", "القطعة", "الحالة", "السعر", "بياناتك", "المراجعة"];
const LAST = STEPS.length - 1;
const BUILT = ["قيد البناء", "مبنى", "مبنى متشطب"];

type Form = {
  hood: string; plot_no: string; area: string; pos: string; front_m: string; views: string[];
  legal: string; delivery_date: string; stage: string; grace_until: string; build_reached: string; floors: string; basement: boolean;
  ownership: string; ownership_note: string;
  price: number | null; paid: number | null; over_amount: number | null;
  has_inst: boolean; inst_value: number | null; inst_count: string; inst_left: string; inst_first: string; inst_last: string;
  transfer_fee: number | null; pay_other: string; seller_name: string; seller_phone: string;
};
const initial: Form = {
  hood: "", plot_no: "", area: "", pos: "", front_m: "", views: [],
  legal: "", delivery_date: "", stage: "", grace_until: "", build_reached: "", floors: "", basement: false,
  ownership: "", ownership_note: "", price: null, paid: null, over_amount: null,
  has_inst: false, inst_value: null, inst_count: "", inst_left: "", inst_first: "", inst_last: "",
  transfer_fee: null, pay_other: "", seller_name: "", seller_phone: "",
};

// The form as a land card, so the review uses the same rules as the land page.
function asCard(f: Form): CardFields {
  const zone = hoodZone(f.hood) ?? "z735";
  const stage = f.legal === "مستلمة" ? f.stage || null : null;
  return {
    tier: ["z455", "z214", "ztm"].includes(zone) ? "mm" : "mt", zone, hood: zone === "zahy" ? null : f.hood || null,
    plot_no: f.plot_no || null, map_path: null,
    area: Number(f.area) || 0, pos: f.pos || null, front_m: Number(f.front_m) || null, views: f.views, services: [],
    legal: f.legal || null, delivery_date: f.legal === "غير مستلمة" ? f.delivery_date || null : null, stage,
    grace_until: stage === "أرض فضاء" || stage === "ذات رخصة" ? f.grace_until || null : null,
    build_reached: stage === "قيد البناء" ? f.build_reached || null : null,
    floors: stage === "مبنى" || stage === "مبنى متشطب" ? f.floors || null : null,
    basement: stage && BUILT.includes(stage) ? f.basement : null,
    ownership: f.ownership || null, ownership_note: f.ownership === "حالة تفصيلية" ? f.ownership_note.trim() || null : null,
    price: f.price ?? 0, paid: f.paid, over_amount: f.over_amount,
    inst_value: f.has_inst ? f.inst_value : null, inst_count: f.has_inst && f.inst_count ? Number(f.inst_count) : null,
    inst_left: f.has_inst && f.inst_left ? Number(f.inst_left) : null,
    inst_first: f.has_inst ? f.inst_first || null : null, inst_last: f.has_inst ? f.inst_last || null : null,
    transfer_fee: f.transfer_fee, pay_other: f.pay_other.trim() || null,
    block: null, dir: null, utilities: null, grace_months: null, description: null,
  };
}

// The map photo is shrunk on the phone before upload (long side 1600px, JPEG), so it uploads fast and stays small.
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("encode"))), "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SellPage() {
  const [f, setF] = useState<Form>(initial);
  const [map, setMap] = useState<{ blob: Blob; url: string } | null>(null);
  const [example, setExample] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const zone = hoodZone(f.hood);
  const tier = zone ? (["z455", "z214", "ztm"].includes(zone) ? "mm" : "mt") : null;
  const area = Number(f.area);
  const areaOk = area >= 50 && area <= 5000;

  function check(s: number) {
    if (s === 0 && !zone) return "اختار المجاورة";
    if (s === 1 && !areaOk) return "اكتب المساحة (من 50 لـ 5000 متر)";
    if (s === 1 && tier === "mm" && Math.floor(area) === 276) return "أراضي المميز مفيش فيها مساحة 276";
    if (s === 1 && f.front_m && !(Number(f.front_m) >= 3 && Number(f.front_m) <= 100)) return "عرض الواجهة لازم يكون بين 3 و100 متر";
    if (s === 2 && !f.legal) return "اختار الحالة";
    if (s === 2 && f.ownership === "حالة تفصيلية" && !f.ownership_note.trim()) return "اكتب تفاصيل الحالة";
    if (s === 3 && !f.price) return "اكتب السعر الكلي";
    if (s === 3 && f.has_inst && f.inst_left && f.inst_count && Number(f.inst_left) > Number(f.inst_count)) return "الأقساط المتبقية أكتر من عدد الأقساط";
    if (s === 4 && f.seller_name.trim().length < 2) return "اكتب اسمك";
    if (s === 4 && !PHONE_RE.test(f.seller_phone)) return "رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01";
    return "";
  }

  async function next() {
    const err = check(step);
    setError(err);
    if (err) return;
    if (step < LAST) { setStep(step + 1); window.scrollTo({ top: 0 }); return; }
    setBusy(true);
    const sb = supabaseBrowser();
    let map_path: string | null = null;
    if (map) {
      const path = `m/${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from("land-maps").upload(path, map.blob, { contentType: "image/jpeg" });
      if (up.error) { setBusy(false); return setError("صورة الخريطة ما اترفعتش، جرّب تاني أو شيلها"); }
      map_path = path;
    }
    const { data, error } = await sb.rpc("submit_land", { p: { ...f, map_path } });
    setBusy(false);
    if (error) {
      if (/too many/.test(error.message)) return setError("بعت إعلانات كتير النهارده من الرقم ده، كلّمنا واتساب");
      if (/premium 276/.test(error.message)) return setError("أراضي المميز مفيش فيها مساحة 276");
      if (error.code === "23514") return setError("فيه رقم مش منطقي، راجع البيانات من «تعديل»");
      return setError("الإعلان ما اتبعتش، جرّب تاني أو كلّمنا واتساب");
    }
    setCode(String(data));
    window.scrollTo({ top: 0 });
  }

  const chips = (k: "pos" | "legal" | "stage" | "build_reached" | "ownership", label: string, required = false) => (
    <div className="field">{label}{required ? " *" : ""}
      <div className="opts">
        {OPT[k].map((v) => (
          <button key={v} type="button" className="opt" aria-pressed={f[k] === v} onClick={() => set(k, f[k] === v ? "" : v)}>{v}</button>
        ))}
      </div>
    </div>
  );
  const text = (k: "plot_no" | "inst_count" | "inst_left", label: string, max: number) => (
    <label className="field" htmlFor={`f_${k}`}>{label}
      <input id={`f_${k}`} className="num" inputMode="numeric" value={f[k]} autoComplete="off" onChange={(e) => set(k, digitsOnly(e.target.value).slice(0, max))} />
    </label>
  );
  const dec = (k: "area" | "front_m", label: string, ph: string, maxInt: number) => (
    <label className="field" htmlFor={`f_${k}`}>{label}
      <input id={`f_${k}`} className="num" inputMode="decimal" placeholder={ph} value={f[k]} autoComplete="off" onChange={(e) => set(k, decimalOnly(e.target.value, maxInt))} />
    </label>
  );
  const money = (k: "price" | "paid" | "over_amount" | "inst_value" | "transfer_fee", label: string) => (
    <label className="field" htmlFor={`f_${k}`}>{label}
      <input id={`f_${k}`} className="num" inputMode="numeric" value={f[k] ? f[k]!.toLocaleString("en") : ""} autoComplete="off" onChange={(e) => set(k, parseMoney(e.target.value))} />
    </label>
  );
  const day = (k: "delivery_date" | "grace_until" | "inst_first" | "inst_last", label: string) => (
    <label className="field" htmlFor={`f_${k}`}>{label}
      <input id={`f_${k}`} type="date" value={f[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );
  const calc = (label: string, hint: string, value: number) => (
    <div className={`calc${value < 0 ? " neg" : ""}`}><span>{label}<small>{hint}</small></span><b className="num">{fmtFull(value)}</b></div>
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
              <button type="button" className="btn line" onClick={() => { setF(initial); setMap(null); setStep(0); setCode(""); }}>اعرض أرض تانية</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const due = (f.paid ?? 0) + (f.over_amount ?? 0);
  const instTotal = (f.inst_value ?? 0) * (Number(f.inst_count) || 0);
  const instLeft = (f.inst_value ?? 0) * (Number(f.inst_left) || 0);

  return (
    <main>
      <div className="wrap wiz">
        <form className="panel" onSubmit={(e) => { e.preventDefault(); next(); }} noValidate>
          <CloseButton label="إغلاق" />
          <h1>اعرض أرضك</h1>
          <div className="steps">{STEPS.map((s, i) => <div key={s} className={i <= step ? "on" : ""}><i />{s}</div>)}</div>
          {step <= 1 && <div className="prev"><Sketch area={areaOk ? area : tier === "mm" ? 500 : 276} pos={f.pos || null} front={Number(f.front_m) || null} big /></div>}

          {step === 0 && (
            <>
              <div className="fixed"><span>المدينة</span><b>سوهاج الجديدة</b></div>
              <label className="field" htmlFor="f_hood">المجاورة *
                <select id="f_hood" value={f.hood} onChange={(e) => set("hood", e.target.value)}>
                  <option value="">اختار المجاورة</option>
                  {ALL_HOODS.map((h) => <option key={h} value={h}>{hoodLabel(h)}</option>)}
                </select>
              </label>
              <div className="fixed"><span>القطعة</span>{tier ? <span className={`tier-tag ${tier}`}>{tierName(tier)}</span> : <span className="muted" style={{ fontSize: 12 }}>بتتحدد لوحدها من المجاورة</span>}</div>
              {text("plot_no", "رقم القطعة", 6)}
              <div className="field">صورة الخريطة وعليها سهم على القطعة <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>اختياري</span>
                <div className="mapup">
                  <button type="button" className="mapex" onClick={() => setExample(true)} aria-label="شوف المثال">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/map-example.svg" alt="" />
                    <span>شوف المثال</span>
                  </button>
                  <p>خد صورة (سكرين شوت) من خريطة المجاورة، وارسم سهم على قطعتك زي المثال، وارفعها هنا.</p>
                </div>
                {map ? (
                  <div className="mapprev">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={map.url} alt="صورة الخريطة اللي اخترتها" />
                    <button type="button" className="btn line sm" onClick={() => { URL.revokeObjectURL(map.url); setMap(null); }}>شيل الصورة</button>
                  </div>
                ) : (
                  <label className="btn line upbtn" htmlFor="f_map">ارفع صورة الخريطة
                    <input id="f_map" type="file" accept="image/*" hidden onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        const blob = await shrink(file);
                        setMap({ blob, url: URL.createObjectURL(blob) });
                        setError("");
                      } catch { setError("الصورة دي مش مدعومة، جرّب صورة تانية"); }
                    }} />
                  </label>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              {dec("area", "المساحة (م²) *", tier === "mm" ? "مثلًا 500" : "مثلًا 276.5", 4)}
              <div className="sec">
                <h2>التميز النوعي للقطعة</h2>
                {chips("pos", "الواجهة")}
                {dec("front_m", "عرض الواجهة (م)", "مثلًا 12.5", 3)}
              </div>
              <div className="field">التميز الجغرافي والإطلالة <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>اختار كل اللي ينطبق</span>
                <MultiSelect id="f_views" options={OPT.views} value={f.views} onChange={(v) => set("views", v)} placeholder="اختار من القايمة" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {chips("legal", "الحالة", true)}
              {f.legal === "غير مستلمة" && <div className="sub">{day("delivery_date", "موعد الاستلام")}</div>}
              {f.legal === "مستلمة" && (
                <div className="sub">
                  {chips("stage", "المرحلة البنائية")}
                  {(f.stage === "أرض فضاء" || f.stage === "ذات رخصة") && day("grace_until", "آخر موعد لمهلة البناء")}
                  {f.stage === "قيد البناء" && chips("build_reached", "وصل لحد")}
                  {(f.stage === "مبنى" || f.stage === "مبنى متشطب") && (
                    <label className="field" htmlFor="f_floors">عدد الأدوار
                      <select id="f_floors" value={f.floors} onChange={(e) => set("floors", e.target.value)}>
                        <option value="">اختار</option>
                        {OPT.floors.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </label>
                  )}
                  {BUILT.includes(f.stage) && (
                    <label className="check"><input type="checkbox" checked={f.basement} onChange={(e) => set("basement", e.target.checked)} />فيه بدروم</label>
                  )}
                </div>
              )}
              {chips("ownership", "تسلسل الملكية")}
              {f.ownership === "حالة تفصيلية" && (
                <label className="field" htmlFor="f_onote">اكتب تفاصيل الحالة *
                  <textarea id="f_onote" rows={3} maxLength={500} placeholder="مثلًا: الأرض باسم الوالد والبيع بتوكيل من الورثة..." value={f.ownership_note} onChange={(e) => set("ownership_note", e.target.value)} />
                </label>
              )}
            </>
          )}

          {step === 3 && (
            <>
              {money("price", "السعر الكلي (جنيه) *")}
              <div className="two">{money("paid", "المدفوع")}{money("over_amount", "الأوفر")}</div>
              {calc("المطلوب دفعه", "المدفوع + الأوفر", due)}
              {calc("المتبقي", "السعر الكلي − المطلوب دفعه", (f.price ?? 0) - due)}
              <label className="check"><input type="checkbox" checked={f.has_inst} onChange={(e) => set("has_inst", e.target.checked)} />فيه أقساط</label>
              {f.has_inst && (
                <div className="sub">
                  <div className="two">{money("inst_value", "قيمة القسط")}{text("inst_count", "عدد الأقساط", 3)}</div>
                  {calc("إجمالي الأقساط", "القسط × العدد", instTotal)}
                  {text("inst_left", "عدد الأقساط المتبقية", 3)}
                  {calc("إجمالي الأقساط المتبقية", "القسط × المتبقي", instLeft)}
                  <div className="two">{day("inst_first", "موعد أول قسط")}{day("inst_last", "موعد آخر قسط")}</div>
                </div>
              )}
              {money("transfer_fee", "قيمة التنازل (اختياري)")}
              <label className="field" htmlFor="f_other">أخرى
                <textarea id="f_other" rows={2} maxLength={500} placeholder="أي بند دفع تاني" value={f.pay_other} onChange={(e) => set("pay_other", e.target.value)} />
              </label>
            </>
          )}

          {step === 4 && (
            <div className="you">
              <b>بياناتك</b>
              <span>مش هتظهر في الإعلان. فريقنا بيستخدمها يكلمك بس.</span>
              <label className="field" htmlFor="f_name">الاسم *<input id="f_name" value={f.seller_name} onChange={(e) => set("seller_name", e.target.value.slice(0, 80))} autoComplete="name" /></label>
              <label className="field" htmlFor="f_phone">رقم الموبايل *
                <input id="f_phone" className="num ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={f.seller_phone} onChange={(e) => set("seller_phone", cleanPhone(e.target.value))} autoComplete="tel" />
              </label>
            </div>
          )}

          {step === LAST && (
            <div className="review">
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>راجع بيانات أرضك قبل ما تبعت. لو فيه حاجة غلط دوس «تعديل» جنبها.</p>
              {landSections(asCard(f)).map((s, i) => {
                const extra: [string, string][] = i === 0 ? [...(f.plot_no ? [["رقم القطعة", f.plot_no]] : []), ...(map ? [["صورة الخريطة", "مرفوعة"]] : [])] as [string, string][] : [];
                const rows: [string, string][] = [...s.rows, ...extra];
                return <ReviewBlock key={s.title} title={s.title} rows={rows} onEdit={() => { setError(""); setStep(i); }} />;
              })}
              <ReviewBlock title="بياناتك" rows={[["الاسم", f.seller_name], ["الموبايل", f.seller_phone]]} onEdit={() => { setError(""); setStep(4); }} />
            </div>
          )}

          {error && <div className="err" role="alert">{error}</div>}
          <div className="wnav">
            {step > 0 && <button type="button" className="btn line" onClick={() => { setError(""); setStep(step === LAST ? 0 : step - 1); }}>{step === LAST ? "تعديل" : "رجوع"}</button>}
            <button type="submit" className="btn dark" disabled={busy}>{busy ? "بنبعت..." : step === LAST ? "تأكيد وابعت" : step === LAST - 1 ? "راجع البيانات" : "التالي"}</button>
          </div>
        </form>
        {example && (
          <div className="sheet-bg cv-bg" onClick={() => setExample(false)}>
            <div className="cv" role="dialog" aria-modal="true" aria-label="مثال صورة الخريطة">
              <button type="button" className="x" aria-label="إغلاق" onClick={() => setExample(false)}><CloseIcon /></button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="cv-pic"><img src="/map-example.svg" alt="مثال: خريطة المجاورة وسهم أحمر على القطعة" /></div>
              <p className="cv-note">خريطة المجاورة، وسهم واضح بيشاور على قطعتك. خلّي أرقام القطع والشوارع باينة.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ReviewBlock({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
  return (
    <section className="rv">
      <div className="rv-h"><b>{title}</b><button type="button" className="linkish" onClick={onEdit}>تعديل</button></div>
      {rows.length ? <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
        : <p className="muted" style={{ margin: 0, fontSize: 13 }}>ما اخترتش حاجة هنا</p>}
    </section>
  );
}
