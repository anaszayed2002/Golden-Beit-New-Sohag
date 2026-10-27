import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <div className="wrap narrow">
        <div className="panel">
          <h1>الصفحة دي مش موجودة</h1>
          <p>ممكن تكون الأرض اتباعت أو الإعلان اتشال.</p>
          <Link className="btn dark" href="/">شوف الأراضي المعروضة</Link>
        </div>
      </div>
    </main>
  );
}
