import { ME, RECEIVED, type Owner } from '../domain/types'

/**
 * Les premières versions avaient deux profils par téléphone (« lui » / « elle »).
 * Il n'y en a plus qu'un : on garde comme garde-robe principale le profil qui était
 * sélectionné (s'il contient des vêtements), sinon celui qui en contient le plus.
 * Les autres deviennent des vêtements « reçus » : rien n'est perdu.
 */
export function pickMainOwner(itemOwners: string[], preferred?: string | null): string | undefined {
  const counts = new Map<string, number>()
  for (const o of itemOwners) counts.set(o, (counts.get(o) ?? 0) + 1)
  if (counts.has(ME)) return ME
  if (preferred && counts.has(preferred)) return preferred
  let best: string | undefined
  for (const [o, n] of counts) if (!best || n > counts.get(best)!) best = o
  return best
}

export function ownerMapper(main: string | undefined) {
  return (owner: string): Owner => (owner === ME || owner === main ? ME : RECEIVED)
}
