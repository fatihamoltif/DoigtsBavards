import { CONFIG } from './config.js'
import { PipelineCamera } from './pipeline.js'
import { normaliserMain } from './normalisation.js'
import { MachineLettres, ETATS } from './reconnaissance.js'
import { chargerClassifieur } from './classifieur.js'
import { Transcription, lireAVoixHaute } from './parole.js'

/* Circonférence de l'anneau de progression (rayon 26 → 2πr). */
const CIRCONFERENCE = 2 * Math.PI * 26

export class EcranConversation {
  constructor() {
    // --- Références DOM (côté dactylologie). ---
    this.video = document.getElementById('video-camera')
    this.canvas = document.getElementById('canvas-squelette')
    this.boutonCamera = document.getElementById('bouton-camera')
    this.boutonCouper = document.getElementById('bouton-couper')
    this.voileCamera = document.getElementById('voile-camera')
    this.etatCamera = document.getElementById('etat-camera')
    this.messageCamera = document.getElementById('message-camera')
    this.lettreCandidate = document.getElementById('lettre-candidate')
    this.anneau = document.getElementById('anneau-progression')
    this.etatLettre = document.getElementById('etat-lettre')
    this.texteCompose = document.getElementById('texte-compose')
    this.curseur = document.getElementById('curseur-texte')
    this.boutonEffacer = document.getElementById('bouton-effacer')
    this.boutonToutEffacer = document.getElementById('bouton-tout-effacer')
    this.boutonLire = document.getElementById('bouton-lire')
    this.pastilleCamera = document.getElementById('pastille-camera')

    // --- Logique. ---
    this.pipeline = new PipelineCamera()
    this.machine = new MachineLettres(CONFIG)
    this.classifieur = null // chargé au démarrage de la caméra
    this.texte = ''
    this.cameraActive = false
    this.dernierVecteur = null // vecteur normalisé de la dernière trame
    this.surValidationLettre = null // callback appelée lors d'une validation de lettre

    this.brancherEvenements()
    this.brancherReglages()
    this.brancherTranscription()
    this.afficherTexte()
  }

  brancherEvenements() {
    this.boutonCamera.addEventListener('click', () => this.demarrerCamera())
    this.boutonCouper.addEventListener('click', () => this.arreterCamera())
    this.boutonEffacer.addEventListener('click', () => {
      this.texte = this.texte.slice(0, -1)
      this.afficherTexte()
    })
    this.boutonToutEffacer.addEventListener('click', () => {
      this.texte = ''
      this.afficherTexte()
    })
    this.boutonLire.addEventListener('click', () => lireAVoixHaute(this.texte.trim()))
  }

  /* ------------------------------ Caméra --------------------------------- */

  async demarrerCamera() {
    this.boutonCamera.disabled = true
    this.messageCamera.textContent = 'Chargement du modèle local…'
    try {
      if (!this.classifieur) this.classifieur = await chargerClassifieur()
      this.machine.reinitialiser()
      await this.pipeline.demarrer(this.video, this.canvas, (main) =>
        this.surTrame(main),
      )
      this.cameraActive = true
      this.voileCamera.classList.add('cache')
      this.boutonCouper.hidden = false
      this.pastilleCamera.classList.add('active')
      this.etatCamera.textContent = 'Caméra active'
    } catch (erreur) {
      this.messageCamera.textContent = this.messageErreurCamera(erreur)
    } finally {
      this.boutonCamera.disabled = false
    }
  }

  /** Mappe une exception caméra à un message d'erreur lisible. */
  messageErreurCamera(erreur) {
    if (!erreur) return "Impossible d'initialiser la caméra ou le modèle."
    switch (erreur.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return "Accès caméra refusé. Autorisez la caméra pour reconnaître les lettres."
      case 'NotFoundError':
        return "Aucune caméra détectée sur cet appareil."
      case 'NotReadableError':
        return "La caméra est déjà utilisée par une autre application ou est en panne."
      default:
        return "Impossible d'ouvrir la caméra : " + (erreur.message || erreur)
    }
  }

  arreterCamera() {
    this.pipeline.arreter(this.video, this.canvas)
    this.cameraActive = false
    this.voileCamera.classList.remove('cache')
    this.boutonCouper.hidden = true
    this.pastilleCamera.classList.remove('active')
    this.etatCamera.textContent = 'En pause'
    this.messageCamera.textContent = ''
    this.afficherEtatMachine({ etat: ETATS.RECHERCHE, candidate: null, progression: 0 })
  }

  /* --------------------- Une trame de la caméra -------------------------- */

  surTrame(main) {
    let prediction = null
    if (main) {
      const vecteur = normaliserMain(main.landmarks, main.lateralite)
      if (vecteur) {
        prediction = this.classifieur.predire(vecteur)
        console.log(`[KNN Debug] Prédit : "${prediction.lettre}" | Confiance : ${Math.round(prediction.confiance * 100)}%`)
      }
    }
    const resultat = this.machine.pousser(prediction, performance.now())
    this.appliquerResultat(resultat, main !== null)
  }

