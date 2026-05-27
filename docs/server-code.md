# Server Code Documentation

## `server/src`

Backend - Express API. Основний потік: route → controller → service → repository → Prisma → response DTO.

### Поточна структура

- `config/` - інфраструктура доступу до БД.
- `controllers/` - тонкий HTTP layer для route params/body/query і виклику services.
- `errors/` - `BusinessLogicError` та HTTP status constants.
- `repositories/` - Prisma persistence layer, include/select конфігурації, transaction helpers.
- `routes/` - Express routers для API endpoints.
- `scripts/` - ручні/службові скрипти для Elasticsearch індексів і reindex.
- `search/` - Elasticsearch client та vacancy index mapping/query helpers.
- `services/` - бізнес-логіка, matching, eligibility, outbox, search і синхронізація Clerk.
- `utils/` - чисті утиліти, зараз email validation.

### `index.ts`

- Призначення: bootstrap Express server.
- Middleware: `cors`, `express.json`, `clerkMiddleware`.
- Routes: монтує `/api/users`, `/api/students`, `/api/companies`, `/api/hr-profiles`, `/api/catalogs`, `/api/vacancies`, `/api/applications`.
- Error handling: обробляє `BusinessLogicError`, Prisma `P2002/P2025`, fallback 500.
- Побічні ефекти: запускає HTTP server.
- Summary: центральна точка запуску backend.

## `server/src/config`

### `db.ts`

#### `prisma`

- Призначення: singleton Prisma client.
- Params: використовує env/database adapter.
- Повертає: `PrismaClient`.
- Побічні ефекти: відкриває доступ до БД.
- Summary: інфраструктурний database layer.

## `server/src/errors`

### `BusinessLogicError.ts`

#### `BusinessLogicError`

- Призначення: контрольована бізнес/API помилка.
- Constructor: `constructor(message: string, statusCode: number, code: string, details?: unknown)`.
- Поля: `statusCode`, `code`, `details`.
- Викликається: services/controllers при validation/auth/access errors.
- Summary: основа нормалізованих error responses.

## `server/src/routes`

### `authRoutes.ts`

- Endpoints: `POST /webhooks/clerk`, `POST /onboarding`, `GET /my-cabinet/auth`, `PATCH /my-cabinet/email`, `GET /:userId/public-info`, `PATCH /:userId/status`.
- Controllers: `UserController`.
- Summary: користувачі, onboarding, Clerk webhook/auth snapshot.

### `studentProfileRoutes.ts`

- Endpoints: profile/search preferences, resume education/languages/courses/projects/experiences CRUD.
- Controllers: `StudentProfileController`.
- Summary: API кабінету студента.

### `companyRoutes.ts`

- Endpoints: `GET /`, `GET /my-cabinet`, `PATCH /my-cabinet`, `GET /my-cabinet/hr-profiles`.
- Controllers: `CompanyController`.
- Summary: пошук компаній, профіль компанії HR, команда рекрутерів.

### `hrProfileRoutes.ts`

- Endpoints: `GET /my-cabinet`, `PATCH /my-cabinet`.
- Controllers: `HrProfileController`.
- Summary: профіль рекрутера.

### `catalogRoutes.ts`

- Endpoints: student-cabinet catalogs, skills, universities, professions, spheres, countries, regions, cities.
- Controllers: `CatalogController`.
- Summary: довідники.

### `vacancyRoutes.ts`

- Endpoints: `GET /catalogs`, `GET /student`, `GET /student/:vacancyId`, `GET/POST /my-cabinet`, `GET/PATCH /my-cabinet/:vacancyId`, `PATCH /my-cabinet/:vacancyId/status`, `POST /my-cabinet/:vacancyId/archive`.
- Controllers: `VacancyController`.
- Summary: HR vacancy lifecycle.

## `server/src/controllers`

### `VacancyController.ts`

#### `getVacancyCatalogs(req, res, next)`

- Призначення: довідники форми вакансії.
- Params: Clerk HR actor from request.
- Повертає: `{ success: true, data }`.
- Викликає: `vacancyService.getVacancyCatalogs`.

#### `listMyVacancies(req, res, next)`

