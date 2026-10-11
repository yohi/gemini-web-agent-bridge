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

## 3. Run initialization and DOM-origin evidence

### 3.1 One chosen initial-prompt sequence (RG-003-DES-004)

**Chosen Phase 0 flow: one user-submitted initial prompt; no automatic bridge Send at launch.** A single manual initial submission is setup, not a repeated per-tool human intervention. The extension publishes subsequent tool results automatically.

| Step | Authoritative action and evidence | Reject if |
| --- | --- | --- |
| I0 | User opens a **stable, already identifiable Gemini conversation**, waits until idle, and types the investigation task **in the extension Run UI**; Gemini composer must be empty. | Unsaved/new chat, pending generation, ambiguous composer or conversation |
| I1 | DOM adapter sends corroborated ConversationEvidence + browser-provided document identity. Coordinator **atomically acquires exclusive ConversationOwner**, stores RunId/OwnerEpoch, creates a fresh RunMarker (correlation only, not secret authorization). | Owner contention, unknown identity |
| I2 | Coordinator constructs exactly **one canonical initial user prompt** from the user's task + RunMarker + allowed tool schemas + whole-turn output grammar + bounded scope. Journal `InitialPromptDigest`, run context and `AwaitInitialUserTurn` **before** any composer edit. Adapter fills the uniquely identified Gemini composer but does **not** click Send. | Composer content mismatch, ambiguous input control, navigation |
| I3 | User reviews the prefilled content and **manually presses Gemini's Send once**. This is the **sole user submission** permitted during the active run; it is not a bridge Result Publication. | Modified input, duplicate send, unrelated manual input |
| I4 | Observer identifies exactly one **new user-role transcript turn**, matching the canonical entire initial prompt digest, RunMarker and bound conversation/document. Journal `InputTurnKey` before arming `AWAITING_MODEL(InputTurnKey)`. | No exact user turn, digest mismatch, reordered or duplicated input |
| I5 | Accept the **single new completed assistant turn** only if §3.3 proves unique causation from I4; then apply §4 whole-turn grammar. | A turn merely appearing “after Run start” is insufficient |

Initial composer prefill is **not** bridge Send; a failed prefill cannot be treated as model prompt delivery. If a user edits/sends an alternate prompt, block the run; no guessing or silent retransmission. Users can cancel a not-yet-sent launch only after owner state is safely reconciled. Trial prompt and instructions are immutable formal-evaluation artifacts. If Gemini UI prefill/initial transcript matching cannot be reliably achieved, **B-07 BLOCKED**.

### 3.2 ConversationKey / DocumentEvidence (RG-003-DES-002)

`ConversationEvidence = {origin, conversationSpecificRoute, independentVisibleConversationCorroboration, tabId, frameId, documentId, navigationGeneration}`. Its trust contract:

- `origin` must be the authorized `https://gemini.google.com/*` site, using minimum permissions; no hidden Gemini APIs, cookie/token extraction or account-level bypass.
- **ConversationKey** derives from the canonical **conversation-specific browser-visible route** *only if* real-browser tests prove it is stable for the *same* conversation in two tabs and distinct for two different conversations. An unsaved chat or generic route does not qualify.
- `independentVisibleConversationCorroboration` must uniquely match the currently displayed conversation, separate from merely reading a possibly stale route; a title alone or DOM node position alone cannot corroborate identity. The exact Gemini selectors/attributes are **unknown until browser probing**, never asserted here as already available. If the second check cannot be implemented, no owner.
- Frame/document IDs must be taken from Chrome-provided message sender metadata, not page-authored text. A targeted `documentId` message **does not guarantee one recipient listener**, so it cannot grant sender uniqueness.
- `DocumentKey=(tabId, frameId, documentId, navigationGeneration)` and `ConversationKey` are both required for authorized effects. SPA route changes, frame replacement, reload, new chat, selection drift or an inability to reproduce corroboration invalidate observations and pending actions. Revalidate immediately before actual dispatch or UI send issuance.
- A single coordinated installation/browser profile can give the same conversation one owner. Cross-profile/device global locking is **not** claimed; the Phase 0 deployment must exclude simultaneous uncoordinated automation.

