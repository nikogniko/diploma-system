/* eslint-disable @typescript-eslint/no-explicit-any */
import { useAuth } from "@clerk/react";
import {
  Avatar,
  Badge,
  Button,
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
import { ApiError, apiRequest } from "../../api/apiClient";
import { AppLoader } from "../../components/common/AppLoader";
import { AppTooltip } from "../../components/common/AppTooltip";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { FormSection } from "../../components/common/FormSection";
import { RichTextEditor } from "../../components/common/RichTextEditor";
import { CabinetLayout } from "../../layouts/CabinetLayout";
import { messages } from "../../locales/localizedMessages";
import {
  formatUkrainianPhone,
  isValidEmail,
  isValidUkrainianPhone,
  sanitizeDomainInput,
  sanitizeEmailInput,
  sanitizePositionInput,
  sanitizeRegistrationNumber,
} from "../../utils/formMasks";
import classes from "./HrDashboard.module.scss";

type CatalogItem = { id: number; name: string };
type LinkType = "WEBSITE" | "MESSENGER" | "SOCIAL" | "PORTFOLIO" | "OTHER";
type LinkItem = { id?: string; linkType: LinkType; linkName: string; value: string };
type LocationFormItem = { countryId: number; regionId?: number | null; cityId?: number | null; label: string };

type HrProfile = {
  id: string;
  position: string;
  links: LinkItem[];
  user: { firstName: string; lastName: string; middleName?: string | null; photoUrl?: string | null; status: string };
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

const ui = messages.hrDashboard;
const commonUi = messages.common;
const currentYear = new Date().getFullYear();

const navItems = [
  { key: "open-vacancy", label: ui.nav.openVacancy, icon: <PlusIcon /> },
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

/** Кабінет роботодавця з профілем рекрутера, профілем компанії та основою дошки вакансій. */
export default function HrDashboard() {
  const { getToken } = useAuth();
  const [active, setActive] = useState("vacancies");
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

  const [hrForm, setHrForm] = useState({ position: "", links: [] as LinkItem[] });
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
      setHrForm({ position: hrData.position ?? "", links: hrData.links ?? [] });
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
    if (!hrForm.position.trim()) throw new Error(ui.errors.required);
    validateLinks(hrForm.links);
    const token = await getToken();
    await apiRequest("/hr-profiles/my-cabinet", token, {
      method: "PATCH",
      body: JSON.stringify({
        position: clean(hrForm.position),
        links: normalizeLinks(hrForm.links),
      }),
    });
  });

  /** Зберігає публічну сторінку компанії, сфери, локації та посилання. */
  const saveCompanyProfile = () => runBlock("company", async () => {
    if (!companyForm.registrationNumber.trim() || !companyForm.legalName.trim() || !companyForm.publicName.trim() || !companyForm.about.trim()) throw new Error(ui.errors.required);
    if (companyForm.registrationType === "COMPANY" && companyForm.registrationNumber.length !== 8) throw new Error(messages.onboarding.company.edrpouError);
    if (companyForm.registrationType === "FOP" && companyForm.registrationNumber.length !== 10) throw new Error(messages.onboarding.company.ipnError);
    if (!isValidEmail(companyForm.publicEmail)) throw new Error(ui.errors.email);
    if (companyForm.publicPhone && !isValidUkrainianPhone(companyForm.publicPhone)) throw new Error(ui.errors.phone);
    if (companyForm.websiteUrl && !isValidUrlLike(companyForm.websiteUrl)) throw new Error(ui.errors.url);
    if (companyForm.logoUrl && !isValidUrlLike(companyForm.logoUrl)) throw new Error(ui.errors.url);
    if (companyForm.foundationYear < 1800 || companyForm.foundationYear > currentYear) throw new Error(ui.errors.year);
    validateLinks(companyForm.links);

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
    <CabinetLayout navItems={navItems} activeKey={active} onSelect={(key) => { setSelectedVacancy(null); setActive(key); }}>
      <Stack gap="md">
        <ErrorBanner message={pageError} />
        {active === "open-vacancy" && <OpenVacancyTab />}
        {active === "vacancies" && (selectedVacancy ? <VacancyDetail vacancy={selectedVacancy} onBack={() => setSelectedVacancy(null)} /> : <VacancyBoard vacancies={vacancies} onSelect={setSelectedVacancy} />)}
        {active === "profile" && <HrProfileTab profile={hrProfile} form={hrForm} setForm={setHrForm} error={blockErrors.hr} saving={saving.hr} onSave={saveHrProfile} />}
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
            onSave={saveCompanyProfile}
          />
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

function HrProfileTab({ profile, form, setForm, error, saving, onSave }: any) {
  const fullName = [profile?.user.lastName, profile?.user.firstName, profile?.user.middleName].filter(Boolean).join(" ");
  return <><TabHeader title={ui.profile.title} description={ui.profile.description} /><FormSection title={ui.profile.title}><div className={classes.profileTop}><Avatar src={profile?.user.photoUrl} size={88} radius="xl" className={classes.avatarRing} /><Stack gap={4}><Text fw={900}>{fullName}</Text><Group gap="xs"><Badge variant="light">{profile?.user.status}</Badge><Text className={classes.muted}>{profile?.company.publicName}</Text></Group></Stack></div><TextInput required label={ui.profile.position} placeholder={ui.profile.positionPlaceholder} maxLength={150} value={form.position} onChange={(event) => setForm({ ...form, position: sanitizePositionInput(event.currentTarget.value) })} /></FormSection><FormSection title={ui.profile.linksTitle} description={ui.profile.linksDescription}><LinkEditor links={form.links} setLinks={(links) => setForm({ ...form, links })} /><InlineError message={error} /><Button className={classes.fullButton} loading={saving} onClick={onSave}>{ui.profile.save}</Button></FormSection></>;
}

function CompanyProfileTab(props: any) {
  const { company, companyHrs, form, setForm, options, newLocation, setNewLocation, error, saving, onAddLocation, onSave } = props;
  return <><div className={classes.headerRow}><TabHeader title={ui.company.title} description={ui.company.description} /><Button variant="light">{ui.company.preview}</Button></div>
    <FormSection title={ui.company.publicTitle}>
      <div className={classes.companyHero}><Avatar src={form.logoUrl} size="xl" radius="md" /><div><Text fw={900}>{form.publicName || company?.publicName}</Text><Text className={classes.muted}>{company?.verificationStatus}</Text></div></div>
      <div className={classes.grid}><TextInput required label={ui.company.publicName} maxLength={100} value={form.publicName} onChange={(e) => setForm({ ...form, publicName: e.currentTarget.value })} /><TextInput label={ui.company.logoUrl} placeholder={messages.studentDashboard.resourcePlaceholder} maxLength={255} value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.currentTarget.value })} /><TextInput label={ui.company.websiteUrl} placeholder="https://company.ua" maxLength={255} value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.currentTarget.value })} /><NumberInput required label={ui.company.foundationYear} min={1800} max={currentYear} step={1} allowDecimal={false} allowNegative={false} clampBehavior="strict" value={form.foundationYear} onChange={(value) => setForm({ ...form, foundationYear: Number(value) || currentYear })} /><Select label={ui.company.employeeCount} data={companySizes} value={form.employeeCount || null} onChange={(value) => setForm({ ...form, employeeCount: value ?? "" })} /><RichTextEditor value={form.about} onChange={(about) => setForm({ ...form, about })} label={ui.company.about} /></div>
    </FormSection>
    <FormSection title={ui.company.legalTitle}>
      <div className={classes.grid}><Select required label={ui.company.registrationType} data={registrationTypes} value={form.registrationType} onChange={(value) => setForm({ ...form, registrationType: value ?? "COMPANY", registrationNumber: "" })} /><TextInput required label={ui.company.registrationNumber} maxLength={form.registrationType === "FOP" ? 10 : 8} value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: sanitizeRegistrationNumber(e.currentTarget.value, form.registrationType) })} /><TextInput required className={classes.fullRow} label={ui.company.legalName} maxLength={200} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.currentTarget.value })} /><TextInput label={ui.company.corporateDomain} placeholder="company.ua" maxLength={100} value={form.corporateDomain} onChange={(e) => setForm({ ...form, corporateDomain: sanitizeDomainInput(e.currentTarget.value) })} /></div>
    </FormSection>
    <FormSection title={ui.company.contactsTitle}>
      <div className={classes.grid}><TextInput required label={ui.company.publicEmail} value={form.publicEmail} onChange={(e) => setForm({ ...form, publicEmail: sanitizeEmailInput(e.currentTarget.value) })} /><TextInput label={ui.company.publicPhone} value={form.publicPhone} onChange={(e) => setForm({ ...form, publicPhone: formatUkrainianPhone(e.currentTarget.value) })} /></div>
    </FormSection>
    <FormSection title={ui.company.spheresTitle}><MultiSelect data={options.spheres} searchable value={form.sphereIds} onChange={(sphereIds) => setForm({ ...form, sphereIds })} /></FormSection>
    <FormSection title={ui.company.locationsTitle}>
      <div className={classes.chips}>{form.locations.map((location: LocationFormItem) => <button key={location.label} className={classes.locationChip} onClick={() => setForm({ ...form, locations: form.locations.filter((item: LocationFormItem) => item.label !== location.label) })}>{location.label} ×</button>)}</div>
      <div className={classes.threeGrid}><Select label={ui.company.country} data={options.countries} value={newLocation.countryId ? String(newLocation.countryId) : null} onChange={(value) => setNewLocation({ countryId: Number(value), regionId: 0, cityId: 0 })} /><Select label={ui.company.region} data={options.regions} disabled={!newLocation.countryId} value={newLocation.regionId ? String(newLocation.regionId) : null} onChange={(value) => setNewLocation({ ...newLocation, regionId: Number(value), cityId: 0 })} /><Select label={ui.company.city} data={options.cities} disabled={!newLocation.regionId} value={newLocation.cityId ? String(newLocation.cityId) : null} onChange={(value) => setNewLocation({ ...newLocation, cityId: Number(value) })} /></div>
      <Button variant="light" onClick={onAddLocation}>{ui.company.addLocation}</Button>
    </FormSection>
    <FormSection title={ui.company.linksTitle}><LinkEditor links={form.links} setLinks={(links) => setForm({ ...form, links })} /></FormSection>
    <FormSection title={ui.company.teamTitle}><div className={classes.hrCards}>{companyHrs.map((hr: CompanyHr) => <div key={hr.id} className={classes.hrCard}><Avatar src={hr.user.photoUrl} radius="xl" /><div><Text fw={900}>{[hr.user.lastName, hr.user.firstName].filter(Boolean).join(" ")}</Text><Text className={classes.muted}>{hr.position}</Text></div></div>)}</div></FormSection>
    <InlineError message={error} /><Button className={classes.fullButton} loading={saving} onClick={onSave}>{ui.company.save}</Button>
  </>;
}

