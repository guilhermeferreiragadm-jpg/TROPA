# Roteiro de telas do harness

Abrir `http://localhost:5173/` (perfil de exemplo) e, no console da página, chamar `__T`. Largura de verificação: 390 px, também 360 e 430. Repetir com `?tema=escuro` e com `prefers-reduced-motion` ligado.

| Grupo | Como abrir |
|---|---|
| Hoje | `__T.ir("hoje")` |
| Check-in (sheet) | `__T.sheetCheckin()` |
| Pausa (sheet) | `__T.sheetPausar()` |
| Treino semana | `__T.ir("treino")` |
| Treino do dia | clicar num item da semana (abre `treino/treino`) |
| Comida | `__T.ir("comida")` |
| Lista de compras (sheet) | `__T.sheetCompras()` |
| Feed | `__T.ir("feed")` |
| Postar (sheet) | `__T.sheetPostar()` |
| Performance | `__T.ir("perf")` |
| Nível, Liga, Desafios, Grupo, Dupla | `__T.ir("perf","nivel")`, `"liga"`, `"desafios"`, `"ngrupo"`, `"dupla"` |
| Perfil | `__T.ir("perfil")` |
| Corpo, Extras | `__T.ir("perfil","corpo")`, `__T.ir("perfil","extras")` |
| Painel do dono | `__T.ir("painel")` |
| Chat | `__T.ir("chat")` |
| Fechar o dia, Nota | `__T.ir("hoje","checkout")`, `__T.ir("hoje","nota", <data AAAA-MM-DD>)` |
| Subiu de nível | `__T.telaSubiu(__T.nivelXP())` |
| Conquista | `__T.celebrar("Teste")` |
| Abertura, Código, Plano pronto, Assinatura, Match | `__T.telaAbertura()`, `telaCodigo()`, `telaPlanoPronto()`, `telaAssinatura()`, `telaMatch()` |
| Onboarding | abrir `?perfil=0`, tocar em entrar, e `__T.onb(0)` a `__T.onb(5)` |
