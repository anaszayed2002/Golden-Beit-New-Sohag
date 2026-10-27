import { supabaseServer } from "@/lib/supabase";
import { LISTING_COLUMNS, type Listing, type Neighborhood } from "@/lib/types";
import Finder from "@/components/Finder";

export const revalidate = 30;

export default async function Home() {
  const sb = supabaseServer();
  const [{ data: listings }, { data: hoods }] = await Promise.all([
    sb.from("listings").select(LISTING_COLUMNS).eq("status", "approved").order("approved_at", { ascending: false }),
    sb.from("neighborhoods").select("n,tier,label").eq("active", true).order("sort"),
  ]);

  return (
    <main>
      <section className="top">
        <div className="wrap">
          <div className="hero">
            <h1>قول لنا بتدوّر على إيه، وإحنا نجيبهولك</h1>
            <p>اختار الفئة والمساحة واكتب ميزانيتك.</p>
          </div>
        </div>
      </section>
      <Finder listings={(listings ?? []) as Listing[]} hoods={(hoods ?? []) as Neighborhood[]} />
    </main>
  );
}
