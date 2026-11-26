> **Исторический документ.** Заменён `docs/PLAN.md` (объединённый SDK: Transport + Office, нормализация спеки, свой транспорт). Оставлен для истории решений; не исполнять.

# План: полный Transport API в `iiko-cloud-sdk`

Статус: утверждён. Фаза 0 выполняется.
Связанные документы: `SPECS.md` (требования), `docs/IMPLEMENTATION.md` (фазы v1.0.0, будут переписаны по этому плану), `GLOSSARY.md` (термины).

## 1. Решения

| Вопрос | Решение |
|---|---|
| Охват первого релиза | Полный Transport API: 126 активных POST-операций. Office API не входит |
| Имя пакета | `iiko-cloud-sdk`. Свободно на npm (проверено 23.11) |
| Версия первого релиза | `0.1.0` (публичная тестовая версия, имена можно менять до `1.0.0`) |
| Репозиторий | `https://github.com/tonytkachenko/iiko-cloud-sdk`, remote `origin`. Сейчас приватный и пустой |
| Публикация | Публичная, npm, MIT. GitHub Actions по тегу `v*` |
| Повторы | Ни для одного POST. Читающие POST тоже не повторяются |
| Публичный `raw` | Нет. Сырой слой не экспортируется |
| Что генерируется | Публичные доменные модули `src/transport/generated/<domain>.ts` целиком: имена, JSDoc, типы |
| Что пишется руками | `src/transport/helpers.ts` (логика поверх операций) и runtime-ядро (auth, http, errors, logger, config) |
| Конкуренты | `@salesduck/iiko-cloud-api` (MIT, 2023): только описания методов и типов, без клиента и актуальной спеки. Наше отличие — runtime и актуальная спека |

## 2. Правила для исполнителя

- Не редактировать руками `src/generated/**` и `src/transport/generated/**`. Они создаются генератором.
- Новые методы появляются только через `scripts/generate/transport-names.json` и проходят ревью.
- Одна фаза = один коммит (или несколько коммитов в одной ветке). Фаза не закрыта, пока её проверки не зелёные.
- Не публиковать пакет до фазы 7 и явного подтверждения владельца. Не запускать `live:check` с реальными ключами без разрешения.
- Публичный API — контракт с первого публичного релиза. Переименование метода после публикации — breaking change.
- Полная проверка на каждом шаге: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.

## 3. Известные проблемы текущего кода

- `src/resources/organizations.ts`: `list()` вызывает `GET /api/1/organizations`, помеченный в спеке **deprecated**. Заменить на `POST /api/1/organizations`.
- `src/resources/menu.ts`: `getExternalMenu()` вызывает `POST /api/2/menu/by_id`, тоже **deprecated**. Заменить на `POST /api/menu/v3/by_id`.
- `src/resources/terminals.ts`: `POST /api/1/terminal_groups` актуален. Переезжает в `terminalGroups.list`.
- `organizations.getById(id)` — не отдельная операция, а `POST /api/1/organizations` с одним id. Сохранить хелпером.
- `src/http.ts`: `as T` для пустого 200 (`/api/1/deliveries/update_tracking_link`). Исправить через `void` в фазе 3.
- `src/operation.ts`: `as never` в общем вызове. Убрать или оставить один задокументированный каст.
- `scripts/generate/operations.mjs`: всегда вызывает `post(...)`, не проверяет метод операции.
- Черновик `raw` (`src/client.ts`, `src/operation.ts`, `src/generated/operations/**`) противоречит решению «без публичного raw» и удаляется в фазе 0.
- `examples/delivery-order.ts`: каст `productItem`, потому что `ProductOrderItem` задан через `allOf` без `discriminator`.
- `src/generated/openapi.json` в рабочем дереве уже обновлён до `iikoTransport` 9.9.4.2 (1095 схем), совпадает с живой спекой. Нужно зафиксировать в фазе 1.

## 4. Фазы

### Фаза 0. Базовый срез рабочего дерева

Цель: отделить готовую работу от черновика, получить дерево, где все проверки зелёные.

