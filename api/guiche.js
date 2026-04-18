import { supabase } from '../lib/supabase.js';
import { verificarAuth } from './_auth.js';

export default async function handler(req, res) {
  const usuario = await verificarAuth(req);
  if (!usuario) return res.status(401).json({ erro: 'Não autenticado' });

  // POST /api/guiche/registrar
  if (req.method === 'POST' && req.query.acao === 'registrar') {
    const { guicheId } = req.body;

    // Libera guichê anterior do mesmo atendente
    await supabase.from('guiches')
      .update({ atendente: null, ativo: false })
      .eq('atendente', usuario.nome)
      .neq('id', guicheId);

    // Registra no novo guichê
    const { data: guiche } = await supabase
      .from('guiches')
      .update({ atendente: usuario.nome, ativo: true })
      .eq('id', guicheId)
      .select()
      .single();

    // Publica evento
    await supabase.from('eventos').insert({
      tipo: 'guiches_atualizados',
      payload: '{}',
      criado_em: new Date().toISOString()
    });

    return res.json({ ok: true, guiche });
  }

  // POST /api/guiche/liberar
  if (req.method === 'POST' && req.query.acao === 'liberar') {
    const { guicheId } = req.body;

    await supabase.from('guiches')
      .update({ atendente: null, ativo: false, senha_atual: null })
      .eq('id', guicheId);

    await supabase.from('eventos').insert({
      tipo: 'guiches_atualizados',
      payload: '{}',
      criado_em: new Date().toISOString()
    });

    return res.json({ ok: true });
  }

  // PATCH /api/guiche/nome
  if (req.method === 'PATCH' && req.query.acao === 'nome') {
    const { guicheId, nome } = req.body;
    await supabase.from('guiches').update({ nome }).eq('id', guicheId);
    await supabase.from('eventos').insert({
      tipo: 'guiches_atualizados',
      payload: '{}',
      criado_em: new Date().toISOString()
    });
    return res.json({ ok: true });
  }

  return res.status(400).json({ erro: 'Ação inválida' });
}
