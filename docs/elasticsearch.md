# Elasticsearch

## Environment

Server `.env`:

```env
ELASTICSEARCH_ENABLED=true
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX_PREFIX=diploma
```

Vacancy index name is `${ELASTICSEARCH_INDEX_PREFIX}_vacancies`, so the local default is `diploma_vacancies`.

## Health

```bash
curl http://localhost:9200/_cluster/health?pretty
```

Security is disabled locally, so username/password are not required.

## Indexes

```bash
curl http://localhost:9200/_cat/indices?v
curl http://localhost:9200/diploma_vacancies/_mapping?pretty
```

## Ensure Indexes

```bash
cd server
npm run search:ensure-indexes
```

This creates `diploma_vacancies` if it does not already exist.

## Reindex Vacancies

```bash
cd server
npm run search:reindex:vacancies
```

The script reads vacancies from PostgreSQL through Prisma, denormalizes related names and ids into Elasticsearch documents, then bulk indexes them.

## Check Vacancy Documents

```bash
curl "http://localhost:9200/diploma_vacancies/_search?pretty&size=5"
curl "http://localhost:9200/diploma_vacancies/_count?pretty"
```

Example text search through the backend:

```bash
curl "http://localhost:5000/api/vacancies/search?search=React&page=1&pageSize=10"
```

The `search` value is free text. The backend accepts terms separated with spaces, commas, plus signs or semicolons, removes duplicates and common linking words, then builds an OR-style relevance query.

## Thunder Client Requests

Create `GET` requests in Thunder Client against the backend:

```text
http://localhost:5000/api/vacancies/search?page=1&pageSize=10
http://localhost:5000/api/vacancies/search?search=React&page=1&pageSize=10
http://localhost:5000/api/vacancies/search?search=розробник%20React%20trainee%20робота%20в%20команді&page=1&pageSize=10
http://localhost:5000/api/vacancies/search?search=React%2BNode.js%3BSQL&page=1&pageSize=10
http://localhost:5000/api/vacancies/search?professionIds=3&sphereIds=10&minSalary=30000&page=1&pageSize=10
http://localhost:5000/api/vacancies/search?languageId=2&minLanguageLevel=B1&workFormatIds=2&employmentTypeIds=1&workScheduleIds=1&page=1&pageSize=10
```

Responses expose application vacancies loaded from Prisma after Elasticsearch selects matching vacancy ids. Use the Elasticsearch document requests above when you need to inspect raw indexed documents directly.

Elasticsearch `_score` is used only as the first relevance signal for text search. It is not the final student-vacancy Match Score.
