# HBJ Archive — Phase 1 (Foundation)

هذا هو الأساس اللي طلبته في المرحلة 1 من `hbj-archive-improvement-spec.md`: مفيش UI هنا خالص — الهدف بنية تحتية صلبة تتبني عليها المراحل 2/3/4.

## اللي اتبنى في المرحلة دي

| البند | الملف | ملاحظات |
|---|---|---|
| `tenant_id` على كل جدول رئيسي | `prisma/schema.prisma` | `Tenant`, `User`, `ContentItem`, `AuditLog` |
| Middleware الفلترة الإجباري | `src/prisma/prisma.service.ts` + `src/common/tenant-context/*` | Prisma Client Extension — مش ممكن أي service "ينسى" الفلترة لأنه أصلاً مش شايف `tenantId` كباراميتر |
| `content_items` الموحد (polymorphic) | `prisma/schema.prisma` (model `ContentItem`) | نفس الحقول المذكورة في الملحق بالظبط |
| `audit_logs` (append-only) | `prisma/schema.prisma` + `src/common/audit/*` | Interceptor مركزي عبر `@Audit()` decorator، مش تسجيل يدوي جوه كل endpoint |
| Policy layer | `src/common/policy/*` | RBAC أساسي + قواعد runtime بترفض حتى الـ Admin لو `confidentiality_level = RESTRICTED` |

## قرار واحد محتاج مراجعتك (per instruction #6)

جدول `audit_logs` في الملحق مفيهوش `tenant_id` صراحة، لكن ضفته لأن التعليمات رقم 4 بتقول "tenant_id على كل جدول رئيسي" — وده جدول رئيسي. لو عايزة تشتغلي بدون العمود ده وتستنتجي الـ tenant من الـ `user_id` وقت الحاجة، قوليلي وأشيله. الفرق العملي: بدونه، أي استعلام على الـ audit log لازم يعمل join على `users` عشان يعرف الـ tenant — ده أبطأ شوية بس ملتزم بالملحق 100%.

## البنية

```
src/
  common/
    tenant-context/   # AsyncLocalStorage — "مين بيسأل؟" متاح لأي service بدون تمرير tenantId يدويًا
    audit/             # @Audit() decorator + interceptor مركزي + AuditService (append-only)
    policy/            # PolicyService (RBAC + attribute rules) + RolesGuard
  prisma/
    prisma.service.ts  # هنا الـ extension اللي بيحقن tenantId إجباريًا
  auth/                # JWT بسيط — كافي لإثبات إن الـ context بيتنقل صح، 2FA الإلزامي فعليًا مرحلة 2 (A1)
  content-items/        # مثال حي يوضح كل حاجة شغالة مع بعض
```

### إزاي الـ middleware بيمنع النسيان فعليًا

كل service بيستخدم `prisma.scoped.xxx` بدل `prisma.xxx` مباشرة. `.scoped` عبارة عن Prisma Client Extension بيحقن `where: { tenantId }` (أو `data: { tenantId }` في الـ create) *تلقائيًا* على أي عملية على `User` / `ContentItem` / `AuditLog` — الـ tenantId جاي من `TenantContextService` (AsyncLocalStorage)، مش من أي حاجة الـ controller بيمررها. لو مفيش context أصلاً (باگ في الـ middleware مثلاً)، الاستعلام **يرفض يشتغل** بدل ما يرجع بيانات غير مفلترة.

الاستثناء الوحيد المتعمد: `auth.service.ts` بيستخدم `prisma.user` (مش `.scoped`) وقت اللوجين بس، لأن الـ tenant لسه مش معروف — ده بالظبط اللي بيتحدد وقتها. أي استخدام تاني للـ raw client المفروض يبقى مشبوه ويتراجع.

## التشغيل محليًا

```bash
cp .env.example .env
docker compose up -d          # Postgres محلي
npm install
npm run prisma:migrate        # يبني الجداول
npm run prisma:seed           # 2 tenants + مستخدمين + محتوى تجريبي
npm run start:dev
```

ثم جرّبي (ملحوظة: من المرحلة 2، اللوجين بقى فيه خطوة 2FA لأدوار الإدارة — شوفي قسم "تجربة الـ 2FA" تحت لو حصلك `requiresTwoFactor` بدل accessToken مباشرة):

```bash
curl -X POST localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"khadija@sortera.inc","password":"Password123!"}'

# خدي الـ accessToken من الرد، وبعدين:
curl localhost:3000/content-items \
  -H "Authorization: Bearer <TOKEN>"
```

## إثبات إن العزل شغال فعليًا (مش افتراض)

```bash
npm test
```

