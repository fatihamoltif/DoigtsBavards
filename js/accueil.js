/*
 * Page d'accueil : typo cinétique (mot épelé lettre par lettre) et
 * révélations au scroll.
 *
 * Le motif « lettre par lettre » est la signature visuelle du projet : c'est
 * exactement ce que fait l'application (épeler). Chaque lettre « pop » en
 * place avec un décalage, le mot reste affiché, puis s'efface et le suivant
 * s'assemble.
 *
 * Accessibilité : si `prefers-reduced-motion` est actif, on affiche le premier
 * mot d'un bloc, sans cycle ni animation. Le conteneur est aria-hidden (le
 * sens est porté par le titre et le pitch, pas par l'animation).
 */

const MOTS = ['BONJOUR', 'MERCI', 'BIENVENUE', 'LSF']

const DUREE_PAR_LETTRE_MS = 160
const PAUSE_MOT_MS = 1800
const DUREE_SORTIE_MS = 450

const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)')

/** Lance l'épellation en boucle dans l'élément donné. */
export function lancerEpellation(conteneur) {
  if (!conteneur) return

  if (mouvementReduit.matches) {
    conteneur.textContent = MOTS[0]
    return
  }

  let index = 0

  function afficherMot() {
    const mot = MOTS[index % MOTS.length]
    index += 1

    conteneur.classList.remove('sortie')
    conteneur.textContent = ''
    for (let i = 0; i < mot.length; i++) {
      const lettre = document.createElement('span')
      lettre.className = 'lettre-epelee'
      lettre.textContent = mot[i]
      lettre.style.animationDelay = `${i * DUREE_PAR_LETTRE_MS}ms`
      conteneur.appendChild(lettre)
    }

    const dureeAssemblage = mot.length * DUREE_PAR_LETTRE_MS + 500
    setTimeout(() => {
      conteneur.classList.add('sortie')
      setTimeout(afficherMot, DUREE_SORTIE_MS)
    }, dureeAssemblage + PAUSE_MOT_MS)
  }

  afficherMot()
}

/* ----------------------- Révélations au scroll --------------------------- */

/**
 * Fait apparaître les éléments `.reveal` (fondu + glissement vers le haut)
 * quand ils entrent dans la zone visible du conteneur d'accueil.
 */
export function activerRevelations(racineScroll) {
  const elements = document.querySelectorAll('.reveal')

  if (mouvementReduit.matches || !('IntersectionObserver' in window)) {
    for (const el of elements) el.classList.add('visible')
    return
  }

  const observateur = new IntersectionObserver(
    (entrees) => {
      for (const entree of entrees) {
        if (entree.isIntersecting) {
          entree.target.classList.add('visible')
          observateur.unobserve(entree.target)
        }
      }
    },
    { root: racineScroll, threshold: 0.18 },
  )
  for (const el of elements) observateur.observe(el)
}

/* ------------------ Illustration : squelette de main --------------------- */

/*
 * On dessine la main comme l'app la « voit » : 21 points reliés (les
 * landmarks MediaPipe). C'est léger, dans la palette, et c'est honnête —
 * l'imagerie EST la donnée que l'app traite (aucune photo).
 */

const POINTS_MAIN = [
  [50, 117],
  [34, 103], [22, 88], [14, 76], [8, 65],
  [42, 67], [40, 45], [38, 31], [38, 18],
  [54, 65], [54, 41], [54, 25], [54, 11],
  [66, 67], [68, 45], [68, 31], [68, 18],
  [76, 72], [80, 54], [82, 41], [84, 29],
]

const LIAISONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Remplit un <svg class="main-squelette"> avec les points et liaisons. */
export function dessinerMainSquelette(svg) {
  svg.setAttribute('viewBox', '0 0 100 130')
  for (const [a, b] of LIAISONS) {
    const ligne = document.createElementNS(SVG_NS, 'line')
    ligne.setAttribute('x1', POINTS_MAIN[a][0])
    ligne.setAttribute('y1', POINTS_MAIN[a][1])
    ligne.setAttribute('x2', POINTS_MAIN[b][0])
    ligne.setAttribute('y2', POINTS_MAIN[b][1])
    ligne.setAttribute('class', 'squelette-ligne')
    svg.appendChild(ligne)
  }
  for (const [x, y] of POINTS_MAIN) {
    const point = document.createElementNS(SVG_NS, 'circle')
    point.setAttribute('cx', x)
    point.setAttribute('cy', y)
    point.setAttribute('r', 2.6)
    point.setAttribute('class', 'squelette-point')
    svg.appendChild(point)
  }
}

/** Initialise toute la page d'accueil. */
export function initialiserAccueil() {
  lancerEpellation(document.getElementById('mot-epele'))
  activerRevelations(document.getElementById('accueil'))
  for (const svg of document.querySelectorAll('svg.main-squelette')) {
    dessinerMainSquelette(svg)
  }
}
