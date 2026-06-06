---
source_handle: tally-webhooks
fetched: 2026-06-06
source_url: https://tally.so/help/webhooks
source_class: tool-doc
provenance: source-direct
substrate_confidence: source-direct
---

# Tally — Webhooks (form-submission ingestion)

## Paraphrased summary

Tally (a free form builder) can push every form submission to an arbitrary HTTP(S) endpoint in real time via a webhook, as an alternative to polling the API or exporting CSVs. The webhook fires on a new submission, POSTs the response as JSON, and can be cryptographically verified by the receiver. Webhooks are available on the free tier.

## Key passages

- Event/trigger: the event type is **`FORM_RESPONSE`**, triggered by "a new form submission."
- Transport: data is sent via **POST request** in **JSON format**; the payload includes `responseId`, `submissionId`, `respondentId`, `formId`, `createdAt`, and an array of field responses.
- Verification: requests carry a **`Tally-Signature`** header whose value is "a SHA256 cryptographic hash of the webhook payload"; the receiver verifies by computing an **HMAC-SHA256 digest in base64** against a user-configured signing secret.
- Cost: "Webhooks are available **for free** to all Tally users."
- Delivery semantics: endpoints have a **10-second timeout**; on failure the system **retries 5 times** (after 5 min, 30 min, 1 h, 6 h, 1 day); a successful response must return a **2XX** status code.
- Other: custom HTTP headers, multiple webhook URLs per form, pause toggle, and delivery logs.

## Structural metadata

Vendor help-doc page (tool-doc). Describes a stable webhook contract: signed JSON POST on `FORM_RESPONSE`, retry/backoff, HMAC-SHA256 verification. Load-bearing for the "hosted-form → platform ingestion" pattern.

## Substrate-test

Usable by a reader without platform context: it documents Tally's webhook contract on its own terms; no project framing or composed claims beyond the source.
