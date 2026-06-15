---
source_handle: react-docs-usecontext
source_class: tool-doc
fetched: 2026-06-15
source_url: https://react.dev/reference/react/useContext
provenance: source-direct
version: react.dev (React 19 docs), accessed 2026-06-15
---

## Paraphrase

The official React reference for `useContext`. Covers `createContext` + Provider + `useContext` consumption, the provider-must-be-above-consumer rule, the "passing data deeply into the tree" use case (single shared resource to a subtree without prop drilling), and the memoization pattern for stable provider values (wrap object/function values in `useMemo`/`useCallback` so consumers don't re-render on every parent render).

## Key passages

**Basic provider + consumer pattern (React 19 form, `<Context value=...>`):**
```js
const ThemeContext = createContext(null);
function MyApp() {
  return (
    <ThemeContext value="dark">
      <Form />
    </ThemeContext>
  );
}
function Button() {
  const theme = useContext(ThemeContext);
}
```
- "`useContext` returns the context value for the calling component. It is determined as the `value` passed to the closest `SomeContext` above the calling component in the tree."

**Provider-must-be-above rule:**
- "`useContext()` call in a component is not affected by providers returned from the *same* component. The corresponding `<Context>` **needs to be *above*** the component doing the `useContext()` call."

**Passing data deeply — the shared-resource use case:**
- "Call `useContext` at the top level of your component to read and subscribe to context... To pass context to a `Button`, wrap it or one of its parent components into the corresponding context provider." Enables providing a single shared resource to a subtree without prop drilling.

**Re-render semantics:**
- "React **automatically re-renders** all the children that use a particular context starting from the provider that receives a different `value`. The previous and the next values are compared with the `Object.is` comparison."

**Memoizing the provider value (stable long-lived value):**
```js
const login = useCallback((response) => { /* ... */ }, []);
const contextValue = useMemo(() => ({ currentUser, login }), [currentUser, login]);
return (
  <AuthContext value={contextValue}>
    <Page />
  </AuthContext>
);
```
- "As a result of this change, even if `MyApp` needs to re-render, the components calling `useContext(AuthContext)` won't need to re-render unless `currentUser` has changed."
- Guidance: for stable, long-lived resources (connections, stores, shared state), wrap the provider value with `useMemo` so reference changes don't cascade re-renders; the dependency array should only include values representing actual semantic changes.
