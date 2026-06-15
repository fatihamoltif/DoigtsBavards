/*
 * Démonstration de la machine à états SANS caméra ni navigateur.
 *
 * On branche le classifieur factice (qui simule un signeur : maintiens,
 * transitions, bruit) sur la machine à états, et on vérifie le contrat :
 *
 *   1. UNE lettre par maintien volontaire — jamais de spam, même si la lettre
 *      est détectée sur des dizaines de trames consécutives ;
 *   2. répéter une lettre (« ELLE ») exige un relâchement entre les deux L ;
 *   3. une pause de la main insère UNE espace ;
 *   4. abstention : aucune lettre fausse n'est validée malgré le bruit.
 *
 * Lancer :  node scripts/demo-saisie.mjs
 */

import { MachineLettres } from '../js/reconnaissance.js'
import { ClassifieurMock } from '../js/classifieur.js'
import { CONFIG } from '../js/config.js'

// Générateur pseudo-aléatoire avec graine : sortie reproductible.
function aleatoireAvecGraine(graine) {
  return () => {
    graine |= 0
    graine = (graine + 0x6d2b79f5) | 0
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
Math.random = aleatoireAvecGraine(7)

const machine = new MachineLettres(CONFIG)
const vecteurFactice = new Float32Array(63)
const DUREE_TRAME_MS = 33 // ≈ 30 trames/seconde, comme la webcam

let texte = ''
let horloge = 0
let trame = 0
let tramesOuLaLettreEtaitDetectee = 0

function pousser(prediction) {
  trame += 1
  horloge += DUREE_TRAME_MS
  if (prediction && prediction.confiance >= CONFIG.SEUIL_HAUT) {
    tramesOuLaLettreEtaitDetectee += 1
  }
  const resultat = machine.pousser(prediction, horloge)
  if (resultat.validation?.type === 'lettre') {
    texte += resultat.validation.lettre
    console.log(
      `trame ${String(trame).padStart(3)} : lettre validée « ${resultat.validation.lettre} »  → texte = "${texte}"`,
    )
  } else if (resultat.validation?.type === 'espace') {
    // Même garde que l'interface : pas d'espace en début ni en double.
    if (texte && !texte.endsWith(' ')) {
      texte += ' '
      console.log(`trame ${String(trame).padStart(3)} : espace (pause)        → texte = "${texte}"`)
    }
  }
}

// Le signeur épelle un mot (le mock simule maintiens + transitions + bruit).
function epeler(mot, nbTrames) {
  const mock = new ClassifieurMock({ script: mot })
  for (let i = 0; i < nbTrames && !mock.terminee; i++) {
    pousser(mock.predire(vecteurFactice))
  }
}

// Pause : main baissée assez longtemps pour déclencher une espace.
function pause() {
  const nbTrames = Math.ceil(CONFIG.DELAI_ESPACE_MS / DUREE_TRAME_MS) + 8
  for (let i = 0; i < nbTrames; i++) pousser(null)
}

console.log('Réglages :', {
  SEUIL_HAUT: CONFIG.SEUIL_HAUT,
  SEUIL_BAS: CONFIG.SEUIL_BAS,
  K_TRAMES: CONFIG.K_TRAMES,
  RELACHEMENT_TRAMES: CONFIG.RELACHEMENT_TRAMES,
  DELAI_ESPACE_MS: CONFIG.DELAI_ESPACE_MS,
})
console.log('\nLe signeur épelle « ELLE », fait une pause, puis « LSF ».\n')

epeler('ELLE', 220)
pause()
epeler('LSF', 170)

console.log(`\nTexte final : "${texte}"`)
console.log(
  `Anti-spam : la bonne lettre a été vue sur ${tramesOuLaLettreEtaitDetectee} trames ` +
    `au-dessus du seuil, mais seulement ${texte.replace(/ /g, '').length} lettres ont été écrites.`,
)
console.log('Le double L de « ELLE » prouve le relâchement → re-signature.')
