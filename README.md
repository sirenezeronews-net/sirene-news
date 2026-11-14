# SIRENE ZERO

**Geopolítica em estado de alerta.** Portal jornalístico em português e **Estúdio Zero**: editor de matérias, fila editorial, gerador de cards JPEG 1080 × 1350 e publicação na conta profissional do Instagram via API oficial da Meta.

> **IMPORTANTE** — Os cinco textos iniciais são amostras editoriais, não reportagens atuais. O próprio site os identifica como conteúdo ilustrativo. Remova/substitua esses textos por apuração e fontes verificadas antes de lançar o portal.

## Como executar

Requisitos: **Node.js 20+**, conexão à internet para instalar as dependências e acesso de gravação ao diretório `storage/` (ou ao caminho de `STORAGE_DIR`).

```bash
npm install
cp .env.example .env
```

Edite `.env` e substitua pelo menos `ADMIN_PASSWORD` e `COOKIE_SECRET` (crie um segredo aleatório com `openssl rand -hex 32`). Em produção, configure senhas fortes por variáveis de ambiente, sem incluir o `.env` no Git.

```bash
npm start
```

- **Portal:** `http://localhost:3000/`
- **Estúdio:** `http://localhost:3000/estudio`

A publicação no próprio portal e os rascunhos funcionam sem credenciais da Meta. A geração e o download do JPEG também.

## Como conectar o Instagram

Use **Instagram API with Instagram Login** (não misture com o fluxo Facebook Login). No [Meta for Developers](https://developers.facebook.com/), crie e configure um app para uma conta profissional Instagram **Business ou Creator**, autorize a conta e obtenha seu token com as permissões `instagram_business_basic` e `instagram_business_content_publish`. O processo exato de aprovação e acesso depende das configurações do aplicativo Meta e de quem será autorizado a usá-lo.

Configure no ambiente do servidor:

```ini
INSTAGRAM_USER_ID=seu-id-de-conta-profissional
INSTAGRAM_ACCESS_TOKEN=seu-token-do-instagram-login
INSTAGRAM_GRAPH_VERSION=v25.0
PUBLIC_URL=https://dominio-publico-do-portal.com.br
```

**Exigências importantes:**

1. A conta precisa ser profissional; contas pessoais não são publicáveis pela API.
2. O site precisa estar hospedado em **domínio HTTPS público**, acessível pelos servidores da Meta. O Instagram busca o JPEG diretamente por `PUBLIC_URL/media/arquivo.jpg`.
3. O token pertence ao **servidor**, nunca ao JavaScript do navegador. Faça a gestão/renovação do token pela Meta. A versão demonstrativa não implementa OAuth nem renovação automática.
4. No Estúdio, gere o card, edite a legenda, marque a revisão editorial e confirme conscientemente o envio. Uma falha na API não é apresentada como sucesso.
5. A versão 1 suporta **post único no feed em JPEG**; não programa agendamentos automáticos, stories, carrosséis nem reels.

Referência: [Documentação oficial da Meta: publicação de conteúdo](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing).

## Arquitetura e operação

- `server.js` — Express, login administrativo com cookie assinado, API editorial, geração JPEG via Sharp e ponte segura para a Meta.
- `public/index.html`, `public/site.js`, `public/styles.css` — site público responsivo.
- `public/estudio.html`, `public/estudio.js` — editor visual, fila, prévia do Instagram e interface de envio.
- `data/articles.json` — conjunto inicial ilustrativo, copiado uma única vez na primeira execução.
- `storage/articles.json` — conteúdo persistente (disco anexado em produção).
- `storage/media/` — JPEGs persistentes e servidos publicamente por `/media`.

### Publicação e segurança

- As operações administrativas exigem senha e cookie de sessão HttpOnly, SameSite=Strict.
- Em produção o cookie exige HTTPS; ative `NODE_ENV=production` e configure o proxy reverso com HTTPS.
- Não há cadastro público, comentários ou coleta de e-mails. A busca é local no conjunto de matérias publicadas.
- O token de acesso à Meta nunca aparece em `/api/config`, no navegador ou no HTML.
- Proteção básica contra tentativas excessivas de login e publicação; valide controles adicionais para uso por equipe e operação em escala.
- O armazenamento JSON pressupõe **uma instância e volume persistente**. Para produção de maior escala, migre para banco de dados, armazenamento de imagens e login multiusuário, inclua backups, logs auditáveis e monitoramento.
- **Recomendação editorial:** implementar política de correções, checagem de fontes, direitos autorais e atribuição de autoria antes de abrir ao público.

## Testes manuais

1. Acesse o portal e teste busca, filtros e leitura das amostras.
2. Acesse `/estudio` e entre com `ADMIN_PASSWORD`.
3. Crie rascunho com manchete, resumo e texto; verifique a fila.
4. Publique no portal informando fontes; atualize o site público.
5. Gere o JPEG e faça o download; revise a arte e a legenda.
6. Sem credenciais da Meta, o botão de publicação retorna mensagem de configuração, sem publicar nada.
7. Com conta profissional e HTTPS configurados, teste primeiro com conteúdo próprio e verificado.

## Nome, assinatura e identidade

**SIRENE ZERO** — *O mundo não espera. Nós também não.* Paleta: carvão `#0B1117`, vermelho-alarme `#EB4145`, branco-papel `#F0EEE6`.

O nome foi criado para este protótipo, mas **não equivale a uma verificação de disponibilidade de marca, domínio ou @ no Instagram**. Faça consulta de marca no INPI e verifique nomes de usuário antes de registrar.

## Publicação no Render

Veja o guia **DEPLOY_RENDER.md** com todas as instruções para o Render Starter e o disco persistente. A versão gratuita não é segura para notícias diárias com o armazenamento atual.
