# Phase 0 Design Spec — Gemini Web Autonomous Tool Loop

| Field | Value |
| --- | --- |
| Status | **DRAFT / DESIGN GATE NOT APPROVED** |
| Issue | [#1](https://github.com/yohi/gemini-web-agent-bridge/issues/1) |
| Requirements Gate | Independent review verdict **APPROVED** (as reported), [recorded on PR #2](https://github.com/yohi/gemini-web-agent-bridge/pull/2#issuecomment-6105978009). **Not** a native GitHub APPROVE event. |
| Immutable Requirements HEAD | `fcdc3d7fcc6a53010fbfd3704dc3f5a4f50469c7` |
| Immutable Requirements blob | `8025df805967f66787369a9cfa834c5dfc69d836` |
| Stacking | Design branch derives from exact Requirements HEAD; PR #2 remains unchanged |
| AI and budget | **Gemini Web only**, no Gemini API / other LLM / new paid AI service |
| Authorized scope | Design and review only; no implementation, actual AWS/Bitbucket/MCP, or real UI automation |

## 1. Decision overview

Phase 0 must demonstrate autonomous **Gemini Web → valid mock tool call → one execution → one result submission → Gemini-selected next call or evidence-backed finish**. The required two contrasting scenarios are **S-A** (investigate EC2 using `ec2.metrics`) and **S-B** (no suspicious EC2, do not invoke `ec2.metrics`). The extension must not script the branch.

**This design is a hypothesis, not a proof.** Four critically unproven details require direct browser feasibility evidence:

1. Can the actual Gemini Web UI supply a trustworthy **new assistant turn + completion** observation, rather than a heuristic timeout?
2. Is **conversation identity** stable and unambiguous across two tabs, navigation and DOM replacement?
3. Can Chrome MV3 contexts provide **linearizable conversation ownership, cancel acknowledgment and fenced effect issuance** across worker restarts?
4. Can an **actual Gemini UI send issuance** be bounded by durable publication intent and cancel without a race between the authorization check and DOM send action?

If one of these is inherently unsupported, **Design Gate is BLOCKED**; the reviewer must not solve it by weakening the approved Requirements. The design explicitly favors a missed send and `INDETERMINATE` over a duplicate send.

## 2. Proposed architecture

```text
        Gemini Web UI (untrusted; no private Gemini API)
                 ↑                        ↓
      visible tool-result text     completed assistant output
                 │                        │
          ┌──────┴────────────────────────┴─────────────┐
          │ Chrome Extension Manifest V3               │
          │                                              │
          │ Content Script (isolated world)              │
          │   DOM observe, role/completion/document ID   │
          │   guarded, single-use UI send initiation      │
          │                ↕ bounded typed messages       │
          │ Service Worker — sole authority              │
          │   parse/schema, permission, run FSM, quotas   │
          │   ownership, fencing, cancel, execution       │
          │   publication, logging                       │
          │                ↕ atomic transaction          │
          │ IndexedDB extension-origin durable journal   │
          │                ↕                              │
          │ Synthetic deterministic mock tool provider   │
          └──────────────────────────────────────────────┘
```

**Deliberate choice:** A single coordinating authority with transactional durable journal is preferred to separate tab-local mutexes, content-script permission decisions or `chrome.storage.local` read-then-write. Candidate persistence is **extension-origin IndexedDB** with a common per-conversation record accessed via the service worker. Exact transaction lifecycle/durability across MV3 suspension must be validated, not assumed.

**Phase 0 excluded:** Native Messaging host, real MCP transport, AWS profiles, external API requests, secret management, production agent daemon. Later phases may substitute a local tool provider behind the same boundary, but Phase 0 uses only deterministic in-process mocks.

### 2.1 Trust boundaries

| Component | Authority | Explicit prohibition |
| --- | --- | --- |
| Gemini DOM/output | Supplies observed **candidate text** | Cannot grant permission, attest completion independently, or provide trusted execution evidence |
| Content Script | Observe a bound document; issue one verified permitted UI action | Cannot grant itself new permits, invoke arbitrary tool, approve its own result |
| Service Worker coordinator | Authorize, serialize effects, decide run state | Cannot rely on RAM as durable state |
| IndexedDB journal | Atomic ownership and one-time reservation candidate | Cannot transactionally atomize DOM clicks or Gemini delivery |
| Mock provider | Deterministic synthetic read-only data | Cannot access network, secrets, filesystem or OS commands |
| Offline oracle | Grade real logs against frozen synthetic answer constraints | Cannot rely on Gemini self-scoring or invented tool evidence |

All DOM content, model calls and mock-returned prose are untrusted, even if their format looks correct. The coordinator applies a schema and independently authorized run scope at every effect boundary.

## 3. Session, conversation and assistant-turn identity

### 3.1 Conversation binding

- Restrict extension host permissions to the necessary `https://gemini.google.com/*` scope. No undocumented Gemini endpoints, cookie/token extraction, remote scripts, blanket `<all_urls>` or general web scraping privilege.
- Run start requires an **unambiguous browser-visible conversation identifier** cross-checked with the displayed conversation. Tab ID, generic URL, DOM position or cached route **alone** is insufficient; if the UI lacks stable identity for new chats, disable run start.
- Represent `ConversationKey`, `TabKey`, `FrameKey`, `DocumentGeneration`, `RunId`, `OwnerEpoch` and `AssistantTurnKey` separately. Navigation, iframe replacement and new conversation invalidate the prior document binding.
- Same conversation in two tabs maps to one `ConversationKey`; an atomic owner claim allows one active run. Cross-profile/device distributed ownership is **outside** the Phase 0 guarantee and is explicitly prohibited during automation.
- Recheck stable conversation identity **immediately before actual provider dispatch and actual UI send issuance**, not just on run creation or message preparation. Unknown identity ⇒ fail closed.

### 3.2 Completed new assistant message

DOM adapter must establish *all* of:
1. Assistant-role provenance, not user input, quote/example, historical assistant turn or bridge-generated result.
2. A turn created **after the user-authorized run began**, or after a verified tool-result issuance.
3. A **verified generation-completion transition** and a stable final message snapshot; a quiet DOM interval or closed JSON fence **alone** is not enough.
4. The observed assistant element/document/generation still belong to the same owner and current conversation.
5. At most one parseable, specially tagged tool-call candidate.

Any ambiguous role/completion/elements/identity or unsupported UI variant ⇒ `BLOCKED`, no tool execution. **The existence of reliable Gemini completion markers is not yet established.** The Design/Spike browser probes must explicitly establish or falsify this.

## 4. Model ↔ bridge protocol

### 4.1 Canonical assistant call v1

The model-facing instruction asks for **one** `gemini-agent-call` fenced JSON object in a completed assistant turn:

```gemini-agent-call
{"version":1,"kind":"tool_call","call_id":"step-1","tool":"cost.summary","arguments":{}}
```

A later assistant turn can request:

```gemini-agent-call
{"version":1,"kind":"tool_call","call_id":"step-2","tool":"ec2.metrics","arguments":{"resource_id":"i-mock-001"}}
```

Requirements:
- Exact version/kind discriminator, bounded `call_id`, allowlisted tool name, typed arguments. Strict schema; reject duplicate JSON object keys, unknown keys, nonfinite numeric values, excessive depth/size and invalid resource identifiers.
- **Zero or one candidate** per complete assistant turn. Two candidates—even byte-identical—cause rejection of **both**. No batch semantics, no executing first-of-many.
- Never infer a call from natural language or arbitrary JSON. Only the allowed tagged structure in a current completed assistant turn is a candidate.
- Model-supplied `call_id` is **not** an authority token. Deduplication identity is bound to actual run/conversation/turn/owner generation; stale/reused calls are rejected.
- Tool grammar normalization, if any, must be explicitly enumerated before tests. Ambiguous syntax fails closed; never allow format repair to silently create executable intent.

### 4.2 Tool result envelope

```json
{
  "version":1,
  "kind":"tool_result",
  "origin_call_id":"step-1",
  "publication_id":"bridge-created-stable-id",
  "status":"ok",
  "evidence_id":"synthetic-evidence-001",
  "data":{"example":"bounded synthetic payload"}
}
```

Only an **actually executed** mock result can create this envelope. The bridge quotes/escapes embedded instructions, call-shaped JSON, markup and fake roles as **data**, and never parses its own result message as a model-origin call. This is an ordinary Gemini UI message, **not** the native tool role. If the model ignores it, mark the trial failed; do not fabricate success. Oversized data fails rather than being silently truncated.

## 5. Durable state and exclusivity design

### 5.1 Records and identities

| Record | Required fields |
| --- | --- |
| `ConversationOwner` | conversationKey, runId, monotonic ownerEpoch, document binding, owner status, durable terminal/reconciliation marker |
| `Run` | runId, ownerEpoch, allowed tools/budgets, model turn count, tool call count, FSM state, cancel status, active effect permits |
| `TurnObservation` | runId, assistantTurnKey, completed snapshot digest, provenance markers, generation |
| `ExecutionIntent` | unique run+conversation+turn+call identity, args digest, ownerEpoch, `RESERVED/MAY_HAVE_DISPATCHED/FINISHED/UNKNOWN`, actual provider count |
| `PublicationIntent` | **separate** stable identity derived from run+conversation+executed result+resultVersion, payload digest, bound document, ownerEpoch, one-time nonce, `RESERVED/PERMIT_OUTSTANDING/ISSUED/UNKNOWN/ABORTED`, UI send issuance count |
| `AuditEvent` | serial event order, bounded IDs, permission decision, intent status, cancellation/dispatch/send order, redacted failure reason |

**Atomic coordination:** owner claim/release, cancellation status, dispatch permit and publication permit changes use a single authoritative transactional boundary around the conversation coordination record. Do not issue permission based on out-of-transaction stale snapshots. The service worker is the **sole writer and effect-grant authority**, all other extension contexts send messages through it.

**Recovery:** On MV3 restart, reload journal before accepting messages. Never steal a conversation owner by lease timeout alone when an old effect could still arrive. Never retry a dispatch or send whose occurrence may be unknown. `UNKNOWN` blocks unsafe owner turnover until separate evidence-backed reconciliation.

### 5.2 Run state machine

```text
IDLE → ACQUIRING_OWNER → AWAITING_MODEL → VALIDATING
                                               ↓
                                          EXECUTING
                                               ↓
                                          RESULT_READY
                                               ↓
                                      PUBLISHING_RESULT
                                               ↓
                                  AWAITING_MODEL / COMPLETE

On faults → BLOCKED / INDETERMINATE
On cancel request → CANCEL_PENDING → CANCELLED_ACK (only after effect gates quiesce)
```

The state transitions are journaled with owner epoch. Every transition must distinguish intent reservation from **actual** effect issuance; a reserved operation can be lost without violating at-most-once.

### 5.3 Conversation owner

`Acquire(conversationKey, runId)` uses a **linearizable transactional compare-and-acquire**, yielding a fresh monotonically distinguishable epoch. A second tab/run loses without any tool/UI effect. A stale callback carrying an old epoch cannot dispatch or publish. `Release` is allowed only when no execution or publication can still begin. If status is uncertain, owner stays blocked; a timeout is never treated as proof of quiescence.

### 5.4 Tool Execution Intent / provider dispatch

1. Validate completed assistant turn, call grammar, schema, owner, user run scope and quotas.
2. Commit **Execution Intent once** before provider entry; duplicate event, rerender or worker restart finds the used reservation and must not reenter provider.
3. At actual dispatch, serialize the final owner/cancel fence with effect issuance. Phase 0 mock dispatch is **synchronous and deterministic** at this boundary; remote async tools are deferred.
4. If canceled before dispatch commit, do not call provider. If dispatch committed first, allow in-flight work to conclude but prohibit later publication after cancel.
5. A crash after reservation but without known provider outcome ⇒ `INDETERMINATE`, no speculative replay. Evidence records distinguish `reserved`, `entered mock provider` and `completed`.

**Unproven:** Durable storage commit and the in-process provider entry cannot be one database transaction. This conservative protocol may lose invocations but must not duplicate them. Cancellation acknowledgment may wait on unresolved dispatch.

### 5.5 Result Publication Intent / UI send

**FR-20/FR-21** require an identity/claim independent of execution. A completed tool result maps to a unique publication key **including run + conversation + actual execution + result version**; fixture `evidence_id` alone is insufficient since it can recur across trials.

Proposed at-most-once issuance protocol:

1. Commit a unique `PublicationIntent` with exact payload digest, evidence provenance and owner epoch in durable journal. Concurrency results in one winner; conflicting payload for the same identity is rejected.
2. Just before UI action, validate current conversation, run, cancel and fenced epoch. Consume **one single-use UI issuance permit** and persist `PERMIT_OUTSTANDING` **before** notifying the exact bound tab/frame/document.
3. The content script accepts only that permit/document; it synchronously marks the nonce spent locally and initiates **at most one** DOM send action without an `await` between its last local document check and action. It reports `ISSUED` or provable `NOT_ISSUED`.
4. If the worker/page dies or send acknowledgment is missing, treat the durable permit as **possibly used**; set `UNKNOWN/INDETERMINATE`. Never generate another permit or automatically resend that result.
5. A duplicated permit message, repeated result-ready callback or second publisher must be rejected by the coordinator and document-local nonce deduplication.
6. Sender completion and permit retirement are persisted. A second conversation run cannot take over if a stale outstanding send could still initiate.

**Non-atomic gap:** IndexedDB transactions cannot include the DOM click. Consequently **exactly-once Gemini delivery is not promised**; issuance may be lost. It remains a major open proof obligation whether Chrome can establish **actual send initiation and cancel ordering**. If the real UI send action is asynchronous in a way that permits post-acknowledgment issuance, **Design or Spike must BLOCK**, not weaken FR-21.

### 5.6 Cancellation linearization

- Clicking Cancel produces `CANCEL_PENDING` immediately, but it is **not an acknowledgment**.
- The authoritative cancel transition closes new dispatch and new UI issuance permit gates. It must wait for all previously granted effects that **might still initiate** a provider call or DOM send; only when these are resolved/terminated can it persist `CANCELLED_ACK` and tell the user cancellation is confirmed.
- If the cancel barrier wins the serialized effect gate, actual provider invocation/send count afterward must be **zero**. If an effect already committed, do not pretend it was rolled back.
- Lost sender/worker acknowledgment cannot be interpreted as quiescence. Keep `CANCEL_PENDING` and show `INDETERMINATE` if a permit cannot be accounted for. No falsely confirmed cancel; no premature owner release.
- Actual UI event issuance must be ordered with the cancel acknowledgment. A **pre-send check by the worker alone is insufficient** if a content script can issue the action later; any viable protocol must prove outstanding permit retirement.

This may compromise cancellation liveness; that is preferable to a false safety guarantee. A human can inspect the blocked run, but **manual reset may not silently authorize a fresh conflicting run**.

### 5.7 Mandatory race schedules

Test controlled interleavings:
- Same conversation / two tabs both acquire; MV3 restart during acquisition; stale old owner tries dispatch/send.
- Cancel before/after validation, before/after dispatch gate, before/after provider entry, then delayed result.
- Cancel before/after UI permit issuance, before/after actual DOM send action, missing acknowledgment.
- Two concurrent publishers for same result; duplicate event/callback; two identical permits; lost result-ready notification.
- Worker crash **after DOM issuance but before acknowledgment**; browser navigation while permit is outstanding; attempted owner replacement.
- Each event log must distinguish **intent/permit** from **actual provider call / actual UI send issuance**. Simply counting journal writes is not proof of at-most-once effects.

## 6. UI-safety and failure taxonomy

| Failure / threat | Behavior |
| --- | --- |
| Completion marker absent, streaming stalled, role ambiguous | `BLOCKED`; no candidate executed |
| Two valid call envelopes, even identical | Reject all; no batch |
| Unknown tool/invalid argument/budget exceeded | Deny and stop; no provider entry |
| Tool result contains instructions / fake system role | Encoded as data; never grant authority |
| Conversation changed/unknown during execution or publication | No new effect; `BLOCKED` or `INDETERMINATE` |
| Duplicate execution event or provider outcome unknown | At-most-once; no provider retry |
| Duplicate publisher or UI send acknowledgment lost | At-most-once; no UI resend |
| Cancel requested while effect permit outstanding | Cancel **pending**, not falsely acknowledged |
| Old owner epoch or another tab | Deny dispatch/send |
| Gemini refuses tool grammar, wrong next tool, fabricated final data | Count failed scored attempt |
| Extension permission/policy uncertain | No live browser run |

Chrome extension uses least permissions and bundled scripts, no dynamic JS evaluation, no credential capture or external network for mocks. Logs store synthetic evidence identifiers/hashes and state transitions, not raw chat, personal data or company invoices.

## 7. Evidence-based contrasting scenarios and oracle

Both evaluation variants run **the same prompt, tool catalog, extension logic and policy**; only `cost.summary` mock evidence differs.

| Scenario | Evidence difference | Expected Gemini decision |
| --- | --- | --- |
| **S-A** | Synthetic suspicious costly EC2 (predefined resource and threshold) | Request `ec2.metrics` for the right resource; use its utilization and cost evidence; grounded conclusion |
| **S-B** | Synthetic cost evidence justifies no EC2 follow-up | **Do not call** `ec2.metrics`; stop with supported negative conclusion |

Predefined **non-LLM oracle** requires matching actually executed evidence IDs, resource IDs, major costs/utilization, units and time window (within frozen tolerance), correct investigation decision and **zero material fabrication**. Machine-check structured facts where possible; freeze adjudication rubric for prose before trials. A correct-looking answer with fabricated numbers is a failure. An unnecessary S-B second call fails.

**Gate chronology (do not invert):** Spike Plan Gate approves the *evaluation manifest specification and collection procedure*, Execution Gate then authorizes mock implementation/unscored exploration, **Formal Evaluation Baseline Freeze** then commits and verifies the *actual built code, test harness, fixtures, prompts, protocol, oracle, trial plan and hashes*, **then** scored browser trials start. Any changes after freeze require a new campaign retaining prior pass/fail history.

Formal proof threshold inherited from Requirements: **S-A at least 10 live trials and ≥90% passing; S-B at least 10 and ≥90%; no per-turn manual interventions; zero safety violations**. This is feasibility evidence, not a production SLO.

## 8. Requirements traceability / Design Gate proof obligations

| ID | Coverage | Evidence required / fail condition |
| --- | --- | --- |
| DP-01 | FR-01/18, AC-05/08 | Demonstrate stable same-conversation identity across tabs/navigation; ambiguous ⇒ BLOCKED |
| DP-02 | FR-02/03, AC-01/05 | Live completed-assistant origin marker and partial/quoted/old-turn negatives; no reliable completion ⇒ BLOCKED |
| DP-03 | FR-04/05/15, AC-05/07 | Strict grammar/schema/unknown-tool, double-call, data injection fixture/unit tests |
| DP-04 | FR-01/18, AC-06 | Atomic ownership/cancel epoch and MV3 restart fault injection; no dual owners |
| DP-05 | FR-07/17/19, AC-01/06 | Actual mock provider entry count ≤1; crash and cancellation schedules |
| DP-06 | **FR-08/20/21**, AC-02/06 | At-most-once **actual UI send issuance** per result across parallel publishers, duplicate message, worker crash |
| DP-07 | FR-17/19/21, AC-06/08 | Actual UI send and provider entry linearized with cancel ACK; any post-ACK effect ⇒ BLOCKED |
| DP-08 | FR-01/08, AC-02/08 | No output to wrong run/conversation, even during navigation or owner replacement |
| DP-09 | FR-09/13/14, AC-02–04 | S-A and S-B different decisions from data, same controller; frozen oracle |
| DP-10 | FR-16/**FR-22**, AC-04/10/11 | Immutable built candidate only **after** Execution Gate, before scored trials |
| DP-11 | NFR-01–17, AC-09/12 | No-network/read-only mock, synthetic trace, privileges/prompt injection audit |
| DP-12 | FR-12, AC-10/11 | Versioned unit/fixture/integration/live evidence and AC statuses separately recorded |

**DP-01, DP-02, DP-04, DP-06 and DP-07 are priority falsification targets.** The actual effect boundary and browser evidence must be validated independently; this draft does not claim them PROVEN.

## 9. Alternatives and unresolved decisions

| Area | Selected hypothesis | Rejected / deferred |
| --- | --- | --- |
| Conversation lock | One transactional extension coordinator with durable conversation record | Tab-local boolean, non-atomic storage read/write, lease timeout takeover |
| Model calls | Strict tagged single JSON envelope | Prose interpretation, guessed repair, permissive batch |
| UI integration | Observable Gemini page via content script | Private Gemini endpoint, Gemini API, account-token extraction |
| Dispatch | Durable preclaim + bounded in-process deterministic mock | Retries following unknown outcome, arbitrary local commands |
| Publication | Separate single-use durable intent and UI issuance permit | Assuming execution dedupe is enough; retry on send timeout |
| Cancellation | Delayed acknowledgment until all possible effect issuers quiesce | Immediate acknowledgment while send permits are live |
| Transport | No native local host in Phase 0 | Premature commitment to Native Messaging/MCP |
| Evaluation | Two frozen contrast scenarios + deterministic oracle | Fixed happy-path controller, Gemini self-grading |

### 9.1 Open blocking questions

- **B-01 UI send:** What precisely is the synchronous, observable irreversible UI send issuance event? Can the content-script permit be retired or proven dead before cancel ACK under all browser interleavings?
- **B-02 Completion:** Which observable UI transitions establish assistant generation completion across Gemini's supported modes? Are they stable enough for fail-closed operation?
- **B-03 Identity:** Which browser-visible properties distinguish a conversation across tabs and reloads without private endpoints?
- **B-04 Coordination:** What IndexedDB transaction boundaries, worker restarts and permit recovery states demonstrate the promised single-owner/cancel/effect ordering?
- **B-05 Protocol:** What happens when Gemini refuses/varies the tagged output? Is the observed success rate adequate without guessing?
- **B-06 Permission:** Is company approval for installing and automating the extension documented prior to Execution Gate?

If **B-01** is impossible, that is a **Major design blocker**, not a call to remove the at-most-once or cancel requirements.

## 10. Review gates and authorization limits

1. **Requirements Gate**: The independent review **APPROVED** only HEAD `fcdc3d7...`, blob `8025df8...`, with all 8 findings resolved; approval recorded separately. Historical Requirements document remains unchanged.
2. **Design Gate — NOW**: Independent review of this candidate against the immutable Requirements and Issue #1. Determine whether effect sequencing, authority and UI interaction contracts are internally coherent and falsifiable. **DRAFT until approved**.
3. **Spike Plan Gate**: Review explicit RED/GREEN tasks, DOM browser probe tasks, fault schedules, synthetic fixture/oracle **specification**, frozen limits and formal freeze procedure. No existing implementation SHA required.
4. **Execution Gate**: After approved plan and organizational authorization, explicitly permit **mock-only** code and **unscored** exploratory browser tests. No actual AWS/Bitbucket/MCP.
5. **Formal Evaluation Baseline Freeze checkpoint**: Freeze *completed implementation* and all scorer inputs/trials in immutable Git assets, record approval **before** scored test #1.
6. **Formal Evaluation / Decision Gate**: Execute pre-registered ≥10 trials per scenario and negative tests. Independently judge **PROVEN / BLOCKED / INCONCLUSIVE**; only PROVEN permits consideration of Phase 1.

### Design Gate reviewer checklist

- Does the chosen coordinator truly serialize **one owner**, provider dispatch and UI send under MV3 restarts?
- Is the **last actual UI send issuance** protected from cancel acknowledgment races, not merely a background permission check?
- Does the distinct `PublicationIntent` guarantee at-most-once **issuance**, including duplicates and lost acknowledgments, without claiming exactly-once delivery?
- Are completion/identity browser observations sufficient, or does the design implicitly rely on unstable guesses?
- Can S-A/S-B and a frozen oracle distinguish model-chosen actions from extension-scripted steps?
- Do all AC-01–12 have credible test evidence and clear BLOCKED conditions?
- Are permissions/policy and phase gates respected, with no implementation before approval?

**Author self-review is not independent approval. No source files, extension code, AWS credentials or live Gemini automation are authorized or created by this document.**
