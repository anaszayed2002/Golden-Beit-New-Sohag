import { supabaseServer } from "@/lib/supabase";
import { emptyFilters, searchLands, type SearchQuery } from "@/lib/search";
import Finder from "@/components/Finder";
import type { Tier } from "@/lib/site";

export const revalidate = 30;

export default async function Home() {
  const sb = supabaseServer();
  // Open on the tier that has lands, so the first view is never empty when the other one isn't.
  const { count: mmCount } = await sb.from("lands").select("id", { count: "exact", head: true }).eq("status", "approved").eq("tier", "mm");
  const { count: mtCount } = await sb.from("lands").select("id", { count: "exact", head: true }).eq("status", "approved").eq("tier", "mt");
  const tier: Tier = !mmCount && mtCount ? "mt" : "mm";
  const query: SearchQuery = { tier, zone: "", hood: "", budget: null, filters: emptyFilters(), sort: "new" };
  const first = await searchLands(sb, query, 0);

  return (
    <main>
      <section className="top">
        <div className="wrap">
          <h1>أميز أراضي المجاورات والأحياء بسوهاج الجديدة</h1>
          <p className="sub">كل أرض معروضة ببياناتها كاملة: مواصفاتها، حالتها، ملكيتها، ومرافقها.</p>
        </div>
      </section>
      <Finder initialTier={tier} initialItems={first.items} initialTotal={first.total} />
    </main>
  );
}
