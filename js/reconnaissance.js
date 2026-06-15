/*
 * Machine à états de validation des lettres.
 *
 * LE point critique : sans elle, la lettre détectée serait ajoutée à chaque
 * trame (≈ 30 fois par seconde) et l'application écrirait en boucle.
 * La machine garantit : UNE lettre ajoutée par geste volontaire.
 *
 * États :
 *   RECHERCHE     on lit les prédictions, rien n'est validé.
 *   CONFIRMATION  une lettre dépasse le seuil haut : on compte les trames
 *                 stables consécutives (anneau de progression dans l'UI).
 *                 Si la lettre change ou la confiance retombe → compteur à zéro.
 *   VERROUILLE    la lettre vient d'être validée (ajoutée UNE fois au texte).
 *                 On ignore tout jusqu'au relâchement : main absente,
 *                 confiance < seuil bas, ou autre lettre tenue M trames.
 *
 * Hystérésis : SEUIL_HAUT pour valider, SEUIL_BAS pour relâcher.
 * Pour répéter une lettre (« ELLE ») : on baisse la main, puis on resigne.
 *
 * Ce module est pur (aucune dépendance navigateur) : il se teste avec Node
 * (voir scripts/demo-saisie.mjs).
 */

export const ETATS = {
  RECHERCHE: 'recherche',
  CONFIRMATION: 'confirmation',
  VERROUILLE: 'verrouille',
}

export class MachineLettres {
  /**
   * @param {object} config — voir js/config.js (SEUIL_HAUT, SEUIL_BAS,
   *                          K_TRAMES, M_TRAMES, RELACHEMENT_TRAMES,
   *                          DELAI_ESPACE_MS).
   */
  constructor(config) {
    this.config = config
    this.reinitialiser()
  }

  reinitialiser() {
    this.etat = ETATS.RECHERCHE
    this.candidate = null // lettre en cours de confirmation
    this.compteur = 0 // trames stables pour la candidate
    this.toleranceUtilisee = 0 // trames ratées absorbées pendant la confirmation
    this.verrouillee = null // lettre validée, en attente de relâchement
    this.tramesRelachement = 0 // preuves de relâchement consécutives
    this.lettreDifferente = null // autre lettre tenue pendant le verrou
    this.tramesDifferente = 0
    this.derniereMainMs = null // horodatage de la dernière main vue
    this.espaceEmis = false // une seule espace par pause
  }

  /**
   * Traite la prédiction d'UNE trame.
   *
   * @param {{lettre: string, confiance: number} | null} prediction
   *        — null si aucune main n'est détectée.
   * @param {number} maintenantMs — horodatage de la trame (performance.now()).
   * @returns {{etat: string, candidate: string|null, progression: number,
   *            validation: {type:'lettre', lettre:string}|{type:'espace'}|null}}
   *        — `progression` ∈ [0,1] alimente l'anneau de l'UI ;
   *          `validation` est non nul UNIQUEMENT à la trame qui valide.
   */
  pousser(prediction, maintenantMs) {
    const c = this.config

    // --- Gestion de l'espace : main absente assez longtemps → une espace. ---
    if (prediction === null) {
      if (this.derniereMainMs !== null && !this.espaceEmis &&
          maintenantMs - this.derniereMainMs >= c.DELAI_ESPACE_MS) {
        this.espaceEmis = true
        this.etat = ETATS.RECHERCHE
        this.candidate = null
        this.compteur = 0
        this.toleranceUtilisee = 0
        this.verrouillee = null
        return this.resultat({ type: 'espace' })
      }
    } else {
      this.derniereMainMs = maintenantMs
      this.espaceEmis = false
    }

    // --- État VERROUILLE : on attend un relâchement, rien n'est ajouté. ---
    if (this.etat === ETATS.VERROUILLE) {
      const relache =
        prediction === null || prediction.confiance < c.SEUIL_BAS

      if (relache) {
        // Main baissée ou confiance retombée : on accumule la preuve.
        this.tramesRelachement += 1
        this.tramesDifferente = 0
      } else if (
        prediction.lettre !== this.verrouillee &&
        prediction.confiance >= c.SEUIL_HAUT
      ) {
        // Une AUTRE lettre est tenue franchement : autre forme de relâchement.
        if (prediction.lettre === this.lettreDifferente) {
          this.tramesDifferente += 1
        } else {
          this.lettreDifferente = prediction.lettre
          this.tramesDifferente = 1
        }
        this.tramesRelachement = 0
      } else {
        // La même lettre est toujours tenue : on reste verrouillé.
        this.tramesRelachement = 0
        this.tramesDifferente = 0
      }

      const deverrouille =
        this.tramesRelachement >= c.RELACHEMENT_TRAMES ||
        this.tramesDifferente >= c.M_TRAMES

      if (deverrouille) {
        this.etat = ETATS.RECHERCHE
        this.verrouillee = null
        this.tramesRelachement = 0
        this.lettreDifferente = null
        this.tramesDifferente = 0
        // La trame courante sera prise en compte dès la prochaine itération.
      }
      return this.resultat(null)
    }

    // --- États RECHERCHE / CONFIRMATION. ---
    const stable =
      prediction !== null && prediction.confiance >= c.SEUIL_HAUT

    if (!stable) {
      // Trame ratée (main floue, confiance retombée). Pendant la confirmation,
      // on en tolère quelques-unes sans perdre le compteur — la caméra rate
      // parfois une trame. Au-delà de la tolérance : retour à zéro
      // (abstention : on n'ajoute jamais rien tant que rien n'est confirmé).
      if (this.etat === ETATS.CONFIRMATION &&
          this.toleranceUtilisee < c.TOLERANCE_TRAMES) {
        this.toleranceUtilisee += 1
        return this.resultat(null)
      }
      this.etat = ETATS.RECHERCHE
      this.candidate = null
      this.compteur = 0
      this.toleranceUtilisee = 0
      return this.resultat(null)
    }

    if (prediction.lettre === this.candidate) {
      this.compteur += 1
      this.toleranceUtilisee = 0
    } else {
      // Nouvelle candidate : le compteur repart à zéro pour CETTE lettre.
      this.candidate = prediction.lettre
      this.compteur = 1
      this.toleranceUtilisee = 0
    }
    this.etat = ETATS.CONFIRMATION

    if (this.compteur >= c.K_TRAMES) {
      // Validation : la lettre est ajoutée UNE SEULE FOIS, puis verrou.
      const lettre = this.candidate
      this.etat = ETATS.VERROUILLE
      this.verrouillee = lettre
      this.candidate = null
      this.compteur = 0
      this.toleranceUtilisee = 0
      this.tramesRelachement = 0
      return this.resultat({ type: 'lettre', lettre })
    }

    return this.resultat(null)
  }

  /** Construit l'objet de sortie standard de pousser(). */
  resultat(validation) {
    return {
      etat: this.etat,
      candidate: this.candidate,
      progression:
        this.etat === ETATS.CONFIRMATION
          ? Math.min(1, this.compteur / this.config.K_TRAMES)
          : 0,
      verrouillee: this.verrouillee,
      validation,
    }
  }
}
