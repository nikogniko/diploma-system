import classes from "./Home.module.scss";

export default function Home() {
  return (
    <div className={classes.container}>
      <h1 className={classes.title}>UniJob.ua</h1>
      <p className={classes.subtitle}>
        Інтелектуальна система працевлаштування. Знайди роботу, яка відповідає
        твоїм реальним навичкам.
      </p>
    </div>
  );
}
