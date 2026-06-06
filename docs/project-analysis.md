# Аналіз архітектури Diploma System

## Горизонтальний Аналіз

### `client/src`

Frontend побудований як React SPA з React Router, Mantine UI, Clerk auth та SCSS modules.

- `api` - спільний HTTP-шар. `apiClient.ts` містить `apiRequest<T>()`, базовий `API_URL` і `ApiError`. Окремих domain-specific services на клієнті немає, тому сторінки напряму викликають `apiRequest`.
- `components` - повторно використовувані UI-блоки. `application` містить toolbar, timeline, status badge і match-аналіз applications; `common` містить tooltip, loader, form section, header, rich text editor, banners і badges; `auth` містить оболонку auth-сторінок і `ProtectedRoute`; `hr` містить стандартну картку і drawer preview рекрутера; `resume` містить preview резюме; `vacancy` містить public preview і search card.
- `layouts` - композиція сторінок. `RootLayout` дає загальну оболонку з header/outlet, `CabinetLayout` дає ліве меню кабінету і контент.
- `locales` - українські тексти і helper `interpolate`.
- `pages` - route-level екрани, розкладені за доменами: `home/Home`, `auth/Start`, `auth/SignInPage`, `auth/SignUpPage`, `auth/AuthRedirect`, `auth/Onboarding`, `auth/AdminDashboard`, `student/StudentDashboard`, `hr/HrDashboard`, `vacancies/VacanciesPage`, `companies/CompanyPublicPage`.
- `styles` - глобальні стилі, змінні, chip mixins.
- `utils` - чисті helper-функції для масок і валідації форм.

Основні frontend routes реально існують у `client/src/router.tsx`: `/`, `/start`, `/sign-up`, `/sign-in`, `/vacancies`, `/vacancies/:vacancyId`, `/companies/:companyId`, `/onboarding`, `/auth/redirect`, `/student`, `/hr` та читабельні HR routes `/hr/vacancies`, `/hr/vacancies/new`, `/hr/vacancies/:vacancyId/:view`, `/hr/profile`, `/hr/company`. Admin route зараз закоментований, хоча placeholder `pages/auth/AdminDashboard.tsx` є у структурі.

Дублювання:

- `HrDashboard.tsx` і `StudentDashboard.tsx` містять багато локальних компонентів, helper-функцій та іконок у межах одного файлу. Для MVP це допустимо, але файл HR вже дуже великий.
- Є повторювані `InfoRow`, `ContactCopyRow`, `LinkEditor`, SVG-іконки у HR, Student та preview-компонентах.
- До правки картки рекрутера в компанії та public preview передавали скорочений об'єкт, хоча drawer preview мав повний DTO. Тепер картки компанії будуються через `buildRecruiterCardFromCompanyHr()`, який використовує той самий `RecruiterPublicPreviewData`.

### `server/src`

Backend побудований як Express API з Clerk middleware, Prisma repository layer та service layer.

- `config` - інфраструктура доступу до бази. `db.ts` створює Prisma client з PostgreSQL adapter.
- `controllers` - HTTP handlers. Витягують auth/user id, route params, query/body, викликають services, повертають `{ success, data }`, помилки передають у `next`.
- `routes` - Express routers. Маплять endpoint на controller.
- `services` - бізнес-логіка, валідація DTO, права доступу, транзакції, синхронізація Clerk, нормалізація даних для frontend.
- `repositories` - ізольований доступ до Prisma. Містить CRUD, пошук, M:N replace-операції, include/select конфігурації.
- `errors` - `BusinessLogicError` і HTTP status constants.
- `utils` - чисті утиліти, зараз `EmailValidator`.

Дублювання:

- У кількох controller-файлах повторюється helper витягування Clerk user id.
- У services повторюються `requiredString`, `requiredNumber`, `requiredEnum`.
- Repository-шар послідовний, але частина M:N replace-операцій повторює один патерн.

## Вертикальний Аналіз Сценаріїв

### Створення Вакансії

Frontend:

