import { useUser, useAuth, useClerk } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import classes from "./Onboarding.module.scss";

interface CompanyPayload {
  registrationType: string;
  registrationNumber: string;
  legalName: string;
  publicName: string;
  corporateDomain?: string;
  foundationYear: number;
  employeeCount?: string;
  publicEmail: string;
  publicPhone?: string;
  about: string;
}

interface OnboardingPayload {
  role: "STUDENT" | "HR";
  email: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
  hrPosition?: string;
  companyName?: string; // Перейменували, щоб не було ID
  newCompanyData?: CompanyPayload;
}

export default function Onboarding() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const intendedRole =
    typeof window !== "undefined"
      ? (localStorage.getItem("intendedRole") as "STUDENT" | "HR" | null)
      : null;

  const [step, setStep] = useState<"MAIN_FORM" | "HR_COMPANY_FORM">(
    "MAIN_FORM",
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Спільні дані
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const authEmail = user?.primaryEmailAddress?.emailAddress || "";
  const photoUrl = user?.imageUrl || "";

  // Дані HR
  const [hrPosition, setHrPosition] = useState("");

  // Вибір існуючої компанії (без ID, тільки текстова назва)
  const [selectedCompanyName, setSelectedCompanyName] = useState("");

  // Дані нової Компанії
  const [companyData, setCompanyData] = useState<CompanyPayload>({
    registrationType: "COMPANY", // За замовчуванням Юридична особа
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

  // Валідація
  const isInvalidStudent =
    intendedRole === "STUDENT" && !authEmail.endsWith(".edu.ua");
  const isHrBaseValid =
    firstName.trim() && lastName.trim() && hrPosition.trim();
  const isCompanyReady = selectedCompanyName.trim() !== "" || hasNewCompanyData;

  if (!intendedRole) {
    navigate("/start", { replace: true });
    return null;
  }

  // Блокування студента
  if (isInvalidStudent) {
    return (
      <div className={classes.container}>
        <div className={classes.warningBlock}>
          <h2>Доступ заборонено</h2>
          <p>
            Ваша пошта <b>{authEmail}</b> не є академічною. Ваш обліковий запис
            не буде створено. Увійдіть за допомогою пошти вашого навчального
            закладу (.edu.ua).
          </p>
        </div>
        <button className={classes.btnDanger} onClick={() => signOut()}>
          Вийти та спробувати іншу пошту
        </button>
      </div>
    );
  }

  const handleFinalSubmit = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const payload: OnboardingPayload = {
        role: intendedRole,
        email: authEmail,
        firstName,
        lastName,
        photoUrl,
      };

      if (intendedRole === "HR") {
        if (!isHrBaseValid || !isCompanyReady)
          throw new Error("Заповніть власні дані та оберіть компанію");
        payload.hrPosition = hrPosition;

        if (hasNewCompanyData) {
          payload.newCompanyData = companyData;
        } else if (selectedCompanyName) {
          payload.companyName = selectedCompanyName;
        }
      }

      const token = await getToken();
      const response = await fetch(
        "http://localhost:5000/api/users/onboarding",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      localStorage.removeItem("intendedRole");
      await user?.reload();
      navigate(intendedRole === "STUDENT" ? "/student" : "/hr", {
        replace: true,
      });
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Сталася невідома помилка");
    } finally {
      setIsLoading(false);
    }
  };

  // --- РЕНДЕР КРОКУ: СТВОРЕННЯ КОМПАНІЇ ---
  if (step === "HR_COMPANY_FORM") {
    // Допоміжні змінні для правильних підказок
    const isFop = companyData.registrationType === "FOP";
    const regNumLabel = isFop ? "ІПН (10 цифр)" : "ЄДРПОУ (8 цифр)";
    const regNumPlaceholder = isFop ? "1234567890" : "12345678";

    return (
      <div className={classes.container}>
        <h2 className={classes.title}>Реєстрація компанії</h2>
        <p className={classes.subtitle}>
          Внесіть юридичні та публічні дані вашої організації.
        </p>

        <div className={`${classes.formSection} ${classes.gridForm}`}>
          <div className={classes.inputGroup}>
            <label className={classes.label}>
              Тип реєстрації <span className={classes.requiredStar}>*</span>
            </label>
            <select
              className={classes.selectField}
              value={companyData.registrationType}
              onChange={(e) => {
                // При зміні типу очищаємо номер, щоб юзер не зберіг ІПН як ЄДРПОУ
                setCompanyData({
                  ...companyData,
                  registrationType: e.target.value,
                  registrationNumber: "",
                });
              }}
            >
              <option value="COMPANY">Юридична особа</option>
              <option value="FOP">Фізична особа-підприємець (ФОП)</option>
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
              placeholder={isFop ? "ФОП Шевченко Т. Г." : "ТОВ 'Рога і Копита'"}
            />
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>
              Публічна назва (Бренд){" "}
              <span className={classes.requiredStar}>*</span>
            </label>
            <input
              className={classes.inputField}
              value={companyData.publicName}
              onChange={(e) =>
                setCompanyData({ ...companyData, publicName: e.target.value })
              }
              placeholder="Бренд компанії"
            />
          </div>

          <div className={classes.inputGroup}>
            <label className={classes.label}>
              Публічний Email компанії{" "}
              <span className={classes.requiredStar}>*</span>
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
              Опис компанії (About){" "}
              <span className={classes.requiredStar}>*</span>
            </label>
            <textarea
              className={classes.inputField}
              rows={3}
              value={companyData.about}
              onChange={(e) =>
                setCompanyData({ ...companyData, about: e.target.value })
              }
              placeholder="Розкажіть про вашу компанію..."
            />
          </div>

          {/* НЕОБОВ'ЯЗКОВІ ПОЛЯ */}
          <div className={classes.inputGroup}>
            <label className={classes.label}>Контактний телефон компанії</label>
            <input
              type="tel"
              className={classes.inputField}
              value={companyData.publicPhone}
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
              value={companyData.corporateDomain}
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
              value={companyData.employeeCount}
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
            </select>
          </div>

          <div className={classes.buttonGroupRow}>
            <button
              className={classes.btnPrimary}
              onClick={() => {
                // ЖОРСТКА ВАЛІДАЦІЯ ПЕРЕД ЗБЕРЕЖЕННЯМ
                const cleanNum = companyData.registrationNumber.trim();
                const isNumOnly = /^\d+$/.test(cleanNum);

                if (
                  !companyData.legalName ||
                  !companyData.publicName ||
                  !companyData.about ||
                  !companyData.publicEmail
                ) {
                  alert("Заповніть всі обов'язкові поля (з зірочкою).");
                  return;
                }

                if (!isNumOnly) {
                  alert("Реєстраційний номер має містити ТІЛЬКИ цифри.");
                  return;
                }

                if (
                  companyData.registrationType === "COMPANY" &&
                  cleanNum.length !== 8
                ) {
                  alert(
                    "Помилка: ЄДРПОУ юридичної особи має містити рівно 8 цифр.",
                  );
                  return;
                }

                if (
                  companyData.registrationType === "FOP" &&
                  cleanNum.length !== 10
                ) {
                  alert("Помилка: ІПН ФОПа має містити рівно 10 цифр.");
                  return;
                }

                if (!companyData.publicEmail.includes("@")) {
                  alert("Введіть коректний Email компанії.");
                  return;
                }

                setHasNewCompanyData(true);
                setSelectedCompanyName(""); // Очищуємо поле випадайки
                setStep("MAIN_FORM");
              }}
            >
              Зберегти дані компанії
            </button>
            <button
              className={classes.btnSecondary}
              onClick={() => setStep("MAIN_FORM")}
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- РЕНДЕР КРОКУ: ГОЛОВНА ФОРМА ---
  return (
    <div className={classes.container}>
      <h1 className={classes.title}>Особисті дані</h1>
      <p className={classes.subtitle}>
        Перевірте та доповніть інформацію для профілю{" "}
        {intendedRole === "STUDENT" ? "Студента" : "Роботодавця"}.
      </p>

      {error && <div className={classes.error}>{error}</div>}

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
                placeholder="Recruiter, CEO..."
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
                      Додано нову: <b>{companyData.legalName}</b>
                    </p>
                    <p
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-dark-muted)",
                      }}
                    >
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
                      style={{ color: "var(--color-dark-muted)" }}
                    >
                      Скасувати
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Datalist без ID, тільки назви */}
                  <input
                    className={classes.inputField}
                    list="registered-companies"
                    placeholder="Почніть вводити назву компанії..."
                    value={selectedCompanyName}
                    onChange={(e) => setSelectedCompanyName(e.target.value)}
                  />
                  <datalist id="registered-companies">
                    <option value="Epam Systems (ТОВ ЕПАМ СИСТЕМЗ)" />
                    <option value="SoftServe (ТОВ СОФТСЕРВ)" />
                    <option value="GlobalLogic (ТОВ ГЛОБАЛЛОДЖИК УКРАЇНА)" />
                  </datalist>

                  <p className={classes.helperText}>
                    Якщо вашої компанії немає в списку, ви можете{" "}
                    <button
                      className={classes.btnLink}
                      onClick={() => setStep("HR_COMPANY_FORM")}
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

        <button
          className={classes.btnSubmit}
          onClick={handleFinalSubmit}
          disabled={
            isLoading ||
            (intendedRole === "HR" && (!isHrBaseValid || !isCompanyReady))
          }
        >
          {isLoading ? "Зачекайте..." : "Завершити реєстрацію"}
        </button>
      </div>
    </div>
  );
}
