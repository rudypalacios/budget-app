# Auth Login/Sign-up Scenarios — Audit & Forward-Looking Design

**Status:** Living reference — audited against Stage 9b (`stage-9b-google-signin`)
**Date:** 2026-07-28

This document tracks every scenario in the original `LoginScenarios.txt`
walkthrough against what's actually implemented, records the decisions made
while closing out Stage 9b, and captures the design for two things not
being built yet: the Facebook provider (Stage 9c) and a future **Account
Data Merge** stage. It exists so neither of those has to be re-derived from
scratch later — `docs/data-model.md` is the schema source of truth; this
file is the auth-behavior equivalent for the flows that don't have a home
in the SRS at the level of detail needed to actually build them.

---

## 1. Scenario-by-scenario status

Legend: **Done** (implemented, matches the scenario) · **Gap** (not
implemented, tracked as a Known Issue) · **Deferred** (real, valid future
work, intentionally not built yet) · **N/A** (out of scope, confirmed) ·
**Corrected** (the scenario's assumption doesn't match this app's actual
architecture — noted here, not treated as a bug).

### 1.1 First-time sign-up — email/password
| Scenario | Status | Notes |
|---|---|---|
| Sign up creates account, lands on main app | Done | `signUpWithEmail` via `linkWithCredential`, `src/lib/firebase/auth.ts:47-54` / `auth.web.ts:54-61` |
| Weak password rejected, no account created | Done | Server-side only (`auth/weak-password`); no client-side strength meter — see Known Issues |
| Email already registered → "already in use" error, no duplicate | Done | `auth-errors.ts:3-4` |

### 1.2 First-time sign-up — Google
| Scenario | Status | Notes |
|---|---|---|
| New account created from Google email, lands on app | Done | `signInWithGoogle`, primary `linkWithCredential`/`linkWithPopup` path |
| Cancel → no account, no error toast, stays on sign-in | Done | `{status:'cancelled'}` is a silent no-op — `auth.ts:66`, `auth.web.ts:78`, `login.tsx:89` |

### 1.3 First-time sign-up — Facebook
| Scenario | Status | Notes |
|---|---|---|
| All three (new account, cancel, no-email-permission) | Deferred | Stage 9c not started — see §3 |

### 2. Returning user, same provider
| Scenario | Status | Notes |
|---|---|---|
| Correct email/password → signed into existing account | Done | `signInWithEmail` |
| Incorrect password → generic invalid-credentials error | Done | Deliberately not distinguished from user-not-found — `auth-errors.ts:9-12`, tested `auth-errors.test.ts:20-25` |
| Returning Google user → same account, not a duplicate | Done | `auth/credential-already-in-use` fallback path — see §1.4/1.5 caveats below |

### 3. Cross-provider, same email (linking)
| Scenario | Status | Notes |
|---|---|---|
| Email/password account + Google sign-in same email → conflict → password-confirm → link | Done | Web: `auth.web.ts:106`, `login.tsx:90-100`. **This flow is confirmed correct and stays as-is.** |
| Same, on native | **Fixed in 9b** | `auth.ts` only checked `auth/email-already-in-use`; now also checks `auth/account-exists-with-different-credential`, matching web exactly (both codes can occur depending on SDK/flow) |
| Existing data intact under original UID after linking | Done | Structural — `linkWithCredential` never changes uid |
| Google-first account, later tries email/password sign-up same email → prevented, not a clear "sign in with Google instead" prompt | Gap (minor) | Functionally prevented (`auth/email-already-in-use`), but message is generic, not provider-specific — Known Issue |
| Google + Facebook linked to same account, either signs in to same UID | Deferred | N/A until Facebook exists |
| Linking fails mid-flow (network drop) → clear retry, no half-linked limbo | Done | `linkWithCredential` is atomic on Firebase's side; `auth/network-request-failed` maps to a clear message and the form stays usable for retry — no separate "half-linked" state exists to handle |

