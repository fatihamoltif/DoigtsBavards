/*
 * Parole ↔ texte via la Web Speech API.
 *
 *   - Transcription (sens entendant → sourd·e) : SpeechRecognition.
 *     Note de transparence : sur la plupart des navigateurs, l'AUDIO du micro
 *     est traité par le service vocal du fournisseur du navigateur. Cela ne
 *     concerne jamais la vidéo, qui reste 100 % locale.
 *   - Synthèse (lecture du texte composé) : SpeechSynthesis, locale.
 */

import { CONFIG } from './config.js'

/* ----------------------------- Transcription ----------------------------- */

export class Transcription {
  /**
   * @param {{surTexte: (texte: string) => void,
   *          surInterim: (texte: string) => void,
   *          surEtat: (enEcoute: boolean) => void,
   *          surErreur: (message: string) => void}} rappels
   */
  constructor(rappels) {
    this.rappels = rappels
    this.reconnaissance = null
    const Reconnaissance =
      window.SpeechRecognition || window.webkitSpeechRecognition
    this.supporte = Boolean(Reconnaissance)
    this.Reconnaissance = Reconnaissance
  }

  demarrer() {
    if (!this.supporte) return
    const rec = new this.Reconnaissance()
    rec.lang = CONFIG.LANGUE
    rec.continuous = true
    rec.interimResults = true

    rec.onstart = () => this.rappels.surEtat(true)
    rec.onend = () => this.rappels.surEtat(false)
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.rappels.surErreur('Accès micro refusé.')
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        this.rappels.surErreur(`Erreur de reconnaissance vocale : ${e.error}`)
      }
    }
    rec.onresult = (evenement) => {
      let interim = ''
      for (let i = evenement.resultIndex; i < evenement.results.length; i++) {
        const resultat = evenement.results[i]
        const texte = resultat[0].transcript.trim()
        if (resultat.isFinal) {
          if (texte) this.rappels.surTexte(texte)
        } else {
          interim += texte
        }
      }
      this.rappels.surInterim(interim)
    }

    this.reconnaissance = rec
    rec.start()
  }

  arreter() {
    this.reconnaissance?.stop()
  }
}

/* ------------------------------- Synthèse -------------------------------- */

export function lireAVoixHaute(texte) {
  if (!('speechSynthesis' in window) || !texte) return
  window.speechSynthesis.cancel()
  const enonce = new SpeechSynthesisUtterance(texte)
  enonce.lang = CONFIG.LANGUE
  window.speechSynthesis.speak(enonce)
}
