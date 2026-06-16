/*
 * Normalisation des 21 landmarks de la main → vecteur de 63 nombres.
 *
 * C'est la clé de la robustesse : après normalisation, le vecteur ne dépend
 * plus de la position de la main dans l'image, de sa distance à la caméra,
 * ni de l'inclinaison du poignet. Trois opérations :
 *
 *   1. TRANSLATION : on place l'origine sur le POIGNET (point 0) ;
 *   2. ÉCHELLE     : on divise par la distance poignet → base du majeur
 *                    (point 9), une longueur stable de la main ;
 *   3. ROTATION    : on exprime les points dans un repère attaché à la main
 *                    (axe Y = poignet→majeur, axe Z = normale de la paume).
 *
 * En plus : les mains GAUCHES sont miroitées pour ressembler aux droites,
 * afin qu'un même signe donne le même vecteur quelle que soit la main.
 */

const POIGNET = 0
const BASE_MAJEUR = 9
const BASE_INDEX = 5
const BASE_AURICULAIRE = 17

/*
 * Empreinte de la convention de normalisation. Le modèle entraîné en Python
 * porte la même empreinte ; si elles diffèrent, c'est que l'entraînement et
 * l'inférence ne parlent pas le même langage → on refuse le modèle plutôt
 * que de prédire n'importe quoi. À incrémenter si on change la normalisation.
 */
export const VERSION_NORMALISATION = 'main-63d-v2'

// Petites fonctions de calcul vectoriel 3D (lisibles, sans bibliothèque).
function soustraire(a, b) {
  return [a.x - b.x, a.y - b.y, a.z - b.z]
}
function produitScalaire(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function produitVectoriel(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}
function longueur(a) {
  return Math.hypot(a[0], a[1], a[2])
}
function normaliserVecteur(a) {
  const n = longueur(a)
  return n > 1e-9 ? [a[0] / n, a[1] / n, a[2] / n] : [0, 0, 0]
}

/**
 * @param {{x:number,y:number,z:number}[]} landmarks — 21 points MediaPipe.
 * @param {'Left'|'Right'} lateralite — main détectée (étiquette MediaPipe).
 * @returns {Float32Array|null} vecteur 63-dim, ou null si géométrie invalide.
 */
export function normaliserMain(landmarks, lateralite = 'Right') {
  if (!landmarks || landmarks.length < 21) return null

  const poignet = landmarks[POIGNET]
  const majeur = landmarks[BASE_MAJEUR]

  // Échelle de référence : distance poignet → base du majeur.
  const versMajeur = soustraire(majeur, poignet)
  const echelle = longueur(versMajeur)
  if (echelle < 1e-6) return null // main dégénérée (mauvaise détection)

  // Repère canonique de la main.
  const axeY = normaliserVecteur(versMajeur)
  const traversPaume = soustraire(landmarks[BASE_INDEX], landmarks[BASE_AURICULAIRE])
  const axeZ = normaliserVecteur(produitVectoriel(traversPaume, axeY)) // normale paume
  const axeX = normaliserVecteur(produitVectoriel(axeY, axeZ))
  if (longueur(axeZ) < 1e-6) return null

  // Miroir gauche → droite : on inverse l'axe X.
  const miroir = lateralite === 'Left' ? -1 : 1

  const vecteur = new Float32Array(63)
  for (let i = 0; i < 21; i++) {
    const relatif = soustraire(landmarks[i], poignet)
    vecteur[i * 3] = (produitScalaire(relatif, axeX) / echelle) 
    vecteur[i * 3 + 1] = produitScalaire(relatif, axeY) / echelle
    vecteur[i * 3 + 2] = produitScalaire(relatif, axeZ) / echelle* miroir
  }
  return vecteur
}
