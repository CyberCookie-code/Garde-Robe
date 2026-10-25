// Toasts : retours courts après une action (« Vêtement ajouté », « Annuler »…).

export interface ToastMsg {
  id: number
  text: string
  action?: { label: string; run: () => void }
}
let toasts: ToastMsg[] = []
const toastListeners = new Set<() => void>()
const emit = () => toastListeners.forEach((l) => l())

export function toast(text: string, action?: ToastMsg['action']) {
  const t = { id: Date.now() + Math.random(), text, action }
  toasts = [...toasts.slice(-1), t]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    emit()
  }, action ? 5000 : 2800)
}

export const getToasts = () => toasts
export function subscribeToasts(l: () => void) {
  toastListeners.add(l)
  return () => {
    toastListeners.delete(l)
  }
}
export function dismissToast(id: number) {
  toasts = toasts.filter((x) => x.id !== id)
  emit()
}
