# Plan: Stable Timeline on Add

**Source PRD**: `.claude/prds/annotation-workflow-improvements.prd.md`
**Selected Milestone**: 1 — Stable timeline on add
**Complexity**: Small

## Summary
Adding an action annotation currently creates it with `actionLabelData[0]` as its label (`ActionTable.vue` `handleAdd`). If that label has no hierarchy prefix (`P:`/`EP:`/`SC:`/`S:`/`T:`/`ST:`/`I:`), `hasUnmatchedHierarchyLabels` in `KeyframePanel.vue` becomes true and its watcher flips the persisted `hierarchicalTimeline` preference to `false`, with a warning toast. That is the bug: the user must re-enable the hierarchical timeline after every add. The fix is to create new annotations with a default label that matches a hierarchy level, so the unmatched-label invariant is never violated by the add path. The regression watcher stays as the safety net for loaded or imported data.

Root cause was found by reading the code; it has **not** been reproduced in the browser yet (see Task 1).

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Naming / pure helpers | `src/libs/hierarchyLevels.js:21-41` | Small, JSDoc-typed pure functions (`matchHierarchyLevel`, `hasUnmatchedActionAnnotations`) exported by name from one module; labels resolved by `.name` from `actionLabelData`. |
| Add path | `src/pages/annotation/ActionTable.vue` `handleAdd` / `handleAddAdvance` | `handleAdd` builds `new ActionAnnotation(start, end, labelId, object, color, '')` from `actionLabelData[0]`; `handleAddAdvance` calls `handleAdd` then advances the frames. Both must pick up the fix through the one shared default. |
| Regression safety net | `src/pages/annotation/KeyframePanel.vue:168-181` | `watch` on `hierarchicalTimeline && hasUnmatchedHierarchyLabels` flips the preference off and notifies via `utils.notify(..., 'warning')`. Leave unchanged. |
| Errors / user feedback | `src/libs/utils.js` (`utils.notify`) | Warnings go through `utils.notify`, not `console`. |
| Tests | None | The repo has no test framework or test files (`package.json` scripts: `dev`, `build`, `preview` only). No pattern exists to mirror; see Validation and the decision below. |

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/libs/hierarchyLevels.js` | UPDATE | Add a pure `getDefaultActionLabel(actionLabelData)` returning the first label whose name matches a hierarchy level, falling back to `actionLabelData[0]` when none matches (non-ENT configs keep today's behavior). |
| `src/pages/annotation/ActionTable.vue` | UPDATE | `handleAdd` uses `getDefaultActionLabel(...)` instead of `actionLabelData[0]`, for the id, first object and color. |

No change to `KeyframePanel.vue`, the preference store, or the annotation store.

## Tasks
### Task 1: Reproduce and confirm the root cause
- **Action**: Run the app with an ENT config where `actionLabelData[0]` has no hierarchy prefix, enable the hierarchical timeline, click "add", and confirm the toast and the preference flip. Also check with a config whose first label is prefixed, to see whether the bug still occurs there.
- **Mirror**: n/a
- **Validate**: Observed toast "Switched to the standard timeline: some annotations have non-hierarchical labels." If it does NOT occur with a prefixed first label, the root cause is confirmed. If it still occurs, stop and re-diagnose before coding.

### Task 2: Add `getDefaultActionLabel`
- **Action**: Implement the pure helper in `hierarchyLevels.js`, using `matchHierarchyLevel`. Handle an empty list safely (return `undefined`; the add path already assumes at least one label).
- **Mirror**: `hasUnmatchedActionAnnotations` (JSDoc, named export).
- **Validate**: Quick node check of the module (see Validation) for: prefixed label not first, no prefixed label, empty list.

### Task 3: Use it in `handleAdd`
- **Action**: Resolve the default label once, then build the annotation from it. `handleAddAdvance` needs no change.
- **Mirror**: Existing `handleAdd` structure.
- **Validate**: In the browser, click "add" and press `+`; the hierarchical timeline stays active, no toast, and the view is unchanged. Repeat with "add & advance".

### Task 4: Regression check on the safety net
- **Action**: Load or import annotations containing an unprefixed label and confirm the existing warning and switch-to-standard behavior still works.
- **Validate**: Toast appears; standard timeline shown.

## Validation
```bash
# build passes
npm run build

# pure-helper check (no test framework in the repo)
node --input-type=module -e "
import { getDefaultActionLabel } from './src/libs/hierarchyLevels.js'
const a = getDefaultActionLabel([{id:1,name:'misc'},{id:2,name:'EP: x'}])
const b = getDefaultActionLabel([{id:1,name:'misc'}])
console.log(a.id === 2, b.id === 1, getDefaultActionLabel([]) === undefined)
"

# manual: npm run dev, then Task 1/3/4 flows in the browser
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Root cause differs from the diagnosis (for example, the switch also fires for another reason) | Low | Task 1 reproduces before any code change |
| Silently picking a different default label surprises annotators who expected `actionLabelData[0]` | Medium | Only applies when the first label is unprefixed; confirm the intended default with the user (decision below) |
| No automated tests, so the fix is verified manually only | Medium | Node check of the pure helper plus a documented manual flow; adding a test framework is a separate decision |
| The filter chips in `ActionTable` hide annotations whose label is deselected, so a new annotation might be invisible in the table | Low | Not part of this bug; note if observed during Task 3 |

## Acceptance
- [ ] Adding via button, `+`, and "add & advance" never changes the active timeline or the current view
- [ ] No timeline-switch toast appears when adding with the ENT config
- [ ] Loading data with unprefixed labels still triggers the existing warning and fallback
- [ ] `npm run build` passes
- [ ] Patterns mirrored, not reinvented

---
*Milestones 2 (sorting) and 3 (add dialog) get their own plans. Milestone 3 will naturally supersede the default-label choice, because the user picks the label.*
