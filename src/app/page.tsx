import { supabaseServer } from "@/lib/supabase";
import { LAND_COLUMNS, type Land } from "@/lib/types";
import Finder from "@/components/Finder";

export const revalidate = 30;

export default async function Home() {
  const { data } = await supabaseServer().from("lands").select(LAND_COLUMNS).eq("status", "approved").order("approved_at", { ascending: false });

  return (
    <main>
      <section className="top">
        <div className="wrap">
          <h1>أميز أراضي المجاورات بسوهاج الجديدة</h1>
          <p className="sub">كل أرض معروضة ببياناتها كاملة: مواصفاتها، حالتها، ملكيتها، ومرافقها.</p>
        </div>
      </section>
      <Finder lands={(data ?? []) as Land[]} />
    </main>
  );
}
