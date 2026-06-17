# Curseur personnalisé — images

Déposez ici **vos 3 images de curseur** (PNG ou SVG à fond **transparent**, pas
de capture avec fond blanc). Noms attendus par défaut :

| Fichier | État | Quand ? |
|---|---|---|
| `normal.png`  | normal     | par défaut |
| `pointer.png` | pointer    | survol d'un élément cliquable (`a`, `button`, champ, onglet…) |
| `grab.png`    | clic/grab  | bouton souris enfoncé |

## Si vos fichiers ont d'autres noms ou formats

Ouvrez [`js/curseur.js`](../../js/curseur.js) et modifiez l'objet `IMAGES`
en haut du fichier (chemins + extension `.svg`/`.png`).

## Réglages utiles (dans `js/curseur.js`)

- `TAILLE` : `'auto'` garde la taille native de l'image ; sinon un nombre de px
  (32–48 conseillé).
- `HOTSPOT` : le « point actif » du curseur en fraction de la taille
  (`{x:0, y:0}` = coin haut-gauche, `{x:0.5, y:0.5}` = centre). À ajuster selon
  le dessin de vos curseurs (ex. la pointe du doigt).

Tant qu'`normal.png` est introuvable, le système **n'active rien** et garde le
curseur natif du navigateur (pas de curseur invisible).
