const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const startTime = Date.now();
let requestCount = 0;

// ─── Banco de dados em memória ────────────────────────────────────────────────

const db = {
  usuarios: [
    { id: 1, nome: 'Ana Silva',    email: 'ana@email.com',   ativo: true,  criadoEm: '2025-01-10T08:00:00Z' },
    { id: 2, nome: 'Bruno Costa',  email: 'bruno@email.com', ativo: true,  criadoEm: '2025-02-14T10:30:00Z' },
    { id: 3, nome: 'Carla Mendes', email: 'carla@email.com', ativo: false, criadoEm: '2025-03-01T09:00:00Z' },
  ],
  produtos: [
    { id: 1, nome: 'Camiseta Básica',  categoria: 'vestuario',   preco: 49.90,   estoque: 120 },
    { id: 2, nome: 'Calça Jeans',      categoria: 'vestuario',   preco: 129.90,  estoque: 80  },
    { id: 3, nome: 'Tênis Casual',     categoria: 'calcados',    preco: 199.90,  estoque: 45  },
    { id: 4, nome: 'Notebook Pro',     categoria: 'eletronicos', preco: 3499.00, estoque: 20  },
    { id: 5, nome: 'Fone Bluetooth',   categoria: 'eletronicos', preco: 249.90,  estoque: 60  },
    { id: 6, nome: 'Mochila Urbana',   categoria: 'acessorios',  preco: 179.90,  estoque: 35  },
  ],
  nextUsuarioId: 4,
};

// ─── Utilitários ──────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (!raw.trim()) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON inválido no corpo da requisição'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Powered-By': 'API-Suite-Testes/1.0',
  });
  res.end(json);
}

function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return send(res, 405, {
    erro: 'Método não permitido',
    metodo: undefined, // preenchido pelo caller
    metodos_permitidos: allowed,
    mensagem: `Este endpoint não suporta o método informado. Use: ${allowed.join(', ')}`,
  });
}

function notFound(res, endpoint) {
  return send(res, 404, {
    erro: 'Endpoint não encontrado',
    endpoint,
    mensagem: 'Verifique a URL e o método HTTP utilizados.',
    endpoints_disponiveis: [
      'POST /calcular',
      'GET  /usuarios',
      'POST /usuarios',
      'PUT  /usuarios/:id',
      'GET  /produtos',
      'GET  /produtos?categoria=<nome>',
      'GET  /status',
    ],
  });
}

function requestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Validações ───────────────────────────────────────────────────────────────

function validarEmail(email) {
  if (!email || typeof email !== 'string') return 'O campo email é obrigatório';
  if (!email.includes('@')) return 'Email deve conter @';
  const [local, domain] = email.split('@');
  if (!local || local.length < 1) return 'Parte local do email inválida (antes do @)';
  if (!domain || !domain.includes('.')) return 'Domínio do email inválido (após o @)';
  return null;
}

