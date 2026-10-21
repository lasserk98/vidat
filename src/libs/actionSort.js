import { HIERARCHY_LEVELS, matchHierarchyLevel } from './hierarchyLevels.js'

const UNMATCHED_RANK = HIERARCHY_LEVELS.length
// Rows with a cleared / non-numeric start sort last instead of jumping to the top mid-edit.
const INVALID_START = Number.MAX_SAFE_INTEGER

const isNumber = (value) => typeof value === 'number' && !Number.isNaN(value)
const startOf = (action) => (isNumber(action.start) ? action.start : INVALID_START)
const durationOf = (action) => (isNumber(action.start) && isNumber(action.end) ? action.end - action.start : 0)

/**
 * @param {{action: number}} action
 * @param {Map<number, {name: string}>} labelById
 * @returns {number} index in HIERARCHY_LEVELS (P first), or UNMATCHED_RANK for non-hierarchy labels
 */
function hierarchyRank(action, labelById) {
  const label = labelById.get(action.action)
  const level = label ? matchHierarchyLevel(label.name) : null
  return level ? HIERARCHY_LEVELS.findIndex((candidate) => candidate.key === level.key) : UNMATCHED_RANK
}

/**
 * Orders action annotations by start time. Ties: higher hierarchy level first, hierarchy labels before
 * non-hierarchy ones, then the longer non-hierarchy annotation first. Remaining ties keep input order.
 * @param {{start: number, end: number, action: number}[]} actionAnnotationList not mutated
 * @param {{id: number, name: string}[]} actionLabelData
 * @returns {{start: number, end: number, action: number}[]} new sorted array of the same objects
 */
function sortActionAnnotations(actionAnnotationList, actionLabelData) {
  const labelById = new Map(actionLabelData.map((label) => [label.id, label]))
  const rankByAction = new Map(actionAnnotationList.map((action) => [action, hierarchyRank(action, labelById)]))
  return [...actionAnnotationList].sort((a, b) => {
    if (startOf(a) !== startOf(b)) {
      return startOf(a) - startOf(b)
    }
    const rankA = rankByAction.get(a)
    const rankB = rankByAction.get(b)
    if (rankA !== rankB) {
      return rankA - rankB
    }
    return rankA === UNMATCHED_RANK ? durationOf(b) - durationOf(a) : 0
  })
}

export { sortActionAnnotations }
