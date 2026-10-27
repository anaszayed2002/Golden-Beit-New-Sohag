"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "@/lib/useAccount";
import { supabaseBrowser } from "@/lib/supabase";

export default function Header() {
  const { user, profile } = useAccount();
  const router = useRouter();
  const first = (profile?.full_name || "حسابي").split(" ")[0];

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/");
  }

  return (
    <header className="head">
      <div className="wrap">
        <Link className="logo" href="/" aria-label="جولدن بيت، الرئيسية">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="جولدن بيت" />
        </Link>
        <span className="site-name" dir="ltr">Golden Beit <b>New Sohag</b></span>
        <nav>
          <Link href="/">الأراضي المعروضة</Link>
          {profile?.role === "admin" && <Link href="/admin">لوحة التحكم</Link>}
        </nav>
        <div className="end">
          <Link className="btn gold" href="/sell">اعرض أرضك</Link>
          {user ? (
            <details className="menu">
              <summary className="user"><i>{first[0]}</i><span>{first}</span></summary>
              <div className="menu-list">
                <Link href="/my">إعلاناتي</Link>
                {profile?.role === "admin" && <Link href="/admin">لوحة التحكم</Link>}
                <button type="button" onClick={signOut}>خروج</button>
              </div>
            </details>
          ) : (
            <Link className="btn login" href="/account">دخول</Link>
          )}
        </div>
      </div>
    </header>
  );
}
