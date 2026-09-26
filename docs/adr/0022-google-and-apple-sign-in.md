# Google and Apple Sign-In, One Account per Email

ADR 0003 chose Google login as Prototype Auth and deferred Sign in with Apple until native iOS distribution was production-worthy, so that Sleevy did not pay for the Apple Developer Program before the product loop was proven. That condition no longer holds. Sign in with Apple was added on 2026-05-15, to the **Native iOS App** and the **Web Companion** at the same time, and the app was in the App Store by 2026-05-22. The Sign in with Apple capability itself needs a paid membership. So Sleevy now offers Google and Apple side by side, this supersedes ADR 0003, and Prototype Auth is retired.

Both providers run through Better Auth in the API. iOS signs in natively and sends the provider's ID token to `POST /api/auth/sign-in/social`; the Web Companion uses the redirect flow. The API turns Apple on only when all five `APPLE_*` settings are present, and offers Google alone otherwise. Both sign-in screens show the Apple button either way.

**An Account is keyed by email, and can have both identities.** A Sleevy **Account** is a Better Auth `user` row, and its email is unique. Each Google or Apple identity is a separate row in Better Auth's `account` table. That row is a **Sign-In Identity**, not an Account; the table name is Better Auth's. At sign-in, Better Auth looks for the identity first, by provider and the provider's user id. If the identity is new, it looks for an Account with the same email. Google and Apple are both trusted providers (`accountLinking.trustedProviders`), so the new identity joins that Account without a prompt, if the Account's email is verified. If no Account has that email, sign-in creates one.

Consequences:

- Apple's Hide My Email gives Sleevy a relay address. If a person hides their email on Apple and also signs in with Google, they get two Accounts, and Sleevy cannot merge them.
- No client offers manual linking. `allowDifferentEmails: false` would stop a manual link to an identity with another email, if one is ever added.
- Anyone with a Google or Apple identity can create an Account. There is no allowlist.
