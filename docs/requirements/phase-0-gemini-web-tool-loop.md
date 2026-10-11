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

The extension must **not hard-code which tool Gemini requests next**. The desired two-tool sequence is an evaluation scenario induced by the mock data and instructions, not a hidden workflow scripted by the extension. Failure to induce the desired next request must be counted, not quietly repaired.

## 3. Trust and identity boundaries

| Boundary | Required guarantee |
| --- | --- |
| Browser tab | A tab is not a unique conversation. Never infer owner solely from tab ID. |
| Conversation | Establish and re-check conversation identity before execution and immediately before result submission; ambiguous or changed identity ⇒ fail closed. |
| User run | A user explicitly enables an action scope, allowed tool set, resource/time budgets, start/stop. Model output cannot expand authorization. |
| Assistant turn | Only a new, completed assistant message in the authorized run may supply a candidate tool call. |
| Tool call | Bind to run, conversation, origin turn and unique call identity; an ID reused in another scope is not the same call. |
| Result | Bind to actual provider execution and evidence ID; never accept model-invented results as executed results. |
| Host/execution | Untrusted page/model text must pass parser, schema and independent policy authorization before reaching a provider. |

All page DOM, Gemini text, retrieved content and future tool results are **untrusted inputs**; the model may propose a tool but cannot itself grant permission to use it.

## 4. Functional requirements

| ID | Requirement | Issue AC |
| --- | --- | --- |
| FR-01 | Bind an explicitly started run to a single originating Gemini conversation; detect tab changes, page navigation and uncertain/changed identity and stop safely. | 01,02,03,05,08 |
| FR-02 | Detect assistant-turn **completion** with evidence; a quiet/stalled stream or partially rendered tool call must never trigger execution. | 01,05 |
| FR-03 | Parse only a clearly designated structured execution block from the authorized current assistant turn; exclude quotations, examples, older turns, user and tool-result messages. If ambiguous, reject. | 01,05,07 |
| FR-04 | Define one canonical minimal tool-call schema in Design; type-check all arguments, specify any bounded syntax normalization, and reject conflicts rather than guessing intent from prose. | 01,07 |
| FR-05 | Enforce allowlisted mock tools `cost.summary` and `ec2.metrics`, schema validation, explicit run permission and size/time/call quotas **before** execution. | 01–03,07,09 |
| FR-06 | Mock tools return deterministic synthetic data, error classifications and evidence IDs. They do not read local secrets or access external services. | 01–03,09 |
| FR-07 | A call is never executed more than once as a consequence of duplicate DOM events, rerenders or reloads. Record durable execution intent before side-effect boundary; uncertain completion ⇒ `INDETERMINATE`, not automatic replay. | 01,06 |
| FR-08 | Attribute/escape/size-bound provider results and publish only to the run’s originating conversation; revalidate binding at publication time. | 02,03,08 |
| FR-09 | Resume waiting for Gemini after result publication, allow a subsequent model-chosen valid tool call and accept a final grounded answer. | 02,03,04 |
| FR-10 | Give the user run start, visible progress, cancel and safe-stop controls. The model cannot disable limits or authorize its own future runs. | 07–09 |
| FR-11 | Distinguish clean completion, model refusal, invalid output, malformed DOM, timeout, transport failure, navigation, reload and user cancellation. | 06–08 |
| FR-12 | Emit sanitized evidence of parsed candidate, policy decision, run/turn/call identity, state transitions, execution count, publication outcome and error reason. | 04,10–12 |

## 5. Non-functional / security requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Phase 0 mock providers have no external networking, OS command execution, storage mutation or credentials. |
| NFR-02 | Every run has finite **max calls, model turns, elapsed time, request bytes and result bytes**, frozen in Spike Plan. No unbounded automatic retry. |
| NFR-03 | Neither page text nor tool output can trigger arbitrary code execution, dynamic URL fetch or unallowlisted tool selection. |
| NFR-04 | On unknown DOM contract, ambiguous role, multiple candidate conversations, multiple conflicting calls or unknown origin, stop **fail closed** with a visible reason. |
| NFR-05 | Seek **at-most-once execution initiation per validated call**, not an unprovable exactly-once external side effect. After a crash with uncertain outcome, never silently replay. |
| NFR-06 | Prevent prompt/tool-output injection from crossing policy boundary. Treat results as data, escaping/sandboxing any content that resembles a tool call or an instruction. New model proposals still require independent validation. |
| NFR-07 | Keep public fixtures synthetic and redact event logs. Do not store full raw chat transcripts, sensitive URLs, company content or credentials by default. |
| NFR-08 | Any UI-driven submission must be confined to the user-approved run; no sending after user cancellation or owner loss. |
| NFR-09 | Distinguish unit, fixture, extension integration and live Gemini Web E2E evidence; one cannot substitute for another. |
| NFR-10 | AWS API charges, billing data handling and region/organization access are future-phase concerns and require a separate explicit gate; Phase 0 uses no paid external API. |

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

