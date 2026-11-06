check -> check -> roll -> damage -> death

check if the victim is still alive
->
check if victim is in the same zone as the attacker
->
check if attacker's weapon has ammunition, if no ammunition, attacks unarmed
->
if victim is hiding, run a new roll for spotting the victim
if (victim stealth * victim hide bonus + zone cover + roll > attacker intelligence + roll) victim is not spotted
->
if attacked spots victim, attacker attempts to attack

If the attacker has more than one weapon, the weapon used is the one with the highest expected damage for this attacker (with ties broken by inventory order) : chooseWeapon(tribute)
only cancels hunts later that round, the outcome is always the first thing that stopped the attack

if has ammunition -> ammunition--

if the tribute was previously attacked by a ranged weapon in the round, they cannot counter, so outcome "pinnedDown" is emitted

hit chance = BASE_HIT + attacker.stats[weapon.scalesWith] × HIT_BONUS − victim.agility × DODGE_BONUS   (clamped)

hit rate = rng.chance(hit chance)


->
damage

damage = weapon.power + attacker.stats[weapon.scalesWith] × SCALE_BONUS - (victim.stats.endurance * 0.5) (clamped e.g. 1)

->
if victim health <= 0
victim dies
->
attacker gains victims inventory
->

Events emitted after kill
Tribute attacked (outcome "hit")
Tribute ammunition changed
Tribute health changed (victim)
Tribute died (with kind of attack and killerId)
Tribute gained item

Events emitted after attack (no kill)
Tribute ammunition changed
Tribute attacked (outcome "hit")
Tribute health changed (victim)

Events emitted after unsuccessful attack (not spotted)
Tribute attacked (outcome "notFound")

Events emitted after unsuccessful attack (target gone, died or moved away)
Tribute attacked (outcome "targetGone")

Events emitted after missed attack (spotted, but the hit roll failed)
Tribute ammunition changed
Tribute attacked (outcome "missed")
