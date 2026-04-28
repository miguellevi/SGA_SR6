// Tenta rss-to-json (disponível no Vercel após npm install)
// Se não disponível, usa fetch nativo com parser manual
let parse;
try {
  parse = require('rss-to-json').parse;
} catch(e) {
  parse = null;
}

const FONTES = [
  { nome: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml' },
  { nome: 'G1 Brasil',      url: 'https://g1.globo.com/rss/g1/brasil/' },
  { nome: 'G1',             url: 'https://g1.globo.com/rss/g1/' },
  { nome: 'G1 Ceará',       url: 'https://g1.globo.com/rss/g1/ceara/' },
];

function formatarTempo(timestamp) {
  if (!timestamp) return '';
  try {
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (diff < 1)    return 'agora';
    if (diff < 60)   return `há ${diff} min`;
    if (diff < 1440) return `há ${Math.floor(diff / 60)}h`;
    return new Date(timestamp).toLocaleDateString('pt-BR');
  } catch { return ''; }
}

// Parser manual de XML/RSS sem dependência
function parseXML(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i'))
             || block.match(new RegExp(`<${tag}[^>]*>([^<]*)<`, 'i'));
      return m ? m[1].trim() : '';
    };
    const titulo = get('title');
    const desc   = get('description').replace(/<[^>]+>/g,'').replace(/&[a-z#0-9]+;/gi,' ').trim().slice(0,220);
    const link   = get('link') || get('guid');
    const pubDate= get('pubDate');
    const cat    = get('category');
    if (titulo.length > 5) items.push({ titulo, descricao: desc, link, pubDate, categoria: cat });
    if (items.length >= 20) break;
  }
  return items;
}

const FALLBACK = [
  { titulo: 'Prefeitura de Fortaleza — Acolhimento Regional 6', descricao: 'Bem-vindo ao Sistema de Atendimento', categoria: 'Informativo', link: '#', tempo: '' },
  { titulo: 'Retire sua senha no totem de atendimento', descricao: 'Aguarde ser chamado no painel', categoria: 'Informativo', link: '#', tempo: '' },
  { titulo: 'Atendimento preferencial: idosos, gestantes e PCD', descricao: 'Retire senha preferencial no totem', categoria: 'Informativo', link: '#', tempo: '' },
  { titulo: 'Dúvidas? Fale com nossos atendentes', descricao: 'Estamos aqui para ajudar você', categoria: 'Informativo', link: '#', tempo: '' },
];

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');

  for (const fonte of FONTES) {
    try {
      let noticias = [];

      if (parse) {
        // Usa rss-to-json se disponível
        const feed = await parse(fonte.url, { timeout: 8000 });
        const items = (feed.items || []).slice(0, 20);
        noticias = items.map(item => ({
          titulo:    (item.title || '').trim(),
          descricao: (item.description || item.content || '')
                      .replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ')
                      .replace(/\s+/g, ' ').trim().slice(0, 220),
          categoria: Array.isArray(item.category) ? item.category[0] : (item.category || fonte.nome),
          link:      item.link || item.url || '#',
          tempo:     formatarTempo(item.published)
        })).filter(n => n.titulo.length > 5);

      } else {
        // Fallback: fetch + parser manual
        const response = await fetch(fonte.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 SGA-Monitor/1.0' },
          signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const xml = await response.text();
        const items = parseXML(xml);
        noticias = items.map(item => ({
          titulo:    item.titulo,
          descricao: item.descricao,
          categoria: item.categoria || fonte.nome,
          link:      item.link || '#',
          tempo:     formatarTempo(item.pubDate)
        }));
      }

      if (!noticias.length) continue;
      return res.json({ ok: true, fonte: fonte.nome, noticias });

    } catch (e) {
      console.warn(`[noticias] Falha ${fonte.nome}:`, e.message);
      continue;
    }
  }

  return res.json({ ok: true, fonte: 'Informativo', noticias: FALLBACK });
};
