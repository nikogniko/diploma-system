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
  Modal,
  MultiSelect,
  NumberInput,
  Pagination,
  Paper,
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, apiRequest } from "../../api/apiClient";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { FormSection } from "../../components/common/FormSection";
import { AppLoader } from "../../components/common/AppLoader";
import { AppTooltip } from "../../components/common/AppTooltip";
import { RichTextEditor } from "../../components/common/RichTextEditor";
import { ResumePreview } from "../../components/resume/ResumePreview";
import { StatusBadge } from "../../components/common/StatusBadge";
import { ApplicationStatusTimeline } from "../../components/application/ApplicationStatusTimeline";
import { MatchAnalysisPanel } from "../../components/application/MatchAnalysisPanel";
import { ApplicationStatusBadge } from "../../components/application/ApplicationStatusBadge";
import { ApplicationPipelineToolbar, type ApplicationPipelineFilter } from "../../components/application/ApplicationPipelineToolbar";
import type { ApplicationRecord, ApplicationStatus } from "../../components/application/applicationTypes";
import { CabinetLayout } from "../../layouts/CabinetLayout";
import { interpolate, messages } from "../../locales/localizedMessages";
import {
  formatUkrainianPhone,
  isValidEmail,
  isValidUkrainianPhone,
  sanitizeEmailInput,
  sanitizeNameInput,
} from "../../utils/formMasks";
import classes from "./StudentDashboard.module.scss";

type CatalogItem = { id: number; name: string };
type Skill = CatalogItem & { category: string };
type LinkType = "WEBSITE" | "MESSENGER" | "SOCIAL" | "PORTFOLIO" | "OTHER";
type LinkItem = { id?: string; linkType: LinkType; linkName: string; value: string };
type LinkResource = { name: string; types: LinkType[]; domains?: string[]; allowAnyUrl?: boolean };
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

type VacancySearchMode = "regular" | "personalized";
type VacancySortBy = "relevance" | "updatedAt" | "salaryFrom";
type SortDirection = "asc" | "desc";
type SkillWeight = "CRITICAL" | "IMPORTANT" | "NICE_TO_HAVE";
type LanguageLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "NATIVE";
type SalaryPeriod = "PER_MONTH" | "PER_HOUR";

type StudentVacancy = {
  id: string;
  title: string;
  description: string;
  professionId: number;
  profession?: CatalogItem | null;
  isLocationCritical: boolean;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: SalaryPeriod | null;
  closingDate: string;
  updatedAt: string;
  company?: { id: string; publicName: string; logoUrl?: string | null } | null;
  spheres: Array<{ sphereId: number; sphere?: CatalogItem | null }>;
  employmentTypes: Array<{ employmentTypeId: number; employmentType?: CatalogItem | null }>;
  workSchedules: Array<{ workScheduleId: number; workSchedule?: CatalogItem | null }>;
  workFormats: Array<{ workFormatId: number; workFormat?: CatalogItem | null }>;
  locations: Array<{ locationId: string; location?: { countryId: number; regionId?: number | null; cityId?: number | null } | null }>;
  skills: Array<{ skillId: number; weight: SkillWeight; skill?: Skill | null }>;
  languages: Array<{ languageId: number; level: LanguageLevel; language?: CatalogItem | null }>;
};

type VacancySearchEntry = {
  vacancy: StudentVacancy;
  matchScore: number | null;
  matchExplanation: Record<string, unknown> | null;
};

