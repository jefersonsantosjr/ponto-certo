import { dataBR, formatarDuracao } from '@ponto-certo/motor';
import { useApp } from '../estado/contexto';
import { Folha } from './Folha';

const ORIGEM = { comprovante: 'Comprovante do e-mail', provisoria: 'Provisória (horário do e-mail)', manual: 'Manual, sem comprovante' } as const;

export function FolhaBatida({ batidaId }: { batidaId: string }) {
  const app = useApp();
  const batida = app.estado?.batidas.find((b) => b.id === batidaId);
  if (!batida) return null;
  const doDia = app.calculo?.dia(batida.data)?.batidas.find((b) => b.id === batidaId);
  const situacao =
    batida.status === 'fora_da_conta' ? 'Fora da conta: CPF de outra pessoa'
      : batida.status === 'substituida' ? 'Substituída pelo comprovante'
        : doDia?.duplicada ? 'Duplicada: ignorada no cálculo'
          : 'Válida, entra no cálculo';
  const identidade = [
    batida.cpfConfere ? 'CPF ✓' : 'CPF diferente',
    batida.nomeConfere ? 'nome ✓' : `nome diferente${batida.nomeNoComprovante ? ` (${batida.nomeNoComprovante})` : ''}`,
    batida.cnpjConfere ? 'empresa ✓' : 'CNPJ diferente',
  ].join(' · ');

  return (
    <Folha aoFechar={app.fecharFolha} rotulo="Comprovante">
      <div class="folha-chapeu">{ORIGEM[batida.origem]}</div>
      <div class="folha-titulo">{dataBR(batida.data)} às {batida.hora}</div>
      <dl class="detalhe">
        <dt>Situação</dt><dd>{situacao}</dd>
        {batida.nsr && (<><dt>NSR</dt><dd>{batida.nsr}</dd></>)}
        {batida.hash && (<><dt>Hash</dt><dd>{batida.hash}</dd></>)}
        {batida.inpi && (<><dt>INPI</dt><dd>{batida.inpi}</dd></>)}
        {batida.recebidoEm && (<><dt>E-mail chegou</dt><dd>{batida.recebidoEm}</dd></>)}
        {batida.atraso > 0 && (<><dt>Atraso</dt><dd>{formatarDuracao(batida.atraso)}</dd></>)}
        {batida.origem !== 'manual' && (<><dt>Identidade</dt><dd>{identidade}</dd></>)}
        {batida.justificativa && (<><dt>Justificativa</dt><dd>{batida.justificativa}</dd></>)}
      </dl>
      {batida.idGmail && (
        <a class="botao-secundario" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }} href={`https://mail.google.com/mail/u/0/#all/${batida.idGmail}`} target="_blank" rel="noopener noreferrer">
          Abrir o e-mail no Gmail
        </a>
      )}
      <div class="nota">O NSR e o hash são a prova da batida no sistema de ponto da empresa.</div>
    </Folha>
  );
}