**Falsification:** same chat in two tabs → same key; different chat (even if same title) → different key; new chat / ambiguous key → reject; reload/route switch/redraw either re-corroborates *exactly* or invalidates. If actual Gemini UI cannot satisfy these predicates, **DP-01/B-03 BLOCKED**.

### 3.3 AssistantTurnKey, completion, causality (RG-003-DES-002)

`InputTurnEvidence={InputTurnKey,role:user,conversationKey,documentKey,canonicalDigest,runMarkerOrPublicationId,transcriptOrder}`.
`AssistantTurnEvidence={AssistantTurnKey,role:assistant,conversationKey,documentKey,predecessorInputTurnKey,generationStartEvidence,completionTransitionEvidence,bodyDigest,transcriptOrder}`.

A turn is executable only when **all** conditions are true:

1. The verified Gemini message boundary identifies role **assistant**, distinct from user text, echoed tool-result text, quotes, old messages and code fragments. Styling/text alone is insufficient; unknown role → reject.
2. The observer retains an **immediately-before-input transcript snapshot** and identifies **one newly created assistant response**, rather than using a recycled DOM node or timestamp guess. Redraw may update the observation only when identity/provenance remain uniquely established.
3. Exactly **one outstanding ExpectedInputTurnKey** exists: I4's exact initial user turn or a **bridge result user turn visibly recorded in the same conversation** and matching the authorized PublicationIntent's payload digest / correlation marker. The assistant must be the **unique reply to that predecessor** according to verified transcript ordering and turn boundaries; “created after the Run” alone is not causality. No other input, regeneration, stop, competing assistant response or unknown message may intervene.
4. An observed **active-generation → completed-generation UI transition**, paired with a stable snapshot and absence of competing stop/regenerate state, is required. A quiet timer, spinner disappearance alone, or closed JSON fence is **not** sufficient. The **actual observable Gemini completion transition remains unproven**; if no robust marker is found, **DP-02/B-02 BLOCKED**.
5. The completed assistant root is unique; record its stable digest and immutable `AssistantTurnKey`. Before execution, re-check current document, owner and digest; changed nodes or ambiguous role imply rejection.
6. **Any manual user submission after initial I3**, including an unrelated question between result send and model continuation, aborts attribution and **blocks** the run. Likewise user editing, regenerate, stop-generation, DOM reordering, another tab's input or navigation. No resumption by picking nearest output.

**UI_SEND_ISSUED does not mean the result was accepted by Gemini.** Only an observed exact newly rendered user-role result turn in the bound transcript may become an `ExpectedInputTurnKey`. If missing or duplicated, remain `INDETERMINATE` and do not re-send.

**Tests:** duplicate-tab conversation, distinct conversations with same title, SPA navigation, new chat, partial stream, stop/regenerate, DOM re-render, user interruption, unexpected third input and reordered messages; any call authorized without proven predecessor fails closed.


## 4. Model ↔ bridge protocol

### 4.1 Canonical **entire assistant-turn** call grammar (RG-003-DES-003)

A tool-call candidate is permitted only when **the complete, fresh, completed assistant message body** is **exactly one top-level tagged code block** containing one strict JSON object. No explanation before/after, paragraph, heading, blockquote, list, wrapper, hidden nodes, other code block or second candidate is accepted:

```text
AssistantBody := TopLevelFencedCall
TopLevelFencedCall := "```gemini-agent-call\n" JsonObject "\n```"
JsonObject := strict JSON object with exactly:
  version = 1
  kind = "tool_call"
  run_marker = current RunMarker
  responding_to = current ExpectedInputTurn correlation
  call_id = bounded nonempty ASCII ID
  tool = "cost.summary" | "ec2.metrics"
  arguments = typed tool-specific object
```

Example (not executable **here**; valid only as the *entire* assistant output in a properly bound Run, with matching marker/predecessor):

```gemini-agent-call
{"version":1,"kind":"tool_call","run_marker":"RUN_MARKER_EXAMPLE","responding_to":"EXPECTED_INPUT_EXAMPLE","call_id":"step-1","tool":"cost.summary","arguments":{}}
```

