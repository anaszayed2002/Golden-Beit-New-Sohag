"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import { useAccount } from "@/lib/useAccount";
import { PHONE_RE, cleanPhone, fmtDate, fmtFull, fmtShort, normalizeDigits, phoneEmail, placeLabel, tierName, waTo } from "@/lib/site";
import { STATUS_NAME, type Land, type LandStatus } from "@/lib/types";
import { landCardText, landSections } from "@/lib/landText";
import { WhatsAppIcon } from "@/components/Icons";

type Private = { seller_name: string; seller_phone: string; plot_no: string | null };
type AdminLand = Land & { land_private: Private | Private[] | null };
type ReqStatus = "new" | "contacted" | "done" | "cancelled";
type Purchase = { id: string; name: string; phone: string; status: ReqStatus; created_at: string; lands: Pick<Land, "code" | "area" | "zone" | "hood" | "price"> | null };
type Alert = { id: string; name: string; phone: string; status: "new" | "contacted" | "done"; criteria: Record<string, unknown>; created_at: string };
type Tab = "pending" | "lands" | "requests" | "alerts";

type Paged<T> = { items: T[]; page: number; more: boolean };
const ADMIN_PAGE = 50;
const EMPTY = { items: [], page: 0, more: false };
const LAND_SELECT = "*, land_private(seller_name,seller_phone,plot_no)";
function appendPage<T extends { id: string }>(cur: Paged<T>, rows: T[], page: number): Paged<T> {
  const items = page === 0 ? rows : [...cur.items, ...rows.filter((r) => !cur.items.some((c) => c.id === r.id))];
  return { items, page, more: rows.length === ADMIN_PAGE };
}

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

// Login only: the single admin account already exists; there is no sign-up anywhere on the site.
function AdminLogin() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!PHONE_RE.test(phone)) return setError("رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01");
    if (!password) return setError("اكتب كلمة السر");
    setBusy(true);
    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({ email: phoneEmail(phone), password });
    setBusy(false);
    if (signInError) setError("رقم الموبايل أو كلمة السر مش صح");
  }

  return (
    <main>
      <div className="wrap wiz">
        <form className="panel" onSubmit={submit} noValidate>
          <h1>دخول الإدارة</h1>
          <label className="field" htmlFor="adPhone">رقم الموبايل
            <input id="adPhone" className="num ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(cleanPhone(e.target.value))} autoComplete="username" />
          </label>
          <label className="field" htmlFor="adPass">كلمة السر
            <input id="adPass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <div className="err" role="alert">{error}</div>}
          <button className="btn dark" type="submit" disabled={busy}>{busy ? "لحظة..." : "ادخل"}</button>
        </form>
      </div>
    </main>
  );
}

function PasswordForm({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 6) return setError("كلمة السر 6 حروف أو أرقام على الأقل");
    if (pw !== pw2) return setError("الكلمتين مش زي بعض");
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(/same|different/i.test(error.message) ? "دي نفس كلمة السر الحالية" : "ما اتغيرتش، جرّب تاني");
    setDone(true);
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h1 style={{ fontSize: 18 }}>تغيير كلمة السر</h1>
      {done ? <div className="done">اتغيرت. استخدم الجديدة المرة الجاية.</div> : (
        <div className="two">
          <label className="field" htmlFor="pw1">كلمة السر الجديدة<input id="pw1" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
          <label className="field" htmlFor="pw2">اكتبها تاني<input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></label>
        </div>
      )}
      {error && <div className="err" role="alert">{error}</div>}
      <div className="wnav">
        <button type="button" className="btn line" onClick={onClose}>{done ? "قفل" : "إلغاء"}</button>
        {!done && <button type="submit" className="btn dark" disabled={busy}>{busy ? "لحظة..." : "احفظ"}</button>}
      </div>
    </form>
  );
}

