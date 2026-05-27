import { useAuth, useClerk, useUser } from "@clerk/react";
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../api/apiClient";
import { messages, interpolate } from "../../locales/localizedMessages";
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
import classes from "./Onboarding.module.scss";

type AppRole = "STUDENT" | "HR";
type RegistrationType = "COMPANY" | "FOP";

interface CompanyPayload {
  registrationType: RegistrationType;
  registrationNumber: string;
  legalName: string;
  publicName: string;
  corporateDomain?: string | null;
  foundationYear: number;
  employeeCount?: string | null;
  publicEmail: string;
  publicPhone?: string | null;
  about: string;
}

interface CompanyOption {
  id: string;
  publicName: string;
  legalName: string;
  registrationType: RegistrationType;
}

interface OnboardingPayload {
  role: AppRole;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  photoUrl?: string | null;
  birthDate?: string;
  contactEmail?: string;
  primaryPhone?: string;
  about?: string | null;
  position?: string;
  companyId?: string;
  company?: CompanyPayload;
}

type CompanyStepProps = {
  companyData: CompanyPayload;
  setCompanyData: (companyData: CompanyPayload) => void;
  error: string | null;
  saveCompanyDraft: () => void;
  cancelCompanyDraft: () => void;
  clearError: () => void;
};

const ui = messages.onboarding;
const academicDomains = ["edu.ua", "kpi.ua", "knu.ua"];
const currentYear = new Date().getFullYear();

const registrationTypes = [
  { value: "COMPANY", label: ui.company.companyType },
  { value: "FOP", label: ui.company.fopType },
];

const employeeCountOptions = [
  { value: "SIZE_1_10", label: "1-10" },
  { value: "SIZE_11_20", label: "11-20" },
  { value: "SIZE_21_50", label: "21-50" },
  { value: "SIZE_51_100", label: "51-100" },
  { value: "SIZE_101_200", label: "101-200" },
  { value: "SIZE_201_500", label: "201-500" },
  { value: "SIZE_501_1000", label: "501-1000" },
  { value: "SIZE_1000_PLUS", label: "1000+" },
];

/** Повертає порожню форму компанії з дефолтним описом для onboarding роботодавця. */
const createEmptyCompanyData = (): CompanyPayload => ({
  registrationType: "COMPANY",
  registrationNumber: "",
  legalName: "",
  publicName: "",
  corporateDomain: "",
  foundationYear: currentYear,
  employeeCount: "",
  publicEmail: "",
  publicPhone: "",
  about: ui.company.defaultAbout,
});

/** Дозволяє вводити тільки чотири цифри року. */
const sanitizeYearInput = (value: string) =>
  value.replace(/\D/g, "").slice(0, 4);

/** Перевіряє email кандидата за академічними доменами, які дублюють backend-правило. */
const isAcademicEmail = (email: string) => {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return academicDomains.some(
    (academicDomain) =>
      domain === academicDomain || domain.endsWith(`.${academicDomain}`),
  );
};

/** Дістає зрозуміле повідомлення про помилку з відповіді backend API. */
const readApiError = async (response: Response) => {
  try {
    const data = await response.json();
    return data?.error?.message ?? data?.error ?? ui.common.unknownError;
  } catch {
    return ui.common.unknownError;
  }
};

