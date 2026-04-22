---
name: ark-ui-v5
description: >
  Ark UI v5 headless component library reference for React. Auto-loads when working with
  @ark-ui/react, Dialog, Toast, Tooltip, Menu, Tabs, Select, Popover, Checkbox, Switch,
  RadioGroup, Collapsible, Accordion, Combobox, Field, Progress, Pagination, headless
  primitives, data-scope, data-part, data-state, accessible components.
user-invocable: false
updated: 2026-04-13
---

# Ark UI React Reference

> **Version:** 5.x (`@ark-ui/react`)
> **Docs:** https://ark-ui.com
> **License:** MIT — React 18/19 compatible
> **Built on:** Zag.js state machines

Headless component library providing accessible UI behavior with zero visual styling.
Components expose `data-scope`, `data-part`, and `data-state` HTML attributes for
CSS targeting. All visual styling is our responsibility via CSS Modules + design tokens.

Installed in `apps/web` only.

## Core Concepts

### Styling Pattern

Ark UI components are unstyled. Target them with data attributes or className props:

```css
/* CSS Modules — attribute selectors */
[data-scope='dialog'][data-part='backdrop'] {
  background: var(--overlay-lock);
}

/* CSS Modules — className approach (preferred for our wrappers) */
.backdrop {
  background: var(--overlay-lock);
}
.backdrop[data-state='open'] {
  animation: fadeIn var(--duration-normal) var(--ease-out);
}
```

### Composition Pattern (`asChild`)

Every sub-component accepts `asChild` to render as its child element instead of its default element:

```tsx
<Dialog.Trigger asChild>
  <button className={styles.myButton}>Open</button>
</Dialog.Trigger>
```

### Portal

Overlays (Dialog, Toast, Tooltip, Popover, Menu, Select, Combobox) should render in a Portal to escape parent stacking contexts:

```tsx
import { Portal } from '@ark-ui/react/portal'

<Portal>
  <Dialog.Backdrop />
  <Dialog.Positioner>
    <Dialog.Content>...</Dialog.Content>
  </Dialog.Positioner>
</Portal>
```

### Lazy Mount / Unmount on Exit

Most overlay components support:
- `lazyMount` (boolean, default: false) — defer rendering until first open
- `unmountOnExit` (boolean, default: false) — remove from DOM when closed

### ListCollection (Select, Combobox)

Select and Combobox use a collection API for items:

```tsx
import { createListCollection } from '@ark-ui/react/select'
// or
import { useListCollection } from '@ark-ui/react/list-collection'

const collection = createListCollection({
  items: [
    { label: 'React', value: 'react' },
    { label: 'Vue', value: 'vue' },
  ]
})

<Select.Root collection={collection}>...</Select.Root>
```

---

## Components

### Dialog

Accessible modal dialog with focus trap, scroll lock, and backdrop dismiss.

**Import:** `import { Dialog } from '@ark-ui/react/dialog'`

**Sub-components:** `Dialog.Root`, `Dialog.Trigger`, `Dialog.Backdrop`, `Dialog.Positioner`, `Dialog.Content`, `Dialog.Title`, `Dialog.Description`, `Dialog.CloseTrigger`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controlled open state |
| `defaultOpen` | `boolean` | `false` | Initial open state |
| `onOpenChange` | `(details) => void` | — | State change callback |
| `closeOnEscape` | `boolean` | `true` | Close on Escape key |
| `closeOnInteractOutside` | `boolean` | `true` | Close on outside click |
| `modal` | `boolean` | `true` | Trap interactions outside |
| `preventScroll` | `boolean` | `true` | Block background scrolling |
| `trapFocus` | `boolean` | `true` | Trap focus inside |
| `role` | `'dialog' \| 'alertdialog'` | `'dialog'` | ARIA role |
| `initialFocusEl` | `() => MaybeElement` | — | Element to focus on open |
| `finalFocusEl` | `() => MaybeElement` | — | Element to focus on close |
| `lazyMount` | `boolean` | `false` | Defer rendering |
| `unmountOnExit` | `boolean` | `false` | Remove from DOM when closed |

**Data Attributes:**
- Trigger: `[data-state="open"|"closed"]`
- Backdrop: `[data-state="open"|"closed"]`
- Content: `[data-state="open"|"closed"]`, `[data-nested]`, `[data-has-nested]`

**CSS Variables:** Backdrop and Content expose `--layer-index`. Content also exposes `--nested-layer-count`.

**Usage:**

