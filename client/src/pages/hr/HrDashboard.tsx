/* eslint-disable @typescript-eslint/no-explicit-any */
import { useAuth } from "@clerk/react";
import {
  Autocomplete,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, apiRequest } from "../../api/apiClient";
import { AppLoader } from "../../components/common/AppLoader";
import { AppTooltip } from "../../components/common/AppTooltip";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { FormSection } from "../../components/common/FormSection";
import { RichTextEditor } from "../../components/common/RichTextEditor";
import { StatusBadge } from "../../components/common/StatusBadge";
import { CabinetLayout } from "../../layouts/CabinetLayout";
import { messages } from "../../locales/localizedMessages";
import {
  formatUkrainianPhone,
  isValidEmail,
  isValidUkrainianPhone,
  sanitizeDomainInput,
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizePositionInput,
  sanitizeRegistrationNumber,
} from "../../utils/formMasks";
import classes from "./HrDashboard.module.scss";

type CatalogItem = { id: number; name: string };
type SkillOption = CatalogItem & { category: "HARD_SKILL" | "SOFT_SKILL" | "TOOL" };
type LinkType = "WEBSITE" | "MESSENGER" | "SOCIAL" | "PORTFOLIO" | "OTHER";
type LinkItem = { id?: string; linkType: LinkType; linkName: string; value: string };
type LinkResource = { name: string; types: LinkType[]; domains?: string[]; allowAnyUrl?: boolean };
type LocationFormItem = { countryId: number; regionId?: number | null; cityId?: number | null; label: string };
type VacancyStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "ARCHIVED";
type SkillWeight = "CRITICAL" | "IMPORTANT" | "NICE_TO_HAVE";
type LanguageLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "NATIVE";
type SalaryPeriod = "PER_MONTH" | "PER_HOUR";

type HrProfile = {
  id: string;
  position: string;
  links: LinkItem[];
  user: { firstName: string; lastName: string; middleName?: string | null; photoUrl?: string | null; status: string; email?: string; createdAt?: string };
  company: { id: string; publicName: string; verificationStatus: string };
};

type CompanyProfile = {
  id: string;
  registrationType: string;
  registrationNumber: string;
  legalName: string;
  corporateDomain?: string | null;
  verificationStatus: string;
  logoUrl?: string | null;
  publicName: string;
  websiteUrl?: string | null;
  foundationYear: number;
  employeeCount?: string | null;
  about: string;
  publicEmail: string;
  publicPhone?: string | null;
  links: LinkItem[];
  spheres: Array<{ sphereId: number; sphere?: CatalogItem }>;
  locations: Array<{
    location: {
      countryId: number;
      regionId?: number | null;
      cityId?: number | null;
    };
  }>;
};

type CompanyHr = {
  id: string;
  position: string;
  user: { firstName: string; lastName: string; middleName?: string | null; photoUrl?: string | null; status: string };
};

type Catalogs = {
  languages: CatalogItem[];
  employmentTypes: CatalogItem[];
  workSchedules: CatalogItem[];
  workFormats: CatalogItem[];
  professions: CatalogItem[];
  spheres: CatalogItem[];
  countries: CatalogItem[];
  regions: Array<CatalogItem & { countryId: number }>;
  cities: Array<CatalogItem & { regionId: number }>;
  skillsByCategory: Record<string, SkillOption[]>;
  officeLocations: Array<{
    locationId: string;
    location: {
      countryId: number;
      regionId?: number | null;
      cityId?: number | null;
    };
  }>;
};

type VacancyRow = {
  id: string;
  title: string;
  status: VacancyStatus;
  description: string;
  professionId: number;
  profession?: CatalogItem;
  isLocationCritical: boolean;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: SalaryPeriod | null;
  closingDate: string;
  spheres: Array<{ sphereId: number; sphere?: CatalogItem }>;
  employmentTypes: Array<{ employmentTypeId: number; employmentType?: CatalogItem }>;
  workSchedules: Array<{ workScheduleId: number; workSchedule?: CatalogItem }>;
  workFormats: Array<{ workFormatId: number; workFormat?: CatalogItem }>;
  locations: Array<{ locationId: string; location?: { countryId: number; regionId?: number | null; cityId?: number | null } }>;
  skills: Array<{ skillId: number; weight: SkillWeight; skill?: SkillOption }>;
  languages: Array<{ languageId: number; level: LanguageLevel; language?: CatalogItem }>;
};

type VacancyFormState = {
  title: string;
  professionId: string;
  sphereIds: string[];
  description: string;
  skills: Array<{ skillId: string; weight: SkillWeight }>;
  languages: Array<{ languageId: string; level: LanguageLevel }>;
  officeLocationIds: string[];
  isLocationStrict: boolean;
  workFormatIds: string[];
  employmentTypeIds: string[];
  workScheduleIds: string[];
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryPeriod: SalaryPeriod;
  closingDate: string;
};

type VacancyOptions = {
  languages: Array<{ value: string; label: string }>;
  employmentTypes: Array<{ value: string; label: string }>;
  workSchedules: Array<{ value: string; label: string }>;
  workFormats: Array<{ value: string; label: string }>;
  professions: Array<{ value: string; label: string }>;
  spheres: Array<{ value: string; label: string }>;
  countries: Array<{ value: string; label: string }>;
  regions: Array<{ value: string; label: string }>;
  cities: Array<{ value: string; label: string }>;
  skills: Array<{ value: string; label: string; category: string }>;
  officeLocations: Array<{ value: string; label: string }>;
};

type RecruiterView = {
  fullName: string;
  position?: string | null;
  photoUrl?: string | null;
  status?: string | null;
  companyName?: string | null;
  email?: string | null;
  contacts?: LinkItem[];
  createdAt?: string | null;
  vacanciesCount?: number;
};

const ui = messages.hrDashboard;
const commonUi = messages.common;
const currentYear = new Date().getFullYear();
const maxSalaryInput = 9_999_999;
const skillWeightRank: Record<SkillWeight, number> = {
  CRITICAL: 3,
  IMPORTANT: 2,
  NICE_TO_HAVE: 1,
};

const navItems = [
  { key: "create-vacancy", label: ui.nav.createVacancy, icon: <PlusIcon />, underline: true },
  { key: "vacancies", label: ui.nav.vacancies, icon: <BriefcaseIcon />, underline: true },
  { key: "profile", label: ui.nav.profile, icon: <UserIcon /> },
  { key: "company", label: ui.nav.company, icon: <CompanyIcon /> },
];

const registrationTypes = [
  { value: "COMPANY", label: "Юридична особа" },
  { value: "FOP", label: "ФОП" },
];

const companySizes = [
  { value: "SIZE_1_10", label: "1-10" },
  { value: "SIZE_11_20", label: "11-20" },
  { value: "SIZE_21_50", label: "21-50" },
  { value: "SIZE_51_100", label: "51-100" },
  { value: "SIZE_101_200", label: "101-200" },
  { value: "SIZE_201_500", label: "201-500" },
  { value: "SIZE_501_1000", label: "501-1000" },
  { value: "SIZE_1000_PLUS", label: "1000+" },
];

const vacancyStatuses = [
  { value: "DRAFT", label: "Чернетка" },
  { value: "ACTIVE", label: "Активна" },
  { value: "ARCHIVED", label: "Архів" },
];

const skillWeights: Array<{ value: SkillWeight; label: string }> = [
  { value: "CRITICAL", label: "Критично" },
  { value: "IMPORTANT", label: "Важливо" },
  { value: "NICE_TO_HAVE", label: "Буде плюсом" },
];

const cefrLevels: Array<{ value: LanguageLevel; label: string }> = [
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "C1", label: "C1" },
  { value: "C2", label: "C2" },
  { value: "NATIVE", label: "На рівні носія" },
];

const salaryPeriods: Array<{ value: SalaryPeriod; label: string }> = [
  { value: "PER_MONTH", label: "За місяць" },
  { value: "PER_HOUR", label: "За годину" },
];

const emptyVacancyForm = (): VacancyFormState => ({
  title: "",
  professionId: "",
  sphereIds: [],
  description: "",
  skills: [],
  languages: [],
  officeLocationIds: [],
  isLocationStrict: false,
  workFormatIds: [],
  employmentTypeIds: [],
  workScheduleIds: [],
  salaryFrom: null,
  salaryTo: null,
  salaryPeriod: "PER_MONTH",
  closingDate: "",
});

const hrLinkResources: LinkResource[] = [
  { name: "Telegram", types: ["MESSENGER"], allowAnyUrl: true },
  { name: "Viber", types: ["MESSENGER"], allowAnyUrl: true },
  { name: "WhatsApp", types: ["MESSENGER"], allowAnyUrl: true },
  { name: "Signal", types: ["MESSENGER"], allowAnyUrl: true },
  { name: "LinkedIn", types: ["SOCIAL"], domains: ["linkedin.com"] },
  { name: "Facebook", types: ["SOCIAL"], domains: ["facebook.com", "fb.com"] },
  { name: "Instagram", types: ["SOCIAL"], domains: ["instagram.com"] },
];

