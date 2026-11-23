# ADR 0026: Local Library without an Account

## Status

Accepted.

## Context

The iOS app opened only after Google or Apple sign-in. A person who wants to try Sleevy had to make an Account first, and the app could not be used at all without the API.

`ReadingListStore` already reaches the API through one interface, `ReadingListNetworkPort`. Demo mode replaces the API with an in-app adapter, and the whole app works with it.

## Decision

The sign-in screen gets **Use Without an Account**. It makes a Local Library: the Saved Items, Folders and Readable Content kept in one file in the app group, on the device.

- `LocalReadingListAdapter` implements `ReadingListNetworkPort`. The store, the lists, search and the Reader View do not change.
- **Enrichment on the device.** For each save the phone fetches the page and reads its title, description, site name and favicon, and its prose as Readable Content. On a device with Apple Intelligence (iOS 26 or later), Apple's on-device model (Foundation Models framework) writes the Preview Summary and picks Tags from the closed vocabulary of ADR 0024. The same model does Auto-Filing: a save that arrived without a Folder goes into the one existing Folder it clearly fits, chosen from the Folder names. A device without it uses the page description, at most two sentences, as the Preview Summary, and gives no Tags and no Auto-Filing. The minimum iOS version does not change.
- There is no Content Check (ADR 0025) and no Jev Classifier on the device. The page text never leaves the phone.
- **The Share Extension** puts a share in the Pending Capture queue of the Local Library. The app saves and enriches it when it opens.
- **The parts that need an Account are hidden:** the Public Profile, publishing a Folder, Organize, and Delete Account. The account menu and Settings offer **Connect an Account** instead. Its sheet sells sync across devices: summaries, Tags and Auto-Filing already work on the device.
- **Connect an Account** signs in, then sends the Local Library to `POST /v1/saved-items/import`. The import keeps the title, description, Preview Summary, Tags, read state and Folder that the device made. The server does not enrich imported saves again. A save that the Account already has (the same normalized URL) is not duplicated. Only after the import worked does the app switch to the Account and erase the Local Library. If the import fails, the reader stays in the Local Library and nothing is lost.

## Consequences

Saves in a Local Library are enriched less well than saves in an Account: the page reader on the device is simpler than the server's, and devices without Apple Intelligence get no summary of their own and no Tags. Those saves keep that after an import, because the server does not enrich them again.

A Local Library is on one device only. A backup of the device keeps it; deleting the app removes it.

The API gets one more write path (the import) that skips Enrichment. Its input is trusted as the person's own data, as a capture is.

Link data is shared by all Accounts. When an imported save points to a Link that the server already has, the server keeps its own data for that Link, and the data from the device is not used. Only a new Link gets the title, description and summary from the device.
