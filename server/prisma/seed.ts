import "dotenv/config";
import { PrismaClient, SkillCategory } from "./generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// ==========================================
// ДАНІ: ГЕОГРАФІЯ
// ==========================================
const regions = [
  { name: "Вінницька область", cities: ["Вінниця", "Жмеринка"] },
  { name: "Волинська область", cities: ["Луцьк", "Ковель"] },
  {
    name: "Дніпропетровська область",
    cities: ["Дніпро", "Кривий Ріг", "Кам'янське", "Павлоград"],
  },
  { name: "Житомирська область", cities: ["Житомир", "Бердичів"] },
  { name: "Закарпатська область", cities: ["Ужгород", "Мукачево"] },
  { name: "Запорізька область", cities: ["Запоріжжя"] },
  { name: "Івано-Франківська область", cities: ["Івано-Франківськ", "Калуш"] },
  {
    name: "Київська область",
    cities: ["Київ", "Біла Церква", "Бровари", "Ірпінь", "Бориспіль"],
  },
  { name: "Кіровоградська область", cities: ["Кропивницький", "Олександрія"] },
  { name: "Львівська область", cities: ["Львів", "Дрогобич", "Стрий"] },
  { name: "Миколаївська область", cities: ["Миколаїв"] },
  { name: "Одеська область", cities: ["Одеса", "Ізмаїл", "Чорноморськ"] },
  { name: "Полтавська область", cities: ["Полтава", "Кременчук", "Миргород"] },
  { name: "Рівненська область", cities: ["Рівне", "Дубно"] },
  { name: "Сумська область", cities: ["Суми", "Конотоп"] },
  { name: "Тернопільська область", cities: ["Тернопіль", "Чортків"] },
  { name: "Харківська область", cities: ["Харків", "Лозова"] },
  { name: "Херсонська область", cities: ["Херсон"] },
  {
    name: "Хмельницька область",
    cities: ["Хмельницький", "Кам'янець-Подільський"],
  },
  { name: "Черкаська область", cities: ["Черкаси", "Умань", "Сміла"] },
  { name: "Чернівецька область", cities: ["Чернівці"] },
  { name: "Чернігівська область", cities: ["Чернігів", "Ніжин"] },
];

// ==========================================
// ДАНІ: УНІВЕРСИТЕТИ (Формат: Абревіатура - Повна назва)
// ==========================================
const universities = [
  "КПІ — Національний технічний університет України «Київський політехнічний інститут імені Ігоря Сікорського»",
  "КНУ — Київський національний університет імені Тараса Шевченка",
  "НаУКМА — Національний університет «Києво-Могилянська академія»",
  "НУЛП — Національний університет «Львівська політехніка»",
  "ЛНУ — Львівський національний університет імені Івана Франка",
  "КАІ — Державний університет «Київський авіаційний інститут»",
  "ХНУРЕ — Харківський національний університет радіоелектроніки",
  "НТУ ХПІ — Національний технічний університет «Харківський політехнічний інститут»",
  "ХНУ — Харківський національний університет імені В. Н. Каразіна",
  "СумДУ — Сумський державний університет",
  "УКУ — Український католицький університет",
  "НТУ ДП — Національний технічний університет «Дніпровська політехніка»",
  "ДНУ — Дніпровський національний університет імені Олеся Гончара",
  "ОНПУ — Національний університет «Одеська політехніка»",
  "ОНУ — Одеський національний університет імені І. І. Мечникова",
  "ЛНТУ — Луцький національний технічний університет",
  "ЧНУ — Чернівецький національний університет імені Юрія Федьковича",
  "ВНТУ — Вінницький національний технічний університет",
  "ТНТУ — Тернопільський національний технічний університет імені Івана Пулюя",
  "УжНУ — Ужгородський національний університет",
  "НУБіП — Національний університет біоресурсів і природокористування України",
  "ДТЕУ — Державний торговельно-економічний університет",
  "ДУІТЗ — Державний університет інтелектуальних технологій і зв'язку",
  "ІФНТУНГ — Івано-Франківський національний технічний університет нафти і газу",
  "ЧДТУ — Черкаський державний технологічний університет",
  "НЛТУ — Національний лісотехнічний університет України",
  "НТУ — Національний транспортний університет",
  "ХАІ — Національний аерокосмічний університет імені М. Є. Жуковського",
  "ОНТУ — Одеський національний технологічний університет",
  "КНЕУ — Київський національний економічний університет імені Вадима Гетьмана",
];

