# План: объединённый SDK `iiko-cloud-sdk`

Статус: принят. Фаза 0 выполняется.
Заменяет `docs/TRANSPORT-PLAN.md` (Transport-only на `openapi-fetch`). Тот документ остаётся историческим.
Основание: сравнение с проектом `/Users/tony/Projects/iiko-sdk 3` (360 операций, нормализация спеки, union-типы, ретрай 429, тесты на каждую операцию).

## 1. Целевая форма

```ts
import { createIikoClient, IikoRateLimitError } from "iiko-cloud-sdk";

const iiko = createIikoClient({ appId, clientSecret, apiKey });

// Transport
const { organizations } = await iiko.transport.organizations.list();
const { correlationId } = await iiko.transport.deliveries.create({
  organizationId,
  terminalGroupId,
  order,
});
const status = await iiko.transport.commands.wait({ organizationId, correlationId });

// Office
const products = await iiko.office.nomenclature.productList({ organizationId, limit: 100 });
const balance = await iiko.office.inventory.stockBalance.list({ organizationId, storeIds });

// Escape hatch: deprecated и только что добавленные операции по пути
await iiko.call("/api/1/deliveries/update_order_payments", body);
```

Ошибки бросаются типизированными классами. Все ответы типизированы. Ноль рантайм-зависимостей.

## 2. Решения

| № | Решение | Обоснование |
|---|---|---|
| D1 | Полное покрытие: 360 активных операций (Transport + Office) | Второй проект доказал, что генератор это тянет; Office — основная ценность для бэк-офиса |
| D2 | Разделение `iiko.transport.*` и `iiko.office.*` | Коллизии имён (`organizations` в обоих), разные форматы ошибок, глоссарий |
| D3 | Бросать типизированные ошибки вместо `{data, error}` | Идиоматично для публичного SDK; ошибка остаётся типизированной через `instanceof` |
| D4 | Свой транспорт на `fetch`, выкинуть `openapi-fetch` | Нужны `Timeout`, ретраи и `onAttempt`; зависимость перестаёт что-либо давать |
| D5 | Ретрай только 429, для всех методов; 5xx, сеть и таймауты не ретраить | Лимитер отклоняет до выполнения; повтор записи безопасен только для 429 |
| D6 | Нормализация спеки + union-ы; именованные типы на операцию; никаких плоских алиасов схем | Закрывает `Order.items`; имена публичных типов не зависят от соседних схем |
| D7 | Deprecated: обёрток нет, доступ через типизированный `call()` | Не теряем операции, но не обещаем стабильность имён |
| D8 | ESM + CJS через `tsup`, Node `>=22.12`, ноль зависимостей | Совместимость без поддержки EOL-нод |
| D9 | Один пакет, не монорепо; имя `iiko-cloud-sdk`, MIT | Монорепо и роли агентов — лишний слой для одной библиотеки |
| D10 | Заголовок `Timeout` + запас 5 с, по умолчанию 15 с | Останавливает работу на сервере, а не только клиент |

## 3. Архитектура

```
spec/raw.json                  спека в git, обновляется вручную или spec:download
spec/normalized.json           генерируется, в git не хранится
scripts/normalize-spec.mjs     патчи дефектов + union-ы, падает на неизвестном
scripts/generate.mjs           схемы -> обёртки + типы + манифест
scripts/names/transport.json   126 курированных имён (переносим)
scripts/names/office.json      правила доменов/подресурсов + точечные правки

src/generated/schema.ts        типы openapi-typescript, в git
src/core/types.ts              Path, RequestOf, ResponseOf, CallOptions
src/core/transport.ts          fetch, auth, ретраи, таймаут, onAttempt
src/core/auth.ts               токен, single-flight, обновление
src/core/errors.ts             8 классов + редакция тел
src/core/dates.ts              toIikoDateUtc / fromIikoDateUtc
src/extensions/commands.ts     commands.wait
src/transport/generated/*.ts   домены Transport
src/office/generated/*.ts      домены и подресурсы Office
src/client.ts                  фабрика
src/index.ts                   публичный экспорт
```

Конвейер: `raw → normalize → schema → generate → client`. Каждый шаг идемпотентен: `pnpm spec:sync` дважды подряд не меняет `git diff`.

## 4. Фазы

### Фаза 0. Заморозка и фиксация

1. Тег `transport-draft-v0.1` на Transport-only версии.
2. Ветка `feat/merged-sdk`.
3. Записать этот план; объявить `docs/TRANSPORT-PLAN.md` историческим.

Готово, когда: решения D1–D10 зафиксированы, текущая работа не потеряна.

