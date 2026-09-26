// The script the agent demo plays: four requests to an agent that has the
// Sleevy MCP server, and what each one does to the Web Companion beside it.
//
// Every step is a real tool from apps/api/src/modules/mcp/McpTools.ts, and
// every change to the pane follows the app's rules. list_saved_items takes no
// search term, so "find" is the agent reading the list itself. The Inbox holds
// unread Saved Items only, so a read one leaves it; a Folder move leaves its
// rows in place (Inbox rows do not show Folders), so the pane opens the Folder.
// The pages are real, so their favicons are too.

export type Client = "claude" | "chatgpt"

export type LinkPreview = {
  readonly title: string
  readonly host: string
  readonly date?: string
  readonly unread?: boolean
}

/** One tool call: the real tool, and what the client says while and after it runs. */
type Call = { readonly tool: string; readonly running: string; readonly done: string }

export type Conversation = {
  readonly client: Client
  /** The request, short, as the button that plays it. */
  readonly prompt: string
  readonly user: string
  readonly attachment?: LinkPreview
  readonly calls: readonly Call[]
  readonly reply: string
  readonly found?: LinkPreview
}

export const conversations: readonly Conversation[] = [
  {
    client: "claude",
    prompt: "Save this for later",
    user: "Save this for later.",
    attachment: { title: "The Tail End", host: "waitbutwhy.com" },
    calls: [{ tool: "save_link", running: "Saving to Sleevy", done: "Saved to Sleevy" }],
    reply: "Saved. It is at the top of your Inbox, and on your iPhone too.",
  },
  {
    client: "chatgpt",
    prompt: "Find that tomato sauce recipe",
    user: "Find that tomato sauce recipe I saved last month.",
    calls: [{ tool: "list_saved_items", running: "Looking through your saved items", done: "Looked through 100 saved items" }],
    reply: "This one? You saved it on 24 August and have not opened it yet.",
    found: { title: "Marcella Hazan's Tomato Sauce", host: "cooking.nytimes.com", date: "Aug 24", unread: true },
  },
  {
    client: "claude",
    prompt: "Put my Japan trip links in a folder",
    user: "Put everything I saved for the Japan trip in my Japan folder.",
    calls: [
      { tool: "list_folders", running: "Checking your folders", done: "Checked your folders" },
      { tool: "list_saved_items", running: "Looking through your saved items", done: "Found 3 for the trip" },
      { tool: "set_saved_item_folder", running: "Moving 3 saved items", done: "Moved 3 saved items to Japan" },
    ],
    reply: "Done. All three are in Japan now.",
  },
  {
    client: "chatgpt",
    prompt: "Mark it read",
    user: "I made the tomato sauce. Mark it read.",
    calls: [{ tool: "set_saved_item_read_state", running: "Marking it read", done: "Marked it read" }],
    reply: "Marked read. It stays in your Library if you want it again.",
  },
]

/**
 * Steps in one conversation: 0 is the request, then each call shows running
 * (step i + 1) and done (step i + 2), and the last step is the reply.
 */
export const stepsOf = (conversation: Conversation) => conversation.calls.length + 2

type PaneItem = LinkPreview & { readonly id: string; readonly trip?: boolean }

const inboxItems: readonly PaneItem[] = [
  { id: "tail", title: "The Tail End", host: "waitbutwhy.com", date: "now" },
  { id: "kyoto", title: "Kyoto Travel Guide", host: "japan-guide.com", date: "12h", trip: true },
  { id: "egg", title: "The Egg - A Short Story", host: "youtube.com", date: "15h" },
  { id: "shinkansen", title: "Shinkansen", host: "en.wikipedia.org", date: "Aug 26", trip: true },
  { id: "sauce", title: "Marcella Hazan's Tomato Sauce", host: "cooking.nytimes.com", date: "Aug 24" },
  { id: "railpass", title: "Japan Rail Pass", host: "japanrailpass.net", date: "Aug 21", trip: true },
  { id: "tanstack", title: "Inside a TanStack Router Navigation | TanStack Blog", host: "tanstack.com", date: "Aug 15" },
]

/** Already in Japan, and read, before the agent moves anything. */
const folderItems: readonly PaneItem[] = [
  { id: "tabelog", title: "Tabelog", host: "tabelog.com", date: "Jul 12" },
  { id: "naoshima", title: "Naoshima", host: "en.wikipedia.org", date: "Jun 3" },
]

/** The unread Saved Items below the ones the pane has room to show. */
const UNSEEN_UNREAD = 17

/**
 * What the agent is doing to a row. "selected" is the app's selected row, for
 * the one item the agent works on; "touched" is a soft fill without the
 * outline, for several at once, where a stack of outlines reads wrong.
 */
export type RowMark = "selected" | "touched"

export type PaneRow = PaneItem & {
  readonly mark?: RowMark
  /** Set on a row that drops into a Folder that just opened: its place in the drop. */
  readonly arriving?: number
}

export type PaneState = {
  readonly view: "inbox" | "folder"
  readonly title: string
  readonly subtitle: string
  readonly rows: readonly PaneRow[]
}

/** The pane at a step of a conversation, with a mark on what the agent touches. */
export function paneAt(active: number, step: number): PaneState {
  if (active === 2 && step >= 4) {
    const moved = inboxItems.filter((item) => item.trip)
    const rows: PaneRow[] = [
      ...moved.map((item, index) => ({ ...item, unread: true, arriving: index })),
      ...folderItems.map((item) => ({ ...item, unread: false })),
    ]
    return { view: "folder", title: "Japan", subtitle: `${rows.length} saves · ${moved.length} unread`, rows }
  }

  const saved = active > 0 || step >= 2
  const read = active === 3 && step >= 2
  const mark = (item: PaneItem): RowMark | undefined => {
    if (active === 2 && step === 3 && item.trip) return "touched"
    const selected =
      (active === 0 && step >= 2 && item.id === "tail") ||
      (active === 1 && step >= 2 && item.id === "sauce") ||
      (active === 3 && step === 1 && item.id === "sauce")
    return selected ? "selected" : undefined
  }

  const rows = inboxItems
    .filter((item) => (saved || item.id !== "tail") && (!read || item.id !== "sauce"))
    .map((item) => ({ ...item, unread: true, mark: mark(item) }))
  return { view: "inbox", title: "Inbox", subtitle: `${rows.length + UNSEEN_UNREAD} unread`, rows }
}
