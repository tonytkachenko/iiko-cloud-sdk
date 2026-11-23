# iikoCloud SDK — Glossary

The shared language of this project and of the iikoCloud API it wraps. One context: the SDK
and everything it talks to. Terms are grouped by the part of iiko they belong to.

Two services live behind the same host, and mixing up their vocabulary is the most common
source of confusion:

- **Transport API** — `/api/1`, `/api/2`, `/api/menu`, `/api/v2`. iikoTransport: orders,
  delivery, menu, guests, terminals.
- **Office API** — `/api/nomenclature`, `/api/inventory`, `/api/finance`, `/api/employees`,
  `/api/purchasing`, `/api/reporting`, `/api/terminals`, `/api/platform`, `/api/pricing`.
  iikoOffice/iikoChain: catalogue, warehouse, accounting, staff.

They even report errors differently: Transport returns `{correlationId, errorDescription, error}`,
Office returns `{details, message}`. The words below state which service they belong to when
both use them.

## Services and protocol

**Transport API**:
The service for restaurant operations: delivery and table orders, menus, guests, terminals,
couriers, stop lists.
_Avoid_: Front office, POS API

**Office API**:
The service for back-office records: nomenclature, warehouse documents, accounting, staff
records, purchasing, reports.
_Avoid_: Back office (as a code boundary — it is a description, not a namespace), ERP API

**Restriction group**:
The permission a caller must hold to run an operation, stated in the operation's description
(`Restriction group: Orders: creating`). Missing rights surface as rejections, not as a
different endpoint.
_Avoid_: Scope, role

**Command**:
An operation that answers before its effect is complete; poll `commands/status` with the
`correlationId` it returned to learn when it finished. Many Transport API mutations are commands,
including delivery and table order creation.
_Avoid_: Async request, job, task

**Command state**:
The value `commands/status` reports for a command: `Success`, `InProgress`, `Error` or
`Cancelled`.
_Avoid_: Status, result

**Revision**:
A monotonic change counter. Passing it back asks for records changed at or after that point,
which is how both services deliver deltas instead of full lists.
_Avoid_: Version, etag, timestamp

**Correlation id**:
The per-response identifier the Transport API returns; it appears in typed errors and is worth
logging, because it is the handle iiko traces a failed call by. The Office API does not provide it.
_Avoid_: Request id, trace id

**Paged list**:
A list operation that returns `{items, limit, offset, totalCount}` and takes `limit`/`offset`.
Only part of the Office API's `list` operations are paged; the rest take no paging at all.
_Avoid_: Cursor, page number

**Deprecated operation**:
An endpoint iiko still serves but has replaced, such as `POST /api/2/menu/by_id`. The SDK
generates only active operations.
_Avoid_: Legacy, old version

## Tenancy and access

**Organization**:
One restaurant company that an API key can reach; most orders, menus and stops are scoped to it.
_Avoid_: Account, tenant, company

**API key**:
The credential identifying the iiko account and the set of organizations a caller may touch.
_Avoid_: Token (that is the short-lived JWT), app secret

**App credentials**:
`appId` and `clientSecret`, the pair identifying the integrator application itself. They are
sent only to the token endpoint.
_Avoid_: Login, password

**Access token**:
The short-lived JWT issued by `/api/v2/access_token` and sent as `Authorization: Bearer …`; the
SDK caches it in memory and renews it before it expires.
_Avoid_: API key, session

**Terminal group**:
A set of front terminals serving one delivery point or restaurant section; iiko describes it as
the group an order must be sent to. `organizationId` scopes an order, `terminalGroupId` routes it.
_Avoid_: Terminal, point, restaurant

**Terminal**:
A single point-of-sale terminal, listed by `terminals/v1/terminals/list`. It is not a terminal
group, and not the same record as a cash register.
_Avoid_: Terminal group, device

## Catalogue and menu

**Nomenclature**:
The Office API's catalogue of everything a venue can sell or use: products, dishes, modifiers,
services. It is the source the menu is built from.
_Avoid_: Menu, assortment, products

**Product**:
One item in nomenclature, identified by `productId`. A dish is a product with a recipe; a
modifier is a product sold attached to another.
_Avoid_: Item, good

**Modifier**:
A product sold as an addition to another product (size, sauce, topping), described by a modifier
schema.
_Avoid_: Option, extra

**External menu**:
The menu the Transport API serves to ordering clients for one organization and price category,
denormalized so the same `productId` may appear in several item groups with different prices or
images. It is not nomenclature.
_Avoid_: Menu, catalogue

**Price category**:
A named set of prices applied to a menu or an order, selected by `priceCategoryId`.
_Avoid_: Price list (that is an Office API document), tariff

**Assembly chart**:
The recipe of a product — which ingredients and how much — kept as a versioned history per
product.
_Avoid_: Recipe, bill of materials

**Combo**:
A fixed set of products sold together at one price.
_Avoid_: Bundle, set

**Stop list**:
The out-of-stock list for a terminal group: products that cannot be sold right now.
_Avoid_: Out-of-stock, availability

## Orders

**Delivery order**:
A guest order delivered by courier or picked up by the guest, managed through `deliveries/*` in
the Transport API. It is not a warehouse document.
_Avoid_: Order (alone), delivery, shipment

**Table order**:
A guest order placed at a table in the venue, managed through `order/*` in the Transport API.
_Avoid_: Dine-in order, POS order

**Purchase order**:
A supply order sent to a supplier, managed through `purchasing/*` in the Office API. It has
nothing to do with a guest.
_Avoid_: Order (alone), delivery order

**Draft**:
A delivery order that is being assembled and is not yet committed to the front; it can be
locked, edited and committed.
_Avoid_: Template, cart

