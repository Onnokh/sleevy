import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    /**
     * Scroll containers that are not the window get their offset carried from
     * the outgoing location to the incoming one — that is the router's default,
     * and for the Reader View's article pane it means a new article opens at
     * whatever depth the last one was left at. Naming the element here does two
     * things: the carry-over skips it, and it is scrolled to the top on a
     * forward navigation. Going back still restores where the article was left,
     * because a back navigation restores rather than resets.
     *
     * The router does this after its own restore pass, so it settles the
     * question. Resetting the element from a page effect does not: the effect
     * runs first and the restore overwrites it.
     */
    scrollToTopSelectors: ["[data-scroll-to-top]"],
  })
}