```tsx
import { Dialog } from '@ark-ui/react/dialog'
import { Portal } from '@ark-ui/react/portal'

<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Portal>
    <Dialog.Backdrop />
    <Dialog.Positioner>
      <Dialog.Content>
        <Dialog.Title>Title</Dialog.Title>
        <Dialog.Description>Description</Dialog.Description>
        <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog.Root>
```

**Built-in behavior:** Focus trap, scroll lock, Escape to close, backdrop click dismiss, ARIA dialog role, return focus on close.

---

### Toast

Transient notifications with imperative API via `createToaster()`.

**Import:** `import { Toast, Toaster, createToaster } from '@ark-ui/react/toast'`

**Sub-components:** `Toast.Root`, `Toast.Title`, `Toast.Description`, `Toast.ActionTrigger`, `Toast.CloseTrigger`

**createToaster(options):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `placement` | `Placement` | `'bottom'` | Position (top, bottom, top-start, top-end, bottom-start, bottom-end) |
| `gap` | `number` | `16` | Space between toasts |
| `max` | `number` | `24` | Maximum visible toasts |
| `duration` | `number` | — | Auto-dismiss duration (ms) |
| `removeDelay` | `number` | `200` | Delay before DOM removal |
| `overlap` | `boolean` | — | Stack toasts overlapped |
| `offsets` | `string \| Record` | `'1rem'` | Viewport offsets |

**Imperative API:**

```typescript
const toaster = createToaster({ placement: 'bottom-end' })

toaster.create({ title: 'Saved', description: 'Changes saved.', type: 'success' })
toaster.success({ title: 'Done' })
toaster.error({ title: 'Failed', description: 'Could not save.' })
toaster.warning({ title: 'Warning' })
toaster.info({ title: 'Note' })
toaster.promise(asyncFn, { loading: {...}, success: {...}, error: {...} })
toaster.update(toastId, { title: 'Updated' })
```

**Toast.Root Data Attributes:**
- `[data-state="open"|"closed"]`
- `[data-type="success"|"error"|"warning"|"info"]`
- `[data-placement]`
- `[data-mounted]`, `[data-paused]`, `[data-overlap]`

**CSS Variables on Toast.Root:** `--x`, `--y`, `--scale`, `--z-index`, `--height`, `--opacity`, `--gap`

**Usage:**

```tsx
import { Toast, Toaster, createToaster } from '@ark-ui/react/toast'
import { Portal } from '@ark-ui/react/portal'

const toaster = createToaster({ placement: 'bottom-end' })

// In app layout (once):
<Portal>
  <Toaster toaster={toaster}>
    {(toast) => (
      <Toast.Root>
        <Toast.Title>{toast.title}</Toast.Title>
        <Toast.Description>{toast.description}</Toast.Description>
        <Toast.CloseTrigger>Dismiss</Toast.CloseTrigger>
      </Toast.Root>
    )}
  </Toaster>
</Portal>

// Anywhere in app:
toaster.success({ title: 'Saved', description: 'Your changes were saved.' })
```

---

### Tooltip

Accessible tooltip on hover/focus with positioning.

**Import:** `import { Tooltip } from '@ark-ui/react/tooltip'`

**Sub-components:** `Tooltip.Root`, `Tooltip.Trigger`, `Tooltip.Positioner`, `Tooltip.Content`, `Tooltip.Arrow`, `Tooltip.ArrowTip`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controlled open state |
| `defaultOpen` | `boolean` | — | Initial open state |
| `onOpenChange` | `(details) => void` | — | State change callback |
| `openDelay` | `number` | `400` | Delay before showing (ms) |
| `closeDelay` | `number` | `150` | Delay before hiding (ms) |
| `closeOnClick` | `boolean` | `true` | Close when clicking trigger |
| `closeOnEscape` | `boolean` | `true` | Close on Escape |
| `closeOnScroll` | `boolean` | `true` | Close when scrolling |
| `interactive` | `boolean` | `false` | Keep open on content hover |
| `positioning` | `PositioningOptions` | — | Placement config |
| `disabled` | `boolean` | — | Disable tooltip |

**Data Attributes:**
- Trigger: `[data-state="open"|"closed"]`
- Content: `[data-state="open"|"closed"]`, `[data-placement]`

**CSS Variables on Positioner:** `--reference-width`, `--reference-height`, `--available-width`, `--available-height`, `--x`, `--y`, `--z-index`, `--transform-origin`

**Usage:**

```tsx
import { Tooltip } from '@ark-ui/react/tooltip'
import { Portal } from '@ark-ui/react/portal'

<Tooltip.Root>
  <Tooltip.Trigger>Hover me</Tooltip.Trigger>
  <Portal>
    <Tooltip.Positioner>
      <Tooltip.Content>Helpful text</Tooltip.Content>
    </Tooltip.Positioner>
  </Portal>
</Tooltip.Root>
```

