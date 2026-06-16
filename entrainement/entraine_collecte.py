# Entraîneur depuis les exports Collecte navigateur (capture_*.json). Celui utilisé actuellement.

"""Entraînement KNN depuis les exports de la Collecte navigateur (JSON)."""
import json, glob, os
from normalisation import VERSION_NORMALISATION

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
SORTIE = os.path.join(RACINE, "modeles", "modele-lettres.json")  # tiret : doit matcher classifieur.js

prototypes = {}
def ajouter(e):
    lettre = e["lettre"]
    trames = e.get("trames") or ([e["vecteur"]] if "vecteur" in e else [])
    for v in trames:
        prototypes.setdefault(lettre, []).append(v)

# Tes exports de Collecte s'appellent capture_*.json, dans entrainement/
for c in sorted(glob.glob(os.path.join(ICI, "capture_*.json"))):
    with open(c, encoding="utf-8") as f:
        d = json.load(f)
    [ajouter(x) for x in d] if isinstance(d, list) else ajouter(d)

if not prototypes:
    raise SystemExit("Aucun capture_*.json trouvé dans entrainement/.")

modele = {"type": "knn", "version_normalisation": VERSION_NORMALISATION, "prototypes": prototypes}
os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
with open(SORTIE, "w", encoding="utf-8") as f:
    json.dump(modele, f)
print("Modele ecrit :", {l: len(v) for l, v in prototypes.items()}, "| version", VERSION_NORMALISATION)