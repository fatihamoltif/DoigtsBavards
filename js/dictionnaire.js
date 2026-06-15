/*
 * Dictionnaire dactylologique LSF.
 * Fournit les descriptions textuelles et les astuces de réalisation
 * de chaque signe de l'alphabet, et gère l'affichage du modal de détails.
 */

import { ALPHABET, LETTRES_MOBILES } from './config.js'
import { dessinerMainSquelette } from './accueil.js'

export const DESCRIPTION_LETTRES = {
  A: {
    description: "Poing fermé, le pouce posé contre le côté de l'index.",
    astuce: "Pensez au poing fermé classique, pouce sur le côté."
  },
  B: {
    description: "Main ouverte, les quatre doigts tendus et collés, le pouce plié sur la paume.",
    astuce: "C'est la forme d'un 'plat' ou d'un salut."
  },
  C: {
    description: "Main courbée en demi-cercle, imitant la forme de la lettre C.",
    astuce: "Formez un arc avec tous vos doigts."
  },
  D: {
    description: "Index tendu vers le haut, les autres doigts formant un cercle avec le pouce.",
    astuce: "Pensez au chiffre 1 ou à désigner le ciel."
  },
  E: {
    description: "Doigts légèrement pliés vers le bas, les ongles touchant presque le pouce plié horizontalement.",
    astuce: "Formez une sorte de petite griffe serrée."
  },
  F: {
    description: "Index et pouce forment un cercle (qui se touchent), les trois autres doigts tendus vers le haut.",
    astuce: "Similaire au signe 'OK' universel."
  },
  G: {
    description: "Index et pouce parallèles pointés vers le côté, comme si l'on mesurait une petite distance.",
    astuce: "Pensez à un pistolet miniature horizontal."
  },
  H: {
    description: "Index et majeur tendus horizontalement et collés, le pouce replié.",
    astuce: "Comme le signe G mais avec deux doigts tendus."
  },
  I: {
    description: "Auriculaire tendu verticalement vers le haut, les autres doigts repliés dans le poing.",
    astuce: "Pensez au petit doigt levé."
  },
  J: {
    description: "Dessinez la lettre J dans l'espace avec l'auriculaire tendu (mouvement courbe vers le bas et le haut).",
    astuce: "Lettre mobile : commencez comme le I, puis tracez un crochet."
  },
  K: {
    description: "Index vertical, majeur pointé en diagonale vers l'avant, le pouce posé à la jonction des deux.",
    astuce: "Similaire au signe de la victoire avec le pouce au milieu."
  },
  L: {
    description: "Index tendu vers le haut, pouce tendu horizontalement vers le côté, formant un angle droit.",
    astuce: "Forme classique du L majuscule."
  },
  M: {
    description: "Index, majeur et annulaire pliés vers le bas sur le pouce plié sous eux.",
    astuce: "Trois doigts pointés vers le sol."
  },
  N: {
    description: "Index et majeur pliés vers le bas sur le pouce plié sous eux.",
    astuce: "Deux doigts pointés vers le sol."
  },
  O: {
    description: "Tous les doigts se courbent pour toucher le pouce, formant un cercle parfait.",
    astuce: "Imitez la forme d'un anneau ou de la lettre O."
  },
  P: {
    description: "Index horizontal, majeur pointé vers le bas, le pouce posé au milieu de l'index.",
    astuce: "Identique à la forme du K mais orientée vers le bas."
  },
  Q: {
    description: "Index et pouce pointés vers le bas, imitant la forme de la lettre G mais vers le bas.",
    astuce: "Pensez à ramasser une petite pince au sol."
  },
  R: {
    description: "Index et majeur croisés verticalement, les autres doigts repliés.",
    astuce: "Croisez les doigts pour souhaiter bonne chance."
  },
  S: {
    description: "Poing fermé, le pouce plié en travers sur le devant des autres doigts.",
    astuce: "Un poing fermé classique, contrairement au A où le pouce est sur le côté."
  },
  T: {
    description: "Poing fermé, le pouce glissé verticalement entre l'index et le majeur pliés.",
    astuce: "Le pouce ressort légèrement entre l'index et le majeur."
  },
  U: {
    description: "Index et majeur tendus verticalement et collés ensemble.",
    astuce: "Pensez au chiffre 2 mais avec les doigts serrés."
  },
  V: {
    description: "Index et majeur tendus verticalement et écartés (formant un V).",
    astuce: "Le signe de la paix ou de la victoire."
  },
  W: {
    description: "Index, majeur et annulaire tendus verticalement et écartés en forme de W.",
    astuce: "Le chiffre 3 ou la lettre W."
  },
  X: {
    description: "Index plié en crochet vers le haut, les autres doigts fermés.",
    astuce: "Pensez à un crochet de pirate."
  },
  Y: {
    description: "Pouce et auriculaire tendus vers les côtés, les trois autres doigts repliés.",
    astuce: "Le signe du shaka ou du téléphone."
  },
  Z: {
    description: "Dessinez un Z dans les airs avec l'index tendu.",
    astuce: "Lettre mobile : tracez la forme en zigzag de la lettre Z."
  }
}

export function initialiserDictionnaire() {
  const modal = document.getElementById('modal-dictionnaire')
  const fermer = document.getElementById('bouton-fermer-modal')
  const titre = document.getElementById('modal-titre')
  const badge = document.getElementById('modal-badge')
  const description = document.getElementById('modal-description')
  const astuce = document.getElementById('modal-astuce')
  const symbole = document.getElementById('symbole-lettre')
  const svg = document.getElementById('svg-illustration-lettre')

  if (!modal || !fermer) return

  // Dessine la main squelette par défaut dans le modal
  dessinerMainSquelette(svg)

  // Associe le clic sur chaque carte de la grille
  document.querySelectorAll('.carte-lettre').forEach((carte) => {
    carte.addEventListener('click', () => {
      const lettre = carte.querySelector('.lettre-grande').textContent
      const infos = DESCRIPTION_LETTRES[lettre]

      symbole.textContent = lettre
      titre.textContent = `Lettre ${lettre}`
      badge.style.display = LETTRES_MOBILES.has(lettre) ? 'inline-block' : 'none'
      description.textContent = infos?.description || "Aucune description disponible."
      astuce.textContent = infos?.astuce || ""

      modal.classList.add('actif')
      modal.setAttribute('aria-hidden', 'false')
    })
  })

  // Fermeture du modal
  const fermerModal = () => {
    modal.classList.remove('actif')
    modal.setAttribute('aria-hidden', 'true')
  }

  fermer.addEventListener('click', fermerModal)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) fermerModal()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('actif')) {
      fermerModal()
    }
  })
}
