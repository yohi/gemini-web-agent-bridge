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

**Implement:** `parseRunRef()`, `parseDocumentKey()`, `validateBridgeMessageV1()`, `validateToolCallV1()`, typed `AssistantOutcome`, `RunTerminal`, `FormalTrialVerdict`, `ExecutionIntent` and `PublicationIntent`; distinct failed/unknown statuses and proof-bearing actor report types `ISSUED/NOT_ISSUED/OBSERVED_ACCEPTED`.

**RED:** missing version fields, unknown types, forged owner keys, unbounded string/depth and conflated `COMPLETE/PASS` compile/runtime tests fail. **GREEN:** exhaustive type guards with strict unknown-field rejection. **REFACTOR:** export discriminated unions and prove exhaustive switches. **Verify:** typecheck + `tests/unit/contracts.test.ts`. **Commit:** `feat: define Phase 0 authority and message contracts`.

### Task 04 — Strict whole-turn parsing and callLike inventory

**Files:** `src/protocol/{grammar,call-signature}.ts`, `tests/unit/grammar.test.ts`, `tests/dom/call-rendering.test.ts`, `tests/fixtures/assistant-call/**`.

**Implement:** `scanCallLike(fullBody,domStructure)`, `parseWholeTurnCall(structuredAssistantBody)`. Only one top-level `gemini-agent-call` block, strict JSON with `run_marker/responding_to/call_id/tool/arguments`; exact CRLF/newline/JSON-space normalizations and reserved-key inventory; reject quotes/examples, siblings, multiple calls including identical, duplicate JSON keys, unknown tool/invalid schema. No inferred calls from prose.

**RED:** bad quoted example, embedded JSON, second block, stale token and partial stream erroneously accepted by a permissive parser. **GREEN:** whole-turn parser and reserved-signature failure precedence. **REFACTOR:** fixtures for supported DOM renderers with versioned parser boundary. **Verify:** unit and DOM tests. **Commit:** `feat: enforce whole-turn single-call grammar`.

### Task 05 — IndexedDB transaction/journal owner and epoch

**Files:** `src/storage/{schema,journal,ownership}.ts`, `tests/integration/ownership-races.test.ts`, `tests/unit/journal.test.ts`.

**Implement:** `openJournal()`, `transactionallyAcquireOwner(conversationKey,runId)`, `readFencedOwner()`, `appendOrderedAuditEvent()`, `releaseOwnerIfSettled()`; use one transaction encompassing conversation coordination row and affected intent state; unique owner key, monotonic epoch and persisted callback generations. No `chrome.storage.local` read-then-write lock, no timeout stealing.

**RED:** Promise.all two-tab claim must never both succeed; injected IDB transaction failure or restart cannot grant stale epoch. **GREEN:** single winner/loser with committed ordering, fail closed after aborted transaction. **REFACTOR:** abstract transaction scheduler; keep invariant tests. **Verify:** unit + fault-injected integration, indexedDB reopen/recovery. **Commit:** `feat: journal linearizable conversation ownership`. **Stop:** cannot prove ownership transaction committed before permission → DP-04 BLOCKED.

### Task 06 — Versioned DOM identity and assistant causality adapter

**Files:** `src/dom/{identity,turns}.ts`, `tests/dom/{identity,completion,causality}.test.ts`, `tests/fixtures/gemini-dom/**`.

**Implement:** `observeConversationEvidence()` (route plus independent displayed-conversation corroboration), `validateDocumentBinding()`, `observeUserInputTurn()`, `observeAssistantActiveToCompleted()`, `attributeAssistantToExpectedInput()`, `invalidateOnNavigationOrMutation()`. Browser sender metadata, not content-declared document ID, is authority. No invented Gemini selectors; adapter is versioned from Task 02 observations.

**RED:** generic route/same title, wrong tab, unsaved chat, stale DOM, multiple messages, manual unrelated user input, stop/regenerate, stream pause and role spoof would previously be accepted. **GREEN:** immutable body/input digests and unique assistant predecessor or `BLOCKED`. **REFACTOR:** DOM contract version and mutation-observer lifecycle. **Verify:** fixture and cross-tab controlled browser tests. **Commit:** `feat: bind DOM conversation and completed assistant causality`. **Stop:** ambiguous role/completion/predecessor → DP-01/02 BLOCKED.

### Task 07 — User-sent first-prompt bootstrap, exclusive run launch

