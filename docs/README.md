# Документація проєкту

## Правило підтримки

Після кожної суттєвої зміни в `client/src` або `server/src` потрібно оновлювати відповідний файл документації:

- зміни у frontend описуються в `docs/client-code.md`;
- зміни у backend описуються в `docs/server-code.md`;
- якщо додається новий файл, компонент, сервіс, контролер або repository, він має бути описаний у `docs/client-code.md` або `docs/server-code.md`.

## Поточні файли

- `docs/project-analysis.md` - горизонтальний і вертикальний аналіз архітектури, routing/API та MVP-рекомендації.
- `docs/client-code.md` - опис frontend-коду з `client/src`.
- `docs/server-code.md` - опис backend-коду з `server/src`.
- `docs/elasticsearch.md` - опис Elasticsearch індексу вакансій, searchable fields і search/reindex сценаріїв.