### Фаза 1. Спека

1. Перенести `src/generated/openapi.json` → `spec/raw.json`; `normalized.json` в `.gitignore`.
2. Портировать `normalize-spec.mjs`:
   - патчи `uuid`, `float`, `bool`, `int`, `integer <int32>`, `integer <int64>`, `Array of strings <uuid>`;
   - `constant string 'X'` → `enum: ["X"]`; `enum` из example → `enum`;
   - `discriminator.mapping` → `${Base}Union` (`oneOf`), подстановка union во все использования;
   - `allOf: [{$ref: Base}]` (описание на ссылке Swashbuckle) → `oneOf: [{$ref: Union}]`;
   - падение на неизвестном дефекте.
3. Скрипты: `spec:download`, `spec:normalize`, `spec:types`, `spec:generate`, `spec:sync`.
4. Отчёт: пути, union-ы, патчи.

Готово, когда: 14 union-ов, 0 неизвестных дефектов, повторный прогон не меняет файлы.

### Фаза 2. Генератор и имена

1. `src/core/types.ts`: `Path`, `RequestOf`, `ResponseOf` (`void` для пустого 200), `CallArgs`, `CallOptions`.
2. `generate.mjs`: оба сервиса, домены, подресурсы Office, именованные `<Domain><Method>Params/Response`.
3. Проверки генератора (падение):
   - активная операция не POST;
   - операция не размечена и нет правила;
   - дубликат имени метода или типа;
   - запись указывает на исчезнувший путь;
   - deprecated не получает обёртку, но попадает в манифест для `call`.
4. `names/transport.json` — перенести 126 имён.
5. `names/office.json` — правила доменов и подресурсов; инвентарь на ревью.
6. Удалить плоские алиасы схем (`src/types.ts` и генерацию `types.ts`).

Готово, когда: 360 обёрток, 720 типов, генерация детерминирована, проверки срабатывают на подсунутых ошибках.

### Фаза 3. Runtime

1. `transport.ts`: `fetch`, JSON, 401 → повтор один раз, 429 → `Retry-After` (секунды и HTTP-date) или backoff с jitter; 5xx, сеть и таймаут без повторов.
2. `auth.ts`: JWT `exp`, запас 5 минут, fallback TTL 1 час, single-flight; запрос токена идёт через тот же транспорт.
3. `errors.ts`: `IikoError`, `IikoAuthError`, `IikoValidationError`, `IikoRateLimitError`, `IikoServerError`, `IikoNetworkError`, `IikoTimeoutError`, `IikoCommandError`; поля `status`, `code`, `correlationId`, `endpoint`, `retryAfterMs`; тела только после `redact()`.
4. `Timeout`-заголовок, `User-Agent: iiko-cloud-sdk/<version>`, `onAttempt` без тел, логгер с debug и редакцией.
5. Аборт вызывающего пробрасывается как `AbortError`.
6. Удалить `src/http.ts` и `src/operation.ts`.

Готово, когда: тесты на single-flight, запас 5 минут, 401, 429, отсутствие ретраев на 500/сети, таймаут, аборт, UA, `onAttempt`, редакцию.

### Фаза 4. Клиент

1. `createIikoClient` → `{ transport, office, call }`; фабрика, без класса и `Object.assign`.
2. `transport.organizations.getById` и `transport.commands.wait` — ручные хелперы поверх сгенерированных.
3. `call(path, body)` типизирован по всем POST-путям, включая deprecated.
4. `src/index.ts`: клиент, ошибки, `RequestOf`/`ResponseOf`, `CallOptions`, `Transport`, `Office`, типы операций, даты, `CommandStatus`.

Готово, когда: README-пример компилируется без кастов.

### Фаза 5. Тесты

1. Табличный тест каждой из 360 операций: путь, тело, метод.
2. Сверка с `spec/raw.json`: спека обновилась, генерация не запускалась → красный.
3. Снимок публичного API через TypeScript Compiler API: значения и типы.
4. Типовые тесты: `Payment`, `Customer`, `OrderItem`, `CommandStatus`, `void` у `updateTrackingLink`, `call` по неизвестному пути.
5. Ядро: ретраи, таймаут, аборт, auth, ошибки обоих форматов (`errorDescription` и `message`), редакция.
6. `live-check.mjs`: read-only по одному вызову на сервис, вручную.

Готово, когда: всё зелёное, покрытие ручного кода ≥ 85%, снимок закоммичен.

### Фаза 6. Упаковка, CI, релиз

