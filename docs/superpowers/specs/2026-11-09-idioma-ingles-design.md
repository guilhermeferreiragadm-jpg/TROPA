# Idioma inglês completo (EUA): design

Data: 2026-11-09. Pedido do usuário: "quero tudo traduzido, a plataforma rodará nos EUA também".

## Decisões já tomadas pelo usuário

- Idioma e unidades são duas chaves separadas em Perfil (junto de Aparência). Inglês liga milhas, libras, pés e polegadas, onças e ritmo por milha por padrão; a pessoa pode trocar.
- Datas em formato americano (Nov 9, 11/09, 9:30 AM), mas a semana de treino continua começando na segunda-feira (não mexe em plano, treinos salvos nem regras do coach).
- Tudo traduzido: telas, avisos, exercícios, alimentos, mensagens de erro do servidor, coach e Nutri.

## Princípios

1. O português continua sendo a fonte da verdade. Nada no armazenamento muda: o que se grava (motivos, tipos, nomes de treino, medidas) segue em português e em unidades métricas (km, kg, cm, ml, kcal). Tradução e conversão acontecem só na hora de mostrar. Assim nenhuma regra do tipo `/Dor|Doente/.test(...)` quebra e dados antigos continuam válidos.
2. O código-fonte do `publicar.html` não é reescrito. Um tradutor em tempo de execução troca os textos no DOM. Isso evita conflito de merge com o amigo (que edita o mesmo arquivo) e o que ele adicionar novo só fica sem tradução até entrar no dicionário, e um teste avisa.
3. A cobertura é medida, não presumida: um extrator lista todo texto em português do código e um teste falha se algum não estiver no dicionário nem na lista de ignorados.

## Arquitetura

**Preferências** (`P.perfil.idioma` "pt" | "en", `P.perfil.unidades` "metrico" | "imperial"). Primeira abertura: se `navigator.language` começa com "en", idioma "en" e unidades "imperial" por padrão; senão "pt" e "metrico". Efeito imediato ao trocar (sem recarregar), `<html lang>` acompanha.

**Tradutor** (bloco `/* @i18n:start */ ... /* @i18n:end */` em `publicar.html`, funções puras testáveis):
- `traduzir(texto)`: devolve o texto como está quando o idioma é pt. Em inglês: (1) busca exata no dicionário; (2) padrões com número (`{n} dias de foguinho`); (3) troca de trechos conhecidos, do maior para o menor, só em fronteira de palavra; (4) conversão de unidades no texto (`12,5 km` vira `7.8 mi`, `72 kg` vira `158.7 lb`, `5:30 /km` vira `8:51 /mi`) se as unidades forem imperiais. Resultado guardado em cache.
- Passagem no DOM: percorre nós de texto e os atributos `placeholder`, `aria-label`, `title`, `alt` e rótulos de botão; um `MutationObserver` em `document.body` cobre telas novas, folhas, avisos (toast) e o chat. Nunca toca em `input`/`textarea` digitados, em `[data-notr]` nem no texto que a pessoa escreveu.
- Número e data: `num()` usa ponto decimal em inglês; `toLocaleString`, `fmt` e `fmtLongo` usam `LOCALE` ("pt-BR" ou "en-US").
- Entradas com unidade (peso, altura, medidas do corpo, distância e ritmo digitados): o campo mostra e lê na unidade escolhida e grava sempre em métrico. São poucos campos, tratados à mão.

**Dicionário** (`app/i18n/en/*.json`, objeto `{"pt": "en"}`, mais `app/i18n/padroes-en.json` com `[regex, flags, modelo]`): embutido em `publicar.html` por `app/scripts/i18n-embutir.js`. Um teste confere que o embutido está em dia. Fonte do texto: `app/scripts/i18n-extrair.js` (acorn) lê o script do `publicar.html`, `app/shim/*.js` e `functions/lib.js` e lista literais em português.

**Coach e Nutri**: o app manda `idioma` e `unidades` na conversa, e os prompts ganham uma instrução: responder em inglês americano, na unidade da pessoa, convertendo dos dados métricos. Os prompts e a base de conhecimento (`KBC`) seguem em português: o modelo lê português e responde em inglês sem perda, e a base não aparece para a pessoa. Mensagens de erro do servidor entram no dicionário.

**Fora do escopo** (anotado, não feito): textos jurídicos (termos, privacidade, CCPA), moeda e preço, outros idiomas além de pt e en, semana começando no domingo.

## Verificação

- Testes de unidade do tradutor, das conversões e do formato de número e data.
- Teste de cobertura do dicionário contra o extrator.
- Varredura no navegador local (harness) com idioma inglês: percorre as telas, junta texto ainda em português e vira entradas ou padrões novos; capturas de tela das principais telas.

## Riscos

- Frases montadas por concatenação saem com inglês meio desajeitado até virarem padrão; a varredura serve para achá-las.
- Texto de usuário idêntico a uma entrada do dicionário é traduzido (ex.: alimento "Arroz"); aceitável.
- Dicionário embutido soma cerca de 0,8 MB ao arquivo, sem problema para o limite do artifact.
