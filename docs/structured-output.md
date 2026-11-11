## Full list of options

| Approach | Guarantees the shape? |
| -------- | --------------------- |
| Ask in the prompt (plus examples) | No, so validate and retry |
| Tool use with strict | Yes, for the tool's arguments |
| Structured outputs (a schema for the whole reply) | Yes, for the reply |
| Constrained decoding on a local model | Yes, but you'd be running your own model |

## Rules and notes
- Field order matters, if reasoning comes before action in the schema, the model "thinks out loud" first then chooses, which tends to give better decisions.
- Haiku 5.5 has built-in thinking, on by default. A reasoning field is visible.
- The reasoning must never reach the engine. 
- Personality being "not obvious" is the reason to add a short in-character line. It gives the narrator flavour and makes personality visible. 
- Relationship tags: another field in the same response, written by the LLM from the events the tribute witnessed. Engine ignores them.
- Schema changes: one Zod schema as the single source of trurth.
- Generates JSON Schema, Typescript type, and the validator. 

Decision
Response structure: { reasoning, line, action, relationshipTags }

Narrator
Response structure: { seq, line }

## Anthropic structured output notes
### When the guarantee does not hold
#### Stop reasons, what happens to the output in each case:
Invalid outputs: if Claude refuses a request for safety reasons, the response has stop_reason: "refusal"
A property that asks for the model’s thinking or step-by-step reasoning might lead to a reasoning_extraction refusal.
If the response is cut off because it reached the max_tokens limit, The response has stop_reason: "max_tokens".

### What schema features are not supported
Recursive schemas
Complex types within enums
External $ref
Numerical constraints
String constraints
Array constraints beyond minItems of 0 or 1
additionalProperties set to anything other than false

Property ordering: required properties appear first, followed by optional properties

### How the TypeScript SDK works with Zod (helper that parses and checks reply)
You can wrap a Zod schema with the zodOutputFormat() helper and pass it to client.messages.parse() ad output_config.format
zodOutputFormat() transforms the schema, and parse() validates the response and returns the parsed result in parsed_output. 


## Validation and fallback
stop_reason ok? → parsed_output present? → game-valid against this tribute's Perception? → use it
any "no"        → (maybe one retry) → fallback

## Test results

schema sent:
```ts
const ContactInfoSchema = z.object({
  name: z.string(),
  email: z.string(),
  plan_interest: z.string(),
  demo_requested: z.boolean()
});
```

model: haiku 5.5

parsed_output:
```ts
{
  name: 'John Smith',
  email: 'john@example.com',
  plan_interest: 'Enterprise',
  demo_requested: true
}
```

stop_reason: end_turn

usage:
```ts
{
  input_tokens: 369,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
  output_tokens: 42,
  output_tokens_details: { thinking_tokens: 0 },
  service_tier: 'standard',
  inference_geo: 'global',
  speed: 'standard'
}
```


The limit .max() in zod is silently ignored, so the validation layer will have to enforce it.