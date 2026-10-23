import { ATALHOS_JUSTIFICATIVA } from '../dados/rotulos';

interface Props {
  valor: string;
  aoMudar(valor: string): void;
}

/** Justificativa obrigatória, com atalhos para os motivos mais comuns. */
export function CampoJustificativa({ valor, aoMudar }: Props) {
  const usar = (atalho: string) => {
    const atual = valor.trim();
    aoMudar(atual.startsWith(atalho) ? atual : atual ? `${atalho}. ${atual}` : atalho);
  };
  return (
    <div>
      <label class="rotulo-campo" for="justificativa">Justificativa <i>obrigatória</i></label>
      <textarea
        id="justificativa"
        class="campo"
        value={valor}
        placeholder="O que aconteceu? Isso fica guardado pra você consultar depois."
        onInput={(e) => aoMudar((e.target as HTMLTextAreaElement).value)}
      />
      <div class="atalhos">
        {ATALHOS_JUSTIFICATIVA.map((atalho) => (
          <button type="button" key={atalho} class={valor.startsWith(atalho) ? 'atalho marcado' : 'atalho'} onClick={() => usar(atalho)}>
            {atalho}
          </button>
        ))}
      </div>
    </div>
  );
}
