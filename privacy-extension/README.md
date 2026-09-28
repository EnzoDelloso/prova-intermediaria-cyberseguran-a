# Privacy Tracker Detector

Extensão acadêmica para Firefox desenvolvida para a Avaliação Intermediária de
Cibersegurança do Insper. O plugin monitora indicadores de rastreamento e
privacidade da página ativa, apresenta um relatório por site e permite bloquear
domínios definidos pelo usuário.

## Funcionalidades

- Identificação de conexões com domínios de terceiros;
- Contagem de cookies de primeira e terceira parte, separados entre cookies de
  sessão e persistentes;
- Monitoramento de escritas em `localStorage` e `sessionStorage` e de aberturas
  de bancos `IndexedDB`;
- Detecção de uso de canvas associado a fingerprinting;
- Detecção heurística de cookie sync e parâmetros de rastreamento;
- Identificação de cadeias compatíveis com bounce tracking;
- Identificação de possíveis indicadores de hijacking/hook;
- Pontuação de privacidade calculada por página;
- Lista de bloqueio personalizada, aplicada por meio da API `webRequest`.

## Instalação no Firefox

1. Baixe ou clone este repositório.
2. Abra o Firefox e acesse `about:debugging#/runtime/this-firefox`.
3. Clique em **Carregar extensão temporária...**.
4. Selecione o arquivo `privacy-extension/manifest.json`.
5. Confirme que a extensão **Privacy Tracker Detector**, versão 1.3.0, aparece
   na lista.
6. Abra o site que deseja analisar, recarregue a página e clique no ícone da
   extensão.

> Extensões temporárias são removidas quando o Firefox é fechado. Nesse caso,
> repita o carregamento pelo `about:debugging`.

## Uso

O popup apresenta apenas os dados da aba ativa. Para iniciar uma medição limpa:

1. Abra a página desejada;
2. Recarregue a página após carregar a extensão;
3. Aguarde o carregamento e as interações necessárias;
4. Abra o popup para consultar o relatório.

Na lista de bloqueio, informe somente o domínio, por exemplo
`bad.third-party.site`, e recarregue a página. O botão **×** remove o domínio da
lista.

## Metodologia da pontuação

Cada página começa com 100 pontos. As penalidades abaixo são subtraídas conforme
os eventos observados:

| Indicador | Penalidade |
|---|---:|
| Cada domínio de terceiro | −3 pontos |
| Cada cookie de terceiro de sessão | −1 ponto |
| Cada cookie de terceiro persistente | −4 pontos |
| Uso de canvas para fingerprinting | −15 pontos |
| Cada ocorrência de bounce tracking | −5 pontos |
| Cada ocorrência de cookie sync | −8 pontos |
| Cada abertura de IndexedDB | −2 pontos |
| Cada indício de hijacking/hook | −10 pontos |

O resultado é arredondado e limitado ao intervalo de 0 a 100. A interface usa
as seguintes faixas:

- **70 a 100:** boa privacidade (verde);
- **40 a 69:** privacidade intermediária (amarelo);
- **0 a 39:** baixa privacidade (vermelho).

Essa pontuação é uma métrica autoral do projeto. Ela não equivale à metodologia
do Blacklight e deve ser comparada com outras ferramentas de forma qualitativa,
considerando o que cada uma mede.

## Estrutura do projeto

| Arquivo ou diretório | Responsabilidade |
|---|---|
| `manifest.json` | Metadados, permissões e componentes da extensão |
| `background.js` | Estado por aba, requisições, cookies, detecções e cálculo do score |
| `blocklist.js` | Persistência e consulta da lista de bloqueio |
| `content_script.js` | Comunicação entre a página e o background |
| `inject.js` | Instrumentação das APIs no contexto principal da página |
| `popup.html` / `popup.js` | Interface e apresentação do relatório |
| `evidencias/` | Prints, HARs e registros usados na avaliação |

## Validação com DuckDuckGo Privacy Test Pages

Os testes foram baseados no projeto
[DuckDuckGo Privacy Test Pages](https://github.com/duckduckgo/privacy-test-pages):

| Teste | Indicador observado no plugin |
|---|---|
| Tracker Reporting | Domínios de terceiros |
| Tracker Blocking | Bloqueio de `bad.third-party.site` |
| Storage Blocking | `localStorage`, `sessionStorage` e `IndexedDB` |
| Storage Partitioning | Atividade de armazenamento por contexto/frame |
| Canvas Fingerprinting | Campo **Canvas fingerprint** |
| Bounce Tracking | Campo **Bounce tracking** |
| Query Parameters | Campo **Cookie sync** |
| JS Leaks | Campo **Indícios de hijacking/hook** |

Essas páginas dependem de domínios locais e Service Workers. Portanto, devem ser
executadas conforme as instruções do repositório oficial, incluindo a
configuração do arquivo `hosts` e do servidor recomendado. Servir os arquivos
somente com `python -m http.server` pode gerar respostas 404 e resultados
inválidos, principalmente em Storage Blocking.

O plugin mede o uso das APIs, mas não substitui o veredito da página de teste.
Por exemplo, Storage Partitioning avalia isolamento entre origens, enquanto o
plugin registra operações de armazenamento. Divergências desse tipo são
esperadas e precisam ser interpretadas no relatório.


## Avaliação em sites reais

Foram analisados G1, Stack Overflow e GitHub usando quatro fontes:

1. Relatório do Privacy Tracker Detector;
2. Tráfego exportado pelo DevTools em formato HAR;
3. Resultado do Blacklight;
4. Bloqueios observados no uBlock Origin e em seu logger.

Resultados obtidos pelo score autoral do plugin:

| Site | Score | Classificação |
|---|---:|---|
| G1 | 0 | Baixa privacidade |
| Stack Overflow | 45 | Privacidade intermediária |
| GitHub | 84 | Boa privacidade |

Os resultados representam as páginas, o momento e as condições específicas das
medições. Consentimento, autenticação, conteúdo dinâmico, localização e listas
de bloqueio podem alterar os valores em uma nova execução.

## Organização das evidências

Para permitir a reprodução e a correção da atividade, recomenda-se manter em
`evidencias/`:

```text
evidencias/
├── ddg/
├── g1/
├── github/   
└── stackoverflow/
```

Cada evidência deve permitir identificar a página testada, o resultado da
ferramenta e, quando aplicável, o popup da extensão.

## Limitações conhecidas

- A função de domínio-base usa uma lista fixa de sufixos comuns, como `com.br`
  e `co.uk`, em vez de uma Public Suffix List completa.
- Cookie sync também pode ser sinalizado pela presença de parâmetros conhecidos
  de campanhas, como `utm_*`, `fbclid` e `gclid`; isso pode gerar falso positivo.
- Bounce tracking depende da observação da cadeia de navegação dentro da janela
  temporal mantida pelo background.
- A detecção de hijacking/hook é heurística. WebSockets de terceiros, alterações
  posteriores em objetos globais e polling repetido são indícios, não prova de
  comprometimento.
- Service Workers executam em contexto próprio e podem escapar parcialmente da
  instrumentação de `inject.js`.
- O plugin contabiliza chamadas e operações observadas; esses números não são
  necessariamente equivalentes a valores únicos persistidos pelo navegador.
- A classificação de privacidade depende dos pesos escolhidos para este projeto
  e não deve ser interpretada como certificação de segurança.

## Privacidade e escopo

Os dados são mantidos localmente pela extensão e apresentados por aba. O projeto
não envia os relatórios para um servidor externo. As permissões amplas são
necessárias para observar requisições e armazenamento nas páginas avaliadas.
