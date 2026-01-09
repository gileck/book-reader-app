# 9. File Storage

## Purpose

File Storage provides management of uploaded files stored in S3 and Vercel Blob storage. Users can browse, search, and delete files related to book content, images, and assets.

## Design/Layout

**Storage Type Selector:**
- Toggle or tabs at top
- "S3 Storage" | "Vercel Blob Storage"
- Shows current storage type
- Switches view between storage systems

**File Browser:**
- Breadcrumb navigation (folders/path)
- Current folder name displayed
- Total files and folders count
- Total storage used

**File List:**
- Table or grid view toggle
- **Table view**:
  - Columns: Name, Type, Size, Last Modified
  - Sortable by any column
  - Checkbox for bulk selection
  - Actions column (Download, Delete)
- **Grid view**:
  - File cards with preview icons
  - File name below icon
  - Size and date on hover

**Search Bar:**
- Top-right position
- Searches current folder or all
- Real-time filter as you type
- Clear button (X) when text entered

**Actions Bar:**
- Selected count: "3 files selected"
- Bulk actions: Delete selected
- Storage stats: "2.3 GB / 5 GB used"
- Refresh button

## User Interactions

**Browsing Folders:**
1. User sees root folder contents
2. Clicks on folder name
3. Navigates into folder
4. Breadcrumb updates: "Home > Books > Chapter1"
5. Contents of subfolder displayed

**Searching Files:**
1. User types "cover" in search box
2. Results filter in real-time
3. Shows all files with "cover" in name
4. Across current folder or all folders (toggle)

**Sorting:**
1. User clicks "Size" column header
2. Files sort by size (largest first)
3. Click again to reverse (smallest first)
4. Arrow indicates sort direction

**Selecting Files:**
1. User clicks checkbox on file row
2. File highlights to show selection
3. Actions bar shows "1 file selected"
4. Can select multiple files
5. "Select All" checkbox in header

**Deleting Files:**
1. User selects 3 files
2. Clicks "Delete Selected"
3. Confirmation: "Delete 3 files? This cannot be undone."
4. User confirms
5. Files removed from list
6. Storage stats update
7. Toast: "3 files deleted successfully"

**Switching Storage:**
1. User currently viewing S3 storage
2. Clicks "Vercel Blob Storage" tab
3. View switches to Blob storage
4. Different file structure appears
5. Storage stats update for that system

## Special Features

**File Metadata:**
- Detailed file information on hover or click
- Full path, size, MIME type
- Upload date, last accessed
- Owner (if applicable)

**Storage Statistics:**
- Current usage vs limit
- Breakdown by file type
- Largest files highlighted
- Trend over time (future)

**Bulk Operations:**
- Select multiple files
- Delete in batch
- Download as zip (future)
- Move to folder (future)

**File Preview:**
- Click file to preview (images, PDFs)
- Modal overlay shows content
- Download option in preview
- Close to return to list

## Visual States

**Empty Folder:**
- Icon illustration
- "This folder is empty"
- Message varies by context

**Loading:**
- Skeleton file rows
- Loading spinner
- "Loading files..." message

**Searching:**
- Real-time filter
- Result count updates
- No results: "No files found matching '[query]'"

**Deleting:**
- Loading spinner on action button
- Files fade out when deleted
- Remaining files reflow

**Error:**
- "Failed to load files"
- Error details displayed
- Retry button available

## Responsive Behavior

**Desktop:**
- Full table view
- All columns visible
- Hover states active
- Multi-select with shift-click

**Tablet:**
- Condensed table or grid view
- Fewer columns visible
- Touch selection
- Swipe actions possible

**Mobile:**
- Grid view default (better for touch)
- List view available
- Bottom sheet for details
- Long-press to select
- Simplified actions

## Use Cases

**Managing Book Assets:**
- View all uploaded book files
- Delete unused PDFs
- Check storage consumption
- Organize by book/chapter

**Cleanup:**
- Identify large files
- Remove outdated content
- Free up storage space
- Optimize usage

**File Recovery:**
- Find accidentally deleted content (if trash available)
- Verify uploads completed
- Check file integrity
- Download backups

**Storage Monitoring:**
- Track usage against limits
- Plan for storage needs
- Optimize file sizes
- Prevent exceeding quota

---

[← Back to Usage Tracking](8-usage-tracking.md) | [Main README](README.md)
