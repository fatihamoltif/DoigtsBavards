import { Navigation } from './navigation.js'
import { EcranConversation } from './ui.js'
import { ClassifieurMock } from './classifieur.js'
import { CONFIG, ALPHABET, LETTRES_MOBILES } from './config.js'
import { initialiserAccueil } from './accueil.js'
import { initialiserDictionnaire } from './dictionnaire.js'
import { EcranCollecte } from './collecte.js'
import { ManagerCorrections } from './corrections.js'

initialiserAccueil()
const conversation = new EcranConversation()
const collecte = new EcranCollecte()
const corrections = new ManagerCorrections()


// Lier la validation de lettre dans la Conversation à la liste de Corrections
conversation.surValidationLettre = (lettre, vecteur) => {
  corrections.ajouterSaisie(lettre, vecteur)
}

new Navigation({
  // Changer de section coupe la caméra : elle ne tourne jamais « dans le dos ».
  surChangement: (section) => {
    if (section !== 'conversation' && conversation.cameraActive) {
      conversation.arreterCamera()
    }
    if (section !== 'collecte' && collecte.cameraActive) {
      collecte.arreterCamera()
    }
  },
})

/* ----------------------- Grille du dictionnaire -------------------------- */
// Les 26 lettres de la dactylologie ; les lettres à mouvement sont signalées.
const grille = document.getElementById('grille-alphabet')
for (const lettre of ALPHABET) {
  const carte = document.createElement('figure')
  carte.className = 'carte-lettre'
  carte.setAttribute('tabindex', '0') // Accessibilité clavier
  carte.setAttribute('role', 'button')
  carte.setAttribute('aria-label', `Voir le geste pour la lettre ${lettre}`)
  const grand = document.createElement('span')
  grand.className = 'lettre-grande'
  grand.textContent = lettre
  carte.appendChild(grand)
  if (LETTRES_MOBILES.has(lettre)) {
    const badge = document.createElement('figcaption')
    badge.className = 'badge-mouvement'
    badge.textContent = 'avec mouvement'
    carte.appendChild(badge)
  }
  grille.appendChild(carte)
}

// Initialiser le comportement du dictionnaire (modal)
initialiserDictionnaire()

/* ------------------------------ Mode démo -------------------------------- */
if (new URLSearchParams(location.search).get('demo') === '1') {
  document.body.classList.add('mode-application')
  document.getElementById('etat-camera').textContent = 'Mode démo'

  // Un signeur simulé épelle « LSF », pause, puis « OK ».
  const mock = new ClassifieurMock({ script: 'LSF' })
  const mock2 = new ClassifieurMock({ script: 'OK' })
  const vecteurFactice = new Float32Array(63)
  let phase = 1
  let tramesPause = 0
  conversation.cameraActive = true

  const intervalle = setInterval(() => {
    let prediction = null
    let mainVisible = true

    if (phase === 1) {
      prediction = mock.predire(vecteurFactice)
      if (mock.terminee) phase = 2
    } else if (phase === 2) {
      // Pause volontaire (main baissée) → la machine insère une espace.
      mainVisible = false
      tramesPause += 1
      if (tramesPause > Math.ceil(CONFIG.DELAI_ESPACE_MS / 33) + 10) phase = 3
    } else if (phase === 3) {
      prediction = mock2.predire(vecteurFactice)
      if (mock2.terminee) phase = 4
    } else {
      mainVisible = false
    }
    if (prediction && prediction.confiance < 0.15) prediction = null

    const resultat = conversation.machine.pousser(prediction, performance.now())
    conversation.appliquerResultat(resultat, mainVisible)
    if (phase === 4 && tramesPause > 200) clearInterval(intervalle)
  }, 33) // ≈ 30 trames/seconde, comme la caméra
}