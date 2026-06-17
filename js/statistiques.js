/*
 * Onglet Statistiques. Trois blocs :
 *   1. cartes de stats générales      — modeles/stats.json (entraînement)
 *   2. matrice de confusion LOSO      — modeles/confusion.json (entraînement)
 *   3. confiance par lettre épelée    — en mémoire, pour la séance courante
 *
 * Les blocs 1 et 2 sont des données FIGÉES (issues du dernier entraînement) ;
 * le bloc 3 est alimenté en direct à chaque lettre validée en Conversation
 * (via app.js → enregistrerLettre) et se remet à zéro au rechargement.
 */

export class GestionnaireStatistiques {
  constructor() {
    this.cartes = document.getElementById('stats-cartes')
    this.matrice = document.getElementById('stats-matrice')
    this.matriceSousTitre = document.getElementById('stats-matrice-sous-titre')
    this.confiance = document.getElementById('stats-confiance')
    this.placeholderConfiance = document.getElementById('placeholder-confiance')

    // Séance : lettre → { somme, n } pour la confiance moyenne.
    this.seance = new Map()

    this.chargerGlobales()
  }

  /* ------------------- 1 & 2 : données figées (entraînement) ------------- */

  async chargerGlobales() {
    const stats = await this.lireJSON('modeles/stats.json')
    if (stats) this.afficherCartes(stats)

    const conf = await this.lireJSON('modeles/confusion.json')
    if (conf) this.afficherMatrice(conf)
  }

  async lireJSON(url) {
    try {
      const r = await fetch(url)
      return r.ok ? await r.json() : null
    } catch {
      return null // pas de fichier (entraînement pas encore lancé) : on ignore
    }
  }

  afficherCartes(s) {
    if (!this.cartes) return
    const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)} %`)
    const cartes = [
      ['Lettres', String(s.n_lettres ?? '—'), 'classes reconnues'],
      ['Échantillons', (s.echantillons ?? 0).toLocaleString('fr-FR'), "trames d'entraînement"],
      ['Signeurs', String(s.signeurs?.length ?? 0), (s.signeurs || []).join(', ')],
      ['Généralisation', pct(s.loso_moyenne), 'signeur jamais vu (LOSO)'],
    ]
    this.cartes.textContent = ''
    for (const [titre, valeur, sous] of cartes) {
      const c = document.createElement('div')
      c.className = 'stat-carte'
      const v = document.createElement('p')
      v.className = 'stat-valeur'
      v.textContent = valeur
      const t = document.createElement('p')
      t.className = 'stat-titre'
      t.textContent = titre
      const ss = document.createElement('p')
      ss.className = 'stat-sous'
      ss.textContent = sous
      c.append(v, t, ss)
      this.cartes.appendChild(c)
    }
  }

  afficherMatrice(conf) {
    if (!this.matrice) return
    const { labels, matrice } = conf
    if (!labels || !matrice) return

    if (this.matriceSousTitre) {
      this.matriceSousTitre.textContent =
        conf.type === 'leave-one-signer-out'
          ? 'Sur un signeur jamais vu (leave-one-signer-out)'
          : 'Validation 80/20'
    }

    const n = labels.length
    const grille = document.createElement('div')
    grille.className = 'matrice-grille'
    grille.style.gridTemplateColumns = `auto repeat(${n}, 1fr)`

    // En-tête : coin vide + lettres prédites (colonnes).
    grille.appendChild(this.entete('', 'coin'))
    for (const l of labels) grille.appendChild(this.entete(l))

    matrice.forEach((ligne, i) => {
      grille.appendChild(this.entete(labels[i])) // vraie lettre (ligne)
      const total = ligne.reduce((a, b) => a + b, 0)
      ligne.forEach((valeur, j) => {
        const frac = total ? valeur / total : 0
        const cell = document.createElement('div')
        cell.className = 'matrice-cellule'
        if (valeur > 0) {
          cell.textContent = valeur
          cell.classList.add('remplie')
          if (i === j) {
            // Diagonale = bonne reconnaissance : teinte navy selon la proportion.
            cell.style.background = `rgba(34, 54, 98, ${(0.15 + 0.85 * frac).toFixed(3)})`
          } else {
            // Hors diagonale = confusion : teinte bordeaux, amplifiée pour rester visible.
            cell.style.background = `rgba(139, 38, 53, ${Math.min(0.9, 0.25 + frac * 4).toFixed(3)})`
          }
        }
        cell.title = `Vrai ${labels[i]} → prédit ${labels[j]} : ${valeur}`
        grille.appendChild(cell)
      })
    })

    this.matrice.textContent = ''
    this.matrice.appendChild(grille)
  }

  entete(txt, extra) {
    const c = document.createElement('div')
    c.className = 'matrice-entete' + (extra ? ` ${extra}` : '')
    c.textContent = txt
    return c
  }

  /* ------------------- 3 : confiance de la séance (live) ----------------- */

  /** Appelée à chaque lettre validée en Conversation (via app.js). */
  enregistrerLettre(lettre, confiance) {
    if (typeof confiance !== 'number' || Number.isNaN(confiance)) return
    const e = this.seance.get(lettre) || { somme: 0, n: 0 }
    e.somme += confiance
    e.n += 1
    this.seance.set(lettre, e)
    this.afficherConfiance()
  }

  afficherConfiance() {
    if (!this.confiance || this.seance.size === 0) return
    if (this.placeholderConfiance) this.placeholderConfiance.style.display = 'none'

    const lignes = [...this.seance.entries()].sort((a, b) => a[0].localeCompare(b[0]))

    const liste = document.createElement('div')
    liste.className = 'confiance-liste'
    for (const [lettre, { somme, n }] of lignes) {
      const moy = somme / n
      const pourcent = Math.round(moy * 100)

      const ligne = document.createElement('div')
      ligne.className = 'confiance-ligne'

      const lab = document.createElement('span')
      lab.className = 'confiance-lettre'
      lab.textContent = lettre

      const piste = document.createElement('div')
      piste.className = 'confiance-piste'
      const barre = document.createElement('div')
      barre.className = 'confiance-barre'
      barre.style.width = `${pourcent}%`
      // Rouge (faible) → discret → teal (forte).
      barre.style.background =
        moy >= 0.7 ? 'var(--encre)' : moy >= 0.5 ? 'var(--discret)' : 'var(--accent-fort)'
      piste.appendChild(barre)

      const val = document.createElement('span')
      val.className = 'confiance-valeur'
      val.textContent = `${pourcent} % · ${n}×`

      ligne.append(lab, piste, val)
      liste.appendChild(ligne)
    }

    const ancienne = this.confiance.querySelector('.confiance-liste')
    if (ancienne) ancienne.remove()
    this.confiance.appendChild(liste)
  }
}
