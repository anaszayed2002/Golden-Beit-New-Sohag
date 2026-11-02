import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Sketch from "@/components/Sketch";
import CloseButton from "@/components/CloseButton";
import PurchaseBox from "@/components/PurchaseBox";
import { UtilTag } from "@/components/LandCard";
import { WhatsAppIcon } from "@/components/Icons";
import { supabaseServer } from "@/lib/supabase";
import { LAND_COLUMNS, type Land } from "@/lib/types";
import { SITE, fmtFull, fmtShort, hoodLabel, placeLabel, tierName, waLink, zoneOf } from "@/lib/site";

export const revalidate = 30;

async function getLand(code: string) {
  const sb = supabaseServer();
  const { data } = await sb.from("lands").select(LAND_COLUMNS).eq("code", code).eq("status", "approved").maybeSingle();
  if (!data) return null;
  const land = data as Land;
  const { data: sim } = await sb.from("lands").select(LAND_COLUMNS).eq("status", "approved").eq("tier", land.tier)
    .neq("id", land.id).gte("area", land.area - 100).lte("area", land.area + 100).limit(20);
  const similar = ((sim ?? []) as Land[]).sort((a, b) => Math.abs(a.price - land.price) - Math.abs(b.price - land.price)).slice(0, 3);
  return { land, similar };
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const res = await getLand(decodeURIComponent((await params).code));
  if (!res) return { title: "الأرض مش موجودة" };
  const l = res.land;
  return { title: `أرض ${l.area} م² ${placeLabel(l.zone, l.hood)}`, description: `${tierName(l.tier)} · المطلوب ${fmtShort(l.price)}` };
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div>{k}<b className="num">{v ?? "—"}</b></div>;

export default async function LandPage({ params }: { params: Promise<{ code: string }> }) {
  const res = await getLand(decodeURIComponent((await params).code));
  if (!res) notFound();
  const { land: l, similar } = res;
  const z = zoneOf(l.zone);

  const waText = [
    `أهلاً جولدن بيت، عايز أستفسر عن الأرض ${l.code}`,
    `${l.area} م² · ${placeLabel(l.zone, l.hood)}${l.block ? ` · بلوك ${l.block}` : ""}`,
    `المطلوب ${fmtShort(l.price)}`,
    `${SITE.url}/land/${l.code}`,
  ].join("\n");

  const steps = ["مالك أصيل", "توكيل 1", "توكيل 2", "توكيل 3+"];
  const n = ({ "مالك أصيل": 1, "توكيل واحد": 2, "توكيلين": 3, "أكثر من توكيلين": 4 } as Record<string, number>)[l.ownership ?? ""] ?? 0;

  return (
    <main>
      <div className="wrap">
        <div className="dt-top">
          <span className="bc">{[z.short, hoodLabel(l.hood), l.code].filter(Boolean).join(" / ")}</span>
          <CloseButton />
        </div>
        <div className="dt">
          <div className="dt-main">
            <div className="pic"><Sketch area={l.area} pos={l.pos} dir={l.dir} front={l.front_m} big /></div>
            <div>
              <div className="where">{[z.name, hoodLabel(l.hood), l.block ? `بلوك ${l.block}` : ""].filter(Boolean).join(" · ")}</div>
              <h1>أرض <span className="num">{l.area}</span> م²{l.pos ? ` ${l.pos}` : ""}{l.dir ? ` ${l.dir}` : ""}</h1>
              <div className="chips" style={{ marginTop: 8 }}>
                <UtilTag u={l.utilities} />
                <span className="tag g">{tierName(l.tier)}</span>
              </div>
            </div>
            <section className="box">
              <h2>الموقع</h2>
              <div className="kv">
                <Row k="الفئة" v={tierName(l.tier)} />
                <Row k="المنطقة" v={z.short} />
                {l.hood && <Row k="المجاورة" v={hoodLabel(l.hood)} />}
                <Row k="البلوك" v={l.block} />
              </div>
            </section>
            <section className="box">
              <h2>مواصفات القطعة</h2>
              <div className="kv">
                <Row k="المساحة" v={`${l.area} م²`} />
                <Row k="موقع القطعة" v={l.pos} />
                <Row k="الاتجاه" v={l.dir} />
                <Row k="الإطلالة" v={l.view} />
                <Row k="عرض الواجهة" v={l.front_m ? `${l.front_m} م` : null} />
              </div>
            </section>
            <section className="box">
              <h2>الحالة والمرافق</h2>
              <div className="kv">
                <Row k="المرحلة البنائية" v={l.stage} />
                <Row k="الاستلام" v={l.legal} />
                {l.legal === "مستلمة" && l.grace_months != null && <Row k="مهلة البناء" v={`فاضل ${l.grace_months} شهر`} />}
                <Row k="المرافق" v={l.utilities} />
              </div>
            </section>
            {l.ownership && (
              <section className="box">
                <h2>تسلسل الملكية</h2>
                <div className="chain">
                  {n ? (
                    <>
                      {steps.slice(0, n).map((s, i) => (
                        <span key={s} className="step-wrap">{i > 0 && <i>←</i>}<span className={i === n - 1 ? "on" : ""}>{s}</span></span>
                      ))}
                      <small>{n === 1 ? "البائع هو صاحب العقد" : `البائع الحالي معاه ${n - 1 === 1 ? "توكيل" : `${n - 1} توكيلات`}`}</small>
                    </>
                  ) : (
                    <><span className="on">حالة تفصيلية</span>{l.ownership_note ? <p className="txt" style={{ width: "100%" }}>{l.ownership_note}</p> : <small>فريقنا هيشرحلك الموقف القانوني بالتفصيل</small>}</>
                  )}
                </div>
              </section>
            )}
            {l.description && (
              <section className="box"><h2>وصف البائع</h2><p className="txt">{l.description}</p></section>
            )}
          </div>
          <aside className="side">
            <div className="box pricebox" id="request">
              <div>
                <small className="muted">المطلوب</small>
                <div className="big num">{fmtFull(l.price)}</div>
                {l.paid != null && <div className="muted num" style={{ fontSize: 14 }}>المدفوع {fmtFull(l.paid)}</div>}
                <div className="muted num" style={{ fontSize: 13 }}>كود الأرض {l.code}</div>
              </div>
              <a className="btn wa" href={waLink(waText)} target="_blank" rel="noopener"><WhatsAppIcon />اسأل على واتساب</a>
              <PurchaseBox landId={l.id} code={l.code} />
            </div>
            {similar.length > 0 && (
              <div className="box">
                <h2>أراضي شبهها</h2>
                <div className="similar">
                  {similar.map((s) => (
                    <Link key={s.id} className="sim" href={`/land/${s.code}`}>
                      <span>{placeLabel(s.zone, s.hood)}</span>
                      <b className="num">{s.area} م² · {fmtShort(s.price)}</b>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
      <div className="mbar">
        <div className="mbar-price"><small>المطلوب</small><b className="num">{fmtShort(l.price)}</b></div>
        <a className="btn green" href="#request">اطلب القطعة</a>
        <a className="btn wa icon" href={waLink(waText)} target="_blank" rel="noopener" aria-label="اسأل على واتساب"><WhatsAppIcon /></a>
      </div>
    </main>
  );
}