- Route: `/hr/vacancies/new`.
- Компоненти: `HrDashboard`, `CreateVacancyTab`, `VacancySkillGroups`, `LinkEditor` не бере участі, `RichTextEditor`, `FormSection`, `ChipBadge`, `InlineError`.
- API: `apiRequest<Catalogs>("/vacancies/catalogs")` для довідників; `apiRequest("/vacancies/my-cabinet", token, { method: "POST", body })` у `saveVacancy`.
- Дані форми: `VacancyFormState` з title, professionId, sphereIds, description, skills, languages, officeLocationIds, isLocationStrict, workFormatIds, employmentTypeIds, workScheduleIds, salaryFrom/salaryTo/salaryPeriod, closingDate.
- Перетворення: `validateVacancyForm()` перевіряє frontend-обмеження; `vacancyFormToPayload()` переводить рядкові ids у числа і додає `status: "DRAFT" | "ACTIVE"`.

Backend:

- Route: `POST /api/vacancies/my-cabinet`.
- Controller: `createVacancy(req, res, next)`.
- Service: `VacancyService.createVacancy(clerkUserId, body)`.
- Repositories: `HrProfileRepository.findByClerkUserId`, `CompanyRepository.findCompanyById`, `SkillRepository.countExistingSkills`, `VacancyRepository.createVacancy`, `replaceSpheres`, `replaceSkills`, `replaceLanguages`, `replaceLocations`, `replaceWorkFormats`, `replaceEmploymentTypes`, `replaceWorkSchedules`, `findVacancyById`.
- Models/types: `Vacancy`, `VacancySphere`, `VacancySkill`, `VacancyLanguage`, `VacancyLocation`, `VacancyWorkFormat`, `VacancyEmploymentType`, `VacancyWorkSchedule`, enums `ListingStatus`, `RequirementWeight`, `LanguageLevel`, `SalaryPeriod`.
- Дані між шарами: frontend payload → controller body → `VacancyUpsertRequest` → normalized service object → `VacancyCreateData` + M:N arrays → Prisma records → mapped vacancy DTO with `matchingRequirements`.

### Редагування Вакансії

Frontend:

- Починається з таблиці або сторінки управління: `startVacancyEdit(vacancy)` заповнює `vacancyForm` через `vacancyToForm(vacancy)`, ставить `editingVacancyId`, відкриває edit mode.
- Компоненти: `VacancyBoard`, `VacancyRowActions`, `VacancyManagementPage`, `CreateVacancyTab`.
- API: `apiRequest(`/vacancies/my-cabinet/${editingVacancyId}`, token, { method: "PATCH", body })`.
- Дані: той самий `VacancyFormState`, але отриманий із `VacancyRow`.

Backend:

- Route: `PATCH /api/vacancies/my-cabinet/:vacancyId`.
- Controller: `updateVacancy`.
- Service: `VacancyService.updateVacancy(clerkUserId, vacancyId, body)`.
- Repositories: перевірка ownership через `findCompanyVacancy`, потім `updateVacancy` і повна заміна M:N зв'язків.
- Дані між шарами: `vacancyId` route param + body → normalized update → `VacancyUpdateData` → updated vacancy DTO.

### Таблиця Управління Вакансіями

Frontend:

- Компоненти: `VacancyBoard`, `VacancyTableSkeleton`, `SortableHeader`, `VacancyStatusBadge`, `VacancyRowActions`, `TablePagination`, `VacancyEmptyState`.
- State: `vacancySearch`, `vacancyStatusFilter`, `vacancyPage`, `vacancyPageSize`, `vacancySortBy`, `vacancySortDirection`, `vacancyMeta`.
- API: `apiRequest<PaginatedResponse<VacancyRow>>(buildVacancyListPath(overrides), token)`.
- Дані: query params `page`, `pageSize`, `sortBy`, `sortDirection`, optional `search`, optional `status`.
- Таблиця не містить колонки умов; перша колонка з назвою вакансії та остання колонка дій завжди видимі; назва переноситься в межах обмеженої першої колонки без tooltip; необов'язкові колонки приховуються справа наліво на менших ширинах.

Backend:

- Route: `GET /api/vacancies/my-cabinet`.
- Controller: `listMyVacancies`.
- Service: `VacancyService.listMyVacancies(clerkUserId, query)`.
- Repositories: `archiveExpiredActiveVacancies`, `listCompanyVacancies`.
- Дані між шарами: query → `VacancyListRequest` → `VacancyListParams` → Prisma `where/orderBy/skip/take` → paginated DTO.

### Перегляд Вакансії В Кабінеті Роботодавця

Frontend:

