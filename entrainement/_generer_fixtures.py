"""
Génère entrainement/fixtures_landmarks.json : des jeux de 21 landmarks
d'exemple, partagés par le test de cohérence Python ↔ JS.

On part d'une main « canonique » (forme plausible à 21 points) à laquelle on
applique des transformations rigides variées (rotation 3D, échelle, position)
plus un peu de bruit, pour vérifier que la normalisation efface bien ces
variations de façon IDENTIQUE des deux côtés. Une main est marquée 'Left'.

Reproductible (graine fixe). À relancer seulement si on veut d'autres exemples.
"""

import json
import math
import os
import random

random.seed(2024)

# Main canonique approximative : 21 points (x, y, z) ~ disposition MediaPipe.
# (Valeurs plausibles, doigts vers le haut, paume face caméra.)
CANONIQUE = [
    (0.50, 0.90, 0.00),  # 0 poignet
    (0.42, 0.82, -0.01), (0.36, 0.74, -0.02), (0.32, 0.67, -0.03), (0.29, 0.61, -0.04),  # pouce
    (0.46, 0.62, 0.00), (0.45, 0.50, 0.00), (0.44, 0.42, 0.00), (0.44, 0.35, 0.00),  # index
    (0.52, 0.61, 0.00), (0.52, 0.48, 0.00), (0.52, 0.39, 0.00), (0.52, 0.31, 0.00),  # majeur
    (0.58, 0.62, 0.00), (0.59, 0.50, 0.00), (0.59, 0.42, 0.00), (0.59, 0.35, 0.00),  # annulaire
    (0.63, 0.65, 0.00), (0.65, 0.55, 0.00), (0.66, 0.48, 0.00), (0.67, 0.42, 0.00),  # auriculaire
]


def _rotation(angles):
    """Matrice de rotation 3D à partir d'angles (rx, ry, rz) en radians."""
    rx, ry, rz = angles
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    # R = Rz * Ry * Rx
    return [
        [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
        [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
        [-sy, cy * sx, cy * cx],
    ]


def _appliquer(mat, v):
    return [
        mat[0][0] * v[0] + mat[0][1] * v[1] + mat[0][2] * v[2],
        mat[1][0] * v[0] + mat[1][1] * v[1] + mat[1][2] * v[2],
        mat[2][0] * v[0] + mat[2][1] * v[1] + mat[2][2] * v[2],
    ]


def transformer(echelle, angles, translation, bruit):
    mat = _rotation(angles)
    points = []
    for p in CANONIQUE:
        q = _appliquer(mat, [c * echelle for c in p])
        points.append([
            q[0] + translation[0] + random.uniform(-bruit, bruit),
            q[1] + translation[1] + random.uniform(-bruit, bruit),
            q[2] + translation[2] + random.uniform(-bruit, bruit),
        ])
    return points


echantillons = [
    {"nom": "frontale", "lateralite": "Right",
     "landmarks": transformer(1.0, (0, 0, 0), (0, 0, 0), 0.0)},
    {"nom": "petite-loin", "lateralite": "Right",
     "landmarks": transformer(0.55, (0.1, -0.2, 0.15), (0.2, 0.1, 0.3), 0.002)},
    {"nom": "grande-proche-inclinee", "lateralite": "Right",
     "landmarks": transformer(1.6, (-0.3, 0.25, -0.4), (-0.1, -0.05, -0.2), 0.003)},
    {"nom": "tournee", "lateralite": "Right",
     "landmarks": transformer(1.1, (0.2, 0.5, 0.6), (0.05, 0.15, 0.1), 0.002)},
    {"nom": "main-gauche", "lateralite": "Left",
     "landmarks": transformer(1.0, (0, 0, 0.1), (0, 0, 0), 0.001)},
]

chemin = os.path.join(os.path.dirname(__file__), "fixtures_landmarks.json")
with open(chemin, "w", encoding="utf-8") as f:
    json.dump(echantillons, f, indent=2)
print(f"{len(echantillons)} échantillons écrits dans {chemin}")