function LinkEditor({ links, setLinks }: { links: LinkItem[]; setLinks: (links: LinkItem[]) => void }) {
  const categories = [
    { value: "WEBSITE", label: messages.studentDashboard.linksEditor.categories.website },
    { value: "MESSENGER", label: messages.studentDashboard.linksEditor.categories.messenger },
    { value: "SOCIAL", label: messages.studentDashboard.linksEditor.categories.social },
    { value: "PORTFOLIO", label: messages.studentDashboard.linksEditor.categories.portfolio },
    { value: "OTHER", label: messages.studentDashboard.linksEditor.categories.other },
  ];
  return <Stack gap="sm">{links.map((link, index) => <div className={classes.linkGrid} key={index}><Select required label={ui.links.category} data={categories} value={link.linkType} onChange={(value) => setLinks(links.map((item, i) => i === index ? { ...item, linkType: (value ?? "OTHER") as LinkType } : item))} /><TextInput required label={ui.links.name} maxLength={100} value={link.linkName} onChange={(e) => setLinks(links.map((item, i) => i === index ? { ...item, linkName: e.currentTarget.value } : item))} /><TextInput required label={ui.links.value} maxLength={255} value={link.value} onChange={(e) => setLinks(links.map((item, i) => i === index ? { ...item, value: e.currentTarget.value } : item))} /><AppTooltip label={commonUi.actions.delete}><button type="button" className={classes.iconButton} onClick={() => setLinks(links.filter((_, i) => i !== index))}><TrashIcon /></button></AppTooltip></div>)}<Button variant="light" onClick={() => setLinks([...links, { linkType: "WEBSITE", linkName: "", value: "" }])}>{ui.links.add}</Button></Stack>;
}

