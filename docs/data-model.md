## Tributes

Fixed:
id
Stats: Strength, Agility, Charisma, Endurance, Intelligence, Stealth
Name
Origin
Original Weapon
Mind (custom personality)

```ts
type Stats = {
    "strength": number;
    "agility": number;
    "charisma": number; 
    "endurance": number; 
    "intelligence": number;
    "stealth": number;
}
```

Changes:
HP
Hunger
Position (zoneId)
alive: boolean
agent memory
Inventory (initial weapon, picked up/stolen weapons, Sponsor items (Ration Pack, Water Flask, Medkit, Antidote, Arrows, Night goggles))

## GameState

Alliances live on GameState, not Tribute: single source of truth.

GameState
    tributes: Tribute[]
    alliances: Alliance[] // e.g. { id, memberIds: [3, 7] }

Alliances


## Action

```ts
type Action = 
    | { type: "forage" }
    | { type: "hide" }
    | { type: "rest" }
    | { type: "hunt", targetId: string }
    | { type: "betray", allyId: string }
    | { type: "move_to", zoneId: string }
    | { type: "use_item", itemId: string }
```

forage
hide
rest
hunt
betray
move_to
use_item

## Weapon 

WeaponDefinition
weapon_def_id
range: number
reload_time / attack_speed: number
power: number
foraging_bonus: number
scales_with: keyof Stats

WeaponInstance
weapon_id
WeaponType: weapon_def_id
ammunition: number

## Map

Edges are {from, to}: allows one-way edges and per-edge cost.

Map
    zones: Zone[]
    adjacency: [
        { from: "ruins", to: "cornucopia", cost: 2}
    ]

Zone
id
name
food
water
cover
hazard_level

## GameEvent

different potential events:
change in hunger
change in health
death from hunger
death from hazard
attack/assault: wounding
attack/assault: death
zone hazard
change in zone food
change in zone water
Tribute gaining item
zone closing
forage
rest
betrayal
item usage
moving to a different zone

Generic structure
event: {
    type: string;
    location: zoneId;
    time: {
        round: number,
        seq: number
    }
    targetId?: string;
    victimId?: string
}

Type definition
```ts
type EventBase = {
    location: zoneId;
    time: {
        round: number,
        seq: number
    };
}
type EventType = EventBase & ({
    type: "death";
    cause: "hunger" | "hazard" | "attack";
    hazardType?: keyof Hazards;
    killerId?: string;
    victimId: string;
} | {
    type: "flood";
})
```