const companyLinkResources: LinkResource[] = [
  { name: "Вебсайт", types: ["WEBSITE"], allowAnyUrl: true },
  { name: "LinkedIn", types: ["SOCIAL"], domains: ["linkedin.com"] },
  { name: "Facebook", types: ["SOCIAL"], domains: ["facebook.com", "fb.com"] },
  { name: "Instagram", types: ["SOCIAL"], domains: ["instagram.com"] },
  { name: "YouTube", types: ["SOCIAL"], domains: ["youtube.com", "youtu.be"] },
  { name: "Telegram", types: ["MESSENGER"], allowAnyUrl: true },
  { name: "Інше", types: ["OTHER"], allowAnyUrl: true },
];

/** Кабінет роботодавця з профілем рекрутера, профілем компанії та основою дошки вакансій. */
export default function HrDashboard() {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [active, setActive] = useState(initialTab && navItems.some((item) => item.key === initialTab) ? initialTab : "vacancies");
  const [selectedVacancy, setSelectedVacancy] = useState<VacancyRow | null>(null);
  const [hrProfile, setHrProfile] = useState<HrProfile | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [companyHrs, setCompanyHrs] = useState<CompanyHr[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [blockErrors, setBlockErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [vacancies, setVacancies] = useState<VacancyRow[]>([]);
  const [isCompanyPreviewOpen, setIsCompanyPreviewOpen] = useState(false);
  const [editingVacancyId, setEditingVacancyId] = useState<string | null>(null);
  const [vacancyForm, setVacancyForm] = useState<VacancyFormState>(() => emptyVacancyForm());
  const [selectedSkillDraft, setSelectedSkillDraft] = useState({ skillId: "", weight: "IMPORTANT" as SkillWeight });
  const [selectedLanguageDraft, setSelectedLanguageDraft] = useState<{ languageId: string; level: LanguageLevel | "" }>({ languageId: "", level: "" });

  const [hrForm, setHrForm] = useState({ firstName: "", lastName: "", middleName: "", position: "", links: [] as LinkItem[] });
  const [companyForm, setCompanyForm] = useState({
    registrationType: "COMPANY",
    registrationNumber: "",
    legalName: "",
    corporateDomain: "",
    logoUrl: "",
    publicName: "",
    websiteUrl: "",
    foundationYear: currentYear,
    employeeCount: "",
    about: "",
    publicEmail: "",
    publicPhone: "",
    sphereIds: [] as string[],
    locations: [] as LocationFormItem[],
    links: [] as LinkItem[],
  });
  const [newLocation, setNewLocation] = useState({ countryId: 0, regionId: 0, cityId: 0 });

  const options = useMemo(() => ({
    languages: catalogs?.languages.map(asOption) ?? [],
    employmentTypes: catalogs?.employmentTypes.map(asOption) ?? [],
    workSchedules: catalogs?.workSchedules.map(asOption) ?? [],
    workFormats: catalogs?.workFormats.map(asOption) ?? [],
    professions: catalogs?.professions.map(asOption) ?? [],
    spheres: catalogs?.spheres.map(asOption) ?? [],
    countries: catalogs?.countries.map(asOption) ?? [],
    regions: catalogs?.regions.filter((region) => region.countryId === newLocation.countryId).map(asOption) ?? [],
    cities: catalogs?.cities.filter((city) => city.regionId === newLocation.regionId).map(asOption) ?? [],
    skills: flattenSkills(catalogs?.skillsByCategory).map((skill) => ({
      value: String(skill.id),
      label: skill.name,
      category: skill.category,
    })),
    officeLocations: catalogs?.officeLocations.map((item) => ({
      value: item.locationId,
      label: formatLocationByIds({
        countryId: item.location.countryId,
        regionId: item.location.regionId ?? 0,
        cityId: item.location.cityId ?? 0,
      }, catalogs),
    })) ?? [],
  }), [catalogs, newLocation.countryId, newLocation.regionId]);

  /** Завантажує профіль рекрутера, компанію, команду та довідники. */
  const loadDashboard = async () => {
    setPageError(null);
    setIsLoading(true);
    try {
      const token = await getToken();
      const [hrData, companyData, hrsData, catalogData, vacancyData] = await Promise.all([
        apiRequest<HrProfile>("/hr-profiles/my-cabinet", token),
        apiRequest<CompanyProfile>("/companies/my-cabinet", token),
        apiRequest<CompanyHr[]>("/companies/my-cabinet/hr-profiles", token),
        apiRequest<Catalogs>("/vacancies/catalogs", token),
        apiRequest<VacancyRow[]>("/vacancies/my-cabinet", token),
      ]);
      setHrProfile(hrData);
      setCompany(companyData);
      setCompanyHrs(hrsData);
      setCatalogs(catalogData);
      setHrForm({
        firstName: hrData.user.firstName ?? "",
        lastName: hrData.user.lastName ?? "",
        middleName: hrData.user.middleName ?? "",
        position: hrData.position ?? "",
        links: hrData.links ?? [],
      });
      setCompanyForm({
        registrationType: companyData.registrationType,
        registrationNumber: companyData.registrationNumber,
        legalName: companyData.legalName,
        corporateDomain: companyData.corporateDomain ?? "",
        logoUrl: companyData.logoUrl ?? "",
        publicName: companyData.publicName,
        websiteUrl: companyData.websiteUrl ?? "",
        foundationYear: companyData.foundationYear,
        employeeCount: companyData.employeeCount ?? "",
        about: companyData.about,
        publicEmail: companyData.publicEmail,
        publicPhone: companyData.publicPhone ?? "",
        sphereIds: companyData.spheres.map((item) => String(item.sphereId)),
        locations: companyData.locations.map(({ location }) => ({
          countryId: location.countryId,
          regionId: location.regionId ?? null,
          cityId: location.cityId ?? null,
          label: formatLocationByIds({
            countryId: location.countryId,
            regionId: location.regionId ?? 0,
            cityId: location.cityId ?? 0,
          }, catalogData),
        })),
        links: companyData.links ?? [],
      });
      setVacancies(vacancyData.filter(Boolean));
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Запускає збереження окремого блоку з локальним loader та помилкою. */
  const runBlock = async (block: string, action: () => Promise<void>) => {
    setBlockErrors((current) => ({ ...current, [block]: null }));
    setSaving((current) => ({ ...current, [block]: true }));
    try {
      await action();
      await loadDashboard();
    } catch (error) {
      setBlockErrors((current) => ({ ...current, [block]: getErrorMessage(error) }));
    } finally {
      setSaving((current) => ({ ...current, [block]: false }));
    }
  };

  /** Зберігає посаду та публічні посилання рекрутера. */
  const saveHrProfile = () => runBlock("hr", async () => {
    if (!hrForm.firstName.trim() || !hrForm.lastName.trim() || !hrForm.position.trim()) throw new Error(ui.errors.required);
    validateLinks(hrForm.links, "hr");
    const token = await getToken();
    await apiRequest("/hr-profiles/my-cabinet", token, {
      method: "PATCH",
      body: JSON.stringify({
        firstName: clean(hrForm.firstName),
        lastName: clean(hrForm.lastName),
        middleName: nullable(hrForm.middleName),
        position: clean(hrForm.position),
        links: normalizeLinks(hrForm.links),
      }),
    });
  });

  /** Зберігає публічну сторінку компанії, сфери, локації та посилання. */
  const saveCompanyProfile = () => runBlock("company", async () => {
    if (!companyForm.registrationNumber.trim() || !companyForm.legalName.trim() || !companyForm.publicName.trim() || !companyForm.about.trim()) throw new Error(ui.errors.required);
    if (companyForm.sphereIds.length > 5) throw new Error(ui.errors.spheresLimit);
    if (companyForm.locations.length > 10) throw new Error(ui.errors.locationsLimit);
    if (companyForm.links.length > 6) throw new Error(ui.errors.linksLimit);
    if (companyForm.registrationType === "COMPANY" && companyForm.registrationNumber.length !== 8) throw new Error(messages.onboarding.company.edrpouError);
    if (companyForm.registrationType === "FOP" && companyForm.registrationNumber.length !== 10) throw new Error(messages.onboarding.company.ipnError);
    if (!isValidEmail(companyForm.publicEmail)) throw new Error(ui.errors.email);
    if (companyForm.publicPhone && !isValidUkrainianPhone(companyForm.publicPhone)) throw new Error(ui.errors.phone);
    if (companyForm.websiteUrl && !isValidUrlLike(companyForm.websiteUrl)) throw new Error(ui.errors.url);
    if (companyForm.logoUrl && !isValidUrlLike(companyForm.logoUrl)) throw new Error(ui.errors.url);
    if (companyForm.foundationYear < 1800 || companyForm.foundationYear > currentYear) throw new Error(ui.errors.year);
    validateLinks(companyForm.links, "company");

    const token = await getToken();
    await apiRequest("/companies/my-cabinet", token, {
      method: "PATCH",
      body: JSON.stringify({
        registrationType: companyForm.registrationType,
        registrationNumber: clean(companyForm.registrationNumber),
        legalName: clean(companyForm.legalName),
        corporateDomain: nullable(companyForm.corporateDomain),
        logoUrl: nullable(companyForm.logoUrl),
        publicName: clean(companyForm.publicName),
        websiteUrl: nullable(companyForm.websiteUrl),
        foundationYear: Number(companyForm.foundationYear),
        employeeCount: companyForm.employeeCount || null,
        about: clean(companyForm.about),
        publicEmail: clean(companyForm.publicEmail),
        publicPhone: nullable(companyForm.publicPhone),
        sphereIds: companyForm.sphereIds.map(Number),
        locations: companyForm.locations.map(({ countryId, regionId, cityId }) => ({ countryId, regionId, cityId })),
        links: normalizeLinks(companyForm.links),
      }),
    });
  });

  /** Додає локацію офісу у локальний список з перевіркою дубля. */
  const addLocation = () => {
    if (!newLocation.countryId) return;
    if (companyForm.locations.length >= 10) {
      setBlockErrors((current) => ({ ...current, company: ui.errors.locationsLimit }));
      return;
    }
    const location = {
      countryId: newLocation.countryId,
      regionId: newLocation.regionId || null,
      cityId: newLocation.cityId || null,
      label: formatLocationByIds(newLocation, catalogs),
    };
    const exists = companyForm.locations.some((item) => item.countryId === location.countryId && item.regionId === location.regionId && item.cityId === location.cityId);
    if (exists) {
      setBlockErrors((current) => ({ ...current, company: ui.errors.locationDuplicate }));
      return;
    }
    setCompanyForm((current) => ({ ...current, locations: [...current.locations, location] }));
    setNewLocation((current) => ({ countryId: current.countryId, regionId: 0, cityId: 0 }));
  };

  /** Додає або оновлює навичку у формі вакансії. */
  const upsertVacancySkill = () => {
    if (!selectedSkillDraft.skillId) return;
    setVacancyForm((current) => {
      const exists = current.skills.some((item) => item.skillId === selectedSkillDraft.skillId);
      return {
        ...current,
        skills: exists
          ? current.skills.map((item) => item.skillId === selectedSkillDraft.skillId ? { ...item, weight: selectedSkillDraft.weight } : item)
          : [...current.skills, { ...selectedSkillDraft }],
      };
    });
    setSelectedSkillDraft((current) => ({ skillId: "", weight: current.weight }));
    setBlockErrors((current) => ({ ...current, vacancy: null }));
  };

  /** Додає або оновлює мовну вимогу у формі вакансії. */
  const upsertVacancyLanguage = () => {
    if (!selectedLanguageDraft.languageId || !selectedLanguageDraft.level) return;
    const languageDraft = {
      languageId: selectedLanguageDraft.languageId,
      level: selectedLanguageDraft.level as LanguageLevel,
    };
    setVacancyForm((current) => {
      const exists = current.languages.some((item) => item.languageId === languageDraft.languageId);
      return {
        ...current,
        languages: exists
          ? current.languages.map((item) => item.languageId === languageDraft.languageId ? { ...item, level: languageDraft.level } : item)
          : [...current.languages, languageDraft],
      };
    });
    setSelectedLanguageDraft({ languageId: "", level: "" });
    setBlockErrors((current) => ({ ...current, vacancy: null }));
  };

  /** Заповнює форму даними вакансії для редагування. */
  const startVacancyEdit = (vacancy: VacancyRow) => {
    setEditingVacancyId(vacancy.id);
    setVacancyForm(vacancyToForm(vacancy));
    setSelectedVacancy(null);
    setIsCompanyPreviewOpen(false);
    setActive("vacancies");
    setSearchParams({});
    setBlockErrors((current) => ({ ...current, vacancy: null }));
  };

  /** Очищає форму вакансії та повертає її в режим створення. */
  const clearVacancyForm = () => {
    setEditingVacancyId(null);
    setVacancyForm(emptyVacancyForm());
    setSelectedSkillDraft({ skillId: "", weight: "IMPORTANT" });
    setSelectedLanguageDraft({ languageId: "", level: "" });
    setBlockErrors((current) => ({ ...current, vacancy: null }));
  };

  /** Створює або оновлює вакансію через backend API. */
  const saveVacancy = (status: "DRAFT" | "ACTIVE") => runBlock("vacancy", async () => {
    validateVacancyForm(vacancyForm, options.officeLocations.length);
    const token = await getToken();
    const path = editingVacancyId ? `/vacancies/my-cabinet/${editingVacancyId}` : "/vacancies/my-cabinet";
    await apiRequest(path, token, {
      method: editingVacancyId ? "PATCH" : "POST",
      body: JSON.stringify(vacancyFormToPayload({ ...vacancyForm, status })),
    });
    clearVacancyForm();
    setActive("vacancies");
    setSearchParams({});
  });

  /** Змінює статус вакансії з таблиці управління. */
  const changeVacancyStatus = (vacancyId: string, status: VacancyStatus) => runBlock("vacancyBoard", async () => {
    const token = await getToken();
    await apiRequest(`/vacancies/my-cabinet/${vacancyId}/status`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  });

  /** Архівує вакансію з таблиці управління. */
  const archiveVacancy = (vacancyId: string) => runBlock("vacancyBoard", async () => {
    const token = await getToken();
    await apiRequest(`/vacancies/my-cabinet/${vacancyId}/archive`, token, { method: "POST" });
  });

  if (isLoading) return <AppLoader text={ui.loading} />;

  return (
    <CabinetLayout navItems={navItems} activeKey={active} onSelect={(key) => {
      setSelectedVacancy(null);
      setIsCompanyPreviewOpen(false);
      if (key === "create-vacancy") clearVacancyForm();
      if (key !== "vacancies") setEditingVacancyId(null);
      setActive(key);
      setSearchParams(key === "vacancies" ? {} : { tab: key });
    }}>
      <Stack gap="md">
        <ErrorBanner message={pageError} />
        {isCompanyPreviewOpen ? (
          <CompanyPublicPage company={company} companyHrs={companyHrs} vacancies={vacancies} onBack={() => setIsCompanyPreviewOpen(false)} />
        ) : (
          <>
            {active === "create-vacancy" && (
              <CreateVacancyTab
                form={vacancyForm}
                setForm={setVacancyForm}
                editingVacancy={null}
                options={options}
                skillsByCategory={catalogs?.skillsByCategory ?? {}}
                selectedSkillDraft={selectedSkillDraft}
                setSelectedSkillDraft={setSelectedSkillDraft}
                selectedLanguageDraft={selectedLanguageDraft}
                setSelectedLanguageDraft={setSelectedLanguageDraft}
                error={blockErrors.vacancy}
                saving={saving.vacancy}
                onAddSkill={upsertVacancySkill}
                onAddLanguage={upsertVacancyLanguage}
                onClear={clearVacancyForm}
                onSave={saveVacancy}
              />
            )}
            {active === "vacancies" && (
              editingVacancyId
                ? <VacancyEditPage
                    vacancy={vacancies.find((vacancy) => vacancy.id === editingVacancyId) ?? null}
                    form={vacancyForm}
                    setForm={setVacancyForm}
                    options={options}
                    skillsByCategory={catalogs?.skillsByCategory ?? {}}
                    selectedSkillDraft={selectedSkillDraft}
                    setSelectedSkillDraft={setSelectedSkillDraft}
                    selectedLanguageDraft={selectedLanguageDraft}
                    setSelectedLanguageDraft={setSelectedLanguageDraft}
                    error={blockErrors.vacancy}
                    saving={saving.vacancy}
                    onAddSkill={upsertVacancySkill}
                    onAddLanguage={upsertVacancyLanguage}
                    onClear={clearVacancyForm}
                    onSave={saveVacancy}
                    onBack={clearVacancyForm}
                  />
                : selectedVacancy
                  ? <VacancyDetail vacancy={selectedVacancy} onBack={() => setSelectedVacancy(null)} />
                  : <VacancyBoard vacancies={vacancies} onSelect={setSelectedVacancy} onEdit={startVacancyEdit} onStatusChange={changeVacancyStatus} onArchive={archiveVacancy} />
            )}
            {active === "profile" && <HrProfileTab profile={hrProfile} form={hrForm} setForm={setHrForm} error={blockErrors.hr} saving={saving.hr} vacanciesCount={vacancies.length} onCompanyOpen={() => setIsCompanyPreviewOpen(true)} onClearError={() => setBlockErrors((current) => ({ ...current, hr: null }))} onSave={saveHrProfile} />}
            {active === "company" && (
              <CompanyProfileTab
                company={company}
                companyHrs={companyHrs}
                form={companyForm}
                setForm={setCompanyForm}
                options={options}
                newLocation={newLocation}
                setNewLocation={setNewLocation}
                error={blockErrors.company}
                saving={saving.company}
                onAddLocation={addLocation}
                onPreview={() => setIsCompanyPreviewOpen(true)}
                onClearError={() => setBlockErrors((current) => ({ ...current, company: null }))}
                onSave={saveCompanyProfile}
              />
            )}
          </>
        )}
      </Stack>
    </CabinetLayout>
  );
}

function VacancyBoard({ vacancies, onSelect, onEdit, onStatusChange, onArchive }: { vacancies: VacancyRow[]; onSelect: (vacancy: VacancyRow) => void; onEdit: (vacancy: VacancyRow) => void; onStatusChange: (vacancyId: string, status: VacancyStatus) => void; onArchive: (vacancyId: string) => void }) {
  return <><TabHeader title={ui.vacancies.title} description={ui.vacancies.description} /><FormSection title={ui.vacancies.title}>
    {vacancies.length ? <Table highlightOnHover className={classes.table}><Table.Thead><Table.Tr><Table.Th>{ui.vacancies.position}</Table.Th><Table.Th>{ui.vacancies.responses}</Table.Th><Table.Th>{ui.vacancies.status}</Table.Th><Table.Th>{ui.vacancies.actions}</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{vacancies.map((vacancy) => <Table.Tr key={vacancy.id} onDoubleClick={() => onSelect(vacancy)}><Table.Td><Text fw={900}>{vacancy.title}</Text><Text className={classes.muted}>{vacancy.profession?.name}</Text></Table.Td><Table.Td>0</Table.Td><Table.Td><Select size="xs" data={vacancyStatuses} value={vacancy.status} onChange={(status) => status && onStatusChange(vacancy.id, status as VacancyStatus)} /></Table.Td><Table.Td><Group gap="xs"><AppTooltip label={ui.vacancies.edit}><button type="button" className={classes.actionIconButton} onClick={() => onEdit(vacancy)}><EditIcon /></button></AppTooltip><AppTooltip label={ui.vacancies.close}><button type="button" className={classes.actionIconButton} data-danger="true" onClick={() => onArchive(vacancy.id)}><ArchiveIcon /></button></AppTooltip></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table> : <Text className={classes.muted}>{ui.vacancies.empty}</Text>}
  </FormSection></>;
}

function VacancyDetail({ vacancy, onBack }: { vacancy: VacancyRow; onBack: () => void }) {
  const stages = Object.values(ui.vacancies.tabs);
  return <><button type="button" className={classes.backButton} onClick={onBack}><ArrowIcon /> {ui.vacancies.back}</button><TabHeader title={vacancy.title} description={ui.vacancies.pipelineDescription} /><FormSection title={ui.vacancies.pipelineTitle}><div className={classes.pipelineTabs}>{stages.map((stage, index) => <button key={stage} className={index === 0 ? classes.pipelineTabActive : classes.pipelineTab}>{stage}<span>0</span></button>)}</div></FormSection></>;
}

function VacancyEditPage(props: Omit<Parameters<typeof CreateVacancyTab>[0], "editingVacancy"> & { vacancy: VacancyRow | null; onBack: () => void }) {
  const { vacancy, onBack, ...formProps } = props;
  return <>
    <button type="button" className={classes.backButton} onClick={onBack}><ArrowIcon /> {ui.vacancies.back}</button>
    <CreateVacancyTab {...formProps} editingVacancy={vacancy} />
  </>;
}

function CreateVacancyTab(props: {
  form: VacancyFormState;
  setForm: (form: VacancyFormState) => void;
  editingVacancy: VacancyRow | null;
  options: VacancyOptions;
  skillsByCategory: Record<string, SkillOption[]>;
  selectedSkillDraft: { skillId: string; weight: SkillWeight };
  setSelectedSkillDraft: (value: { skillId: string; weight: SkillWeight }) => void;
  selectedLanguageDraft: { languageId: string; level: LanguageLevel | "" };
  setSelectedLanguageDraft: (value: { languageId: string; level: LanguageLevel | "" }) => void;
  error?: string | null;
  saving?: boolean;
  onAddSkill: () => void;
  onAddLanguage: () => void;
  onClear: () => void;
  onSave: (status: "DRAFT" | "ACTIVE") => void;
}) {
  const { form, setForm, editingVacancy, options, skillsByCategory, selectedSkillDraft, setSelectedSkillDraft, selectedLanguageDraft, setSelectedLanguageDraft, error, saving, onAddSkill, onAddLanguage, onClear, onSave } = props;
  const isEditingActiveVacancy = editingVacancy?.status === "ACTIVE";
  return <>
    <TabHeader title={editingVacancy ? ui.createVacancy.editTitle : ui.createVacancy.title} description={ui.createVacancy.description} />
    <FormSection title={ui.createVacancy.basicTitle} description={ui.createVacancy.basicDescription}>
      <div className={classes.grid}>
        <TextInput className={classes.fullRow} required label={ui.createVacancy.titleField} placeholder={ui.createVacancy.titlePlaceholder} maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.currentTarget.value })} />
        <Select required searchable label={ui.createVacancy.profession} placeholder={ui.createVacancy.professionPlaceholder} data={options.professions} value={form.professionId || null} onChange={(value) => setForm({ ...form, professionId: value ?? "" })} />
        <MultiSelect classNames={{ pill: classes.spherePill }} required searchable maxValues={3} label={ui.createVacancy.spheres} placeholder={ui.createVacancy.spheresPlaceholder} data={options.spheres} value={form.sphereIds} onChange={(sphereIds) => setForm({ ...form, sphereIds })} />
      </div>
    </FormSection>
    <FormSection title={ui.createVacancy.descriptionTitle} description={ui.createVacancy.descriptionBlockDescription}>
      <RichTextEditor value={form.description} onChange={(description) => setForm({ ...form, description })} placeholder={ui.createVacancy.descriptionPlaceholder} />
    </FormSection>
    <FormSection title={ui.createVacancy.requirementsTitle} description={ui.createVacancy.requirementsDescription}>
      <div className={`${classes.skillInputRow} ${classes.languageInputRow}`}>
        <Select label={ui.createVacancy.skillWeight} data={skillWeights} value={selectedSkillDraft.weight} onChange={(weight) => setSelectedSkillDraft({ ...selectedSkillDraft, weight: (weight ?? "IMPORTANT") as SkillWeight })} />
        <Select searchable clearable label={ui.createVacancy.skill} placeholder={ui.createVacancy.skillPlaceholder} data={options.skills} value={selectedSkillDraft.skillId || null} onChange={(skillId) => setSelectedSkillDraft({ ...selectedSkillDraft, skillId: skillId ?? "" })} />
        <Button variant="light" onClick={onAddSkill} disabled={!selectedSkillDraft.skillId}>{ui.createVacancy.addSkill}</Button>
      </div>
      <VacancySkillGroups form={form} setForm={setForm} skillsByCategory={skillsByCategory} onSelectSkill={(skill) => setSelectedSkillDraft(skill)} />
      <div className={classes.skillInputRow}>
        <Select searchable clearable label={ui.createVacancy.language} placeholder={ui.createVacancy.languagePlaceholder} data={options.languages} value={selectedLanguageDraft.languageId || null} onChange={(languageId) => setSelectedLanguageDraft({ ...selectedLanguageDraft, languageId: languageId ?? "" })} />
        <Select clearable label={ui.createVacancy.languageLevel} placeholder={ui.createVacancy.languageLevelPlaceholder} data={cefrLevels} value={selectedLanguageDraft.level || null} onChange={(level) => setSelectedLanguageDraft({ ...selectedLanguageDraft, level: (level ?? "") as LanguageLevel | "" })} />
        <Button variant="light" onClick={onAddLanguage} disabled={!selectedLanguageDraft.languageId || !selectedLanguageDraft.level}>{ui.createVacancy.addLanguage}</Button>
      </div>
      <div className={classes.languageChips}>{form.languages.map((item) => <button type="button" className={classes.languageChip} key={item.languageId} onClick={() => setSelectedLanguageDraft(item)}>{findLabel(options.languages, item.languageId)} - {languageLevelLabel(item.level)}<span onClick={(event) => { event.stopPropagation(); setForm({ ...form, languages: form.languages.filter((language) => language.languageId !== item.languageId) }); }}>×</span></button>)}</div>
    </FormSection>
    <FormSection title={ui.createVacancy.conditionsTitle} description={ui.createVacancy.conditionsDescription}>
      <div className={classes.locationStrictRow}>
        <MultiSelect classNames={{ pill: classes.locationPill }} required label={ui.createVacancy.officeLocations} data={options.officeLocations} value={form.officeLocationIds} onChange={(officeLocationIds) => setForm({ ...form, officeLocationIds })} />
        <Checkbox className={`${classes.inlineCheckbox} ${classes.locationStrictCheckbox}`} label={ui.createVacancy.locationStrict} checked={form.isLocationStrict} onChange={(event) => setForm({ ...form, isLocationStrict: event.currentTarget.checked })} />
      </div>
      <div className={classes.conditionsGrid}>
        <Checkbox.Group className={classes.checkboxGroup} label={ui.createVacancy.workFormats} value={form.workFormatIds} onChange={(workFormatIds) => setForm({ ...form, workFormatIds })}>{options.workFormats.map((item) => <Checkbox key={item.value} value={item.value} label={item.label} />)}</Checkbox.Group>
        <Checkbox.Group className={classes.checkboxGroup} label={ui.createVacancy.employmentTypes} value={form.employmentTypeIds} onChange={(employmentTypeIds) => setForm({ ...form, employmentTypeIds })}>{options.employmentTypes.map((item) => <Checkbox key={item.value} value={item.value} label={item.label} />)}</Checkbox.Group>
        <Checkbox.Group className={classes.checkboxGroup} label={ui.createVacancy.workSchedules} value={form.workScheduleIds} onChange={(workScheduleIds) => setForm({ ...form, workScheduleIds })}>{options.workSchedules.map((item) => <Checkbox key={item.value} value={item.value} label={item.label} />)}</Checkbox.Group>
      </div>
      <Text className={classes.subsectionTitle}>{ui.createVacancy.salaryRange}</Text>
      <Text className={classes.subsectionDescription}>{ui.createVacancy.salaryRangeDescription}</Text>
      <div className={classes.salaryFields}>
        <Select label={ui.createVacancy.salaryPeriod} data={salaryPeriods} value={form.salaryPeriod} onChange={(salaryPeriod) => setForm({ ...form, salaryPeriod: (salaryPeriod ?? "PER_MONTH") as SalaryPeriod })} />
        <NumberInput label={ui.createVacancy.minSalary} min={0} max={maxSalaryInput} step={1000} allowNegative={false} allowDecimal={false} value={form.salaryFrom ?? ""} onChange={(value) => setForm({ ...form, salaryFrom: normalizeSalaryInput(value, form.salaryFrom), salaryTo: value === "" ? null : form.salaryTo })} />
        <NumberInput label={ui.createVacancy.maxSalary} min={form.salaryFrom ?? 0} max={maxSalaryInput} step={1000} allowNegative={false} allowDecimal={false} disabled={form.salaryFrom === null} value={form.salaryTo ?? ""} onChange={(value) => setForm({ ...form, salaryTo: normalizeSalaryInput(value, form.salaryTo) })} />
      </div>
    </FormSection>
    <FormSection title={ui.createVacancy.publishTitle} description={ui.createVacancy.publishDescription}>
      <DateInput required label={ui.createVacancy.closingDate} placeholder={ui.createVacancy.closingDatePlaceholder} value={form.closingDate ? new Date(form.closingDate) : null} onChange={(value) => setForm({ ...form, closingDate: value ? dayjs(value).format("YYYY-MM-DD") : "" })} valueFormat="DD.MM.YYYY" locale="uk" minDate={dayjs().add(1, "day").toDate()} clearable popoverProps={{ position: "bottom-end", withinPortal: true }} />
      <InlineError message={error} />
      <div className={classes.vacancyActions}>
        <Button variant="light" onClick={onClear}>{commonUi.actions.clear}</Button>
        <Button variant="light" className={classes.outlineActionButton} leftSection={<SaveIcon />} loading={saving} onClick={() => onSave("DRAFT")}>{ui.createVacancy.saveDraft}</Button>
        <Button leftSection={<PublishIcon />} loading={saving} onClick={() => onSave("ACTIVE")}>{isEditingActiveVacancy ? ui.createVacancy.updatePublished : ui.createVacancy.publishNow}</Button>
      </div>
    </FormSection>
  </>;
}

function HrProfileTab({ profile, form, setForm, error, saving, vacanciesCount, onCompanyOpen, onClearError, onSave }: any) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fullName = [profile?.user.lastName, profile?.user.firstName, profile?.user.middleName].filter(Boolean).join(" ");
  const recruiterView = {
    fullName,
    position: profile?.position,
    photoUrl: profile?.user.photoUrl,
    status: profile?.user.status,
    companyName: profile?.company.publicName,
    email: profile?.user.email,
    contacts: profile?.links ?? [],
    createdAt: profile?.user.createdAt,
    vacanciesCount,
  };
  return <>
    <RecruiterPreviewDrawer opened={isPreviewOpen} data={recruiterView} onClose={() => setIsPreviewOpen(false)} onCompanyOpen={() => { setIsPreviewOpen(false); onCompanyOpen(); }} />

    <div className={classes.profileHeaderRow}>
      <TabHeader title={ui.profile.title} description={ui.profile.description} />
      <RecruiterCard data={recruiterView} onClick={() => setIsPreviewOpen(true)} />
    </div>
    <div className={classes.tipBlock}>
      <Text className={classes.tipTitle}>{ui.profile.tipTitle}</Text>
      <Text>{ui.profile.tipText}</Text>
    </div>
    <FormSection title={ui.profile.title}>
      <div className={classes.profileMetaLine}>
        <StatusBadge status={profile?.user.status} />
        <Text className={classes.muted}>{ui.profile.createdAt}: {profile?.user.createdAt ? dateShort(profile.user.createdAt) : ui.profile.unknownDate}</Text>
      </div>
      <Text className={classes.companyText}>{ui.profile.company}: <button type="button" onClick={onCompanyOpen}>{profile?.company.publicName}</button></Text>
      <div className={classes.grid}>
        <TextInput required label={ui.profile.firstName} maxLength={100} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: sanitizeNameInput(event.currentTarget.value) })} />
        <TextInput label={ui.profile.middleName} maxLength={100} value={form.middleName} onChange={(event) => setForm({ ...form, middleName: sanitizeNameInput(event.currentTarget.value) })} />
        <TextInput required label={ui.profile.lastName} maxLength={100} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: sanitizeNameInput(event.currentTarget.value) })} />
        <TextInput required label={ui.profile.position} placeholder={ui.profile.positionPlaceholder} maxLength={150} value={form.position} onChange={(event) => setForm({ ...form, position: sanitizePositionInput(event.currentTarget.value) })} />
      </div>
    </FormSection>
    <FormSection title={ui.profile.linksTitle} description={ui.profile.linksDescription}>
      <InfoRow label={ui.profile.contactEmail} value={profile?.user.email} />
      <LinkEditor links={form.links} setLinks={(links) => { setForm({ ...form, links }); onClearError(); }} mode="hr" />
      <InlineError message={error} />
      <Button className={classes.fullButton} loading={saving} onClick={onSave}>{ui.profile.save}</Button>
    </FormSection>
  </>;
}