- Компоненти: `VacancyManagementPage`, `VacancyPreview`, `RecruiterPublicCard`, `RecruiterPublicPreviewDrawer`, `InfoRow`, `VacancySkillGroups`.
- Відкриття: таблиця `onSelect(vacancy)` ставить `selectedVacancy` і `vacancyManagementTab="preview"`.
- API: окремий `GET /vacancies/my-cabinet/:id` існує, але поточний UI переважно використовує вже завантажений `VacancyRow` зі списку.
- Дані: `VacancyRow` містить професію, сфери, умови, локації, skills/languages, company, hrProfile.

Backend:

- Route: `GET /api/vacancies/my-cabinet/:vacancyId`.
- Controller: `getMyVacancy`.
- Service: `VacancyService.getMyVacancy`.
- Repository: `findCompanyVacancy`.
- Дані між шарами: `vacancyId` + current HR company → full vacancy DTO.

### Профіль Рекрутера

Frontend:

- Route: `/hr/profile`.
- Компоненти: `HrProfileTab`, `RecruiterPublicCard`, `RecruiterPublicPreviewDrawer`, `LinkEditor`, `InfoRow`, `ContactCopyRow`, `ModerationBadge`.
- API: `GET /hr-profiles/my-cabinet` у `loadDashboard`; `PATCH /hr-profiles/my-cabinet` у `saveHrProfile`.
- Дані: `HrProfile` з `position`, `links`, `user` identity/status/email/createdAt, `company`.

Backend:

- Routes: `GET /api/hr-profiles/my-cabinet`, `PATCH /api/hr-profiles/my-cabinet`.
- Controllers: `getMyHrProfile`, `updateMyHrProfile`.
- Service: `HrProfileService.getMyHrProfile`, `updateMyHrProfile`.
- Repositories: `HrProfileRepository.findByClerkUserId`, `updateHrProfile`, `replaceLinks`; `UserRepository.updateUserIdentity`.

### Публічне Preview Рекрутера

Frontend:

- Єдиний стандартний компонент: `RecruiterPublicPreviewDrawer`.
- Картка відкриття: `RecruiterPublicCard`.
- Джерела DTO: `buildRecruiterPreviewFromProfile`, `buildRecruiterPreviewFromCompanyHr`, `buildRecruiterPreviewFromVacancy`.
- Після правки картки рекрутерів у профілі компанії та preview компанії формуються через `buildRecruiterCardFromCompanyHr`, тобто з того самого DTO, який потім відкривається у drawer.
- Дані: fullName, position, photoUrl, companyName, email, contacts, createdAt, activeVacanciesCount, totalVacanciesCount.

Backend:

- Окремого public recruiter endpoint немає.
- Дані приходять у складі `GET /hr-profiles/my-cabinet`, `GET /companies/my-cabinet/hr-profiles`, `GET /vacancies/my-cabinet`.

### Профіль Компанії

Frontend:

- Route: `/hr/company`.
- Компоненти: `CompanyProfileTab`, `FormSection`, `RichTextEditor`, `LinkEditor`, `RecruiterPublicCard`, `RecruiterPublicPreviewDrawer`, `ModerationBadge`.
- API: `GET /companies/my-cabinet`, `GET /companies/my-cabinet/hr-profiles`, `PATCH /companies/my-cabinet`.
- Дані: `CompanyProfile` з registration/legal/public fields, contacts, spheres, locations, links; `CompanyHr[]` для команди.

Backend:

- Routes: `GET /api/companies/my-cabinet`, `GET /api/companies/my-cabinet/hr-profiles`, `PATCH /api/companies/my-cabinet`.
- Controllers: `getMyCompany`, `getMyCompanyHrs`, `updateMyCompany`.
- Service: `CompanyService.getMyCompany`, `getMyCompanyHrs`, `updateMyCompany`.
- Repositories: `CompanyRepository.findCompanyByHrClerkId`, `listCompanyHrs`, `updateCompany`, `replaceCompanySpheres`, `upsertLocation`, `replaceCompanyLocations`, `replaceLinks`.

### Preview Компанії

Frontend:

- Не окремий route; відкривається локально через `isCompanyPreviewOpen`.
- Компоненти: `CompanyPublicPage`, `CompanyVacancyFilters`, `CompanyPublicLinks`, `RecruiterPublicCard`, `RecruiterPublicPreviewDrawer`, `TablePagination`, `VacancyStatusBadge`.
- Дані: використовує вже завантажені `company`, `companyHrs`, `vacancies`. Фільтрація public vacancies локальна через `filterPublicVacancies`, сортування через `sortPublicVacancies`, пагінація через `paginateVacancies`.
- API: окремого preview endpoint немає.

