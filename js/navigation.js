/*
 * Navigation : page d'accueil → application, et glissement entre sections.
 *
 * Principe : les 4 sections (Conversation, Dictionnaire, Collecte,
 * Corrections) sont des panneaux côte à côte dans une piste horizontale.
 * Changer de section déplace la piste avec `transform: translateX(...)` —
 * uniquement transform/opacity pour rester fluide (60 i/s).
 *
 * L'indicateur actif du menu glisse lui aussi sous l'onglet courant.
 * `prefers-reduced-motion` est respecté dans le CSS (transitions coupées).
 */

export class Navigation {
  /**
   * @param {{surChangement?: (id: string) => void}} options
   *        — rappel optionnel quand la section change (ex. couper la caméra).
   */
  constructor(options = {}) {
    this.surChangement = options.surChangement
    this.accueil = document.getElementById('accueil')
    this.application = document.getElementById('application')
    this.piste = document.getElementById('piste-sections')
    this.onglets = [...document.querySelectorAll('.onglet')]
    this.indicateur = document.getElementById('indicateur-onglet')
    this.sectionActive = 'conversation'

    // Boutons d'entrée (hero + appel final) : glissent vers l'application.
    for (const bouton of document.querySelectorAll('[data-action="ouvrir-app"]')) {
      bouton.addEventListener('click', () => this.ouvrirApplication())
    }
    // Logo : retour à l'accueil.
    document.getElementById('lien-accueil').addEventListener('click', () => {
      this.ouvrirAccueil()
    })

    // Clic sur un onglet → glissement vers la section.
    for (const onglet of this.onglets) {
      onglet.addEventListener('click', () => this.allerA(onglet.dataset.section))
    }

    // L'indicateur doit suivre l'onglet si la fenêtre change de taille.
    window.addEventListener('resize', () => this.placerIndicateur())
  }

  ouvrirApplication() {
    document.body.classList.add('mode-application')
    // L'indicateur ne peut être mesuré que quand le menu est visible.
    requestAnimationFrame(() => this.placerIndicateur())
  }

  ouvrirAccueil() {
    document.body.classList.remove('mode-application')
  }

  /** Fait glisser la piste vers la section demandée. */
  allerA(id) {
    const index = this.onglets.findIndex((o) => o.dataset.section === id)
    if (index < 0 || id === this.sectionActive) return
    this.sectionActive = id

    // Glissement : chaque panneau occupe 100 % de la largeur.
    this.piste.style.transform = `translateX(-${index * 100}%)`

    for (const onglet of this.onglets) {
      const actif = onglet.dataset.section === id
      onglet.classList.toggle('actif', actif)
      onglet.setAttribute('aria-current', actif ? 'page' : 'false')
    }
    this.placerIndicateur()

    if (this.surChangement) this.surChangement(id)
  }

  /** Aligne la barre-indicateur sous l'onglet actif (translation animée). */
  placerIndicateur() {
    const actif = this.onglets.find((o) => o.classList.contains('actif'))
    if (!actif || !this.indicateur) return
    const boite = actif.getBoundingClientRect()
    const parent = actif.parentElement.getBoundingClientRect()
    this.indicateur.style.width = `${boite.width}px`
    this.indicateur.style.transform = `translateX(${boite.left - parent.left}px)`
  }
}
