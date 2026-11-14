1. Exactly one winner. The game never ends in a draw.
2. Actions within a round resolve sequentially. A dead tribute's action is skipped.
3. The engine is deterministic: same seed + same actions gives the same outputs. No Math.random() in the sim.
4. Store each round's chosed actions (inputs), not just the event log (outputs).
5. The engine owns the truth, and the LLM only reacts to it. 
6. The engine builds each tribute's perception. Tributes only see what they could possibly know. 
7. a tribute only knows who attacked them (in memories) when it was a melee attack, and not a ranged attack. Bystanders know who attacked who.
8. When the input means the caller has a bug, crash at the bug, not three steps later.
9. Move events are located at the origin.
10. resting exactly cancels out the starvation drain (+10 / -10)
11. If the attacker has more than one weapon, the weapon used is the one with the highest expected damage for this attacker
12. Hiding keeps a tribute out of memory; perception still shows them this round.