/*
 * Curseur personnalisé à 3 états (normal / pointer / clic-grab).
 *
 * - Desktop souris uniquement : désactivé sur tactile (mobile, tablette).
 * - Suit la souris de façon fluide (requestAnimationFrame + transform).
 * - Cache le curseur natif (cursor: none), pointer-events: none, z-index très haut.
 * - Se masque quand la souris quitte la fenêtre, réapparaît au retour.
 * - Garde-fou : si l'image « normal » est introuvable, on n'active rien
 *   (le curseur natif reste) — jamais de curseur invisible.
 *
 * >>> À CONFIGURER : les chemins de TES 3 images (PNG ou SVG transparents). <<<
 * Si tes fichiers ont d'autres noms / un autre dossier, change-les ici.
 */

const IMAGES = {
  normal: 'assets/curseur/normal.png',
  pointer: 'assets/curseur/pointer.png',
  grab: 'assets/curseur/grab.png',
}

const TAILLE = 'auto'

const HOTSPOT = { x: 0.15, y: 0.1 }

const SELECTEUR_CLIQUABLE =
  'a, button, [role="button"], input, textarea, select, label, summary, ' +
  '.clickable, .onglet, .carte-lettre, [data-action]'

export function initialiserCurseur() {
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return

  const sonde = new Image()
  sonde.onload = () => activer(sonde.naturalWidth || 40, sonde.naturalHeight || 40)
  sonde.onerror = () =>
    console.warn(
      `Curseur perso désactivé : « ${IMAGES.normal} » introuvable. ` +
        'Place tes 3 images (voir assets/curseur/README.md) ou corrige les chemins dans js/curseur.js.',
    )
  sonde.src = IMAGES.normal

  function activer(largeurNative, hauteurNative) {
    for (const src of [IMAGES.pointer, IMAGES.grab]) {
      const i = new Image()
      i.src = src
    }

    const el = document.createElement('div')
    el.className = 'curseur-perso cache'
    el.setAttribute('aria-hidden', 'true')
    el.style.backgroundImage = `url("${IMAGES.normal}")`
    el.style.width = `${TAILLE === 'auto' ? largeurNative : TAILLE}px`
    el.style.height = `${TAILLE === 'auto' ? hauteurNative : TAILLE}px`
    document.body.appendChild(el)
    document.documentElement.classList.add('curseur-actif')

    let etat = 'normal'
    let presse = false
    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let raf = null

    const appliquerImage = () => {
      const cle = presse ? 'grab' : etat
      el.style.backgroundImage = `url("${IMAGES[cle]}")`
    }

    const rendre = () => {
      raf = null
      const w = el.offsetWidth || 40
      const h = el.offsetHeight || 40
      el.style.transform = `translate(${x - w * HOTSPOT.x}px, ${y - h * HOTSPOT.y}px)`
    }
    const planifier = () => {
      if (raf === null) raf = requestAnimationFrame(rendre)
    }

    window.addEventListener('mousemove', (e) => {
      x = e.clientX
      y = e.clientY
      el.classList.remove('cache')
      const surCliquable =
        e.target instanceof Element && e.target.closest(SELECTEUR_CLIQUABLE)
      const suivant = surCliquable ? 'pointer' : 'normal'
      if (suivant !== etat) {
        etat = suivant
        if (!presse) appliquerImage()
      }
      planifier()
    })

    window.addEventListener('mousedown', () => {
      presse = true
      appliquerImage()
    })
    window.addEventListener('mouseup', () => {
      presse = false
      appliquerImage()
    })

    document.documentElement.addEventListener('mouseleave', () => el.classList.add('cache'))
    document.documentElement.addEventListener('mouseenter', () => el.classList.remove('cache'))
    window.addEventListener('blur', () => el.classList.add('cache'))
  }
}
