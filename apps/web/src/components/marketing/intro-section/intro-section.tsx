import styles from "./intro-section.module.scss"

// The claims here are the ones public/index.md makes: capture without
// organizing first, and a queue whose read state, folders, and tags sync.
const steps = [
  {
    title: "Save",
    body: "Share a link from any app on iPhone, click once in Chrome, or save it from Raycast. No need to sort it first.",
  },
  {
    title: "Sync",
    body: "Your queue syncs instantly across devices, so it's current wherever you open it.",
  },
  {
    title: "Read",
    body: "Open it when you have time. Sleevy marks it read and keeps it in your library, in folders if you want them.",
  },
]

/** What Sleevy is, in one sentence, then the flow in three steps. */
export function IntroSection() {
  return (
    <section className={styles.section} aria-labelledby="intro-title">
      <div className={styles.inner}>
        <h2 className={styles.statement} id="intro-title">
          Sleevy is a bookmark manager. <span>Save a link the moment you find it, and read it later on any device.</span>
        </h2>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.number} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
