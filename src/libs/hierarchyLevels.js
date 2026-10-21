/**
 * Hierarchy levels for the Microsurgery timeline view.
 * Each action label's row is determined by matching its name against these prefixes, in order.
 * `optional` levels get no timeline row until at least one annotation uses them.
 * The prefixes mirror LEVELS in ENT-Phase-Framework's hierarchy.py (plus the vidat-only instrument row).
 */
const HIERARCHY_LEVELS = [
  { key: 'p', label: 'P', prefix: 'P:', optional: true },
  { key: 'ep', label: 'EP', prefix: 'EP:' },
  { key: 'sc', label: 'SC', prefix: 'SC:' },
  { key: 's', label: 'S', prefix: 'S:' },
  { key: 't', label: 'T', prefix: 'T:' },
  { key: 'st', label: 'ST', prefix: 'ST:' },
  { key: 'instrument', label: 'I', prefix: 'I:' }
]

/**
 * @param {string} labelName
 * @returns {{key: string, label: string, prefix: string} | null}
 */
function matchHierarchyLevel(labelName) {
  if (typeof labelName !== 'string') {
    return null
  }
  return HIERARCHY_LEVELS.find((level) => labelName.startsWith(level.prefix)) || null
}

/**
 * @param {{action: number}[]} actionAnnotationList
 * @param {{id: number, name: string}[]} actionLabelData
 * @returns {boolean} true if any annotation's label doesn't match a recognized hierarchy prefix
 */
function hasUnmatchedActionAnnotations(actionAnnotationList, actionLabelData) {
  return actionAnnotationList.some((action) => {
    const label = actionLabelData.find((candidate) => candidate.id === action.action)
    return !matchHierarchyLevel(label ? label.name : null)
  })
}

/**
 * Label a new annotation starts with. Prefers a hierarchy-matching label so adding an annotation
 * doesn't trip the unmatched-label fallback to the standard timeline.
 * @param {{id: number, name: string}[]} actionLabelData
 * @returns {{id: number, name: string} | undefined} first hierarchy-matching label, else the first label
 */
function getDefaultActionLabel(actionLabelData) {
  return actionLabelData.find((label) => matchHierarchyLevel(label.name)) || actionLabelData[0]
}

export { HIERARCHY_LEVELS, matchHierarchyLevel, hasUnmatchedActionAnnotations, getDefaultActionLabel }
