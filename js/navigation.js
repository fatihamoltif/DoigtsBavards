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
    this.fenetre = document.querySelector('.fenetre-sections')
    this.panneaux = [...document.querySelectorAll('.panneau')]
    this.onglets = [...document.querySelectorAll('.onglet')]
    this.indicateur = document.getElementById('indicateur-onglet')
    this.sectionActive = 'conversation'

    for (const bouton of document.querySelectorAll('[data-action="ouvrir-app"]')) {
      bouton.addEventListener('click', () => this.ouvrirApplication())
    }
    document.getElementById('lien-accueil').addEventListener('click', () => {
      this.ouvrirAccueil()
    })

    for (const onglet of this.onglets) {
      onglet.addEventListener('click', () => this.allerA(onglet.dataset.section))
    }

    window.addEventListener('resize', () => {
      this.placerIndicateur()
      this.ajusterHauteur()
    })

    if ('ResizeObserver' in window) {
      const observateur = new ResizeObserver(() => this.ajusterHauteur())
      for (const p of this.panneaux) observateur.observe(p)
    }
    this.ajusterHauteur()
  }

  ouvrirApplication() {
    document.body.classList.add('mode-application')
    requestAnimationFrame(() => {
      this.placerIndicateur()
      this.ajusterHauteur()
    })
  }

  ouvrirAccueil() {
    document.body.classList.remove('mode-application')
  }

  /** Fait glisser la piste vers la section demandée. */
  allerA(id) {
    const index = this.onglets.findIndex((o) => o.dataset.section === id)
    if (index < 0 || id === this.sectionActive) return
    this.sectionActive = id

    this.piste.style.transform = `translateX(-${index * 100}%)`

    for (const onglet of this.onglets) {
      const actif = onglet.dataset.section === id
      onglet.classList.toggle('actif', actif)
      onglet.setAttribute('aria-current', actif ? 'page' : 'false')
    }
    this.placerIndicateur()
    this.ajusterHauteur()

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

  /**
   * Cale la hauteur de la fenêtre des sections sur celle du panneau actif,
   * pour qu'il n'y ait pas d'espace vide sous les onglets plus courts que le
   * panneau le plus grand (la piste est une rangée flex de panneaux 100 %).
   */
  ajusterHauteur() {
    if (!this.fenetre) return
    const actif = document.getElementById(`section-${this.sectionActive}`)
    if (actif) this.fenetre.style.height = `${actif.offsetHeight}px`
  }
}
