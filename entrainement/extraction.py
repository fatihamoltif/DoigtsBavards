"""
Extraction des landmarks de main depuis les vidéos d'entraînement.

Parcourt entrainement/videos/<LETTRE>/<signeur>.mp4, détecte la main image par
image avec le MÊME modèle MediaPipe que le navigateur (modeles/hand_landmarker.task),
normalise chaque main en vecteur 63-dim (normalisation.py, identique au JS) et
range tout dans un jeu de données local.

Sortie : entrainement/donnees_landmarks.npz
  - X       : tableau (N, 63) des vecteurs normalisés
  - y       : tableau (N,) des lettres
  - signeurs: tableau (N,) du nom de signeur (pour le leave-one-signer-out)

Vie privée : on ne garde QUE des coordonnées normalisées. Aucune image n'est
enregistrée. Les vidéos restent locales (entrainement/videos/ est .gitignore).

Lancer :  python entrainement/extraction.py
"""

import os
import sys

import cv2
import numpy as np

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

from normalisation import normaliser_main, VERSION_NORMALISATION

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
DOSSIER_VIDEOS = os.path.join(ICI, "videos")
MODELE_TASK = os.path.join(RACINE, "modeles", "hand_landmarker.task")
SORTIE = os.path.join(ICI, "donnees_landmarks.npz")

# A–Z sauf J et Z (lettres à mouvement, traitées en phase 2).
LETTRES = [c for c in "ABCDEFGHIKLMNOPQRSTUVWXY"]

# Confiance minimale de détection (mêmes valeurs que le pipeline JS).
CONFIANCE_MIN = 0.5
EXTENSIONS = (".mp4", ".webm", ".mov", ".avi", ".mkv")


def creer_detecteur():
    """Crée le HandLandmarker MediaPipe en mode VIDEO (une seule main)."""
    options = mp_vision.HandLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODELE_TASK),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=CONFIANCE_MIN,
        min_hand_presence_confidence=CONFIANCE_MIN,
        min_tracking_confidence=CONFIANCE_MIN,
    )
    return mp_vision.HandLandmarker.create_from_options(options)


def extraire_video(detecteur, chemin):
    """
    Extrait les vecteurs normalisés d'une vidéo.
    Retourne une liste de vecteurs (63 floats) — un par image exploitable.
    """
    capture = cv2.VideoCapture(chemin)
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    vecteurs = []
    index = 0
    while True:
        ok, image_bgr = capture.read()
        if not ok:
            break
        # OpenCV lit en BGR ; MediaPipe attend du RGB.
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        image_mp = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)

        # Horodatage croissant en millisecondes (requis en mode VIDEO).
        timestamp_ms = int(index * 1000.0 / fps)
        resultat = detecteur.detect_for_video(image_mp, timestamp_ms)
        index += 1

        if not resultat.hand_landmarks:
            continue  # aucune main détectée sur cette image
        landmarks = resultat.hand_landmarks[0]
        lateralite = "Right"
        if resultat.handedness and resultat.handedness[0]:
            lateralite = resultat.handedness[0][0].category_name

        points = [(p.x, p.y, p.z) for p in landmarks]
        vecteur = normaliser_main(points, lateralite)
        if vecteur is not None:
            vecteurs.append(vecteur)

    capture.release()
    return vecteurs


def main():
    if not os.path.exists(MODELE_TASK):
        print(f"Modèle introuvable : {MODELE_TASK}")
        return 1
    if not os.path.isdir(DOSSIER_VIDEOS):
        print(f"Dossier de vidéos introuvable : {DOSSIER_VIDEOS}")
        print("Rangez vos clips dans entrainement/videos/<LETTRE>/<signeur>.mp4")
        return 1

    detecteur = creer_detecteur()
    X, y, signeurs = [], [], []
    resume = {}

    for lettre in LETTRES:
        dossier = os.path.join(DOSSIER_VIDEOS, lettre)
        if not os.path.isdir(dossier):
            continue
        for fichier in sorted(os.listdir(dossier)):
            if not fichier.lower().endswith(EXTENSIONS):
                continue
            signeur = os.path.splitext(fichier)[0]  # nom de fichier = signeur
            chemin = os.path.join(dossier, fichier)
            vecteurs = extraire_video(detecteur, chemin)
            for v in vecteurs:
                X.append(v)
                y.append(lettre)
                signeurs.append(signeur)
            resume.setdefault(lettre, {}).setdefault(signeur, 0)
            resume[lettre][signeur] += len(vecteurs)
            print(f"  {lettre}/{fichier} : {len(vecteurs)} images exploitables")

    detecteur.close()

    if not X:
        print("\nAucune donnée extraite. Vérifiez vos vidéos et l'éclairage.")
        return 1

    X = np.asarray(X, dtype=np.float32)
    y = np.asarray(y)
    signeurs = np.asarray(signeurs)
    np.savez(SORTIE, X=X, y=y, signeurs=signeurs, version=VERSION_NORMALISATION)

    print("\n--- Résumé de l'extraction ---")
    print(f"{X.shape[0]} échantillons, {X.shape[1]} dimensions.")
    print(f"Lettres couvertes : {sorted(set(y.tolist()))}")
    print(f"Signeurs : {sorted(set(signeurs.tolist()))}")
    print(f"Jeu de données écrit dans {SORTIE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
