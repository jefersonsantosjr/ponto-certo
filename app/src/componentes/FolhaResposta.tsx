import { dataCurtaBR, formatarHoraCurta, justificativaValida, paraSegundos } from '@ponto-certo/motor';
import type { BatidaRegistrada, ClassificacaoDia, Pendencia, Resposta } from '@ponto-certo/motor';
import { useMemo, useState } from 'preact/hooks';
import { DIAS_CURTOS } from '../dados/datas';
import { efeitoDaHipotese, textoDoEfeito } from '../dados/previa';
import { CLASSIFICACOES_DIA, perguntaPendencia } from '../dados/rotulos';
import { useApp } from '../estado/contexto';
import { diaDaSemana } from '@ponto-certo/motor';
import { CampoJustificativa } from './CampoJustificativa';
import { Folha } from './Folha';

interface Opcao {
  chave: string;
  rotulo: string;
  contra?: boolean;
}

function opcoesDa(p: Pendencia): Opcao[] {
  switch (p.tipo) {
    case 'abono_intervalo':
      return [{ chave: 'sim', rotulo: '✓ Sim, foi abonado' }, { chave: 'nao', rotulo: 'Não, desconta', contra: true }];
    case 'dia_sem_batida':
      return (Object.keys(CLASSIFICACOES_DIA) as ClassificacaoDia[]).map((c) => ({ chave: c, rotulo: CLASSIFICACOES_DIA[c], contra: c === 'folga_banco' }));
    case 'so_duas_batidas':
      return [{ chave: 'almocou', rotulo: 'Almocei sem bater' }, { chave: 'nao_almocou', rotulo: 'Não almocei', contra: true }];
    case 'almoco_ambiguo':
      return p.opcoes.map((o) => ({ chave: `${o.inicio}-${o.fim}`, rotulo: `Almoço ${formatarHoraCurta(o.inicio)}–${formatarHoraCurta(o.fim)}` }));
    case 'batida_faltando':
      return [{ chave: 'informar', rotulo: 'Informar o horário' }, { chave: 'nao_sei', rotulo: 'Não sei', contra: true }];
  }
}

function titulo(p: Pendencia): string {
  switch (p.tipo) {
    case 'abono_intervalo':
      return `Saída das ${formatarHoraCurta(p.inicio)} às ${formatarHoraCurta(p.fim)}`;
    case 'dia_sem_batida':
      return 'Dia sem nenhuma batida';
    case 'batida_faltando':
      return 'Batida faltando';
    case 'so_duas_batidas':
      return 'Só entrada e saída';
    case 'almoco_ambiguo':
      return 'Qual foi o almoço?';
  }
}

function respostaPara(p: Pendencia, chave: string, justificativa: string): Resposta | null {
  switch (p.tipo) {
    case 'abono_intervalo':
      return { tipo: 'abono_intervalo', data: p.data, inicio: p.inicio, fim: p.fim, abonado: chave === 'sim', justificativa };
    case 'dia_sem_batida':
      return { tipo: 'dia_sem_batida', data: p.data, classificacao: chave as ClassificacaoDia, justificativa };
    case 'so_duas_batidas':
      return { tipo: 'so_duas_batidas', data: p.data, almocou: chave === 'almocou', justificativa };
    case 'almoco_ambiguo': {
      const [inicio, fim] = chave.split('-').map(Number);
      return { tipo: 'almoco_escolhido', data: p.data, inicio, fim, justificativa };
    }
    case 'batida_faltando':
      return chave === 'nao_sei' ? { tipo: 'batida_faltando', data: p.data, justificativa } : null;
  }
}

function horaValida(hora: string): string | null {
  const completa = /^\d{2}:\d{2}$/.test(hora) ? `${hora}:00` : hora;
  try {
    paraSegundos(completa);
    return completa;
  } catch {
    return null;
  }
}

