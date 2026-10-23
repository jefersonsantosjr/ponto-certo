import { useEffect, useState } from 'preact/hooks';
import { Carregando } from '../componentes/Avisos';
import { useApp } from '../estado/contexto';
import { navegar, type Rota } from '../estado/rotas';

const LOGO = `${import.meta.env.BASE_URL}icones/icone-192.png`;

export function BoasVindas() {
  const app = useApp();
  return (
    <div class="boas-vindas">
      <img class="logo" src={LOGO} alt="" />
      <h1>Ponto Certo</h1>
      <p>Seu banco de horas, conferido com os comprovantes que chegam no seu e-mail.</p>
      <p><b>Pra começar, abra o link de ativação que o Jéferson te mandou.</b> É só tocar nele uma vez neste celular.</p>
      {app.erro && <div class="aviso erro">{app.erro}</div>}
    </div>
  );
}

/** #/ativar?u=<url do robô>&c=<código>: troca o código por uma sessão e vai para a tela Hoje. */
export function Ativar({ rota }: { rota: Rota }) {
  const app = useApp();
  const urlRobo = rota.consulta.get('u');
  const codigo = rota.consulta.get('c');
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!urlRobo || !codigo) return;
    let ativo = true;
    app.ativar(urlRobo, codigo).then(
      () => {
        if (ativo) navegar('#/hoje');
      },
      () => {
        if (ativo) setFalhou(true);
      },
    );
    return () => {
      ativo = false;
    };
  }, [urlRobo, codigo]);

  if (!urlRobo || !codigo) return <BoasVindas />;
  if (!falhou) return <Carregando texto="Ativando este aparelho…" />;
  return (
    <div class="boas-vindas">
      <img class="logo" src={LOGO} alt="" />
      <h1>Não deu pra ativar</h1>
      <p>{app.erro ?? 'O link pode ter expirado ou já ter sido usado.'}</p>
      <p>Peça um link novo ao Jéferson e toque nele de novo.</p>
    </div>
  );
}