/** Єдина компактна візитка рекрутера для кабінету, вакансій і публічних сторінок. */
function RecruiterCard({ data, onClick }: { data: RecruiterView; onClick: () => void }) {
  return <button type="button" className={classes.recruiterCard} onClick={onClick}>
    <Avatar src={data.photoUrl} size={48} radius="xl" className={classes.avatarRing} />
    <span>
      <strong>{data.fullName}</strong>
      <small>{data.position}</small>
    </span>
  </button>;
}

/** Єдина бічна панель перегляду публічної інформації рекрутера. */
function RecruiterPreviewDrawer({ opened, data, onClose, onCompanyOpen }: { opened: boolean; data: RecruiterView | null; onClose: () => void; onCompanyOpen?: () => void }) {
  const progress = getRecruiterProgress(data);
  return <Drawer opened={opened} onClose={onClose} position="right" size="sm" title={ui.profile.previewTitle}>
    <div className={classes.recruiterPreview}>
      <div className={classes.recruiterStickyHeader}>
        <div className={classes.previewHeader}>
          <Avatar src={data?.photoUrl} size={82} radius="xl" className={classes.avatarRing} />
          <div>
            <Text fw={950}>{data?.fullName}</Text>
            <Text className={classes.muted}>{data?.position}</Text>
          </div>
        </div>
        <div className={classes.previewProgress}><span style={{ width: `${progress}%` }} /></div>
      </div>
      <div className={classes.recruiterPreviewBody}>
        <InfoRow label={ui.profile.company} value={data?.companyName} actionLabel={ui.profile.openCompany} onClick={onCompanyOpen} />
        <InfoRow label={ui.profile.position} value={data?.position} />
        {data?.email && <ContactCopyRow label={ui.profile.email} value={data.email} />}
        {data?.contacts?.map((contact) => <ContactCopyRow key={`${contact.linkName}-${contact.value}`} label={contact.linkName} value={contact.value} />)}
        {data?.createdAt && <InfoRow label={ui.profile.createdAt} value={dateShort(data.createdAt)} />}
        {typeof data?.vacanciesCount === "number" && <InfoRow label={ui.profile.activeVacancies} value={String(data.vacanciesCount)} />}
        {typeof data?.vacanciesCount === "number" && <details className={classes.vacancyDetails}>
          <summary>{ui.profile.vacanciesList}</summary>
          <Text className={classes.muted}>{ui.vacancies.empty}</Text>
        </details>}
      </div>
    </div>
  </Drawer>;
}