- Призначення: paginated таблиця вакансій компанії HR.
- Params: Clerk user id, `req.query`.
- Викликає: `vacancyService.listMyVacancies`.

#### `getMyVacancy(req, res, next)`

- Призначення: одна вакансія за id у межах компанії HR.
- Params: `vacancyId`.
- Викликає: `vacancyService.getMyVacancy`.

#### `createVacancy(req, res, next)`

- Призначення: створити вакансію.
- Params: body `VacancyUpsertRequest`.
- Викликає: `vacancyService.createVacancy`.

#### `updateVacancy(req, res, next)`

- Призначення: оновити вакансію.
- Params: `vacancyId`, body.
- Викликає: `vacancyService.updateVacancy`.

#### `changeVacancyStatus(req, res, next)`

- Призначення: змінити статус вакансії.
- Params: `vacancyId`, `body.status`.
- Викликає: `vacancyService.changeVacancyStatus`.

#### `archiveVacancy(req, res, next)`

- Призначення: архівувати вакансію.
- Params: `vacancyId`.
- Викликає: `vacancyService.archiveVacancy`.

- File summary: тонкий HTTP layer для vacancy API.

### `CompanyController.ts`

- `searchCompanies(req, res, next)` - читає `q`, викликає `companyService.searchCompanies`.
- `getMyCompany(req, res, next)` - повертає компанію поточного HR.
- `getMyCompanyHrs(req, res, next)` - повертає рекрутерів компанії.
- `updateMyCompany(req, res, next)` - оновлює public profile компанії.
- File summary: HTTP layer для company API.

### `HrProfileController.ts`

- `getMyHrProfile(req, res, next)` - повертає HR profile.
- `updateMyHrProfile(req, res, next)` - оновлює identity/position/links HR.
- File summary: HTTP layer для recruiter profile.

### `UserController.ts`

- `completeOnboarding(req, res, next)` - завершує onboarding для ролі.
- `handleClerkWebhook(req, res, next)` - синхронізує Clerk events.
- `getMyAuthSnapshot(req, res, next)` - повертає auth/user snapshot.
- `updateUserStatus(req, res, next)` - змінює статус користувача.
- `getPublicUserInfo(req, res, next)` - public user info за id.
- `updateMyEmail(req, res, next)` - змінює email поточного користувача.
- File summary: user/auth HTTP layer.

### `StudentProfileController.ts`

- Methods: `getMyStudentProfile`, `updateStudentPersonalInfo`, `updateStudentSearchPreferences`, `getStudentSearchPreferences`, CRUD для education/languages/courses/projects/experiences.
- Призначення: приймає route params/body і делегує в `StudentProfileService`.
- File summary: HTTP layer студентського резюме.

### `CatalogController.ts`

- Methods: `getStudentCabinetCatalogs`, `searchSkills`, `searchUniversities`, `searchProfessions`, `searchSpheres`, `searchCountries`, `searchRegions`, `searchCities`.
- Призначення: пошук і читання довідників.
- File summary: HTTP layer каталогу.

## `server/src/services`

### `VacancyService.ts`

#### `VacancyService`

- Призначення: бізнес-логіка вакансій.
- Constructor: repositories `VacancyRepository`, `HrProfileRepository`, `CompanyRepository`, `CatalogRepository`, `SkillRepository`.
- Public methods:
  - `getVacancyCatalogs(clerkUserId: string)` - перевіряє HR, повертає довідники й офісні локації компанії.
  - `listMyVacancies(clerkUserId: string, query: VacancyListRequest = {})` - архівує прострочені активні вакансії, нормалізує query, повертає paginated list.
  - `getMyVacancy(clerkUserId: string, vacancyId: string)` - перевіряє company ownership і повертає DTO.
  - `createVacancy(clerkUserId: string, body: VacancyUpsertRequest)` - валідує body, створює vacancy і M:N зв'язки в транзакції.
  - `updateVacancy(clerkUserId: string, vacancyId: string, body: VacancyUpsertRequest)` - перевіряє ownership, оновлює base fields і повністю синхронізує M:N.
  - `changeVacancyStatus(clerkUserId: string, vacancyId: string, status: ListingStatus)` - перевіряє статус і право доступу, оновлює статус.
  - `archiveVacancy(clerkUserId: string, vacancyId: string)` - wrapper для статусу `ARCHIVED`.
