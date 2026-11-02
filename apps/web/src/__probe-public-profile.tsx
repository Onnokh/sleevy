// Throwaway harness for screenshots: the real Public Profile card in a
// Settings-shaped page with a stubbed profile endpoint. Delete me.
import type React from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"

import { ThemeProvider } from "./contexts/theme-context"
import { PublicProfilePanel, PUBLIC_PROFILE_HASH } from "./components/public-profile/public-profile"
import "./styles/base.css"
import "./styles.css"

const params = new URLSearchParams(window.location.search)
const theme = params.get("theme") === "light" ? "light" : "dark"
localStorage.setItem("sleevy:theme", theme)
document.documentElement.dataset.theme = theme

let claimedHandle: string | null = params.get("claimed") === "yes" ? "onno" : null

const real = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  if (url.includes("/v1/profile/handle-availability")) {
    return new Response(JSON.stringify({ available: true }), { status: 200 })
  }
  if (url.includes("/v1/profile/handle") && init?.method === "POST") {
    claimedHandle = JSON.parse(String(init.body)).handle
    await new Promise((resolve) => setTimeout(resolve, 250))
    return new Response(JSON.stringify({ handle: claimedHandle, visibility: "private" }), { status: 200 })
  }
  if (url.includes("/v1/profile")) {
    return claimedHandle === null
      ? new Response(JSON.stringify({ _tag: "ProfileNotFoundError", message: "no profile" }), { status: 404 })
      : new Response(JSON.stringify({ handle: claimedHandle, visibility: "private" }), { status: 200 })
  }
  return real(input, init)
}

function Filler({ title, height }: { readonly title: string; readonly height: string }) {
  return (
    <section className="settings-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="section-description">A card above or below the one we are showing</p>
        </div>
      </div>
      <div style={{ height }} />
    </section>
  )
}

// A strip of harness controls, deliberately unstyled by the app's own classes
// so nothing here can be mistaken for the card being tested.
function ProbeBar({ onArrive, onReset }: { readonly onArrive: () => void; readonly onReset: () => void }) {
  const bar: React.CSSProperties = {
    position: "fixed",
    zIndex: 10,
    left: "50%",
    bottom: "1rem",
    transform: "translateX(-50%)",
    display: "flex",
    gap: "0.5rem",
    padding: "0.5rem",
    borderRadius: "999px",
    background: "rgba(120,120,130,0.22)",
    backdropFilter: "blur(12px)",
    font: "500 13px ui-sans-serif, system-ui, sans-serif",
  }
  const button: React.CSSProperties = {
    padding: "0.35rem 0.75rem",
    border: 0,
    borderRadius: "999px",
    background: "rgba(150,150,160,0.25)",
    color: "inherit",
    cursor: "pointer",
  }
  return (
    <div style={bar}>
      <button type="button" style={button} onClick={onArrive}>Arrive from sidebar</button>
      <button type="button" style={button} onClick={onReset}>Reset to unclaimed</button>
      <a
        style={{ ...button, textDecoration: "none" }}
        href={`?theme=${theme === "dark" ? "light" : "dark"}`}
      >
        {theme === "dark" ? "Light theme" : "Dark theme"}
      </a>
    </div>
  )
}

function ProbePage() {
  return (
    <div className="dashboard">
      <div className="content" id="probe-content">
        <div className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Make Sleevy yours, everywhere you save.</p>
          </div>
        </div>
        <div className="page-sections">
          <Filler title="Account" height="14rem" />
          <Filler title="Source name" height="10rem" />
          <PublicProfilePanel />
          <Filler title="Connected apps" height="14rem" />
          <Filler title="API keys" height="40rem" />
        </div>
      </div>
      <ProbeBar
        onArrive={() => {
          void router.navigate({ to: "/" })
          document.getElementById("probe-content")?.scrollTo({ top: 0 })
          setTimeout(() => void router.navigate({ to: "/", hash: PUBLIC_PROFILE_HASH }), 150)
        }}
        onReset={() => {
          claimedHandle = null
          void queryClient.invalidateQueries()
          document.getElementById("probe-content")?.scrollTo({ top: 0 })
        }}
      />
    </div>
  )
}

const rootRoute = createRootRoute()
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: ProbePage })
const router = createRouter({
  routeTree: rootRoute.addChildren([settingsRoute]),
  history: createMemoryHistory({ initialEntries: [`/#${PUBLIC_PROFILE_HASH}`] }),
})

const queryClient = new QueryClient()
const host = document.getElementById("probe-root")!
createRoot(host).render(
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </ThemeProvider>,
)
