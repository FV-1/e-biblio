import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Exemplaire } from '../../../commun/api';
import { pluriel } from '../recherche/format';
import { apparenceLivre, NOMBRE_PLANCHES, repartirSurPlanches } from './contenu-etagere';
import { ETAGERE, type Disposition, type EtagereDessinee, type SalleDessinee } from './disposition';

/** Une teinte par rayon pour les meubles ; la place prévue et le lieu de détection ont les leurs. */
const COULEURS_RAYONS = ['#8fa3b8', '#a7b796', '#c9b48f', '#b49ab5', '#94b5b0', '#c79a8a'];
const COULEUR_PREVUE = '#2b5c8f';
const COULEUR_VUE = '#c2412a';
const COULEUR_OUVERTE = '#e0a43a';
const COULEUR_SOL = '#e7e2d8';
const COULEUR_CONTOUR = '#b9b2a4';
/** Bois des meubles et du fond, les mêmes que dans la vue « étagère ». */
const COULEUR_BOIS = '#8a6a4a';
const COULEUR_FOND = '#3a2d22';
const EPAISSEUR = 0.1;

/** Ordre envoyé à la caméra ; `numero` change à chaque demande, même répétée. */
export type CommandeCamera =
  | { readonly type: 'ensemble' | 'dessus' | 'selection' | 'zoom-avant' | 'zoom-arriere'; readonly numero: number }
  | { readonly type: 'salle'; readonly salleId: string; readonly numero: number };

interface Props {
  readonly disposition: Disposition;
  /** Contenu connu de chaque étagère (livres dessinés sur les planches). */
  readonly contenus: ReadonlyMap<string, readonly Exemplaire[]>;
  /** Étagère où l'exemplaire suivi devrait être. */
  readonly prevue: string | null;
  /** Étagère où il a été vu, quand elle diffère de la place prévue. */
  readonly vue: string | null;
  /** Exemplaire suivi : son livre dépasse de la planche. */
  readonly suivi: string | null;
  /** Étagère ouverte dans la vue « étagère » : la caméra se place devant. */
  readonly ouverte: string | null;
  readonly commande: CommandeCamera | null;
  /** Faux quand l'onglet est caché : l'animation s'arrête et ne consomme rien. */
  readonly actif: boolean;
  readonly onOuvrirEtagere: (etagereId: string) => void;
}

/**
 * Rendu Three.js du plan. Seul composant qui dépend de WebGL : il est remplacé
 * par un double dans les tests des écrans (jsdom n'a pas de carte graphique).
 */