**Keyboard:** Tab shows tooltip (no delay). Escape closes.

---

### Menu

Dropdown menu with keyboard navigation, typeahead, and submenu support.

**Import:** `import { Menu } from '@ark-ui/react/menu'`

**Sub-components:** `Menu.Root`, `Menu.Trigger`, `Menu.Positioner`, `Menu.Content`, `Menu.Item`, `Menu.ItemGroup`, `Menu.ItemGroupLabel`, `Menu.ItemIndicator`, `Menu.ItemText`, `Menu.CheckboxItem`, `Menu.RadioItemGroup`, `Menu.RadioItem`, `Menu.Separator`, `Menu.TriggerItem`, `Menu.ContextTrigger`, `Menu.Arrow`, `Menu.ArrowTip`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controlled open state |
| `onSelect` | `(details) => void` | — | Selection handler |
| `closeOnSelect` | `boolean` | `true` | Auto-close on select |
| `positioning` | `PositioningOptions` | — | Placement config |
| `loopFocus` | `boolean` | `false` | Loop keyboard navigation |
| `typeahead` | `boolean` | `true` | Character search |
| `lazyMount` | `boolean` | `false` | Defer rendering |
| `unmountOnExit` | `boolean` | `false` | Remove from DOM |

**Menu.Item Props:** `value` (string), `disabled` (boolean), `closeOnSelect` (boolean), `valueText` (string, for typeahead)

**Data Attributes:**
- Content: `[data-state="open"|"closed"]`
- Item: `[data-highlighted]`, `[data-disabled]`, `[data-value]`

**Keyboard:** Space/Enter activate, ArrowDown/Up navigate, ArrowRight/Left for submenus, Escape closes.

**Usage:**

```tsx
import { Menu } from '@ark-ui/react/menu'

<Menu.Root>
  <Menu.Trigger>Actions</Menu.Trigger>
  <Menu.Positioner>
    <Menu.Content>
      <Menu.Item value="edit">Edit</Menu.Item>
      <Menu.Item value="delete">Delete</Menu.Item>
      <Menu.Separator />
      <Menu.ItemGroup>
        <Menu.ItemGroupLabel>More</Menu.ItemGroupLabel>
        <Menu.Item value="archive">Archive</Menu.Item>
      </Menu.ItemGroup>
    </Menu.Content>
  </Menu.Positioner>
</Menu.Root>
```

---

### Tabs

Tabbed content with automatic or manual activation.

**Import:** `import { Tabs } from '@ark-ui/react/tabs'`

**Sub-components:** `Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`, `Tabs.Indicator`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultValue` | `string` | — | Initial selected tab |
| `value` | `string` | — | Controlled selected tab |
| `onValueChange` | `(details) => void` | — | Selection callback |
| `activationMode` | `'automatic' \| 'manual'` | `'automatic'` | Activate on focus or click |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction |
| `loopFocus` | `boolean` | `true` | Wrap keyboard navigation |
| `lazyMount` | `boolean` | `false` | Defer content rendering |
| `unmountOnExit` | `boolean` | `false` | Remove inactive content |

**Tabs.Trigger Props:** `value` (string), `disabled` (boolean)

**Tabs.Content Props:** `value` (string) — must match trigger value

**Data Attributes:**
- Root: `[data-orientation]`
- Trigger: `[data-state="active"|"inactive"]`, `[data-disabled]`, `[data-orientation]`
- Content: `[data-state="active"|"inactive"]`

**Tabs.Indicator** — animated indicator, exposes CSS variables: `--transition-property`, `--left`, `--top`, `--width`, `--height`

**Usage:**

```tsx
import { Tabs } from '@ark-ui/react/tabs'

<Tabs.Root defaultValue="tab1">
  <Tabs.List>
    <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
    <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Content value="tab1">Content 1</Tabs.Content>
  <Tabs.Content value="tab2">Content 2</Tabs.Content>
