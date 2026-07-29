const { supabase } = require('../lib/supabase');
const { verificarAuth, somenteCoord } = require('./_auth');
const { dataFortaleza } = require('../lib/horario');

// Converter qualquer string de data ou timestamp para YYYY-MM-DD em Fortaleza (UTC-3)
function toYYYYMMDD(dataVal, criadoEmVal) {
  if (criadoEmVal) {
    try {
      const str = typeof criadoEmVal === 'string' ? criadoEmVal.replace(' ', 'T') : criadoEmVal;
      const isoStr = (typeof str === 'string' && !str.endsWith('Z') && !str.includes('+')) ? str + 'Z' : str;
      const dt = new Date(isoStr);
      if (!isNaN(dt.getTime())) {
        const fortMs = dt.getTime() - (3 * 60 * 60 * 1000);
        const fortDate = new Date(fortMs);
        const y = fortDate.getUTCFullYear();
        const m = String(fortDate.getUTCMonth() + 1).padStart(2, '0');
        const d = String(fortDate.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch (e) {}
  }

  if (dataVal && typeof dataVal === 'string') {
    const clean = dataVal.trim().replace(/[^\d\/-]/g, '');
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        let y = parts[2];
        if (y.length === 2) y = '20' + y;
        return `${y}-${m}-${d}`;
      }
    }
    if (clean.includes('-')) {
      const parts = clean.split('T')[0].split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
          let y = parts[2];
          if (y.length === 2) y = '20' + y;
          return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
  }

  return null;
}

function parseParam(s) {
  if (!s) return '';
  return toYYYYMMDD(s, null) || '';
}

module.exports = async function handler(req, res) {
  try {
    const usuario = await verificarAuth(req);
    if (!somenteCoord(usuario, res)) return;

    const { recurso } = req.query;

    // ── Relatório ──
    if (recurso === 'relatorio' && req.method === 'GET') {
      const inicio = req.query.inicio || dataFortaleza();
      const fim    = req.query.fim    || dataFortaleza();

      // Busca registros
      const { data, error } = await supabase
        .from('relatorio')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) {
        console.error('Erro ao buscar relatorio:', error);
        return res.status(500).json({ ok: false, erro: error.message });
      }

      const isoIni = parseParam(inicio);
      const isoFim = parseParam(fim);

      const minIso = isoIni && isoFim ? (isoIni <= isoFim ? isoIni : isoFim) : (isoIni || isoFim);
      const maxIso = isoIni && isoFim ? (isoIni <= isoFim ? isoFim : isoIni) : (isoIni || isoFim);

      const filtrado = (data || []).filter(r => {
        const rIso = toYYYYMMDD(r.data, r.criado_em);
        if (!rIso || !minIso || !maxIso) return true;
        return rIso >= minIso && rIso <= maxIso;
      });

      return res.json({ ok: true, relatorio: filtrado, total: filtrado.length });
    }

    // ── Usuários ──
    if (recurso === 'usuarios') {
      if (req.method === 'GET') {
        const { data } = await supabase.from('usuarios').select('id, nome, login, perfil').order('id');
        return res.json(data || []);
      }
      if (req.method === 'POST') {
        const { nome, login, senha, perfil } = req.body;
        const email = `${login}@sga.local`;
        const { data: authData, error } = await supabase.auth.admin.createUser({
          email, password: senha, email_confirm: true
        });
        if (error) return res.json({ ok: false, erro: error.message });
        await supabase.from('usuarios').insert({ auth_id: authData.user.id, nome, login, perfil: perfil || 'atendente' });
        return res.json({ ok: true });
      }
      if (req.method === 'DELETE') {
        const { id } = req.query;
        const { data: u } = await supabase.from('usuarios').select('auth_id, perfil').eq('id', id).single();
        if (!u) return res.json({ ok: false, erro: 'Não encontrado' });
        if (u.perfil === 'coordenador') return res.json({ ok: false, erro: 'Não pode remover coordenador' });
        await supabase.auth.admin.deleteUser(u.auth_id);
        await supabase.from('usuarios').delete().eq('id', id);
        return res.json({ ok: true });
      }
    }

    // ── Tipos de Senha ──
    if (recurso === 'tipos') {
      if (req.method === 'GET') {
        const { data } = await supabase.from('tipos_senha').select('*').order('id');
        return res.json(data || []);
      }
      if (req.method === 'POST') {
        const { label, prefixo, preferencial } = req.body;
        await supabase.from('tipos_senha').insert({ label, prefixo: prefixo || '', preferencial: !!preferencial, ativo: true });
        return res.json({ ok: true });
      }
      if (req.method === 'PATCH') {
        const { id } = req.query;
        await supabase.from('tipos_senha').update(req.body).eq('id', id);
        return res.json({ ok: true });
      }
    }

    return res.status(400).json({ erro: 'Recurso inválido' });
  } catch (e) {
    console.error('Erro dados:', e.message);
    return res.status(500).json({ ok: false, erro: e.message });
  }
};
