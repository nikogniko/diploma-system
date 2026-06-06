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
  Menu,
  Modal,
  MultiSelect,
  NumberInput,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError, apiRequest } from "../../api/apiClient";
import { AppLoader } from "../../components/common/AppLoader";
import { AppTooltip } from "../../components/common/AppTooltip";
import { ChipBadge } from "../../components/common/ChipBadge";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { FormSection } from "../../components/common/FormSection";
import { MarkdownView } from "../../components/common/MarkdownView";
import { RichTextEditor } from "../../components/common/RichTextEditor";
import { StatusBadge } from "../../components/common/StatusBadge";
import { RecruiterPublicCard as RecruiterCard } from "../../components/hr/RecruiterPublicCard";
import { RecruiterPublicPreviewDrawer as RecruiterPreviewDrawer } from "../../components/hr/RecruiterPublicPreviewDrawer";
import type { RecruiterPublicPreviewData } from "../../components/hr/RecruiterPublicPreviewDrawer";
import { VacancyPublicPreview } from "../../components/vacancy/VacancyPublicPreview";
import { ApplicationStatusTimeline } from "../../components/application/ApplicationStatusTimeline";
import { ApplicationCard } from "../../components/application/ApplicationCard";
import { ApplicationPipelineToolbar, type ApplicationPipelineFilter } from "../../components/application/ApplicationPipelineToolbar";
import { MatchAnalysisPanel } from "../../components/application/MatchAnalysisPanel";
import { ResumePreview, type ResumeProfile } from "../../components/resume/ResumePreview";
import type { ApplicationRecord, ApplicationResumeResponse, ApplicationStatus } from "../../components/application/applicationTypes";
import { CabinetLayout } from "../../layouts/CabinetLayout";
import { messages } from "../../locales/localizedMessages";
import { CompanyPublicPage as SharedCompanyPublicPage } from "../companies/CompanyPublicPage";
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
type SkillOption = CatalogItem & {
  category: "HARD_SKILL" | "SOFT_SKILL" | "TOOL";
};
type LinkType = "WEBSITE" | "MESSENGER" | "SOCIAL" | "PORTFOLIO" | "OTHER";
type LinkItem = {
  id?: string;
  linkType: LinkType;
  linkName: string;
  value: string;
};
type LinkResource = {
  name: string;
  types: LinkType[];
  domains?: string[];
  allowAnyUrl?: boolean;
};
type LocationFormItem = {
  countryId: number;
  regionId?: number | null;
  cityId?: number | null;
  label: string;
};
type VacancyStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "ARCHIVED";
type SkillWeight = "CRITICAL" | "IMPORTANT" | "NICE_TO_HAVE";
type LanguageLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "NATIVE";
type SalaryPeriod = "PER_MONTH" | "PER_HOUR";
type VacancyManagementTab = "applications" | "preview" | "edit";
type VacancySortBy = "title" | "status" | "closingDate" | "updatedAt";
type SortDirection = "asc" | "desc";
type VacancyApplication = ApplicationRecord;
type HrNavigationState = {
  tab?: string | null;
  vacancyId?: string | null;
  view?: VacancyManagementTab | null;
};
type HrProfile = {
  id: string;
  position: string;
  links: LinkItem[];
  user: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    photoUrl?: string | null;
    status: string;
    email?: string;
    createdAt?: string;
  };
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
  links?: LinkItem[];
  user: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    photoUrl?: string | null;
    status: string;
    email?: string | null;
    createdAt?: string | null;
  };
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
  createdAt: string;
  updatedAt: string;
  hrProfile?: {
    id: string;
    position: string;
    links?: LinkItem[];
    user: {
      firstName: string;
      lastName: string;
      middleName?: string | null;
      photoUrl?: string | null;
      status?: string | null;
      email?: string | null;
      createdAt?: string | null;
    };
    vacancies?: Array<{
      id: string;
      title: string;
      status?: VacancyStatus | string | null;
      updatedAt?: string | null;
      profession?: { name?: string | null } | null;
    }>;
  };
  company?: {
    id: string;
    publicName: string;
    logoUrl?: string | null;
  };
  spheres: Array<{ sphereId: number; sphere?: CatalogItem }>;
  employmentTypes: Array<{
    employmentTypeId: number;
    employmentType?: CatalogItem;
  }>;
  workSchedules: Array<{ workScheduleId: number; workSchedule?: CatalogItem }>;
  workFormats: Array<{ workFormatId: number; workFormat?: CatalogItem }>;
  locations: Array<{
    locationId: string;
    location?: {
      countryId: number;
      regionId?: number | null;
      cityId?: number | null;
    };
  }>;
  skills: Array<{ skillId: number; weight: SkillWeight; skill?: SkillOption }>;
  languages: Array<{
    languageId: number;
    level: LanguageLevel;
    language?: CatalogItem;
  }>;
  _count?: {
    applications?: number;
  };
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type VacancyListMeta = Omit<PaginatedResponse<VacancyRow>, "items">;

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

const ui = messages.hrDashboard;
const commonUi = messages.common;
const currentYear = new Date().getFullYear();
const maxSalaryInput = 1_000_000;
const maxVacancySkills = 30;
const maxVacancyLanguages = 5;
const maxVacancyLocations = 10;
const normalizeVacancyManagementTab = (
  value: string | null,
): VacancyManagementTab =>
  value === "preview" || value === "edit" || value === "applications"
    ? value
    : "applications";
const skillWeightRank: Record<SkillWeight, number> = {
  CRITICAL: 3,
  IMPORTANT: 2,
  NICE_TO_HAVE: 1,
};