</Tabs.Root>
```

---

### Select

Styled select dropdown with collection-based items.

**Import:** `import { Select, createListCollection } from '@ark-ui/react/select'`

**Sub-components:** `Select.Root`, `Select.Label`, `Select.Control`, `Select.Trigger`, `Select.ValueText`, `Select.ClearTrigger`, `Select.Indicator`, `Select.Positioner`, `Select.Content`, `Select.ItemGroup`, `Select.ItemGroupLabel`, `Select.Item`, `Select.ItemText`, `Select.ItemIndicator`, `Select.HiddenSelect`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collection` | `ListCollection<T>` | **required** | Item collection |
| `value` | `string[]` | — | Controlled selected values |
| `defaultValue` | `string[]` | — | Initial values |
| `onValueChange` | `(details) => void` | — | Selection callback |
| `multiple` | `boolean` | — | Multi-select |
| `disabled` | `boolean` | — | Disable interaction |
| `closeOnSelect` | `boolean` | `true` | Close after selection |
| `positioning` | `PositioningOptions` | — | Dropdown positioning |
| `name` | `string` | — | Form field name |
| `invalid` | `boolean` | — | Error state |

**Data Attributes:**
- Trigger: `[data-state="open"|"closed"]`, `[data-placeholder-shown]`
- Item: `[data-state="checked"|"unchecked"]`, `[data-highlighted]`, `[data-disabled]`, `[data-value]`
- Content: `[data-state="open"|"closed"]`, `[data-placement]`

**HiddenSelect** renders a native `<select>` for form integration.

**Usage:**

```tsx
import { Select, createListCollection } from '@ark-ui/react/select'

const collection = createListCollection({
  items: [
    { label: 'React', value: 'react' },
    { label: 'Vue', value: 'vue' },
  ]
})

<Select.Root collection={collection}>
  <Select.Label>Framework</Select.Label>
  <Select.Control>
    <Select.Trigger>
      <Select.ValueText placeholder="Select..." />
    </Select.Trigger>
  </Select.Control>
  <Select.Positioner>
    <Select.Content>
      {collection.items.map((item) => (
        <Select.Item key={item.value} item={item}>
          <Select.ItemText>{item.label}</Select.ItemText>
          <Select.ItemIndicator>✓</Select.ItemIndicator>
        </Select.Item>
      ))}
    </Select.Content>
  </Select.Positioner>
  <Select.HiddenSelect />
</Select.Root>
```

**Keyboard:** Space/Enter open + select, ArrowDown/Up navigate, Escape closes, A-Za-z typeahead.

---

### Popover

Overlay with title, description, and close trigger. Non-modal by default.

**Import:** `import { Popover } from '@ark-ui/react/popover'`

**Sub-components:** `Popover.Root`, `Popover.Trigger`, `Popover.Anchor`, `Popover.Positioner`, `Popover.Content`, `Popover.Title`, `Popover.Description`, `Popover.CloseTrigger`, `Popover.Arrow`, `Popover.ArrowTip`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controlled open state |
| `defaultOpen` | `boolean` | — | Initial open state |
| `onOpenChange` | `(details) => void` | — | State change callback |
| `autoFocus` | `boolean` | `true` | Focus first element on open |
| `closeOnEscape` | `boolean` | `true` | Close on Escape |
| `closeOnInteractOutside` | `boolean` | `true` | Close on outside click |
| `modal` | `boolean` | `false` | Trap focus and block scroll |
| `portalled` | `boolean` | `true` | Render in portal |
| `positioning` | `PositioningOptions` | — | Placement config |

**Data Attributes:**
- Trigger: `[data-state="open"|"closed"]`
- Content: `[data-state="open"|"closed"]`, `[data-placement]`

**CSS Variables on Positioner:** `--reference-width`, `--reference-height`, `--available-width`, `--available-height`, `--x`, `--y`, `--z-index`, `--transform-origin`

**Popover.Anchor** — optional alternate positioning reference (different from trigger).

**Usage:**

```tsx
import { Popover } from '@ark-ui/react/popover'

<Popover.Root>
  <Popover.Trigger>Info</Popover.Trigger>
  <Popover.Positioner>
    <Popover.Content>
      <Popover.Title>Details</Popover.Title>
      <Popover.Description>More information here.</Popover.Description>
      <Popover.CloseTrigger>Close</Popover.CloseTrigger>
    </Popover.Content>
  </Popover.Positioner>
</Popover.Root>
```

**Keyboard:** Space/Enter toggle, Tab/Shift+Tab navigate, Escape closes.

---

### Checkbox

Accessible checkbox with indeterminate state support.

**Import:** `import { Checkbox } from '@ark-ui/react/checkbox'`

**Sub-components:** `Checkbox.Root` (renders `<label>`), `Checkbox.Control`, `Checkbox.Indicator`, `Checkbox.Label`, `Checkbox.HiddenInput`, `Checkbox.Group`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `CheckedState` | — | Controlled checked state |
| `defaultChecked` | `CheckedState` | — | Initial state |
| `onCheckedChange` | `(details) => void` | — | State change callback |
| `disabled` | `boolean` | — | Disable interaction |
| `name` | `string` | — | Form field name |
| `invalid` | `boolean` | — | Error state |
| `required` | `boolean` | — | Required field |
| `readOnly` | `boolean` | — | Read-only state |