  /** Applique un pas de machine à états à l'interface (aussi utilisé en démo). */
  appliquerResultat(resultat, mainVisible) {
    if (resultat.validation?.type === 'lettre') {
      this.ajouterLettre(resultat.validation.lettre)
      if (this.surValidationLettre && this.dernierVecteur) {
        this.surValidationLettre(resultat.validation.lettre, this.dernierVecteur)
      }
    } else if (resultat.validation?.type === 'espace') {
      // Une espace seulement si le texte ne se termine pas déjà par une.
      if (this.texte && !this.texte.endsWith(' ')) {
        this.texte += ' '
        this.afficherTexte()
      }
    }
    this.afficherEtatMachine(resultat, mainVisible)
  }

  ajouterLettre(lettre) {
    this.texte += lettre
    this.afficherTexte()
    // Animation « pop » sur la dernière lettre ajoutée.
    const derniere = this.texteCompose.lastElementChild
    if (derniere) derniere.classList.add('pop')
  }

  /* ------------------------------ Affichage ------------------------------ */

  afficherTexte() {
    // Chaque caractère dans son propre <span> pour pouvoir animer le dernier.
    this.texteCompose.textContent = ''
    for (const caractere of this.texte) {
      const span = document.createElement('span')
      span.textContent = caractere
      this.texteCompose.appendChild(span)
    }
    this.texteCompose.appendChild(this.curseur)

    const vide = this.texte.length === 0
    this.boutonEffacer.disabled = vide
    this.boutonToutEffacer.disabled = vide
    this.boutonLire.disabled = this.texte.trim().length === 0
  }

  afficherEtatMachine(resultat, mainVisible = false) {
    // Lettre candidate + anneau de progression (compteur / K).
    if (resultat.etat === ETATS.CONFIRMATION && resultat.candidate) {
      this.lettreCandidate.textContent = resultat.candidate
      this.lettreCandidate.classList.remove('discrete')
      this.anneau.style.strokeDashoffset =
        CIRCONFERENCE * (1 - resultat.progression)
      this.etatLettre.textContent = 'Maintenez…'
    } else if (resultat.etat === ETATS.VERROUILLE) {
      this.lettreCandidate.textContent = resultat.verrouillee ?? '·'
      this.lettreCandidate.classList.add('discrete')
      this.anneau.style.strokeDashoffset = 0
      this.etatLettre.textContent = 'Validée — relâchez la main'
    } else {
      this.lettreCandidate.textContent = '·'
      this.lettreCandidate.classList.add('discrete')
      this.anneau.style.strokeDashoffset = CIRCONFERENCE
      this.etatLettre.textContent = !this.cameraActive
        ? 'Caméra coupée'
        : mainVisible
          ? 'En attente d’une lettre stable'
          : 'Placez votre main dans le cadre'
    }
  }

  /* ----------------------- Réglages (curseurs) --------------------------- */

  brancherReglages() {
    // Chaque curseur modifie CONFIG en direct (pratique pour calibrer).
    const lier = (idCurseur, idValeur, cle, formater) => {
      const curseur = document.getElementById(idCurseur)
      const valeur = document.getElementById(idValeur)
      if (!curseur) return
      curseur.addEventListener('input', () => {
        CONFIG[cle] = Number(curseur.value)
        valeur.textContent = formater(CONFIG[cle])
      })
    }
    lier('reglage-seuil-haut', 'valeur-seuil-haut', 'SEUIL_HAUT', (v) => `${Math.round(v * 100)} %`)
    lier('reglage-seuil-bas', 'valeur-seuil-bas', 'SEUIL_BAS', (v) => `${Math.round(v * 100)} %`)
    lier('reglage-k', 'valeur-k', 'K_TRAMES', (v) => `${v} trames`)
    lier('reglage-espace', 'valeur-espace', 'DELAI_ESPACE_MS', (v) => `${(v / 1000).toFixed(1)} s`)
  }

  /* ------------------- Transcription (entendant → sourd·e) --------------- */

  brancherTranscription() {
    const boutonMicro = document.getElementById('bouton-micro')
    const flux = document.getElementById('flux-transcription')
    const interim = document.getElementById('ligne-interim')
    const pastille = document.getElementById('pastille-micro')
    const etatMicro = document.getElementById('etat-micro')
    let enEcoute = false

    this.transcription = new Transcription({
      surTexte: (texte) => {
        const p = document.createElement('p')
        p.className = 'bulle'
        p.textContent = texte
        flux.insertBefore(p, interim)
        flux.scrollTop = flux.scrollHeight
        document.getElementById('placeholder-transcription')?.remove()
      },
      surInterim: (texte) => {
        interim.textContent = texte
      },
      surEtat: (actif) => {
        enEcoute = actif
        boutonMicro.textContent = actif ? 'Arrêter le micro' : 'Activer le micro'
        boutonMicro.classList.toggle('fort', actif)
        pastille.classList.toggle('active', actif)
        etatMicro.textContent = actif ? 'Écoute' : 'Micro coupé'
      },
      surErreur: (message) => {
        interim.textContent = message
      },
    })

    if (!this.transcription.supporte) {
      boutonMicro.disabled = true
      document.getElementById('placeholder-transcription').textContent =
        "La reconnaissance vocale n'est pas disponible dans ce navigateur (essayez Chrome ou Edge)."
    }

    boutonMicro.addEventListener('click', () => {
      if (enEcoute) this.transcription.arreter()
      else this.transcription.demarrer()
    })
  }
}