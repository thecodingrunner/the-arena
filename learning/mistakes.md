# Mistakes

Record meaningful bugs or recurring misconceptions. Preserve the original reasoning.

## YYYY-MM-DD: Short title

- **Problem:**
- **Mistake:**
- **Original mental model:**
- **Correct mental model:**
- **Category:**
- **Prevention:**
- **Follow-up exercise:**

## 2026-10-17: while statements and immutability

BUG: When running tests they were hanging due to an infinite loop in the sanitisePersonality function. The infinite loop was due to a couple reasons. First a replace was being applied to the prompt, but the returned value wasn't being set to a variable, so the value wasnt updating. Secondly, the initial prompt was being compared to an updated one, which would always return true in the statement (initial !== new), therefore the while loop was infinitely looping. 
ORIGINAL MODEL: I believed the code was stripping the prompt of tags, exiting the loop when the values were the same, then slicing down to a specified length if necessary
REAL MODEL: At one point it wasn't redefining a stripped prompt at all, at another it was, but was stuck in an infinite loop where the condition was always true. 
MISSED SIGNAL: the statements result was thrown away (tagsStripped(...)), and none of the variables in the while condition were assigned inside of the loop body. 
ROOT CONCEPT: I misunderstood the fact that javascript strings are immutable, and that I needed to redefine variables. A loop only ends if its condition depends on something that the body changes, and that change moves it towards false. 
PREVENTION: Knowing that variables must be assigned with the updated value from replace, thinking through the flow of the while loop with a simpler example, and running simple tests on a browser console.

BUG: The regex was not successfully stripping the given strings, since [^0-9]+ was stripping closing tags with anything but digits, not only letters and underscores. And [a-zA-Z_]* was stripping tags with 0 or more, making pattern this optional rather than required. 
ORIGINAL MODEL: I believed it was stripping the tags that included a potential tag name such as </tagname>
I thought this [^0-9]+ meant all but digits, plus the following set
[a-zA-Z_]* I thought the * applied to the following set
REAL MODEL: 
[^0-9]+ matches any non-digit, including spaces and >, so it ran past the tag to the end of the string. The * applied to [a-zA-Z_] before it, which made the first letter optional, so </3 matched.
MISSED SIGNAL: The tests failing was the first point I saw the outputs. The outputs showed how far each match ran (only < survived; and 3 vanished).
ROOT CONCEPT: The fact that quantifies apply to the set before it, and that the letter and underscores had to be stated explicitly rather than in a negative statement
PREVENTION:Test a new regex on regex101 against one attack string and one legitimate string before putting it in code
CATEGORY: Missing domain knowledge

## 2026-11-02: Returned a snapshot instead of a live reading (state / getState() vs getState)

## 2026-11-05: arrange, act, assert (don't change arena data)

BUG: was changing the arena data to meet preconditions, but this was leading to failed tests due to the varied starting points of tributes
ORIGINAL MODEL: 
REAL MODEL: the test relied on fixture data for its precondition, instead of arranging it
MISSED SIGNAL: 
ROOT CONCEPT: 
PREVENTION: reassigned the food and water values of the location zone within the test

## 2026-11-05: The move_to test expected the wrong sign, the same as the code

BUG: the test was passing despite the delta sign being incorrect, as the test had been built to match the incorrect engine code
ORIGINAL MODEL: the test was written from the implementation, not the spec, so both agreed on the bug.
REAL MODEL: should write tests before implementing engine logic, and derive values from doc definitions/rules
MISSED SIGNAL: missed the incorrect logic since the test was passing, but hunger was decreasing on moving zones
ROOT CONCEPT: order of writting tests and implementation
PREVENTION: derive expected values from round-execution.md; writing tests first makes that easier, but doesn't guarantee it.

## 2026-11-09: Duplicated loot

