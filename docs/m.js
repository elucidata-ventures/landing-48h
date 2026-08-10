/* G001-08 · instrumentacao de metricas — custo R$0, sem conta, sem cookie.
   Dois contadores anonimos redundantes (se um cair, o outro sobrevive):
     1) CounterAPI v1   -> JSON, facil de ler em script  (primario)
     2) visitorbadge.io -> SVG, numero no texto do badge (backup)
   Nao sai daqui nenhum dado pessoal: so o nome da chave.
   Uso:  <script src="m.js" data-hit="landing"></script>
         M.hit('pedido-contratar')                                        */
(function (w, d) {
  var NS = 'elucidata-g001-08';

  // chaves sempre em [a-z0-9_-]; qualquer outra coisa vira '-'
  function slug(k) {
    return String(k == null ? '' : k)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  function ping(url) {
    try {
      if (w.fetch) { w.fetch(url, { mode: 'no-cors', cache: 'no-store', keepalive: true }); return; }
    } catch (e) { /* cai no Image() abaixo */ }
    try { (new Image()).src = url; } catch (e) {}
  }

  function hit(key) {
    var k = slug(key);
    if (!k) return;
    ping('https://api.counterapi.dev/v1/' + NS + '/' + k + '/up?t=' + Date.now());
    ping('https://api.visitorbadge.io/api/visitors?path=' + encodeURIComponent(NS + '/' + k) + '&label=v');
  }

  w.M = { hit: hit, ns: NS, slug: slug };

  // dispara automaticamente as chaves declaradas em data-hit="a,b,c"
  var tags = d.querySelectorAll('script[data-hit]');
  for (var i = 0; i < tags.length; i++) {
    var list = (tags[i].getAttribute('data-hit') || '').split(',');
    for (var j = 0; j < list.length; j++) hit(list[j]);
  }
})(window, document);
