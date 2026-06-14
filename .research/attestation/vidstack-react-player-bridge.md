---
source_handle: vidstack-react-player-bridge
fetched: 2026-06-14
source_path: node_modules/.bun/@vidstack+react@1.12.13+b2e33729a97476bf/node_modules/@vidstack/react/dev/vidstack.js
provenance: source-direct
---

## Summary

`dev/vidstack.js` contains the React component bridges for `MediaPlayer`, `MediaProvider`, and
related output components. The `MediaPlayer` bridge is a `React.forwardRef` component that
extracts the `aspectRatio` prop from its props and maps it to `style.aspectRatio` before
forwarding the rest to `MediaPlayerBridge`.

## Key passages with source-internal anchors

**Lines 200–216 — MediaPlayer React bridge with aspectRatio handling:**
```js
const MediaPlayer = React.forwardRef(
  ({ aspectRatio, children, ...props }, forwardRef) => {
    return React.createElement(
      MediaPlayerBridge,
      {
        ...props,
        src: props.src,
        ref: forwardRef,
        style: {
          aspectRatio,
          ...props.style
        }
      },
      (props2) => React.createElement(Primitive.div, { ...props2 }, children)
    );
  }
);
```

**Mechanism:** `aspectRatio` prop → extracted and placed as `style.aspectRatio` on the rendered
element. Any explicit `props.style.aspectRatio` in the user's `style` prop would override it
(because `...props.style` comes after `aspectRatio` in the spread). The prop value is passed
directly as a CSS property value string — e.g., `"16/9"` or `"16 / 9"`.

## Structural metadata

- `aspectRatio` is a React prop on `<MediaPlayer>`, NOT a data attribute
- It maps 1:1 to `style.aspectRatio` (an inline style)
- Inline styles have specificity that overrides all class/attribute/element selectors
- The `style` spread order means user-provided `style.aspectRatio` overrides the `aspectRatio` prop
- `MediaPlayerBridge` is a wrapper over `MediaPlayerInstance` (the core non-React Vidstack player)