// ==========================================
// ДАНІ: ІТ-СФЕРИ ТА ПРОФЕСІЇ
// ==========================================
const spheres = [
  "E-commerce / Електронна комерція",
  "FinTech",
  "EdTech",
  "HealthTech / MedTech",
  "GameDev",
  "Кібербезпека",
  "Cloud Solutions / SaaS",
  "AI / ML",
  "Data Science / Аналітика",
  "Blockchain / Web3",
  "ERP / CRM Системи",
  "Маркетинг / AdTech",
  "Телекомунікації",
  "Роздрібна торгівля / Retail",
  "Логістика / Supply Chain",
  "Агросектор / AgriTech",
  "Виробництво / Manufacturing",
  "Туризм / TravelTech",
];

const professions = [
  "Frontend-розробник",
  "Backend-розробник",
  "Fullstack-розробник",
  "Мобільний розробник",
  "Інженер з автоматизації тестування",
  "Інженер з ручного тестування",
  "DevOps-інженер",
  "Data-інженер",
  "Data-аналітик",
  "UI/UX-дизайнер",
  "Менеджер продукту",
  "Менеджер проєктів",
  "Бізнес-аналітик",
  "Системний адміністратор",
  "Фахівець з кібербезпеки",
  "SEO-спеціаліст",
  "Технічний письменник",
  "Розробник ігор",
  "ERP-розробник",
  "HR-менеджер / Рекрутер",
];

// ==========================================
// ДАНІ: УМОВИ РОБОТИ ТА МОВИ
// ==========================================
const employmentTypes = [
  "Повна зайнятість",
  "Часткова зайнятість",
  "Проєктна робота",
  "Стажування",
];
const workSchedules = [
  "Фіксований графік",
  "Гнучкий графік",
  "Позмінна робота",
];
const workFormats = ["Віддалена робота", "Робота в офісі", "Гібридний формат"];
const languages = [
  "Українська",
  "Англійська",
  "Німецька",
  "Польська",
  "Французька",
  "Іспанська",
  "Італійська",
  "Чеська",
];

// ==========================================
// ДАНІ: НАВИЧКИ
// ==========================================
const skills = [
  // ---------------- TOOLS (Інструменти) ----------------
  { name: "TypeScript", category: SkillCategory.TOOL },
  { name: "Node.js", category: SkillCategory.TOOL },
  { name: "React", category: SkillCategory.TOOL },
  { name: "Next.js", category: SkillCategory.TOOL },
  { name: "Vue.js", category: SkillCategory.TOOL },
  { name: "Angular", category: SkillCategory.TOOL },
  { name: "Docker", category: SkillCategory.TOOL },
  { name: "Kubernetes", category: SkillCategory.TOOL },
  { name: "Git", category: SkillCategory.TOOL },
  { name: "GitHub", category: SkillCategory.TOOL },
  { name: "GitLab", category: SkillCategory.TOOL },
  { name: "Figma", category: SkillCategory.TOOL },
  { name: "Jira", category: SkillCategory.TOOL },
  { name: "Postman", category: SkillCategory.TOOL },
  { name: "Swagger", category: SkillCategory.TOOL },
  { name: "AWS", category: SkillCategory.TOOL },
  { name: "PostgreSQL", category: SkillCategory.TOOL },
  { name: "MongoDB", category: SkillCategory.TOOL },
  { name: "MySQL", category: SkillCategory.TOOL },
  { name: "Redis", category: SkillCategory.TOOL },
  { name: "Vite", category: SkillCategory.TOOL },
  { name: "Webpack", category: SkillCategory.TOOL },
  { name: "Tailwind CSS", category: SkillCategory.TOOL },
  { name: "Sass", category: SkillCategory.TOOL },

  // ---------------- HARD SKILLS (Технічні навички) ----------------
  { name: "JavaScript", category: SkillCategory.HARD_SKILL },
  { name: "Python", category: SkillCategory.HARD_SKILL },
  { name: "Java", category: SkillCategory.HARD_SKILL },
  { name: "C#", category: SkillCategory.HARD_SKILL },
  { name: "C++", category: SkillCategory.HARD_SKILL },
  { name: "PHP", category: SkillCategory.HARD_SKILL },
  { name: "Go", category: SkillCategory.HARD_SKILL },
  { name: "Ruby", category: SkillCategory.HARD_SKILL },
  { name: "HTML5", category: SkillCategory.HARD_SKILL },
  { name: "CSS3", category: SkillCategory.HARD_SKILL },
  { name: "SQL", category: SkillCategory.HARD_SKILL },
  { name: "NoSQL", category: SkillCategory.HARD_SKILL },
  { name: "REST API", category: SkillCategory.HARD_SKILL },
  { name: "GraphQL", category: SkillCategory.HARD_SKILL },
  { name: "CI/CD", category: SkillCategory.HARD_SKILL },
  { name: "Unit-тестування", category: SkillCategory.HARD_SKILL },
  { name: "E2E-тестування", category: SkillCategory.HARD_SKILL },
  { name: "Алгоритми та структури даних", category: SkillCategory.HARD_SKILL },
  { name: "ООП", category: SkillCategory.HARD_SKILL },
  { name: "SOLID", category: SkillCategory.HARD_SKILL },
  { name: "Системне проєктування", category: SkillCategory.HARD_SKILL },
  { name: "Бізнес-аналіз", category: SkillCategory.HARD_SKILL },
  { name: "Моделювання даних", category: SkillCategory.HARD_SKILL },
  { name: "Адміністрування БД", category: SkillCategory.HARD_SKILL },

  // ---------------- SOFT SKILLS (Гнучкі навички) ----------------
  { name: "Комунікабельність", category: SkillCategory.SOFT_SKILL },
  { name: "Робота в команді", category: SkillCategory.SOFT_SKILL },
  { name: "Критичне мислення", category: SkillCategory.SOFT_SKILL },
  { name: "Тайм-менеджмент", category: SkillCategory.SOFT_SKILL },
  { name: "Вирішення проблем", category: SkillCategory.SOFT_SKILL },
  { name: "Адаптивність", category: SkillCategory.SOFT_SKILL },
  { name: "Стресостійкість", category: SkillCategory.SOFT_SKILL },
  { name: "Лідерство", category: SkillCategory.SOFT_SKILL },
  { name: "Проактивність", category: SkillCategory.SOFT_SKILL },
  { name: "Системне мислення", category: SkillCategory.SOFT_SKILL },
  { name: "Навички презентації", category: SkillCategory.SOFT_SKILL },
  { name: "Уважність до деталей", category: SkillCategory.SOFT_SKILL },
  { name: "Клієнтоорієнтованість", category: SkillCategory.SOFT_SKILL },
  { name: "Креативність", category: SkillCategory.SOFT_SKILL },
  { name: "Гнучкість", category: SkillCategory.SOFT_SKILL },
  { name: "Здатність до навчання", category: SkillCategory.SOFT_SKILL },
  { name: "Аналітичне мислення", category: SkillCategory.SOFT_SKILL },
  { name: "Ініціативність", category: SkillCategory.SOFT_SKILL },
  { name: "Відповідальність", category: SkillCategory.SOFT_SKILL },
];

