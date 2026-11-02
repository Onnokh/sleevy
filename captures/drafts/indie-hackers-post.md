# Indie Hackers post — draft 2 (prose)

**Where:** Indie Hackers feed, main group. Post today, while the Product Hunt page is live.
**Title:** Pocket shut down and I built the replacement I wanted. Four months, 566 commits.

---

Pocket closed in July last year and I did not really miss the app. I missed the
pause it gave me.

That sounds precious, so let me be concrete. I find something interesting, I have
no time for it right now, and I need somewhere to put it that I actually trust.
Pocket was that place. Once it was gone, the interesting thing just stayed an open
tab. Then there were forty tabs. Then I closed all of them in one sweep and lost
whatever was in there. I did that three or four times before I accepted it was a
real problem and not a personal failing.

So on the first of May I started building the replacement. The iPhone app is on
the App Store now, and it went on Product Hunt this morning, which is the only
reason I am finally writing about it instead of just committing to it.

The whole thing comes out of one decision. Every reading list I tried wanted me to
file the link before I read it: pick a folder, add a tag, say what this is for. It
asks at the exact moment I know the least about the thing, because I have not read
it yet. That is a small cost, but it is enough of one that I would just leave the
tab open instead. So Sleevy takes the URL and nothing else. One action from the
iOS share sheet, a Chrome extension, Raycast, the web app, or a script, and the
title and image and a short summary get filled in behind you. Folders and tags are
there if you want them. Never touching them is a completely valid way to use it.

The home screen is an inbox rather than a list of everything, so items leave when
you read them. I went back and forth on that for weeks and it turned out to settle
more arguments with myself than any other choice in the app.

Two things surprised me on the way.

The first is that the API stopped being a checkbox. I built it for me, because I
wanted to save links from a script, and I gave it a documented REST endpoint and a
key you make yourself in settings in about a minute. That was a selfish weekend.
It is now the single most common reason a developer tries the app at all. I would
not have guessed that, and I am still not sure whether the lesson is "developers
like APIs" or "the thing you build for yourself is the thing that is honest".

The second is stranger, and it is the part I would want to talk about. Sleevy runs
an MCP server, so an assistant can save a link for you or tell you what is in your
queue. Writing the tools was an afternoon. The hard part was letting an agent that
has never seen my service work out how to sign in on its own, at three in the
morning, with nobody around to ask. A human developer reads your docs and guesses
the rest. An agent cannot guess. So every step has to point at the next one: the
401 says where the rules live, the rules say where to register, registering hands
back a credential, and the person can revoke it in one tap from the same settings
screen. I also wrote the whole flow out as one page of plain English at
/auth.md, for the agents that would rather read sentences than JSON, and I have a
test suite whose only job is to check my own site stays readable to software. I did
not expect to write that this year. I suspect a lot of products will have one
within twelve months.

The least glamorous win was the App Store listing. It is localized into about
fifty locales, screenshots included, and I did not translate any of it by hand or
pay anyone. The metadata sits in the repo as one JSON file per locale, and a CLI
plus an agent skill fills them in and pushes them up. It cost me an evening. The
only genuinely annoying part is the screenshots, because German and Finnish will
walk straight through a layout you designed in English, so the text needs safe
bounds before you render anything.

Where it actually stands: iPhone app, Chrome extension, Raycast extension, a web
app you can drive entirely from the keyboard, a public API, the MCP server, and
opt-in public profiles if you want to share a folder. Four months, 566 commits,
one person. [ADD YOUR REAL NUMBERS HERE — installs or signups since launch, even
if they are small. Or delete this sentence.]

The thing I keep going in circles on is offline reading. Sleevy has no reader mode
and no annotations. It takes you to the original page. I tell myself that is a
scope decision, and some weeks I am fairly sure it is the reason it will never
fully replace Pocket for most people. So if you used Pocket: was the offline
reader the point for you, or was the pause the point?

It is on the App Store and at sleevy.app, and on Product Hunt today if you want to
see the launch page. Happy to get into the stack in the comments, it is Effect on
the server and SwiftUI on the phone.

---

## Notes before posting

- The forty-tabs story and "three or four times" are my guess at your version.
  Swap in what actually happened, or cut the paragraph. It should be true.
- Fill in or delete the numbers sentence. Do not invent one.
- Attach the hero video or one screenshot.
- Add Sleevy as a Product on your IH profile first.
- No upvote ask. Product Hunt gets one mention, at the end.
- Keep an hour free afterwards to answer every comment.
