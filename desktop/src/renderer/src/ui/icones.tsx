import type { SVGProps } from 'react';

/** Icônes SVG en ligne (aucune dépendance, aucun chargement réseau : compatible avec la CSP). */
function Icone({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const IconeLivres = (p: P) => (
  <Icone {...p}>
    <path d="M4 19.5V5a2 2 0 0 1 2-2h4v18H6a2 2 0 0 1-2-1.5Z" />
    <path d="M10 3h4v18h-4" />
    <path d="m15.5 4.2 3.8-1 2.6 16.4-3.8 1z" />
  </Icone>
);

export const IconeRecherche = (p: P) => (
  <Icone {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icone>
);

export const IconePlus = (p: P) => (
  <Icone {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icone>
);

export const IconeCodeBarres = (p: P) => (
  <Icone {...p}>
    <path d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12" />
  </Icone>
);

export const IconeTelephone = (p: P) => (
  <Icone {...p}>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Icone>
);

export const IconeCrayon = (p: P) => (
  <Icone {...p}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Icone>
);

export const IconeValide = (p: P) => (
  <Icone {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icone>
);

export const IconeAlerte = (p: P) => (
  <Icone {...p}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 10v4M12 17.5v.01" />
  </Icone>
);

export const IconeEtagere = (p: P) => (
  <Icone {...p}>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <path d="M3 9h18M3 15h18" />
  </Icone>
);

export const IconePlan = (p: P) => (
  <Icone {...p}>
    <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
    <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
  </Icone>
);

export const IconeBase = (p: P) => (
  <Icone {...p}>
    <ellipse cx="12" cy="5.5" rx="8" ry="3" />
    <path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    <path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </Icone>
);

export const IconeChevron = (p: P) => (
  <Icone {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icone>
);

export const IconeActualiser = (p: P) => (
  <Icone {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </Icone>
);

export const IconeCopier = (p: P) => (
  <Icone {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </Icone>
);

export const IconeFermer = (p: P) => (
  <Icone {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icone>
);
