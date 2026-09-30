# ADR 0024: Jev Classifier for Tags, Auto-Filing, and Organize

## Status

Accepted. Amends ADR 0002 for how Enrichment Tags are chosen.

## Context

AI Enrichment asked one language model for the Preview Summary and the Enrichment Tags in one request. Tags are a closed vocabulary, so the choice is a classification, not writing. A language model gives no calibrated confidence for that choice, so Sleevy cannot tell a clear Tag from a guess.

People also asked for new saves to go into their Folders without manual work. A wrong Folder hides a Saved Item where the person will not look, so this needs a confidence bar, and it must never invent a Folder.

TypeSafe's Jev model answers typed questions (yes/no, or a choice among options) with probabilities.

## Decision

Use the Jev Classifier for Enrichment Tags and for Auto-Filing. Keep the language model only for the Preview Summary, because Jev cannot write text.

- Tags: one yes/no question per Tag in one request. A Tag applies at a probability of 0.5 or more.
- Auto-Filing: one Choice over the Account's existing Folder names plus a "none of these folders" option. Each Folder carries up to five recent titles of Saved Items already in it, because a bare name such as "Work" says little. A Saved Item is filed only when the winner is a Folder and its confidence is 0.75 or more. Per-Folder yes/no questions were tried and were badly calibrated.
- The model is pinned (`TYPESAFE_MODEL`, default `jev-1.13.0`), because the thresholds were tuned against it. `jev-latest` is an alias that can move.
- Auto-Filing runs after Enrichment, per Saved Item, only when the save arrived without a Folder. The write is conditional on the item still being unfiled, so a Folder the person sets always wins.
- Auto-Filing is an Account Setting, stored on the server in `account_settings`. The column defaults to on for new Accounts. The migration writes off for every existing Account, so nobody sees saves move without having chosen it.

### Organize

Organize sorts the Saved Items that are already unfiled, which Auto-Filing never touches. It is a Settings action, not a setting, and it is the only place that may create Folders.

- It runs in the background over at most 2,000 unfiled Saved Items, in batches of 50. One run per Account is stored in `organize_runs`, with its progress and, at the end, the Organize Plan. A run that stops writing progress for five minutes counts as failed.
- Pass one: a language model proposes new Folders for each batch, given the Account's Folders with example titles, and told to match their naming style, emoji, and colour. Each batch sees the Folders proposed before it. At most 12 new Folders per run.
- Pass two: Jev files every Saved Item among the existing and proposed Folders, with the same Choice and 0.75 confidence bar as Auto-Filing. A proposed Folder that gets fewer than two Saved Items is dropped.
- The person applies the part of the plan they keep. Only then are Folders created. A proposed name that the Account already uses reuses that Folder, and a Saved Item filed since the plan keeps its Folder.

Names come from the language model because Jev cannot write text. Placement comes from Jev because its confidence decides when to leave a Saved Item alone.

## Consequences

Enrichment sends the Extracted Page Content to two processors (TypeSafe and the language model provider) instead of one. The tagging and preview-summary stages now fail independently.

Without `TYPESAFE_API_KEY`, Links get no Enrichment Tags, Auto-Filing files nothing, and Organize answers `503`; everything else keeps working. Without the language model, Organize still files into existing Folders but proposes none.

Changing the pinned model needs the thresholds to be checked again.
