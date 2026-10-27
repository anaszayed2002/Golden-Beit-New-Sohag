import { SITE } from "@/lib/site";
import { FacebookIcon, MailIcon, PhoneIcon, WhatsAppIcon } from "./Icons";

export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt="جولدن بيت" />
        </div>
        <div>
          <h3>تواصل معانا</h3>
          <ul>
            <li><PhoneIcon /><span>تليفون <a className="num" href={`tel:${SITE.phone}`}>{SITE.phone}</a></span></li>
            <li><WhatsAppIcon /><a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noopener">واتساب {SITE.phone}</a></li>
            <li><MailIcon /><a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>
            {SITE.facebook && (
              <li><FacebookIcon /><a href={SITE.facebook} target="_blank" rel="noopener">صفحتنا على فيسبوك</a></li>
            )}
          </ul>
        </div>
        <div className="notebox">
          <b>تنويه</b>
          منصة &quot;جولدن بيت&quot; هي منصة عقارية وسيطة ومستقلة. الموقع غير تابع لهيئة المجتمعات العمرانية أو أي جهة رسمية أخرى. جميع الوحدات المعروضة هي مسؤولية أصحابها من الأفراد أو الشركات، ودورنا هو الربط بين البائع والمشتري.
        </div>
        <div className="copy">
          <span>© {new Date().getFullYear()} جولدن بيت للتسويق العقاري · سوهاج الجديدة</span>
          <span dir="ltr">{SITE.name}</span>
        </div>
      </div>
    </footer>
  );
}
