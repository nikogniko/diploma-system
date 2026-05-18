/* eslint-disable @typescript-eslint/no-explicit-any */
import { useAuth } from "@clerk/react";
import {
  Autocomplete,
  Badge,
  Button,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput, MonthPickerInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiRequest } from "../../api/apiClient";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { FormSection } from "../../components/common/FormSection";
import { AppLoader } from "../../components/common/AppLoader";
import { RichTextEditor } from "../../components/common/RichTextEditor";
import { StatusBadge } from "../../components/common/StatusBadge";
import { CabinetLayout } from "../../layouts/CabinetLayout";
import {
  formatUkrainianPhone,
  isValidEmail,
  isValidUkrainianPhone,
} from "../../utils/formMasks";
import classes from "./StudentDashboard.module.scss";

type CatalogItem = { id: number; name: string };
type Skill = CatalogItem & { category: string };
type LinkType = "WEBSITE" | "MESSENGER" | "SOCIAL" | "PORTFOLIO" | "OTHER";
type LinkItem = { id?: string; linkType: LinkType; linkName: string; value: string };
type SkillJoin = { skill: Skill };
type LocationJoin = {
  location: {
    countryId: number;
    regionId?: number | null;
    cityId?: number | null;
    country?: CatalogItem;
    region?: CatalogItem | null;
    city?: CatalogItem | null;
  };
};

type StudentProfile = {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    photoUrl?: string | null;
    status: string;
    createdAt?: string;
  };
  birthDate?: string;
  gender?: string | null;
  about?: string | null;
  contactEmail: string;
  primaryPhone: string;
  secondaryPhone?: string | null;
  desiredPosition?: string | null;
  minSalary?: number | null;
  isActiveSearch: boolean;
  visibility: string;
  links: LinkItem[];
  education: Array<{
    id: string;
    universityId?: number | null;
    university?: CatalogItem | null;
    customUniversityName?: string | null;
    specialty: string;
    degree: string;
    startYear: number;
    endYear?: number | null;
    diplomaUrl?: string | null;
  }>;
  languages: Array<{ id: string; languageId: number; level: string; certificateUrl?: string | null; language?: CatalogItem }>;
  courses: Array<{ id: string; title: string; startDate: string; endDate?: string | null; certificateUrl?: string | null; skills: SkillJoin[] }>;
  projects: Array<{ id: string; title: string; description: string; projectUrl?: string | null; skills: SkillJoin[] }>;
  experiences: Array<{
    id: string;
    professionId: number;
    sphereId: number;
    profession?: CatalogItem;
    sphere?: CatalogItem;
    position: string;
    companyName: string;
    startDate: string;
    endDate?: string | null;
    achievements: string;
    skills: SkillJoin[];
  }>;
  desiredProfessions: Array<{ professionId: number; profession?: CatalogItem }>;
  employmentTypes: Array<{ employmentTypeId: number; employmentType?: CatalogItem }>;
  workSchedules: Array<{ workScheduleId: number; workSchedule?: CatalogItem }>;
  workFormats: Array<{ workFormatId: number; workFormat?: CatalogItem }>;
  desiredLocations: LocationJoin[];
};

type StudentCatalogs = {
  languages: CatalogItem[];
  employmentTypes: CatalogItem[];
  workSchedules: CatalogItem[];
  workFormats: CatalogItem[];
  professions: CatalogItem[];
  spheres: CatalogItem[];
  countries: CatalogItem[];
  regions: Array<CatalogItem & { countryId: number }>;
  cities: Array<CatalogItem & { regionId: number }>;
  skillsByCategory: Record<string, Skill[]>;
};

const navItems = [
  { key: "dashboard", label: "Дашборд", icon: <DashboardIcon />, underline: true },
  { key: "vacancies", label: "Відгуки на вакансії", icon: <BriefcaseIcon />, underline: true },
  { key: "personal", label: "Персональні дані", icon: <UserIcon /> },
  { key: "resume", label: "Резюме", icon: <ResumeIcon /> },
  { key: "search", label: "Параметри пошуку", icon: <SearchIcon /> },
];

const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2", "NATIVE"];
const currentYear = new Date().getFullYear();
const resourcePlaceholder = "Вкажіть посилання на ресурс або на файл у вашому Google Drive/OneDrive...";

