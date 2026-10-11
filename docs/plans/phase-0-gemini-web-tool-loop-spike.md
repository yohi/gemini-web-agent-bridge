# Phase 0 Spike Implementation Plan — Gemini Web Autonomous Tool Loop

| Property | Immutable baseline / status |
| --- | --- |
| Status | **DRAFT — SPIKE PLAN GATE NOT APPROVED; EXECUTION NOT AUTHORIZED** |
| Issue | [#1](https://github.com/yohi/gemini-web-agent-bridge/issues/1) |
| Requirements Gate | APPROVED as independently reported; HEAD `fcdc3d7fcc6a53010fbfd3704dc3f5a4f50469c7`, blob `8025df805967f66787369a9cfa834c5dfc69d836` |
| Design Gate | **READY** as independently reported and [recorded on PR #3](https://github.com/yohi/gemini-web-agent-bridge/pull/3#issuecomment-6107515824) |
| **Approved Design HEAD** | `beb560759f0823af908ba1d7a41af8fd7b827352` |
| **Approved Design blob** | `52c8f56d0700c3ad385c618fd19dd8ac0030ac19` |
| Stacking | This documentation-only Plan branch is based on the **exact** Design HEAD, and is a candidate stacked PR against `docs/issue-1-phase-0-design` |
| Scope | Design-derived **future implementation plan only**; no implementation, tests run, live Gemini automation or AWS/Bitbucket/MCP connectivity |
| Date | 2026-10-11 JST |

## 0. Gate boundaries and non-negotiable rules

**Read this before any task.** The independent Design Gate READY authorizes planning and Plan review, **not execution**. All paths, TypeScript names, commands and test expectations below are *proposed implementation contracts*, not evidence that code exists. A future implementation agent must first check immutable parent HEAD/blob, receive **independent Spike Plan Gate approval and explicit Execution Gate authorization**, and record corporate permission to install the Chrome extension and automate Gemini Web in a test environment. If any authority or baseline has changed, **stop**, do not quietly retarget.

**Phase 0 is synthetic and read-only.** Gemini Web is the **only** LLM. Do not use Gemini API, AI Studio Agents, a second LLM, actual AWS/Atlassian/Bitbucket/MCP, Native Messaging, credentials or extra AI usage charges. All mock tools operate offline on deterministic fake data. Neither extension nor test harness may record real conversations/company data, scrape credentials or access undocumented Gemini endpoints. No user-visible code, test, CI or config is changed by authoring this Plan.

**Safety before liveness:** exact one conversation owner, identity/role/completion causality, one full-turn tool call, execution at-most-once, **separate** publication at-most-once, actual synchronous one-click issuance, Cancel ACK barrier, Q/A safe release and indefinite quarantine on uncertainty. Never interpret a durable permit reservation as proof a click happened, or `ISSUED` as `OBSERVED_ACCEPTED`. Reviewers must reject any implementation shortcut weakening these constraints.

**Plan vs evaluation freeze:** Spike Plan Gate approves this task protocol and the **specification** of future evaluation artifacts. Execution Gate later authorizes the mock candidate and **unscored** exploration. **Only after implementation** may an independent checkpoint freeze the actual extension/test-harness commit, complete fixtures, oracle, prompt, browser configuration, rubric and trial schedule **before** the first scored browser attempt. No tests from exploration are retroactively scored; changes after freeze produce a new campaign retaining previous attempts.

## 1. Target implementation structure (all files FUTURE, do not create now)

| Proposed path | Responsibility / exported contracts |
| --- | --- |
| `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js` | Pinned Node/TypeScript + Vitest/esbuild tooling; no runtime network dependencies |
| `src/contracts/{ids,messages,errors,run,outcome,tool}.ts` | Runtime branded IDs, versioned message envelopes, Run/Intent/Trial types, strict schema and failure reasons |
| `src/extension/manifest.json`, `src/extension/background.ts`, `src/extension/content.ts`, `src/extension/ui.ts` | MV3 extension; single worker coordinator, isolated-world observer/effect actor, user Start/Cancel/Stop UI |
| `src/dom/{identity,turns,composer,send-actor}.ts` | Gemini DOM predicates, role/turn causality, exact editor serialization, singleton synchronous send actor |
| `src/protocol/{grammar,call-signature,result-encoding}.ts` | Entire-turn tagged call, callLike scanner, strictly escaped synthetic result payload |
| `src/core/{coordinator,policy,fsm,classification,launch,cancel,recovery}.ts` | Online business logic and pure transitions, **no S-A/S-B labels or oracle expectations** |
| `src/storage/{schema,journal,ownership,effects}.ts` | Extension-origin IndexedDB, cross-context transactional owner/intent/permit audit |
| `src/mock/{provider,fixtures}.ts` | In-process deterministic `cost.summary` / `ec2.metrics`; no network/write/secret access |
| `src/evidence/{events,sealer,redaction}.ts` | Append-only sanitized audit/trace and immutable final-answer snapshot proof |
| `src/evaluation/{manifest,oracle,grader,adjudication}.ts` | **Independent offline** fixture oracle, human rubric and FormalTrialRecord verdict store |
| `tests/{unit,dom,integration,browser,fixtures,adversarial}/**` | Separate deterministic, DOM-fixture, MV3 fault, controlled-browser and real-Gemini tests |
| `docs/reports/**` (future) | Executed test evidence and gate-specific reports; no real user data in repository |

**Dependency boundaries:** `dom → candidate evidence` only; `protocol → typed tool candidate` only; `core → journal authorization/effect state` only; `mock → deterministic synthetic response` only; `evaluation → sealed read-only trace + frozen oracle` only. **Never import `src/evaluation` from `src/core`, `src/dom` or `src/extension`.** Mock-provider selection via harness fixture **data injection** must not expose a fixture label/expected next tool to the Coordinator. No tool invocation from content scripts.

### 1.1 Type/authority contract (to implement in Tasks 03–06)

`ConversationKey` is canonical origin + **independently corroborated** stable conversation-specific route. `DocumentKey` is trusted Chrome tab/frame/document identity + navigation generation. `RunRef = {runId, conversationKey, ownerEpoch, documentKey}`. Initial prompt has preissued `RunMarker` and `InitialInputCorrelationId`; subsequent result text has preissued `next_input_correlation_id`. A call must echo `run_marker` and `responding_to`, but these are **correlators, not authorizations**.

`ConversationOwner` has one active run/generation per conversation. `ExecutionIntent` and `PublicationIntent` are different persisted records, separate unique indexes and separate at-most-once boundaries. Publication key = run + conversation + actual execution + result version; `evidence_id` is not unique across runs. Actor states include `PERMIT_OUTSTANDING / ISSUED / OBSERVED_ACCEPTED / UNKNOWN / ABORTED`. `NOT_ISSUED` is a **positive observation**, not the absence of `ISSUED`.

Online `AssistantOutcome`: `TOOL_CALL / FINAL_ANSWER / INVALID_OUTPUT / MODEL_REFUSAL`. Operational Run terminals: `COMPLETE / BLOCKED / CANCELLED_ACK / INDETERMINATE`. Formal Trial verdict, **separate**: `NOT_SCORED / PENDING / PASS / FAIL / INDETERMINATE`, with `HUMAN_REVIEW_REQUIRED` substatus. `COMPLETE` is safe run closure, **not** correctness. Only the independent Grader can assign a formal PASS. Q = all old effect issuers irrevocably quiescent; A = per-publication positive `NOT_ISSUED` or unique `OBSERVED_ACCEPTED`. A mere click/ISSUED does **not** establish A.

**Typed failures** to preserve: `CONVERSATION_UNBOUND`, `INITIAL_PROMPT_MISMATCH`, `TURN_UNATTRIBUTABLE`, `ROLE_AMBIGUOUS`, `MODEL_NOT_COMPLETE`, `CALL_GRAMMAR_INVALID`, `MULTIPLE_CALL_CANDIDATES`, `MODEL_REFUSAL`, `AMBIGUOUS_CALL_SHAPE`, `SENDER_NOT_SINGLETON`, `COMPOSER_DIGEST_MISMATCH`, `PUBLICATION_UNKNOWN`, `PUBLICATION_ACCEPTANCE_UNKNOWN`, `OWNER_EPOCH_STALE`, `CANCEL_EFFECT_UNSETTLED`, `RECOVERY_QUARANTINED`. `FINAL_ORACLE_FAILED`, `FINAL_ORACLE_INDETERMINATE`, `HUMAN_REVIEW_REQUIRED`, `SCORING_DEADLINE_EXCEEDED` are **grader-only**, never runtime permission/status.

### 1.2 RunBudgetV1 — immutable Plan Gate safety limits (RG-004-PLAN-003)

**These numeric maxima are Plan contracts, not values deferred to Task 19.** All counts/byte limits are checked in the authoritative Coordinator and journaled before admitting a new effect. They apply **identically** to S-A and S-B; budgets are not driven by fixture labels. An implementation change to these values needs a new Spike Plan review.

| Budget | Value and counting rule | Admission boundary and over-limit result |
| --- | --- | --- |
| `maxToolCalls` | **4** unique *claimed execution attempts per Run*, including failures, denied/uncertain dispatched attempts and all `cost.summary` / `ec2.metrics`; repeated DOM notifications for one durable intent do not consume another slot | Reserve one slot atomically **with** ExecutionIntent; 4 allowed, fifth rejected without provider entry, terminal `BLOCKED` after safe Q/A or `INDETERMINATE` if an effect is uncertain |
| `maxModelTurns` | **6** unique *newly started assistant generation attempts* associated with the Run (including malformed, refusal, interrupted or regenerated attempts); one re-render of same turn is not another attempt | Count before attaching the next assistant-generation expectation; no seventh turn admitted, no new tool/publication; same safe terminal failure rule |
| `maxElapsedMs` | **600000 ms (10 minutes)** wall-clock from successful durable owner-acquire / Run initialization **I1**, including initial user manual send, UI waits, service-worker sleep, tool work and retries; no pause/reset on MV3 restart | Deadline `startWallTime + 600000`; when elapsed **≥600000**, stop granting new actions and close gates, settle/Q/A or quarantine. Persist start+deadline; rollback/unknown clock or unreliable elapsed measurement ⇒ fail closed, never extend time |
| `maxRequestBytes` | **16384 bytes (16 KiB)** UTF-8 **per submitted initial Gemini prompt or complete model tool-call message**, using frozen canonical serializer and including protocol metadata/markers; bounded raw and canonical forms must both be within limit | Validate before initial composer prefill and before parsing/accepting a tool-call; equality allowed, **16385 denied**. Invalid/truncated JSON is never repaired |
| `maxResultBytes` | **32768 bytes (32 KiB)** UTF-8 **per complete outbound tool-result user message**, including result envelope, publication correlation, synthetic values and escape expansion; compare raw and canonical transmitted byte lengths | Validate before PublicationIntent claim and before composer write; equality allowed, **32769 denied**, no permit or UI click |
| `maxFinalSnapshotBytes` (additional) | **32768 bytes** UTF-8 per substantive final-answer evidence snapshot, before/redaction and after canonical serialization | If larger or impossible to capture safely, no online normal completion from truncated content; record typed failure and, if formal, offline evidence is nonpassing |

**Measurements:** `TextEncoder` UTF-8 sizes on exact versioned encodings, checked for both source and canonical bytes; enforce limits before expensive parsing and recheck within the atomic claim/admission transaction. `maxToolCalls` consumes a slot at **unique durable intent claim**, never on callback delivery and never refunds an uncertain attempt. `maxModelTurns` counts unique generation attempts (not the number of completed valid messages). Wall clock start and deadline survive worker restarts; monotonic elapsed hints may supplement but never override the persistent wall deadline. Fail closed if a time jump/ambiguous provenance could hide a breach. Stop/terminal reason `RUN_BUDGET_EXCEEDED(kind,observed,limit)` is an online **non-PASS** failure; do not truncate tool/result/answer bytes to fit.

**Tests:** exact 4th/5th call, 6th/7th assistant generation (including regen/interruption), elapsed 599999/600000 ms with restart and clock rollback, 16384/16385 request bytes, 32768/32769 result and final bytes including multibyte characters, atomic two-call quota race and duplicate notification replay. Assert **zero new provider entries/UI clicks after exhausted budget**; in-flight uncertain effects prevent a false owner release/Cancel ACK. The immutable evaluation manifest must repeat these values **unchanged**.


## 2. Task execution protocol (AFTER Execution Gate ONLY)

For **each** implementation Task below, use **RED → GREEN → REFACTOR → verification → one explicit bounded commit**. RED must reproduce failure against pre-task production code, not merely add an already-green test. GREEN implements only scoped functionality. REFACTOR must preserve the same test evidence. Commands proposed for post-authorization use:
- `npm ci`; `npm run typecheck`; `npm run lint`; `npx vitest run tests/unit tests/dom tests/integration`.
- `npm run build:extension`; `npm run test:browser:synthetic` under controlled Chromium with fake HTML only.
- `npm run test:browser:live` is **opt-in, local, explicit corporate permission**, authenticated Gemini Web with **synthetic** prompts; never in public CI; no automatic login or session-cookie recording.

Exact dependency versions, npm scripts, deterministic fixture checksums and local browser command switches are approved as part of this Plan's **build contract** and pinned to lockfile **after** Execution Gate. No unpinned dependency or custom private Gemini endpoint. A task is not green because a mocked handler was called: when actual send/provider issuance is part of its claim, count **the actual single `click()` invocation / actual mock-provider entry**, not just an IndexedDB write.

**Commit discipline:** one task ≈ one reviewable implementation commit after verifying only its specified files/tests; if a task is blocked, preserve its RED evidence and write a report rather than fabricating a GREEN commit. Each task records exact command, test count, output, git SHA and AC/DP evidence IDs. Do not batch subsequent tasks after a stop condition or add out-of-scope features.

### 2.1 Effect-enablement and dependency gates (RG-004-PLAN-001 / 002)

**Explicit staged authorization:** Task 01–14 production logic is **fail closed by default** for actual Gemini tool-result click issuance. Tests of Tasks 05/10/12/13/14 may use instrumented **pure units or synthetic isolated documents** and a deliberately non-issuing actor, but **must not create a temporary production permit, test-only bypass in real Gemini, or enable an actual bridge-result Send**.

- **Task 02** real Gemini inspection is **observation only**: manual user-originated clicks/initial input and DOM event inspection are permitted if corporate policy allows; no programmatic Gemini `click()` and no Bridge Result Publication. A synthetic local fixture may test a prototype `click()` but is **not** live-Gemini bridge evidence. Actual authorized send behavior remains unproven until Task 17/18.
- **Task 05** implements durable owner, schema and effect-obligation ledger; **Task 10** adds the provider dispatch admission/entry/recovery protocol. Any provider entry is the synchronous **mock-only** entry under its persisted permission; no real API.
- **Task 12** installs a **disabled-by-default singleton actor** and a fail-closed nonce/digest verifier. Its GREEN is **actor identity and zero unauthorized actual clicks**, not successful Gemini Send. No synthetic or live production actor may self-mint an issuance permit.
- **Task 13** implements unique durable PublicationIntent, one irreversible `PERMIT_OUTSTANDING`, no-retry MV3 recovery and coordinator routing, with the actor still **non-issuing**. Its GREEN proves reservation and duplicate suppression, **not** an actual click.
- **Task 14** implements the Cancel admission/ACK barrier plus positive Q (actor quiescence) and A (result acceptance/positive no-issuance) and quarantine before any production click enablement. Test obligations using fault-injected synthetic actor reports; missing proofs mean `INDETERMINATE`.
- **Task 17** is the **first integrated actual-click GREEN** on a controlled synthetic page, and only after Task 10, 12, 13, **and 14 are verified**. Enable solely through a **single coordinator-validated armed path**, never a temporary permission shortcut. GREEN includes durable intent→one permit→one actor→actual click→observed accepted result, plus duplicate callback/listener, MV3 restart and cancel interleavings. If any safety counterexample remains, STOP before any live bridge publication.
- **Task 18** is first *authorized, unscored* actual Gemini Bridge UI Send after Task 17 has proven the controlled safety preconditions and Task 02 has established sufficient DOM observations. If real Gemini requires a different issuance primitive, **STOP and return to Design Gate**; do not silently substitute Enter/HTTP.

**No transient unsafe GREEN:** A prerequisite task is GREEN only for the **explicit restricted claim** above. An all-features-running claim, at-most-once actual Send proof, or Cancel ACK liveness is forbidden until full integration. The implementation reviewer must record the current `actualBridgeClickAllowed=false/true` authorization boundary and check it after every commit.


### Task 01 — Reproducible mock-only MV3 harness

**Files:** `package.json`, lockfile, tsconfig, Vitest/esbuild/ESLint config, `src/extension/manifest.json`, `src/extension/{background,content,ui}.ts`, `scripts/build-extension.mjs`, `tests/unit/harness.test.ts`.

**Contract / functions:** Build MV3 SW and isolated-world content script as **bundled static code**; popup has disabled/safe Start/Cancel indicators; manifest only `https://gemini.google.com/*` plus minimal extension permissions; no native host, cookie, broad web/network rights or eval. `buildExtension()`, `assertManifestLeastPrivilege()`.

**RED:** manifest/security assertions fail with absent build and with deliberate `<all_urls>`, nativeMessaging, remote code or disallowed host permissions. **GREEN:** pinned installation/build, deterministic artifacts, manifest audit. **REFACTOR:** normalize scripts, regenerate lockfile and audit again.

**Verify:** `npm ci && npm run typecheck && npm run lint && npx vitest run tests/unit/harness.test.ts && npm run build:extension`. **Commit:** `build: scaffold synthetic-only MV3 feasibility harness`. **Stop:** any unexpected network/permission expansion.

### Task 02 — Priority **live-browser DOM falsification probes** (unscored; fail-fast)

**Files:** `tests/browser/probes/{conversation,completion,composer,send}.spec.ts`, `tests/fixtures/dom-observation-schema.json`, `docs/reports/phase-0-browser-probes.md` (synthetic observation only).

**Contracts:** `probeConversationEvidence()`, `probeAssistantTransition()`, `probeComposerSendControl()`, `probeDocumentTargeting()`; capture only structural marker names, redacted DOM sketches, observable event sequences and anonymous test conversation IDs/digests. Run **only after corporate permission and Execution Gate**, on explicitly prepared Gemini test conversations with synthetic content. No undocumented network API; no raw screenshots/transcripts in public PR. Manual login/preparation is allowed, but the tool loop must not require manual help.

**RED:** intentionally missing/ambiguous identity, role, active→complete marker, multi-composer, DOM drift or no executable click path must produce `BLOCKED` for that proof obligation. **GREEN:** observe real supported Gemini UI state where predicates are satisfied. **REFACTOR:** extract versioned observed DOM contract fixture without treating observed selectors as permanent.

**Verification/falsification:** same conversation opened in two tabs must yield identical canonical key, different/same-title conversations distinct; unsaved chat rejected; active/complete/stop/refusal distinguishable; one unique composer + submit control, and **manual user-initiated** click/visible user turn are separately observable; **no programmatic bridge result click, no PublicationIntent or automated Gemini send in Task 02**. **Any missing required identity, completion, causal provenance or observable manual submit/acceptance boundary ⇒ STOP**, record B-01/B-02/B-03/B-07/B-08 as unproven/blocked where applicable. **The automatic click→acceptance premise remains unproven until Task 17/18; do not mark it PROVEN from a manual click.** Exploratory observations **never** count in scored trial denominator. **Commit:** `test: document unscored Gemini DOM feasibility probe evidence` (synthetic/redacted only).

### Task 03 — Branded contracts and explicit failure taxonomy

**Files:** `src/contracts/{ids,messages,errors,run,outcome,tool}.ts`, `tests/unit/contracts.test.ts`.

**Implement:** `parseRunRef()`, `parseDocumentKey()`, `validateBridgeMessageV1()`, `validateToolCallV1()`, `validateRunBudgetV1()` (§1.2), typed `AssistantOutcome`, `RunTerminal`, `FormalTrialVerdict`, `ExecutionIntent`, `PublicationIntent`, `DispatchAttemptKey`, `EffectObligation`, and `EvidenceSealResult`; different typed namespaces for `RunTerminal`, `FormalTrialVerdict`, campaign scheduler/slot status and `DecisionGate`. Distinguish actual dispatch Entry from admission and `ISSUED` from `OBSERVED_ACCEPTED` and positive `NOT_ISSUED`.

**RED:** missing version fields, unknown types, forged owner keys, unbounded string/depth, illegal `INCONCLUSIVE` Run/Trial value, under/overflow in RunBudgetV1, and conflated `COMPLETE/PASS` compile/runtime tests fail. **GREEN:** exhaustive type guards with strict unknown-field rejection. **REFACTOR:** export discriminated unions and prove exhaustive switches. **Verify:** typecheck + `tests/unit/contracts.test.ts`. **Commit:** `feat: define Phase 0 authority and message contracts`.

### Task 04 — Strict whole-turn parsing and callLike inventory

**Files:** `src/protocol/{grammar,call-signature}.ts`, `tests/unit/grammar.test.ts`, `tests/dom/call-rendering.test.ts`, `tests/fixtures/assistant-call/**`.

**Implement:** `scanCallLike(fullBody,domStructure)`, `parseWholeTurnCall(structuredAssistantBody)`. Only one top-level `gemini-agent-call` block, strict JSON with `run_marker/responding_to/call_id/tool/arguments`; exact CRLF/newline/JSON-space normalizations and reserved-key inventory; reject quotes/examples, siblings, multiple calls including identical, duplicate JSON keys, unknown tool/invalid schema. No inferred calls from prose.

**RED:** bad quoted example, embedded JSON, second block, stale token and partial stream erroneously accepted by a permissive parser. **GREEN:** whole-turn parser and reserved-signature failure precedence. **REFACTOR:** fixtures for supported DOM renderers with versioned parser boundary. **Verify:** unit and DOM tests. **Commit:** `feat: enforce whole-turn single-call grammar`.

### Task 05 — IndexedDB transaction/journal owner and epoch

**Files:** `src/storage/{schema,journal,ownership}.ts`, `tests/integration/ownership-races.test.ts`, `tests/unit/journal.test.ts`.

**Implement:** `openJournal()`, `transactionallyAcquireOwner(conversationKey,runId)`, `readFencedOwner()`, `appendOrderedAuditEvent()`, `releaseOwnerIfSettled()`, `reserveDispatchOutstanding()`, `retireDispatchOutstandingWithPositiveProof()`; use IndexedDB unique conversation-owner record and one `readwrite` transaction over owner, Run, Intent and **EffectObligation** records for **each admission**. Define immutable `DispatchAttemptKey = RunId + ConversationKey + AssistantTurnKey + CallId`, monotonically fenced `OwnerEpoch`, `ExecutionIntent` states `RESERVED → MAY_HAVE_DISPATCHED → FINISHED / UNKNOWN` and a **separate outstanding dispatch obligation** `ADMITTED_MAY_ENTER → ENTRY_REPORTED / POSITIVELY_NOT_ENTERED / UNKNOWN`. Never infer actual entry from transaction commit or absence of an entry log. An admission commit persists `MAY_HAVE_DISPATCHED`/obligation **before** any caller may enter provider; identical attempt cannot be admitted again after restart. Persist cancel gate epoch and proof-bearing obligation lifecycle in same authoritative store. No `chrome.storage.local` read-then-write lock, no timeout takeover.

**RED:** Promise.all two-tab owner claim cannot have two winners; duplicate DispatchAttemptKey/worker restart cannot create a new obligation; a committed `ADMITTED_MAY_ENTER` cannot be mistaken for provider Entry or as positive no-entry proof. **GREEN:** atomic unique claims and durable obligation survive IndexedDB reopen; canceled-before-admission transactions reject new attempts; aborted IDB tx grants no permission; uncertain attempt remains fenced. **REFACTOR:** transaction scheduler and no-takeover invariants. **Verify:** unit + fault-injected integration including worker restarts. **Commit:** `feat: journal linearizable conversation ownership and dispatch obligations`. **Stop:** if atomic owner/cancel/intent admission cannot be demonstrated → DP-04/05 BLOCKED.

### Task 06 — Versioned DOM identity and assistant causality adapter

**Files:** `src/dom/{identity,turns}.ts`, `tests/dom/{identity,completion,causality}.test.ts`, `tests/fixtures/gemini-dom/**`.

**Implement:** `observeConversationEvidence()` (route plus independent displayed-conversation corroboration), `validateDocumentBinding()`, `observeUserInputTurn()`, `observeAssistantActiveToCompleted()`, `attributeAssistantToExpectedInput()`, `invalidateOnNavigationOrMutation()`. Browser sender metadata, not content-declared document ID, is authority. No invented Gemini selectors; adapter is versioned from Task 02 observations.

**RED:** generic route/same title, wrong tab, unsaved chat, stale DOM, multiple messages, manual unrelated user input, stop/regenerate, stream pause and role spoof would previously be accepted. **GREEN:** immutable body/input digests and unique assistant predecessor or `BLOCKED`. **REFACTOR:** DOM contract version and mutation-observer lifecycle. **Verify:** fixture and cross-tab controlled browser tests. **Commit:** `feat: bind DOM conversation and completed assistant causality`. **Stop:** ambiguous role/completion/predecessor → DP-01/02 BLOCKED.

### Task 07 — User-sent first-prompt bootstrap, exclusive run launch

**Files:** `src/core/launch.ts`, `src/extension/ui.ts`, `src/dom/composer.ts`, `tests/integration/launch.test.ts`.

**Implement:** `prepareUserSentInitialPrompt()`, `deriveInitialPromptDigest()`, `armInitialInputExpectation()`, `recognizeManualFirstSend()`. I0–I5 sequence: owner acquired first; RunMarker and InitialInputCorrelationId preissued; exact tool grammar/catalog and user task journaled; unique composer prefilled; **human manually sends exactly once**, no extension auto-submit; observe exact user turn before accepting assistant. Subsequent manual interruption blocks run.

**RED:** prompt sent before owner, mutated initial prompt, wrong conversation, duplicate initial send, missing user-turn acknowledgment. **GREEN:** exact prefill/observed correlation only, and **initial canonical prompt ≤16384 UTF-8 bytes** (§1.2); no tool entry before I4. Timer starts at owner acquisition I1 even if manual initial Send is delayed. **REFACTOR:** separate pure prompt serialization from UI. **Verify:** tests and synthetic browser. **Commit:** `feat: implement single user-sent launch handoff`.

### Task 08 — Online classification and Run state machine (no oracle)

**Files:** `src/core/{classification,fsm,policy}.ts`, `tests/unit/{outcome,fsm,policy}.test.ts`.

**Implement:** `classifyCandidate()`, `authorizeCallCandidate()`, `transitionRun()`, `closeOnSafeFinal()`, `evaluateAndReserveRunBudget(RunBudgetV1)`. Budget policy uses the numeric §1.2 contract; owner/Run/intent transaction enforces tool quota, assistant-generation observation quota, byte limits and a persisted ten-minute deadline; no fixture-label inputs. Four outcomes `TOOL_CALL/FINAL_ANSWER/INVALID_OUTPUT/MODEL_REFUSAL` with precedence callLike → whole-turn valid call or invalid → explicit refusal → normal final; provisional `CALL_CANDIDATE` requires policy and durable intent before becoming authoritative `TOOL_CALL`. Normal substantive answer enters `FINAL_SAFETY_CHECK` and only after Q/A-safe settlement becomes **operational `COMPLETE`**, independent of correctness.

**RED:** final falsely accepted for malformed embedded call, refusal as final, oracle FAIL blocking a Q/A-safe Run, fixture label choosing `ec2.metrics`, or exact 4/5 calls, 6/7 turns, 599999/600000 ms, 16384/16385 and 32768/32769 bytes mishandled. **GREEN:** classifier independent of `src/evaluation` with static import-boundary test; numeric RunBudgetV1 enforced at the real claim/effect gates; `FINAL_ANSWER` snapshot persisted once; no after-COMPLETE or over-budget provider/UI operations. **REFACTOR:** table-driven reducer/effect-free parsing. **Verify:** unit & static import boundary test. **Commit:** `feat: classify assistant outcome and safe online completion`.

### Task 09 — Offline deterministic mock provider

**Files:** `src/mock/{provider,fixtures}.ts`, `tests/unit/provider.test.ts`, `tests/fixtures/mock/{scenario-a,scenario-b}.json`.

**Implement:** `dispatchMockTool(tool,validatedArguments,fixtureData)`, `renderMockEvidence()`. Synthetic `cost.summary` chooses data variant; `ec2.metrics` accesses only predeclared fake resource IDs. Same tool catalog in both variants. Provider returns bounded evidence ID/provenance, typed cost/usage/time and structured failure without networking or file/secret access.

**RED:** nonallowed ID, missing evidence field, fixture-dependent hard-coded model follow-up and any `fetch`/network action must fail. **GREEN:** deterministic reproducible outputs, mock provider has no influence on Coordinator decisions. **REFACTOR:** fixture input schema/digests. **Verify:** no-network integration & provider fixture tests. **Commit:** `feat: add deterministic synthetic-only mock tools`.

### Task 10 — ExecutionIntent, actual provider entry and durable Cancel admission (RG-004-PLAN-002)

**Files:** `src/storage/effects.ts`, `src/core/{coordinator,cancel}.ts`, `tests/integration/{execution-once,cancel-dispatch,dispatch-handoff-failpoints}.test.ts`.

**Implement:** `claimExecutionIntent()`, `commitDispatchAdmission()`, `invokeExactlyOneMock()`, `recordProviderEntryOrDefinitiveNoEntry()`, `closeEffectGatesOnCancelRequest()`, `reconcileDispatchObligation()`. The **irreversible admission linearization point** is a successfully completed IndexedDB `readwrite` transaction checking owner epoch, Run/cancel gate, tool quota and unique ExecutionIntent; it writes `MAY_HAVE_DISPATCHED`, one **durable outstanding obligation `ADMITTED_MAY_ENTER`** and a spent attempt key **before provider invocation**. Transaction `complete` is an admission commit **only**, **not** actual entry. Failed/aborted transaction authorizes no entry.

**Required non-atomic handoff sequence:**

1. Under a unique current owner/Run+call, claim `ExecutionIntent.RESERVED` once. Keep an idempotent unique constraint, bounded RunBudgetV1 and no retry from old/unknown attempts. Intent reservation alone never enters provider.
2. In the **same authoritative IndexedDB transaction** checking persisted `CANCEL_GATE_CLOSED`, owner epoch and quotas, commit `MAY_HAVE_DISPATCHED + ADMITTED_MAY_ENTER`. Exactly one attempt gets a permit; all duplicates and after-cancel claimants lose. The commit counts as the attempt's **irreversible right consumption**, even if provider is never entered.
3. After the awaited transaction-completion callback, the same single Service Worker invocation performs a last **synchronous, non-yielding** in-memory owner/Run/cancel/obligation check followed immediately by **one synchronous in-process** `dispatchMockTool()` entry. No additional `await`, timer, message hop, alternate worker or queued callback between this last check and invocation; no remote async provider in Phase 0. A detected cancel/epoch change prior to entry may skip dispatch **only with positive no-entry proof from the sole authorized caller** and durable retirement of the obligation.
4. Instrument actual `PROVIDER_ENTERED` at the top of the mock function, separate from `ADMISSION_COMMITTED`, and `PROVIDER_RETURNED` at completed exit. Record durable `FINISHED` and retire the obligation after outcome capture. These audit events are proof *only if* bound to the sole admitted attempt and ordering; a missing event is **not** proof of no entry.
5. If worker dies or result cannot be durably recorded **after admission**, recover to `UNKNOWN/INDETERMINATE` without retry. The worst-case crash-before-entry sacrifices liveness, not at-most-once. Never mark `NOT_ENTERED` solely because restart sees no `PROVIDER_ENTERED` log. Proving non-entry requires positive still-live actor proof it explicitly chose to skip before calling provider **and** that all old callbacks are irrevocably unable to enter; otherwise obligation stays unresolved.
6. **Cancel ordering:** if durable `CANCEL_GATE_CLOSED` commits first, admission cannot commit and actual entry is forbidden. If admission commits first, it is an **outstanding may-enter effect**; the actor may enter before cancellation is acknowledged, but **`CANCELLED_ACK` and same-chat owner release must wait** for positive `PROVIDER_RETURNED`/settled failure or `POSITIVELY_NOT_ENTERED` plus actor quiescence. `CANCEL_GATE_CLOSED` alone cannot imply old attempts have stopped. Because a synchronous JS critical section cannot interleave cancellation callback execution inside the section, no provider entry may initiate **after a valid Cancel ACK**. Missing quiescence/entry status ⇒ `CANCEL_PENDING / INDETERMINATE` and quarantine.

**RED:** duplicate callbacks, two owners, quota race and cancellation competing with admission; inject worker interruption at **(a) final admission transaction commit, (b) after commit/before actual provider entry, (c) just after `PROVIDER_ENTERED`, (d) after mock return/before durable `FINISHED`**. Also force cancel gate win/lose admission, lost completion callback, delayed old worker and restart of a `MAY_HAVE_DISPATCHED` attempt. **GREEN:** actual mock-provider entry count ≤1; no retry from UNKNOWN; zero post-`CANCELLED_ACK` entry; `NOT_ENTERED` requires affirmative actor proof; old obligation blocks premature owner release. **REFACTOR:** isolate single-flight handoff with no extra async boundary. **Verify:** deterministic interleavings and MV3 worker-reopen fault tests. **Commit:** `feat: bind durable dispatch admission to at-most-once mock entry`. **Stop:** if admission/entry/Q barrier cannot be distinguished or a post-ACK provider entry occurs → DP-04/05/07/14 BLOCKED.


### Task 11 — Exact result encoding, digest and safe composer observation

**Files:** `src/protocol/result-encoding.ts`, `src/dom/composer.ts`, `tests/dom/{result-encoding,composer-digest}.test.ts`.

**Implement:** `encodeToolResultV1()`, `canonicalizeSendableComposer()`, `verifyComposerPayloadDigest()`. Bridge-minted PublicationId, evidence ID, RunMarker and preissued `next_input_correlation_id`; escape HTML, fake tool calls, Markdown fences, fake system roles, control characters and Unicode without changing numeric truth. Snapshot exact actual sendable editor state; do not equate superficial innerText with submitted payload.

**RED:** malicious mock text injects executable call; composer has extra hidden text/attachment, user edit, alternative rich-editor serialization or oversized evidence. **GREEN:** complete outgoing payload ≤32768 UTF-8 bytes (both raw/canonical including escaped envelope), exact digest-before-click or abort; no partial content truncation or silent re-encoding. **REFACTOR:** serializer version and golden digests. **Verify:** DOM fixture tests. **Commit:** `feat: bind quoted tool results to exact composer payload`.

### Task 12 — Passive singleton UI effect actor, **NOT YET SEND-ENABLED** (RG-004-PLAN-001)

**Files:** `src/dom/send-actor.ts`, `src/extension/content.ts`, `tests/integration/{send-singleton,nonce-races}.test.ts`, `tests/browser/probes/send.spec.ts`.

**Implement:** `registerSoleEffectActor(DocumentKey)`, `inspectPermitWithoutIssuing()`, `consumeNonceSynchronously()`, `issueComposerSendOnce()`. Establish a document-scoped isolated-world actor registry **before** registration of one effect listener. Duplicate actor/listener/reinjection, wrong frame/document or unknown registry continuity must fail closed. `tabs.sendMessage({documentId})` is a routing constraint, **not** a unique listener guarantee. Implement the prospective synchronous critical-section helper that will only accept an **authoritative durable, signed-by-coordinator (not cryptographic trust) permit reference** bound to current owner/document, composer digest and unique nonce. **Keep the actual `HTMLElement.click()` branch unreachable in packaged production flow** until Task 17 verifies Task 13's durable publication and Task 14's Cancel/Q/A prerequisites. Neither content script nor a test-only public message can mint a permit.

**RED:** duplicate content listeners, same-document reinjection, duplicate/stale nonce, frame substitution, composer mutation and synthetic forged permits must all fail actor admission; a synthetic test attempting to issue through the packaged actor **before Task 17** must record **zero actual clicks**. **GREEN:** exactly one registered executor/nonce owner and zero unauthorized DOM effects, including MV3-restart/reinjection attempts; actor is **fail-closed** and receives no executable production permit. **REFACTOR:** isolate synchronous executor body without introducing `await` between final verification and eventual click. **Verify:** unit/integration + synthetic fixture tests **without enabling actual Bridge UI Send**. **Commit:** `feat: establish disabled-by-default singleton send actor`. **Stop:** any click from unfinished/forged authorization → DP-06/B-08 BLOCKED. **Explicit non-claim:** Task 12 GREEN does **not** prove at-most-once live send or success of Gemini `click()`.


### Task 13 — Durable PublicationIntent, unique permit reservation, **no issuing actor yet** (RG-004-PLAN-001)

**Files:** `src/storage/effects.ts`, `src/core/coordinator.ts`, `tests/integration/{publication-once,publication-restart}.test.ts`.

**Implement:** `claimPublicationIntent()`, `reserveOneUiPermit()`, `recordActorOutcome()`, `reconcileAcceptedResultTurn()`, `rejectDuplicatePublisher()`. A valid executed result maps to `run + conversation + execution + resultVersion`, with exact canonical payload digest. In one indexedDB transaction across Owner/Run/PublicationIntent/EffectObligation, atomically create unique immutable claim, consume its **single permanent issuance right** into `PERMIT_OUTSTANDING`, and persist document/actor/owner epoch/payload digest + outstanding **may-click** obligation before any delivery to a content script. Parallel claimants lose. Only the authorized coordinator may route; the send actor **still cannot execute click** until Task 17 enablement. Duplicate result notifications, crash after reservation, delayed old worker, lost ACK or ambiguous acceptance lead to `UNKNOWN/INDETERMINATE` **without another permit**. `ISSUED` means actual click (not reservation); `OBSERVED_ACCEPTED` requires one matching new Gemini user input turn before the next assistant expectation.

**RED:** duplicate callbacks, two parallel publishers, reused evidence ID across different Runs, inconsistent result digest, wrong document, MV3 restart after permit claim and old nonce replay. **GREEN:** exactly one durable PublicationIntent and one spent send right, no duplicate permits, conservative `UNKNOWN` recovery, **zero actual packaged actor clicks during this Task**. Fault injector may use recorded **synthetic actor outcomes** for persistence tests; do not misreport these as actual effects. **REFACTOR:** unique constraints, outcome-evidence schema and transaction boundary. **Verify:** IDB fault tests + no-click assertion. **Commit:** `feat: journal distinct at-most-once publication rights`. **Stop:** worker restart or dual claim reauthorizes spent nonce → DP-06 BLOCKED.


### Task 14 — Pre-click Cancel ACK barrier and Q/A recovery (RG-004-PLAN-001/002)

**Files:** `src/core/{cancel,recovery}.ts`, `src/storage/{ownership,effects}.ts`, `tests/integration/{cancel-ui-interleavings,recovery-quarantine}.test.ts`.

**Implement:** `requestCancel()`, `closeCancelAdmissionGate()`, `acknowledgeCancelIfSettled()`, `proveActorQuiescenceQ()`, `proveAcceptanceA()`, `reconcileRunWithoutReplay()`, `retireOutstandingEffectObligation()`. Durable cancel transaction closes **both** provider-entry admission and new UI publication-permit admission. Its linearization order is relative to the *committed admission*, **not assumed actual provider entry or click**. Every previous `ADMITTED_MAY_ENTER` / `PERMIT_OUTSTANDING` is an unresolved obligation until **positive** provider actor/DOM actor quiescence. **Q** covers both mock provider entry/return and all send-capable document actors. **A** independently requires each result `NOT_ISSUED` with impossible future initiation **or** unique `OBSERVED_ACCEPTED`. An `ISSUED` click with unconfirmed page acceptance may satisfy Q but **not A**; do **not** ACK cancel or release same-conversation owner. Never infer Q or A from timeouts, closed tabs alone, service-worker restart or missing ACK.

**RED:** simulate Cancel winning admission and losing to a **previously granted** dispatch/permit, unknown provider entry, quiescent actor with unknown page acceptance, old actor after attempted owner turnover, and forged `NOT_ISSUED`; a duplicate or delayed callback must not turn an unknown status into Q/A. **GREEN:** under controlled **synthetic actor-event traces**, the barrier waits on every may-enter/may-click obligation and only ACKs once affirmative terminal evidence is present; no actual Gemini result send is enabled yet. **REFACTOR:** one shared Q/A predicate used by Cancel ACK, Run COMPLETE and terminal reconciliation; document permitted indefinite quarantine. **Verify:** ordered fault-injection across Task 10 dispatch and Task 13 publication journal (real click still disabled). **Commit:** `feat: add conservative Cancel ACK and Q-A settlement before send enablement`. **Stop:** any phantom Q/A proof or premature Cancel ACK → DP-07/14 BLOCKED.

**First actual-click qualification is Task 17, not Tasks 12–14.** Task 17 must extend these synthetic-reported checks to the actual send-control invocation with worker-restart and cancellation races before Task 18 may exercise Gemini.


### Task 15 — Sanitized scoreable evidence and typed sealing failures (RG-004-PLAN-005)

**Files:** `src/evidence/{events,sealer,redaction}.ts`, `src/contracts/errors.ts`, `tests/unit/{redaction,seal-evidence}.test.ts`, `tests/integration/evidence-replay.test.ts`.

**Implement:** `emitSanitizedAuditEvent()`, `captureFinalAnswerSnapshot()`, `sealRunEvidence()`, `verifySealedEvidenceDigest()`. Include ordered synthetic-only owner/epoch, input/assistant correlations, DOM contract version, **actual provider entries/returns**, complete bounded synthetic results, Publication claim vs actual click vs one accepted user turn, Q/A proof, final-answer canonical text/digest and operational Run terminal. Hash a versioned immutable canonical trace; include frozen manifest/code refs. Restrict capture to preregistered synthetic user task/result/final-answer regions with strict allowlist/redaction; no real account contents, personal conversation, cookie, credentials or raw browser screenshots. Preserve sufficient resource IDs/numbers/units/evidence IDs for independent scoring. If capturing an unknown/personal field would be necessary for grading, **refuse to seal**, never secretly store it.

**Explicit typed separation:**

```ts
type EvidenceSealResult =
  | { kind: "SEALED"; digest: string; schemaVersion: number }
  | { kind: "REJECTED_SENSITIVE_CONTENT"; evidenceCode: "EVIDENCE_SEAL_PRIVACY_REJECTED" }
  | { kind: "INSUFFICIENT_SCORABLE_EVIDENCE"; evidenceCode: "EVIDENCE_SEAL_INCOMPLETE" }
  | { kind: "INTEGRITY_OR_STORAGE_FAILURE"; evidenceCode: "EVIDENCE_SEAL_INTEGRITY_UNKNOWN" };
// EvidenceSealResult is neither RunTerminal nor FormalTrialVerdict nor DecisionGate.
```

**Run versus Trial versus Decision:** Evidence sealing is evidence-processing, **not** a provider/UI effect or authorization predicate. If actual runtime Q/A proofs are intact, a safely `COMPLETE` Run **stays COMPLETE and owner may be released**, even when sealing fails; a `BLOCKED` run stays BLOCKED. If missing evidence also means Q/A itself **cannot** be proven, keep online Run `INDETERMINATE` and quarantine *for that reason*, not merely because Grader cannot seal. Each preregistered formal attempt remains `FormalTrialRecord=PENDING` with a sanitized `EvidenceSealFailure` **code only** (never raw rejected text); attempt remains in original denominator. Only a fully verified, scoreable immutable `SEALED` bundle can be formal PASS; if proof/judgment cannot be recovered by the frozen scoring deadline, Grader records **trial `INDETERMINATE` (nonpassing)**, or **FAIL** if a definite criterion/safety violation was proven. **`INCONCLUSIVE` is reserved for independent campaign/Decision Gate**, never an EvidenceSealResult, RunTerminal or FormalTrialVerdict. Regrading may re-read already permitted immutable synthetic records; never re-open Gemini/run, recreate missing sensitive text or replay tool/publication effects.

**RED:** missing final-answer snapshot, missing actual click/provider entry, mutated trace hash, synthetic numbers mistakenly redacted, sensitive token/private text not rejected, and direct mapping of `EVIDENCE_SEAL_PRIVACY_REJECTED` to Run `INCONCLUSIVE` or trial PASS. **GREEN:** a scoreable synthetic trace seals deterministically; privacy/missing-evidence failure produces only typed sanitized code and `PENDING`→deadline `INDETERMINATE` (or definite FAIL), without modifying safely closed Run or dropping trial. **REFACTOR:** versioned trace schema and strict privacy boundary. **Verify:** unit/integration, staged crash, deterministic replay and secret scanners. **Commit:** `feat: seal scoreable sanitized traces with separate evidence-failure states`. **Stop:** unredacted real/secret data reach persisted evidence or public PR → critical safety violation, execute Task 20 halt procedure during any campaign.


### Task 16 — Independent Grader and FormalTrialRecord

**Files:** `src/evaluation/{manifest,oracle,grader,adjudication}.ts`, `tests/unit/{oracle,grader}.test.ts`, `tests/integration/grader-restart.test.ts`.

**Implement:** `gradeSealedTrial()`, `recordHumanRubricJudgment()`, `compareAndSetFormalTrialVerdict()`, `recordSealFailureWithoutRunMutation()`. **Separate evaluation-only store** keyed by CampaignId/TrialId/ManifestSha, preregistered attempts, expected fixture label/next tool/ranges *only here*. Correctly grade S-A 2-call vs S-B 1-call, numeric/evidence accuracy and unsupported recommendations; optional frozen narrow human rubric yields `PENDING(HUMAN_REVIEW_REQUIRED)`; deadline without judgment ⇒ nonpassing trial `INDETERMINATE`. `PASS` only if operational Run safely `COMPLETE` and all oracle criteria pass. Duplicate grade callback/idempotent restart never alters Run/owner or causes a click.

**RED:** online `COMPLETE` with fabricated numbers being called PASS, S-A missing follow-up passing, S-B extra call passing, human pending being treated as PASS, grader writing to Run journal, typed `EVIDENCE_SEAL_INCOMPLETE` being mistaken for Run INDETERMINATE or Decision INCONCLUSIVE, and unstarted frozen slot silently omitted. **GREEN:** independent PASS/FAIL/INDETERMINATE, durable reason/rubric/reviewer; sealing failure leaves trial PENDING until deadline→nonpassing INDETERMINATE unless definite FAIL, while Run safe closure and Q/A remain unchanged. **REFACTOR:** strict runtime→evaluation import firewall and frozen rubric examples. **Verify:** grader tests + forbidden-import test. **Commit:** `feat: grade formal trials independently of runtime state`.

### Task 17 — **First integrated actual-click GREEN**, synthetic-browser race suite (RG-004-PLAN-001)

**Files:** `tests/browser/{synthetic-loop,synthetic-races}.spec.ts`, `tests/fixtures/fake-gemini/**`, `tests/adversarial/**`, final integration wiring in `src/dom/send-actor.ts` and `src/core/coordinator.ts`.

**Hard prerequisites / enable gate:** Completed and verified Tasks **05,10,11,12,13,14**; Task 02's read-only DOM observations must not have failed the identity/completion prerequisites. No packaged UI click path is enabled before this Task. Use the **real production** claim→permit→sender code, not a second test-only authorization route. Integrate Task 12's synchronous sender behind a strict coordinator-issued, journal-backed, **already spent** PublicationIntent permit, with complete DocumentKey/OwnerEpoch/nonce/composer digest and Cancel effect-obligation checks. A human initial Send remains separate.

**RED:** a controlled synthetic page with duplicate listeners, two same-chat tabs, redelivered permit, MV3 restart at reserve/deliver/click/ACK points, concurrent Cancel, user composer edit and navigation must expose the intended failure before integration; no click may be caused by a forged/unstored permit. **GREEN:** the **first actual `HTMLElement.click()`** is initiated by the sole elected content actor, **only** for a verified durable `PERMIT_OUTSTANDING` that has satisfied Task 13/14 prerequisites; all interleavings show ≤1 **actual click** per publication, ≤1 actual provider entry, no click/entry after `CANCELLED_ACK`, one exactly matched `OBSERVED_ACCEPTED`, Q/A-gated owner release and conservative quarantine for unknown. Count clicks and provider entries *separately from durable reservations*. A fixture may simulate Gemini rendering, but it **cannot** claim live Gemini semantics.

**REFACTOR:** deterministic scheduler with before/after admission, actor registration, actual click, observed input and settlement checkpoints; confirm no test-only bypass or second issuance path survives. **Verify:** packaged MV3 controlled Chromium `npm run test:browser:synthetic`, forced race orderings and reopen after worker kill, test actual DOM button invocation. **Commit:** `test: integrate authorized one-click synthetic loop with MV3 race proofs`. **Stop:** any duplicate/send-after-ACK, bypass, uncertain singleton or failed ownership/obligation proof ⇒ DP-04/05/06/07/14 BLOCKED; **do not run Task 18**. Safe synthetic-browser success is **not** proof of Gemini Web.


### Task 18 — Authenticated Gemini Web **unscored** E2E (first actual bridge publication)

**Files:** `tests/browser/live-gemini.spec.ts`, `docs/reports/phase-0-unscored-exploration.md` (only bounded synthetic/redacted evidence).

**Prerequisites:** explicit Execution Gate and company permission, verified Task 02 read-only DOM predicates and **Task 17 integrated click/Cancel proof**; freeze candidate for unscored exploration but **do not** claim formal evaluation readiness. Use manually authenticated separate test conversations, only synthetic data and no AWS/MCP/Bitbucket/cookie extraction. No live Bridge-result send was allowed by Tasks 01–17.

**Test:** one user-originated initial Send, then the actual **authorized** Gemini Bridge result click through Task 13's durable claim and Task 14's Cancel/Q/A barrier, and uninterrupted Gemini-selected `cost.summary` and possibly `ec2.metrics` follow-up. Require fresh assistant completion/causal predecessor, exact composer digest, actual click count, one bound `OBSERVED_ACCEPTED` and a final turn that may safely end online as `COMPLETE`. Same protocol and controller for S-A/B; only mock data differs. Force safe negative cases for navigation, duplicated callbacks, lost ACK and cancel/worker races; **no unsafe experiment may deliberately provoke a real duplicated click**.

**RED:** read-only/fixture evidence alone must not count as live proof, and negatives must fail closed. **GREEN:** record actual Gemini UI evidence supporting the specified predicates, separate from synthetic tests; a correct final response here is **not** counted as a formal PASS. **Stop immediately** if click is ignored/ambiguous, document/completion cannot be corroborated, company permission withdrawn, actual send duplicates or starts after ACK, an unknown result could reach the wrong chat, or sanitized evidence leaks sensitive text. If the selected `click()` primitive does not work, **BLOCKED** and return to independent Design review rather than substituting another UI mechanism. Record `INCONCLUSIVE` **only as an unscored feasibility/report decision**, never as a Run/Trial state. **Commit:** `test: preserve permitted unscored Gemini Web feasibility evidence` (sanitized synthetic-only).


### Task 19 — Formal Evaluation Baseline Freeze and **per-trial conversation isolation** (RG-004-PLAN-004)

**Files planned after Execution:** `evaluation/{manifest.json,trial-schedule.json}`, `evaluation/{prompts,fixtures,oracles,rubrics}/**`, `docs/reports/phase-0-evaluation-freeze.md`. These are future artifacts, **not** created during Plan Gate.

**Immutable freeze specification:** The manifest pins approved Requirements/Design/Plan blobs, **actual completed extension and harness implementation commit + file hashes**, browser/extension versions, observable Gemini mode (no invented backend model version), exact synthetic S-A/B fixtures, tool/result schema, prompt template/canonicalizer, completion/DOM contract, numeric **RunBudgetV1 unchanged from §1.2**, oracle/resource/cost values/tolerances, qualitative human rubric, timeout/retry accounting, adjudication and campaign safety-stop rules. A separate independent checkpoint approves byte-identical hashes **after** Execution Gate implementation/unscored exploration and **before** the first formal attempt.

**Formal trial isolation contract (no history reuse):**

1. Each frozen slot has a unique `CampaignId/TrialId`, preregistered S-A/B assignment, manifest SHA, planned attempt order/seed and **distinct, never previously trial-used `ConversationKey`**. Two slots may **never reuse** one Gemini conversation. No carry-over S-A→S-B chat or tool results.
2. Because Design §3.1 needs a **stable identifiable existing conversation**, prepare a **fresh, unused, corroborated saved conversation per slot**. If a neutral initial exchange is required solely to establish a conversation-specific route, the exact neutral seed prompt/response **contract and permissible canonical fingerprint** must be frozen for *every* slot before testing. It must contain **no prior trial task, mock evidence or tool instruction**. If this controlled state cannot be achieved/corroborated, **do not start that trial** and record a nonpassing preregistered slot; never silently switch to a reused/contaminated conversation.
3. Before acquiring Run owner, record `initialTranscriptFingerprint` over **ordered role + canonical content digests + turn count + completion flags**, excluding unavoidable per-chat IDs but keeping the separately recorded unique conversation key and document identity. Assert no bridge result/RunMarker/trial history already exists. The same frozen admissible transcript **shape and content contract** applies to S-A and S-B. Record empty/neutral-only state and fixture data-binding hash in the grader/harness-side manifest, with **no S-A/B expected branch or label sent to Coordinator**.
4. The user's initial prompt is still sent manually **once** per Design I0–I5 after owner claim; freeze its common template and allowed variable RunMarker/InitialInputCorrelationId fields, and journal exact submitted digest per slot. No manual per-turn intervention.
5. **Admit trial only if** initial conversation, transcript fingerprint, unique slot binding, fixture checksum, prompt/template, model mode and prior slot non-reuse all match frozen predicates. Failed preconditions do **not** create an executed Run; preserve `TrialAdmission=NOT_STARTED_INVALID_BASELINE` and make the preregistered slot **nonpassing**, with trial verdict eventually `INDETERMINATE` if evidence cannot be established by deadline. Do not count it as a successfully executed browser trial or replace it behind the scenes.

**Freeze/RED/GREEN:** commit actual candidate+manifest and verify by GitHub re-fetch; **RED** mismatched implementation hash, reused chat, different seed history, missing fingerprint or unpinned prompt must reject freeze/trial admission. **GREEN** verified byte-identical baseline and deterministic per-slot fresh-chat eligibility, not invented live success. **REFACTOR** none after freeze; any change starts a new campaign, preserving every old slot, including failures. **Commit:** `docs: pin implemented Phase 0 formal evaluation baseline and trial-isolation protocol` (future). **No formal trials until independent Freeze checkpoint and separate execution authorization.**


### Task 20 — Formal scored campaign, **immediate safety halt**, independent Decision Gate (RG-004-PLAN-006)

**Files planned:** `docs/reports/phase-0-formal-campaign-<campaign-id>.md`, `evaluation/results/**`, `tests/integration/campaign-safety-halt.test.ts`. Future files only.

**Preconditions:** explicit Execution Gate, independent post-implementation Formal Evaluation Baseline Freeze approval, frozen per-slot initial transcript isolation (Task 19), pre-registered **≥10 S-A and ≥10 S-B** attempt slots, RunBudgetV1 and a **durable campaign scheduler admission gate**. A scheduler state `CAMPAIGN_ACTIVE / CAMPAIGN_HALTED_SAFETY / CAMPAIGN_FINISHED` is separate from RunTerminal and FormalTrialVerdict. Slots independently record `SCHEDULED / STARTED / NOT_STARTED_SAFETY_HALT / NOT_STARTED_INVALID_BASELINE / FINISHED`.

**Procedure:** admit trials serially by fixed frozen order, each in its distinct, proven clean conversation with the same prompt/controller and only its synthetic data difference. Count every started failure, refusal, timeout, unsafe action and grading-`INDETERMINATE` in the preregistered slot records and denominator. Separate **planned slots vs actually STARTED browser trials**; a never-started slot cannot masquerade as an executed FAIL/PASS or be replaced/discarded. Independent Grader and optional frozen human rubric determine PASS/FAIL only after Run stops; non-PASS/unknown remain nonpassing in the frozen aggregate.

**Critical safety violation trigger (zero tolerance):** any **confirmed** duplicate actual mock-provider entry, duplicate actual bridge-result `click()`, new effect after `CANCELLED_ACK`, wrong-chat publication, stale owner epoch entering an effect, unauthorized network/real provider/secret exposure, or owner release despite unresolved Q/A. The supervising safety monitor records the reason, exact actor/intent/trial/time and **atomically persists `CAMPAIGN_HALTED_SAFETY` before any next trial admission**. Immediately block future starts, withdraw pending admissions and request Cancel/fencing for **all active Runs via the normal Coordinator authority**. For outstanding actors/permits, close new gates but **do not fake Cancel ACK or assume quiescence**; keep `INDETERMINATE` quarantine until legitimate Q/A proof. No “continue to collect sample size” after violation.

**Retention and denomination:** preserve immutable sealed/sanitized evidence for all prior and in-flight started attempts, including the violating trial and failure details. Future preregistered slots remain visible as `NOT_STARTED_SAFETY_HALT`, nonpassing for campaign decision, but **not counted as executed trials**. If the 10-per-scenario actual-run minimum was not reached, explicitly report it as unmet. **Confirmed safety breach forces independent Decision Gate `BLOCKED` regardless of pass percentage**, and forbids Phase 1. No deletion/replacement/reordering of failed or unstarted slots; a new revised run requires **a new approved campaign**, retaining prior historical evidence.

**RED:** inject on the third of 20 frozen slots a duplicate actual click or post-ACK provider entry; assert no fourth slot can be admitted, the first three remain recorded with statuses, the 17 unstarted slots remain distinguishable and visible, unsafe old actors remain quarantined and Decision cannot report PROVEN. Also force monitor crash/restart between safety flag and next admission (the scheduler's durable gate must win), privacy breach during evidence sealing and confirmation arriving while an earlier Run is active. **GREEN:** fail-stop scheduling is atomic, concurrent admissions cannot bypass halt, in-flight cancellation honors Q/A, evidence and denominator remain auditable. **REFACTOR:** deterministic scheduler failpoint harness. **Verify:** `tests/integration/campaign-safety-halt.test.ts` and permitted frozen live campaign evidence (no intentional dangerous fault injection on actual Gemini). **Commit:** `docs: record immutable Phase 0 formal campaign results` only after authorized execution.

**Formal success criteria:** at least **10 actually executed live trials per scenario**, ≥90% independent PASS **in each scenario**, no human per-turn assistance, **zero** critical safety violations. A completed formal campaign that cannot show these is **BLOCKED** on proven failure, or **INCONCLUSIVE** for missing proof under the separately reviewed Decision Gate rules. **No scored attempt is silently discarded, and no safety halt is represented as completing 20 actual browser trials.**


## 3. Design DP-01–18 → task → evidence matrix

| Design obligation | Planned Task(s) | Proof boundary / required artifact |
| --- | --- | --- |
| DP-01 Conversation identity | 02,06,07,18 | Real browser same-chat two-tab equality, different-chat inequality, route+visible corroboration |
| DP-02 Assistant completion and predecessor | 02,06,07,18 | Active→completed role/turn evidence, manual interruption negative |
| DP-03 Strict parser | 03,04,17 | Whole-turn grammar tests, multiple/quoted calls rejected |
| DP-04 Linearizable owner/epoch | 05,10,17,18 | IndexedDB transaction race, stale worker callback, one winner |
| DP-05 Provider dispatch at-most-once | 05,09,10,14,17,18 | Durable admitted-may-enter obligation, actual mock entries, positive not-entered or UNKNOWN, cancel interleavings |
| DP-06 Publication at-most-once | 02,11–14,17,18 | Tasks 12–14 **no-click** durable prerequisites; first authorized actual click only Task 17; Gemini first Task 18 |
| DP-07 Cancel vs actual UI send | 05,10,12–14,17,18 | Durable obligation/Q/A before first click; both actual click/dispatch race orders, zero post-ACK effects |
| DP-08 Safe result destination | 06,11,12,13,18 | Correct conversation/input binding even on navigation |
| DP-09 S-A/B vs final boundary | 08,09,16,18,20 | Online Q/A COMPLETE separate from independent oracle PASS |
| DP-10 Immutable evaluation | 19,20 | Post-implementation freeze, distinct per-slot conversations, preregistered initial transcript fingerprints and safety-halt statuses |
| DP-11 Threat/least authority | 01,03,04,08–11,15,17 | RunBudgetV1 numeric maximum values (§1.2), no network/secret rights, adversarial corpus |
| DP-12 Reproducible evidence | 01,15–17,18–20 | Trace hashes, typed EvidenceSealFailure, no state `INCONCLUSIVE`, immutable slots and safety stop |
| DP-13 User-sent initial Run handoff | 02,06,07,18 | Owner-first, exact prefill/input digest, first assistant causality |
| DP-14 Q/A recovery and quarantine | 13,14,17,18 | ISSUED without acceptance blocks release; positive Q & A only |
| DP-15 Grammar/example ambiguity | 04,08,17 | Embedded quote rejected, plain tool names never executed |
| DP-16 Synthetic mock correctness | 09,10,15 | Deterministic fixtures and actual evidence IDs; no external IO |
| DP-17 Online classifier | 03,04,08,17,18 | Four-way outcome; normal final without oracle; no implicit call |
| DP-18 Independent formal grader | 15,16,19,20 | Separate TrialRecord store, sealing PENDING→INDETERMINATE on deadline, human rubric, fresh-chat isolation and immutable denominator |

## 4. Issue #1 AC-01–12 → planned evidence matrix

| AC | Planned tasks | Required proof category |
| --- | --- | --- |
| AC-01 | 05,06,08,09,10,18 | Live current assistant request, one actual mock `cost.summary` entry |
| AC-02 | 11–14,17,18 | PublicationIntent + Q/A verified **before** first actual click in Task 17; real accepted result/next call in Task 18 |
| AC-03 | 08,15,16,18,20 | Correct grounded final **formal** oracle PASS after live Run |
| AC-04 | 18–20 | ≥10 **actually started** each scenario, distinct verified clean chats, immutable trial slots/denominators, ≥90% each or safe HALT |
| AC-05 | 04,06,08,17 | No partial/quoted/old/user/wrong-conversation/multi-call execution |
| AC-06 | 05,10,12–14,17 | Durable outstanding dispatch/send obligations, owner race, actual click/entry dedupe, restart and Cancel ACK ordering |
| AC-07 | 03,04,08,17 | Unknown tool, schema, quota, ambiguity and DOM drift fail closed |
| AC-08 | 06,10,12–14,17,18 | No wrong-chat publication; Cancel and failures/quarantine |
| AC-09 | 01,09,11,15 | Mock-only, no network/credentials/write access |
| AC-10 | 01–18 | Independent unit/DOM fixture/MV3/synthetic browser/**real Gemini** evidence |
| AC-11 | 15,18–20 | Versioned evidence/error codes and sanitized final snapshots; verified trial histories, initial conversation fingerprints and safety-halt reports |
| AC-12 | 01,04,11–15,17,20 | Threat model, prompt injection, provenance and recovery residual risks |

## 5. Scenario and negative-test fixtures to specify/freeze (not fixed now)

**S-A / S-B:** deterministic synthetic `cost.summary` with identical prompt/tool registry, varied suspicious EC2 evidence; `ec2.metrics` only when Gemini independently selects it. The fixture **label** and oracle-expected path are owned by evaluation harness/Grader; Coordinator receives **only data as a mock provider return**, not scenario identity. Specify fixed numeric amounts, units, timestamps, resource IDs, evidence IDs, savings assertions, accepted tolerance and supported conclusions in pre-freeze artifacts; do not fabricate an implementation hash at Plan Gate.

**Adversarial fixtures:** quoted code samples, two identical calls, JSON discriminator in prose/code, role spoofing, stalled partial stream, user interjection, same-title distinct chat, two same-chat tabs, stale worker epoch, duplicated content listeners, duplicate permit, composer drift, wrong frame, cancel exactly before/after actual click, lost worker ACK, ISSUED without observed acceptance, late accepted result, sealed-trace mutation, wrong numbers with correct evidence IDs, missing S-A follow-up, unnecessary S-B tool, refused model, human-rubric pending/failed and grading deadline expiry.

**Oracle anti-cheating invariant:** Runtime decisions can depend on authorized tool types, quotas, validated inputs, conversation/turn causal evidence and mock provider's **actual reply data for displaying it**, never a hidden fixture label or expected result. The offline Grader **may** use expected resource/cost/usage/path to assign PASS/FAIL. A safe but inaccurate Run can end `COMPLETE` and score `FAIL`.

## 6. Proof submission and independent review checklist

Every candidate Spike Plan/Execution evidence report must contain **separate**: approval IDs and immutable HEAD/blob, task ID/commit, actual command/test exit codes, RED→GREEN evidence, actor/owner/document epochs, DOM contract version, *actual* mock provider entry/click counts vs intents, duplicate/worker/cancel schedules, Q/A reconciliation and quarantine results, threat/privacy review, model mode/browser versions, trial number/fixture hash, final answer snapshot **scoreable but synthetic-only**, independent grader PASS/FAIL with rubric reasons, and residual unproven assumptions.

**Blocking conditions** (do not claim feasibility on unit tests or durable intent counts): inability to identify active conversation and the expected assistant predecessor; no reliable completion marker; ambiguous composer or multiple send actors; UI `click()` not constituting a stable observable issuance boundary; wrong-chat send; any duplicated actual click/actual provider entry; any effect after acknowledged Cancel; old owner or result that may act after release; secret/data leak; real API invocation; missing company permission; RunBudgetV1 violation; unverified conversation history reuse across formal trials; inability to preserve scoreable sanitized final answer; grading coupled to Run or scenario-labelled bridge branching; unreliable hashes or untracked trials; any critical safety violation demands immediate durable `CAMPAIGN_HALTED_SAFETY` and no subsequent admission.

**Plan Gate review must verify:** Tasks 01–20 cover DP-01–18 and AC-01–12, fix numerical RunBudgetV1 (§1.2) now, stage actual-send enablement only at Task 17, define dispatch admission/entry/UNKNOWN, isolate frozen formal conversations, classify seal errors and stop campaigns on safety breach; make unproven B-01–B-11 falsifiable, and preserve distinct Plan, Execution, post-implementation Freeze and Formal Decision gates. **Reviewing/approving this Plan is not authorizing Tasks 01–20.**

## 7. Current author self-review (documentation only)

- Requirements and approved Design **remain immutable**; this document is based on the exact review SHA.
- All planned source/test/fixture paths are **future** paths. Neither a source file nor an Implementation Plan nor a browser automation tool has been created/run at authoring time.
- Whole-turn parser, online `COMPLETE` vs formal trial PASS, independent ExecutionIntent/PublicationIntent, Cancel/Q/A, one-click and owner fencing remain distinct.
- Architecture-specific browser premise (exact DOM selectors, isolated-world singleton, click→acceptance behavior) is **unproven** and explicitly STOP-gated.
- Test strategies are stated as future RED/GREEN/REFACTOR steps; no test results are claimed.
- RG-004-PLAN-001–006 are **author-addressed only**: publication prerequisites, durable provider handoff, numeric NFR-02 budget, distinct trial conversation histories, typed sealing failure and durable safety halt; none is independently RESOLVED yet.
- Independent Spike Plan Gate review is **required**. No source implementation, UI experimentation, evaluation freeze or Phase 1 work may begin on self-review alone.

**Spike Plan Gate: NOT APPROVED. Execution Gate: NOT AUTHORIZED.**
