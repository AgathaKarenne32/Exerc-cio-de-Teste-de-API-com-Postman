# Divisão válida
curl -X POST http://localhost:3000/calcular \
  -H "Content-Type: application/json" \
  -d '{"operacao":"divisao","a":10,"b":4}'

# Divisão por zero
curl -X POST http://localhost:3000/calcular \
  -H "Content-Type: application/json" \
  -d '{"operacao":"divisao","a":7,"b":0}'

# Criar usuário
curl -X POST http://localhost:3000/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nome":"Maria","email":"maria@email.com"}'

# Listar produtos por categoria
curl http://localhost:3000/produtos?categoria=vestuario

# Status
curl http://localhost:3000/status