type VacancySearchResponse = {
  items: VacancySearchEntry[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const ui = messages.studentDashboard;
const commonUi = messages.common;

const navItems = [
  { key: "dashboard", label: ui.nav.dashboard, icon: <DashboardIcon />, underline: true },
  { key: "applications", label: ui.nav.applications, icon: <BriefcaseIcon />, underline: true },
  { key: "personal", label: ui.nav.personal, icon: <UserIcon /> },
  { key: "resume", label: ui.nav.resume, icon: <ResumeIcon /> },
  { key: "search", label: ui.nav.search, icon: <SearchIcon /> },
];

const cefrLevels = [
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
  { value: "C1", label: "C1" },
  { value: "C2", label: "C2" },
  { value: "NATIVE", label: "На рівні носія" },
];
const currentYear = new Date().getFullYear();
const resourcePlaceholder = ui.resourcePlaceholder;
const maxProfileLinks = 6;
const maxSalaryInput = 9_999_999;
const vacancyPageSizes = ["5", "10", "20"];
const vacancySortOptions = [
  { value: "relevance", label: "Релевантність" },
  { value: "updatedAt", label: "Оновлено" },
  { value: "salaryFrom", label: "Зарплата від" },
];
const linkResources: LinkResource[] = [
  { name: "LinkedIn", types: ["SOCIAL", "PORTFOLIO"], domains: ["linkedin.com"] },
  { name: ui.linksEditor.suggestions.ownWebsite, types: ["WEBSITE"], allowAnyUrl: true },
  { name: ui.linksEditor.suggestions.portfolio, types: ["PORTFOLIO"], allowAnyUrl: true },
  { name: "Google Drive", types: ["PORTFOLIO", "OTHER"], domains: ["drive.google.com"] },
  { name: "OneDrive", types: ["PORTFOLIO", "OTHER"], domains: ["onedrive.live.com", "1drv.ms"] },
  { name: "Instagram", types: ["SOCIAL", "PORTFOLIO"], domains: ["instagram.com"] },
  { name: "Facebook", types: ["SOCIAL"], domains: ["facebook.com"] },
  { name: "YouTube", types: ["SOCIAL", "PORTFOLIO"], domains: ["youtube.com", "youtu.be"] },
  { name: "TikTok", types: ["SOCIAL", "PORTFOLIO"], domains: ["tiktok.com"] },
  { name: "Notion", types: ["PORTFOLIO", "OTHER"], domains: ["notion.so", "notion.site"] },
  { name: "Canva", types: ["PORTFOLIO", "OTHER"], domains: ["canva.com"] },
  { name: "GitHub", types: ["PORTFOLIO"], domains: ["github.com"] },
  { name: "GitLab", types: ["PORTFOLIO"], domains: ["gitlab.com"] },
  { name: "LeetCode", types: ["PORTFOLIO"], domains: ["leetcode.com"] },
  { name: "Behance", types: ["PORTFOLIO"], domains: ["behance.net"] },
  { name: "Dribbble", types: ["PORTFOLIO"], domains: ["dribbble.com"] },
  { name: "Figma", types: ["PORTFOLIO", "OTHER"], domains: ["figma.com"] },
  { name: "ArtStation", types: ["PORTFOLIO"], domains: ["artstation.com"] },
  { name: "CodePen", types: ["PORTFOLIO"], domains: ["codepen.io"] },
];

/** Кабінет кандидата з персональними даними, резюме і параметрами пошуку. */
export default function StudentDashboard() {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [active, setActive] = useState(initialTab && navItems.some((item) => item.key === initialTab) ? initialTab : "dashboard");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [catalogs, setCatalogs] = useState<StudentCatalogs | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [blockErrors, setBlockErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isResumePreviewOpen, setIsResumePreviewOpen] = useState(false);
  const [vacancySearch, setVacancySearch] = useState("");
  const [vacancyMode, setVacancyMode] = useState<VacancySearchMode>("regular");
  const [vacancyProfessionId, setVacancyProfessionId] = useState<string | null>(null);
  const [vacancySphereIds, setVacancySphereIds] = useState<string[]>([]);
  const [vacancyWorkFormatIds, setVacancyWorkFormatIds] = useState<string[]>([]);
  const [vacancyEmploymentTypeIds, setVacancyEmploymentTypeIds] = useState<string[]>([]);
  const [vacancyWorkScheduleIds, setVacancyWorkScheduleIds] = useState<string[]>([]);
  const [vacancyLanguageId, setVacancyLanguageId] = useState<string | null>(null);
  const [vacancyLanguageLevel, setVacancyLanguageLevel] = useState<LanguageLevel>("A1");
  const [vacancyMinSalary, setVacancyMinSalary] = useState<number | null>(null);
  const [vacancySortBy, setVacancySortBy] = useState<VacancySortBy>("relevance");
  const [vacancySortDirection, setVacancySortDirection] = useState<SortDirection>("desc");
  const [vacancyPage, setVacancyPage] = useState(1);
  const [vacancyPageSize, setVacancyPageSize] = useState(10);
  const [vacancyResult, setVacancyResult] = useState<VacancySearchResponse | null>(null);
  const [isVacancyLoading, setIsVacancyLoading] = useState(false);
  const [vacancyError, setVacancyError] = useState<string | null>(null);
  const [selectedVacancy, setSelectedVacancy] = useState<VacancySearchEntry | null>(null);
  const [applicationNotice, setApplicationNotice] = useState<string | null>(null);

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

  /** Формує URL студентського каталогу вакансій з фільтрами, режимом і пагінацією. */
  const buildVacancyCatalogPath = (overrides: Partial<{
    page: number;
    pageSize: number;
    mode: VacancySearchMode;
  }> = {}) => {
    const params = new URLSearchParams({
      page: String(overrides.page ?? vacancyPage),
      pageSize: String(overrides.pageSize ?? vacancyPageSize),
      mode: overrides.mode ?? vacancyMode,
      sortBy: vacancySortBy,
      sortDirection: vacancySortDirection,
    });
    if (vacancySearch.trim()) params.set("search", vacancySearch.trim());
    if (vacancyProfessionId) params.set("professionId", vacancyProfessionId);
    if (vacancySphereIds.length) params.set("sphereIds", vacancySphereIds.join(","));
    if (vacancyWorkFormatIds.length) params.set("workFormatIds", vacancyWorkFormatIds.join(","));
    if (vacancyEmploymentTypeIds.length) params.set("employmentTypeIds", vacancyEmploymentTypeIds.join(","));
    if (vacancyWorkScheduleIds.length) params.set("workScheduleIds", vacancyWorkScheduleIds.join(","));
    if (vacancyLanguageId) {
      params.set("languageId", vacancyLanguageId);
      params.set("minLanguageLevel", vacancyLanguageLevel);
    }
    if (vacancyMinSalary !== null) params.set("minSalary", String(vacancyMinSalary));
    return `/vacancies/search?${params.toString()}`;
  };

  /** Завантажує студентський каталог вакансій. */
  const loadStudentVacancies = async (overrides: Partial<{ page: number; pageSize: number; mode: VacancySearchMode }> = {}) => {
    setVacancyError(null);
    setIsVacancyLoading(true);
    try {
      const token = await getToken();
      const result = await apiRequest<VacancySearchResponse>(buildVacancyCatalogPath(overrides), token);
      setVacancyResult(result);
      setVacancyPage(result.page);
      setVacancyPageSize(result.pageSize);
    } catch (error) {
      setVacancyError(getErrorMessage(error));
    } finally {
      setIsVacancyLoading(false);
    }
  };

  /** Відкриває активну вакансію через окремий endpoint перегляду. */
  const openVacancy = async (vacancyId: string) => {
    setVacancyError(null);
    setIsVacancyLoading(true);
    setApplicationNotice(null);
    try {
      const token = await getToken();
      const result = await apiRequest<VacancySearchEntry>(`/vacancies/student/${vacancyId}`, token);
      setSelectedVacancy(result);
    } catch (error) {
      setVacancyError(getErrorMessage(error));
    } finally {
      setIsVacancyLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (active !== "vacancies" || vacancyResult) return;
    void loadStudentVacancies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, vacancyResult]);

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
    if (!isValidEmail(personalForm.contactEmail)) throw new Error(ui.errors.contactEmail);
    if (!isValidUkrainianPhone(personalForm.primaryPhone)) throw new Error(ui.errors.primaryPhone);
    if (personalForm.secondaryPhone && !isValidUkrainianPhone(personalForm.secondaryPhone)) throw new Error(ui.errors.secondaryPhone);
    if (personalForm.viber && !isValidUkrainianPhone(personalForm.viber)) throw new Error(ui.errors.viber);
    if (personalForm.telegram && !/^(@[a-zA-Z0-9_]{5,32}|\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2})$/.test(personalForm.telegram)) throw new Error(ui.errors.telegram);
    const invalidLink = personalForm.links.find((link) => validateProfileLink(link));
    if (personalForm.links.length > maxProfileLinks) throw new Error((ui.errors as Record<string, string>).linksLimit ?? ui.errors.links);
    if (invalidLink) throw new Error(validateProfileLink(invalidLink) ?? ui.errors.links);

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

  /** Оновлює тільки текст "Про себе", не зачіпаючи контакти та посилання профілю. */
  const saveAboutInfo = () => runBlock("about", async () => {
    const token = await getToken();
    await apiRequest("/students/my-cabinet/personal-info", token, {
      method: "PATCH",
      body: JSON.stringify({ about: clean(personalForm.about) }),
    });
  });

  /** Зберігає параметри пошуку вакансій. */
  const saveSearchPreferences = () => runBlock("search", async () => {
    if (searchForm.desiredProfessionIds.length < 1 || searchForm.desiredProfessionIds.length > 3) throw new Error(ui.errors.desiredProfessions);
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
    if (searchForm.desiredLocations.length >= 5) return setBlockErrors((c) => ({ ...c, search: ui.errors.maxLocations }));
    const label = [
      catalogs?.countries.find((item) => item.id === newLocation.countryId)?.name,
      regions.find((item) => item.id === newLocation.regionId)?.name,
      cities.find((item) => item.id === newLocation.cityId)?.name,
    ].filter(Boolean).join(", ");
    const exists = searchForm.desiredLocations.some((item) => item.countryId === newLocation.countryId && item.regionId === (newLocation.regionId || null) && item.cityId === (newLocation.cityId || null));
    if (exists) return setBlockErrors((c) => ({ ...c, search: ui.errors.duplicateLocation }));
    setSearchForm((current) => ({ ...current, desiredLocations: [...current.desiredLocations, { countryId: newLocation.countryId, regionId: newLocation.regionId || null, cityId: newLocation.cityId || null, label }] }));
    setNewLocation((current) => ({ countryId: current.countryId, regionId: 0, cityId: 0 }));
  };

  /** Saves an education record from the resume editor form. */
  const saveEducation = () => runResume("education", educationEditId, {
    universityId: educationForm.universityId ? Number(educationForm.universityId) : null,
    customUniversityName: educationForm.universityId ? null : nullable(educationForm.customUniversityName || universityQuery),
    degree: educationForm.degree,
    specialty: clean(educationForm.specialty),
    startYear: Number(educationForm.startYear),
    endYear: educationForm.endYear ? Number(educationForm.endYear) : null,
    diplomaUrl: nullable(educationForm.diplomaUrl),
  }, () => { setEducationForm(emptyEducation); setEducationEditId(null); setUniversityQuery(""); }, () => {
    if (!educationForm.universityId && !nullable(educationForm.customUniversityName || universityQuery)) return ui.errors.educationUniversity;
    if (!educationForm.specialty.trim()) return ui.errors.educationSpecialty;
    if (!educationForm.startYear) return ui.errors.educationStartYearRequired;
    if (Number(educationForm.startYear) < currentYear - 60 || Number(educationForm.startYear) > currentYear) return interpolate(ui.errors.educationStartYearRange, { min: currentYear - 60, max: currentYear });
    return null;
  });

  /** Saves a language proficiency record from the resume editor form. */
  const saveLanguage = () => runResume("languages", languageEditId, {
    languageId: Number(languageForm.languageId),
    level: languageForm.level,
    certificateUrl: nullable(languageForm.certificateUrl),
  }, () => { setLanguageForm(emptyLanguage); setLanguageEditId(null); }, () => {
    if (!languageForm.languageId || !languageForm.level) return ui.errors.languageRequired;
    return null;
  });

  /** Saves a course record after validating its linked skills. */
  const saveCourse = () => {
    if (courseForm.skillIds.length < 1) return setBlockErrors((c) => ({ ...c, courses: ui.errors.courseRequired }));
    return runResume("courses", courseEditId, { ...courseForm, startDate: monthToDate(courseForm.startDate), endDate: courseForm.endDate ? monthToDate(courseForm.endDate) : null, certificateUrl: nullable(courseForm.certificateUrl), skillIds: courseForm.skillIds.map(Number) }, () => { setCourseForm(emptyCourse); setCourseEditId(null); }, () => {
      if (!courseForm.title.trim() || !courseForm.startDate) return ui.errors.courseRequired;
      return null;
    });
  };

  /** Saves a project record after validating its required data and skills. */
  const saveProject = () => {
    if (projectForm.skillIds.length < 3) return setBlockErrors((c) => ({ ...c, projects: ui.errors.projectRequired }));
    return runResume("projects", projectEditId, { ...projectForm, projectUrl: nullable(projectForm.projectUrl), skillIds: projectForm.skillIds.map(Number) }, () => { setProjectForm(emptyProject); setProjectEditId(null); }, () => {
      if (!projectForm.title.trim() || !projectForm.description.trim()) return ui.errors.projectRequired;
      return null;
    });
  };

  /** Saves an experience record after validating its required data and skills. */
  const saveExperience = () => {
    if (experienceForm.skillIds.length < 3) return setBlockErrors((c) => ({ ...c, experiences: ui.errors.experienceRequired }));
    return runResume("experiences", experienceEditId, { ...experienceForm, professionId: Number(experienceForm.professionId), sphereId: Number(experienceForm.sphereId), endDate: nullable(experienceForm.endDate), skillIds: experienceForm.skillIds.map(Number) }, () => { setExperienceForm(emptyExperience); setExperienceEditId(null); }, () => {
      if (!experienceForm.professionId || !experienceForm.position.trim() || !experienceForm.companyName.trim() || !experienceForm.sphereId || !experienceForm.startDate || !experienceForm.achievements.trim()) return ui.errors.experienceRequired;
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

  if (isLoading) return <AppLoader text={ui.loading.dashboard} />;

  return (
    <CabinetLayout navItems={navItems} activeKey={active} onSelect={(key) => {
      setActive(key);
      setSearchParams(key === "dashboard" ? {} : { tab: key });
    }}>
      <Drawer
        opened={isResumePreviewOpen}
        onClose={() => setIsResumePreviewOpen(false)}
        title={ui.resumePreview.drawerTitle}
        position="right"
        size="min(980px, 92vw)"
      >
        <ResumePreview profile={profile} />
      </Drawer>
      <Stack gap="md">
        <ErrorBanner message={pageError} />
        {active === "dashboard" && <DashboardTab profile={profile} onOpenResume={() => setIsResumePreviewOpen(true)} />}
        {active === "applications" && <MyApplicationsTab />}
        {active === "vacancies" && (
          <VacancyCatalogTab
            catalogs={catalogs}
            result={vacancyResult}
            selected={selectedVacancy}
            loading={isVacancyLoading}
            error={vacancyError}
            notice={applicationNotice}
            filters={{
              search: vacancySearch,
              mode: vacancyMode,
              professionId: vacancyProfessionId,
              sphereIds: vacancySphereIds,
              workFormatIds: vacancyWorkFormatIds,
              employmentTypeIds: vacancyEmploymentTypeIds,
              workScheduleIds: vacancyWorkScheduleIds,
              languageId: vacancyLanguageId,
              languageLevel: vacancyLanguageLevel,
              minSalary: vacancyMinSalary,
              sortBy: vacancySortBy,
              sortDirection: vacancySortDirection,
              pageSize: vacancyPageSize,
            }}
            setters={{
              setSearch: setVacancySearch,
              setMode: setVacancyMode,
              setProfessionId: setVacancyProfessionId,
              setSphereIds: setVacancySphereIds,
              setWorkFormatIds: setVacancyWorkFormatIds,
              setEmploymentTypeIds: setVacancyEmploymentTypeIds,
              setWorkScheduleIds: setVacancyWorkScheduleIds,
              setLanguageId: setVacancyLanguageId,
              setLanguageLevel: setVacancyLanguageLevel,
              setMinSalary: setVacancyMinSalary,
              setSortBy: setVacancySortBy,
              setSortDirection: setVacancySortDirection,
            }}
            onSearch={() => { setVacancyPage(1); void loadStudentVacancies({ page: 1 }); }}
            onPersonalized={() => { setVacancyMode("personalized"); setVacancyPage(1); void loadStudentVacancies({ page: 1, mode: "personalized" }); }}
            onPageChange={(page) => { setVacancyPage(page); void loadStudentVacancies({ page }); }}
            onPageSizeChange={(pageSize) => { setVacancyPageSize(pageSize); setVacancyPage(1); void loadStudentVacancies({ page: 1, pageSize }); }}
            onOpen={(vacancyId) => void openVacancy(vacancyId)}
            onBack={() => { setSelectedVacancy(null); setApplicationNotice(null); }}
            onApply={() => setApplicationNotice(null)}
          />
        )}
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
            saveAboutInfo={saveAboutInfo}
            options={options}
            universities={universities}
            universityQuery={universityQuery}
            setUniversityQuery={setUniversityQuery}
            forms={{ educationForm, languageForm, courseForm, projectForm, experienceForm }}
            setters={{ setEducationForm, setLanguageForm, setCourseForm, setProjectForm, setExperienceForm }}
            edits={{ setEducationEditId, setLanguageEditId, setCourseEditId, setProjectEditId, setExperienceEditId }}
            editIds={{ educationEditId, languageEditId, courseEditId, projectEditId, experienceEditId }}
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

/** Renders the dashboard summary for the student's cabinet. */
function DashboardTab({ profile, onOpenResume }: { profile: StudentProfile | null; onOpenResume: () => void }) {
  return (
    <>
      <TabHeader title={ui.dashboard.title} description={ui.dashboard.description} />
      <FormSection title={ui.dashboard.sectionTitle} description={ui.dashboard.sectionDescription}>
        <Group gap="sm">
          <Badge className={classes.badge}>{interpolate(ui.dashboard.educationBadge, { count: profile?.education.length ?? 0 })}</Badge>
          <Badge className={classes.badge}>{interpolate(ui.dashboard.languagesBadge, { count: profile?.languages.length ?? 0 })}</Badge>
          <Badge className={classes.badge}>{interpolate(ui.dashboard.coursesBadge, { count: profile?.courses.length ?? 0 })}</Badge>
          <Badge className={classes.badge}>{interpolate(ui.dashboard.projectsBadge, { count: profile?.projects.length ?? 0 })}</Badge>
          <Badge className={classes.badge}>{interpolate(ui.dashboard.experienceBadge, { count: profile?.experiences.length ?? 0 })}</Badge>
        </Group>
        <Button className={classes.previewButton} onClick={onOpenResume}>{ui.dashboard.previewButton}</Button>
      </FormSection>
    </>
  );
}

/** Показує студенту його відгуки, статусний timeline та аналіз відповідності. */
function MyApplicationsTab() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const applicationUi = messages.applicationModule;
  const [items, setItems] = useState<ApplicationRecord[]>([]);
  const [filter, setFilter] = useState<ApplicationPipelineFilter>("ALL");
  const [sortBy, setSortBy] = useState<"score" | "percent" | "date">("score");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ application: ApplicationRecord; status: ApplicationStatus } | null>(null);

  /** Завантажує лише власні відгуки поточного студента. */
  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      setItems(await apiRequest<ApplicationRecord[]>("/applications/my", token));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadApplications);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Відкликає власний нетермінальний відгук через дозволений студенту transition. */
  const updateStatus = async (applicationId: string, status: ApplicationStatus) => {
    setSavingId(applicationId);
    setError(null);
    try {
      const token = await getToken();
      const updated = await apiRequest<ApplicationRecord>(`/applications/${applicationId}/status`, token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setItems((current) => current.map((item) => item.id === applicationId ? updated : item));
    } catch {
      setError(status === "WITHDRAWN" ? applicationUi.student.withdrawError : applicationUi.student.restoreError);
    } finally {
      setSavingId(null);
    }
  };

  const counts = (["SENT", "VIEWED", "SHORTLISTED", "INTERVIEW_INVITED", "OFFERED", "HIRED", "REJECTED", "WITHDRAWN"] as ApplicationStatus[])
    .reduce<Record<ApplicationPipelineFilter, number>>((result, status) => {
      result[status] = items.filter((item) => item.status === status).length;
      return result;
    }, { ALL: items.length } as Record<ApplicationPipelineFilter, number>);
  const visible = items
    .filter((item) => filter === "ALL" || item.status === filter)
    .sort((first, second) => sortBy === "date"
      ? new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
      : sortBy === "percent"
        ? (second.matchDetails?.baseRequirementsPercent ?? -1) - (first.matchDetails?.baseRequirementsPercent ?? -1)
        : (second.matchScore ?? -1) - (first.matchScore ?? -1));
  return <>
    <Modal centered opened={Boolean(confirmAction)} onClose={() => setConfirmAction(null)} title={confirmAction?.status === "WITHDRAWN" ? applicationUi.student.withdrawConfirmTitle : applicationUi.student.restoreConfirmTitle}>
      <Text>{confirmAction?.status === "WITHDRAWN" ? applicationUi.student.withdrawConfirmText : applicationUi.student.restoreConfirmText}</Text>
      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={() => setConfirmAction(null)}>{applicationUi.actions.cancel}</Button>
        <Button loading={Boolean(confirmAction && savingId === confirmAction.application.id)} onClick={() => {
          if (!confirmAction) return;
          void updateStatus(confirmAction.application.id, confirmAction.status).then(() => setConfirmAction(null));
        }}>{confirmAction?.status === "WITHDRAWN" ? applicationUi.student.withdraw : applicationUi.student.restore}</Button>
      </Group>
    </Modal>
    <TabHeader title={applicationUi.student.title} description={applicationUi.student.description} />
    <FormSection title={applicationUi.student.title}>
      <ErrorBanner message={error} />
      <ApplicationPipelineToolbar counts={counts} selected={filter} onSelect={setFilter} sortBy={sortBy} onSortChange={setSortBy} />
      {loading ? <Text>{applicationUi.student.loading}</Text> : visible.length === 0 ? <Text className={classes.muted}>{filter === "ALL" ? applicationUi.student.empty : applicationUi.student.emptyFiltered}</Text> : (
        <div className={classes.applicationList}>{visible.map((application) => {
          const expanded = expandedId === application.id;
          const inactive = application.matchDetails?.requirementEligibility?.matchesBlockingRequirements === false;
          const canWithdraw = !["HIRED", "REJECTED", "WITHDRAWN"].includes(application.status);
          const restoreStatus = previousStatusBeforeWithdraw(application);
          return <article className={classes.applicationCard} data-expanded={expanded || undefined} data-inactive={inactive || undefined} key={application.id} onDoubleClick={() => setExpandedId(expanded ? null : application.id)}>
            <div className={classes.applicationCardMain}>
              <div>
                <Text fw={900}>{application.vacancy.title}</Text>
                <Text className={classes.muted}>{application.vacancy.company?.publicName ?? applicationUi.student.company}</Text>
              </div>
              <div className={classes.applicationMetric}><span>{applicationUi.student.status}</span><ApplicationStatusBadge status={application.status} /></div>
              <div className={classes.applicationMetric}><span>{applicationUi.student.createdAt}</span><strong>{new Date(application.createdAt).toLocaleDateString("uk-UA")}</strong></div>
              <div className={classes.applicationMetric}><span>{applicationUi.student.baseRequirements}</span><strong>{application.matchDetails?.baseRequirementsPercent ?? 0}%</strong></div>
              <div className={classes.applicationMetric}><span>{applicationUi.student.matchScore}</span><strong>{application.matchScore ?? 0}</strong></div>
            </div>
            <div className={classes.applicationActions} onDoubleClick={(event) => event.stopPropagation()}>
              <Button variant="subtle" onClick={() => navigate(`/vacancies/${application.vacancy.id}`)}>{applicationUi.student.viewVacancy}</Button>
              <Button variant="light" onClick={() => setExpandedId(expanded ? null : application.id)}>{expanded ? applicationUi.student.hideAnalysis : applicationUi.student.analysis}</Button>
            </div>
            {expanded && <div className={classes.applicationDetails}>
              <ApplicationStatusTimeline currentStatus={application.status} statusHistory={application.statusHistory} variant="student" actions={<>
                {canWithdraw && <Button color="red" size="xs" variant="light" loading={savingId === application.id} onClick={() => setConfirmAction({ application, status: "WITHDRAWN" })}>{applicationUi.student.withdraw}</Button>}
                {application.status === "WITHDRAWN" && restoreStatus && <Button size="xs" variant="light" loading={savingId === application.id} onClick={() => setConfirmAction({ application, status: restoreStatus })}>{applicationUi.student.restore}</Button>}
              </>} />
              <MatchAnalysisPanel details={application.matchDetails} variant="student" />
            </div>}
          </article>;
        })}</div>
      )}
    </FormSection>
  </>;
}

/** Відновлює етап відгуку, на якому студент перебував безпосередньо перед відкликанням. */
function previousStatusBeforeWithdraw(application: ApplicationRecord) {
  return [...application.statusHistory].reverse()
    .find((event) => event.toStatus === "WITHDRAWN")?.fromStatus ?? null;
}

/** Renders vacancy search controls, results, paging and the selected vacancy. */
function VacancyCatalogTab(props: {
  catalogs: StudentCatalogs | null;
  result: VacancySearchResponse | null;
  selected: VacancySearchEntry | null;
  loading: boolean;
  error?: string | null;
  notice?: string | null;
  filters: {
    search: string;
    mode: VacancySearchMode;
    professionId: string | null;
    sphereIds: string[];
    workFormatIds: string[];
    employmentTypeIds: string[];
    workScheduleIds: string[];
    languageId: string | null;
    languageLevel: LanguageLevel;
    minSalary: number | null;
    sortBy: VacancySortBy;
    sortDirection: SortDirection;
    pageSize: number;
  };
  setters: {
    setSearch: (value: string) => void;
    setMode: (value: VacancySearchMode) => void;
    setProfessionId: (value: string | null) => void;
    setSphereIds: (value: string[]) => void;
    setWorkFormatIds: (value: string[]) => void;
    setEmploymentTypeIds: (value: string[]) => void;
    setWorkScheduleIds: (value: string[]) => void;
    setLanguageId: (value: string | null) => void;
    setLanguageLevel: (value: LanguageLevel) => void;
    setMinSalary: (value: number | null) => void;
    setSortBy: (value: VacancySortBy) => void;
    setSortDirection: (value: SortDirection) => void;
  };
  onSearch: () => void;
  onPersonalized: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpen: (vacancyId: string) => void;
  onBack: () => void;
  onApply: () => void;
}) {
  const { catalogs, result, selected, loading, error, notice, filters, setters, onSearch, onPersonalized, onPageChange, onPageSizeChange, onOpen, onBack, onApply } = props;
  const options = {
    professions: catalogs?.professions.map(asOption) ?? [],
    spheres: catalogs?.spheres.map(asOption) ?? [],
    workFormats: catalogs?.workFormats.map(asOption) ?? [],
    employmentTypes: catalogs?.employmentTypes.map(asOption) ?? [],
    workSchedules: catalogs?.workSchedules.map(asOption) ?? [],
    languages: catalogs?.languages.map(asOption) ?? [],
  };

  if (selected) {
    return <VacancyDetails entry={selected} notice={notice} onBack={onBack} onApply={onApply} />;
  }

  return <>
    <TabHeader title="Вакансії" description="Каталог активних вакансій для студентів. Можна шукати вручну або використати параметри профілю." />
    <Paper className={classes.vacancyFilters}>
      <div className={classes.vacancyFilterHeader}>
        <TextInput label="Пошук" placeholder="Назва, опис, компанія або навичка" value={filters.search} onChange={(event) => setters.setSearch(event.currentTarget.value)} />
        <Button className={classes.previewButton} onClick={onSearch} loading={loading}>Шукати</Button>
        <Button variant="light" className={classes.personalizedButton} onClick={onPersonalized} loading={loading} data-active={filters.mode === "personalized" || undefined}>Підібрати за моїм профілем</Button>
      </div>
      <div className={classes.vacancyFilterGrid}>
        <Select label="Професія" searchable clearable data={options.professions} value={filters.professionId} onChange={setters.setProfessionId} />
        <MultiSelect label="Сфери" searchable data={options.spheres} value={filters.sphereIds} onChange={setters.setSphereIds} />
        <MultiSelect label="Формат роботи" data={options.workFormats} value={filters.workFormatIds} onChange={setters.setWorkFormatIds} />
        <MultiSelect label="Тип зайнятості" data={options.employmentTypes} value={filters.employmentTypeIds} onChange={setters.setEmploymentTypeIds} />
        <MultiSelect label="Графік" data={options.workSchedules} value={filters.workScheduleIds} onChange={setters.setWorkScheduleIds} />
        <div className={classes.languageFilterPair}>
          <Select label="Мова" clearable data={options.languages} value={filters.languageId} onChange={setters.setLanguageId} />
          <Select label="Рівень від" data={cefrLevels} value={filters.languageLevel} onChange={(value) => setters.setLanguageLevel((value ?? "A1") as LanguageLevel)} />
        </div>
        <NumberInput label="Мін. зарплата" min={0} max={maxSalaryInput} step={1000} allowNegative={false} allowDecimal={false} clampBehavior="strict" value={filters.minSalary ?? undefined} onChange={(value) => setters.setMinSalary(normalizeMoneyInput(value))} />
        <Select label="Сортувати" data={vacancySortOptions} value={filters.sortBy} onChange={(value) => setters.setSortBy((value ?? "updatedAt") as VacancySortBy)} />
        {filters.sortBy !== "relevance" && <Select label="Напрям" data={[{ value: "desc", label: "Спадання" }, { value: "asc", label: "Зростання" }]} value={filters.sortDirection} onChange={(value) => setters.setSortDirection((value ?? "desc") as SortDirection)} />}
      </div>
    </Paper>
    <InlineError message={error} />
    {loading && <Stack gap="sm">{Array.from({ length: 3 }).map((_, index) => <Paper key={index} className={classes.vacancyCardSkeleton} />)}</Stack>}
    {!loading && result && result.items.length === 0 && <FormSection title="Вакансій не знайдено" description="Спробуйте змінити пошук або зняти частину фільтрів."><Text className={classes.muted}>Показуються тільки активні вакансії з актуальним дедлайном.</Text></FormSection>}
    {!loading && result && result.items.length > 0 && <>
      <div className={classes.vacancyCatalogList}>{result.items.map((entry) => <VacancyCatalogCard key={entry.vacancy.id} entry={entry} onOpen={onOpen} />)}</div>
      <div className={classes.catalogPagination}>
        <Text className={classes.muted}>Знайдено: {result.totalItems}</Text>
        <Pagination value={result.page} total={result.totalPages} onChange={onPageChange} />
        <Select className={classes.catalogPageSize} data={vacancyPageSizes.map((value) => ({ value, label: value }))} value={String(filters.pageSize)} onChange={(value) => onPageSizeChange(Number(value ?? 10))} />
      </div>
    </>}
  </>;
}

/** Renders one selectable vacancy card in the student catalog. */
function VacancyCatalogCard({ entry, onOpen }: { entry: VacancySearchEntry; onOpen: (vacancyId: string) => void }) {
  const vacancy = entry.vacancy;
  const skills = primaryVacancySkills(vacancy);
  return <Paper className={classes.vacancyCatalogCard}>
    <div className={classes.vacancyCardMain}>
      <div>
        <Text className={classes.vacancyCardTitle}>{vacancy.title}</Text>
        <Text className={classes.vacancyCompany}>{vacancy.company?.publicName ?? "Компанія"} · {vacancy.profession?.name ?? "Професія"}</Text>
      </div>
      <Avatar src={vacancy.company?.logoUrl} radius="md" size={54}>{vacancy.company?.publicName?.[0] ?? "C"}</Avatar>
    </div>
    <Text className={classes.vacancyDescription}>{stripHtml(vacancy.description)}</Text>
    <div className={classes.vacancyMetaLine}>
      <span>{labelList(vacancy.workFormats.map((item) => item.workFormat?.name))}</span>
      <span>{labelList(vacancy.employmentTypes.map((item) => item.employmentType?.name))}</span>
      <span>{labelList(vacancy.workSchedules.map((item) => item.workSchedule?.name))}</span>
      <span>{shortVacancyLocation(vacancy)}</span>
    </div>
    <div className={classes.vacancyCardFooter}>
      <div className={classes.vacancySkillRow}>{skills.map((skill) => <span key={`${skill.skillId}-${skill.weight}`} className={`${classes.skillChip} ${skillClass(skill.skill?.category ?? "")}`}>{skill.skill?.name}</span>)}</div>
      <div className={classes.vacancyFooterActions}>
        {formatVacancySalary(vacancy) && <Text fw={900}>{formatVacancySalary(vacancy)}</Text>}
        <Text className={classes.muted}>до {dateShort(vacancy.closingDate)}</Text>
        <Button onClick={() => onOpen(vacancy.id)}>Переглянути</Button>
      </div>
    </div>
    {entry.matchScore !== null && <Badge className={classes.badge}>Match {entry.matchScore}</Badge>}
  </Paper>;
}

/** Renders full details for the selected public vacancy. */
function VacancyDetails({ entry, notice, onBack, onApply }: { entry: VacancySearchEntry; notice?: string | null; onBack: () => void; onApply: () => void }) {
  const vacancy = entry.vacancy;
  const skillGroups = groupVacancySkills(vacancy);
  return <div className={classes.vacancyDetailsPage}>
    <button type="button" className={classes.backButton} onClick={onBack}><ArrowIcon /> Назад до вакансій</button>
    <section className={classes.vacancyDetailsHero}>
      <div>
        <Text className={classes.previewEyebrow}>Активна вакансія</Text>
        <Title order={1}>{vacancy.title}</Title>
        <Text className={classes.vacancyCompany}>{vacancy.company?.publicName ?? "Компанія"} · {vacancy.profession?.name ?? "Професія"}</Text>
      </div>
      <Avatar src={vacancy.company?.logoUrl} radius="md" size={76}>{vacancy.company?.publicName?.[0] ?? "C"}</Avatar>
    </section>
    <div className={classes.vacancyDetailsGrid}>
      <section className={classes.sectionStack}>
        <FormSection title="Опис вакансії">
          <div className={classes.richPreview} dangerouslySetInnerHTML={{ __html: vacancy.description }} />
        </FormSection>
        <FormSection title="Навички">
          <div className={classes.skillGroups}>{skillGroups.map((group) => <div key={group.category}><Text className={classes.skillGroupTitle}>{skillCategoryLabel(group.category)}</Text><div className={classes.chips}>{group.skills.map((item) => <span key={item.skillId} className={`${classes.skillChip} ${skillClass(item.skill?.category ?? "")}`}>{item.skill?.name}</span>)}</div></div>)}</div>
        </FormSection>
        {vacancy.languages.length > 0 && <FormSection title="Мови">
          <div className={classes.chips}>{vacancy.languages.map((item) => <span key={item.languageId} className={classes.locationChip}>{item.language?.name}: {languageLevelLabel(item.level)}</span>)}</div>
        </FormSection>}
      </section>
      <aside className={classes.sectionStack}>
        <FormSection title="Умови роботи">
          <InfoLine label="Формат" value={labelList(vacancy.workFormats.map((item) => item.workFormat?.name))} />
          <InfoLine label="Тип зайнятості" value={labelList(vacancy.employmentTypes.map((item) => item.employmentType?.name))} />
          <InfoLine label="Графік" value={labelList(vacancy.workSchedules.map((item) => item.workSchedule?.name))} />
          <InfoLine label="Локація" value={shortVacancyLocation(vacancy)} />
          {vacancy.isLocationCritical && <Badge className={classes.badge}>Локація обов'язкова</Badge>}
          <InfoLine label="Зарплата" value={formatVacancySalary(vacancy) ?? "Не вказано"} />
          <InfoLine label="Дедлайн" value={dateShort(vacancy.closingDate)} />
        </FormSection>
        <FormSection title="Сфери">
          <div className={classes.chips}>{vacancy.spheres.map((item) => <span className={classes.locationChip} key={item.sphereId}>{item.sphere?.name}</span>)}</div>
        </FormSection>
        <Button className={classes.fullButton} onClick={onApply}>Відгукнутися</Button>
        {notice && <div className={classes.hint}>{notice}</div>}
      </aside>
    </div>
  </div>;
}

/** Renders editable personal information and contact visibility controls. */
function PersonalTab({ profile, form, setForm, error, saving, onSave }: any) {
  return (
    <>
      <TabHeader title={ui.personal.title} description={ui.personal.description} />
      <div className={classes.tipBlock}>
        <Text className={classes.tipTitle}><InfoIcon /> {ui.personal.tipTitle}</Text>
        <Text>{ui.personal.tipText}</Text>
      </div>
      <FormSection title={ui.personal.personalTitle} description={ui.personal.personalDescription}>
        <div className={classes.profileTop}>
          <img className={classes.avatar} src={profile?.user.photoUrl || "/vite.svg"} alt={ui.personal.profilePhotoAlt} />
          <Stack gap="xs">
            <Text fw={900}>{profile?.user.lastName} {profile?.user.firstName}</Text>
            <Group gap="xs">
              <StatusBadge status={profile?.user.status} />
              <Text className={classes.muted}>{interpolate(ui.personal.createdAt, { date: profile?.user.createdAt ? dateShort(profile.user.createdAt) : ui.personal.unknownDate })}</Text>
            </Group>
          </Stack>
        </div>
        <div className={classes.personalGrid}>
          <div className={classes.nameColumn}>
            <TextInput label={ui.personal.firstName} required maxLength={100} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: sanitizeNameInput(e.currentTarget.value) })} />
            <TextInput label={ui.personal.lastName} required maxLength={100} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: sanitizeNameInput(e.currentTarget.value) })} />
            <TextInput label={ui.personal.middleName} maxLength={100} value={form.middleName} onChange={(e) => setForm({ ...form, middleName: sanitizeNameInput(e.currentTarget.value) })} />
          </div>
          <div className={classes.nameColumn}>
            <Select label={ui.personal.gender} data={[{ value: "FEMALE", label: ui.personal.female }, { value: "MALE", label: ui.personal.male }]} value={form.gender || null} onChange={(value) => setForm({ ...form, gender: value ?? "" })} />
            <DateInput label={ui.personal.birthDate} required value={form.birthDate ? new Date(form.birthDate) : null} onChange={(value) => setForm({ ...form, birthDate: value ? dayjs(value).format("YYYY-MM-DD") : "" })} valueFormat="DD.MM.YYYY" locale="uk" maxDate={new Date()} popoverProps={{ position: "bottom-end", withinPortal: true }} />
          </div>
        </div>
      </FormSection>
      <FormSection title={ui.personal.contactsTitle} description={ui.personal.contactsDescription}>
        <div className={classes.grid}>
          <TextInput className={classes.fullRow} label={ui.personal.contactEmail} required value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: sanitizeEmailInput(e.currentTarget.value) })} />
          <TextInput label={ui.personal.primaryPhone} required value={form.primaryPhone} onChange={(e) => setForm({ ...form, primaryPhone: formatUkrainianPhone(e.currentTarget.value) })} />
          <TextInput label={ui.personal.secondaryPhone} value={form.secondaryPhone} onChange={(e) => setForm({ ...form, secondaryPhone: formatUkrainianPhone(e.currentTarget.value) })} />
        </div>
      </FormSection>
      <FormSection title={ui.personal.linksTitle} description={ui.personal.linksDescription}>
        <div className={classes.grid}>
          <TextInput label="Telegram" placeholder={ui.personal.telegramPlaceholder} value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.currentTarget.value.startsWith("+") || /^\d/.test(e.currentTarget.value) ? formatUkrainianPhone(e.currentTarget.value) : e.currentTarget.value })} />
          <TextInput label="Viber" value={form.viber} onChange={(e) => setForm({ ...form, viber: formatUkrainianPhone(e.currentTarget.value) })} />
        </div>
        <LinkEditor links={form.links} setLinks={(links) => setForm({ ...form, links })} />
      </FormSection>
      <FormSection title={ui.personal.contactVisibilityTitle} description={ui.personal.visibilityDescription}>
        <VisibilitySelector value={form.visibility ?? "APPLIED_ONLY"} onChange={(visibility) => setForm({ ...form, visibility })} />
      </FormSection>
      <InlineError message={error} />
      <Button className={classes.fullButton} loading={saving} onClick={onSave}>{ui.actions.savePersonal}</Button>
    </>
  );
}

