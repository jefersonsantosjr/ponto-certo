import type { JSX } from 'preact';

type Props = { tamanho?: number } & JSX.SVGAttributes<SVGSVGElement>;

function base(caminho: JSX.Element, { tamanho = 22, ...resto }: Props) {
  return (
    <svg class="icone" viewBox="0 0 24 24" width={tamanho} height={tamanho} aria-hidden="true" {...resto}>
      {caminho}
    </svg>
  );
}

export const IconeRelogio = (p: Props) => base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, p);
export const IconeCalendario = (p: Props) => base(<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>, p);
export const IconeSino = (p: Props) => base(<><path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>, p);
export const IconeCaderno = (p: Props) => base(<><rect x="6" y="3" width="13" height="18" rx="2" /><path d="M4 7h4M4 12h4M4 17h4M11 8h5M11 12h5" /></>, p);
export const IconeVoltar = (p: Props) => base(<path d="M15 5l-7 7 7 7" />, p);
export const IconeAvancar = (p: Props) => base(<path d="M9 5l7 7-7 7" />, p);
export const IconeAtualizar = (p: Props) => base(<><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>, p);
export const IconeBusca = (p: Props) => base(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>, p);
export const IconeBaixar = (p: Props) => base(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />, p);
export const IconeImpressora = (p: Props) => base(<><path d="M7 9V3h10v6" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>, p);
