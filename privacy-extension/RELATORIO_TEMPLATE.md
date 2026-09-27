# Relatório — Avaliação Intermediária de Cibersegurança
**Aluno:** João Eduardo Luisi
**Projeto:** Privacy Tracker Detector (extensão Firefox)
**Repositório:** _[link do repositório Git aqui]_

> Este documento é um **template**. Preencha as seções com os resultados reais obtidos ao rodar a extensão (screenshots, valores do popup, arquivos HAR). Converta para PDF antes da entrega final.

---

## 1. Metodologia da pontuação de privacidade

Base: 100 pontos. Penalidades:

| Fator | Penalidade |
|---|---|
| Cada domínio de terceira parte distinto | -3 |
| Cookie de sessão de terceiros | -1 |
| Cookie persistente de terceiros | -4 |
| Canvas fingerprinting detectado (uma vez) | -15 |
| Cada evento de bounce tracking | -5 |
| Cada evento de cookie sync | -8 |
| Cada abertura de IndexedDB | -2 |
| Cada indício de hijacking/hook | -10 |

Score final = max(0, min(100, 100 − Σ penalidades)). Justificativa dos pesos: fingerprinting e hijacking são tratados como os sinais mais graves (identificação persistente e possível controle remoto do navegador), por isso recebem os maiores pesos; contagens (domínios, cookies) crescem linearmente pois cada unidade adicional representa mais um ponto de exposição.

---

## 2. Relatório de execução — DuckDuckGo Privacy Test Pages

| Teste | Resultado esperado (página DDG) | Resultado do plugin | Divergência / explicação |
|---|---|---|---|
| Tracker Reporting | _preencher_ | _preencher_ | _preencher, referenciando o domínio específico observado_ |
| Storage blocking | | | |
| Fingerprinting / canvas | | | |
| Tracker Blocking | | | |
| Storage partitioning | | | |
| Bounce tracking | | | |
| Query parameters (cookie sync) | | | |
| js-leaks (hijacking) | | | |

> Cada linha precisa vir acompanhada de print do popup em execução sobre a respectiva página (salvar em `evidencias/ddg/`).

---

## 3. Análise de 3 sites reais

### Site 1: _[nome/URL]_
- HAR: `evidencias/site1/site1.har`
- Resumo do plugin: domínios de terceiros = N, cookies 3ª parte = N, canvas fingerprint = sim/não, score = N
- Comparação com Blacklight: _preencher_
- Comparação com uBlock Origin: _preencher_
- Divergências e explicação técnica (citando o HAR): _preencher_

### Site 2: _[nome/URL]_
(mesma estrutura)

### Site 3: _[nome/URL]_
(mesma estrutura)

---

## 4. Pontuação de privacidade aplicada aos 3 sites

| Site | Score do plugin | Classificação Blacklight | Onde concordam | Onde divergem e por quê |
|---|---|---|---|---|
| Site 1 | | | | |
| Site 2 | | | | |
| Site 3 | | | | |

---

## 5. Limitações do projeto

- `baseDomain()` não implementa a Public Suffix List completa (ver README).
- Detecção de hijacking é heurística, sujeita a falsos positivos/negativos.
- Service Workers podem escapar parcialmente da instrumentação de `inject.js`.
