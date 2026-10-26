/** Petits réglages de l'appareil, gardés dans le navigateur (sans importance si perdus). */
const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* navigation privée */
  }
}

export const prefs = {
  /** Détourer automatiquement chaque nouvelle photo (activé par défaut). */
  autoCutout: {
    get: () => read('autoCutout') !== 'non',
    set: (on: boolean) => write('autoCutout', on ? 'oui' : 'non'),
  },
  /** Le moteur de détourage a déjà été téléchargé une fois sur cet appareil. */
  cutoutReady: {
    get: () => read('cutoutReady') === 'oui',
    set: () => write('cutoutReady', 'oui'),
  },
}
