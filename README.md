# Whiteboard

Quadro branco digital local para criar quadrados, setas e anotações. A versão 0.1 usa React, TypeScript, Vite, React Konva e IndexedDB.

## Executar

Requer Node.js 24 ou superior.

```sh
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. Use o mesmo endereço, porta e perfil do navegador para recuperar o quadro salvo.

## Usar o quadro

| Ferramenta | Atalho | Como usar |
| --- | --- | --- |
| Selecionar | Alt + V | Clique em um elemento ou arraste-o para mover. |
| Quadrado | Alt + S | Clique e arraste para desenhar. |
| Seta | Alt + A | Arraste da origem até a ponta. |
| Texto | Alt + T | Clique onde quer escrever e digite. Enter ou um clique fora confirma. Shift + Enter quebra a linha e Esc cancela. |

Para formatar um elemento já desenhado, use **Selecionar** e clique nele. A barra mantém os controles visíveis e habilita os que se aplicam ao elemento selecionado. Quadrados têm cores separadas para contorno e preenchimento, e textos têm cor, fonte e tamanho. Ao escolher uma ferramenta de desenho, os ajustes valem para os próximos elementos.

Segure **Alt** e arraste com o botão esquerdo do mouse para mover a visualização da lousa.

Pressione **Delete** para apagar o elemento selecionado ou ative **Borracha** e clique no que deseja apagar. Os botões **−** e **+** ajustam o zoom. Clique na porcentagem para voltar a 100%.

Use **Inserir imagem** para abrir um arquivo PNG, JPEG ou WebP de até 5 MB. Selecione a imagem e arraste a alça no canto para redimensionar. Para curvar uma seta, selecione-a e arraste seu ponto de controle.

No modo local, o Whiteboard salva automaticamente no navegador. Use **Nova lousa** para criar ou importar uma lousa e **Minhas Boards** para alternar entre elas. O desenho salvo antes dessa atualização aparece como **Lousa principal**. Use **Exportar lousa** para baixar um arquivo editável com as formas, os textos e as imagens. Limpar os dados do site remove as lousas locais.

## Acessar as lousas em outros computadores

O modo servidor usa uma conta pessoal configurada pelo administrador e salva as lousas automaticamente em um banco SQLite. Com Node.js 24 ou superior, execute na raiz do projeto:

```powershell
npm ci
npm run build
$env:WHITEBOARD_USER = 'seu-usuario'
$env:WHITEBOARD_PASSWORD = Read-Host 'Defina uma senha forte' -MaskInput
npm start
```

Abra http://127.0.0.1:5173 para testar no servidor. Para acessar de outros computadores, mantenha uma única instância em um servidor acessível por eles, publique pelo mesmo endereço HTTPS com um proxy reverso e entre com as mesmas credenciais no navegador. O processo escuta em 127.0.0.1 por padrão. Configure `HOST` e `PORT` conforme a rede do proxy. Use um caminho persistente em `WHITEBOARD_DB` (padrão `whiteboard.sqlite`) e faça backup desse banco.

Crie uma lousa com **Nova lousa** e abra qualquer lousa salva em **Minhas Boards**. Para levar o desenho já existente ao servidor, abra o aplicativo no mesmo endereço e perfil em que desenhou, clique em **Exportar lousa** e selecione o arquivo ao criar uma lousa no servidor.

Espere aparecer **Salvo no servidor** antes de fechar a página ou continuar em outro computador. Se duas abas alterarem a mesma lousa, a versão mais recente no servidor é preservada. A aba que receber o aviso pode exportar suas alterações e importar o arquivo em uma nova lousa.

Para excluir uma lousa, selecione-a em **Minhas Boards**, clique em **Excluir lousa** e confira o nome antes de confirmar.

## Verificar

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes unitários cobrem geometria, validação e persistência. O teste de navegador cobre desenho, movimento e recuperação após recarregar. O GitHub Actions executa as verificações em pushes e pull requests.