**Rendered-DOM extraction:** The adapter must identify a unique assistant message content root, then one top-level `pre > code` block with a **verifiably identified** `gemini-agent-call` language marker; no other substantive siblings and not inside quotation/list/sample containers. It **must not** substring-search `innerText` or treat an arbitrary fenced example anywhere in a response as executable. If Gemini's rendered UI discards that language marker or flattens structural role boundaries, **fail closed**; whether the structure is available must be verified in a real browser.

**Only permitted normalizations:** CRLF→LF, zero/one trailing code-block newline, standard JSON whitespace and unordered JSON object field order. No surrounding prose trimming, JSON repair, fence guessing, case folding, content rewording or implicit tool inference.

**Validation order:** active user-authorized Run/owner → specific conversation and expected predecessor → fresh completed assistant evidence → full-body grammar + **0-or-1 candidate count** → `run_marker` and `responding_to` correlate to journal (not authorization by themselves) → strict JSON schema (reject duplicate keys, unknown keys, excessive size/depth, bad IDs or tool) → independent run policy/quota/cancel + final turn/owner fencing → durable ExecutionIntent → actual provider dispatch. A malformed or multi-call turn never executes a subset.

**Irreducible ambiguity:** If Gemini emits a **whole-message, structurally identical block as a code example**, page output alone cannot establish the model's private intention. A valid call is considered only while the run is **explicitly awaiting a model-selected tool decision for the authorized investigation input**. If the user task asks to *explain the protocol*, or the causal context is ambiguous, no call executes. RunMarker is a correlation field, **not proof of semantic intent or authorization**. This residual limitation and adversarial example-only tests are mandatory review/proof items, not grounds to claim perfect intent recognition.


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

Only an **actually executed** mock result can create this envelope. The bridge must also journal its originating `run_marker`, expected result-user-turn correlation and exact outgoing payload digest; the result text does not grant permission. The bridge quotes/escapes embedded instructions, call-shaped JSON, markup and fake roles as **data**, and never parses its own result message as a model-origin call. This is an ordinary Gemini UI message, **not** the native tool role. If the model ignores it, mark the trial failed; do not fabricate success. Oversized data fails rather than being silently truncated.

## 5. Durable state and exclusivity design

### 5.1 Records and identities

| Record | Required fields |
| --- | --- |
| `ConversationOwner` | conversationKey, runId, monotonic ownerEpoch, document binding, owner status, durable terminal/reconciliation marker |
| `Run` | runId, ownerEpoch, **RunMarker, InitialPromptDigest, launchStage, ExpectedInputTurnKey**, allowed tools/budgets, model turn count, tool call count, FSM state, cancel status, active effect permits |
| `TurnObservation` | runId, **InputTurnKey, AssistantTurnKey, predecessorInputTurnKey, role, transcriptOrder, observed active→completed evidence**, completed snapshot digest, document generation |
| `ExecutionIntent` | unique run+conversation+turn+call identity, args digest, ownerEpoch, `RESERVED/MAY_HAVE_DISPATCHED/FINISHED/UNKNOWN`, actual provider count |
| `PublicationIntent` | **separate** stable identity derived from run+conversation+executed result+resultVersion, **exact canonical composer text/payload digest**, bound tab/frame/document/navigation generation, ownerEpoch, single-use nonce, **sender identity**, `RESERVED/PERMIT_OUTSTANDING/ISSUED/OBSERVED_ACCEPTED/UNKNOWN/ABORTED`, UI send issuance count |
| `AuditEvent` | serial event order, bounded IDs, permission decision, intent status, cancellation/dispatch/send order, redacted failure reason |

**Atomic coordination:** owner claim/release, cancellation status, dispatch permit and publication permit changes use a single authoritative transactional boundary around the conversation coordination record. Do not issue permission based on out-of-transaction stale snapshots. The service worker is the **sole writer and effect-grant authority**, all other extension contexts send messages through it.

**Recovery:** On MV3 restart, reload journal before accepting messages. Never steal a conversation owner by lease timeout alone when an old effect could still arrive. Never retry a dispatch or send whose occurrence may be unknown. `UNKNOWN` blocks unsafe owner turnover until separate evidence-backed reconciliation.

### 5.2 Run state machine