/** Renders editable vacancy-search preferences stored in the profile. */
function SearchTab(props: any) {
  const { form, setForm, options, countries, regions, cities, newLocation, setNewLocation, error, saving, onAddLocation, onSave } = props;
  return (
    <>
      <TabHeader title={ui.search.title} description={ui.search.description} />
      <FormSection title={ui.search.mainTitle} description={ui.search.mainDescription}>
        <Switch className={classes.inlineSwitch} label={ui.search.activeSearch} checked={form.isActiveSearch} onChange={(e) => setForm({ ...form, isActiveSearch: e.currentTarget.checked })} />
        <div className={classes.grid}>
          <TextInput label={ui.search.desiredPosition} maxLength={150} placeholder={ui.search.desiredPositionPlaceholder} value={form.desiredPosition} onChange={(e) => setForm({ ...form, desiredPosition: e.currentTarget.value })} />
          <MultiSelect classNames={{ pill: classes.professionPill }} label={ui.search.desiredProfession} required searchable maxValues={3} data={options.professions} value={form.desiredProfessionIds} onChange={(value) => setForm({ ...form, desiredProfessionIds: value })} />
        </div>
      </FormSection>
      <FormSection title={ui.search.locationsTitle} description={ui.search.locationsDescription}>
        <div className={classes.chips}>{form.desiredLocations.map((item: any) => <button key={item.label} className={classes.locationChip} onClick={() => setForm({ ...form, desiredLocations: form.desiredLocations.filter((location: any) => location.label !== item.label) })}>{item.label} ×</button>)}</div>
        {form.desiredLocations.length < 5 && <div className={classes.threeGrid}>
          <Select label={ui.search.country} data={countries.map(asOption)} value={String(newLocation.countryId || "")} onChange={(value) => setNewLocation({ countryId: Number(value), regionId: 0, cityId: 0 })} />
          <Select label={ui.search.region} data={regions.map(asOption)} disabled={!countries.find((c: CatalogItem) => c.id === newLocation.countryId)?.name.toLowerCase().includes("укра")} value={String(newLocation.regionId || "")} onChange={(value) => setNewLocation({ ...newLocation, regionId: Number(value), cityId: 0 })} />
          <Select label={ui.search.city} data={cities.map(asOption)} disabled={!newLocation.regionId} value={String(newLocation.cityId || "")} onChange={(value) => setNewLocation({ ...newLocation, cityId: Number(value) })} />
        </div>}
        <Button variant="light" onClick={onAddLocation}>{ui.actions.addLocation}</Button>
      </FormSection>
      <FormSection title={ui.search.salaryTitle} description={ui.search.salaryDescription}>
        <div className={classes.salaryGrid}>
          <Switch className={classes.centerCheckbox} label={ui.search.showAllSalary} checked={form.showAllSalary} onChange={(e) => setForm({ ...form, showAllSalary: e.currentTarget.checked, minSalary: e.currentTarget.checked ? null : form.minSalary })} />
          <NumberInput label={ui.search.minSalary} min={0} max={maxSalaryInput} step={1000} allowNegative={false} allowDecimal={false} clampBehavior="strict" disabled={form.showAllSalary} value={form.minSalary ?? undefined} onChange={(value) => setForm({ ...form, minSalary: normalizeMoneyInput(value) ?? 0 })} />
        </div>
        <div className={classes.threeGrid}>
          <Checkbox.Group className={classes.checkboxGroup} label={ui.search.employmentTypes} value={form.employmentTypeIds} onChange={(value) => setForm({ ...form, employmentTypeIds: value })}>{options.employmentTypes.map((item: any) => <Checkbox key={item.value} value={item.value} label={item.label} />)}</Checkbox.Group>
          <Checkbox.Group className={classes.checkboxGroup} label={ui.search.workSchedules} value={form.workScheduleIds} onChange={(value) => setForm({ ...form, workScheduleIds: value })}>{options.workSchedules.map((item: any) => <Checkbox key={item.value} value={item.value} label={item.label} />)}</Checkbox.Group>
          <Checkbox.Group className={classes.checkboxGroup} label={ui.search.workFormats} value={form.workFormatIds} onChange={(value) => setForm({ ...form, workFormatIds: value })}>{options.workFormats.map((item: any) => <Checkbox key={item.value} value={item.value} label={item.label} />)}</Checkbox.Group>
        </div>
      </FormSection>
      <InlineError message={error} />
      <Button className={classes.fullButton} loading={saving} onClick={onSave}>{ui.actions.saveSearch}</Button>
    </>
  );
}

