import { useAuth, useClerk, useUser } from "@clerk/react";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../api/apiClient";
import { formatUkrainianPhone } from "../utils/formMasks";
import classes from "./Onboarding.module.scss";

type AppRole = "STUDENT" | "HR";

interface CompanyPayload {
  registrationType: "COMPANY" | "FOP";
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
  corporateDomain: string | null;
  verificationStatus: string;
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

const academicDomains = ["edu.ua", "kpi.ua", "knu.ua"];

/** Перевіряє email кандидата за академічними доменами, які дублюють backend-правило. */
const isAcademicEmail = (email: string) => {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return academicDomains.some(
    (academicDomain) =>
      domain === academicDomain || domain.endsWith(`.${academicDomain}`),
  );
};

/** Дістає зрозуміле повідомлення про помилку з відповіді API. */
const readApiError = async (response: Response) => {
  try {
    const data = await response.json();
    return data?.error?.message ?? data?.error ?? "Не вдалося завершити реєстрацію";
  } catch {
    return "Не вдалося завершити реєстрацію";
  }
};

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
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");

  const [companyData, setCompanyData] = useState<CompanyPayload>({
    registrationType: "COMPANY",
    registrationNumber: "",
    legalName: "",
    publicName: "",
    corporateDomain: "",
    foundationYear: new Date().getFullYear(),
    employeeCount: "",
    publicEmail: "",
    publicPhone: "",
    about: "",
  });
  const [hasNewCompanyData, setHasNewCompanyData] = useState(false);

  const isInvalidStudent =
    intendedRole === "STUDENT" && authEmail !== "" && !isAcademicEmail(authEmail);
  const isStudentBaseValid =
    firstName.trim() && lastName.trim() && birthDate && primaryPhone.trim() && about.trim();
  const isHrBaseValid = firstName.trim() && lastName.trim() && hrPosition.trim();
  const isCompanyReady = selectedCompanyId !== "" || hasNewCompanyData;

  /** Завантажує компанії з backend для реального вибору під час onboarding роботодавця. */
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

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const data = await response.json();
        setCompanyOptions(data.data ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCompaniesError(
          err instanceof TypeError
            ? "Не вдалося підвантажити компанії. Перевірте, чи запущений backend."
            : err instanceof Error
              ? err.message
              : "Не вдалося підвантажити компанії.",
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
          <h2>Доступ обмежено</h2>
          <p>
            Пошта <b>{authEmail}</b> не схожа на академічну. Для кабінету
            кандидата використайте корпоративну пошту навчального закладу.
          </p>
        </div>
        <button className={classes.btnDanger} onClick={() => signOut()}>
          Вийти та спробувати іншу пошту
        </button>
      </div>
    );
  }

  /** Завершує onboarding і відправляє на backend payload відповідно до ролі. */
  const handleFinalSubmit = async () => {
    setError(null);
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
        if (!isStudentBaseValid) {
          throw new Error("Заповніть ім'я, прізвище, дату народження, телефон і блок «Про себе».");
        }

        payload.birthDate = birthDate;
        payload.contactEmail = authEmail;
        payload.primaryPhone = primaryPhone.trim();
        payload.about = about.trim();
      }

