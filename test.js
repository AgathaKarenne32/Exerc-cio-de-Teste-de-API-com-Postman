const http = require('http');

const BASE = 'http://localhost:3000';
let passed = 0;
let failed = 0;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(desc, condition) {
  if (condition) {
    console.log(`    ✓  ${desc}`);
    passed++;
  } else {
    console.log(`    ✗  ${desc}`);
    failed++;
  }
}

async function run() {
  console.log('\n══════════════════════════════════════════════');
  console.log(' Suite de Testes — API Completa');
  console.log('══════════════════════════════════════════════\n');

  // ── PARTE 1: FUNCIONAL ──────────────────────────────────────────────────
  console.log('▶  PARTE 1 — Funcional (/calcular)\n');

  console.log('  TC-01: Divisão válida (10 ÷ 4)');
  let r = await request('POST', '/calcular', { operacao: 'divisao', a: 10, b: 4 });
  assert('Status 200', r.status === 200);
  assert('Resultado = 2.5', r.body.resultado === 2.5);
  assert('Sem campo erro', !r.body.erro);
  console.log(`         Response: ${JSON.stringify(r.body)}\n`);

  console.log('  TC-02: Divisão por zero (7 ÷ 0)');
  r = await request('POST', '/calcular', { operacao: 'divisao', a: 7, b: 0 });
  assert('Status 400', r.status === 400);
  assert('Campo erro presente', !!r.body.erro);
  assert('Código DIVISION_BY_ZERO', r.body.codigo === 'DIVISION_BY_ZERO');
  console.log(`         Response: ${JSON.stringify(r.body)}\n`);

  console.log('  TC-03: Multiplicação (6 × 7)');
  r = await request('POST', '/calcular', { operacao: 'multiplicacao', a: 6, b: 7 });
  assert('Status 200', r.status === 200);
  assert('Resultado = 42', r.body.resultado === 42);
  assert('Operacao retornada', r.body.operacao === 'multiplicacao');
  console.log(`         Response: ${JSON.stringify(r.body)}\n`);

  // ── PARTE 2: EXPLORATÓRIO ───────────────────────────────────────────────
  console.log('▶  PARTE 2 — Exploratório (/usuarios)\n');

  console.log('  TC-04: POST /usuarios sem email');
  r = await request('POST', '/usuarios', { nome: 'Carlos' });
  assert('Status 422', r.status === 422);
  assert('Campo email identificado', r.body.campo === 'email');
  assert('Mensagem clara', !!r.body.mensagem);
  console.log(`         Response: ${JSON.stringify(r.body)}\n`);

  console.log('  TC-05: POST /usuarios com email sem @');
  r = await request('POST', '/usuarios', { nome: 'Joana', email: 'joana_sem_arroba' });
  assert('Status 422', r.status === 422);
  assert('Campo email identificado', r.body.campo === 'email');
  assert('Mensagem menciona @', r.body.mensagem && r.body.mensagem.includes('@'));
  console.log(`         Response: ${JSON.stringify(r.body)}\n`);

  console.log('  TC-06: DELETE /usuarios (método não permitido)');
  r = await request('DELETE', '/usuarios', null);
  assert('Status 405', r.status === 405);
  assert('Métodos permitidos listados', Array.isArray(r.body.metodos_permitidos));
  assert('Mensagem explicativa', !!r.body.mensagem);
  console.log(`         Response: ${JSON.stringify(r.body)}\n`);

  // ── PARTE 3: REGRESSÃO ──────────────────────────────────────────────────
  console.log('▶  PARTE 3 — Regressão (/produtos)\n');

  console.log('  TC-07: GET /produtos?categoria=vestuario');
  r = await request('GET', '/produtos?categoria=vestuario', null);
  assert('Status 200', r.status === 200);
  assert('Apenas vestuario', r.body.produtos.every(p => p.categoria === 'vestuario'));
  assert('2 itens', r.body.produtos.length === 2);
  console.log(`         Total retornado: ${r.body.total}\n`);

  console.log('  TC-08: GET /produtos (listagem completa)');
  r = await request('GET', '/produtos', null);
  assert('Status 200', r.status === 200);
  assert('6 produtos no total', r.body.total === 6);
  assert('Total corresponde ao array', r.body.total === r.body.produtos.length);
  console.log(`         Total retornado: ${r.body.total}\n`);

  console.log('  TC-09: Regressão /calcular (100 ÷ 5)');
  r = await request('POST', '/calcular', { operacao: 'divisao', a: 100, b: 5 });
  assert('Status 200', r.status === 200);
  assert('Resultado = 20', r.body.resultado === 20);
  console.log(`         Response: ${JSON.stringify(r.body)}\n`);

  // ── PARTE 4: PERFORMANCE ────────────────────────────────────────────────
  console.log('▶  PARTE 4 — Não Funcional (/status)\n');

  const tempos = [];
  for (let i = 1; i <= 8; i++) {
    const t0 = Date.now();
    r = await request('GET', '/status', null);
    const ms = Date.now() - t0;
    tempos.push(ms);
    console.log(`  Chamada ${i}: status=${r.status}  tempo=${ms}ms  chamadas=${r.body.chamadas}`);
  }
  const avg = Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
  const vari = Math.max(...tempos) - Math.min(...tempos);
  console.log();
  assert('Todas retornam 200', r.status === 200);
  assert(`Tempo médio < 200ms (atual: ${avg}ms)`, avg < 200);
  assert(`Variação < 100ms (atual: ${vari}ms)`, vari < 100);
  console.log();

  // ── RESUMO ──────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════');
  console.log(` Resultado: ${passed} passaram  |  ${failed} falharam`);
  console.log('══════════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('\nErro ao executar testes:', err.message);
  console.error('Certifique-se que o server está rodando: node server.js\n');
  process.exit(1);
});