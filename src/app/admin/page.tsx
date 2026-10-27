"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { useAccount } from "@/lib/useAccount";
import { fmtFull, fmtShort, tierName, waTo } from "@/lib/site";
import { STATUS_NAME, type Listing, type ListingStatus, type Profile } from "@/lib/types";
import { WhatsAppIcon } from "@/components/Icons";

type Private = { contact_phone: string; plot_no: string | null };
type AdminListing = Listing & {
  listing_private: Private | Private[] | null;
  profiles: { full_name: string; phone: string } | null;
};
type RequestStatus = "new" | "contacted" | "done" | "cancelled";
type PlotRequest = {
  id: string; name: string; phone: string; status: RequestStatus; created_at: string;
  listings: { code: string; area: number; neighborhood: number; ask: number; tier: Listing["tier"] } | null;
};
type Tab = "pending" | "listings" | "requests" | "users";

const REQ_NAME: Record<RequestStatus, string> = { new: "جديد", contacted: "اتكلمنا معاه", done: "اتقفل", cancelled: "اتلغى" };
const REQ_TAG: Record<RequestStatus, string> = { new: "st-pending", contacted: "", done: "st-approved", cancelled: "st-rejected" };

const priv = (x: AdminListing): Private | null => (Array.isArray(x.listing_private) ? x.listing_private[0] ?? null : x.listing_private);
const date = (s: string) => new Date(s).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });

