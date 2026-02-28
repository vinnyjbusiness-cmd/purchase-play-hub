

## Fix: Contact Balance Detail Page — Single Scrollable View on Mobile

### Problem
The detail view uses a split layout (`flex flex-col h-full overflow-hidden`) with:
- A fixed header section (`shrink-0`) containing the back button, avatar, name, and stat cards
- A scrollable body (`flex-1 overflow-y-auto`) containing the heatmap, breakdown, and Activity Log

On mobile/iPad, this creates a nested scroll area where the Activity Log is trapped inside a small scrollable region, making it nearly impossible to scroll through.

### Solution
On mobile and iPad portrait (`< 1024px`), convert the entire detail view to a single scrollable page with no fixed sections. On desktop/iPad landscape, keep the current split layout.

### Changes — `src/pages/Balance.tsx`

**1. Outer container (line ~474):**
- Change from `flex flex-col h-full overflow-hidden` to conditionally apply the split layout only on large screens
- Mobile: `overflow-y-auto` on the entire container, no `h-full` constraint
- Desktop (lg+): Keep existing `flex flex-col h-full overflow-hidden`

**2. Header section (line ~475):**
- Mobile: Remove `shrink-0`, let it flow naturally in the scroll
- Desktop: Keep `shrink-0` so it stays pinned

**3. Body section (line ~506):**
- Mobile: Remove `flex-1 overflow-y-auto`, let content flow as part of the main scroll
- Desktop: Keep `flex-1 overflow-y-auto`

**4. Activity Log action buttons (lines ~561-570):**
- Mobile: Stack the Payment/Charge/Opening Balance buttons vertically or wrap them so they don't overflow on small screens

### Implementation Detail

Use Tailwind responsive classes to conditionally apply the layout:

```
// Outer container
className="lg:flex lg:flex-col lg:h-full lg:overflow-hidden overflow-y-auto"

// Header
className="px-6 pt-6 pb-4 border-b border-border lg:shrink-0"

// Body
className="lg:flex-1 lg:overflow-y-auto px-6 py-4 space-y-4"
```

This ensures:
- **iPhone / iPad portrait**: One continuous scrollable page — avatar, stats, heatmap, breakdown, and full Activity Log all flow top-to-bottom with natural page scrolling
- **iPad landscape / Desktop**: Existing pinned header + scrollable body layout is preserved

### File Modified
| File | Change |
|---|---|
| `src/pages/Balance.tsx` | ~3 lines changed: responsive classes on the detail view container, header, and body sections |
