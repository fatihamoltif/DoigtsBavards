/*
 * Volet JS du test de cohérence : lit la même fixture de landmarks,
 * applique EXACTEMENT la normalisation du navigateur (js/normalisation.js),
 * et imprime les vecteurs 63-dim en JSON sur la sortie standard.
 *
 * Appelé par entrainement/test_coherence.py, qui compare ces vecteurs à ceux
 * calculés par entrainement/normalisation.py.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { normaliserMain, VERSION_NORMALISATION } from '../js/normalisation.js'

const ici = dirname(fileURLToPath(import.meta.url))
const echantillons = JSON.parse(
  readFileSync(join(ici, 'fixtures_landmarks.json'), 'utf-8'),
)

const sortie = echantillons.map((ech) => {
  // La fixture stocke les points en [x, y, z] ; on les passe en {x, y, z}.
  const landmarks = ech.landmarks.map(([x, y, z]) => ({ x, y, z }))
  const vecteur = normaliserMain(landmarks, ech.lateralite)
  return { nom: ech.nom, vecteur: vecteur ? Array.from(vecteur) : null }
})

console.log(JSON.stringify({ version: VERSION_NORMALISATION, echantillons: sortie }))