/** Renders resume sections and their edit actions. */
function ResumeTab(props: any) {
  const { profile, personalForm, setPersonalForm, saveAboutInfo, options, universities, universityQuery, setUniversityQuery, forms, setters, edits, editIds, errors, saving, actions, clearError } = props;
  const { educationForm, languageForm, courseForm, projectForm, experienceForm } = forms;
  const { setEducationForm, setLanguageForm, setCourseForm, setProjectForm, setExperienceForm } = setters;
  return (
    <>
      <TabHeader title={ui.resume.title} description={ui.resume.description} />
      <FormSection title={ui.resume.aboutTitle} description={ui.resume.aboutDescription}>
        <RichTextEditor value={personalForm.about} onChange={(about) => setPersonalForm({ ...personalForm, about })} maxLength={500} placeholder={ui.resume.aboutPlaceholder} />
        <InlineError message={errors.about} />
        <ActionButtons saving={saving.about} isEditing={false} createLabel={commonUi.actions.save} onSave={saveAboutInfo} onCancel={() => { setPersonalForm({ ...personalForm, about: "" }); clearError("about"); }} />
      </FormSection>
      <FormSection title={ui.resume.educationTitle} description={ui.resume.educationDescription}>
        <RecordList items={sortByYearDesc(profile?.education ?? [])} title={(i: any) => i.university?.name ?? i.customUniversityName} meta={(i: any) => <><strong>{degreeLabel(i.degree)}</strong> · {i.specialty}<br />{i.startYear}{i.endYear ? `-${i.endYear}` : ""}</>} links={(i: any) => i.diplomaUrl ? [{ label: ui.links.diploma, value: i.diplomaUrl }] : []} onEdit={(i: any) => { edits.setEducationEditId(i.id); setEducationForm({ universityId: i.universityId ? String(i.universityId) : "", customUniversityName: i.customUniversityName ?? "", degree: i.degree, specialty: i.specialty, startYear: String(i.startYear), endYear: i.endYear ? String(i.endYear) : "", diplomaUrl: i.diplomaUrl ?? "" }); setUniversityQuery(i.customUniversityName ?? i.university?.name ?? ""); }} onDelete={(i: any) => actions.deleteResumeItem("education", i.id)} />
        <div className={classes.grid}>
          <div className={classes.fullRow}>
            <TextInput label={ui.resume.university} required placeholder={ui.resume.universityPlaceholder} value={universityQuery} onChange={(event) => { const value = event.currentTarget.value; setUniversityQuery(value); setEducationForm({ ...educationForm, universityId: "", customUniversityName: value }); }} />
            {universityQuery.trim().length >= 2 && !educationForm.universityId && universities.length > 0 && (
              <div className={classes.suggestionList}>
                {universities.map((item: CatalogItem) => <button key={item.id} type="button" onClick={() => { setUniversityQuery(item.name); setEducationForm({ ...educationForm, universityId: String(item.id), customUniversityName: "" }); }}>{item.name}</button>)}
              </div>
            )}
          </div>
          <Select label={ui.resume.degree} required placeholder={ui.resume.degreePlaceholder} data={[{ value: "JUNIOR_BACHELOR", label: ui.degreeLabels.juniorBachelor }, { value: "BACHELOR", label: ui.degreeLabels.bachelor }, { value: "MASTER", label: ui.degreeLabels.master }, { value: "PHD", label: ui.degreeLabels.phd }, { value: "OTHER", label: ui.degreeLabels.other }]} value={educationForm.degree} onChange={(value) => setEducationForm({ ...educationForm, degree: value ?? "BACHELOR" })} />
          <TextInput label={ui.resume.specialty} required placeholder={ui.resume.specialtyPlaceholder} maxLength={200} value={educationForm.specialty} onChange={(e) => setEducationForm({ ...educationForm, specialty: e.currentTarget.value })} />
          <NumberInput label={ui.resume.startYear} required placeholder={String(currentYear)} min={currentYear - 60} max={currentYear} value={educationForm.startYear ? Number(educationForm.startYear) : undefined} onChange={(value) => setEducationForm({ ...educationForm, startYear: value ? String(value) : "" })} />
          <NumberInput label={ui.resume.endYear} min={currentYear - 60} max={currentYear} value={educationForm.endYear ? Number(educationForm.endYear) : undefined} onChange={(value) => setEducationForm({ ...educationForm, endYear: value ? String(value) : "" })} />
          <TextInput className={classes.fullRow} label={ui.resume.diplomaUrl} placeholder={resourcePlaceholder} maxLength={255} value={educationForm.diplomaUrl} onChange={(e) => setEducationForm({ ...educationForm, diplomaUrl: e.currentTarget.value })} />
        </div>
        <InlineError message={errors.education} /><ActionButtons saving={saving.education} isEditing={Boolean(editIds.educationEditId)} onSave={actions.saveEducation} onCancel={() => { setEducationForm({ universityId: "", customUniversityName: "", degree: "BACHELOR", specialty: "", startYear: "", endYear: "", diplomaUrl: "" }); edits.setEducationEditId(null); setUniversityQuery(""); clearError("education"); }} />
      </FormSection>
      <FormSection title={ui.resume.languagesTitle} description={ui.resume.languagesDescription}>
        <RecordList items={profile?.languages ?? []} title={(i: any) => `${i.language?.name ?? ""} - ${languageLevelLabel(i.level)}`} links={(i: any) => i.certificateUrl ? [{ label: ui.links.certificate, value: i.certificateUrl }] : []} onEdit={(i: any) => { edits.setLanguageEditId(i.id); setLanguageForm({ languageId: String(i.languageId), level: i.level, certificateUrl: i.certificateUrl ?? "" }); }} onDelete={(i: any) => actions.deleteResumeItem("languages", i.id)} />
        <div className={classes.grid}>
          <Select label={ui.resume.language} required searchable placeholder={ui.resume.languagePlaceholder} data={options.languages} value={languageForm.languageId || null} onChange={(value) => setLanguageForm({ ...languageForm, languageId: value ?? "" })} />
          <Select label={ui.resume.level} required placeholder={ui.resume.levelPlaceholder} data={cefrLevels} value={languageForm.level || null} onChange={(value) => setLanguageForm({ ...languageForm, level: value ?? "" })} />
          <TextInput className={classes.fullRow} label={ui.resume.certificateUrl} placeholder={resourcePlaceholder} maxLength={255} value={languageForm.certificateUrl} onChange={(e) => setLanguageForm({ ...languageForm, certificateUrl: e.currentTarget.value })} />
        </div>
        <InlineError message={errors.languages} /><ActionButtons saving={saving.languages} isEditing={Boolean(editIds.languageEditId)} onSave={actions.saveLanguage} onCancel={() => { setLanguageForm({ languageId: "", level: "", certificateUrl: "" }); edits.setLanguageEditId(null); clearError("languages"); }} />
      </FormSection>
      <CompetencySection type="courses" title={ui.resume.coursesTitle} description={ui.resume.coursesDescription} items={sortByDateDesc(profile?.courses ?? [], "startDate")} form={courseForm} setForm={setCourseForm} edit={edits.setCourseEditId} isEditing={Boolean(editIds.courseEditId)} error={errors.courses} saving={saving.courses} onSave={actions.saveCourse} onDelete={actions.deleteResumeItem} options={options} clearError={clearError} />
      <CompetencySection type="projects" title={ui.resume.projectsTitle} description={ui.resume.projectsDescription} items={profile?.projects ?? []} form={projectForm} setForm={setProjectForm} edit={edits.setProjectEditId} isEditing={Boolean(editIds.projectEditId)} error={errors.projects} saving={saving.projects} onSave={actions.saveProject} onDelete={actions.deleteResumeItem} options={options} clearError={clearError} />
      <ExperienceSection form={experienceForm} setForm={setExperienceForm} items={sortByDateDesc(profile?.experiences ?? [], "startDate")} options={options} edit={edits.setExperienceEditId} isEditing={Boolean(editIds.experienceEditId)} error={errors.experiences} saving={saving.experiences} onSave={actions.saveExperience} onDelete={actions.deleteResumeItem} clearError={clearError} />
    </>
  );
}

