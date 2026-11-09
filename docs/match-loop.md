### Match loop rules

1. the loop lives in apps/cli
2. perceive is in sim, with the Perception type in shared
3. visibleTributes includes tributes who hid, with hidLastRound
4. the round cap and the tie-break chain are in resolveRound, which emits matchEnded
5. resolveRound throws if called after the match has ended

the agent gets its own RNG:
it lives in the loop and gets passed to the random agent, the same way sim receives its rng. 
it isn't stored in GameState
use a --agent-seed CLI flag that defaults to matchSeed + 1

verification plan:
perceive, the random agent, the end check and tie-break, the loop

Perceive
- perceive only returns visibleTributes located in the same zone as the tribute (no tributes from other zones)
- no personality prompts of other tributes
- perceive only returns adjacentZones accessible from the current zone
- if a tribute from visibleTributes was hiding the previous round, it will have a true hidLastRound value
- perceive returns a Perceive object with the correct round number
- the tribute itself isn't in visibleTributes
- dead tributes arent in visibleTributes
- perceive doesn't modify the state


The random agent
- hunt target is in visibleTributes
- a move_to target is in adjacentZoneIds
- the random agent cannot select hunt if its perceive input has an empty visibleTributes field
- the random agent cannot select move_to if there are no adjacent zones
- the random agent cannot select 
- over many seeds, every action type that's possible shows up at least once
- th same agent seed and the same perception give the same action

The end check and tie-break
- if there is one tribute alive, the MatchEnded event will be emitted once with the match results of kind "lastStanding"
- if there are more than one tributes alive and the max round limit is reached, the MatchEnded event will be emitted with the match results of kind "tiebreak" and cause "timeout"
- if there are 0 alive after the round, the MatchEnded event will be emitted with the match results of kind "tiebreak" and cause "draw"
- in a tiebreak ending, the tribute with the greater hp at the start of the round will win
- in a tiebreak ending, with both tributes of equal hp at the start of the round, the tribute with the most kills will win
- in a tiebreak ending, with both tributes of equal hp and kills, higher endurance wins more often, but the lower one still wins sometimes
- MatchEnded is emitted exactly once, and it's the last event of its round (check seq)
- placements: every tribute appears exactly once, the winner is at index 0, and the earlier deaths are placed lower


The loop
- in a round where the match has already ended (match state with ended flag), will throw an error
- the same seed with recorded decisions produces an identical event log
- the game runs to completion, exactly one MatchEnded event emitted, never thows, never goes past MAX_ROUNDS
- exactly one action per living tribute, and none for dead tributes

function agent(perception: Perception, agentRng: Rng): Action {}