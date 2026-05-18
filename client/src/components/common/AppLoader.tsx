import { Text } from "@mantine/core";
import classes from "./AppLoader.module.scss";

type AppLoaderProps = {
  text?: string;
};

/** Мінімалістичний анімований loader для завантаження сторінок і даних. */
export function AppLoader({ text = "Завантажуємо дані..." }: AppLoaderProps) {
  return (
    <div className={classes.loader}>
      <span className={classes.ring} />
      <Text className={classes.text}>{text}</Text>
    </div>
  );
}
