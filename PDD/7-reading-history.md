# 7. Reading History

## Purpose

Reading History provides a comprehensive view of all reading sessions, showing when, how long, and what was read. It helps users track their reading habits and resume from specific points in past sessions.

## Design/Layout

**iOS-Inspired Design:**
- Apple Books-style interface
- Clean, minimal aesthetic
- Grouped by day (Today, Yesterday, Last 7 Days, etc.)
- Session cards with rounded corners and shadows

**Session Cards:**
Each session card displays:
- Book title and cover thumbnail
- Chapter information (e.g., "Chapter 5: The Journey")
- Session duration (e.g., "45 minutes")
- Sentence/line count (e.g., "234 sentences read")
- Timestamp (e.g., "2:30 PM - 3:15 PM")
- Expandable detail section (collapsed by default)

**Expanded Session Details:**
- Individual sentence timestamps
- Progress through chapter
- Reading pace (sentences per minute)
- Click any sentence to resume from that point
- Session statistics summary

**Day Groupings:**
- **Today**: Sessions from current day
- **Yesterday**: Previous day's sessions
- **Last 7 Days**: Grouped by date
- **Earlier**: Collapsed by month

## User Interactions

**Viewing History:**
1. User navigates to Reading History page
2. Sessions grouped by day appear
3. Most recent sessions shown first
4. Scroll to load older sessions (infinite scroll)

**Expanding Session:**
1. User clicks on session card
2. Card expands with smooth animation
3. Detailed view shows:
   - Sentence-by-sentence breakdown
   - Time spent per section
   - Exact reading position throughout
   - "Resume from Here" buttons

**Resuming from Session:**
1. User views past session details
2. Clicks "Resume from Here" on specific timestamp
3. Reader opens at that exact sentence
4. User can continue from that point

**Filtering:**
- Filter by book (dropdown)
- Filter by date range (calendar picker)
- Filter by session duration (> X minutes)
- Clear filters to see all

**Statistics View:**
- Toggle to statistics mode
- Shows:
  - Total reading time (this week/month)
  - Books in progress
  - Chapters completed
  - Average session length
  - Reading streak (days in a row)
- Charts and graphs (visual representations)

## Special Features

**Session Merging:**
- Adjacent sessions within 5 minutes auto-merge
- Shows as single continuous session
- Prevents fragmented history
- More accurate duration tracking

---

## Session Merging - Technical Details

### Merging Algorithm

**Threshold Rule:**
```
Two reading sessions merge if:
  endTime of Session A + 5 minutes >= startTime of Session B

Where:
- Session A ends first (earlier timestamp)
- Session B starts later (later timestamp)
- 5 minutes = 300,000 milliseconds
```

**Example Scenarios:**

**Scenario 1: Should Merge**
```
Session A: 2:00 PM - 2:30 PM (30 min reading)
Session B: 2:32 PM - 3:00 PM (28 min reading)
Gap: 2 minutes
Result: MERGE → Single session 2:00 PM - 3:00 PM (58 minutes)
```

**Scenario 2: Should NOT Merge**
```
Session A: 2:00 PM - 2:30 PM
Session B: 2:40 PM - 3:00 PM
Gap: 10 minutes
Result: KEEP SEPARATE (gap exceeds 5-minute threshold)
```

**Scenario 3: Multiple Sessions**
```
Session A: 2:00 PM - 2:15 PM
Session B: 2:17 PM - 2:30 PM (2 min gap → merges with A)
Session C: 2:32 PM - 2:45 PM (2 min gap → merges with A+B)
Session D: 2:55 PM - 3:10 PM (10 min gap → separate session)

Result:
- Merged Session: 2:00 PM - 2:45 PM (45 minutes)
- Separate Session: 2:55 PM - 3:10 PM (15 minutes)
```

### Merging Process

**When Merging Occurs:**
```
Triggers:
1. On session end (when user closes reader)
2. On new session start (checks if previous session mergeable)
3. Background job (every 10 minutes, processes recent sessions)
4. On Reading History page load (merges before display)
```

