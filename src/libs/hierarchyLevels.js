/**
 * Hierarchy levels for the Microsurgery timeline view.
 * Each action label's row is determined by matching its name against these prefixes, in order.
 */
const HIERARCHY_LEVELS = [
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

export { HIERARCHY_LEVELS, matchHierarchyLevel, hasUnmatchedActionAnnotations }
