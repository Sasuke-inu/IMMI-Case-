import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

// -------------------------------------------------------------------
// Hoisted mock factories
// -------------------------------------------------------------------
const { mockUseBookmarks } = vi.hoisted(() => ({
  mockUseBookmarks: vi.fn(),
}));

// -------------------------------------------------------------------
// Module-level mocks
// -------------------------------------------------------------------
vi.mock("@/hooks/use-bookmarks", () => ({
  useBookmarks: mockUseBookmarks,
  createCollection: vi.fn(() => ({
    id: "col-new",
    name: "New Collection",
    description: "",
    tags: [],
    case_order: [],
    case_notes: {},
    created_at: new Date().toISOString(),
  })),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  reorderCollection: vi.fn(),
  removeCaseFromCollection: vi.fn(),
  setCollectionCaseNote: vi.fn(),
}));

// Mock CollectionCard to avoid deep rendering
vi.mock("@/components/collections/CollectionCard", () => ({
  CollectionCard: ({ collection }: { collection: { name: string } }) => (
    <div data-testid="collection-card">{collection.name}</div>
  ),
}));

// Mock CollectionEditor to avoid portal / dialog complexity
vi.mock("@/components/collections/CollectionEditor", () => ({
  CollectionEditor: ({ open }: { open: boolean }) =>
    open ? <div data-testid="collection-editor">Editor Open</div> : null,
}));

// Mock SortableCaseItem to avoid dnd-kit complexity
vi.mock("@/components/collections/SortableCaseItem", () => ({
  SortableCaseItem: ({
    bookmark,
  }: {
    bookmark: { case_id: string; case_citation?: string };
  }) => (
    <div data-testid="sortable-case-item">
      {bookmark.case_citation ?? bookmark.case_id}
    </div>
  ),
}));

// Mock ConfirmModal
vi.mock("@/components/shared/ConfirmModal", () => ({
  ConfirmModal: () => null,
}));

// Mock dnd-kit modules to avoid DOM measurement issues in jsdom
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
  arrayMove: vi.fn((_arr: unknown[], _from: number, _to: number) => _arr),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
  })),
}));
vi.mock("@dnd-kit/modifiers", () => ({
  restrictToVerticalAxis: {},
}));

// Mock api for export
vi.mock("@/lib/api", () => ({
  exportCollection: vi.fn(() => Promise.resolve("<html></html>")),
}));

// -------------------------------------------------------------------
// Import pages AFTER mocks
// -------------------------------------------------------------------
import { CollectionsPage } from "@/pages/CollectionsPage";
import { CollectionDetailPage } from "@/pages/CollectionDetailPage";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderWithRouter(
  ui: React.ReactElement,
  initialEntries: string[] = ["/"],
) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderWithRoute(
  path: string,
  routePath: string,
  element: React.ReactElement,
) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Empty bookmarks state */
function emptyBookmarksState() {
  return { bookmarks: [], collections: [] };
}

/** Bookmarks state with collections */
function withCollections(
  collections: Array<{
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    case_order?: string[];
    case_notes?: Record<string, string>;
    color?: string;
    created_at?: string;
  }>,
  bookmarks: Array<{
    case_id: string;
    case_citation?: string;
    case_title?: string;
    date?: string;
    bookmarked_at?: string;
    note?: string;
  }> = [],
) {
  return {
    bookmarks,
    collections: collections.map((c) => ({
      description: "",
      tags: [],
      case_order: [],
      case_notes: {},
      created_at: new Date().toISOString(),
      ...c,
    })),
  };
}

// -------------------------------------------------------------------
// Tests: CollectionsPage
// -------------------------------------------------------------------
describe("CollectionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // t("bookmarks.collections", "Collections") — second arg is a string,
  // not { defaultValue: ... }, so the mock returns the key "bookmarks.collections"
  it("renders page heading", () => {
    mockUseBookmarks.mockReturnValue(emptyBookmarksState());
    renderWithRouter(<CollectionsPage />);
    const headings = screen.getAllByText("bookmarks.collections");
    expect(headings.length).toBeGreaterThan(0);
  });

  it("shows new collection button", () => {
    mockUseBookmarks.mockReturnValue(emptyBookmarksState());
    renderWithRouter(<CollectionsPage />);
    // t("bookmarks.new_collection", "New Collection") → returns key
    const buttons = screen.getAllByText("bookmarks.new_collection");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no collections exist", () => {
    mockUseBookmarks.mockReturnValue(emptyBookmarksState());
    renderWithRouter(<CollectionsPage />);
    // t("bookmarks.no_collections", "No collections yet") → returns key
    expect(screen.getByText("bookmarks.no_collections")).toBeInTheDocument();
  });

  it("renders collection cards when collections exist", () => {
    mockUseBookmarks.mockReturnValue(
      withCollections([
        { id: "col-1", name: "Research" },
        { id: "col-2", name: "Important" },
      ]),
    );
    renderWithRouter(<CollectionsPage />);
    const cards = screen.getAllByTestId("collection-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Research");
    expect(cards[1]).toHaveTextContent("Important");
  });

  it("shows bookmark count in stats", () => {
    mockUseBookmarks.mockReturnValue(
      withCollections(
        [{ id: "col-1", name: "Research" }],
        [
          {
            case_id: "case-1",
            case_citation: "[2024] FCA 1",
            bookmarked_at: new Date().toISOString(),
            note: "",
          },
          {
            case_id: "case-2",
            case_citation: "[2024] FCA 2",
            bookmarked_at: new Date().toISOString(),
            note: "",
          },
        ],
      ),
    );
    renderWithRouter(<CollectionsPage />);
    // The stats section shows "2" next to "units.cases"
    const caseLabels = screen.getAllByText("units.cases");
    expect(caseLabels.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// Tests: CollectionDetailPage
// -------------------------------------------------------------------
describe("CollectionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders not found state when collection does not exist", () => {
    mockUseBookmarks.mockReturnValue(emptyBookmarksState());
    renderWithRoute(
      "/collections/nonexistent",
      "/collections/:collectionId",
      <CollectionDetailPage />,
    );
    // t("common.not_found", "Not Found") → returns key
    const notFoundLabels = screen.getAllByText("common.not_found");
    expect(notFoundLabels.length).toBeGreaterThan(0);
  });

  it("renders collection name and description", () => {
    mockUseBookmarks.mockReturnValue(
      withCollections([
        {
          id: "col-1",
          name: "My Research",
          description: "Key cases for analysis",
        },
      ]),
    );
    renderWithRoute(
      "/collections/col-1",
      "/collections/:collectionId",
      <CollectionDetailPage />,
    );
    // "My Research" appears in breadcrumb + page header
    const nameElements = screen.getAllByText("My Research");
    expect(nameElements.length).toBeGreaterThan(0);
    expect(screen.getByText("Key cases for analysis")).toBeInTheDocument();
  });

  it("shows empty state when collection has no cases", () => {
    mockUseBookmarks.mockReturnValue(
      withCollections([
        { id: "col-1", name: "Empty Collection", case_order: [] },
      ]),
    );
    renderWithRoute(
      "/collections/col-1",
      "/collections/:collectionId",
      <CollectionDetailPage />,
    );
    // t("bookmarks.collection_detail_empty", "No cases in this collection yet.") → returns key
    expect(
      screen.getByText("bookmarks.collection_detail_empty"),
    ).toBeInTheDocument();
  });
});
