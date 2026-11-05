# Concepts

Record durable understanding, not every definition encountered.

## YYYY-MM-DD: Concept

- **Learner's explanation:**
- **Corrected understanding:**
- **Example:**
- **Related concepts:**


## 2026-10-16: Single source of truth

- **Learner's explanation:** Storing information once in a single place, so that difference sources of information don't contradict one another
- **Corrected understanding:**
- **Example:** Storing alliances on an alliance object rather than in individual tributes
- **Related concepts:** 

## 2026-10-16: Don't put derived values in useState

- **Learner's explanation:** If you can compute it from other state, compute it. Storing it gived two sources of truth and they will drift apart.
- **Corrected understanding:**
- **Example:** Effective power is derived from definition + current holder, so store neither the result nor the function. Compute it in the engine at fight time. 
- **Related concepts:** 


## 2026-10-16: Defence in depth

- **Learner's explanation:** The prompt is a suggestion, and the engine is enforcement.  
- **Corrected understanding:**
- **Example:** Models make mistakes, and a personality prompt can actively try to push them into illegal moves.
- **Related concepts:** 

## 2026-10-16: Idempotency
- **Learner's explanation:** when doing an event twice has the same effect as doing it once
- **Corrected understanding:** 
- **Example:** When deciding which fields to add to the change in hunger and health events, it was decided that adding both the current state and the change is beneficial, so that the same difference cannot be applied twice and the current state is taken as the source of truth (incase a client disconnects), but the change can still be used for commentary. 
- **Related concepts:** HTTP PUT is safe to retry and a naive "add 1" POST isn't

## 2026-10-16: Idempotency key
- **Learner's explanation:** a key that can be used to prevent the same event from being carried out twice
- **Corrected understanding:** 
- **Example:** the giftId on the the SponsorGift Action acts as an idempotency key, created in the client e.g. crypto.randomUUID(), and server checks its own record of processed gift ids.
- **Related concepts:** Payment APIs like Stripe use the same pattern to prevent double charges

## 2026-10-16: a factory vs the thing it makes
- **Learner's explanation:** a factory creates a generator with fresh state, so calling the factory again will create a new generator, rather than running the already one
- **Corrected understanding:** 
- **Example:** mulberry32 is a factory, and calling it creates a generator with a fresh state. It should run once, in createRng. The old seed ran the factory on every call, so each next() built a brand-new generator, and returned that generator, uncalled.
- **Related concepts:** 

## 2026-11-02: arguments are evaluated before the function is called
- **Learner's explanation:** arguments must be evaluated first before a function is called, otherwise the check will be dead, and the function may run on invalid arguments
- **Corrected understanding:** passed the generator, and ran the int function after the check within the pick function
- **Example:** was passing the int function to get the index, before checking that the length of the array was not zero
- **Related concepts:** 

## 2026-11-02: make invalid states unrepresentable
- **Learner's explanation:** splitting types so that only the types with valid states in that moment are used
- **Corrected understanding:** assumed that all values would need to be set on the Tribute type, but the TributeState data can be added later after setup
- **Example:** using TributeConfig and TributeState, so that only the valid states are defined as types when necessary
- **Related concepts:** 

## 2026-11-02: definition vs instance, again
- **Learner's explanation:** an id for a definition can be set, and later used to create an instance. 
- **Corrected understanding:** assumed that instances would have to be set, rather than just using an id to represent a definition
- **Example:** a weaponId or arenaId can be set initially to the GameConfig, without adding the actual instances
- **Related concepts:** 

## 2026-11-05: Vacuous passes 
- **Learner's explanation:** a vacuous pass is when the test passes despite nothing actually running, due to empty loops etc. 
- **Corrected understanding:** Initially assumed a test had passed just because it was green, but it is important to check the test for any potential vacuous passes. 
- **Example:** adding a count guard on the arenaDefinitions to prevent describe.each([]) running on an empty array.
- **Related concepts:** 

## 2026-11-05: Shallow vs deep copy 
- **Learner's explanation:** a shallow copy does not copy objects that are nested in an arraw, whereas a deep copy maps through said objects and copies them.
- **Corrected understanding:** Before I assumed that copying an array like [..arr] would complete a deep copy without having to map the objects nested within it. Now know to take deep copies. 
- **Example:** the zones in createMatch are objects so had to take a deep copy.
- **Related concepts:** 

## 2026-11-05: ! and runtime checks vs types
- **Learner's explanation:** ! is a compile-time promise, whereas if (!x) throw actually narrows and throws an error. 
- **Corrected understanding:** 
- **Example:** 
- **Related concepts:** 

## 2026-11-05: Events isolate cause
- **Learner's explanation:** events record one cause and its effect, whereas the final state is the sum of what happened. Therefore it is easier to test for single events, as the sum does not need to be calculated.
- **Corrected understanding:** Before I was just checking the final state and assuming that the difference would be the impact of a single event. 
- **Example:** Checking the final state of foraging rather than the Event would lead to a failed test if the hunger tick isn't considered
- **Related concepts:** 

## 2026-11-05: Testing seeded randomness
- **Learner's explanation:** when there is seeded randomness, it helps to loop over multiple seeds and check when a rule applied. Taking a count of said events, or comparing the rates with a tolerance adjusted range is useful when the event happens at a certain rate. 
- **Corrected understanding:** 
- **Example:** 
- **Related concepts:** 

## 2026-11-05: Helpers calculate, the orchestrator applies
- **Learner's explanation:** Helpers are for calculating values but should not be applying changes to state, or emitting events, this should be done by the orchestrator
- **Corrected understanding:** 
- **Example:** feed returns {hunger, delta}; resolveRound mutates state and emits, keeping seq order in one place
- **Related concepts:** 