**Order type**:
The iiko order type a delivery order belongs to (`orderTypeId`), e.g. pickup or courier
delivery. Defined by the venue, listed by `deliveries/order_types`.
_Avoid_: Service type

**Service type**:
How the guest receives the order: `DeliveryByCourier`, `DeliveryByClient` (pickup) or `Common`
(sitting in the venue). Fixed by iiko, unlike the venue-defined order type.
_Avoid_: Order type, delivery type

**Creation status**:
How far the front has got with an order: `Success`, `InProgress`, `Error` or `Cancelled`.
_Avoid_: Order status (that is the kitchen/delivery lifecycle), state

**Delivery point**:
The address and entrance details the courier needs: street, house, flat, floor, entrance, comment.
_Avoid_: Address (taken alone — it is the whole set of address details)

**Courier**:
A delivery driver: a Transport API employee who has a shift and an active location, and can be
assigned to orders.
_Avoid_: Driver, employee (which also covers office staff)

**Cancel cause**, **Removal type**:
Reference lists explaining why an order was cancelled or removed; both are dictionaries the
Transport API exposes and an order references by id.
_Avoid_: Reason, status

**Marketing source**:
The channel an order came from (phone, site, aggregator), used for reporting.
_Avoid_: Channel, source

## Reserves

**Banquet**, **Reserve**:
A booking of tables for a future visit, created through `reserve/*`; it has its own lifecycle and
statuses and can hold order items.
_Avoid_: Booking, reservation (pick one — this glossary uses reserve)

## Guests and loyalty

**Customer**:
A guest known to the loyalty system, identified by phone or card; orders can reference one.
_Avoid_: Client, user, contact

**Loyalty program**:
A ruleset granting bonuses, discounts or categories to customers; the API can calculate a check
against it before the order is paid.
_Avoid_: Loyalty, bonus scheme

**Wallet**:
A customer's stored balance, topped up and charged off through loyalty calls, with `hold` for
temporary reservations of funds.
_Avoid_: Balance, account (that is a finance entity)

**Coupon**:
A single-use code from a coupon series, checked and redeemed against a customer.
_Avoid_: Promo code, voucher

**iikoCard**:
iiko's loyalty platform; the `/loyalty/iiko/*` operations talk to it.
_Avoid_: Loyalty card (that is the physical card), iiko card

## Warehouse

**Store**:
A physical or logical stock location (kitchen, bar, warehouse) that documents move goods between.
_Avoid_: Warehouse, storage location

**Document**:
An Office API record of stock movement: incoming invoice, outgoing invoice, write-off, internal
transfer, production, sales, returned invoice, incoming inventory, disassembly, transformation.
_Avoid_: Order, transaction, operation

**Post**, **Unpost**:
Change a document's status from `NEW` to `PROCESSED` (post) or back (unpost). Only a posted
document affects balances and accounting.
_Avoid_: Approve, confirm, commit

**Stock balance**:
The quantity of a product in a store at a moment, as reported by the warehouse operations.
_Avoid_: Remainder, stock, inventory (alone)

**Counteragent**:
A counterparty a venue trades with — supplier, buyer or contractor — referenced by warehouse and
finance documents.
_Avoid_: Client, customer (those are guests), partner

**Price list**:
An Office API document assigning prices to products for a counteragent or a period. It is not a
price category.
_Avoid_: Price category, tariff

## Finance

**Account**:
A financial account — cash desk, bank account or similar — that postings belong to. Its type
comes from `account-type`; it is not the iiko account an API key belongs to.
_Avoid_: Wallet, organization, ledger (the two differ: see chart of accounts)

**Chart of accounts**:
The full list of financial accounts, listed by `chart-of-accounts/list`.
_Avoid_: Ledger, account list

**Posting**:
A movement recorded on a financial account over a period.
_Avoid_: Transaction (that word is also used for loyalty), entry

**Service act**:
A money document for an incoming or outgoing service, moving through `NEW` → `PROCESSED`, with
`CANCELED` as the other ending.
_Avoid_: Invoice (that is a stock document), payment

**Cash flow category**:
The classification of a money movement (revenue, purchase, salary) used in cash flow reports;
categories form a hierarchy.
_Avoid_: Category (alone), account

**Balance sheet**:
A report of account balances as of a given date.
_Avoid_: Balance, stock balance

## Workforce

**Employee**:
A person on staff. The Transport API exposes couriers and their shifts; the Office API exposes
attendance, schedules and positions.
_Avoid_: User, staff, courier (which is one kind of employee)

**Shift**, **Clock-in**:
An open personal session for an employee at a terminal, started with `clockin` and ended with
`clockout` through the Transport API.
_Avoid_: Attendance (that is the Office API's record of it), session

**Attendance**:
The Office API's record of when an employee worked, edited through `employees/v1/attendance`.
_Avoid_: Shift, timesheet

**Schedule**:
The planned working hours for employees in the Office API; it has its own schedule types.
_Avoid_: Shift, roster

**Position**:
A job title a staff member holds, listed by `employees/v1/positions`.
_Avoid_: Role (that is a permission concept), post

## Reporting and platform

**OLAP**:
The multidimensional report engine of the Office API; a report is requested as a set of columns
plus filters.
_Avoid_: Report (taken alone), analytics

**Income plan**:
Daily planned income values for an organization over a requested period.
_Avoid_: Budget, forecast

**Event**:
An entry in the platform event feed, queried either by period or from a revision onwards — never
both at once.
_Avoid_: Webhook (that is a push subscription), log entry

**Webhook**:
An outbound subscription iiko calls when an order changes or fails. Configured per organization;
the configuration carries an `authToken` the receiver verifies.
_Avoid_: Event, callback
