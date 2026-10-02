const DISMISSED_KEY = 'mangetsu:dismissed-notices'

let snapshot: string[] = []
const listeners = new Set<() => void>()
const emptySnapshot: string[] = []

const notify = () => {
  listeners.forEach((l) => l())
}

export const dismissedNoticesStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },

  getSnapshot() {
    return snapshot
  },

  getServerSnapshot() {
    return emptySnapshot
  },

  init() {
    try {
      snapshot = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
    } catch {
      snapshot = []
    }
    notify()
  },

  dismiss(id: string) {
    snapshot = [...snapshot, id]
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(snapshot))
    notify()
  },

  reset() {
    snapshot = []
    localStorage.removeItem(DISMISSED_KEY)
    notify()
  },
}