بيشغل `test/tenant-isolation.spec.ts` اللي بيتأكد فعليًا إن:
- استعلام من غير tenant context بيترفض بدل ما يرجع بيانات.
- tenant A مايشوفش صفوف tenant B، والعكس.
- الـ `create()` بيحقن الـ tenant الصح تلقائيًا.
- `audit_logs` فعلاً append-only (update/delete بيترفضوا حتى بدور SUPER_ADMIN).

## الديبلوي على Railway

1. اعملي repo على GitHub وارفعي المجلد ده.
2. في Railway: New Project → Deploy from GitHub repo.
3. ضيفي plugin PostgreSQL من نفس المشروع — Railway هيحط `DATABASE_URL` تلقائيًا في الـ environment.
4. ضيفي متغير `JWT_SECRET` (قيمة عشوائية طويلة) و`JWT_EXPIRES_IN`.
5. في Settings → Deploy: تأكدي إن الـ Start Command هو `npm run prisma:deploy && npm run start:prod` (بدل `start:prod` لوحدها) عشان الـ migrations تتطبق تلقائيًا مع كل ديبلوي.
6. أول ديبلوي، شغّلي الـ seed مرة واحدة يدويًا من الـ Railway shell: `npm run prisma:seed`.

## اللي لسه مش هنا (متعمد — مراحل تانية)

- `document_files`, `retention_policies`, `shared_resources` → **المرحلة 3**
- `access_requests`, بوابة الباحث الخارجي → **المرحلة 4**
- الشاشات نفسها (frontend) — هتتبنى بعد ما توصلني صور الشاشات الحالية عشان أحافظ على نفس الهوية البصرية.

---

## المرحلة 2 — تحسينات القسم أ + B1/B2/B4

### اللي اتبنى

| البند | إزاي |
|---|---|
| **A1 — 2FA إلزامي بدون تخطٍ** | `/auth/login` بترجع `{requiresTwoFactor, tempToken}` بدل accessToken كامل لو الدور محتاج 2FA — مفيش أي endpoint تاني يقبل الـ tempToken ده غير `/auth/2fa/setup` و`/auth/2fa/verify` (مفروضة في `TenantMiddleware` نفسه). "تذكرني على هذا الجهاز" بديل حقيقي عن زرار "تخطي": `deviceToken` طويل الأمد يتبعت مرة واحدة بعد أول 2FA ناجح. |
| Rate limiting | Redis token-bucket (تقريبي) على الإيميل والـ IP معًا في `RateLimitService`. |
| **A2 — داشبورد** | `DashboardSnapshot` جدول تجميعي، بيتحدث بـ cron كل ساعة (`@nestjs/schedule`)، مش استعلام حي. |
| **A3 — Sidebar مُجمّع** | `nav_sections` قابل للتهيئة لكل tenant/role — شفتي في الـ seed إزاي tenant الوزارة أصلاً مالوش قسم "الشخصيات والعلامات". |
| **A4 — دمج Video/Photo Lists مع Event Clips** | نفس `GET /content-items` — فلتر `eventId` اختياري بدل endpoint منفصل. |
| **A5 — Linked Clips بسبب واضح** | `content_relations` بحقل `relation_type` + `confidence_score`. |
| **A6 — دورة حياة العنصر** | `PATCH /content-items/:id/lifecycle` — بيكتب `status_transitions` (append-only) + `event_revisions` (snapshot قبل التغيير) تلقائيًا. |
| **A7 — دمج الشخصيات المكررة** | `pending_merge_suggestions` + `/merge-suggestions` (queue مراجعة بشرية). |
| **A8/A9/B4 — حوكمة الـ AI** | `ai_predictions` موحد للأدوات الثلاث، حالة `PENDING` افتراضية، `/ai-predictions/:id/approve|reject`. |
| **A10 — Event Type** | `event_types` هيكلي (`parent_id`) بدل نص حر. |
| **A11 — مهام الباحثين** | `tasks` مرتبطة بـ `content_item_id`، والداشبورد بيتغذى منها مباشرة. |
| **A12 — إدارة الجلسات** | `active_sessions` — `GET/DELETE /auth/sessions` — مسح الصف = إلغاء الجلسة فورًا حتى لو الـ JWT لسه صالح (بيتفحص في `TenantMiddleware` على كل request). |
| **B2 — Version history** | `event_revisions` append-only. |
| **B1 — بحث نصي كامل** | Postgres `search_vector` (tsvector+GIN) + trigger + `saved_searches`. تفاصيل تحت. |

### القرار اللي اتاخد بخصوص البحث النصي الكامل (B1)