// ==========================================
// ЛОГІКА НАПОВНЕННЯ (SEEDING FUNCTIONS)
// ==========================================

async function seedDictionaries() {
  console.log("📍 Наповнення географії...");
  const country = await prisma.country.upsert({
    where: { name: "Україна" },
    update: {},
    create: { name: "Україна" },
  });

  for (const regionData of regions) {
    const region = await prisma.region.upsert({
      where: {
        name_countryId: { name: regionData.name, countryId: country.id },
      },
      update: {},
      create: { name: regionData.name, countryId: country.id },
    });

    for (const cityName of regionData.cities) {
      const city = await prisma.city.upsert({
        where: { name_regionId: { name: cityName, regionId: region.id } },
        update: {},
        create: { name: cityName, regionId: region.id },
      });

      await prisma.location.upsert({
        where: {
          countryId_regionId_cityId: {
            countryId: country.id,
            regionId: region.id,
            cityId: city.id,
          },
        },
        update: {},
        create: { countryId: country.id, regionId: region.id, cityId: city.id },
      });
    }
  }

  console.log("📍 Наповнення університетів...");
  for (const name of universities) {
    await prisma.university.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("📍 Наповнення професій та сфер...");
  for (const name of spheres) {
    await prisma.sphere.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  for (const name of professions) {
    await prisma.profession.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("📍 Наповнення навичок...");
  for (const skill of skills) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: { category: skill.category },
      create: skill,
    });
  }

  console.log("📍 Наповнення мов та форматів...");
  for (const name of languages) {
    await prisma.language.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  for (const name of employmentTypes) {
    await prisma.employmentType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  for (const name of workSchedules) {
    await prisma.workSchedule.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  for (const name of workFormats) {
    await prisma.workFormat.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

// ==========================================
// ГОЛОВНА ФУНКЦІЯ (RUNNER)
// ==========================================
async function main() {
  console.log("🚀 Запуск ініціалізації довідників...");
  try {
    await seedDictionaries();
    console.log("🎉 Всі довідники успішно заповнені!");
  } catch (error) {
    console.error("❌ Помилка під час виконання seed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
