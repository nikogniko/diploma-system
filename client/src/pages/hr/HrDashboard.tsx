/* eslint-disable @typescript-eslint/no-explicit-any */
import { useAuth } from "@clerk/react";
import {
  Autocomplete,
  Avatar,
  Badge,
  Button,
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
type LinkType = "WEBSITE" | "MESSENGER" | "SOCIAL" | "PORTFOLIO" | "OTHER";
type LinkItem = { id?: string; linkType: LinkType; linkName: string; value: string };
type LinkResource = { name: string; types: LinkType[]; domains?: string[]; allowAnyUrl?: boolean };
type LocationFormItem = { countryId: number; regionId?: number | null; cityId?: number | null; label: string };

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
  spheres: CatalogItem[];
  countries: CatalogItem[];
  regions: Array<CatalogItem & { countryId: number }>;
  cities: Array<CatalogItem & { regionId: number }>;
};

type VacancyRow = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED";
  responses: number;
};

type RecruiterView = {
  fullName: string;
  position?: string | null;
  photoUrl?: string | null;
  status?: string | null;
  companyName?: string | null;
  email?: string | null;
  contacts?: string | null;
  createdAt?: string | null;
  vacanciesCount?: number;
};

const ui = messages.hrDashboard;
const commonUi = messages.common;
const currentYear = new Date().getFullYear();

