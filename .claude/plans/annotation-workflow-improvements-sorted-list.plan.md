# Plan: Start-Time Sorted Action List

**Source PRD**: `.claude/prds/annotation-workflow-improvements.prd.md`
**Selected Milestone**: 2 — Start-time sorted list
**Complexity**: Medium

## Summary
The "Actions / Video Segments" table (`ActionTable.vue`) renders `annotationStore.actionAnnotationList` in insertion order. Replace that with a derived, sorted view: ascending start time; ties broken by hierarchy level (P, EP, SC, S, T, ST, then instrument), and for non-hierarchy annotations the longer one first. The sort is computed from the store list without mutating it, so the saved/exported order is unchanged. Because `start`/`end` inputs are debounced (1500 ms) and commit on completion, the derived view naturally resorts only after an edit completes; a brief highlight on the moved row makes the reorder visible.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Pure helpers / naming | `src/libs/hierarchyLevels.js:21-50` | Small JSDoc-typed pure functions, named exports, labels resolved by `actionLabelData.find(l => l.id === action.action)`; level order from `HIERARCHY_LEVELS` array index. |
| Non-mutating sort | `src/pages/annotation/components/HierarchicalActionIndicator.vue:63`, `ActionIndicator.vue:58` | `[...list].sort((a, b) => a.start - b.start)` — copy, then sort by start. |
| Table + row highlight | `src/pages/annotation/ActionTable.vue:80-85` | `q-tr :class` with `bg-green-2` / `bg-green-8` (dark mode via `q.dark.isActive`) keyed on row identity (`props.row === annotationStore.currentThumbnailAction`). Reuse for the moved-row highlight. |
| Sorted order shared with the thumbnail preview | `ActionTable.vue` `// sort` block, `src/components/ActionThumbnailPreview.vue:120-128` | `annotationStore.currentSortedActionList` holds the displayed order for prev/next. Must stay equal to the displayed order. |
| User feedback / timers | `src/libs/utils.js` (`utils.notify`) | Feedback through utils helpers; no `console`. |
| Tests | None | No test framework in the repo (scripts: `dev`, `build`, `preview`). Validate via a node check of the pure sorter plus a manual browser flow. |

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/libs/actionSort.js` | CREATE | Pure `sortActionAnnotations(list, actionLabelData)` returning a new array: start asc; tie → hierarchy rank (matched before unmatched); both unmatched → longer duration first; else stable. Keeps `hierarchyLevels.js` focused on level definitions. |
| `src/pages/annotation/ActionTable.vue` | UPDATE | Feed `q-table` the sorted computed instead of the raw list; keep `currentSortedActionList` in sync with the displayed order (default order and header-sort order); replace `row-key="start"` with a unique per-row key; add moved-row highlight after an edit-triggered reorder. |

## Tasks
### Task 1: Pure sorter
- **Action**: Implement `sortActionAnnotations`. Rank = index in `HIERARCHY_LEVELS` of the matched level, via `matchHierarchyLevel(label.name)`; unmatched/unknown label ids rank after all hierarchy levels. Never mutate inputs.
- **Mirror**: `hasUnmatchedActionAnnotations` (lookup + JSDoc); `[...list].sort` pattern.
- **Validate**: Node check covering: start ordering; same start, hierarchy order (EP before T); same start, both unmatched, longer first; same start, hierarchy before unmatched; full tie keeps input order; input array unchanged.

### Task 2: Use the sorted view in the table
- **Action**: In `ActionTable.vue`, add a computed sorted list from the store list and `configurationStore.actionLabelData`, and pass it as `:rows`. Header-sorting still works on top of it via the existing `actionSort`.
- **Mirror**: Existing `:rows`/`:sort-method` wiring.
- **Validate**: Add several annotations out of time order; table shows them by start time; `handleDelete` and `handleClearAll` still remove the right rows (they work on the store list by object identity).

### Task 3: Keep `currentSortedActionList` correct
- **Action**: Update `currentSortedActionList` whenever the displayed default order changes (replacing the one-time assignment of the raw list reference at setup, which goes stale after "clear all" replaces the array). `actionSort` keeps setting it for header sorts.
- **Validate**: Open a thumbnail preview; prev/next walks annotations in the displayed order, before and after adding or editing annotations.

### Task 4: Unique row keys
- **Action**: Replace `row-key="start"` with a function key giving each annotation object a stable unique id (WeakMap-based, no change to the annotation data model or saved JSON). Same-start rows are now routine (ENT hierarchy), and duplicate keys can cause stale or mis-rendered rows when rows move.
- **Mirror**: n/a (Quasar `row-key` accepts a function).
- **Validate**: Create annotations with identical start times; edit one; the others render correctly.

### Task 5: Visible reorder after an edit
- **Action**: When an edit changes a row's position in the sorted view, highlight that row briefly, using the existing green row-highlight classes and a short timeout that clears it. No highlight on add/delete/load, only when an existing row moved. Keep the highlight independent of the thumbnail-selection highlight.
- **Mirror**: `bg-green-2` / `bg-green-8` dark-aware class pattern.
- **Validate**: Edit a start time past another row; after the debounce/blur the row moves and flashes; no movement while typing.

### Task 6: Regression checks
- **Action**: Confirm saving then reloading annotations preserves the stored order (sort is view-only), that header sorting on start/end still works, and that the filter chips still filter the sorted rows.
- **Validate**: Manual flow.

## Validation
```bash
npm run build

# pure-sorter check (no test framework in the repo)
node --input-type=module -e "
import { sortActionAnnotations } from './src/libs/actionSort.js'
// cases from Task 1 here
"

# manual: npm run dev with public/config/ci.json, then Tasks 2-6 in the browser
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Resort while the annotator edits moves the row they are working on | Medium | Debounced number inputs commit on completion/blur; highlight keeps the row findable. Verify that blur flushes the debounce (Task 5). |
| Changing `:rows` to a computed breaks mutations that relied on row identity | Low | Sorted rows are the same objects, not copies; `handleDelete`/`handleSet` use identity. |
| Duplicate `row-key` produces render glitches once ties are common | Medium | Task 4 |
| `currentSortedActionList` drifts from displayed order, so thumbnail prev/next jumps | Medium | Task 3 |
| Unspecified ordering: hierarchy vs unprefixed annotations at the same start; instrument row rank | Low | Plan defaults: hierarchy before unprefixed; instrument last in the hierarchy. Confirm with the user. |
| No automated tests | Medium | Node check of the sorter plus the manual flow |

## Acceptance
- [ ] List is ordered by start time ascending, with the specified tie-breaks
- [ ] Reorder after an edit happens on completion, not while typing, and is visibly indicated
- [ ] Stored/exported annotation order is unchanged
- [ ] Thumbnail prev/next follows the displayed order
- [ ] `npm run build` passes
- [ ] Patterns mirrored, not reinvented

---
*Milestone 3 (add dialog) gets its own plan.*
