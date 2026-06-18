#!/usr/bin/env python3
"""
Convertit les exports navigateur `capture_*.json` en `donnees_landmarks.npz`.

Entrée attendue par défaut : fichiers `capture_*.json` dans le même dossier que ce script.
Sortie par défaut : `donnees_landmarks.npz` dans le même dossier que ce script.

Le script ne re-normalise rien : il réutilise les vecteurs 63D déjà normalisés.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

import numpy as np


DIMENSION_ATTENDUE = 63

# Permet de lancer le script depuis la racine du projet ou depuis `entrainement/`.
DOSSIER_SCRIPT = Path(__file__).resolve().parent
RACINE_PROJET = DOSSIER_SCRIPT.parent
for chemin in (DOSSIER_SCRIPT, RACINE_PROJET):
    if str(chemin) not in sys.path:
        sys.path.insert(0, str(chemin))

try:
    from normalisation import VERSION_NORMALISATION
except ImportError as exc:
    raise SystemExit(
        "Impossible d'importer VERSION_NORMALISATION depuis normalisation.py. "
        "Vérifie que normalisation.py est accessible depuis la racine du projet "
        "ou depuis le dossier entrainement/."
    ) from exc


def est_vecteur_63_possible(valeur: Any) -> bool:
    """Détecte le cas de repli où `trames` contient directement un vecteur 63D."""
    if not isinstance(valeur, list) or len(valeur) != DIMENSION_ATTENDUE:
        return False
    return not any(isinstance(element, (list, dict)) for element in valeur)


def objets_capture(contenu_json: Any) -> list[dict[str, Any]]:
    """Accepte soit un objet JSON unique, soit une liste d'objets JSON."""
    if isinstance(contenu_json, dict):
        return [contenu_json]
    if isinstance(contenu_json, list):
        return [objet for objet in contenu_json if isinstance(objet, dict)]
    return []


def trames_capture(objet: dict[str, Any]) -> Iterable[Any]:
    """Lit `trames` en priorité, puis `vecteur` en repli."""
    trames = objet.get("trames")
    if trames is not None:
        if est_vecteur_63_possible(trames):
            yield trames
            return
        if isinstance(trames, list):
            yield from trames
            return

    vecteur = objet.get("vecteur")
    if vecteur is not None:
        yield vecteur


def convertir_vecteur_63(vecteur: Any) -> np.ndarray | None:
    """Retourne un vecteur float32 de taille 63, ou None si la trame est invalide."""
    if not isinstance(vecteur, list) or len(vecteur) != DIMENSION_ATTENDUE:
        return None

    try:
        tableau = np.asarray(vecteur, dtype=np.float32)
    except (TypeError, ValueError):
        return None

    if tableau.shape != (DIMENSION_ATTENDUE,):
        return None
    if not np.all(np.isfinite(tableau)):
        return None
    return tableau


def charger_captures(dossier: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray, dict[str, Any]]:
    fichiers = sorted(dossier.glob("capture_*.json"))
    if not fichiers:
        raise SystemExit(f"Aucun fichier capture_*.json trouvé dans : {dossier}")

    X: list[np.ndarray] = []
    y: list[str] = []
    signeurs: list[str] = []

    stats = {
        "fichiers_lus": 0,
        "objets_lus": 0,
        "objets_ignores_sans_lettre_ou_signeur": 0,
        "trames_ignorees_invalides": 0,
        "trames_conservees": 0,
        "par_lettre": Counter(),
        "par_signeur": Counter(),
    }

    for fichier in fichiers:
        try:
            with fichier.open("r", encoding="utf-8") as flux:
                contenu = json.load(flux)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"JSON invalide dans {fichier} : {exc}") from exc

        stats["fichiers_lus"] += 1

        for objet in objets_capture(contenu):
            stats["objets_lus"] += 1

            lettre = str(objet.get("lettre", "")).strip()
            signeur = str(objet.get("signeur", "")).strip()

            if not lettre or not signeur:
                stats["objets_ignores_sans_lettre_ou_signeur"] += 1
                continue

            for trame in trames_capture(objet):
                vecteur = convertir_vecteur_63(trame)
                if vecteur is None:
                    stats["trames_ignorees_invalides"] += 1
                    continue

                X.append(vecteur)
                y.append(lettre)
                signeurs.append(signeur)
                stats["trames_conservees"] += 1
                stats["par_lettre"][lettre] += 1
                stats["par_signeur"][signeur] += 1

    if not X:
        raise SystemExit(
            "Aucune trame valide trouvée. Vérifie que les captures contiennent "
            "bien `lettre`, `signeur` et des vecteurs de longueur 63."
        )

    return (
        np.vstack(X).astype(np.float32, copy=False),
        np.asarray(y, dtype=str),
        np.asarray(signeurs, dtype=str),
        stats,
    )


def afficher_stats(stats: dict[str, Any], sortie: Path, X: np.ndarray) -> None:
    print("Conversion terminée.")
    print(f"  Sortie                 : {sortie}")
    print(f"  Version normalisation  : {VERSION_NORMALISATION}")
    print(f"  Fichiers lus           : {stats['fichiers_lus']}")
    print(f"  Objets lus             : {stats['objets_lus']}")
    print(f"  Trames conservées      : {stats['trames_conservees']}")
    print(f"  Trames ignorées        : {stats['trames_ignorees_invalides']}")
    print(f"  Objets ignorés         : {stats['objets_ignores_sans_lettre_ou_signeur']}")
    print(f"  X                      : {X.shape} float32")
    print("  Répartition lettres    : " + ", ".join(
        f"{lettre}={nb}" for lettre, nb in sorted(stats["par_lettre"].items())
    ))
    print("  Répartition signeurs   : " + ", ".join(
        f"{signeur}={nb}" for signeur, nb in sorted(stats["par_signeur"].items())
    ))


def main() -> None:
    parseur = argparse.ArgumentParser(
        description="Convertit entrainement/capture_*.json en entrainement/donnees_landmarks.npz."
    )
    parseur.add_argument(
        "--dossier",
        type=Path,
        default=DOSSIER_SCRIPT,
        help="Dossier contenant les capture_*.json. Par défaut : dossier du script.",
    )
    parseur.add_argument(
        "--sortie",
        type=Path,
        default=DOSSIER_SCRIPT / "donnees_landmarks.npz",
        help="Fichier .npz à écrire. Par défaut : entrainement/donnees_landmarks.npz.",
    )
    args = parseur.parse_args()

    dossier = args.dossier.resolve()
    sortie = args.sortie.resolve()

    X, y, signeurs, stats = charger_captures(dossier)

    sortie.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        sortie,
        X=X,
        y=y,
        signeurs=signeurs,
        version=np.asarray(VERSION_NORMALISATION, dtype=str),
    )

    afficher_stats(stats, sortie, X)


if __name__ == "__main__":
    main()