const navItems = [
  { key: "open-vacancy", label: ui.nav.openVacancy, icon: <PlusIcon />, underline: true },
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
    spheres: catalogs?.spheres.map(asOption) ?? [],
    countries: catalogs?.countries.map(asOption) ?? [],
    regions: catalogs?.regions.filter((region) => region.countryId === newLocation.countryId).map(asOption) ?? [],
    cities: catalogs?.cities.filter((city) => city.regionId === newLocation.regionId).map(asOption) ?? [],
  }), [catalogs, newLocation.countryId, newLocation.regionId]);

  /** Завантажує профіль рекрутера, компанію, команду та довідники. */
  const loadDashboard = async () => {
    setPageError(null);
    setIsLoading(true);
    try {
      const token = await getToken();
      const [hrData, companyData, hrsData, catalogData] = await Promise.all([
        apiRequest<HrProfile>("/hr-profiles/my-cabinet", token),
        apiRequest<CompanyProfile>("/companies/my-cabinet", token),
        apiRequest<CompanyHr[]>("/companies/my-cabinet/hr-profiles", token),
        apiRequest<Catalogs>("/catalogs/student-cabinet", token),
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
      setVacancies([]);
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

  if (isLoading) return <AppLoader text={ui.loading} />;

  return (
    <CabinetLayout navItems={navItems} activeKey={active} onSelect={(key) => { setSelectedVacancy(null); setIsCompanyPreviewOpen(false); setActive(key); setSearchParams(key === "vacancies" ? {} : { tab: key }); }}>
      <Stack gap="md">
        <ErrorBanner message={pageError} />
        {isCompanyPreviewOpen ? (
          <CompanyPublicPage company={company} companyHrs={companyHrs} vacancies={vacancies} onBack={() => setIsCompanyPreviewOpen(false)} />
        ) : (
          <>
            {active === "open-vacancy" && <OpenVacancyTab />}
            {active === "vacancies" && (selectedVacancy ? <VacancyDetail vacancy={selectedVacancy} onBack={() => setSelectedVacancy(null)} /> : <VacancyBoard vacancies={vacancies} onSelect={setSelectedVacancy} />)}
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

function VacancyBoard({ vacancies, onSelect }: { vacancies: VacancyRow[]; onSelect: (vacancy: VacancyRow) => void }) {
  return <><TabHeader title={ui.vacancies.title} description={ui.vacancies.description} /><FormSection title={ui.vacancies.title}>
    {vacancies.length ? <Table highlightOnHover className={classes.table}><Table.Thead><Table.Tr><Table.Th>{ui.vacancies.position}</Table.Th><Table.Th>{ui.vacancies.responses}</Table.Th><Table.Th>{ui.vacancies.status}</Table.Th><Table.Th>{ui.vacancies.actions}</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{vacancies.map((vacancy) => <Table.Tr key={vacancy.id} onDoubleClick={() => onSelect(vacancy)}><Table.Td>{vacancy.title}</Table.Td><Table.Td>{vacancy.responses}</Table.Td><Table.Td><Badge>{statusLabel(vacancy.status)}</Badge></Table.Td><Table.Td><Group gap="xs"><Button size="xs" variant="light">{ui.vacancies.edit}</Button><Button size="xs" color="red" variant="light">{ui.vacancies.close}</Button></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table> : <Text className={classes.muted}>{ui.vacancies.empty}</Text>}
  </FormSection></>;
}

function VacancyDetail({ vacancy, onBack }: { vacancy: VacancyRow; onBack: () => void }) {
  const stages = Object.values(ui.vacancies.tabs);
  return <><button type="button" className={classes.backButton} onClick={onBack}><ArrowIcon /> {ui.vacancies.back}</button><TabHeader title={vacancy.title} description={ui.vacancies.pipelineDescription} /><FormSection title={ui.vacancies.pipelineTitle}><div className={classes.pipelineTabs}>{stages.map((stage, index) => <button key={stage} className={index === 0 ? classes.pipelineTabActive : classes.pipelineTab}>{stage}<span>0</span></button>)}</div></FormSection></>;
}

function OpenVacancyTab() {
  return <><TabHeader title={ui.openVacancy.title} description={ui.openVacancy.description} /><FormSection title={ui.openVacancy.title}><Text className={classes.notice}>{ui.openVacancy.notice}</Text><div className={classes.grid}><TextInput label={ui.openVacancy.titleField} placeholder={ui.openVacancy.titlePlaceholder} disabled /><Select label={ui.openVacancy.profession} placeholder={ui.openVacancy.professionPlaceholder} disabled /><TextInput label={ui.openVacancy.minSalary} placeholder="від" disabled /><TextInput label={ui.openVacancy.maxSalary} placeholder="до" disabled /></div><Button className={classes.fullButton} disabled>{ui.nav.openVacancy}</Button></FormSection></>;
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
    contacts: profile?.links?.map((link: LinkItem) => `${link.linkName}: ${link.value}`).join("; ") || ui.profile.noContacts,
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
  return <Drawer opened={opened} onClose={onClose} position="right" size="sm" title={ui.profile.previewTitle}>
    <div className={classes.recruiterPreview}>
      <div className={classes.previewHeader}>
        <Avatar src={data?.photoUrl} size={82} radius="xl" className={classes.avatarRing} />
        <div>
          <Text fw={950}>{data?.fullName}</Text>
          <Text className={classes.muted}>{data?.position}</Text>
        </div>
      </div>
      <div className={classes.previewProgress} />
      <InfoRow label={ui.profile.company} value={data?.companyName} actionLabel={ui.profile.openCompany} onClick={onCompanyOpen} />
      <InfoRow label={ui.profile.position} value={data?.position} />
      {data?.email && <InfoRow label={ui.profile.email} value={data.email} />}
      {data?.contacts && <InfoRow label={ui.profile.contacts} value={data.contacts} />}
      {data?.createdAt && <InfoRow label={ui.profile.createdAt} value={dateShort(data.createdAt)} />}
      {data?.status && <InfoRow label={ui.profile.status} value={userStatusLabel(data.status)} />}
      {typeof data?.vacanciesCount === "number" && <InfoRow label={ui.profile.activeVacancies} value={String(data.vacanciesCount)} />}
      {typeof data?.vacanciesCount === "number" && <details className={classes.vacancyDetails}>
        <summary>{ui.profile.vacanciesList}</summary>
        <Text className={classes.muted}>{ui.vacancies.empty}</Text>
      </details>}
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
        <InfoRow label={ui.company.foundationYear} value={company?.foundationYear ? String(company.foundationYear) : null} />
        <InfoRow label={ui.company.employeeCount} value={company?.employeeCount ? companySizeLabel(company.employeeCount) : null} />
        <div className={classes.publicChipBlock}>
          <Text fw={900}>{ui.company.contactsTitle}</Text>
          <Text className={classes.publicContactsNote}>{ui.company.contactsDescription}</Text>
          <InfoRow value={company?.publicEmail} />
          <InfoRow value={company?.publicPhone} />
          <CompanyPublicLinks links={getCompanyPublicLinks(company)} />
        </div>
        <div className={classes.publicChipBlock}>
          <Text fw={900}>{ui.company.spheresTitle}</Text>
          <div className={classes.chips}>{company?.spheres?.map((item) => <span className={classes.sphereChip} key={item.sphereId}>{item.sphere?.name ?? item.sphereId}</span>)}</div>
        </div>
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

function ModerationBadge({ status }: { status?: string | null }) {
  return <span className={classes.moderationBadge} data-status={status ?? "PENDING"}>{moderationLabel(status)}</span>;
}

const asOption = (item: CatalogItem) => ({ value: String(item.id), label: item.name });
const clean = (value: string) => value.trim();
const nullable = (value?: string | null) => value?.trim() || null;
const dateShort = (value: string) => new Date(value).toLocaleDateString("uk-UA");
const isValidUrlLike = (value: string) => /^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(value.trim());
const formatHrName = (hr?: CompanyHr | null) => [hr?.user.firstName, hr?.user.middleName, hr?.user.lastName].filter(Boolean).join(" ");
const normalizeHref = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || !isValidUrlLike(trimmed)) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};
const copyToClipboard = (value: string) => {
  void navigator.clipboard?.writeText(value);
};
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
function statusLabel(status: VacancyRow["status"]) { return ({ DRAFT: "Чернетка", PUBLISHED: "Опублікована", PAUSED: "Призупинена", CLOSED: "Закрита" }[status]); }
function moderationLabel(status?: string | null) { return ({ PENDING: "На перевірці", APPROVED: "Підтверджено", REJECTED: "Відхилено" }[status ?? "PENDING"] ?? status ?? "На перевірці"); }
function userStatusLabel(status?: string | null) { return ({ PENDING: "На перевірці", ACTIVE: "Активний", BLOCKED: "Заблокований" }[status ?? "PENDING"] ?? status ?? "На перевірці"); }
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