function CompanyProfileTab(props: any) {
  const { company, companyHrs, form, setForm, options, newLocation, setNewLocation, error, saving, onAddLocation, onPreview, onClearError, onSave } = props;
  return <><div className={classes.headerRow}><TabHeader title={ui.company.title} description={ui.company.description} /><Button variant="outline" className={classes.previewOutlineButton} onClick={onPreview}>{ui.company.preview}</Button></div>
    <FormSection title={ui.company.publicTitle}>
      <div className={classes.companyHero}><Avatar src={form.logoUrl} size="xl" radius="md" /><div><Text fw={900}>{form.publicName || company?.publicName}</Text><ModerationBadge status={company?.verificationStatus} /></div></div>
      <div className={classes.grid}>
        <TextInput required label={ui.company.publicName} maxLength={100} value={form.publicName} onChange={(e) => setForm({ ...form, publicName: e.currentTarget.value })} />
        <NumberInput required label={ui.company.foundationYear} min={1800} max={currentYear} step={1} allowDecimal={false} allowNegative={false} clampBehavior="strict" value={form.foundationYear} onChange={(value) => setForm({ ...form, foundationYear: Number(value) || currentYear })} />
        <Select label={ui.company.employeeCount} data={companySizes} value={form.employeeCount || null} onChange={(value) => setForm({ ...form, employeeCount: value ?? "" })} />
        <TextInput label={ui.company.websiteUrl} placeholder="https://company.ua" maxLength={255} value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.currentTarget.value })} />
        <TextInput className={classes.fullRow} label={ui.company.logoUrl} placeholder={messages.studentDashboard.resourcePlaceholder} maxLength={255} value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.currentTarget.value })} />
      </div>
    </FormSection>
    <FormSection title={ui.company.aboutTitle} description={ui.company.aboutDescription}>
      <RichTextEditor value={form.about} onChange={(about) => setForm({ ...form, about })} />
      <div className={classes.editorActions}>
        <Button variant="light" onClick={() => { setForm({ ...form, about: "" }); onClearError(); }}>{commonUi.actions.clear}</Button>
        <Button loading={saving} onClick={onSave}>{commonUi.actions.save}</Button>
      </div>
    </FormSection>
    <FormSection title={ui.company.legalTitle}>
      <div className={classes.grid}><Select required label={ui.company.registrationType} data={registrationTypes} value={form.registrationType} onChange={(value) => setForm({ ...form, registrationType: value ?? "COMPANY", registrationNumber: "" })} /><TextInput required label={ui.company.registrationNumber} maxLength={form.registrationType === "FOP" ? 10 : 8} value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: sanitizeRegistrationNumber(e.currentTarget.value, form.registrationType) })} /><TextInput required className={classes.fullRow} label={ui.company.legalName} maxLength={200} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.currentTarget.value })} /><TextInput label={ui.company.corporateDomain} placeholder="company.ua" maxLength={100} value={form.corporateDomain} onChange={(e) => setForm({ ...form, corporateDomain: sanitizeDomainInput(e.currentTarget.value) })} /></div>
    </FormSection>
    <FormSection title={ui.company.contactsTitle}>
      <div className={classes.grid}><TextInput required label={ui.company.publicEmail} value={form.publicEmail} onChange={(e) => setForm({ ...form, publicEmail: sanitizeEmailInput(e.currentTarget.value) })} /><TextInput label={ui.company.publicPhone} value={form.publicPhone} onChange={(e) => setForm({ ...form, publicPhone: formatUkrainianPhone(e.currentTarget.value) })} /></div>
      <LinkEditor links={form.links} setLinks={(links) => { setForm({ ...form, links }); onClearError(); }} mode="company" />
    </FormSection>
    <FormSection title={ui.company.spheresTitle}><MultiSelect classNames={{ pill: classes.spherePill }} data={options.spheres} searchable maxValues={5} value={form.sphereIds} onChange={(sphereIds) => setForm({ ...form, sphereIds })} /></FormSection>
    <FormSection title={ui.company.locationsTitle}>
      <div className={classes.chips}>{form.locations.map((location: LocationFormItem) => <button key={location.label} className={classes.locationChip} onClick={() => setForm({ ...form, locations: form.locations.filter((item: LocationFormItem) => item.label !== location.label) })}>{location.label} ×</button>)}</div>
      <div className={classes.threeGrid}><Select label={ui.company.country} data={options.countries} value={newLocation.countryId ? String(newLocation.countryId) : null} onChange={(value) => setNewLocation({ countryId: Number(value), regionId: 0, cityId: 0 })} /><Select label={ui.company.region} data={options.regions} disabled={!newLocation.countryId} value={newLocation.regionId ? String(newLocation.regionId) : null} onChange={(value) => setNewLocation({ ...newLocation, regionId: Number(value), cityId: 0 })} /><Select label={ui.company.city} data={options.cities} disabled={!newLocation.regionId} value={newLocation.cityId ? String(newLocation.cityId) : null} onChange={(value) => setNewLocation({ ...newLocation, cityId: Number(value) })} /></div>
      <Button variant="light" onClick={onAddLocation} disabled={form.locations.length >= 10}>{ui.company.addLocation}</Button>
    </FormSection>
    <FormSection title={ui.company.teamTitle}><div className={classes.hrCards}>{companyHrs.map((hr: CompanyHr) => <div key={hr.id} className={classes.hrCard}><Avatar src={hr.user.photoUrl} radius="xl" /><div><Text fw={900}>{[hr.user.lastName, hr.user.firstName].filter(Boolean).join(" ")}</Text><Text className={classes.muted}>{hr.position}</Text></div></div>)}</div></FormSection>
    <InlineError message={error} /><Button className={classes.fullButton} loading={saving} onClick={onSave}>{ui.company.save}</Button>
  </>;
}

