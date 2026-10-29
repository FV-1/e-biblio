import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ETAGERE, type Disposition, type EtagereDessinee } from './disposition';

/** Une couleur par rayon ; la place prévue et le lieu de détection ont les leurs. */
const COULEURS_RAYONS = ['#8fa3b8', '#a7b796', '#c9b48f', '#b49ab5', '#94b5b0', '#c79a8a'];
const COULEUR_PREVUE = '#2b5c8f';
const COULEUR_VUE = '#c2412a';
const COULEUR_SOL = '#e7e2d8';
const COULEUR_CONTOUR = '#b9b2a4';

interface Props {
  readonly disposition: Disposition;
  /** Étagère où l'exemplaire devrait être. */
  readonly prevue: string | null;
  /** Étagère où il a été vu, quand elle diffère de la place prévue. */
  readonly vue: string | null;
  /** Faux quand l'onglet est caché : l'animation s'arrête et ne consomme rien. */
  readonly actif: boolean;
}

/**
 * Rendu Three.js du plan. Seul composant qui dépend de WebGL : il est remplacé
 * par un double dans les tests des écrans (jsdom n'a pas de carte graphique).
 */
export function ScenePlan({ disposition, prevue, vue, actif }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const moteur = useRef<Moteur | null>(null);
  const [indisponible, setIndisponible] = useState(false);

  useEffect(() => {
    let m: Moteur;
    try {
      m = creerMoteur(conteneur.current!);
    } catch {
      setIndisponible(true);
      return;
    }
    moteur.current = m;
    return () => {
      m.detruire();
      moteur.current = null;
    };
  }, []);

  useEffect(() => moteur.current?.afficher(disposition, prevue, vue), [disposition, prevue, vue]);
  useEffect(() => moteur.current?.activer(actif), [actif]);

  if (indisponible) {
    return (
      <div className="plan-scene plan-scene-indisponible" role="status">
        La vue 3D n’est pas disponible sur ce poste (WebGL désactivé). La localisation reste affichée à gauche.
      </div>
    );
  }
  return <div ref={conteneur} className="plan-scene" aria-hidden="true" />;
}

interface Moteur {
  afficher(disposition: Disposition, prevue: string | null, vue: string | null): void;
  activer(actif: boolean): void;
  detruire(): void;
}