**Algorithm Steps:**
```
1. Fetch all sessions for user, ordered by startTime ASC
2. Initialize: mergedSessions = []
3. Initialize: currentMerge = first session
4. For each subsequent session:
   a. Calculate gap = session.startTime - currentMerge.endTime
   b. If gap <= 5 minutes:
      - Extend currentMerge.endTime = session.endTime
      - Add session.sentencesRead to currentMerge.sentencesRead
      - Merge session.chaptersCovered into currentMerge.chaptersCovered
      - Keep merging (don't push yet)
   c. Else (gap > 5 minutes):
      - Push currentMerge to mergedSessions
      - Set currentMerge = current session
      - Continue
5. Push final currentMerge to mergedSessions
6. Return mergedSessions
```

### Data Persistence

**Original Sessions:**
```
ReadingLog {
  _id: ObjectId,
  userId: ObjectId,
  bookId: ObjectId,
  chapterNumber: number,
  startChunk: number,
  endChunk: number,
  startTime: Date,
  endTime: Date,
  sentencesRead: number,
  duration: number,           // milliseconds
  readingMode: string,        // "full", "focus", etc.
  mergedInto: ObjectId | null // If merged, points to parent session
}
```

**Key Points:**
- Original sessions NOT deleted when merged
- `mergedInto` field references parent session
- Allows un-merging if needed
- Preserves raw data for analytics

**Merged Session Representation:**
```
MergedReadingLog {
  _id: ObjectId,
  userId: ObjectId,
  bookId: ObjectId,
  startTime: Date,            // Earliest session start
  endTime: Date,              // Latest session end
  totalDuration: number,      // Sum of all merged durations
  sentencesRead: number,      // Sum of all sentences
  chaptersCovered: number[], // Unique chapters (deduplicated)
  sessionCount: number,       // How many sessions merged
  originalSessions: ObjectId[] // References to merged sessions
}
```

### Display Logic

**In Reading History UI:**
```
Display Logic:
1. Query all sessions for user + book
2. Apply merging algorithm (runtime)
3. Display merged results
4. Each card shows:
   - Merged duration (e.g., "58 minutes")
   - Merged sentence count
   - If expanded: Show original session breaks as timeline
```

**Expanded View:**
```
Merged Session Card (2:00 PM - 3:00 PM):
├── Original Session 1: 2:00 PM - 2:30 PM (30 min)
│   └── Chapter 5, Sentences 100-234
├── [2-minute break]
└── Original Session 2: 2:32 PM - 3:00 PM (28 min)
    └── Chapter 5, Sentences 235-350

Total: 58 minutes, 251 sentences
```

### Edge Cases

**Same Chunk Overlap:**
```
Problem: User re-reads same passage in consecutive sessions
Session A: Chunk 10-15
Session B: Chunk 12-18

Solution:
- Merge sessions (time-based)
- Count unique chunks only (deduplicate)
- Sentence count = unique sentences read
```

**Cross-Chapter Merging:**
```
Session A: Chapter 5 end
Session B: Chapter 6 start
Gap: 3 minutes

Result: MERGE
- Single session spanning 2 chapters
- chaptersCovered: [5, 6]
- Shows chapter transition in expanded view
```

**Midnight Crossing:**
```
Session A: 11:50 PM - 11:59 PM (Day 1)
Session B: 12:01 AM - 12:30 AM (Day 2)
Gap: 2 minutes

Result: MERGE
- Single session crossing midnight
- Displayed under Day 1 (by start time)
- Duration: 40 minutes
```

**Different Reading Modes:**
```
Session A: Full mode, 2:00 PM - 2:15 PM
Session B: Focus mode, 2:17 PM - 2:30 PM
Gap: 2 minutes

Result: MERGE
- Single merged session
- readingMode: "mixed" or "full, focus" (comma-separated)
- Shows mode changes in expanded view
```