const navItems = [
  {
    key: "create-vacancy",
    label: ui.nav.createVacancy,
    icon: <PlusIcon />,
    underline: true,
  },
  {
    key: "vacancies",
    label: ui.nav.vacancies,
    icon: <BriefcaseIcon />,
    underline: true,
  },
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
  { value: "PAUSED", label: "Призупинена" },
  { value: "CLOSED", label: "Закрита" },
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
  const location = useLocation();
  const navigate = useNavigate();
  const { vacancyId: pathVacancyId, view: pathView } = useParams<{ vacancyId?: string; view?: string }>();
  const [initialNavigation] = useState<HrNavigationState>(() => {
    const legacyParams = new URLSearchParams(location.search);
    const pathTab = location.pathname.endsWith("/profile")
      ? "profile"
      : location.pathname.endsWith("/company")
        ? "company"
        : location.pathname.endsWith("/vacancies/new")
          ? "create-vacancy"
          : "vacancies";
    return {
      tab: pathTab !== "vacancies" ? pathTab : legacyParams.get("tab") ?? pathTab,
      vacancyId: pathVacancyId ?? legacyParams.get("vacancyId"),
      view: normalizeVacancyManagementTab(pathView ?? legacyParams.get("view")),
    };
  });
  const initialTab = initialNavigation.tab;
  const initialVacancyId = initialNavigation.vacancyId;
  const initialVacancyManagementTab = normalizeVacancyManagementTab(initialNavigation.view ?? null);
  const [active, setActive] = useState(
    initialVacancyId
      ? "vacancies"
      : initialTab && navItems.some((item) => item.key === initialTab)
      ? initialTab
      : "vacancies",
  );
  const [selectedVacancy, setSelectedVacancy] = useState<VacancyRow | null>(
    null,
  );
  const [hrProfile, setHrProfile] = useState<HrProfile | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [companyHrs, setCompanyHrs] = useState<CompanyHr[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [blockErrors, setBlockErrors] = useState<Record<string, string | null>>(
    {},
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [vacancies, setVacancies] = useState<VacancyRow[]>([]);
  const [vacancyMeta, setVacancyMeta] = useState<VacancyListMeta>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  });
  const [vacancySearch, setVacancySearch] = useState("");
  const [vacancyStatusFilter, setVacancyStatusFilter] = useState<
    VacancyStatus | "ALL"
  >("ALL");
  const [vacancyPage, setVacancyPage] = useState(1);
  const [vacancyPageSize, setVacancyPageSize] = useState(10);
  const [vacancySortBy, setVacancySortBy] =
    useState<VacancySortBy>("updatedAt");
  const [vacancySortDirection, setVacancySortDirection] =
    useState<SortDirection>("desc");
  const [isVacancyTableLoading, setIsVacancyTableLoading] = useState(false);
  const [vacancyListError, setVacancyListError] = useState<string | null>(null);
  const [isCompanyPreviewOpen, setIsCompanyPreviewOpen] = useState(false);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [editingVacancyId, setEditingVacancyId] = useState<string | null>(null);
  const [vacancyManagementTab, setVacancyManagementTab] =
    useState<VacancyManagementTab>(initialVacancyManagementTab);
  const [vacancyForm, setVacancyForm] = useState<VacancyFormState>(() =>
    emptyVacancyForm(),
  );
  const [selectedSkillDraft, setSelectedSkillDraft] = useState({
    skillId: "",
    weight: "IMPORTANT" as SkillWeight,
  });
  const [selectedLanguageDraft, setSelectedLanguageDraft] = useState<{
    languageId: string;
    level: LanguageLevel | "";
  }>({ languageId: "", level: "" });

  const [hrForm, setHrForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    position: "",
    links: [] as LinkItem[],
  });
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
  const [newLocation, setNewLocation] = useState({
    countryId: 0,
    regionId: 0,
    cityId: 0,
  });

  const options = useMemo(
    () => ({
      languages: catalogs?.languages.map(asOption) ?? [],
      employmentTypes: catalogs?.employmentTypes.map(asOption) ?? [],
      workSchedules: catalogs?.workSchedules.map(asOption) ?? [],
      workFormats: catalogs?.workFormats.map(asOption) ?? [],
      professions: catalogs?.professions.map(asOption) ?? [],
      spheres: catalogs?.spheres.map(asOption) ?? [],
      countries: catalogs?.countries.map(asOption) ?? [],
      regions:
        catalogs?.regions
          .filter((region) => region.countryId === newLocation.countryId)
          .map(asOption) ?? [],
      cities:
        catalogs?.cities
          .filter((city) => city.regionId === newLocation.regionId)
          .map(asOption) ?? [],
      skills: flattenSkills(catalogs?.skillsByCategory).map((skill) => ({
        value: String(skill.id),
        label: skill.name,
        category: skill.category,
      })),
      officeLocations:
        catalogs?.officeLocations.map((item) => ({
          value: item.locationId,
          label: formatLocationByIds(
            {
              countryId: item.location.countryId,
              regionId: item.location.regionId ?? 0,
              cityId: item.location.cityId ?? 0,
            },
            catalogs,
          ),
        })) ?? [],
    }),
    [catalogs, newLocation.countryId, newLocation.regionId],
  );

  /** Формує query-рядок для серверної пагінації вакансій. */
  const buildVacancyListPath = (
    overrides: Partial<{
      page: number;
      pageSize: number;
      search: string;
      status: VacancyStatus | "ALL";
      sortBy: VacancySortBy;
      sortDirection: SortDirection;
    }> = {},
  ) => {
    const params = new URLSearchParams({
      page: String(overrides.page ?? vacancyPage),
      pageSize: String(overrides.pageSize ?? vacancyPageSize),
      sortBy: overrides.sortBy ?? vacancySortBy,
      sortDirection: overrides.sortDirection ?? vacancySortDirection,
    });
    const search = overrides.search ?? vacancySearch;
    const status = overrides.status ?? vacancyStatusFilter;
    if (search.trim()) params.set("search", search.trim());
    if (status !== "ALL") params.set("status", status);
    return `/vacancies/my-cabinet?${params.toString()}`;
  };

  /** Завантажує профіль рекрутера, компанію, команду та довідники. */
  const loadDashboard = async () => {
    setPageError(null);
    setIsLoading(true);
    try {
      const token = await getToken();
      const [hrData, companyData, hrsData, catalogData, vacancyData] =
        await Promise.all([
          apiRequest<HrProfile>("/hr-profiles/my-cabinet", token),
          apiRequest<CompanyProfile>("/companies/my-cabinet", token),
          apiRequest<CompanyHr[]>("/companies/my-cabinet/hr-profiles", token),
          apiRequest<Catalogs>("/vacancies/catalogs", token),
          apiRequest<PaginatedResponse<VacancyRow>>(
            buildVacancyListPath(),
            token,
          ),
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
          label: formatLocationByIds(
            {
              countryId: location.countryId,
              regionId: location.regionId ?? 0,
              cityId: location.cityId ?? 0,
            },
            catalogData,
          ),
        })),
        links: companyData.links ?? [],
      });
      setVacancies(vacancyData.items.filter(Boolean));
      setVacancyMeta({
        page: vacancyData.page,
        pageSize: vacancyData.pageSize,
        totalItems: vacancyData.totalItems,
        totalPages: vacancyData.totalPages,
      });
      const routeVacancyId = initialNavigation.vacancyId;
      if (routeVacancyId) {
        const routeView = normalizeVacancyManagementTab(initialNavigation.view ?? null);
        const vacancy =
          vacancyData.items.find((item) => item.id === routeVacancyId) ??
          (await apiRequest<VacancyRow>(
            `/vacancies/my-cabinet/${routeVacancyId}`,
            token,
          ));
        setActive("vacancies");
        setVacancyManagementTab(routeView);
        if (routeView === "edit") {
          setEditingVacancyId(vacancy.id);
          setVacancyForm(vacancyToForm(vacancy));
          setSelectedVacancy(null);
        } else {
          setEditingVacancyId(null);
          setSelectedVacancy(vacancy);
        }
      }
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  /** Перезавантажує тільки таблицю вакансій, не чіпаючи форми профілю та компанії. */
  const loadVacancies = async (
    overrides: Partial<{
      page: number;
      pageSize: number;
      search: string;
      status: VacancyStatus | "ALL";
      sortBy: VacancySortBy;
      sortDirection: SortDirection;
    }> = {},
  ) => {
    setVacancyListError(null);
    setIsVacancyTableLoading(true);
    try {
      const token = await getToken();
      const result = await apiRequest<PaginatedResponse<VacancyRow>>(
        buildVacancyListPath(overrides),
        token,
      );
      setVacancies(result.items.filter(Boolean));
      setVacancyMeta({
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      });
    } catch (error) {
      setVacancyListError(getErrorMessage(error));
    } finally {
      setIsVacancyTableLoading(false);
    }
  };

  const openVacancyManagement = (
    vacancy: VacancyRow,
    view: VacancyManagementTab = "preview",
  ) => {
    setEditingVacancyId(null);
    setSelectedVacancy(vacancy);
    setVacancyManagementTab(view);
    setIsCompanyPreviewOpen(false);
    setActive("vacancies");
    navigate(`/hr/vacancies/${vacancy.id}/${view}`);
  };

  const setLocalVacancyManagementTab = (tab: VacancyManagementTab) => {
    setVacancyManagementTab(tab);
    const vacancyId = editingVacancyId ?? selectedVacancy?.id;
    if (vacancyId) navigate(`/hr/vacancies/${vacancyId}/${tab}`);
  };

  useEffect(() => {
    if (location.search) {
      const legacyPath = initialNavigation.vacancyId
        ? `/hr/vacancies/${initialNavigation.vacancyId}/${initialNavigation.view ?? "applications"}`
        : initialNavigation.tab === "profile"
          ? "/hr/profile"
          : initialNavigation.tab === "company"
            ? "/hr/company"
            : initialNavigation.tab === "create-vacancy"
              ? "/hr/vacancies/new"
              : "/hr/vacancies";
      navigate(legacyPath, { replace: true });
    }
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Синхронізує видимий екран кабінету з path route при browser navigation. */
  useEffect(() => {
    if (isLoading || location.search) return;
    if (location.pathname.endsWith("/profile")) {
      setActive("profile");
      setSelectedVacancy(null);
      setEditingVacancyId(null);
      return;
    }
    if (location.pathname.endsWith("/company")) {
      setActive("company");
      setSelectedVacancy(null);
      setEditingVacancyId(null);
      return;
    }
    if (location.pathname.endsWith("/vacancies/new")) {
      setActive("create-vacancy");
      setSelectedVacancy(null);
      setEditingVacancyId(null);
      return;
    }
    if (!pathVacancyId) {
      setActive("vacancies");
      setSelectedVacancy(null);
      setEditingVacancyId(null);
      return;
    }
    const view = normalizeVacancyManagementTab(pathView ?? null);
    /** Відкриває потрібне представлення вакансії після відновлення route. */
    const setRouteVacancy = (vacancy: VacancyRow) => {
      setActive("vacancies");
      setVacancyManagementTab(view);
      if (view === "edit") {
        setEditingVacancyId(vacancy.id);
        setVacancyForm(vacancyToForm(vacancy));
        setSelectedVacancy(null);
      } else {
        setEditingVacancyId(null);
        setSelectedVacancy(vacancy);
      }
    };
    const vacancy = vacancies.find((item) => item.id === pathVacancyId)
      ?? (selectedVacancy?.id === pathVacancyId ? selectedVacancy : null);
    if (vacancy) {
      setRouteVacancy(vacancy);
      return;
    }
    let isCurrentRoute = true;
    void (async () => {
      try {
        const token = await getToken();
        const loadedVacancy = await apiRequest<VacancyRow>(`/vacancies/my-cabinet/${pathVacancyId}`, token);
        if (isCurrentRoute) setRouteVacancy(loadedVacancy);
      } catch (error) {
        if (isCurrentRoute) setPageError(getErrorMessage(error));
      }
    })();
    return () => {
      isCurrentRoute = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isLoading]);

  /** Запускає збереження окремого блоку з локальним loader та помилкою. */
  const runBlock = async (block: string, action: () => Promise<void>) => {
    setBlockErrors((current) => ({ ...current, [block]: null }));
    setSaving((current) => ({ ...current, [block]: true }));
    try {
      await action();
      await loadDashboard();
    } catch (error) {
      setBlockErrors((current) => ({
        ...current,
        [block]: getErrorMessage(error),
      }));
    } finally {
      setSaving((current) => ({ ...current, [block]: false }));
    }
  };

  /** Зберігає посаду та публічні посилання рекрутера. */
  const saveHrProfile = () =>
    runBlock("hr", async () => {
      if (
        !hrForm.firstName.trim() ||
        !hrForm.lastName.trim() ||
        !hrForm.position.trim()
      )
        throw new Error(ui.errors.required);
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
  const saveCompanyProfile = () =>
    runBlock("company", async () => {
      if (
        !companyForm.registrationNumber.trim() ||
        !companyForm.legalName.trim() ||
        !companyForm.publicName.trim() ||
        !companyForm.about.trim()
      )
        throw new Error(ui.errors.required);
      if (companyForm.sphereIds.length > 5)
        throw new Error(ui.errors.spheresLimit);
      if (companyForm.locations.length > 10)
        throw new Error(ui.errors.locationsLimit);
      if (companyForm.links.length > 6) throw new Error(ui.errors.linksLimit);
      if (
        companyForm.registrationType === "COMPANY" &&
        companyForm.registrationNumber.length !== 8
      )
        throw new Error(messages.onboarding.company.edrpouError);
      if (
        companyForm.registrationType === "FOP" &&
        companyForm.registrationNumber.length !== 10
      )
        throw new Error(messages.onboarding.company.ipnError);
      if (!isValidEmail(companyForm.publicEmail))
        throw new Error(ui.errors.email);
      if (
        companyForm.publicPhone &&
        !isValidUkrainianPhone(companyForm.publicPhone)
      )
        throw new Error(ui.errors.phone);
      if (companyForm.websiteUrl && !isValidUrlLike(companyForm.websiteUrl))
        throw new Error(ui.errors.url);
      if (companyForm.logoUrl && !isValidUrlLike(companyForm.logoUrl))
        throw new Error(ui.errors.url);
      if (
        companyForm.foundationYear < 1800 ||
        companyForm.foundationYear > currentYear
      )
        throw new Error(ui.errors.year);
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
          locations: companyForm.locations.map(
            ({ countryId, regionId, cityId }) => ({
              countryId,
              regionId,
              cityId,
            }),
          ),
          links: normalizeLinks(companyForm.links),
        }),
      });
    });

  /** Додає локацію офісу у локальний список з перевіркою дубля. */
  const addLocation = () => {
    if (!newLocation.countryId) return;
    if (companyForm.locations.length >= 10) {
      setBlockErrors((current) => ({
        ...current,
        company: ui.errors.locationsLimit,
      }));
      return;
    }
    const location = {
      countryId: newLocation.countryId,
      regionId: newLocation.regionId || null,
      cityId: newLocation.cityId || null,
      label: formatLocationByIds(newLocation, catalogs),
    };
    const exists = companyForm.locations.some(
      (item) =>
        item.countryId === location.countryId &&
        item.regionId === location.regionId &&
        item.cityId === location.cityId,
    );
    if (exists) {
      setBlockErrors((current) => ({
        ...current,
        company: ui.errors.locationDuplicate,
      }));
      return;
    }
    setCompanyForm((current) => ({
      ...current,
      locations: [...current.locations, location],
    }));
    setNewLocation((current) => ({
      countryId: current.countryId,
      regionId: 0,
      cityId: 0,
    }));
  };

  /** Додає або оновлює навичку у формі вакансії. */
  const upsertVacancySkill = () => {
    if (!selectedSkillDraft.skillId) return;
    setVacancyForm((current) => {
      const exists = current.skills.some(
        (item) => item.skillId === selectedSkillDraft.skillId,
      );
      return {
        ...current,
        skills: exists
          ? current.skills.map((item) =>
              item.skillId === selectedSkillDraft.skillId
                ? { ...item, weight: selectedSkillDraft.weight }
                : item,
            )
          : [...current.skills, { ...selectedSkillDraft }],
      };
    });
    setSelectedSkillDraft((current) => ({
      skillId: "",
      weight: current.weight,
    }));
    setBlockErrors((current) => ({ ...current, vacancy: null }));
  };

  /** Додає або оновлює мовну вимогу у формі вакансії. */
  const upsertVacancyLanguage = () => {
    if (!selectedLanguageDraft.languageId || !selectedLanguageDraft.level)
      return;
    const languageDraft = {
      languageId: selectedLanguageDraft.languageId,
      level: selectedLanguageDraft.level as LanguageLevel,
    };
    setVacancyForm((current) => {
      const exists = current.languages.some(
        (item) => item.languageId === languageDraft.languageId,
      );
      return {
        ...current,
        languages: exists
          ? current.languages.map((item) =>
              item.languageId === languageDraft.languageId
                ? { ...item, level: languageDraft.level }
                : item,
            )
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
    setVacancyManagementTab("edit");
    setIsCompanyPreviewOpen(false);
    setActive("vacancies");
    navigate(`/hr/vacancies/${vacancy.id}/edit`);
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

  /** Повертає управління вакансіями до таблиці без редагування чи перегляду конкретної вакансії. */
  const closeVacancyManagement = () => {
    clearVacancyForm();
    setSelectedVacancy(null);
    setVacancyManagementTab("applications");
    navigate("/hr/vacancies");
  };

  /** Створює або оновлює вакансію через backend API. */
  const saveVacancy = (status: "DRAFT" | "ACTIVE") =>
    runBlock("vacancy", async () => {
      validateVacancyForm(vacancyForm, options.officeLocations.length);
      const token = await getToken();
      const path = editingVacancyId
        ? `/vacancies/my-cabinet/${editingVacancyId}`
        : "/vacancies/my-cabinet";
      await apiRequest(path, token, {
        method: editingVacancyId ? "PATCH" : "POST",
        body: JSON.stringify(vacancyFormToPayload({ ...vacancyForm, status })),
      });
      clearVacancyForm();
      setActive("vacancies");
      navigate("/hr/vacancies");
    });

  /** Змінює статус вакансії з таблиці управління. */
  const changeVacancyStatus = (vacancyId: string, status: VacancyStatus) =>
    runBlock("vacancyBoard", async () => {
      const token = await getToken();
      const updated = await apiRequest<VacancyRow>(
        `/vacancies/my-cabinet/${vacancyId}/status`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      setSelectedVacancy((current) =>
        current?.id === vacancyId ? updated : current,
      );
    });

  /** Архівує вакансію з таблиці управління. */
  const archiveVacancy = (vacancyId: string) =>
    runBlock("vacancyBoard", async () => {
      const token = await getToken();
      const updated = await apiRequest<VacancyRow>(
        `/vacancies/my-cabinet/${vacancyId}/archive`,
        token,
        { method: "POST" },
      );
      setSelectedVacancy((current) =>
        current?.id === vacancyId ? updated : current,
      );
    });

  if (isLoading) return <AppLoader text={ui.loading} />;

  return (
    <CabinetLayout
      navItems={navItems}
      activeKey={active}
      autoCollapseKeys={["vacancies"]}
      collapseSignal={collapseSignal}
      storageKey="hr-cabinet-sidebar"
      onSelect={(key) => {
        setSelectedVacancy(null);
        setIsCompanyPreviewOpen(false);
        if (key === "create-vacancy") clearVacancyForm();
        if (key !== "vacancies") setEditingVacancyId(null);
        setActive(key);
        navigate(key === "create-vacancy"
          ? "/hr/vacancies/new"
          : key === "vacancies"
            ? "/hr/vacancies"
            : `/hr/${key}`);
      }}
    >
      <Stack gap="md">
        <ErrorBanner message={pageError} />
        {isCompanyPreviewOpen ? (
          <SharedCompanyPublicPage
            embedded
            initialData={company ? { company, companyHrs, vacancies } : null}
            catalogs={catalogs}
            onBack={() => setIsCompanyPreviewOpen(false)}
            onVacancyOpen={(vacancyId) => {
              const vacancy = vacancies.find((item) => item.id === vacancyId);
              if (!vacancy) return;
              openVacancyManagement(vacancy, "preview");
            }}
          />
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
            {active === "vacancies" &&
              (editingVacancyId ? (
                <VacancyManagementPage
                  vacancy={
                    vacancies.find(
                      (vacancy) => vacancy.id === editingVacancyId,
                    ) ?? null
                  }
                  activeTab={vacancyManagementTab}
                  setActiveTab={setLocalVacancyManagementTab}
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
                  onStatusChange={changeVacancyStatus}
                  onArchive={archiveVacancy}
                  onBack={closeVacancyManagement}
                />
              ) : selectedVacancy ? (
                <VacancyManagementPage
                  vacancy={selectedVacancy}
                  activeTab={vacancyManagementTab}
                  setActiveTab={setLocalVacancyManagementTab}
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
                  onEdit={() => startVacancyEdit(selectedVacancy)}
                  onStatusChange={changeVacancyStatus}
                  onArchive={archiveVacancy}
                  onBack={closeVacancyManagement}
                />
              ) : (
                <VacancyBoard
                  vacancies={vacancies}
                  meta={vacancyMeta}
                  search={vacancySearch}
                  statusFilter={vacancyStatusFilter}
                  page={vacancyPage}
                  pageSize={vacancyPageSize}
                  sortBy={vacancySortBy}
                  sortDirection={vacancySortDirection}
                  loading={isVacancyTableLoading}
                  error={vacancyListError}
                  onSearchChange={(search) => {
                    setVacancySearch(search);
                    setVacancyPage(1);
                    void loadVacancies({ search, page: 1 });
                  }}
                  onStatusFilterChange={(status) => {
                    setVacancyStatusFilter(status);
                    setVacancyPage(1);
                    void loadVacancies({ status, page: 1 });
                  }}
                  onPageChange={(page) => {
                    setVacancyPage(page);
                    void loadVacancies({ page });
                  }}
                  onPageSizeChange={(pageSize) => {
                    setVacancyPageSize(pageSize);
                    setVacancyPage(1);
                    void loadVacancies({ pageSize, page: 1 });
                  }}
                  onSortChange={(sortBy) => {
                    const sortDirection =
                      vacancySortBy === sortBy && vacancySortDirection === "asc"
                        ? "desc"
                        : "asc";
                    setVacancySortBy(sortBy);
                    setVacancySortDirection(sortDirection);
                    setVacancyPage(1);
                    void loadVacancies({ sortBy, sortDirection, page: 1 });
                  }}
                  onCreate={() => {
                    clearVacancyForm();
                    setActive("create-vacancy");
                    navigate("/hr/vacancies/new");
                  }}
                  onSelect={(vacancy) => {
                    openVacancyManagement(vacancy, "preview");
                  }}
                  onOpenApplications={(vacancy) => {
                    openVacancyManagement(vacancy, "applications");
                  }}
                  onEdit={startVacancyEdit}
                  onStatusChange={changeVacancyStatus}
                  onArchive={archiveVacancy}
                />
              ))}
            {active === "profile" && (
              <HrProfileTab
                profile={hrProfile}
                form={hrForm}
                setForm={setHrForm}
                error={blockErrors.hr}
                saving={saving.hr}
                activeVacanciesCount={
                  vacancies.filter((vacancy) => vacancy.status === "ACTIVE")
                    .length
                }
                totalVacanciesCount={vacancies.length}
                vacancies={vacancies}
                onCompanyOpen={() => setIsCompanyPreviewOpen(true)}
                onClearError={() =>
                  setBlockErrors((current) => ({ ...current, hr: null }))
                }
                onSave={saveHrProfile}
              />
            )}
            {active === "company" && (
              <CompanyProfileTab
                company={company}
                companyHrs={companyHrs}
                form={companyForm}
                setForm={setCompanyForm}
                options={options}
                vacancies={vacancies}
                newLocation={newLocation}
                setNewLocation={setNewLocation}
                error={blockErrors.company}
                saving={saving.company}
                onAddLocation={addLocation}
                onPreview={() => {
                  setCollapseSignal((value) => value + 1);
                  setIsCompanyPreviewOpen(true);
                }}
                onClearError={() =>
                  setBlockErrors((current) => ({ ...current, company: null }))
                }
                onSave={saveCompanyProfile}
              />
            )}
          </>
        )}
      </Stack>
    </CabinetLayout>
  );
}

function VacancyBoard(props: {
  vacancies: VacancyRow[];
  meta: VacancyListMeta;
  search: string;
  statusFilter: VacancyStatus | "ALL";
  page: number;
  pageSize: number;
  sortBy: VacancySortBy;
  sortDirection: SortDirection;
  loading: boolean;
  error?: string | null;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: VacancyStatus | "ALL") => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sortBy: VacancySortBy) => void;
  onCreate: () => void;
  onSelect: (vacancy: VacancyRow, view?: VacancyManagementTab) => void;
  onOpenApplications: (vacancy: VacancyRow) => void;
  onEdit: (vacancy: VacancyRow) => void;
  onStatusChange: (vacancyId: string, status: VacancyStatus) => void;
  onArchive: (vacancyId: string) => void;
}) {
  const {
    vacancies,
    meta,
    search,
    statusFilter,
    page,
    pageSize,
    sortBy,
    sortDirection,
    loading,
    error,
    onSearchChange,
    onStatusFilterChange,
    onPageChange,
    onPageSizeChange,
    onSortChange,
    onCreate,
    onSelect,
    onOpenApplications,
    onEdit,
    onStatusChange,
    onArchive,
  } = props;
  const hasFilters = Boolean(search.trim()) || statusFilter !== "ALL";

  return (
    <>
      <TabHeader
        title={ui.vacancies.title}
        description={ui.vacancies.description}
      />
      <Paper className={classes.vacancyTableCard}>
        <div className={classes.vacancyToolbar}>
          <TextInput
            value={search}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder={ui.vacancies.searchPlaceholder}
          />
          <Select
            data={[
              { value: "ALL", label: ui.vacancies.allStatuses },
              ...vacancyStatuses,
            ]}
            value={statusFilter}
            onChange={(value) =>
              onStatusFilterChange((value ?? "ALL") as VacancyStatus | "ALL")
            }
          />
          <Select
            data={[
              { value: "5", label: "5" },
              { value: "10", label: "10" },
              { value: "20", label: "20" },
            ]}
            value={String(pageSize)}
            onChange={(value) => onPageSizeChange(Number(value ?? 10))}
          />
        </div>
        <InlineError message={error} />
        {loading ? (
          <VacancyTableSkeleton />
        ) : vacancies.length ? (
          <>
            <Table highlightOnHover className={classes.table}>
              <Table.Thead>
                <Table.Tr>
                  <SortableHeader
                    label={ui.vacancies.position}
                    sortKey="title"
                    sortBy={sortBy}
                    direction={sortDirection}
                    onSort={onSortChange}
                  />
                  <SortableHeader
                    label={ui.vacancies.status}
                    sortKey="status"
                    sortBy={sortBy}
                    direction={sortDirection}
                    onSort={onSortChange}
                  />
                  <SortableHeader
                    label={ui.vacancies.responses}
                    sortKey="updatedAt"
                    sortBy={sortBy}
                    direction={sortDirection}
                    onSort={onSortChange}
                  />
                  <SortableHeader
                    label={ui.vacancies.updatedAt}
                    sortKey="updatedAt"
                    sortBy={sortBy}
                    direction={sortDirection}
                    onSort={onSortChange}
                  />
                  <SortableHeader
                    label={ui.vacancies.deadline}
                    sortKey="closingDate"
                    sortBy={sortBy}
                    direction={sortDirection}
                    onSort={onSortChange}
                  />
                  <Table.Th>{ui.vacancies.actions}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {vacancies.map((vacancy) => (
                  <Table.Tr
                    key={vacancy.id}
                    className={classes.vacancyRow}
                    onDoubleClick={() => onOpenApplications(vacancy)}
                  >
                    <Table.Td>
                      <Text fw={900} className={classes.vacancyTitleCell}>
                        {vacancy.title}
                      </Text>
                      <Text className={classes.muted}>
                        {vacancy.profession?.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <VacancyStatusBadge status={vacancy.status} />
                    </Table.Td>
                    <Table.Td>
                      <Text fw={800}>{vacancy._count?.applications ?? 0}</Text>
                    </Table.Td>
                    <Table.Td>{dateShort(vacancy.updatedAt)}</Table.Td>
                    <Table.Td>{dateShort(vacancy.closingDate)}</Table.Td>
                    <Table.Td>
                      <VacancyRowActions
                        vacancy={vacancy}
                        onSelect={onSelect}
                        onEdit={onEdit}
                        onStatusChange={onStatusChange}
                        onArchive={onArchive}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={meta.totalItems}
              totalPages={meta.totalPages}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        ) : (
          <VacancyEmptyState hasFilters={hasFilters} onCreate={onCreate} />
        )}
      </Paper>
    </>
  );
}

function VacancyTableSkeleton() {
  return (
    <Stack gap="xs">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} height={48} radius="md" />
      ))}
    </Stack>
  );
}

function SortableHeader({
  label,
  sortKey,
  sortBy,
  direction,
  onSort,
}: {
  label: string;
  sortKey: VacancySortBy;
  sortBy: VacancySortBy;
  direction: SortDirection;
  onSort: (sortBy: VacancySortBy) => void;
}) {
  const isActive = sortBy === sortKey;
  return (
    <Table.Th>
      <button
        type="button"
        className={classes.sortButton}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span>{isActive ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </Table.Th>
  );
}

function VacancyStatusBadge({ status }: { status: VacancyStatus }) {
  return (
    <Badge className={classes.vacancyStatusBadge} data-status={status}>
      {statusLabel(status)}
    </Badge>
  );
}

function VacancyRowActions({
  vacancy,
  onSelect,
  onEdit,
  onStatusChange,
  onArchive,
}: {
  vacancy: VacancyRow;
  onSelect: (vacancy: VacancyRow) => void;
  onEdit: (vacancy: VacancyRow) => void;
  onStatusChange: (vacancyId: string, status: VacancyStatus) => void;
  onArchive: (vacancyId: string) => void;
}) {
  const actions = getVacancyStatusActions(vacancy.status);
  return (
    <Group gap="xs" wrap="nowrap">
      <AppTooltip label={ui.vacancies.view}>
        <button
          type="button"
          className={classes.actionIconButton}
          onClick={() => onSelect(vacancy)}
        >
          <EyeIcon />
        </button>
      </AppTooltip>
      {actions.length > 0 && (
        <Menu shadow="md" width={220} position="bottom-end">
          <Menu.Target>
            <button
              type="button"
              className={classes.actionIconButton}
              aria-label={ui.vacancies.moreActions}
            >
              <MoreIcon />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            {actions.map((action) => (
              <Menu.Item
                key={action.key}
                leftSection={action.icon}
                color={action.danger ? "red" : undefined}
                onClick={() => {
                  if (action.type === "edit") onEdit(vacancy);
                  if (action.type === "status")
                    onStatusChange(vacancy.id, action.status);
                  if (action.type === "archive") onArchive(vacancy.id);
                }}
              >
                {action.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}

function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className={classes.tablePagination}>
      <Text className={classes.muted}>
        {ui.vacancies.pagination.total}: {totalItems}
      </Text>
      <Pagination
        total={totalPages}
        value={page}
        onChange={onPageChange}
        size="sm"
        radius="xl"
      />
      <Select
        className={classes.pageSizeSelect}
        data={[
          { value: "5", label: "5" },
          { value: "10", label: "10" },
          { value: "20", label: "20" },
        ]}
        value={String(pageSize)}
        onChange={(value) => onPageSizeChange(Number(value ?? 10))}
      />
    </div>
  );
}

function VacancyEmptyState({
  hasFilters,
  onCreate,
}: {
  hasFilters: boolean;
  onCreate: () => void;
}) {
  return (
    <div className={classes.emptyState}>
      <Text fw={900}>
        {hasFilters ? ui.vacancies.emptyFiltered : ui.vacancies.empty}
      </Text>
      {!hasFilters && (
        <Button variant="light" leftSection={<PlusIcon />} onClick={onCreate}>
          {ui.nav.createVacancy}
        </Button>
      )}
    </div>
  );
}

function VacancyManagementPage(
  props: Omit<
    Parameters<typeof CreateVacancyTab>[0],
    "editingVacancy" | "mode"
  > & {
    vacancy: VacancyRow | null;
    activeTab: VacancyManagementTab;
    setActiveTab: (tab: VacancyManagementTab) => void;
    onEdit?: () => void;
    onStatusChange: (vacancyId: string, status: VacancyStatus) => void;
    onArchive: (vacancyId: string) => void;
    onBack: () => void;
  },
) {
  const {
    vacancy,
    activeTab,
    setActiveTab,
    onEdit,
    onStatusChange,
    onArchive,
    onBack,
    options,
    ...formProps
  } = props;
  const primaryAction = vacancy
    ? getVacancyPrimaryAction(vacancy.status)
    : null;
  return (
    <>
      <button type="button" className={classes.backButton} onClick={onBack}>
        <ArrowIcon /> {ui.vacancies.back}
      </button>
      <div className={classes.managementHeading}>
        <TabHeader
          title={vacancy?.title ?? ui.createVacancy.editTitle}
          description={ui.vacancies.pipelineDescription}
        />
        {vacancy && (
          <div className={classes.vacancyQuickActions}>
            {primaryAction && (
              <Button
                onClick={() =>
                  primaryAction.type === "archive"
                    ? onArchive(vacancy.id)
                    : onStatusChange(vacancy.id, primaryAction.status)
                }
              >
                {primaryAction.label}
              </Button>
            )}
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <Button variant="subtle" rightSection={<MoreIcon />}>
                  {ui.vacancies.moreActions}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {getVacancyStatusActions(vacancy.status)
                  .filter(
                    (action) =>
                      action.key !== primaryAction?.key && action.key !== "edit",
                  )
                  .map((action) => (
                    <Menu.Item
                      key={action.key}
                      leftSection={action.icon}
                      color={action.danger ? "red" : undefined}
                      onClick={() => {
                        if (action.type === "status")
                          onStatusChange(vacancy.id, action.status);
                        if (action.type === "archive") onArchive(vacancy.id);
                      }}
                    >
                      {action.label}
                    </Menu.Item>
                  ))}
              </Menu.Dropdown>
            </Menu>
          </div>
        )}
      </div>
      <div className={classes.managementTabs}>
        <button
          type="button"
          className={
            activeTab === "applications"
              ? classes.managementTabActive
              : classes.managementTab
          }
          onClick={() => setActiveTab("applications")}
        >
          {ui.vacancies.managementTabs.applications}
        </button>
        <button
          type="button"
          className={
            activeTab === "preview"
              ? classes.managementTabActive
              : classes.managementTab
          }
          onClick={() => setActiveTab("preview")}
        >
          {ui.vacancies.managementTabs.preview}
        </button>
        <button
          type="button"
          className={
            activeTab === "edit"
              ? classes.managementTabActive
              : classes.managementTab
          }
          onClick={() => {
            if (onEdit) onEdit();
            setActiveTab("edit");
          }}
        >
          {ui.vacancies.managementTabs.edit}
        </button>
      </div>
      {activeTab === "applications" && (
        <>
          {vacancy && <VacancyApplicationsPanel vacancyId={vacancy.id} />}
        </>
      )}
      {activeTab === "preview" && (
        <VacancyPreview vacancy={vacancy} options={options} />
      )}
      {activeTab === "edit" && (
        <CreateVacancyTab
          {...formProps}
          options={options}
          editingVacancy={vacancy}
          mode="edit"
        />
      )}
    </>
  );
}

/** Показує та дозволяє вручну оновлювати відгуки для вакансії поточного HR. */
function VacancyApplicationsPanel({ vacancyId }: { vacancyId: string }) {
  const { getToken } = useAuth();
  const [items, setItems] = useState<VacancyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApplicationPipelineFilter>("ALL");
  const [sortBy, setSortBy] = useState<"score" | "percent" | "date">("score");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<ApplicationResumeResponse<ResumeProfile> | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [rejectApplicationId, setRejectApplicationId] = useState<string | null>(null);
  const applicationUi = ui.vacancies.applications;
  const moduleUi = messages.applicationModule;

  /** Завантажує applications вакансії через ownership-aware endpoint. */
  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      setItems(await apiRequest<VacancyApplication[]>(`/vacancies/${vacancyId}/applications`, token));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadApplications);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacancyId]);

  /** Змінює статус одного application і відображає оновлений запис без reload сторінки. */
  const changeApplicationStatus = async (applicationId: string, status: string | null) => {
    if (!status) return;
    setSavingId(applicationId);
    setError(null);
    try {
      const token = await getToken();
      const updated = await apiRequest<VacancyApplication>(`/applications/${applicationId}/status`, token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setItems((current) => current.map((item) => item.id === applicationId ? updated : item));
    } catch (updateError) {
      setError(getErrorMessage(updateError) || applicationUi.updateError);
    } finally {
      setSavingId(null);
    }
  };

  /** Відкриває резюме кандидата через endpoint, що застосовує правила видимості контактів. */
  const openResume = async (applicationId: string) => {
    setResumeOpen(true);
    setResumeData(null);
    setResumeLoading(true);
    setError(null);
    try {
      const token = await getToken();
      setResumeData(await apiRequest<ApplicationResumeResponse<ResumeProfile>>(`/applications/${applicationId}/resume`, token));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setResumeOpen(false);
    } finally {
      setResumeLoading(false);
    }
  };

  const counts = (["SENT", "VIEWED", "SHORTLISTED", "INTERVIEW_INVITED", "OFFERED", "HIRED", "REJECTED", "WITHDRAWN"] as ApplicationStatus[])
    .reduce<Record<ApplicationPipelineFilter, number>>((result, status) => {
      result[status] = items.filter((item) => item.status === status).length;
      return result;
    }, { ALL: items.length } as Record<ApplicationPipelineFilter, number>);

  const visibleItems = [...items]
    .filter((application) => statusFilter === "ALL" || application.status === statusFilter)
    .sort((first, second) => {
      const firstActive = first.matchDetails?.requirementEligibility?.matchesBlockingRequirements !== false;
      const secondActive = second.matchDetails?.requirementEligibility?.matchesBlockingRequirements !== false;
      if (firstActive !== secondActive) return firstActive ? -1 : 1;
      if (sortBy === "date") return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      if (sortBy === "percent") {
        return (second.matchDetails?.baseRequirementsPercent ?? -1) - (first.matchDetails?.baseRequirementsPercent ?? -1)
          || (second.matchScore ?? -1) - (first.matchScore ?? -1)
          || new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      }
      return (second.matchScore ?? -1) - (first.matchScore ?? -1)
        || new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });

  return <>
    <Drawer
      opened={resumeOpen}
      onClose={() => setResumeOpen(false)}
      title={messages.studentDashboard.resumePreview.drawerTitle}
      position="right"
      size="min(980px, 92vw)"
    >
      {resumeLoading ? <AppLoader text={moduleUi.hr.resumeLoading} /> : resumeData && (
        <ResumePreview profile={resumeData.profile} contactAccess={resumeData.contactAccess} />
      )}
    </Drawer>
    <Modal centered opened={Boolean(rejectApplicationId)} onClose={() => setRejectApplicationId(null)} title={moduleUi.hr.rejectConfirmTitle}>
      <Text>{moduleUi.hr.rejectConfirmText}</Text>
      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={() => setRejectApplicationId(null)}>{moduleUi.actions.cancel}</Button>
        <Button color="red" loading={Boolean(rejectApplicationId && savingId === rejectApplicationId)} onClick={() => {
          if (!rejectApplicationId) return;
          void changeApplicationStatus(rejectApplicationId, "REJECTED").then(() => setRejectApplicationId(null));
        }}>{moduleUi.hr.reject}</Button>
      </Group>
    </Modal>
    <FormSection title={ui.vacancies.managementTabs.applications}>
    <ErrorBanner message={error} />
    <ApplicationPipelineToolbar counts={counts} selected={statusFilter} onSelect={setStatusFilter} sortBy={sortBy} onSortChange={setSortBy} />
    {loading ? <Text>{applicationUi.loading}</Text> : visibleItems.length === 0 ? <Text className={classes.muted}>{statusFilter === "ALL" ? applicationUi.empty : applicationUi.emptyFiltered}</Text> : (
      <div className={classes.applicationList}>{visibleItems.map((application) => {
        const expanded = expandedId === application.id;
        const inactive = application.matchDetails?.requirementEligibility?.matchesBlockingRequirements === false;
        return <ApplicationCard
          key={application.id}
          application={application}
          title={studentName(application)}
          subtitle={application.studentProfile?.desiredPosition}
          statusDetails={inactive ? <Text size="xs" c="red">{moduleUi.hr.inactive}</Text> : null}
          expanded={expanded}
          inactive={inactive}
          statusLabel={moduleUi.student.status}
          createdAtLabel={moduleUi.student.createdAt}
          baseRequirementsLabel={moduleUi.hr.baseRequirements}
          matchScoreLabel={moduleUi.student.matchScore}
          onToggle={() => setExpandedId(expanded ? null : application.id)}
          actions={<>
              <Button size="xs" variant="subtle" onClick={() => void openResume(application.id)}>{moduleUi.hr.resume}</Button>
              <Button size="xs" variant="light" onClick={() => setExpandedId(expanded ? null : application.id)}>{expanded ? moduleUi.hr.hideAnalysis : moduleUi.hr.analysis}</Button>
            </>}
        >
            <ApplicationStatusTimeline
              currentStatus={application.status}
              onStatusChange={(status) => void changeApplicationStatus(application.id, status)}
              onReject={() => setRejectApplicationId(application.id)}
              saving={savingId === application.id}
              statusHistory={application.statusHistory}
              variant="hr"
            />
            <MatchAnalysisPanel details={application.matchDetails} variant="hr" />
        </ApplicationCard>;
      })}</div>
    )}
    </FormSection>
  </>;
}

/** Формує читабельне ім'я студента для таблиці відгуків. */
function studentName(application: VacancyApplication) {
  const user = application.studentProfile?.user;
  if (!user) return applicationUiFallback();
  return [user.lastName, user.firstName, user.middleName].filter(Boolean).join(" ");
}

/** Повертає нейтральний fallback для кандидата без публічного імені. */
function applicationUiFallback() {
  return messages.hrDashboard.vacancies.applications.student;
}

function VacancyPreview({
  vacancy,
  options,
}: {
  vacancy: VacancyRow | null;
  options: VacancyOptions;
}) {
  const [isRecruiterOpen, setIsRecruiterOpen] = useState(false);
  if (!vacancy)
    return (
      <FormSection title={ui.vacancies.managementTabs.preview}>
        <Text className={classes.muted}>{ui.vacancies.empty}</Text>
      </FormSection>
    );

  const recruiterView = buildRecruiterPreviewFromVacancy(vacancy);

  return (
    <div className={classes.vacancyPreview}>
      <RecruiterPreviewDrawer
        opened={isRecruiterOpen}
        data={recruiterView}
        title={ui.profile.previewTitle}
        labels={recruiterPreviewLabels()}
        onClose={() => setIsRecruiterOpen(false)}
      />
      <VacancyPublicPreview
        vacancy={{ ...vacancy, status: statusLabel(vacancy.status) }}
        labels={{
          description: stripRequiredMark(ui.createVacancy.descriptionTitle),
          requiredSkills: "Необхідні навички",
          languages: ui.createVacancy.languagesTitle,
          about: ui.vacancies.aboutVacancy,
          conditions: stripRequiredMark(ui.createVacancy.conditionsTitle),
          profession: ui.createVacancy.profession,
          salary: ui.createVacancy.salaryRange,
          closingDate: ui.createVacancy.closingDate,
          location: stripRequiredMark(ui.createVacancy.officeLocations),
          workFormat: stripRequiredMark(ui.createVacancy.workFormats),
          employmentType: stripRequiredMark(ui.createVacancy.employmentTypes),
          schedule: stripRequiredMark(ui.createVacancy.workSchedules),
        }}
        companyHref={
          vacancy.company?.id ? `/companies/${vacancy.company.id}` : undefined
        }
        locationText={joinNames(
          vacancy.locations.map((item) =>
            findLabel(options.officeLocations, item.locationId),
          ),
        )}
        recruiterSlot={
          recruiterView ? (
            <RecruiterCard
              data={recruiterView}
              onClick={() => setIsRecruiterOpen(true)}
            />
          ) : null
        }
      />
    </div>
  );
}

function CreateVacancyTab(props: {
  form: VacancyFormState;
  setForm: (form: VacancyFormState) => void;
  editingVacancy: VacancyRow | null;
  options: VacancyOptions;
  skillsByCategory: Record<string, SkillOption[]>;
  selectedSkillDraft: { skillId: string; weight: SkillWeight };
  setSelectedSkillDraft: (value: {
    skillId: string;
    weight: SkillWeight;
  }) => void;
  selectedLanguageDraft: { languageId: string; level: LanguageLevel | "" };
  setSelectedLanguageDraft: (value: {
    languageId: string;
    level: LanguageLevel | "";
  }) => void;
  mode?: "create" | "edit";
  error?: string | null;
  saving?: boolean;
  onAddSkill: () => void;
  onAddLanguage: () => void;
  onClear: () => void;
  onSave: (status: "DRAFT" | "ACTIVE") => void;
}) {
  const {
    form,
    setForm,
    editingVacancy,
    options,
    skillsByCategory,
    selectedSkillDraft,
    setSelectedSkillDraft,
    selectedLanguageDraft,
    setSelectedLanguageDraft,
    mode = "create",
    error,
    saving,
    onAddSkill,
    onAddLanguage,
    onClear,
    onSave,
  } = props;
  const isEditingActiveVacancy = editingVacancy?.status === "ACTIVE";
  return (
    <>
      <TabHeader
        title={
          editingVacancy ? ui.createVacancy.editTitle : ui.createVacancy.title
        }
        description={ui.createVacancy.description}
      />
      <FormSection
        title={ui.createVacancy.basicTitle}
        description={ui.createVacancy.basicDescription}
      >
        <div className={classes.grid}>
          <TextInput
            className={classes.fullRow}
            required
            label={ui.createVacancy.titleField}
            placeholder={ui.createVacancy.titlePlaceholder}
            maxLength={200}
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.currentTarget.value })
            }
          />
          <Select
            required
            searchable
            label={ui.createVacancy.profession}
            placeholder={ui.createVacancy.professionPlaceholder}
            data={options.professions}
            value={form.professionId || null}
            onChange={(value) =>
              setForm({ ...form, professionId: value ?? "" })
            }
          />
          <MultiSelect
            classNames={{ pill: classes.spherePill }}
            required
            searchable
            maxValues={3}
            label={ui.createVacancy.spheres}
            placeholder={ui.createVacancy.spheresPlaceholder}
            data={options.spheres}
            value={form.sphereIds}
            onChange={(sphereIds) => setForm({ ...form, sphereIds })}
          />
        </div>
      </FormSection>
      <FormSection
        title={ui.createVacancy.descriptionTitle}
        description={ui.createVacancy.descriptionBlockDescription}
      >
        <RichTextEditor
          value={form.description}
          onChange={(description) => setForm({ ...form, description })}
          maxLength={10000}
          placeholder={ui.createVacancy.descriptionPlaceholder}
        />
      </FormSection>
      <FormSection
        title={ui.createVacancy.requirementsTitle}
        description={ui.createVacancy.requirementsDescription}
      >
        <div className={classes.requirementInputRow}>
          <Select
            label={ui.createVacancy.skillWeight}
            data={skillWeights}
            value={selectedSkillDraft.weight}
            onChange={(weight) =>
              setSelectedSkillDraft({
                ...selectedSkillDraft,
                weight: (weight ?? "IMPORTANT") as SkillWeight,
              })
            }
          />
          <Select
            searchable
            clearable
            label={ui.createVacancy.skill}
            placeholder={ui.createVacancy.skillPlaceholder}
            data={options.skills}
            value={selectedSkillDraft.skillId || null}
            onChange={(skillId) =>
              setSelectedSkillDraft({
                ...selectedSkillDraft,
                skillId: skillId ?? "",
              })
            }
          />
          <Button
            variant="light"
            onClick={onAddSkill}
            disabled={!selectedSkillDraft.skillId || form.skills.length >= maxVacancySkills}
          >
            {ui.createVacancy.addSkill}
          </Button>
        </div>
        <VacancySkillGroups
          form={form}
          setForm={setForm}
          skillsByCategory={skillsByCategory}
          onSelectSkill={(skill) => setSelectedSkillDraft(skill)}
        />
        <div className={classes.requirementInputRow}>
          <Select
            clearable
            label={ui.createVacancy.languageLevel}
            placeholder={ui.createVacancy.languageLevelPlaceholder}
            data={cefrLevels}
            value={selectedLanguageDraft.level || null}
            onChange={(level) =>
              setSelectedLanguageDraft({
                ...selectedLanguageDraft,
                level: (level ?? "") as LanguageLevel | "",
              })
            }
          />
          <Select
            searchable
            clearable
            label={ui.createVacancy.language}
            placeholder={ui.createVacancy.languagePlaceholder}
            data={options.languages}
            value={selectedLanguageDraft.languageId || null}
            onChange={(languageId) =>
              setSelectedLanguageDraft({
                ...selectedLanguageDraft,
                languageId: languageId ?? "",
              })
            }
          />
          <Button
            variant="light"
            onClick={onAddLanguage}
            disabled={
              !selectedLanguageDraft.languageId ||
              !selectedLanguageDraft.level ||
              form.languages.length >= maxVacancyLanguages
            }
          >
            {ui.createVacancy.addLanguage}
          </Button>
        </div>
        <div className={classes.languageChips}>
          {form.languages.map((item) => (
            <ChipBadge
              tone="language"
              key={item.languageId}
              onClick={() => setSelectedLanguageDraft(item)}
              onRemove={() =>
                setForm({
                  ...form,
                  languages: form.languages.filter(
                    (language) => language.languageId !== item.languageId,
                  ),
                })
              }
            >
              {findLabel(options.languages, item.languageId)} -{" "}
              {languageLevelLabel(item.level)}
            </ChipBadge>
          ))}
        </div>
      </FormSection>
      <FormSection
        title={ui.createVacancy.conditionsTitle}
        description={ui.createVacancy.conditionsDescription}
      >
        <div className={classes.locationStrictRow}>
          <MultiSelect
            classNames={{ pill: classes.locationPill }}
            required
            label={ui.createVacancy.officeLocations}
            data={options.officeLocations}
            maxValues={maxVacancyLocations}
            value={form.officeLocationIds}
            onChange={(officeLocationIds) =>
              setForm({ ...form, officeLocationIds })
            }
          />
          <Checkbox
            className={`${classes.inlineCheckbox} ${classes.locationStrictCheckbox}`}
            label={ui.createVacancy.locationStrict}
            checked={form.isLocationStrict}
            onChange={(event) =>
              setForm({
                ...form,
                isLocationStrict: event.currentTarget.checked,
              })
            }
          />
        </div>
        <div className={classes.conditionsGrid}>
          <Checkbox.Group
            className={classes.checkboxGroup}
            label={ui.createVacancy.workFormats}
            value={form.workFormatIds}
            onChange={(workFormatIds) => setForm({ ...form, workFormatIds })}
          >
            {options.workFormats.map((item) => (
              <Checkbox
                key={item.value}
                value={item.value}
                label={item.label}
              />
            ))}
          </Checkbox.Group>
          <Checkbox.Group
            className={classes.checkboxGroup}
            label={ui.createVacancy.employmentTypes}
            value={form.employmentTypeIds}
            onChange={(employmentTypeIds) =>
              setForm({ ...form, employmentTypeIds })
            }
          >
            {options.employmentTypes.map((item) => (
              <Checkbox
                key={item.value}
                value={item.value}
                label={item.label}
              />
            ))}
          </Checkbox.Group>
          <Checkbox.Group
            className={classes.checkboxGroup}
            label={ui.createVacancy.workSchedules}
            value={form.workScheduleIds}
            onChange={(workScheduleIds) =>
              setForm({ ...form, workScheduleIds })
            }
          >
            {options.workSchedules.map((item) => (
              <Checkbox
                key={item.value}
                value={item.value}
                label={item.label}
              />
            ))}
          </Checkbox.Group>
        </div>
        <Text className={classes.subsectionTitle}>
          {ui.createVacancy.salaryRange}
        </Text>
        <Text className={classes.subsectionDescription}>
          {ui.createVacancy.salaryRangeDescription}
        </Text>
        <div className={classes.salaryFields}>
          <Select
            label={ui.createVacancy.salaryPeriod}
            data={salaryPeriods}
            value={form.salaryPeriod}
            onChange={(salaryPeriod) =>
              setForm({
                ...form,
                salaryPeriod: (salaryPeriod ?? "PER_MONTH") as SalaryPeriod,
              })
            }
          />
          <NumberInput
            label={ui.createVacancy.minSalary}
            min={0}
            max={maxSalaryInput}
            step={1000}
            allowNegative={false}
            allowDecimal={false}
            clampBehavior="strict"
            value={form.salaryFrom ?? ""}
            onChange={(value) =>
              setForm({
                ...form,
                salaryFrom: normalizeSalaryInput(value, form.salaryFrom),
                salaryTo: value === "" ? null : form.salaryTo,
              })
            }
          />
          <NumberInput
            label={ui.createVacancy.maxSalary}
            min={form.salaryFrom ?? 0}
            max={maxSalaryInput}
            step={1000}
            allowNegative={false}
            allowDecimal={false}
            clampBehavior="strict"
            disabled={form.salaryFrom === null}
            value={form.salaryTo ?? ""}
            onChange={(value) =>
              setForm({
                ...form,
                salaryTo: normalizeSalaryInput(value, form.salaryTo),
              })
            }
          />
        </div>
      </FormSection>
      <FormSection
        title={ui.createVacancy.publishTitle}
        description={ui.createVacancy.publishDescription}
      >
        <DateInput
          required
          label={ui.createVacancy.closingDate}
          placeholder={ui.createVacancy.closingDatePlaceholder}
          value={form.closingDate ? new Date(form.closingDate) : null}
          onChange={(value) =>
            setForm({
              ...form,
              closingDate: value ? dayjs(value).format("YYYY-MM-DD") : "",
            })
          }
          valueFormat="DD.MM.YYYY"
          locale="uk"
          minDate={dayjs().add(1, "day").toDate()}
          clearable
          popoverProps={{ position: "bottom-end", withinPortal: true }}
        />
        <InlineError message={error} />
        <div className={classes.vacancyActions}>
          <Button variant="light" onClick={onClear}>
            {mode === "edit"
              ? commonUi.actions.cancelChanges
              : commonUi.actions.clear}
          </Button>
          <Button
            variant="light"
            className={classes.outlineActionButton}
            leftSection={<SaveIcon />}
            loading={saving}
            onClick={() => onSave("DRAFT")}
          >
            {ui.createVacancy.saveDraft}
          </Button>
          <Button
            leftSection={<PublishIcon />}
            loading={saving}
            onClick={() => onSave("ACTIVE")}
          >
            {isEditingActiveVacancy
              ? ui.createVacancy.updatePublished
              : ui.createVacancy.publishNow}
          </Button>
        </div>
      </FormSection>
    </>
  );
}

function HrProfileTab({
  profile,
  form,
  setForm,
  error,
  saving,
  activeVacanciesCount,
  totalVacanciesCount,
  vacancies,
  onCompanyOpen,
  onClearError,
  onSave,
}: any) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const recruiterView = buildRecruiterPreviewFromProfile(
    profile,
    activeVacanciesCount,
    totalVacanciesCount,
    vacancies,
  );
  return (
    <>
      <RecruiterPreviewDrawer
        opened={isPreviewOpen}
        data={recruiterView}
        title={ui.profile.previewTitle}
        labels={recruiterPreviewLabels()}
        onClose={() => setIsPreviewOpen(false)}
        onCompanyOpen={() => {
          setIsPreviewOpen(false);
          onCompanyOpen();
        }}
      />

      <div className={classes.profileHeaderRow}>
        <TabHeader
          title={ui.profile.title}
          description={ui.profile.description}
        />
        <RecruiterCard
          data={recruiterView}
          onClick={() => setIsPreviewOpen(true)}
        />
      </div>
      <div className={classes.tipBlock}>
        <Text className={classes.tipTitle}>{ui.profile.tipTitle}</Text>
        <Text>{ui.profile.tipText}</Text>
      </div>
      <FormSection title={ui.profile.title}>
        <div className={classes.profileMetaLine}>
          <StatusBadge status={profile?.user.status} />
          <Text className={classes.muted}>
            {ui.profile.createdAt}:{" "}
            {profile?.user.createdAt
              ? dateShort(profile.user.createdAt)
              : ui.profile.unknownDate}
          </Text>
        </div>
        <Text className={classes.companyText}>
          {ui.profile.company}:{" "}
          <button type="button" onClick={onCompanyOpen}>
            {profile?.company.publicName}
          </button>
        </Text>
        <div className={classes.grid}>
          <TextInput
            required
            label={ui.profile.firstName}
            maxLength={100}
            value={form.firstName}
            onChange={(event) =>
              setForm({
                ...form,
                firstName: sanitizeNameInput(event.currentTarget.value),
              })
            }
          />
          <TextInput
            label={ui.profile.middleName}
            maxLength={100}
            value={form.middleName}
            onChange={(event) =>
              setForm({
                ...form,
                middleName: sanitizeNameInput(event.currentTarget.value),
              })
            }
          />
          <TextInput
            required
            label={ui.profile.lastName}
            maxLength={100}
            value={form.lastName}
            onChange={(event) =>
              setForm({
                ...form,
                lastName: sanitizeNameInput(event.currentTarget.value),
              })
            }
          />
          <TextInput
            required
            label={ui.profile.position}
            placeholder={ui.profile.positionPlaceholder}
            maxLength={150}
            value={form.position}
            onChange={(event) =>
              setForm({
                ...form,
                position: sanitizePositionInput(event.currentTarget.value),
              })
            }
          />
        </div>
      </FormSection>
      <FormSection
        title={ui.profile.linksTitle}
        description={ui.profile.linksDescription}
      >
        <InfoRow label={ui.profile.contactEmail} value={profile?.user.email} />
        <LinkEditor
          links={form.links}
          setLinks={(links) => {
            setForm({ ...form, links });
            onClearError();
          }}
          mode="hr"
        />
        <InlineError message={error} />
        <Button
          className={classes.fullButton}
          loading={saving}
          onClick={onSave}
        >
          {ui.profile.save}
        </Button>
      </FormSection>
    </>
  );
}

/** Єдина компактна візитка рекрутера для кабінету, вакансій і публічних сторінок. */

/** Єдина бічна панель перегляду публічної інформації рекрутера. */

function CompanyProfileTab(props: any) {
  const {
    company,
    companyHrs,
    form,
    setForm,
    options,
    vacancies,
    newLocation,
    setNewLocation,
    error,
    saving,
    onAddLocation,
    onPreview,
    onClearError,
    onSave,
  } = props;
  const [selectedHr, setSelectedHr] = useState<CompanyHr | null>(null);
  const selectedRecruiterView = buildRecruiterPreviewFromCompanyHr(
    selectedHr,
    company,
    vacancies,
  );

  return (
    <>
      <RecruiterPreviewDrawer
        opened={Boolean(selectedRecruiterView)}
        data={selectedRecruiterView}
        title={ui.profile.previewTitle}
        labels={recruiterPreviewLabels()}
        onClose={() => setSelectedHr(null)}
      />
      <div className={classes.headerRow}>
        <TabHeader
          title={ui.company.title}
          description={ui.company.description}
        />
        <Button
          variant="outline"
          className={classes.previewOutlineButton}
          onClick={onPreview}
        >
          {ui.company.preview}
        </Button>
      </div>
      <FormSection title={ui.company.publicTitle}>
        <div className={classes.companyHero}>
          <Avatar src={form.logoUrl} size="xl" radius="md" />
          <div>
            <Text fw={900}>{form.publicName || company?.publicName}</Text>
            <ModerationBadge status={company?.verificationStatus} />
          </div>
        </div>
        <div className={classes.grid}>
          <TextInput
            required
            label={ui.company.publicName}
            maxLength={100}
            value={form.publicName}
            onChange={(e) =>
              setForm({ ...form, publicName: e.currentTarget.value })
            }
          />
          <NumberInput
            required
            label={ui.company.foundationYear}
            min={1800}
            max={currentYear}
            step={1}
            allowDecimal={false}
            allowNegative={false}
            clampBehavior="strict"
            value={form.foundationYear}
            onChange={(value) =>
              setForm({ ...form, foundationYear: Number(value) || currentYear })
            }
          />
          <Select
            label={ui.company.employeeCount}
            data={companySizes}
            value={form.employeeCount || null}
            onChange={(value) =>
              setForm({ ...form, employeeCount: value ?? "" })
            }
          />
          <TextInput
            label={ui.company.websiteUrl}
            placeholder="https://company.ua"
            maxLength={255}
            value={form.websiteUrl}
            onChange={(e) =>
              setForm({ ...form, websiteUrl: e.currentTarget.value })
            }
          />
          <TextInput
            className={classes.fullRow}
            label={ui.company.logoUrl}
            placeholder={messages.studentDashboard.resourcePlaceholder}
            maxLength={255}
            value={form.logoUrl}
            onChange={(e) =>
              setForm({ ...form, logoUrl: e.currentTarget.value })
            }
          />
        </div>
      </FormSection>
      <FormSection
        title={ui.company.aboutTitle}
        description={ui.company.aboutDescription}
      >
        <RichTextEditor
          value={form.about}
          onChange={(about) => setForm({ ...form, about })}
          maxLength={10000}
        />
        <div className={classes.editorActions}>
          <Button
            variant="light"
            onClick={() => {
              setForm({ ...form, about: "" });
              onClearError();
            }}
          >
            {commonUi.actions.clear}
          </Button>
          <Button loading={saving} onClick={onSave}>
            {commonUi.actions.save}
          </Button>
        </div>
      </FormSection>
      <FormSection title={ui.company.legalTitle}>
        <div className={classes.grid}>
          <Select
            required
            label={ui.company.registrationType}
            data={registrationTypes}
            value={form.registrationType}
            onChange={(value) =>
              setForm({
                ...form,
                registrationType: value ?? "COMPANY",
                registrationNumber: "",
              })
            }
          />
          <TextInput
            required
            label={ui.company.registrationNumber}
            maxLength={form.registrationType === "FOP" ? 10 : 8}
            value={form.registrationNumber}
            onChange={(e) =>
              setForm({
                ...form,
                registrationNumber: sanitizeRegistrationNumber(
                  e.currentTarget.value,
                  form.registrationType,
                ),
              })
            }
          />
          <TextInput
            required
            className={classes.fullRow}
            label={ui.company.legalName}
            maxLength={200}
            value={form.legalName}
            onChange={(e) =>
              setForm({ ...form, legalName: e.currentTarget.value })
            }
          />
          <TextInput
            label={ui.company.corporateDomain}
            placeholder="company.ua"
            maxLength={100}
            value={form.corporateDomain}
            onChange={(e) =>
              setForm({
                ...form,
                corporateDomain: sanitizeDomainInput(e.currentTarget.value),
              })
            }
          />
        </div>
      </FormSection>
      <FormSection title={ui.company.contactsTitle}>
        <div className={classes.grid}>
          <TextInput
            required
            label={ui.company.publicEmail}
            value={form.publicEmail}
            onChange={(e) =>
              setForm({
                ...form,
                publicEmail: sanitizeEmailInput(e.currentTarget.value),
              })
            }
          />
          <TextInput
            label={ui.company.publicPhone}
            value={form.publicPhone}
            onChange={(e) =>
              setForm({
                ...form,
                publicPhone: formatUkrainianPhone(e.currentTarget.value),
              })
            }
          />
        </div>
        <LinkEditor
          links={form.links}
          setLinks={(links) => {
            setForm({ ...form, links });
            onClearError();
          }}
          mode="company"
        />
      </FormSection>
      <FormSection title={ui.company.spheresTitle}>
        <MultiSelect
          classNames={{ pill: classes.spherePill }}
          data={options.spheres}
          searchable
          maxValues={5}
          value={form.sphereIds}
          onChange={(sphereIds) => setForm({ ...form, sphereIds })}
        />
      </FormSection>
      <FormSection title={ui.company.locationsTitle}>
        <div className={classes.chips}>
          {form.locations.map((location: LocationFormItem) => (
            <button
              key={location.label}
              className={classes.locationChip}
              onClick={() =>
                setForm({
                  ...form,
                  locations: form.locations.filter(
                    (item: LocationFormItem) => item.label !== location.label,
                  ),
                })
              }
            >
              {location.label} ×
            </button>
          ))}
        </div>
        <div className={classes.threeGrid}>
          <Select
            label={ui.company.country}
            data={options.countries}
            value={newLocation.countryId ? String(newLocation.countryId) : null}
            onChange={(value) =>
              setNewLocation({
                countryId: Number(value),
                regionId: 0,
                cityId: 0,
              })
            }
          />
          <Select
            label={ui.company.region}
            data={options.regions}
            disabled={!newLocation.countryId}
            value={newLocation.regionId ? String(newLocation.regionId) : null}
            onChange={(value) =>
              setNewLocation({
                ...newLocation,
                regionId: Number(value),
                cityId: 0,
              })
            }
          />
          <Select
            label={ui.company.city}
            data={options.cities}
            disabled={!newLocation.regionId}
            value={newLocation.cityId ? String(newLocation.cityId) : null}
            onChange={(value) =>
              setNewLocation({ ...newLocation, cityId: Number(value) })
            }
          />
        </div>
        <Button
          variant="light"
          onClick={onAddLocation}
          disabled={form.locations.length >= 10}
        >
          {ui.company.addLocation}
        </Button>
      </FormSection>
      <FormSection title={ui.company.teamTitle}>
        <div className={classes.hrCards}>
          {companyHrs.map((hr: CompanyHr) => (
            <RecruiterCard
              key={hr.id}
              data={buildRecruiterCardFromCompanyHr(hr, company)}
              onClick={() => setSelectedHr(hr)}
            />
          ))}
        </div>
      </FormSection>
      <InlineError message={error} />
      <Button className={classes.fullButton} loading={saving} onClick={onSave}>
        {ui.company.save}
      </Button>
    </>
  );
}

export function HrCompanyPublicPageLegacy({
  company,
  companyHrs,
  vacancies,
  onBack,
  onVacancyOpen,
}: {
  company: CompanyProfile | null;
  companyHrs: CompanyHr[];
  vacancies: VacancyRow[];
  onBack: () => void;
  onVacancyOpen: (vacancy: VacancyRow) => void;
}) {
  const [selectedHr, setSelectedHr] = useState<CompanyHr | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VacancyStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [sortBy, setSortBy] = useState<VacancySortBy>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const selectedRecruiterView = buildRecruiterPreviewFromCompanyHr(
    selectedHr,
    company,
    vacancies,
  );
  const publicVacancies = paginateVacancies(
    sortPublicVacancies(
      filterPublicVacancies(vacancies, search, status),
      sortBy,
      sortDirection,
    ),
    page,
    pageSize,
  );

  return (
    <div className={classes.companyPreviewPage}>
      <RecruiterPreviewDrawer
        opened={Boolean(selectedRecruiterView)}
        data={selectedRecruiterView}
        title={ui.profile.previewTitle}
        labels={recruiterPreviewLabels()}
        onClose={() => setSelectedHr(null)}
      />

      <button type="button" className={classes.backButton} onClick={onBack}>
        <ArrowIcon /> {ui.company.backToCabinet}
      </button>
      <div className={classes.previewShellLabel}>
        {ui.company.publicProfile}
      </div>
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
            <MarkdownView className={classes.richPreview} value={company?.about || ui.company.emptyAbout} />
          </FormSection>
          <FormSection title={ui.company.vacanciesTitle}>
            <CompanyVacancyFilters
              search={search}
              status={status}
              sortBy={sortBy}
              sortDirection={sortDirection}
              pageSize={pageSize}
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              onStatusChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              onSortChange={(field, direction) => {
                setSortBy(field);
                setSortDirection(direction);
                setPage(1);
              }}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
            {publicVacancies.items.length ? (
              <div className={classes.publicVacancyList}>
                {publicVacancies.items.map((vacancy) => (
                  <button
                    type="button"
                    key={vacancy.id}
                    onClick={() => onVacancyOpen(vacancy)}
                  >
                    <span>
                      {vacancy.title}
                      <small>{vacancy.profession?.name}</small>
                    </span>
                    <VacancyStatusBadge status={vacancy.status} />
                  </button>
                ))}
              </div>
            ) : (
              <Text className={classes.muted}>
                {ui.vacancies.emptyFiltered}
              </Text>
            )}
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={publicVacancies.totalItems}
              totalPages={publicVacancies.totalPages}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
            />
          </FormSection>
        </section>
        <aside className={classes.companyPreviewAside}>
          <div className={classes.publicChipBlock}>
            <Text fw={900}>{ui.company.spheresTitle}</Text>
            <div className={classes.chips}>
              {company?.spheres?.map((item) => (
                <span className={classes.sphereChip} key={item.sphereId}>
                  {item.sphere?.name ?? item.sphereId}
                </span>
              ))}
            </div>
          </div>
          <div className={classes.publicChipBlock}>
            <Text fw={900}>{ui.company.contactsTitle}</Text>
            <Text className={classes.publicContactsNote}>
              {ui.company.contactsDescription}
            </Text>
            <ContactCopyRow value={company?.publicEmail} />
            <ContactCopyRow
              value={company?.publicPhone}
              normalizeCopy={normalizePhone}
            />
            <CompanyPublicLinks links={getCompanyPublicLinks(company)} />
          </div>
          <InfoRow
            label={ui.company.foundationYear}
            value={
              company?.foundationYear ? String(company.foundationYear) : null
            }
          />
          <InfoRow
            label={ui.company.employeeCount}
            value={
              company?.employeeCount
                ? companySizeLabel(company.employeeCount)
                : null
            }
          />
          <div className={classes.publicChipBlock}>
            <Text fw={900}>{ui.company.teamTitle}</Text>
            <div className={classes.hrCards}>
              {companyHrs.map((hr) => (
                <RecruiterCard
                  key={hr.id}
                  data={buildRecruiterCardFromCompanyHr(hr, company, vacancies)}
                  onClick={() => setSelectedHr(hr)}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CompanyVacancyFilters(props: {
  search: string;
  status: VacancyStatus | "ALL";
  sortBy: VacancySortBy;
  sortDirection: SortDirection;
  pageSize: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: VacancyStatus | "ALL") => void;
  onSortChange: (field: VacancySortBy, direction: SortDirection) => void;
  onPageSizeChange: (value: number) => void;
}) {
  const {
    search,
    status,
    sortBy,
    sortDirection,
    pageSize,
    onSearchChange,
    onStatusChange,
    onSortChange,
    onPageSizeChange,
  } = props;
  const publicStatuses = vacancyStatuses.filter((item) =>
    ["ACTIVE", "PAUSED", "CLOSED"].includes(item.value),
  );
  const sortFields: Array<{ value: VacancySortBy; label: string }> = [
    { value: "title", label: ui.vacancies.position },
    { value: "status", label: ui.vacancies.status },
    { value: "closingDate", label: ui.vacancies.deadline },
    { value: "updatedAt", label: ui.vacancies.updatedAt },
  ];

  return (
    <div className={classes.companyVacancyFilters}>
      <TextInput
        value={search}
        onChange={(event) => onSearchChange(event.currentTarget.value)}
        placeholder={ui.vacancies.searchPlaceholder}
      />
      <Select
        data={[
          { value: "ALL", label: ui.vacancies.allStatuses },
          ...publicStatuses,
        ]}
        value={status}
        onChange={(value) =>
          onStatusChange((value ?? "ALL") as VacancyStatus | "ALL")
        }
      />
      <Select
        data={[
          { value: "5", label: "5" },
          { value: "10", label: "10" },
          { value: "20", label: "20" },
        ]}
        value={String(pageSize)}
        onChange={(value) => onPageSizeChange(Number(value ?? 5))}
      />
      <Menu shadow="md" width={230} position="bottom-end">
        <Menu.Target>
          <button type="button" className={classes.sortIconButton}>
            <SortIcon />
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          {sortFields.map((field) => (
            <Menu.Item
              key={field.value}
              onClick={() => onSortChange(field.value, sortDirection)}
            >
              {sortBy === field.value ? "✓ " : ""}
              {field.label}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item onClick={() => onSortChange(sortBy, "asc")}>
            {sortDirection === "asc" ? "✓ " : ""}
            {ui.vacancies.sortAsc}
          </Menu.Item>
          <Menu.Item onClick={() => onSortChange(sortBy, "desc")}>
            {sortDirection === "desc" ? "✓ " : ""}
            {ui.vacancies.sortDesc}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}

/** Формує публічний список посилань компанії разом із веб-сайтом із візитки. */
function getCompanyPublicLinks(company: CompanyProfile | null): LinkItem[] {
  const website = company?.websiteUrl
    ? [
        {
          linkType: "WEBSITE" as LinkType,
          linkName: ui.company.websiteUrl,
          value: company.websiteUrl,
        },
      ]
    : [];
  return [...website, ...(company?.links ?? [])].filter((link) => link.value);
}

/** Показує публічні посилання компанії з діями копіювання та відкриття. */
function CompanyPublicLinks({ links }: { links: LinkItem[] }) {
  if (!links.length) return null;

  return (
    <div className={classes.publicLinks}>
      {links.map((link, index) => {
        const href = normalizeHref(link.value);
        return (
          <div
            className={classes.publicLinkRow}
            key={`${link.linkName}-${index}`}
          >
            <AppTooltip label={link.value}>
              {href ? (
                <a href={href} target="_blank" rel="noreferrer">
                  {link.linkName}
                </a>
              ) : (
                <span>
                  {link.linkName}: {link.value}
                </span>
              )}
            </AppTooltip>
            <span className={classes.publicLinkActions}>
              {href && (
                <AppTooltip
                  label={messages.studentDashboard.resumePreview.open}
                >
                  <button
                    type="button"
                    onClick={() =>
                      window.open(href, "_blank", "noopener,noreferrer")
                    }
                  >
                    <OpenIcon />
                  </button>
                </AppTooltip>
              )}
              <AppTooltip label={messages.studentDashboard.resumePreview.copy}>
                <button
                  type="button"
                  onClick={() => copyToClipboard(link.value)}
                >
                  <CopyIcon />
                </button>
              </AppTooltip>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Групує обрані навички вакансії за категоріями та показує вагу як колір плашки. */
function VacancySkillGroups({
  form,
  setForm,
  skillsByCategory,
  onSelectSkill,
}: {
  form: VacancyFormState;
  setForm: (form: VacancyFormState) => void;
  skillsByCategory: Record<string, SkillOption[]>;
  onSelectSkill: (skill: { skillId: string; weight: SkillWeight }) => void;
}) {
  const categories = Object.entries(skillsByCategory)
    .map(([category, skills]) => ({
      category,
      skills: form.skills
        .map((item) => ({
          ...item,
          skill: skills.find((skill) => String(skill.id) === item.skillId),
        }))
        .filter((item) => Boolean(item.skill))
        .sort(
          (first, second) =>
            skillWeightRank[second.weight] - skillWeightRank[first.weight],
        ),
    }))
    .filter((group) => group.skills.length > 0);

  if (categories.length === 0)
    return (
      <Text className={classes.muted}>{ui.createVacancy.emptySkills}</Text>
    );

  return (
    <div className={classes.skillGroups}>
      {categories.map((group) => (
        <div key={group.category}>
          <Text fw={900}>{skillCategoryLabel(group.category)}</Text>
          <div className={classes.skillChips}>
            {group.skills.map((item) => (
              <ChipBadge
                tone={skillWeightTone(item.weight)}
                key={item.skillId}
                onClick={() =>
                  onSelectSkill({ skillId: item.skillId, weight: item.weight })
                }
                onRemove={() =>
                  setForm({
                    ...form,
                    skills: form.skills.filter(
                      (skill) => skill.skillId !== item.skillId,
                    ),
                  })
                }
              >
                {item.skill?.name}
              </ChipBadge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LinkEditor({
  links,
  setLinks,
  mode,
}: {
  links: LinkItem[];
  setLinks: (links: LinkItem[]) => void;
  mode: "hr" | "company";
}) {
  const resources = mode === "hr" ? hrLinkResources : companyLinkResources;
  const allowedTypes =
    mode === "hr"
      ? ["MESSENGER", "SOCIAL"]
      : ["WEBSITE", "MESSENGER", "SOCIAL", "OTHER"];
  const categories = [
    {
      value: "WEBSITE",
      label: messages.studentDashboard.linksEditor.categories.website,
    },
    {
      value: "MESSENGER",
      label: messages.studentDashboard.linksEditor.categories.messenger,
    },
    {
      value: "SOCIAL",
      label: messages.studentDashboard.linksEditor.categories.social,
    },
    {
      value: "OTHER",
      label: messages.studentDashboard.linksEditor.categories.other,
    },
  ].filter((category) => allowedTypes.includes(category.value));
  const maxLinks = 6;

  return (
    <Stack gap="sm">
      {links.map((link, index) => {
        const selectedResource = getLinkResource(link.linkName, resources);
        const availableCategories = selectedResource
          ? categories.filter((item) =>
              selectedResource.types.includes(item.value as LinkType),
            )
          : categories;
        return (
          <div className={classes.linkGrid} key={index}>
            <Select
              required
              label={ui.links.category}
              data={availableCategories}
              value={link.linkType}
              onChange={(value) =>
                setLinks(
                  links.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          linkType: (value ?? allowedTypes[0]) as LinkType,
                        }
                      : item,
                  ),
                )
              }
            />
            <Autocomplete
              required
              label={ui.links.name}
              data={resources.map((item) => item.name)}
              limit={resources.length}
              maxLength={100}
              value={link.linkName}
              onChange={(value) => {
                const found = getLinkResource(value, resources);
                setLinks(
                  links.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          linkName: value,
                          linkType:
                            found && !found.types.includes(item.linkType)
                              ? found.types[0]
                              : item.linkType,
                        }
                      : item,
                  ),
                );
              }}
            />
            <TextInput
              required
              label={ui.links.value}
              maxLength={255}
              value={link.value}
              onChange={(e) =>
                setLinks(
                  links.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          value: formatContactValue(
                            item.linkName,
                            e.currentTarget.value,
                          ),
                        }
                      : item,
                  ),
                )
              }
            />
            <AppTooltip label={commonUi.actions.delete}>
              <button
                type="button"
                className={classes.iconButton}
                onClick={() => setLinks(links.filter((_, i) => i !== index))}
              >
                <TrashIcon />
              </button>
            </AppTooltip>
          </div>
        );
      })}
      <Button
        variant="light"
        onClick={() =>
          setLinks([
            ...links,
            { linkType: allowedTypes[0] as LinkType, linkName: "", value: "" },
          ])
        }
        disabled={links.length >= maxLinks}
      >
        {ui.links.add}
      </Button>
    </Stack>
  );
}

function TabHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={classes.tabHeader}>
      <Title order={1} className={classes.tabTitle}>
        {title}
      </Title>
      <Text className={classes.tabDescription}>{description}</Text>
    </div>
  );
}

function InlineError({ message }: { message?: string | null }) {
  return message ? <div className={classes.inlineError}>{message}</div> : null;
}

function InfoRow({
  label,
  value,
  actionLabel,
  onClick,
}: {
  label?: string;
  value?: string | null;
  actionLabel?: string;
  onClick?: () => void;
}) {
  return (
    <div className={classes.infoRow}>
      {label && <span>{label}</span>}
      {onClick ? (
        <button type="button" onClick={onClick}>
          {value || actionLabel}
        </button>
      ) : (
        <strong>{value || "—"}</strong>
      )}
    </div>
  );
}

function ContactCopyRow({
  label,
  value,
  normalizeCopy,
}: {
  label?: string;
  value?: string | null;
  normalizeCopy?: (value: string) => string;
}) {
  if (!value) return null;
  const copyValue = normalizeCopy ? normalizeCopy(value) : value;
  return (
    <div className={classes.contactCopyRow}>
      {label && <span>{label}</span>}
      <strong>{value}</strong>
      <AppTooltip label={messages.studentDashboard.resumePreview.copy}>
        <button type="button" onClick={() => copyToClipboard(copyValue)}>
          <CopyIcon />
        </button>
      </AppTooltip>
    </div>
  );
}

function ModerationBadge({ status }: { status?: string | null }) {
  return (
    <span className={classes.moderationBadge} data-status={status ?? "PENDING"}>
      {moderationLabel(status)}
    </span>
  );
}

const asOption = (item: CatalogItem) => ({
  value: String(item.id),
  label: item.name,
});
const clean = (value: string) => value.trim();
const nullable = (value?: string | null) => value?.trim() || null;
const dateShort = (value: string) =>
  new Date(value).toLocaleDateString("uk-UA");
const isValidUrlLike = (value: string) =>
  /^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(value.trim());
const flattenSkills = (skillsByCategory?: Record<string, SkillOption[]>) =>
  Object.values(skillsByCategory ?? {}).flat();
const findLabel = (
  options: Array<{ value: string; label: string }>,
  value: string,
) => options.find((item) => item.value === value)?.label ?? value;
const languageLevelLabel = (level: LanguageLevel | string) =>
  cefrLevels.find((item) => item.value === level)?.label ?? level;
const formatRecruiterName = (user?: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}) =>
  [user?.lastName, user?.firstName, user?.middleName].filter(Boolean).join(" ");
const formatHrName = (hr?: CompanyHr | null) => formatRecruiterName(hr?.user);
const stripRequiredMark = (value: string) => value.replace(/\s*\*+$/, "");
const countHrVacancies = (
  vacancies: VacancyRow[],
  hrProfileId?: string | null,
  status?: VacancyStatus,
) =>
  vacancies.filter(
    (vacancy) =>
      vacancy.hrProfile?.id === hrProfileId &&
      (!status || vacancy.status === status),
  ).length;

/** Формує стандартні дані публічного прев'ю рекрутера з профілю поточного HR. */
function buildRecruiterPreviewFromProfile(
  profile: HrProfile | null,
  activeVacanciesCount?: number,
  totalVacanciesCount?: number,
  vacancies: VacancyRow[] = [],
): RecruiterPublicPreviewData {
  return {
    fullName: formatRecruiterName(profile?.user),
    position: profile?.position,
    photoUrl: profile?.user.photoUrl,
    companyName: profile?.company.publicName,
    companyHref: profile?.company.id ? `/companies/${profile.company.id}` : undefined,
    email: profile?.user.email,
    contacts: profile?.links ?? [],
    createdAt: profile?.user.createdAt,
    activeVacanciesCount,
    totalVacanciesCount,
    vacancies: mapRecruiterPreviewVacancies(vacancies),
  };
}

/** Формує стандартні дані публічного прев'ю рекрутера з картки рекрутера компанії. */
function buildRecruiterPreviewFromCompanyHr(
  hr: CompanyHr | null,
  company: CompanyProfile | null,
  vacancies: VacancyRow[] = [],
): RecruiterPublicPreviewData | null {
  if (!hr) return null;
  return {
    fullName: formatHrName(hr),
    position: hr.position,
    photoUrl: hr.user.photoUrl,
    companyName: company?.publicName,
    companyHref: company?.id ? `/companies/${company.id}` : undefined,
    email: hr.user.email,
    contacts: hr.links ?? [],
    createdAt: hr.user.createdAt,
    activeVacanciesCount: countHrVacancies(vacancies, hr.id, "ACTIVE"),
    totalVacanciesCount: countHrVacancies(vacancies, hr.id),
    vacancies: mapRecruiterPreviewVacancies(vacancies.filter((vacancy) => vacancy.hrProfile?.id === hr.id)),
  };
}

/** Формує дані картки рекрутера з того самого DTO, який відкривається у спільному preview drawer. */
function buildRecruiterCardFromCompanyHr(
  hr: CompanyHr,
  company: CompanyProfile | null,
  vacancies: VacancyRow[] = [],
) {
  return (
    buildRecruiterPreviewFromCompanyHr(hr, company, vacancies) ?? {
      fullName: formatHrName(hr),
      position: hr.position,
      photoUrl: hr.user.photoUrl,
    }
  );
}

/** Формує стандартні дані публічного прев'ю рекрутера з вакансії. */
function buildRecruiterPreviewFromVacancy(
  vacancy: VacancyRow,
): RecruiterPublicPreviewData | null {
  if (!vacancy.hrProfile) return null;
  return {
    fullName: formatRecruiterName(vacancy.hrProfile.user),
    position: vacancy.hrProfile.position,
    photoUrl: vacancy.hrProfile.user.photoUrl,
    companyName: vacancy.company?.publicName,
    companyHref: vacancy.company?.id ? `/companies/${vacancy.company.id}` : undefined,
    email: vacancy.hrProfile.user.email,
    contacts: vacancy.hrProfile.links ?? [],
    createdAt: vacancy.hrProfile.user.createdAt,
    activeVacanciesCount: (vacancy.hrProfile.vacancies ?? []).filter((item) => item.status === "ACTIVE").length,
    totalVacanciesCount: vacancy.hrProfile.vacancies?.length ?? 0,
    vacancies: mapRecruiterPreviewVacancies(vacancy.hrProfile.vacancies ?? []),
  };
}

function mapRecruiterPreviewVacancies(vacancies: Array<{
  id: string;
  title: string;
  updatedAt?: string | null;
  profession?: { name?: string | null } | null;
}>) {
  return vacancies.map((vacancy) => ({
    id: vacancy.id,
    title: vacancy.title,
    updatedAt: vacancy.updatedAt,
    profession: vacancy.profession,
    href: `/vacancies/${vacancy.id}`,
  }));
}

const normalizeHref = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || !isValidUrlLike(trimmed)) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};
const copyToClipboard = (value: string) => {
  void navigator.clipboard?.writeText(value);
};
const normalizePhone = (value: string) => value.replace(/\s/g, "");
const joinNames = (values: Array<string | undefined | null>) =>
  values.filter(Boolean).join(", ") || null;
const skillWeightTone = (weight: SkillWeight) =>
  ({ CRITICAL: "critical", IMPORTANT: "important", NICE_TO_HAVE: "plus" })[
    weight
  ] as "critical" | "important" | "plus";
const publicVacancyStatusRank: Record<VacancyStatus, number> = {
  ACTIVE: 1,
  PAUSED: 2,
  CLOSED: 3,
  DRAFT: 4,
  ARCHIVED: 5,
};
const normalizeSalaryInput = (
  value: string | number,
  previous: number | null,
) => {
  if (value === "") return null;
  if (typeof value !== "number" || value > maxSalaryInput) return previous;
  return value;
};
function filterPublicVacancies(
  vacancies: VacancyRow[],
  search: string,
  status: VacancyStatus | "ALL",
) {
  return vacancies
    .filter((vacancy) =>
      ["ACTIVE", "PAUSED", "CLOSED"].includes(vacancy.status),
    )
    .filter((vacancy) => status === "ALL" || vacancy.status === status)
    .filter(
      (vacancy) =>
        !search.trim() ||
        vacancy.title.toLowerCase().includes(search.trim().toLowerCase()),
    );
}
function sortPublicVacancies(
  vacancies: VacancyRow[],
  sortBy: VacancySortBy,
  direction: SortDirection,
) {
  const modifier = direction === "asc" ? 1 : -1;
  return [...vacancies].sort((first, second) => {
    if (sortBy === "status")
      return (
        (publicVacancyStatusRank[first.status] -
          publicVacancyStatusRank[second.status]) *
        modifier
      );
    const firstValue = sortBy === "title" ? first.title : first[sortBy];
    const secondValue = sortBy === "title" ? second.title : second[sortBy];
    return (
      String(firstValue).localeCompare(String(secondValue), "uk") * modifier
    );
  });
}
function paginateVacancies(
  vacancies: VacancyRow[],
  page: number,
  pageSize: number,
) {
  const totalItems = vacancies.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  return {
    items: vacancies.slice((safePage - 1) * pageSize, safePage * pageSize),
    totalItems,
    totalPages,
  };
}
function vacancyToForm(vacancy: VacancyRow): VacancyFormState {
  return {
    title: vacancy.title,
    professionId: String(vacancy.professionId),
    sphereIds: vacancy.spheres.map((item) => String(item.sphereId)),
    description: vacancy.description,
    skills: vacancy.skills.map((item) => ({
      skillId: String(item.skillId),
      weight: item.weight,
    })),
    languages: vacancy.languages.map((item) => ({
      languageId: String(item.languageId),
      level: item.level,
    })),
    officeLocationIds: vacancy.locations.map((item) => item.locationId),
    isLocationStrict: vacancy.isLocationCritical,
    workFormatIds: vacancy.workFormats.map((item) => String(item.workFormatId)),
    employmentTypeIds: vacancy.employmentTypes.map((item) =>
      String(item.employmentTypeId),
    ),
    workScheduleIds: vacancy.workSchedules.map((item) =>
      String(item.workScheduleId),
    ),
    salaryFrom: vacancy.minSalary ?? null,
    salaryTo: vacancy.maxSalary ?? null,
    salaryPeriod: vacancy.salaryPeriod ?? "PER_MONTH",
    closingDate: dayjs(vacancy.closingDate).format("YYYY-MM-DD"),
  };
}
function vacancyFormToPayload(
  form: VacancyFormState & { status: "DRAFT" | "ACTIVE" },
) {
  return {
    title: form.title.trim(),
    professionId: Number(form.professionId),
    sphereIds: form.sphereIds.map(Number),
    description: form.description,
    skills: form.skills.map((skill) => ({
      skillId: Number(skill.skillId),
      weight: skill.weight,
    })),
    languages: form.languages.map((language) => ({
      languageId: Number(language.languageId),
      level: language.level,
    })),
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
function validateVacancyForm(
  form: VacancyFormState,
  companyLocationCount: number,
) {
  if (!form.title.trim() || !form.professionId || !form.description.trim())
    throw new Error(ui.createVacancy.errors.required);
  if (form.sphereIds.length < 1 || form.sphereIds.length > 3)
    throw new Error(ui.createVacancy.errors.spheres);
  if (form.skills.length < 1) throw new Error(ui.createVacancy.errors.skills);
  if (form.skills.length > maxVacancySkills)
    throw new Error(ui.createVacancy.errors.skills);
  if (form.languages.length > maxVacancyLanguages)
    throw new Error(ui.createVacancy.errors.conditions);
  if (companyLocationCount === 0)
    throw new Error(ui.createVacancy.errors.companyLocations);
  if (form.officeLocationIds.length < 1)
    throw new Error(ui.createVacancy.errors.locations);
  if (form.officeLocationIds.length > maxVacancyLocations)
    throw new Error(ui.createVacancy.errors.locations);
  if (
    form.workFormatIds.length < 1 ||
    form.employmentTypeIds.length < 1 ||
    form.workScheduleIds.length < 1
  )
    throw new Error(ui.createVacancy.errors.conditions);
  if (
    !form.closingDate ||
    dayjs(form.closingDate).isBefore(dayjs().add(1, "day"), "day")
  )
    throw new Error(ui.createVacancy.errors.closingDate);
  if (form.salaryTo !== null && form.salaryFrom === null)
    throw new Error(ui.createVacancy.errors.salaryToWithoutFrom);
  if (
    (form.salaryFrom !== null && form.salaryFrom > maxSalaryInput) ||
    (form.salaryTo !== null && form.salaryTo > maxSalaryInput)
  )
    throw new Error(ui.createVacancy.errors.salaryRange);
  if (
    form.salaryFrom !== null &&
    form.salaryTo !== null &&
    form.salaryTo < form.salaryFrom
  )
    throw new Error(ui.createVacancy.errors.salaryRange);
}
function skillCategoryLabel(category: string) {
  return (
    { HARD_SKILL: "Hard Skills", SOFT_SKILL: "Soft Skills", TOOL: "Tools" }[
      category
    ] ?? category
  );
}
function validateLinks(links: LinkItem[], mode: "hr" | "company") {
  const resources = mode === "hr" ? hrLinkResources : companyLinkResources;
  const allowedTypes =
    mode === "hr"
      ? ["MESSENGER", "SOCIAL"]
      : ["WEBSITE", "MESSENGER", "SOCIAL", "OTHER"];
  links.forEach((link) => {
    if (!link.linkType || !link.linkName.trim() || !link.value.trim())
      throw new Error(ui.errors.required);
    if (!allowedTypes.includes(link.linkType))
      throw new Error(ui.errors.linkCategory);
    const resource = getLinkResource(link.linkName, resources);
    if (resource && !resource.types.includes(link.linkType))
      throw new Error(ui.errors.linkCategory);
    if (resource && !isValidResourceValue(resource.name, link.value))
      throw new Error(ui.errors.linkFormat);
    if (resource?.domains?.length) {
      const url = getLinkUrl(link.value);
      if (
        !url ||
        !resource.domains.some(
          (domain) =>
            url.hostname === domain || url.hostname.endsWith(`.${domain}`),
        )
      )
        throw new Error(ui.errors.linkDomain);
    }
    if (!isValidUrlLike(link.value) && link.linkType !== "MESSENGER")
      throw new Error(ui.errors.url);
  });
}
const normalizeLinks = (links: LinkItem[]) =>
  links
    .filter((link) => link.linkName.trim() && link.value.trim())
    .map((link) => ({
      linkType: link.linkType,
      linkName: clean(link.linkName),
      value: clean(link.value),
    }));
const getLinkResource = (name: string, resources: LinkResource[]) =>
  resources.find(
    (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
  );
const getLinkUrl = (value: string) => {
  try {
    const trimmed = value.trim();
    return new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
  } catch {
    return null;
  }
};
function formatLocationByIds(
  location: { countryId: number; regionId: number; cityId: number },
  catalogs: Catalogs | null,
) {
  return [
    catalogs?.countries.find((item) => item.id === location.countryId)?.name,
    catalogs?.regions.find((item) => item.id === location.regionId)?.name,
    catalogs?.cities.find((item) => item.id === location.cityId)?.name,
  ]
    .filter(Boolean)
    .join(", ");
}
function getErrorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : commonUi.messages.unknownError;
}
function statusLabel(status: VacancyStatus) {
  return {
    DRAFT: "Чернетка",
    ACTIVE: "Активна",
    PAUSED: "Призупинена",
    CLOSED: "Закрита",
    ARCHIVED: "Архів",
  }[status];
}
function moderationLabel(status?: string | null) {
  return (
    {
      PENDING: "На перевірці",
      APPROVED: "Підтверджено",
      REJECTED: "Відхилено",
    }[status ?? "PENDING"] ??
    status ??
    "На перевірці"
  );
}
function companySizeLabel(value: string) {
  return companySizes.find((item) => item.value === value)?.label ?? value;
}
function isValidResourceValue(name: string, value: string) {
  const cleanValue = value.trim();
  const lowerName = name.toLowerCase();
  if (lowerName === "telegram")
    return /^(@[a-zA-Z0-9_]{5,32}|https?:\/\/(t\.me|telegram\.me)\/[a-zA-Z0-9_]{5,32})$/.test(
      cleanValue,
    );
  if (
    lowerName === "viber" ||
    lowerName === "whatsapp" ||
    lowerName === "signal"
  )
    return /^(\+380\s\d{2}\s\d{3}\s\d{2}\s\d{2}|https?:\/\/[^\s]+)$/i.test(
      cleanValue,
    );
  return true;
}
function formatContactValue(name: string, value: string) {
  const lowerName = name.toLowerCase();
  if (
    (lowerName === "viber" ||
      lowerName === "whatsapp" ||
      lowerName === "signal") &&
    (value.startsWith("+") || /^\d/.test(value))
  ) {
    return formatUkrainianPhone(value);
  }
  return value;
}

/** Повертає локалізовані підписи для спільного прев'ю рекрутера. */
function recruiterPreviewLabels() {
  return {
    company: ui.profile.company,
    position: ui.profile.position,
    email: ui.profile.email,
    createdAt: ui.profile.createdAt,
    activeVacancies: ui.profile.activeVacancies,
    totalVacancies: ui.profile.totalVacancies,
    vacanciesList: ui.profile.vacanciesList,
    latestVacanciesNote: ui.profile.latestVacanciesNote,
    emptyVacancies: ui.vacancies.empty,
    copy: messages.studentDashboard.resumePreview.copy,
  };
}

/** Повертає доступні дії вакансії залежно від її поточного статусу. */
function getVacancyStatusActions(status: VacancyStatus) {
  const editAction = {
    key: "edit",
    type: "edit" as const,
    label: ui.vacancies.edit,
    icon: <EditIcon />,
    danger: false,
  };
  const publishAction = {
    key: "publish",
    type: "status" as const,
    status: "ACTIVE" as VacancyStatus,
    label: ui.vacancies.publish,
    icon: <PublishIcon />,
    danger: false,
  };
  const pauseAction = {
    key: "pause",
    type: "status" as const,
    status: "PAUSED" as VacancyStatus,
    label: ui.vacancies.pause,
    icon: <PauseIcon />,
    danger: false,
  };
  const resumeAction = {
    key: "resume",
    type: "status" as const,
    status: "ACTIVE" as VacancyStatus,
    label: ui.vacancies.resume,
    icon: <PublishIcon />,
    danger: false,
  };
  const closeAction = {
    key: "close",
    type: "status" as const,
    status: "CLOSED" as VacancyStatus,
    label: ui.vacancies.close,
    icon: <CloseIcon />,
    danger: true,
  };
  const archiveAction = {
    key: "archive",
    type: "archive" as const,
    label: ui.vacancies.archive,
    icon: <ArchiveIcon />,
    danger: true,
  };

  if (status === "DRAFT") return [editAction, publishAction, archiveAction];
  if (status === "ACTIVE") return [editAction, pauseAction, closeAction];
  if (status === "PAUSED") return [editAction, resumeAction, closeAction];
  if (status === "CLOSED") return [archiveAction];
  return [];
}

/** Визначає головну швидку дію в деталях вакансії. */
function getVacancyPrimaryAction(status: VacancyStatus) {
  if (status === "DRAFT")
    return {
      key: "publish",
      type: "status" as const,
      status: "ACTIVE" as VacancyStatus,
      label: ui.vacancies.publish,
    };
  if (status === "ACTIVE")
    return {
      key: "pause",
      type: "status" as const,
      status: "PAUSED" as VacancyStatus,
      label: ui.vacancies.pause,
    };
  if (status === "PAUSED")
    return {
      key: "resume",
      type: "status" as const,
      status: "ACTIVE" as VacancyStatus,
      label: ui.vacancies.resume,
    };
  if (status === "CLOSED")
    return {
      key: "archive",
      type: "archive" as const,
      label: ui.vacancies.archive,
    };
  return null;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
    </svg>
  );
}
function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M9 6V4h6v2h5a2 2 0 0 1 2 2v4H2V8a2 2 0 0 1 2-2h5Zm2 0h2V5h-2v1ZM2 14h20v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4Z" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
  );
}
function CompanyIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M3 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16h-2v-4h-4v4H3Zm4-12h2V7H7v2Zm4 0h2V7h-2v2Zm-4 4h2v-2H7v2Zm4 0h2v-2h-2v2Zm7 8V9h1a2 2 0 0 1 2 2v10h-3Z" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="m10 6 1.4 1.4L8.8 10H20v2H8.8l2.6 2.6L10 16l-5-5 5-5Z" />
    </svg>
  );
}
function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M8 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V7Zm2 0v12h9V7h-9ZM3 17V3a2 2 0 0 1 2-2h10v2H5v14H3Z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7ZM9 4h6l1 1h4v2H4V5h4l1-1Z" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 17.25V20h2.75L17.8 8.95 15.05 6.2 4 17.25ZM19.7 7.05a1 1 0 0 0 0-1.4l-1.35-1.35a1 1 0 0 0-1.4 0l-1.05 1.05 2.75 2.75 1.05-1.05Z" />
    </svg>
  );
}
function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M20 6h-3.2l-1.1-2H8.3L7.2 6H4v14h16V6ZM9.5 6l.35-.65h4.3L14.5 6h-5ZM6 8h12v10H6V8Zm3 2h6v2H9v-2Zm0 3h6v2H9v-2Z" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4ZM5 5h10.2L19 8.8V19H5V5Zm2 1h8v5H7V6Zm1 9h8v3H8v-3Z" />
    </svg>
  );
}
function PublishIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 3 4 11h5v10h6V11h5l-8-8Zm0 2.8 3.2 3.2H13v10h-2V9H8.8L12 5.8Z" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 5c5 0 9 5.2 9 7s-4 7-9 7-9-5.2-9-7 4-7 9-7Zm0 2c-3.6 0-6.6 3.4-7 5 .4 1.6 3.4 5 7 5s6.6-3.4 7-5c-.4-1.6-3.4-5-7-5Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M6 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm11.2 0L19 6.4 6.4 19 5 17.6 17.6 5Z" />
    </svg>
  );
}
function SortIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 4h10v2H7V4Zm-2 7h14v2H5v-2Zm3 7h8v2H8v-2Z" />
    </svg>
  );
}