- Private methods: `archiveExpiredVacancies`, `normalizeListQuery`, `clampPositiveInt`, `validateVacancyBody`, `mapBaseCreateData`, `mapBaseUpdateData`, `replaceRelations`, `getHrProfileOrThrow`, `getOwnedVacancyOrThrow`, `ensureCompanyLocations`, `ensureSkillsExist`, `groupSkillsByCategory`, `mapVacancy`, `getEffectiveStatus`, enum/required validators, `todayDateOnly`.
- Побічні ефекти: database writes, transactions, auto-archive expired vacancies.
- Summary: ядро vacancy lifecycle.

### `CompanyService.ts`

#### `CompanyService`

- Public methods:
  - `getMyCompany(clerkUserId: string)` - компанія поточного HR.
  - `searchCompanies(query?: string)` - пошук компаній для onboarding.
  - `getPublicCompany(companyId: string)` - публічна сторінка компанії з HR-командою та активними/призупиненими вакансіями.
  - `getMyCompanyHrs(clerkUserId: string)` - HR profiles компанії.
  - `updateMyCompany(clerkUserId: string, body: UpdateCompanyRequest)` - оновлює public profile, spheres, locations, links у транзакції.
- Private methods: `getHrProfileOrThrow`, `getCompanyForHrOrThrow`, `ensureHrCanManageCompany`, `mapLinks`, `uniqueNumbers`, `requiredString`, `requiredNumber`, `requiredEnum`.
- Побічні ефекти: database writes.
- Summary: бізнес-логіка профілю компанії.

### `HrProfileService.ts`

#### `HrProfileService`

- Public methods:
  - `completeHrOnboarding(clerkUserId, body)` - створює або прив'язує компанію, оновлює user, створює HR profile.
  - `getMyHrProfile(clerkUserId)` - повертає профіль HR.
  - `updateMyHrProfile(clerkUserId, body)` - оновлює identity, position, links.
- Private methods: `getHrProfileOrThrow`, `mapCompanyCreateData`, `mapLinks`, validators, `syncClerkPublicMetadataBestEffort`.
- Побічні ефекти: database transaction, Clerk metadata best-effort update, console info/error.
- Summary: onboarding і редагування recruiter profile.

### `UserService.ts`

#### `UserService`

- Призначення: user onboarding/auth snapshot/status/email/public info.
- Public methods: complete onboarding dispatch, Clerk webhook sync, auth snapshot, status update, public info, email update.
- Викликає: `UserRepository`, `StudentProfileService`, `HrProfileService`, `ClerkUserSyncService`, validators.
- Побічні ефекти: database writes, Clerk sync.
- Summary: orchestration для користувачів і ролей.

### `StudentProfileService.ts`

#### `StudentProfileService`

- Призначення: профіль студента, search preferences, resume CRUD.
- Public methods: get/update profile/preferences, create/update/delete education, language, courses, projects, experiences.
- Викликає: `StudentProfileRepository`, catalog/skill validation, transaction manager.
- Побічні ефекти: database writes.
- Summary: бізнес-логіка студентського кабінету.

### `CatalogService.ts`

#### `CatalogService`

- Public methods: отримання довідників для студентського кабінету та пошук skills/universities/professions/spheres/locations.
- Викликає: `CatalogRepository`, `SkillRepository`.
- Summary: read-only catalog business layer.

### `ClerkUserSyncService.ts`

#### `ClerkUserSyncService`

- Public methods: синхронізація/оновлення Clerk public metadata.
- Побічні ефекти: external Clerk API calls.
- Summary: integration layer для Clerk.

### `VacancyMatchingService.ts`

- `normalizeVacancyRequirements(vacancy: VacancyForMatching)` - формує normalized requirements для обчислення відповідності вакансії.
- `requirementWeightScore` - scoring map для `RequirementWeight`.
- Summary: підготовка вакансії до matching, поки без повного matching pipeline.

## `server/src/repositories`

### `VacancyRepository.ts`

#### `VacancyRepository`

