# 6. Bookmarks Page

## Purpose

The Bookmarks Page provides a centralized view for managing all bookmarks across all books. Users can browse, organize, and navigate to saved reading positions.

## Design/Layout

**Page Structure:**
- Book selector dropdown at top
- Grid of bookmark cards below
- Each card displays:
  - Small avatar icon (book color-coded)
  - Bookmark name/title
  - Preview text (first 100 chars)
  - Chapter number badge
  - Creation timestamp (relative, e.g., "2 hours ago")
  - Actions: "Go to Bookmark", Edit, Delete

**Book Selector:**
- Dropdown showing all books with bookmarks
- Shows bookmark count per book
- "All Books" option to see everything
- Current selection highlighted

**Empty State:**
- Large bookmark icon
- "No bookmarks yet" message
- Encouragement: "Bookmark passages while reading"
- Link to reader or library

## User Interactions

**Viewing Bookmarks:**
1. User navigates to Bookmarks page
2. Defaults to current/last-read book
3. All bookmarks for that book displayed as cards
4. Ordered by chapter, then creation date

**Switching Books:**
1. User clicks book selector
2. Dropdown shows all books with bookmark counts
3. User selects different book
4. Bookmark grid updates to show that book's bookmarks
5. URL updates with book parameter

**Navigating to Bookmark:**
1. User clicks "Go to Bookmark" button on card
2. Reader opens at that exact position
3. Sentence highlighted
4. Returns to Bookmarks page shows "back" option

**Editing Bookmark:**
1. User clicks edit icon (pencil)
2. Inline editor appears
3. Can rename bookmark (custom title)
4. Can add note (future)
5. Saves on enter or click outside

**Deleting Bookmark:**
1. User clicks delete icon (trash)
2. Confirmation popup: "Delete this bookmark?"
3. User confirms
4. Card fades out
5. Remaining bookmarks reflow
6. Toast: "Bookmark deleted"

**Bulk Actions:**
- Select multiple bookmarks (checkboxes)
- Delete selected (with confirmation)
- Export selected (future)
- Clear all for current book

## Special Features

**Search/Filter:**
- Search box filters by preview text
- Real-time results as user types
- Highlights matching text in previews
- Empty state if no matches

**Sorting:**
- By chapter (default)
- By creation date (newest/oldest)
- By last accessed (future)
- Alphabetically by name (future)

**Preview Text:**
- Shows context around bookmarked sentence
- Truncated intelligently at word boundaries
- Highlights bookmark-specific terms
- Click to expand full preview

**Color Coding:**
- Each book has unique color
- Bookmark cards show book color as accent
- Helps visually distinguish books
- Consistent with library colors

## Visual States

**Loading:**
- Skeleton bookmark cards
- Pulsing gray rectangles
- Shows while fetching from database

**Empty Book:**
- "No bookmarks in this book yet"
- Suggestion to create bookmarks while reading
- Link to start reading that book

**Editing:**
- Inline editor with text input
- Save and cancel buttons
- Current text pre-filled
- Focus on input for immediate typing

**Deleting:**
- Fade-out animation (300ms)
- Remaining cards reflow smoothly
- Confirmation toast appears

## Responsive Behavior

**Desktop:**
- 3-4 cards per row
- Hover states on cards
- All actions visible
- Side-by-side book selector

**Tablet:**
- 2-3 cards per row
- Touch-optimized
- Swipe actions possible
- Dropdown book selector

**Mobile:**
- 1-2 cards per row (portrait/landscape)
- Bottom sheet for book selector
- Swipe to delete
- Long-press for actions menu
- Full-width cards

## Use Cases

**Cross-Book Reference:**
- View all bookmarks across multiple books
- Find specific passages remembered from other books
- Compare bookmarks between books
- Organize reading notes

**Study Organization:**
- All important passages in one place
- Organized by chapter for easy review
- Quick navigation to review material
- Export for external note-taking (future)

**Reading Management:**
- Track multiple stopping points
- Remember key plot points
- Flag passages for discussion
- Create reading checkpoints

---

[← Back to TTS System](5-tts-system/README.md) | [Main README](README.md) | [Next: Reading History →](7-reading-history.md)