Backend:

- Дані preview збираються з уже наявних endpoints `GET /companies/my-cabinet`, `GET /companies/my-cabinet/hr-profiles`, `GET /vacancies/my-cabinet`.

## Routing/API

### Frontend Routes

- `/` - home.
- `/start` - стартовий вибір.
- `/sign-up`, `/sign-in` - Clerk auth pages.
- `/onboarding`, `/auth/redirect` - protected auth completion.
- `/student` - кабінет студента.
- `/hr/vacancies`, `/hr/vacancies/new`, `/hr/vacancies/:vacancyId/:view`, `/hr/profile`, `/hr/company` - route-backed екрани кабінету роботодавця.
- `/admin` - кабінет адміністратора.

HR-кабінет використовує читабельні path routes, тому вкладка, вибрана вакансія й підекран applications/preview/edit відновлюються після refresh та browser navigation. Legacy query URL приймається для сумісності й переводиться у відповідний path.

### Backend API Endpoints

Знайдені endpoints:

- `GET /api/health`
- `POST /api/users/webhooks/clerk`
- `POST /api/users/onboarding`
- `GET /api/users/my-cabinet/auth`
- `PATCH /api/users/my-cabinet/email`
- `GET /api/users/:userId/public-info`
- `PATCH /api/users/:userId/status`
- `GET /api/students/my-cabinet`
- `GET /api/students/my-cabinet/search-preferences`
- `PATCH /api/students/my-cabinet/personal-info`
- `PATCH /api/students/my-cabinet/search-preferences`
- `POST/PATCH/DELETE /api/students/my-cabinet/resume/education`
- `POST/PATCH/DELETE /api/students/my-cabinet/resume/languages`
- `POST/PATCH/DELETE /api/students/my-cabinet/resume/courses`
- `POST/PATCH/DELETE /api/students/my-cabinet/resume/projects`
- `POST/PATCH/DELETE /api/students/my-cabinet/resume/experiences`
- `GET /api/companies`
- `GET /api/companies/my-cabinet`
- `PATCH /api/companies/my-cabinet`
- `GET /api/companies/my-cabinet/hr-profiles`
- `GET /api/hr-profiles/my-cabinet`
- `PATCH /api/hr-profiles/my-cabinet`
- `GET /api/catalogs/student-cabinet`
- `GET /api/catalogs/skills`
- `GET /api/catalogs/universities`
- `GET /api/catalogs/professions`
- `GET /api/catalogs/spheres`
- `GET /api/catalogs/countries`
- `GET /api/catalogs/countries/:countryId/regions`
- `GET /api/catalogs/regions/:regionId/cities`
- `GET /api/vacancies/catalogs`
- `GET /api/vacancies/search`
- `GET /api/vacancies/student/filter-options`
- `GET /api/vacancies/student/:vacancyId`
- `GET /api/vacancies/my-cabinet`
- `POST /api/vacancies/my-cabinet`
- `GET /api/vacancies/my-cabinet/:vacancyId`
- `PATCH /api/vacancies/my-cabinet/:vacancyId`
- `PATCH /api/vacancies/my-cabinet/:vacancyId/status`
- `POST /api/vacancies/my-cabinet/:vacancyId/archive`
- `POST /api/applications/check-eligibility`
- `POST /api/applications`
- `GET /api/applications/my`
- `GET /api/vacancies/:id/applications`
- `PATCH /api/applications/:id/status`

Endpoints, яких бракує або які варто винести пізніше:

- public company profile endpoint за company id/slug;
- public recruiter profile endpoint за recruiter id;
- public vacancy endpoint для студентів/гостей;
- окремий `GET /api/companies/my-cabinet/vacancies` не критичний, бо `/api/vacancies/my-cabinet` уже покриває список вакансій компанії;
- розширені pipeline filters/analytics endpoints для applications, якщо базова ручна перевірка стане production workflow.

## Мінімальні Рекомендації

Критичних архітектурних проблем, які вимагають негайного переписування, не знайдено.

Мінімальні правки:

- використовувати читабельні path routes HR-кабінету без технічних query-параметрів;
- не дробити `HrDashboard` прямо зараз, але наступним технічним боргом винести типи, API wrappers і великі tab-компоненти;
- додати public endpoints лише тоді, коли preview стане реально публічним, а не кабінетним попереднім переглядом;
- уніфікувати дрібні `InfoRow/ContactCopyRow/LinkEditor` пізніше, коли стабілізується дизайн.