- Constructor: `constructor(private readonly db: DbClient = prisma)`.
- Methods:
  - `createVacancy(data: VacancyCreateData)` - створює base vacancy.
  - `updateVacancy(vacancyId, data)` - оновлює base fields.
  - `findVacancyById(vacancyId)` - full include by id.
  - `findCompanyVacancy(vacancyId, companyId)` - ownership-aware lookup.
  - `listCompanyVacancies(companyId, params)` - pagination/filter/sort.
  - `listPublicCompanyVacancies(companyId)` - активні та призупинені вакансії для публічної сторінки компанії.
  - `updateVacancyStatus(vacancyId, status)` - status/publishedAt update.
  - `archiveExpiredActiveVacancies(companyId, today)` - bulk archive.
  - `replaceSpheres`, `replaceEmploymentTypes`, `replaceWorkSchedules`, `replaceWorkFormats`, `replaceLocations`, `replaceSkills`, `replaceLanguages` - повна заміна M:N зв'язків.
- Побічні ефекти: Prisma reads/writes.
- Summary: persistence layer для вакансій.

### `CompanyRepository.ts`

#### `CompanyRepository`

- Methods: `createCompany`, `findCompanyById`, `findCompanyByHrClerkId`, `searchCompanies`, `listCompanyHrs`, `updateCompany`, `replaceCompanySpheres`, `upsertLocation`, `replaceCompanyLocations`, `replaceLinks`.
- Побічні ефекти: Prisma reads/writes.
- Summary: persistence layer компаній, локацій і links.

### `HrProfileRepository.ts`

#### `HrProfileRepository`

- Methods: `createHrProfile`, `findByClerkUserId`, `updateHrProfile`, `replaceLinks`.
- Summary: persistence layer HR profile.

### `UserRepository.ts`

#### `UserRepository`

- Methods: створення/пошук user, update identity, role, status, email, public info.
- Summary: persistence layer користувачів.

### `StudentProfileRepository.ts`

#### `StudentProfileRepository`

- Methods: отримання/оновлення student profile/search preferences, CRUD resume records, M:N skills/links/languages/locations.
- Summary: persistence layer студентського профілю.

### `CatalogRepository.ts`

#### `CatalogRepository`

- Methods: list/search languages, employment types, work schedules, work formats, universities, professions, spheres, countries, regions, cities.
- Summary: read-only persistence layer довідників.

### `SkillRepository.ts`

#### `SkillRepository`

- Methods: `searchSkills`, `countExistingSkills`.
- Summary: read-only/validation layer навичок.

### `TransactionManager.ts`

#### `TransactionManager`

- `run<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>` - wrapper над Prisma transaction.
- Summary: спільна транзакційна утиліта.

### `repositoryTypes.ts`

- Призначення: тип `DbClient` для repository constructors.
- Summary: дозволяє repository працювати і з Prisma client, і з transaction client.

## `server/src/utils`

### `EmailValidator.ts`

#### `EmailValidator`

- `normalizeEmail(email: string): string` - trim/lowercase.
- `isValidEmail(email: string): boolean` - формат email.
- `getDomain(email: string): string | null` - домен email.
- `isValidRecruiterDomain(email, corporateDomain?)` - перевіряє відповідність домену рекрутера компанії.
- Summary: чистий validation helper.

## Folder Summary

`server/src` має правильний для MVP поділ на routes/controllers/services/repositories. Найближчий борг - винести повторні validators/auth helpers у shared utilities, додати public endpoints для компанії/рекрутера/вакансій, коли preview стане публічним продуктово.

## Студентський Каталог Вакансій

### `server/src/routes/vacancyRoutes.ts`

- `GET /api/vacancies/search` повертає список активних вакансій із пошуком, фільтрами, сортуванням і пагінацією.
- `GET /api/vacancies/student/filter-options` повертає додаткові значення фільтрів студентського каталогу.
- `GET /api/vacancies/student/:vacancyId` повертає одну видиму вакансію для перегляду.
- `/api/vacancies/my-cabinet*` обслуговують керування вакансіями роботодавця.

### `server/src/controllers/VacancyController.ts`

#### `searchVacancies(req, res, next)`