function CompanyPublicPage({ company, companyHrs, vacancies, onBack }: { company: CompanyProfile | null; companyHrs: CompanyHr[]; vacancies: VacancyRow[]; onBack: () => void }) {
  const [selectedHr, setSelectedHr] = useState<CompanyHr | null>(null);
  const selectedRecruiterView = selectedHr ? {
    fullName: formatHrName(selectedHr),
    position: selectedHr.position,
    photoUrl: selectedHr.user.photoUrl,
    status: selectedHr.user.status,
    companyName: company?.publicName,
  } : null;

  return <div className={classes.companyPreviewPage}>
    <RecruiterPreviewDrawer opened={Boolean(selectedRecruiterView)} data={selectedRecruiterView} onClose={() => setSelectedHr(null)} />

    <button type="button" className={classes.backButton} onClick={onBack}><ArrowIcon /> {ui.company.backToCabinet}</button>
    <div className={classes.previewShellLabel}>{ui.company.publicProfile}</div>
    <section className={classes.companyPreviewHero}>
      <Avatar src={company?.logoUrl} size={96} radius="lg" />
      <div>
        <Title order={1}>{company?.publicName}</Title>
        <ModerationBadge status={company?.verificationStatus} />
      </div>
    </section>
    <div className={classes.companyPreviewGrid}>
      <section className={classes.companyPreviewMain}>
        <FormSection title={ui.company.aboutTitle}>
          <div className={classes.richPreview} dangerouslySetInnerHTML={{ __html: company?.about || ui.company.emptyAbout }} />
        </FormSection>
        <FormSection title={ui.company.vacanciesTitle}>
          {vacancies.length ? <div className={classes.publicVacancyList}>{vacancies.map((vacancy) => <button type="button" key={vacancy.id}>{vacancy.title}<Badge>{statusLabel(vacancy.status)}</Badge></button>)}</div> : <Text className={classes.muted}>{ui.vacancies.empty}</Text>}
        </FormSection>
      </section>
      <aside className={classes.companyPreviewAside}>
        <div className={classes.publicChipBlock}>
          <Text fw={900}>{ui.company.spheresTitle}</Text>
          <div className={classes.chips}>{company?.spheres?.map((item) => <span className={classes.sphereChip} key={item.sphereId}>{item.sphere?.name ?? item.sphereId}</span>)}</div>
        </div>
        <div className={classes.publicChipBlock}>
          <Text fw={900}>{ui.company.contactsTitle}</Text>
          <Text className={classes.publicContactsNote}>{ui.company.contactsDescription}</Text>
          <ContactCopyRow value={company?.publicEmail} />
          <ContactCopyRow value={company?.publicPhone} normalizeCopy={normalizePhone} />
          <CompanyPublicLinks links={getCompanyPublicLinks(company)} />
        </div>
        <InfoRow label={ui.company.foundationYear} value={company?.foundationYear ? String(company.foundationYear) : null} />
        <InfoRow label={ui.company.employeeCount} value={company?.employeeCount ? companySizeLabel(company.employeeCount) : null} />
        <div className={classes.publicChipBlock}>
          <Text fw={900}>{ui.company.teamTitle}</Text>
          <div className={classes.hrCards}>{companyHrs.map((hr) => <RecruiterCard key={hr.id} data={{ fullName: formatHrName(hr), position: hr.position, photoUrl: hr.user.photoUrl }} onClick={() => setSelectedHr(hr)} />)}</div>
        </div>
      </aside>
    </div>
  </div>;
}