**CheckedState:** `boolean | 'indeterminate'`

**Checkbox.Group Props:** `defaultValue` (string[]), `value` (string[]), `onValueChange`, `disabled`, `name`

**Data Attributes:** `[data-state="checked"|"unchecked"|"indeterminate"]`, `[data-disabled]`, `[data-focus]`, `[data-hover]`, `[data-invalid]`

**Usage:**

```tsx
import { Checkbox } from '@ark-ui/react/checkbox'

<Checkbox.Root>
  <Checkbox.Control>
    <Checkbox.Indicator>✓</Checkbox.Indicator>
  </Checkbox.Control>
  <Checkbox.Label>Accept terms</Checkbox.Label>
  <Checkbox.HiddenInput />
</Checkbox.Root>
```

**Keyboard:** Space toggles.

---

### Switch

Toggle switch for on/off states.

**Import:** `import { Switch } from '@ark-ui/react/switch'`

**Sub-components:** `Switch.Root` (renders `<label>`), `Switch.Control`, `Switch.Thumb`, `Switch.Label`, `Switch.HiddenInput`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `checked` | `boolean` | — | Controlled checked state |
| `onCheckedChange` | `(details) => void` | — | State change callback |
| `disabled` | `boolean` | — | Disable interaction |
| `name` | `string` | — | Form field name |
| `value` | `string \| number` | `'on'` | Form value |
| `invalid` | `boolean` | — | Error state |
| `required` | `boolean` | — | Required field |

**Data Attributes:** `[data-state="checked"|"unchecked"]`, `[data-disabled]`, `[data-focus]`, `[data-hover]`, `[data-invalid]`

**Usage:**

```tsx
import { Switch } from '@ark-ui/react/switch'

<Switch.Root>
  <Switch.Control>
    <Switch.Thumb />
  </Switch.Control>
  <Switch.Label>Enable notifications</Switch.Label>
  <Switch.HiddenInput />
</Switch.Root>
```

**Keyboard:** Space and Enter toggle.

---

### Radio Group

Single-selection radio group.

**Import:** `import { RadioGroup } from '@ark-ui/react/radio-group'`

**Sub-components:** `RadioGroup.Root`, `RadioGroup.Label`, `RadioGroup.Item`, `RadioGroup.ItemControl`, `RadioGroup.ItemText`, `RadioGroup.ItemHiddenInput`, `RadioGroup.Indicator`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultValue` | `string` | — | Initial selected value |
| `value` | `string` | — | Controlled selected value |
| `onValueChange` | `(details) => void` | — | Selection callback |
| `orientation` | `'horizontal' \| 'vertical'` | — | Layout direction |
| `disabled` | `boolean` | — | Disable all items |
| `name` | `string` | — | Form field name |

**RadioGroup.Item Props:** `value` (string), `disabled` (boolean)

**Data Attributes:**
- Root: `[data-orientation]`, `[data-disabled]`
- ItemControl: `[data-state="checked"|"unchecked"]`, `[data-active]`, `[data-focus]`, `[data-hover]`, `[data-disabled]`

**RadioGroup.Indicator** — animated indicator, exposes CSS variables: `--left`, `--top`, `--width`, `--height`

**Usage:**

```tsx
import { RadioGroup } from '@ark-ui/react/radio-group'

const options = ['Small', 'Medium', 'Large']

<RadioGroup.Root defaultValue="Medium">
  <RadioGroup.Label>Size</RadioGroup.Label>
  {options.map((opt) => (
    <RadioGroup.Item key={opt} value={opt}>
      <RadioGroup.ItemControl />
      <RadioGroup.ItemText>{opt}</RadioGroup.ItemText>
      <RadioGroup.ItemHiddenInput />
    </RadioGroup.Item>
  ))}
</RadioGroup.Root>
```

---

### Collapsible

Expandable/collapsible content section.

**Import:** `import { Collapsible } from '@ark-ui/react/collapsible'`

**Sub-components:** `Collapsible.Root`, `Collapsible.Trigger`, `Collapsible.Content`, `Collapsible.Indicator`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controlled open state |
| `defaultOpen` | `boolean` | — | Initial open state |
| `onOpenChange` | `(details) => void` | — | State change callback |
| `disabled` | `boolean` | — | Disable toggle |
| `lazyMount` | `boolean` | `false` | Defer rendering |
| `unmountOnExit` | `boolean` | `false` | Remove from DOM |

**Data Attributes:** `[data-state="open"|"closed"]`, `[data-disabled]`

**CSS Variables on Content:** `--height`, `--width` (for animation)

**Usage:**

```tsx
import { Collapsible } from '@ark-ui/react/collapsible'