/** Кабінет кандидата з персональними даними, резюме і параметрами пошуку. */
export default function StudentDashboard() {
  const { getToken } = useAuth();
  const [active, setActive] = useState("dashboard");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [catalogs, setCatalogs] = useState<StudentCatalogs | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [blockErrors, setBlockErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [personalForm, setPersonalForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    birthDate: "",
    gender: "",
    contactEmail: "",
    primaryPhone: "",
    secondaryPhone: "",
    about: "",
    telegram: "",
    viber: "",
    visibility: "APPLIED_ONLY",
    links: [] as LinkItem[],
  });
  const [searchForm, setSearchForm] = useState({
    desiredPosition: "",
    desiredProfessionIds: [] as string[],
    desiredLocations: [] as Array<{ countryId: number; regionId?: number | null; cityId?: number | null; label: string }>,
    minSalary: null as number | null,
    showAllSalary: true,
    isActiveSearch: true,
    visibility: "APPLIED_ONLY",
    employmentTypeIds: [] as string[],
    workScheduleIds: [] as string[],
    workFormatIds: [] as string[],
  });
  const [newLocation, setNewLocation] = useState({ countryId: 0, regionId: 0, cityId: 0 });
  const [regions, setRegions] = useState<CatalogItem[]>([]);
  const [cities, setCities] = useState<CatalogItem[]>([]);
  const [universities, setUniversities] = useState<CatalogItem[]>([]);
  const [universityQuery, setUniversityQuery] = useState("");

  const [educationEditId, setEducationEditId] = useState<string | null>(null);
  const [languageEditId, setLanguageEditId] = useState<string | null>(null);
  const [courseEditId, setCourseEditId] = useState<string | null>(null);
  const [projectEditId, setProjectEditId] = useState<string | null>(null);
  const [experienceEditId, setExperienceEditId] = useState<string | null>(null);

  const emptyEducation = { universityId: "", customUniversityName: "", degree: "BACHELOR", specialty: "", startYear: "", endYear: "", diplomaUrl: "" };
  const emptyLanguage = { languageId: "", level: "", certificateUrl: "" };
  const emptyCourse = { title: "", startDate: "", endDate: "", certificateUrl: "", skillIds: [] as string[] };
  const emptyProject = { title: "", description: "", projectUrl: "", skillIds: [] as string[] };
  const emptyExperience = { professionId: "", sphereId: "", companyName: "", position: "", startDate: "", endDate: "", achievements: "", skillIds: [] as string[] };
  const [educationForm, setEducationForm] = useState(emptyEducation);
  const [languageForm, setLanguageForm] = useState(emptyLanguage);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [experienceForm, setExperienceForm] = useState(emptyExperience);

  const options = useMemo(() => ({
    languages: catalogs?.languages.map(asOption) ?? [],
    professions: catalogs?.professions.map(asOption) ?? [],
    spheres: catalogs?.spheres.map(asOption) ?? [],
    countries: catalogs?.countries.map(asOption) ?? [],
    employmentTypes: catalogs?.employmentTypes.map(asOption) ?? [],
    workSchedules: catalogs?.workSchedules.map(asOption) ?? [],
    workFormats: catalogs?.workFormats.map(asOption) ?? [],
    skills: Object.values(catalogs?.skillsByCategory ?? {}).flat().map((skill) => ({
      value: String(skill.id),
      label: skill.name,
      category: skill.category,
      name: skill.name,
    })),
  }), [catalogs]);

  /** Завантажує профіль кандидата та довідники для форм. */
  const loadDashboard = async () => {
    setPageError(null);
    setIsLoading(true);
    try {
      const token = await getToken();
      const [profileData, catalogData] = await Promise.all([
        apiRequest<StudentProfile>("/students/my-cabinet", token),
        apiRequest<StudentCatalogs>("/catalogs/student-cabinet", token),
      ]);
      setProfile(profileData);
      setCatalogs(catalogData);
      fillForms(profileData, catalogData);
    } catch (err) {
      setPageError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const query = universityQuery.trim();
    if (query.length < 2) return;
    void apiRequest<CatalogItem[]>(`/catalogs/universities?q=${encodeURIComponent(query)}`, null)
      .then(setUniversities)
      .catch(() => setUniversities([]));
  }, [universityQuery]);

  useEffect(() => {
    if (!newLocation.countryId) return;
    void apiRequest<CatalogItem[]>(`/catalogs/countries/${newLocation.countryId}/regions`, null)
      .then(setRegions)
      .catch(() => setRegions([]));
  }, [newLocation.countryId]);

  useEffect(() => {
    if (!newLocation.regionId) {
      setCities([]);
      return;
    }
    void apiRequest<CatalogItem[]>(`/catalogs/regions/${newLocation.regionId}/cities`, null)
      .then(setCities)
      .catch(() => setCities([]));
  }, [newLocation.regionId]);

  /** Заповнює локальні форми даними з backend. */
  const fillForms = (profileData: StudentProfile, catalogData: StudentCatalogs) => {
    const messenger = (name: string) => profileData.links.find((link) => link.linkType === "MESSENGER" && link.linkName === name)?.value ?? "";
    setPersonalForm({
      firstName: profileData.user.firstName ?? "",
      lastName: profileData.user.lastName ?? "",
      middleName: profileData.user.middleName ?? "",
      birthDate: profileData.birthDate?.slice(0, 10) ?? "",
      gender: profileData.gender ?? "",
      contactEmail: profileData.contactEmail ?? "",
      primaryPhone: profileData.primaryPhone ?? "",
      secondaryPhone: profileData.secondaryPhone ?? "",
      about: profileData.about ?? "",
      telegram: messenger("Telegram"),
      viber: messenger("Viber"),
      visibility: profileData.visibility,
      links: profileData.links.filter((link) => !(link.linkType === "MESSENGER" && ["Telegram", "Viber"].includes(link.linkName))),
    });
    setSearchForm({
      desiredPosition: profileData.desiredPosition ?? "",
      desiredProfessionIds: profileData.desiredProfessions.map((item) => String(item.professionId)),
      desiredLocations: profileData.desiredLocations.map((item) => ({
        countryId: item.location.countryId,
        regionId: item.location.regionId,
        cityId: item.location.cityId,
        label: formatLocation(item, catalogData),
      })),
      minSalary: profileData.minSalary ?? null,
      showAllSalary: profileData.minSalary === null || profileData.minSalary === undefined,
      isActiveSearch: profileData.isActiveSearch,
      visibility: profileData.visibility,
      employmentTypeIds: profileData.employmentTypes.map((item) => String(item.employmentTypeId)),
      workScheduleIds: profileData.workSchedules.map((item) => String(item.workScheduleId)),
      workFormatIds: profileData.workFormats.map((item) => String(item.workFormatId)),
    });
    const ukraine = catalogData.countries.find((country) => country.name.toLowerCase().includes("укра"));
    if (ukraine) setNewLocation((current) => ({ ...current, countryId: ukraine.id }));
  };

  /** Виконує дію блоку з власним loader і власною помилкою. */
  const runBlock = async (block: string, action: () => Promise<void>) => {
    setBlockErrors((current) => ({ ...current, [block]: null }));
    setSaving((current) => ({ ...current, [block]: true }));
    try {
      await action();
      await loadDashboard();
    } catch (err) {
      setBlockErrors((current) => ({ ...current, [block]: getErrorMessage(err) }));
    } finally {
      setSaving((current) => ({ ...current, [block]: false }));
    }
  };

  /** Зберігає персональні, контактні дані та посилання кандидата. */
  const savePersonalInfo = () => runBlock("personal", async () => {
    if (!isValidEmail(personalForm.contactEmail)) throw new Error("Введіть коректну контактну пошту.");
    if (!isValidUkrainianPhone(personalForm.primaryPhone)) throw new Error("Основний телефон має бути у форматі +380 XX XXX XX XX.");
    if (personalForm.secondaryPhone && !isValidUkrainianPhone(personalForm.secondaryPhone)) throw new Error("Додатковий телефон має бути у форматі +380 XX XXX XX XX.");
    if (personalForm.viber && !isValidUkrainianPhone(personalForm.viber)) throw new Error("Viber має бути номером у форматі +380 XX XXX XX XX.");
    if (personalForm.telegram && !/^(@[a-zA-Z0-9_]{5,32}|\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2})$/.test(personalForm.telegram)) throw new Error("Telegram має починатися з @ або бути номером телефону.");
    if (personalForm.links.some((link) => !link.linkType || !link.linkName.trim() || !isValidUrlLike(link.value))) {
      throw new Error("Для кожного посилання заповніть категорію, назву та коректний URL.");
    }

    const token = await getToken();
    await apiRequest("/students/my-cabinet/personal-info", token, {
      method: "PATCH",
      body: JSON.stringify({
        firstName: clean(personalForm.firstName),
        lastName: clean(personalForm.lastName),
        middleName: nullable(personalForm.middleName),
        birthDate: personalForm.birthDate,
        gender: nullable(personalForm.gender),
        contactEmail: clean(personalForm.contactEmail),
        primaryPhone: clean(personalForm.primaryPhone),
        secondaryPhone: nullable(personalForm.secondaryPhone),
        about: clean(personalForm.about),
        links: buildLinks(personalForm),
      }),
    });
    await apiRequest("/students/my-cabinet/search-preferences", token, {
      method: "PATCH",
      body: JSON.stringify({ visibility: personalForm.visibility }),
    });
  });

  /** Зберігає параметри пошуку вакансій. */
  const saveSearchPreferences = () => runBlock("search", async () => {
    if (searchForm.desiredProfessionIds.length < 1 || searchForm.desiredProfessionIds.length > 3) throw new Error("Оберіть від 1 до 3 бажаних професій.");
    const token = await getToken();
    await apiRequest("/students/my-cabinet/search-preferences", token, {
      method: "PATCH",
      body: JSON.stringify({
        desiredPosition: nullable(searchForm.desiredPosition),
        minSalary: searchForm.showAllSalary ? null : searchForm.minSalary,
        isActiveSearch: searchForm.isActiveSearch,
        visibility: searchForm.visibility,
        desiredProfessionIds: searchForm.desiredProfessionIds.map(Number),
        employmentTypeIds: searchForm.employmentTypeIds.map(Number),
        workScheduleIds: searchForm.workScheduleIds.map(Number),
        workFormatIds: searchForm.workFormatIds.map(Number),
        desiredLocations: searchForm.desiredLocations.map(({ countryId, regionId, cityId }) => ({ countryId, regionId, cityId })),
      }),
    });
  });

  /** Додає локацію у локальний список із перевіркою дубліката та ліміту. */
  const addLocation = () => {
    if (searchForm.desiredLocations.length >= 5) return setBlockErrors((c) => ({ ...c, search: "Можна додати максимум 5 локацій." }));
    const label = [
      catalogs?.countries.find((item) => item.id === newLocation.countryId)?.name,
      regions.find((item) => item.id === newLocation.regionId)?.name,
      cities.find((item) => item.id === newLocation.cityId)?.name,
    ].filter(Boolean).join(", ");
    const exists = searchForm.desiredLocations.some((item) => item.countryId === newLocation.countryId && item.regionId === (newLocation.regionId || null) && item.cityId === (newLocation.cityId || null));
    if (exists) return setBlockErrors((c) => ({ ...c, search: "Ця локація вже додана." }));
    setSearchForm((current) => ({ ...current, desiredLocations: [...current.desiredLocations, { countryId: newLocation.countryId, regionId: newLocation.regionId || null, cityId: newLocation.cityId || null, label }] }));
    setNewLocation((current) => ({ countryId: current.countryId, regionId: 0, cityId: 0 }));
  };

  const saveEducation = () => runResume("education", educationEditId, {
    universityId: educationForm.universityId ? Number(educationForm.universityId) : null,
    customUniversityName: educationForm.universityId ? null : nullable(educationForm.customUniversityName || universityQuery),
    degree: educationForm.degree,
    specialty: clean(educationForm.specialty),
    startYear: Number(educationForm.startYear),
    endYear: educationForm.endYear ? Number(educationForm.endYear) : null,
    diplomaUrl: nullable(educationForm.diplomaUrl),
  }, () => { setEducationForm(emptyEducation); setEducationEditId(null); setUniversityQuery(""); }, () => {
    if (!educationForm.universityId && !nullable(educationForm.customUniversityName || universityQuery)) return "Оберіть університет або введіть власну назву.";
    if (!educationForm.specialty.trim()) return "Вкажіть спеціальність.";
    if (!educationForm.startYear) return "Вкажіть рік початку.";
    if (Number(educationForm.startYear) < currentYear - 60 || Number(educationForm.startYear) > currentYear) return `Рік початку має бути від ${currentYear - 60} до ${currentYear}.`;
    return null;
  });

  const saveLanguage = () => runResume("languages", languageEditId, {
    languageId: Number(languageForm.languageId),
    level: languageForm.level,
    certificateUrl: nullable(languageForm.certificateUrl),
  }, () => { setLanguageForm(emptyLanguage); setLanguageEditId(null); }, () => {
    if (!languageForm.languageId) return "Оберіть мову.";
    if (!languageForm.level) return "Оберіть рівень володіння мовою.";
    return null;
  });

  const saveCourse = () => {
    if (courseForm.skillIds.length < 1) return setBlockErrors((c) => ({ ...c, courses: "Додайте мінімум одну навичку." }));
    return runResume("courses", courseEditId, { ...courseForm, startDate: monthToDate(courseForm.startDate), endDate: courseForm.endDate ? monthToDate(courseForm.endDate) : null, certificateUrl: nullable(courseForm.certificateUrl), skillIds: courseForm.skillIds.map(Number) }, () => { setCourseForm(emptyCourse); setCourseEditId(null); }, () => {
      if (!courseForm.title.trim()) return "Вкажіть назву курсу.";
      if (!courseForm.startDate) return "Вкажіть місяць і рік початку курсу.";
      return null;
    });
  };

  const saveProject = () => {
    if (projectForm.skillIds.length < 3) return setBlockErrors((c) => ({ ...c, projects: "Для проєкту потрібно мінімум три навички." }));
    return runResume("projects", projectEditId, { ...projectForm, projectUrl: nullable(projectForm.projectUrl), skillIds: projectForm.skillIds.map(Number) }, () => { setProjectForm(emptyProject); setProjectEditId(null); }, () => {
      if (!projectForm.title.trim()) return "Вкажіть назву проєкту.";
      if (!projectForm.description.trim()) return "Додайте опис проєкту.";
      return null;
    });
  };

  const saveExperience = () => {
    if (experienceForm.skillIds.length < 3) return setBlockErrors((c) => ({ ...c, experiences: "Для досвіду потрібно мінімум три навички." }));
    return runResume("experiences", experienceEditId, { ...experienceForm, professionId: Number(experienceForm.professionId), sphereId: Number(experienceForm.sphereId), endDate: nullable(experienceForm.endDate), skillIds: experienceForm.skillIds.map(Number) }, () => { setExperienceForm(emptyExperience); setExperienceEditId(null); }, () => {
      if (!experienceForm.professionId) return "Оберіть професію.";
      if (!experienceForm.position.trim()) return "Вкажіть посаду.";
      if (!experienceForm.companyName.trim()) return "Вкажіть компанію.";
      if (!experienceForm.sphereId) return "Оберіть сферу.";
      if (!experienceForm.startDate) return "Вкажіть дату початку роботи.";
      if (!experienceForm.achievements.trim()) return "Опишіть досягнення та обов'язки.";
      return null;
    });
  };

  /** Створює або оновлює запис резюме залежно від edit id. */
  const runResume = (type: string, editId: string | null, body: unknown, reset: () => void, validate?: () => string | null) => {
    const validationError = validate?.();
    if (validationError) {
      setBlockErrors((current) => ({ ...current, [type]: validationError }));
      return;
    }
    return runBlock(type, async () => {
    const token = await getToken();
    await apiRequest(`/students/my-cabinet/resume/${type}${editId ? `/${editId}` : ""}`, token, {
      method: editId ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });
    reset();
    });
  };

  /** Видаляє запис резюме. */
  const deleteResumeItem = (type: string, id: string) => runBlock(type, async () => {
    const token = await getToken();
    await apiRequest(`/students/my-cabinet/resume/${type}/${id}`, token, { method: "DELETE" });
  });

  if (isLoading) return <AppLoader text="Збираємо ваш кар'єрний простір..." />;

  return (
    <CabinetLayout navItems={navItems} activeKey={active} onSelect={setActive}>
      <Stack gap="md">
        <ErrorBanner message={pageError} />
        {active === "dashboard" && <DashboardTab profile={profile} />}
        {active === "vacancies" && <SimpleTab title="Відгуки на вакансії" description="Тут буде добірка вакансій і відгуки кандидата після реалізації модуля вакансій." />}
        {active === "personal" && (
          <PersonalTab
            profile={profile}
            form={personalForm}
            setForm={setPersonalForm}
            error={blockErrors.personal}
            saving={saving.personal}
            onSave={savePersonalInfo}
          />
        )}
        {active === "search" && (
          <SearchTab
            form={searchForm}
            setForm={setSearchForm}
            options={options}
            countries={catalogs?.countries ?? []}
            regions={regions}
            cities={cities}
            newLocation={newLocation}
            setNewLocation={setNewLocation}
            error={blockErrors.search}
            saving={saving.search}
            onAddLocation={addLocation}
            onSave={saveSearchPreferences}
          />
        )}
        {active === "resume" && (
          <ResumeTab
            profile={profile}
            personalForm={personalForm}
            setPersonalForm={setPersonalForm}
            savePersonalInfo={savePersonalInfo}
            options={options}
            universities={universities}
            universityQuery={universityQuery}
            setUniversityQuery={setUniversityQuery}
            forms={{ educationForm, languageForm, courseForm, projectForm, experienceForm }}
            setters={{ setEducationForm, setLanguageForm, setCourseForm, setProjectForm, setExperienceForm }}
            edits={{ setEducationEditId, setLanguageEditId, setCourseEditId, setProjectEditId, setExperienceEditId }}
            errors={blockErrors}
            saving={saving}
            actions={{ saveEducation, saveLanguage, saveCourse, saveProject, saveExperience, deleteResumeItem }}
            clearError={(block: string) => setBlockErrors((current) => ({ ...current, [block]: null }))}
          />
        )}
      </Stack>
    </CabinetLayout>
  );
}

