# Plan: Streamline Annotation UI to Temporal-Segment-Only

**Source PRD**: `.claude/prds/streamline-annotation-ui-temporal-only.prd.md`
**Selected Milestone**: 1 — Streamline main annotation UI to temporal-segment-only
**Complexity**: Small

## Summary
Hide the Objects, Regions, and Skeletons toggles/settings/tables, the copy/replace/fill buttons, the Mode selector, and the Grayscale option from the default annotation UI, so annotators only see temporal-segment (Action) controls. This is done entirely by flipping three default preference values and deleting a handful of UI blocks — no changes to the annotation store's data schema, file format, or load/parse logic, so existing annotation files (including ones with empty or populated Object/Skeleton/Region data) keep loading exactly as before.

**Scope-resolution note (please confirm):** The original request named only Objects and Skeletons for toggle removal, but the agreed success criterion ("the annotation UI only shows temporal-segment controls and overviews... in the annotations view and in the preference view") and the separate "Regions view" removal ask both imply Regions should be hidden too, in both views, not just the main view. This plan removes Objects, Regions, and Skeletons UI uniformly. Actions and Hierarchical Timeline (the temporal-segment controls) are left exactly as they are today — those are the surviving "standard" controls, not touched.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Conditional hide-by-mode | `src/pages/annotation/ControlPanel.vue:3`, `:131` | `v-if="annotationStore.mode !== 'action'"` already gates the Copy/Replace/Fill block and the Operation/bulk-clear block — reuse this exact condition for the one remaining ungated block (the Mode selector) instead of inventing a new flag |
| Preference toggle removal | `src/pages/preference/Preference.vue` (Actions / Hierarchical Timeline rows, left untouched) | Each preference is a self-contained `q-item`/`q-toggle` block bound to one `storeToRefs` ref — deletion is a clean block removal, no shared state to untangle |

No existing test suite covers these components (none found under a `tests/`/`__tests__` path for `.vue` files in this repo), so validation here is manual + build-check, matching how prior UI changes in this session were verified.

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/store/preference.js` | UPDATE | Flip `objects`, `regions`, `skeletons` defaults from `true` to `false` in `DEFAULT_PREFERENCE`. This is what makes `annotationStore`'s existing mode-resolution watcher (`src/store/annotation.js:135-151`) settle on `'action'` by default — the root cause of everything else becoming hidden. Keys are kept (not deleted) to preserve the existing `?showObjects=`/`?showRegions=`/`?showSkeletons=` URL-embed API in `src/App.vue` and the `reset()`/"restore" button already in Preferences. |
| `src/pages/preference/Preference.vue` | UPDATE | Delete the Objects, Regions, Skeletons, and Grayscale `q-item` rows; trim the now-unused refs from the `storeToRefs(preferenceStore)` destructure. |
| `src/pages/annotation/ControlPanel.vue` | UPDATE | Add the existing `v-if="annotationStore.mode !== 'action'"` guard to the Mode-selector `<div>` (currently the only ungated block in the file); remove the Grayscale `q-toggle` line from the Options section. |

## Tasks

### Task 1: Default Objects/Regions/Skeletons off
- **Action**: In `src/store/preference.js`, change `objects: true` → `objects: false`, `regions: true` → `regions: false`, `skeletons: true` → `skeletons: false`. Leave every other key (`actions`, `hierarchicalTimeline`, `grayscale`, `muted`, `showPopup`, etc.) unchanged.
- **Mirror**: n/a — value-only change, schema untouched.
- **Validate**: With a clean `localStorage` (or after clicking "restore" in Preferences), confirm the app's annotation mode resolves to `'action'` on load.

### Task 2: Remove Objects/Regions/Skeletons/Grayscale from the Preferences view
- **Action**: In `src/pages/preference/Preference.vue`, delete the four `q-item` blocks for "Objects" (~lines 125-148), "Regions" (~149-172), "Skeletons" (~173-196), and "Grayscale video" (~270-293). Remove `objects, regions, skeletons, grayscale` from the `storeToRefs(preferenceStore)` destructure in `<script setup>`.
- **Mirror**: Leave the structurally-identical "Actions / Video segments" and "Hierarchical Timeline" `q-item` blocks exactly as they are — same component shape, just not touched.
- **Validate**: Open the Preferences page; only Sensitivity, Default FPS, Default FPK, Video Decoder, Actions/Video segments, Hierarchical Timeline, Mute video, and Show Popup remain.

### Task 3: Remove copy/replace/fill, the Mode selector, and Grayscale from the main annotation view
- **Action**:
  1. In `src/pages/annotation/ControlPanel.vue`, add `v-if="annotationStore.mode !== 'action'"` to the `<div>` that wraps the Mode select, the skeleton-type select, and the mobile mode toggles (the one currently starting right after the Copy/Replace/Fill block, before this change the only ungated block in the file).
  2. Remove the `<q-toggle v-model="preferenceStore.grayscale" label="Grayscale" />` line from the Options section.
  3. Leave the handler functions/computeds (`handleCopyLeft`/`handleCopyRight`, `handleReplaceLeft`/`handleReplaceRight`, `handleInterpolate`, `modeOptions`, `skeletonTypeOptions`, the mobile mode-toggle computeds, `handleBulkClear`) in place, unreferenced-but-intact — they only ever execute when `mode !== 'action'`, which no longer happens by default, but still would if someone re-enables Objects/Regions/Skeletons via the existing preference fields or the URL-embed API.
- **Mirror**: `v-if="annotationStore.mode !== 'action'"` from `src/pages/annotation/ControlPanel.vue:3`.
- **Validate**: With default preferences, open the Annotation view; confirm Copy/Replace/Fill, the Mode selector, and Grayscale are all gone, leaving only Muted under Options (Show Popup was already hidden in action mode before this change, unaffected).

## Validation
```bash
cd /home/renzkiefel/projects/repos/vidat
npm run build
```
Manual:
1. Clear `localStorage` (or click "restore" in Preferences) and load a video — confirm the Annotation view shows only the temporal-segment (Action) timeline/table, with no Copy/Replace/Fill, Mode selector, Object/Region/Skeleton tables, or Grayscale toggle.
2. Load a pre-existing annotation JSON file with populated (and, separately, empty) `objectAnnotationListMap`/`regionAnnotationListMap`/`skeletonAnnotationListMap` — confirm it loads with the existing "Annotation load successfully!" notice and no errors.

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Annotators' browsers already have `objects`/`regions`/`skeletons` = `true` in `localStorage` from before this change, so the streamlined UI won't appear until they act | Medium | Tell the annotation team to click "restore" in Preferences once before the upcoming annotation block (existing button, no new code) |
| Someone external still relies on the `?mode=object` / `?showObjects=true` URL-embed API and expects it to keep working | Low | Confirmed unaffected — this plan does not touch `src/App.vue`'s query-param handling or the underlying preference fields, only their default value and their own-page toggle UI |

## Acceptance
- [x] Preferences view shows no Objects/Regions/Skeletons/Grayscale controls — verified via browser snapshot at `/#/preference`, no console errors
- [x] Annotation view shows no Copy/Replace/Fill buttons, Mode selector, or Object/Region/Skeleton tables by default — verified via browser screenshot with the demo video+annotation loaded; Options now shows only "Muted"
- [x] A legacy annotation file with Object/Skeleton/Region data (including empty maps) loads without error — verified with `public/annotation/example.json` (37 object annotations, 1 region annotation, 0 skeleton annotations across 90 frames): "Annotation load successfully!" notice, no console errors
- [x] `npm run build` passes