export function FolhaResposta({ pendencia, preferencia }: { pendencia: Pendencia; preferencia?: 'sim' | 'nao' }) {
  const app = useApp();
  const [escolha, setEscolha] = useState<string | null>(pendencia.tipo === 'abono_intervalo' ? (preferencia ?? null) : null);
  const [justificativa, setJustificativa] = useState('');
  const [hora, setHora] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const opcoes = opcoesDa(pendencia);
  const informarHora = pendencia.tipo === 'batida_faltando' && escolha === 'informar';
  const horaCompleta = informarHora ? horaValida(hora) : null;

  const previa = useMemo(() => {
    if (!app.estado || !escolha) return null;
    if (informarHora) {
      if (!horaCompleta) return null;
      const hipotese: BatidaRegistrada = {
        id: 'hipotese', data: pendencia.data, segundos: paraSegundos(horaCompleta), origem: 'manual', status: 'ativa', hora: horaCompleta,
        cpfConfere: true, nomeConfere: true, cnpjConfere: true, atraso: 0, recebidoEm: '',
      };
      return textoDoEfeito(pendencia.data, efeitoDaHipotese(app.estado, app.relogio, pendencia.data, { batidas: [hipotese] }), app.relogio.hoje);
    }
    const resposta = respostaPara(pendencia, escolha, 'prévia');
    if (!resposta) return null;
    return textoDoEfeito(pendencia.data, efeitoDaHipotese(app.estado, app.relogio, pendencia.data, { respostas: [resposta] }), app.relogio.hoje);
  }, [app.estado, app.relogio, pendencia, escolha, informarHora, horaCompleta]);

  const pronto = escolha !== null && justificativaValida(justificativa) && (!informarHora || horaCompleta !== null) && app.podeEscrever && !salvando;

  const salvar = async () => {
    if (!escolha) return;
    setSalvando(true);
    setFalha(null);
    try {
      if (informarHora && horaCompleta) {
        await app.batidaManual(pendencia.data, horaCompleta, justificativa.trim());
      } else {
        const resposta = respostaPara(pendencia, escolha, justificativa.trim());
        if (resposta) await app.responder(resposta);
      }
      app.fecharFolha();
    } catch {
      setFalha('Não deu pra salvar agora. Confira a internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Folha aoFechar={app.fecharFolha} rotulo="Responder pendência">
      <div class="folha-chapeu">{DIAS_CURTOS[diaDaSemana(pendencia.data)]}, {dataCurtaBR(pendencia.data)}</div>
      <div class="folha-titulo">{titulo(pendencia)}</div>
      <div class="folha-pergunta">{perguntaPendencia(pendencia)}</div>
      <div class={opcoes.length === 1 ? 'opcoes uma' : 'opcoes'}>
        {opcoes.map((o) => (
          <button
            type="button"
            key={o.chave}
            class={`opcao${escolha === o.chave ? ' marcada' : ''}${escolha === o.chave && o.contra ? ' contra' : ''}`}
            onClick={() => setEscolha(o.chave)}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
      {informarHora && (
        <div class="campos">
          <div>
            <label class="rotulo-campo" for="hora-faltando">Horário da batida <i>sem comprovante</i></label>
            <input id="hora-faltando" class="campo" type="time" step={1} value={hora} onInput={(e) => setHora((e.target as HTMLInputElement).value)} />
          </div>
        </div>
      )}
      <CampoJustificativa valor={justificativa} aoMudar={setJustificativa} />
      {previa && <div class="previa">{previa}</div>}
      {falha && <div class="aviso erro">{falha}</div>}
      {!app.podeEscrever && <div class="aviso">{app.semConexao ? 'Sem conexão: pra responder precisa de internet.' : 'Seu acesso é só de leitura.'}</div>}
      <button type="button" class="botao-principal" disabled={!pronto} onClick={salvar}>
        {salvando ? 'Salvando…' : 'Salvar resposta'}
      </button>
      <div class="nota">Dá pra mudar a resposta depois, no detalhe do dia.</div>
    </Folha>
  );
}
