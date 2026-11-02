import Link from "next/link";

export default function Header() {
  return (
    <header className="head">
      <div className="wrap">
        <Link className="logo" href="/" aria-label="جولدن بيت، الرئيسية">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="جولدن بيت" />
        </Link>
        <span className="site-name" dir="ltr"><span>Golden Beit</span> <b>New Sohag</b></span>
        <nav>
          <Link href="/">الأراضي</Link>
          <Link href="/compare">المقارنة</Link>
        </nav>
        <div className="end">
          <Link className="btn gold" href="/sell">اعرض أرضك</Link>
        </div>
      </div>
    </header>
  );
}