```text
IDLE → ACQUIRING_OWNER → AWAIT_INITIAL_USER_SEND → AWAITING_MODEL → VALIDATING
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

The state transitions are journaled with owner epoch, expected predecessor input and document generation. The **initial user prompt is sent once by the human**; all later tool-result sends require a bridge PublicationIntent. Every transition distinguishes intent reservation from **actual** effect issuance; a reserved operation can be lost without violating at-most-once.

### 5.3 Conversation owner

`Acquire(conversationKey, runId)` uses a **linearizable transactional compare-and-acquire**, yielding a fresh monotonically distinguishable epoch. A second tab/run loses without any tool/UI effect. A stale callback carrying an old epoch cannot dispatch or publish. `Release` is allowed only when no execution or publication can still begin. If status is uncertain, owner stays blocked; a timeout is never treated as proof of quiescence.

### 5.4 Tool Execution Intent / provider dispatch

1. Validate completed assistant turn, call grammar, schema, owner, user run scope and quotas.
2. Commit **Execution Intent once** before provider entry; duplicate event, rerender or worker restart finds the used reservation and must not reenter provider.
3. At actual dispatch, serialize the final owner/cancel fence with effect issuance. Phase 0 mock dispatch is **synchronous and deterministic** at this boundary; remote async tools are deferred.
4. If canceled before dispatch commit, do not call provider. If dispatch committed first, allow in-flight work to conclude but prohibit later publication after cancel.
5. A crash after reservation but without known provider outcome ⇒ `INDETERMINATE`, no speculative replay. Evidence records distinguish `reserved`, `entered mock provider` and `completed`.

**Unproven:** Durable storage commit and the in-process provider entry cannot be one database transaction. This conservative protocol may lose invocations but must not duplicate them. Cancellation acknowledgment may wait on unresolved dispatch.

### 5.5 Result Publication Intent — actual UI issuance (RG-003-DES-001)

`FR-20` and `FR-21` require a **distinct durable publication identity/claim** from ExecutionIntent: `run + conversation + actually executed call + resultVersion` with immutable serialized payload digest. An `evidence_id` alone is not unique.

#### 5.5.1 Definition of actual UI send initiation and payload

**`UI_SEND_ISSUED` is the single synchronous invocation of `HTMLElement.click()` on Gemini's unique, enabled, composer-associated Send control, by one authorized content-script actor, with the entire exact journaled tool-result text already present and verified in that same composer.** This is the **extension's actual UI send initiation**, not reservation, permission delivery, success in the Gemini backend, or exactly-once delivery.

The Gemini DOM contract must identify one active composer and one corresponding enabled Send control in the **bound tab/frame/document/conversation**. It rejects hidden/duplicate composers, ambiguous roles, attachments, pending user edits, obsolete controls, or unverified rich-editor behavior. The coordinator journals exact canonical outgoing plain text and `payloadDigest`; the content script must read the **actual sendable editor value**, canonicalize with the identical serializer and match the digest **just before click**. A superficially matching `innerText` alone is insufficient. If the actual rich composer serialization cannot be verified, **B-01/DP-06 BLOCKED**.

Phase 0 permits **only that single click path**, never guessed Enter-key fallbacks, repeated clicks, submit alternatives, or private HTTP calls. `HTMLElement.click()` may be rejected by Gemini or enqueue app-level processing; whether it works is **not proven** and must be measured in real Chrome.

#### 5.5.2 Single executor and duplicate message delivery

- A **single elected UI-effect executor** must be registered per `DocumentKey=(tabId,frameId,documentId,navigationGeneration)`, in the extension's isolated world. Its document-global synchronous singleton registry is acquired **before attaching an effect-message listener**. Reinjection/duplicate initialization must detect the existing executor and **must not register another effect listener**. Passive DOM observers never consume send permits.
- `tabs.sendMessage` targeting `documentId` and frame narrows delivery but **does not guarantee a single listener**. The design does **not** infer at-most-once from API routing. Both a verified sole executor and a shared doc-global spent-nonce registry are required; fail closed if isolated-world sharing, executor uniqueness or sender document identity cannot be proven.
- The coordinator grants **one** single-use, document/epoch-bound issuance permit. It never grants a second for the same PublicationIntent. The elected actor synchronously consumes its nonce in a doc-global set and enters a `sendInProgress` critical section. Duplicated delivery (including forced duplicate handlers) must observe the nonce as spent and must not click.
- The final live-document/conversation/owner/nonce/composer-digest checks, marking nonce spent and invoking `click()` run **in one synchronous JS run-to-completion section with no `await`, timer or queued callback between them**. All content-script issuer paths must use this gate; no other script can independently click under the same permit.
- MV3 worker restart does not mint a replacement nonce or make an outstanding permit reusable. Lost delivery/ACK or duplicate listeners that cannot be ruled out leave `INDETERMINATE`; no resend.

This is a **specific proposed mechanism**, not an established Chrome guarantee. Controlled browser tests must inject duplicate listeners, reinjection, target frame/document mismatches and worker restart. Any observable second `click()`, ambiguous singleton or inability to prove a single executor is **Design/Spike BLOCKED**.

#### 5.5.3 Publication / report contract

1. The coordinator verifies actual provider result, unique publication key/payload digest, run authorization, current owner epoch and expected conversation; it atomically claims `PublicationIntent`. A parallel/duplicate claimant loses; inconsistent payloads fail closed.
2. Before informing the content script, atomically persist `PERMIT_OUTSTANDING`, bound `DocumentKey`, single-use nonce, actor identity, payload digest and an **outstanding effect obligation**. This is a **may-have-issued** recovery state, not proof of a send.
3. The elected content actor verifies exact composer content, consumes the nonce and issues **at most one** synchronous send-control `click()`. Record separate audit events for `PUBLICATION_CLAIMED`, `PERMIT_OUTSTANDING`, `UI_SEND_ISSUED`, and any `OBSERVED_ACCEPTED` message.
4. **`ISSUED`** means the actor invoked `click()` once; it is **not proof** Gemini accepted/submitted the message. **`NOT_ISSUED`** means a positive actor report proves it exited *before* the click, no other actor exists and no old permit can fire later. A dead worker, vanished document or missing ACK is **not `NOT_ISSUED`**.
5. **`OBSERVED_ACCEPTED`** means exactly one **new user-role transcript turn**, in the original verified conversation, matches the full canonical outgoing result text and publication correlation ID. That establishes browser-visible acceptance, **not server acknowledgment**; only this turn can become the next `ExpectedInputTurnKey` (§3.3).
6. If the actor crashes between claim and click, or between click and ACK, or transcript acceptance is absent/ambiguous, mark `UNKNOWN/INDETERMINATE` and **do not** retry. Never equate reservation, `ISSUED`, `OBSERVED_ACCEPTED` and remote Gemini delivery.
7. A second publication action is prohibited **even if Gemini ignored the first**. This is at-most-once initiation, not delivery liveness.

**Non-atomic gap:** IndexedDB cannot transactionally include a DOM click. All reservations are conservatively irrevocable. If the real page launches unexpected delayed extension-side send work or the actual send/acceptance cannot be observed reliably, the design fails closed and **B-01 remains BLOCKED**.

### 5.6 Cancel ACK versus actual effect start (RG-003-DES-001)

Distinguish `CANCEL_REQUESTED` (user input), `CANCEL_GATE_CLOSED` (durable transaction refuses any **new provider dispatch/publication permits**) and `CANCELLED_ACK` (confirmed cancellation after **all previous effect issuers** are positively quiescent).

1. Cancel request is serialized with **provider dispatch** and **publication permit admission** in the coordinator's durable transaction. Closing admission is **not by itself** proof the UI action cannot start: a previous permit may already be in transit to a content script.
2. **Do not commit `CANCELLED_ACK` while any prior permit might still start a click**. Require positive evidence that the one actor either (a) exited before clicking and is permanently unable to do so (`NOT_ISSUED`) or (b) already completed the single click critical section, can never execute it again, **and** a matching result user turn has been **`OBSERVED_ACCEPTED`**. If acceptance is pending, do not ACK based on `ISSUED` alone.
3. No post-check asynchronous `click()` callbacks exist under the protocol. All actual extension-initiated UI send actions occur in a single synchronous actor critical section; actor retirement evidence precedes the final persisted `CANCELLED_ACK` transaction.
4. If an actor, document or UI application-side submission can execute a *new* send after a purported ACK, **the prerequisites are not established**, so do not ACK and mark `CANCEL_PENDING/INDETERMINATE`. No timeout, missing message response or MV3 worker restart proves quiescence.
5. An earlier click/user turn cannot be rolled back. The UI must never represent already initiated sends as canceled. An uncertain UI result may remain blocked permanently.

**Conditional happens-before argument:** At the ACK commit, both new effect gates are closed; every previously permitted actor is proven terminated or has positively finished its only synchronous send action; all nonces are spent, and no future extension click callbacks exist. Therefore no **new bridge UI click** can begin after ACK **if** the singleton executor, sync-send and observed-settlement browser premises are true. A Gemini internal asynchronous network send is **outside the extension's atomicity**, and page-level acceptance/delivery is not guaranteed. Those premises must be directly falsified by controlled and real-browser tests; if unprovable **DP-06/DP-07 BLOCKED**. Do not silently rename a durable permit reservation into "actual send".

### 5.7 Mandatory controlled interleavings

Record **actual mock provider entry counts and actual DOM send-control `click()` counts separately** from journal claims.

- Two tabs same conversation / atomic owner competition, stale epoch callbacks and MV3 worker restarts; duplicate result notifications and parallel publisher transactions.
- Same-document duplicate content script injection/listener, duplicated identical `documentId` messages, two frames, navigation and rerender; ensure **one elected actor and one actual click at most**.
- Cancel before/after validation, execution reservation, **actual provider dispatch**, publication claim, permit grant, actor receiving it, **actual click**, observed accepted user turn and worker ACK loss. Force both orders.
- Composer changed by user after preparation and before click, two composers, changed serialization, missing button or wrong bound conversation ⇒ **zero clicks**, not a best-guess send.
- Worker stops after permit delivery but before click; after click but before `ISSUED` ACK; after observed user turn but before journal commit; old sender after attempted new owner ⇒ no resend and no falsely confirmed Cancel ACK.
- Manual unrelated user input while `ExpectedInputTurnKey` pending, stop/regenerate or altered previous message ⇒ reject subsequent assistant call.
- All logs include owner/document/actor identity, publication/nonce, composer digest, click issuance, optional accepted-user-turn identity, cancel gate close/ACK and uncertainty code.

### 5.8 Manual recovery and quarantine (RG-003-DES-005)

**No generic Reset/Retry.** An uncertain ExecutionIntent or PublicationIntent remains durably bound to the old Run/ConversationKey/OwnerEpoch; it may **never** be replayed automatically.

| State | Permitted resolution | Prohibited |
| --- | --- | --- |
| Pre-effect BLOCKED with affirmative proof **no actor can still initiate** a send/dispatch | Cancel and atomically close/release the owner after positive quiescence evidence | Assuming an unobserved initial prompt was sent |
| `INDETERMINATE` with unknown invocation/publication | Manual inspection of sanitized trace; **quarantine the conversation** and seek independent proof of actor termination/effect status | Resend/reinvoke, clear journal, timeout-based takeover, declaring `NOT_ISSUED` from absent acknowledgment |
| Proof of an earlier `ISSUED` or `NOT_ISSUED` event plus no possible pending issuer | Explicit operator confirmation and durable fenced terminal reconciliation; **no old effect retry** | Reusing an old ExecutionIntent/PublicationIntent for a second attempt |
| Permanently unreconcilable old conversation | Keep **that conversation permanently blocked for automation**; Gemini manual use is allowed. A **distinct new verified conversation** may be used for a fresh run **only when all old send-capable actors/documents are positively quiescent and no installation-wide uncertainty remains** | Silent same-conversation replacement, unlocking by browser tab closure alone, restarting the extension as proof of no send |

Positive proof requires: exact old actor/document fate (no remaining runnable callbacks), owner-epoch fencing, a corroborated current transcript or conclusively destroyed document, and audit-confirmed effect ordering. A user closing a tab or pressing Reset alone cannot establish whether a result reached Gemini. If positive proof is unavailable, **safety wins over liveness**: no same-conversation recovery, potentially indefinite BLOCKED. No special manual override exists in Phase 0.

**Typed failure codes for writing-plans:** `CONVERSATION_UNBOUND`, `INITIAL_PROMPT_MISMATCH`, `TURN_UNATTRIBUTABLE`, `ROLE_AMBIGUOUS`, `MODEL_NOT_COMPLETE`, `CALL_GRAMMAR_INVALID`, `MULTIPLE_CALL_CANDIDATES`, `SENDER_NOT_SINGLETON`, `COMPOSER_DIGEST_MISMATCH`, `PUBLICATION_UNKNOWN`, `OWNER_EPOCH_STALE`, `CANCEL_EFFECT_UNSETTLED`, `RECOVERY_QUARANTINED`. Preserve distinct `PERMIT_OUTSTANDING`, `UI_SEND_ISSUED`, and `OBSERVED_ACCEPTED`.


## 6. UI-safety and failure taxonomy

| Failure / threat | Behavior |
| --- | --- |
| Completion marker absent, streaming stalled, role ambiguous or missing predecessor input | `BLOCKED`; no candidate executed |
| Two valid call envelopes, even identical | Reject all; no batch |
| Unknown tool/invalid argument/budget exceeded | Deny and stop; no provider entry |
| Tool result contains instructions / fake system role | Encoded as data; never grant authority |
| Conversation changed/unknown during execution or publication | No new effect; `BLOCKED` or `INDETERMINATE` |
| Duplicate execution event or provider outcome unknown | At-most-once; no provider retry |
| Duplicate publisher / effect listener or lost UI acknowledgment | Singleton/nonce gate: actual click at most once; `INDETERMINATE` without resend |
| Cancel while send permit outstanding | Cancel remains **pending** until positive actor quiescence plus browser-visible result acceptance (or definitive `NOT_ISSUED`) |
| Old owner epoch or another tab | Deny dispatch/send |
| Gemini refuses tool grammar, wrong next tool, fabricated final data | Count failed scored attempt |
| Additional manual user input, initial prompt mismatch or regeneration | Invalidate predecessor binding; `BLOCKED` |
| Composer digest mismatch / unverified singleton sender | No click; `BLOCKED` |
| Permanently uncertain result publication | Quarantine old conversation; no manual retry or unsafe release |
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
| DP-01 | FR-01/18, AC-05/08 | §3.2 conversation-specific route **plus independent visible corroboration**, same chat/two tabs and different chat/same title; ambiguous ⇒ BLOCKED |
| DP-02 | FR-02/03, AC-01/05 | §3.3 active→completed assistant transition, role, **unique predecessor input**, manual interruption negatives |
| DP-03 | FR-03–05/15, AC-05/07 | §4.1 strict **whole-assistant-turn** tagged code-block grammar; quotes/examples and multiple calls rejected |
| DP-04 | FR-01/18, AC-06 | Atomic ownership/cancel epoch and MV3 restart fault injection; no dual owners |
| DP-05 | FR-07/17/19, AC-01/06 | Actual mock provider entry count ≤1; crash and cancellation schedules |
| DP-06 | **FR-08/20/21**, AC-02/06 | §5.5 single doc effect actor, duplicate listeners, exact composer digest, **actual click count** and lost ACK |
| DP-07 | FR-17/19/21, AC-06/08 | §5.6 Cancel ACK after positive actor quiescence / observed acceptance; race forcing at **actual click** |
| DP-08 | FR-01/08, AC-02/08 | No wrong-conversation send after navigation/owner change; exact result-user-turn causality |
| DP-09 | FR-09/13/14, AC-02–04 | S-A and S-B different decisions from data, same controller; frozen oracle |
| DP-10 | FR-16/**FR-22**, AC-04/10/11 | Immutable built candidate only **after** Execution Gate, before scored trials |
| DP-11 | NFR-01–17, AC-09/12 | No-network/read-only mock, synthetic trace, privileges/prompt injection audit |
| DP-12 | FR-12, AC-10/11 | Versioned unit/fixture/integration/live evidence, manual recovery/quarantine trace, AC-level results |

| DP-13 | FR-01/02/10, AC-01/05/08 | §3.1 fixed user-sent initial prompt after owner claim, exact prefill/message digest and first assistant predecessor |
| DP-14 | FR-07/08/11/20/21, AC-06/08/12 | §5.8 positive-evidence manual recovery or permanent quarantine; no old effect replay |
| DP-15 | FR-03/04/15, AC-05/07 | §4.1 entire-message grammar, code example adversarial tests and Run context |

**DP-01, DP-02, DP-04, DP-06 and DP-07 are priority falsification targets.** The actual effect boundary and browser evidence must be validated independently; this draft does not claim them PROVEN.

## 9. Alternatives and unresolved decisions

| Area | Selected hypothesis | Rejected / deferred |
| --- | --- | --- |
| Conversation lock | One transactional extension coordinator with durable conversation record | Tab-local boolean, non-atomic storage read/write, lease timeout takeover |
| Model calls | Exact **whole-turn** code block with RunMarker/input correlation | Substring or example matching, permissive batch |
| UI integration | Verified conversation and composer with one isolated-world singleton effect actor | Private Gemini API, multiple sender assumptions, guessed route/DOM |
| Dispatch | Durable preclaim + bounded in-process deterministic mock | Retries following unknown outcome, arbitrary local commands |
| Publication | Distinct durable intent, single-use nonce, exact composer digest and one synchronous `click()` | Execution dedupe alone, retry-on-timeout, ACK=delivery assumption |
| Cancellation | Delay ACK until actor quiescence plus observed accepted result / definitive no-issuance | Immediate ACK on permit close, mere worker heartbeat |
| Transport | No native local host in Phase 0 | Premature commitment to Native Messaging/MCP |
| Evaluation | Two frozen contrast scenarios + deterministic oracle | Fixed happy-path controller, Gemini self-grading |

### 9.1 Open blocking questions

- **B-01 UI send:** Proposed actual issuance is one synchronous `sendControl.click()` with exact composer digest. Can Gemini really accept this event, and can its async acceptance and the actor's quiescence be proven before Cancel ACK? Unproven ⇒ BLOCKED.
- **B-02 Completion:** Which actual UI transitions establish assistant **active→completed** and one uniquely attributed reply to `ExpectedInputTurnKey`? No selector is yet proven.
- **B-03 Identity:** Can a conversation-specific route **and independent visible corroboration** distinguish same chat across tabs and distinct chats with same title? If not, BLOCKED.
- **B-04 Coordination:** What IndexedDB transaction boundaries, worker restarts and permit recovery states demonstrate the promised single-owner/cancel/effect ordering?
- **B-05 Protocol:** What happens when Gemini refuses/varies the tagged output? Is the observed success rate adequate without guessing?
- **B-06 Permission:** Is company approval for installing and automating the extension documented prior to Execution Gate?
- **B-07 Initial handoff:** Is the prefilled initial prompt exact and user-sent turn independently observable in Gemini Web?
- **B-08 Singleton/async page behavior:** Can a single effect actor be proven amid reinjection/duplicate listeners and can page-side async send settle be observed?
- **B-09 Recovery:** Can positive quiescence/reconciliation evidence be obtained? If not, old conversation stays quarantined.

If **B-01/B-02/B-03/B-07/B-08** cannot be justified with the approved UI/browser constraints, they are **Major design blockers**, not excuses to weaken Requirements.

### 9.2 Independent Review finding response matrix (author self-review only)

| Finding | Severity | Revision | Blocking proof |
| --- | --- | --- | --- |
| RG-003-DES-001 | Major | §5.5–5.7: actual click, singleton actor, digest, ISSUED/NOT_ISSUED/acceptance, ACK barrier | B-01/B-08, DP-06/07 |
| RG-003-DES-002 | Major | §3.2–3.3: conversation proof, predecessor input, role and completion | B-02/B-03, DP-01/02 |
| RG-003-DES-003 | Major | §4.1: entire-turn grammar, exact normalization, ambiguous sample | B-05, DP-03/15 |
| RG-003-DES-004 | Major | §3.1: one user-sent initial prompt, exclusive owner and first-turn linkage | B-07, DP-13 |
| RG-003-DES-005 | Minor | §5.8: no-reset/no-replay, positive-evidence recovery or permanent quarantine | B-09, DP-14 |

**All five are author-addressed, not independently RESOLVED. Design Gate remains BLOCKED until a fresh independent Design Review of the exact new committed baseline.**

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
