# BG orders to NIK

The sender uses POST https://nikelectric.com/api/integrations/ibis/orders.
Server-only configuration: `NIK_ORDERS_SEND_ENABLED=true` and `NIK_ORDERS_API_KEY`
(the value configured as `IBIS_ORDERS_BG_KEY` in NIK). No key is committed or sent
to browsers. Existing NIK product sync and Romania guards are independent.

New finalized checkout orders are eligible: manual payment on creation; Revolut
only through the existing verified successful-payment finalization. The sender
also checks the committed successful transaction and its order relationship.
Administrative creation and historical orders are not automatically exported.

Each order keeps a protected `nikOrder` state and immutable request containing
`externalOrderId: BG:<BG order ID>` and aggregated SKU/quantity snapshots. No
customer details, addresses, retail prices, or payment data are sent. The optional
sparse unique `checkoutTransactionId` prevents two concurrent confirmations of
the same payment transaction from creating two differently numbered BG orders.

The first delivery runs through Next.js `after`, after the response/checkout
handler (including its existing inventory work). It is not a cron, permanent
worker or periodic queue. State is stored in MongoDB before scheduling. A process
crash can leave pending/sending work requiring the administrator's retry action;
this implementation does not promise unattended retries after a restart.

An atomic conditional claim permits only one active attempt. A lost response is
`unknown`, never a confirmed refusal; a retry uses the exact saved request and ID.
Interrupted `sending` is retryable after two minutes (HTTP timeout is 90 seconds).
Accepted orders are not re-sent. Replies must match the external ID and acceptance
contract. NIK acceptance is independent of MI export / stock-sync delivery status.

Shortages and invalid group1 prices become `manual_review`, with safe SKU/quantity
details in the admin. The customer order/payment is not cancelled, refunded or
modified. The retry button repeats the original request only. Partially fulfilling
an order after discussion with the customer is a manual business operation; no
automatic line editing, new external ID, refund or partial resubmission is provided.
The admin retry endpoint requires an admin, a reason and the expected attempt ID.
The order retains the latest retry actor/reason/time, not a full audit history.

No local stock reduction, price modification, description change, RO checkout
change, MI call or order email replacement is introduced by the sender.

## Verification

`pnpm exec vitest run tests/int/nik-orders.int.spec.ts` uses mocked persistence/HTTP.
`NIK_ORDER_TEST_DATABASE=local pnpm exec vitest run tests/int/nik-orders-mongo.int.spec.ts`
uses only MongoDB at `127.0.0.1:27029/ibis_nik_sender_test`, and mocked HTTP.
Do not run the general API test suite against the shared production database.

Before enabling in production, verify the sparse unique checkout index is present
and coordinate one explicitly approved real order with NIK. Publishing and enabling
the BG sender are separate from this implementation task.
