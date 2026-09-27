# Privacy Tracker Detector

Extensão para Firefox que detecta e apresenta, por página:

- Conexões a domínios de terceira parte;
- Cookies (1ª/3ª parte, sessão/persistente);
- Armazenamento HTML5 (localStorage, sessionStorage, IndexedDB);
- Cookie sync / bounce tracking;
- Canvas fingerprinting;
- Indícios de sequestro de navegador (hijacking/hook);
- Pontuação de privacidade da página, com metodologia explícita (ver `background.js`, seção "Cálculo da pontuação de privacidade");
- Lista de bloqueio personalizada (bloqueia domínios via `webRequest`).

## Instalação (teste local, via about:debugging)

1. Abra o Firefox e acesse `about:debugging#/runtime/this-firefox`.
2. Clique em **"Carregar extensão temporária..."**.
3. Selecione o arquivo `manifest.json` dentro desta pasta.
4. A extensão aparecerá na barra de ferramentas (ícone verde). Abra qualquer site e clique no ícone para ver o relatório da aba ativa.

Observação: extensões carregadas assim são removidas ao fechar o Firefox; para reinstalar, repita o passo 2/3.

## Estrutura do código

| Arquivo | Papel |
|---|---|
| `manifest.json` | Declaração da extensão e permissões |
| `background.js` | Estado por aba, classificação de requisições/cookies, bounce tracking, cookie sync, score, API para o popup |
| `blocklist.js` | Persistência da lista de bloqueio customizada |
| `content_script.js` | Ponte entre a página (isolated world) e o background |
| `inject.js` | Roda no **main world** da página; hookeia `canvas`, `localStorage`/`sessionStorage`, `IndexedDB`, `WebSocket`, `setInterval` e detecta adulteração de globais |
| `popup.html` / `popup.js` | Interface: relatório por página + gestão da blocklist |

## Como testar nas DuckDuckGo Privacy Test Pages (entregável 2)

Repositório de referência: `https://github.com/duckduckgo/privacy-test-pages`. Pode ser clonado e servido localmente (`python3 -m http.server`) ou acessado pela versão hospedada, se disponível.

Páginas relevantes e o que checar no popup:

1. **Tracker Reporting** → conferir contagem em "Domínios de terceira parte".
2. **Storage blocking** → conferir `localStorage`/`sessionStorage`/`IndexedDB`.
3. **Fingerprinting / canvas** → conferir "Canvas fingerprint = Sim".
4. **Tracker Blocking** → adicionar o domínio de teste à blocklist customizada e confirmar que a requisição é cancelada (aparecerá em `tab.blockedRequests`, visível no console de background via `about:debugging` → "Inspecionar").
5. **Storage partitioning** → comparar contagens de storage por frame/origem.
6. **Bounce tracking** → observar `bounceTracking` no relatório.
7. **Query parameters (cookie sync)** → observar `cookieSync`.
8. **js-leaks** → observar `hijackIndicators` (adulteração de globais / polling).

Para o relatório exigido (tabela teste × esperado × obtido × explicação), monte uma tabela manualmente comparando o que a própria página DDG reporta como esperado com o que aparece no popup, e tire prints do popup aberto sobre cada página de teste (guarde em `evidencias/`).

## Como testar em sites reais (entregável 3)

Para cada um dos 3 sites sorteados:

1. Abra o DevTools → aba Network → grave a navegação → exporte como `.har` (botão direito → "Save all as HAR").
2. Rode o [Blacklight (The Markup)](https://themarkup.org/blacklight) para o mesmo site.
3. Instale o [uBlock Origin](https://github.com/gorhill/uBlock) e veja o que ele bloqueia na mesma navegação.
4. Compare os três relatórios (plugin, Blacklight, uBlock) e documente divergências citando o tráfego específico do HAR (nome do domínio, tipo de recurso, cookie).

## Limitações conhecidas (documentar no relatório)

- `baseDomain()` usa uma lista fixa de sufixos públicos comuns (`com.br`, `co.uk`, etc.) em vez de uma Public Suffix List completa — pode classificar incorretamente domínios com sufixos incomuns.
- A detecção de hijacking é heurística (WebSocket para terceiro, polling curto, adulteração de globais) e pode gerar falsos positivos/negativos; não é uma prova formal de comprometimento.
- Sites que usam Service Workers para fetch podem escapar parcialmente do hook de `inject.js`, já que Service Workers rodam em contexto próprio.
- A pontuação é uma métrica autoral (pesos definidos no código), não a mesma metodologia do Blacklight — a comparação deve ser qualitativa (onde concordam/divergem e por quê), não numérica direta.

## Licença / uso acadêmico

Projeto desenvolvido para a avaliação intermediária de Cibersegurança (Insper). Uso educacional.
