# 2. Book Library

## Purpose

The Book Library serves as the central hub for managing and accessing your book collection. It provides a comprehensive overview of all uploaded books with visual progress tracking, sorting capabilities, and quick access to reading.

## Design/Layout

**Visual Organization:**
- Grid layout displaying book cards in rows (3-4 books per row on desktop, 1-2 on mobile)
- Each book card features:
  - Book cover image (prominent, top of card)
  - Title and author (below cover)
  - Progress indicator bar (colored bar showing percentage complete)
  - Reading status badge ("Continue Reading" vs "Start Reading")
  - Last read timestamp (e.g., "Last read: 2 hours ago")
  - Chapter count display (e.g., "Chapter 5 of 24")

**Color Scheme:**
- Cards have subtle shadows and rounded corners for depth
- Progress bars use warm accent colors (orange/amber for active, gray for unstarted)
- Active book (currently selected) has highlighted border in accent color
- Hover states add slight elevation and glow effect

**Top Bar Controls:**
- Sort dropdown (left side): "Sort by Title", "Sort by Progress", "Sort by Last Read"
- Upload button (right side): Prominent button with "+" icon
- View toggles: Grid view vs List view (icon buttons)

**Empty State:**
- Large book icon illustration in center
- "Your library is empty" message
- Prominent "Upload Your First Book" button
- Helpful text: "Add PDF books to start reading"

## User Interactions

**Viewing Books:**
1. User lands on library page
2. All books load with cover images fading in
3. Progress bars animate from 0% to actual percentage
4. Last read timestamps display relative time
5. Books appear in selected sort order

**Sorting Books:**
1. User clicks sort dropdown
2. Menu expands showing three options
3. User selects sort criteria
4. Books re-arrange with smooth animation
5. Selected sort option displays checkmark

**Starting/Continuing Reading:**
1. User clicks on book card
2. Card lifts slightly (hover effect)
3. Action menu appears with options:
   - "Continue Reading" (if progress > 0) or "Start Reading"
   - "Edit Book Details"
   - "Set as Active Book"
   - "Manage Offline Chapters"
   - "Remove Book"
4. User selects "Continue Reading"
5. Reader opens at last saved position

**Editing Book Metadata:**
1. User selects "Edit Book Details" from card menu
2. Modal dialog opens with form fields:
   - Title (text input)
   - Author (text input)
   - Cover Image (upload/paste area with preview)
   - Base URL (for chapter content)
   - Chapter Start Number (numeric input)
3. User modifies fields
4. "Save Changes" button becomes enabled
5. User clicks save
6. Modal closes with success message
7. Book card updates to show new metadata

**Managing Offline Chapters:**
1. User selects "Manage Offline Chapters"
2. Offline manager dialog opens showing:
   - List of all chapters with checkboxes
   - Download status per chapter (Not Downloaded, Downloaded, Downloading)
   - Total storage used display
   - "Download All" and "Clear All" buttons
3. User selects specific chapters or clicks "Download All"
4. Progress bars show download progress per chapter
5. Completion message appears when done
6. Downloaded chapters show green checkmark icons

**Setting Active Book:**
1. User selects "Set as Active"
2. Book card border highlights in accent color
3. Quick access icon appears on card
4. Previous active book loses highlight
5. Toast notification: "Active book set"

**Removing Books:**
1. User selects "Remove Book"
2. Confirmation dialog appears: "Are you sure? This will delete all progress and bookmarks."
3. User clicks "Confirm"
4. Book card fades out with animation
5. Remaining books re-flow to fill space
6. Toast notification: "Book removed successfully"

**Loading States:**
- Initial library load: Skeleton cards with pulsing gray rectangles
- Progress loading: Spinner replaces percentage until data loads
- Cover images: Placeholder icon until image loads
- Delete operation: Spinning loader on "Confirm" button

**Responsive Behavior:**
- Desktop (>1024px): 3-4 books per row, all metadata visible
- Tablet (768-1024px): 2-3 books per row, condensed metadata
- Mobile (<768px): 1-2 books per row, minimal metadata, full-width cards
- Touch targets minimum 44x44px for mobile interactions

---

[← Back to Overview](1-overview.md) | [Main README](README.md) | [Next: Upload Book →](3-upload-book.md)
