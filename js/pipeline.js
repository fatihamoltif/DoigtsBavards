/*
 * Pipeline caméra → MediaPipe Hands → landmarks.
 *
 * Sécurité / vie privée (principes appliqués ici) :
 *   - la caméra n'est demandée QUE sur clic explicite (jamais au chargement) ;
 *   - audio: false : on ne demande jamais le micro avec la caméra ;
 *   - les pistes vidéo sont ARRÊTÉES à l'arrêt (le voyant caméra s'éteint) ;
 *   - aucun pixel n'est stocké ni transmis : on extrait des coordonnées,
 *     trame par trame, et c'est tout ;
 *   - le runtime WASM et le modèle sont AUTO-HÉBERGÉS (dossiers mediapipe/
 *     et modeles/) : aucun appel à un serveur tiers, fonctionne hors ligne.
 */

import { FilesetResolver, HandLandmarker } from '../lib/vision_bundle.mjs'

const LIAISONS_MAIN = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

export class PipelineCamera {
  constructor() {
    this.latenceMs = 0
    this.flux = null
    this.detecteur = null
    this.boucleActive = false
    this.idBoucle = null
  }

  async chargerModele() {
    if (this.detecteur) return
    const fileset = await FilesetResolver.forVisionTasks('mediapipe/wasm')
    const options = {
      baseOptions: { modelAssetPath: 'modeles/hand_landmarker.task', delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }
    try {
      this.detecteur = await HandLandmarker.createFromOptions(fileset, options)
    } catch (erreur) {
      console.warn('GPU indisponible, repli sur CPU.', erreur)
      options.baseOptions.delegate = 'CPU'
      this.detecteur = await HandLandmarker.createFromOptions(fileset, options)
    }
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
  try {
    this.flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
  } catch (erreur) {
    throw new Error(this.messageErreurCamera(erreur))
  }

  video.srcObject = this.flux
  await video.play()

  await this.chargerModele()

  const contexte = canvas.getContext('2d')
  this.boucleActive = true

  const boucle = () => {
    if (!this.boucleActive) return

    if (video.readyState >= 2) {
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }

      const t0 = performance.now()
      const resultat = this.detecteur.detectForVideo(video, t0)
      const dureeDetection = performance.now() - t0

      this.latenceMs =
        this.latenceMs === 0
          ? dureeDetection
          : 0.8 * this.latenceMs + 0.2 * dureeDetection

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
    ctx.strokeStyle = '#D5B893'
    ctx.fillStyle = '#FBFAF8'

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
  messageErreurCamera(erreur) {
  switch (erreur.name) {
    case 'NotAllowedError':  return "Accès caméra refusé. Autorisez la caméra puis réessayez."
    case 'NotFoundError':    return "Aucune caméra détectée sur cet appareil."
    case 'NotReadableError': return "La caméra est déjà utilisée par une autre application."
    default:                 return "Impossible d'ouvrir la caméra : " + erreur.message
    }
  }
}