import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Plot from "@/components/Plot";
import CloseButton from "@/components/CloseButton";
import RequestPlot from "@/components/RequestPlot";
import { WhatsAppIcon } from "@/components/Icons";
import { supabaseServer } from "@/lib/supabase";
import { LISTING_COLUMNS, type Listing } from "@/lib/types";
import { JEDIA, fmtFull, fmtShort, tierName, waLink } from "@/lib/site";

export const revalidate = 30;

async function getListing(code: string) {
  const sb = supabaseServer();
  const { data } = await sb.from("listings").select(LISTING_COLUMNS).eq("code", code).eq("status", "approved").maybeSingle();
  if (!data) return null;
  const listing = data as Listing;
  const { data: hood } = await sb.from("neighborhoods").select("label").eq("n", listing.neighborhood).maybeSingle();
  return { listing, label: (hood?.label as string | null) ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const res = await getListing(decodeURIComponent((await params).code));
  if (!res) return { title: "الأرض مش موجودة" };
  const x = res.listing;
  return { title: `أرض ${x.area} م² مجاورة ${x.neighborhood}`, description: `${tierName(x.tier)} · المطلوب ${fmtShort(x.ask)}` };
}

export default async function LandPage({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code);
  const res = await getListing(code);
  if (!res) notFound();
  const { listing: x, label } = res;

  const waText = `أهلاً جولدن بيت، عايز أستفسر عن الأرض ${x.code}: ${x.area} م² مجاورة ${x.neighborhood} (${tierName(x.tier)})، المطلوب ${fmtShort(x.ask)}`;

  return (
    <main>
      <div className="wrap">
        <div className="crumb">
          <div><Link href="/">الأراضي المعروضة</Link> / <span className="num">{x.code}</span></div>
          <CloseButton />
        </div>
        <div className="det">
          <div>
            <div className="det-plot"><Plot area={x.area} big /></div>
            <h1>أرض <span className="num">{x.area}</span> م² · مجاورة <span className="num">{x.neighborhood}</span></h1>
            <div className="meta">
              <span className="tag g">{tierName(x.tier)}</span>
              {label && <span className="tag g">{label}</span>}
              {x.features.map((f) => <span className="tag" key={f}>{f}</span>)}
            </div>
            <div className="specs">
              <div>الفئة<b>{tierName(x.tier)}</b></div>
              <div>المجاورة<b className="num">{x.neighborhood}</b></div>
              <div>المساحة<b className="num">{x.area} م²</b></div>
            </div>
            {x.description && (
              <>
                <h2>وصف البائع</h2>
                <p className="txt">{x.description}</p>
              </>
            )}
          </div>
          <aside className="side" id="request">
            <div className="price"><small>المطلوب</small><b className="num">{fmtFull(x.ask)}</b></div>
            <div className="pay">
              <div><span>الجدية</span><b className="num">{fmtFull(JEDIA[x.tier])}</b></div>
              {x.paid != null && <div><span>المدفوع</span><b className="num">{fmtFull(x.paid)}</b></div>}
              <div><span>كود الأرض</span><b className="num">{x.code}</b></div>
            </div>
            <RequestPlot listingId={x.id} code={x.code} waText={waText} />
            <a className="btn wa block" href={waLink(waText)} target="_blank" rel="noopener"><WhatsAppIcon />اسأل على واتساب</a>
            <p className="note">رقم البائع مش بيظهر. التواصل والمعاينة بيتمّوا عن طريق جولدن بيت.</p>
          </aside>
        </div>
      </div>
      <div className="mbar land">
        <div className="mbar-price"><small>المطلوب</small><b className="num">{fmtShort(x.ask)}</b></div>
        <a className="btn green" href="#request">اطلب القطعة</a>
        <a className="btn wa icon" href={waLink(waText)} target="_blank" rel="noopener" aria-label="اسأل على واتساب"><WhatsAppIcon /></a>
      </div>
    </main>
  );
}
