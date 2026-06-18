# DoigtsBavards / Épelle — Diagrammes de séquence

Application web **100 % locale** (HTML/CSS/JS pur, aucune étape de build, aucun serveur tiers)
de reconnaissance de la **dactylologie LSF** (alphabet signé). Deux sens de communication :

- **Sourd·e → entendant·e** : la webcam lit les signes → texte → synthèse vocale.
- **Entendant·e → sourd·e** : le micro écoute la parole → texte (transcription).

Plus une **chaîne d'entraînement hors-ligne** (Python) qui produit le modèle chargé par le navigateur.

---

## 1. Reconnaissance d'une lettre (flux principal : signe → texte → voix)

C'est le cœur de l'application. La boucle tourne ≈ 30 fois/seconde ; la **machine à états**
garantit qu'**une seule lettre est ajoutée par geste volontaire** (sinon la lettre détectée
serait écrite 30 fois/seconde).

```mermaid
sequenceDiagram
    actor U as Utilisateur (signeur)
    participant UI as EcranConversation (ui.js)
    participant PC as PipelineCamera (pipeline.js)
    participant MP as MediaPipe HandLandmarker (WASM local)
    participant N as normaliserMain (normalisation.js)
    participant CL as Classifieur KNN/MLP (classifieur.js)
    participant M as MachineLettres (reconnaissance.js)
    participant P as Parole (parole.js)

    U->>UI: clic « Activer la caméra »
    UI->>CL: chargerClassifieur()
    CL->>CL: fetch modeles/modele-lettres.json<br/>(sinon repli sur ClassifieurMock)
    CL-->>UI: classifieur prêt
    UI->>M: reinitialiser()
    UI->>PC: demarrer(video, canvas, surTrame)
    PC->>U: getUserMedia({video, audio:false})
    Note over PC,U: caméra demandée SEULEMENT sur clic<br/>jamais le micro, aucun pixel stocké
    PC->>MP: chargerModele() (GPU, repli CPU)

    loop ≈ 30 trames/seconde (requestAnimationFrame)
        PC->>MP: detectForVideo(video, t0)
        MP-->>PC: 21 landmarks 3D + latéralité (ou rien)
        alt main détectée
            PC->>PC: dessinerMain() (squelette sur le canvas)
            PC->>UI: surTrame({landmarks, lateralite})
            UI->>N: normaliserMain(landmarks, lateralite)
            Note over N: translation poignet + échelle +<br/>rotation repère main + miroir gauche→droite<br/>→ vecteur 63 nombres
            N-->>UI: vecteur 63D (ou null si géométrie invalide)
            UI->>CL: predire(vecteur)
            CL-->>UI: {lettre, confiance}
        else aucune main
            PC->>UI: surTrame(null)
        end
        UI->>M: pousser(prediction, now)
        Note over M: RECHERCHE → CONFIRMATION (K trames stables) → VERROUILLE<br/>hystérésis SEUIL_HAUT / SEUIL_BAS<br/>tolère qq trames ratées, anti-doublon
        M-->>UI: {etat, candidate, progression, validation}
        UI->>UI: anneau de progression + lettre candidate
        opt validation = lettre
            UI->>UI: ajouterLettre() → texte composé
            UI->>UI: surValidationLettre() → stats de confiance
        end
        opt validation = espace (main absente > DELAI_ESPACE_MS)
            UI->>UI: ajoute une espace (une seule par pause)
        end
    end

    U->>UI: clic « Lire à voix haute »
    UI->>P: lireAVoixHaute(texte)
    P->>U: synthèse vocale (SpeechSynthesis, fr-FR)
    U->>UI: clic « Couper la caméra »
    UI->>PC: arreter() → pistes vidéo stoppées (voyant éteint)
```

### Détail de la machine à états (`MachineLettres.pousser`)

