import Link from "next/link";
import { CloseIcon } from "./Icons";

export default function CloseButton({ href = "/", label = "إغلاق والرجوع للأراضي", className = "x" }: { href?: string; label?: string; className?: string }) {
  return (
    <Link className={className} href={href} aria-label={label} title="إغلاق">
      <CloseIcon />
    </Link>
  );
}
