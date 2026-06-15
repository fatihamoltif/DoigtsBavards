/*
 * Gestionnaire de Corrections.
 * Permet de capturer les trames validées à tort dans la Conversation,
 * de les afficher sous forme de liste avec choix de la correction (A-Z),
 * et de les exporter au format JSON pour ré-entraînement.
 */

import { ALPHABET } from './config.js'

export class ManagerCorrections {
  constructor() {
    this.liste = document.getElementById('liste-corrections')
    this.compteur = document.getElementById('compteur-corrections')
    this.boutonExport = document.getElementById('bouton-export-corrections')
    this.boutonClear = document.getElementById('bouton-clear-corrections')
    this.placeholder = document.getElementById('placeholder-corrections')

    this.donnees = [] // Array of { id, lettreReconnue, lettreCorrigee, vecteur }

    this.brancherEvenements()
  }

  brancherEvenements() {
    if (!this.boutonExport) return

    this.boutonExport.addEventListener('click', () => this.exporterJSON())
    this.boutonClear.addEventListener('click', () => {
      this.donnees = []
      this.rafraichirUI()
    })
  }

  /**
   * Ajoute une nouvelle saisie à corriger.
   * @param {string} lettreReconnue
   * @param {Float32Array} vecteurNormalise
   */
  ajouterSaisie(lettreReconnue, vecteurNormalise) {
    if (!vecteurNormalise) return

    const correction = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      lettreReconnue,
      lettreCorrigee: lettreReconnue, // par défaut
      vecteur: Array.from(vecteurNormalise),
    }

    this.donnees.push(correction)
    this.rafraichirUI()
  }

  rafraichirUI() {
    if (!this.liste) return

    // Supprimer le placeholder
    if (this.placeholder) {
      if (this.donnees.length > 0) {
        this.placeholder.style.display = 'none'
      } else {
        this.placeholder.style.display = 'block'
      }
    }

    // Vider la liste (sauf le placeholder)
    const elementsASupprimer = [...this.liste.children].filter(
      (child) => child !== this.placeholder,
    )
    for (const el of elementsASupprimer) {
      this.liste.removeChild(el)
    }

    // Recréer les éléments
    this.donnees.forEach((item) => {
      const div = document.createElement('div')
      div.style.display = 'flex'
      div.style.alignItems = 'center'
      div.style.justifyContent = 'space-between'
      div.style.padding = '0.7rem 1rem'
      div.style.border = '1px solid rgb(97 120 145 / 0.15)'
      div.style.borderRadius = 'var(--rayon)'
      div.style.background = 'var(--papier)'
      div.style.gap = '0.8rem'

      const label = document.createElement('span')
      label.style.fontWeight = '500'
      label.style.color = 'var(--encre)'
      label.textContent = `Reconnu : `
      const spanLettre = document.createElement('strong')
      spanLettre.style.fontFamily = 'var(--serif)'
      spanLettre.style.fontSize = '1.3rem'
      spanLettre.textContent = item.lettreReconnue
      label.appendChild(spanLettre)

      const selectDiv = document.createElement('div')
      selectDiv.style.display = 'flex'
      selectDiv.style.alignItems = 'center'
      selectDiv.style.gap = '0.4rem'
      selectDiv.style.fontSize = '0.85rem'
      selectDiv.style.color = 'var(--discret)'
      selectDiv.textContent = 'Corriger en : '

      const select = document.createElement('select')
      select.style.padding = '0.35rem 0.6rem'
      select.style.borderRadius = '8px'
      select.style.border = '1px solid rgb(97 120 145 / 0.25)'
      select.style.background = 'var(--blanc)'
      select.style.fontFamily = 'inherit'
      select.style.fontSize = '0.9rem'
      select.style.color = 'var(--encre)'

      for (const lettre of ALPHABET) {
        const option = document.createElement('option')
        option.value = lettre
        option.textContent = lettre
        option.selected = lettre === item.lettreCorrigee
        select.appendChild(option)
      }

      select.addEventListener('change', () => {
        item.lettreCorrigee = select.value
      })

      selectDiv.appendChild(select)

      const boutonSuppr = document.createElement('button')
      boutonSuppr.className = 'bouton-fermer'
      boutonSuppr.style.position = 'static'
      boutonSuppr.style.fontSize = '1.3rem'
      boutonSuppr.style.padding = '0'
      boutonSuppr.innerHTML = '&times;'
      boutonSuppr.setAttribute('aria-label', 'Supprimer cette correction')
      boutonSuppr.addEventListener('click', () => {
        this.donnees = this.donnees.filter((d) => d.id !== item.id)
        this.rafraichirUI()
      })

      div.appendChild(label)
      div.appendChild(selectDiv)
      div.appendChild(boutonSuppr)
      this.liste.appendChild(div)
    })

    // Mettre à jour le compteur et l'état des boutons
    const nb = this.donnees.length
    this.compteur.textContent = nb
    this.boutonExport.disabled = nb === 0
    this.boutonClear.disabled = nb === 0
  }

  exporterJSON() {
    if (this.donnees.length === 0) return

    // Groupement par lettre corrigée pour correspondre au format d'entraînement
    const exportData = {
      type: 'corrections',
      date: new Date().toISOString().split('T')[0],
      exemples: this.donnees.map((item) => ({
        lettre_originale: item.lettreReconnue,
        lettre_corrigee: item.lettreCorrigee,
        vecteur: item.vecteur,
      })),
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const lien = document.createElement('a')
    lien.href = url
    lien.download = `corrections_${exportData.date}.json`
    document.body.appendChild(lien)
    lien.click()
    document.body.removeChild(lien)
    URL.revokeObjectURL(url)

    // Réinitialise après export
    this.donnees = []
    this.rafraichirUI()
  }
}
