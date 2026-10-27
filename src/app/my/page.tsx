"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Plot from "@/components/Plot";
import CloseButton from "@/components/CloseButton";
import { supabaseBrowser } from "@/lib/supabase";
import { useAccount } from "@/lib/useAccount";
import { fmtShort, tierName } from "@/lib/site";
import { LISTING_COLUMNS, STATUS_NAME, type Listing } from "@/lib/types";

export default function MyListings() {
  const router = useRouter();
  const { loading, user } = useAccount();
  const [items, setItems] = useState<Listing[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/account?next=/my"); return; }
    supabaseBrowser().from("listings").select(LISTING_COLUMNS).eq("owner_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Listing[]));
  }, [loading, user, router]);

  return (
    <main>
      <div className="wrap narrow" style={{ maxWidth: 760 }}>
        <div className="panel">
          <CloseButton label="إغلاق" />
          <h1>إعلاناتي</h1>
          {items === null ? (
            <p className="loading">لحظة...</p>
          ) : items.length === 0 ? (
            <div className="empty">
              <span>لسه ما عرضتش أي أرض.</span>
              <Link className="btn gold" href="/sell">اعرض أرضك</Link>
            </div>
          ) : (
            <div className="mine">
              {items.map((x) => (
                <div className="mine-row" key={x.id}>
                  <div className="mini"><Plot area={x.area} /></div>
                  <div>
                    <h3>أرض <span className="num">{x.area}</span> م² · مجاورة <span className="num">{x.neighborhood}</span></h3>
                    <p><span className="num">{x.code}</span> · {tierName(x.tier)} · المطلوب <span className="num">{fmtShort(x.ask)}</span></p>
                    {x.status === "approved" && <p><Link href={`/land/${x.code}`} style={{ color: "var(--green)", fontWeight: 700 }}>شوف الإعلان</Link></p>}
                  </div>
                  <span className={`tag st-${x.status}`}>{STATUS_NAME[x.status]}</span>
                </div>
              ))}
            </div>
          )}
          <Link className="btn dark" href="/sell">اعرض أرض تانية</Link>
        </div>
      </div>
    </main>
  );
}