**Files:** `src/core/launch.ts`, `src/extension/ui.ts`, `src/dom/composer.ts`, `tests/integration/launch.test.ts`.

**Implement:** `prepareUserSentInitialPrompt()`, `deriveInitialPromptDigest()`, `armInitialInputExpectation()`, `recognizeManualFirstSend()`. I0–I5 sequence: owner acquired first; RunMarker and InitialInputCorrelationId preissued; exact tool grammar/catalog and user task journaled; unique composer prefilled; **human manually sends exactly once**, no extension auto-submit; observe exact user turn before accepting assistant. Subsequent manual interruption blocks run.

**RED:** prompt sent before owner, mutated initial prompt, wrong conversation, duplicate initial send, missing user-turn acknowledgment. **GREEN:** exact prefill/observed correlation only; no tool entry before I4. **REFACTOR:** separate pure prompt serialization from UI. **Verify:** tests and synthetic browser. **Commit:** `feat: implement single user-sent launch handoff`.

### Task 08 — Online classification and Run state machine (no oracle)

**Files:** `src/core/{classification,fsm,policy}.ts`, `tests/unit/{outcome,fsm,policy}.test.ts`.

**Implement:** `classifyCandidate()`, `authorizeCallCandidate()`, `transitionRun()`, `closeOnSafeFinal()`. Four outcomes `TOOL_CALL/FINAL_ANSWER/INVALID_OUTPUT/MODEL_REFUSAL` with precedence callLike → whole-turn valid call or invalid → explicit refusal → normal final; provisional `CALL_CANDIDATE` requires policy and durable intent before becoming authoritative `TOOL_CALL`. Normal substantive answer enters `FINAL_SAFETY_CHECK` and only after Q/A-safe settlement becomes **operational `COMPLETE`**, independent of correctness.

**RED:** final falsely accepted for malformed embedded call, refusal as final, oracle FAIL blocking a Q/A-safe Run, or fixture label choosing `ec2.metrics`. **GREEN:** classifier independent of `src/evaluation` with static import-boundary test; `FINAL_ANSWER` snapshot persisted once; no after-COMPLETE calls. **REFACTOR:** table-driven reducer/effect-free parsing. **Verify:** unit & static import boundary test. **Commit:** `feat: classify assistant outcome and safe online completion`.

### Task 09 — Offline deterministic mock provider

**Files:** `src/mock/{provider,fixtures}.ts`, `tests/unit/provider.test.ts`, `tests/fixtures/mock/{scenario-a,scenario-b}.json`.

**Implement:** `dispatchMockTool(tool,validatedArguments,fixtureData)`, `renderMockEvidence()`. Synthetic `cost.summary` chooses data variant; `ec2.metrics` accesses only predeclared fake resource IDs. Same tool catalog in both variants. Provider returns bounded evidence ID/provenance, typed cost/usage/time and structured failure without networking or file/secret access.

**RED:** nonallowed ID, missing evidence field, fixture-dependent hard-coded model follow-up and any `fetch`/network action must fail. **GREEN:** deterministic reproducible outputs, mock provider has no influence on Coordinator decisions. **REFACTOR:** fixture input schema/digests. **Verify:** no-network integration & provider fixture tests. **Commit:** `feat: add deterministic synthetic-only mock tools`.

### Task 10 — ExecutionIntent, actual dispatch and Cancel race

**Files:** `src/storage/effects.ts`, `src/core/coordinator.ts`, `src/core/cancel.ts`, `tests/integration/{execution-once,cancel-dispatch}.test.ts`.

**Implement:** `claimExecutionIntent()`, `admitActualProviderDispatch()`, `invokeExactlyOneMock()`, `closeEffectGatesOnCancelRequest()`. Intent is durably claimed once; **actual synchronous mock provider entry**, not reserve, is the dispatch effect boundary and serialized with owner/cancel. Unknown crash outcome ⇒ `INDETERMINATE`, never speculative retry.

**RED:** duplicated call callbacks, concurrent workers/owners, cancel between validation/claim/provider entry and post-ACK provider action. **GREEN:** count actual provider entries ≤1 and zero post-Cancel ACK starts; loss possible. **REFACTOR:** effect-gate fault scheduler. **Verify:** deterministic interleaving tests in both orderings and restarted worker. **Commit:** `feat: fence at-most-once provider dispatch and cancel`. **Stop:** any post-ACK provider entry → DP-05/07 BLOCKED.