/** Renders and edits course or project competency records. */
function CompetencySection({ type, title, description, items, form, setForm, edit, isEditing, error, saving, onSave, onDelete, options, clearError }: any) {
  const isCourse = type === "courses";
  const isProject = type === "projects";
  return <FormSection title={title} description={description}>
    <RecordList items={items} title={(i: any) => i.title} meta={(i: any) => isCourse ? `${monthShort(i.startDate)}${i.endDate ? ` - ${monthShort(i.endDate)}` : ""}` : stripHtml(i.description)} skills={(i: any) => i.skills?.map((join: SkillJoin) => join.skill) ?? []} links={(i: any) => isCourse ? (i.certificateUrl ? [{ label: ui.links.certificate, value: i.certificateUrl }] : []) : (i.projectUrl ? [{ label: ui.links.project, value: i.projectUrl }] : [])} onEdit={(i: any) => { edit(i.id); setForm(isCourse ? { title: i.title, startDate: i.startDate?.slice(0, 7), endDate: i.endDate?.slice(0, 7) ?? "", certificateUrl: i.certificateUrl ?? "", skillIds: i.skills.map((s: SkillJoin) => String(s.skill.id)) } : { title: i.title, description: i.description, projectUrl: i.projectUrl ?? "", skillIds: i.skills.map((s: SkillJoin) => String(s.skill.id)) }); }} onDelete={(i: any) => onDelete(type, i.id)} />
    {isCourse ? <div className={classes.grid}><TextInput className={classes.fullRow} label={ui.resume.titleField} required placeholder={ui.resume.courseTitlePlaceholder} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} /><MonthPickerInput label={ui.resume.startMonth} required placeholder={ui.resume.monthPlaceholder} value={form.startDate ? new Date(monthToDate(form.startDate)) : null} onChange={(v) => setForm({ ...form, startDate: v ? dayjs(v).format("YYYY-MM") : "" })} valueFormat="MM.YYYY" locale="uk" popoverProps={{ position: "bottom-end", withinPortal: true }} /><MonthPickerInput label={ui.resume.endMonth} placeholder={ui.resume.monthPlaceholder} clearable value={form.endDate ? new Date(monthToDate(form.endDate)) : null} onChange={(v) => setForm({ ...form, endDate: v ? dayjs(v).format("YYYY-MM") : "" })} valueFormat="MM.YYYY" locale="uk" popoverProps={{ position: "bottom-end", withinPortal: true }} /><TextInput className={classes.fullRow} label={ui.resume.certificateUrl} placeholder={resourcePlaceholder} maxLength={255} value={form.certificateUrl} onChange={(e) => setForm({ ...form, certificateUrl: e.currentTarget.value })} /></div> : <><TextInput label={ui.resume.titleField} required placeholder={ui.resume.projectTitlePlaceholder} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} /><RichTextEditor value={form.description} onChange={(description) => setForm({ ...form, description })} label={ui.resume.descriptionField} placeholder={ui.resume.projectDescriptionPlaceholder} /><TextInput label={ui.resume.projectUrl} placeholder={resourcePlaceholder} maxLength={255} value={form.projectUrl} onChange={(e) => setForm({ ...form, projectUrl: e.currentTarget.value })} /></>}
    <SmartSkillSelector value={form.skillIds} onChange={(skillIds) => setForm({ ...form, skillIds })} options={options.skills} max={isProject ? 30 : 20} />
    <InlineError message={error} /><ActionButtons saving={saving} isEditing={isEditing} onSave={onSave} onCancel={() => { setForm(isCourse ? { title: "", startDate: "", endDate: "", certificateUrl: "", skillIds: [] } : { title: "", description: "", projectUrl: "", skillIds: [] }); edit(null); clearError(type); }} />
  </FormSection>;
}

