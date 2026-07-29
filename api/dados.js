const { supabase } = require('../lib/supabase');
const { verificarAuth, somenteCoord } = require('./_auth');
const { dataFortaleza } = require('../lib/horario');

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
      const { data } = await supabase
        .from('relatorio')
        .select('*')
        .order('criado_em', { ascending: true });

      function toIsoDate(val, criadoEm) {
        if (criadoEm) {
          try {
            const str = typeof criadoEm === 'string' ? criadoEm.replace(' ', 'T') : criadoEm;
            const isoStr = str.endsWith('Z') || str.includes('+') ? str : str + 'Z';
            const dt = new Date(isoStr);
            if (!isNaN(dt.getTime())) {
              const dateStr = dt.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
              const [d, m, y] = dateStr.split('/');
              if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          } catch (e) {}
        }
        if (val && typeof val === 'string') {
          const s = val.trim();
          if (s.includes('/')) {
            const [d, m, y] = s.split('/');
            if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
          if (s.includes('-')) {
            const clean = s.split('T')[0];
            const p = clean.split('-');
            if (p.length === 3) {
              if (p[0].length === 4) return clean;
              return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
            }
          }
        }
        return null;
      }

      function paramToIsoDate(s) {
        if (!s) return '';
        if (s.includes('/')) {
          const [d, m, y] = s.split('/');
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return s.split('T')[0];
      }

      const isoIni = paramToIsoDate(inicio);
      const isoFim = paramToIsoDate(fim);

      const filtrado = (data || []).filter(r => {
        const rIso = toIsoDate(r.data, r.criado_em);
        if (!rIso) return true;
        return rIso >= isoIni && rIso <= isoFim;
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