function DashboardTab({ profile }: { profile: StudentProfile | null }) {
  return (
    <>
      <TabHeader title="Дашборд кандидата" description="Короткий стан профілю: ці блоки стануть основою персональних рекомендацій і майбутнього багатофакторного аналізу." />
      <FormSection title="Стан профілю" description="Поступово заповнюйте профіль: чим більше структурованих даних, тим точніше працюватиме зіставлення з вакансіями.">
        <Group gap="sm">
          <Badge className={classes.badge}>Освіта: {profile?.education.length ?? 0}</Badge>
          <Badge className={classes.badge}>Мови: {profile?.languages.length ?? 0}</Badge>
          <Badge className={classes.badge}>Курси: {profile?.courses.length ?? 0}</Badge>
          <Badge className={classes.badge}>Проєкти: {profile?.projects.length ?? 0}</Badge>
          <Badge className={classes.badge}>Досвід: {profile?.experiences.length ?? 0}</Badge>
        </Group>
      </FormSection>
    </>
  );
}

function PersonalTab({ profile, form, setForm, error, saving, onSave }: any) {
  return (
    <>
      <TabHeader title="Персональні дані" description="Ці дані формують блок інформації про кандидата. Контакти приховані від роботодавців і відкриваються лише за правилами видимості." />
      <div className={classes.tipBlock}>
        <Text className={classes.tipTitle}><InfoIcon /> Підказка</Text>
        <Text>Фото, пароль, пошту входу та підключені акаунти можна змінити в налаштуваннях акаунта у правому верхньому кутку.</Text>
      </div>
      <FormSection title="Персональні дані" description="ПІБ, стать і дата народження потрібні для коректного профілю та майбутньої генерації резюме.">
        <div className={classes.profileTop}>
          <img className={classes.avatar} src={profile?.user.photoUrl || "/vite.svg"} alt="Фото профілю" />
          <Stack gap="xs">
            <Text fw={900}>{profile?.user.lastName} {profile?.user.firstName}</Text>
            <Group gap="xs">
              <StatusBadge status={profile?.user.status} />
              <Text className={classes.muted}>Створено: {profile?.user.createdAt ? dateShort(profile.user.createdAt) : "невідомо"}</Text>
            </Group>
          </Stack>
        </div>
        <div className={classes.personalGrid}>
          <div className={classes.nameColumn}>
            <TextInput label="Ім'я" required maxLength={100} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: lettersOnly(e.currentTarget.value) })} />
            <TextInput label="Прізвище" required maxLength={100} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: lettersOnly(e.currentTarget.value) })} />
            <TextInput label="По батькові" maxLength={100} value={form.middleName} onChange={(e) => setForm({ ...form, middleName: lettersOnly(e.currentTarget.value) })} />
          </div>
          <div className={classes.nameColumn}>
            <Select label="Стать" data={[{ value: "FEMALE", label: "Жіноча" }, { value: "MALE", label: "Чоловіча" }]} value={form.gender || null} onChange={(value) => setForm({ ...form, gender: value ?? "" })} />
            <DateInput label="Дата народження" required value={form.birthDate ? new Date(form.birthDate) : null} onChange={(value) => setForm({ ...form, birthDate: value ? dayjs(value).format("YYYY-MM-DD") : "" })} valueFormat="DD.MM.YYYY" locale="uk" maxDate={new Date()} popoverProps={{ position: "bottom-end", withinPortal: true }} />
          </div>
        </div>
      </FormSection>
      <FormSection title="Контактні дані" description="За замовчуванням контактна пошта дублює пошту реєстрації, але для спілкування можна вказати іншу. Академічний домен тут не обов'язковий.">
        <div className={classes.grid}>
          <TextInput className={classes.fullRow} label="Контактна пошта" required value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.currentTarget.value })} />
          <TextInput label="Основний телефон" required value={form.primaryPhone} onChange={(e) => setForm({ ...form, primaryPhone: formatUkrainianPhone(e.currentTarget.value) })} />
          <TextInput label="Додатковий телефон" value={form.secondaryPhone} onChange={(e) => setForm({ ...form, secondaryPhone: formatUkrainianPhone(e.currentTarget.value) })} />
        </div>
      </FormSection>
      <FormSection title="Соцмережі, месенджери, портфоліо" description="Додайте канали, які допоможуть роботодавцю краще зрозуміти ваш професійний профіль.">
        <div className={classes.grid}>
          <TextInput label="Telegram" placeholder="@username або +380 XX XXX XX XX" value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.currentTarget.value.startsWith("+") || /^\d/.test(e.currentTarget.value) ? formatUkrainianPhone(e.currentTarget.value) : e.currentTarget.value })} />
          <TextInput label="Viber" value={form.viber} onChange={(e) => setForm({ ...form, viber: formatUkrainianPhone(e.currentTarget.value) })} />
        </div>
        <LinkEditor links={form.links} setLinks={(links) => setForm({ ...form, links })} />
      </FormSection>
      <FormSection title="Видимість профілю" description="Оберіть, коли роботодавець побачить ваші контактні дані.">
        <VisibilitySelector value={form.visibility ?? "APPLIED_ONLY"} onChange={(visibility) => setForm({ ...form, visibility })} />
      </FormSection>
      <InlineError message={error} />
      <Button className={classes.fullButton} loading={saving} onClick={onSave}>Зберегти персональні дані</Button>
    </>
  );
}

