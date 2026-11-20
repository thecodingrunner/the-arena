# Alliances (Phase 1 step 10)

The design for alliances: how they form, how they end, and what each package has to change. The `test.todo`s in `sim`, `witnessed` and `decide` are the test list; this doc is the reasoning behind them.

**Definition of done (brief):** an alliance only forms when both sides agree, allies can't attack each other, and a betrayal shows up in the betrayed tribute's memory.

## Decisions

| Decision | Choice |
| -------- | ------ |
| Members | Pairs, at most one ally each (for now). Stored as pairs, so lifting the limit later is one validation rule, not a redesign |
| Propose / accept | Proposing uses round N's action, accepting uses round N+1's |
| Offer lifetime | One round. Any other action in N+1 ignores it. Several offers: accept one, the rest fail |
| Accept conditions | Proposer alive and in the same zone, neither side already allied |
| Mutual proposals | Form immediately in round N, when the second proposal resolves (same alive and same-zone checks) |
| Hunting your target | Withdraws your offer, independent of initiative order (decided from the round's actions, before anything resolves) |
| Visibility | Public: `allyId` in perception, and `AllianceFormed` / `AllianceBetrayed` are public events |
| Storage | `GameState.alliances` and `GameState.pendingProposals` (engine facts live in state, not rebuilt from the log) |
| Shared sightings | Cut: a hunt needs the same zone, so seeing someone in another zone through an ally isn't actionable |
| Betray | Ends the alliance and attacks the ally, with a surprise hit bonus reduced by the victim's charisma |
| Same zone | The ally must be in the same zone (and visible) for a betrayal, like a hunt |
| Surprise bonus | `Math.max(0, SURPRISE_HIT_BONUS - charisma × CHARISMA_BETRAYAL_FORESIGHT)`, in a pure `surpriseBonus(charisma)` helper. Charisma 10 brings it to about 0. The final hit chance still goes through `MIN_HIT_CHANCE` / `MAX_HIT_CHANCE` |
| No fighting back | A betrayal that **hits** pins the victim, like a ranged hit (reuses the existing `pinned` set). A miss doesn't |
| Spotting applies | Same as a hunt, so a hiding ally still has to be found |
| Two betrayals in one round | Both resolve as attacks with the surprise bonus. The second resolves after the alliance has already ended (**open:** does it still emit `AllianceBetrayed`, or only the attack events?) |
| No peaceful exit | An alliance only ends by betrayal or death |
| Death ends it | When a member dies (from anything), the alliance is removed from `GameState.alliances` (**open:** emit an event, or is `TributeDied` enough?) |

## Events

| Event | Visibility | Notes |
| ----- | ---------- | ----- |
| `AllianceProposed` | Private: proposer **and** target | |
| `AllianceFormed` | Public | |
| `AllianceProposalFailed` | Private: proposer **and** target | `reason: "ignored" \| "withdrawn" \| "targetAllied" \| "proposerGone" \| "proposerAllied"`. `proposerGone` means dead **or** not in your zone, like `targetGone` for hunts |
| `AllianceBetrayed` | Public, if the target has already left when the proposal resolves, it fails at once with outcome: "targetGone"  | |


A betrayal **also** emits the normal combat events (`TributeAttacked`, `TributeHealthChanged`, and `TributeDied` / `TributeGainedItem` on a kill). Facts, `describeEvent` and weapon pickup then work without new code.

"Private" means `isOwn` is true for **both** the proposer and the target, the same way attacks count for attacker and victim.

## Invariants in `sim` (throw, like hunting yourself)

With the game gate and the withdraw rule, `sim` should never receive these, so they're bugs:

- `accept_alliance` with no matching pending proposal
- `hunt` on a current ally

## Types

- `Alliance.memberIds: [TributeId, TributeId]`: the tuple makes "exactly two" a compile-time guarantee
- `PendingProposal: { proposalId, proposerId, targetId, round }`
- After round N+1, every proposal from round N is removed from `pendingProposals`, whatever happened to it

## Outside `sim`

- **Perception:** `allyId` for self and for each visible tribute, plus the offers waiting for me (proposer ids). The prompt's `accept_alliance` menu needs them
- **`decide` game gate:**
  - `propose_alliance`: target visible, target has no ally, I have no ally → otherwise `illegalProposal`
  - `accept_alliance`: an offer from that proposer is waiting for me → otherwise `illegalAccept`
  - `betray`: target is my ally and visible → otherwise `illegalBetray`
  - `hunt` on my ally → `illegalHunt` (betray first)
- **Prompt:** menu entries for the three actions, the alliance rules (one round to accept, hunting withdraws, no peaceful exit), the betrayal and charisma rules (numbers from constants), the offers waiting for me, my ally, and each visible tribute's ally. Optional flavour: show the proposer's charisma on an offer
- **LLM schema:** remove the alliance actions from `LlmAction`'s `Exclude` and add them to `actionSchema`
- **Random agent (open):** when it proposes, accepts and betrays, as rough rules or probabilities (for example: accept any offer some of the time, betray rarely)
- **Facts:** "betrayed you", "allied with" (the "Later" comment on `Facts`)
- **`describeEvent`:** a line for each new event