الملف اقترح Elasticsearch/OpenSearch/Meilisearch + queue منفصل (RabbitMQ/SQS). بالنسبة لحجم النظام الحالي (بنية واحدة على Railway، مش scale ضخم دلوقتي)، اقترحت بديل أخف حسب تعليمة رقم 7، ووافقتِ عليه:

**اقتراحي:** Postgres Full-Text Search (tsvector + GIN index) كخطوة أولى بدل ما نضيف Elasticsearch كخدمة منفصلة كاملة.
- **مميزاته:** صفر بنية تحتية إضافية (نفس الـ Postgres الموجود أصلاً)، صفر sync jobs، كافي جدًا لآلاف-عشرات آلاف السجلات.
- **عيوبه:** أضعف من Elasticsearch في البحث العربي المتقدم (fuzzy matching، ranking معقد)، وهيحتاج migration فعلي لـ Meilisearch لو الأرشيف كبر لملايين السجلات.
- **الخطة:** أبني الـ interface (`SearchService`) بشكل مستقل عن التنفيذ، فلو قررنا بعدين نبدّل لـ Meilisearch، الكود اللي بينادي عليه (`saved_searches`، فلاتر الـ content_items) مايتغيرش.

### B1 — البحث النصي الكامل: تم بـ Postgres Full-Text Search

بعد موافقتك، اتنفّذ بـ **Postgres tsvector + GIN index** بدل ما نضيف Elasticsearch/Meilisearch كخدمة منفصلة من الأول (السبب والمقايضة اتشرحوا فوق، لسه سارية).

**خطوة إضافية لازمة بعد أول migration** (Prisma مش بيعرف يعبّر عن triggers في الـ schema):

```bash
npm run prisma:migrate
npx prisma db execute --file prisma/sql/fulltext_search.sql --schema prisma/schema.prisma
```

**الاستخدام:**

```bash
GET /search?q=مؤتمر&contentType=VIDEO&dateFrom=2026-01-01
GET /search?q=قرار+وزاري          # بيدوّر في العنوان + الميتاداتا + أي نص AI معتمد مرتبط
POST /saved-searches   { "name": "فيديوهات المؤتمرات", "queryParams": {"q":"مؤتمر","contentType":"VIDEO"} }
POST /saved-searches/:id/run
```

**محدودية معروفة (موثّقة كمان في `prisma/sql/fulltext_search.sql`):** استخدمنا Postgres text search config اسمه `simple` (تقطيع + تصغير حروف بس، من غير تجذير/stemming)، لأن Postgres مفيهوش قواعد تجذير عربي جاهزة من الصندوق. يعني "الفيديو" و"فيديو" مش هيتطابقوا تلقائيًا. لو ده أثّر عمليًا على جودة البحث، ده بالظبط السيجنال إننا ننتقل لـ Meilisearch (بتدعم العربي أفضل)، وبما إن `SearchService` معزول في module لوحده، الانتقال مش هيغيّر أي كود في الأماكن التانية اللي بتستخدمه.

### تجربة الـ 2FA (لاحظي إن سلوك اللوجين اتغيّر عن المرحلة 1)

`khadija@sortera.inc` دورها OWNER، وده من الأدوار اللي `enforceTwoFactorForRoles` بتفرض عليها 2FA افتراضيًا. يعني بعد الـ migrate/seed، اللوجين العادي مش هيرجع `accessToken` على طول:

```bash
# 1) لوجين عادي — هيرجع tempToken بدل accessToken لأن الدور محتاج 2FA
curl -X POST localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"khadija@sortera.inc","password":"Password123!"}'
# → {"requiresTwoFactor":true,"twoFactorSetupRequired":true,"tempToken":"..."}

# 2) أول مرة بس: سجّلي جهاز الـ authenticator بالـ tempToken
curl -X POST localhost:3000/auth/2fa/setup -H "Authorization: Bearer <TEMP_TOKEN>"
# → {"otpauthUrl":"otpauth://totp/...","secret":"..."} — حطي الـ secret في Google Authenticator

# 3) اتحقّقي بالكود اللي ظهر في التطبيق
curl -X POST localhost:3000/auth/2fa/verify \
  -H "Authorization: Bearer <TEMP_TOKEN>" -H "Content-Type: application/json" \
  -d '{"code":"123456","rememberDevice":true}'
# → {"accessToken":"...","deviceToken":"...","user":{...}}

# المرة الجاية: ابعتي الـ deviceToken جوه /auth/login نفسه عشان تتخطي الكود تاني
# لغاية 30 يوم:  {"email":"...","password":"...","deviceToken":"<DEVICE_TOKEN>"}
```

