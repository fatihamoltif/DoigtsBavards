/*
 * Classifieur de lettres : à partir d'un vecteur de main normalisé (63 nombres),
 * renvoie { lettre, confiance }.
 *
 * Trois implémentations, toutes derrière la même forme de fonction :
 *
 *   1. ClassifieurMock      — factice, pour développer/tester l'interface
 *                             (et la machine à états) sans modèle entraîné.
 *   2. ClassifieurKNN       — plus proche voisin sur des prototypes calculés
 *                             en Python (entrainement/ → modele.json).
 *   3. ClassifieurMLP       — petit réseau de neurones entraîné en Python,
 *                             passe-avant recodée ici en quelques lignes.
 *
 * KNN et MLP sont volontairement simples et lisibles : aucune boîte noire,
 * tout s'explique en soutenance.
 */

import { ALPHABET } from './config.js'
import { VERSION_NORMALISATION } from './normalisation.js' 
/* ------------------------------ 1. Le mock ------------------------------- */

export class ClassifieurMock {
  /**
   * Simule un signeur : il « tient » une lettre plusieurs trames (confiance
   * haute), puis « transite » vers la suivante (confiance basse). Cela permet
   * de tester la machine à états dans des conditions réalistes.
   *
   * @param {{script?: string}} options — si `script` est fourni (ex. "ELLE"),
   *        les lettres tenues suivent ce texte ; sinon, lettres au hasard.
   */
  constructor(options = {}) {
    this.script = options.script ? [...options.script.toUpperCase()] : null
    this.indexScript = 0
    this.phase = 'transition'
    this.tramesRestantes = 0
    this.cible = 'A'
    this.terminee = false
  }

  lettreAuHasard(sauf) {
    let lettre = ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    while (lettre === sauf) {
      lettre = ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    }
    return lettre
  }

  phaseSuivante() {
    if (this.phase === 'transition') {
      if (this.script) {
        if (this.indexScript >= this.script.length) {
          this.terminee = true
          this.tramesRestantes = Number.MAX_SAFE_INTEGER
          return
        }
        this.cible = this.script[this.indexScript]
        this.indexScript += 1
      } else {
        this.cible = this.lettreAuHasard()
      }
      this.phase = 'maintien'
      this.tramesRestantes = 16 + Math.floor(Math.random() * 8)
    } else {
      this.phase = 'transition'
      this.tramesRestantes = 8 + Math.floor(Math.random() * 5)
    }
  }

  /** @param {Float32Array} _vecteur @returns {{lettre:string,confiance:number}} */
  predire(_vecteur) {
    if (this.tramesRestantes <= 0) this.phaseSuivante()
    this.tramesRestantes -= 1

    if (this.phase === 'transition') {
      return { lettre: this.lettreAuHasard(), confiance: 0.2 + Math.random() * 0.25 }
    }
    const r = Math.random()
    if (r < 0.9) {
      return { lettre: this.cible, confiance: 0.87 + Math.random() * 0.12 }
    }
    return { lettre: this.lettreAuHasard(this.cible), confiance: 0.4 + Math.random() * 0.3 }
  }
}

/* --------------------- 2. KNN sur prototypes (Python) -------------------- */

export class ClassifieurKNN {
  /**
   * @param {{prototypes: Object.<string, number[][]>}} modele
   *        — pour chaque lettre, une liste de vecteurs 63-dim « moyens »
   *          calculés en Python à partir des captures.
   */
  constructor(modele) {
    this.prototypes = []
    for (const [lettre, vecteurs] of Object.entries(modele.prototypes)) {
      for (const vecteur of vecteurs) {
        this.prototypes.push({ lettre, vecteur })
      }
    }
  }

predire(vecteur) {
    const distanceParLettre = {}
    for (const proto of this.prototypes) {
      let d = 0
      for (let i = 0; i < 63; i++) {
        const ecart = vecteur[i] - proto.vecteur[i]
        d += ecart * ecart
      }
      const actuelle = distanceParLettre[proto.lettre]
      if (actuelle === undefined || d < actuelle) {
        distanceParLettre[proto.lettre] = d
      }
    }

    const classees = Object.entries(distanceParLettre).sort((a, b) => a[1] - b[1])
    if (classees.length === 0) return { lettre: '?', confiance: 0 }

    const [lettre, d1] = classees[0]
    const d2 = classees.length > 1 ? classees[1][1] : Infinity

    const confiance = d2 === Infinity ? 1 : 1 - d1 / d2
    return { lettre, confiance }
  }
}

/* ------------------------ 3. Petit MLP (Python) --------------------------- */

export class ClassifieurMLP {
  /**
   * @param {{couches: {poids: number[][], biais: number[]}[], lettres: string[]}} modele
   *        — poids exportés par le script Python ; chaque couche fait
   *          sortie = activation(poids × entrée + biais).
   */
  constructor(modele) {
    this.couches = modele.couches
    this.lettres = modele.lettres
  }

  predire(vecteur) {
    let activation = Array.from(vecteur)
    for (let c = 0; c < this.couches.length; c++) {
      const { poids, biais } = this.couches[c]
      const sortie = new Array(biais.length)
      for (let j = 0; j < biais.length; j++) {
        let somme = biais[j]
        for (let i = 0; i < activation.length; i++) {
          somme += poids[j][i] * activation[i]
        }
        sortie[j] = c < this.couches.length - 1 ? Math.max(0, somme) : somme
      }
      activation = sortie
    }
    const max = Math.max(...activation)
    const exps = activation.map((v) => Math.exp(v - max))
    const total = exps.reduce((a, b) => a + b, 0)
    let indiceMax = 0
    for (let i = 1; i < exps.length; i++) {
      if (exps[i] > exps[indiceMax]) indiceMax = i
    }
    return { lettre: this.lettres[indiceMax], confiance: exps[indiceMax] / total }
  }
}

/* ----------------------------- Chargement -------------------------------- */

/**
 * Charge le modèle entraîné en Python (modeles/modele-lettres.json) s'il
 * existe, sinon retombe sur le mock. L'UI n'a pas besoin de savoir lequel
 * est utilisé : les trois ont la même méthode predire().
 */
export async function chargerClassifieur() {
  try {
    const reponse = await fetch('modeles/modele-lettres.json')
    if (reponse.ok) {
      const modele = await reponse.json()
      if (modele.version_normalisation && modele.version_normalisation !== VERSION_NORMALISATION) {
        console.warn(`Modèle en ${modele.version_normalisation}, code en ${VERSION_NORMALISATION} → ignoré.`)
        return new ClassifieurMock()
      }
      if (modele.type === 'knn') return new ClassifieurKNN(modele)
      if (modele.type === 'mlp') return new ClassifieurMLP(modele)
    }
  } catch {
  }
  return new ClassifieurMock()
}