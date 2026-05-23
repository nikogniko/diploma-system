# Аналіз архітектури Diploma System

## Горизонтальний Аналіз

### `client/src`

Frontend побудований як React SPA з React Router, Mantine UI, Clerk auth та SCSS modules.

- `api` - спільний HTTP-шар. `apiClient.ts` містить `apiRequest<T>()`, базовий `API_URL` і `ApiError`. Окремих domain-specific services на клієнті немає, тому сторінки напряму викликають `apiRequest`.
- `components` - повторно використовувані UI-блоки. `common` містить tooltip, loader, form section, rich text editor, badges; `auth` містить оболонку auth-сторінок; `hr` містить стандартну картку і drawer preview рекрутера; `resume` містить preview резюме.
- `layouts` - композиція сторінок. `RootLayout` дає загальну оболонку з header/outlet, `CabinetLayout` дає ліве меню кабінету і контент.
- `locales` - українські тексти і helper `interpolate`.
- `pages` - route-level екрани. `Home`, `Start`, auth/onboarding, `student/StudentDashboard`, `hr/HrDashboard`, `admin/AdminDashboard`.
- `styles` - глобальні стилі, змінні, chip mixins.
- `utils` - чисті helper-функції для масок і валідації форм.

Основні frontend routes реально існують у `client/src/router.tsx`: `/`, `/start`, `/sign-up`, `/sign-in`, `/onboarding`, `/auth/redirect`, `/student`, `/hr`, `/admin`. HR-кабінет не має вкладених URL routes; вкладки керуються через `/hr?tab=...`.

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

- Route: `/hr?tab=create-vacancy`.
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
- UI-правка: колонку умов прибрано з таблиці; перша колонка з назвою вакансії та остання колонка дій не приховуються; назва переноситься в межах обмеженої першої колонки без tooltip; необов'язкові колонки приховуються справа наліво на менших ширинах.

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

- Route/tab: `/hr?tab=profile`.
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

- Route/tab: `/hr?tab=company`.
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
- `/hr` - кабінет роботодавця з query tabs.
- `/admin` - кабінет адміністратора.

Поточний підхід `/hr?tab=...` достатній для дипломного MVP: вкладки HR-кабінету є частинами одного робочого простору, вони мають спільний state, спільне завантаження dashboard-даних і не потребують deep-link URL для кожної вкладки. Повноцінні nested routes варто вводити тільки якщо з'являться незалежні сторінки з власним lifecycle, browser history вимогами або public sharing.

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
- `GET /api/vacancies/student`
- `GET /api/vacancies/student/:vacancyId`
- `GET /api/vacancies/my-cabinet`
- `POST /api/vacancies/my-cabinet`
- `GET /api/vacancies/my-cabinet/:vacancyId`
- `PATCH /api/vacancies/my-cabinet/:vacancyId`
- `PATCH /api/vacancies/my-cabinet/:vacancyId/status`
- `POST /api/vacancies/my-cabinet/:vacancyId/archive`

Endpoints, яких бракує або які варто винести пізніше:

- public company profile endpoint за company id/slug;
- public recruiter profile endpoint за recruiter id;
- public vacancy endpoint для студентів/гостей;
- окремий `GET /api/companies/my-cabinet/vacancies` не критичний, бо `/api/vacancies/my-cabinet` уже покриває список вакансій компанії;
- endpoints для applications pipeline, якщо вкладка "відгуки" стане реальною функцією, а не placeholder.

## Мінімальні Рекомендації

Критичних архітектурних проблем, які вимагають негайного переписування, не знайдено.

Мінімальні правки:

- залишити `/hr?tab=...` для MVP;
- не дробити `HrDashboard` прямо зараз, але наступним технічним боргом винести типи, API wrappers і великі tab-компоненти;
- додати public endpoints лише тоді, коли preview стане реально публічним, а не кабінетним попереднім переглядом;
- уніфікувати дрібні `InfoRow/ContactCopyRow/LinkEditor` пізніше, коли стабілізується дизайн.
## Поточні уточнення routing та UI

- Верхнє посилання `/vacancies` підключене до окремої спільної сторінки каталогу вакансій, а не до вкладки кабінету.
- Поточний підхід із вкладками кабінету та query-параметром `tab` лишається достатнім для MVP: він не вимагає розбивати кабінет на окремі nested routes.
- Меню кабінету зберігає стан, який задав користувач. Автоматична дія обмежена тільки одноразовим згортанням для HR-вкладки управління вакансіями.
- Поля зарплати у формі вакансії та студентських фільтрах мають однакове frontend-обмеження `0..9_999_999`, без дробових і від'ємних значень; backend-правила варто винести в окрему валідаційну задачу.
- Студентський кабінет знову має внутрішню вкладку заявок/відгуків як placeholder, а каталог вакансій винесено за межі кабінету.
- Фільтри каталогу винесено в бічну панель: великі категорії мають пошук, плашки обраних значень і список зі скролом; професії та компанії підтримують multi-select, мови додаються парами `мова-рівень`.
- Перегляд вакансії винесено у спільний `VacancyPublicPreview`: HR preview і студентський перегляд використовують один компонент, а студентська дія `Відгукнутися` приклеєна в правій колонці.
