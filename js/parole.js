export function creerParole() {
  return {
    lire(texte) {
      if (!texte) return;
      window.speechSynthesis.cancel();
      const enonciation = new SpeechSynthesisUtterance(texte);
      enonciation.lang = 'fr-FR';
      window.speechSynthesis.speak(enonciation);
    }
  };
}