---
name: vidat-key-handlers-block-dialog-input
description: "Use when adding a dialog, input or keyboard flow to Vidat's annotation page and arrow keys, Enter or Escape do nothing inside it, or when a Quasar q-select/q-input handler never fires — the page's window-level capture handlers call stopPropagation() first"
metadata:
  origin: auto-extracted
---

# Vidat global key handlers swallow keys meant for dialogs

**Extracted:** 2026-10-21
**Context:** Vidat (Vue 3 + Quasar). Annotation page: `KeyframePanel.vue`, `CanvasPanel.vue`, `ActionTable.vue`.

## Problem
Each of these registers `window.addEventListener('keydown'|'keyup', handler, true)` (capture phase)
and its first line is `event.stopPropagation()`; only afterwards does it return early for `input` targets.
Keys typed into an input therefore never reach the input's own listeners (`@keydown.down`, Quasar `q-select`
navigation) or Quasar's bubble-phase Escape handling. Typing characters still works, which makes it look like
the component is broken, not blocked.

## Solution
Listen on `window` in the capture phase yourself while the overlay is open. `stopPropagation()` only stops
the event moving to later nodes, so a second listener on the same window capture phase still runs.

```js
const handleKeydown = (event) => {
  if (event.isComposing) return
  if (event.code === 'ArrowDown' || event.code === 'ArrowUp') { event.preventDefault(); move(...) }
  else if (event.code === 'Enter' || event.code === 'NumpadEnter') { event.preventDefault(); confirm() }
  else if (event.code === 'Escape') { event.preventDefault(); isOpen.value = false } // Quasar's Escape is blocked too
}
watch(isOpen, (open) => window[open ? 'addEventListener' : 'removeEventListener']('keydown', handleKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown, true))
```

Reference implementation: `src/components/AddActionDialog.vue`.

## Related gotchas (same dialog)
- Quasar `q-select` menus use virtual scrolling that assumes uniform row height. Group headers or custom
  option slots of different height without `:key` gave repeated rows and scroll resets. For ~100 grouped
  items use a plain scrollable `q-list` instead.
- Existing shortcuts (`+` is `event.code === 'Equal'`, `p`, arrows, `a/d/w/s`) ignore `input` targets, so
  typing in a filter field is safe; focus on a button is not.

## When to Use
- Adding any modal or overlay with keyboard navigation to the annotation page
- Handlers on an input inside a Vidat dialog never fire, or Escape does not close a Quasar dialog
