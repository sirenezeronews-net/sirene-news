const test = require('node:test');
const assert = require('node:assert/strict');
const { wrapTitle, escapeXml, cleanedArticle } = require('../server');

test('quebra de manchete respeita limite de linhas', () => {
  const lines = wrapTitle('Taiwan e Ártico: por que crises internacionais podem afetar a economia global', 21, 6);
  assert.ok(lines.length <= 6);
  assert.ok(lines.every(line => line.length > 0));
});
test('texto de um título não injeta elementos no SVG', () => {
  assert.equal(escapeXml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});
test('publicação exige fonte editorial', () => {
  assert.throws(() => cleanedArticle({ title:'Exemplo de manchete geopolítica', summary:'Resumo com contexto editorial detalhado', body:'Texto extenso. '.repeat(10), status:'published' }), /fontes/i);
});
test('rascunho é salvo sem exigir fontes', () => {
  const item = cleanedArticle({ title:'Exemplo de manchete geopolítica', summary:'Resumo com contexto editorial detalhado', body:'Texto extenso. '.repeat(10), status:'draft' });
  assert.equal(item.status, 'draft');
  assert.ok(item.id);
});
