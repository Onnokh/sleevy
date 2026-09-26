import { Outlet, useLocation } from "@tanstack/react-router"
import { domAnimation, LazyMotion } from "motion/react"

import { MarketingNav } from "../components/marketing/marketing-nav/marketing-nav"
import { MarketingFooter } from "../components/marketing/marketing-footer/marketing-footer"
import { RybbitScript } from "../components/marketing/rybbit-script"
import styles from "./-marketing-layout.module.scss"

export function MarketingLayout() {
  // On the homepage the nav sits bare on the hero until the page scrolls.
  const onHome = useLocation({ select: (location) => location.pathname === "/" })

  return (
    <LazyMotion features={domAnimation}>
      <RybbitScript />
      <main className={styles.page}>
        <MarketingNav bareAtTop={onHome} />
        <Outlet />
        <MarketingFooter />
      </main>
    </LazyMotion>
  )
}
