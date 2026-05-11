import { useNavigate } from "react-router-dom";
import classes from "./Onboarding.module.scss"; // Використаємо існуючі стилі

export default function Start() {
  const navigate = useNavigate();

  const handleRoleSelect = (role: "STUDENT" | "HR") => {
    // Зберігаємо намір користувача в пам'ять браузера
    localStorage.setItem("intendedRole", role);
    // Перенаправляємо на сторінку реєстрації Clerk
    navigate("/sign-up");
  };

  return (
    <div className={classes.container}>
      <h1 className={classes.title}>Початок роботи</h1>
      <p className={classes.subtitle}>
        Оберіть, як саме ви плануєте використовувати UniJob.
      </p>

      <div className={classes.buttonGroup}>
        <button
          className={classes.btnStudent}
          onClick={() => handleRoleSelect("STUDENT")}
        >
          Я Студент (Шукаю роботу)
        </button>
        <button
          className={classes.btnHr}
          onClick={() => handleRoleSelect("HR")}
        >
          Я Роботодавець (Шукаю таланти)
        </button>
      </div>
    </div>
  );
}
