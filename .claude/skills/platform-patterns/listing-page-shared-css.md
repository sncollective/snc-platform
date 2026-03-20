# Pattern: Listing Page Shared CSS

`apps/web/src/styles/listing-page.module.css` provides a shared CSS module for all listing pages: page heading, empty/loading status message, and load-more button. Import it alongside a local `.module.css` for page-specific styles.

## Rationale

Content feed, creator listing, and merch listing all share the same structural elements: a heading, a status message for empty/loading states, and a "Load more" button. Extracting these into a shared module prevents CSS drift and ensures consistent spacing and interaction states across all listing pages.

## Examples

### Example 1: Feed page imports listing styles
**File**: `apps/web/src/routes/feed.tsx:11`
```typescript
import listingStyles from "../styles/listing-page.module.css";

// In JSX:
<h1 className={listingStyles.heading}>Feed</h1>
<p className={listingStyles.status}>Loading...</p>
<div className={listingStyles.loadMoreWrapper}>
  <button className={listingStyles.loadMoreButton} disabled={isLoading}>
    {isLoading ? "Loading..." : "Load more"}
  </button>
</div>
```

### Example 2: Creators listing imports listing styles alongside its own module
**File**: `apps/web/src/routes/creators/index.tsx:9`
```typescript
import styles from "./creators-index.module.css";         // page-specific
import listingStyles from "../../styles/listing-page.module.css"; // shared

// Mixed usage:
<div className={styles.creatorsPage}>
  <h1 className={listingStyles.heading}>Creators</h1>
  {items.length === 0 && (
    <p className={listingStyles.status}>No creators found.</p>
  )}
  <div className={listingStyles.loadMoreWrapper}>
    <button className={listingStyles.loadMoreButton} onClick={loadMore}>
      Load more
    </button>
  </div>
</div>
```

### Example 3: Merch listing follows the same dual-import pattern
**File**: `apps/web/src/routes/merch/index.tsx:9`
```typescript
import styles from "./merch-index.module.css";            // page-specific
import listingStyles from "../../styles/listing-page.module.css"; // shared

// Standard status message usage:
{isLoading && items.length === 0 ? (
  <p className={listingStyles.status}>Loading...</p>
) : items.length === 0 ? (
  <p className={listingStyles.status}>No products found.</p>
) : (
  <>
    <div className="content-grid">...</div>
    {nextCursor && (
      <div className={listingStyles.loadMoreWrapper}>
        <button
          className={listingStyles.loadMoreButton}
          onClick={loadMore}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Load more"}
        </button>
      </div>
    )}
  </>
)}
```

### Shared CSS classes available
**File**: `apps/web/src/styles/listing-page.module.css:1`
```css
.heading        /* Page title: --font-heading, --font-size-2xl */
.status         /* Empty/loading message: centered, muted color */
.loadMoreWrapper /* Centering flex container for the button */
.loadMoreButton  /* Transparent bordered button with accent hover */
```

### Example 4: Landing section shared CSS — same pattern for section-level layout

A parallel shared module exists for landing section components:

**File**: `apps/web/src/styles/landing-section.module.css:1`
```css
.section  /* Section padding + max-width centering */
.heading  /* Section heading: --font-heading, 1.5rem */
.loading  /* Loading placeholder text: muted, small */
```

Used in `featured-creators.tsx`, `recent-content.tsx`, and `landing-pricing.tsx`. Components
that need additional layout specifics import their own module alongside the shared one:

```typescript
import sectionStyles from "../../styles/landing-section.module.css";   // shared base
import styles from "./featured-creators.module.css";                    // component-specific

// Composition via class string:
<section className={sectionStyles.section}>
  <h2 className={sectionStyles.heading}>...</h2>

// Or with override via template literal:
<section className={`${sectionStyles.section} ${styles.sectionElevated}`}>
```

## When to Use
- Any new listing/index page that shows a collection of items with load-more pagination
- Whenever a page needs a consistent heading, status message, or "Load more" button
- Landing page section components that display a heading + optional loading state

## When NOT to Use
- Detail pages (single-item views) — those use their own layout entirely
- Non-listing pages (forms, settings, checkout) — `loadMoreWrapper` and `.status` semantics don't apply

## Common Violations
- Copying `.loadMoreButton` styles into a page-specific CSS module instead of importing from the shared module: creates visual inconsistency when the shared styles are updated
- Using the shared `.heading` class for section headings within a page — it is for the top-level page title only
- Defining section `.heading` or `.loading` in a component module when `landing-section.module.css` already provides them
