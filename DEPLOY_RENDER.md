# SIRENE ZERO — colocar no ar com Render e Registro.br

Este guia usa **Render Starter (pago) + disco persistente** para o portal diário. O GitHub pode ser gratuito. O domínio é opcional durante testes, mas recomendado para lançamento público.

## 1. Nome e domínio

Confira disponibilidade do domínio no https://registro.br e pesquise sinais de marca idêntica no INPI. Registre usando o CPF/CNPJ do responsável. Nunca entregue as credenciais do domínio a terceiros.

## 2. Suba o projeto para o GitHub

Crie um repositório privado chamado `sirene-zero` no GitHub. Extraia o ZIP e envie **os arquivos DENTRO da pasta sirene-zero**, para que `package.json` esteja na raiz. Não envie um `.env`, tokens ou senhas. Para deploy pelo navegador, use **Add file → Upload files** e envie os arquivos preservando a árvore de pastas (pelo cliente Git local você controla isso melhor).

## 3. Crie o Web Service no Render

New → Web Service → Connect GitHub → repositório `sirene-zero`.

- Language: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Branch: `main`
- Instance: **Starter (paga, a partir de US$ 7/mês)**
- Region: escolha próxima aos leitores

## 4. Disco permanente (ANTES de publicar matérias)

No Render, Settings / Disks (ou na aba Advanced durante criação), anexe um disco chamado `sirene-zero-storage`:

- Mount path: `/opt/render/project/src/storage`
- Size: `1 GB` para começar (US$ 0,25/GB/mês, sujeito a preços novos)

Este caminho precisa ser exatamente igual à variável `STORAGE_DIR`. O código lê e grava matérias em `storage/articles.json` e as imagens em `storage/media/`. Apenas a primeira execução copia as matérias de demonstração. **Não formate ou remova o disco sem backup.**

## 5. Variáveis de ambiente no Render

Abra Environment e adicione:

```
NODE_ENV=production
TRUST_PROXY=1
STORAGE_DIR=/opt/render/project/src/storage
ADMIN_PASSWORD=SENHA-FORTE-COM-PELO-MENOS-12-CARACTERES
COOKIE_SECRET=SEGREDO-ALEATORIO-COM-PELO-MENOS-32-CARACTERES
PUBLIC_URL=https://SEU-NOME.onrender.com
```

As duas últimas credenciais precisam ser geradas por você (ou por ferramenta confiável), nunca use valores de exemplo. `COOKIE_SECRET` pode ser gerado no computador com `openssl rand -hex 32` ou gerador de senhas.

NÃO inclua segredos em GitHub. Configure o `PUBLIC_URL` com a URL final https que aponta para o Render (URL `onrender.com` já funciona para testes e publicação de imagens, antes do domínio).

## 6. Teste a aplicação

Abra `https://SEU-NOME.onrender.com/` e `https://SEU-NOME.onrender.com/estudio`. Entre com `ADMIN_PASSWORD`; crie uma matéria de teste, reinicie/republique o serviço e confirme que a matéria continua lá. Teste gerar JPEG.

**Atenção:** cinco textos demonstrativos aparecem no portal, claramente sinalizados. Retire-os/substitua-os por conteúdo real verificado antes da divulgação.

## 7. Conecte o domínio

No painel Render → serviço → Settings → Custom Domains → Add Custom Domain. Insira seu domínio. Anote os registros de DNS exigidos e configure-os no painel Registro.br. Aguarde propagação e clique em Verify. O Render fornece HTTPS automaticamente. Agora atualize `PUBLIC_URL=https://seudominio.com.br` e redeploy.

## 8. Instagram profissional / Meta

- Crie/transforme o perfil Instagram em profissional (Creator ou Business)
- Acesse https://developers.facebook.com/ e crie um aplicativo com **Instagram API with Instagram Login**
- Configure permissões `instagram_business_basic` e `instagram_business_content_publish`, e faça a autorização no fluxo do painel Meta
- No Render (Environment), adicione `INSTAGRAM_USER_ID` e `INSTAGRAM_ACCESS_TOKEN` obtidos pela Meta. Mantenha o token **somente** no servidor
- Configure/renove o token conforme as regras de validade atuais da Meta. Esta versão não automatiza OAuth, refresh de token ou agendamento
- Teste um único JPEG com legenda revisada no Estúdio Zero antes de usar em produção

Documentação oficial: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing

## 9. Requisitos para operação diária

- Antes de lançar: remover notícias-demo e configurar expediente, contato, fontes, direitos autorais, política de correções
- Faça backup regular de `storage/articles.json` e `storage/media/` fora do Render; snapshot da plataforma **não substitui** política própria de backup
- Mantenha senha do editor e token Meta fora do GitHub; habilite autenticação multifator nas contas GitHub/Render/Meta/Registro.br
- Monitore falhas de publicação e os custos do serviço
- A versão 1 usa arquivo JSON e é adequada a operação pequena, de um editor/uma instância. Com equipe e alto tráfego, migre para banco gerenciado e armazenamento de objetos

## Limites de assistência

Esta entrega **não registra domínio, não cria contas, não paga hospedagem e não publica no Instagram** sem uma conta Meta autorizada. O processo de hospedagem e a publicação do Instagram ainda precisam ser testados em ambiente real.
