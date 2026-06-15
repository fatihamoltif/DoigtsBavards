/*
 * Pipeline caméra → MediaPipe Hands → landmarks.
 *
 * Sécurité / vie privée (principes appliqués ici) :
 *   - la caméra n'est demandée QUE sur clic explicite (jamais au chargement) ;
 *   - `audio: false` : on ne demande jamais le micro avec la caméra ;
 *   - les pistes vidéo sont ARRÊTÉES à l'arrêt (le voyant caméra s'éteint) ;
 *   - aucun pixel n'est stocké ni transmis : on extrait des coordonnées,
 *     trame par trame, et c'est tout ;
 *   - le runtime WASM et le modèle sont AUTO-HÉBERGÉS (dossiers mediapipe/
 *     et modeles/) : aucun appel à un serveur tiers, fonctionne hors ligne.
 */

import { FilesetResolver, HandLandmarker } from '../lib/vision_bundle.mjs'

// Connexions entre les 21 points, pour dessiner le squelette de la main.
const LIAISONS_MAIN = [
  [0, 1], [1, 2], [2, 3], [3, 4], // pouce
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // majeur
  [9, 13], [13, 14], [14, 15], [15, 16], // annulaire
  [13, 17], [17, 18], [18, 19], [19, 20], // auriculaire
  [0, 17], // paume
]

export class PipelineCamera {
  constructor() {
    this.flux = null // MediaStream de la webcam
    this.detecteur = null // HandLandmarker MediaPipe
    this.boucleActive = false
    this.idBoucle = null
  }

  /** Charge le modèle MediaPipe (une seule fois). */
  async chargerModele() {
    if (this.detecteur) return
    const fileset = await FilesetResolver.forVisionTasks('mediapipe/wasm')
    this.detecteur = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: 'modeles/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1, // dactylologie : une seule main
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
  }

  /**
   * Démarre la caméra et la boucle de détection.
   *
   * @param {HTMLVideoElement} video — élément où afficher le flux.
   * @param {HTMLCanvasElement} canvas — superposition du squelette.
   * @param {(main: {landmarks: object[], lateralite: string} | null) => void} surTrame
   *        — appelée à chaque trame avec la main détectée (ou null).
   */
  async demarrer(video, canvas, surTrame) {
    // Caméra seule, jamais le micro (moindre privilège).
    this.flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
    video.srcObject = this.flux
    await video.play()

    await this.chargerModele()

    const contexte = canvas.getContext('2d')
    this.boucleActive = true

    const boucle = () => {
      if (!this.boucleActive) return

      if (video.readyState >= 2) {
        // Le canvas suit la taille réelle de la vidéo.
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        const resultat = this.detecteur.detectForVideo(video, performance.now())
        const landmarks = resultat.landmarks && resultat.landmarks[0]

        if (landmarks) {
          const lateralite =
            (resultat.handedness?.[0]?.[0]?.categoryName) || 'Right'
          this.dessinerMain(contexte, landmarks, canvas.width, canvas.height)
          surTrame({ landmarks, lateralite })
        } else {
          contexte.clearRect(0, 0, canvas.width, canvas.height)
          surTrame(null)
        }
      }
      this.idBoucle = requestAnimationFrame(boucle)
    }
    this.idBoucle = requestAnimationFrame(boucle)
  }

  /** Dessine le squelette de la main (zone live : contraste fort). */
  dessinerMain(ctx, points, largeur, hauteur) {
    ctx.clearRect(0, 0, largeur, hauteur)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#D5B893' // tan : lisible sur la vidéo
    ctx.fillStyle = '#FBFAF8' // blanc cassé

    for (const [a, b] of LIAISONS_MAIN) {
      ctx.beginPath()
      ctx.moveTo(points[a].x * largeur, points[a].y * hauteur)
      ctx.lineTo(points[b].x * largeur, points[b].y * hauteur)
      ctx.stroke()
    }
    for (const p of points) {
      ctx.beginPath()
      ctx.arc(p.x * largeur, p.y * hauteur, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** Arrête la boucle ET libère la caméra (le voyant s'éteint). */
  arreter(video, canvas) {
    this.boucleActive = false
    if (this.idBoucle !== null) {
      cancelAnimationFrame(this.idBoucle)
      this.idBoucle = null
    }
    if (this.flux) {
      for (const piste of this.flux.getTracks()) piste.stop()
      this.flux = null
    }
    if (video) video.srcObject = null
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }
}
