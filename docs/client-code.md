# Client Code Documentation

## `client/src`

Frontend - React SPA. Основний потік даних: route/page component → `apiRequest` → backend API → локальний state → Mantine/UI components.

### `App.tsx`

#### `App()`

- Призначення: кореневий React-компонент, який підключає `RouterProvider`.
- Props/params: не приймає.
- Повертає: JSX з router.
- Викликає: `router` з `router.tsx`.
- Побічні ефекти: немає.
- Summary: мінімальний entry-компонент SPA.

### `main.tsx`

Файл ініціалізує React, Mantine provider, Clerk provider і монтує `App` у DOM.

- Основні функції: немає експортованих; виконує bootstrap.
- Приймає: DOM root `#root` через browser API.
- Повертає: нічого.
- Викликає: `createRoot(...).render(...)`.
- Побічні ефекти: монтує застосунок.
- Summary: точка входу frontend.

### `router.tsx`

#### `router`

- Призначення: декларація реальних frontend routes.
- Тип: `createBrowserRouter([...])`.
- Routes: `/`, `/start`, `/sign-up`, `/sign-in`, `/onboarding`, `/auth/redirect`, `/student`, `/hr`, `/admin`.
- Викликає: `RootLayout`, `ProtectedRoute`, page-компоненти.
- Побічні ефекти: немає.
- Summary: централізує route tree; HR tabs залишаються query/state-based, не nested routes.

## `client/src/api`

### `apiClient.ts`

#### `ApiError`

- Призначення: нормалізована помилка HTTP/API для UI.
- Constructor signature: `constructor(message: string, status: number, code?: string, details?: unknown)`.
- Поля: `status`, `code`, `details`.
- Повертає: instance `Error`.
- Summary: дає сторінкам єдиний формат помилок.

#### `apiRequest<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T>`

- Призначення: виконує HTTP-запит до backend.
- Params: `path` відносно `API_URL`; `token` Clerk bearer; `options` fetch options.
- Повертає: `payload.data as T`.
- Викликає: browser `fetch`.
- Побічні ефекти: network request; кидає `ApiError` при network/API помилці.
- Summary: єдиний низькорівневий API-клієнт; domain-specific methods поки не винесені.

## `client/src/components`

### `ProtectedRoute.tsx`

#### `ProtectedRoute({ allowedRoles }: ProtectedRouteProps)`

- Призначення: захищає route через Clerk auth і role metadata.
- Props: `allowedRoles?: string[]`.
- Повертає: loader, redirect або `Outlet`.
- Викликає: Clerk hooks, React Router navigation helpers.
- Побічні ефекти: redirects.
- Summary: gatekeeper для `/student`, `/hr`, `/admin`, `/onboarding`.

### `Header.tsx`

#### `Header()`

- Призначення: верхня навігація root layout.
- Props: не приймає.
- Повертає: header JSX.
- Викликає: Clerk auth UI/navigation.
- Summary: спільний header публічної оболонки.

## `client/src/components/auth`

### `AuthShell.tsx`

#### `AuthShell({ title, subtitle, note, tone = "info", children }: AuthShellProps)`

- Призначення: стилізована оболонка сторінок входу/реєстрації.
- Props: заголовок, підзаголовок, optional note/tone, children.
- Повертає: JSX shell.
- Побічні ефекти: немає.
- Summary: прибирає дублювання auth layout.

## `client/src/components/common`

### `AppLoader.tsx`

#### `AppLoader({ text = "Завантажуємо дані..." })`

- Призначення: стандартний loading state.
- Props: `text?: string`.
- Повертає: loader UI.
- Summary: використовується під час завантаження кабінетів.

### `AppTooltip.tsx`

#### `AppTooltip({ label, children }: AppTooltipProps)`

- Призначення: єдиний tooltip поверх Mantine `Tooltip`.
- Props: `label: string`, `children: ReactNode`.
- Повертає: tooltip wrapper.
- Побічні ефекти: hover/focus UI.
- Summary: у таблиці вакансій отримує повний `vacancy.title`.