1. Удалить черновик `raw`: вернуть `src/client.ts` к HEAD, удалить `src/operation.ts` и `src/generated/operations/`.
2. Откатить постороннее: `openapi-fetch` с точного пина на `^0.17.0` (вместе с `pnpm-lock.yaml`), косметическое переформатирование `CallResult` в `src/http.ts`.
3. Сохранить полезное: union-тип `IikoResult` в `src/http.ts`, экспорт `IikoResult` в `src/index.ts`, тест сужения в `tests/client.test.ts`, переименование пакета в `examples/basic.ts` и `tsconfig.json`.
4. Черновые `examples/backoffice.ts` и `examples/delivery-order.ts` (зависят от `raw`) убрать из дерева, содержимое сохранить вне репозитория до фазы 6.
5. `scripts/generate/` остаётся как вход для фазы 2.
6. `GLOSSARY.md` добавить в репозиторий.
7. Проверить: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`.
8. Коммиты: `docs: add glossary and executable plan`, `refactor: drop the raw draft and keep the narrowed result`.

Готово, когда: проверки зелёные, `git status` не содержит отслеживаемого мусора.

### Фаза 1. Зафиксировать спеку 9.9.4

1. `git checkout -b chore/sync-spec-9.9.4`
2. `pnpm iiko:sync` — подтвердить, что пересборка из живой спеки не меняет файлы (локальная копия уже 9.9.4.2).
3. `pnpm typecheck`, `pnpm test`. Поправить `src/resources/*` под новые схемы без изменения поведения.
4. Обновить факты в `docs/IMPLEMENTATION.md`: версия модели 9.9.4.2, 1095 схем, 418 путей, дата проверки.
5. Коммит: `chore(spec): sync iiko OpenAPI to iikoTransport 9.9.4`.

Готово, когда: typecheck и test зелёные, diff схем описан в PR.

### Фаза 2. Таблица имён и генератор

Файлы: `scripts/generate/transport-names.json` (единый источник), `scripts/generate/operations.mjs`, `package.json`.

Один файл вместо двух таблиц:
```json
{
  "domains": {
    "organizations": ["/api/1/organizations"],
    "deliveries": ["/api/1/deliveries"]
  },
  "operations": {
    "/api/1/deliveries/by_id": { "domain": "deliveries", "name": "byId" }
  },
  "skip": {
    "/api/2/menu/by_id": "deprecated",
    "/api/nomenclature/v1": "office: out of scope"
  }
}
```

1. Режим `node scripts/generate/operations.mjs --inventory` печатает 126 активных Transport POST-операций и **черновую** таблицу имён по эвристике (хвост пути в camelCase). Человек проходит по черновику и правит имена. Артефакт не коммитится.
2. Генератор пишет `src/transport/generated/<domain>.ts`, по файлу на домен. JSDoc: `summary` первой строкой, `Restriction group` из `description` отдельной строкой.
3. Генератор падает с кодом 1, если:
   - активная Transport-операция не POST;
   - у неё нет записи в `operations` и нет причины в `skip`;
   - внутри домена два метода с одним именем;
   - запись указывает на путь, которого нет в спеке.
4. Скрипты: `"iiko:operations": "node scripts/generate/operations.mjs"`, вызывается из `iiko:sync` после `iiko:types`.
5. Замерить `dist/**/*.d.ts` и время `tsc --noEmit` в тестовом проекте-потребителе. Если типы тяжелее ~3 МБ или проверка дольше ~5 с — обсудить вынос именованных алиасов по домену.

Готово, когда: `pnpm iiko:sync` меняет только ожидаемые файлы, повторный запуск даёт пустой diff, генератор выдаёт ровно 126 методов, удаление записи из таблицы приводит к падению.

### Фаза 3. Типы

1. Пустой 200 (`update_tracking_link`): `void` в `SuccessBody`, убрать `as T` в `src/http.ts`.
2. `as never` в `src/operation.ts`: убрать, если openapi-fetch позволяет. Иначе один каст с комментарием `shortcut: <причина>, <когда убрать>`.
3. Подтипы `allOf` (`ProductOrderItem`, `CompoundOrderItem`, `ServiceOrderItem`): генератор экспортирует их типы из схем, кастов в примерах нет.
4. Удалить `CallOptions.headers`, если фасаду он не нужен.

Готово, когда: в `examples/` нет `as` для позиций заказа; `tests/types.test.ts` проверяет, что `ProductOrderItem` требует `productId` и `price`.

### Фаза 4. Runtime и хелперы

1. `src/http.ts`: убрать `x-iiko-retry`. Повторы только для GET, PUT, DELETE (в Transport таких нет, логика остаётся). POST не повторяется никогда.
2. `src/transport/helpers.ts` (руками):
   - `organizations.getById(id)`: `POST /api/1/organizations`, первый элемент или `undefined`.
   - `commands.waitFor(correlationId, opts)` — только если ревью признает нужным. По умолчанию нет.
3. `src/client.ts`: `IikoClient` = `{ transport }`. Старые `organizations`, `terminals`, `menu`, `raw` удалить.
4. `src/index.ts`: `createIikoClient`, `IikoClient`, `IikoClientOptions`, ошибки, `ILogger`, `IikoResult`, `JsonBody`, `SuccessBody`, `CallOptions` и типы из `src/transport/generated/types.ts`. Сгенерированные доменные модули не экспортируются.

Готово, когда: typecheck зелёный, `iiko.transport` содержит 126 методов, `src/index.ts` не экспортирует сгенерированное.

### Фаза 5. Тесты

1. `tests/transport-coverage.test.ts`: подставить заглушку `HttpClient` с записывающим `request()` и для каждой записи таблицы проверить `{method, endpoint, requestBody}`. Валидные тела не нужны.
2. Один тест на домен через fake fetch: `Authorization`, сериализация тела, разбор ответа.
3. `tests/api-surface.test.ts`: дерево `iiko.transport` против снимка `tests/__snapshots__/api-surface.snap`. Обновление только `vitest -u` с отметкой в PR.
4. Переписать `auth`, `retry`, `errors`, `client` на `iiko.transport.*`. Логику не менять.
5. `tests/retry.test.ts`: GET/PUT/DELETE повторяются, POST не повторяется.
6. `scripts/live-check.mjs`: read-only по одному методу на домен, только вручную.
7. `vitest.config.ts`: исключить `src/transport/generated/**` из покрытия. Порог 85% сохраняется для ручного кода.

Готово, когда: тесты зелёные, снимок зафиксирован, live-check пройден владельцем.

### Фаза 6. Документы и релиз

1. `SPECS.md`: §1, §4.1, §4.6, §5, §11, §12, §13 переписать под `iiko-cloud-sdk`, полный Transport и генерацию модулей.
2. `docs/adr/0001-transport-coverage.md`: полный Transport, генерация публичных модулей, отказ от `raw`, отказ от повторов POST.
3. `README.md`: дисклеймер первым абзацем, установка `pnpm add iiko-cloud-sdk`, быстрый старт, ошибки, переменные окружения, обновление спеки, **ESM-only и Node >=22.12**.
4. Примеры `basic`, `backoffice`, `delivery-order` на `iiko.transport.*`, без каста `productItem`.
5. `grep -r "@toniq" .` вне `CHANGELOG.md` даёт 0 совпадений.
6. Changeset `minor` → `0.1.0`.
7. CI:
   - в PR: регенерация из закоммиченного `openapi.json`, `git diff --exit-code src/generated src/transport/generated` — детерминированно;
   - ночью по расписанию: скачать upstream и при расхождении открыть issue. PR от этого не краснеет.

Готово, когда: README-пример проходит вручную, `pnpm build` даёт `dist/`, changeset создан.

### Фаза 7. Публикация на npm

Только после фаз 1–6 и подтверждения владельца.

**7.1. `package.json`:**
- `version`: `0.1.0`.
- `repository`: `git+https://github.com/tonytkachenko/iiko-cloud-sdk.git`; `bugs`: `.../issues`; `homepage`: `.../readme`.
- `author`: `Tony Tkachenko`, `license`: `MIT`, `keywords`: `iiko`, `iikocloud`, `restaurant`, `pos`, `sdk`, `typescript`.
- `types`: `./dist/index.d.ts` рядом с `exports`.
- `files`: `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`.
- `publishConfig`: `access: public`, `provenance: true` только при публичном репозитории.
- `engines.node`: `>=22.12`.

**7.2. Проверки до публикации:**
- `npm pack --dry-run`: только `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json`.
- Установка архива в чистый проект, импорт ESM.
- `npm audit --audit-level=high` чистый.

**7.3. Первая публикация `0.1.0` — один путь:**
1. Workflow `.github/workflows/publish.yml`: тег `v*` → install, lint, typecheck, test, build, сверка версии с тегом, `npm publish --provenance` (если публичный репозиторий).
2. Первый релиз — с `NPM_TOKEN` в секретах GitHub (доверенный публикатор настраивается только для существующего пакета).
3. После появления пакета: настроить trusted publishing (OIDC) на npmjs.com для репозитория и workflow. Следующие теги — без токена, с `id-token: write`.
4. Один номер версии публикуется ровно один раз. `0.1.0` не публикуется дважды.

**7.4. Публичный доступ:** перевести репозиторий в публичный до релиза (нужен для провенанса, `repository`/`bugs` и пользователей пакета). Решение владельца.

## 5. Риски

- Спека меняется в минорных версиях (9.9.3 → 9.9.4 изменил 25 схем). Фаза 1 повторяется, ночная проверка upstream обязательна.
- Имена из таблицы, не из URL. Переименование пути в iiko ломает генератор, решение принимает человек.
- Формат ошибок Transport: `correlationId` и код `error`. Фасад не должен это упрощать.
- Без повторов POST при сбоях чтения вызывающий код сам решает, повторять ли.
- Один каст в `operation.ts`, если его не удалось убрать; он задокументирован.
- `allOf` без `discriminator`: тип подтипа берётся из схемы явно.
- Тяжёлые типы: `schema.d.ts` на 1095 схем попадает в тип-граф потребителя. Замер в фазе 2, решение по алиасам — по результату.

## 6. Что не входит в первый релиз

- Office API (`/api/nomenclature`, `/api/inventory`, `/api/finance` и остальные).
- Публичный `raw`.
- Повторы POST.
- iikoServer, iikoFront, iikoCard, вебхуки на стороне SDK.
- Кэширование меню и бизнес-данных.

## 7. Решения владельца и открытые вопросы

Решено:
1. Версия: `0.1.0`.
2. Репозиторий: `tonytkachenko/iiko-cloud-sdk`.
3. Имя пакета: `iiko-cloud-sdk`.
4. Публикация: GitHub Actions по тегу `v*`.
5. npm-аккаунт есть, двухфакторка включена.

Открыто:
1. **Видимость репозитория:** перевести в публичный до релиза (рекомендация) или оставить приватным и без провенанса?
2. **Аутентификация:** `NPM_TOKEN` для `0.1.0` (рекомендация), затем trusted publishing.
