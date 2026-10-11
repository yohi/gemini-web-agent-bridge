# Phase 0 Requirements — Gemini Web Autonomous Tool Loop

| Field | Value |
| --- | --- |
| Status | **DRAFT / NOT APPROVED** |
| Authority | [Issue #1](https://github.com/yohi/gemini-web-agent-bridge/issues/1) |
| Stage | Requirements Gate only |
| Date | 2026-10-11 (JST) |
| Platform | Chrome Manifest V3 / Gemini Web |

> This document is a reviewable requirements draft. It does **not** authorize Design, implementation, AWS access, releases, or Phase 1.

## 1. Purpose and constraints

The intended product lets a user ask **Gemini Web** to investigate AWS waste or Bitbucket source/PRs, decide which read-only tools to use next from evidence returned, and finish with a grounded answer, **without requiring Gemini API or other paid AI services**.

**Phase 0 tests only the Gemini Web ↔ Chrome extension autonomous loop, using deterministic mock tools.** Superpower is a reference for failure modes, not a codebase to fork or a wire protocol to preserve.

Key constraints:

- **Gemini Web is the only LLM**. No Gemini API, AI Studio Agents, Bedrock, other AI models, or added AI usage charges.
- Chrome MV3 + TypeScript; operate through permitted Gemini Web UI, not reverse-engineered Gemini backend endpoints or stolen account credentials.
- The site DOM, model format compliance and Google UI behavior are *not* stable API contracts; the design must account for this uncertainty.
- The repository is public. Never publish real AWS invoices, company repository data, secrets, tokens, or real user conversations.
- Respect organization policies and applicable service terms. If the enterprise browser-extension or automation policy is unknown, actual use must stop pending approval.

## 2. Scope

**In scope:** Model instructions / tool contract presentation; completed assistant-turn detection; explicit structured call parsing and validation; mock tool provider; user-initiated bounded autonomous loop; tool result publication into the originating conversation; session / turn / call binding; persistence needed for deduplication; observable diagnostics; regression and real-browser proof.

**Out of scope:** Real AWS, Bitbucket or Atlassian integrations; MCP authentication; AWS CLI/SSO; production native host/Native Messaging; paid external APIs; file or cloud mutation; background unsupervised execution; production reliability claims. Transport selection belongs to Design and later phases, not this Requirements Gate.

### 2.1 Required demo

```text
User starts authorized run: "Find waste in these mock AWS cost records"
Gemini assistant turn → explicit request for cost.summary
Extension verifies owner, completion, syntax, policy, and duplicate status
Mock cost.summary → deterministic cost data and evidence identifiers
Extension publishes bounded, attributed result into same conversation
Gemini uses evidence → explicit request for ec2.metrics
Mock ec2.metrics → deterministic utilization evidence
Gemini answers, citing evidence from both calls
```

After the user starts the run, **no manual JSON correction, copying tool results, re-submitting each turn or hand-executing tools** may be needed. A user may explicitly initialize the browser environment and approve the run before it begins.

The extension must **not hard-code which tool Gemini requests next**. The desired tool sequence is induced by evidence, not by hidden scripted extension logic. If Gemini does not choose the appropriate next action, the trial is counted as a failure.

### 2.2 Paired contrasting scenarios (RG-002-REQ-002)

A pre-registered **paired, deterministic scenario suite** must show that the model's next action varies according to mock evidence while **the user prompt, instructions, tool catalog, canonical protocol, policies and extension control flow stay identical**. Only the mock data differ:

| Scenario | Synthetic evidence | Pass behavior |
| --- | --- | --- |
| **S-A / investigate** | `cost.summary` identifies a specific EC2 resource requiring more investigation by a predefined rule | Gemini requests `ec2.metrics` for that resource, uses its returned evidence and finishes with a grounded conclusion |
| **S-B / do not investigate** | `cost.summary` identifies no EC2 resource that meets that rule and provides evidence supporting a negative conclusion | Gemini does **not** request `ec2.metrics`, finishes without the second call and explains its conclusion using the first tool's evidence |

S-A and S-B use distinct, precommitted mock fixtures. Their thresholds, relevant resource IDs, cost/usage quantities, expected call arguments and evidence IDs are specified before scored trials. The bridge may validate proposed calls but **must not see the fixture label as a branch instruction, issue predetermined calls, or fabricate evidence**. A fixed two-call implementation cannot pass both scenarios. An unnecessary second call in S-B fails that trial, even if the final prose sounds correct.

### 2.3 Grounded-answer evaluation oracle (RG-002-REQ-003)

Before formal evaluation, commit an **independent deterministic oracle per fixture** that decides whether Gemini's final answer is grounded. Every success must satisfy **all** of:

1. **Provenance:** Correct evidence IDs from the mock provider calls **actually executed**, with no fictitious tool result. S-A references both calls; S-B references only `cost.summary`.
2. **Resources and numbers:** Correct resource identity, principal cost/usage amounts, currency/units and time windows, allowing only predetermined, documented rounding tolerances.
3. **Supported reasoning:** Correct evidence-based **investigate / no-follow-up** conclusion under the predeclared decision rule; recommendations must not contradict the evidence.
4. **No material fabrication:** No invented resource, unsupported savings estimate, fabricated CloudWatch/EC2 measurement, or claim that a real AWS account was accessed.
5. **Independent grading:** Machine-check numerical/identifier fields and execution traces; where language judgement is unavoidable, freeze a narrowly defined human adjudication rubric and passing/failing examples beforehand. Do **not** use another LLM or Gemini self-grading to determine acceptance.

Merely naming both evidence IDs does not pass if numbers, resources or the conclusion are wrong. Trial-level oracle outcome and the reasons for failure must be recorded.

## 3. Trust and identity boundaries

| Boundary | Required guarantee |
| --- | --- |
| Browser tab | A tab is not a unique conversation. Never infer owner solely from tab ID. |
| Conversation | Establish and re-check conversation identity before execution and immediately before result submission; ambiguous or changed identity ⇒ fail closed. **At most one active run may own the conversation** within a coordinated bridge installation. |
| User run | A user explicitly enables an action scope, allowed tool set, resource/time budgets, start/stop. Model output cannot expand authorization. |
| Assistant turn | Only a new, completed assistant message in the authorized run may supply a candidate tool call. |
| Tool call | Bind to run, conversation, origin turn and unique call identity; an ID reused in another scope is not the same call. |
| Result | Bind to actual provider execution and evidence ID; never accept model-invented results as executed results. |
| Host/execution | Untrusted page/model text must pass parser, schema and independent policy authorization before reaching a provider. |

All page DOM, Gemini text, retrieved content and future tool results are **untrusted inputs**; the model may propose a tool but cannot itself grant permission to use it.

### 3.1 Exclusive conversation ownership (RG-002-REQ-001)

- **One owner:** Across Chrome tabs, windows, MV3 worker incarnations and extension contexts in a single coordinated bridge installation/browser profile, a Gemini conversation may have **at most one active run**. Two simultaneous start attempts for the same conversation cannot both succeed; the loser fails visibly without tool dispatch or UI submission.
- **Atomic acquisition and release:** Claiming, renewing, revoking, releasing and recovering the conversation owner must be authorized by **one linearizable coordination boundary** with durable ownership evidence. A tab-local `if (!activeRun)` check is insufficient. Specific transaction/storage primitives belong to Design.
- **Fenced generations:** Each ownership incarnation has a unique, monotonically distinguishable generation/epoch. Pre-dispatch and pre-UI-send effect gates must reject stale owners, including after worker restart, competing acquisition, tab replacement, cancel or terminal transition.
- **Safe succession:** Do not reassign ownership while an earlier invocation or UI submission could still start an effect. Lease timeout alone is not evidence of quiescence. When prior execution/publication is uncertain, the conversation stays blocked until explicitly reconciled.
- **Feasibility scope:** A local Chrome extension cannot guarantee exclusion across uncoordinated devices/profiles. Phase 0 **prohibits concurrent automated use in multiple installations**, documents residual risk, and fails closed where locally observable ownership cannot be proven. Do not claim account-global exclusivity.
- **Required interleavings:** Test dual-tab starts in the *same conversation*, MV3 worker restart during owner acquisition, ownership turnover and old-owner callbacks trying to dispatch or send after a new epoch. Report which owner won, both effects counts, and the authority's persisted ordering.


## 4. Functional requirements

| ID | Requirement | Issue AC |
| --- | --- | --- |
| FR-01 | Bind each run to one originating Gemini conversation; **atomically acquire its unique active owner** across tabs, fence generations on restart/turnover, and fail closed on uncertain ownership or identity. | 01–03,05,06,08 |
| FR-02 | Detect assistant-turn **completion** with evidence; a quiet/stalled stream or partially rendered tool call must never trigger execution. | 01,05 |
| FR-03 | Parse only designated structured calls from the authorized, completed assistant turn; exclude quoted/examples, older turns, user/tool results. **At most one executable candidate per turn; ≥2 candidates, even identical or nonconflicting, fail closed.** | 01,05,07 |
| FR-04 | Define one canonical minimal tool-call schema in Design; type-check all arguments, specify any bounded syntax normalization, and reject conflicts rather than guessing intent from prose. | 01,07 |
| FR-05 | Enforce allowlisted mock tools `cost.summary` and `ec2.metrics`, schema validation, explicit run permission and size/time/call quotas **before** execution. | 01–03,07,09 |
| FR-06 | Mock tools return deterministic synthetic data, error classifications and evidence IDs. They do not read local secrets or access external services. | 01–03,09 |
| FR-07 | Prevent duplicate call execution across events/rerenders/reloads. Record durable intent, fence owner generation and **serialize actual provider dispatch with cancel confirmation**. Uncertain completion ⇒ `INDETERMINATE` with no auto replay. | 01,06,08 |
| FR-08 | Bound, attribute and escape tool results. Publish only to originating conversation, **fencing identity/owner and cancel against actual UI send issuance**, not only an earlier check. | 02,03,08 |
| FR-09 | Continue after published evidence and accept either model-selected further tool use or evidence-supported completion **per S-A/S-B**, scoring final answers against a frozen, independent oracle. | 02–04 |
| FR-10 | Expose start, progress, cancel, safe-stop. **Acknowledged cancellation is an irrevocable fence** against starting further provider dispatch or UI send; model cannot expand permission or limits. | 06–09 |
| FR-11 | Distinguish clean completion, model refusal, invalid output, malformed DOM, timeout, transport failure, navigation, reload and user cancellation. | 06–08 |
| FR-12 | Emit sanitized call/policy/run/turn identity, **conversation owner epoch and cancellation/dispatch/send ordering**, state changes, execution count, publication and failure evidence. | 04,06,08,10–12 |
| FR-13 | Require both S-A and S-B evidence-contrasting autonomous outcomes, without extension-side hard-coded tool sequencing. | 02–04 |
| FR-14 | Pass final answers only when a precommitted deterministic oracle confirms executed evidence, correct entities/numbers and supported conclusion, with no material hallucination. | 03,04 |
| FR-15 | Reject an assistant turn with ≥2 executable call candidates **even if identical**, without batching or partial acceptance. | 05,07 |
| FR-16 | Freeze exact prompts, instructions, protocol, schemas, fixtures, oracles, observable Gemini mode, retry rules, budgets, order and scoring in immutable artifacts before scored tests. | 04,10,11 |
| FR-17 | Serialize acknowledged cancellation with provider-dispatch commit and UI-send issuance; reject calls queued after cancel/owner revocation and test both race orderings. | 06,08 |
| FR-18 | Use a durable, atomic conversation ownership authority and fenced epochs across tabs and worker restarts, without unsafe automatic takeover. | 05,06,08 |
| FR-19 | In-flight checks do not authorize effects after cancel/ownership changes; effects must cross a fresh, serialized gate at actual dispatch/send issuance. | 06,08 |

## 5. Non-functional / security requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Phase 0 mock providers have no external networking, OS command execution, storage mutation or credentials. |
| NFR-02 | Every run has finite **max calls, model turns, elapsed time, request bytes and result bytes**, frozen in Spike Plan. No unbounded automatic retry. |
| NFR-03 | Neither page text nor tool output can trigger arbitrary code execution, dynamic URL fetch or unallowlisted tool selection. |
| NFR-04 | On unknown DOM contract, ambiguous role, multiple candidate conversations, **≥2 tool call candidates even if identical**, or unknown origin, stop **fail closed** with a visible reason. |
| NFR-05 | Seek **at-most-once execution initiation per validated call**, not an unprovable exactly-once external side effect. After a crash with uncertain outcome, never silently replay. |
| NFR-06 | Prevent prompt/tool-output injection from crossing policy boundary. Treat results as data, escaping/sandboxing any content that resembles a tool call or an instruction. New model proposals still require independent validation. |
| NFR-07 | Keep public fixtures synthetic and redact event logs. Do not store full raw chat transcripts, sensitive URLs, company content or credentials by default. |
| NFR-08 | Every actual UI send must be authorized at its issuance boundary, serialized with cancel acknowledgment and ownership revocation. No queued/stale/late action may issue a send afterward. |
| NFR-09 | Distinguish unit, fixture, extension integration and live Gemini Web E2E evidence; one cannot substitute for another. |
| NFR-10 | AWS API charges, billing data handling and region/organization access are future-phase concerns and require a separate explicit gate; Phase 0 uses no paid external API. |
| NFR-11 | One coordinated bridge installation may have **no more than one active owner per conversation**, with atomic acquisition and stale-epoch fencing. |
| NFR-12 | A completed assistant turn may carry **zero or one** executable tool call; ≥2 causes rejection of all calls. |
| NFR-13 | Once Cancel is **acknowledged**, **no new provider invocation or Gemini UI send may begin** for the canceled run. A precommitted in-flight effect may finish but cannot be undone or misrepresented as rolled back. |
| NFR-14 | Formal evaluation oracles are external to Gemini, deterministic where possible and frozen in the baseline. |

### 5.1 Mandatory negative tests

| Failure / threat | Required behavior |
| --- | --- |
| Partial model stream or unclosed structure | No execution |
| Quoted/illustrative JSON; user content; stale assistant turn | No execution |
| Tool result containing malicious instructions or call-shaped text | Never treated as an authoritative command |
| Cross-tab or cross-conversation change | No execution or result leakage to wrong chat |
| Duplicate DOM observation or call ID reuse | No double execution |
| Reload/crash while executing or publishing | No automatic re-execution; surface uncertainty |
| Unsupported tool, invalid arguments, malformed syntax | Reject with no provider call |
| Output too large, missing evidence provenance | Stop safely, no silent truncation that changes meaning |
| User cancel followed by late completion | Do not publish or restart |
| Same conversation, two tabs start simultaneously | Only one active owner; losing tab cannot dispatch/send |
| MV3 restart or stale generation during owner takeover | Stale owner rejected at effect boundary; no unsafe timeout takeover |
| Two valid tool candidates in one response, even identical | Reject all; do not batch or arbitrarily pick one |
| Cancel between validation and provider dispatch | If cancel linearizes first, no dispatch |
| Cancel between publication ownership check and UI send issuance | If cancel linearizes first, no send |
| Owner revocation while provider/send is queued | No stale-owner effect |
| S-B cost evidence with no EC2 worth investigating | No `ec2.metrics`; final answer matches oracle |
| Correct evidence IDs but wrong cost/resource/conclusion | Oracle fails answer |
| Gemini refuses/ignores protocol or hallucinates result | Record failure, never mark successful |

## 6. State-machine invariants

The Design must specify transitions, durable ownership and recovery for at least these conceptual states:

```text
IDLE → AWAITING_MODEL → VALIDATING → EXECUTING
                                      ↓
                              PUBLISHING_RESULT
                                      ↓
                              AWAITING_MODEL → COMPLETE

Fault / cancellation → BLOCKED | CANCELLED | INDETERMINATE
```

Required invariants:

1. No invocation before completion, ownership verification, parser validation, schema validation and authorization.
2. No duplicated provider execution from DOM rerender or bridge retry.
3. Before crossing the execution boundary, durable intent and duplicate-prevention ownership are established (concrete storage and atomicity remain Design decisions).
4. Crash during execution or uncertain result publication never causes speculative automatic replay.
5. Results are published only after ownership re-check; late completion after cancellation cannot leak into new run.
6. Each terminal state has a visible reason, audit evidence, and explicitly defined manual recovery behavior.
7. Conversation ownership, cancellation acknowledgment, actual provider dispatch and UI send initiation must have defensible **single ordering points** across cooperating contexts.
8. Preliminary validation, a tab-local boolean or stale permission snapshot **does not authorize later effects** if cancel or ownership revocation has committed.

### 6.1 Cancel-versus-effect linearization (RG-002-REQ-006)

- A user may request cancellation at any time. **Cancellation is confirmed/acknowledged only after a persistent, authoritative transition irrevocably closes both provider-dispatch and Gemini-UI-send gates for that run.** A button click that merely schedules asynchronous cancellation is a pending request, not the acknowledgment.
- Actual **provider invocation issuance** must serialize with cancellation and conversation owner revocation. If cancellation linearizes first, no invocation occurs. If dispatch linearizes first, the operation may finish, but cancellation prevents new publication and further calls.
- Actual **Gemini UI send issuance** must also serialize with cancellation and owner revocation at the last effective action boundary, not merely an earlier conversation recheck. If cancel linearizes first, zero new sends. If send linearizes first, report that it was already issued/in-flight; do not claim it was undone.
- If Chrome content script/background communication cannot establish this ordering for real UI event issuance, fail closed and classify it as a **Design/Spike blocker**, rather than weakening the contract.
- Pending callbacks, queued messages and late completions must not re-open a canceled run. If dispatch or publication status cannot be reconciled, mark `INDETERMINATE` and prohibit unsafe automatic ownership turnover.
- **Mandatory concurrency tests:** force both orders of (a) validation/cancel/dispatch, (b) owner recheck/cancel/UI issuance, (c) dispatch/cancel/late result, (d) owner replacement/stale dispatch or send, and repeat critical cases across MV3 worker restart. Assert zero new effects **after the acknowledgment event**, without asserting impossible rollback of an already committed effect.


## 7. Acceptance criteria mapping

| AC | Evidence required | Corresponding requirements |
| --- | --- | --- |
| AC-01 | Live `cost.summary` executed once under exclusive conversation owner | FR-01–07,18 |
| AC-02 | S-A evidence returned to owning chat; Gemini selects next `ec2.metrics` | FR-01,08,09,13 |
| AC-03 | S-A two-tool and S-B one-tool conclusions pass frozen evidence/number/reasoning oracle | FR-08,09,13,14 |
| AC-04 | Frozen S-A/S-B campaigns and complete denominators, rates, durations, failures | FR-09,12,13,14,16 |
| AC-05 | No execution for partial/quoted/stale/user/other-chat/multiple-call content | FR-01–04,15,18, NFR-04 |
| AC-06 | Dedupe, dual-tab owner race, worker restart, stale fence, cancel-effect races | FR-07,11,17–19, NFR-05,11,13 |
| AC-07 | Invalid tool/schema/budget/DOM and multi-call response fail closed | FR-04,05,10,15 |
| AC-08 | Navigation, cancel, provider failures and cancel-versus-dispatch/send races isolated | FR-01,08,10,11,17–19 |
| AC-09 | Evidence provider has no write/network/credentials | FR-05,06, NFR-01 |
| AC-10 | Independent unit/fixture/MV3/live checks including dual-tab contention and contrasting scenarios | FR-12,16,18, NFR-09 |
| AC-11 | Reproduction, immutable *evaluation* baseline, exact mode/fixtures/oracle and logs | FR-12,16 |
| AC-12 | Threat model, negative/concurrency tests and residual scope of ownership guarantee | NFR-03–08,11–14 |

### 7.1 Immutable evaluation baseline and proof threshold (RG-002-REQ-005)

**Before the first scored trial**, Spike Plan Gate must record an immutable Git **evaluation manifest with commit and file blob hashes**, including:

- Exact user prompt, Gemini-facing setup/instructions, complete tool catalog and call contract/schema; all synthetic mock fixtures for S-A/S-B; all scenario decision thresholds, expected resource IDs/arguments and evidence IDs.
- The independent deterministic answer oracle, rounding/tolerance rules, human adjudication rubric (if any), explicit pass/fail examples, failure taxonomy, allowed timeouts, request/turn/tool budgets and stop policy.
- Extension/test harness and fixture/DOM-adapter baselines, Chrome/OS versions and **observable Gemini model/mode selection**; if the Web UI cannot pin the model, record the available setting, UI state and timestamps without pretending to freeze an inaccessible backend version.
- A preregistered S-A/S-B trial schedule (including order), fixed number of attempts and treatment of timeouts, Gemini refusals, invalid responses, reloads and user aborts. Every attempted formal trial remains in its original denominator. Retries count as new attempts and **never erase the original failure**.
- Formal runs prohibit prompt tweaking, fixture swaps, tool-set edits, post-hoc oracle relaxation, selective exclusion or changing the denominator. Any artifact/rule modification starts a **new campaign with new immutable identifiers**; historical results remain available and are not selectively pooled.

**Scored live-browser threshold:**

- **S-A: ≥10 formal live trials; ≥90%** end-to-end completion with correct second tool and oracle-passing grounded answer.
- **S-B: ≥10 formal live trials; ≥90%** end-to-end completion without unnecessary `ec2.metrics`, with oracle-passing grounded answer.
- **Same prompt / tool protocol / bridge logic for both scenarios**, only synthetic tool data differ. No per-turn manual intervention.
- **Safety violations = zero** across the entire campaign and adversarial/concurrency tests: unauthorized call, duplicate execution, two active owners of same conversation, dispatch/send after acknowledged cancel, cross-conversation result, real API invocation or leak of sensitive data. Any confirmed violation ⇒ **BLOCKED**.
- Each AC requires attributable evidence; passing fixture/unit tests does not prove live Gemini behavior.
- These rates are **only a preliminary feasibility gate**, not a production SLO nor a statistically reliable estimate of operational success.

Status rubric:
- **PROVEN:** All mandatory criteria demonstrated with actual evidence, live threshold met, zero safety violations.
- **BLOCKED:** Confirmed unsafe behavior or failed mandatory contract.
- **INCONCLUSIVE:** Insufficient evidence, blocked environment/permissions, or nonreproducible outcomes; does not authorize Phase 1.

## 8. Reproducibility & reports

Plan for a report under `docs/reports/` with: Issue ID; immutable Requirements/Design/Plan blob IDs and test-commit SHA; **frozen evaluation manifest commit and blob hashes (prompts, schemas, scenario fixtures, oracles, grading and trial order)**; UTC+JST execution time; OS/Chrome/extension versions; observable Gemini mode and UI conditions; mock input/output with evidence ID; sanitized **owner generations and cancel/dispatch/UI issuance event ordering**; actual call counts, **all attempt logs/denominators per scenario including refusals, errors and retries**, oracle outcome, AC-level status, residual risks and reproducibility steps.

Tests must cover:
1. Unit: grammar/schema/policy/state transitions/idempotency/recovery.
2. DOM fixtures: partial output, examples, role boundaries, multiple candidates, navigation, UI drift.
3. MV3 integration: content/background messaging, worker lifecycle, durable recovery, **atomic same-conversation dual-tab acquisition, worker restart fencing, and both cancel-before-effect/effect-before-cancel orderings for actual provider dispatch and UI send**.
4. Authenticated live Gemini Web: **both frozen S-A and S-B scenarios** plus adverse interaction/concurrency tests, **synthetic data only**, with browser state prepared manually but no intervention during a tool loop.

### 8.1 Closure matrix for the reported Requirements findings

| Finding | Document changes | Acceptance evidence |
| --- | --- | --- |
| RG-002-REQ-001 — Major | §3.1 atomic per-conversation owner, fenced epoch/restart | FR-01/18; AC-06/08 |
| RG-002-REQ-002 — Major | §2.2 S-A/S-B contrasting evidence-driven actions | FR-13; AC-02–04 |
| RG-002-REQ-003 — Major | §2.3 deterministic, independent provenance/numeric/conclusion oracle | FR-14; AC-03/04 |
| RG-002-REQ-004 — Moderate | FR-03/15; one call/turn maximum, reject even identical duplicates | AC-05/07 |
| RG-002-REQ-005 — Moderate | §7.1 immutable prompt/tool/fixture/oracle/mode/trial baseline | FR-16; AC-04/11 |
| RG-002-REQ-006 — Moderate | §6.1 cancel acknowledgment serialized with actual dispatch/UI send | FR-17/19; AC-06/08 |

All six are **author-addressed, not independently verified**. Requirements Gate remains BLOCKED until a fresh review of this exact Git commit and blob.


## 9. Review gates and authorization

1. **Requirements Gate (now):** Independent review of this draft against Issue #1, constraints, AC, security, and testability. DRAFT until explicitly approved.
2. **Design Gate (later):** Choose completion evidence, conversation binding, protocol, DOM adapter, durable dedup, exact policy boundaries, UI publishing, architecture and recovery. Native Messaging is not decided here.
3. **Spike Plan Gate:** Review tasks, RED/GREEN tests, browser evidence, environment, frozen limits/threshold and stopping rules.
4. **Execution Gate:** Explicitly authorize *mock-only* Phase 0 development and live verification **only after company permission for extension installation and automated Gemini UI actions in the test environment is recorded**.
5. **Decision Gate:** Independent PROVEN/BLOCKED/INCONCLUSIVE review. Only PROVEN permits proposing the next phase.

### Open questions for review

- **OQ-01:** Does company policy permit an extension to inspect and automatically interact with Gemini Web? How is permission recorded?
- **OQ-02:** What browser-visible evidence establishes assistant-turn completion and stable conversation identity without undocumented backend calls?
- **OQ-03:** What canonical call envelope minimizes model format deviation while eliminating accidental execution from normal code blocks?
- **OQ-04:** How are atomic ownership, durable execution intents, MV3 worker restarts, cancel-versus-effect commit gates and uncertain UI publication represented?
- **OQ-05:** What bounded automatic recovery (if any) is safe without re-executing a tool?
- **OQ-06:** What future local-runtime transport minimizes credential exposure without increasing browser privileges?

**Change control:** A documentation PR does not authorize implementation. No AWS/Bitbucket access or company secrets in this branch. This author's edits are not a fresh independent review or Requirements Gate approval.
