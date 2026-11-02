## Tributes

Fixed:
id
owner: player | AI
Stats: Strength, Agility, Charisma, Endurance, Intelligence, Stealth
Name
Origin
Original Weapon
Mind (custom personality)

Changes:
HP
Hunger
Position (zoneId)
alive: boolean
agent memory
Inventory (initial weapon, picked up/stolen weapons, Sponsor items (Ration Pack, Water Flask, Medkit, Antidote, Arrows, Night goggles))

```ts
type TributeConfig = {
    // Fixed
    tributeId: TributeId;
    stats: Stats;
    name: string;
    origin: District;
    personality: string;
    startingWeaponDefId: string;
    owner: PlayerId | null; // null = AI-controlled
} 

type TributeState = {
    hp: number;
    hunger: number;
    position: ZoneId;
    alive: boolean;
    memory: string[];
    inventory: InventoryItem[];
}

type InventoryItem = WeaponInstance | SponsorItemInstance;

type Tribute = TributeConfig & TributeState;

type District = "Saltworks" | "Glassmouth" | "Blackfenn" | "The Quaries" | "Hollow Pines";

type Stats = {
    "strength": number;
    "agility": number;
    "charisma": number; 
    "endurance": number; 
    "intelligence": number;
    "stealth": number;
}
```

## GameState

Alliances live on GameState, not Tribute: single source of truth.

```ts
type GameState = {
    tributes: Tribute[];
    alliances: Alliance[]; // e.g. { id, memberIds: [3, 7] }
    zones: Zone[];
    matchId: MatchId;
    seq: number;
    round: number;
    rngState: number;
    nextItemId: string;
    arenaId: ArenaId;
}
```

Alliances


## Action

```ts
type PlayerId = string;
type TributeId = string;
type ZoneId = string;
type MatchId = string;
type ArenaId = string;

type Action = 
    | { type: "forage" }
    | { type: "hide" }
    | { type: "rest" }
    | { type: "hunt", targetId: TributeId }
    | { type: "betray", allyId: TributeId }
    | { type: "propose_alliance", tributeId: TributeId }
    | { type: "accept_alliance", proposerId: TributeId }
    | { type: "move_to", zoneId: ZoneId }
    | { type: "use_item", itemId: string };

type SponsorGift = {
    giftId: string, 
    from: PlayerId | null, 
    to: TributeId, 
    itemDefId: string, 
    appliesInRound: number
}
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

```ts
type WeaponDefinition = {
    name: string;
    weaponDefinitionId: string;
    range: number;
    attackSpeed: number;
    power: number;
    foragingBonus: number;
    scalesWith: keyof Stats;
}

type WeaponInstance = {
    weaponId: string;
    weaponType: string; // weaponDefinitionId
    ammunition: number;
}
```

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
    matchId: string;
    seq: number;
    round: number;
    location: ZoneId;
    v: 1;
}

type TributeDied = EventBase & {
    type: "TributeDied";
    cause: DeathCause;
    victimId: TributeId;
}
type DeathCause =
    | { kind: "attack", killerId: TributeId }
    | { kind: "hunger" },
    | { kind: "hazard", hazard: keyof Hazards }
type ZoneFlooded = EventBase & {
    type: "ZoneFlooded";
    zoneId: ZoneId;
}
type TributeHungerChanged = EventBase & {
    type: "TributeHungerChanged";
    tributeId: TributeId;
    delta: number;
    hunger: number;
}
type TributeHealthChanged = EventBase & {
    type: "TributeHealthChanged";
    tributeId: TributeId;
    delta: number;
    health: number;
}
type TributeAttacked = EventBase & {
    type: "TributeAttacked";
    attackerId: TributeId;
    victimId: TributeId;
}
type ZoneFoodChanged = EventBase & {
    type: "ZoneFoodChanged";
    zoneId: ZoneId;
}
type ZoneWaterChanged = EventBase & {
    type: "ZoneWaterChanged";
    zoneId: ZoneId;
}
type TributeGainedItem = EventBase & {
    type: "TributeGainedItem";
    tributeId: TributeId;
    item: InventoryItem;
}
type ZoneClosed = EventBase & {
    type: "ZoneClosed";
    zoneId: ZoneId;
}
type TributeForagedFood = EventBase & {
    type: "TributeForagedFood";
    tributeId: TributeId;
}
type TributeRested = EventBase & {
    type: "TributeRested";
    tributeId: TributeId;
}
type TributeBetrayedAlliance = EventBase & {
    type: "TributeBetrayedAlliance";
    betrayerId: TributeId;
    allianceId: string;
}
type TributeUsedItem = EventBase & {
    type: "TributeUsedItem";
    tributeId: TributeId;
    item: SponsorItemInstance;
}
type TributeChangedZone = EventBase & {
    type: "TributeChangedZone";
    tributeId: TributeId;
    previousZoneId: ZoneId;
    currentZoneId: ZoneId;
}
type TributeReceivedGift = EventBase & {
    type: "TributeReceivedGift",
    recipientId: TributeId;
    senderId: PlayerId | null;
    itemDefinitionId: string;
    giftId: string;
    appliedInRound: number;
}


type GameEvent = TributeDied | ZoneFlooded | TributeHungerChanged | TributeHealthChanged | TributeAttacked | ZoneFoodChanged | ZoneWaterChanged | TributeGainedItem | ZoneClosed | TributeForagedFood | TributeRested TributeBetrayedAlliance | TributeUsedItem | TributeChangedZone | TributeReceivedGift;
```

Sponsor Item

Is gifted from a player (or by AI hence the optional null on sender) to a Tribute, and can be passed to another Tribute if the initial recipient dies. It has an effect, of which the impact will be dependent on the user and their stats.

```ts
type SponsorItemDefinition = {
    itemDefinitionId: string;
    name: string;
    cost: number;
}

type SponsorItemInstance = {
    type: string; // itemDefinitionId
    itemId: string; 
}
```

## MatchConfig

Lives in: shared

```ts
type MatchConfig = { 
    matchId: MatchId, 
    seed: number, 
    arenaId: ArenaId, 
    tributes: TributeConfig[]
    }
```