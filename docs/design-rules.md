1. Exactly one winner. The game never ends in a draw.
2. Actions within a round resolve sequentially. A dead tribute's action is skipped.
4. The engine is deterministic: same seed + same actions gives the same outputs. No Math.random() in the sim.
5. Store each round's chosed actions (inputs), not just the event log (outputs).
6. The engine owns the truth, and the LLM only reacts to it. 