function TabHeader({ title, description }: { title: string; description: string }) {
  return <div className={classes.tabHeader}><Title order={1} className={classes.tabTitle}>{title}</Title><Text className={classes.tabDescription}>{description}</Text></div>;
}

function InlineError({ message }: { message?: string | null }) {
  return message ? <div className={classes.inlineError}>{message}</div> : null;
}

const asOption = (item: CatalogItem) => ({ value: String(item.id), label: item.name });
const clean = (value: string) => value.trim();
const nullable = (value?: string | null) => value?.trim() || null;
const isValidUrlLike = (value: string) => /^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(value.trim());
function validateLinks(links: LinkItem[]) {
  links.forEach((link) => {
    if (!link.linkType || !link.linkName.trim() || !link.value.trim()) throw new Error(ui.errors.required);
    if (!isValidUrlLike(link.value) && link.linkType !== "MESSENGER") throw new Error(ui.errors.url);
  });
}
const normalizeLinks = (links: LinkItem[]) => links.filter((link) => link.linkName.trim() && link.value.trim()).map((link) => ({ linkType: link.linkType, linkName: clean(link.linkName), value: clean(link.value) }));
function formatLocationByIds(location: { countryId: number; regionId: number; cityId: number }, catalogs: Catalogs | null) {
  return [
    catalogs?.countries.find((item) => item.id === location.countryId)?.name,
    catalogs?.regions.find((item) => item.id === location.regionId)?.name,
    catalogs?.cities.find((item) => item.id === location.cityId)?.name,
  ].filter(Boolean).join(", ");
}
function getErrorMessage(error: unknown) { return error instanceof ApiError || error instanceof Error ? error.message : commonUi.messages.unknownError; }
function statusLabel(status: VacancyRow["status"]) { return ({ DRAFT: "Чернетка", PUBLISHED: "Опублікована", PAUSED: "Призупинена", CLOSED: "Закрита" }[status]); }

function PlusIcon() { return <svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" /></svg>; }
function BriefcaseIcon() { return <svg viewBox="0 0 24 24"><path d="M9 6V4h6v2h5a2 2 0 0 1 2 2v4H2V8a2 2 0 0 1 2-2h5Zm2 0h2V5h-2v1ZM2 14h20v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4Z" /></svg>; }
function UserIcon() { return <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" /></svg>; }
function CompanyIcon() { return <svg viewBox="0 0 24 24"><path d="M3 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16h-2v-4h-4v4H3Zm4-12h2V7H7v2Zm4 0h2V7h-2v2Zm-4 4h2v-2H7v2Zm4 0h2v-2h-2v2Zm7 8V9h1a2 2 0 0 1 2 2v10h-3Z" /></svg>; }
function ArrowIcon() { return <svg viewBox="0 0 24 24"><path d="m10 6 1.4 1.4L8.8 10H20v2H8.8l2.6 2.6L10 16l-5-5 5-5Z" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24"><path d="M7 21a2 2 0 0 1-2-2V7h14v12a2 2 0 0 1-2 2H7ZM9 4h6l1 1h4v2H4V5h4l1-1Z" /></svg>; }