/** Renders and edits professional experience records. */
function ExperienceSection({ form, setForm, items, options, edit, isEditing, error, saving, onSave, onDelete, clearError }: any) {
  return <FormSection title={ui.resume.experienceTitle} description={ui.resume.experienceDescription}>
    <RecordList items={items} title={(i: any) => `${i.position} · ${i.companyName}`} meta={(i: any) => <><strong>{formatDuration(i.startDate, i.endDate)}</strong> · {dateShort(i.startDate)} - {i.endDate ? dateShort(i.endDate) : ui.resume.now}<br />{i.profession?.name ?? ""} · {i.sphere?.name ?? ""}</>} skills={(i: any) => i.skills?.map((join: SkillJoin) => join.skill) ?? []} onEdit={(i: any) => { edit(i.id); setForm({ professionId: String(i.professionId), sphereId: String(i.sphereId), companyName: i.companyName, position: i.position, startDate: i.startDate?.slice(0, 10), endDate: i.endDate?.slice(0, 10) ?? "", achievements: i.achievements, skillIds: i.skills.map((s: SkillJoin) => String(s.skill.id)) }); }} onDelete={(i: any) => onDelete("experiences", i.id)} />
    <div className={classes.grid}><Select label={ui.resume.profession} required searchable placeholder={ui.resume.professionPlaceholder} data={options.professions} value={form.professionId || null} onChange={(value) => setForm({ ...form, professionId: value ?? "" })} /><TextInput label={ui.resume.position} required placeholder={ui.resume.positionPlaceholder} maxLength={200} value={form.position} onChange={(e) => setForm({ ...form, position: e.currentTarget.value })} /><TextInput label={ui.resume.company} required placeholder={ui.resume.companyPlaceholder} maxLength={200} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.currentTarget.value })} /><Select label={ui.resume.sphere} required searchable placeholder={ui.resume.spherePlaceholder} data={options.spheres} value={form.sphereId || null} onChange={(value) => setForm({ ...form, sphereId: value ?? "" })} /><DateInput label={ui.resume.startDate} required placeholder={ui.resume.datePlaceholder} value={form.startDate ? new Date(form.startDate) : null} onChange={(v) => setForm({ ...form, startDate: v ? dayjs(v).format("YYYY-MM-DD") : "" })} valueFormat="DD.MM.YYYY" locale="uk" popoverProps={{ position: "bottom-end", withinPortal: true }} /><DateInput label={ui.resume.endDate} placeholder={ui.resume.datePlaceholder} clearable value={form.endDate ? new Date(form.endDate) : null} onChange={(v) => setForm({ ...form, endDate: v ? dayjs(v).format("YYYY-MM-DD") : "" })} valueFormat="DD.MM.YYYY" locale="uk" popoverProps={{ position: "bottom-end", withinPortal: true }} /></div>
    <RichTextEditor label={ui.resume.achievements} value={form.achievements} onChange={(achievements) => setForm({ ...form, achievements })} placeholder={ui.resume.achievementsPlaceholder} />
    <SmartSkillSelector value={form.skillIds} onChange={(skillIds) => setForm({ ...form, skillIds })} options={options.skills} max={30} />
    <InlineError message={error} /><ActionButtons saving={saving} isEditing={isEditing} onSave={onSave} onCancel={() => { setForm({ professionId: "", sphereId: "", companyName: "", position: "", startDate: "", endDate: "", achievements: "", skillIds: [] }); edit(null); clearError("experiences"); }} />
  </FormSection>;
}