### `ChipBadge.tsx`

#### `ChipBadge({ children, tone = "primary", onClick, onRemove })`

- Призначення: reusable chip/badge для skills, languages, сфер, умов.
- Props: content, tone, optional click/remove handlers.
- Повертає: badge/button UI.
- Побічні ефекти: викликає handlers.
- Summary: компактне представлення тегів.

### `ErrorBanner.tsx`

#### `ErrorBanner({ title = "Не вдалося виконати дію", message })`

- Призначення: показує помилки сторінки.
- Props: title, message.
- Повертає: error UI або `null`.
- Summary: централізований error banner.

### `FormSection.tsx`

#### `FormSection({ title, description, children })`

- Призначення: секція форм/кабінету на `Paper`.
- Props: `title`, optional `description`, `children`.
- Повертає: section card.
- Summary: основний структурний блок HR/Student форм.

### `NoticeBanner.tsx`

#### `NoticeBanner({ message, tone = "info" })`

- Призначення: інформаційне або warning повідомлення.
- Props: message, tone.
- Повертає: notice UI.
- Summary: використовується для пояснювальних станів.

### `RichTextEditor.tsx`

#### `RichTextEditor({ label, value, onChange, maxLength, placeholder })`

- Призначення: rich text editor на TipTap для описів.
- Props: label, html value, onChange callback, optional maxLength/placeholder.
- Повертає: editor UI з toolbar.
- Методи/функції: `TiptapToolbar`, `ToolbarButton`, `ToolbarDivider`, SVG icons.
- Викликає: TipTap editor commands.
- Побічні ефекти: оновлює HTML через `onChange`.
- Summary: використовується для опису вакансії, компанії, резюме.

### `StatusBadge.tsx`

#### `StatusBadge({ status = "PENDING_VERIFICATION" })`

- Призначення: показує статус користувача/модерації.
- Props: status.
- Повертає: badge.
- Summary: спільне відображення статусів.

## `client/src/components/hr`

### `RecruiterPublicCard.tsx`

#### `RecruiterPublicCard({ data, onClick })`

- Призначення: компактна картка рекрутера, яка відкриває preview.
- Props: `data: { fullName; position?; photoUrl? }`, `onClick`.
- Повертає: button з avatar, ПІБ, посадою.
- Побічні ефекти: викликає `onClick`.
- Summary: використовується у профілі рекрутера, профілі/preview компанії, preview вакансії.

### `RecruiterPublicPreviewDrawer.tsx`

#### `RecruiterPublicPreviewDrawer({ opened, data, title, labels, onClose, onCompanyOpen })`

- Призначення: єдиний стандартний drawer preview рекрутера.
- Props: `opened`, `data: RecruiterPublicPreviewData | null`, title, labels, close handler, optional company open handler.
- Повертає: Mantine `Drawer` з avatar, progress, компанією, посадою, email, контактами, датою створення, лічильниками вакансій.
- Helper methods: `InfoRow`, `ContactCopyRow`, `getRecruiterProgress`, `CopyIcon`.
- Побічні ефекти: копіювання контакту в clipboard.
- Summary: єдине джерело UI для recruiter preview.

## `client/src/components/resume`

### `ResumePreview.tsx`

#### `ResumePreview({ profile }: ResumePreviewProps)`

- Призначення: preview резюме студента.
- Props: `profile` з user, personalInfo, preferences, education, languages, courses, projects, experiences, links.
- Повертає: resume UI з секціями досвіду, освіти, skills, контактів.
- Helper methods: `PreviewSection`, `ResumeCard`, `CardList`, `SkillCloud`, `GroupedSkillCloud`, `LinkList`, `QuickContactList`, `InfoLine`, `ContactLine`, format/sort helpers.
- Побічні ефекти: copy to clipboard для контактів.
- Summary: незалежний preview-компонент резюме.

## `client/src/layouts`

### `RootLayout.tsx`

#### `RootLayout()`

- Призначення: загальна оболонка route tree.
- Props: не приймає.
- Повертає: header + `Outlet`.
- Summary: root layout для всіх сторінок.