function Dashboard({ name }: { name: string }) {
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<Paged<AdminLand>>(EMPTY);
  const [lands, setLands] = useState<Paged<AdminLand>>(EMPTY);
  const [requests, setRequests] = useState<Paged<Purchase>>(EMPTY);
  const [alerts, setAlerts] = useState<Paged<Alert>>(EMPTY);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, newReq: 0, newAlerts: 0 });
  const [code, setCode] = useState("");
  const [found, setFound] = useState<AdminLand[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<LandStatus | "all">("approved");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [pwOpen, setPwOpen] = useState(false);

  const loadCounts = useCallback(async () => {
    const sb = supabaseBrowser();
    const head = { count: "exact" as const, head: true };
    const [p, a, r, al] = await Promise.all([
      sb.from("lands").select("id", head).eq("status", "pending"),
      sb.from("lands").select("id", head).eq("status", "approved"),
      sb.from("purchase_requests").select("id", head).eq("status", "new"),
      sb.from("land_alerts").select("id", head).eq("status", "new"),
    ]);
    setCounts({ pending: p.count ?? 0, approved: a.count ?? 0, newReq: r.count ?? 0, newAlerts: al.count ?? 0 });
  }, []);

  // Each list loads ADMIN_PAGE rows at a time; "اعرض أكتر" appends the next page.
  const loadPending = useCallback(async (page = 0) => {
    const { data, error } = await supabaseBrowser().from("lands").select(LAND_SELECT).eq("status", "pending").order("created_at", { ascending: false }).range(page * ADMIN_PAGE, page * ADMIN_PAGE + ADMIN_PAGE - 1);
    if (error) return setError("في بيانات ما اتحمّلتش، دوس تحديث");
    setPending((cur) => appendPage(cur, (data ?? []) as unknown as AdminLand[], page));
  }, []);
  const loadLands = useCallback(async (page = 0) => {
    let q = supabaseBrowser().from("lands").select(LAND_SELECT).neq("status", "pending");
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q.order("created_at", { ascending: false }).range(page * ADMIN_PAGE, page * ADMIN_PAGE + ADMIN_PAGE - 1);
    if (error) return setError("في بيانات ما اتحمّلتش، دوس تحديث");
    setLands((cur) => appendPage(cur, (data ?? []) as unknown as AdminLand[], page));
  }, [statusFilter]);
  const loadRequests = useCallback(async (page = 0) => {
    const { data, error } = await supabaseBrowser().from("purchase_requests").select("id,name,phone,status,created_at, lands(code,area,zone,hood,price)").order("created_at", { ascending: false }).range(page * ADMIN_PAGE, page * ADMIN_PAGE + ADMIN_PAGE - 1);
    if (error) return setError("في بيانات ما اتحمّلتش، دوس تحديث");
    setRequests((cur) => appendPage(cur, (data ?? []) as unknown as Purchase[], page));
  }, []);
  const loadAlerts = useCallback(async (page = 0) => {
    const { data, error } = await supabaseBrowser().from("land_alerts").select("*").order("created_at", { ascending: false }).range(page * ADMIN_PAGE, page * ADMIN_PAGE + ADMIN_PAGE - 1);
    if (error) return setError("في بيانات ما اتحمّلتش، دوس تحديث");
    setAlerts((cur) => appendPage(cur, (data ?? []) as Alert[], page));
  }, []);

  const load = useCallback(() => {
    setError("");
    loadCounts(); loadPending(0); loadRequests(0); loadAlerts(0);
  }, [loadCounts, loadPending, loadRequests, loadAlerts]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadLands(0); }, [loadLands]);

  // Deleting frees the land's code for the next new listing; its purchase requests go with it.
  async function remove(id: string) {
    setBusyId(id); setError("");
    const { error } = await supabaseBrowser().from("lands").delete().eq("id", id);
    setBusyId("");
    if (error) return setError("الحذف ما تمش، جرّب تاني");
    const drop = <T extends { id: string }>(p: Paged<T>) => ({ ...p, items: p.items.filter((x) => x.id !== id) });
    setLands(drop); setPending(drop);
    setFound((f) => f && f.filter((x) => x.id !== id));
    loadCounts(); loadRequests(0);
  }

  async function update(table: "lands" | "purchase_requests" | "land_alerts", id: string, status: string) {
    setBusyId(id); setError("");
    const { error } = await supabaseBrowser().from(table).update({ status }).eq("id", id);
    setBusyId("");
    if (error) return setError("التعديل ما اتحفظش");
    if (table === "lands") {
      const patch = (p: Paged<AdminLand>) => ({ ...p, items: p.items.map((x) => (x.id === id ? { ...x, status: status as LandStatus } : x)) });
      setPending((p) => ({ ...p, items: p.items.filter((x) => x.id !== id) }));
      setLands(patch);
      setFound((f) => f && f.map((x) => (x.id === id ? { ...x, status: status as LandStatus } : x)));
    }
    if (table === "purchase_requests") setRequests((p) => ({ ...p, items: p.items.map((x) => (x.id === id ? { ...x, status: status as ReqStatus } : x)) }));
    if (table === "land_alerts") setAlerts((p) => ({ ...p, items: p.items.map((x) => (x.id === id ? { ...x, status: status as Alert["status"] } : x)) }));
    loadCounts();
  }

  // Code search runs in the database: "GB-1005", "1005" or a seller phone (6+ digits) all work.
  useEffect(() => {
    const q = normalizeDigits(code).toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!q) { setFound(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const sb = supabaseBrowser();
      const digits = q.replace(/[^\d]/g, "");
      const byCode = sb.from("lands").select(LAND_SELECT).ilike("code", `%${q}%`).order("created_at", { ascending: false }).limit(20);
      const byPhone = digits.length >= 6 ? sb.from("land_private").select("land_id").like("seller_phone", `%${digits}%`).limit(20) : null;
      const [c, p] = await Promise.all([byCode, byPhone]);
      let rows = (c.data ?? []) as unknown as AdminLand[];
      const ids = ((p?.data ?? []) as { land_id: string }[]).map((x) => x.land_id).filter((id) => !rows.some((r) => r.id === id));
      if (ids.length) {
        const { data } = await sb.from("lands").select(LAND_SELECT).in("id", ids);
        rows = [...rows, ...((data ?? []) as unknown as AdminLand[])];
      }
      if (alive) setFound(rows);
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [code]);

  const newReq = counts.newReq;
  const newAlerts = counts.newAlerts;

  const landRow = (x: AdminLand) => {
    const p = priv(x);
    return (
      <div className="arow" key={x.id}>
        <div>
          <h3><span className="num code">{x.code}</span><span>{x.area} م² · {placeLabel(x.zone, x.hood)}</span><span className="tag g">{tierName(x.tier)}</span><span className={`tag st-${x.status}`}>{STATUS_NAME[x.status]}</span></h3>
          <p className="sub">السعر الكلي <b className="num">{fmtFull(x.price)}</b>{p?.plot_no && <> · قطعة <span className="num">{p.plot_no}</span></>} · {date(x.created_at)}</p>
          {landSections(x).slice(1).map((s) => {
            const rows = s.rows.filter(([k]) => k !== "السعر الكلي");
            return rows.length ? <p className="sub" key={s.title}><b>{s.title}:</b> {rows.map(([k, v]) => `${k} ${v}`).join(" · ")}</p> : null;
          })}
          <p className="seller">صاحب الأرض: <b>{p?.seller_name ?? "—"}</b> · <a className="num" href={p ? `tel:${p.seller_phone}` : undefined}>{p?.seller_phone}</a></p>
        </div>
        <div className="acts">
          <CopyCard land={x} />
          {p && <a className="btn wa sm" target="_blank" rel="noopener" href={waTo(p.seller_phone, `أهلاً ${p.seller_name}، معاك جولدن بيت بخصوص أرضك ${x.code} (${x.area} م² ${placeLabel(x.zone, x.hood)}).`)}><WhatsAppIcon />صاحب الأرض</a>}
          {x.status === "approved" && <Link className="btn line sm" href={`/land/${x.code}`} target="_blank">الإعلان</Link>}
          {x.status !== "approved" && <button className="btn green sm" disabled={busyId === x.id} onClick={() => update("lands", x.id, "approved")}>{x.status === "pending" ? "وافق وانشر" : "انشر تاني"}</button>}
          {x.status === "approved" && <button className="btn dark sm" disabled={busyId === x.id} onClick={() => update("lands", x.id, "sold")}>اتباعت</button>}
          {x.status === "pending" && <button className="btn danger sm" disabled={busyId === x.id} onClick={() => update("lands", x.id, "rejected")}>ارفض</button>}
          {x.status !== "pending" && <DeleteButton code={x.code} busy={busyId === x.id} onDelete={() => remove(x.id)} />}
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
            <button className="btn line sm" onClick={() => setPwOpen((v) => !v)}>كلمة السر</button>
            <button className="btn line sm" onClick={() => supabaseBrowser().auth.signOut()}>خروج</button>
          </div>
        </div>
        {pwOpen && <PasswordForm onClose={() => setPwOpen(false)} />}

        <label className="codebox" htmlFor="codeSearch">
          <span>ابحث بكود الوحدة</span>
          <input id="codeSearch" className="num ltr" placeholder="GB-1005 أو 1005 أو رقم البائع" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        </label>
        {found && (
          <div className="rows">
            {found.length ? found.map(landRow) : <div className="empty">مفيش وحدة بالكود ده.</div>}
          </div>
        )}

        <div className="kpis">
          <button type="button" className={`kpi${counts.pending ? " hot" : ""}`} onClick={() => setTab("pending")}><span className="k-l">مستني مراجعة</span><b className="k-v num">{counts.pending}</b></button>
          <button type="button" className="kpi" onClick={() => { setTab("lands"); setStatusFilter("approved"); }}><span className="k-l">أراضي معروضة</span><b className="k-v num">{counts.approved}</b></button>
          <button type="button" className={`kpi${newReq ? " hot" : ""}`} onClick={() => setTab("requests")}><span className="k-l">طلبات شراء جديدة</span><b className="k-v num">{newReq}</b></button>
          <button type="button" className={`kpi${newAlerts ? " hot" : ""}`} onClick={() => setTab("alerts")}><span className="k-l">تنبيهات جديدة</span><b className="k-v num">{newAlerts}</b></button>
        </div>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "pending"} onClick={() => setTab("pending")}>المراجعة<span className="num">{counts.pending}</span></button>
          <button role="tab" aria-selected={tab === "lands"} onClick={() => setTab("lands")}>الأراضي</button>
          <button role="tab" aria-selected={tab === "requests"} onClick={() => setTab("requests")}>طلبات الشراء{newReq > 0 && <span className="num">{newReq}</span>}</button>
          <button role="tab" aria-selected={tab === "alerts"} onClick={() => setTab("alerts")}>التنبيهات{newAlerts > 0 && <span className="num">{newAlerts}</span>}</button>
        </div>
        {error && <div className="err" role="alert">{error}</div>}

        {tab === "pending" && <div className="rows">{pending.items.length ? pending.items.map(landRow) : <div className="empty">مفيش أراضي مستنية مراجعة.</div>}<More list={pending} onMore={() => loadPending(pending.page + 1)} /></div>}

        {tab === "lands" && (
          <>
            <div className="adm-filter">
              <select aria-label="الحالة" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LandStatus | "all")}>
                <option value="approved">معروضة</option><option value="sold">اتباعت</option><option value="rejected">مرفوضة</option><option value="all">الكل</option>
              </select>
            </div>
            <div className="rows">{lands.items.length ? lands.items.map(landRow) : <div className="empty">مفيش أراضي هنا.</div>}<More list={lands} onMore={() => loadLands(lands.page + 1)} /></div>
          </>
        )}

        {tab === "requests" && (
          <div className="rows">
            {requests.items.length === 0 && <div className="empty">لسه مفيش طلبات شراء.</div>}
            {requests.items.map((r) => (
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
            <More list={requests} onMore={() => loadRequests(requests.page + 1)} />
          </div>
        )}

        {tab === "alerts" && (
          <div className="rows">
            {alerts.items.length === 0 && <div className="empty">لسه مفيش تنبيهات.</div>}
            {alerts.items.map((a) => (
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
            <More list={alerts} onMore={() => loadAlerts(alerts.page + 1)} />
          </div>
        )}
      </div>
    </main>
  );
}

// Two taps so a land is never deleted by a slip of the finger.
function DeleteButton({ code, busy, onDelete }: { code: string; busy: boolean; onDelete: () => void }) {
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 5000);
    return () => clearTimeout(t);
  }, [sure]);
  if (!sure) return <button type="button" className="btn danger sm" disabled={busy} onClick={() => setSure(true)}>حذف</button>;
  return (
    <button type="button" className="btn sm del-sure" disabled={busy} onClick={onDelete} title={`حذف ${code} نهائيًا`}>
      {busy ? "بيتحذف..." : `أكيد احذف ${code}`}
    </button>
  );
}

// Copies the land card as tidy lines for WhatsApp. Seller name and phone are left out on purpose.
function CopyCard({ land }: { land: AdminLand }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    const text = landCardText(land);
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      // Older browsers: copy through a hidden textarea
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      setState(ok ? "done" : "failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }
  return (
    <button type="button" className={`btn sm ${state === "done" ? "green" : "line"}`} onClick={copy}>
      {state === "done" ? "اتنسخت ✓" : state === "failed" ? "ما اتنسختش" : "نسخ البطاقة"}
    </button>
  );
}

function More<T>({ list, onMore }: { list: Paged<T>; onMore: () => void }) {
  if (!list.more) return null;
  return <div className="more"><button type="button" className="btn line" onClick={onMore}>اعرض أكتر</button></div>;
}

function describe(c: Record<string, unknown>) {
  const parts: string[] = [];
  if (c.tier === "mm" || c.tier === "mt") parts.push(tierName(c.tier));
  if (typeof c.zone === "string" && c.zone) parts.push(placeLabel(c.zone, typeof c.hood === "string" ? c.hood : null));
  if (typeof c.budget === "number") parts.push("لحد " + fmtShort(c.budget)); // alerts saved before range filters
  if (typeof c.block === "string" && c.block) parts.push("بلوك " + c.block);
  const ranges = (c.ranges ?? {}) as Record<string, { min: number | string | null; max: number | string | null }>;
  const money = (n: number | string) => fmtShort(Number(n));
  const day = (n: number | string) => fmtDate(String(n));
  const names: Record<string, [string, (n: number | string) => string]> = {
    price: ["السعر الكلي", money], paid: ["المدفوع", money], over_amount: ["الأوفر", money], inst_value: ["القسط", money],
    inst_left: ["الأقساط المتبقية", (n) => `${n}`], transfer_fee: ["التنازل", money], area: ["المساحة", (n) => `${n} م²`],
    front_m: ["الواجهة", (n) => `${n} م`], delivery_date: ["الاستلام", day], grace_until: ["مهلة البناء", day], inst_last: ["آخر قسط", day],
    grace_months: ["مهلة البناء", (n) => `${n} شهر`],
  };
  const has = (v: unknown) => v != null && v !== "";
  for (const [k, [t, f]] of Object.entries(names)) {
    const r = ranges[k];
    if (!r || (!has(r.min) && !has(r.max))) continue;
    parts.push(has(r.min) && has(r.max) ? `${t} ${f(r.min!)}–${f(r.max!)}` : has(r.min) ? `${t} من ${f(r.min!)}` : `${t} لحد ${f(r.max!)}`);
  }
  for (const k of ["area", "pos", "views", "services", "legal", "stage", "build_reached", "floors", "basement", "ownership", "dir", "view", "front", "utilities"]) {
    const v = c[k];
    if (Array.isArray(v) && v.length) parts.push(k === "area" ? v.map((x) => x + " م²").join("/") : k === "front" ? `واجهة ${v.join("/")}م+` : v.join("/"));
  }
  return parts.join(" · ") || "أي أرض";
}