### Task 11 — Exact result encoding, digest and safe composer observation

**Files:** `src/protocol/result-encoding.ts`, `src/dom/composer.ts`, `tests/dom/{result-encoding,composer-digest}.test.ts`.

**Implement:** `encodeToolResultV1()`, `canonicalizeSendableComposer()`, `verifyComposerPayloadDigest()`. Bridge-minted PublicationId, evidence ID, RunMarker and preissued `next_input_correlation_id`; escape HTML, fake tool calls, Markdown fences, fake system roles, control characters and Unicode without changing numeric truth. Snapshot exact actual sendable editor state; do not equate superficial innerText with submitted payload.

**RED:** malicious mock text injects executable call; composer has extra hidden text/attachment, user edit, alternative rich-editor serialization or oversized evidence. **GREEN:** immutable bounded canonical outgoing payload, exact digest-before-click or abort. **REFACTOR:** serializer version and golden digests. **Verify:** DOM fixture tests. **Commit:** `feat: bind quoted tool results to exact composer payload`.

### Task 12 — Singleton actual UI send actor (HIGH RISK, stop on failure)

**Files:** `src/dom/send-actor.ts`, `src/extension/content.ts`, `tests/integration/{send-singleton,nonce-races}.test.ts`, `tests/browser/probes/send.spec.ts`.

**Implement:** `registerSoleEffectActor(DocumentKey)`, `consumeNonceSynchronously()`, `issueComposerSendOnce()`. A document-scoped isolated-world singleton must be elected **before** listener registration; duplicate listener/document injection fails closed. Target exact trusted tab/frame/document/generation. Actor must synchronously verify nonce/owner/document/composer digest and call **one** bound enabled `sendControl.click()` with **no await/timer**. `tabs.sendMessage({documentId})` is **not** single-listener proof. `ISSUED` means one actual click invocation, `NOT_ISSUED` requires positive proof no click/no future actor, `OBSERVED_ACCEPTED` requires matching new user transcript turn (not Gemini backend guarantee).

**RED:** two content listeners, reinjection, duplicate permit messages, wrong frame, late owner epoch, edit immediately before click and click after actor retirement. **GREEN:** exactly one actor and click ≤1 per publication; zero mismatched composer sends. **REFACTOR:** one synchronous issuer critical section and independent audit hook. **Verify:** fault-injected controlled-browser plus permitted unscored real Gemini probe. **Commit:** `feat: enforce singleton one-click Gemini publication actor`. **Stop:** if click cannot reliably initiate send or uniqueness/actual click count cannot be established → DP-06/B-01/B-08 BLOCKED; never soften to “permit issued once”.

### Task 13 — Separate PublicationIntent and no-retry recovery

**Files:** `src/storage/effects.ts`, `src/core/coordinator.ts`, `tests/integration/{publication-once,publication-restart}.test.ts`.

**Implement:** `claimPublicationIntent()`, `reserveOneUiPermit()`, `recordActorOutcome()`, `reconcileAcceptedResultTurn()`. Atomic durable unique identity **independent** of ExecutionIntent. Preclaim before permit delivery. Parallel publishers, duplicate events and restart cannot mint a second nonce for same result; `ISSUED` ≠ accepted. Lost ACK/crash ⇒ `UNKNOWN`, no automatic re-publication. Outcome `OBSERVED_ACCEPTED` requires exactly one matching user-role turn in original conversation before arming next assistant predecessor.

**RED:** duplicate result-ready, two parallel publishers, worker crash before/after click without ACK, late accepted user turn, same evidence ID from independent runs. **GREEN:** ≤1 **actual click** per result, verified journal audit, no speculative second send. **REFACTOR:** assert unique record indexes and payload conflict reasons. **Verify:** integration and controlled browser. **Commit:** `feat: persist independent at-most-once result publication`.

### Task 14 — Cancel ACK and Q/A manual recovery/quarantine

**Files:** `src/core/{cancel,recovery}.ts`, `src/storage/ownership.ts`, `tests/integration/{cancel-ui-interleavings,recovery-quarantine}.test.ts`.