      if (intendedRole === "HR") {
        if (!isHrBaseValid || !isCompanyReady) {
          throw new Error("Заповніть власні дані та оберіть або зареєструйте компанію.");
        }

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
            about: companyData.about.trim(),
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

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      localStorage.removeItem("intendedRole");
      if (user?.id) localStorage.setItem(`currentRole:${user.id}`, intendedRole);
      await user?.reload();
      navigate("/auth/redirect", { replace: true });
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        setError("Сервер тимчасово недоступний. Запустіть backend і повторіть спробу.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Сталася невідома помилка");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "HR_COMPANY_FORM") {
    const isFop = companyData.registrationType === "FOP";
    const regNumLabel = isFop ? "ІПН (10 цифр)" : "ЄДРПОУ (8 цифр)";
    const regNumPlaceholder = isFop ? "1234567890" : "12345678";

    /** Перевіряє форму нової компанії перед поверненням до основного кроку. */
    const saveCompanyDraft = () => {
      const cleanNum = companyData.registrationNumber.trim();
      const isNumOnly = /^\d+$/.test(cleanNum);

      if (
        !companyData.legalName.trim() ||
        !companyData.publicName.trim() ||
        !companyData.about.trim() ||
        !companyData.publicEmail.trim()
      ) {
        setError("Заповніть усі обов'язкові поля компанії.");
        return;
      }

      if (!isNumOnly) {
        setError("Реєстраційний номер має містити тільки цифри.");
        return;
      }

      if (companyData.registrationType === "COMPANY" && cleanNum.length !== 8) {
        setError("ЄДРПОУ юридичної особи має містити рівно 8 цифр.");
        return;
      }

      if (companyData.registrationType === "FOP" && cleanNum.length !== 10) {
        setError("ІПН ФОП має містити рівно 10 цифр.");
        return;
      }

      if (!companyData.publicEmail.includes("@")) {
        setError("Введіть коректний email компанії.");
        return;
      }

      setError(null);
      setHasNewCompanyData(true);
      setSelectedCompanyId("");
      setStep("MAIN_FORM");
    };

    return (
      <div className={classes.container}>
        <h2 className={classes.title}>Реєстрація компанії</h2>
        <p className={classes.subtitle}>
          Внесіть юридичні та публічні дані організації. Компанія потрапить на
          модерацію системного адміністратора.
        </p>

        <div className={`${classes.formSection} ${classes.gridForm}`}>
          <div className={classes.inputGroup}>
            <label className={classes.label}>
              Тип реєстрації <span className={classes.requiredStar}>*</span>
            </label>
            <select
              className={classes.selectField}
              value={companyData.registrationType}
              onChange={(e) =>
                setCompanyData({
                  ...companyData,
                  registrationType: e.target.value as "COMPANY" | "FOP",
                  registrationNumber: "",
                })
              }
            >
              <option value="COMPANY">Юридична особа</option>
              <option value="FOP">Фізична особа-підприємець</option>
            </select>
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>
              {regNumLabel} <span className={classes.requiredStar}>*</span>
            </label>
            <input
              className={classes.inputField}
              value={companyData.registrationNumber}
              onChange={(e) =>
                setCompanyData({
                  ...companyData,
                  registrationNumber: e.target.value,
                })
              }
              placeholder={regNumPlaceholder}
            />
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>
              Юридична назва <span className={classes.requiredStar}>*</span>
            </label>
            <input
              className={classes.inputField}
              value={companyData.legalName}
              onChange={(e) =>
                setCompanyData({ ...companyData, legalName: e.target.value })
              }
              placeholder={isFop ? "ФОП Шевченко Т. Г." : "ТОВ «Приклад Компанії»"}
            />
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>
              Публічна назва <span className={classes.requiredStar}>*</span>
            </label>
            <input
              className={classes.inputField}
              value={companyData.publicName}
              onChange={(e) =>
                setCompanyData({ ...companyData, publicName: e.target.value })
              }
              placeholder="Назва, яку побачать кандидати"
            />
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>
              Публічний email <span className={classes.requiredStar}>*</span>
            </label>
            <input
              type="email"
              className={classes.inputField}
              value={companyData.publicEmail}
              onChange={(e) =>
                setCompanyData({ ...companyData, publicEmail: e.target.value })
              }
              placeholder="hello@company.com"
            />
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>
              Опис компанії <span className={classes.requiredStar}>*</span>
            </label>
            <textarea
              className={classes.inputField}
              rows={3}
              value={companyData.about}
              onChange={(e) =>
                setCompanyData({ ...companyData, about: e.target.value })
              }
              placeholder="Коротко опишіть компанію, напрям і команду."
            />
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>Телефон компанії</label>
            <input
              type="tel"
              className={classes.inputField}
              value={companyData.publicPhone ?? ""}
              onChange={(e) =>
                setCompanyData({ ...companyData, publicPhone: e.target.value })
              }
              placeholder="+380..."
            />
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>Корпоративний домен</label>
            <input
              className={classes.inputField}
              value={companyData.corporateDomain ?? ""}
              onChange={(e) =>
                setCompanyData({
                  ...companyData,
                  corporateDomain: e.target.value,
                })
              }
              placeholder="company.com"
            />
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>
              Рік заснування <span className={classes.requiredStar}>*</span>
            </label>
            <input
              type="number"
              className={classes.inputField}
              value={companyData.foundationYear}
              onChange={(e) =>
                setCompanyData({
                  ...companyData,
                  foundationYear: Number(e.target.value),
                })
              }
            />
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>Кількість працівників</label>
            <select
              className={classes.selectField}
              value={companyData.employeeCount ?? ""}
              onChange={(e) =>
                setCompanyData({
                  ...companyData,
                  employeeCount: e.target.value,
                })
              }
            >
              <option value="">Не вказано</option>
              <option value="SIZE_1_10">1-10</option>
              <option value="SIZE_11_20">11-20</option>
              <option value="SIZE_21_50">21-50</option>
              <option value="SIZE_51_100">51-100</option>
              <option value="SIZE_101_200">101-200</option>
              <option value="SIZE_201_500">201-500</option>
              <option value="SIZE_501_1000">501-1000</option>
              <option value="SIZE_1000_PLUS">1000+</option>
            </select>
          </div>

          {error && <div className={classes.error}>{error}</div>}

          <div className={classes.buttonGroupRow}>
            <button className={classes.btnPrimary} onClick={saveCompanyDraft}>
              Зберегти дані компанії
            </button>
            <button
              className={classes.btnSecondary}
              onClick={() => {
                setError(null);
                setStep("MAIN_FORM");
              }}
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.container}>
      <h1 className={classes.title}>Особисті дані</h1>
      <p className={classes.subtitle}>
        Перевірте інформацію для профілю{" "}
        {intendedRole === "STUDENT" ? "кандидата" : "роботодавця"}.
      </p>

      <div className={classes.formSection}>
        <div className={classes.inputGroup}>
          <label className={classes.label}>
            Ім'я <span className={classes.requiredStar}>*</span>
          </label>
          <input
            className={classes.inputField}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>

        <div className={classes.inputGroup}>
          <label className={classes.label}>
            Прізвище <span className={classes.requiredStar}>*</span>
          </label>
          <input
            className={classes.inputField}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <div className={classes.inputGroup}>
          <label className={classes.label}>По батькові</label>
          <input
            className={classes.inputField}
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
          />
        </div>

        {intendedRole === "STUDENT" && (
          <>
            <DateInput
              classNames={{
                root: classes.inputGroup,
                label: classes.label,
                input: classes.inputField,
              }}
              label={
                <>
                  Дата народження <span className={classes.requiredStar}>*</span>
                </>
              }
              value={birthDate ? new Date(birthDate) : null}
              onChange={(value) =>
                setBirthDate(value ? dayjs(value).format("YYYY-MM-DD") : "")
              }
              valueFormat="DD.MM.YYYY"
              locale="uk"
              placeholder="Оберіть дату"
              maxDate={new Date()}
              clearable
              popoverProps={{ position: "bottom-end", withinPortal: true }}
              firstDayOfWeek={1}
            />

            <div className={classes.inputGroup}>
              <label className={classes.label}>
                Контактний телефон <span className={classes.requiredStar}>*</span>
              </label>
              <input
                type="tel"
                className={classes.inputField}
                value={primaryPhone}
                onChange={(e) => setPrimaryPhone(formatUkrainianPhone(e.target.value))}
                placeholder="+380..."
              />
            </div>

            <div className={classes.inputGroup}>
              <label className={classes.label}>
                Про себе <span className={classes.requiredStar}>*</span>
              </label>
              <textarea
                className={classes.inputField}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Коротко опишіть свій досвід, інтереси та ціль."
              />
            </div>
          </>
        )}

        {intendedRole === "HR" && (
          <>
            <div className={classes.inputGroup}>
              <label className={classes.label}>
                Ваша посада <span className={classes.requiredStar}>*</span>
              </label>
              <input
                className={classes.inputField}
                value={hrPosition}
                onChange={(e) => setHrPosition(e.target.value)}
                placeholder="Recruiter, HR manager, CEO..."
              />
            </div>

            <div className={classes.companySelectWrapper}>
              <label className={classes.label}>
                Компанія <span className={classes.requiredStar}>*</span>
              </label>

              {hasNewCompanyData ? (
                <div className={classes.selectedCompanyBlock}>
                  <div>
                    <p>
                      Додано нову: <b>{companyData.publicName}</b>
                    </p>
                    <p className={classes.selectedCompanyMeta}>
                      Реєстр. номер: {companyData.registrationNumber}
                    </p>
                  </div>
                  <div className={classes.actions}>
                    <button
                      className={classes.btnLink}
                      onClick={() => setStep("HR_COMPANY_FORM")}
                    >
                      Редагувати
                    </button>
                    <button
                      className={classes.btnLink}
                      onClick={() => setHasNewCompanyData(false)}
                    >
                      Скасувати
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    className={classes.inputField}
                    placeholder="Почніть вводити назву компанії..."
                    value={companySearch}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      setSelectedCompanyId("");
                    }}
                  />
                  <select
                    className={classes.selectField}
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                  >
                    <option value="">
                      {isCompaniesLoading ? "Завантаження компаній..." : "Оберіть компанію зі списку"}
                    </option>
                    {companyOptions.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.publicName} ({company.legalName})
                      </option>
                    ))}
                  </select>

                  {companiesError && <div className={classes.error}>{companiesError}</div>}

                  <p className={classes.helperText}>
                    Якщо вашої компанії немає у списку, можна{" "}
                    <button
                      className={classes.btnLink}
                      onClick={() => {
                        setError(null);
                        setStep("HR_COMPANY_FORM");
                      }}
                    >
                      зареєструвати її
                    </button>
                    .
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {error && <div className={classes.error}>{error}</div>}

        <button
          className={classes.btnSubmit}
          onClick={handleFinalSubmit}
          disabled={
            isLoading ||
            (intendedRole === "STUDENT" && !isStudentBaseValid) ||
            (intendedRole === "HR" && (!isHrBaseValid || !isCompanyReady))
          }
        >
          {isLoading ? "Зачекайте..." : "Завершити реєстрацію"}
        </button>
      </div>
    </div>
  );
}