function validarNumero(valor, campo) {
  if (valor === undefined || valor === null) return `O campo ${campo} é obrigatório`;
  if (typeof valor !== 'number' || isNaN(valor)) return `O campo ${campo} deve ser um número`;
  return null;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleCalcular(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') {
    return send(res, 405, {
      erro: 'Método não permitido',
      metodo: req.method,
      metodos_permitidos: ['POST'],
      mensagem: 'O endpoint /calcular aceita apenas POST.',
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return send(res, 400, {
      erro: 'Corpo da requisição inválido',
      mensagem: 'Envie um JSON válido com os campos: operacao, a, b',
    });
  }

  if (!body) {
    return send(res, 400, {
      erro: 'Corpo da requisição ausente',
      mensagem: 'Envie um JSON com os campos: operacao, a, b',
    });
  }

  const { operacao, a, b } = body;

  // Validar operacao
  const operacoesValidas = ['soma', 'subtracao', 'multiplicacao', 'divisao'];
  if (!operacao) {
    return send(res, 400, {
      erro: 'Campo obrigatório ausente',
      campo: 'operacao',
      mensagem: `O campo operacao é obrigatório. Valores aceitos: ${operacoesValidas.join(', ')}`,
      operacoes_validas: operacoesValidas,
    });
  }
  if (!operacoesValidas.includes(operacao)) {
    return send(res, 400, {
      erro: 'Operação inválida',
      campo: 'operacao',
      valor_recebido: operacao,
      operacoes_validas: operacoesValidas,
      mensagem: `"${operacao}" não é uma operação suportada.`,
    });
  }

  // Validar a e b
  const erroA = validarNumero(a, 'a');
  if (erroA) return send(res, 400, { erro: 'Campo inválido', campo: 'a', mensagem: erroA });
  const erroB = validarNumero(b, 'b');
  if (erroB) return send(res, 400, { erro: 'Campo inválido', campo: 'b', mensagem: erroB });

  // Divisão por zero
  if (operacao === 'divisao' && b === 0) {
    return send(res, 400, {
      erro: 'Divisão por zero não permitida',
      codigo: 'DIVISION_BY_ZERO',
      operacao,
      a,
      b,
      mensagem: 'O divisor (b) não pode ser zero. Matematicamente indefinido.',
    });
  }

  const operacoes = {
    soma:          (x, y) => x + y,
    subtracao:     (x, y) => x - y,
    multiplicacao: (x, y) => x * y,
    divisao:       (x, y) => x / y,
  };

  const resultado = operacoes[operacao](a, b);

  return send(res, 200, {
    resultado,
    operacao,
    a,
    b,
    expressao: `${a} ${{ soma:'+', subtracao:'-', multiplicacao:'×', divisao:'÷' }[operacao]} ${b} = ${resultado}`,
  });
}

async function handleUsuarios(req, res, idParam) {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  // PUT /usuarios/:id
  if (idParam !== undefined) {
    if (req.method !== 'PUT') {
      return send(res, 405, {
        erro: 'Método não permitido',
        metodo: req.method,
        metodos_permitidos: ['PUT'],
        mensagem: 'Para usuários individuais, use PUT /usuarios/:id',
      });
    }
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return send(res, 400, { erro: 'ID inválido', mensagem: 'O ID deve ser um número inteiro.' });
    }
    const idx = db.usuarios.findIndex(u => u.id === id);
    if (idx === -1) {
      return send(res, 404, {
        erro: 'Usuário não encontrado',
        id,
        mensagem: `Não existe usuário com id=${id}`,
      });
    }
    let body;
    try { body = await readBody(req); } catch {
      return send(res, 400, { erro: 'JSON inválido' });
    }
    const { nome, email, ativo } = body || {};
    if (email !== undefined) {
      const erroEmail = validarEmail(email);
      if (erroEmail) return send(res, 422, { erro: 'Formato inválido', campo: 'email', mensagem: erroEmail });
      if (db.usuarios.some((u, i) => u.email === email && i !== idx)) {
        return send(res, 409, { erro: 'Conflito', campo: 'email', mensagem: 'Este email já está em uso por outro usuário.' });
      }
    }
    if (nome !== undefined) db.usuarios[idx].nome = nome;
    if (email !== undefined) db.usuarios[idx].email = email;
    if (ativo !== undefined) db.usuarios[idx].ativo = Boolean(ativo);
    return send(res, 200, {
      mensagem: 'Usuário atualizado com sucesso',
      usuario: db.usuarios[idx],
    });
  }

  // GET /usuarios
  if (req.method === 'GET') {
    return send(res, 200, {
      usuarios: db.usuarios,
      total: db.usuarios.length,
    });
  }

  // POST /usuarios
  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch {
      return send(res, 400, { erro: 'JSON inválido no corpo da requisição', mensagem: 'Envie um JSON válido.' });
    }
    if (!body) return send(res, 400, { erro: 'Corpo ausente', mensagem: 'Envie nome e email no body.' });
    const { nome, email } = body;

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return send(res, 422, { erro: 'Campo obrigatório ausente', campo: 'nome', mensagem: 'O campo nome é obrigatório e não pode estar vazio.' });
    }
    const erroEmail = validarEmail(email);
    if (erroEmail) return send(res, 422, { erro: 'Campo obrigatório ausente ou inválido', campo: 'email', mensagem: erroEmail });

    if (db.usuarios.some(u => u.email === email)) {
      return send(res, 409, { erro: 'Conflito', campo: 'email', mensagem: 'Já existe um usuário com este email.' });
    }

    const novo = {
      id: db.nextUsuarioId++,
      nome: nome.trim(),
      email,
      ativo: true,
      criadoEm: new Date().toISOString(),
    };
    db.usuarios.push(novo);
    return send(res, 201, { mensagem: 'Usuário criado com sucesso', usuario: novo });
  }

  // DELETE ou outro método não permitido
  return send(res, 405, {
    erro: 'Método não permitido',
    metodo: req.method,
    metodos_permitidos: ['GET', 'POST', 'PUT'],
    mensagem: `O método ${req.method} não é suportado neste endpoint.`,
  });
}

