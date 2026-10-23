import { diaDaSemana } from '@ponto-certo/motor';
import type { Pendencia } from '@ponto-certo/motor';
import { DIAS_CURTOS } from '../dados/datas';
import { perguntaPendencia, tituloPendencia } from '../dados/rotulos';
import { useApp } from '../estado/contexto';

/** Cartão âmbar de uma pendência, com Sim/Não (abono) ou "Responder". */
export function CartaoPendencia({ pendencia }: { pendencia: Pendencia }) {
  const app = useApp();
  const titulo = tituloPendencia(pendencia, DIAS_CURTOS[diaDaSemana(pendencia.data)]);
  const abrir = (preferencia?: 'sim' | 'nao') => app.abrirFolha({ tipo: 'pendencia', pendencia, preferencia });
  return (
    <div class="pendencia">
      ⚠️ <b>{titulo}</b>
      <div>{perguntaPendencia(pendencia)}</div>
      {app.podeEscrever && (
        <div class="botoes">
          {pendencia.tipo === 'abono_intervalo' ? (
            <>
              <button type="button" class="botao-sim" onClick={() => abrir('sim')}>Sim, foi abonado</button>
              <button type="button" class="botao-nao" onClick={() => abrir('nao')}>Não</button>
            </>
          ) : (
            <button type="button" class="botao-nao" onClick={() => abrir()}>Responder</button>
          )}
        </div>
      )}
    </div>
  );
}