function SearchTab(props: any) {
  const { form, setForm, options, countries, regions, cities, newLocation, setNewLocation, error, saving, onAddLocation, onSave } = props;
  return (
    <>
      <TabHeader title="Параметри пошуку" description="Це параметри вакансій, які вам підходять. Обирайте розумно: вони будуть жорсткими фільтрами при зіставленні резюме та вакансій, а також шаблоном для ручного пошуку." />
      <FormSection title="Основні фільтри" description="Під час ручного моніторингу вакансій ці дані можна буде застосувати в один клік.">
        <Switch label="В активному пошуку" checked={form.isActiveSearch} onChange={(e) => setForm({ ...form, isActiveSearch: e.currentTarget.checked })} />
        <div className={classes.grid}>
          <TextInput label="Бажана посада" maxLength={150} placeholder="Trainee React Native Developer" value={form.desiredPosition} onChange={(e) => setForm({ ...form, desiredPosition: e.currentTarget.value })} />
          <MultiSelect label="Бажана професія" required searchable maxValues={3} data={options.professions} value={form.desiredProfessionIds} onChange={(value) => setForm({ ...form, desiredProfessionIds: value })} />
        </div>
      </FormSection>
      <FormSection title="Бажані локації" description="Можна додати до 5 унікальних локацій. Якщо обрати тільки країну, фільтр буде ширшим.">
        <div className={classes.chips}>{form.desiredLocations.map((item: any) => <button key={item.label} className={classes.locationChip} onClick={() => setForm({ ...form, desiredLocations: form.desiredLocations.filter((location: any) => location.label !== item.label) })}>{item.label} ×</button>)}</div>
        {form.desiredLocations.length < 5 && <div className={classes.threeGrid}>
          <Select label="Країна" data={countries.map(asOption)} value={String(newLocation.countryId || "")} onChange={(value) => setNewLocation({ countryId: Number(value), regionId: 0, cityId: 0 })} />
          <Select label="Область" data={regions.map(asOption)} disabled={!countries.find((c: CatalogItem) => c.id === newLocation.countryId)?.name.toLowerCase().includes("укра")} value={String(newLocation.regionId || "")} onChange={(value) => setNewLocation({ ...newLocation, regionId: Number(value), cityId: 0 })} />
          <Select label="Місто" data={cities.map(asOption)} disabled={!newLocation.regionId} value={String(newLocation.cityId || "")} onChange={(value) => setNewLocation({ ...newLocation, cityId: Number(value) })} />
        </div>}
        <Button variant="light" onClick={onAddLocation}>+ Додати локацію</Button>
      </FormSection>
      <FormSection title="Зарплата та формат" description="Оберіть усі варіанти, які вам підходять. Пропозиції з іншими параметрами показуватись не будуть.">
        <div className={classes.salaryGrid}>
          <Checkbox className={classes.centerCheckbox} label="Показувати всі зарплати" checked={form.showAllSalary} onChange={(e) => setForm({ ...form, showAllSalary: e.currentTarget.checked, minSalary: e.currentTarget.checked ? null : form.minSalary })} />
          <NumberInput label="Мінімальна зарплата, грн" min={0} step={1000} disabled={form.showAllSalary} value={form.minSalary ?? 0} onChange={(value) => setForm({ ...form, minSalary: Number(value) || 0 })} />
        </div>
        <div className={classes.threeGrid}>
          <Checkbox.Group className={classes.checkboxGroup} label="Тип зайнятості" value={form.employmentTypeIds} onChange={(value) => setForm({ ...form, employmentTypeIds: value })}>{options.employmentTypes.map((item: any) => <Checkbox key={item.value} value={item.value} label={item.label} />)}</Checkbox.Group>
          <Checkbox.Group className={classes.checkboxGroup} label="Графік роботи" value={form.workScheduleIds} onChange={(value) => setForm({ ...form, workScheduleIds: value })}>{options.workSchedules.map((item: any) => <Checkbox key={item.value} value={item.value} label={item.label} />)}</Checkbox.Group>
          <Checkbox.Group className={classes.checkboxGroup} label="Формат роботи" value={form.workFormatIds} onChange={(value) => setForm({ ...form, workFormatIds: value })}>{options.workFormats.map((item: any) => <Checkbox key={item.value} value={item.value} label={item.label} />)}</Checkbox.Group>
        </div>
      </FormSection>
      <InlineError message={error} />
      <Button className={classes.fullButton} loading={saving} onClick={onSave}>Зберегти параметри пошуку</Button>
    </>
  );
}

