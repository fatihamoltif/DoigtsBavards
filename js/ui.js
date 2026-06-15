export class EcranConversation {
  constructor() {
    this.anneauProgression = document.getElementById('anneau-progression');
    this.lettreCandidate = document.getElementById('lettre-candidate');
    this.etatLettre = document.getElementById('etat-lettre');
    this.texteCompose = document.getElementById('texte-compose');
    
    this.btnEffacer = document.getElementById('bouton-effacer');
    this.btnToutEffacer = document.getElementById('bouton-tout-effacer');
    this.btnLire = document.getElementById('bouton-lire');

    this.circonference = 2 * Math.PI * 26;
    this.initialiserEvenementsBoutons();
  }

  initialiserEvenementsBoutons() {
    if (this.btnEffacer) this.btnEffacer.addEventListener('click', () => this.effacerDerniereLettre());
    if (this.btnToutEffacer) this.btnToutEffacer.addEventListener('click', () => this.toutEffacer());
  }

  mettreAJourAnneau(progression) {
    if (!this.anneauProgression) return;
    this.anneauProgression.style.strokeDasharray = `${this.circonference} ${this.circonference}`;
    const offset = this.circonference - (progression * this.circonference);
    this.anneauProgression.style.strokeDashoffset = offset;
  }

  majInterface(evenement) {
    if (!evenement) return;
    const { etat, progression, validation, candidate } = evenement;

    this.mettreAJourAnneau(progression);

    if (this.lettreCandidate && candidate) {
      this.lettreCandidate.textContent = candidate;
    }

    if (this.etatLettre) {
      switch (etat) {
        case 'verrouille':
          this.etatLettre.textContent = "Lettre validée ! Relâchez votre main.";
          if (this.lettreCandidate) this.lettreCandidate.style.color = "gray"; 
          if (this.anneauProgression) this.anneauProgression.style.stroke = "gray"; 
          break;
        case 'confirmation':
          this.etatLettre.textContent = "Analyse et maintien du geste...";
          if (this.lettreCandidate) this.lettreCandidate.style.color = "darkblue";
          if (this.anneauProgression) this.anneauProgression.style.stroke = "darkblue";
          break;
        case 'recherche':
        default:
          this.etatLettre.textContent = "Prêt à détecter une lettre LSF";
          if (this.lettreCandidate && !candidate) this.lettreCandidate.textContent = "-";
          if (this.lettreCandidate) this.lettreCandidate.style.color = "black";
          if (this.anneauProgression) this.anneauProgression.style.stroke = "lightblue";
          break;
      }
    }

    if (validation) {
      if (validation.type === 'lettre') {
        this.ecrireLettre(validation.lettre);
      } else if (validation.type === 'espace') {
        this.ecrireEspace();
      }
    }
  }

  ecrireLettre(lettre) {
    const noeudLettre = document.createElement('span');
    noeudLettre.textContent = lettre;
    noeudLettre.classList.add('pop');
    const curseur = document.getElementById('curseur-texte');
    if (curseur && this.texteCompose) {
      this.texteCompose.insertBefore(noeudLettre, curseur);
    }
    this.actualiserEtatBoutons();
  }

  ecrireEspace() {
    const noeudEspace = document.createElement('span');
    noeudEspace.innerHTML = '&nbsp;';
    const curseur = document.getElementById('curseur-texte');
    if (curseur && this.texteCompose) {
      this.texteCompose.insertBefore(noeudEspace, curseur);
    }
  }

  effacerDerniereLettre() {
    if (!this.texteCompose) return;
    const curseur = document.getElementById('curseur-texte');
    if (curseur) {
      const cible = curseur.previousSibling;
      if (cible && cible.nodeName === 'SPAN') {
        this.texteCompose.removeChild(cible);
      }
    }
    this.actualiserEtatBoutons();
  }

  toutEffacer() {
    if (!this.texteCompose) return;
    const curseur = document.getElementById('curseur-texte');
    this.texteCompose.innerHTML = '';
    if (curseur) this.texteCompose.appendChild(curseur); 
    this.actualiserEtatBoutons();
  }

  actualiserEtatBoutons() {
    const texteUtile = this.texteCompose ? this.texteCompose.textContent.trim() : "";
    const estVide = texteUtile.length === 0;
    if (this.btnEffacer) this.btnEffacer.disabled = estVide;
    if (this.btnToutEffacer) this.btnToutEffacer.disabled = estVide;
    if (this.btnLire) this.btnLire.disabled = estVide;
  }
}