### `CabinetLayout.tsx`

#### `CabinetLayout({ navItems, activeKey, onSelect, children, defaultCollapsed = false, autoCollapseKeys = [] })`

- Призначення: layout кабінету з лівою навігацією.
- Props: items, active key, select handler, children, collapsed default, optional keys for one-way auto-collapse.
- Повертає: sidebar + content.
- Побічні ефекти: локально змінює `isCollapsed`.
- Summary: використовується HR і Student кабінетами.

## `client/src/pages`

### `Home.tsx`, `Start.tsx`, `SignInPage.tsx`, `SignUpPage.tsx`, `AuthRedirect.tsx`, `Onboarding.tsx`

- Призначення: публічні та auth/onboarding сторінки.
- Основні виклики: Clerk auth, `apiRequest` для onboarding/auth snapshot.
- Повертають: route-level UI.
- Summary: підтримують старт користувача та вибір ролі.

## `client/src/pages/hr`

### `HrDashboard.tsx`

#### `HrDashboard()`

- Призначення: головний HR-кабінет: вакансії, створення/редагування вакансії, профіль рекрутера, профіль/preview компанії.
- State: active tab, selected/editing vacancy, HR profile, company, companyHrs, catalogs, vacancy table filters/pagination/sort, forms, saving/errors.
- UI behavior: ліве меню не відкривається примусово під час переходів між вкладками; при переході на вкладку вакансій воно може одноразово згорнутися через `autoCollapseKeys`.
- Routing: відкрита сторінка взаємодії з вакансією зберігається в query params `tab=vacancies&vacancyId=...&view=...`, тому reload повертає користувача до тієї самої вакансії та вкладки.
- Обмеження вводу: зарплата у формі вакансії обмежена `0..9_999_999`, без від'ємних і дробових значень, з `clampBehavior="strict"`.
- API calls: `GET /hr-profiles/my-cabinet`, `GET/PATCH /companies/my-cabinet`, `GET /companies/my-cabinet/hr-profiles`, `GET /vacancies/catalogs`, `GET/POST/PATCH /vacancies/my-cabinet`, `PATCH /vacancies/my-cabinet/:id/status`, `POST /vacancies/my-cabinet/:id/archive`.
- Methods:
  - `buildVacancyListPath(overrides): string` - формує query для server-side pagination/filter/sort.
  - `loadDashboard(): Promise<void>` - паралельно завантажує профіль, компанію, команду, довідники, вакансії; заповнює форми.
  - `loadVacancies(overrides): Promise<void>` - оновлює тільки таблицю вакансій.
  - `runBlock(block, action): Promise<void>` - керує saving/error для окремого блоку.
  - `saveHrProfile()` - валідує контакти HR і PATCH-ить профіль.
  - `saveCompanyProfile()` - валідує компанію і PATCH-ить public profile.
  - `startVacancyEdit(vacancy)` - переводить `VacancyRow` у форму.
  - `saveVacancy(status)` - POST/PATCH вакансії.
  - `changeVacancyStatus(vacancyId, status)` - змінює статус.
  - `archiveVacancy(vacancyId)` - архівує вакансію.
- Локальні компоненти: `VacancyBoard`, `VacancyManagementPage`, `VacancyPreview`, `CreateVacancyTab`, `HrProfileTab`, `CompanyProfileTab`, `CompanyPublicPage`, `CompanyVacancyFilters`, `VacancySkillGroups`, `LinkEditor`.
- Helper methods: `buildRecruiterPreviewFromProfile`, `buildRecruiterPreviewFromCompanyHr`, `buildRecruiterCardFromCompanyHr`, `buildRecruiterPreviewFromVacancy`, `vacancyToForm`, `vacancyFormToPayload`, `validateVacancyForm`, `validateLinks`, formatting/filter/sort/pagination helpers.
- Побічні ефекти: network requests, URL search params, clipboard copy, local UI state.
- Summary: найбільший frontend-модуль; для MVP робочий, але кандидат на подальше розбиття.

### `HrDashboard.module.scss`

