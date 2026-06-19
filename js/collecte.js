/*
 * Module de Collecte de données d'apprentissage.
 * Permet d'enregistrer des trames de landmarks normalisés pour une lettre
 * et un signeur donnés, et d'exporter le jeu de données final en JSON.
 */

import { ALPHABET } from './config.js'
import { PipelineCamera } from './pipeline.js'
import { normaliserMain } from './normalisation.js'

export class EcranCollecte {
  constructor() {
    this.video = document.getElementById('video-camera-collecte')
    this.canvas = document.getElementById('canvas-squelette-collecte')
    this.boutonCamera = document.getElementById('bouton-camera-collecte')
    this.boutonCouper = document.getElementById('bouton-couper-collecte')
    this.voileCamera = document.getElementById('voile-camera-collecte')
    this.etatCamera = document.getElementById('etat-camera-collecte')
    this.messageCamera = document.getElementById('message-camera-collecte')
    this.pastilleCamera = document.getElementById('pastille-camera-collecte')

    this.inputSigneur = document.getElementById('input-signeur')
    this.selectLettre = document.getElementById('select-lettre')
    this.compteurCaptures = document.getElementById('compteur-captures')
    this.badgeEnregistrement = document.getElementById('badge-enregistrement')
    this.aideCapture = document.getElementById('aide-capture')

    this.boutonRec = document.getElementById('bouton-rec-collecte')
    this.boutonSupprimer = document.getElementById('bouton-supprimer-collecte')
    this.boutonExport = document.getElementById('bouton-export-collecte')

    this.pipeline = new PipelineCamera()
    this.trames = []
    this.enEnregistrement = false
    this.cameraActive = false

    this.initialiserFormulaire()
    this.brancherEvenements()
  }

  initialiserFormulaire() {
    if (this.selectLettre) {
      this.selectLettre.textContent = ''
      for (const lettre of ALPHABET) {
        const option = document.createElement('option')
        option.value = lettre
        option.textContent = `Lettre ${lettre}`
        this.selectLettre.appendChild(option)
      }
    }
  }

  brancherEvenements() {
    if (!this.boutonCamera) return

    this.boutonCamera.addEventListener('click', () => this.demarrerCamera())
    this.boutonCouper.addEventListener('click', () => this.arreterCamera())

    const validerControles = () => {
      const signeurOk = this.inputSigneur.value.trim().length > 0
      const recPret = signeurOk && this.cameraActive

      this.boutonRec.disabled = !recPret
      this.boutonSupprimer.disabled = this.trames.length === 0
      this.boutonExport.disabled = this.trames.length === 0

      if (this.enEnregistrement) {
        this.aideCapture.textContent = "Capture en cours... Tenez la position ou variez légèrement l'angle."
      } else if (!this.cameraActive) {
        this.aideCapture.textContent = "Activez la caméra pour démarrer la capture."
      } else if (!signeurOk) {
        this.aideCapture.textContent = "Saisissez un nom de signeur pour activer l'enregistrement."
      } else {
        this.aideCapture.textContent = `Prêt à capturer des exemples de la lettre ${this.selectLettre.value}.`
      }
    }

    this.inputSigneur.addEventListener('input', validerControles)
    this.selectLettre.addEventListener('change', validerControles)

    this.boutonRec.addEventListener('click', () => {
      if (this.enEnregistrement) {
        this.arrêterEnregistrement()
      } else {
        this.démarrerEnregistrement()
      }
      validerControles()
    })

    this.boutonSupprimer.addEventListener('click', () => {
      this.trames = []
      this.compteurCaptures.textContent = '0'
      this.arrêterEnregistrement()
      validerControles()
    })

    this.boutonExport.addEventListener('click', () => this.exporterJSON())
  }

  /* ------------------------------ Caméra --------------------------------- */

  async demarrerCamera() {
    this.boutonCamera.disabled = true
    this.messageCamera.textContent = 'Chargement du modèle local…'
    try {
      await this.pipeline.demarrer(this.video, this.canvas, (main) =>
        this.surTrame(main),
      )
      this.cameraActive = true
      this.voileCamera.classList.add('cache')
      this.boutonCouper.hidden = false
      this.pastilleCamera.classList.add('active')
      this.etatCamera.textContent = 'Caméra active'
      this.inputSigneur.dispatchEvent(new Event('input'))
    } catch (erreur) {
      console.error(erreur)
      this.messageCamera.textContent = "Impossible d'initialiser la caméra ou le modèle."
    } finally {
      this.boutonCamera.disabled = false
    }
  }

  arreterCamera() {
    this.arrêterEnregistrement()
    this.pipeline.arreter(this.video, this.canvas)
    this.cameraActive = false
    this.voileCamera.classList.remove('cache')
    this.boutonCouper.hidden = true
    this.pastilleCamera.classList.remove('active')
    this.etatCamera.textContent = 'En pause'
    this.messageCamera.textContent = ''
    this.inputSigneur.dispatchEvent(new Event('input'))
  }

  /* ------------------------ Enregistrement ------------------------------- */

  démarrerEnregistrement() {
    this.enEnregistrement = true
    this.badgeEnregistrement.style.display = 'inline-block'
    this.boutonRec.textContent = '⏹ Arrêter'
    this.boutonRec.classList.add('fort')
    this.inputSigneur.disabled = true
    this.selectLettre.disabled = true
  }

  arrêterEnregistrement() {
    if (!this.enEnregistrement) return
    this.enEnregistrement = false
    this.badgeEnregistrement.style.display = 'none'
    this.boutonRec.textContent = '🔴 Enregistrer'
    this.inputSigneur.disabled = false
    this.selectLettre.disabled = false
  }

  surTrame(main) {
    if (!this.enEnregistrement) return

    if (main) {
      const vecteur = normaliserMain(main.landmarks, main.lateralite)
      if (vecteur) {
        this.trames.push(Array.from(vecteur))
        this.compteurCaptures.textContent = this.trames.length
        this.boutonSupprimer.disabled = false
        this.boutonExport.disabled = false
      }
    }
  }

  /* ---------------------------- Export JSON ------------------------------ */

  exporterJSON() {
    if (this.trames.length === 0) return

    const signeur = this.inputSigneur.value.trim().toLowerCase().replace(/\s+/g, '_')
    const lettre = this.selectLettre.value

    const exportData = {
      lettre: lettre,
      signeur: signeur,
      trames: this.trames,
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const lien = document.createElement('a')
    lien.href = url
    lien.download = `capture_${lettre}_${signeur}.json`
    document.body.appendChild(lien)
    lien.click()
    document.body.removeChild(lien)
    URL.revokeObjectURL(url)

    this.trames = []
    this.compteurCaptures.textContent = '0'
    this.arrêterEnregistrement()
    this.inputSigneur.dispatchEvent(new Event('input'))
  }
}
