"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  // The dashboard header shows only the logo and the name.
  const isAdmin = usePathname().startsWith("/admin");
  return (
    <header className="head">
      <div className="wrap">
        <Link className="logo" href={isAdmin ? "/admin" : "/"} aria-label="جولدن بيت، الرئيسية">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="جولدن بيت" />
        </Link>
        <span className="site-name" dir="ltr"><span>Golden Beit</span> <b>New Sohag</b></span>
        {!isAdmin && (
          <>
            <nav>
              <Link href="/">الأراضي</Link>
              <Link href="/compare">المقارنة</Link>
            </nav>
            <div className="end">
              <Link className="btn gold" href="/sell">اعرض أرضك</Link>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
