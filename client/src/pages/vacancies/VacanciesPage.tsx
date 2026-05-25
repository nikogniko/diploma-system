import { useAuth, useUser } from "@clerk/react";
import {
  Button,
  Checkbox,
  Drawer,
  Menu,
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
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, apiRequest } from "../../api/apiClient";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { FormSection } from "../../components/common/FormSection";
import { AppLoader } from "../../components/common/AppLoader";
import { RecruiterPublicCard } from "../../components/hr/RecruiterPublicCard";
import { RecruiterPublicPreviewDrawer } from "../../components/hr/RecruiterPublicPreviewDrawer";
import type { RecruiterPublicPreviewData } from "../../components/hr/RecruiterPublicPreviewDrawer";
import { VacancyPublicPreview } from "../../components/vacancy/VacancyPublicPreview";
import { VacancySearchCard } from "../../components/vacancy/VacancySearchCard";
import { interpolate, messages } from "../../locales/localizedMessages";
import classes from "./VacanciesPage.module.scss";

type CatalogItem = { id: number; name: string };
type FilterOption = { id: number | string; name: string };
type Skill = CatalogItem & { category: string };
type VacancySearchMode = "regular" | "personalized";
type VacancySortBy = "relevance" | "updatedAt" | "salaryFrom";
type SortDirection = "asc" | "desc";
type SkillWeight = "CRITICAL" | "IMPORTANT" | "NICE_TO_HAVE";
type LanguageLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "NATIVE";
type SalaryPeriod = "PER_MONTH" | "PER_HOUR";

type VacancyCatalogs = {
  languages: CatalogItem[];
  employmentTypes: CatalogItem[];
  workSchedules: CatalogItem[];
  workFormats: CatalogItem[];
  professions: CatalogItem[];
  spheres: CatalogItem[];
  countries: CatalogItem[];
  regions: Array<CatalogItem & { countryId: number }>;
  cities: Array<CatalogItem & { regionId: number }>;
};

type StudentProfile = {
  minSalary?: number | null;
  desiredProfessions: Array<{ professionId: number }>;
  employmentTypes: Array<{ employmentTypeId: number }>;
  workSchedules: Array<{ workScheduleId: number }>;
  workFormats: Array<{ workFormatId: number }>;
  languages: Array<{ languageId: number; level: LanguageLevel }>;
  desiredLocations: Array<{ location: { countryId: number; regionId?: number | null; cityId?: number | null } }>;
};

type VacancyRecruiterUser = {
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  createdAt?: string | null;
} | null | undefined;

