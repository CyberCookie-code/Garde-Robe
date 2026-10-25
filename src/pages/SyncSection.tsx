import { useState, useSyncExternalStore } from 'react'
import { account, syncNow, syncStore } from '../sync/engine'

export function SyncSection() {
  const s = useSyncExternalStore(syncStore.subscribe, syncStore.get)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string>()
  const [busy, setBusy] = useState(false)

  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true)
    setMsg(undefined)
    try {
      await fn()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!s.configured)
    return (
      <p className="muted">
        Les données restent sur ce téléphone. La synchro entre vos deux téléphones s'activera quand le projet
        Supabase sera configuré.
      </p>
    )

  if (!s.email)
    return (
      <div className="form">
        <p className="muted">Connecte-toi pour partager la garde-robe avec l'autre téléphone.</p>
        <label>
          E-mail
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div className="actions">
          <button className="primary" disabled={busy} onClick={run(() => account.signIn(email, password))}>
            Se connecter
          </button>
          <button
            disabled={busy || password.length < 6}
            onClick={run(async () => {
              const { needsConfirmation } = await account.signUp(email, password)
              if (needsConfirmation) setMsg('Compte créé : clique sur le lien reçu par e-mail, puis reviens te connecter ici.')
            })}
          >
            Créer un compte
          </button>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </div>
    )

  if (!s.householdId)
    return (
      <div className="form">
        <p className="muted">Connecté·e : {s.email}</p>
        <button className="primary" disabled={busy} onClick={run(account.createHousehold)}>
          Créer notre garde-robe partagée
        </button>
        <label>
          …ou rejoindre celle de l'autre avec son code
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex. 4F7A12BC" />
        </label>
        <button disabled={busy || code.trim().length < 6} onClick={run(() => account.joinHousehold(code))}>
          Rejoindre
        </button>
        <button className="ghost small" onClick={run(account.signOut)}>
          Se déconnecter
        </button>
        {msg && <p className="muted">{msg}</p>}
      </div>
    )

  const status = {
    off: 'inactive',
    idle: s.pending ? `${s.pending} modification(s) en attente` : 'à jour',
    syncing: 'synchronisation…',
    offline: `hors-ligne${s.pending ? `, ${s.pending} modification(s) à envoyer` : ''}`,
    error: `erreur : ${s.error}`,
  }[s.status]

  return (
    <div className="form">
      <p>
        Synchro : <strong>{status}</strong>
        {s.lastSyncAt && (
          <span className="muted"> · {new Date(s.lastSyncAt).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}</span>
        )}
      </p>
      <p>
        Code à donner à l'autre téléphone : <strong className="code">{s.inviteCode}</strong>
      </p>
      <p className="muted">Connecté·e : {s.email}</p>
      <div className="actions">
        <button onClick={() => void syncNow()} disabled={s.status === 'syncing'}>
          Synchroniser
        </button>
        <button className="ghost small" onClick={run(account.signOut)}>
          Se déconnecter
        </button>
      </div>
      {msg && <p className="muted">{msg}</p>}
    </div>
  )
}
