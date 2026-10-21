import { HIERARCHY_LEVELS, matchHierarchyLevel } from './hierarchyLevels.js'

const OTHER_GROUP = { key: 'other', label: 'Other' }
const GROUPS = [...HIERARCHY_LEVELS.map(({ key, label }) => ({ key, label })), OTHER_GROUP]

/**
 * Dropdown options for picking an action label: filtered by the typed words and grouped by hierarchy level
 * (in HIERARCHY_LEVELS order, labels without a hierarchy prefix last under "Other"). Empty groups are dropped.
 * @param {{id: number, name: string, color: string}[]} actionLabelData not mutated
 * @param {string} query every whitespace-separated word must appear in the label name (case-insensitive)
 * @returns {({value: number, label: string, color: string} | {label: string, header: true, disable: true})[]}
 *   selectable options, each group preceded by a non-selectable header
 */
function buildActionLabelOptions(actionLabelData, query = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const optionsByGroup = new Map(GROUPS.map((group) => [group.key, []]))
  for (const label of actionLabelData) {
    const name = String(label.name ?? '')
    const lowerName = name.toLowerCase()
    if (words.every((word) => lowerName.includes(word))) {
      const level = matchHierarchyLevel(name)
      optionsByGroup.get(level ? level.key : OTHER_GROUP.key).push({ value: label.id, label: name, color: label.color })
    }
  }
  return GROUPS.flatMap((group) => {
    const options = optionsByGroup.get(group.key)
    return options.length ? [{ label: group.label, header: true, disable: true }, ...options] : []
  })
}

export { buildActionLabelOptions }