```mermaid
sequenceDiagram
    participant T as Trame (prediction, now)
    participant M as MachineLettres

    Note over M: État initial = RECHERCHE

    T->>M: prediction = null (aucune main)
    alt main absente depuis > DELAI_ESPACE_MS
        M-->>T: validation = ESPACE (une seule par pause)
    end

    T->>M: prediction stable (confiance ≥ SEUIL_HAUT)
    alt même lettre que la candidate
        M->>M: compteur += 1   (état CONFIRMATION)
    else nouvelle lettre
        M->>M: candidate = lettre, compteur = 1
    end
    alt compteur ≥ K_TRAMES
        M->>M: état = VERROUILLE
        M-->>T: validation = LETTRE (ajoutée UNE fois)
    end

    Note over M: VERROUILLE : rien ajouté tant que la main<br/>n'a pas « relâché »
    T->>M: confiance < SEUIL_BAS (RELACHEMENT_TRAMES fois)<br/>ou autre lettre tenue M_TRAMES
    M->>M: état = RECHERCHE (prêt pour la lettre suivante)
```

---

## 2. Transcription parole → texte (entendant·e → sourd·e)

```mermaid
sequenceDiagram
    actor E as Interlocuteur entendant
    participant UI as EcranConversation (ui.js)
    participant TR as Transcription (parole.js)
    participant API as Web Speech API (navigateur)

    UI->>UI: clic « Activer le micro »
    UI->>TR: demarrer()
    TR->>API: SpeechRecognition (lang fr-FR, continu, interim)
    loop tant que le micro écoute
        E->>API: parole
        API-->>TR: onresult (résultats interim + finaux)
        alt résultat partiel
            TR->>UI: surInterim(texte) → ligne grisée en direct
        else résultat final
            TR->>UI: surTexte(texte) → bulle ajoutée au flux
        end
    end
    UI->>TR: arreter() (re-clic)
```

---

## 3. Chaîne d'entraînement hors-ligne (produit le modèle)

Exécutée **une fois** en Python par les développeurs ; le navigateur ne fait que **charger**
le `modele-lettres.json` résultant. La même convention de normalisation
(`VERSION_NORMALISATION = main-63d-v2`) est partagée entre Python et JS — un garde-fou
refuse un modèle entraîné avec une autre convention.

```mermaid
sequenceDiagram
    actor D as Développeur·se
    participant COL as Collecte (collecte.js / vidéos)
    participant EXT as extraction.py
    participant ENT as entrainement.py
    participant JS as Application (navigateur)

    D->>COL: capture des gestes (JSON de landmarks par lettre/signeur)
    D->>EXT: python extraction.py
    EXT->>EXT: normalisation main-63d-v2 → donnees_landmarks.npz
    D->>ENT: python entrainement.py
    ENT->>ENT: augmentation (rotations ±5°, bruit, miroir option.)
    ENT->>ENT: KMeans intra-classe → prototypes par lettre (KNN)
    ENT->>ENT: éval 80/20 + leave-one-signer-out + matrice de confusion
    ENT->>JS: modeles/modele_lettres.json (prototypes + version)
    ENT->>JS: modeles/stats.json, modeles/confusion.json (onglet Statistiques)
    Note over ENT,JS: confiance = 1 − d1/d2 (même règle exacte<br/>en Python et en JS) → cohérence garantie
    JS->>JS: au démarrage, chargerClassifieur() lit ce JSON
```

---

## Composants clés (récapitulatif)

| Fichier | Rôle |
|---|---|
| `js/pipeline.js` | Webcam + MediaPipe → 21 landmarks 3D par trame |
| `js/normalisation.js` | Landmarks → vecteur 63D invariant (position/échelle/rotation/main) |
| `js/classifieur.js` | Vecteur → `{lettre, confiance}` (KNN, MLP ou Mock) |
| `js/reconnaissance.js` | Machine à états : 1 lettre par geste volontaire |
| `js/ui.js` | Orchestration écran Conversation + transcription |
| `js/parole.js` | Parole→texte (reconnaissance) et texte→parole (synthèse) |
| `js/config.js` | Tous les seuils réglables (SEUIL_HAUT/BAS, K_TRAMES, etc.) |
| `entrainement/*.py` | Chaîne hors-ligne produisant le modèle JSON |
```
