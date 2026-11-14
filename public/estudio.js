(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('article-form');
  let articles = [];
  let imagePath = null;
  let graphicForTitle = null;
  let pendingContainerId = null;
  const fields = ['title','summary','body','sources','category','region','tags','eyebrow','highlight'];
  const els = Object.fromEntries(fields.map(key => [key, $('article-'+key)]));
  const safe = s => String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function message(target, text, ok=false) { const el = $(target); el.textContent = text; el.classList.toggle('ok',ok); }
  async function api(path, init={}) {
    const options = { credentials:'same-origin', ...init };
    if (options.body && typeof options.body !== 'string') options.body = JSON.stringify(options.body);
    if (options.body) options.headers = { 'Content-Type':'application/json', ...options.headers };
    const response = await fetch(path, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Erro HTTP ${response.status}`);
    return data;
  }
  function showDashboard(loggedIn) {
    $('login-screen').hidden = loggedIn;
    $('studio-dashboard').hidden = !loggedIn;
    $('logout-button').hidden = !loggedIn;
    if (loggedIn) loadQueue();
  }
  async function bootstrap() {
    try { const auth = await api('/api/auth/me'); showDashboard(auth.loggedIn); }
    catch { showDashboard(false); }
    try {
      const cfg = await api('/api/config');
      $('connection-status').textContent = cfg.instagramConfigured ? 'META CONFIGURADA' : 'META NÃO CONECTADA';
      $('integration-detail').textContent = cfg.instagramConfigured ? 'Conta profissional configurada. Gere uma arte, revise e confirme a publicação. A mídia precisa estar disponível no domínio HTTPS público.' : 'Para enviar diretamente ao Instagram, configure INSTAGRAM_USER_ID, INSTAGRAM_ACCESS_TOKEN e PUBLIC_URL (HTTPS) no servidor. Antes disso, o estúdio permite gerar e baixar artes.';
    } catch {}
  }
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault(); message('login-message','');
    try { await api('/api/auth/login', { method:'POST', body:{password:$('admin-password').value} }); $('admin-password').value=''; showDashboard(true); }
    catch (error) { message('login-message',error.message); }
  });
  $('logout-button').addEventListener('click', async () => { try { await api('/api/auth/logout',{method:'POST'}); } catch {} showDashboard(false); });
  function titleChanged() {
    const value = els.title.value.trim();
    $('title-count').textContent = els.title.value.length + ' / 160';
    $('preview-title').textContent = value ? value.toLocaleUpperCase('pt-BR') : 'SUA MANCHETE ENTRA AQUI.';
    $('preview-category').textContent = `${els.category.value} // ${els.eyebrow.value || 'ALERTA GLOBAL'}`;
    if (graphicForTitle !== value + els.category.value + els.eyebrow.value) {
      imagePath = null; pendingContainerId = null; $('download-image').hidden = true;
    }
  }
  ['title','category','eyebrow'].forEach(k => els[k].addEventListener('input', titleChanged));
  $('instagram-caption').addEventListener('input', () => $('caption-count').textContent = `${$('instagram-caption').value.length} / 2.200`);
  function currentData(status) {
    return {
      title: els.title.value, summary: els.summary.value, body: els.body.value,
      sources: els.sources.value, category: els.category.value, region: els.region.value,
      tags: els.tags.value, eyebrow: els.eyebrow.value, highlight: els.highlight.checked,
      status
    };
  }
  function readIntoEditor(item) {
    $('article-id').value = item.id;
    for(const k of fields) { if(k==='highlight') els[k].checked = Boolean(item[k]); else els[k].value = item[k] || ''; }
    titleChanged(); window.scrollTo({top:0,behavior:'smooth'});
    message('editor-message',`Editando: ${item.title}`,true);
    suggestCaption();
  }
  function resetEditor() {
    form.reset(); $('article-id').value=''; els.eyebrow.value='RADAR GLOBAL';
    $('instagram-caption').value=''; $('confirm-review').checked=false;
    titleChanged(); message('editor-message','Nova matéria iniciada.',true); message('instagram-message','');
  }
  async function save(status) {
    message('editor-message','Salvando...');
    try {
      const id = $('article-id').value;
      const item = await api(id ? '/api/admin/articles/'+encodeURIComponent(id) : '/api/admin/articles', { method:id ? 'PUT' : 'POST', body:currentData(status) });
      $('article-id').value = item.id;
      message('editor-message',status === 'published' ? 'Matéria publicada no site. ✓' : 'Rascunho salvo. ✓', true);
      await loadQueue();
    } catch(err) { message('editor-message',err.message); }
  }
  $('save-draft').addEventListener('click', () => save('draft'));
  $('publish-site').addEventListener('click', () => save('published'));
  $('new-article').addEventListener('click', resetEditor);
  $('refresh-list').addEventListener('click', loadQueue);
  $('nav-fila').addEventListener('click', () => { const el = $('editorial-list'); el.scrollIntoView({behavior:'smooth'}); });
  async function loadQueue() {
    try { articles = await api('/api/admin/articles'); renderQueue(); }
    catch(e) { $('articles-list').textContent = e.message; }
  }
  function renderQueue() {
    $('articles-list').innerHTML = articles.length ? articles.map(a => `<div class="editorial-row"><div class="row-main"><span class="status ${a.status === 'published' ? 'published' : ''}">${a.status==='published'?'PUBLICADO':'RASCUNHO'}</span> <small>${safe(a.category)} · ${new Date(a.createdAt).toLocaleDateString('pt-BR')}${a.demo?' · EXEMPLO':''}</small><h3>${safe(a.title)}</h3></div><button type="button" data-edit="${safe(a.id)}">EDITAR</button><button type="button" class="danger" data-delete="${safe(a.id)}">EXCLUIR</button></div>`).join('') : '<div class="editorial-empty">Nenhuma matéria ainda. Crie a primeira publicação.</div>';
  }
  $('articles-list').addEventListener('click', async e => {
    const edit=e.target.closest('[data-edit]'); const del=e.target.closest('[data-delete]');
    if (edit) { const a = articles.find(x => x.id===edit.dataset.edit); if(a)readIntoEditor(a); }
    if (del) {
      const a = articles.find(x => x.id===del.dataset.delete);
      if (!a || !confirm(`Excluir definitivamente a matéria “${a.title}”?`)) return;
      try { await api('/api/admin/articles/'+encodeURIComponent(a.id), { method:'DELETE' }); if($('article-id').value === a.id)resetEditor(); await loadQueue(); }
      catch (err) { message('editor-message',err.message); }
    }
  });
  function suggestCaption() {
    const title = els.title.value.trim(); const summary=els.summary.value.trim();
    const tags = els.tags.value.split(',').map(x => '#'+x.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_]/g,'')).filter(x=>x.length>1).slice(0,6);
    $('instagram-caption').value = [title ? `◉ ${title.toLocaleUpperCase('pt-BR')}` : '',summary,'','Entenda o contexto e veja as fontes no portal SIRENE ZERO.','','O mundo não espera. Nós também não.','',tags.length ? tags.join(' ') : '#Geopolitica #SireneZero #MundoEmAlerta'].filter((x,i) => x!=='' || i>0).join('\n').trim();
    $('instagram-caption').dispatchEvent(new Event('input'));
  }
  $('suggest-caption').addEventListener('click', suggestCaption);
  $('copy-caption').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('instagram-caption').value); message('instagram-message','Legenda copiada para a área de transferência.',true); }
    catch { $('instagram-caption').select(); message('instagram-message','Selecione e copie o texto da legenda.'); }
  });
  $('generate-image').addEventListener('click', async () => {
    message('instagram-message','Gerando JPEG 1080 × 1350...');
    try {
      const result = await api('/api/admin/graphic',{method:'POST',body:{title:els.title.value,category:els.category.value,eyebrow:els.eyebrow.value}});
      imagePath = result.imagePath; pendingContainerId = null;
      graphicForTitle = els.title.value.trim() + els.category.value + els.eyebrow.value;
      $('download-image').href = imagePath; $('download-image').hidden = false;
      message('instagram-message','Arte gerada. Baixe o JPEG ou publique após a revisão.',true);
    } catch(e) {message('instagram-message',e.message);}
  });
  $('publish-instagram').addEventListener('click', async () => {
    if (!imagePath && !pendingContainerId) return message('instagram-message','Gere uma arte atualizada antes de publicar.');
    if (!$('confirm-review').checked) return message('instagram-message','Marque a confirmação de revisão editorial.');
    const caption=$('instagram-caption').value.trim();
    if(caption.length<15) return message('instagram-message','Escreva uma legenda com pelo menos 15 caracteres.');
    if(!confirm('Confirmar a publicação real deste conteúdo no Instagram conectado?'))return;
    const button=$('publish-instagram');button.disabled=true;
    message('instagram-message','Enviando para a Meta. A publicação só será confirmada após resposta da plataforma...');
    try {
      const endpoint = pendingContainerId ? '/api/admin/instagram/finish' : '/api/admin/instagram/publish';
      const payload = pendingContainerId ? {containerId:pendingContainerId,confirmed:true} : {imagePath,caption,confirmed:true};
      const result = await api(endpoint,{method:'POST',body:payload});
      if(result.pending && result.containerId){ pendingContainerId=result.containerId; button.textContent='◎ CONCLUIR ENVIO PENDENTE ↗'; }
      if(result.ok){pendingContainerId=null; button.textContent='◎ PUBLICAR NO INSTAGRAM ↗';}
      message('instagram-message',result.message || 'Publicação concluída.',Boolean(result.ok));
    }catch(e){message('instagram-message',e.message);}finally{button.disabled=false;}
  });
  titleChanged(); bootstrap();
})();
