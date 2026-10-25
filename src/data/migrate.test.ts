import { describe, expect, it } from 'vitest'
import { ownerMapper, pickMainOwner } from './migrate'

describe('migration vers un seul profil', () => {
  it('garde le profil sélectionné comme garde-robe principale', () => {
    const main = pickMainOwner(['a', 'a', 'a', 'b'], 'b')
    expect(main).toBe('b')
    const map = ownerMapper(main)
    expect(map('b')).toBe('moi')
    expect(map('a')).toBe('recu')
  })

  it('prend le profil le plus rempli si le sélectionné est vide', () => {
    expect(pickMainOwner(['a', 'b', 'b'], 'c')).toBe('b')
    expect(pickMainOwner(['a', 'b', 'b'], null)).toBe('b')
  })

  it('ne touche pas à des données déjà migrées', () => {
    const map = ownerMapper(pickMainOwner(['moi', 'recu']))
    expect(map('moi')).toBe('moi')
    expect(map('recu')).toBe('recu')
  })

  it('fonctionne sans aucun vêtement', () => {
    expect(pickMainOwner([], 'a')).toBeUndefined()
    expect(ownerMapper(undefined)('moi')).toBe('moi')
  })
})
