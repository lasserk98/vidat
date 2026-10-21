# Streamline Annotation UI to Temporal-Segment-Only

## Problem
The Vidat annotation UI currently exposes toggles/settings for Objects and Skeletons annotation types, copy/replace/fill buttons, a grayscale option, and a Regions view in the main annotation view. None of these are needed for the upcoming annotation work, which will only use temporal segment (action) annotations. This clutters the UI and creates a risk of accidentally changing settings that shouldn't be touched during a large annotation effort.

## Evidence
- Direct observed usage by the user and others: the current UI is cluttered with elements/settings that aren't needed and shouldn't be changed for this kind of work.

## Users
- **Primary**: Annotators (including the requester) performing an upcoming large block of temporal-segment (action) annotation work.
- **Not for**: Users doing Object, Skeleton, or Region annotation work — that functionality is not needed for this version and is out of active use, not deleted from the data model.

## Hypothesis
We believe **removing the Objects/Skeletons toggles and settings, the copy/replace/fill buttons, the grayscale option, and the Regions view from the main annotation UI** will **reduce UI clutter and prevent accidental changes to unrelated settings** for **annotators doing the upcoming large temporal-segment annotation block**.
We'll know we're right when **the annotation UI (both the Annotations view and the Preferences view) shows only temporal-segment controls and overviews, with no Object/Skeleton/Region-related elements visible anywhere**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Visible Object/Skeleton/Region-related UI elements in Annotations view | 0 | Manual review of the main annotation view |
| Visible Object/Skeleton-related toggles/settings in Preferences view | 0 | Manual review of the preferences/settings panel |
| Legacy annotation files with Object/Skeleton/Region data (including empty) load without error | 100% | Load an existing annotation file through the app and confirm no load errors |

## Scope
**MVP**
- Remove the Objects toggle and its settings from the UI.
- Remove the Skeletons toggle and its settings from the UI.
- Remaining annotation types (temporal segments/actions) are always enabled/visible — treated as standard, not user-togglable.
- Remove the copy, replace, and fill buttons from the main annotation view.
- Remove the grayscale option.
- Remove the Regions view from the main annotation view.
- This is a UI-visibility change only: existing annotation files that contain Object, Skeleton, or Region data (including files where those are empty/zero) must continue to load safely with no errors or data loss. No changes to the annotation data schema, file format, or parsing/loading logic.

**Out of scope**
- Nothing explicitly excluded beyond the MVP list above — no additional requirements were raised.

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Streamline main annotation UI to temporal-segment-only | Annotators see only temporal-segment controls in the Annotations view and Preferences view; Objects/Skeletons toggles, copy/replace/fill buttons, grayscale option, and Regions view are no longer visible anywhere in the UI | complete | `.claude/plans/streamline-annotation-ui-temporal-only.plan.md` |

## Open Questions
- None at this time.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| UI removal accidentally touches annotation data parsing/loading code, breaking backward compatibility with existing files | Low | High | Scope the change strictly to UI-layer visibility (toggles, buttons, views); verify by loading a pre-existing annotation file with non-empty and empty Object/Skeleton/Region data after the change |
| Making temporal-segment annotation "standard" (always-on) changes default behavior in an unexpected way for annotators | Low | Medium | Confirm the resulting default behavior matches how temporal-segment annotation already worked prior to this change |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