**TTS vs Manual Reading:**
```
Session A: Manual reading
Session B: TTS active
Gap: 3 minutes

Result: MERGE
- Sessions merged regardless of input method
- TTS usage tracked separately
- Both contribute to total reading time
```

### Un-Merging (Admin/Debug)

**Manual Un-Merge:**
```
Use Case: User reports incorrect session duration
Process:
1. Admin views merged session
2. Sees original sessions list
3. Clicks "Un-merge"
4. Merged session deleted
5. Original sessions restored to history
6. User sees separate sessions again
```

**Automatic Un-Merge Triggers:**
```
Conditions:
- If gap recalculated and exceeds threshold (rare)
- If original session edited (timestamp change)
- If session marked as duplicate
```

### Performance Optimization

**Caching:**
```
- Merged sessions cached for 5 minutes
- Cache key: {userId, bookId, date}
- Invalidated on new session create
- Reduces recalculation on page refresh
```

**Indexing:**
```
Database indexes:
- {userId, bookId, startTime} - For fetching sessions
- {userId, startTime} - For cross-book history
- {mergedInto} - For finding merged children
```

**Batch Processing:**
```
- Background job runs every 10 minutes
- Processes sessions created in last 15 minutes
- Pre-merges for faster UI display
- Reduces runtime merging overhead
```

### Statistics Impact

**Reading Time Calculation:**
```
Total Reading Time = Sum of merged session durations

Correct:
- Session A: 30 min
- Session B: 28 min
- Break: 2 min (NOT counted)
Result: 58 minutes total

Incorrect (without merging):
- Session A: 30 min
- Session B: 28 min
- Break counted as "inactive reading"
Result: 60 minutes (inflated)
```

**Session Count:**
```
- UI shows merged sessions (user-facing count)
- Analytics use original sessions (accurate count)
- Example: 10 original sessions → 6 merged → User sees "6 sessions"
```

---

**Reading Pace:**
- Calculates sentences per minute
- Shows reading speed trend
- Helpful for pacing goals
- Varies by content difficulty

**Smart Timestamps:**
- Relative times: "2 hours ago", "Yesterday at 3:00 PM"
- Absolute when needed: "Jan 15, 2026"
- Time zone aware
- Localized formats

**Session Statistics:**
- Duration (minutes and seconds)
- Sentences read
- Chapters covered
- Mode used (Full, Focus, etc.)
- TTS usage (if applicable)

## Visual States

**Loading:**
- Skeleton session cards
- Pulsing gray rectangles
- "Loading history..." message

**Empty State:**
- Illustration of book
- "No reading history yet"
- "Start reading to build your history"
- Link to library

**Expanded:**
- Card height increases smoothly
- Detail section slides in
- Collapse button appears at top
- Dimmed background (focus on expanded card)

**Filtering Active:**
- Filter chips show active filters
- Count of filtered sessions
- "Clear filters" button
- Dimmed unmatched sessions (optional)

## Responsive Behavior

**Desktop:**
- Two-column layout possible
- Session list on left
- Details on right (when expanded)
- Full statistics panel

**Tablet:**
- Single column
- Expanded cards push others down
- Touch-optimized expansion
- Simplified statistics

**Mobile:**
- Full-width session cards
- Bottom sheet for session details
- Swipe down to dismiss
- Compact statistics view
- Vertical timeline view

## Use Cases

**Tracking Progress:**
- See how much time spent reading
- Monitor reading habits
- Set and track goals
- Motivational feedback

**Resuming Reading:**
- Find exact position in past session
- Resume mid-chapter easily
- Review what was read previously
- Context before continuing

**Study Habits:**
- Analyze reading patterns
- Optimize study time
- Track focus and concentration
- Improve reading efficiency

**Book Management:**
- See which books actively reading
- Identify abandoned books
- Plan reading schedule
- Balance multiple books

---

[← Back to Bookmarks Page](6-bookmarks-page.md) | [Main README](README.md) | [Next: Usage Tracking →](8-usage-tracking.md)
