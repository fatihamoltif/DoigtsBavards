# (Ancien) entraîneur JSON, remplacé par entraine_collecte.py.
import json, glob, os

ICI = os.path.dirname(os.path.abspath(__file__))

# tous les .json du dossier, SAUF les fixtures du test de coherence
chemins = [c for c in glob.glob(os.path.join(ICI, '*.json'))
           if not c.endswith('fixtures_landmarks.json')]

prototypes = {}

def ajouter(entree):
    lettre = entree['lettre']
    if 'trames' in entree:                 # format Collecte : plusieurs trames
        for vecteur in entree['trames']:
            prototypes.setdefault(lettre, []).append(vecteur)
    elif 'vecteur' in entree:              # format liste plate : un vecteur
        prototypes.setdefault(lettre, []).append(entree['vecteur'])

for chemin in chemins:
    with open(chemin, encoding='utf-8') as f:
        donnees = json.load(f)
    if isinstance(donnees, list):          # fichier = liste d'objets
        for e in donnees:
            ajouter(e)
    else:                                  # fichier = un seul objet
        ajouter(donnees)

modele = {'type': 'knn', 'prototypes': prototypes}

sortie = os.path.join(os.path.dirname(ICI), 'modeles', 'modele-lettres.json')
os.makedirs(os.path.dirname(sortie), exist_ok=True)
with open(sortie, 'w', encoding='utf-8') as f:
    json.dump(modele, f, ensure_ascii=False)

print('Modele ecrit :', {l: len(v) for l, v in prototypes.items()})