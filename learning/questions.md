# Questions

Keep unresolved questions concise. Add a date or context when it helps.

## YYYY-MM-DD: Question

- **Context:**
- **Current hypothesis:**
- **Evidence to check:**
- **Status:** unresolved

## 2026-10-16: exhaustive switch with never?

- **Context:**
- **Current hypothesis:**
- **Evidence to check:**
- **Status:** resolved, implemented this in resolveRound, typescript throws an error if a case is deleted. The deleted type reaches default, where it can't be assigned to never, so it's a compile error, not a runtime one. 

## 2026-10-16: should ...tribute be converted to a deeper copy to copy stats

- **Context:** match.tributes[0].stats is the config's stats object
- **Current hypothesis:** stats never change during play, so it is harmless today. But buffs or injuries could potentially modify stats down the line. 
- **Evidence to check:**
- **Status:** unresolved

## 2026-11-05: a tribute who rests every round would survive forever without eating. Change later during tuning?

- **Context:** 
- **Current hypothesis:** 
- **Evidence to check:**
- **Status:** unresolved