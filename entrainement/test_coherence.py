"""
Test de cohérence de la normalisation Python ↔ JS.

LE point qui casse tout : si la normalisation diffère entre l'entraînement
(Python) et l'inférence (navigateur, JS), le modèle s'effondre. Ce test prouve
que, pour les MÊMES landmarks, les deux produisent le MÊME vecteur 63-dim.

Déroulé :
  1. lit la fixture partagée (entrainement/fixtures_landmarks.json) ;
  2. calcule les vecteurs côté Python (normalisation.py) ;
  3. exécute le volet JS (node coherence_js.mjs) et récupère ses vecteurs ;
  4. compare élément par élément ; échoue si l'écart dépasse la tolérance.

La tolérance (1e-5) tient compte de l'arrondi en float32 (Float32Array côté
navigateur) et des micro-différences d'implémentation de hypot.

Lancer :  python entrainement/test_coherence.py
"""

import json
import os
import subprocess
import sys

from normalisation import normaliser_main, VERSION_NORMALISATION

# Sur Windows, ajouter le chemin par défaut de Node.js au PATH s'il n'y est pas déjà.
if sys.platform == "win32":
    node_path = r"C:\Program Files\nodejs"
    if node_path not in os.environ["PATH"]:
        os.environ["PATH"] += os.path.pathsep + node_path

ICI = os.path.dirname(os.path.abspath(__file__))
TOLERANCE = 1e-5


def charger_fixtures():
    with open(os.path.join(ICI, "fixtures_landmarks.json"), encoding="utf-8") as f:
        return json.load(f)


def vecteurs_js():
    """Exécute le volet JS et renvoie {version, echantillons:[{nom, vecteur}]}."""
    res = subprocess.run(
        ["node", os.path.join(ICI, "coherence_js.mjs")],
        capture_output=True, text=True, check=True,
    )
    return json.loads(res.stdout)


def main():
    fixtures = charger_fixtures()
    cote_js = vecteurs_js()

    # 0. Les empreintes de version doivent correspondre.
    if cote_js["version"] != VERSION_NORMALISATION:
        print(f"ÉCHEC : versions différentes "
              f"(JS={cote_js['version']!r}, Python={VERSION_NORMALISATION!r}).")
        return 1

    print(f"Version de normalisation : {VERSION_NORMALISATION}")
    print(f"{'échantillon':<26}{'écart max':>14}{'   statut'}")
    print("-" * 52)

    ecart_global = 0.0
    ok = True
    js_par_nom = {e["nom"]: e["vecteur"] for e in cote_js["echantillons"]}

    for ech in fixtures:
        nom = ech["nom"]
        v_py = normaliser_main(ech["landmarks"], ech["lateralite"])
        v_js = js_par_nom.get(nom)

        if v_py is None or v_js is None:
            statut = "None des deux côtés" if v_py is None and v_js is None else "DÉSACCORD (None)"
            print(f"{nom:<26}{'—':>14}   {statut}")
            ok = ok and (v_py is None and v_js is None)
            continue

        ecart = max(abs(a - b) for a, b in zip(v_py, v_js))
        ecart_global = max(ecart_global, ecart)
        passe = ecart <= TOLERANCE
        ok = ok and passe
        print(f"{nom:<26}{ecart:>14.2e}   {'OK' if passe else 'ÉCHEC'}")

    print("-" * 52)
    print(f"ecart maximal global : {ecart_global:.2e}  (tolerance {TOLERANCE:.0e})")
    if ok:
        print("\n[OK] COHERENCE CONFIRMEE : Python et JS produisent le meme vecteur.")
        return 0
    print("\n[ERREUR] INCOHERENCE : corriger avant tout entrainement.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