/** Renders a capped skill selector grouped by skill category. */
function SmartSkillSelector({ value, onChange, options, max }: { value: string[]; onChange: (v: string[]) => void; options: Array<{ value: string; label: string; category?: string; name?: string }>; max: number }) {
  const [search, setSearch] = useState("");
  const selected = options.filter((option: any) => value.includes(option.value));
  const categories = ["HARD", "TOOL", "SOFT"];
  return <div className={classes.selectorBox}><Select label={ui.resume.skills} placeholder={ui.resume.skillsPlaceholder} searchable clearable value={null} searchValue={search} onSearchChange={setSearch} data={options.filter((option) => !value.includes(option.value))} onChange={(skillId) => { if (skillId && value.length < max) onChange([...value, skillId]); setSearch(""); }} /><div className={classes.skillGroups}>{categories.map((category) => {
    const categorySkills = selected.filter((item: any) => String(item.category).toUpperCase().includes(category));
    if (!categorySkills.length) return null;
    return <div key={category}><Text className={classes.skillGroupTitle}>{category === "HARD" ? "Hard Skills" : category === "TOOL" ? "Tools" : "Soft Skills"}</Text><div className={classes.chips}>{categorySkills.map((item: any) => <button key={item.value} className={`${classes.skillChip} ${skillClass(item.category)}`} onClick={() => onChange(value.filter((id) => id !== item.value))}>{item.name ?? item.label} <span>×</span></button>)}</div></div>;
  })}</div></div>;
}

/** Renders editable resume records as a compact card list. */
function RecordList({ items, title, meta, skills, links, onEdit, onDelete }: any) {
  if (!items.length) return <Text className={classes.muted}>{ui.resume.noRecords}</Text>;
  return <div className={classes.cardList}>{items.map((item: any) => <div key={item.id} className={classes.recordCard}><span className={classes.dragHandle}>⠿</span><div><Text className={classes.recordTitle}>{title(item)}</Text>{meta?.(item) && <Text className={classes.recordMeta}>{meta(item)}</Text>}{links?.(item)?.length > 0 && <div className={classes.urlList}>{links(item).map((link: { label: string; value: string }) => <AppTooltip key={`${link.label}-${link.value}`} label={link.value}><a className={classes.resourceLink} href={normalizeHref(link.value)} target="_blank" rel="noreferrer">{link.label}</a></AppTooltip>)}</div>}{skills && <SkillChips skills={skills(item)} />}</div><div className={classes.iconActions}><AppTooltip label={commonUi.actions.edit}><button className={classes.iconButton} onClick={() => onEdit(item)}><EditIcon /></button></AppTooltip><AppTooltip label={commonUi.actions.delete}><button className={`${classes.iconButton} ${classes.dangerIconButton}`} onClick={() => onDelete(item)}><TrashIcon /></button></AppTooltip></div></div>)}</div>;
}

/** Renders and edits profile resource links. */
function LinkEditor({ links, setLinks }: { links: LinkItem[]; setLinks: (links: LinkItem[]) => void }) {
  const [error, setError] = useState<string | null>(null);
  const categoryOptions = [
    { value: "WEBSITE", label: ui.linksEditor.categories.website },
    { value: "MESSENGER", label: ui.linksEditor.categories.messenger },
    { value: "SOCIAL", label: ui.linksEditor.categories.social },
    { value: "PORTFOLIO", label: ui.linksEditor.categories.portfolio },
    { value: "OTHER", label: ui.linksEditor.categories.other },
  ];
  /** Appends one empty link field when the profile link limit allows it. */
  const add = () => {
    const last = links.at(-1);
    if (links.length >= maxProfileLinks) {
      setError((ui.errors as Record<string, string>).linksLimit ?? ui.errors.links);
      return;
    }
    if (last) {
      const validationError = validateProfileLink(last);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setError(null);
    setLinks([...links, { linkType: "SOCIAL", linkName: "", value: "" }]);
  };
  return <Stack gap="sm">{links.map((link, index) => {
    const selectedResource = getLinkResource(link.linkName);
    const availableCategories = selectedResource
      ? categoryOptions.filter((item) => selectedResource.types.includes(item.value as LinkType))
      : categoryOptions;
    return <div className={classes.linkGrid} key={index}><Select required label={ui.linksEditor.category} placeholder={ui.linksEditor.categoryPlaceholder} data={availableCategories} value={link.linkType} onChange={(value) => setLinks(links.map((item, i) => i === index ? { ...item, linkType: (value ?? "OTHER") as LinkType } : item))} /><Autocomplete required label={ui.linksEditor.name} placeholder={ui.linksEditor.namePlaceholder} data={linkResources.map((item) => item.name)} limit={linkResources.length} maxLength={100} value={link.linkName} onChange={(value) => {
    const found = getLinkResource(value);
    setLinks(links.map((item, i) => i === index ? { ...item, linkName: value, linkType: found && !found.types.includes(item.linkType) ? found.types[0] : item.linkType } : item));
    setError(null);
  }} /><TextInput required label={ui.linksEditor.value} placeholder={resourcePlaceholder} maxLength={255} value={link.value} onChange={(e) => {
    setLinks(links.map((item, i) => i === index ? { ...item, value: e.currentTarget.value } : item));
    setError(null);
  }} /><AppTooltip label={ui.linksEditor.deleteTitle}><button type="button" className={`${classes.iconButton} ${classes.dangerIconButton} ${classes.linkDeleteButton}`} onClick={() => { setLinks(links.filter((_, i) => i !== index)); setError(null); }}><TrashIcon /></button></AppTooltip></div>;
  })}<InlineError message={error} /><Button variant="light" onClick={add} disabled={links.length >= maxProfileLinks}>{ui.actions.addLink}</Button></Stack>;
}

/** Renders the profile visibility segmented selector. */
function VisibilitySelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const items = [
    ["PUBLIC", ui.visibility.publicLabel, ui.visibility.publicText],
    ["APPLIED_ONLY", ui.visibility.appliedLabel, ui.visibility.appliedText],
    ["HIDDEN", ui.visibility.hiddenLabel, ui.visibility.hiddenText],
  ];
  return <div className={classes.visibilityOptions}>{items.map(([id, label, text]) => <label className={classes.visibilityOption} key={id}><Checkbox className={classes.visibilityCheckbox} checked={value === id} onChange={() => onChange(id)} label={<><Text fw={900}>{label}</Text><Text className={classes.muted}>{text}</Text></>} /></label>)}</div>;
}

/** Renders category-colored chips for a skill collection. */
function SkillChips({ skills }: { skills: Skill[] }) {
  return <div className={classes.chips}>{skills.map((skill) => <span key={skill.id} className={`${classes.skillChip} ${skillClass(skill.category)}`}>{skill.name}</span>)}</div>;
}

/** Renders the heading and description of a cabinet tab. */
function TabHeader({ title, description }: { title: string; description: string }) {
  return <div className={classes.tabHeader}><Title order={1} className={classes.tabTitle}>{title}</Title><Text className={classes.tabDescription}>{description}</Text></div>;
}

/** Renders an inline error only when a message is present. */
function InlineError({ message }: { message?: string | null }) {
  return message ? <div className={classes.inlineError}>{message}</div> : null;
}

/** Renders save and cancel actions for an editable form block. */
function ActionButtons({ saving, isEditing, createLabel, onSave, onCancel }: { saving?: boolean; isEditing?: boolean; createLabel?: string; onSave: () => void; onCancel: () => void }) {
  return <div className={classes.formActions}><Button className={classes.fullButton} loading={saving} onClick={onSave}>{isEditing ? commonUi.actions.saveChanges : (createLabel ?? commonUi.actions.add)}</Button><Button className={classes.cancelButton} variant="light" onClick={onCancel}>{isEditing ? commonUi.actions.cancelChanges : commonUi.actions.clear}</Button></div>;
}

