import { supabaseServer } from "@/lib/supabase";
import { emptyFilters, emptyRanges, searchLands, type SearchQuery } from "@/lib/search";
import Finder from "@/components/Finder";

export const revalidate = 30;

export default async function Home() {
  // Opens on every unit; filtering starts when the visitor picks something.
  const query: SearchQuery = { tier: "", zone: "", hood: "", filters: emptyFilters(), ranges: emptyRanges(), sort: "approved_at.desc" };
  const first = await searchLands(supabaseServer(), query, 0);

  return (
    <main>
      <section className="top">
        <div className="wrap">
          <h1>أميز أراضي المجاورات والأحياء بسوهاج الجديدة</h1>
          <p className="sub">كل أرض معروضة ببياناتها كاملة: مواصفاتها، حالتها، ملكيتها، ومرافقها.</p>
        </div>
      </section>
      <Finder initialItems={first.items} initialTotal={first.total} />
    </main>
  );
}
