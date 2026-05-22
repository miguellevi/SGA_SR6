const { supabase } = require('../lib/supabase');
const { verificarAuth, somenteCoord } = require('./_auth');

module.exports = async function handler(req, res) {
  try {
    const usuario = await verificarAuth(req);
    if (!somenteCoord(usuario, res)) return;

    const { recurso } = req.query;

    // ── Relatório ──
    if (recurso === 'relatorio' && req.method === 'GET') {
      const inicio = req.query.inicio || new Date().toLocaleDateString('pt-BR');
      const fim    = req.query.fim    || new Date().toLocaleDateString('pt-BR');

      // Busca registros — filtra por data no JS pois o campo é string dd/mm/yyyy
      const { data } = await supabase
        .from('relatorio')
        .select('*')
        .order('criado_em', { ascending: true });

      // Filtra pelo período
      function toDate(s) {
        const [d,m,y] = s.split('/');
        return new Date(y, m-1, d);
      }
      const dIni = toDate(inicio);
      const dFim = toDate(fim);
      dFim.setHours(23,59,59);

      const filtrado = (data || []).filter(r => {
        if (!r.data) return false;
        const d = toDate(r.data);
        return d >= dIni && d <= dFim;
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
