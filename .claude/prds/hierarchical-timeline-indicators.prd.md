# Hierarchical Timeline Indicators

## Problem
Surgical video annotators use this vidat deployment to label microsurgery procedure videos against a 5-level clinical workflow hierarchy — Extended Phase (EP), Surgical Component (SC), Step (S), Task (T), Subtask (ST) — plus instrument-in-use tracking. Today `ActionIndicator.vue` renders every action annotation into a single flat 8px timeline row, positioned only by start/end time; annotations from different hierarchy levels and instruments visually overlap and swap paint order whenever labels are created, edited, reassigned, or deleted. As the team scales up to annotating many videos with this hierarchy, this makes it hard to tell at a glance which level or instrument an annotation belongs to.

(Note: the current indicator does not do any dynamic "fit as few rows as possible" packing — confirmed in code — it is a single always-one-row strip where overlapping annotations simply paint over each other in list order.)

## Evidence
- Observed directly by the requester and colleagues during hands-on use of vidat annotating microsurgery videos. No formal tickets/metrics collected yet.

## Users
- **Primary**: surgical video annotators using this hosted vidat deployment (annotating microsurgery, with endoscopic surgery as a likely future case).
- **Not for**: N/A — this deployment is single-purpose; all users of this instance are surgical annotators using the EP/SC/S/T/ST/I hierarchy.

## Hypothesis
We believe **splitting the timeline indicator into fixed, hierarchy-specific rows (EP, SC, S, T, ST, plus dedicated instrument rows) driven by a label-name prefix convention** will **eliminate cross-level visual jumbling and let annotators immediately identify which hierarchy level and instrument lane an annotation belongs to** for **surgical video annotators**.
We'll know we're right when all 7 rows (5 hierarchy levels + 2 instrument rows, the microsurgery default) are always visible and static, and every annotation is placed in — and automatically re-routed to — the correct row whenever it is created, edited, reassigned, or deleted, based on its label's prefix.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Row correctness | 100% of annotations render in the row matching their label's hierarchy prefix | Manual QA pass over sample annotated videos before/after |
| Row stability | The 7 rows are always rendered (never collapse/reflow) regardless of annotation count or content | Manual visual check across empty and dense timelines |
| Re-routing correctness | Reassigning an annotation's label to a different hierarchy level moves it to the correct row without manual refresh | Manual test: create, edit/reassign, delete an annotation per level |

## Scope
**MVP**
- Replace the single flat action-indicator strip with a fixed "Microsurgery" hierarchical layout: 7 static rows — EP, SC, S, T, ST, Instrument 1, Instrument 2 — always rendered, even when empty.
- Row placement is determined by parsing the action label's name prefix (`EP:`, `SC:`, `S:`, `T:`, `ST:`, `I:` for instruments).
- The 2 instrument rows accommodate up to 2 simultaneous instrument annotations (microsurgery is two-handed).
- Placement re-evaluates automatically whenever an annotation is created, edited (including label reassignment — the prefix is re-checked), or deleted.
- A toggle to switch between this new hierarchical (Microsurgery) view and the existing legacy single-row (standard) view, for backward compatibility with projects/labels that don't use the prefix convention.
- The new hierarchical Microsurgery view is the default going forward; legacy view remains available via the toggle.
- If any action annotation's label doesn't match a recognized hierarchy prefix, the hierarchical view refuses to activate (or automatically reverts to the standard view if already active) and shows a warning explaining why. Annotation data is never modified or deleted by this check — it only forces a view change so stray/miscategorized labels can't go unnoticed.

**Out of scope**
- Endoscopic surgery mode (3+ instrument rows for procedures with more simultaneous instruments) — noted as a desired future milestone, not built in this pass.
- Configurable/custom hierarchy levels beyond the fixed EP/SC/S/T/ST + instruments set.
- Auto-migrating existing action label names to add the prefix convention.
- Changes to the annotation list/table view (`ActionTable.vue`) or the label-editing UI (`ActionLabelTable.vue`).

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Microsurgery hierarchical view | Annotators see 7 static, correctly-labeled rows (EP/SC/S/T/ST + 2 instrument rows) instead of one jumbled strip, with a toggle back to the legacy view | in-progress | `.claude/plans/hierarchical-timeline-indicators.plan.md` |
| 2 | Endoscopic instrument mode | Annotators working on endoscopic videos can switch to a mode supporting 3+ simultaneous instrument rows | pending | — |

## Open Questions
- [x] What happens to action labels whose name doesn't match any of the 6 recognized prefixes when the hierarchical view is active? **Resolved**: the view regresses to standard (non-destructive) with a warning, rather than silently hiding those annotations — hiding was rejected because stray/miscategorized labels could go unnoticed indefinitely.
- [ ] For endoscopic mode (Milestone 2): is the instrument row count fixed (e.g. exactly 3) or dynamically sized to the max number of simultaneous instruments actually observed in the video?
- [ ] How are two simultaneous instrument annotations assigned to Instrument Row 1 vs Row 2 (first-come-first-served, or a consistent per-instrument-label assignment)? **Resolved for Milestone 1**: greedy, sorted by start time, reusing a lane once its prior occupant ends.
- [ ] Should the view toggle (hierarchical vs standard) persist per-project/session, or reset by default? **Resolved for Milestone 1**: persists via the existing preference-store mechanism (localStorage), same as other view toggles.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Existing non-prefixed action labels become invisible or miscategorized in hierarchical view | Medium | Medium | Resolved: hierarchical view regresses to standard with a warning instead of hiding annotations, so stray labels are always visible somewhere |
| Endoscopic mode gets pulled into scope mid-build, expanding Milestone 1 | Low-Medium | Medium | Explicitly deferred to Milestone 2; re-prioritize via a separate `/plan` pass only if needed |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
