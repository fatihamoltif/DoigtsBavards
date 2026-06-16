"""
Entraînement du classifieur de lettres (KNN sur centroïdes) + évaluation.

Entrée  : entrainement/donnees_landmarks.npz  (produit par extraction.py)
Sorties : modeles/modele_lettres.json         (chargé par le JS au démarrage)
          entrainement/matrice_confusion.txt  (lisible en terminal)
          entrainement/matrice_confusion.png  (pour le rapport)

Choix du modèle — explicabilité d'abord :
  KNN SUR CENTROÏDES. Pour chaque lettre, on résume les exemples par quelques
  « prototypes » (centres de k-means intra-classe). À l'inférence, on cherche
  le prototype le plus proche : la lettre gagnante est la sienne. Compact
  (24 lettres × K prototypes × 63 nombres), robuste, et trivial à expliquer
  en soutenance. (L'alternative MLP reste possible côté JS : même interface.)

La RÈGLE DE CONFIANCE est exactement celle du JS (js/classifieur.js) :
  confiance = 1 − d1/d2  (d1 = distance² au plus proche, d2 au deuxième).
On l'évalue ici aussi, pour donner une recommandation de seuil à la machine
à états (SEUIL_HAUT dans js/config.js).

Évaluation honnête :
  - découpage stratifié 80/20 → accuracy globale + par lettre + matrice de
    confusion (quelles lettres se confondent : LE résultat à montrer) ;
  - si ≥ 2 signeurs : LEAVE-ONE-SIGNER-OUT (entraîner sans un signeur, tester
    sur lui) → mesure l'écart signeur connu / non vu.

Usage :
  python entrainement/entrainement.py                 # défauts raisonnables
  python entrainement/entrainement.py --prototypes 5 --jitter 2 --miroir
"""
# Pipeline VIDÉO (.mp4 → .npz → modèle, avec éval/LOSO). Nécessite entrainement/videos/.
import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

import numpy as np

from normalisation import VERSION_NORMALISATION

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
DONNEES = os.path.join(ICI, "donnees_landmarks.npz")
SORTIE_MODELE = os.path.join(RACINE, "modeles", "modele_lettres.json")
SORTIE_MATRICE_TXT = os.path.join(ICI, "matrice_confusion.txt")
SORTIE_MATRICE_PNG = os.path.join(ICI, "matrice_confusion.png")


# ----------------------------- Augmentation -------------------------------

def augmenter(X, y, signeurs, nb_copies, miroir, graine):
    """
    Augmentation LÉGÈRE des vecteurs normalisés, pour la robustesse :
      - petites rotations 3D (± ~5°) : simule l'imprécision du repère canonique ;
      - bruit gaussien faible : simule le bruit de détection des landmarks.
    Optionnel (--miroir) : copie miroitée gauche/droite (axe X inversé).
    La normalisation gère déjà la latéralité ; ce drapeau ne sert que si on
    soupçonne des erreurs d'étiquetage main gauche/droite. Désactivé par défaut.
    """
    rng = np.random.default_rng(graine)
    lots_X, lots_y, lots_s = [X], [y], [signeurs]

    def rotation_aleatoire():
        angles = rng.uniform(-0.09, 0.09, size=3)  # ± ~5° par axe
        cx, sx = np.cos(angles[0]), np.sin(angles[0])
        cy, sy = np.cos(angles[1]), np.sin(angles[1])
        cz, sz = np.cos(angles[2]), np.sin(angles[2])
        rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
        ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
        rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
        return rz @ ry @ rx

    for _ in range(nb_copies):
        points = X.reshape(-1, 21, 3)
        tournes = np.stack([p @ rotation_aleatoire().T for p in points])
        bruites = tournes + rng.normal(0, 0.015, size=tournes.shape)
        lots_X.append(bruites.reshape(-1, 63).astype(np.float32))
        lots_y.append(y)
        lots_s.append(signeurs)

    if miroir:
        copie = X.reshape(-1, 21, 3).copy()
        copie[:, :, 0] *= -1  # inversion de l'axe X
        lots_X.append(copie.reshape(-1, 63).astype(np.float32))
        lots_y.append(y)
        lots_s.append(signeurs)

    return (np.concatenate(lots_X), np.concatenate(lots_y), np.concatenate(lots_s))


# ------------------------- KNN sur centroïdes ------------------------------

def calculer_prototypes(X, y, k_prototypes, graine):
    """K-means INTRA-CLASSE : quelques centres par lettre."""
    from sklearn.cluster import KMeans

    prototypes = {}
    for lettre in sorted(set(y.tolist())):
        X_lettre = X[y == lettre]
        k = min(k_prototypes, len(X_lettre))
        if k <= 1:
            prototypes[lettre] = [X_lettre.mean(axis=0).tolist()]
            continue
        kmeans = KMeans(n_clusters=k, n_init=4, random_state=graine)
        kmeans.fit(X_lettre)
        prototypes[lettre] = kmeans.cluster_centers_.tolist()
    return prototypes