type StudentVacancy = {
  id: string;
  title: string;
  description: string;
  status?: "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED" | "ARCHIVED";
  profession?: CatalogItem | null;
  isLocationCritical: boolean;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: SalaryPeriod | null;
  closingDate: string;
  updatedAt: string;
  company?: { id: string; publicName: string; logoUrl?: string | null } | null;
  hrProfile?: {
    id: string;
    position?: string | null;
    links?: Array<{ linkName: string; value: string }>;
    user?: VacancyRecruiterUser;
  } | null;
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

type MatchSkill = { id: number; name: string };
type MissingLanguage = { id: number; name: string; requiredLevel: LanguageLevel; currentLevel: LanguageLevel | null };
type EligibilityResponse = {
  canApply: boolean;
  blockingReasons: string[];
  missingCriticalSkills: MatchSkill[];
  missingLanguages: MissingLanguage[];
  locationMismatch: boolean;
  profileWarnings: string[];
  matchPreview?: {
    baseRequirementsPercent: number | null;
  } | null;
};

type FilterState = {
  search: string;
  mode: VacancySearchMode;
  professionIds: string[];
  companyIds: string[];
  sphereIds: string[];
  regionIds: string[];
  cityIds: string[];
  workFormatIds: string[];
  employmentTypeIds: string[];
  workScheduleIds: string[];
  languageFilters: Array<{ languageId: string; level: LanguageLevel }>;
  minSalary: number | null;
  sortBy: VacancySortBy;
  sortDirection: SortDirection;
  pageSize: number;
};

const maxSalaryInput = 9_999_999;
const pageSizes = ["5", "10", "20"];
const defaultFilters: FilterState = {
  search: "",
  mode: "regular",
  professionIds: [],
  companyIds: [],
  sphereIds: [],
  regionIds: [],
  cityIds: [],
  workFormatIds: [],
  employmentTypeIds: [],
  workScheduleIds: [],
  languageFilters: [],
  minSalary: null,
  sortBy: "relevance",
  sortDirection: "desc",
  pageSize: 10,
};
const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2", "NATIVE"] as const;
const sortOptions: Array<{ value: VacancySortBy; label: string }> = [
  { value: "relevance", label: messages.publicVacancies.catalog.sort.relevance },
  { value: "updatedAt", label: messages.publicVacancies.catalog.sort.updatedAt },
  { value: "salaryFrom", label: messages.publicVacancies.catalog.sort.salaryFrom },
];
type VacancyFilterOptions = { companies: Array<{ id: string; publicName: string }> };
const ui = messages.publicVacancies;

/** Спільна сторінка каталогу активних вакансій з хедера сайту. */
export default function VacanciesPage() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { vacancyId } = useParams();
  const role = user?.publicMetadata?.role as string | undefined;
  const [catalogs, setCatalogs] = useState<VacancyCatalogs | null>(null);
  const [filterOptions, setFilterOptions] = useState<VacancyFilterOptions>({ companies: [] });
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilters);
  const [result, setResult] = useState<VacancySearchResponse | null>(null);
  const [selected, setSelected] = useState<VacancySearchEntry | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [applicationCreated, setApplicationCreated] = useState(false);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [filtersOpened, setFiltersOpened] = useState(false);
  const [isProfilePresetActive, setIsProfilePresetActive] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  /** Returns a Clerk token for authenticated API requests when available. */
  const tokenLoader = async () => (isSignedIn ? await getToken() : null);

  const options = useMemo(() => ({
    professions: sortByName(catalogs?.professions ?? []),
    spheres: sortByName(catalogs?.spheres ?? []),
    regions: sortByName(catalogs?.regions ?? []),
    cities: sortByName(catalogs?.cities ?? []),
    workFormats: sortByName(catalogs?.workFormats ?? []),
    employmentTypes: sortByName(catalogs?.employmentTypes ?? []),
    workSchedules: sortByName(catalogs?.workSchedules ?? []),
    languages: sortByName(catalogs?.languages ?? []),
    companies: sortByName(filterOptions.companies.map((company) => ({ id: company.id, name: company.publicName }))),
  }), [catalogs, filterOptions]);

  const effectiveRole =
    role ??
    (typeof window !== "undefined" && user?.id ? localStorage.getItem(`currentRole:${user.id}`) ?? undefined : undefined);

  /** Loads catalogs, public filter options, profile preferences and initial results. */
  const loadCatalogs = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = await tokenLoader();
      const [catalogData, extraOptions, profileData] = await Promise.all([
        apiRequest<VacancyCatalogs>("/catalogs/student-cabinet", token),
        apiRequest<VacancyFilterOptions>("/vacancies/student/filter-options", token),
        effectiveRole === "STUDENT" ? apiRequest<StudentProfile>("/students/my-cabinet", token) : Promise.resolve(null),
      ]);
      setCatalogs(catalogData);
      setFilterOptions(extraOptions);
      setProfile(profileData);
      await loadVacancies(defaultFilters, 1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  /** Builds a vacancy search endpoint URL from current page controls. */
  const buildPath = (state: FilterState, nextPage: number) => {
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(state.pageSize),
      mode: state.mode,
      sortBy: state.sortBy,
      sortDirection: state.sortDirection,
    });
    if (state.search.trim()) params.set("search", state.search.trim());
    if (state.professionIds.length) params.set("professionIds", state.professionIds.join(","));
    if (state.companyIds.length) params.set("companyIds", state.companyIds.join(","));
    if (state.sphereIds.length) params.set("sphereIds", state.sphereIds.join(","));
    if (state.regionIds.length) params.set("regionIds", state.regionIds.join(","));
    if (state.cityIds.length) params.set("cityIds", state.cityIds.join(","));
    if (state.workFormatIds.length) params.set("workFormatIds", state.workFormatIds.join(","));
    if (state.employmentTypeIds.length) params.set("employmentTypeIds", state.employmentTypeIds.join(","));
    if (state.workScheduleIds.length) params.set("workScheduleIds", state.workScheduleIds.join(","));
    if (state.languageFilters.length) {
      params.set("languageId", state.languageFilters.map((item) => item.languageId).join(","));
      params.set("minLanguageLevel", state.languageFilters.map((item) => item.level).join(","));
    }
    if (state.minSalary !== null) params.set("minSalary", String(state.minSalary));
    return `/vacancies/search?${params.toString()}`;
  };

  /** Loads one page of searchable vacancies from the backend. */
  const loadVacancies = async (state = filters, nextPage = page) => {
    setError(null);
    setSearching(true);
    try {
      const token = await tokenLoader();
      const data = await apiRequest<VacancySearchResponse>(buildPath(state, nextPage), token);
      setResult(data);
      setPage(data.page);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSearching(false);
    }
  };

  /** Loads a public vacancy record for the details view. */
  const loadVacancyDetails = async (vacancyId: string) => {
    setError(null);
    setSearching(true);
    setNotice(null);
    setEligibility(null);
    setApplicationError(null);
    setApplicationCreated(false);
    try {
      const token = await tokenLoader();
      const data = await apiRequest<VacancySearchEntry>(`/vacancies/student/${vacancyId}`, token);
      setSelected(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSearching(false);
    }
  };

  /** Opens a vacancy details route and fetches its data. */
  const openVacancy = async (nextVacancyId: string) => {
    navigate(`/vacancies/${nextVacancyId}`);
    await loadVacancyDetails(nextVacancyId);
  };

  /** Перевіряє eligibility та створює відгук одним кліком у спільному перегляді вакансії. */
  const applyToVacancy = async (targetVacancyId: string) => {
    setApplicationError(null);
    setApplicationCreated(false);
    setEligibility(null);
    if (effectiveRole !== "STUDENT") {
      setApplicationError(ui.applications.studentOnly);
      return;
    }

    setApplicationLoading(true);
    try {
      const token = await tokenLoader();
      const check = await apiRequest<EligibilityResponse>("/applications/check-eligibility", token, {
        method: "POST",
        body: JSON.stringify({ vacancyId: targetVacancyId }),
      });
      setEligibility(check);
      if (!check.canApply) return;

      await apiRequest("/applications", token, {
        method: "POST",
        body: JSON.stringify({ vacancyId: targetVacancyId }),
      });
      setApplicationCreated(true);
    } catch (applicationRequestError) {
      if (applicationRequestError instanceof ApiError
        && applicationRequestError.code === "APPLICATION_NOT_ELIGIBLE"
        && applicationRequestError.details) {
        setEligibility(applicationRequestError.details as EligibilityResponse);
        return;
      }
      setApplicationError(ui.applications.requestFailed);
    } finally {
      setApplicationLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadCatalogs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, effectiveRole]);

  useEffect(() => {
    if (!vacancyId) {
      void Promise.resolve().then(() => setSelected(null));
      return;
    }
    void Promise.resolve().then(() => loadVacancyDetails(vacancyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacancyId, isSignedIn]);

  /** Updates draft filter controls and exits profile-preset mode. */
  const updateDraft = (patch: Partial<FilterState>) => {
    setDraftFilters((current) => ({ ...current, ...(isProfilePresetActive ? { mode: "regular" as VacancySearchMode } : {}), ...patch }));
    setIsProfilePresetActive(false);
  };

  /** Applies filters and starts search results at the first page. */
  const applyFilters = (state = draftFilters) => {
    setFilters(state);
    setPage(1);
    setFiltersOpened(false);
    void loadVacancies(state, 1);
  };

  /** Resets all catalog controls and reloads the default results. */
  const clearFilters = () => {
    setFilters(defaultFilters);
    setDraftFilters(defaultFilters);
    setIsProfilePresetActive(false);
    setPage(1);
    void loadVacancies(defaultFilters, 1);
  };

  /** Fills search filters from the current student's preferences. */
  const applyProfilePreset = () => {
    if (effectiveRole !== "STUDENT" || !profile) {
      setNotice(ui.catalog.profileNotice);
      setIsProfilePresetActive(false);
      return;
    }
    const profileLocations = locationFiltersFromProfile(profile.desiredLocations);
    const next: FilterState = {
      ...draftFilters,
      mode: "personalized",
      professionIds: profile.desiredProfessions.map((item) => String(item.professionId)),
      regionIds: profileLocations.regionIds,
      cityIds: profileLocations.cityIds,
      employmentTypeIds: profile.employmentTypes.map((item) => String(item.employmentTypeId)),
      workScheduleIds: profile.workSchedules.map((item) => String(item.workScheduleId)),
      workFormatIds: profile.workFormats.map((item) => String(item.workFormatId)),
      languageFilters: profile.languages.map((item) => ({ languageId: String(item.languageId), level: item.level })),
      minSalary: profile.minSalary ?? null,
    };
    setDraftFilters(next);
    setIsProfilePresetActive(true);
    applyFilters(next);
  };

  if (loading) return <AppLoader text={ui.catalog.loading} />;

  return (
    <main className={classes.page}>
      {!selected && <>
      <div className={classes.headerRow}>
        <div>
          <Text className={classes.eyebrow}>UniJob.ua</Text>
          <Title order={1}>{ui.catalog.title}</Title>
          <Text className={classes.subtitle}>{ui.catalog.subtitle}</Text>
        </div>
        {effectiveRole === "HR" && <Button component={Link} to="/hr?tab=create-vacancy">{ui.catalog.create}</Button>}
      </div>

      <div className={classes.toolbar}>
        <TextInput className={classes.searchInput} value={draftFilters.search} onFocus={() => setIsSearchFocused(true)} onBlur={() => setIsSearchFocused(false)} onChange={(event) => updateDraft({ search: event.currentTarget.value })} onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }} placeholder={ui.catalog.searchPlaceholder} description={isSearchFocused ? ui.catalog.searchHint : undefined} />
        <Button leftSection={<SearchIcon />} onClick={() => applyFilters()} loading={searching}>{ui.catalog.search}</Button>
          <Button className={classes.filterButton} variant="light" onClick={() => setFiltersOpened(true)}><FilterIcon /><span className={classes.filterButtonText}>{ui.catalog.filters}</span></Button>
        <Button className={classes.iconOnlyButton} variant="subtle" onClick={clearFilters} aria-label={ui.catalog.clearFilters}><CloseIcon /></Button>
        <Menu position="bottom-end" withinPortal={false}>
          <Menu.Target>
            <Button className={classes.iconOnlyButton} variant="light" aria-label={sortLabel(filters)}><SortIcon /></Button>
          </Menu.Target>
          <Menu.Dropdown>
            {sortOptions.map((option) => (
              <Menu.Item leftSection={filters.sortBy === option.value ? <CheckIcon /> : <span className={classes.menuIconSpace} />} key={option.value} onClick={() => {
                const next = { ...filters, sortBy: option.value, sortDirection: option.value === "relevance" ? "desc" as SortDirection : filters.sortDirection, mode: isProfilePresetActive ? "regular" as VacancySearchMode : filters.mode };
                setFilters(next);
                setDraftFilters((current) => ({ ...current, sortBy: option.value, sortDirection: next.sortDirection }));
                setIsProfilePresetActive(false);
                void loadVacancies(next, 1);
              }}>{option.label}</Menu.Item>
            ))}
            {filters.sortBy === "relevance" ? (
              <>
                <Menu.Divider />
                <Menu.Item disabled>{ui.catalog.relevanceFirst}</Menu.Item>
              </>
            ) : (
              <>
                <Menu.Divider />
                {(["desc", "asc"] as SortDirection[]).map((direction) => (
                  <Menu.Item leftSection={filters.sortDirection === direction ? <CheckIcon /> : <span className={classes.menuIconSpace} />} key={direction} onClick={() => {
                    const next = { ...filters, mode: isProfilePresetActive ? "regular" as VacancySearchMode : filters.mode, sortDirection: direction };
                    setFilters(next);
                    setDraftFilters((current) => ({ ...current, sortDirection: next.sortDirection }));
                    setIsProfilePresetActive(false);
                    void loadVacancies(next, 1);
                  }}>{direction === "desc" ? ui.catalog.sortDesc : ui.catalog.sortAsc}</Menu.Item>
                ))}
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </div>
      </>}

      <ErrorBanner message={error} />
      {!selected && notice && <div className={classes.notice}>{notice}</div>}

      <Drawer opened={filtersOpened} onClose={() => { setDraftFilters(filters); setFiltersOpened(false); }} title={<div className={classes.drawerTitle}><Text fw={900}>{ui.catalog.filters}</Text><div className={classes.filterActions}><Button variant="light" onClick={() => { setDraftFilters(filters); setFiltersOpened(false); }}>{ui.catalog.cancel}</Button><Button onClick={() => applyFilters()}>{ui.catalog.apply}</Button></div></div>} position="left" size="min(440px, 92vw)" classNames={{ header: classes.drawerHeader, body: classes.drawerBody }}>
        <Stack gap="xl" className={classes.filterStack}>
          <Switch label={ui.catalog.profileMatch} checked={isProfilePresetActive} onChange={(event) => event.currentTarget.checked ? applyProfilePreset() : setIsProfilePresetActive(false)} />
          <SearchableFilterGroup title={ui.catalog.professions} placeholder={ui.catalog.professionPlaceholder} values={draftFilters.professionIds} options={options.professions} onChange={(professionIds) => updateDraft({ professionIds })} />
          <SearchableFilterGroup title={ui.catalog.companies} placeholder={ui.catalog.companyPlaceholder} values={draftFilters.companyIds} options={options.companies} onChange={(companyIds) => updateDraft({ companyIds })} />
          <SearchableFilterGroup title={ui.catalog.spheres} placeholder={ui.catalog.spherePlaceholder} values={draftFilters.sphereIds} options={options.spheres} onChange={(sphereIds) => updateDraft({ sphereIds })} />
          <LocationFilterGroup regions={options.regions} cities={options.cities} regionIds={draftFilters.regionIds} cityIds={draftFilters.cityIds} onRegionChange={(regionIds) => updateDraft({ regionIds })} onCityChange={(cityIds) => updateDraft({ cityIds })} />
          <CompactCheckGroup title={ui.catalog.workFormat} values={draftFilters.workFormatIds} options={options.workFormats} onChange={(workFormatIds) => updateDraft({ workFormatIds })} />
          <CompactCheckGroup title={ui.catalog.employmentType} values={draftFilters.employmentTypeIds} options={options.employmentTypes} onChange={(employmentTypeIds) => updateDraft({ employmentTypeIds })} />
          <CompactCheckGroup title={ui.catalog.schedule} values={draftFilters.workScheduleIds} options={options.workSchedules} onChange={(workScheduleIds) => updateDraft({ workScheduleIds })} />
          <LanguageFilterEditor languages={options.languages} values={draftFilters.languageFilters} onChange={(languageFilters) => updateDraft({ languageFilters })} />
          <NumberInput label={ui.catalog.minSalary} placeholder={ui.catalog.minSalaryPlaceholder} min={0} max={maxSalaryInput} step={1000} allowNegative={false} allowDecimal={false} clampBehavior="strict" value={draftFilters.minSalary ?? undefined} onChange={(value) => updateDraft({ minSalary: normalizeMoneyInput(value) })} />
        </Stack>
      </Drawer>

      {selected ? (
        <VacancyDetails
          entry={selected}
          catalogs={catalogs}
          role={effectiveRole}
          eligibility={eligibility}
          applicationError={applicationError}
          applicationCreated={applicationCreated}
          applicationLoading={applicationLoading}
          onBack={() => { setSelected(null); setNotice(null); setEligibility(null); setApplicationError(null); setApplicationCreated(false); navigate(-1); }}
          onApply={() => void applyToVacancy(selected.vacancy.id)}
        />
      ) : (
        <>
          {searching && <Stack gap="sm">{Array.from({ length: 3 }).map((_, index) => <Paper key={index} className={classes.skeleton} />)}</Stack>}
          {!searching && result?.items.length === 0 && <FormSection title={ui.catalog.emptyTitle} description={ui.catalog.emptyDescription}><Text className={classes.muted}>{ui.catalog.emptyHint}</Text></FormSection>}
          {!searching && result && result.items.length > 0 && (
            <>
              <div className={classes.list}>{result.items.map((entry) => <VacancySearchCard key={entry.vacancy.id} vacancy={entry.vacancy} skills={primaryVacancySkills(entry.vacancy)} locations={vacancyLocationLabels(entry.vacancy, catalogs)} onOpen={openVacancy} />)}</div>
              <div className={classes.pagination}>
                <Text className={classes.muted}>{interpolate(ui.catalog.found, { count: result.totalItems })}</Text>
                <Pagination value={result.page} total={result.totalPages} onChange={(nextPage) => { setPage(nextPage); void loadVacancies(filters, nextPage); }} size="sm" radius="xl" />
                <Select className={classes.pageSizeSelect} value={String(filters.pageSize)} onChange={(value) => {
                  const next = { ...filters, pageSize: Number(value ?? filters.pageSize) };
                  setFilters(next);
                  setDraftFilters((current) => ({ ...current, pageSize: next.pageSize }));
                  void loadVacancies(next, 1);
                }} data={pageSizes} />
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

/** Renders a searchable multi-select group for a catalog filter. */
function SearchableFilterGroup({ title, placeholder, values, options, onChange }: { title: string; placeholder: string; values: string[]; options: FilterOption[]; onChange: (values: string[]) => void }) {
  const [query, setQuery] = useState("");
  const visible = sortByName(options.filter((option) => option.name.toLowerCase().includes(query.trim().toLowerCase())));
  const selected = values.map((value) => options.find((option) => String(option.id) === value)).filter(Boolean) as FilterOption[];
  /** Removes one selected value from this filter group. */
  const remove = (value: string) => onChange(values.filter((item) => item !== value));
  return (
    <div className={classes.filterGroup}>
      <Text fw={900}>{title}</Text>
      {selected.length > 0 && <div className={classes.selectedChips}>{selected.map((item) => <button type="button" key={item.id} onClick={() => remove(String(item.id))}>{item.name}<CloseIcon /></button>)}</div>}
      <TextInput placeholder={placeholder} value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      <Checkbox.Group value={values} onChange={onChange}>
        <div className={classes.scrollOptions}>{visible.map((option) => <Checkbox key={option.id} value={String(option.id)} label={option.name} />)}</div>
      </Checkbox.Group>
    </div>
  );
}

/** Renders hierarchical region and city multi-select controls. */
function LocationFilterGroup({
  regions,
  cities,
  regionIds,
  cityIds,
  onRegionChange,
  onCityChange,
}: {
  regions: Array<CatalogItem & { countryId: number }>;
  cities: Array<CatalogItem & { regionId: number }>;
  regionIds: string[];
  cityIds: string[];
  onRegionChange: (values: string[]) => void;
  onCityChange: (values: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [expandedRegionIds, setExpandedRegionIds] = useState<string[]>([]);
  const normalizedQuery = query.trim().toLowerCase();
  const selectedRegions = selectedLocationItems(regions, regionIds);
  const selectedCities = selectedLocationItems(cities, cityIds);
  const citiesByRegion = useMemo(
    () => groupCitiesByRegion(cities, normalizedQuery),
    [cities, normalizedQuery],
  );
  const visibleRegions = regions.filter((region) => {
    if (!normalizedQuery) return true;
    return region.name.toLowerCase().includes(normalizedQuery) || Boolean(citiesByRegion.get(region.id)?.length);
  });

  /** Toggles an identifier in a set of selected location ids. */
  const toggleValue = (values: string[], value: string) =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  /** Toggles selection of one region. */
  const toggleRegion = (regionId: string) => onRegionChange(toggleValue(regionIds, regionId));
  /** Toggles selection of one city. */
  const toggleCity = (cityId: string) => onCityChange(toggleValue(cityIds, cityId));
  /** Expands or collapses cities under a region. */
  const toggleExpanded = (regionId: string) =>
    setExpandedRegionIds((current) => toggleValue(current, regionId));
  /** Reports whether a region's city list should be visible. */
  const isExpanded = (regionId: string, hasMatchingCities: boolean) =>
    expandedRegionIds.includes(regionId) || (Boolean(normalizedQuery) && hasMatchingCities);

  return (
    <div className={classes.filterGroup}>
      <Text fw={900}>{ui.catalog.locations}</Text>
      {(selectedRegions.length > 0 || selectedCities.length > 0) && (
        <div className={classes.selectedChips}>
          {selectedRegions.map((region) => <button type="button" key={`region-${region.id}`} onClick={() => toggleRegion(String(region.id))}>{region.name}<CloseIcon /></button>)}
          {selectedCities.map((city) => <button type="button" key={`city-${city.id}`} onClick={() => toggleCity(String(city.id))}>{city.name}<CloseIcon /></button>)}
        </div>
      )}
      <TextInput placeholder={ui.catalog.regionPlaceholder} value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      <div className={classes.locationTree}>
        {visibleRegions.map((region) => {
          const regionCities = citiesByRegion.get(region.id) ?? [];
          const expanded = isExpanded(String(region.id), regionCities.length > 0);
          return (
            <div className={classes.locationRegion} key={region.id}>
              <div className={classes.locationRegionRow}>
                <Checkbox checked={regionIds.includes(String(region.id))} onChange={() => toggleRegion(String(region.id))} label={region.name} />
                <button type="button" className={classes.locationExpandButton} data-expanded={expanded || undefined} onClick={() => toggleExpanded(String(region.id))} aria-label={ui.catalog.cities}>
                  <ChevronIcon />
                </button>
              </div>
              {expanded && (
                <div className={classes.locationCities}>
                  {regionCities.map((city) => (
                    <Checkbox key={city.id} checked={cityIds.includes(String(city.id))} onChange={() => toggleCity(String(city.id))} label={city.name} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Renders a compact checkbox group for short filter catalogs. */
function CompactCheckGroup({ title, values, options, onChange }: { title: string; values: string[]; options: CatalogItem[]; onChange: (values: string[]) => void }) {
  return (
    <Checkbox.Group label={title} value={values} onChange={onChange}>
      <div className={classes.compactOptions}>{sortByName(options).map((option) => <Checkbox key={option.id} value={String(option.id)} label={option.name} />)}</div>
    </Checkbox.Group>
  );
}

/** Lets the user select languages together with minimum required levels. */
function LanguageFilterEditor({ languages, values, onChange }: { languages: CatalogItem[]; values: Array<{ languageId: string; level: LanguageLevel }>; onChange: (values: Array<{ languageId: string; level: LanguageLevel }>) => void }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LanguageLevel>("A1");
  const visible = sortByName(languages.filter((language) => language.name.toLowerCase().includes(query.trim().toLowerCase())));
  /** Adds or updates one selected language requirement. */
  const addLanguage = (languageId: string) => {
    const next = values.filter((item) => item.languageId !== languageId);
    onChange([...next, { languageId, level }]);
  };
  return (
    <div className={classes.filterGroup}>
      <Text fw={900}>{ui.catalog.languages}</Text>
      {values.length > 0 && <div className={classes.selectedChips}>{values.map((item) => <button type="button" key={item.languageId} onClick={() => onChange(values.filter((value) => value.languageId !== item.languageId))}>{findName(languages, item.languageId)} · {languageLevelLabel(item.level)}<CloseIcon /></button>)}</div>}
      <TextInput placeholder={ui.catalog.languagePlaceholder} value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      <div className={classes.levelOptions}>{cefrLevels.map((item) => <button type="button" key={item} data-active={level === item || undefined} onClick={() => setLevel(item)}>{languageLevelLabel(item)}</button>)}</div>
      <div className={classes.scrollOptions}>{visible.map((language) => <button type="button" className={classes.optionButton} key={language.id} onClick={() => addLanguage(String(language.id))}><span>{values.some((item) => item.languageId === String(language.id)) ? "✓" : "+"}</span><span>{language.name}</span></button>)}</div>
    </div>
  );
}

/** Displays the full public preview for a selected vacancy. */
function VacancyDetails({ entry, catalogs, role, eligibility, applicationError, applicationCreated, applicationLoading, onBack, onApply }: { entry: VacancySearchEntry; catalogs: VacancyCatalogs | null; role?: string; eligibility: EligibilityResponse | null; applicationError: string | null; applicationCreated: boolean; applicationLoading: boolean; onBack: () => void; onApply: () => void }) {
  const vacancy = entry.vacancy;
  const [isRecruiterOpen, setIsRecruiterOpen] = useState(false);
  const recruiterView = buildRecruiterPreviewFromVacancy(vacancy);
  return <div className={classes.detailsPage}>
    <button type="button" className={classes.backButton} onClick={onBack}><ArrowIcon /> {ui.common.back}</button>
    <RecruiterPublicPreviewDrawer opened={isRecruiterOpen} data={recruiterView} title={ui.common.recruiterProfile} labels={recruiterPreviewLabels} onClose={() => setIsRecruiterOpen(false)} />
    <VacancyPublicPreview
      vacancy={{ ...vacancy, status: statusLabel(vacancy.status ?? "ACTIVE") }}
      companyHref={vacancy.company?.id ? `/companies/${vacancy.company.id}` : undefined}
      locationText={vacancyLocationLabels(vacancy, catalogs).join(", ")}
      recruiterSlot={recruiterView ? <div className={classes.recruiterSlot}><RecruiterPublicCard data={recruiterView} onClick={() => setIsRecruiterOpen(true)} /></div> : null}
      stickyAction={role === "HR" ? null : "student-apply"}
      actionLoading={applicationLoading}
      actionDisabled={applicationCreated}
      actionFeedback={<ApplicationFeedback eligibility={eligibility} error={applicationError} created={applicationCreated} />}
      onApply={onApply}
    />
  </div>;
}

/** Показує результат eligibility/створення без дублювання повідомлення поза action-блоком. */
function ApplicationFeedback({ eligibility, error, created }: { eligibility: EligibilityResponse | null; error: string | null; created: boolean }) {
  const applicationsUi = ui.applications;
  if (error) return <div className={classes.applicationFeedback}><Text>{error}</Text></div>;
  if (!eligibility && !created) return null;
  const reasonText = (reason: string) => applicationsUi.blockingReasons[reason as keyof typeof applicationsUi.blockingReasons] ?? reason;
  const warningText = (warning: string) => applicationsUi.profileWarnings[warning as keyof typeof applicationsUi.profileWarnings] ?? warning;

  return <div className={classes.applicationFeedback}>
    <Text fw={900}>{created ? applicationsUi.created : applicationsUi.cannotApply}</Text>
    {eligibility?.matchPreview?.baseRequirementsPercent !== null && eligibility?.matchPreview?.baseRequirementsPercent !== undefined
      && <Text>{interpolate(applicationsUi.matchPreview, { percent: eligibility.matchPreview.baseRequirementsPercent })}</Text>}
    {!created && eligibility?.blockingReasons.length ? <div>
      <Text fw={900}>{applicationsUi.blockingTitle}</Text>
      <ul>{eligibility.blockingReasons.map((reason) => <li key={reason}>{reasonText(reason)}</li>)}</ul>
    </div> : null}
    {!created && eligibility?.missingCriticalSkills.length ? <div>
      <Text fw={900}>{applicationsUi.missingSkillsTitle}</Text>
      <Text>{eligibility.missingCriticalSkills.map((skill) => skill.name).join(", ")}</Text>
    </div> : null}
    {!created && eligibility?.missingLanguages.length ? <div>
      <Text fw={900}>{applicationsUi.missingLanguagesTitle}</Text>
      <Text>{eligibility.missingLanguages.map((language) => `${language.name}: ${language.requiredLevel}`).join(", ")}</Text>
    </div> : null}
    {!created && eligibility?.locationMismatch ? <Text>{applicationsUi.locationMismatch}</Text> : null}
    {eligibility?.profileWarnings.length ? <div>
      <Text fw={900}>{applicationsUi.warningsTitle}</Text>
      <ul>{eligibility.profileWarnings.map((warning) => <li key={warning}>{warningText(warning)}</li>)}</ul>
    </div> : null}
  </div>;
}

/** Selects the highest-priority skills shown on a vacancy card. */
function primaryVacancySkills(vacancy: StudentVacancy) {
  return [...vacancy.skills]
    .sort((first, second) => skillWeightRank[second.weight] - skillWeightRank[first.weight] || skillCategoryRank(first.skill?.category) - skillCategoryRank(second.skill?.category))
    .slice(0, 10);
}

const skillWeightRank: Record<SkillWeight, number> = { CRITICAL: 3, IMPORTANT: 2, NICE_TO_HAVE: 1 };
/** Orders skills consistently when their requirement weights match. */
const skillCategoryRank = (category?: string | null) => category === "HARD_SKILL" ? 1 : category === "TOOL" ? 2 : category === "SOFT_SKILL" ? 3 : 4;
/** Formats a language proficiency enum for display. */
const languageLevelLabel = (level: string) => level === "NATIVE" ? ui.details.nativeLanguage : level;
/** Resolves a catalog identifier into its human-readable name. */
const findName = (items: CatalogItem[], id: string | number) => items.find((item) => String(item.id) === String(id))?.name ?? "";
/** Resolves selected location ids into their catalog records. */
const selectedLocationItems = <T extends CatalogItem>(items: T[], values: string[]) =>
  values.map((value) => items.find((item) => String(item.id) === value)).filter(Boolean) as T[];
/** Derives selectable region and city filters from a student profile. */
const locationFiltersFromProfile = (
  desiredLocations: StudentProfile["desiredLocations"],
) =>
  desiredLocations.reduce(
    (filters, item) => {
      const location = item.location;
      if (location.cityId) filters.cityIds.push(String(location.cityId));
      else if (location.regionId) filters.regionIds.push(String(location.regionId));
      return filters;
    },
    { regionIds: [] as string[], cityIds: [] as string[] },
  );
/** Groups visible cities by their parent region for the location tree. */
const groupCitiesByRegion = (cities: Array<CatalogItem & { regionId: number }>, query: string) => {
  const grouped = new Map<number, Array<CatalogItem & { regionId: number }>>();
  cities
    .filter((city) => !query || city.name.toLowerCase().includes(query))
    .forEach((city) => {
      grouped.set(city.regionId, [...(grouped.get(city.regionId) ?? []), city]);
    });
  return grouped;
};
/** Sorts named catalog items using Ukrainian locale order. */
const sortByName = <T extends { name: string }>(items: T[]) => [...items].sort((first, second) => first.name.localeCompare(second.name, "uk"));
/** Creates concise location labels for a vacancy card or preview. */
const vacancyLocationLabels = (vacancy: StudentVacancy, catalogs: VacancyCatalogs | null) => {
  const labels = vacancy.locations.map((item) => {
    const location = item.location;
    if (!location) return null;
    if (location.cityId) return findName(catalogs?.cities ?? [], location.cityId);
    if (location.regionId) return findName(catalogs?.regions ?? [], location.regionId);
    return findName(catalogs?.countries ?? [], location.countryId);
  }).filter(Boolean) as string[];
  return labels.length ? [...new Set(labels)].slice(0, 3) : [ui.card.locationFallback];
};
/** Normalizes salary input to an optional bounded integer. */
const normalizeMoneyInput = (value: string | number) => value === "" || typeof value !== "number" || Number.isNaN(value) ? null : Math.min(Math.max(0, Math.trunc(value)), maxSalaryInput);
/** Formats the active sorting mode for accessible control labeling. */
const sortLabel = (filters: FilterState) => filters.sortBy === "relevance"
  ? `${ui.catalog.sort.relevance} · ${ui.catalog.relevanceFirst}`
  : `${sortOptions.find((item) => item.value === filters.sortBy)?.label ?? ui.catalog.sortFallback} · ${filters.sortDirection === "asc" ? ui.catalog.sortLabelAsc : ui.catalog.sortLabelDesc}`;
/** Normalizes API and runtime errors into visible copy. */
const getErrorMessage = (error: unknown) => error instanceof ApiError || error instanceof Error ? error.message : messages.common.messages.unknownError;
const statusLabels: Record<NonNullable<StudentVacancy["status"]>, string> = {
  DRAFT: ui.statuses.DRAFT,
  ACTIVE: ui.statuses.ACTIVE,
  PAUSED: ui.statuses.PAUSED,
  CLOSED: ui.statuses.CLOSED,
  ARCHIVED: ui.statuses.ARCHIVED,
};
/** Resolves a vacancy status enum into its localized label. */
const statusLabel = (status: NonNullable<StudentVacancy["status"]>) => statusLabels[status] ?? status;
const recruiterPreviewLabels = {
  company: ui.common.company,
  position: ui.common.position,
  email: ui.common.email,
  createdAt: ui.common.createdAt,
  activeVacancies: ui.common.activeVacancies,
  totalVacancies: ui.common.totalVacancies,
  vacanciesList: ui.common.vacanciesList,
  emptyVacancies: ui.common.emptyVacancies,
  copy: ui.common.copy,
};
/** Maps vacancy recruiter data into the shared public preview DTO. */
function buildRecruiterPreviewFromVacancy(vacancy: StudentVacancy): RecruiterPublicPreviewData | null {
  if (!vacancy.hrProfile) return null;
  return {
    fullName: formatRecruiterName(vacancy.hrProfile.user),
    position: vacancy.hrProfile.position,
    photoUrl: vacancy.hrProfile.user?.photoUrl,
    companyName: vacancy.company?.publicName,
    email: vacancy.hrProfile.user?.email,
    contacts: vacancy.hrProfile.links ?? [],
    createdAt: vacancy.hrProfile.user?.createdAt,
  };
}
/** Builds a display name for the vacancy recruiter. */
function formatRecruiterName(user?: VacancyRecruiterUser) {
  const value = [user?.lastName, user?.firstName, user?.middleName].filter(Boolean).join(" ").trim();
  return value || ui.common.recruiter;
}

/** Renders the filter toolbar icon. */
function FilterIcon() { return <svg viewBox="0 0 24 24"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" /></svg>; }
/** Renders the sorting toolbar icon. */
function SortIcon() { return <svg viewBox="0 0 24 24"><path d="M7 4h2v12l3-3 1.4 1.4L8 20l-5.4-5.6L4 13l3 3V4Zm10 0 5.4 5.6L21 11l-3-3v12h-2V8l-3 3-1.4-1.4L17 4Z" /></svg>; }
/** Renders the back-navigation icon. */
function ArrowIcon() { return <svg viewBox="0 0 24 24"><path d="m10 6 1.4 1.4L8.8 10H20v2H8.8l2.6 2.6L10 16l-5-5 5-5Z" /></svg>; }
/** Renders the search action icon. */
function SearchIcon() { return <svg viewBox="0 0 24 24"><path d="m21 19.6-5.2-5.2a7 7 0 1 0-1.4 1.4l5.2 5.2L21 19.6ZM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z" /></svg>; }
/** Renders the remove or clear icon. */
function CloseIcon() { return <svg viewBox="0 0 24 24"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" /></svg>; }
/** Renders the selected-option icon. */
function CheckIcon() { return <svg viewBox="0 0 24 24"><path d="m9 16.2-3.5-3.5L4 14.2 9 19 20.5 7.5 19 6 9 16.2Z" /></svg>; }
/** Renders the location expansion icon. */
function ChevronIcon() { return <svg viewBox="0 0 24 24"><path d="m7.4 8.6 4.6 4.6 4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z" /></svg>; }
