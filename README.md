# Golden Beit New Sohag

منصة جولدن بيت لعرض وطلب أراضي مجاورات سوهاج الجديدة (متوسط ومتميز).

- Next.js 15 (App Router) على Vercel
- Supabase project `golden-beit-new-sohag` (`lbbayvojqvaziproordg`)

## الصفحات

| المسار | الوظيفة |
| --- | --- |
| `/` | البحث بالفئة والمساحة والميزانية + الأراضي المعتمدة |
| `/land/[code]` | تفاصيل الأرض، «اطلب القطعة»، واتساب |
| `/account` | حساب جديد أو دخول (موبايل + كلمة سر) |
| `/sell` | فورم «اعرض أرضك» (لازم حساب) |
| `/my` | إعلاناتي وحالتها |
| `/admin` | لوحة التحكم: مراجعة الإعلانات، الأراضي، طلبات القطع، الحسابات |

أي حساب يتعمل بالرقم الموجود في جدول `admin_phones` (حاليًا 01040333703) بيبقى أدمن تلقائيًا.

## التشغيل محليًا

```bash
cp .env.example .env.local   # وحط NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Supabase

- `supabase/migrations` فيها الـ schema والـ RLS.
- `supabase/functions/signup` بتعمل الحساب متأكد من غير SMS (الإيميل داخلي: `<phone>@users.goldenbeit.com`).
