const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
async function verify(token) {
  const routes = new Map();
  const calls = [];
  const app = {set() {}, use() {}, get(p, f) {routes.set('GET '+p, f);}, post(p, f) {routes.set('POST '+p, f);}, delete(p, f) {routes.set('DELETE '+p, f);}, listen() {}};
  const express = Object.assign(() => app, {json() {}, static() {}});
  vm.runInNewContext(fs.readFileSync('server.js', 'utf8'), {
    require: name => name === 'express' ? express : require(name),
    __dirname, process: {env: {N8N_ADMIN_TOKEN: token, DASHBOARD_USER: 'operador-teste'}}, Buffer, AbortSignal, URL,
    console: {log() {}},
    fetch: async (url, options) => {calls.push({url, options}); return {ok:true, json:async()=>({}), text:async()=>'{}'};}
  });
  let status = 200;
  const res = {status(n) {status=n; return this;}, json() {return this;}, set() {return this;}};
  await routes.get('GET /api/dashboard')({}, res);
  await routes.get('POST /api/liberar-automacao')({body:{telefone:'5511999999999'}}, res);
  await routes.get('POST /api/produtos/preco')({body:{id:1,preco:100}}, res);
  await routes.get('POST /api/produtos')({body:{nome:'Pilsen',volume:30,preco:450}}, res);
  await routes.get('DELETE /api/produtos/:id')({params:{id:1}}, res);
  await routes.get('POST /api/pedidos/confirmar')({body:{id:42}}, res);
  await routes.get('POST /api/pedidos/recusar')({body:{id:42}}, res);
  await routes.get('POST /api/pedidos/concluir')({body:{id:42}}, res);
  assert.equal(calls.length,8);
  for (const c of calls) {
    assert.equal(c.options.headers['X-Bona-Admin-Token'], token || undefined);
    assert(c.options.signal instanceof AbortSignal);
    assert.equal(c.options.headers['X-Bona-Admin-Actor'], 'operador-teste');
  }
  for (const preco of [null, '', 0, -1, 'inválido']) {
    status=200;
    await routes.get('POST /api/produtos/preco')({body:{id:1,preco}}, res);
    assert.equal(status,400);
  }
  for (const produto of [
    {nome:'',volume:30,preco:100},
    {nome:'Pilsen',volume:0,preco:100},
    {nome:'Pilsen',volume:30,preco:0}
  ]) {
    status=200;
    await routes.get('POST /api/produtos')({body:produto}, res);
    assert.equal(status,400);
  }
  status=200;
  await routes.get('DELETE /api/produtos/:id')({params:{id:'inválido'}}, res);
  assert.equal(status,400);
  assert.equal(calls.length,8);

  const payloads=calls.filter(c=>String(c.url).includes('produtos-preco')).map(c=>JSON.parse(c.options.body));
  assert.deepEqual(payloads, [
    {acao:'alterar_preco',id:1,preco:100},
    {acao:'criar',nome:'Pilsen',volume:30,preco:450},
    {acao:'excluir',id:1}
  ]);
}
(async()=>{await verify('token-ficticio-de-teste'); await verify(''); console.log('Proxy: criação, preço e exclusão de produtos validados sem chamadas externas.');})().catch(e=>{console.error(e);process.exitCode=1;});
