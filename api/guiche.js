const { supabase } = require('../lib/supabase');
const { verificarAuth } = require('./_auth');

module.exports = async function handler(req, res) {
  try {
    const usuario = await verificarAuth(req);
    if (!usuario) return res.status(401).json({ erro: 'Não autenticado' });

    const { acao } = req.query;

    if (req.method === 'POST' && acao === 'registrar') {
      const { guicheId } = req.body;
      await supabase.from('guiches').update({ atendente: null, ativo: false })
        .eq('atendente', usuario.nome).neq('id', guicheId);
      const { data: guiche } = await supabase.from('guiches')
        .update({ atendente: usuario.nome, ativo: true }).eq('id', guicheId).select().single();
      await supabase.from('eventos').insert({ tipo: 'guiches_atualizados', payload: '{}', criado_em: new Date().toISOString() });
      return res.json({ ok: true, guiche });
    }

    if (req.method === 'POST' && acao === 'finalizar') {
      const { guicheId } = req.body;
      // Limpa apenas a senha_atual — mantém atendente e ativo
      await supabase.from('guiches')
        .update({ senha_atual: null, preferencial: false })
        .eq('id', guicheId);
      await supabase.from('eventos').insert({
        tipo: 'guiches_atualizados', payload: '{}', criado_em: new Date().toISOString()
      });
      return res.json({ ok: true });
    }

    if (req.method === 'POST' && acao === 'liberar') {
      const { guicheId } = req.body;
      await supabase.from('guiches').update({ atendente: null, ativo: false, senha_atual: null }).eq('id', guicheId);
      await supabase.from('eventos').insert({ tipo: 'guiches_atualizados', payload: '{}', criado_em: new Date().toISOString() });
      return res.json({ ok: true });
    }

    if (req.method === 'PATCH' && acao === 'nome') {
      const { guicheId, nome } = req.body;
      await supabase.from('guiches').update({ nome }).eq('id', guicheId);
      await supabase.from('eventos').insert({ tipo: 'guiches_atualizados', payload: '{}', criado_em: new Date().toISOString() });
      return res.json({ ok: true });
    }

    return res.status(400).json({ erro: 'Ação inválida' });
  } catch (e) {
    console.error('Erro guiche:', e.message);
    return res.status(500).json({ ok: false, erro: e.message });
  }
};
