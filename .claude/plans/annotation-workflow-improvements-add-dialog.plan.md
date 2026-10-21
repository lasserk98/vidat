# Plan: Add-Annotation Dialog

**Source PRD**: `.claude/prds/annotation-workflow-improvements.prd.md`
**Selected Milestone**: 3 — Add-annotation dialog
**Complexity**: Medium

## Summary
Clicking "add" in the Actions table, or pressing the existing `+` shortcut, opens a pop-up with a type-to-filter dropdown of the configured action labels, grouped by ENT hierarchy level (P, EP, SC, S, T, ST, I, then Other). Selecting a label creates the annotation at the current left/right range exactly as `handleAdd` does today, without touching the view, timeline or selection. An optional "keep open" toggle supports rapid multi-add (several labels over the same range, for example P + EP + SC). The `+` binding and its target filtering are not changed.

## Findings that shaped this plan
- **No parent links in the config.** `public/config/ci.json` labels have only `id`, `name`, `color`, `objects`; the hierarchy exists only as a name prefix (`EP:`, `SC:`, …) handled in `src/libs/hierarchyLevels.js`. So "show the ENT hierarchy" means grouping by prefix level, and filtering can match the label name only. The PRD question about matching parent names is resolved: not possible without data that doesn't exist.
- **Scale:** `ci.json` has 113 action labels, so grouping, filtering and a color swatch matter.
- **Shortcut scope:** `+` is handled in `ActionTable.vue` (`handleKeyup`, `window` keyup, capture phase, `event.code === 'Equal'`), and ignores events whose target is an `input`. Other global keys (`KeyP`, arrows, `KeyA/D/W/S`, comma, period in `KeyframePanel.vue`; `Delete`, `Escape` in `CanvasPanel.vue`) also only ignore `input` targets. A filter box is an `input`, so typing in it is safe; focus on a dialog button would not be.
- **Key-code caveat:** `Equal` is a physical key code. On layouts where `+` is a different physical key (for example German QWERTZ) the existing shortcut may not fire on the `+` key. Preserved as-is per the PRD (see open questions).

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Dialog plugin usage | `src/libs/utils.js:14-27` (`confirm`), `src/main.js:16-19` (Dialog, Notify plugins) | Quasar dialogs are used through the plugin; a reusable component with its own state is new, so use Quasar's `q-dialog` component with `v-model`. No existing `q-dialog` or `use-input` in the repo (confirmed by search): follow the Quasar docs pattern, nothing local to copy. |
| Pop-up with a select | `src/pages/annotation/CanvasPanel.vue:85-115` (popup with `q-select`, `@keydown.enter`, confirm button) | Dense `q-select` with `emit-value` / `map-options`, enter to confirm. |
| Pure helper + JSDoc | `src/libs/hierarchyLevels.js` | Pure, JSDoc-typed, named exports, label lookup by `matchHierarchyLevel(label.name)`. |
| Label list source | `ActionTable.vue` `actionOptionList` computed (`{label: name, value: id}`) | Options derive from `configurationStore.actionLabelData`. |
| Creating an annotation | `ActionTable.vue` `handleAdd` | `new ActionAnnotation(index2time(left), index2time(right), label.id, label.objects[0], label.color, '')` pushed to `annotationStore.actionAnnotationList`. Reuse via one shared function. |
| Keyboard handling | `ActionTable.vue` `handleKeyup` | Window capture listener, ignore `input` targets, `preventDefault` then act. |
| Dark-mode aware styling | `ActionTable.vue` `q.dark.isActive` classes | Use the same approach for any custom colors. |
| Tests | None | No test framework; node check of the pure helper plus a manual browser flow. |

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/libs/actionLabelOptions.js` | CREATE | Pure `buildActionLabelOptions(actionLabelData, query)`: filters by case-insensitive word match on the label name (every typed word must appear), groups by hierarchy level in `HIERARCHY_LEVELS` order with an "Other" group last, returns a flat list of group headers and selectable options (`{id, name, color}`) for the dropdown. |
| `src/components/AddActionDialog.vue` | CREATE | `q-dialog` with a focused `q-select` (`use-input`, filter-as-you-type, group headers, color swatch per option), a "keep open" toggle, and an `add(labelId)` event. Resets the input after each add. |
| `src/pages/annotation/ActionTable.vue` | UPDATE | "add" button and `+` open the dialog (guard against re-opening while open); extract the annotation creation from `handleAdd` into a function taking a label, used by the dialog's event. `handleAddAdvance` unchanged for now (see open questions). Update the button tooltip. |
| `src/pages/help/Help.vue` | UPDATE | Shortcut description for `plus (+)` becomes "open the add action dialog". |

## Tasks
### Task 1: Pure option builder
- **Action**: Implement `buildActionLabelOptions`. Empty query returns all labels grouped; a query returns only matching labels, dropping empty groups. Labels not matching any hierarchy prefix go into "Other". Stable order within a group (config order). Never mutates inputs.
- **Mirror**: `hierarchyLevels.js` helpers.
- **Validate**: Node check with real `ci.json` and `stapes.json`: grouping order, multi-word filter, no-match query returns an empty list, "Other" contains `default`, input not mutated.

### Task 2: Dialog component
- **Action**: Build `AddActionDialog.vue` with `v-model` open state. On open, focus the select input. Enter selects the highlighted option; selecting emits `add` with the label id and clears the filter. Without "keep open" the dialog closes; with it, it stays open and refocuses the input. Escape and click-outside close it. Group headers are not selectable.
- **Mirror**: CanvasPanel popup select; Quasar docs `use-input` filtering pattern.
- **Validate**: Browser: open, type "cochl", see only matching labels under their group headers, press Enter, annotation is added.

### Task 3: Wire into `ActionTable`
- **Action**: Extract `addAction(label)` from `handleAdd` (same fields as today). The "add" button and the `+` key open the dialog; ignore `+` while the dialog is open. Do not change `handleKeyup`'s target filtering or key code. The dialog's `add` event calls `addAction`. Do not select, scroll to or highlight the new row, and do not touch frames, timeline preference or other view state.
- **Mirror**: `handleAdd`, `handleKeyup`.
- **Validate**: Browser: `+` and the button both open the dialog; adding keeps the hierarchical timeline and the current view; the new row appears in its sorted position.

### Task 4: Rapid multi-add
- **Action**: With "keep open" on, add several labels in a row over the same range; each creates one annotation. Verify focus returns to the filter input after each add so the whole flow is keyboard-only (`+`, type, Enter, type, Enter, Escape).
- **Validate**: Browser: three adds in one session produce three annotations with the expected labels and identical start/end.

### Task 5: Shortcut and Help text
- **Action**: Update `Help.vue` description; confirm other global shortcuts do not fire while the dialog is focused (typing letters such as `p`, `a`, `d`, `w`, `s` in the filter must not play the video or move frames, and Escape must not also affect the canvas).
- **Validate**: Browser: type "pad" in the filter; no playback or frame change.

### Task 6: Regression checks
- **Action**: Confirm milestone 1 (no timeline switch) and milestone 2 (sorted list, same-start hierarchy tie-break) still hold with dialog-created annotations, and that "add & advance" still works.
- **Validate**: Manual flow with `ci.json`.

## Validation
```bash
npm run build
npx prettier --check src/libs/actionLabelOptions.js src/components/AddActionDialog.vue src/pages/annotation/ActionTable.vue src/pages/help/Help.vue

