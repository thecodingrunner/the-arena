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