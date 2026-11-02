"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase";
import { useAccount } from "@/lib/useAccount";
import { PHONE_RE, cleanPhone, fmtFull, fmtShort, phoneEmail, placeLabel, tierName, waTo } from "@/lib/site";
import { STATUS_NAME, type Land, type LandStatus } from "@/lib/types";
import { WhatsAppIcon } from "@/components/Icons";

type Private = { seller_name: string; seller_phone: string; plot_no: string | null };
type AdminLand = Land & { land_private: Private | Private[] | null };
type ReqStatus = "new" | "contacted" | "done" | "cancelled";
type Purchase = { id: string; name: string; phone: string; status: ReqStatus; created_at: string; lands: Pick<Land, "code" | "area" | "zone" | "hood" | "price"> | null };
type Alert = { id: string; name: string; phone: string; status: "new" | "contacted" | "done"; criteria: Record<string, unknown>; created_at: string };
type Tab = "pending" | "lands" | "requests" | "alerts";

const REQ_NAME: Record<ReqStatus, string> = { new: "جديد", contacted: "اتكلمنا معاه", done: "اتقفل", cancelled: "اتلغى" };
const priv = (x: AdminLand): Private | null => (Array.isArray(x.land_private) ? x.land_private[0] ?? null : x.land_private);
const date = (s: string) => new Date(s).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });

export default function AdminPage() {
  const { loading, user, profile } = useAccount();
  if (loading) return <main><p className="loading">لحظة...</p></main>;
  if (!user) return <AdminLogin />;
  if (profile?.role !== "admin") {
    return (
      <main><div className="wrap wiz"><div className="panel"><h1>الصفحة دي للإدارة بس</h1>
        <button className="btn dark" onClick={() => supabaseBrowser().auth.signOut()}>خروج</button></div></div></main>
    );
  }
  return <Dashboard name={profile.full_name} />;
}

function AdminLogin() {
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (isNew && name.trim().length < 2) return setError("اكتب اسمك");
    if (!PHONE_RE.test(phone)) return setError("رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01");
    if (password.length < 6) return setError("كلمة السر 6 حروف أو أرقام على الأقل");
    setBusy(true);
    const sb = supabaseBrowser();
    if (isNew) {
      const { error: fnError } = await sb.functions.invoke("signup", { body: { name: name.trim(), phone, password } });
      if (fnError) {
        let msg = "حصلت مشكلة، جرّب تاني";
        if (fnError instanceof FunctionsHttpError) { try { msg = (await fnError.context.json()).error || msg; } catch {} }
        setBusy(false);
        return setError(msg);
      }
    }
    const { error: signInError } = await sb.auth.signInWithPassword({ email: phoneEmail(phone), password });
    setBusy(false);
    if (signInError) setError("رقم الموبايل أو كلمة السر مش صح");
  }

  return (
    <main>
      <div className="wrap wiz">
        <form className="panel" onSubmit={submit} noValidate>
          <h1>دخول الإدارة</h1>
          <div className="seg2" role="group" aria-label="نوع الدخول">
            <button type="button" aria-pressed={!isNew} onClick={() => setIsNew(false)}>دخول</button>
            <button type="button" aria-pressed={isNew} onClick={() => setIsNew(true)}>أول مرة</button>
          </div>
          {isNew && <label className="field" htmlFor="adName">الاسم<input id="adName" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}
          <label className="field" htmlFor="adPhone">رقم الموبايل
            <input id="adPhone" className="num ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(cleanPhone(e.target.value))} autoComplete="username" />
          </label>
          <label className="field" htmlFor="adPass">كلمة السر
            <input id="adPass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isNew ? "new-password" : "current-password"} />
          </label>
          {error && <div className="err" role="alert">{error}</div>}
          <button className="btn dark" type="submit" disabled={busy}>{busy ? "لحظة..." : isNew ? "اعمل حساب الإدارة" : "ادخل"}</button>
        </form>
      </div>
    </main>
  );
}

