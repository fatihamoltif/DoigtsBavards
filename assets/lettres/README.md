# Images des gestes de la main (dictionnaire)

Déposez ici **une image PNG par lettre**, affichée dans le modal du dictionnaire
quand on clique sur une lettre.

## Convention de nommage (obligatoire)

```
lettre_a.png
lettre_b.png
lettre_c.png
...
lettre_z.png
```

- Préfixe `lettre_`, puis la **lettre en minuscule**, puis `.png`.
- Le code charge automatiquement `assets/lettres/lettre_<lettre>.png`
  (voir `js/dictionnaire.js`).

## Si une image manque

Le cadre photo se **masque tout seul** : aucune image cassée n'apparaît.
Ajoutez le fichier au bon nom et rechargez la page — il s'affiche.

## Conseils
- Format **PNG** (fond transparent recommandé pour s'intégrer au cadre lavande).
- Garder un cadrage homogène d'une lettre à l'autre (même taille, même centrage).
- Largeur utile ~320 px suffit (l'image est redimensionnée à l'affichage).