/** Формує публічний список посилань компанії разом із веб-сайтом із візитки. */
function getCompanyPublicLinks(company: CompanyProfile | null): LinkItem[] {
  const website = company?.websiteUrl ? [{ linkType: "WEBSITE" as LinkType, linkName: ui.company.websiteUrl, value: company.websiteUrl }] : [];
  return [...website, ...(company?.links ?? [])].filter((link) => link.value);
}

/** Показує публічні посилання компанії з діями копіювання та відкриття. */
function CompanyPublicLinks({ links }: { links: LinkItem[] }) {
  if (!links.length) return null;

  return <div className={classes.publicLinks}>{links.map((link, index) => {
    const href = normalizeHref(link.value);
    return <div className={classes.publicLinkRow} key={`${link.linkName}-${index}`}>
      <AppTooltip label={link.value}>
        {href ? <a href={href} target="_blank" rel="noreferrer">{link.linkName}</a> : <span>{link.linkName}: {link.value}</span>}
      </AppTooltip>
      <span className={classes.publicLinkActions}>
        {href && <AppTooltip label={messages.studentDashboard.resumePreview.open}><button type="button" onClick={() => window.open(href, "_blank", "noopener,noreferrer")}><OpenIcon /></button></AppTooltip>}
        <AppTooltip label={messages.studentDashboard.resumePreview.copy}><button type="button" onClick={() => copyToClipboard(link.value)}><CopyIcon /></button></AppTooltip>
      </span>
    </div>;
  })}</div>;
}