### 4. Anonymous user upgrading (the core Stage 9 migration case)
| Scenario | Status | Notes |
|---|---|---|
| Anonymous + data, signs up email/password → data preserved | Done | `linkWithCredential` |
| Same via Google | Done | |
| Same via Facebook | Deferred | Stage 9c |
| Anonymous links to an identity that already has a **separate, pre-existing real account** elsewhere → should ask before merging, never silently auto-merge | **Gap, deferred by decision** | Currently silently signs into the other account, abandoning local anon data with no warning (`auth.ts:93-96`, `auth.web.ts:92-97`). Correct fix requires a real migration engine — see §2, deferred to the future **Account Data Merge** stage |
| Merge strategy per collection once that confirmation exists | Answered | See §2 — full design below |
| Anonymous with zero data → no merge dialog shown | Deferred | Applies to the same future stage |

### 5. Sign-out and re-entry
| Scenario | Status | Notes |
|---|---|---|
| Sign out → lands on a sign-in screen, not silently re-anonymized | **Corrected** | The app re-anonymizes immediately after sign-out by design (`session.ts:163-166`) so every store can assume a uid always exists (FR-10 offline-first). This scenario's assumption doesn't match this app's architecture — confirmed intentional, not changed. |
| Sign out, sign back in same provider → data intact, no uid rotation | Done | |

### 6. Error / network conditions
| Scenario | Status | Notes |
|---|---|---|
| Offline sign-in attempt → clear "no connection" message | Gap (partial) | No proactive preflight check; `auth/network-request-failed` is mapped to a clear message only *after* Firebase's own rejection — Known Issue |
| Signed in, Firestore unreachable, initial fetch fails → not stuck on a frozen screen | Gap | `bootstrapSession`'s `status:'error'` is never surfaced distinctly from `'pending'` anywhere in the UI (`use-sync-status.ts:20,28`) — Known Issue |
| OAuth token expires mid-session → prompted to re-auth | Gap | No `reauthenticateWith*` call anywhere in the codebase; moot today since no sensitive action (e.g. account deletion) requires a fresh session yet — Known Issue |

### 7. Account deletion
| Scenario | Status | Notes |
|---|---|---|
| Delete account | N/A | Explicitly out of scope — SRS §10 "Considered, Not Included Yet" |

---

## 2. Future stage: Account Data Merge

Not built yet — scheduled for whenever the app is more developed, tracked
here so the design isn't lost in chat history. This is a **data migration
problem**, not a login-flow change, which is why it doesn't live inside
Stage 9's scope.

### 2.1 Trigger

When an anonymous session attempts to link *any* provider (email/password,
Google, Facebook) to a credential that already belongs to a **separate,
pre-existing real account** — i.e. Firebase throws
`auth/credential-already-in-use` (or, for email/password specifically, the
equivalent conflict) — instead of the current silent auto-link, show a
session-level (not per-item) prompt:

> "You already have an account with this data. Keep your data on this
> device, or start fresh with your existing account?" — **Keep my data**
> / **Start fresh**, two plain buttons, no further per-item choices.

This is distinct from — and must not be confused with — the *already
correct* flow used when an **already-registered** account adds a second
sign-in method (e.g. an email/password account linking Google): that flow
asks for a password to confirm ownership and stays exactly as-is. The new
prompt only applies to the anonymous-session-has-local-data case.

- If the anonymous session has **zero data**, skip the dialog entirely —
  nothing to merge, no pointless prompt.
- **Start fresh** → discard the anonymous session's local data, sign into
  the existing account as-is (matches today's current silent behavior,
  just now an explicit, confirmed choice instead of an unannounced one).
- **Keep my data** → run the merge described below.

### 2.2 Merge mechanics ("keep my data")

