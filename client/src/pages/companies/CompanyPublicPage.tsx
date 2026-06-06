import {
  Avatar,
  Pagination,
  Select,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useAuth } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, apiRequest } from "../../api/apiClient";
import { AppLoader } from "../../components/common/AppLoader";
import { AppTooltip } from "../../components/common/AppTooltip";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { FormSection } from "../../components/common/FormSection";
import { MarkdownView } from "../../components/common/MarkdownView";
import { RecruiterPublicCard as RecruiterCard } from "../../components/hr/RecruiterPublicCard";
import { RecruiterPublicPreviewDrawer as RecruiterPreviewDrawer } from "../../components/hr/RecruiterPublicPreviewDrawer";
import type { RecruiterPublicPreviewData } from "../../components/hr/RecruiterPublicPreviewDrawer";
import { VacancySearchCard } from "../../components/vacancy/VacancySearchCard";
import { interpolate, messages } from "../../locales/localizedMessages";
import classes from "../hr/HrDashboard.module.scss";

type CatalogItem = { id: number; name: string };
type LinkItem = { linkName: string; value: string };
type VacancyStatus = "ACTIVE" | "PAUSED" | "CLOSED" | "DRAFT" | "ARCHIVED";
type SortDirection = "asc" | "desc";
type VacancySortBy =
  | "title"
  | "status"
  | "closingDate"
  | "updatedAt"
  | "createdAt";

type CompanyProfile = {
  id: string;
  publicName: string;
  verificationStatus?: string | null;
  logoUrl?: string | null;
  about?: string | null;
  publicEmail?: string | null;
  publicPhone?: string | null;
  websiteUrl?: string | null;
  foundationYear?: number | null;
  employeeCount?: string | null;
  links?: LinkItem[];
  spheres?: Array<{ sphereId: number; sphere?: CatalogItem | null }>;
};

type CompanyHr = {
  id: string;
  contactAccess?: "VISIBLE" | "AFTER_APPLICATION";
  position?: string | null;
  links?: LinkItem[];
  user: {
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    photoUrl?: string | null;
    email?: string | null;
    createdAt?: string | null;
  };
};

type VacancyRow = {
  id: string;
  title: string;
  description?: string | null;
  status: VacancyStatus;
  profession?: CatalogItem | null;
  company?: { publicName?: string | null; logoUrl?: string | null } | null;
  createdAt?: string;
  updatedAt: string;
  closingDate: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: "PER_MONTH" | "PER_HOUR" | null;
  hrProfile?: { id: string } | null;
  skills?: Array<{ skillId: number; weight: string; skill?: { name?: string | null; category?: string | null } | null }>;
  workFormats?: Array<{ workFormat?: { name?: string | null } | null }>;
  employmentTypes?: Array<{ employmentType?: { name?: string | null } | null }>;
  workSchedules?: Array<{ workSchedule?: { name?: string | null } | null }>;
  locations?: Array<{
    locationId: string;
    location?: {
      countryId: number;
      regionId?: number | null;
      cityId?: number | null;
    } | null;
  }>;
};

type PublicCompanyResponse = {
  company: CompanyProfile;
  companyHrs: CompanyHr[];
  vacancies: VacancyRow[];
};

type VacancyCatalogs = {
  countries: CatalogItem[];
  regions: Array<CatalogItem & { countryId: number }>;
  cities: Array<CatalogItem & { regionId: number }>;
};

type CompanyPublicPageProps = {
  initialData?: PublicCompanyResponse | null;
  catalogs?: VacancyCatalogs | null;
  embedded?: boolean;
  onBack?: () => void;
  onVacancyOpen?: (vacancyId: string) => void;
};

const ui = messages.publicVacancies;

