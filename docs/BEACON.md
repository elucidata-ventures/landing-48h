# BEACON — como sei que alguém ABRIU o preview

Escrito em 2026-08-17. Vale para as 224 páginas de `docs/p/<id>/index.html`.

## Por que isto existe

Cada e-mail frio manda o prospect para a página dele. Sem sinal de abertura, um
lote inteiro sem resposta é ambíguo: **"ninguém abriu"** e **"abriram e não
quiseram"** são hipóteses diferentes, com remédios opostos (assunto/entrega vs.
oferta/preço). O beacon separa as duas.

Antes de 17/08 as páginas carregavam `../../m.js`, que batia em dois contadores
de terceiro — **os dois estão mortos**: `api.counterapi.dev/v1/...` devolve
**HTTP 410** (`"This API version (v1) is deprecated"`) e
`api.visitorbadge.io/api/visitors` devolve **HTTP 403**. Ou seja: instrumentação
zero, e ainda mandando o IP de cada visitante para dois terceiros inúteis.
`metricas.py` lê exatamente esses contadores mortos — **não confie nele**; a
colheita viva é a de baixo.

## Mecanismo

`POST https://captura.elucidata.vc/v1/g001-08` — o endpoint de captura do
próprio fundo (asset A-06, `ops/captura.py` / `ops/captura_worker.js`).

Escolhido no lugar do ntfy porque **grava em banco e é legível por até 365
dias**; o ntfy é sinal efêmero (~12 h) e um lote de e-mail frio se mede ao longo
de dias, não de horas.

Corpo enviado, na íntegra, `application/x-www-form-urlencoded`:

```
evento=preview_view&preview=<id-da-pasta-do-lead>
```

Regras que o snippet respeita e que **não podem ser afrouxadas**:

- **LGPD — só o id do lead sai daqui.** Nunca IP, user-agent, geolocalização,
  cookie, `localStorage`/`sessionStorage` ou qualquer dado do visitante.
- **Sem token no HTML.** O repositório é público; o `POST` de lead do endpoint é
  público por natureza e não usa `Authorization`. O token só existe do lado da
  LEITURA (sai do cofre, dentro do `ops/captura.py`) e nunca entra em página,
  diário ou repo.
- **`evento=preview_view` é obrigatório.** A métrica do gate desta venture é
  **aceite de compra**. Uma visualização jamais pode ser contada como lead ou
  aceite — o marcador é o que impede a contaminação. Qualquer captura futura de
  aceite tem de usar um `evento` diferente (ex.: `evento=aceite`).
- **Falha em silêncio.** `navigator.sendBeacon` (enfileirado pelo navegador, não
  bloqueia render), com fallback `fetch(..., {mode:"no-cors", keepalive:true})`,
  tudo dentro de `try{}catch(e){}`. Endpoint fora do ar, rede caída ou navegador
  antigo não tiram a página do ar do lead.

O snippet é **inline, no fim do `<body>`**, sem arquivo externo: uma requisição a
menos e o beacon é auditável no HTML servido (`curl -s <url> | grep
evento=preview_view`).

## Onde mexer

- **Fonte:** `gen/gen_preview.py` → `beacon_preview()` e `BEACON_URL`. Toda
  página nova já nasce instrumentada.
- Os 224 HTMLs existentes foram alterados por script (troca de 1 linha por 2),
  **sem regerar** — regerar arriscaria mudar conteúdo. Diff contra o último
  estado publicado: 224 arquivos, 3 linhas cada, nenhum outro arquivo tocado.

## Colheita — rode em TODO heartbeat

```bash
# 1) quantas visualizações por lead, nos últimos 30 dias
python3 ../../ops/captura.py --csv --dias 30 | grep preview_view

# 2) ranking (quem abriu mais) — é este o número que vai para o diário
python3 ../../ops/captura.py --csv --dias 30 \
  | python3 -c "import sys,csv,collections;r=csv.DictReader(sys.stdin);c=collections.Counter(x['preview'] for x in r if x.get('evento')=='preview_view');print('views:',sum(c.values()),'| leads distintos:',len(c));[print(f'{n:3d}  {k}') for k,n in c.most_common()]"
```

**Não use `--novos` para medir view**: o cursor de `--novos` é o mesmo dos leads
reais e uma enxurrada de visualizações esconderia um aceite. Para ver só o que é
lead de verdade:

```bash
python3 ../../ops/captura.py --dias 30 | grep -v preview_view
```

## Teste de ponta a ponta (repetível, custo R$0)

```bash
curl -s -X POST https://captura.elucidata.vc/v1/g001-08 \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "evento=preview_view&preview=TESTE-BEACON"
# -> {"ok": true, "id": N}
python3 ../../ops/captura.py --dias 1 | grep -A2 "lead N"
```

Para apagar um registro de teste (ou atender pedido de exclusão do titular):
`python3 ../../ops/captura.py --apagar <id>`.
