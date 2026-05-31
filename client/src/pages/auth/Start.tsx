import { Button, Group, Text, Title } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import classes from "./Start.module.scss";

/** Сторінка вибору ролі перед реєстрацією. */
export default function Start() {
  const navigate = useNavigate();

  /** Зберігає обрану роль і відкриває сторінку реєстрації. */
  const handleRoleSelect = (role: "STUDENT" | "HR") => {
    localStorage.setItem("intendedRole", role);
    navigate("/sign-up");
  };

  return (
    <section className={classes.start}>
      <div className={classes.card}>
        <Text className={classes.eyebrow}>Початок роботи</Text>
        <Title order={1} className={classes.title}>
          Оберіть, як UniJob має допомогти саме вам
        </Title>
        <Text className={classes.subtitle}>
          Кандидати отримують простір для пошуку можливостей та створення свого
          професійного профілю. Роботодавці зможуть представляти компанію та
          розміщувати вакансії, знаходити релевантних молодих фахівців.
        </Text>

        <Group className={classes.actions}>
          <Button
            className={classes.primaryAction}
            onClick={() => handleRoleSelect("STUDENT")}
          >
            <span>Я студент</span>
            <small>(кандидат)</small>
          </Button>
          <Button
            className={classes.secondaryAction}
            onClick={() => handleRoleSelect("HR")}
          >
            <span>Я роботодавець</span>
            <small>(HR / представник компанії)</small>
          </Button>
        </Group>
      </div>
    </section>
  );
}
