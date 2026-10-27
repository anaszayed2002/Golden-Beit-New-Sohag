"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { waLink } from "@/lib/site";
import { WhatsAppIcon } from "./Icons";

// Phone-only bottom bar. Land pages render their own bar with the price.
export default function MobileBar() {
  const path = usePathname();
  if (path.startsWith("/land/") || path.startsWith("/sell") || path.startsWith("/account") || path.startsWith("/admin")) return null;
  return (
    <div className="mbar">
      <Link className="btn gold" href="/sell">اعرض أرضك</Link>
      <a className="btn wa" href={waLink("أهلاً جولدن بيت، عايز أستفسر عن أراضي سوهاج الجديدة")} target="_blank" rel="noopener">
        <WhatsAppIcon />واتساب
      </a>
    </div>
  );
}