## Application Flow Foundation

### Потік Та Статуси

`Application` пов'язує `StudentProfile` з `Vacancy` і має унікальність `(vacancyId, studentProfileId)`. Доступні статуси з Prisma enum: `SENT`, `VIEWED`, `SHORTLISTED`, `INTERVIEW_INVITED`, `OFFERED`, `HIRED`, `REJECTED`, `WITHDRAWN`.

Потік створення: студент викликає eligibility check, після позитивної відповіді `POST /api/applications` повторно перевіряє умови й у transaction створює application зі статусом `SENT`, перший `ApplicationStatusHistory(fromStatus=null, toStatus=SENT)` та outbox event. Студент читає лише власні applications. HR читає applications лише вакансій своєї компанії, а змінює статуси тільки для вакансій, створених саме його `HrProfile`.

Статусний потік: кожна фактична зміна статусу додає `ApplicationStatusHistory`; запит з тим самим статусом повертає поточний запис без дублювання історії. Перший перегляд HR-списку відгуків вакансії одноразово фіксує `SENT -> VIEWED`. Студент може встановити `WITHDRAWN` для власного нетермінального відгуку й скасувати відкликання тільки поверненням на попередній зафіксований етап. HR може просувати кандидата вперед, пропускаючи проміжні етапи, або після підтвердження встановити `REJECTED`; інші зворотні переходи та редагування terminal status заборонені. При `HIRED` сервіс перевіряє відсутність іншого найнятого application та в одній transaction закриває vacancy (`CLOSED`, `closedAt`, `closeReason=HIRED`). Автоматичного відхилення інших кандидатів немає.

### Eligibility

Відгук блокують лише умови, підтримані чинною моделлю:

- vacancy не `ACTIVE` або `closingDate` уже минула;
- студент уже подавав application на цю vacancy;
- `StudentProfile.visibility = HIDDEN`;
- у skills із досвіду, проєктів і курсів немає всіх `VacancySkill(weight=CRITICAL)`;
- бажана професія не збігається з професією вакансії, або не збігається жодне задане значення типу зайнятості, графіка чи формату роботи;
- зарплатне очікування кандидата перевищує задану верхню межу/єдину межу вакансії;
- мовний рівень студента нижчий за вимогу `VacancyLanguage` або мова відсутня;
- при `isLocationCritical=true` немає exact збігу нормалізованого `locationId` серед бажаних локацій.

Незаповнений опис профілю та відсутність зовнішніх посилань/портфоліо повертаються як `profileWarnings`, але не блокують application. Нових обов'язкових полів профілю не введено.

### Match Score Та Elasticsearch

`MatchingScoreService` реалізує дві незалежні метрики. `baseRequirementsPercent` є відсотком покриття всіх параметрів вакансії: формується список profession, окремих skills, languages, grouped location/employment/schedule/format і salary items; вага `CRITICAL=3`, `IMPORTANT=2`, `NICE_TO_HAVE=1`; формула: `round(matchedRequirementScore / maxRequirementScore * 100, 2)`, або `100`, якщо items відсутні. Ця метрика не тотожна допуску до відгуку.

Кожний requirement item містить `isBlocking` та `blockingReason`. Критичні вимоги мають дві видимі групи: `Критичні навички` та `Обов'язкові умови вакансії`. До умов допуску належать profession, language requirements, задані employment type/schedule/work format, задана salary condition, а локація блокує лише при `isLocationCritical=true`; необов'язкова локація зберігається у цій категорії для покриття і бонусу, але не забороняє application. `EligibilityService` читає ці самі items, а не дублює правила. Відсутність `student.minSalary` означає відсутність нижньої межі очікувань, тому зарплатна умова вважається виконаною.

`totalScore` є абсолютним балом для сортування applications і записується в `Application.matchScore`. Формула: `skillDepthScore + additionalCriteriaScore`, де складові у UI називаються `Бали за глибину компетенцій` і `Додаткові бали`. Skill depth враховує лише skills вакансії: курс дає `2` або `4` бали із сертифікатом, проєкт `6` або `8` балів із посиланням, досвід дає `fullMonths * 2` або мінімум `1`; сума джерел множиться на requirement weight skill. Додаткові бали: language bonus залежно від перевищення рівня і сертифіката, exact/broad bonus лише для необов'язкової локації (`4/2/0`), найвища освіта з bonus диплома та `isActiveSearch`. Критична локація впливає тільки на eligibility і дає `0` additional points.

