import { PipelineCamera }     from './pipeline.js';      // Géré par R1
import { normaliserMain }     from './normalisation.js';  // Géré par R2
import { chargerClassifieur } from './classifieur.js';    // Géré par R2
import { MachineLettres }     from './reconnaissance.js'; // Géré par R2
import { Navigation }         from './navigation.js';     // Géré par R4
import { EcranConversation }  from './ui.js';            // TON FICHIER (R3)
import { creerParole }        from './parole.js';         // TON FICHIER (R3)

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialisation de la navigation globale de R4
  const navigation = new Navigation({
    surChangement: (sectionId) => {
      console.log(`Changement de section vers : ${sectionId}`);
    }
  });

  // 2. Initialisation de ton interface et de la synthèse vocale (R3)
  const ui = new EcranConversation();
  const parole = creerParole();

  // Détection du mode démo J1 (?demo=1)
  const urlParams = new URLSearchParams(window.location.search);
  const modeDemo = urlParams.get('demo') === '1';

  if (modeDemo) {
    lancerModeDemo(ui);
    return;
  }

  // 3. Initialisation de la chaîne technique réelle (J2)
  const pipeline = new PipelineCamera();
  
  const configurationSecours = {
    SEUIL_HAUT: 0.85,
    SEUIL_BAS: 0.50,
    K_TRAMES: 12,
    M_TRAMES: 12,
    RELACHEMENT_TRAMES: 5,
    TOLERANCE_TRAMES: 2,
    DELAI_ESPACE_MS: 1200
  };

  const machine = new MachineLettres(configurationSecours);
  const classifieur = await chargerClassifieur(); 

  const videoElement = document.getElementById('video-camera');
  const canvasElement = document.getElementById('canvas-squelette');
  const btnCamera = document.getElementById('bouton-camera');
  const voileCamera = document.getElementById('voile-camera');
  const messageCamera = document.getElementById('message-camera');
  const pastilleCamera = document.getElementById('pastille-camera');

  if (btnCamera) {
    btnCamera.addEventListener('click', async () => {
      try {
        if (messageCamera) messageCamera.textContent = ""; 
        
        await pipeline.demarrer(videoElement, canvasElement, (main) => {
          const maintenant = performance.now();
          
          if (!main) {
            const evenementVide = machine.pousser(null, maintenant); 
            ui.majInterface(evenementVide);              
            return;
          }

          const vecteur = normaliserMain(main.landmarks, main.lateralite);
          if (vecteur !== null) {
            const prediction = classifieur.predire(vecteur);            
            const evenement = machine.pousser(prediction, maintenant);              
            ui.majInterface(evenement); 
          }
        });

        if (voileCamera) voileCamera.classList.add('cache');
        if (pastilleCamera) pastilleCamera.classList.add('active');
        const textEtat = document.getElementById('etat-camera');
        if (textEtat) textEtat.textContent = "Active";

      } catch (erreur) {
        console.error("Échec du démarrage de la caméra :", erreur);
        if (messageCamera) messageCamera.textContent = erreur.message;
      }
    });
  }

  const btnLire = document.getElementById('bouton-lire');
  if (btnLire) {
    btnLire.addEventListener('click', () => {
      const zoneTexte = document.getElementById('texte-compose');
      if (zoneTexte) {
        const texte = zoneTexte.textContent.replace('⌫', '').trim();
        parole.lire(texte);
      }
    });
  }
});

function lancerModeDemo(ui) {
  console.log("Mode démo activé");
  let progressionSimulee = 0;
  setInterval(() => {
    progressionSimulee += 0.2;
    if (progressionSimulee > 1) {
      progressionSimulee = 0;
      ui.majInterface({ etat: "verrouille", progression: 0, validation: { type: "lettre", lettre: "X" } });
    } else {
      ui.majInterface({ etat: "confirmation", progression: progressionSimulee });
    }
  }, 250);
}