export function CompanyPublicPage({
  initialData,
  catalogs: externalCatalogs = null,
  embedded = false,
  onBack,
  onVacancyOpen,
}: CompanyPublicPageProps = {}) {
  const { companyId } = useParams();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [loadedData, setLoadedData] = useState<PublicCompanyResponse | null>(null);
  const [loadedCatalogs, setLoadedCatalogs] = useState<VacancyCatalogs | null>(null);
  const [selectedHr, setSelectedHr] = useState<CompanyHr | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<VacancyStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [sortBy, setSortBy] = useState<VacancySortBy>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(!initialData && !embedded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      return;
    }
    let isMounted = true;
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const [result, catalogData] = await Promise.all([
          apiRequest<PublicCompanyResponse>(`/companies/${companyId}`, token),
          apiRequest<VacancyCatalogs>("/catalogs/student-cabinet", token),
        ]);
        if (isMounted) {
          setLoadedData(result);
          setLoadedCatalogs(catalogData);
        }
      } catch (err) {
        if (isMounted)
          setError(
            err instanceof ApiError || err instanceof Error
              ? err.message
              : ui.companyPage.loadError,
          );
      } finally {
        if (isMounted) setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [companyId, embedded, getToken]);

  const data = initialData ?? loadedData;
  const catalogs = externalCatalogs ?? loadedCatalogs;
  const company = data?.company ?? null;
  const vacancies = useMemo(() => data?.vacancies ?? [], [data]);
  const companyHrs = useMemo(() => data?.companyHrs ?? [], [data]);
  const selectedRecruiterView = buildRecruiterPreviewFromCompanyHr(
    selectedHr,
    company,
    vacancies,
  );
  const publicVacancies = useMemo(
    () =>
      paginateVacancies(
        sortPublicVacancies(
          filterPublicVacancies(vacancies, search, status),
          sortBy,
          sortDirection,
        ),
        page,
        pageSize,
      ),
    [vacancies, search, status, sortBy, sortDirection, page, pageSize],
  );

  if (loading) return <AppLoader text={ui.companyPage.loading} />;

  return (
    <main
      className={`${classes.companyPreviewPage} ${embedded ? "" : classes.publicCompanyPage}`}
    >
      <RecruiterPreviewDrawer
        opened={Boolean(selectedRecruiterView)}
        data={selectedRecruiterView}
        title={ui.common.recruiterProfile}
        labels={recruiterPreviewLabels}
        onClose={() => setSelectedHr(null)}
      />
      <button
        type="button"
        className={classes.backButton}
        onClick={onBack ?? (() => navigate(-1))}
      >
        <ArrowIcon /> {ui.common.back}
      </button>
      <ErrorBanner message={error} />
      {company && (
        <>
          <section className={classes.companyPreviewHero}>
            <Avatar src={company.logoUrl} size={96} radius="lg" />
            <div>
              <ModerationBadge status={company.verificationStatus} />
              <Title order={1}>{company.publicName}</Title>
              <CompanyHeroMeta company={company} />
            </div>
          </section>
          <div className={classes.companyPreviewGrid}>
            <section className={classes.companyPreviewMain}>
              <FormSection title={ui.companyPage.about}>
                <MarkdownView className={classes.richPreview} value={company.about || ui.companyPage.emptyAbout} />
              </FormSection>
              <FormSection title={ui.companyPage.vacancies}>
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
                      <VacancySearchCard
                        key={vacancy.id}
                        vacancy={normalizeCompanyVacancy(vacancy, company)}
                        skills={primaryVacancySkills(vacancy)}
                        locations={vacancyLocationLabels(vacancy, catalogs)}
                        onOpen={(vacancyId) => {
                          if (onVacancyOpen) {
                            onVacancyOpen(vacancyId);
                            return;
                          }
                          navigate(`/vacancies/${vacancyId}`);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Text className={classes.muted}>
                    {ui.companyPage.emptyVacancies}
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
                <Text fw={900}>{ui.companyPage.spheres}</Text>
                <div className={classes.chips}>
                  {company.spheres?.map((item) => (
                    <span className={classes.sphereChip} key={item.sphereId}>
                      {item.sphere?.name ?? item.sphereId}
                    </span>
                  ))}
                </div>
              </div>
              <div className={classes.publicChipBlock}>
                <Text fw={900}>{ui.companyPage.contacts}</Text>
                <Text className={classes.publicContactsNote}>
                  {ui.companyPage.contactsNote}
                </Text>
                <ContactCopyRow value={company.publicEmail} />
                <ContactCopyRow
                  value={company.publicPhone}
                  normalizeCopy={normalizePhone}
                />
                <CompanyPublicLinks links={getCompanyPublicLinks(company)} />
              </div>
              <div className={classes.publicChipBlock}>
                <Text fw={900}>{ui.companyPage.team}</Text>
                <div className={classes.hrCards}>
                  {companyHrs.map((hr) => (
                    <RecruiterCard
                      key={hr.id}
                      data={buildRecruiterCardFromCompanyHr(
                        hr,
                        company,
                        vacancies,
                      )}
                      onClick={() => setSelectedHr(hr)}
                    />
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
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
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={classes.companyVacancyFilters}>
      <div className={classes.companyVacancySearchRow}>
        <TextInput
          value={props.search}
          onChange={(event) => props.onSearchChange(event.currentTarget.value)}
          placeholder={ui.companyPage.filters.searchPlaceholder}
        />
        <button
          type="button"
          className={classes.filterToggleButton}
          data-expanded={expanded || undefined}
          onClick={() => setExpanded((value) => !value)}
          aria-label={ui.catalog.filters}
        >
          <FilterChevronIcon />
        </button>
      </div>
      {expanded && (
        <div className={classes.companyVacancyFilterRow}>
          <Select
            value={props.status}
            onChange={(value) =>
              props.onStatusChange((value ?? "ALL") as VacancyStatus | "ALL")
            }
            data={[
              { value: "ALL", label: ui.companyPage.filters.allStatuses },
              { value: "ACTIVE", label: ui.companyPage.filters.active },
              { value: "PAUSED", label: ui.companyPage.filters.paused },
            ]}
          />
          <Select
            value={`${props.sortBy}:${props.sortDirection}`}
            onChange={(value) => {
              const [field, direction] = (value ?? "updatedAt:desc").split(":") as [
                VacancySortBy,
                SortDirection,
              ];
              props.onSortChange(field, direction);
            }}
            data={[
              { value: "updatedAt:desc", label: ui.companyPage.filters.updatedDesc },
              { value: "title:asc", label: ui.companyPage.filters.titleAsc },
              { value: "closingDate:asc", label: ui.companyPage.filters.closingDateAsc },
            ]}
          />
          <Select
            className={classes.pageSizeSelect}
            value={String(props.pageSize)}
            onChange={(value) => props.onPageSizeChange(Number(value ?? 5))}
            data={["5", "10", "20"]}
          />
        </div>
      )}
    </div>
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
  onPageSizeChange: (value: number) => void;
}) {
  return (
    <div className={classes.tablePagination}>
      <Text className={classes.muted}>{interpolate(ui.catalog.found, { count: totalItems })}</Text>
      <Pagination
        value={page}
        total={totalPages}
        onChange={onPageChange}
        size="sm"
        radius="xl"
      />
      <Select
        className={classes.pageSizeSelect}
        value={String(pageSize)}
        onChange={(value) => onPageSizeChange(Number(value ?? pageSize))}
        data={["5", "10", "20"]}
      />
    </div>
  );
}

function ContactCopyRow({
  value,
  normalizeCopy,
}: {
  value?: string | null;
  normalizeCopy?: (value: string) => string;
}) {
  if (!value) return null;
  const copyValue = normalizeCopy ? normalizeCopy(value) : value;
  return (
    <div className={classes.contactCopyRow}>
      <strong>{value}</strong>
      <AppTooltip label={ui.common.copy}>
        <button type="button" onClick={() => copyToClipboard(copyValue)}>
          <CopyIcon />
        </button>
      </AppTooltip>
    </div>
  );
}

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
                <AppTooltip label={ui.common.open}>
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
              <AppTooltip label={ui.common.copy}>
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

function ModerationBadge({ status }: { status?: string | null }) {
  return (
    <span className={classes.moderationBadge} data-status={status ?? "PENDING"}>
      {moderationStatusLabel(status)}
    </span>
  );
}

function CompanyHeroMeta({ company }: { company: CompanyProfile }) {
  const items = [
    company.foundationYear
      ? interpolate(ui.companyPage.foundedSince, { year: company.foundationYear })
      : null,
    company.employeeCount
      ? interpolate(ui.companyPage.employeesCount, { count: companySizeLabel(company.employeeCount) })
      : null,
  ].filter(Boolean);

  if (!items.length) return null;
  return (
    <Text className={classes.companyHeroMeta}>
      {items.map((item, index) => (
        <span key={item}>
          {index > 0 && <span className={classes.companyDot}>{ui.card.dot}</span>}
          {item}
        </span>
      ))}
    </Text>
  );
}

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
    contactAccess: hr.contactAccess,
    createdAt: hr.user.createdAt,
    activeVacanciesCount: countHrVacancies(vacancies, hr.id, "ACTIVE"),
    totalVacanciesCount: countHrVacancies(vacancies, hr.id),
    vacancies: vacancies
      .filter((vacancy) => vacancy.hrProfile?.id === hr.id)
      .map((vacancy) => ({
        id: vacancy.id,
        title: vacancy.title,
        updatedAt: vacancy.updatedAt,
        profession: vacancy.profession,
        href: `/vacancies/${vacancy.id}`,
      })),
  };
}

function filterPublicVacancies(
  vacancies: VacancyRow[],
  search: string,
  status: VacancyStatus | "ALL",
) {
  return vacancies
    .filter((vacancy) =>
      ["ACTIVE", "PAUSED"].includes(vacancy.status),
    )
    .filter((vacancy) => status === "ALL" || vacancy.status === status)
    .filter(
      (vacancy) =>
        !search.trim() ||
        vacancy.title.toLowerCase().includes(search.trim().toLowerCase()),
    );
}

function normalizeCompanyVacancy(vacancy: VacancyRow, company: CompanyProfile) {
  return {
    ...vacancy,
    company: vacancy.company ?? {
      publicName: company.publicName,
      logoUrl: company.logoUrl,
    },
  };
}

function primaryVacancySkills(vacancy: VacancyRow) {
  return [...(vacancy.skills ?? [])]
    .sort((first, second) => skillWeightRank(second.weight) - skillWeightRank(first.weight))
    .slice(0, 10);
}

function vacancyLocationLabels(vacancy: VacancyRow, catalogs: VacancyCatalogs | null) {
  const labels = (vacancy.locations ?? []).map((item) => {
    const location = item.location;
    if (!location) return null;
    if (location.cityId) return findName(catalogs?.cities ?? [], location.cityId);
    if (location.regionId) return findName(catalogs?.regions ?? [], location.regionId);
    return findName(catalogs?.countries ?? [], location.countryId);
  }).filter(Boolean) as string[];
  return labels.length ? [...new Set(labels)].slice(0, 3) : [ui.card.locationFallback];
}

function sortPublicVacancies(
  vacancies: VacancyRow[],
  sortBy: VacancySortBy,
  direction: SortDirection,
) {
  return [...vacancies].sort((first, second) => {
    const firstValue = String(vacancySortValue(first, sortBy));
    const secondValue = String(vacancySortValue(second, sortBy));
    return direction === "asc"
      ? firstValue.localeCompare(secondValue, "uk")
      : secondValue.localeCompare(firstValue, "uk");
  });
}

function vacancySortValue(vacancy: VacancyRow, sortBy: VacancySortBy) {
  if (sortBy === "status") return vacancy.status;
  if (sortBy === "title") return vacancy.title;
  if (sortBy === "closingDate") return vacancy.closingDate;
  if (sortBy === "createdAt") return vacancy.createdAt ?? "";
  return vacancy.updatedAt;
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

const getCompanyPublicLinks = (company: CompanyProfile | null) => [
  ...(company?.websiteUrl
    ? [{ linkName: ui.companyPage.website, value: company.websiteUrl }]
    : []),
  ...(company?.links ?? []),
];
const normalizeHref = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value}`;
const copyToClipboard = (value: string) =>
  void navigator.clipboard?.writeText(value);
const normalizePhone = (value: string) => value.replace(/\s/g, "");
const findName = (items: CatalogItem[] = [], id: string | number) =>
  items.find((item) => String(item.id) === String(id))?.name ?? "";
const formatHrName = (hr: CompanyHr) =>
  [hr.user.lastName, hr.user.firstName, hr.user.middleName]
    .filter(Boolean)
    .join(" ") || ui.common.recruiter;
const countHrVacancies = (
  vacancies: VacancyRow[],
  hrId: string,
  status?: VacancyStatus,
) =>
  vacancies.filter(
    (vacancy) =>
      vacancy.hrProfile?.id === hrId && (!status || vacancy.status === status),
  ).length;
const skillWeightRank = (weight: string) =>
  ({ CRITICAL: 3, IMPORTANT: 2, NICE_TO_HAVE: 1 })[weight] ?? 0;
const companySizeLabel = (value: string) =>
  ({
    SIZE_1_10: "1-10",
    SIZE_11_20: "11-20",
    SIZE_21_50: "21-50",
    SIZE_51_100: "51-100",
    SIZE_101_200: "101-200",
    SIZE_201_500: "201-500",
    SIZE_501_1000: "501-1000",
    SIZE_1000_PLUS: "1000+",
  })[value] ?? value;
const moderationStatusLabel = (status?: string | null) =>
  (ui.moderation as Record<string, string>)[status ?? ""] ??
  status ??
  ui.moderation.PENDING;
const recruiterPreviewLabels = {
  company: ui.common.company,
  position: ui.common.position,
  email: ui.common.email,
  createdAt: ui.common.createdAt,
  activeVacancies: ui.common.activeVacancies,
  totalVacancies: ui.common.totalVacancies,
  vacanciesList: ui.common.vacanciesList,
  latestVacanciesNote: ui.common.latestVacanciesNote,
  emptyVacancies: ui.common.emptyVacancies,
  copy: ui.common.copy,
  contactsUnavailable: ui.common.contactsUnavailable,
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="m10 6 1.4 1.4L8.8 10H20v2H8.8l2.6 2.6L10 16l-5-5 5-5Z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M8 7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3v-2a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1H8Zm-4 4a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6Zm3-1a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H7Z" />
    </svg>
  );
}
function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14V4ZM5 6h6v2H7v9h9v-4h2v6H5V6Z" />
    </svg>
  );
}
function FilterChevronIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="m7.4 8.6 4.6 4.6 4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z" />
    </svg>
  );
}

export default CompanyPublicPage;
