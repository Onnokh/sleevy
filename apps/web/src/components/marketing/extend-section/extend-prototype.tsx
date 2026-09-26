// PROTOTYPE — throwaway.
// Question: what should the "Built to extend." section (REST API and MCP
// server) look like under the new hero, intro, and bento? Looks on the
// existing `/` route, switchable via `?extend=` or the ← → keys:
//   agent   — example prompts on the left play as Claude / ChatGPT conversations
//   stage   — prompts as tabs over one wide window, with the Inbox changing live
//   tabs    — one card, a REST API / MCP switch, and the command to copy
//   cards   — two quiet solid cards like the bento, each with its command
//   spec    — no cards: heading on the left, two spec tables on the right
//   current — the marquee headline and two columns of grey text (baseline)
// The user rejected "cards" and asked for example conversations with the
// Claude and OpenAI marks, so "agent" and "stage" lead. Mono tool rows, a
// green "connected" dot, and a connector chip read as AI-made and are gone.

import { useSearch } from "@tanstack/react-router"
import { MotionConfig } from "motion/react"

import { ExtendSection } from "./extend-section"
import { PrototypeSwitcher } from "./prototype-switcher"
import { VariantAgent } from "./variant-agent"
import { VariantCards } from "./variant-cards"
import { VariantSpec } from "./variant-spec"
import { VariantStage } from "./variant-stage"
import { VariantTabs } from "./variant-tabs"

const variants = [
  { key: "agent", name: "Agent — prompts and a chat" },
  { key: "stage", name: "Stage — chat and live Inbox" },
  { key: "tabs", name: "Tabs — switch and copy" },
  { key: "cards", name: "Cards — two code cards" },
  { key: "spec", name: "Spec — reference tables" },
  { key: "current", name: "Current — marquee" },
] as const

export function ExtendPrototype() {
  const search = useSearch({ strict: false }) as { extend?: string }
  const current = variants.some((variant) => variant.key === search.extend) ? search.extend! : "agent"

  // Reduced motion keeps the fades and drops the slides.
  return (
    <MotionConfig reducedMotion="user">
      {current === "agent" && <VariantAgent />}
      {current === "stage" && <VariantStage />}
      {current === "tabs" && <VariantTabs />}
      {current === "cards" && <VariantCards />}
      {current === "spec" && <VariantSpec />}
      {current === "current" && <ExtendSection />}
      <PrototypeSwitcher variants={variants} current={current} />
    </MotionConfig>
  )
}