**Implement:** `requestCancel()`, `closeCancelAdmissionGate()`, `acknowledgeCancelIfSettled()`, `proveActorQuiescenceQ()`, `proveAcceptanceA()`, `reconcileRunWithoutReplay()`. `CANCEL_REQUESTED` immediately visible; `CANCEL_GATE_CLOSED` forbids new permits; `CANCELLED_ACK` waits until **all prior send actors cannot initiate future click**, and old `ISSUED` results are `OBSERVED_ACCEPTED` (or definitively `NOT_ISSUED`). Explicit owner release also requires **both Q and A**, with no outstanding execution. `ISSUED` with unknown acceptance ⇒ permanent same-chat quarantine unless independent positive proof arrives. No reset/timeout unlock.

**RED:** cancel between worker permit issuance and **actual click**, worker restart/lost ACK, quiescent actor with unknown page acceptance, late old result, manual Reset without proof. **GREEN:** *zero actual click/provider starts after confirmed Cancel ACK*; pending/unknown never falsely confirmed, stale owner never acquired. **REFACTOR:** share Q/A predicates between Cancel, Run terminal and reconciliation. **Verify:** ordered concurrency/fault test and permitted real browser probe. **Commit:** `feat: fence cancel ack and conservative Q-A recovery`. **Stop:** cannot prove content actor retirement/send settlement → DP-07/14 BLOCKED.

### Task 15 — Sanitized audit and **scoreable** sealed trace

**Files:** `src/evidence/{events,sealer,redaction}.ts`, `tests/unit/{redaction,seal-evidence}.test.ts`, `tests/integration/evidence-replay.test.ts`.

**Implement:** `emitSanitizedAuditEvent()`, `captureFinalAnswerSnapshot()`, `sealRunEvidence()`, `verifySealedEvidenceDigest()`. Append ordered synthetic-only owner/epoch, input/assistant correlations, DOM adapter version, provider entry count + bounded synthetic inputs/results, publication nonce/actual click/accepted user turn, Q/A proof, final answer canonical text and per-Run terminal reason. Compute stable canonical serialization, content hash and immutable manifest/blob refs. **Do not omit final-answer text/numbers needed to judge claims; do not save raw account sessions/private chat**. For live runs, only known synthetic protocol/result regions plus bounded test task/final text may be included after strict allowlist/redaction; unknown or personal content ⇒ sealing fails **INCONCLUSIVE**, not “redact it and still declare PASS”.

**RED:** missing final snapshot, missing actual effect evidence, altered trace hash, secret/cookie/token appearing in report or false-positive redaction that drops required cost fields. **GREEN:** offline Grader can replay full *synthetic* facts and provenance without accessing Gemini. **REFACTOR:** versioned trace schema, replay/hash stability. **Verify:** unit/integration and static privacy scan. **Commit:** `feat: seal redacted scoreable Phase 0 execution evidence`.

### Task 16 — Independent Grader and FormalTrialRecord

**Files:** `src/evaluation/{manifest,oracle,grader,adjudication}.ts`, `tests/unit/{oracle,grader}.test.ts`, `tests/integration/grader-restart.test.ts`.

**Implement:** `gradeSealedTrial()`, `recordHumanRubricJudgment()`, `compareAndSetFormalTrialVerdict()`. **Separate evaluation-only store** keyed by CampaignId/TrialId/ManifestSha, preregistered attempts, expected fixture label/next tool/ranges *only here*. Correctly grade S-A 2-call vs S-B 1-call, numeric/evidence accuracy and unsupported recommendations; optional frozen narrow human rubric yields `PENDING(HUMAN_REVIEW_REQUIRED)`; deadline without judgment ⇒ nonpassing trial `INDETERMINATE`. `PASS` only if operational Run safely `COMPLETE` and all oracle criteria pass. Duplicate grade callback/idempotent restart never alters Run/owner or causes a click.

**RED:** online `COMPLETE` with fabricated numbers being called PASS, S-A missing follow-up passing, S-B extra call passing, human pending being treated as PASS, grader writing to Run journal. **GREEN:** independent PASS/FAIL/INDETERMINATE, durable reason/rubric/reviewer. **REFACTOR:** strict runtime→evaluation import firewall and frozen rubric examples. **Verify:** grader tests + forbidden-import test. **Commit:** `feat: grade formal trials independently of runtime state`.

### Task 17 — End-to-end synthetic-browser and injected interleaving suite

**Files:** `tests/browser/synthetic-loop.spec.ts`, `tests/browser/synthetic-races.spec.ts`, `tests/fixtures/fake-gemini/**`, `tests/adversarial/**`.

