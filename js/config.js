/*
 * Configuration globale de l'application.
 *
 * Tous les réglages de la reconnaissance sont ici, en un seul endroit,
 * pour pouvoir les expliquer et les ajuster facilement (curseurs en mode
 * réglages dans l'interface).
 */

export const CONFIG = {
  // --- Machine à états de validation des lettres ---

  // Seuil HAUT : confiance minimale pour qu'une trame compte vers la validation.
  SEUIL_HAUT: 0.85,

  // Seuil BAS : en dessous, on considère que la main a « relâché » la lettre.
  // Deux seuils distincts (hystérésis) pour éviter le tremblement.
  SEUIL_BAS: 0.5,

  // K : nombre de trames consécutives stables pour valider une lettre.
  // À ~30 trames/seconde, 12 trames ≈ 0,4 s de maintien volontaire.
  K_TRAMES: 12,

  // M : nombre de trames d'une lettre clairement différente pour relâcher
  // le verrou (l'utilisateur est passé à une autre lettre).
  M_TRAMES: 6,

  // Tolérance : nombre de trames ratées (main floue, confiance retombée)
  // acceptées PENDANT la confirmation sans remettre le compteur à zéro.
  // La caméra rate parfois une trame ; sans cette tolérance, il faudrait
  // K trames parfaitement consécutives et la validation deviendrait pénible.
  TOLERANCE_TRAMES: 2,

  // Trames consécutives de « preuve de relâchement » (main absente ou
  // confiance < SEUIL_BAS) avant de déverrouiller. Évite qu'une seule trame
  // ratée par la caméra ne déverrouille et ne fasse écrire la lettre en double.
  RELACHEMENT_TRAMES: 5,

  // Délai sans main détectée avant d'insérer une espace (millisecondes).
  DELAI_ESPACE_MS: 1200,

  // --- Parole ---
  LANGUE: 'fr-FR',
}

// Alphabet reconnu (dactylologie LSF).
export const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

// Lettres comportant un MOUVEMENT (tracées dans l'espace) : elles ne sont pas
// une simple configuration statique et demanderont une courte fenêtre
// temporelle. Référence LSF : J et Z. Liste à étendre si besoin.
export const LETTRES_MOBILES = new Set(['J', 'Z'])

// Mention de confidentialité affichée dans l'interface.
export const MENTION_CONFIDENTIALITE =
  'Aucune vidéo ne quitte votre appareil — seules des coordonnées de squelette sont traitées, en local.'
