(() => {
  'use strict';
  const grid = document.getElementById('news-grid');
  const search = document.getElementById('site-search');
  const modal = document.getElementById('article-modal');
  let articles = [];
  let category = 'TODAS';
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const categories = ['TODAS','CONFLITOS','DEFESA','ESTRATÉGIA','ECONOMIA','INTELIGÊNCIA'];
  const date = s => { try { return new Date(s).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' }).replace('.',''); } catch { return ''; } };
  function updateClock() {
    document.getElementById('utc-clock').textContent = 'UTC ' + new Date().toLocaleTimeString('pt-BR', { timeZone:'UTC', hour:'2-digit', minute:'2-digit' });
  }
  updateClock(); setInterval(updateClock, 60_000);
  function render() {
    const query = (search.value || '').trim().toLocaleLowerCase('pt-BR');
    const filtered = articles.filter(a => (category === 'TODAS' || a.category === category) && [a.title,a.summary,a.region,a.tags].join(' ').toLocaleLowerCase('pt-BR').includes(query));
    document.getElementById('no-results').hidden = filtered.length > 0;
    grid.innerHTML = filtered.map((a,i) => {
      const featured = i === 0 && category === 'TODAS' && !query;
      return `<a href="#artigo-${encodeURIComponent(a.id)}" class="news-card ${featured?'featured-card':''}" data-id="${escapeHTML(a.id)}">
        <div class="card-visual"><span class="visual-label">SIRENE // ZERO</span><span class="visual-number">${String(i+1).padStart(2,'0')}</span><span class="visual-signal"><span class="red-dot"></span>${escapeHTML(a.eyebrow || 'RADAR GLOBAL')}</span></div>
        <div class="card-body"><div class="card-meta"><span>${escapeHTML(a.category)}</span><small>${escapeHTML(a.region || 'GLOBAL')} · ${date(a.createdAt)}</small></div><h3 class="card-title">${escapeHTML(a.title)}</h3><p class="card-excerpt">${escapeHTML(a.summary)}</p><div class="card-cta"><span>${a.demo ? 'ARTIGO DEMONSTRATIVO' : 'LER REPORTAGEM'} </span><span>↗</span></div></div></a>`;
    }).join('');
    grid.querySelectorAll('a[data-id]').forEach(link => link.addEventListener('click', e => { e.preventDefault(); showArticle(link.dataset.id); }));
  }
  function showArticle(id) {
    const article = articles.find(a => a.id === id);
    if (!article) return;
    const paragraphs = String(article.body || '').split(/\n\s*\n/).filter(Boolean).map(p => '<p>' + escapeHTML(p).replace(/\n/g,'<br>') + '</p>').join('');
    const container = document.getElementById('article-detail');
    container.innerHTML = `${article.demo ? '<span class="detail-demo">CONTEÚDO ILUSTRATIVO — NÃO É NOTÍCIA APURADA</span>' : ''}<div class="section-overline" style="margin-top:22px">${escapeHTML(article.category)} / ${escapeHTML(article.region)} · ${date(article.createdAt)}</div><h2 class="detail-title">${escapeHTML(article.title)}</h2><p class="detail-summary">${escapeHTML(article.summary)}</p><div class="detail-body">${paragraphs}</div><div class="detail-sources"><b>FONTES E METODOLOGIA</b><div>${escapeHTML(article.sources || 'Não informado.')}</div></div><button class="dark-button detail-share" type="button" id="share-article">COMPARTILHAR ↗</button>`;
    document.getElementById('share-article').addEventListener('click', async () => {
      const url = location.origin + '/#artigo-' + encodeURIComponent(article.id);
      if (navigator.share) { try { await navigator.share({ title: article.title, url }); } catch {} }
      else { try { await navigator.clipboard.writeText(url); document.getElementById('share-article').textContent = 'LINK COPIADO ✓'; } catch {} }
    });
    modal.showModal(); history.replaceState(null,'','#artigo-'+encodeURIComponent(id));
  }
  function activateCategory(c) {
    category = categories.includes(c) ? c : 'TODAS';
    document.querySelectorAll('[data-category]').forEach(b => b.classList.toggle('active', b.dataset.category === category));
    render();
  }
  document.getElementById('filter-buttons').addEventListener('click', e => { const b = e.target.closest('[data-category]'); if (b) activateCategory(b.dataset.category); });
  document.querySelectorAll('nav [data-filter]').forEach(a => a.addEventListener('click', () => activateCategory(a.dataset.filter)));
  document.getElementById('search-toggle').addEventListener('click', () => { const el = document.getElementById('search-wrapper'); el.hidden = !el.hidden; if (!el.hidden) search.focus(); });
  search.addEventListener('input', render);
  document.getElementById('hero-read').addEventListener('click', () => document.getElementById('radar').scrollIntoView({ behavior:'smooth' }));
  document.getElementById('modal-close').addEventListener('click', () => { modal.close(); history.replaceState(null,'',location.pathname); });
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
  fetch('/api/articles').then(r => { if(!r.ok)throw new Error(); return r.json(); }).then(data => {
    articles = data; render();
    if (location.hash.startsWith('#artigo-')) showArticle(decodeURIComponent(location.hash.substring(8)));
  }).catch(() => { grid.innerHTML = '<p class="loading-news">Não foi possível carregar o radar. Verifique a conexão com o servidor.</p>'; });
})();
