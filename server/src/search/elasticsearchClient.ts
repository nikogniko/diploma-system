import { Client } from "@elastic/elasticsearch";

const enabledValues = new Set(["true", "1", "yes", "on"]);

/** Reports whether Elasticsearch-backed search is enabled in environment settings. */
export const isElasticsearchEnabled = () =>
  enabledValues.has((process.env.ELASTICSEARCH_ENABLED ?? "").toLowerCase());

/** Returns the configured Elasticsearch node URL. */
export const elasticsearchUrl = () =>
  process.env.ELASTICSEARCH_URL?.trim() || "http://localhost:9200";

/** Returns the prefix applied to application search index names. */
export const searchIndexPrefix = () =>
  process.env.ELASTICSEARCH_INDEX_PREFIX?.trim() || "diploma";

/** Returns the fully-qualified Elasticsearch index name for vacancies. */
export const vacanciesIndexName = () => `${searchIndexPrefix()}_vacancies`;

let cachedClient: Client | null = null;

/** Reuses one Elasticsearch client instance for application search operations. */
export const getElasticsearchClient = () => {
  cachedClient ??= new Client({ node: elasticsearchUrl() });
  return cachedClient;
};

/** Tests whether the configured Elasticsearch node can accept search requests. */
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
