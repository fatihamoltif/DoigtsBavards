# Entraînement du classifieur de lettres (dactylologie LSF)

Pipeline Python qui transforme **vos propres vidéos** en un modèle léger, chargé
ensuite par l'application à la place du mock.

Périmètre : **A–Z sauf J et Z** (lettres à mouvement → phase 2, voir plus bas).

> **Vie privée** : les vidéos restent locales et ne sont **pas** versionnées
> (`entrainement/videos/` est dans `.gitignore`). On n'extrait que des
> **coordonnées** ; le modèle exporté (`modeles/modele_lettres.json`) ne
> contient que des nombres (centroïdes/poids), aucune image. À l'usage, l'app
> reste 100 % locale (landmarks seulement).

## 1. Convention des vidéos d'entrée

Un sous-dossier par lettre ; un fichier par signeur :

```
entrainement/videos/
  A/  fati.mp4   camarade2.mp4
  B/  fati.mp4   camarade2.mp4
  ...
  Y/  fati.mp4   camarade2.mp4
```

- **Nom du dossier = la lettre** (l'étiquette).
- **Nom du fichier = le signeur** (`fati.mp4`, `camarade2.mp4`…) — indispensable
  pour l'évaluation **leave-one-signer-out** (entraîner sans un signeur, tester
  sur lui).
- Plusieurs clips par lettre/signeur autorisés.
- Lettres attendues : `A B C D E F G H I K L M N O P Q R S T U V W X Y`
  (**J et Z exclus** pour l'instant).

**Conseils de tournage** : un clip de **5–10 s** par lettre, configuration de
main **tenue** (pas de geste), avec de **légères variations d'angle et de
distance**. Filmez avec la **même webcam** que pour l'usage, dans un éclairage
correct, main bien visible dans le cadre.

## 2. Workflow

```bash
# 1. Filmer et ranger les clips dans entrainement/videos/<LETTRE>/<signeur>.mp4

# 2. Installer les dépendances Python
pip install -r entrainement/requirements.txt

# 3. (recommandé) Vérifier que Python et JS normalisent À L'IDENTIQUE
python entrainement/test_coherence.py

# 4. Extraire les landmarks, entraîner, exporter, évaluer
python entrainement/extraction.py     # → entrainement/donnees_landmarks.npz
python entrainement/entrainement.py    # → modeles/modele_lettres.json (+ matrice de confusion)

# 5. Recharger l'app (servie par python -m http.server) : elle utilise
#    automatiquement le vrai modèle (sinon, repli sur le mock).
```

## 3. Le point critique : cohérence de normalisation

La normalisation (landmarks → vecteur 63-dim) **doit être identique** côté
entraînement (Python) et côté inférence (navigateur, JS). Si elle diffère, le
modèle s'effondre.

- Elle est définie **une seule fois** de chaque côté :
  `entrainement/normalisation.py` ⇄ `js/normalisation.js` (port exact).
- Une **empreinte de version** (`main-63d-v1`) accompagne le modèle exporté ;
  le JS refuse un modèle dont l'empreinte ne correspond pas.
- **Test automatique** : `python entrainement/test_coherence.py` compare, sur
  des landmarks d'exemple, les vecteurs Python et JS. Écart constaté ≈ `1e-17`
  (niveau epsilon machine), bien sous la tolérance.

## 4. Fichiers

```
normalisation.py     landmarks → vecteur 63-dim (port exact du JS)
test_coherence.py    prouve l'égalité Python ↔ JS (à lancer avant d'entraîner)
coherence_js.mjs     volet JS du test (appelé par test_coherence.py)
fixtures_landmarks.json  landmarks d'exemple partagés par le test
_generer_fixtures.py génère la fixture ci-dessus (reproductible)
extraction.py        vidéos → donnees_landmarks.npz (MediaPipe + normalisation)
entrainement.py      entraînement KNN + export JSON + évaluation   (étape 2)
requirements.txt     dépendances Python
videos/              VOS vidéos (non versionnées)
```

## 5. J et Z (phase 2)

J et Z sont des lettres **à mouvement** (tracées dans l'espace) : une seule
image ne suffit pas. Elles seront traitées séparément, avec une **courte
fenêtre temporelle** (séquence de landmarks) et des **vidéos dédiées**, dans une
seconde étape. Elles sont volontairement exclues du périmètre statique actuel.