- **Categories** merge by `(name, type)` case-insensitive match:
  - A match (common case: both sides have the same seeded
    `isSystemDefault` categories like "Groceries") collapses into the
    *existing* account's category — the anonymous category's id is
    recorded in an id-remap table, never copied as a separate document.
  - No match → the anonymous category is copied over as a new category
    under the existing account (new doc id, `order` appended after the
    existing account's current max so dropdown sort stays sane).
- **Everything else (expenses, incomes, recurring definitions/instances)**
  copies over **individually, never auto-deduplicated** — e.g. a "Mall"
  recurring expense that exists on both sides ends up as two separate
  records sharing one merged "Groceries"-type category, not collapsed into
  one. A disclaimer shown before the merge starts must say this plainly
  (something like: "Categories with the same name will be combined;
  individual transactions and recurring items will all be kept, even if
  they look like duplicates").
  - Every copied record's `categoryId`/`recurringExpenseId`/
    `recurringIncomeId` reference is rewritten through the id-remap table
    built during the category pass.
  - Recurring instances additionally need their deterministic doc id
    (`data-model.md` §6: `expenses/{recurringExpenseId}_{yyyy-MM}`)
    **recomputed** against the copied definition's *new* id — not copied
    verbatim, since that id scheme is derived from `recurringExpenseId`.
- **`users/{uid}` settings**: the existing (kept) account's settings
  always win. The anonymous session's `defaultCurrency`/`language`/
  `theme`/`reminders` are discarded, never copied over.
- **Idempotency**: the account link (uid switch) and the data copy are two
  separate steps, so a network drop partway through the copy must not
  leave a half-merged, unrecoverable state on retry. Copied documents
  should use **deterministic ids** derived from the source
  (e.g. `${sourceUid}_${sourceDocId}`), so re-running the merge after a
  partial failure safely no-ops on anything already copied instead of
  duplicating it. (One-time records don't otherwise have a natural
  deterministic id — recurring instances already do, per the point above.)
- **Batching**: Firestore batched writes cap at 500 documents per batch;
  personal-scale data is usually fine, but the merge must chunk into
  multiple batches rather than assume one batch always suffices.
- **Orphaned anonymous data after a successful merge**: left in place,
  never deleted. Deleting adds another failure-prone step for no real
  user-facing benefit at this app's personal scale, and matches the
  existing trash/purge philosophy of never rushing a hard delete.

### 2.3 Why this is its own stage, not folded into 9a/9b

This needs a category-matching pass, a cross-collection id-remap table,
idempotent deterministic-id copying, batched multi-collection writes, and
a new confirm-dialog UI primitive that doesn't exist anywhere in the app
yet (the same missing primitive already noted in `CLAUDE.md`'s Known
Issues for the unrelated "discard changes?" form-cancel gap — worth
building once, reused by both). That's a real migration engine, not a
tweak to the Google/email sign-in plumbing Stage 9b is scoped to.

---

## 3. Facebook (Stage 9c) — forward-looking requirements

Not started — blocked on registering an app in the Facebook Developer
console. Captured here so 9c's build inherits every decision made while
auditing 9a/9b instead of re-discovering the same gaps:

1. **Native/web parity from day one.** Stage 9b's native implementation
   initially missed a Firebase error code (`auth/account-exists-with-different-credential`)
   that web already handled for the exact same conflict — both platforms'
   `signInWithFacebook` must handle identical error-code sets from the
   start, not be built on one platform and ported to the other later.
2. **Reuse the existing password-confirmation linking flow** for "an
   email/password (or Google) account exists, user now tries Facebook with
   the same email" — same `account-exists`/`completeFacebookLink` shape as
   `signInWithGoogle`/`completeGoogleLink` already use (`auth.ts:106-116`,
   `auth.web.ts:106-118`). Don't invent a parallel mechanism.
2a. Facebook can return a **null email** if the user doesn't grant the
    email permission (per `LoginScenarios.txt` §1.3) — this has no Google
    equivalent (Google always provides an email) and needs an explicit
    decision before 9c is built: either request the permission explicitly
    in the Facebook login flow, or show a clear, specific error rather
    than silently failing the account-exists/email-matching logic that
    every other provider relies on having a real email for.
3. **Do not build a separate silent-auto-link path for Facebook's
   `credential-already-in-use` case.** Once the Account Data Merge stage
   (§2) exists, Facebook's anonymous-upgrade conflict should go through
   that same session-level "keep my data or start fresh?" prompt — not a
   third bespoke silent-link implementation alongside email's and
   Google's.
4. **Sign-out/re-anonymize behavior is provider-agnostic** — no
   Facebook-specific change needed there (see §1 "Corrected" entry above).

---

## 4. Change log

- **2026-07-28:** Initial version, written during the Stage 9b closeout
  audit against `LoginScenarios.txt`. Documents the native/web parity fix
  applied to `auth.ts` before merging 9b, the decision to defer the
  anonymous-merge-confirmation gap to a new future stage (with its full
  design captured in §2), and the Facebook (9c) forward-looking
  requirements in §3.