/** Combines user links with populated messenger contacts for persistence. */
function buildLinks(form: { links: LinkItem[]; telegram: string; viber: string }): LinkItem[] {
  const links = form.links.filter((link) => link.linkName.trim() && link.value.trim());
  if (form.telegram.trim()) links.push({ linkType: "MESSENGER", linkName: "Telegram", value: form.telegram.trim() });
  if (form.viber.trim()) links.push({ linkType: "MESSENGER", linkName: "Viber", value: form.viber.trim() });
  return links;
}

/** Renders one labeled detail row when its value exists. */
function InfoLine({ label, value }: { label: string; value?: string | null }) {
  return <div className={classes.infoLine}><span>{label}</span><strong>{value || "Не вказано"}</strong></div>;
}

/** Selects the most prominent skills to show on a vacancy card. */
function primaryVacancySkills(vacancy: StudentVacancy) {
  return [...vacancy.skills]
    .sort((first, second) => skillWeightRank[second.weight] - skillWeightRank[first.weight] || skillCategoryRank(first.skill?.category) - skillCategoryRank(second.skill?.category))
    .slice(0, 5);
}

/** Groups vacancy skills into requirement weight categories. */
function groupVacancySkills(vacancy: StudentVacancy) {
  const order = ["HARD_SKILL", "TOOL", "SOFT_SKILL"];
  return Object.entries(vacancy.skills.reduce<Record<string, StudentVacancy["skills"]>>((groups, item) => {
    const category = item.skill?.category ?? "OTHER";
    groups[category] ??= [];
    groups[category].push(item);
    return groups;
  }, {}))
    .sort(([first], [second]) => order.indexOf(first) - order.indexOf(second))
    .map(([category, skills]) => ({
      category,
      skills: [...skills].sort((first, second) => skillWeightRank[second.weight] - skillWeightRank[first.weight]),
    }));
}

/** Formats the vacancy salary interval for display. */
function formatVacancySalary(vacancy: StudentVacancy) {
  if (!vacancy.minSalary && !vacancy.maxSalary) return null;
  const period = vacancy.salaryPeriod === "PER_HOUR" ? "грн/год" : "грн/міс";
  if (vacancy.minSalary && vacancy.maxSalary) return `${vacancy.minSalary}-${vacancy.maxSalary} ${period}`;
  return `${vacancy.minSalary ?? vacancy.maxSalary} ${period}`;
}

/** Extracts a compact visible location label for a vacancy. */
function shortVacancyLocation(vacancy: StudentVacancy) {
  return vacancy.locations.length ? `${vacancy.locations.length} локац.` : "Локація не вказана";
}

/** Joins non-empty catalog labels for compact display. */
function labelList(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(", ") || "Не вказано";
}

/** Defines visual ordering of skill categories. */
function skillCategoryRank(category?: string | null) {
  if (category === "HARD_SKILL") return 1;
  if (category === "TOOL") return 2;
  if (category === "SOFT_SKILL") return 3;
  return 4;
}

/** Maps a skill category identifier to its localized label. */
function skillCategoryLabel(category: string) {
  if (category === "HARD_SKILL") return "Hard Skills";
  if (category === "TOOL") return "Tools";
  if (category === "SOFT_SKILL") return "Soft Skills";
  return category;
}

const skillWeightRank: Record<SkillWeight, number> = {
  CRITICAL: 3,
  IMPORTANT: 2,
  NICE_TO_HAVE: 1,
};

/** Converts a catalog item into a Select option. */
const asOption = (item: CatalogItem) => ({ value: String(item.id), label: item.name });
/** Trims user-entered text before persistence. */
const clean = (value: string) => value.trim();
/** Converts empty optional text values to null. */
const nullable = (value?: string | null) => value?.trim() || null;
/** Clamps a monetary input to the accepted non-negative integer range. */
const normalizeMoneyInput = (value: string | number) => {
  if (value === "" || typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.min(Math.max(0, Math.trunc(value)), maxSalaryInput);
};
/** Formats an ISO date for short UI display. */
const dateShort = (value: string) => dayjs(value).format("DD.MM.YYYY");
/** Formats a date as month and year for resume records. */
const monthShort = (value: string) => dayjs(value).format("MM.YYYY");
/** Converts month-only picker values into ISO date input values. */
const monthToDate = (value: string) => value.length === 7 ? `${value}-01` : value;
/** Checks whether a profile resource looks like a public URL. */
const isValidUrlLike = (value: string) => /^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(value.trim());
/** Finds validation metadata for a named link resource. */
const getLinkResource = (name: string) => linkResources.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
/** Parses a profile resource URL for host-level validation. */
const getLinkUrl = (value: string) => {
  const trimmed = value.trim();
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
};
/** Checks whether a URL host belongs to one of the supported domains. */
const linkHostMatches = (host: string, domains: string[]) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
/** Validates one typed profile resource link. */
const validateProfileLink = (link: LinkItem) => {
  const errors = ui.errors as Record<string, string>;
  if (!link.linkType || !link.linkName.trim() || !link.value.trim()) return errors.linksRequired ?? ui.errors.links;
  if (!isValidUrlLike(link.value)) return errors.linkFormatInvalid ?? ui.errors.links;
  const resource = getLinkResource(link.linkName);
  if (!resource) return null;
  if (!resource.types.includes(link.linkType)) return errors.linkCategoryNotAllowed ?? ui.errors.links;
  if (resource.allowAnyUrl || !resource.domains?.length) return null;
  const url = getLinkUrl(link.value);
  if (!url || !linkHostMatches(url.hostname.replace(/^www\./i, "").toLowerCase(), resource.domains)) return errors.linkDomainInvalid ?? ui.errors.links;
  return null;
};
/** Normalizes user links into browser-ready absolute URLs. */
const normalizeHref = (value: string) => /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim().replace(/^www\./i, "www.")}`;
/** Produces readable plain text from rich text fragments. */
const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
/** Sorts dated records from newest to oldest. */
const sortByDateDesc = <T extends Record<string, string>>(items: T[], key: keyof T) => [...items].sort((a, b) => dayjs(String(b[key])).valueOf() - dayjs(String(a[key])).valueOf());
/** Sorts academic records from latest start year to earliest. */
const sortByYearDesc = <T extends { startYear: number }>(items: T[]) => [...items].sort((a, b) => b.startYear - a.startYear);
/** Formats the elapsed duration between two resume dates. */
const formatDuration = (start: string, end?: string | null) => {
  const startDate = dayjs(start);
  const endDate = end ? dayjs(end) : dayjs();
  const years = endDate.diff(startDate, "year");
  if (years >= 1) return `${years} ${pluralUk(years, commonUi.duration.year)}`;
  const months = endDate.diff(startDate, "month");
  if (months >= 1) return `${months} ${pluralUk(months, commonUi.duration.month)}`;
  const days = Math.max(1, endDate.diff(startDate, "day"));
  return `${days} ${pluralUk(days, commonUi.duration.day)}`;
};
/** Chooses the Ukrainian plural form for a numeric value. */
const pluralUk = (value: number, forms: string[]) => {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
};
/** Maps an education degree identifier to its display label. */
const degreeLabel = (degree: string) => ({ JUNIOR_BACHELOR: ui.degreeLabels.juniorBachelor, BACHELOR: ui.degreeLabels.bachelor, MASTER: ui.degreeLabels.master, PHD: ui.degreeLabels.phd, OTHER: ui.degreeLabels.other }[degree] ?? degree);
/** Maps a language proficiency identifier to its display label. */
const languageLevelLabel = (level: string) => cefrLevels.find((item) => item.value === level)?.label ?? level;
/** Selects a chip style from a skill category. */
const skillClass = (category: string) => category.toLowerCase().includes("soft") ? classes.soft : category.toLowerCase().includes("tool") ? classes.tools : classes.hard;
/** Builds a visible location name from a location relation and catalogs. */
function formatLocation(item: LocationJoin, catalogs: StudentCatalogs) {
  const label = [
    catalogs.countries.find((country) => country.id === item.location.countryId)?.name,
    catalogs.regions.find((region) => region.id === item.location.regionId)?.name,
    catalogs.cities.find((city) => city.id === item.location.cityId)?.name,
  ].filter(Boolean).join(", ");
  return label || ui.fallbacks.location;
}
/** Converts unknown API failures into a visible error message. */
function getErrorMessage(error: unknown) { return error instanceof ApiError || error instanceof Error ? error.message : commonUi.messages.unknownError; }

/** Renders the dashboard navigation icon. */
function DashboardIcon() { return <svg viewBox="0 0 24 24"><path d="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z" /></svg>; }
/** Renders the back navigation icon. */
function ArrowIcon() { return <svg viewBox="0 0 24 24"><path d="m10 6 1.4 1.4L8.8 10H20v2H8.8l2.6 2.6L10 16l-5-5 5-5Z" /></svg>; }
/** Renders the vacancies navigation icon. */
function BriefcaseIcon() { return <svg viewBox="0 0 24 24"><path d="M9 6V4h6v2h5a2 2 0 0 1 2 2v4H2V8a2 2 0 0 1 2-2h5Zm2 0h2V5h-2v1ZM2 14h20v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4Z" /></svg>; }
/** Renders the personal profile navigation icon. */
function UserIcon() { return <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" /></svg>; }
/** Renders the resume navigation icon. */
function ResumeIcon() { return <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5L14 3.5ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z" /></svg>; }
/** Renders the search navigation icon. */
function SearchIcon() { return <svg viewBox="0 0 24 24"><path d="m21 19.6-5.2-5.2a7 7 0 1 0-1.4 1.4L19.6 21 21 19.6ZM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z" /></svg>; }
/** Renders an informational status icon. */
function InfoIcon() { return <svg viewBox="0 0 24 24"><path d="M11 17h2v-6h-2v6Zm1-14a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm-1-10h2V7h-2v2Z" /></svg>; }
/** Renders the edit record icon. */
function EditIcon() { return <svg viewBox="0 0 24 24"><path d="M4 17.25V20h2.75L17.8 8.95 15.05 6.2 4 17.25ZM19.7 7.05a1 1 0 0 0 0-1.4l-1.35-1.35a1 1 0 0 0-1.4 0l-1.05 1.05 2.75 2.75 1.05-1.05Z" /></svg>; }
/** Renders the delete record icon. */
function TrashIcon() { return <svg viewBox="0 0 24 24"><path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7ZM9 4h6l1 1h4v2H4V5h4l1-1Z" /></svg>; }