- Призначення: стилі HR-кабінету.
- Важливі блоки: форми, profile/company preview, vacancy preview, таблиця.
- Поточна правка: таблиця повернена на `table-layout: auto`; колонку умов прибрано; перша колонка обмежена шириною і переносить довгі назви без tooltip; остання колонка дій не приховується; responsive rules приховують тільки необов'язкові колонки справа наліво.
- Summary: містить responsive rules і UI-стани HR dashboard.

## `client/src/pages/student`

### `StudentDashboard.tsx`

#### `StudentDashboard()`

- Призначення: кабінет студента: dashboard, персональні дані, preferences, resume sections.
- Routing: підтримує відкриття вкладки через `/student?tab=vacancies`; верхнє посилання `/vacancies` для ролі STUDENT веде саме сюди.
- UI behavior: меню кабінету не відкривається примусово при зміні вкладок; стан меню змінюється дією користувача.
- Обмеження вводу: мінімальна зарплата у фільтрах каталогу й у preferences обмежена `0..9_999_999`, без від'ємних і дробових значень.
- API calls: student profile, search preferences, resume CRUD endpoints, catalogs.
- Локальні компоненти: `DashboardTab`, `PersonalTab`, `SearchTab`, `ResumeTab`, section editors, `RecordList`, `LinkEditor`, `VisibilitySelector`.
- Побічні ефекти: network requests, form state, resume preview state.
- Summary: route-level студентський кабінет із локальними tab-компонентами.

## `client/src/pages/admin`

### `AdminDashboard.tsx`

#### `AdminDashboard()`

- Призначення: placeholder/початковий кабінет адміністратора.
- Props: не приймає.
- Повертає: admin UI.
- Summary: потребує розширення в окремих задачах.

## `client/src/locales`

### `localizedMessages.ts`

#### `messages`

- Призначення: експорт українських текстів.

#### `interpolate(template, values)`

- Призначення: замінює placeholders у текстах.
- Params: template, key-value values.
- Повертає: string.
- Summary: простий i18n helper.

### `uk.json`

- Призначення: українські UI-тексти.
- Summary: джерело labels/errors для сторінок.

## `client/src/utils`

### `formMasks.ts`

- `formatUkrainianPhone(value: string): string` - нормалізує телефон у формат України.
- `isValidUkrainianPhone(value: string): boolean` - перевіряє український номер.
- `isValidEmail(value: string): boolean` - перевіряє email.
- `sanitizeEmailInput(value: string): string` - прибирає недопустимі символи/пробіли email.
- `sanitizeNameInput(value: string): string` - чистить ПІБ.
- `sanitizePositionInput(value: string): string` - чистить назву посади.
- `sanitizeDomainInput(value: string): string` - чистить domain input.
- `sanitizeRegistrationNumber(value: string, registrationType: string): string` - чистить реєстраційний номер залежно від типу.
- Summary: чисті frontend validators/masks без побічних ефектів.

## Folder Summary

`client/src` має зрозумілий MVP-поділ на pages/components/layouts/api/utils. Основний борг - надмірно великі dashboard-файли і відсутність domain-specific API service wrappers, але це не блокує дипломний MVP.

## Оновлення: Студентський Каталог Вакансій

### `client/src/pages/student/StudentDashboard.tsx`

#### `VacancyCatalogTab`

- Призначення: вкладка “Вакансії” у кабінеті студента.
- Props: catalogs, result, selected vacancy, loading/error/notice, filters, setters, callbacks.
- Приймає фільтри: search, profession, spheres, work formats, employment types, schedules, language + minimum level, min salary, sortBy, sortDirection, pageSize.
- Викликає: `GET /vacancies/student`.
- Режими: `regular` і `personalized`.
- Побічні ефекти: network request через callbacks, зміна local state.

#### `VacancyCatalogCard`

- Призначення: компактна картка вакансії в каталозі.
- Props: `entry: VacancySearchEntry`, `onOpen`.
- Показує: назву, професію, компанію, logo/avatar, сфери/умови коротко, 3-5 основних skills, salary, closingDate, кнопку “Переглянути”.
- Не показує: повний опис, фейковий match score, фейкові відгуки.

