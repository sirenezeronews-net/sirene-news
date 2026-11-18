# SIRENE ZERO — versão 2.0: TV ao vivo, rádio digital e redes sociais

## O que muda na interface

- Home: área **SINAL AO VIVO** com player 16:9 do YouTube, título, linha fina, identificação da fonte original, estado editorial e resumo das atualizações.
- Página **/ao-vivo**: o mesmo painel ganha uma linha do tempo completa com notas e suas fontes. Quando a pessoa navega usando o botão do painel, a mudança ocorre na própria página, sem recriar o player; isso ajuda a não interromper a transmissão durante a leitura das atualizações.
- Home: player **RÁDIO ZERO** com status do sinal, nome da estação, programa, faixa/boletim em execução e próxima atração com horário de Brasília.
- Data, relógio em Brasília e UTC, atualizados no navegador.
- Links configuráveis de Instagram, YouTube, X, Facebook e WhatsApp. Sem perfil configurado, os ícones são exibidos desativados; não apontam para perfis de terceiros.
- Estúdio `/estudio`: novo módulo **AO VIVO & RÁDIO**. Permite gerenciar a transmissão, publicar atualizações, configurar rádio e programação, cadastrar redes sociais.

## Passo a passo: YouTube

1. No Estúdio, abra **AO VIVO & RÁDIO**.
2. Informe título, linha fina, fonte e URL do canal de origem.
3. Vá ao vídeo/transmissão específica no YouTube e copie o link de `watch?v=...`, `live/...` ou `youtu.be/...`.
4. Cole em **LINK DO VÍDEO OU DA LIVE DO YOUTUBE**. Apenas indicar o endereço do canal `@...` não é suficiente.
5. Marque **TRANSMISSÃO AO VIVO — VERIFICADA** somente depois de conferir que o vídeo está ao vivo e que pode ser incorporado; ou **VÍDEO / REPRISE**, conforme aplicável.
6. Clique em **SALVAR CONFIGURAÇÕES DO SINAL**.
7. Para noticiar o andamento, registre título da atualização, texto e fonte em **ATUALIZAÇÕES EM TEMPO REAL**. O sistema grava horário de publicação; a interface o apresenta em Brasília.

O status **AO VIVO** depende de validação editorial; não é detecção automática de estado do YouTube. O YouTube pode proibir incorporação para determinados vídeos. Os espectadores devem poder acessar a fonte diretamente pelo botão **CANAL DE ORIGEM**.

Fontes de consulta (links oficiais, mas selecione sempre o vídeo específico para incorporar):
- Canal Gov: https://www.youtube.com/@canalgov
- Governo do Brasil: https://www.youtube.com/@GovernoDoBrasil
- The White House: https://www.youtube.com/@WhiteHouse

## Passo a passo: rádio 24 horas

1. Contrate ou configure **um servidor de streaming separado**, como uma hospedagem que ofereça **AzuraCast + Icecast + AutoDJ**. O Render que hospeda o portal NÃO transmite áudio por conta própria. A rádio 24/7 continuará operando no serviço de streaming, independentemente de manter a página aberta.
2. Cadastre programas e arquivos de áudio originais/licenciados no AutoDJ e organize playlists por horário. Confira o armazenamento e a transferência de dados necessários para o público previsto.
3. Copie o endereço HTTPS do *stream* (por exemplo, `https://radio.exemplo.com/listen/zero/radio.mp3`) e cole em **ENDEREÇO HTTPS DO STREAM DE ÁUDIO**.
4. Se usar AzuraCast, informe a URL pública `https://radio.exemplo.com/api/nowplaying/nome_da_estacao` em **AZURACAST / API NOW PLAYING**. O portal consulta esse endpoint a cada 30 segundos para preencher "tocando agora" e verificar `is_online`, quando disponível. O endpoint precisará permitir acesso HTTPS/CORS pelo navegador; se não permitir, use o campo manual como fallback até configurar um proxy confiável.
5. No Estúdio, informe a programação de atrações recorrentes, uma por linha: `HH:MM | Nome da atração`, **sempre no horário de Brasília**. O portal calcula automaticamente o programa atual e a próxima atração, inclusive após a meia-noite. **Você ainda precisa configurar a mesma grade no AutoDJ** para que o som realmente corresponda ao painel.
6. Ative **SINAL DE RÁDIO CONFIGURADO E HABILITADO** e clique em salvar.
7. O navegador não dispara o áudio automaticamente. O visitante precisa clicar em **PLAY**. Ele poderá continuar ouvindo durante a navegação interna de Home para `/ao-vivo` feita pelos botões do portal. Trocar de aba, recarregar ou navegar para fora pode interromper a reprodução.

O status da rádio distingue **configurada** de **no ar confirmado** (quando `is_online` está disponível via AzuraCast). Não se deve exibir uma transmissão como ativa sem verificação.

**Direitos autorais**: executar músicas em uma web rádio normalmente exige licenciamento de execução pública no Brasil (Ecad) e pode envolver outros direitos sobre gravações; confirme as condições do repertório. Com conteúdo próprio falado, trilhas originais ou materiais licenciados, os requisitos podem ser diferentes. Não assuma que uma música encontrada na internet é livre para retransmissão.

## Implantação e preservação dos dados

O arquivo novo `data/live.json` é a semente para o painel. Na primeira inicialização, `prepareStorage()` copia os conteúdos para `<STORAGE_DIR>/live.json`, sem sobrescrever o que já existir. Isso vale também para `articles.json`.

Na hospedagem Render configure o disco persistente no mesmo `STORAGE_DIR` usado na versão anterior (por exemplo, `/opt/render/project/src/storage`). Faça um backup do disco antes de qualquer alteração de infraestrutura. A rádio é um serviço separado e terá seus próprios custos de operação.

## Segurança e responsabilidades

- URL de vídeo validada: somente IDs de vídeo do YouTube em HTTPS.
- URL de áudio, metadados e perfis: somente HTTPS, sem credenciais na URL.
- Endpoints de escrita no painel requerem login administrativo e checagem de origem.
- O HTML escapará textos de atualizações e links; não são aceitos snippets de `iframe` arbitrários do editor.
- As cinco atualizações iniciais são demonstrativas e identificadas como tal; remova-as antes da estreia pública.
- Sinal de canal oficial é conteúdo de terceiro. Atribua a origem, siga os termos de incorporação e não afirme ser a produtora do vídeo.
