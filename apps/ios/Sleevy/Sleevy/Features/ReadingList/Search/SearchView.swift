import SwiftUI

@MainActor
struct SearchView: View {
    var store: ReadingListStore
    @State private var query = ""
    @State private var isRetryingLoad = false

    var body: some View {
        let snapshot = store.searchSnapshot

        Group {
            if store.isLoading && !snapshot.hasSavedItems {
                ProgressView("Loading your Sleevy...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if !snapshot.hasSavedItems, let loadFailureMessage {
                VStack(spacing: 16) {
                    ContentUnavailableView(
                        "Unable to Load Sleevy",
                        systemImage: "wifi.exclamationmark",
                        description: Text(loadFailureMessage)
                    )

                    Button {
                        Task {
                            await retryLoad()
                        }
                    } label: {
                        if isRetryingLoad {
                            ProgressView()
                        } else {
                            Label("Try Again", systemImage: "arrow.clockwise")
                        }
                    }
                    .buttonStyle(.prominent)
                    .disabled(isRetryingLoad)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if trimmedQuery.isEmpty {
                ContentUnavailableView(
                    "Search Sleevy",
                    systemImage: "magnifyingglass",
                    description: Text("Search saved titles, domains, tags, and links.")
                )
            } else if snapshot.items.isEmpty {
                ContentUnavailableView.search(text: trimmedQuery)
            } else {
                List {
                    SavedItemListRows(items: snapshot.items, store: store)
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
        }
        .background(Color(.systemBackground))
        .navigationTitle("Search")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always))
        .onChange(of: query, initial: true) {
            store.setSearchQuery(query)
        }
        .task {
            await store.loadIfNeeded()
        }
        .refreshable {
            await store.refresh()
        }
    }

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var loadFailureMessage: String? {
        if !store.isOnline {
            return "Connect to the internet, then try again."
        }

        if let errorMessage = store.errorMessage {
            return errorMessage
        }

        if !store.isAPIReachable {
            return "Sleevy could not reach the API. Try again in a moment."
        }

        return nil
    }

    private func retryLoad() async {
        guard !isRetryingLoad else { return }
        isRetryingLoad = true
        defer { isRetryingLoad = false }
        await store.retryLoad()
    }
}
