import type { NomeRota } from '../estado/rotas';
import { IconeCaderno, IconeCalendario, IconeRelogio, IconeSino } from './Icones';

interface Props {
  atual: NomeRota;
  pendencias: number;
}

export function Abas({ atual, pendencias }: Props) {
  const ativa = (nomes: NomeRota[]) => (nomes.includes(atual) ? 'aba ativa' : 'aba');
  return (
    <nav class="abas" aria-label="Navegação principal">
      <a class={ativa(['hoje', 'config'])} href="#/hoje"><IconeRelogio />Hoje</a>
      <a class={ativa(['mes', 'dia'])} href="#/mes"><IconeCalendario />Mês</a>
      <a class={ativa(['pendencias'])} href="#/pendencias">
        {pendencias > 0 && <span class="selo">{pendencias}</span>}
        <IconeSino />Pendências
      </a>
      <a class={ativa(['caderninho'])} href="#/caderninho"><IconeCaderno />Caderninho</a>
    </nav>
  );
}