- Призначення: приймає query каталогу вакансій для студента.
- Params: `page`, `pageSize`, `search`, `professionIds`, `companyIds`, `sphereIds`, `countryIds`, `regionIds`, `cityIds`, `locationIds`, `workFormatIds`, `employmentTypeIds`, `workScheduleIds`, пари `languageId` + `minLanguageLevel`, `minSalary`, `sortBy`, `sortDirection`, `mode`.
- Повертає: `items`, `page`, `pageSize`, `totalItems`, `totalPages`.
- Викликає: `vacancySearchService.searchVacancies`.

#### `getStudentVacancy(req, res, next)`

- Призначення: повертає одну активну вакансію для студентського перегляду.
- Params: `vacancyId`.
- Повертає: `{ vacancy, matchScore: null, matchExplanation: null }`.
- Викликає: `vacancySearchService.getActiveVacancy`.

### `server/src/services/VacancySearchService.ts`

#### `VacancySearchService`

- Призначення: окремий search layer для студентського каталогу.
- Методи:
  - `searchVacancies(query: VacancySearchRequest = {}, clerkUserId?: string | null)` - regular/personalized search, фільтри, сортування, пагінація.
  - `getActiveVacancy(vacancyId: string)` - повертає публічно видиму вакансію: активну з актуальним дедлайном або призупинену.
  - `getIndexMappingDraft()` - описує денормалізовані fields документа індексу вакансій.
- Elasticsearch flow: якщо `ELASTICSEARCH_ENABLED=true` і вузол доступний, сервіс виконує text search та strict filters в індексі `${ELASTICSEARCH_INDEX_PREFIX}_vacancies`, після чого завантажує публічні записи вакансій через Prisma.
- Fallback: якщо Elasticsearch вимкнений, недоступний або повертає помилку, сервіс виконує пошук через `VacancyRepository`, а PostgreSQL лишається source of truth.
- Personalized mode: бере з профілю студента бажані професії, формати, типи зайнятості, графіки, локації і мінімальну зарплату.
- Placeholder: `matchScore` і `matchExplanation` повертаються як `null`; frontend їх не показує.
- Search parser: звичайні слова є soft OR terms, терми з префіксом `*` є required terms, а `+` використовується тільки як роздільник.
- Поля індексу: `id`, `title`, `description`, `status`, `closingDate`, `createdAt`, `updatedAt`, `professionId`, `professionName`, `companyId`, `companyName`, `sphereIds`, `sphereNames`, `workFormats`, `employmentTypes`, `workSchedules`, `languageRequirements`, `skillNames`, `criticalSkillNames`, `importantSkillNames`, `plusSkillNames`, `salaryFrom`, `salaryTo`, `locationIds`, `countryIds`, `regionIds`, `cityIds`.

### `server/src/repositories/VacancyRepository.ts`

- `listPublicActiveVacancies(params)` виконує Prisma fallback пошуку активних актуальних вакансій.
- `listPublicCompanyVacancies(companyId)` повертає `ACTIVE` і `PAUSED` вакансії для сторінки компанії.
- `findPublicVisibleVacancyById(vacancyId, today)` повертає вакансію для публічного перегляду.
- Бізнес-обмеження студентського каталогу на repository/service рівні: search list повертає `status = ACTIVE` і `closingDate >= today`; detail view також відкриває `PAUSED`, якщо користувач прийшов зі сторінки компанії.
## Пошук Вакансій

### `server/src/services/VacancySearchService.ts`

- Пошук активних вакансій підтримує `professionIds` як список професій поряд зі старим одиничним `professionId`.
- Personalized mode для студентів формує список професій з `desiredProfessions`.
- Summary: backend готовий до multi-select професій у спільному каталозі `/vacancies`.

### `server/src/repositories/VacancyRepository.ts`

