# Annotation Workflow Improvements

## Problem
Researchers annotating the ENT framework in Vidat lose focus on every annotation: adding one switches the view away from the hierarchical timeline (requiring an extra click to recover it), and the annotation list is ordered by creation, so they scroll back and forth to find or add entries. No workaround exists. With more annotation rounds ahead, this friction multiplies across every annotation.

## Evidence
- Annotator feedback from the first ENT annotation rounds, requesting workflow optimization (qualitative; no verbatim quotes or metrics recorded).
- Assumption — needs validation via the next annotator feedback round (and optionally a click count per annotation) for the size of the effect.

## Users
- **Primary**: Researchers annotating the ENT framework with the pre-configured `config.json` label classes; they annotate in long, focused sessions.
- **Not for**: Annotators using free-form labels outside the ENT `config.json` classes.

## Hypothesis
We believe **keeping the active timeline on add, auto-sorting the annotation list by start time, and a searchable "Add annotation" dialog** will **remove the per-annotation timeline-recovery click and list scrolling** for **researchers annotating the ENT framework**.
We'll know we're right when **annotators no longer need to re-select the timeline after adding an annotation, any label can be added without scrolling, and annotators confirm the improvement in the next feedback round**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Extra clicks to recover the timeline after adding an annotation | 0 (from 1) | Manual walkthrough of the add flow |
| Scrolling needed to add a label | None | Manual walkthrough with the full ENT config |
| Annotator satisfaction | Confirmed improvement | Next annotator feedback round (TBD — needs validation via feedback round; no numeric baseline exists) |

## Scope
**MVP**
1. **Bug fix**: Adding an annotation never changes the active timeline or the current view. The new annotation is not auto-selected or scrolled into view. (Exception: an annotation outside the ENT identifiers may switch timelines; not expected with `config.json` classes.)
2. **Auto-sort**: The annotation list is ordered by start time, ascending.
   - Ties on start time: the higher hierarchy object comes first.
   - Ties among non-hierarchy annotations: the longer annotation comes first.
   - Full ties: order is unspecified.
   - Editing an annotation resorts the list only after the edit is completed, and the reorder is made visible to the user.
3. **Add-annotation dialog**: The "New annotation" button and the existing `+` shortcut open a pop-up with a filterable dropdown of the configured labels, shown in the ENT hierarchy. Selecting a label creates the annotation at the current start time (as today).
4. **Should-have**: Rapid multi-add — the dialog can stay open to add several annotations in a row.

**Out of scope**
- Sort options other than start time (by label, end time, or a user toggle) — not requested.
- Annotations outside the `config.json` classes — not expected in current use.
- Changes to the ENT config, hierarchy, or label editing — separate concern.
- Changing the `+` shortcut or its behavior — explicitly to be left as is.

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Stable timeline on add | Adding an annotation keeps the current timeline and view; no recovery click | complete | `.claude/plans/annotation-workflow-improvements.plan.md` |
| 2 | Start-time sorted list | List is ordered by start time with hierarchy and duration tie-breaks; reorders after edit completion with a visible change | complete | `.claude/plans/annotation-workflow-improvements-sorted-list.plan.md` |
| 3 | Add-annotation dialog | Button or `+` opens a filterable, hierarchy-aware label picker that adds the annotation, with optional rapid multi-add | complete | `.claude/plans/annotation-workflow-improvements-add-dialog.plan.md` |

## Open Questions
- [ ] Shortcut scope: `+` is the current shortcut and must keep working. Verify how it is scoped in the settings today, and whether the dialog must coexist with that scope.
- [ ] Filtering: does typing match the label name only, or the parent hierarchy names as well? (Not yet decided.)
- [ ] "Visible" resort: what form should the visible reorder take after an edit (for example, a brief highlight or animation)? Not specified.
- [ ] Rapid multi-add: confirm whether it is MVP or a follow-up if it adds significant scope.
- [ ] Layout-dependent keys: does `+` need Shift on some keyboard layouts, and is the numpad `+` already handled? (Existing behavior is to be preserved either way.)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Resort after editing moves the item the user is working on, causing disorientation | Medium | Medium | Resort only after edit completion, with a visible cue (per requirement) |
| The new dialog conflicts with the existing `+` shortcut scope or other bindings | Low | Medium | Verify the current scope during planning; do not change the shortcut |
| Annotations created outside the ENT identifiers still trigger a timeline switch | Low | Low | Documented exception; classes come from `config.json` |
| No baseline metrics, so the improvement can't be measured numerically | High | Low | Click-count walkthrough plus the next feedback round |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