1. `tsup`: ESM + CJS + `.d.ts`/`.d.cts`; `exports` с `import` и `require`.
2. `package.json`: имя, repository, bugs, homepage, author, keywords, `files`, `engines >=22.12`, `publishConfig`.
3. README: установка, оба сервиса, типы, ошибки, ретраи, таймаут, `onAttempt`, даты, `call`, обновление спеки, дисклеймер.
4. `docs/ARCHITECTURE.md` + ADR: 0001 слияние, 0002 политика ретраев, 0003 throw vs result. `SPECS.md`, `IMPLEMENTATION.md`, `TRANSPORT-PLAN.md` → `docs/history/`.
5. CI: PR — детерминированная генерация из закоммиченной спеки; ночью — upstream + issue; тесты; сборка; audit; smoke ESM/CJS.
6. Publish workflow по тегу: первый релиз с `NPM_TOKEN`, затем trusted publishing.

Готово, когда: `npm pack --dry-run` содержит только нужное, установка в чистый проект работает в обоих форматах.

### Фаза 7. Приёмка

1. Замер `dist/**/*.d.ts` и времени `tsc --noEmit` в проекте-потребителе.
2. Живой read-only прогон владельцем.
3. Тег `v0.2.0` (не `0.1.0`: API сменился).

Готово, когда: пакет опубликован, README на npm корректен, пример устанавливается.

## 5. Имена Office

- Домен из префикса: `inventory`, `nomenclature`, `finance`, `employees`, `purchasing`, `reporting`, `terminals`, `platform`, `pricing`, `licenses`.
- Подресурс — первый сегмент после версии:
  `/api/inventory/v1/incoming_invoice/create` → `office.inventory.incomingInvoice.create`.
- Метод — остаток пути; корень подресурса → `list`.
- Версия в имени метода, если путей несколько: `nomenclature.productListV2`.
- `names/office.json` содержит правила подресурсов и исключения; генератор падает на неразмеченном пути.

Так 107 операций inventory не свалятся в один объект, а разойдутся по `stockBalance`, `incomingInvoice`, `internalTransfer` и остальным.

## 6. Критерии приёмки

1. `pnpm spec:sync` дважды подряд не меняет `git diff`.
2. 360 активных операций доступны, deprecated — только через `call`.
3. 14 union-ов; `items` без `productId` не компилируется.
4. `updateTrackingLink` возвращает `void`, а не `never`.
5. 429 ретраится, 500/сеть/таймаут — нет; `Retry-After` в секундах и дате.
6. Заголовки `Timeout` и `User-Agent` уходят; `onAttempt` отдаёт метрики без тел.
7. Секреты не попадают в ошибки и логи (тест).
8. Снимок API закоммичен и проверяется в CI.
9. `pnpm check` и `pnpm build` зелёные; ESM и CJS импортируются.
10. Ноль рантайм-зависимостей; `npm audit` чистый.

## 7. Риски

- 360 имён — большой контракт; снимок и ревью Office-имён обязательны до публикации.
- Нормализация — хирургия спеки; падение на неизвестном дефекте и типовые тесты обязательны.
- Смена throw/result: после публикации — major.
- Тип-граф 2.3 МБ; замер в фазе 7, при необходимости субпатчи `iiko-cloud-sdk/transport` и `/office`.
- 429-политика опирается на семантику лимитера; зафиксировать в ADR.
- Ошибки Office отличаются от Transport; тесты на оба конверта.
- CJS + ESM удваивает артефакты; проверять типы в обоих режимах.

## 8. Что не делаем

- Runtime-валидация (zod/valibot) — позже отдельным слоем.
- Вебхуки, кэширование, GraphQL, браузер.
- Монорепо, роли агентов, копирование процесса второго проекта.
- Плоские алиасы схем.
- Ретраи 5xx, сети и таймаутов.

## 9. Что переносится из текущего кода

| Компонент | Судьба |
|---|---|
| `scripts/names/transport.json` (126 имён) | переносится, добавляется `service` |
| Проверки генератора | переносятся и расширяются |
| `GLOSSARY.md` | остаётся |
| `src/errors.ts`, редакция | переносятся, расширяются `IikoCommandError` |
| `src/logger.ts` | остаётся, дополняется `onAttempt` |
| CI, changesets, LICENSE | остаются, расширяются |
| `src/http.ts`, `src/operation.ts` | заменяются на `src/core/*` |
| `src/transport/generated/*` | перегенерируются |
| `src/types.ts` | удаляется |
| Тесты | портируются на новый API |
| `examples/basic.ts` | переписывается |
| `SPECS.md`, `IMPLEMENTATION.md`, `TRANSPORT-PLAN.md` | в `docs/history/` |
