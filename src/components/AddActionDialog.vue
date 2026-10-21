<template>
  <q-dialog
    v-model="isOpen"
    @show="handleShow"
  >
    <q-card style="width: 480px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-subtitle1">Add action / video segment</div>
        <q-space></q-space>
        <q-toggle
          v-model="isKeepOpen"
          dense
          label="keep open"
        >
          <q-tooltip>stay open after adding, to add several actions in a row</q-tooltip>
        </q-toggle>
      </q-card-section>
      <q-card-section class="q-pb-sm">
        <q-input
          ref="input"
          v-model="query"
          dense
          outlined
          clearable
          label="type to filter, enter to add"
        ></q-input>
      </q-card-section>
      <q-card-section
        ref="listArea"
        class="q-pt-none"
        style="max-height: 50vh; overflow-y: auto"
      >
        <q-list
          dense
          separator
        >
          <template
            v-for="option in options"
            :key="option.header ? `header-${option.label}` : `label-${option.value}`"
          >
            <q-item-label
              v-if="option.header"
              header
              class="text-weight-bold"
            >
              {{ option.label }}
            </q-item-label>
            <q-item
              v-else
              clickable
              :active="option.value === activeValue"
              :data-label-id="option.value"
              @click="handleSelect(option.value)"
              @mousemove="activeValue = option.value"
            >
              <q-item-section
                avatar
                style="min-width: 24px"
              >
                <q-icon
                  name="circle"
                  size="xs"
                  :style="{ color: option.color }"
                ></q-icon>
              </q-item-section>
              <q-item-section>{{ option.label }}</q-item-section>
            </q-item>
          </template>
          <q-item v-if="!selectableOptions.length">
            <q-item-section class="text-grey">No matching action label</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { buildActionLabelOptions } from '~/libs/actionLabelOptions.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  actionLabelData: { type: Array, required: true }
})
const emit = defineEmits(['update:modelValue', 'add'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
const isKeepOpen = ref(false)
const input = ref(null)
const listArea = ref(null)
const query = ref('')
const activeValue = ref(null)

const options = computed(() => buildActionLabelOptions(props.actionLabelData, query.value || ''))
const selectableOptions = computed(() => options.value.filter((option) => !option.header))

// the highlight restarts at the first match only when the typed filter changes
const resetActive = () => {
  activeValue.value = selectableOptions.value.length ? selectableOptions.value[0].value : null
}
watch(query, resetActive)

const scrollActiveIntoView = () => {
  nextTick(() => {
    const element = listArea.value?.$el.querySelector(`[data-label-id="${activeValue.value}"]`)
    element?.scrollIntoView({ block: 'nearest' })
  })
}
const moveActive = (offset) => {
  const count = selectableOptions.value.length
  if (!count) {
    return
  }
  const current = selectableOptions.value.findIndex((option) => option.value === activeValue.value)
  const next = Math.min(Math.max(current + offset, 0), count - 1)
  activeValue.value = selectableOptions.value[next].value
  scrollActiveIntoView()
}

// The annotation page's window-level capture handlers call stopPropagation(), so key events never reach
// the input or Quasar's own Escape handling. Listen at the window capture level while the dialog is open.
const handleKeydown = (event) => {
  if (event.isComposing) {
    return
  }
  if (event.code === 'ArrowDown' || event.code === 'ArrowUp') {
    event.preventDefault()
    moveActive(event.code === 'ArrowDown' ? 1 : -1)
  } else if (event.code === 'Enter' || event.code === 'NumpadEnter') {
    event.preventDefault()
    addActive()
  } else if (event.code === 'Escape') {
    event.preventDefault()
    isOpen.value = false
  }
}
watch(isOpen, (isNowOpen) => {
  window[isNowOpen ? 'addEventListener' : 'removeEventListener']('keydown', handleKeydown, true)
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown, true))

const handleShow = () => {
  query.value = ''
  resetActive()
  input.value.focus()
}
const handleSelect = (labelId) => {
  emit('add', labelId)
  if (isKeepOpen.value) {
    query.value = ''
    resetActive()
    input.value.focus()
  } else {
    isOpen.value = false
  }
}
const addActive = () => {
  if (activeValue.value !== null) {
    handleSelect(activeValue.value)
  }
}
</script>
