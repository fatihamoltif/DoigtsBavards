/*
 * Configuration globale de l'application.
 *
 * Tous les réglages de la reconnaissance sont ici, en un seul endroit,
 * pour pouvoir les expliquer et les ajuster facilement (curseurs en mode
 * réglages dans l'interface).
 */

export const CONFIG = {

  SEUIL_HAUT: 0.65,

  SEUIL_BAS: 0.5,

  K_TRAMES: 7,

  M_TRAMES: 6,

  TOLERANCE_TRAMES: 2,

  RELACHEMENT_TRAMES: 5,

  DELAI_ESPACE_MS: 1200,

  LANGUE: 'fr-FR',
}

export const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

export const LETTRES_MOBILES = new Set(['J', 'Z'])

export const MENTION_CONFIDENTIALITE =
  'Aucune vidéo ne quitte votre appareil — seules des coordonnées de squelette sont traitées, en local.'
