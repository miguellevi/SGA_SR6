const { supabase } = require('../lib/supabase');
const { verificarAuth, somenteCoord } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const usuario = await verificarAuth(req);
    if (!somenteCoord(usuario, res)) return;

    const { guicheId } = req.body;

    const { data: fila } = await supabase.from('fila').select('*')
      .order('preferencial', { ascending: false })
      .order('criado_em', { ascending: true })
      .limit(1);

    if (!fila || fila.length === 0) return res.json({ ok: false, erro: 'Fila vazia' });

    const senha = fila[0];
    const { data: guiche } = await supabase.from('guiches').select('*').eq('id', guicheId).single();
    if (!guiche) return res.json({ ok: false, erro: 'Guichê inválido' });

    await supabase.from('fila').delete().eq('id', senha.id);

    const hora = new Date().toLocaleTimeString('pt-BR');
    const agora = new Date().toISOString();

    await supabase.from('guiches').update({
      senha_atual: senha.num, preferencial: senha.preferencial
    }).eq('id', guicheId);

    await supabase.from('relatorio').insert({
      num: senha.num, guiche_id: guicheId, nome_guiche: guiche.nome,
      atendente: guiche.atendente || usuario.nome,
      preferencial: senha.preferencial, hora,
      data: new Date().toLocaleDateString('pt-BR'), criado_em: agora
    });

    // Busca fila atualizada para broadcast
    const { data: filaAtual } = await supabase.from('fila').select('preferencial');
    const filaNormalQtd = (filaAtual || []).filter(s => !s.preferencial).length;
    const filaPrefQtd   = (filaAtual || []).filter(s => s.preferencial).length;

    await supabase.from('eventos').insert({
      tipo: 'nova_chamada',
      payload: JSON.stringify({
        num: senha.num, guicheId, nomeGuiche: guiche.nome,
        atendente: guiche.atendente || usuario.nome,
        preferencial: senha.preferencial, hora,
        filaNormalQtd, filaPrefQtd
      }),
      criado_em: agora
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('Erro chamar:', e.message);
    return res.status(500).json({ ok: false, erro: e.message });
  }
};