function Dashboard({ name }: { name: string }) {
  const [tab, setTab] = useState<Tab>("pending");
  const [lands, setLands] = useState<AdminLand[]>([]);
  const [requests, setRequests] = useState<Purchase[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [code, setCode] = useState("");
  const [statusFilter, setStatusFilter] = useState<LandStatus | "all">("approved");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const [l, r, a] = await Promise.all([
      sb.from("lands").select("*, land_private(seller_name,seller_phone,plot_no)").order("created_at", { ascending: false }),
      sb.from("purchase_requests").select("id,name,phone,status,created_at, lands(code,area,zone,hood,price)").order("created_at", { ascending: false }),
      sb.from("land_alerts").select("*").order("created_at", { ascending: false }),
    ]);
    setError(l.error || r.error || a.error ? "في بيانات ما اتحمّلتش، دوس تحديث" : "");
    setLands((l.data ?? []) as unknown as AdminLand[]);
    setRequests((r.data ?? []) as unknown as Purchase[]);
    setAlerts((a.data ?? []) as Alert[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function update(table: "lands" | "purchase_requests" | "land_alerts", id: string, status: string) {
    setBusyId(id); setError("");
    const { error } = await supabaseBrowser().from(table).update({ status }).eq("id", id);
    setBusyId("");
    if (error) return setError("التعديل ما اتحفظش");
    if (table === "lands") setLands((c) => c.map((x) => (x.id === id ? { ...x, status: status as LandStatus } : x)));
    if (table === "purchase_requests") setRequests((c) => c.map((x) => (x.id === id ? { ...x, status: status as ReqStatus } : x)));
    if (table === "land_alerts") setAlerts((c) => c.map((x) => (x.id === id ? { ...x, status: status as Alert["status"] } : x)));
  }

  // Code search: "1005", "gb-1005" or a seller phone all work.
  const q = code.trim().toUpperCase().replace(/\s/g, "");
  const found = useMemo(() => {
    if (!q) return [];
    const digits = q.replace(/[^\d]/g, "");
    return lands.filter((x) => x.code.toUpperCase().includes(q) || (digits.length >= 3 && x.code.replace(/[^\d]/g, "").endsWith(digits)) || (digits.length >= 6 && priv(x)?.seller_phone.includes(digits)));
  }, [q, lands]);

  const pending = lands.filter((x) => x.status === "pending");
  const shown = lands.filter((x) => x.status !== "pending" && (statusFilter === "all" || x.status === statusFilter));
  const newReq = requests.filter((r) => r.status === "new").length;
  const newAlerts = alerts.filter((r) => r.status === "new").length;

  const landRow = (x: AdminLand) => {
    const p = priv(x);
    return (
      <div className="arow" key={x.id}>
        <div>
          <h3><span className="num code">{x.code}</span><span>{x.area} م² · {placeLabel(x.zone, x.hood)}</span><span className="tag g">{tierName(x.tier)}</span><span className={`tag st-${x.status}`}>{STATUS_NAME[x.status]}</span></h3>
          <p className="sub">المطلوب <b className="num">{fmtFull(x.price)}</b>{x.paid != null && <> · المدفوع <span className="num">{fmtFull(x.paid)}</span></>}{x.block && <> · بلوك {x.block}</>}{p?.plot_no && <> · قطعة <span className="num">{p.plot_no}</span></>} · {date(x.created_at)}</p>
          <p className="sub">{[x.pos, x.dir, x.view, x.front_m ? `واجهة ${x.front_m}م` : "", x.stage, x.legal, x.ownership, x.utilities].filter(Boolean).join(" · ")}</p>
          {x.description && <p className="sub">{x.description}</p>}
          <p className="seller">صاحب الأرض: <b>{p?.seller_name ?? "—"}</b> · <a className="num" href={p ? `tel:${p.seller_phone}` : undefined}>{p?.seller_phone}</a></p>
        </div>
        <div className="acts">
          {p && <a className="btn wa sm" target="_blank" rel="noopener" href={waTo(p.seller_phone, `أهلاً ${p.seller_name}، معاك جولدن بيت بخصوص أرضك ${x.code} (${x.area} م² ${placeLabel(x.zone, x.hood)}).`)}><WhatsAppIcon />صاحب الأرض</a>}
          {x.status === "approved" && <Link className="btn line sm" href={`/land/${x.code}`} target="_blank">الإعلان</Link>}
          {x.status !== "approved" && <button className="btn green sm" disabled={busyId === x.id} onClick={() => update("lands", x.id, "approved")}>{x.status === "pending" ? "وافق وانشر" : "انشر تاني"}</button>}
          {x.status === "approved" && <button className="btn dark sm" disabled={busyId === x.id} onClick={() => update("lands", x.id, "sold")}>اتباعت</button>}
          {(x.status === "pending" || x.status === "approved") && <button className="btn danger sm" disabled={busyId === x.id} onClick={() => update("lands", x.id, "rejected")}>{x.status === "pending" ? "ارفض" : "إخفاء"}</button>}
        </div>
      </div>
    );
  };

  return (
    <main>
      <div className="wrap adm">
        <div className="adm-h">
          <div><h1>لوحة التحكم</h1><p className="note">أهلاً {name}</p></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn line sm" onClick={load}>تحديث</button>
            <button className="btn line sm" onClick={() => supabaseBrowser().auth.signOut()}>خروج</button>
          </div>
        </div>

        <label className="codebox" htmlFor="codeSearch">
          <span>ابحث بكود الوحدة</span>
          <input id="codeSearch" className="num ltr" placeholder="GB-1005 أو 1005 أو رقم البائع" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        </label>
        {q && (
          <div className="rows">
            {found.length ? found.map(landRow) : <div className="empty">مفيش وحدة بالكود ده.</div>}
          </div>
        )}

        <div className="kpis">
          <button type="button" className={`kpi${pending.length ? " hot" : ""}`} onClick={() => setTab("pending")}><span className="k-l">مستني مراجعة</span><b className="k-v num">{pending.length}</b></button>
          <button type="button" className="kpi" onClick={() => { setTab("lands"); setStatusFilter("approved"); }}><span className="k-l">أراضي معروضة</span><b className="k-v num">{lands.filter((x) => x.status === "approved").length}</b></button>
          <button type="button" className={`kpi${newReq ? " hot" : ""}`} onClick={() => setTab("requests")}><span className="k-l">طلبات شراء جديدة</span><b className="k-v num">{newReq}</b></button>
          <button type="button" className={`kpi${newAlerts ? " hot" : ""}`} onClick={() => setTab("alerts")}><span className="k-l">تنبيهات جديدة</span><b className="k-v num">{newAlerts}</b></button>
        </div>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "pending"} onClick={() => setTab("pending")}>المراجعة<span className="num">{pending.length}</span></button>
          <button role="tab" aria-selected={tab === "lands"} onClick={() => setTab("lands")}>الأراضي</button>
          <button role="tab" aria-selected={tab === "requests"} onClick={() => setTab("requests")}>طلبات الشراء<span className="num">{requests.length}</span></button>
          <button role="tab" aria-selected={tab === "alerts"} onClick={() => setTab("alerts")}>التنبيهات<span className="num">{alerts.length}</span></button>
        </div>
        {error && <div className="err" role="alert">{error}</div>}

        {tab === "pending" && <div className="rows">{pending.length ? pending.map(landRow) : <div className="empty">مفيش أراضي مستنية مراجعة.</div>}</div>}

        {tab === "lands" && (
          <>
            <div className="adm-filter">
              <select aria-label="الحالة" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LandStatus | "all")}>
                <option value="approved">معروضة</option><option value="sold">اتباعت</option><option value="rejected">مرفوضة</option><option value="all">الكل</option>
              </select>
            </div>
            <div className="rows">{shown.length ? shown.map(landRow) : <div className="empty">مفيش أراضي هنا.</div>}</div>
          </>
        )}

        {tab === "requests" && (
          <div className="rows">
            {requests.length === 0 && <div className="empty">لسه مفيش طلبات شراء.</div>}
            {requests.map((r) => (
              <div className="arow" key={r.id}>
                <div>
                  <h3><span>{r.name}</span><a className="num" href={`tel:${r.phone}`}>{r.phone}</a><span className={`tag ${r.status === "new" ? "st-pending" : r.status === "done" ? "st-approved" : r.status === "cancelled" ? "st-rejected" : ""}`}>{REQ_NAME[r.status]}</span></h3>
                  <p className="sub">عايز الوحدة <button type="button" className="linkish num" onClick={() => r.lands && setCode(r.lands.code)}>{r.lands?.code}</button>
                    {r.lands && <> · {r.lands.area} م² · {placeLabel(r.lands.zone, r.lands.hood)} · <span className="num">{fmtShort(r.lands.price)}</span></>} · {date(r.created_at)}</p>
                </div>
                <div className="acts">
                  <a className="btn wa sm" target="_blank" rel="noopener" href={waTo(r.phone, `أهلاً ${r.name}، معاك جولدن بيت بخصوص طلبك على الأرض ${r.lands?.code ?? ""}.`)}><WhatsAppIcon />العميل</a>
                  <select aria-label="حالة الطلب" value={r.status} disabled={busyId === r.id} onChange={(e) => update("purchase_requests", r.id, e.target.value)}>
                    {(Object.keys(REQ_NAME) as ReqStatus[]).map((s) => <option key={s} value={s}>{REQ_NAME[s]}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "alerts" && (
          <div className="rows">
            {alerts.length === 0 && <div className="empty">لسه مفيش تنبيهات.</div>}
            {alerts.map((a) => (
              <div className="arow" key={a.id}>
                <div>
                  <h3><span>{a.name}</span><a className="num" href={`tel:${a.phone}`}>{a.phone}</a><span className={`tag ${a.status === "new" ? "st-pending" : a.status === "done" ? "st-approved" : ""}`}>{a.status === "new" ? "جديد" : a.status === "done" ? "اتقفل" : "اتكلمنا معاه"}</span></h3>
                  <p className="sub">{describe(a.criteria)} · {date(a.created_at)}</p>
                </div>
                <div className="acts">
                  <a className="btn wa sm" target="_blank" rel="noopener" href={waTo(a.phone, `أهلاً ${a.name}، معاك جولدن بيت. لقينالك أرض بالمواصفات اللي طلبتها.`)}><WhatsAppIcon />العميل</a>
                  <select aria-label="حالة التنبيه" value={a.status} disabled={busyId === a.id} onChange={(e) => update("land_alerts", a.id, e.target.value)}>
                    <option value="new">جديد</option><option value="contacted">اتكلمنا معاه</option><option value="done">اتقفل</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function describe(c: Record<string, unknown>) {
  const parts: string[] = [];
  if (c.tier === "mm" || c.tier === "mt") parts.push(tierName(c.tier));
  if (typeof c.zone === "string" && c.zone) parts.push(placeLabel(c.zone, typeof c.hood === "string" ? c.hood : null));
  if (typeof c.budget === "number") parts.push("لحد " + fmtShort(c.budget));
  for (const k of ["area", "pos", "dir", "view", "front", "stage", "legal", "ownership", "utilities"]) {
    const v = c[k];
    if (Array.isArray(v) && v.length) parts.push(k === "area" ? v.map((x) => x + " م²").join("/") : k === "front" ? `واجهة ${v.join("/")}م+` : v.join("/"));
  }
  return parts.join(" · ") || "أي أرض";
}
