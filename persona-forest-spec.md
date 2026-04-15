# Persona — Forest Admin Integration Spec

## Context

This spec covers the implementation of **smart fields** and **smart actions** to integrate [Persona](https://withpersona.com/) into Forest Admin. Persona is a KYC/identity verification and compliance platform. Its data should be surfaced **in context of existing records** (users, companies) in the app DB — not as a standalone datasource.

For Forest Admin implementation patterns (how to declare smart fields and smart actions in code), refer to your `claude.md` file. This document provides the Persona-specific knowledge needed to implement each item correctly.

---

## Persona API — essentials

**Base URL:** `https://withpersona.com/api/v1`

**Authentication:** All requests require a Bearer token in the `Authorization` header:
```
Authorization: Bearer <PERSONA_API_KEY>
Key-Inflection: camel  ← include this header to get camelCase responses
```

**Response format:** JSON:API. Data is under `data.attributes` and relationships under `data.relationships`. When `Key-Inflection: camel` is set, field names are camelCase.

**Rate limiting:** Persona enforces rate limits per API key. Smart fields run on record load — avoid calling multiple Persona endpoints per record; prefer one well-scoped call per field.

**Async reports:** Some Persona resources (reports) are created asynchronously after an inquiry completes. Their status will be `pending` until ready. Handle this gracefully in smart fields (show "pending" rather than erroring).

---

## Persona data model — what matters here

### Account
A persistent identity record for an end-user in Persona. One account can have many inquiries over time. Accounts are looked up by a **reference ID** you pass when creating them — typically your app's user ID or email.

Relevant endpoint: `GET /accounts?filter[reference-id]={your_user_id}`

Key fields:
- `referenceId` — your internal user identifier
- `createdAt`, `updatedAt`
- relationships: `inquiries`, `reports`

### Inquiry
A single KYC attempt. Contains the outcome of an identity verification flow.

Relevant endpoints:
- `GET /inquiries?filter[account-id]={account_id}` — list inquiries for an account
- `GET /inquiries/{inquiry-id}` — retrieve a single inquiry
- `POST /inquiries/{inquiry-id}/approve` — approve (body: `{ "meta": { "reason": "..." } }`)
- `POST /inquiries/{inquiry-id}/decline` — decline (body: `{ "meta": { "reason": "..." } }`)

Key fields:
- `status` — one of: `created`, `pending`, `completed`, `failed`, `expired`, `needs_review`, `approved`, `declined`
- `createdAt`, `completedAt`
- `referenceId` — your internal user identifier (set when inquiry was created)
- relationships: `verifications`, `reports`, `account`

**Status semantics:**
- `needs_review` → requires manual human decision → approve or decline action
- `approved` / `declined` → final human decision recorded
- `completed` → passed all automated checks (may still need review depending on config)
- `failed` → exceeded retry attempts

### Verifications
Individual checks within an inquiry. Each has its own type and status.

Relevant endpoint: `GET /verifications/{verification-id}` (IDs come from inquiry relationships)

Key fields:
- `status` — `passed`, `failed`, `requires_retry`, `submitted`, `initiated`
- `type` — e.g. `verification/government-id`, `verification/selfie`, `verification/phone-number`, `verification/database`
- For government ID verifications: `nameFirst`, `nameLast`, `birthdate`, `addressStreet1`, `countryCode`, `idClass`, `idNumber`

### Reports
Background checks run after an inquiry completes. Asynchronous — always check `status` before reading results.

Relevant endpoint: `GET /reports/{report-id}`

Report types relevant here:
- `report/watchlist` — AML/sanctions screening. Key field: `status`, `matched` (bool), `matchedLists` (array of matched list names)
- `report/adverse-media` — adverse media hits. Key field: `matched`, `mediaEntries`
- `report/address-lookup` — address verification
- `report/profile` — demographic profile enrichment

Key fields on all reports:
- `status` — `pending` or `ready`
- `createdAt`
- report-specific result fields (vary by type)

### Lists and List Items
Persona lists are blocklists or allowlists — sets of identifiers that get flagged on future inquiries.

Relevant endpoints:
- `GET /lists` — list all lists (to find the right list ID)
- `POST /list-items/email-address` — add an email to a list
- `POST /list-items/government-id` — add a gov ID number to a list
- `POST /list-items/phone-number` — add a phone number

Body for creating a list item:
```json
{
  "data": {
    "type": "list-item/email-address",
    "attributes": {
      "value": "user@example.com",
      "listId": "lst_XXXX"
    }
  }
}
```

---

## Smart fields to implement

All smart fields below are added to the **users table** (or equivalent app DB table holding end-user records). Each field makes one Persona API call on load.

The lookup pattern is: use the user's email or your internal user ID to find their Persona account, then fetch the relevant data.

---

### 1. `persona_kyc_status`

**Purpose:** Show the current KYC status for this user at a glance.

**Display label:** `KYC Status`

**Logic:**
1. Call `GET /accounts?filter[reference-id]={user.id}` (or `filter[reference-id]={user.email}` depending on how accounts were created)
2. If no account found → return `"no_account"`
3. Get the account's most recent inquiry ID from `data.relationships.inquiries.data[0].id`
4. Call `GET /inquiries/{inquiry_id}`
5. Return `data.attributes.status`

**Return value:** String — one of `approved`, `declined`, `needs_review`, `completed`, `failed`, `expired`, `pending`, `no_account`

**Notes:**
- Surface as a badge/enum in Forest with color coding: `approved` → green, `declined` → red, `needs_review` → orange, others → grey
- If the account has no inquiries yet, return `"no_inquiry"`

---

### 2. `persona_watchlist_hit`

**Purpose:** Flag whether this user has any AML/sanctions watchlist matches.

**Display label:** `Watchlist Hit`

**Logic:**
1. Find account via reference ID (same as above)
2. Fetch the most recent inquiry: `GET /inquiries/{inquiry_id}?include=reports`
3. Find a report of type `report/watchlist` in the included reports (or from `data.relationships.reports`)
4. Fetch that report: `GET /reports/{report_id}`
5. If `data.attributes.status === "pending"` → return `"pending"`
6. Return `data.attributes.matched` (boolean) and optionally the matched list names from `data.attributes.matchedLists`

**Return value:** String — `"hit"`, `"clear"`, `"pending"`, or `"no_report"`

**Notes:**
- A `"hit"` result should be visually prominent in Forest (red badge). This is a compliance-critical field.
- `matchedLists` contains the names of the sanctions/watchlists matched — surface these in a tooltip or secondary field if possible.

---

### 3. `persona_verification_summary`

**Purpose:** Show which verification checks have passed for this user (ID doc, selfie, phone, database).

**Display label:** `Verification Checks`

**Logic:**
1. Find account and most recent inquiry (same pattern as above)
2. Fetch inquiry with verifications: `GET /inquiries/{inquiry_id}?include=verifications`
3. For each verification in `included`, extract `type` and `status`
4. Return a summary object mapping check type → status

**Return value:** JSON object, e.g.:
```json
{
  "government_id": "passed",
  "selfie": "passed",
  "phone_number": "failed",
  "database": "passed"
}
```

**Notes:**
- Verification types to handle: `verification/government-id`, `verification/selfie`, `verification/phone-number`, `verification/database`
- Strip the `verification/` prefix for display
- Surface as a compact multi-badge field in Forest

---

### 4. `persona_inquiry_date`

**Purpose:** Show when this user last completed a KYC inquiry.

**Display label:** `Last KYC Date`

**Logic:**
1. Find account and most recent inquiry
2. Return `data.attributes.completedAt` from the inquiry (may be null if not yet completed)

**Return value:** ISO 8601 datetime string or null

---

## Smart actions to implement

---

### 1. Approve KYC

**Trigger:** On a user record where `persona_kyc_status` is `needs_review` or `completed`

**What it does:**
1. Looks up the user's Persona account and most recent inquiry (same lookup chain as smart fields)
2. Calls `POST /inquiries/{inquiry_id}/approve` with body:
   ```json
   { "meta": { "reason": "Approved by {operator_name} via Forest Admin" } }
   ```
3. On success: optionally updates a `kyc_status` or `kyc_approved_at` field in the app DB
4. Returns confirmation

**Form fields to show the operator:**
- `reason` (optional text input) — appended to the meta reason string

**Error handling:**
- If the inquiry is already `approved` or `declined` → show a clear message, do not call the API
- If no account or inquiry found → show error

**Notes:**
- This is an irreversible status change in Persona. Consider adding a confirmation step in Forest.
- Persona's approve endpoint: `POST /inquiries/{inquiry-id}/approve`

---

### 2. Decline KYC

**Trigger:** On a user record where `persona_kyc_status` is `needs_review`, `completed`, or `pending`

**What it does:**
1. Looks up account and most recent inquiry
2. Calls `POST /inquiries/{inquiry_id}/decline` with body:
   ```json
   { "meta": { "reason": "..." } }
   ```
3. Optionally updates `kyc_status` in the app DB

**Form fields:**
- `reason` (required text input) — reason for decline, will be passed to Persona

**Error handling:** Same as Approve KYC above.

**Notes:**
- Persona's decline endpoint: `POST /inquiries/{inquiry-id}/decline`
- Reason is important for audit trail — make it required.

---

### 3. Add to Persona Blocklist

**Trigger:** On a user record — typically used after a fraud determination or a declined KYC

**What it does:**
1. Retrieves the user's email (and optionally phone number) from the app DB
2. Calls `POST /list-items/email-address` to add the email to a configured blocklist:
   ```json
   {
     "data": {
       "type": "list-item/email-address",
       "attributes": {
         "value": "{user.email}",
         "listId": "lst_XXXX"
       }
     }
   }
   ```
3. Optionally also adds phone number via `POST /list-items/phone-number`
4. Optionally sets a `is_blocklisted` flag or `blocklisted_at` timestamp in the app DB

**Form fields:**
- `reason` (required text input) — for internal audit logging (not sent to Persona, stored locally or in a note)
- `include_phone` (boolean toggle, default off) — whether to also blocklist the phone number

**Configuration needed:**
- `PERSONA_BLOCKLIST_ID` — the ID of the Persona blocklist to add to (format: `lst_XXXX`). This should be an environment variable. Operators must set this to the correct list ID from their Persona dashboard before the action works.

**Notes:**
- This is a high-impact, difficult-to-reverse action. A confirmation step is strongly recommended.
- Persona does not expose a "remove from blocklist" API endpoint in standard plans — treat this as permanent.

---

## Environment variables required

```
PERSONA_API_KEY=         # Persona API key (from Persona dashboard → API Keys)
PERSONA_BLOCKLIST_ID=    # ID of the blocklist to use for the "Add to Blocklist" action (format: lst_XXXX)
```

---

## Lookup helper — reusable pattern

All smart fields and actions share the same account + inquiry lookup chain. Implement this as a shared helper to avoid duplication:

```
getPersonaInquiry(userReferenceId):
  1. GET /accounts?filter[reference-id]={userReferenceId}
     → if no results: return null
     → extract account_id from data[0].id
  2. GET /inquiries?filter[account-id]={account_id}&sort=-createdAt&page[size]=1
     → if no results: return null
     → return inquiry object (data[0])
```

**Reference ID strategy:** Persona accounts are keyed on a `referenceId` you set when creating them. Confirm with the team what value was used — likely `user.id` (your DB primary key) or `user.email`. This determines how the lookup filter is constructed.

---

## What's intentionally out of scope here

- **Datasource**: Not needed unless the team wants a standalone "all KYC cases" browse view across all users simultaneously. Smart fields cover the per-user enrichment case more efficiently.
- **MCP connector**: The approve/decline/blocklist actions above can also be exposed as MCP tools for use inside Forest Workflows (e.g. auto-approve when a risk score drops below a threshold). That's a follow-on task once the smart actions are working.
- **Document image viewer**: Feasible via Persona's authenticated image URLs, but requires a proxy/passthrough to avoid exposing the API key client-side. Defer for a later iteration.
- **Re-running a KYC inquiry**: Persona supports creating new inquiries via API (Enterprise plan only). Out of scope here.