/** Групує обрані навички вакансії за категоріями та показує вагу як колір плашки. */
function VacancySkillGroups({ form, setForm, skillsByCategory, onSelectSkill }: { form: VacancyFormState; setForm: (form: VacancyFormState) => void; skillsByCategory: Record<string, SkillOption[]>; onSelectSkill: (skill: { skillId: string; weight: SkillWeight }) => void }) {
  const categories = Object.entries(skillsByCategory)
    .map(([category, skills]) => ({
      category,
      skills: form.skills
        .map((item) => ({ ...item, skill: skills.find((skill) => String(skill.id) === item.skillId) }))
        .filter((item) => Boolean(item.skill))
        .sort((first, second) => skillWeightRank[second.weight] - skillWeightRank[first.weight]),
    }))
    .filter((group) => group.skills.length > 0);

  if (categories.length === 0) return <Text className={classes.muted}>{ui.createVacancy.emptySkills}</Text>;

  return <div className={classes.skillGroups}>{categories.map((group) => <div key={group.category}>
    <Text fw={900}>{skillCategoryLabel(group.category)}</Text>
    <div className={classes.skillChips}>{group.skills.map((item) => <button type="button" data-weight={item.weight} key={item.skillId} onClick={() => onSelectSkill({ skillId: item.skillId, weight: item.weight })}>{item.skill?.name}<span onClick={(event) => { event.stopPropagation(); setForm({ ...form, skills: form.skills.filter((skill) => skill.skillId !== item.skillId) }); }}>×</span></button>)}</div>
  </div>)}</div>;
}

function LinkEditor({ links, setLinks, mode }: { links: LinkItem[]; setLinks: (links: LinkItem[]) => void; mode: "hr" | "company" }) {
  const resources = mode === "hr" ? hrLinkResources : companyLinkResources;
  const allowedTypes = mode === "hr" ? ["MESSENGER", "SOCIAL"] : ["WEBSITE", "MESSENGER", "SOCIAL", "OTHER"];
  const categories = [
    { value: "WEBSITE", label: messages.studentDashboard.linksEditor.categories.website },
    { value: "MESSENGER", label: messages.studentDashboard.linksEditor.categories.messenger },
    { value: "SOCIAL", label: messages.studentDashboard.linksEditor.categories.social },
    { value: "OTHER", label: messages.studentDashboard.linksEditor.categories.other },
  ].filter((category) => allowedTypes.includes(category.value));
  const maxLinks = mode === "company" ? 6 : 6;
  return <Stack gap="sm">{links.map((link, index) => {
    const selectedResource = getLinkResource(link.linkName, resources);
    const availableCategories = selectedResource
      ? categories.filter((item) => selectedResource.types.includes(item.value as LinkType))
      : categories;
    return <div className={classes.linkGrid} key={index}><Select required label={ui.links.category} data={availableCategories} value={link.linkType} onChange={(value) => setLinks(links.map((item, i) => i === index ? { ...item, linkType: (value ?? allowedTypes[0]) as LinkType } : item))} /><Autocomplete required label={ui.links.name} data={resources.map((item) => item.name)} limit={resources.length} maxLength={100} value={link.linkName} onChange={(value) => {
      const found = getLinkResource(value, resources);
      setLinks(links.map((item, i) => i === index ? { ...item, linkName: value, linkType: found && !found.types.includes(item.linkType) ? found.types[0] : item.linkType } : item));
    }} /><TextInput required label={ui.links.value} maxLength={255} value={link.value} onChange={(e) => setLinks(links.map((item, i) => i === index ? { ...item, value: formatContactValue(item.linkName, e.currentTarget.value) } : item))} /><AppTooltip label={commonUi.actions.delete}><button type="button" className={classes.iconButton} onClick={() => setLinks(links.filter((_, i) => i !== index))}><TrashIcon /></button></AppTooltip></div>;
  })}<Button variant="light" onClick={() => setLinks([...links, { linkType: allowedTypes[0] as LinkType, linkName: "", value: "" }])} disabled={links.length >= maxLinks}>{ui.links.add}</Button></Stack>;
}

function TabHeader({ title, description }: { title: string; description: string }) {
  return <div className={classes.tabHeader}><Title order={1} className={classes.tabTitle}>{title}</Title><Text className={classes.tabDescription}>{description}</Text></div>;
}

function InlineError({ message }: { message?: string | null }) {
  return message ? <div className={classes.inlineError}>{message}</div> : null;
}

function InfoRow({ label, value, actionLabel, onClick }: { label?: string; value?: string | null; actionLabel?: string; onClick?: () => void }) {
  return <div className={classes.infoRow}>{label && <span>{label}</span>}{onClick ? <button type="button" onClick={onClick}>{value || actionLabel}</button> : <strong>{value || "—"}</strong>}</div>;
}

function ContactCopyRow({ label, value, normalizeCopy }: { label?: string; value?: string | null; normalizeCopy?: (value: string) => string }) {
  if (!value) return null;
  const copyValue = normalizeCopy ? normalizeCopy(value) : value;
  return <div className={classes.contactCopyRow}>{label && <span>{label}</span>}<strong>{value}</strong><AppTooltip label={messages.studentDashboard.resumePreview.copy}><button type="button" onClick={() => copyToClipboard(copyValue)}><CopyIcon /></button></AppTooltip></div>;
}

function ModerationBadge({ status }: { status?: string | null }) {
  return <span className={classes.moderationBadge} data-status={status ?? "PENDING"}>{moderationLabel(status)}</span>;
}

