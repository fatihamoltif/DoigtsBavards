# DoigtsBavards / Épelle — Architecture

## 1. Vue en couches (composants)

L'app est **statique** (servie par `python -m http.server`), **sans build**, et **hors-ligne** :
runtime WASM et modèles auto-hébergés, aucun appel réseau tiers.

```mermaid
flowchart TB
    subgraph NAV["Navigateur — application statique"]
        direction TB

        subgraph PRES["Présentation / Orchestration"]
            APP["app.js<br/>point d'entrée, câblage"]
            NAVI["Navigation<br/>sections + accueil"]
            ACC["accueil.js"]
            DICO["dictionnaire.js"]
            CUR["curseur.js"]
        end

        subgraph ECRANS["Écrans (contrôleurs DOM)"]
            UI["EcranConversation<br/>(ui.js)"]
            COL["EcranCollecte<br/>(collecte.js)"]
            STAT["GestionnaireStatistiques<br/>(statistiques.js)"]
        end

        subgraph DOMAINE["Domaine — logique pure (testable Node)"]
            MACH["MachineLettres<br/>(reconnaissance.js)"]
            NORM["normaliserMain<br/>(normalisation.js)"]
            CLAS["Classifieur KNN / MLP / Mock<br/>(classifieur.js)"]
            CONF["CONFIG / ALPHABET<br/>(config.js)"]
        end

        subgraph INFRA["Infrastructure navigateur"]
            PIPE["PipelineCamera<br/>(pipeline.js)"]
            PAR["Transcription / Synthèse<br/>(parole.js)"]
        end

        subgraph WEBAPI["APIs du navigateur"]
            CAM["getUserMedia (webcam)"]
            SPEECH["Web Speech API"]
        end

        MP["MediaPipe HandLandmarker<br/>(lib/ + mediapipe/wasm — local)"]
    end

    subgraph ASSETS["Fichiers livrés (générés hors-ligne)"]
        MODELE["modeles/modele-lettres.json"]
        STATS["modeles/stats.json"]
        CONFU["modeles/confusion.json"]
        TASK["modeles/hand_landmarker.task"]
    end

    subgraph PY["Chaîne d'entraînement (Python, hors-ligne)"]
        EXTR["extraction.py"]
        ENTR["entrainement.py"]
        CAPT["entrainement/capture_*.json"]
    end

    APP --> UI & COL & STAT & NAVI & ACC & DICO & CUR
    UI --> PIPE & MACH & NORM & CLAS & PAR & CONF
    COL --> PIPE & NORM
    STAT --> STATS & CONFU
    PIPE --> MP --> TASK
    PIPE --> CAM
    PAR --> SPEECH
    CLAS --> MODELE

    CAPT --> EXTR --> ENTR --> MODELE
    ENTR --> STATS & CONFU
```

---

## 2. Diagramme de classes (modules JS)

```mermaid
classDiagram
    direction LR

    class app {
        <<entrée>>
        +câble les écrans
        +surValidationLettre vers stats
    }

    class Navigation {
        -sectionActive: string
        -surChangement(id)
        +allerA(id)
        +ouvrirApplication()
        +placerIndicateur()
    }

    class EcranConversation {
        -pipeline: PipelineCamera
        -machine: MachineLettres
        -classifieur: Classifieur
        -texte: string
        -cameraActive: bool
        +surValidationLettre(lettre, vec, conf)
        +demarrerCamera()
        +arreterCamera()
        +surTrame(main)
        +appliquerResultat(res, visible)
    }

    class EcranCollecte {
        -pipeline: PipelineCamera
        -trames: number[][]
        -enEnregistrement: bool
        +demarrerCamera()
        +surTrame(main)
        +exporterJSON()
    }

    class GestionnaireStatistiques {
        -seance: Map
        +chargerGlobales()
        +enregistrerLettre(lettre, conf)
        +afficherMatrice(conf)
    }

    class PipelineCamera {
        -flux: MediaStream
        -detecteur: HandLandmarker
        -latenceMs: number
        +chargerModele()
        +demarrer(video, canvas, surTrame)
        +arreter()
        +dessinerMain()
    }

    class MachineLettres {
        -etat: ETATS
        -candidate: string
        -compteur: number
        -verrouillee: string
        +pousser(prediction, nowMs) Resultat
        +reinitialiser()
    }

    class Classifieur {
        <<interface>>
        +predire(vecteur) Prediction
    }
    class ClassifieurKNN {
        -prototypes
        +predire(vecteur) Prediction
    }
    class ClassifieurMLP {
        -couches
        +predire(vecteur) Prediction
    }
    class ClassifieurMock {
        -script
        +predire(vecteur) Prediction
    }

    class Transcription {
        -reconnaissance
        +demarrer()
        +arreter()
    }

    class normalisation {
        <<module>>
        +normaliserMain(landmarks, lat) Float32Array
        +VERSION_NORMALISATION
    }
    class config {
        <<module>>
        +CONFIG
        +ALPHABET
        +LETTRES_MOBILES
    }

    Classifieur <|.. ClassifieurKNN
    Classifieur <|.. ClassifieurMLP
    Classifieur <|.. ClassifieurMock

    app --> Navigation
    app --> EcranConversation
    app --> EcranCollecte
    app --> GestionnaireStatistiques

    EcranConversation --> PipelineCamera
    EcranConversation --> MachineLettres
    EcranConversation --> Classifieur
    EcranConversation --> Transcription
    EcranConversation ..> normalisation
    EcranConversation ..> config

    EcranCollecte --> PipelineCamera
    EcranCollecte ..> normalisation

    MachineLettres ..> config

    EcranConversation ..> GestionnaireStatistiques : surValidationLettre
```

### Principes d'architecture à mettre en avant

- **Couche domaine pure et testable** : `MachineLettres`, `normaliserMain`, les classifieurs n'ont
  **aucune dépendance navigateur** → testables avec Node (`scripts/demo-saisie.mjs`,
  `entrainement/test_coherence.py`).
- **Polymorphisme par contrat** : KNN / MLP / Mock partagent la même méthode `predire(vecteur)` ;
  l'UI ignore lequel tourne (repli automatique sur Mock si pas de modèle).
- **Cohérence Python ↔ JS garantie** : même normalisation (`main-63d-v2`) et même règle de confiance
  (`1 − d1/d2`), avec un **garde-fou de version** qui refuse un modèle incompatible.
- **Vie privée par conception** : caméra sur clic uniquement, jamais le micro avec, aucun pixel stocké
  ni transmis, pistes vidéo coupées au changement de section.
```