- `PublicVacancyListParams` доповнено `professionIds?: number[]`.
- `PublicVacancyListParams` також підтримує `companyIds?: string[]`.
- `PublicVacancyListParams` також підтримує `countryIds?: number[]`, `regionIds?: number[]` і `cityIds?: number[]` для фільтра локацій у публічному каталозі.
- `buildPublicVacancyWhere(params)` фільтрує `professionId: { in: professionIds }`, `companyId: { in: companyIds }`, а також вакансії за країнами, областями або містами через OR; одиничний `professionId` лишився fallback для сумісності.
- Логіка локацій ієрархічна тільки зверху вниз: країна матчить усі локації країни, область матчить область і її міста, місто матчить тільки конкретне місто. Місто кандидата не матчить вакансію, де роботодавець вказав лише область.
- `listPublicActiveVacancyCompanies(today)` повертає компанії, які мають активні вакансії з актуальним дедлайном, для UI-фільтра.
- Summary: студентський/публічний каталог може фільтрувати вакансії за кількома професіями та компаніями без зміни існуючих HR endpoint-ів.

## Application Flow Foundation

### Routes Та Controller

- `POST /api/applications/check-eligibility` - приймає `{ vacancyId }`, вимагає student actor і повертає eligibility response разом із `matchPreview`.
- `POST /api/applications` - створює відгук поточного студента; при блокуванні повертає `400 APPLICATION_NOT_ELIGIBLE` з eligibility у `error.details`.
- `GET /api/applications/my` - повертає тільки applications поточного студента.
- `GET /api/vacancies/:id/applications` - повертає відгуки тільки HR з компанії-власника вакансії.
- `GET /api/applications/:id/resume` - повертає HR компанії-власника повне резюме кандидата; контактні поля та links включаються лише відповідно до visibility policy.
- `PATCH /api/applications/:id/status` - виконує role/ownership-aware перехід статусу.
- `ApplicationController.ts` - тонкий HTTP layer: читає Clerk actor/route params, викликає `ApplicationService`, нормалізує HTTP status.

### `ApplicationService.ts`

- `checkEligibility(clerkUserId, vacancyId)` - знаходить студентський профіль і делегує blocking rules в `EligibilityService`.
- `createApplication(clerkUserId, body)` - після успішної перевірки рахує matching, створює `Application(status=SENT, matchScore=totalScore, matchDetails=result)`, initial `ApplicationStatusHistory` та `Application CREATED` outbox event в одній Prisma transaction.
- `listMyApplications(clerkUserId)` - ізолює студентський список відгуків і перед видачею актуалізує score snapshots.
- `listVacancyApplications(clerkUserId, vacancyId)` - перевіряє належність вакансії компанії поточного HR, актуалізує snapshots і при першому відкритті переводить `SENT -> VIEWED` з history/outbox event; потім повертає список для сортування/аналізу.
- `changeStatus(clerkUserId, applicationId, status)` - студенту дозволяє `WITHDRAWN` власного нетермінального відгуку, а після відкликання - повернення лише до статусу безпосередньо перед `WITHDRAWN`; HR дозволяє лише просування вперед у pipeline або `REJECTED` для application вакансії, створеної саме ним. При `HIRED` в одній transaction закриває вакансію з `closeReason=HIRED`.
- `getApplicationResume(clerkUserId, applicationId)` - перевіряє, що HR належить компанії вакансії; `PUBLIC` відкриває контакти після відгуку, `APPLIED_ONLY` тільки після наявності `OFFERED`/`HIRED` у history, а до цього приватні контакти й links вирізаються на сервері.

### `EligibilityService.ts`

- `checkCanApply(studentProfileId, vacancyId)` повертає `{ canApply, blockingReasons, missingBlockingRequirements, matchedCriticalSkills, missingCriticalSkills, matchedImportantSkills, missingImportantSkills, matchedPlusSkills, missingPlusSkills, missingLanguages, locationMismatch, profileWarnings, matchPreview }`.
- Blocking codes: `VACANCY_NOT_ACTIVE`, `VACANCY_EXPIRED`, `APPLICATION_ALREADY_EXISTS`, `PROFILE_HIDDEN`, `MISSING_CRITICAL_SKILLS`, `MISSING_REQUIRED_CONDITIONS`, `MISSING_REQUIRED_LANGUAGES`, `LOCATION_MISMATCH`.
- Для вимог вакансії сервіс не обчислює правила повторно: `canApply` читає ті самі `requirementItems`, де `isBlocking=true` і `matched=false`, що зберігаються у matching snapshot.
- Warning codes: `PROFILE_ABOUT_EMPTY`, `PROFILE_LINKS_EMPTY`; вони не забороняють подання.
- Skills студента беруться з наявних relations `experiences.skills`, `projects.skills`, `courses.skills`; нових schema fields не додано.

