import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

interface Props {
  aoFechar(): void;
  rotulo: string;
  children: ComponentChildren;
}

/** Folha que sobe de baixo (bottom sheet), fecha ao tocar fora ou no Esc. */
export function Folha({ aoFechar, rotulo, children }: Props) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
    };
  }, [aoFechar]);

  return (
    <>
      <div class="folha-fundo" onClick={aoFechar} />
      <div class="folha" role="dialog" aria-modal="true" aria-label={rotulo}>
        <div class="alca" />
        {children}
      </div>
    </>
  );
}