export default function AdminPage() {
  const router = useRouter();
  const { loading, user, profile } = useAccount();
  const [tab, setTab] = useState<Tab>("pending");
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [requests, setRequests] = useState<PlotRequest[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("approved");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const isAdmin = profile?.role === "admin";

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const [l, r, u] = await Promise.all([
      sb.from("listings").select("*, listing_private(contact_phone,plot_no), profiles(full_name,phone)").order("created_at", { ascending: false }),
      sb.from("plot_requests").select("id,name,phone,status,created_at, listings(code,area,neighborhood,ask,tier)").order("created_at", { ascending: false }),
      sb.from("profiles").select("id,full_name,phone,role,created_at").order("created_at", { ascending: false }),
    ]);
    if (l.error || r.error || u.error) setError("في بيانات ما اتحمّلتش، حدّث الصفحة");
    setListings((l.data ?? []) as unknown as AdminListing[]);
    setRequests((r.data ?? []) as unknown as PlotRequest[]);
    setUsers((u.data ?? []) as Profile[]);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/account?next=/admin"); return; }
    if (isAdmin) load();
  }, [loading, user, isAdmin, load, router]);

  async function setListingStatus(id: string, status: ListingStatus) {
    setBusyId(id); setError("");
    const { error } = await supabaseBrowser().from("listings").update({ status }).eq("id", id);
    setBusyId("");
    if (error) return setError("التعديل ما اتحفظش");
    setListings((cur) => cur.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  async function setRequestStatus(id: string, status: RequestStatus) {
    setBusyId(id); setError("");
    const { error } = await supabaseBrowser().from("plot_requests").update({ status }).eq("id", id);
    setBusyId("");
    if (error) return setError("التعديل ما اتحفظش");
    setRequests((cur) => cur.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  const pending = useMemo(() => listings.filter((x) => x.status === "pending"), [listings]);
  const shown = useMemo(() => {
    const term = q.trim();
    return listings.filter((x) => x.status !== "pending" && (statusFilter === "all" || x.status === statusFilter)
      && (!term || x.code.includes(term) || String(x.neighborhood) === term || priv(x)?.contact_phone.includes(term)));
  }, [listings, q, statusFilter]);
  const newRequests = requests.filter((r) => r.status === "new").length;

  if (loading) return <main><p className="loading">لحظة...</p></main>;
  if (!isAdmin) {
    return (
      <main>
        <div className="wrap narrow">
          <div className="panel"><h1>الصفحة دي للإدارة بس</h1><Link className="btn dark" href="/">رجوع للأراضي</Link></div>
        </div>
      </main>
    );
  }

  const listingRow = (x: AdminListing, actions: React.ReactNode) => {
    const p = priv(x);
    const seller = x.profiles;
    return (
      <div className="arow" key={x.id}>
        <div>
          <h3>
            <span className="num">{x.code}</span>
            <span>أرض {x.area} م² · مجاورة {x.neighborhood}</span>
            <span className="tag g">{tierName(x.tier)}</span>
            <span className={`tag st-${x.status}`}>{STATUS_NAME[x.status]}</span>
          </h3>
          <p className="sub">
            المطلوب <b className="num">{fmtFull(x.ask)}</b>
            {x.paid != null && <> · المدفوع <span className="num">{fmtFull(x.paid)}</span></>}
            {p?.plot_no && <> · قطعة رقم <span className="num">{p.plot_no}</span></>}
            {" · "}{date(x.created_at)}
          </p>
          <p className="sub">
            البائع: {seller?.full_name || "—"} · تليفون الإعلان <span className="num">{p?.contact_phone}</span>
            {seller?.phone && seller.phone !== p?.contact_phone && <> · حسابه <span className="num">{seller.phone}</span></>}
          </p>
          {(x.features.length > 0 || x.description) && (
            <p className="sub">{x.features.join(" · ")}{x.features.length > 0 && x.description ? " — " : ""}{x.description}</p>
          )}
        </div>
        <div className="acts">
          {p?.contact_phone && (
            <a className="btn wa sm" target="_blank" rel="noopener"
              href={waTo(p.contact_phone, `أهلاً ${seller?.full_name || ""}، معاك جولدن بيت بخصوص إعلان أرضك ${x.code} (${x.area} م² مجاورة ${x.neighborhood}).`)}>
              <WhatsAppIcon />البائع
            </a>
          )}
          {actions}
        </div>
      </div>
    );
  };

  return (
    <main>
      <div className="wrap adm">
        <div className="adm-h">
          <div><h1>لوحة التحكم</h1><p className="note">أهلاً {profile.full_name}</p></div>
          <button className="btn line sm" onClick={load}>تحديث</button>
        </div>

        <div className="kpis">
          <button type="button" className={`kpi${pending.length ? " hot" : ""}`} onClick={() => setTab("pending")}><span className="k-l">مستني مراجعة</span><b className="k-v num">{pending.length}</b></button>
          <button type="button" className="kpi" onClick={() => { setTab("listings"); setStatusFilter("approved"); }}><span className="k-l">أراضي معروضة</span><b className="k-v num">{listings.filter((x) => x.status === "approved").length}</b></button>
          <button type="button" className={`kpi${newRequests ? " hot" : ""}`} onClick={() => setTab("requests")}><span className="k-l">طلبات قطع جديدة</span><b className="k-v num">{newRequests}</b></button>
          <button type="button" className="kpi" onClick={() => setTab("users")}><span className="k-l">الحسابات</span><b className="k-v num">{users.length}</b></button>
        </div>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "pending"} onClick={() => setTab("pending")}>المراجعة<span className="num">{pending.length}</span></button>
          <button role="tab" aria-selected={tab === "listings"} onClick={() => setTab("listings")}>الأراضي</button>
          <button role="tab" aria-selected={tab === "requests"} onClick={() => setTab("requests")}>طلبات القطع<span className="num">{requests.length}</span></button>
          <button role="tab" aria-selected={tab === "users"} onClick={() => setTab("users")}>الحسابات</button>
        </div>

        {error && <div className="err" role="alert">{error}</div>}

        {tab === "pending" && (
          <div className="rows">
            {pending.length === 0 && <div className="empty">مفيش إعلانات مستنية مراجعة.</div>}
            {pending.map((x) => listingRow(x, (
              <>
                <button className="btn green sm" disabled={busyId === x.id} onClick={() => setListingStatus(x.id, "approved")}>وافق وانشر</button>
                <button className="btn danger sm" disabled={busyId === x.id} onClick={() => setListingStatus(x.id, "rejected")}>ارفض</button>
              </>
            )))}
          </div>
        )}

        {tab === "listings" && (
          <>
            <div className="adm-filter">
              <input aria-label="بحث" placeholder="كود، مجاورة، أو تليفون" value={q} onChange={(e) => setQ(e.target.value)} />
              <select aria-label="الحالة" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ListingStatus | "all")}>
                <option value="approved">معروضة</option>
                <option value="sold">اتباعت</option>
                <option value="rejected">مرفوضة</option>
                <option value="all">الكل</option>
              </select>
            </div>
            <div className="rows">
              {shown.length === 0 && <div className="empty">مفيش أراضي هنا.</div>}
              {shown.map((x) => listingRow(x, (
                <>
                  {x.status === "approved" && <Link className="btn line sm" href={`/land/${x.code}`} target="_blank">الإعلان</Link>}
                  {x.status === "approved" && <button className="btn dark sm" disabled={busyId === x.id} onClick={() => setListingStatus(x.id, "sold")}>اتباعت</button>}
                  {x.status === "approved" && <button className="btn danger sm" disabled={busyId === x.id} onClick={() => setListingStatus(x.id, "rejected")}>إخفاء</button>}
                  {x.status !== "approved" && <button className="btn green sm" disabled={busyId === x.id} onClick={() => setListingStatus(x.id, "approved")}>انشر تاني</button>}
                </>
              )))}
            </div>
          </>
        )}

        {tab === "requests" && (
          <div className="rows">
            {requests.length === 0 && <div className="empty">لسه مفيش طلبات على القطع.</div>}
            {requests.map((r) => (
              <div className="arow" key={r.id}>
                <div>
                  <h3>
                    <span>{r.name}</span>
                    <span className="num">{r.phone}</span>
                    <span className={`tag ${REQ_TAG[r.status]}`}>{REQ_NAME[r.status]}</span>
                  </h3>
                  <p className="sub">
                    طالب القطعة <b className="num">{r.listings?.code}</b>
                    {r.listings && <> · {r.listings.area} م² مجاورة {r.listings.neighborhood} · {tierName(r.listings.tier)} · <span className="num">{fmtShort(r.listings.ask)}</span></>}
                    {" · "}{date(r.created_at)}
                  </p>
                </div>
                <div className="acts">
                  <a className="btn wa sm" target="_blank" rel="noopener"
                    href={waTo(r.phone, `أهلاً ${r.name}، معاك جولدن بيت بخصوص طلبك على الأرض ${r.listings?.code ?? ""}.`)}>
                    <WhatsAppIcon />العميل
                  </a>
                  <select aria-label="حالة الطلب" value={r.status} disabled={busyId === r.id}
                    onChange={(e) => setRequestStatus(r.id, e.target.value as RequestStatus)}
                    style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "6px 10px", background: "var(--paper)" }}>
                    {(Object.keys(REQ_NAME) as RequestStatus[]).map((s) => <option key={s} value={s}>{REQ_NAME[s]}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "users" && (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>الاسم</th><th>الموبايل</th><th>النوع</th><th>إعلانات</th><th>اتسجل</th><th></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name}</td>
                    <td className="num">{u.phone}</td>
                    <td>{u.role === "admin" ? <span className="tag g">إدارة</span> : "عميل"}</td>
                    <td className="num">{listings.filter((x) => x.profiles?.phone === u.phone).length}</td>
                    <td>{u.created_at ? date(u.created_at) : ""}</td>
                    <td><a className="btn wa sm" target="_blank" rel="noopener" href={waTo(u.phone, `أهلاً ${u.full_name}، معاك جولدن بيت.`)}><WhatsAppIcon /></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
