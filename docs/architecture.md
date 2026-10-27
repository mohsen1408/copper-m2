# Architecture

How the Copper State Labs app fits together. Each module adds a section at the
end (see [Adding a module](#adding-a-module)) when it changes how the app
works: new pages, tables or AI calls.

_Fictional — for educational use._

## The starter app (Module 0)

A Next.js app that builds, runs and deploys with **no environment variables**.
A Google AI Studio key is optional until a module needs one.

| Piece | Where | What it does |
|---|---|---|
| Pages | `app/` | `layout.tsx` sets the fonts and theme; `page.tsx` is the placeholder home page |
| Brand components | `components/copper/` | `Logo`, `SiteHeader`, `SiteFooter`, `ModeToggle` |
| UI kit | `components/ui/` (shadcn), `components/ai-elements/` (AI Elements) | The only UI libraries the app uses |
| Setup card | `components/setup-required.tsx` | `<SetupRequired service="ai" />`, shown instead of a page whose service isn't configured |
| Company catalog | `lib/copper/catalog.ts`, `lib/copper/data/catalog.json` | Product, plan and privacy facts from the Product Bible (Sections 3, 4, 8 and 10). Pages read prices and plan details from here instead of typing them (added in the Module 1 starter) |
| AI wrapper | `lib/ai/call.ts` | `callText` and `callObject`: every model call goes through these and is logged to the terminal |
| Models and prices | `lib/ai/models.ts`, `lib/ai/pricing.ts` | The approved Gemini models and their token prices |
| Module checks | `specs/module-N/`, `scripts/check.mjs` | Each module's spec, instructions, rubric and acceptance tests; `npm run check` runs them |

## Data flow

1. A user opens a page in `app/`.
2. Server code checks what's configured (`isAiConfigured()`). If the key is
   missing, the page renders `<SetupRequired />` instead of crashing.
3. Data comes from files under `lib/copper/data/`.
4. AI requests go through `callText` / `callObject` in `lib/ai/call.ts`, which
   calls Google and then prints one `[ai_calls]` line: `module`, `feature`,
   `model`, tokens, `cost_usd`, `latency_ms`, `ok`.

```ts
const { text } = await callText(
  { module: 2, feature: "ask-copper" },
  { prompt },
);
```

## Two kinds of "AI tiers"

Don't mix these up:

- **Copper State Labs' product tiers** (On-device, Raw Ore, Refined, the
  Copper Cloud) are part of the fictional company. They are facts in the
  [Product Bible](copper-state-labs/product-bible.md) and rows in the `ai_tiers`
  table.
- **The models this app calls** are real Claude models listed in
  `lib/ai/models.ts`. Their cost is logged in `ai_calls`.

## Decisions

- **No environment variables required.** Every service is optional, so a fresh
  clone builds and deploys before any accounts are set up.
- **One AI wrapper.** Routing every call through `lib/ai/call.ts` gives one
  place to log cost and latency per module and feature.
- **No authentication or row-level security yet.** They arrive in a later
  module.

## Adding a module

When a module changes how the app fits together, add a section here:

```md
## Module N: <feature name>

**Summary:** one or two sentences: what this adds and why.

| Piece | Where | What it does |
|---|---|---|
| Page / route | `app/...` | |
| Components | `components/...` | |
| Data | `lib/copper/data/...` | Data files added |
| AI calls | `lib/ai/call.ts` (module, feature) | Model, prompt purpose, expected cost per call |

**Data flow:** user action → page → server code → database / model → response.

**Decisions and trade-offs:** what you chose, the alternatives, and why.

**Risks and open questions:** cost, privacy, accuracy or safety risks, and how
you handle them.
```

## Module 2: Ask Copper, the shopping chatbot

**Summary:** a floating chat panel on the landing page that answers price,
total and stock questions. With **Use tools** on, the model calls four tools
that read the catalog and the stock list, so it checks instead of guessing;
with it off, the same question goes to the model with no tools, for the
tools-on vs. off comparison.

| Piece | Where | What it does |
|---|---|---|
| Tools | `lib/copper/assistant/tools.ts` | `get_products`, `get_prices`, `calculate_cost`, `check_availability`. Prices from `lib/copper/catalog.ts`, stock from `readInventory()` (read fresh every call). Zod schemas enforce each tool's input contract |
| Instructions | `lib/copper/assistant/instructions.ts` | `COPPER_INSTRUCTIONS`, the system prompt, sent only with tools on |
| Server action | `lib/copper/assistant/ask.ts` | `askCopper({ messages, useTools })` streams through `callStream` (logged to `ai_calls` as module 2, `ask-copper`) and returns a live `Progress`: thinking, tool steps and the reply |
| Panel | `components/copper/ask-copper.tsx` | Launcher, Sheet, two separate chats (tools on/off), starter questions, composer. Opens from the launcher, the header's `#ask` link, or `/#ask` |
| Answer view | `components/copper/ask-copper-answer.tsx` | Draws each answer as stations on a rail: tools available, thinking, an open card per tool call (what was sent, what came back), then the reply |
| Page | `app/page.tsx` | Mounts `<AskCopper aiConfigured={isAiConfigured()} />`; the key itself never reaches the browser |

**Decisions and trade-offs:** `askCopper` returns the live value at once and
reads the stream in the background, so the panel shows each step as it
happens. Tools on and off are separate conversations, each sending only its own
history, so the tools-off model can't copy an answer the tools worked out.
Tool cards render each tool's output as a labelled list, never raw JSON.

**Risks and open questions:** cost per question grows with tool steps (capped
at 5 per question). With tools off the model invents prices and stock; the
panel labels those answers "Answered without tools: may be made up". Without
`GOOGLE_GENERATIVE_AI_API_KEY` the panel shows the setup card instead of the
chat.
