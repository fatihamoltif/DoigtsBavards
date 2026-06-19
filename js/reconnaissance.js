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
    this.candidate = null
    this.compteur = 0
    this.toleranceUtilisee = 0
    this.verrouillee = null
    this.tramesRelachement = 0
    this.lettreDifferente = null
    this.tramesDifferente = 0
    this.derniereMainMs = null
    this.espaceEmis = false
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

    if (this.etat === ETATS.VERROUILLE) {
      const relache =
        prediction === null || prediction.confiance < c.SEUIL_BAS

      if (relache) {
        this.tramesRelachement += 1
        this.tramesDifferente = 0
      } else if (
        prediction.lettre !== this.verrouillee &&
        prediction.confiance >= c.SEUIL_HAUT
      ) {
        if (prediction.lettre === this.lettreDifferente) {
          this.tramesDifferente += 1
        } else {
          this.lettreDifferente = prediction.lettre
          this.tramesDifferente = 1
        }
        this.tramesRelachement = 0
      } else {
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
      }
      return this.resultat(null)
    }

    const stable =
      prediction !== null && prediction.confiance >= c.SEUIL_HAUT

    if (!stable) {
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
      this.candidate = prediction.lettre
      this.compteur = 1
      this.toleranceUtilisee = 0
    }
    this.etat = ETATS.CONFIRMATION

    if (this.compteur >= c.K_TRAMES) {
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