`researcher@hbjarchive.com` (دور RESEARCHER) مش داخل في `enforceTwoFactorForRoles` الافتراضية، فهيلوجن عادي بدون 2FA — ده متعمد، مش باگ.

---

## المرحلة 3 — C2 (مستندات) + C3 (احتفاظ) + C4 (مشاركة بين عملاء)

### القرار اللي اتاخد بخصوص الـ queue (C2)

الملف اقترح RabbitMQ/SQS لمعالجة المستندات غير المتزامنة. بما إن Redis أصلاً موجود في الـ stack (لـ rate limiting)، استخدمت **BullMQ** (queue مبني على Redis نفسه) بدل ما نضيف نظام queue كامل جديد لمهمة واحدة بس. لو حجم المعالجة كبر جدًا مستقبلًا، BullMQ بيقدر يتوسّع افقيًا (workers متعددة)، والانتقال لـ RabbitMQ/SQS ممكن بعدين من غير ما يأثر على `DocumentsService` (نفس فكرة عزل `SearchService` في B1).

### اللي اتبنى

| البند | إزاي |
|---|---|
| **C2 — رفع ومعالجة PDF/Word** | `POST /documents` (multipart) → S3-compatible storage (بادئة `tenants/<id>/` لكل tenant) → `document_files` بحالة `PENDING` → BullMQ job. الـ worker (`document-processing.processor.ts`): نص حقيقي عبر `pdf-parse`، لو النص شبه فاضي (PDF ممسوح ضوئيًا) → OCR عبر `tesseract.js` (عربي+إنجليزي)، Word عبر `mammoth`. النص المستخرج بينضاف لـ `metadata.extractedText` فيبقى قابل للبحث تلقائيًا (نفس trigger الـ B1). |
| **C3 — سياسة الاحتفاظ** | `retention_policies` (CRUD عبر `/retention-policies`) + `retention_expiry_date`/`applied_retention_policy` (snapshot) على كل `content_item` وقت الإنشاء. Cron يومي (`RetentionEnforcementService`) بينفذ `ARCHIVE`/`DELETE`/`NOTIFY_ONLY`. الحذف **soft-delete أول** (7 أيام أمان)، وبعد المهلة "hard delete" فعليًا معناه *تفريغ المحتوى* (title/metadata) مش حذف الصف نفسه — لأن `status_transitions`/`event_revisions` بتربط بيه بـ foreign key ولازم تفضل موجودة (B2). |
| **C4 — مشاركة بين عملاء** | `shared_resources` (`POST/GET/DELETE /shared-resources/*`) + `GET /shared-with-me/:contentItemId` كـ endpoint منفصل تمامًا عن `GET /content-items/:id` العادي — قصدًا، مش مدموجين. المحتوى `RESTRICTED` **مايتشاركش عبر الـ tenants إطلاقًا** حتى لو الطرف التاني SUPER_ADMIN. |

**ملاحظة معمارية مهمة:** `shared_resources` هو الجدول الوحيد في النظام كله المُستثنى عمدًا من الـ middleware الإجباري (`.scoped`) — لأن عمود `tenant_id` فيه معناه "التenant اللي اتشارك معاه" مش "المالك"، فالحقن التلقائي كان هيقلب المعنى. الاستثناء ده موثّق بالتفصيل في `prisma.service.ts` و`shared-resources.service.ts` — هو المكان الوحيد المسموح له يلمس الجدول ده مباشرة.

### إعداد إضافي لازم للمرحلة 3

```bash
# .env جديد: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
docker compose up -d   # بقى فيه MinIO كمان (S3 محلي) على :9000، الكونسول على :9001
```

اعملي الـ bucket مرة واحدة يدويًا من MinIO console (`http://localhost:9001`, admin/minioadmin) باسم `hbj-archive-documents` (أو أي اسم، بس يطابق `S3_BUCKET` في `.env`).

### ملاحظة صراحة: كود لسه محتاج smoke-test فعلي

جزء الـ OCR (`document-processing.processor.ts`) اتكتب من غير تثبيت فعلي للمكتبات (مفيش إنترنت في بيئة الكتابة)، وتحديدًا استدعاء `pdf-img-convert` — الـ API بتاعها اتغيّر بين الإصدارات. أول حاجة تتأكدي منها لما تشغّلي الـ worker محليًا هي إن استدعاء `pdfImgConvert.convert(buffer)` بيرجع فعلاً array من الصور زي المتوقع. باقي الكود (pdf-parse, mammoth, tesseract.js الأساسي) أنماط استخدام مستقرة وموثقة كويس.