#### `VacancyDetails`

- Призначення: студентський перегляд конкретної вакансії.
- Props: selected entry, notice, `onBack`, `onApply`.
- Викликає: `GET /vacancies/student/:vacancyId` через parent callback.
- Показує: назву, компанію, професію, сфери, HTML-опис, skills за категоріями, мови, умови роботи, зарплату, closingDate.
- Placeholder: кнопка “Відгукнутися” показує повідомлення “Модуль відгуків буде реалізовано пізніше.”

#### Search Types

- `StudentVacancy` - DTO активної вакансії для студента.
- `VacancySearchEntry` - `{ vacancy, matchScore, matchExplanation }`.
- `VacancySearchResponse` - paginated response з `items`, `page`, `pageSize`, `totalItems`, `totalPages`.
- `matchScore` не показується, коли дорівнює `null`.

### `client/src/pages/student/StudentDashboard.module.scss`

- Додано стилі каталогу: фільтри, картки, responsive grid, detail-view, empty/loading/error states.
- Фільтри перебудовуються в одну колонку на mobile.
- Картка стримана: інформація стисла, без перевантаження badge-плашками.

### `client/src/pages/hr/HrDashboard.module.scss`

- У таблиці управління вакансіями перша колонка зменшена та обмежена (`28%`, `max-width: 20rem`).
- Додано відступ між назвою вакансії і професією.
- Дедлайн повернуто як видиму колонку після “Оновлено” на звичайних ширинах.
- Службові колонки лишаються content-sized; перша й остання колонки не приховуються.
## `client/src/pages/vacancies`

### `VacanciesPage.tsx`

#### `VacanciesPage()`

- Призначення: окрема спільна сторінка `/vacancies` з верхньої навігації сайту.
- Props: не приймає.
- Повертає: каталог активних вакансій, бічну панель фільтрів, сортування, пагінацію та режим перегляду вакансії.
- API calls: `GET /catalogs/student-cabinet`, `GET /vacancies/student`, `GET /vacancies/student/:vacancyId`; для студента додатково `GET /students/my-cabinet`, щоб заповнити фільтри з профілю.
- Методи: `loadCatalogs()`, `buildPath(state, nextPage)`, `loadVacancies(state, nextPage)`, `openVacancy(vacancyId)`, `updateDraft(patch)`, `applyFilters(state)`, `clearFilters()`, `applyProfilePreset()`.
- Фільтри: великі категорії мають власний пошук, плашки обраних значень і обмежений список зі скролом; компанії завантажуються з активних вакансій; локації показуються деревом область → міста, де область і кожне місто можна обирати незалежно; мови додаються парами `мова-рівень`.
- Персональний підбір: тумблер одноразово заповнює професії, формати, типи зайнятості, графіки, мови та зарплату з профілю студента і запускає пошук; після ручного редагування наступний пошук стає regular.
- Картка: контейнер звужений, опис лишається обрізаним, локації показуються назвами міст/областей/країн у плашках, зарплата форматується з розрядами, замість deadline показується `Оновлено`.
- Відкриття вакансії: картка клікабельна повністю; кнопка `Переглянути` прибрана.
- Повернення з перегляду: кнопка `Повернутися` використовує browser history, тому зберігає контекст відкриття з каталогу або сторінки компанії.
- Пагінація: селект кількості елементів використовує Mantine `Select` зі спільною шириною для каталогу і вакансій компанії.
- Побічні ефекти: network requests, зміна local state, placeholder-повідомлення для майбутнього модуля відгуків.
- Summary: каталог більше не є вкладкою кабінету; сторінка спільна для ролей, а рольові кнопки відрізняються в UI.

#### `FilterGroup`

- Призначення: вертикальний список checkbox-фільтрів у бічній панелі без popover/dropdown overlay.
- Props: `title`, `values`, `options`, `onChange`.
- Повертає: `Checkbox.Group` з усіма варіантами в основному потоці панелі.
- Summary: замінює dropdown-фільтри на пошукові секції в прокручуваній бічній панелі.