HR переглядає те саме оформлене резюме кандидата з application card через захищений endpoint. Контакти не входять у загальний список applications: для `PUBLIC` вони відкриваються після подання відгуку, для `APPLIED_ONLY` - після `INTERVIEW_INVITED` або пізнішого етапу, а `HIDDEN` і далі блокує подання відгуку.

`Application.matchDetails` містить повний JSON-аналіз: base requirements items/coverage, coverage blocking-вимог, skill/language/location/education breakdown, active search bonus, score components, explanation codes та `requirementEligibility`. Коли HR змінює вимоги вакансії або студент змінює matching-дані профілю, existing applications перераховуються; кандидат не видаляється, але після втрати blocking eligibility має `matchesBlockingRequirements=false`, показується неактивним і опускається нижче у HR-списку.

Application card використовує окрему візуальну шкалу підходящості на базі `baseRequirementsPercent` і blocking eligibility. Якщо `matchesBlockingRequirements=false` або є `missingCriticalSkills`, показується `Не відповідає критичним вимогам` з danger-тоном, червоною рамкою, приглушенням і легкою сірою домішкою фону. Якщо всі критичні/blocking вимоги виконані, `baseRequirementsPercent < 70` дає `Часткова відповідність` з accent-тоном, `70 <= percent < 85` - `Хороша відповідність` з info-тоном, `percent >= 85` - `Висока відповідність` із secondary-тоном. Це не змінює `matchScore`: абсолютний score далі використовується для сортування й аналізу глибини підтверджень.

PostgreSQL/Prisma є source of truth для eligibility і matching. Elasticsearch використовується лише для retrieval/search та ранжування результатів текстового пошуку; його `_score` не є і не стане фінальним match score application.

### Application UI Та Timeline

У спільній сторінці вакансії кнопка `Відгукнутися` виконує eligibility і створення; feedback має dismiss-action. У вкладці студента `Відгуки на вакансії` та в HR-панелі конкретної вакансії використовується спільний `ApplicationCard`: заголовок і метрики вгорі, нижче два рівні блоки meta/actions, які адаптуються до ширини. У HR-панелі є process-step filter, сортування за `matchScore`, `baseRequirementsPercent` або датою та expandable analysis.

Reusable `ApplicationStatusTimeline` у картці спершу показує лише останнє оновлення; після розгортання відображає горизонтальний процес `SENT -> VIEWED -> SHORTLISTED -> INTERVIEW_INVITED -> OFFERED -> HIRED`, terminal markers `REJECTED`/`WITHDRAWN` і журнал `ApplicationStatusHistory`. Текст кроку знаходиться під номером, пропущені HR етапи позначаються перекресленими, а керування переходом для HR розміщене всередині timeline, не в основному рядку картки. `MatchAnalysisPanel` показує метрики у порядку coverage, critical requirements, base percentage, total score; дві останні метрики розкривають формулу та склад бала. Під метриками розміщено `DonutChart` покриття чотирьох категорій і перемиканий `BarChart` балів за навичками/кількості джерел, а секції вимог виводять колонки `Виконано`/`Не виконано`.

### Transactional Outbox

У transaction створюються такі MVP-події:

- `Application CREATED` при створенні відгуку;
- `Application UPDATED` при фактичній зміні статусу;
- `Vacancy UPDATED` при закритті вакансії через `HIRED`.

`SearchOutboxWorker` доданий як skeleton, але не підключений до автоматичного scheduler/process startup: його можна підключити окремим background runner. Він обробляє `PENDING` події за `createdAt`, ставить `PROCESSED` або `FAILED` і не впливає на успіх бізнес-операції при недоступному Elasticsearch.

Поточна `OutboxEvent` модель достатня для MVP, але для production бракує retry counter, persisted error details, processed timestamp та locking/claiming механізму для кількох worker-ів. Також перевірка єдиного `HIRED` зараз service-level; при конкурентних транзакціях майбутня production-реалізація потребує сильнішої DB/concurrency гарантії.
## Поточні уточнення routing та UI