**Implement/test harness:** controlled Gemini-like test page with deterministic *role/completion/navigation/composer* transitions and injected cancellation at named boundaries; actual packaged MV3 service worker/content script exercised. Synthetic page **does not prove the real Gemini DOM**, so report it separately. Force two same-chat tabs and different-chat tabs; duplicate listeners/messages; multiple calls, quoted fake JSON, prompt-injected mock data; cancelled dispatch/actual click; worker termination at claimed/issued/accepted points; Q/A quarantine, online normal final, separate grader queue fail.

**RED:** at least one reproducible old-contract unsafe interleaving fails (fault-injected). **GREEN:** no unsafe provider entry, no duplicate actual click, no post-ACK effect, wrong-chat sends zero, unreconciled effect never released. **REFACTOR:** deterministic interleaving scheduler & audit. **Verify:** `npm run test:browser:synthetic`, run with two independent seeds/schedules. **Commit:** `test: cover synthetic browser tool loop and MV3 races`.

### Task 18 — Authenticated Gemini Web **unscored** exploratory E2E and feasibility stop

**Files:** `tests/browser/live-gemini.spec.ts`, `docs/reports/phase-0-unscored-exploration.md` (only synthetic redacted evidence).

**Preconditions:** separate explicit execution permission recorded, company UI automation permission recorded, manually authenticated disposable/test conversations with **synthetic mock data only**. No browser login automation, company documents, real AWS, personal conversation capture, screenshots of real account contents or CI secrets.

**Test:** one manual initial user Send, then **uninterrupted** Gemini-selected calls to `cost.summary` and perhaps `ec2.metrics` with accepted bridged result user-turn and final response; vary mock evidence between S-A/B with **identical** bridge prompt/logic. Observe actual role completion, causal predecessor, UI send click and unique `OBSERVED_ACCEPTED`. Inject navigation, wrong chat, Cancel races, duplicate events and worker restarts. Assert DP-01/02/04/05/06/07/08/13/14/17 on real page.

**RED:** explicit negative cases fail closed, and report failed assumptions; **GREEN** means evidence supports the planned browser hypotheses, not a formal PASS rate or production guarantee. **Stop immediately** on any unauthorized, duplicate or post-ACK actual effect, inability to establish unique completion/conversation/actor, evidence leakage or company policy denial. Record `BLOCKED` if safety contract fails, `INCONCLUSIVE` for insufficient/permission evidence. No opportunistic prompt tweaks within formal campaign. **Commit:** `test: preserve permitted unscored Gemini feasibility evidence` or separate historical BLOCKED report if unsuccessful.

### Task 19 — Formal Evaluation Baseline Freeze checkpoint (**after candidate implementation**)

**Files planned after Execution:** `evaluation/manifest.json`, `evaluation/prompts/**`, `evaluation/fixtures/**`, `evaluation/oracles/**`, `evaluation/rubrics/**`, `evaluation/trial-schedule.json`, `docs/reports/phase-0-evaluation-freeze.md`.

**Pre-freeze specification:** immutable JSON manifest includes Design/Requirements/Plan blob IDs, **actual built implementation and harness commit SHA + file blob IDs**, browser/extension version, observable Gemini mode (do not fabricate inaccessible backend model pin), exact S-A/B fixtures and IDs/numbers, tool call/result schema, exact prompt/format, role/DOM contract version, all adjudication examples/rubric, timeouts, retry accounting, failure taxonomy, per-trial order, budget/stop rules and human reviewer criteria. Manifest hash is verified by an independent checkpoint reviewer.

**Freeze procedure:** after all permitted unscored tasks, commit candidate and manifest; re-fetch hashes from GitHub; formally approve **this separate checkpoint** before any scored attempt. **RED:** mismatch or unpinned prompt/fixture/code, pre-registered denominator absent ⇒ refuse freeze. **GREEN:** byte-identical verified baseline. **REFACTOR:** none after freeze; any change creates **new campaign** with historical attempts preserved. **Commit:** `docs: pin implemented Phase 0 formal evaluation baseline` (future, **not now**). Formal scoring is **not authorized by Plan Gate alone**.

### Task 20 — Formal scored campaign, independent Decision Gate report

**Files planned:** `docs/reports/phase-0-formal-campaign-<campaign-id>.md` plus synthetic-only hash-verified run evidence, `evaluation/results/**`.