const asOption = (item: CatalogItem) => ({ value: String(item.id), label: item.name });
const clean = (value: string) => value.trim();
const nullable = (value?: string | null) => value?.trim() || null;
const dateShort = (value: string) => new Date(value).toLocaleDateString("uk-UA");
const isValidUrlLike = (value: string) => /^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(value.trim());
const flattenSkills = (skillsByCategory?: Record<string, SkillOption[]>) => Object.values(skillsByCategory ?? {}).flat();
const findLabel = (options: Array<{ value: string; label: string }>, value: string) => options.find((item) => item.value === value)?.label ?? value;
const languageLevelLabel = (level: LanguageLevel | string) => cefrLevels.find((item) => item.value === level)?.label ?? level;
const formatHrName = (hr?: CompanyHr | null) => [hr?.user.firstName, hr?.user.middleName, hr?.user.lastName].filter(Boolean).join(" ");
const normalizeHref = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || !isValidUrlLike(trimmed)) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};
const copyToClipboard = (value: string) => {
  void navigator.clipboard?.writeText(value);
};
const normalizePhone = (value: string) => value.replace(/\s/g, "");
const normalizeSalaryInput = (value: string | number, previous: number | null) => {
  if (value === "") return null;
  if (typeof value !== "number" || value > maxSalaryInput) return previous;
  return value;
};
function getRecruiterProgress(data: RecruiterView | null) {
  if (!data) return 0;
  const checks = [
    Boolean(data.fullName?.trim()),
    Boolean(data.position?.trim()),
    Boolean(data.companyName?.trim()),
    Boolean(data.email?.trim()),
    Boolean(data.contacts?.length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
function vacancyToForm(vacancy: VacancyRow): VacancyFormState {
  return {
    title: vacancy.title,
    professionId: String(vacancy.professionId),
    sphereIds: vacancy.spheres.map((item) => String(item.sphereId)),
    description: vacancy.description,
    skills: vacancy.skills.map((item) => ({ skillId: String(item.skillId), weight: item.weight })),
    languages: vacancy.languages.map((item) => ({ languageId: String(item.languageId), level: item.level })),
    officeLocationIds: vacancy.locations.map((item) => item.locationId),
    isLocationStrict: vacancy.isLocationCritical,
    workFormatIds: vacancy.workFormats.map((item) => String(item.workFormatId)),
    employmentTypeIds: vacancy.employmentTypes.map((item) => String(item.employmentTypeId)),
    workScheduleIds: vacancy.workSchedules.map((item) => String(item.workScheduleId)),
    salaryFrom: vacancy.minSalary ?? null,
    salaryTo: vacancy.maxSalary ?? null,
    salaryPeriod: vacancy.salaryPeriod ?? "PER_MONTH",
    closingDate: dayjs(vacancy.closingDate).format("YYYY-MM-DD"),
  };
}
function vacancyFormToPayload(form: VacancyFormState & { status: "DRAFT" | "ACTIVE" }) {
  return {
    title: form.title.trim(),
    professionId: Number(form.professionId),
    sphereIds: form.sphereIds.map(Number),
    description: form.description,
    skills: form.skills.map((skill) => ({ skillId: Number(skill.skillId), weight: skill.weight })),
    languages: form.languages.map((language) => ({ languageId: Number(language.languageId), level: language.level })),
    officeLocationIds: form.officeLocationIds,
    isLocationStrict: form.isLocationStrict,
    workFormatIds: form.workFormatIds.map(Number),
    employmentTypeIds: form.employmentTypeIds.map(Number),
    workScheduleIds: form.workScheduleIds.map(Number),
    salaryFrom: form.salaryFrom,
    salaryTo: form.salaryTo,
    salaryPeriod: form.salaryPeriod,
    closingDate: form.closingDate,
    status: form.status,
  };
}
function validateVacancyForm(form: VacancyFormState, companyLocationCount: number) {
  if (!form.title.trim() || !form.professionId || !form.description.trim()) throw new Error(ui.createVacancy.errors.required);
  if (form.sphereIds.length < 1 || form.sphereIds.length > 3) throw new Error(ui.createVacancy.errors.spheres);
  if (form.skills.length < 1) throw new Error(ui.createVacancy.errors.skills);
  if (companyLocationCount === 0) throw new Error(ui.createVacancy.errors.companyLocations);
  if (form.officeLocationIds.length < 1) throw new Error(ui.createVacancy.errors.locations);
  if (form.workFormatIds.length < 1 || form.employmentTypeIds.length < 1 || form.workScheduleIds.length < 1) throw new Error(ui.createVacancy.errors.conditions);
  if (!form.closingDate || dayjs(form.closingDate).isBefore(dayjs().add(1, "day"), "day")) throw new Error(ui.createVacancy.errors.closingDate);
  if (form.salaryTo !== null && form.salaryFrom === null) throw new Error(ui.createVacancy.errors.salaryToWithoutFrom);
  if (form.salaryFrom !== null && form.salaryTo !== null && form.salaryTo < form.salaryFrom) throw new Error(ui.createVacancy.errors.salaryRange);
}
function skillCategoryLabel(category: string) {
  return ({ HARD_SKILL: "Hard Skills", SOFT_SKILL: "Soft Skills", TOOL: "Tools" }[category] ?? category);
}
function validateLinks(links: LinkItem[], mode: "hr" | "company") {
  const resources = mode === "hr" ? hrLinkResources : companyLinkResources;
  const allowedTypes = mode === "hr" ? ["MESSENGER", "SOCIAL"] : ["WEBSITE", "MESSENGER", "SOCIAL", "OTHER"];
  links.forEach((link) => {
    if (!link.linkType || !link.linkName.trim() || !link.value.trim()) throw new Error(ui.errors.required);
    if (!allowedTypes.includes(link.linkType)) throw new Error(ui.errors.linkCategory);
    const resource = getLinkResource(link.linkName, resources);
    if (resource && !resource.types.includes(link.linkType)) throw new Error(ui.errors.linkCategory);
    if (resource && !isValidResourceValue(resource.name, link.value)) throw new Error(ui.errors.linkFormat);
    if (resource?.domains?.length) {
      const url = getLinkUrl(link.value);
      if (!url || !resource.domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new Error(ui.errors.linkDomain);
    }
    if (!isValidUrlLike(link.value) && link.linkType !== "MESSENGER") throw new Error(ui.errors.url);
  });
}
const normalizeLinks = (links: LinkItem[]) => links.filter((link) => link.linkName.trim() && link.value.trim()).map((link) => ({ linkType: link.linkType, linkName: clean(link.linkName), value: clean(link.value) }));
const getLinkResource = (name: string, resources: LinkResource[]) => resources.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
const getLinkUrl = (value: string) => {
  try {
    const trimmed = value.trim();
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
};
function formatLocationByIds(location: { countryId: number; regionId: number; cityId: number }, catalogs: Catalogs | null) {
  return [
    catalogs?.countries.find((item) => item.id === location.countryId)?.name,
    catalogs?.regions.find((item) => item.id === location.regionId)?.name,
    catalogs?.cities.find((item) => item.id === location.cityId)?.name,
  ].filter(Boolean).join(", ");
}
function getErrorMessage(error: unknown) { return error instanceof ApiError || error instanceof Error ? error.message : commonUi.messages.unknownError; }
function statusLabel(status: VacancyStatus) { return ({ DRAFT: "Чернетка", ACTIVE: "Активна", PAUSED: "Призупинена", CLOSED: "Закрита", ARCHIVED: "Архів" }[status]); }
function moderationLabel(status?: string | null) { return ({ PENDING: "На перевірці", APPROVED: "Підтверджено", REJECTED: "Відхилено" }[status ?? "PENDING"] ?? status ?? "На перевірці"); }
function companySizeLabel(value: string) { return companySizes.find((item) => item.value === value)?.label ?? value; }
function isValidResourceValue(name: string, value: string) {
  const cleanValue = value.trim();
  const lowerName = name.toLowerCase();
  if (lowerName === "telegram") return /^(@[a-zA-Z0-9_]{5,32}|https?:\/\/(t\.me|telegram\.me)\/[a-zA-Z0-9_]{5,32})$/.test(cleanValue);
  if (lowerName === "viber" || lowerName === "whatsapp" || lowerName === "signal") return /^(\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2}|https?:\/\/[^\s]+)$/i.test(cleanValue);
  return true;
}
function formatContactValue(name: string, value: string) {
  const lowerName = name.toLowerCase();
  if ((lowerName === "viber" || lowerName === "whatsapp" || lowerName === "signal") && (value.startsWith("+") || /^\d/.test(value))) {
    return formatUkrainianPhone(value);
  }
  return value;
}

function PlusIcon() { return <svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" /></svg>; }
function BriefcaseIcon() { return <svg viewBox="0 0 24 24"><path d="M9 6V4h6v2h5a2 2 0 0 1 2 2v4H2V8a2 2 0 0 1 2-2h5Zm2 0h2V5h-2v1ZM2 14h20v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4Z" /></svg>; }
function UserIcon() { return <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" /></svg>; }
function CompanyIcon() { return <svg viewBox="0 0 24 24"><path d="M3 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16h-2v-4h-4v4H3Zm4-12h2V7H7v2Zm4 0h2V7h-2v2Zm-4 4h2v-2H7v2Zm4 0h2v-2h-2v2Zm7 8V9h1a2 2 0 0 1 2 2v10h-3Z" /></svg>; }
function ArrowIcon() { return <svg viewBox="0 0 24 24"><path d="m10 6 1.4 1.4L8.8 10H20v2H8.8l2.6 2.6L10 16l-5-5 5-5Z" /></svg>; }
function OpenIcon() { return <svg viewBox="0 0 24 24"><path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg>; }
function CopyIcon() { return <svg viewBox="0 0 24 24"><path d="M8 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V7Zm2 0v12h9V7h-9ZM3 17V3a2 2 0 0 1 2-2h10v2H5v14H3Z" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24"><path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7ZM9 4h6l1 1h4v2H4V5h4l1-1Z" /></svg>; }
function EditIcon() { return <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L17.8 8.95 15.05 6.2 4 17.25ZM19.7 7.05a1 1 0 0 0 0-1.4l-1.35-1.35a1 1 0 0 0-1.4 0l-1.05 1.05 2.75 2.75 1.05-1.05Z" /></svg>; }
function ArchiveIcon() { return <svg viewBox="0 0 24 24"><path d="M20 6h-3.2l-1.1-2H8.3L7.2 6H4v14h16V6ZM9.5 6l.35-.65h4.3L14.5 6h-5ZM6 8h12v10H6V8Zm3 2h6v2H9v-2Zm0 3h6v2H9v-2Z" /></svg>; }
function SaveIcon() { return <svg viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4ZM5 5h10.2L19 8.8V19H5V5Zm2 1h8v5H7V6Zm1 9h8v3H8v-3Z" /></svg>; }
function PublishIcon() { return <svg viewBox="0 0 24 24"><path d="M12 3 4 11h5v10h6V11h5l-8-8Zm0 2.8 3.2 3.2H13v10h-2V9H8.8L12 5.8Z" /></svg>; }
