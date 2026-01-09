# 8. Usage Tracking Pages

## Purpose

Usage Tracking provides visibility into TTS and Translation API usage and costs. Users can monitor their consumption of free tiers, track expenses, and optimize usage to stay within budgets.

## Two Tracking Pages

### 8.1 TTS Usage
Tracks text-to-speech API calls and costs across all providers.

### 8.2 Translation Usage
Tracks Google Cloud Translation API usage and costs.

---

## 8.1 TTS Usage Page

### Design/Layout

**Overview Cards:**
- Total cost (current month)
- Total characters processed
- Total audio duration generated
- Cache hit ratio (cost savings)

**Provider Breakdown:**
Three sections (tabs or accordion):
1. **Google Cloud TTS**
2. **Amazon Polly**
3. **ElevenLabs**

Each shows:
- Characters used
- Cost incurred
- Free tier usage (progress bar)
- Voice tier breakdown (Standard, Neural, etc.)

**Free Tier Tracking:**
- Progress bars per tier
- Current usage / Monthly limit
- Percentage used
- Days remaining in month
- Color coding (green < 50%, yellow 50-75%, orange 75-90%, red > 90%)

**Charts:**
- Daily usage (last 30 days)
- Cost breakdown by provider
- Voice tier distribution
- Cache hit rate over time

**AWS Integration:**
- Real AWS billing data for Polly
- Comparison with internal tracking
- Discrepancy alerts if mismatch
- Direct AWS billing link

### User Interactions

**Viewing Usage:**
1. User navigates to TTS Usage page
2. Overview cards show current month totals
3. Provider tabs show detailed breakdown
4. Charts visualize trends

**Checking Free Tier:**
1. User clicks on Google TTS tab
2. Free tier section shows:
   - Standard: 3.2M / 4M chars (80%) - Orange
   - Neural2: 650K / 1M chars (65%) - Yellow
   - Studio: 2K / 1M chars (0.2%) - Green
3. User sees approaching limit on Standard tier
4. Considers switching to Neural2 or different provider

**Analyzing Costs:**
1. User reviews cost chart
2. Sees spike on specific date
3. Hovers over data point to see details
4. "Jan 15: $3.42 (ElevenLabs, 35K chars)"
5. Identifies expensive usage pattern

**Comparing Providers:**
1. User views provider comparison
2. Google: $1.23 (mostly free tier)
3. Polly: $0.85 (free tier)
4. ElevenLabs: $8.50 (no free tier, premium voices)
5. Decides to use ElevenLabs more sparingly

### Special Features

**Real-Time Updates:**
- Usage updates after each TTS generation
- Live cost calculation
- Immediate free tier percentage updates

**Warnings:**
- Notification at 75% of free tier
- Alert at 90% of free tier
- Suggestion to switch provider or tier

**AWS Billing Integration:**
- Fetches actual Polly billing from AWS
- Compares with internal tracking
- Shows discrepancies if any
- Links to AWS console for details

**Cost Savings Display:**
- Shows money saved through caching
- "Cached playback saved $12.50 this month"
- Encourages replaying content

### Visual States

**Under Free Tier:**
- Green progress bars
- Positive messaging
- "You're within free limits"

**Approaching Limit:**
- Yellow/orange bars
- Warning message
- Suggestions to optimize

**Exceeded Free Tier:**
- Red progress bars
- Cost amount shown
- Breakdown of charges
- Suggestions to reduce costs

---

## 8.2 Translation Usage Page

### Design/Layout

**Overview Cards:**
- Total translation cost (current month)
- Total characters translated
- Cache hit ratio
- Free tier usage (500K chars/month)

**Free Tier Tracking:**
- Large progress bar: Usage / 500K chars
- Percentage used
- Characters remaining
- Days left in month

**Language Breakdown:**
- Table or chart showing:
  - Target language
  - Character count
  - Percentage of total
  - Cost (if exceeded free tier)

**Recent Translations:**
- Last 24 hours of translations
- Source → Target language
- Character count
- Cached or new
- Individual cost

**Daily Usage Chart:**
- Last 7 days
- Characters translated per day
- Free tier limit line
- Trend visualization

### User Interactions

**Monitoring Free Tier:**
1. User checks translation usage
2. Progress bar shows 425K / 500K (85%)
3. Orange color indicates approaching limit
4. "75K characters remaining" displayed
5. Warning: "Approaching monthly free tier limit"

**Viewing Language Distribution:**
1. User views breakdown table
2. Spanish: 180K chars (40%)
3. French: 120K chars (27%)
4. German: 80K chars (18%)
5. Others: 45K chars (15%)
6. Identifies most used languages

**Checking Recent Translations:**
1. User reviews last 24 hours
2. Sees list of all translations
3. Each shows cached status (disk icon if cached)
4. Identifies which sentences used API vs cache

**Analyzing Costs:**
1. User exceeded free tier (550K chars)
2. First 500K: Free
3. Next 50K: $2.50 (at $50 per 1M chars)
4. Total month cost: $2.50
5. Breakdown shown clearly

### Special Features

**Cache Tracking:**
- Shows cached translation count
- "42% of translations served from cache"
- Cost savings from cache
- Encourages reviewing previously translated content

**Warning Thresholds:**
- 75% usage: Yellow notification
- 90% usage: Orange warning
- 100% usage: Red alert with cost estimate

**Cost Projection:**
- Based on current usage trend
- "At current rate, will use 620K chars this month"
- Estimated overage cost
- Suggestions to reduce usage

**Character Efficiency:**
- Average characters per translation
- Multi-sentence vs single sentence comparison
- Recommendations for optimal translation size

### Visual States

**Within Free Tier:**
- Green indicators
- "You're within the free tier"
- Current usage displayed positively

**Approaching Limit:**
- Orange warnings
- Characters remaining highlighted
- Suggestions to be mindful

**Exceeded Free Tier:**
- Red indicators
- Clear cost display
- Breakdown of charges
- Tips to minimize future costs

---

## Responsive Behavior

**Desktop:**
- Full dashboard layout
- Side-by-side charts
- Detailed tables
- All data visible

**Tablet:**
- Stacked layout
- Scrollable charts
- Condensed tables
- Touch-optimized

**Mobile:**
- Vertical stack
- Swipe between providers
- Simplified charts
- Essential data prioritized
- Bottom sheet for details

## Use Cases

**Cost Management:**
- Monitor API spending
- Stay within free tiers
- Optimize provider selection
- Identify expensive patterns

**Usage Optimization:**
- Maximize cache benefits
- Choose cost-effective voices
- Balance quality vs cost
- Plan monthly usage

**Budgeting:**
- Set spending limits (future)
- Alerts when approaching
- Historical cost tracking
- Forecast future costs

**Provider Selection:**
- Compare costs across providers
- Identify best value
- Switch based on needs
- Balance quality and price

---

[← Back to Reading History](7-reading-history.md) | [Main README](README.md) | [Next: File Storage →](9-file-storage.md)