**Procedure:** Execute **at least 10 frozen live-browser trials S-A and 10 S-B** with unchanged prompt/catalog/bridge; no human per-turn help. Trial slots precommitted; count failures, refusals, timeouts and retries in original denominator. Require ≥90% **independently graded PASS per scenario**, zero safety violations across formal and adverse tests. Human adjudication occurs offline with frozen rubric; PENDING past deadline ⇒ `INDETERMINATE` nonpassing. Unit/fixture/synthetic-browser success never substitutes for live-Gemini evidence.

**RED:** a deliberately incorrect answer, unnecessary tool, missing evidence/graded human response, mismatch in campaign SHA or unsafe send never passes; **GREEN:** independent signed-off report with exact results and hashes. **REFACTOR:** none within frozen campaign. **Commit:** `docs: record immutable Phase 0 formal feasibility results`, only after separate execution + freeze authorization. **Independent Decision Gate:** PROVEN only if all contractual AC and thresholds supported; BLOCKED on demonstrated violation; INCONCLUSIVE for missing/ambiguous proof. Only PROVEN permits *proposing* Phase 1, not starting real integrations automatically.

## 3. Design DP-01–18 → task → evidence matrix

| Design obligation | Planned Task(s) | Proof boundary / required artifact |
| --- | --- | --- |
| DP-01 Conversation identity | 02,06,07,18 | Real browser same-chat two-tab equality, different-chat inequality, route+visible corroboration |
| DP-02 Assistant completion and predecessor | 02,06,07,18 | Active→completed role/turn evidence, manual interruption negative |
| DP-03 Strict parser | 03,04,17 | Whole-turn grammar tests, multiple/quoted calls rejected |
| DP-04 Linearizable owner/epoch | 05,10,17,18 | IndexedDB transaction race, stale worker callback, one winner |
| DP-05 Provider dispatch at-most-once | 09,10,17,18 | **Actual mock provider entries** and cancel interleavings |
| DP-06 Publication at-most-once | 02,11,12,13,17,18 | **Actual single click**, singleton registry, composer digest, lost ACK |
| DP-07 Cancel vs actual UI send | 10,12,14,17,18 | Both race orders, zero click/provider entry after ACK |
| DP-08 Safe result destination | 06,11,12,13,18 | Correct conversation/input binding even on navigation |
| DP-09 S-A/B vs final boundary | 08,09,16,18,20 | Online Q/A COMPLETE separate from independent oracle PASS |
| DP-10 Immutable evaluation | 19,20 | Post-implementation freeze approval and fixed attempts |
| DP-11 Threat/least authority | 01,04,09,11,15,17 | No real provider/network/secret rights; adversarial corpus |
| DP-12 Reproducible evidence | 01,15,17,18,20 | Trace hashes, exact commands, per-AC evidence categories |
| DP-13 User-sent initial Run handoff | 02,06,07,18 | Owner-first, exact prefill/input digest, first assistant causality |
| DP-14 Q/A recovery and quarantine | 13,14,17,18 | ISSUED without acceptance blocks release; positive Q & A only |
| DP-15 Grammar/example ambiguity | 04,08,17 | Embedded quote rejected, plain tool names never executed |
| DP-16 Synthetic mock correctness | 09,10,15 | Deterministic fixtures and actual evidence IDs; no external IO |
| DP-17 Online classifier | 03,04,08,17,18 | Four-way outcome; normal final without oracle; no implicit call |
| DP-18 Independent formal grader | 15,16,19,20 | Separate TrialRecord store, human PENDING, frozen oracle/denominator |

## 4. Issue #1 AC-01–12 → planned evidence matrix

