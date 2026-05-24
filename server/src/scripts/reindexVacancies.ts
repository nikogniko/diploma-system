import "dotenv/config";
import { prisma } from "../config/db.js";
import {
  buildVacancySearchDocument,
  ensureVacanciesIndex,
} from "../search/vacancySearchIndex.js";
import { getElasticsearchClient } from "../search/elasticsearchClient.js";
import { vacancyRepository } from "../repositories/VacancyRepository.js";

/** Rebuilds vacancy search documents from the PostgreSQL source of truth. */
const main = async () => {
  const index = await ensureVacanciesIndex();
  const vacancies = await vacancyRepository.listVacanciesForSearchIndex();
  const client = getElasticsearchClient();

  if (vacancies.length === 0) {
    await client.indices.refresh({ index });
    console.log(`No vacancies to reindex into ${index}.`);
    return;
  }

  const operations = vacancies.flatMap((vacancy) => [
    { index: { _index: index, _id: vacancy.id } },
    buildVacancySearchDocument(vacancy),
  ]);
  const result = await client.bulk({ refresh: true, operations });

  if (result.errors) {
    const failedItems = result.items.filter((item) => item.index?.error);
    console.error("Some vacancy documents failed to index", failedItems.slice(0, 5));
    process.exitCode = 1;
    return;
  }

  console.log(`Reindexed ${vacancies.length} vacancies into ${index}.`);
};

main()
  .catch((error) => {
    console.error("Failed to reindex vacancies", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
