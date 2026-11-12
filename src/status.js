// Estados de uma doação, na ordem em que acontecem:
// publicada (disponivel) -> aceita por uma ONG (aceita) -> retirada pelo entregador (coletada).
// São os valores gravados na coluna `status` da tabela doacoes. Regras e SQL usam
// estas constantes em vez de repetir o texto, para um erro de digitação não passar em silêncio.
export const STATUS = Object.freeze({
  DISPONIVEL: 'disponivel',
  ACEITA: 'aceita',
  COLETADA: 'coletada',
});
