/** Dados FALSOS usados em todas as fixtures. O CPF tem dígito verificador inválido de propósito. */
export const FALSO = {
  cpf: '12345678900',
  nome: 'MARIA EXEMPLO DA SILVA',
  cnpj: '11111111000100',
  empresa: 'EMPRESA EXEMPLO LTDA',
  nsr: '12345',
  hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  inpi: 'BR5120210029364',
} as const;
