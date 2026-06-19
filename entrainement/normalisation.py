"""
Normalisation des 21 landmarks de la main → vecteur de 63 nombres.

PORT EXACT de js/normalisation.js. Les deux DOIVENT produire le même vecteur
pour les mêmes landmarks, sinon le modèle entraîné en Python ne veut rien dire
pour l'inférence dans le navigateur (voir entrainement/test_coherence.py).

Trois opérations, identiques au JS :
  1. TRANSLATION : origine sur le POIGNET (point 0) ;
  2. ÉCHELLE     : division par la distance poignet → base du majeur (point 9) ;
  3. ROTATION    : projection dans un repère attaché à la main
   a                (axe Y = poignet→majeur, axe Z = normale de la paume).
En plus : les mains GAUCHES sont miroitées sur les droites (axe X inversé).

On reste en Python pur (pas de numpy) pour effectuer EXACTEMENT les mêmes
opérations scalaires que le JS. Le vecteur est ensuite arrondi en float32,
comme le Float32Array du navigateur.
"""

import math
import struct

VERSION_NORMALISATION = "main-63d-v2"

POIGNET = 0
BASE_MAJEUR = 9
BASE_INDEX = 5
BASE_AURICULAIRE = 17


def _soustraire(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def _produit_scalaire(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _produit_vectoriel(a, b):
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]


def _longueur(a):
    return math.hypot(a[0], a[1], a[2])


def _normaliser_vecteur(a):
    n = _longueur(a)
    if n > 1e-9:
        return [a[0] / n, a[1] / n, a[2] / n]
    return [0.0, 0.0, 0.0]


def _en_float32(x):
    """Arrondit un float64 au float32 le plus proche, comme un Float32Array JS."""
    return struct.unpack("f", struct.pack("f", x))[0]


def normaliser_main(landmarks, lateralite="Right"):
    """
    landmarks : liste de 21 points, chacun (x, y, z) — tuple/liste ou objet
                avec .x/.y/.z. lateralite : 'Left' ou 'Right'.
    Retourne une liste de 63 floats (float32), ou None si géométrie invalide.
    """
    if landmarks is None or len(landmarks) < 21:
        return None

    pts = [_en_xyz(p) for p in landmarks]
    poignet = pts[POIGNET]
    majeur = pts[BASE_MAJEUR]

    vers_majeur = _soustraire(majeur, poignet)
    echelle = _longueur(vers_majeur)
    if echelle < 1e-6:
        return None

    axe_y = _normaliser_vecteur(vers_majeur)
    travers_paume = _soustraire(pts[BASE_INDEX], pts[BASE_AURICULAIRE])
    axe_z = _normaliser_vecteur(_produit_vectoriel(travers_paume, axe_y))
    axe_x = _normaliser_vecteur(_produit_vectoriel(axe_y, axe_z))
    if _longueur(axe_z) < 1e-6:
        return None

    miroir = -1.0 if lateralite == "Left" else 1.0

    vecteur = [0.0] * 63
    for i in range(21):
        relatif = _soustraire(pts[i], poignet)
        vecteur[i * 3]     = _en_float32(_produit_scalaire(relatif, axe_x) / echelle)
        vecteur[i * 3 + 1] = _en_float32(_produit_scalaire(relatif, axe_y) / echelle)
        vecteur[i * 3 + 2] = _en_float32((_produit_scalaire(relatif, axe_z) / echelle) * miroir)
    return vecteur


def _en_xyz(p):
    """Accepte un point sous forme (x,y,z), [x,y,z] ou objet .x/.y/.z."""
    if hasattr(p, "x"):
        return (p.x, p.y, p.z)
    return (p[0], p[1], p[2])