<Collapsible.Root>
  <Collapsible.Trigger>Toggle</Collapsible.Trigger>
  <Collapsible.Content>
    <p>Collapsible content here.</p>
  </Collapsible.Content>
</Collapsible.Root>
```

**Keyboard:** Space and Enter toggle.

---

### Accordion

Multi-section collapsible, single or multiple open.

**Import:** `import { Accordion } from '@ark-ui/react/accordion'`

**Sub-components:** `Accordion.Root`, `Accordion.Item`, `Accordion.ItemTrigger`, `Accordion.ItemContent`, `Accordion.ItemIndicator`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultValue` | `string[]` | — | Initially expanded items |
| `value` | `string[]` | — | Controlled expanded items |
| `onValueChange` | `(details) => void` | — | Change callback |
| `collapsible` | `boolean` | `false` | Allow closing all items |
| `multiple` | `boolean` | `false` | Allow multiple open |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Layout |
| `disabled` | `boolean` | — | Disable all items |
| `lazyMount` | `boolean` | `false` | Defer rendering |
| `unmountOnExit` | `boolean` | `false` | Remove from DOM |

**Accordion.Item Props:** `value` (string, required), `disabled` (boolean)

**Data Attributes:**
- Item: `[data-state="open"|"closed"]`, `[data-disabled]`
- ItemTrigger: `[data-state="open"|"closed"]`
- ItemContent: `[data-state="open"|"closed"]`

**Usage:**

```tsx
import { Accordion } from '@ark-ui/react/accordion'

<Accordion.Root collapsible defaultValue={['item-1']}>
  <Accordion.Item value="item-1">
    <Accordion.ItemTrigger>
      Section 1
      <Accordion.ItemIndicator />
    </Accordion.ItemTrigger>
    <Accordion.ItemContent>Content 1</Accordion.ItemContent>
  </Accordion.Item>
  <Accordion.Item value="item-2">
    <Accordion.ItemTrigger>
      Section 2
      <Accordion.ItemIndicator />
    </Accordion.ItemTrigger>
    <Accordion.ItemContent>Content 2</Accordion.ItemContent>
  </Accordion.Item>
</Accordion.Root>
```

---

### Combobox

Search input with filtered dropdown list.

**Import:** `import { Combobox } from '@ark-ui/react/combobox'`

**Collection:** `import { useListCollection } from '@ark-ui/react/list-collection'`

**Sub-components:** `Combobox.Root`, `Combobox.Label`, `Combobox.Control`, `Combobox.Input`, `Combobox.Trigger`, `Combobox.ClearTrigger`, `Combobox.Positioner`, `Combobox.Content`, `Combobox.ItemGroup`, `Combobox.ItemGroupLabel`, `Combobox.Item`, `Combobox.ItemText`, `Combobox.ItemIndicator`, `Combobox.List`, `Combobox.Empty`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collection` | `ListCollection<T>` | **required** | Item collection |
| `inputBehavior` | `'none' \| 'autohighlight' \| 'autocomplete'` | `'none'` | Auto-completion |
| `multiple` | `boolean` | — | Multi-select |
| `allowCustomValue` | `boolean` | — | Accept typed values |
| `value` | `string[]` | — | Controlled selected values |
| `onValueChange` | `(details) => void` | — | Selection callback |
| `onInputValueChange` | `(details) => void` | — | Input change callback |
| `placeholder` | `string` | — | Input placeholder |

**Data Attributes:**
- Content: `[data-state="open"|"closed"]`, `[data-empty]`
- Item: `[data-highlighted]`, `[data-state="checked"|"unchecked"]`, `[data-value]`

**Usage:**

```tsx
import { Combobox } from '@ark-ui/react/combobox'
import { useListCollection } from '@ark-ui/react/list-collection'

