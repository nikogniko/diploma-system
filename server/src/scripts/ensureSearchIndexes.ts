import "dotenv/config";
import { ensureVacanciesIndex } from "../search/vacancySearchIndex.js";

/** Ensures application search indexes required by the backend exist. */
const main = async () => {
  const index = await ensureVacanciesIndex();
  console.log(`Ensured Elasticsearch index: ${index}`);
};

main().catch((error) => {
  console.error("Failed to ensure Elasticsearch indexes", error);
  process.exitCode = 1;
});