function ResumeTab(props: any) {
  const { profile, personalForm, setPersonalForm, savePersonalInfo, options, universities, universityQuery, setUniversityQuery, forms, setters, edits, errors, saving, actions, clearError } = props;
  const { educationForm, languageForm, courseForm, projectForm, experienceForm } = forms;
  const { setEducationForm, setLanguageForm, setCourseForm, setProjectForm, setExperienceForm } = setters;
  return (
    <>
      <TabHeader title="Резюме" description="Заповнюйте структуровані блоки: освіта, мови, курси, проєкти й досвід дадуть системі дані для майбутнього аналізу відповідності." />
      <FormSection title="Про себе" description="Коротко опишіть професійні інтереси, сильні сторони і ціль. Цей блок обов'язковий для повного профілю.">
        <RichTextEditor value={personalForm.about} onChange={(about) => setPersonalForm({ ...personalForm, about })} maxLength={500} placeholder="Опишіть свої професійні інтереси, сильні сторони та ціль." />
        <InlineError message={errors.personal} />
        <ActionButtons saving={saving.personal} isEditing={false} onSave={savePersonalInfo} onCancel={() => { setPersonalForm({ ...personalForm, about: "" }); clearError("personal"); }} />
      </FormSection>
      <FormSection title="Формальна освіта" description="Оберіть університет із довідника або використайте введену назву, якщо його немає в списку.">
        <RecordList items={profile?.education ?? []} title={(i: any) => i.university?.name ?? i.customUniversityName} meta={(i: any) => `${degreeLabel(i.degree)} · ${i.specialty} · ${i.startYear}${i.endYear ? `-${i.endYear}` : ""}`} links={(i: any) => i.diplomaUrl ? [{ label: "Диплом", value: i.diplomaUrl }] : []} onEdit={(i: any) => { edits.setEducationEditId(i.id); setEducationForm({ universityId: i.universityId ? String(i.universityId) : "", customUniversityName: i.customUniversityName ?? "", degree: i.degree, specialty: i.specialty, startYear: String(i.startYear), endYear: i.endYear ? String(i.endYear) : "", diplomaUrl: i.diplomaUrl ?? "" }); setUniversityQuery(i.customUniversityName ?? i.university?.name ?? ""); }} onDelete={(i: any) => actions.deleteResumeItem("education", i.id)} />
        <div className={classes.grid}>
          <div className={classes.fullRow}>
            <TextInput label="Університет" required placeholder="Оберіть зі списку чи введіть власну назву університету" value={universityQuery} onChange={(event) => { const value = event.currentTarget.value; setUniversityQuery(value); setEducationForm({ ...educationForm, universityId: "", customUniversityName: value }); }} />
            {universities.length > 0 && (
              <div className={classes.suggestionList}>
                {universities.map((item: CatalogItem) => <button key={item.id} type="button" onClick={() => { setUniversityQuery(item.name); setEducationForm({ ...educationForm, universityId: String(item.id), customUniversityName: "" }); }}>{item.name}</button>)}
              </div>
            )}
          </div>
          <Select label="Ступінь" required placeholder="Оберіть ступінь" data={[{ value: "JUNIOR_BACHELOR", label: "Молодший бакалавр" }, { value: "BACHELOR", label: "Бакалавр" }, { value: "MASTER", label: "Магістр" }, { value: "PHD", label: "Доктор філософії" }, { value: "OTHER", label: "Інше" }]} value={educationForm.degree} onChange={(value) => setEducationForm({ ...educationForm, degree: value ?? "BACHELOR" })} />
          <TextInput label="Спеціальність" required placeholder="Наприклад: Інженерія програмного забезпечення" maxLength={200} value={educationForm.specialty} onChange={(e) => setEducationForm({ ...educationForm, specialty: e.currentTarget.value })} />
          <NumberInput label="Рік початку" required placeholder={String(currentYear)} min={currentYear - 60} max={currentYear} value={educationForm.startYear ? Number(educationForm.startYear) : undefined} onChange={(value) => setEducationForm({ ...educationForm, startYear: value ? String(value) : "" })} />
          <NumberInput label="Рік завершення" min={currentYear - 60} max={currentYear} value={educationForm.endYear ? Number(educationForm.endYear) : undefined} onChange={(value) => setEducationForm({ ...educationForm, endYear: value ? String(value) : "" })} />
          <TextInput className={classes.fullRow} label="URL-посилання на диплом" placeholder={resourcePlaceholder} maxLength={255} value={educationForm.diplomaUrl} onChange={(e) => setEducationForm({ ...educationForm, diplomaUrl: e.currentTarget.value })} />
        </div>
        <InlineError message={errors.education} /><ActionButtons saving={saving.education} isEditing={false} onSave={actions.saveEducation} onCancel={() => { setEducationForm({ universityId: "", customUniversityName: "", degree: "BACHELOR", specialty: "", startYear: "", endYear: "", diplomaUrl: "" }); setUniversityQuery(""); clearError("education"); }} />
      </FormSection>
      <FormSection title="Мовні компетенції" description="Мова і рівень CEFR є обов'язковими, сертифікат можна додати посиланням.">
        <RecordList items={profile?.languages ?? []} title={(i: any) => i.language?.name} meta={(i: any) => i.level} links={(i: any) => i.certificateUrl ? [{ label: "Сертифікат", value: i.certificateUrl }] : []} onEdit={(i: any) => { edits.setLanguageEditId(i.id); setLanguageForm({ languageId: String(i.languageId), level: i.level, certificateUrl: i.certificateUrl ?? "" }); }} onDelete={(i: any) => actions.deleteResumeItem("languages", i.id)} />
        <div className={classes.grid}>
          <Select label="Мова" required searchable placeholder="Оберіть мову" data={options.languages} value={languageForm.languageId || null} onChange={(value) => setLanguageForm({ ...languageForm, languageId: value ?? "" })} />
          <Select label="Рівень" required placeholder="Оберіть рівень" data={cefrLevels} value={languageForm.level || null} onChange={(value) => setLanguageForm({ ...languageForm, level: value ?? "" })} />
          <TextInput className={classes.fullRow} label="URL-посилання на сертифікат" placeholder={resourcePlaceholder} maxLength={255} value={languageForm.certificateUrl} onChange={(e) => setLanguageForm({ ...languageForm, certificateUrl: e.currentTarget.value })} />
        </div>
        <InlineError message={errors.languages} /><ActionButtons saving={saving.languages} isEditing={false} onSave={actions.saveLanguage} onCancel={() => { setLanguageForm({ languageId: "", level: "", certificateUrl: "" }); clearError("languages"); }} />
      </FormSection>
      <CompetencySection type="courses" title="Неформальна освіта" description="Курси показують, які навички ви здобували поза університетом. Мінімум одна навичка." items={profile?.courses ?? []} form={courseForm} setForm={setCourseForm} edit={edits.setCourseEditId} error={errors.courses} saving={saving.courses} onSave={actions.saveCourse} onDelete={actions.deleteResumeItem} options={options} clearError={clearError} />
      <CompetencySection type="projects" title="Власні проєкти" description="Проєкти демонструють практичне застосування знань. Для проєкту потрібно мінімум три навички." items={profile?.projects ?? []} form={projectForm} setForm={setProjectForm} edit={edits.setProjectEditId} error={errors.projects} saving={saving.projects} onSave={actions.saveProject} onDelete={actions.deleteResumeItem} options={options} clearError={clearError} />
      <ExperienceSection form={experienceForm} setForm={setExperienceForm} items={profile?.experiences ?? []} options={options} edit={edits.setExperienceEditId} error={errors.experiences} saving={saving.experiences} onSave={actions.saveExperience} onDelete={actions.deleteResumeItem} clearError={clearError} />
    </>
  );
}