function Demo() {
  const { collection } = useListCollection({
    initialItems: [
      { label: 'React', value: 'react' },
      { label: 'Vue', value: 'vue' },
    ],
  })

  return (
    <Combobox.Root collection={collection}>
      <Combobox.Label>Framework</Combobox.Label>
      <Combobox.Control>
        <Combobox.Input />
        <Combobox.Trigger>Open</Combobox.Trigger>
      </Combobox.Control>
      <Combobox.Positioner>
        <Combobox.Content>
          {collection.items.map((item) => (
            <Combobox.Item key={item.value} item={item}>
              <Combobox.ItemText>{item.label}</Combobox.ItemText>
              <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
            </Combobox.Item>
          ))}
          <Combobox.Empty>No results</Combobox.Empty>
        </Combobox.Content>
      </Combobox.Positioner>
    </Combobox.Root>
  )
}
```

---

### Field

Form field wrapper with label, input, helper text, and error text. Propagates `disabled`, `invalid`, `required`, `readOnly` to children.

**Import:** `import { Field } from '@ark-ui/react/field'`

**Sub-components:** `Field.Root`, `Field.Label`, `Field.Input`, `Field.Textarea`, `Field.Select`, `Field.HelperText`, `Field.ErrorText`, `Field.RequiredIndicator`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `disabled` | `boolean` | — | Disable field |
| `invalid` | `boolean` | — | Error state |
| `required` | `boolean` | — | Required field |
| `readOnly` | `boolean` | — | Read-only |

**Field.Textarea** supports `autoresize` (boolean, default: false).

**Data Attributes:** `[data-disabled]`, `[data-invalid]`, `[data-required]`, `[data-readonly]`

**Usage:**

```tsx
import { Field } from '@ark-ui/react/field'

<Field.Root required invalid={!!error}>
  <Field.Label>Email</Field.Label>
  <Field.Input type="email" />
  <Field.HelperText>We'll never share your email.</Field.HelperText>
  <Field.ErrorText>{error}</Field.ErrorText>
</Field.Root>
```

Field auto-wires `aria-describedby` between input and helper/error text, and `aria-invalid` from the `invalid` prop.

**Gotchas:**

- **`id` on `Field.Root` sets the control's id, not the root's.** To control the input's id (e.g., for a caller-provided `htmlFor`), pass `id={yourId}` on `Field.Root` — it flows to the input via context and to the label's `htmlFor`. The `ids.control` prop on Root counterintuitively sets the *root element's* rendered id, not the control's.
- **`required` propagates as native HTML `required`, not `aria-required`.** This is correct HTML practice (native attr is sufficient), but tests checking for `aria-required="true"` will fail — use `.toBeRequired()` / check the native attribute instead.

---

### Progress (Linear)

Determinate or indeterminate progress bar.

**Import:** `import { Progress } from '@ark-ui/react/progress'`

**Sub-components:** `Progress.Root`, `Progress.Label`, `Progress.ValueText`, `Progress.Track`, `Progress.Range`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | — | Controlled value |
| `defaultValue` | `number` | `50` | Initial value |
| `min` | `number` | `0` | Minimum value |
| `max` | `number` | `100` | Maximum value |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout |

Set `value` to `null` for indeterminate state.

**Data Attributes:** `[data-state="indeterminate"|"loading"|"complete"]`, `[data-value]`, `[data-orientation]`

**CSS Variables:** `--percent`

**Usage:**

```tsx
import { Progress } from '@ark-ui/react/progress'

<Progress.Root defaultValue={42}>
  <Progress.Label>Uploading</Progress.Label>
  <Progress.ValueText />
  <Progress.Track>
    <Progress.Range />
  </Progress.Track>
</Progress.Root>
```

---

### Pagination

Page navigation with prev/next, page items, and ellipsis.

**Import:** `import { Pagination } from '@ark-ui/react/pagination'`

**Sub-components:** `Pagination.Root`, `Pagination.PrevTrigger`, `Pagination.NextTrigger`, `Pagination.Item`, `Pagination.Ellipsis`, `Pagination.FirstTrigger`, `Pagination.LastTrigger`

**Root Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `count` | `number` | — | Total data items |
| `pageSize` | `number` | `10` | Items per page |
| `defaultPage` | `number` | `1` | Initial page |
| `page` | `number` | — | Controlled page |
| `onPageChange` | `(details) => void` | — | Page change callback |
| `siblingCount` | `number` | `1` | Pages beside active |
| `boundaryCount` | `number` | `1` | Pages at start/end |
| `type` | `'button' \| 'link'` | `'button'` | Element type |

**Data Attributes:**
- Item: `[data-selected]`
- PrevTrigger/NextTrigger: `[data-disabled]`

**Context API:** `page`, `totalPages`, `pages` (array with page/ellipsis entries), `pageRange`, `setPage()`, `goToNextPage()`, `goToPrevPage()`

**Usage:**

```tsx
import { Pagination } from '@ark-ui/react/pagination'

