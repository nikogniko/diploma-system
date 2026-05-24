import { Client } from "@elastic/elasticsearch";

const enabledValues = new Set(["true", "1", "yes", "on"]);

export const isElasticsearchEnabled = () =>
  enabledValues.has((process.env.ELASTICSEARCH_ENABLED ?? "").toLowerCase());

export const elasticsearchUrl = () =>
  process.env.ELASTICSEARCH_URL?.trim() || "http://localhost:9200";

export const searchIndexPrefix = () =>
  process.env.ELASTICSEARCH_INDEX_PREFIX?.trim() || "diploma";

export const vacanciesIndexName = () => `${searchIndexPrefix()}_vacancies`;

let cachedClient: Client | null = null;

export const getElasticsearchClient = () => {
  cachedClient ??= new Client({ node: elasticsearchUrl() });
  return cachedClient;
};

export const isElasticsearchAvailable = async () => {
  if (!isElasticsearchEnabled()) return false;

  try {
    await getElasticsearchClient().ping();
    return true;
  } catch (error) {
    console.warn("Elasticsearch is unavailable, falling back to Prisma search.", error);
    return false;
  }
};