function handleProdutos(req, res, searchParams) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'GET') {
    return send(res, 405, {
      erro: 'Método não permitido',
      metodo: req.method,
      metodos_permitidos: ['GET'],
      mensagem: 'O endpoint /produtos aceita apenas GET.',
    });
  }

  const categoria = searchParams.get('categoria');
  const lista = categoria
    ? db.produtos.filter(p => p.categoria.toLowerCase() === categoria.toLowerCase())
    : db.produtos;

  if (categoria && lista.length === 0) {
    return send(res, 200, {
      produtos: [],
      total: 0,
      categoria,
      mensagem: `Nenhum produto encontrado na categoria "${categoria}". Categorias disponíveis: ${[...new Set(db.produtos.map(p => p.categoria))].join(', ')}`,
    });
  }

  return send(res, 200, {
    produtos: lista,
    total: lista.length,
    categoria: categoria || 'todas',
  });
}

function handleStatus(req, res) {
  if (req.method !== 'GET') {
    return send(res, 405, {
      erro: 'Método não permitido',
      metodos_permitidos: ['GET'],
    });
  }

  const uptimeMs = Date.now() - startTime;
  const uptimeSeg = Math.floor(uptimeMs / 1000);
  const horas = Math.floor(uptimeSeg / 3600);
  const min  = Math.floor((uptimeSeg % 3600) / 60);
  const seg  = uptimeSeg % 60;

  return send(res, 200, {
    status: 'ok',
    versao: '1.0.0',
    timestamp: new Date().toISOString(),
    chamadas: requestCount,
    uptime: `${horas}h ${min}m ${seg}s`,
    uptime_segundos: uptimeSeg,
    memoria_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    node_version: process.version,
    endpoints: {
      calcular:  'POST /calcular',
      usuarios:  'GET|POST /usuarios   PUT /usuarios/:id',
      produtos:  'GET /produtos   GET /produtos?categoria=<nome>',
      status:    'GET /status',
    },
  });
}

// ─── Roteador principal ───────────────────────────────────────────────────────

async function router(req, res) {
  requestCount++;

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  let url;
  try {
    url = new URL(req.url, `http://localhost:${PORT}`);
  } catch {
    return send(res, 400, { erro: 'URL inválida' });
  }

  const path = url.pathname.replace(/\/+$/, '') || '/';
  const rid = requestId();
  const ts = new Date().toISOString();

  console.log(`[${ts}] ${req.method.padEnd(6)} ${path}  id=${rid}`);

  try {
    if (path === '/calcular') {
      return await handleCalcular(req, res);
    }

    if (path === '/usuarios') {
      return await handleUsuarios(req, res, undefined);
    }

    // /usuarios/:id
    const usuarioMatch = path.match(/^\/usuarios\/(\w+)$/);
    if (usuarioMatch) {
      return await handleUsuarios(req, res, usuarioMatch[1]);
    }

    if (path === '/produtos') {
      return handleProdutos(req, res, url.searchParams);
    }

    if (path === '/status') {
      return handleStatus(req, res);
    }

    return notFound(res, path);

  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    return send(res, 500, {
      erro: 'Erro interno do servidor',
      mensagem: 'Ocorreu um erro inesperado. Tente novamente.',
      request_id: rid,
    });
  }
}

const server = http.createServer(router);

server.listen(PORT, () => {
  console.log(`\n  API rodando em http://localhost:${PORT}`);
  console.log(`\n  Endpoints disponíveis:`);
  console.log(`    POST http://localhost:${PORT}/calcular`);
  console.log(`    GET  http://localhost:${PORT}/usuarios`);
  console.log(`    POST http://localhost:${PORT}/usuarios`);
  console.log(`    PUT  http://localhost:${PORT}/usuarios/:id`);
  console.log(`    GET  http://localhost:${PORT}/produtos`);
  console.log(`    GET  http://localhost:${PORT}/produtos?categoria=vestuario`);
  console.log(`    GET  http://localhost:${PORT}/status`);
  console.log(`\n  Pressione Ctrl+C para encerrar.\n`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Porta ${PORT} já está em uso. Defina PORT=<outra_porta> e tente novamente.`);
  } else {
    console.error('Erro no servidor:', err);
  }
  process.exit(1);
});