def predire(vecteur, protos_plats):
    """
    Plus proche prototype — MÊME règle que js/classifieur.js :
    d1 = distance² à la lettre gagnante, d2 = meilleure lettre CONCURRENTE
    (différente — comparer deux prototypes de la même lettre n'aurait pas de
    sens), confiance = 1 − d1/d2.
    """
    meilleure_par_lettre = {}
    for lettre, proto in protos_plats:
        d = float(np.sum((vecteur - proto) ** 2))
        if lettre not in meilleure_par_lettre or d < meilleure_par_lettre[lettre]:
            meilleure_par_lettre[lettre] = d

    gagnante, d1, d2 = "?", np.inf, np.inf
    for lettre, d in meilleure_par_lettre.items():
        if d < d1:
            if gagnante != "?":
                d2 = d1
            d1, gagnante = d, lettre
        elif d < d2:
            d2 = d
    confiance = 1.0 if d2 == np.inf else (1.0 - d1 / d2 if d2 > 0 else 0.0)
    return gagnante, confiance


def aplatir(prototypes):
    return [(lettre, np.asarray(p)) for lettre, liste in prototypes.items() for p in liste]


# ------------------------------ Évaluation ---------------------------------

def evaluer(X_app, y_app, X_test, y_test, k_prototypes, graine):
    """Entraîne sur (X_app) et évalue sur (X_test). Renvoie les métriques."""
    protos = aplatir(calculer_prototypes(X_app, y_app, k_prototypes, graine))
    predictions, confiances = [], []
    for v in X_test:
        lettre, conf = predire(v, protos)
        predictions.append(lettre)
        confiances.append(conf)
    predictions = np.asarray(predictions)
    exactes = predictions == y_test
    return {
        "accuracy": float(exactes.mean()),
        "predictions": predictions,
        "confiances": np.asarray(confiances),
        "exactes": exactes,
    }


def matrice_confusion(y_vrai, y_pred, lettres):
    index = {l: i for i, l in enumerate(lettres)}
    m = np.zeros((len(lettres), len(lettres)), dtype=int)
    for vrai, pred in zip(y_vrai, y_pred):
        if pred in index:
            m[index[vrai], index[pred]] += 1
    return m


def sauver_matrice(m, lettres):
    # Texte aligné (lisible en terminal et versionnable).
    largeur = 4
    lignes = ["Matrice de confusion (lignes = vraie lettre, colonnes = prédite)", ""]
    lignes.append(" " * 5 + "".join(f"{l:>{largeur}}" for l in lettres))
    for i, l in enumerate(lettres):
        lignes.append(f"{l:>4} " + "".join(f"{v:>{largeur}}" for v in m[i]))
    with open(SORTIE_MATRICE_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(lignes) + "\n")

    # Image pour le rapport.
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(9, 8))
    im = ax.imshow(m, cmap="YlOrBr")
    ax.set_xticks(range(len(lettres)), lettres)
    ax.set_yticks(range(len(lettres)), lettres)
    ax.set_xlabel("Lettre prédite")
    ax.set_ylabel("Vraie lettre")
    ax.set_title("Matrice de confusion — dactylologie LSF (DoigtsBavards)")
    for i in range(len(lettres)):
        for j in range(len(lettres)):
            if m[i, j]:
                ax.text(j, i, str(m[i, j]), ha="center", va="center", fontsize=7)
    fig.colorbar(im, shrink=0.8)
    fig.tight_layout()
    fig.savefig(SORTIE_MATRICE_PNG, dpi=160)
    plt.close(fig)


