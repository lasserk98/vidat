# Plan: Hierarchical Timeline Indicators

**Source PRD**: `.claude/prds/hierarchical-timeline-indicators.prd.md`
**Selected Milestone**: 1 — Microsurgery hierarchical view
**Complexity**: Medium

## Summary
Replace the single flat 8px action-annotation timeline strip with a static, 7-row "Microsurgery" layout (EP, SC, S, T, ST, Instrument 1, Instrument 2). Row placement is derived from the action label's name prefix (`EP:`/`SC:`/`S:`/`T:`/`ST:`/`I:`); the two instrument rows use a simple 2-lane packing algorithm since two instruments can be in use simultaneously. A persisted preference flag toggles between this new view and the existing legacy single-row view (legacy stays untouched). If any action annotation's label doesn't match a recognized prefix, the hierarchical view refuses to activate (or auto-reverts if already active) and shows a warning — it never hides or deletes those annotations silently, since that risked stray/miscategorized labels going unnoticed.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Persisted boolean preference flag | `src/store/preference.js:7-20` (`DEFAULT_PREFERENCE`, e.g. `actions: true`) | New flags are added as plain boolean fields on `DEFAULT_PREFERENCE`; the store's existing `watch(state, ...)` (line 33) auto-persists the whole object to `localStorage` — no new persistence code needed. |
| Preference toggle UI | `src/pages/preference/Preference.vue:197-220` (`actions` toggle, "Actions / Video segments") | Each flag gets a `q-item`/`q-toggle` block with a tooltip, and its ref added to the `storeToRefs(preferenceStore)` destructure (lines 297-316). Copy this block for the new flag. |
| Quick toolbar toggle button | `src/pages/annotation/KeyframePanel.vue:24-31` (`showEdit` button: `:icon="showEdit ? 'done' : 'edit'"`, `@click="showEdit = !showEdit"`) | Same icon-swap button pattern, but bound to the persisted `preferenceStore` flag instead of a local `ref`. |
| Label id → label object lookup | `src/pages/annotation/components/ActionIndicator.vue:56` and `src/pages/annotation/ActionTable.vue` (`configurationStore.actionLabelData.find(label => label.id === action.action)`) | `ActionAnnotation.action` (`src/libs/annotationlib.js:743-761`) stores the numeric label id only, never a name — always resolve through `actionLabelData` to get `.name` for prefix parsing. |
| Time → position mapping | `src/pages/annotation/components/ActionIndicator.vue:34-50` (`actionIndicatorList` computed, `utils.time2index`, left/right percent math) | Reuse the same left/right percentage formula per row instead of reinventing positioning math. |
| Indicator visual style | `src/pages/annotation/components/ActionIndicator.vue:64-81` (`.action-indicator` / `.action` CSS: absolute-positioned colored blocks, hover `scaleY(1.5)`) | Repeat this block per row rather than introducing a new visual language. |