function CompetencySection({ type, title, description, items, form, setForm, edit, error, saving, onSave, onDelete, options, clearError }: any) {
  const isCourse = type === "courses";
  const isProject = type === "projects";
  return <FormSection title={title} description={description}>
    <RecordList items={items} title={(i: any) => i.title} meta={(i: any) => isCourse ? `${monthShort(i.startDate)}${i.endDate ? ` - ${monthShort(i.endDate)}` : ""}` : stripHtml(i.description)} skills={(i: any) => i.skills?.map((join: SkillJoin) => join.skill) ?? []} links={(i: any) => isCourse ? (i.certificateUrl ? [{ label: "Сертифікат", value: i.certificateUrl }] : []) : (i.projectUrl ? [{ label: "Проєкт", value: i.projectUrl }] : [])} onEdit={(i: any) => { edit(i.id); setForm(isCourse ? { title: i.title, startDate: i.startDate?.slice(0, 7), endDate: i.endDate?.slice(0, 7) ?? "", certificateUrl: i.certificateUrl ?? "", skillIds: i.skills.map((s: SkillJoin) => String(s.skill.id)) } : { title: i.title, description: i.description, projectUrl: i.projectUrl ?? "", skillIds: i.skills.map((s: SkillJoin) => String(s.skill.id)) }); }} onDelete={(i: any) => onDelete(type, i.id)} />
    {isCourse ? <div className={classes.grid}><TextInput className={classes.fullRow} label="Назва" required placeholder="Наприклад: React Advanced Course" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} /><MonthPickerInput label="Місяць початку" required placeholder="Оберіть місяць" value={form.startDate ? new Date(monthToDate(form.startDate)) : null} onChange={(v) => setForm({ ...form, startDate: v ? dayjs(v).format("YYYY-MM") : "" })} valueFormat="MM.YYYY" locale="uk" popoverProps={{ position: "bottom-end", withinPortal: true }} /><MonthPickerInput label="Місяць завершення" placeholder="Оберіть місяць" clearable value={form.endDate ? new Date(monthToDate(form.endDate)) : null} onChange={(v) => setForm({ ...form, endDate: v ? dayjs(v).format("YYYY-MM") : "" })} valueFormat="MM.YYYY" locale="uk" popoverProps={{ position: "bottom-end", withinPortal: true }} /><TextInput className={classes.fullRow} label="URL-посилання на сертифікат" placeholder={resourcePlaceholder} maxLength={255} value={form.certificateUrl} onChange={(e) => setForm({ ...form, certificateUrl: e.currentTarget.value })} /></div> : <><TextInput label="Назва" required placeholder="Коротка назва проєкту" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} /><RichTextEditor value={form.description} onChange={(description) => setForm({ ...form, description })} label="Опис" placeholder="Опишіть суть проєкту, вашу роль, стек і результат." /><TextInput label="URL-посилання на проєкт" placeholder={resourcePlaceholder} maxLength={255} value={form.projectUrl} onChange={(e) => setForm({ ...form, projectUrl: e.currentTarget.value })} /></>}
    <SmartSkillSelector value={form.skillIds} onChange={(skillIds) => setForm({ ...form, skillIds })} options={options.skills} max={isProject ? 30 : 20} />
    <Text className={classes.muted}>TODO: пізніше додамо пропонування нової навички зі статусом “На модерації”.</Text>
    <InlineError message={error} /><ActionButtons saving={saving} isEditing={false} onSave={onSave} onCancel={() => { setForm(isCourse ? { title: "", startDate: "", endDate: "", certificateUrl: "", skillIds: [] } : { title: "", description: "", projectUrl: "", skillIds: [] }); clearError(type); }} />
  </FormSection>;
}