### `MatchingScoreService.ts`

- `calculateApplicationMatch(vacancyId, studentProfileId)` завантажує vacancy requirements і студентські desired settings/resume evidence із PostgreSQL/Prisma.
- `baseRequirementsPercent` рахується за weighted requirement items: `CRITICAL=3`, `IMPORTANT=2`, `NICE_TO_HAVE=1`; у details зберігаються загальна кількість вимог, кількість збігів і окремий coverage фактичних blocking-вимог.
- Кожний `requirementItem` містить `key`, `label`, `category`, `weight`, `matched`, `isBlocking`, `blockingReason` і `details`. Критичні вимоги поділено на critical skills та mandatory vacancy conditions: profession, language requirements, задані employment type/schedule/work format і salary; локація належить до умов вакансії та є blocking лише при `isLocationCritical=true`.
- Необов'язкова location лишається пунктом покриття/додаткового бала, але не eligibility-блокером. Якщо `student.minSalary=null`, salary requirement вважається matched, бо кандидат не задав нижню межу очікувань. Для grouped-параметрів і profession у `details` зберігаються required/student values, щоб UI міг показати інформацію кандидата.
- `skillDepthScore` рахує підтвердження skills лише з вимог вакансії: course `2/4`, project `6/8`, experience `max(1, fullMonths*2)`; сума джерел множиться на вагу skill.
- `additionalCriteriaScore` складається з bonus за відповідні мови, необов'язковий location match, найвищу освіту/диплом та активний пошук; у UI ця складова називається `Додаткові бали`. Критична локація є умовою допуску і не додає балів.
- `score` дорівнює `totalScore = skillDepthScore + additionalCriteriaScore`; пояснення повертає deterministic codes для frontend-локалізації, matched/missing groups і `requirementEligibility.matchesBlockingRequirements`.

### `ApplicationMatchRefreshService.ts`

- `recalculateForStudent(studentProfileId)` оновлює `matchScore`/`matchDetails` applications після змін резюме або параметрів пошуку студента.
- `recalculateForVacancy(vacancyId)` оновлює snapshots після редагування вимог вакансії та перед HR-переглядом.
- Snapshot не видаляє application: якщо після зміни blocking-вимог кандидат більше не проходить допуск, `requirementEligibility.matchesBlockingRequirements=false` дозволяє UI показати його неактивним і сортувати нижче.

### Repositories Та Outbox

- `ApplicationRepository.ts` інкапсулює CRUD applications, status history, public-safe student projection, оновлення matching snapshot, одноразовий conditional `SENT -> VIEWED`, student/HR списки й перевірку іншого `HIRED`.
- `StudentProfileRepository.findForApplicationMatchById()` читає education, languages, desired preferences, locations та evidence skills для matching.
- `VacancyRepository.closeVacancyAsHired()` фіксує `CLOSED`, `closedAt`, `closeReason=HIRED`.
- `OutboxEventRepository.ts` працює з реальною моделлю `OutboxEvent` без schema changes.
- `OutboxEventService.ts` додає мінімальні payload events: `Application CREATED`, `Application UPDATED`, `Vacancy UPDATED` при закритті через найм.
- `SearchOutboxWorker.ts` є worker skeleton: читає `PENDING` у порядку `createdAt`, синхронізує відомі `Vacancy` documents лише якщо Elasticsearch увімкнено, позначає `PROCESSED`/`FAILED`; application index у MVP не створюється.

### Response Shape Applications

- `GET /api/applications/my` повертає application id/status/dates, `matchScore`, `matchDetails`, vacancy з company і `statusHistory` з доступним публічним автором переходу.
- `GET /api/vacancies/:id/applications` повертає ті самі score/history поля, а також публічні дані кандидата (`firstName`, `lastName`, `middleName`, `photoUrl`, короткі поля profile); приватні контакти не включаються.