No existing grouping/lane-packing code exists anywhere in the codebase (confirmed: `ActionTable.vue` only does flat id-based filtering/sorting, no grouping). The instrument 2-lane packing logic is new and has no prior pattern to mirror.

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/libs/hierarchyLevels.js` | CREATE | Single source of truth for the 6 recognized prefixes (`EP:`, `SC:`, `S:`, `T:`, `ST:`, `I:`) and their row metadata (key, display label, order), so the component and any future consumer don't duplicate magic strings. |
| `src/store/preference.js` | UPDATE | Add `hierarchicalTimeline: true` to `DEFAULT_PREFERENCE` — the new view is the default per PRD scope. |
| `src/pages/preference/Preference.vue` | UPDATE | Add a `q-toggle` block ("Hierarchical Timeline") mirroring the `actions` toggle, and add `hierarchicalTimeline` to the `storeToRefs` destructure, so the setting is discoverable in the standard preferences page. |
| `src/pages/annotation/components/HierarchicalActionIndicator.vue` | CREATE | New component rendering the static 7-row layout: buckets `annotationStore.actionAnnotationList` by label prefix (via `hierarchyLevels.js`), runs 2-lane packing for `I:`-prefixed annotations, renders each row with the existing position/style pattern plus a row label. Assumes (by contract with `KeyframePanel.vue`) that it is only ever mounted when no unmatched-prefix annotations exist; still defensively skips any it encounters rather than crashing. |
| `src/pages/annotation/KeyframePanel.vue` | UPDATE | Conditionally render `<ActionIndicator>` or `<HierarchicalActionIndicator>` based on `preferenceStore.hierarchicalTimeline`, gated by the existing `preferenceStore.actions` master switch; add the quick toolbar toggle button; own the unmatched-label regression policy (computed `hasUnmatchedHierarchyLabels` + a `watch` that flips `hierarchicalTimeline` back to `false` and warns via `utils.notify` whenever it's true while unmatched labels exist). |

`src/pages/annotation/components/ActionIndicator.vue` (legacy) is **not modified** — it stays exactly as-is for the standard view, per PRD out-of-scope.

## Tasks

### Task 1: Hierarchy prefix constants
- **Action**: Create `src/libs/hierarchyLevels.js` exporting an ordered array, e.g. `[{ key: 'ep', label: 'EP', prefix: 'EP:' }, ..., { key: 'instrument', label: 'Instrument', prefix: 'I:' }]` covering EP/SC/S/T/ST/Instrument, plus a small helper `matchHierarchyLevel(labelName)` that returns the matching entry or `null`.
- **Mirror**: Plain exported const/function module, same style as `src/libs/utils.js`.
- **Validate**: Manual review; no runtime effect until consumed by Task 3.

### Task 2: Persisted view-toggle preference
- **Action**: Add `hierarchicalTimeline: true` to `DEFAULT_PREFERENCE` in `src/store/preference.js`. Add the matching `q-item`/`q-toggle` block to `src/pages/preference/Preference.vue` (copy the `actions` block, lines 197-220) and add `hierarchicalTimeline` to its `storeToRefs` destructure.
- **Mirror**: `actions` flag end-to-end (store field → toggle UI).
- **Validate**: `npm run dev` → open Preferences page → toggle appears, persists across reload (check `localStorage.preferenceData`).

### Task 3: `HierarchicalActionIndicator.vue` component
- **Action**:
  - Computed `rows`: for each of the 5 hierarchy levels (EP/SC/S/T/ST), filter `annotationStore.actionAnnotationList` to annotations whose label (looked up via `configurationStore.actionLabelData`) matches that level's prefix, mapped to left/right percentages exactly like `ActionIndicator.vue`'s existing computed.
  - Computed instrument lanes: filter all `I:`-prefixed annotations, sort by `start`, greedily assign each to the first of the 2 lanes whose previous occupant's `end` is before this annotation's `start` (else the other lane) — a minimal 2-lane interval-packing pass. Annotations beyond what 2 lanes can hold render into lane 2 anyway (accepted overflow for this milestone; 3+ simultaneous instruments is explicitly Milestone 2 / endoscopic mode).
  - Annotations that don't match any of the 6 prefixes are skipped in the bucketing loop (defensive only — see below, this should never actually occur given the `KeyframePanel.vue` gate).
  - Template: 7 stacked row `div`s (reusing the `.action-indicator`/`.action` CSS pattern from `ActionIndicator.vue`), each with a small row-label (e.g. "EP", "SC", …, "I") and the same `handleClick` seek-to-annotation behavior as the legacy component.
  - No warning/notification logic lives in this component — that policy decision belongs to `KeyframePanel.vue` (see Task 4), which decides whether this component is even mounted.
- **Mirror**: `ActionIndicator.vue` in full (computed shape, `handleClick`, CSS) — this component is a structural sibling, not a rewrite from scratch.
- **Validate**: `npm run dev` → import the sample annotation JSON from the PRD (the stapedotomy example with EP/SC/S/T labels) → confirm 7 rows always render, each annotation lands in the row matching its prefix, and instrument overlaps (if added) split across the 2 instrument rows.

### Task 4: Wire into `KeyframePanel.vue`
- **Action**: Import `HierarchicalActionIndicator`. Replace the single `<ActionIndicator v-if="preferenceStore.actions" .../>` with a conditional: hierarchical component when `preferenceStore.actions && preferenceStore.hierarchicalTimeline`, legacy component when `preferenceStore.actions && !preferenceStore.hierarchicalTimeline`. Add a toolbar `q-btn` (mirroring the `showEdit` icon-toggle button) to flip `preferenceStore.hierarchicalTimeline`.
- **Mirror**: `showEdit` button (lines 24-31) for the icon-toggle interaction.
- **Validate**: `npm run dev` → toggle button and Preferences-page toggle both switch the view and stay in sync (same underlying store field); reload persists the last choice.

### Task 5: Manual verification against PRD success metrics
- **Action**: Using the sample project JSON from the PRD (stapedotomy video with EP/SC/S/T action annotations), manually verify: (a) all 7 rows render and stay static regardless of annotation count, (b) every annotation appears in the row matching its label prefix, (c) editing an annotation's label to a different hierarchy level moves it to the new row immediately, (d) deleting an annotation removes it from its row, (e) toggling to legacy view shows the old single-strip behavior unchanged, (f) an unmatched-label annotation (e.g. a plain "pick up" label) triggers the one-time warning and is absent from the hierarchical rows.
- **Mirror**: N/A — manual QA pass, matching the PRD's own "How measured" column (all three metrics are manual-QA based; no automated test suite exists in this project — `package.json` defines only `dev`/`build`/`preview` scripts, no `test` or `lint` script).
- **Validate**: See steps above; also run `npm run build` to confirm no build-breaking errors.

## Validation
```bash
npm run dev     # manual QA per Task 5 checklist
npm run build   # confirm production build succeeds (no test/lint scripts exist in this project)
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Instrument 2-lane packing algorithm has no existing pattern to mirror — risk of subtly wrong overlap assignment | Medium | Keep the algorithm minimal (greedy, sorted by start) and cover it explicitly in Task 5's manual verification with an overlapping-instrument test case |
| Warning-on-activation logic (Task 3) could become noisy if triggered on every annotation edit instead of only on view activation | Low | Explicitly scope the `Notify` call to the `watch` on `preferenceStore.hierarchicalTimeline` and `onMounted`, not to `actionAnnotationList` changes |
| Two toggle entry points (Preferences page + toolbar button) drift out of sync | Low | Both bind directly to the same `preferenceStore.hierarchicalTimeline` ref — no separate local state to desync |

## Acceptance
- [ ] All 5 tasks complete
- [ ] `npm run build` passes
- [ ] Manual QA checklist (Task 5) passes against the PRD's sample stapedotomy annotation data
- [ ] Legacy `ActionIndicator.vue` and legacy view behavior are unchanged
- [ ] Patterns mirrored (preference flag, toggle UI, label lookup, position math, indicator styling), not reinvented