function ExperienceSection({ form, setForm, items, options, edit, error, saving, onSave, onDelete, clearError }: any) {
  return <FormSection title="Досвід роботи" description="Досвід пов'язується з професією, сферою та здобутими навичками. Усі поля, крім дати завершення, обов'язкові.">
    <RecordList items={items} title={(i: any) => `${i.position} · ${i.companyName}`} meta={(i: any) => `${dateShort(i.startDate)} - ${i.endDate ? dateShort(i.endDate) : "нині"}\n${i.profession?.name ?? ""} · ${i.sphere?.name ?? ""}`} skills={(i: any) => i.skills?.map((join: SkillJoin) => join.skill) ?? []} onEdit={(i: any) => { edit(i.id); setForm({ professionId: String(i.professionId), sphereId: String(i.sphereId), companyName: i.companyName, position: i.position, startDate: i.startDate?.slice(0, 10), endDate: i.endDate?.slice(0, 10) ?? "", achievements: i.achievements, skillIds: i.skills.map((s: SkillJoin) => String(s.skill.id)) }); }} onDelete={(i: any) => onDelete("experiences", i.id)} />
    <div className={classes.grid}><Select label="Професія" required searchable placeholder="Оберіть професію" data={options.professions} value={form.professionId || null} onChange={(value) => setForm({ ...form, professionId: value ?? "" })} /><TextInput label="Посада" required placeholder="Наприклад: Frontend Developer" maxLength={200} value={form.position} onChange={(e) => setForm({ ...form, position: e.currentTarget.value })} /><TextInput label="Компанія" required placeholder="Оберіть зі списку чи введіть назву компанії" maxLength={200} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.currentTarget.value })} /><Select label="Сфера" required searchable placeholder="Оберіть сферу" data={options.spheres} value={form.sphereId || null} onChange={(value) => setForm({ ...form, sphereId: value ?? "" })} /><DateInput label="Дата початку" required placeholder="Оберіть дату" value={form.startDate ? new Date(form.startDate) : null} onChange={(v) => setForm({ ...form, startDate: v ? dayjs(v).format("YYYY-MM-DD") : "" })} valueFormat="DD.MM.YYYY" locale="uk" popoverProps={{ position: "bottom-end", withinPortal: true }} /><DateInput label="Дата завершення" placeholder="Оберіть дату" clearable value={form.endDate ? new Date(form.endDate) : null} onChange={(v) => setForm({ ...form, endDate: v ? dayjs(v).format("YYYY-MM-DD") : "" })} valueFormat="DD.MM.YYYY" locale="uk" popoverProps={{ position: "bottom-end", withinPortal: true }} /></div>
    <RichTextEditor label="Досягнення та обов'язки" value={form.achievements} onChange={(achievements) => setForm({ ...form, achievements })} placeholder="Опишіть відповідальність, досягнення і результат роботи." />
    <SmartSkillSelector value={form.skillIds} onChange={(skillIds) => setForm({ ...form, skillIds })} options={options.skills} max={30} />
    <InlineError message={error} /><ActionButtons saving={saving} isEditing={false} onSave={onSave} onCancel={() => { setForm({ professionId: "", sphereId: "", companyName: "", position: "", startDate: "", endDate: "", achievements: "", skillIds: [] }); clearError("experiences"); }} />
  </FormSection>;
}

function SmartSkillSelector({ value, onChange, options, max }: { value: string[]; onChange: (v: string[]) => void; options: Array<{ value: string; label: string; category?: string; name?: string }>; max: number }) {
  const [search, setSearch] = useState("");
  const selected = options.filter((option: any) => value.includes(option.value));
  const categories = ["HARD", "TOOL", "SOFT"];
  return <div className={classes.selectorBox}><Select label="Навички" placeholder="Почніть вводити навичку..." searchable clearable value={null} searchValue={search} onSearchChange={setSearch} data={options.filter((option) => !value.includes(option.value))} onChange={(skillId) => { if (skillId && value.length < max) onChange([...value, skillId]); setSearch(""); }} /><div className={classes.skillGroups}>{categories.map((category) => {
    const categorySkills = selected.filter((item: any) => String(item.category).toUpperCase().includes(category));
    if (!categorySkills.length) return null;
    return <div key={category}><Text className={classes.skillGroupTitle}>{category === "HARD" ? "Hard Skills" : category === "TOOL" ? "Tools" : "Soft Skills"}</Text><div className={classes.chips}>{categorySkills.map((item: any) => <button key={item.value} className={`${classes.skillChip} ${skillClass(item.category)}`} onClick={() => onChange(value.filter((id) => id !== item.value))}>{item.name ?? item.label} <span>×</span></button>)}</div></div>;
  })}</div></div>;
}

function RecordList({ items, title, meta, skills, links, onEdit, onDelete }: any) {
  if (!items.length) return <Text className={classes.muted}>Записів поки немає. Додайте перший нижче.</Text>;
  return <div className={classes.cardList}>{items.map((item: any) => <div key={item.id} className={classes.recordCard}><span className={classes.dragHandle}>⠿</span><div><Text className={classes.recordTitle}>{title(item)}</Text><Text className={classes.recordMeta}>{meta(item)}</Text>{links?.(item)?.length > 0 && <div className={classes.urlList}>{links(item).map((link: { label: string; value: string }) => <a key={`${link.label}-${link.value}`} className={classes.resourceLink} href={normalizeHref(link.value)} target="_blank" rel="noreferrer">{link.label}</a>)}</div>}{skills && <SkillChips skills={skills(item)} />}</div><div className={classes.iconActions}><button className={classes.iconButton} onClick={() => onEdit(item)} title="Редагувати"><EditIcon /></button><button className={`${classes.iconButton} ${classes.dangerIconButton}`} onClick={() => onDelete(item)} title="Видалити"><TrashIcon /></button></div></div>)}</div>;
}

