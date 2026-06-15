import json
import glob
import os

# Se déplacer dans le dossier contenant les fichiers JSON (dossier entrainement)
ICI = os.path.dirname(os.path.abspath(__file__))

# 1. Charger et regrouper les exports de la Collecte
prototypes = {}
chemins_json = glob.glob(os.path.join(ICI, '*.json'))

# Exclure fixtures_landmarks.json du modèle d'entraînement
chemins_json = [c for c in chemins_json if not c.endswith('fixtures_landmarks.json')]

for chemin in chemins_json:
    with open(chemin, encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, dict) and 'lettre' in data and 'trames' in data:
            lettre = data['lettre']
            trames = data['trames']
            prototypes.setdefault(lettre, []).extend(trames)

# 3. Exporter au format lu par le JS
modele = {
    'type': 'knn',
    'prototypes': prototypes
}

chemin_sortie = os.path.join(os.path.dirname(ICI), 'modeles', 'modele-lettres.json')
# Créer le dossier parent s'il n'existe pas
os.makedirs(os.path.dirname(chemin_sortie), exist_ok=True)

with open(chemin_sortie, 'w', encoding='utf-8') as f:
    json.dump(modele, f, ensure_ascii=False, indent=2)

print('Modèle écrit :', {l: len(v) for l, v in prototypes.items()})