- Верхнє посилання `/vacancies` підключене до окремої спільної сторінки каталогу вакансій, а не до вкладки кабінету.
- Поточний підхід із внутрішнім state вкладок лишається у Student dashboard. HR dashboard уже має читабельні path routes для основних екранів і vacancy subviews, тому технічний state взаємодії з вакансією не ховається у query.
- Меню кабінету зберігає стан, який задав користувач. Автоматична дія обмежена тільки одноразовим згортанням для HR-вкладки управління вакансіями.
- Поля зарплати у формі вакансії та студентських фільтрах мають однакове frontend-обмеження `0..1_000_000`, без дробових і від'ємних значень; backend додатково перевіряє верхні межі та верифікацію компанії перед публікацією вакансії.
- Ручна перевірка eligibility/application flow підключена на спільній сторінці `/vacancies`: кнопка `Відгукнутися` сама виконує eligibility check перед створенням application.
- Фільтри каталогу винесено в бічну панель: великі категорії мають пошук, плашки обраних значень і список зі скролом; професії та компанії підтримують multi-select, мови додаються парами `мова-рівень`.
- Перегляд вакансії винесено у спільний `VacancyPublicPreview`: HR preview і студентський перегляд використовують один компонент, а студентська дія `Відгукнутися` приклеєна в правій колонці.
- Результат application action показується тільки під кнопкою в sticky-блоці; дублюючий загальний notice на detail view не використовується.

## VacanciesPage Search Flow With Elasticsearch

- `VacanciesPage` збирає стан пошуку, фільтрів, сортування та пагінації і викликає `GET /api/vacancies/search`.
- Frontend передає тільки звичайні параметри: `search`, `page`, `pageSize`, `sortBy`, `sortDirection`, `mode`, `professionIds`, `companyIds`, `sphereIds`, `regionIds`, `cityIds`, `workFormatIds`, `employmentTypeIds`, `workScheduleIds`, `languageId`, `minLanguageLevel`, `minSalary`.
- Backend нормалізує параметри у `VacancySearchService.searchVacancies()`. Для стандартної сторінки завжди додаються `status = ACTIVE` і `closingDate >= today`.
- Якщо `ELASTICSEARCH_ENABLED=true` і Elasticsearch відповідає, пошук виконується через індекс `${ELASTICSEARCH_INDEX_PREFIX}_vacancies`. Якщо Elasticsearch недоступний або запит падає, сервіс тихо переходить на Prisma fallback, де PostgreSQL залишається source of truth.
- Elasticsearch query формується тільки на backend, щоб frontend не знав про mapping, boosts, nested-фільтри мов, fallback і майбутні зміни індексу.
- Вільний текст `search` нормалізується на backend: пробіли, коми, `+` і `;` розділяють пошукові терми, дублікати та поширені службові слова прибираються. Кожен змістовний терм є optional relevance match, а `minimum_should_match: 1` означає, що достатньо збігу з будь-якою значущою частиною запиту; більше збігів збільшує `_score`.
- Усі обрані категорії фільтрів застосовуються як строгі constraints разом із `status = ACTIVE` та актуальним `closingDate`; декілька значень у межах однієї категорії (наприклад, кілька професій або локацій) працюють як допустимі альтернативи.
- Для текстового пошуку використовуються boost-и: `title^6`; `criticalSkillNames^5`; `importantSkillNames^4`; `plusSkillNames^3`; `skillNames^3`; `professionName^2.5`; `sphereNames^2`; `description^1`; `companyName^0.75`.
- Elasticsearch `_score` використовується як первинна релевантність для пошукового рядка. Це не фінальний Match Score студента з вакансією і не замінює окремий matching/scoring pipeline.
- Звичайні терми у `search` є soft OR matches. Терм із початковим `*`, наприклад `*Trainee`, стає required match; символ `*` забирається перед пошуком. Символ `+` залишається тільки роздільником і не робить слово обов'язковим.
- В Elasticsearch soft terms потрапляють у `bool.should`, required terms у `bool.must`, а строгі фільтри залишаються в `bool.filter`. У Prisma fallback кожен required term додається як окрема AND-група, яка може збігтися з будь-яким searchable полем.
- При текстовому запиті типовий `sortBy=relevance`: `_score desc`, потім `updatedAt desc`. Для явного `sortBy=updatedAt` або `sortBy=salaryFrom` обране поле стає primary sort, а `_score desc` використовується як tie-breaker.
- Без текстового `search` relevance не обчислюється: `sortBy=relevance` нормалізується до `updatedAt desc`. Основний sorting UI пропонує `relevance`, `updatedAt` та `salaryFrom`.
