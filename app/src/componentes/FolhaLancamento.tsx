import { dataBR, justificativaValida, paraSegundos } from '@ponto-certo/motor';
import type { AjusteGravado, BatidaRegistrada, DataISO } from '@ponto-certo/motor';
import { useMemo, useState } from 'preact/hooks';
import { efeitoDaHipotese, textoDoEfeito } from '../dados/previa';
import { useApp } from '../estado/contexto';
import { CampoJustificativa } from './CampoJustificativa';
import { Folha } from './Folha';

function segundosDe(texto: string, comSegundos: boolean): number | null {
  const completo = /^\d{2}:\d{2}$/.test(texto) ? `${texto}:00` : texto;
  if (!comSegundos && !/^\d{2}:\d{2}(:\d{2})?$/.test(texto)) return null;
  try {
    return paraSegundos(completo);
  } catch {
    return null;
  }
}

/** "+ Lançar abono" (horas abonadas no dia) e "+ Batida que faltou" (batida manual). */
export function FolhaLancamento({ tipo, data }: { tipo: 'abono' | 'batidaManual'; data: DataISO }) {
  const app = useApp();
  const [valor, setValor] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const segundos = segundosDe(valor, tipo === 'batidaManual');
  const valido = segundos !== null && (tipo === 'batidaManual' || segundos > 0);

  const previa = useMemo(() => {
    if (!app.estado || !valido || segundos === null) return null;
    if (tipo === 'abono') {
      const ajuste: AjusteGravado = { id: 'hipotese', data, tipo: 'abono_horas', segundos, justificativa: 'prévia', ativo: true, criadoEm: '', autor: '' };
      return textoDoEfeito(data, efeitoDaHipotese(app.estado, app.relogio, data, { ajustes: [ajuste] }), app.relogio.hoje);
    }
    const hora = valor.length === 5 ? `${valor}:00` : valor;
    const batida: BatidaRegistrada = {
      id: 'hipotese', data, segundos, origem: 'manual', status: 'ativa', hora,
      cpfConfere: true, nomeConfere: true, cnpjConfere: true, atraso: 0, recebidoEm: '',
    };
    return textoDoEfeito(data, efeitoDaHipotese(app.estado, app.relogio, data, { batidas: [batida] }), app.relogio.hoje);
  }, [app.estado, app.relogio, data, tipo, valido, segundos, valor]);

  const pronto = valido && justificativaValida(justificativa) && app.podeEscrever && !salvando;

  const salvar = async () => {
    if (segundos === null) return;
    setSalvando(true);
    setFalha(null);
    try {
      if (tipo === 'abono') await app.ajustar({ data, tipo: 'abono_horas', segundos, justificativa: justificativa.trim() });
      else await app.batidaManual(data, valor.length === 5 ? `${valor}:00` : valor, justificativa.trim());
      app.fecharFolha();
    } catch {
      setFalha('Não deu pra salvar agora. Confira a internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Folha aoFechar={app.fecharFolha} rotulo={tipo === 'abono' ? 'Lançar abono' : 'Batida que faltou'}>
      <div class="folha-chapeu">{dataBR(data)}</div>
      <div class="folha-titulo">{tipo === 'abono' ? 'Lançar abono de horas' : 'Informar batida que faltou'}</div>
      <div class="folha-pergunta">
        {tipo === 'abono'
          ? 'Quantas horas foram abonadas nesse dia? (ex.: consulta com declaração)'
          : 'Ela entra como manual, sem comprovante, separada das batidas do e-mail.'}
      </div>
      <div class="campos">
        <div>
          <label class="rotulo-campo" for="valor-lancamento">{tipo === 'abono' ? 'Horas abonadas (horas:minutos)' : 'Horário da batida'}</label>
          <input id="valor-lancamento" class="campo" type="time" step={tipo === 'batidaManual' ? 1 : 60} value={valor} onInput={(e) => setValor((e.target as HTMLInputElement).value)} />
        </div>
      </div>
      <CampoJustificativa valor={justificativa} aoMudar={setJustificativa} />
      {previa && <div class="previa">{previa}</div>}
      {falha && <div class="aviso erro">{falha}</div>}
      <button type="button" class="botao-principal" disabled={!pronto} onClick={salvar}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </Folha>
  );
}