/** Сторінка завершення реєстрації кандидата або роботодавця після Clerk signup. */
export default function Onboarding() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const intendedRole =
    typeof window !== "undefined"
      ? (localStorage.getItem("intendedRole") as AppRole | null)
      : null;
  const [step, setStep] = useState<"MAIN_FORM" | "HR_COMPANY_FORM">(
    "MAIN_FORM",
  );
  const [error, setError] = useState<string | null>(null);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompaniesLoading, setIsCompaniesLoading] = useState(false);
  const [isHrSubmittedOpen, setIsHrSubmittedOpen] = useState(false);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [middleName, setMiddleName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [about, setAbout] = useState("");
  const authEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const photoUrl = user?.imageUrl ?? "";

  const [hrPosition, setHrPosition] = useState("");
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [companyTypeFilter, setCompanyTypeFilter] =
    useState<RegistrationType>("COMPANY");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyData, setCompanyData] = useState<CompanyPayload>(
    createEmptyCompanyData,
  );
  const [hasNewCompanyData, setHasNewCompanyData] = useState(false);

  const isInvalidStudent =
    intendedRole === "STUDENT" &&
    authEmail !== "" &&
    !isAcademicEmail(authEmail);
  const isStudentBaseValid =
    firstName.trim() &&
    lastName.trim() &&
    birthDate &&
    primaryPhone.trim() &&
    about.trim();
  const isHrBaseValid =
    firstName.trim() && lastName.trim() && hrPosition.trim();
  const isCompanyReady = selectedCompanyId !== "" || hasNewCompanyData;

  /** Прибирає активну помилку, коли користувач виправляє поля форми. */
  const clearError = () => setError(null);

  /** Відкриває форму нової компанії тільки після заповнення базових даних рекрутера. */
  const openCompanyRegistration = () => {
    if (!isHrBaseValid) {
      setError(ui.hr.fillHrBeforeCompany);
      return;
    }

    clearError();
    setCompanyData({
      ...createEmptyCompanyData(),
      registrationType: companyTypeFilter,
    });
    setStep("HR_COMPANY_FORM");
  };

  /** Скасовує реєстрацію нової компанії та очищує всі пов'язані з нею поля. */
  const cancelCompanyDraft = () => {
    clearError();
    setCompanyData(createEmptyCompanyData());
    setHasNewCompanyData(false);
    setSelectedCompanyId("");
    setCompanySearch("");
    setStep("MAIN_FORM");
  };

  const companySelectData = useMemo(
    () =>
      companyOptions
        .filter((company) => company.registrationType === companyTypeFilter)
        .map((company) => ({
          value: company.id,
          label: `${company.publicName} (${company.legalName})`,
        })),
    [companyOptions, companyTypeFilter],
  );

  /** Завантажує компанії з backend для вибору під час onboarding роботодавця. */
  useEffect(() => {
    if (intendedRole !== "HR" || hasNewCompanyData) return;

    const controller = new AbortController();
    const loadCompanies = async () => {
      setIsCompaniesLoading(true);
      setCompaniesError(null);
      try {
        const query = companySearch.trim();
        const response = await fetch(
          `${API_URL}/companies${query ? `?q=${encodeURIComponent(query)}` : ""}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(await readApiError(response));
        const data = await response.json();
        setCompanyOptions(data.data ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCompaniesError(
          err instanceof TypeError
            ? ui.hr.loadCompaniesError
            : err instanceof Error
              ? err.message
              : ui.hr.loadCompaniesFallback,
        );
      } finally {
        setIsCompaniesLoading(false);
      }
    };

    const timeout = window.setTimeout(loadCompanies, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [companySearch, hasNewCompanyData, intendedRole]);

  if (!intendedRole) {
    navigate("/start", { replace: true });
    return null;
  }

  if (isInvalidStudent) {
    return (
      <div className={classes.container}>
        <div className={classes.warningBlock}>
          <Title order={2}>{ui.accessDenied.title}</Title>
          <Text>{interpolate(ui.accessDenied.text, { email: authEmail })}</Text>
        </div>
        <Button className={classes.btnDanger} onClick={() => signOut()}>
          {ui.accessDenied.button}
        </Button>
      </div>
    );
  }

  /** Завершує onboarding і відправляє payload на backend відповідно до ролі. */
  const handleFinalSubmit = async () => {
    clearError();
    setIsLoading(true);

    try {
      const payload: OnboardingPayload = {
        role: intendedRole,
        email: authEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || null,
        photoUrl,
      };

      if (intendedRole === "STUDENT") {
        if (!isStudentBaseValid || !isValidUkrainianPhone(primaryPhone))
          throw new Error(ui.student.validation);
        payload.birthDate = birthDate;
        payload.contactEmail = authEmail;
        payload.primaryPhone = primaryPhone.trim();
        payload.about = about.trim();
      }

      if (intendedRole === "HR") {
        if (!isHrBaseValid || !isCompanyReady)
          throw new Error(ui.hr.validation);
        payload.position = hrPosition.trim();
        if (hasNewCompanyData) {
          payload.company = {
            ...companyData,
            registrationNumber: companyData.registrationNumber.trim(),
            legalName: companyData.legalName.trim(),
            publicName: companyData.publicName.trim(),
            corporateDomain: companyData.corporateDomain?.trim() || null,
            employeeCount: companyData.employeeCount || null,
            publicEmail: companyData.publicEmail.trim(),
            publicPhone: companyData.publicPhone?.trim() || null,
            about: ui.company.defaultAbout,
          };
        } else {
          payload.companyId = selectedCompanyId;
        }
      }

      const token = await getToken();
      const response = await fetch(`${API_URL}/users/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response));

      localStorage.removeItem("intendedRole");
      if (user?.id)
        localStorage.setItem(`currentRole:${user.id}`, intendedRole);
      await user?.reload();

      if (intendedRole === "HR") {
        setIsHrSubmittedOpen(true);
        return;
      }

      navigate("/auth/redirect", { replace: true });
    } catch (err: unknown) {
      setError(
        err instanceof TypeError
          ? ui.common.serverUnavailable
          : err instanceof Error
            ? err.message
            : ui.common.unknownError,
      );
    } finally {
      setIsLoading(false);
    }
  };

  /** Перевіряє форму нової компанії перед поверненням до основного кроку. */
  const saveCompanyDraft = () => {
    const cleanNum = companyData.registrationNumber.trim();
    if (
      !companyData.registrationNumber.trim() ||
      !companyData.legalName.trim() ||
      !companyData.publicName.trim() ||
      !companyData.publicEmail.trim()
    )
      return setError(ui.company.requiredError);
    if (!/^\d+$/.test(cleanNum)) return setError(ui.company.numberDigitsError);
    if (companyData.registrationType === "COMPANY" && cleanNum.length !== 8)
      return setError(ui.company.edrpouError);
    if (companyData.registrationType === "FOP" && cleanNum.length !== 10)
      return setError(ui.company.ipnError);
    if (!isValidEmail(companyData.publicEmail))
      return setError(ui.company.emailError);
    if (
      companyData.publicPhone &&
      !isValidUkrainianPhone(companyData.publicPhone)
    )
      return setError(ui.common.required);
    if (
      !/^\d{4}$/.test(String(companyData.foundationYear)) ||
      companyData.foundationYear > currentYear
    )
      return setError(ui.company.yearError);

    setError(null);
    setHasNewCompanyData(true);
    setSelectedCompanyId("");
    setStep("MAIN_FORM");
  };

  return (
    <>
      <Modal
        opened={isHrSubmittedOpen}
        onClose={() => navigate("/hr/profile", { replace: true })}
        title={ui.hr.submittedTitle}
        centered
      >
        <Stack>
          <Text>{ui.hr.submittedText}</Text>
          <Button onClick={() => navigate("/hr/profile", { replace: true })}>
            {ui.hr.submittedButton}
          </Button>
        </Stack>
      </Modal>

      {step === "HR_COMPANY_FORM" ? (
        <CompanyStep
          companyData={companyData}
          setCompanyData={setCompanyData}
          error={error}
          saveCompanyDraft={saveCompanyDraft}
          cancelCompanyDraft={cancelCompanyDraft}
          clearError={clearError}
        />
      ) : (
        <div className={classes.container}>
          <Title order={1} className={classes.title}>
            {ui.common.personalTitle}
          </Title>
          <Text className={classes.subtitle}>
            {interpolate(ui.common.personalSubtitle, {
              role:
                intendedRole === "STUDENT"
                  ? ui.common.candidateRole
                  : ui.common.employerRole,
            })}
          </Text>

          <Stack className={classes.formSection} gap="md">
            <div
              className={
                intendedRole === "HR" ? classes.twoGrid : classes.formGrid
              }
            >
              <TextInput
                required
                label={ui.common.firstName}
                value={firstName}
                onChange={(e) => {
                  setFirstName(sanitizeNameInput(e.currentTarget.value));
                  clearError();
                }}
              />
              {intendedRole === "HR" && (
                <TextInput
                  label={ui.common.middleName}
                  value={middleName}
                  onChange={(e) => {
                    setMiddleName(sanitizeNameInput(e.currentTarget.value));
                    clearError();
                  }}
                />
              )}
              <TextInput
                required
                label={ui.common.lastName}
                value={lastName}
                onChange={(e) => {
                  setLastName(sanitizeNameInput(e.currentTarget.value));
                  clearError();
                }}
              />
              {intendedRole === "HR" && (
                <TextInput
                  required
                  label={ui.hr.position}
                  placeholder={ui.hr.positionPlaceholder}
                  maxLength={150}
                  value={hrPosition}
                  onChange={(e) => {
                    setHrPosition(sanitizePositionInput(e.currentTarget.value));
                    clearError();
                  }}
                />
              )}
            </div>

            {intendedRole === "STUDENT" && (
              <>
                <TextInput
                  label={ui.common.middleName}
                  value={middleName}
                  onChange={(e) => {
                    setMiddleName(sanitizeNameInput(e.currentTarget.value));
                    clearError();
                  }}
                />
                <DateInput
                  required
                  label={ui.student.birthDate}
                  value={birthDate ? new Date(birthDate) : null}
                  onChange={(value) => {
                    setBirthDate(
                      value ? dayjs(value).format("YYYY-MM-DD") : "",
                    );
                    clearError();
                  }}
                  valueFormat="DD.MM.YYYY"
                  locale="uk"
                  placeholder={ui.student.birthPlaceholder}
                  maxDate={new Date()}
                  clearable
                  popoverProps={{ position: "bottom-end", withinPortal: true }}
                  firstDayOfWeek={1}
                />
                <TextInput
                  required
                  label={ui.student.phone}
                  type="tel"
                  value={primaryPhone}
                  onChange={(e) => {
                    setPrimaryPhone(
                      formatUkrainianPhone(e.currentTarget.value),
                    );
                    clearError();
                  }}
                  placeholder="+380 XX XXX XX XX"
                />
                <TextInput
                  required
                  label={ui.student.about}
                  value={about}
                  onChange={(e) => {
                    setAbout(e.currentTarget.value);
                    clearError();
                  }}
                  placeholder={ui.student.aboutPlaceholder}
                />
              </>
            )}

            {intendedRole === "HR" && (
              <div className={classes.fullRow}>
                <Text className={classes.label}>
                  {ui.hr.company}{" "}
                  <span className={classes.requiredStar}>*</span>
                </Text>
                {hasNewCompanyData ? (
                  <div className={classes.selectedCompanyBlock}>
                    <div>
                      <Text>
                        {ui.hr.selectedNew} <b>{companyData.publicName}</b>
                      </Text>
                      <Text className={classes.selectedCompanyMeta}>
                        {ui.hr.registrationNumber}{" "}
                        {companyData.registrationNumber}
                      </Text>
                    </div>
                    <Group gap="sm">
                      <button
                        className={classes.btnLink}
                        onClick={() => setStep("HR_COMPANY_FORM")}
                      >
                        {ui.hr.edit}
                      </button>
                      <button
                        className={classes.btnLink}
                        onClick={cancelCompanyDraft}
                      >
                        {ui.hr.cancel}
                      </button>
                    </Group>
                  </div>
                ) : (
                  <Stack gap="sm">
                    <div className={classes.companySearchGrid}>
                      <Select
                        required
                        label={ui.company.registrationType}
                        data={registrationTypes}
                        value={companyTypeFilter}
                        onChange={(value) => {
                          setCompanyTypeFilter(
                            (value ?? "COMPANY") as RegistrationType,
                          );
                          setSelectedCompanyId("");
                          clearError();
                        }}
                        allowDeselect={false}
                      />
                      <Select
                        required
                        label={ui.hr.companySearch}
                        data={companySelectData}
                        value={selectedCompanyId || null}
                        searchValue={companySearch}
                        onSearchChange={(value) => {
                          setCompanySearch(value);
                          clearError();
                        }}
                        onChange={(value) => {
                          setSelectedCompanyId(value ?? "");
                          clearError();
                        }}
                        placeholder={
                          isCompaniesLoading
                            ? ui.hr.loadingCompanies
                            : companySelectData.length
                              ? ui.hr.selectCompany
                              : ui.hr.emptyCompanies
                        }
                        nothingFoundMessage={ui.hr.emptyCompanies}
                        searchable
                        clearable
                      />
                    </div>
                    {companiesError && (
                      <div className={classes.error}>{companiesError}</div>
                    )}
                    <Text className={classes.helperText}>
                      {ui.hr.registerCompanyPrefix}{" "}
                      <button
                        className={classes.btnLink}
                        onClick={openCompanyRegistration}
                      >
                        {ui.hr.registerCompanyAction}
                      </button>
                      .
                    </Text>
                  </Stack>
                )}
              </div>
            )}

            {error && <div className={classes.error}>{error}</div>}
            <Button
              className={classes.btnSubmit}
              loading={isLoading}
              onClick={handleFinalSubmit}
              disabled={
                (intendedRole === "STUDENT" && !isStudentBaseValid) ||
                (intendedRole === "HR" && (!isHrBaseValid || !isCompanyReady))
              }
            >
              {isLoading ? ui.common.wait : ui.common.finish}
            </Button>
          </Stack>
        </div>
      )}
    </>
  );
}