# --------------------------------- Main ------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Entraîne le classifieur de lettres (KNN centroïdes).")
    ap.add_argument("--prototypes", type=int, default=4, help="prototypes par lettre (k-means intra-classe)")
    ap.add_argument("--jitter", type=int, default=1, help="copies augmentées (rotations/bruit), 0 = aucune")
    ap.add_argument("--miroir", action="store_true", help="ajoute une copie miroitée gauche/droite")
    ap.add_argument("--test", type=float, default=0.2, help="fraction de test (découpage stratifié)")
    ap.add_argument("--graine", type=int, default=42)
    args = ap.parse_args()

    if not os.path.exists(DONNEES):
        print(f"Jeu de données introuvable : {DONNEES}")
        print("Lancez d'abord : python entrainement/extraction.py")
        return 1

    d = np.load(DONNEES, allow_pickle=False)
    X, y, signeurs = d["X"], d["y"].astype(str), d["signeurs"].astype(str)
    version = str(d["version"])
    if version != VERSION_NORMALISATION:
        print(f"ERREUR : données normalisées avec {version!r}, code en {VERSION_NORMALISATION!r}.")
        print("Relancez extraction.py pour régénérer les données.")
        return 1

    lettres = sorted(set(y.tolist()))
    liste_signeurs = sorted(set(signeurs.tolist()))
    print(f"{len(X)} échantillons · {len(lettres)} lettres · signeurs : {', '.join(liste_signeurs)}")

    # --- Augmentation (sur une copie : l'évaluation 80/20 augmente seulement
    #     le jeu d'apprentissage, jamais le jeu de test). ---
    rng = np.random.default_rng(args.graine)

    # Découpage stratifié par lettre.
    idx_app, idx_test = [], []
    for lettre in lettres:
        indices = np.flatnonzero(y == lettre)
        rng.shuffle(indices)
        n_test = max(1, int(len(indices) * args.test))
        idx_test.extend(indices[:n_test])
        idx_app.extend(indices[n_test:])
    idx_app, idx_test = np.asarray(idx_app), np.asarray(idx_test)

    X_app, y_app, s_app = augmenter(
        X[idx_app], y[idx_app], signeurs[idx_app], args.jitter, args.miroir, args.graine
    )

    print("\n=== Évaluation 80/20 (stratifiée par lettre) ===")
    res = evaluer(X_app, y_app, X[idx_test], y[idx_test], args.prototypes, args.graine)
    print(f"Accuracy globale : {res['accuracy']:.1%}  ({len(idx_test)} exemples de test)")

    # Accuracy par lettre.
    print("\nAccuracy par lettre :")
    par_lettre = defaultdict(lambda: [0, 0])
    for vrai, ok in zip(y[idx_test], res["exactes"]):
        par_lettre[vrai][1] += 1
        par_lettre[vrai][0] += int(ok)
    for lettre in lettres:
        bons, total = par_lettre[lettre]
        barre = "█" * round(20 * bons / total) if total else ""
        print(f"  {lettre} : {bons / total:6.1%} ({bons}/{total}) {barre}")

    m = matrice_confusion(y[idx_test], res["predictions"], lettres)
    sauver_matrice(m, lettres)
    print(f"\nMatrice de confusion → {os.path.relpath(SORTIE_MATRICE_TXT, RACINE)}"
          f" et .png (à mettre dans le rapport)")

    # Conseil de seuil pour la machine à états (basé sur la règle 1 − d1/d2).
    conf_ok = res["confiances"][res["exactes"]]
    conf_ko = res["confiances"][~res["exactes"]]
    if len(conf_ok):
        print(f"\nConfiances (règle JS 1−d1/d2) — correctes : médiane {np.median(conf_ok):.2f}, "
              f"10e centile {np.percentile(conf_ok, 10):.2f}")
        if len(conf_ko):
            print(f"                                erronées  : médiane {np.median(conf_ko):.2f}")
        suggestion = round(float(np.percentile(conf_ok, 10)), 2)
        print(f"→ SEUIL_HAUT suggéré dans js/config.js : ~{suggestion} "
              f"(actuel : 0.85 ; ajustez selon le taux d'abstention vécu)")

    # --- Leave-one-signer-out : l'écart honnête signeur connu / non vu. ---
    if len(liste_signeurs) >= 2:
        print("\n=== Leave-one-signer-out ===")
        scores = []
        for signeur in liste_signeurs:
            masque_test = signeurs == signeur
            X_a, y_a, _ = augmenter(
                X[~masque_test], y[~masque_test], signeurs[~masque_test],
                args.jitter, args.miroir, args.graine,
            )
            r = evaluer(X_a, y_a, X[masque_test], y[masque_test], args.prototypes, args.graine)
            scores.append(r["accuracy"])
            print(f"  test sur « {signeur} » (jamais vu) : {r['accuracy']:.1%}")
        print(f"  moyenne signeur non vu : {np.mean(scores):.1%} "
              f"(vs {res['accuracy']:.1%} signeurs connus) — l'écart est le résultat à discuter")
    else:
        print("\n(Un seul signeur : pas de leave-one-signer-out possible. "
          "Ajoutez les vidéos d'un camarade pour mesurer la généralisation.)")

    # --- Modèle FINAL : entraîné sur TOUTES les données (+ augmentation). ---
    X_tout, y_tout, _ = augmenter(X, y, signeurs, args.jitter, args.miroir, args.graine)
    prototypes = calculer_prototypes(X_tout, y_tout, args.prototypes, args.graine)

    modele = {
        "type": "knn",
        "version_normalisation": VERSION_NORMALISATION,
        "lettres": lettres,
        "prototypes": prototypes,
        "parametres": {
            "prototypes_par_lettre": args.prototypes,
            "jitter": args.jitter,
            "miroir": args.miroir,
            "echantillons": int(len(X)),
            "signeurs": liste_signeurs,
        },
        "entraine_le": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    with open(SORTIE_MODELE, "w", encoding="utf-8") as f:
        json.dump(modele, f)
    taille = os.path.getsize(SORTIE_MODELE) / 1024
    print(f"\nModèle exporté → {os.path.relpath(SORTIE_MODELE, RACINE)} ({taille:.0f} Ko)")
    print("Rechargez l'application : elle utilisera ce modèle automatiquement.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
