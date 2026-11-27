---
"iiko-cloud-sdk": patch
---

`reserves.create` and `tableOrders.create` now type `customer` as the documented union of a
`regular` and a `one-time` customer instead of `Omit<RegularCustomer, "type">`. Table order
responses expose `customer.type` again, and the delivery customer, address and payment unions stay
intact.