## 7. Acceptance criteria mapping

| AC | Evidence required | Corresponding requirements |
| --- | --- | --- |
| AC-01 | Live browser `cost.summary` tool call with exactly one mock execution | FR-01–07 |
| AC-02 | Live result returned to correct conversation and new `ec2.metrics` request | FR-01,08,09 |
| AC-03 | Live second result, autonomous continuation, evidence-backed final answer | FR-08,09 |
| AC-04 | Multiple live repetitions, denominator, success fraction, duration and categorized failures | FR-09,12 |
| AC-05 | No execution from incomplete, quoted, stale, user or other-chat text | FR-01–04, NFR-04 |
| AC-06 | Dedupe and reload/crash uncertainty tests | FR-07,11, NFR-05 |
| AC-07 | Invalid tool/schema/budget/DOM fails closed | FR-04,05,10 |
| AC-08 | Tab change, conversation change, cancel and provider failure are isolated | FR-01,08,11 |
| AC-09 | Evidence provider has no write/network/credentials | FR-05,06, NFR-01 |
| AC-10 | Separate unit, fixture, integration, live-browser reports | FR-12, NFR-09 |
| AC-11 | Reproduction steps, environment, immutable code baseline and logs | FR-12 |
| AC-12 | Threat model, negative tests, residual risk statement | NFR-03–08 |

### 7.1 Phase 0 preliminary proof threshold (freeze before execution)

- At least **10 predeclared live-Gemini-Web full-loop trials** using equivalent synthetic scenario and recorded browser/Gemini UI conditions.
- At least **90% completed without per-turn human intervention** (9 of 10, if exactly 10 trials). Count model refusals, format errors and DOM failures in the denominator.
- **Zero safety violations** across the entire test campaign (unauthorized execution, double execution, cross-conversation publication, real external API call or sensitive-data exposure). One confirmed violation means **BLOCKED**.
- Every AC must have attributable evidence and a determination; a passed parser fixture is *not* proof of a working browser loop.
- This is a **feasibility-spike threshold, not a production SLO**. A Phase 1 or product rollout requires independent reliability/security criteria.

Status rubric:
- **PROVEN:** All mandatory criteria demonstrated with actual evidence, live threshold met, zero safety violations.
- **BLOCKED:** Confirmed unsafe behavior or failed mandatory contract.
- **INCONCLUSIVE:** Insufficient evidence, blocked environment/permissions, or nonreproducible outcomes; does not authorize Phase 1.

## 8. Reproducibility & reports

Plan for a report under `docs/reports/` with: Issue ID; immutable Requirements/Design/Plan blob IDs and test-commit SHA; UTC+JST execution time; OS/Chrome/extension versions; visible UI conditions; mock input/output + evidence ID; sanitized state transitions; actual calls count; tests/trials/failure codes; AC-level status; unresolved risks; reproduction instructions.

Tests must cover:
1. Unit: grammar/schema/policy/state transitions/idempotency/recovery.
2. DOM fixtures: partial output, examples, role boundaries, multiple candidates, navigation, UI drift.
3. MV3 integration: content/background messaging, worker lifecycle, durable recovery.
4. Authenticated live Gemini Web: multi-turn loop and adverse interaction scenarios, **synthetic data only**, with browser state prepared manually but no manual intervention in the tool loop.

## 9. Review gates and authorization

1. **Requirements Gate (now):** Independent review of this draft against Issue #1, constraints, AC, security, and testability. DRAFT until explicitly approved.
2. **Design Gate (later):** Choose completion evidence, conversation binding, protocol, DOM adapter, durable dedup, exact policy boundaries, UI publishing, architecture and recovery. Native Messaging is not decided here.
3. **Spike Plan Gate:** Review tasks, RED/GREEN tests, browser evidence, environment, frozen limits/threshold and stopping rules.
4. **Execution Gate:** Explicitly authorize *mock-only* Phase 0 development and live verification.
5. **Decision Gate:** Independent PROVEN/BLOCKED/INCONCLUSIVE review. Only PROVEN permits proposing the next phase.

### Open questions for review

- **OQ-01:** Does company policy permit an extension to inspect and automatically interact with Gemini Web? How is permission recorded?
- **OQ-02:** What browser-visible evidence establishes assistant-turn completion and stable conversation identity without undocumented backend calls?
- **OQ-03:** What canonical call envelope minimizes model format deviation while eliminating accidental execution from normal code blocks?
- **OQ-04:** How are durable execution intents, MV3 worker restarts and result-publication uncertainty represented?
- **OQ-05:** What bounded automatic recovery (if any) is safe without re-executing a tool?
- **OQ-06:** What future local-runtime transport minimizes credential exposure without increasing browser privileges?

**Change control:** A documentation PR does not authorize implementation. No AWS/Bitbucket access or company secrets in this branch.