BUG: After the victim died, the looted weapon stayed in the victim's inventory as well
ORIGINAL MODEL: I believed my loot test proved the weapon was transferred
REAL MODEL: It only proved the killer had the weapon. A transfer has two sides, add and remove, and my test checked only one. 
MISSED SIGNAL: Had not checked the victims inventory to check that it was empty in the test.
ROOT CONCEPT: A transfer is two changes, not one.
PREVENTION: Ask yourself whether that is the only instance, and whenever passing a intance from one owner to another, make sure the original is removed. Should only have one unique instance at any one point, otherwise this duplication will cause indentification issues down the line. For a transfer, assert both sides.

## 2026-11-09: Wrong bow: chooseWeapon picked the empty bow, so ammo went to -1

BUG: chooseWeapon picked the empty bow, so ammo went to -1. The chooseWeapon function was finding weaponInstances by their definitionIds rather than itemIds. Therefore if two bows existed, it was selecting the empty bow and attempting to use it, leading to ammo of -1. 
ORIGINAL MODEL: I believed the chooseWeapon function was finding the correct weapon instance.
REAL MODEL: It was only selecting the weapon definition. And was leading to the incorrect weapon being selected. 
MISSED SIGNAL: Tests were passing, since a test with two bows in one inventory asserting the ammunition quantity/event after usage had not been added, so it went unnoticed. 
ROOT CONCEPT: Identity vs Kind. itemId says which object, definitionId says what sort. 
PREVENTION: Understanding that there may be more than one instance of the same weapon type. Make sure the desired instance is being selected, rather than any of the same type. Add appropriate tests. Replaced the selection identifier with the itemId, so the specific instance, was found. Also returned the instance and definition from the chooseWeapon function rather than just the id. Ensure that specific instance identifiers are being used rather than general definition ids. 

## 2026-11-09: Double miss: a miss emitted two TributeAttacked events

BUG: a miss emitted two TributeAttacked events, since hit/miss events were being emitted at the start, and another miss event was being emitted in the else part of the outcome === "hit" if statement. Had added a generic attack event with a tertiary statement for the outcome, whilst forgetting to remove the previous miss attack event emit.
ORIGINAL MODEL: I believed the resolveHunt was only emitting one attack missed event. 
REAL MODEL: The attack missed event was being emitted twice in the resolveHunt function. 
MISSED SIGNAL: Had not set up a test for asserting the number of attack events, so the tests were all passing. 
ROOT CONCEPT: the leftover else was isolated carelessness. Events can be emitted an undesirable number of times, so emit quantity must be tested for. 
PREVENTION: When adding a generic attack event emit, make sure the previous ones are removed. Ensure that only one attack event is emitted per hunt. Ensure only one attack event is emitted per hunt. Every test asserted that something was present, usually with findEvent, which returns the first match. None asserted what was absent, or how many. For "exactly one", use filterEvents(...).length or the exact slice approach, not findEvent.

## 2026-11-10: out-of-date aliveTributes bug

BUG: the match loop was attempting to resolve rounds (and apply actions) on tributes from a previous state (the first state), leading to an error being thrown on a move_to action
ORIGINAL MODEL: I thought the tributes from the current state were being used in the perceive function
REAL MODEL: the tributes from the first state we're being passed as an argument, and each agent was given a perception based on its round-0 position, chose a move that was valid from there, and the resolveRound then rejected it against where the tribute really was, what the agent saw and what was true had drifted apart
MISSED SIGNAL: the test error (move from centre to centre), meant the perception and the state disagree
ROOT CONCEPT: state updates create new objects every round, so any reference held across rounds goes out of date (repeated pattern: getState snapshot - line 35, and shallow-copy issues)
PREVENTION: ensured that the tributes were being updated within the loop, rather than instantiated once outside it. Also updated the perceive function so that it takes a tributeId and accessed the tribute from the state rather than passing a full tribute.

## 2026-11-10: stale watch-mode error

BUG: the tests failed in watch-mode after changing the perceive function, even though the function was correct
ORIGINAL MODEL: I thought the function was incorrect
REAL MODEL: The watch-mode tests were using a previous version of the perceive function, causing it to fail
MISSED SIGNAL: the error message didn't match the line pointed at
ROOT CONCEPT: the code may be stale in watch mode (missing knowledge about tooling)
PREVENTION: After changing one package, restart the watcher in any other package that uses it