#### `VacancySearchCard` usage

- Призначення: компактна картка вакансії в каталозі.
- Props: `entry`, catalogs, `onOpen`.
- Повертає: спільний компонент `components/vacancy/VacancySearchCard` з назвою, компанією, професією, коротким описом, локаціями, умовами, skills, датою оновлення та зарплатою.
- Побічні ефекти: по кліку відкриває перегляд вакансії через callback `onOpen`.
- Summary: не показує фейковий match score і не дублює повний перегляд.

#### `VacancyDetails`

- Призначення: перегляд конкретної активної вакансії на сторінці каталогу.
- Props: `entry`, `role`, `notice`, `onBack`, `onApply`.
- Повертає: тільки стрілку назад і спільний компонент `VacancyPublicPreview`.
- Summary: студентський перегляд не має зайвого header/search над preview.

## `client/src/components/vacancy`

### `VacancyPublicPreview.tsx`

#### `VacancyPublicPreview({ vacancy, labels, locationText, recruiterSlot, stickyAction, notice, onApply })`

- Призначення: спільний компонент перегляду вакансії для HR preview і студентської сторінки.
- Props: вакансія, optional labels, текст локації, optional recruiter slot, sticky action для студентського `Відгукнутися`.
- Повертає: hero вакансії, опис, блок `Необхідні навички`, окремий блок `Мови`, праву колонку з умовами та sticky action.
- Методи всередині: групування skills за категоріями й важливістю, форматування зарплати з розрядами, форматування дат українською.
- Summary: прибирає дублювання preview між кабінетом роботодавця і студентським каталогом.

### `VacancyPublicPreview.module.scss`

- Призначення: стилі спільного preview вакансії.
- Основні блоки: hero, grid, skill/language chips, right aside, sticky action.
- Summary: забезпечує однаковий вигляд preview вакансії для різних ролей.

### `VacancySearchCard.tsx`

#### `VacancySearchCard({ vacancy, skills, locations, onOpen })`

- Призначення: reusable картка вакансії для пошукової видачі та списку вакансій на сторінці компанії.
- Props: DTO вакансії з базовими полями, optional skills/locations, callback відкриття.
- Повертає: клікабельну картку з компанією, професією, описом, локаціями, умовами, skills, зарплатою та датою оновлення.
- Summary: зменшує дублювання між `/vacancies` і `/companies/:companyId`.

### `VacancySearchCard.module.scss`

- Призначення: ізольовані стилі картки вакансії для повторного використання в різних сторінках.
- Summary: винесено card UI зі сторінки каталогу, щоб сторінка компанії могла показувати такі самі картки без копіювання розмітки.

### `VacanciesPage.module.scss`

- Призначення: стилі окремої сторінки каталогу вакансій.
- Основні блоки: toolbar, sticky buttons у drawer, вертикальні списки фільтрів, картки, detail view, responsive layout.
- Summary: дає фільтрам бічну панель і прибирає dropdown overlay для основних фільтрів.

## `client/src/pages/companies`

### `CompanyPublicPage.tsx`

#### `CompanyPublicPage()`

- Призначення: публічна сторінка компанії з hero, описом, контактами, командою рекрутерів і вакансіями компанії.
- API calls: `GET /companies/:companyId`.
- UI behavior: кнопка `Повернутися` веде на попередню сторінку; ширина сторінки синхронізована з `/vacancies`; hero показує badge модерації над назвою і коротку мету `від {рік} року • {кількість} співробітників`.
- Вакансії: список фільтрується по `Активні` / `Призупинені`, використовує reusable `VacancySearchCard`, показує локації через довідники, а додаткові фільтри відкриваються окремим рядком біля пошуку.
- Reuse: цей самий component використовується в HR-вкладці компанії як embedded preview; при відкритті preview з кнопки HR меню одноразово згортається.
- Summary: сторінка компанії тепер стилістично ближча до перегляду вакансії та використовує спільні компоненти каталогу.