# pure-helper check (no test framework in the repo)
node --input-type=module -e "
import { buildActionLabelOptions } from './src/libs/actionLabelOptions.js'
// cases from Task 1 here, using public/config/ci.json
"

# manual: npm run dev with public/config/ci.json, then Tasks 2-6 in the browser
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Group headers inside a `q-select` menu need a custom option slot and may misbehave with keyboard navigation | Medium | Mark headers non-selectable; verify arrow-key and Enter behavior in the browser (Task 2). Fallback: a filtered `q-list` inside the dialog with its own input. |
| Global key handlers (`KeyP`, arrows, `Delete`, `Escape`) fire while focus is in the dialog but not on an input | Medium | Task 5; if needed, stop key propagation inside the dialog. |
| `+` re-opens the dialog or fires from inside it | Low | Guard on open state; filter input is already ignored by the handler. |
| Existing `Equal` key code does not match the `+` key on some layouts | Medium | Out of scope to change (PRD); recorded as an open question. |
| 113 labels make the dropdown long | Low | Filter-as-you-type plus grouping; verify scrolling inside the menu. |
| No automated tests | Medium | Node check of the pure helper plus the manual flow |

## Open questions (defaults used by this plan)
- [ ] **"add & advance"**: keep it adding immediately with the default label (plan default), or also open the dialog and advance after each pick?
- [ ] **"Keep open" default**: off (dialog closes after each add) by default, with a toggle; or on by default?
- [ ] **`+` key on non-US layouts**: should the binding also accept the physical `+` key, or stay exactly as it is? Plan default: unchanged.

## Acceptance
- [ ] Button and `+` open the dialog; filtering by typed words works; labels are grouped by ENT level
- [ ] Selecting a label adds the annotation over the current range, with no change to timeline, view or selection
- [ ] Rapid multi-add works from the keyboard
- [ ] Typing in the filter triggers no other global shortcuts
- [ ] Existing `+` binding unchanged; "add & advance" unaffected
- [ ] `npm run build` and prettier pass
- [ ] Patterns mirrored, not reinvented