export function ScenePlan(props: Props) {
  const { disposition, contenus, prevue, vue, suivi, ouverte, commande, actif } = props;
  const conteneur = useRef<HTMLDivElement>(null);
  const moteur = useRef<Moteur | null>(null);
  const surOuvrir = useRef(props.onOuvrirEtagere);
  surOuvrir.current = props.onOuvrirEtagere;
  const [indisponible, setIndisponible] = useState(false);

  useEffect(() => {
    let m: Moteur;
    try {
      m = creerMoteur(conteneur.current!, (id) => surOuvrir.current(id));
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

  useEffect(
    () => moteur.current?.afficher({ disposition, contenus, prevue, vue, suivi, ouverte }),
    [disposition, contenus, prevue, vue, suivi, ouverte],
  );
  useEffect(() => {
    if (commande) moteur.current?.commander(commande);
  }, [commande?.numero]);
  useEffect(() => moteur.current?.activer(actif), [actif]);

  if (indisponible) {
    return (
      <div className="plan-scene plan-scene-indisponible" role="status">
        La vue 3D n’est pas disponible sur ce poste (WebGL désactivé). Les étagères restent consultables depuis le panneau de gauche.
      </div>
    );
  }
  return (
    <div
      ref={conteneur}
      className="plan-scene"
      tabIndex={0}
      role="application"
      aria-roledescription="plan 3D"
      aria-label="Plan 3D de la bibliothèque. Flèches : déplacer la vue. Les boutons au-dessus du plan permettent aussi de naviguer."
    />
  );
}

interface Etat {
  readonly disposition: Disposition;
  readonly contenus: ReadonlyMap<string, readonly Exemplaire[]>;
  readonly prevue: string | null;
  readonly vue: string | null;
  readonly suivi: string | null;
  readonly ouverte: string | null;
}

interface Moteur {
  afficher(etat: Etat): void;
  commander(commande: CommandeCamera): void;
  activer(actif: boolean): void;
  detruire(): void;
}

interface Vol {
  readonly p0: THREE.Vector3;
  readonly p1: THREE.Vector3;
  readonly c0: THREE.Vector3;
  readonly c1: THREE.Vector3;
  readonly debut: number;
  readonly duree: number;
}

function creerMoteur(element: HTMLElement, onOuvrir: (etagereId: string) => void): Moteur {
  const rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rendu.setPixelRatio(window.devicePixelRatio);
  element.appendChild(rendu.domElement);
  const calqueEtiquettes = new CSS2DRenderer();
  calqueEtiquettes.domElement.className = 'plan-calque-etiquettes';
  element.appendChild(calqueEtiquettes.domElement);
  const infobulle = document.createElement('div');
  infobulle.className = 'plan-infobulle';
  infobulle.hidden = true;
  element.appendChild(infobulle);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#b8b2a6', 2.1));
  const soleil = new THREE.DirectionalLight('#ffffff', 1.5);
  soleil.position.set(30, 60, 40);
  scene.add(soleil);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.3, 2000);
  const controles = new OrbitControls(camera, rendu.domElement);
  controles.enableDamping = true;
  controles.maxPolarAngle = Math.PI * 0.48; // jamais sous le sol
  controles.minDistance = 4;
  controles.maxDistance = 400;
  controles.listenToKeyEvents(element);

  let contenu = new THREE.Group();
  scene.add(contenu);
  let etat: Etat | null = null;
  let meubles = new Map<string, THREE.Group>();
  const reperes: THREE.Object3D[] = [];
  const horloge = new THREE.Clock();
  let vol: Vol | null = null;
  let actif = false;
  let animation = 0;
  let survolee: string | null = null;
  /** Vrai tant que personne n'a bougé la caméra : la vue d'ensemble suit alors la taille de l'écran. */
  let cadrageInitial = true;

  // ---------- Caméra ----------

  const voler = (position: THREE.Vector3, cible: THREE.Vector3, duree = 900) => {
    cadrageInitial = false;
    vol = { p0: camera.position.clone(), p1: position, c0: controles.target.clone(), c1: cible, debut: performance.now(), duree };
  };
  controles.addEventListener('start', () => {
    vol = null; // l'utilisateur reprend la main
    cadrageInitial = false;
  });

  const vueDEnsemble = (): [THREE.Vector3, THREE.Vector3] => {
    const { centre, etendue } = etat!.disposition;
    const c = new THREE.Vector3(centre.x, centre.y, centre.z);
    // Recul calculé pour que tout le plan tienne dans la largeur de l'écran, quel que soit son format.
    const demiAngleHorizontal = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const recul = Math.max((etendue * 0.62) / Math.tan(demiAngleHorizontal), etendue * 0.7);
    return [c.clone().add(new THREE.Vector3(0, 0.56, 0.83).multiplyScalar(recul)), c];
  };
  const centreEtagere = (e: EtagereDessinee) => new THREE.Vector3(e.x, e.y + ETAGERE.hauteur / 2, e.z);
  const etagere = (id: string | null) => (id ? etat?.disposition.etageres.find((e) => e.id === id) : undefined);

  const cadrerSelection = () => {
    const points = [etagere(etat!.prevue), etagere(etat!.vue)]
      .filter((e): e is EtagereDessinee => e !== undefined)
      .map(centreEtagere);
    if (points.length === 0) return;
    // Visée un peu au-dessus des meubles : les étiquettes des repères gardent de la place en haut.
    const cible = points.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(points.length).add(new THREE.Vector3(0, 3, 0));
    const ecart = points.length === 2 ? points[0]!.distanceTo(points[1]!) : 0;
    // Vue plongeante : les meubles du premier rang ne cachent pas les repères.
    const distance = Math.max(22, ecart * 1.5);
    voler(cible.clone().add(new THREE.Vector3(0, distance * 0.85, distance * 0.62)), cible);
  };

  const cadrerEtagere = (e: EtagereDessinee) => {
    const c = centreEtagere(e);
    // De face, à hauteur d'yeux. La vue « étagère » couvre la moitié droite de la scène : le meuble
    // doit tenir dans la moitié gauche, soit environ 42 % de la largeur visible, centré au premier quart.
    const demiAngleHorizontal = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const largeurVisible = ETAGERE.largeur / 0.42;
    const recul = largeurVisible / 2 / Math.tan(demiAngleHorizontal);
    const decalage = new THREE.Vector3(largeurVisible * 0.24, 0, 0);
    voler(c.clone().add(decalage).add(new THREE.Vector3(0, 0.8, recul)), c.clone().add(decalage));
  };

  const cadrerSalle = (s: SalleDessinee) => {
    const c = new THREE.Vector3((s.xMin + s.xMax) / 2, s.y, (s.zMin + s.zMax) / 2);
    const taille = Math.max(s.xMax - s.xMin, s.zMax - s.zMin);
    voler(c.clone().add(new THREE.Vector3(0, taille * 0.75, taille * 0.85)), c);
  };

  // ---------- Survol et clic ----------

  const rayon = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  const etagereSous = (evenement: PointerEvent): string | null => {
    const r = rendu.domElement.getBoundingClientRect();
    pointeur.set(((evenement.clientX - r.left) / r.width) * 2 - 1, -((evenement.clientY - r.top) / r.height) * 2 + 1);
    rayon.setFromCamera(pointeur, camera);
    for (const impact of rayon.intersectObjects([...meubles.values()], true)) {
      let o: THREE.Object3D | null = impact.object;
      while (o && o.userData.etagereId === undefined) o = o.parent;
      if (o) return o.userData.etagereId as string;
    }
    return null;
  };

  const eclairer = (id: string | null, allume: boolean) => {
    meubles.get(id ?? '')?.traverse((o) => {
      if (o instanceof THREE.Mesh && o.userData.cadre) (o.material as THREE.MeshStandardMaterial).emissive.set(allume ? '#3a3a3a' : '#000000');
    });
  };

  const surDeplacement = (evenement: PointerEvent) => {
    const id = evenement.buttons === 0 ? etagereSous(evenement) : null;
    if (id !== survolee) {
      eclairer(survolee, false);
      eclairer(id, true);
      survolee = id;
      rendu.domElement.style.cursor = id ? 'pointer' : 'grab';
      const e = etagere(id);
      if (e) {
        const n = etat!.contenus.get(e.id)?.length;
        infobulle.textContent = `${e.nom} · ${n === undefined ? 'contenu inconnu' : pluriel(n, 'exemplaire')} · clic pour ouvrir`;
      }
      infobulle.hidden = !e;
    }
    if (survolee) {
      const r = element.getBoundingClientRect();
      infobulle.style.left = `${evenement.clientX - r.left + 14}px`;
      infobulle.style.top = `${evenement.clientY - r.top + 14}px`;
    }
  };
  const surSortie = () => {
    eclairer(survolee, false);
    survolee = null;
    infobulle.hidden = true;
  };

  let appui: { x: number; y: number } | null = null;
  const surAppui = (e: PointerEvent) => (appui = { x: e.clientX, y: e.clientY });
  const surRelache = (e: PointerEvent) => {
    // Un vrai clic, pas la fin d'un glisser pour tourner la vue.
    if (appui && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) < 5) {
      const id = etagereSous(e);
      if (id) onOuvrir(id);
    }
    appui = null;
  };
  rendu.domElement.addEventListener('pointermove', surDeplacement);
  rendu.domElement.addEventListener('pointerleave', surSortie);
  rendu.domElement.addEventListener('pointerdown', surAppui);
  rendu.domElement.addEventListener('pointerup', surRelache);

  // ---------- Boucle ----------

  const redimensionner = () => {
    const { clientWidth: largeur, clientHeight: hauteur } = element;
    if (largeur === 0 || hauteur === 0) return; // onglet caché
    rendu.setSize(largeur, hauteur);
    calqueEtiquettes.setSize(largeur, hauteur);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
    if (cadrageInitial && etat) {
      const [position, cible] = vueDEnsemble();
      camera.position.copy(position);
      controles.target.copy(cible);
    }
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(element);

  const boucle = () => {
    animation = requestAnimationFrame(boucle);
    const t = horloge.getElapsedTime();
    reperes.forEach((r, i) => (r.position.y = (r.userData.base as number) + Math.sin(t * 2.4 + i) * 0.3));
    if (vol) {
      const k = Math.min(1, (performance.now() - vol.debut) / vol.duree);
      const lisse = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2; // accélère puis freine
      camera.position.lerpVectors(vol.p0, vol.p1, lisse);
      controles.target.lerpVectors(vol.c0, vol.c1, lisse);
      if (k >= 1) vol = null;
    }
    controles.update();
    rendu.render(scene, camera);
    calqueEtiquettes.render(scene, camera);
  };

  return {
    afficher(nouvel) {
      const precedent = etat;
      etat = nouvel;
      scene.remove(contenu);
      vider(contenu);
      contenu = new THREE.Group();
      meubles = new Map();
      reperes.length = 0;

      for (const s of nouvel.disposition.salles) {
        const sol = new THREE.Mesh(
          new THREE.BoxGeometry(s.xMax - s.xMin, 0.3, s.zMax - s.zMin),
          new THREE.MeshStandardMaterial({ color: COULEUR_SOL }),
        );
        sol.position.set((s.xMin + s.xMax) / 2, s.y - 0.15, (s.zMin + s.zMax) / 2);
        const contour = new THREE.LineSegments(new THREE.EdgesGeometry(sol.geometry), new THREE.LineBasicMaterial({ color: COULEUR_CONTOUR }));
        contour.position.copy(sol.position);
        contenu.add(sol, contour, etiquette(s.nom, 'plan-etiquette-salle', new THREE.Vector3((s.xMin + s.xMax) / 2, s.y, s.zMax + 1.5)));
      }

      for (const e of nouvel.disposition.etageres) {
        const signal = e.id === nouvel.prevue ? COULEUR_PREVUE : e.id === nouvel.vue ? COULEUR_VUE : null;
        const meuble = construireMeuble(e, COULEURS_RAYONS[e.rangRayon % COULEURS_RAYONS.length]!, signal, nouvel.contenus.get(e.id) ?? [], nouvel.suivi);
        if (e.id === nouvel.ouverte) meuble.add(cadreOuverture());
        meubles.set(e.id, meuble);
        contenu.add(meuble);
      }
      if (survolee) eclairer(survolee, true);

      const prevue = etagere(nouvel.prevue);
      const vue = etagere(nouvel.vue);
      if (prevue) reperes.push(repere(contenu, prevue, COULEUR_PREVUE, `Place prévue · ${prevue.nom}`, 'plan-etiquette-prevue'));
      if (vue) reperes.push(repere(contenu, vue, COULEUR_VUE, `Vu ici · ${vue.nom}`, 'plan-etiquette-vue'));
      if (prevue && vue) contenu.add(arc(prevue, vue));
      scene.add(contenu);

      // Cadrage : vue d'ensemble au premier affichage, puis seulement quand la demande change.
      if (!precedent) {
        const [position, cible] = vueDEnsemble();
        camera.position.copy(position);
        controles.target.copy(cible);
      } else if (nouvel.ouverte && nouvel.ouverte !== precedent.ouverte) {
        const e = etagere(nouvel.ouverte);
        if (e) cadrerEtagere(e);
      } else if (nouvel.prevue !== precedent.prevue || nouvel.vue !== precedent.vue || nouvel.suivi !== precedent.suivi) {
        cadrerSelection();
      }
    },

    commander(commande) {
      if (!etat) return;
      switch (commande.type) {
        case 'ensemble':
          return voler(...vueDEnsemble());
        case 'dessus': {
          const { centre, etendue } = etat.disposition;
          const c = new THREE.Vector3(centre.x, centre.y, centre.z);
          return voler(c.clone().add(new THREE.Vector3(0, etendue * 1.3, 0.01)), c);
        }
        case 'selection':
          return cadrerSelection();
        case 'zoom-avant':
        case 'zoom-arriere': {
          const facteur = commande.type === 'zoom-avant' ? 0.7 : 1.4;
          const decalage = camera.position.clone().sub(controles.target).multiplyScalar(facteur);
          return voler(controles.target.clone().add(decalage), controles.target.clone(), 350);
        }
        case 'salle': {
          const s = etat.disposition.salles.find((x) => x.id === commande.salleId);
          if (s) cadrerSalle(s);
        }
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
      rendu.domElement.removeEventListener('pointermove', surDeplacement);
      rendu.domElement.removeEventListener('pointerleave', surSortie);
      rendu.domElement.removeEventListener('pointerdown', surAppui);
      rendu.domElement.removeEventListener('pointerup', surRelache);
      vider(contenu);
      rendu.dispose();
      rendu.domElement.remove();
      calqueEtiquettes.domElement.remove();
      infobulle.remove();
    },
  };
}

/**
 * Un meuble de rangement : deux montants, un fond, des planches, un fronton à la
 * couleur du rayon, et les livres à la place que leur donne repartirSurPlanches
 * (la même que dans la vue « étagère »). `signal` colore tout le bois : place
 * prévue ou lieu de détection de l'exemplaire suivi.
 */
function construireMeuble(
  e: EtagereDessinee,
  teinteRayon: string,
  signal: string | null,
  exemplaires: readonly Exemplaire[],
  suivi: string | null,
): THREE.Group {
  const { largeur: L, hauteur: H, profondeur: P } = ETAGERE;
  const meuble = new THREE.Group();
  meuble.position.set(e.x, e.y, e.z);
  meuble.userData.etagereId = e.id;

  const bois = new THREE.MeshStandardMaterial({ color: signal ?? COULEUR_BOIS, transparent: e.approchee, opacity: e.approchee ? 0.5 : 1 });
  const fond = new THREE.MeshStandardMaterial({ color: signal ? new THREE.Color(signal).multiplyScalar(0.45) : COULEUR_FOND });
  const fronton = new THREE.MeshStandardMaterial({ color: teinteRayon });
  const piece = (l: number, h: number, p: number, x: number, y: number, z: number, matiere: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(l, h, p), matiere);
    m.position.set(x, y, z);
    m.userData.cadre = true;
    meuble.add(m);
  };
  piece(EPAISSEUR, H, P, -L / 2 + EPAISSEUR / 2, H / 2, 0, bois);
  piece(EPAISSEUR, H, P, L / 2 - EPAISSEUR / 2, H / 2, 0, bois);
  piece(L, H, EPAISSEUR, 0, H / 2, -P / 2 + EPAISSEUR / 2, fond);
  const pas = (H - EPAISSEUR) / NOMBRE_PLANCHES;
  for (let k = 0; k <= NOMBRE_PLANCHES; k++) piece(L - 2 * EPAISSEUR, EPAISSEUR, P, 0, EPAISSEUR / 2 + k * pas, 0, bois);
  piece(L, 0.28, P + 0.06, 0, H + 0.14, 0, fronton); // fronton : on reconnaît le rayon même de loin

  const hauteurNiveau = pas - EPAISSEUR;
  repartirSurPlanches(exemplaires, e.id).forEach((planche, p) => {
    // La planche 0 est en haut : elle repose sur la planche NOMBRE_PLANCHES - 1 en partant du bas.
    const base = EPAISSEUR + (NOMBRE_PLANCHES - 1 - p) * pas;
    let x = -L / 2 + EPAISSEUR + 0.2;
    for (const { exemplaire, statut } of planche) {
      const a = apparenceLivre(exemplaire.livreId);
      const largeurLivre = a.largeur * 0.6;
      const hauteurLivre = a.hauteur * hauteurNiveau;
      const profondeurLivre = P * 0.72;
      const estSuivi = exemplaire.id === suivi;
      const matiere =
        statut === 'absent'
          ? new THREE.MeshBasicMaterial({ color: '#9aa3ad', transparent: true, opacity: 0.22, depthWrite: false })
          : new THREE.MeshStandardMaterial({
              color: statut === 'intrus' ? COULEUR_VUE : a.couleur,
              emissive: estSuivi ? COULEUR_PREVUE : statut === 'intrus' ? COULEUR_VUE : '#000000',
              emissiveIntensity: estSuivi ? 0.7 : 0.35,
            });
      const livre = new THREE.Mesh(new THREE.BoxGeometry(largeurLivre, hauteurLivre, profondeurLivre), matiere);
      livre.position.set(x + largeurLivre / 2, base + hauteurLivre / 2, P / 2 - profondeurLivre / 2 - 0.04 + (estSuivi ? 0.45 : 0));
      meuble.add(livre);
      x += largeurLivre + 0.04;
    }
  });
  return meuble;
}

/** Contour lumineux autour du meuble ouvert dans la vue « étagère ». */
function cadreOuverture(): THREE.LineSegments {
  const { largeur: L, hauteur: H, profondeur: P } = ETAGERE;
  const cadre = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(L + 0.3, H + 0.3, P + 0.3)),
    new THREE.LineBasicMaterial({ color: COULEUR_OUVERTE }),
  );
  cadre.position.y = H / 2;
  return cadre;
}

/** Repère flottant au-dessus d'une étagère : une pointe vers le bas et une bille. */
function repere(groupe: THREE.Group, e: EtagereDessinee, couleur: string, texte: string, classe: string): THREE.Object3D {
  const matiere = new THREE.MeshStandardMaterial({ color: couleur, emissive: couleur, emissiveIntensity: 0.35 });
  const pointe = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 24), matiere);
  pointe.rotation.x = Math.PI; // pointe vers l'étagère
  const bille = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 16), matiere);
  bille.position.y = 1.8;
  const r = new THREE.Group();
  r.add(pointe, bille, etiquette(texte, classe, new THREE.Vector3(0, 4.8, 0)));
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