function CompanyStep({
  companyData,
  setCompanyData,
  error,
  saveCompanyDraft,
  cancelCompanyDraft,
  clearError,
}: CompanyStepProps) {
  const isFop = companyData.registrationType === "FOP";
  const registrationNumberLimit = isFop ? 10 : 8;
  return (
    <div className={classes.container}>
      <Title order={2} className={classes.title}>
        {ui.company.title}
      </Title>
      <Text className={classes.subtitle}>{ui.company.subtitle}</Text>

      <Stack className={classes.formSection} gap="md">
        <div className={classes.companyTopRow}>
          <Select
            required
            label={ui.company.registrationType}
            data={registrationTypes}
            value={companyData.registrationType}
            onChange={(value) => {
              setCompanyData({
                ...companyData,
                registrationType: (value ?? "COMPANY") as RegistrationType,
                registrationNumber: "",
              });
              clearError();
            }}
            allowDeselect={false}
          />
          <TextInput
            required
            label={isFop ? ui.company.ipn : ui.company.edrpou}
            placeholder={isFop ? "1234567890" : "12345678"}
            maxLength={registrationNumberLimit}
            value={companyData.registrationNumber}
            onChange={(e) => {
              setCompanyData({
                ...companyData,
                registrationNumber: sanitizeRegistrationNumber(
                  e.currentTarget.value,
                  companyData.registrationType,
                ),
              });
              clearError();
            }}
          />
        </div>

        <TextInput
          required
          label={ui.company.legalName}
          placeholder={
            isFop
              ? ui.company.legalNameFopPlaceholder
              : ui.company.legalNameCompanyPlaceholder
          }
          maxLength={200}
          value={companyData.legalName}
          onChange={(e) => {
            setCompanyData({
              ...companyData,
              legalName: e.currentTarget.value.slice(0, 200),
            });
            clearError();
          }}
        />

        <div className={classes.companyColumns}>
          <Stack gap="md">
            <TextInput
              required
              label={ui.company.publicName}
              placeholder={ui.company.publicNamePlaceholder}
              maxLength={100}
              value={companyData.publicName}
              onChange={(e) => {
                setCompanyData({
                  ...companyData,
                  publicName: e.currentTarget.value.slice(0, 100),
                });
                clearError();
              }}
            />
            <TextInput
              required
              label={ui.company.publicEmail}
              type="email"
              placeholder="hello@company.com"
              value={companyData.publicEmail}
              onChange={(e) => {
                setCompanyData({
                  ...companyData,
                  publicEmail: sanitizeEmailInput(e.currentTarget.value),
                });
                clearError();
              }}
            />
            <TextInput
              label={ui.company.publicPhone}
              type="tel"
              placeholder="+380 XX XXX XX XX"
              value={companyData.publicPhone ?? ""}
              onChange={(e) => {
                setCompanyData({
                  ...companyData,
                  publicPhone: formatUkrainianPhone(e.currentTarget.value),
                });
                clearError();
              }}
            />
          </Stack>

          <Stack gap="md">
            <NumberInput
              required
              label={ui.company.foundationYear}
              min={1800}
              max={currentYear}
              step={1}
              allowDecimal={false}
              allowNegative={false}
              clampBehavior="strict"
              placeholder={String(currentYear)}
              value={
                companyData.foundationYear
                  ? String(companyData.foundationYear)
                  : ""
              }
              onChange={(value) => {
                const year = sanitizeYearInput(String(value));
                setCompanyData({
                  ...companyData,
                  foundationYear: year ? Number(year) : 0,
                });
                clearError();
              }}
            />
            <TextInput
              label={ui.company.corporateDomain}
              placeholder="company.com"
              maxLength={100}
              value={companyData.corporateDomain ?? ""}
              onChange={(e) => {
                setCompanyData({
                  ...companyData,
                  corporateDomain: sanitizeDomainInput(e.currentTarget.value),
                });
                clearError();
              }}
            />
            <Select
              label={ui.company.employeeCount}
              placeholder={ui.company.notSpecified}
              data={employeeCountOptions}
              value={companyData.employeeCount || null}
              onChange={(value) => {
                setCompanyData({ ...companyData, employeeCount: value ?? "" });
                clearError();
              }}
            />
          </Stack>
        </div>

        {error && <div className={classes.error}>{error}</div>}
        <div className={classes.buttonGroupRow}>
          <Button className={classes.btnPrimary} onClick={saveCompanyDraft}>
            {ui.company.save}
          </Button>
          <Button
            className={classes.btnSecondary}
            variant="light"
            onClick={cancelCompanyDraft}
          >
            {ui.company.cancel}
          </Button>
        </div>
      </Stack>
    </div>
  );
}