<Pagination.Root count={500} pageSize={10} siblingCount={1}>
  <Pagination.PrevTrigger>Previous</Pagination.PrevTrigger>
  <Pagination.Context>
    {(api) =>
      api.pages.map((page, i) =>
        page.type === 'page' ? (
          <Pagination.Item key={i} {...page}>{page.value}</Pagination.Item>
        ) : (
          <Pagination.Ellipsis key={i} index={i}>...</Pagination.Ellipsis>
        )
      )
    }
  </Pagination.Context>
  <Pagination.NextTrigger>Next</Pagination.NextTrigger>
</Pagination.Root>
```

---

## Positioning Options

Shared by Tooltip, Popover, Menu, Select, Combobox. Passed via `positioning` prop on Root:

```typescript
type PositioningOptions = {
  placement?: 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end'
    | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end'
  strategy?: 'absolute' | 'fixed'
  offset?: { mainAxis?: number; crossAxis?: number }
  gutter?: number        // shorthand for mainAxis offset
  flip?: boolean         // auto-flip when near edge
  slide?: boolean        // slide along edge when near edge
  overlap?: boolean      // allow overlap with reference
  sameWidth?: boolean    // match reference width
  fitViewport?: boolean  // constrain to viewport
}
```

---

## S/NC Wrapper Pattern

Our styled wrappers live in `components/ui/`. Each primitive gets two files:

```
components/ui/
  dialog.tsx           — re-exports Ark UI parts with className props
  dialog.module.css    — visual styling using tokens
```

**Consumers import our wrapper, not Ark UI directly.** This centralizes styling and makes swapping the behavioral library possible without touching feature code.

```tsx
// components/ui/dialog.tsx
import { Dialog as ArkDialog } from '@ark-ui/react/dialog'
import { Portal } from '@ark-ui/react/portal'
import styles from './dialog.module.css'

export function DialogRoot(props) { return <ArkDialog.Root {...props} /> }
export function DialogBackdrop() { return <ArkDialog.Backdrop className={styles.backdrop} /> }
export function DialogContent({ children, ...props }) {
  return (
    <Portal>
      <ArkDialog.Positioner className={styles.positioner}>
        <ArkDialog.Content className={styles.content} {...props}>
          {children}
        </ArkDialog.Content>
      </ArkDialog.Positioner>
    </Portal>
  )
}
export function DialogTitle(props) { return <ArkDialog.Title className={styles.title} {...props} /> }
export function DialogDescription(props) { return <ArkDialog.Description className={styles.description} {...props} /> }
export function DialogCloseTrigger(props) { return <ArkDialog.CloseTrigger className={styles.close} {...props} /> }
export const DialogTrigger = ArkDialog.Trigger
```

**Pattern rules:**
- Wrapper handles Portal placement (consumer doesn't need to think about it)
- CSS Modules use design tokens (`var(--color-*)`, `var(--space-*)`, etc.)
- Animations use `[data-state="open"]` / `[data-state="closed"]` selectors
- All `--duration-*` tokens reset to 0ms under `prefers-reduced-motion: reduce`

---

## Testing Ark UI Components (Vitest + Testing Library)

Ark primitives render floating content (Menu/Popover/Select/Tooltip/Dialog) via React Portal. This changes how tests find + interact with content.

**Idioms:**
- **Use `screen.getBy*` / `findBy*`, not `container.querySelector`.** Portal content is rendered outside the component's container. Role-based queries (`getByRole("menuitem")`, `getByRole("option")`, `getByRole("dialog")`) find it regardless.
- **Use `userEvent`, not `fireEvent`.** Ark's Zag state machines respond to realistic pointer/keyboard sequences. `fireEvent.click` often won't trip the right state transitions on triggers.
- **Select/Menu items render only when open.** Click the trigger first, then `findByRole("option"|"menuitem")` — the `find*` variant waits for Portal render.
- **Don't test outside-click/Escape handlers.** Those are Ark's responsibility. Test *your* behavior: that `onOpenChange` props wire up, that selection fires callbacks, that visible state matches expectations.

**jsdom polyfills required** (add to `tests/setup.ts` once, covers every Ark primitive):

```ts
// @floating-ui/dom (Ark's positioning engine) needs ResizeObserver
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
// Zag Select calls scrollTo on option elements on open; jsdom elements lack it
Element.prototype.scrollTo = () => {};
```

**Example — testing a Select:**

```tsx
const user = userEvent.setup();
render(<MyComponent />);
await user.click(screen.getByLabelText("Role"));        // click trigger
const option = await screen.findByRole("option", { name: "viewer" });
await user.click(option);
expect(onChange).toHaveBeenCalledWith("viewer");
```

**`aria-label` placement:** put `aria-label` on the focusable trigger element (`SelectTrigger`, `MenuTrigger`), not the Root. `getByLabelText` needs to find the focusable element.