| AC | Planned tasks | Required proof category |
| --- | --- | --- |
| AC-01 | 05,06,08,09,10,18 | Live current assistant request, one actual mock `cost.summary` entry |
| AC-02 | 11–13,17,18 | One actual result UI click, correct accepted input, Gemini-chosen second call |
| AC-03 | 08,15,16,18,20 | Correct grounded final **formal** oracle PASS after live Run |
| AC-04 | 18–20 | ≥10 each scenario, frozen prompts, exact denominators, ≥90% each |
| AC-05 | 04,06,08,17 | No partial/quoted/old/user/wrong-conversation/multi-call execution |
| AC-06 | 05,10,12–14,17 | Owner race, execution/publication dedupe, restart and cancel sequencing |
| AC-07 | 03,04,08,17 | Unknown tool, schema, quota, ambiguity and DOM drift fail closed |
| AC-08 | 06,10,12–14,17,18 | No wrong-chat publication; Cancel and failures/quarantine |
| AC-09 | 01,09,11,15 | Mock-only, no network/credentials/write access |
| AC-10 | 01–18 | Independent unit/DOM fixture/MV3/synthetic browser/**real Gemini** evidence |
| AC-11 | 15,18–20 | Runtime/browser version, code/blob manifest hashes, trial logs, result reports |
| AC-12 | 01,04,11–15,17,20 | Threat model, prompt injection, provenance and recovery residual risks |

## 5. Scenario and negative-test fixtures to specify/freeze (not fixed now)

**S-A / S-B:** deterministic synthetic `cost.summary` with identical prompt/tool registry, varied suspicious EC2 evidence; `ec2.metrics` only when Gemini independently selects it. The fixture **label** and oracle-expected path are owned by evaluation harness/Grader; Coordinator receives **only data as a mock provider return**, not scenario identity. Specify fixed numeric amounts, units, timestamps, resource IDs, evidence IDs, savings assertions, accepted tolerance and supported conclusions in pre-freeze artifacts; do not fabricate an implementation hash at Plan Gate.

**Adversarial fixtures:** quoted code samples, two identical calls, JSON discriminator in prose/code, role spoofing, stalled partial stream, user interjection, same-title distinct chat, two same-chat tabs, stale worker epoch, duplicated content listeners, duplicate permit, composer drift, wrong frame, cancel exactly before/after actual click, lost worker ACK, ISSUED without observed acceptance, late accepted result, sealed-trace mutation, wrong numbers with correct evidence IDs, missing S-A follow-up, unnecessary S-B tool, refused model, human-rubric pending/failed and grading deadline expiry.

**Oracle anti-cheating invariant:** Runtime decisions can depend on authorized tool types, quotas, validated inputs, conversation/turn causal evidence and mock provider's **actual reply data for displaying it**, never a hidden fixture label or expected result. The offline Grader **may** use expected resource/cost/usage/path to assign PASS/FAIL. A safe but inaccurate Run can end `COMPLETE` and score `FAIL`.

## 6. Proof submission and independent review checklist

Every candidate Spike Plan/Execution evidence report must contain **separate**: approval IDs and immutable HEAD/blob, task ID/commit, actual command/test exit codes, RED→GREEN evidence, actor/owner/document epochs, DOM contract version, *actual* mock provider entry/click counts vs intents, duplicate/worker/cancel schedules, Q/A reconciliation and quarantine results, threat/privacy review, model mode/browser versions, trial number/fixture hash, final answer snapshot **scoreable but synthetic-only**, independent grader PASS/FAIL with rubric reasons, and residual unproven assumptions.

**Blocking conditions** (do not claim feasibility on unit tests): inability to identify active conversation and the expected assistant predecessor; no reliable completion marker; ambiguous composer or multiple send actors; UI `click()` not constituting a stable observable issuance boundary; wrong-chat send; any duplicated actual click/actual provider entry; any effect after acknowledged Cancel; old owner or result that may act after release; secret/data leak; real API invocation; missing company permission; inability to preserve scoreable sanitized final answer; grading coupled to Run or scenario-labelled bridge branching; unreliable hashes or untracked trials.

**Plan Gate review must verify:** Tasks 01–20 cover DP-01–18 and AC-01–12, make all unproven B-01–B-11 falsifiable, specify implementation interfaces and failure codes without weakening Design, and preserve the explicit distinct permissions for Plan, Execution, post-implementation Freeze and Formal Decision. **Reviewing/approving this Plan is not authorizing Tasks 01–20.**

## 7. Current author self-review (documentation only)

- Requirements and approved Design **remain immutable**; this document is based on the exact review SHA.
- All planned source/test/fixture paths are **future** paths. Neither a source file nor an Implementation Plan nor a browser automation tool has been created/run at authoring time.
- Whole-turn parser, online `COMPLETE` vs formal trial PASS, independent ExecutionIntent/PublicationIntent, Cancel/Q/A, one-click and owner fencing remain distinct.
- Architecture-specific browser premise (exact DOM selectors, isolated-world singleton, click→acceptance behavior) is **unproven** and explicitly STOP-gated.
- Test strategies are stated as future RED/GREEN/REFACTOR steps; no test results are claimed.
- Independent Spike Plan Gate review is **required**. No source implementation, UI experimentation, evaluation freeze or Phase 1 work may begin on self-review alone.

**Spike Plan Gate: NOT APPROVED. Execution Gate: NOT AUTHORIZED.**