function creerMoteur(element: HTMLElement): Moteur {
  const rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rendu.setPixelRatio(window.devicePixelRatio);
  element.appendChild(rendu.domElement);
  const calqueEtiquettes = new CSS2DRenderer();
  calqueEtiquettes.domElement.className = 'plan-calque-etiquettes';
  element.appendChild(calqueEtiquettes.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#b8b2a6', 2.2));
  const soleil = new THREE.DirectionalLight('#ffffff', 1.4);
  soleil.position.set(30, 60, 40);
  scene.add(soleil);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 2000);
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.enableDamping = true;
  controles.maxPolarAngle = Math.PI * 0.47; // jamais sous le sol

  let contenu = new THREE.Group();
  scene.add(contenu);
  const reperes: THREE.Object3D[] = [];
  const cible = new THREE.Vector3();
  const horloge = new THREE.Clock();
  let premierCadrage = true;
  let actif = false;
  let animation = 0;

  const redimensionner = () => {
    const { clientWidth: largeur, clientHeight: hauteur } = element;
    if (largeur === 0 || hauteur === 0) return; // onglet caché
    rendu.setSize(largeur, hauteur);
    calqueEtiquettes.setSize(largeur, hauteur);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(element);

  const boucle = () => {
    animation = requestAnimationFrame(boucle);
    const t = horloge.getElapsedTime();
    reperes.forEach((r, i) => (r.position.y = (r.userData.base as number) + Math.sin(t * 2.4 + i) * 0.35));
    // La caméra glisse vers le livre sélectionné sans changer d'angle : elle suit la cible.
    const avant = controles.target.clone();
    controles.target.lerp(cible, 0.08);
    camera.position.add(controles.target.clone().sub(avant));
    controles.update();
    rendu.render(scene, camera);
    calqueEtiquettes.render(scene, camera);
  };

  return {
    afficher(disposition, prevue, vue) {
      scene.remove(contenu);
      vider(contenu);
      contenu = new THREE.Group();
      reperes.length = 0;

      for (const s of disposition.salles) {
        const sol = new THREE.Mesh(
          new THREE.BoxGeometry(s.xMax - s.xMin, 0.3, s.zMax - s.zMin),
          new THREE.MeshStandardMaterial({ color: COULEUR_SOL }),
        );
        sol.position.set((s.xMin + s.xMax) / 2, s.y - 0.15, (s.zMin + s.zMax) / 2);
        const contour = new THREE.LineSegments(new THREE.EdgesGeometry(sol.geometry), new THREE.LineBasicMaterial({ color: COULEUR_CONTOUR }));
        contour.position.copy(sol.position);
        contenu.add(sol, contour, etiquette(s.nom, 'plan-etiquette-salle', new THREE.Vector3((s.xMin + s.xMax) / 2, s.y, s.zMax + 1.5)));
      }

      for (const e of disposition.etageres) {
        const couleur = e.id === prevue ? COULEUR_PREVUE : e.id === vue ? COULEUR_VUE : COULEURS_RAYONS[e.rangRayon % COULEURS_RAYONS.length]!;
        const boite = new THREE.Mesh(
          new THREE.BoxGeometry(ETAGERE.largeur, ETAGERE.hauteur, ETAGERE.profondeur),
          new THREE.MeshStandardMaterial({ color: couleur, transparent: e.approchee, opacity: e.approchee ? 0.5 : 1 }),
        );
        boite.position.set(e.x, e.y + ETAGERE.hauteur / 2, e.z);
        contenu.add(boite);
      }

      const trouver = (id: string | null) => (id ? disposition.etageres.find((e) => e.id === id) : undefined);
      const etagerePrevue = trouver(prevue);
      const etagereVue = trouver(vue);
      if (etagerePrevue) reperes.push(repere(contenu, etagerePrevue, COULEUR_PREVUE, `Place prévue · ${etagerePrevue.nom}`, 'plan-etiquette-prevue'));
      if (etagereVue) reperes.push(repere(contenu, etagereVue, COULEUR_VUE, `Vu ici · ${etagereVue.nom}`, 'plan-etiquette-vue'));
      if (etagerePrevue && etagereVue) contenu.add(arc(etagerePrevue, etagereVue));
      scene.add(contenu);

      const { centre, etendue } = disposition;
      const focus = [etagerePrevue, etagereVue].filter((e): e is EtagereDessinee => e !== undefined);
      if (focus.length > 0) {
        cible.set(
          focus.reduce((s, e) => s + e.x, 0) / focus.length,
          focus[0]!.y + ETAGERE.hauteur / 2,
          focus.reduce((s, e) => s + e.z, 0) / focus.length,
        );
      } else {
        cible.set(centre.x, centre.y, centre.z);
      }
      if (premierCadrage) {
        camera.position.set(centre.x, centre.y + etendue * 0.7, centre.z + etendue * 0.92);
        controles.target.copy(cible);
        premierCadrage = false;
      }
    },

    activer(nouveau) {
      if (nouveau && !actif) {
        redimensionner();
        boucle();
      } else if (!nouveau && actif) {
        cancelAnimationFrame(animation);
      }
      actif = nouveau;
    },

    detruire() {
      cancelAnimationFrame(animation);
      observateur.disconnect();
      controles.dispose();
      vider(contenu);
      rendu.dispose();
      rendu.domElement.remove();
      calqueEtiquettes.domElement.remove();
    },
  };
}

/** Repère flottant au-dessus d'une étagère : une pointe vers le bas et une bille. */
function repere(groupe: THREE.Group, e: EtagereDessinee, couleur: string, texte: string, classe: string): THREE.Object3D {
  const matiere = new THREE.MeshStandardMaterial({ color: couleur, emissive: couleur, emissiveIntensity: 0.35 });
  const pointe = new THREE.Mesh(new THREE.ConeGeometry(1, 2.4, 24), matiere);
  pointe.rotation.x = Math.PI; // pointe vers l'étagère
  const bille = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 16), matiere);
  bille.position.y = 1.9;
  const r = new THREE.Group();
  r.add(pointe, bille, etiquette(texte, classe, new THREE.Vector3(0, 5.2, 0)));
  r.userData.base = e.y + ETAGERE.hauteur + 1.8;
  r.position.set(e.x, r.userData.base as number, e.z);
  groupe.add(r);
  return r;
}

/** Arc pointillé de la place prévue vers le lieu où l'exemplaire a été vu. */
function arc(de: EtagereDessinee, vers: EtagereDessinee): THREE.Line {
  const hauteur = ETAGERE.hauteur + 0.4;
  const a = new THREE.Vector3(de.x, de.y + hauteur, de.z);
  const b = new THREE.Vector3(vers.x, vers.y + hauteur, vers.z);
  const sommet = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 4 + a.distanceTo(b) * 0.3, 0));
  const ligne = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, sommet, b).getPoints(48)),
    new THREE.LineDashedMaterial({ color: COULEUR_VUE, dashSize: 0.9, gapSize: 0.5 }),
  );
  ligne.computeLineDistances();
  return ligne;
}

function etiquette(texte: string, classe: string, position: THREE.Vector3): CSS2DObject {
  const div = document.createElement('div');
  div.className = `plan-etiquette ${classe}`;
  div.textContent = texte;
  const objet = new CSS2DObject(div);
  objet.position.copy(position);
  return objet;
}

/** Libère la mémoire graphique et retire les étiquettes du DOM. */
function vider(groupe: THREE.Object3D) {
  groupe.traverse((o) => {
    if (o instanceof CSS2DObject) o.element.remove();
    if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
      o.geometry.dispose();
      const matieres = Array.isArray(o.material) ? o.material : [o.material];
      matieres.forEach((m: THREE.Material) => m.dispose());
    }
  });
}
