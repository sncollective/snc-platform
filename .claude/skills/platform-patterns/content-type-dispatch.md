# Pattern: Content Type Dispatch

A `FeedItem["type"]` discriminated union drives two complementary approaches: `Record<FeedItem["type"], T>` constants for type-safe per-variant values (labels, CSS classes), and inline conditional rendering `{item.type === "X" && <XVariant />}` to dispatch to variant components — each variant receiving the full `FeedItem` and extracting its own type-specific fields.

## Rationale

Centralizing type-to-value mappings in module-level `Record` constants keeps all per-type decisions in one place and makes TypeScript exhaustiveness-check the mapping (TypeScript errors if a new type is added to the union without updating the Record). Conditional rendering dispatch to variant components rather than a single large component keeps each variant small and independently testable.

## Examples

### Example 1: Record<Type, T> for type-safe badge labels and CSS classes
**File**: `apps/web/src/components/content/content-card.tsx:11-21`
```typescript
const TYPE_BADGE_LABELS: Record<FeedItem["type"], string> = {
  video: "VIDEO",
  audio: "AUDIO",
  written: "POST",
};

const TYPE_BADGE_CLASSES: Record<FeedItem["type"], string> = {
  video: styles.badgeVideo,
  audio: styles.badgeAudio,
  written: styles.badgeWritten,
};

// Usage — exhaustive lookup, no fallback needed
<span className={`${styles.badge} ${TYPE_BADGE_CLASSES[item.type]}`}>
  {TYPE_BADGE_LABELS[item.type]}
</span>
```

### Example 2: Conditional rendering dispatch to variant components
**File**: `apps/web/src/components/content/content-detail.tsx:17-25`
```typescript
export function ContentDetail({ item }: ContentDetailProps): React.ReactElement {
  return (
    <article className={styles.detailPage}>
      {item.type === "video"   && <VideoDetail item={item} />}
      {item.type === "audio"   && <AudioDetail item={item} />}
      {item.type === "written" && <WrittenDetail item={item} />}
    </article>
  );
}
```

### Example 3: Variant components receive shared FeedItem and extract type-specific fields
**File**: `apps/web/src/components/content/video-detail.tsx:1-39`
```typescript
// Each variant gets the same FeedItem prop — type narrowing happens internally
export function VideoDetail({ item }: { readonly item: FeedItem }): React.ReactElement {
  const posterSrc = item.thumbnailUrl;
  const mediaSrc = item.mediaUrl ?? "";

  return (
    <div className={styles.videoDetail}>
      <VideoPlayer src={mediaSrc} poster={posterSrc ?? undefined} />
      <ContentMeta title={item.title} creatorName={item.creatorName} publishedAt={item.publishedAt} />
      {item.description && <p className={styles.description}>{item.description}</p>}
    </div>
  );
}
```

**File**: `apps/web/src/components/content/audio-detail.tsx:1-60`
```typescript
// Audio variant extracts coverArtUrl, contentId — fields irrelevant to VideoDetail/WrittenDetail
export function AudioDetail({ item }: { readonly item: FeedItem }): React.ReactElement {
  const coverArtSrc = item.coverArtUrl;
  const mediaSrc = item.mediaUrl ?? "";

  return (
    <div className={styles.audioDetail}>
      <ContentMeta title={item.title} creatorName={item.creatorName} publishedAt={item.publishedAt} />
      <AudioPlayer
        src={mediaSrc}
        title={item.title}
        creator={item.creatorName}
        coverArtUrl={coverArtSrc ?? undefined}
        contentId={item.id}
      />
      {item.description && <p className={styles.description}>{item.description}</p>}
    </div>
  );
}
```

### Example 4: Testing the dispatch with mocked variant components
**File**: `apps/web/tests/unit/components/content-detail.test.tsx`
```typescript
const { mockVideoDetail, mockAudioDetail, mockWrittenDetail } = vi.hoisted(() => ({
  mockVideoDetail:  vi.fn(),
  mockAudioDetail:  vi.fn(),
  mockWrittenDetail: vi.fn(),
}));

vi.mock("../../../src/components/content/video-detail.js", () => ({
  VideoDetail: (props: Record<string, unknown>) => {
    mockVideoDetail(props);
    return <div data-testid="video-detail" />;
  },
}));

it("renders VideoDetail for video items", () => {
  const item = makeMockFeedItem({ type: "video" });
  render(<ContentDetail item={item} />);
  expect(screen.getByTestId("video-detail")).toBeInTheDocument();
  expect(mockVideoDetail).toHaveBeenCalledWith(expect.objectContaining({ item }));
});
```

## When to Use

- A shared data model (`FeedItem`) has a `type` field that determines which UI variant to show
- Multiple per-variant values (labels, classes, icons) need to be defined — use `Record<Type, T>` constants
- Each variant has meaningfully different rendering logic — dispatch to separate components rather than inline if/else

## When NOT to Use

- Only one or two small differences between variants — inline ternaries are simpler than Record constants
- The "type" is a boolean flag rather than a discriminated union — use conditional props instead
- Variants are all identical except one optional section — use conditional rendering within a single component

## Common Violations

- Using an object with a string index type instead of `Record<FeedItem["type"], T>` — loses exhaustiveness checking; TypeScript won't error if a new type is added to the union
- Inlining all variant logic in one large component function with `if (type === "video") { ... } else if (type === "audio") { ... }` — hard to test in isolation and grows unbounded
- Passing type-specific props to the variant components from the dispatcher — variants should extract what they need from the shared `FeedItem` prop internally
