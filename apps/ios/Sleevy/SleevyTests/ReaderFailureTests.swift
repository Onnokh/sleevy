import Testing

@testable import Sleevy

/// A failed read leaves the reader in one of two states, and telling them
/// apart is the whole point: "this page has no article" is settled and sends
/// the reader to the Original URL, while "Sleevy could not be reached" is a
/// question of when and should not send them anywhere.
@Suite("Reader failure")
struct ReaderFailureTests {
    @Test("a definitive rejection means the page has no article")
    func permanentIsNoArticle() {
        // The server looked and there was nothing: extraction is best effort,
        // so a 404 here is ordinary rather than an error to apologise for.
        #expect(ReaderView.Failure.from(.permanent(reason: "404")) == .noArticle)
        #expect(ReaderView.Failure.from(.permanent(reason: "404")).isRetriable == false)
    }

    @Test("a failure to reach Sleevy never claims the page has no article")
    func transientAndUnreachableAreNotNoArticle() {
        // The bug this guards: with the API down, every article in the library
        // reported "Sleevy couldn't extract this page's text" — which is a lie
        // the reader acts on, by leaving for a browser they did not need.
        let faults: [SyncFault] = [
            .transient(reason: "offline"),
            .unreachable(reason: "proxy returned HTML"),
            .authInvalid(reason: "401"),
        ]

        for fault in faults {
            let failure = ReaderView.Failure.from(fault)
            #expect(failure != .noArticle, "\(fault) must not read as a missing article")
            #expect(failure.isRetriable, "\(fault) is worth trying again")
        }
    }

    @Test("each state says a different thing")
    func statesReadDifferently() {
        let missing = ReaderView.Failure.noArticle
        let offline = ReaderView.Failure.from(.transient(reason: "offline"))

        #expect(missing.title != offline.title)
        #expect(missing.message != offline.message)
        // The one the reader can act on keeps the Original URL as its main
        // way out; the other offers to try again first.
        #expect(missing.isRetriable == false)
        #expect(offline.isRetriable)
    }
}