function LinkEditor({ links, setLinks }: { links: LinkItem[]; setLinks: (links: LinkItem[]) => void }) {
  const [error, setError] = useState<string | null>(null);
  const suggestions: Array<{ name: string; type: LinkType }> = [
    { name: "LinkedIn", type: "SOCIAL" },
    { name: "Власний сайт", type: "WEBSITE" },
    { name: "Портфоліо", type: "PORTFOLIO" },
    { name: "Google Drive", type: "PORTFOLIO" },
    { name: "OneDrive", type: "PORTFOLIO" },
    { name: "Instagram", type: "SOCIAL" },
    { name: "Twitter / X", type: "SOCIAL" },
    { name: "Facebook", type: "SOCIAL" },
    { name: "YouTube", type: "SOCIAL" },
    { name: "TikTok", type: "SOCIAL" },
    { name: "Notion", type: "PORTFOLIO" },
    { name: "Canva", type: "PORTFOLIO" },
    { name: "GitHub", type: "PORTFOLIO" },
    { name: "GitLab", type: "PORTFOLIO" },
    { name: "LeetCode", type: "PORTFOLIO" },
    { name: "Behance", type: "PORTFOLIO" },
    { name: "Dribbble", type: "PORTFOLIO" },
    { name: "Figma", type: "PORTFOLIO" },
    { name: "ArtStation", type: "PORTFOLIO" },
    { name: "CodePen", type: "PORTFOLIO" },
  ];
  const categoryOptions = [
    { value: "WEBSITE", label: "Вебсайт" },
    { value: "MESSENGER", label: "Месенджер" },
    { value: "SOCIAL", label: "Соцмережа" },
    { value: "PORTFOLIO", label: "Портфоліо" },
    { value: "OTHER", label: "Інше" },
  ];
  const add = () => {
    const last = links.at(-1);
    if (last && (!last.linkType || !last.linkName.trim() || !isValidUrlLike(last.value))) {
      setError("Заповніть категорію, назву та коректний URL у попередньому рядку.");
      return;
    }
    setError(null);
    setLinks([...links, { linkType: "SOCIAL", linkName: "", value: "" }]);
  };
  return <Stack gap="sm">{links.map((link, index) => <div className={classes.linkGrid} key={index}><Select required label="Категорія" placeholder="Оберіть категорію" data={categoryOptions} value={link.linkType} onChange={(value) => setLinks(links.map((item, i) => i === index ? { ...item, linkType: (value ?? "OTHER") as LinkType } : item))} /><Autocomplete required label="Назва" placeholder="Оберіть зі списку чи введіть власну назву" data={suggestions.map((item) => item.name)} limit={suggestions.length} maxLength={100} value={link.linkName} onChange={(value) => {
    const found = suggestions.find((item) => item.name.toLowerCase() === value.toLowerCase());
    setLinks(links.map((item, i) => i === index ? { ...item, linkName: value, linkType: found?.type ?? item.linkType } : item));
  }} /><TextInput required label="URL / значення" placeholder={resourcePlaceholder} maxLength={255} value={link.value} onChange={(e) => setLinks(links.map((item, i) => i === index ? { ...item, value: e.currentTarget.value } : item))} /><button type="button" className={`${classes.iconButton} ${classes.dangerIconButton} ${classes.linkDeleteButton}`} onClick={() => { setLinks(links.filter((_, i) => i !== index)); setError(null); }} title="Видалити посилання"><TrashIcon /></button></div>)}<InlineError message={error} /><Button variant="light" onClick={add}>+ Додати посилання</Button></Stack>;
}

function VisibilitySelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const items = [
    ["PUBLIC", "Відкритий", "Контактні дані видно роботодавцю одразу після відгуку на його вакансію."],
    ["APPLIED_ONLY", "Конфіденційний", "Контакти приховані під час відгуку і відкриваються після запрошення на співбесіду."],
    ["HIDDEN", "Прихований", "Для періоду, коли ви не шукаєте роботу; у цьому режимі не можна подаватись на вакансії."],
  ];
  return <div className={classes.visibilityOptions}>{items.map(([id, label, text]) => <label className={classes.visibilityOption} key={id}><Checkbox checked={value === id} onChange={() => onChange(id)} label={<><Text fw={900}>{label}</Text><Text className={classes.muted}>{text}</Text></>} /></label>)}</div>;
}

function SkillChips({ skills }: { skills: Skill[] }) {
  return <div className={classes.chips}>{skills.map((skill) => <span key={skill.id} className={`${classes.skillChip} ${skillClass(skill.category)}`}>{skill.name}</span>)}</div>;
}

function TabHeader({ title, description }: { title: string; description: string }) {
  return <div className={classes.tabHeader}><Title order={1} className={classes.tabTitle}>{title}</Title><Text className={classes.tabDescription}>{description}</Text></div>;
}

function SimpleTab({ title, description }: { title: string; description: string }) {
  return <><TabHeader title={title} description={description} /><FormSection title="Скоро" description="Цей блок підключимо після реалізації вакансій."><Text className={classes.muted}>Фундамент кабінету вже готовий для майбутнього модуля.</Text></FormSection></>;
}

function InlineError({ message }: { message?: string | null }) {
  return message ? <div className={classes.inlineError}>{message}</div> : null;
}

function ActionButtons({ saving, isEditing, onSave, onCancel }: { saving?: boolean; isEditing?: boolean; onSave: () => void; onCancel: () => void }) {
  return <div className={classes.formActions}><Button className={classes.fullButton} loading={saving} onClick={onSave}>{isEditing ? "Зберегти зміни" : "Зберегти"}</Button><Button className={classes.cancelButton} variant="light" onClick={onCancel}>{isEditing ? "Відмінити зміни" : "Очистити"}</Button></div>;
}

function buildLinks(form: { links: LinkItem[]; telegram: string; viber: string }): LinkItem[] {
  const links = form.links.filter((link) => link.linkName.trim() && link.value.trim());
  if (form.telegram.trim()) links.push({ linkType: "MESSENGER", linkName: "Telegram", value: form.telegram.trim() });
  if (form.viber.trim()) links.push({ linkType: "MESSENGER", linkName: "Viber", value: form.viber.trim() });
  return links;
}

const asOption = (item: CatalogItem) => ({ value: String(item.id), label: item.name });
const clean = (value: string) => value.trim();
const nullable = (value?: string | null) => value?.trim() || null;
const lettersOnly = (value: string) => value.replace(/[^\p{L}' -]/gu, "").slice(0, 100);
const dateShort = (value: string) => dayjs(value).format("DD.MM.YYYY");
const monthShort = (value: string) => dayjs(value).format("MM.YYYY");
const monthToDate = (value: string) => value.length === 7 ? `${value}-01` : value;
const isValidUrlLike = (value: string) => /^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(value.trim());
const normalizeHref = (value: string) => /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim().replace(/^www\./i, "www.")}`;
const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const degreeLabel = (degree: string) => ({ JUNIOR_BACHELOR: "Молодший бакалавр", BACHELOR: "Бакалавр", MASTER: "Магістр", PHD: "Доктор філософії", OTHER: "Інше" }[degree] ?? degree);
const skillClass = (category: string) => category.toLowerCase().includes("soft") ? classes.soft : category.toLowerCase().includes("tool") ? classes.tools : classes.hard;
function formatLocation(item: LocationJoin, catalogs: StudentCatalogs) {
  const label = [
    catalogs.countries.find((country) => country.id === item.location.countryId)?.name,
    catalogs.regions.find((region) => region.id === item.location.regionId)?.name,
    catalogs.cities.find((city) => city.id === item.location.cityId)?.name,
  ].filter(Boolean).join(", ");
  return label || "Локація";
}
function getErrorMessage(error: unknown) { return error instanceof ApiError || error instanceof Error ? error.message : "Сталася невідома помилка"; }

function DashboardIcon() { return <svg viewBox="0 0 24 24"><path d="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z" /></svg>; }
function BriefcaseIcon() { return <svg viewBox="0 0 24 24"><path d="M9 6V4h6v2h5a2 2 0 0 1 2 2v4H2V8a2 2 0 0 1 2-2h5Zm2 0h2V5h-2v1ZM2 14h20v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4Z" /></svg>; }
function UserIcon() { return <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" /></svg>; }
function ResumeIcon() { return <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z" /></svg>; }
function SearchIcon() { return <svg viewBox="0 0 24 24"><path d="m21 19.6-5.2-5.2a7 7 0 1 0-1.4 1.4L19.6 21 21 19.6ZM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z" /></svg>; }
function InfoIcon() { return <svg viewBox="0 0 24 24"><path d="M11 17h2v-6h-2v6Zm1-14a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm-1-10h2V7h-2v2Z" /></svg>; }
function EditIcon() { return <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L17.8 8.95 15.05 6.2 4 17.25ZM19.7 7.05a1 1 0 0 0 0-1.4l-1.35-1.35a1 1 0 0 0-1.4 0l-1.05 1.05 2.75 2.75 1.05-1.05Z" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24"><path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7ZM9 4h6l1 1h4v2H4V5h4l1-1Z" /></svg>; }
