const { supabase } = require('../lib/supabase');
const { verificarAuth, somenteCoord } = require('./_auth');
const { horaFortaleza, dataFortaleza } = require('../lib/horario');

// Seleciona o melhor guichê automaticamente
// 1º — guichê ativo e livre (sem senha) com menos atendimentos hoje
// 2º — se todos ocupados, o que tem menos atendimentos
async function selecionarGuicheAuto() {
  const { data: guiches } = await supabase
    .from('guiches')
    .select('*')
    .eq('ativo', true)
    .order('id');

  if (!guiches || guiches.length === 0) return null;

  const hoje = dataFortaleza();
  const { data: relHoje } = await supabase
    .from('relatorio')
    .select('guiche_id')
    .eq('data', hoje);

  const contagem = {};
  (relHoje || []).forEach(r => {
    contagem[r.guiche_id] = (contagem[r.guiche_id] || 0) + 1;
  });

  const comContagem = guiches.map(g => ({
    ...g,
    atendimentos: contagem[g.id] || 0
  }));

  const livres = comContagem.filter(g => !g.senha_atual);
  if (livres.length > 0) {
    return livres.sort((a, b) => a.atendimentos - b.atendimentos)[0];
  }

  return comContagem.sort((a, b) => a.atendimentos - b.atendimentos)[0];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const usuario = await verificarAuth(req);
    if (!somenteCoord(usuario, res)) return;

    const { guicheId, auto } = req.body;

    const { data: fila } = await supabase.from('fila').select('*')
      .order('preferencial', { ascending: false })
      .order('criado_em',    { ascending: true })
      .limit(1);

    if (!fila || fila.length === 0) return res.json({ ok: false, erro: 'Fila vazia' });

    const senha = fila[0];

    let guiche;
    if (auto) {
      guiche = await selecionarGuicheAuto();
      if (!guiche) return res.json({ ok: false, erro: 'Nenhum guichê ativo. Peça aos atendentes para selecionar seus guichês.' });
    } else {
      const { data } = await supabase.from('guiches').select('*').eq('id', guicheId).single();
      if (!data) return res.json({ ok: false, erro: 'Guichê inválido' });
      guiche = data;
    }

    await supabase.from('fila').delete().eq('id', senha.id);

    // ── Horário correto de Fortaleza (UTC-3) ──
    const hora  = horaFortaleza();
    const data  = dataFortaleza();
    const agora = new Date().toISOString(); // criado_em pode continuar em UTC — é só timestamp interno

    await supabase.from('guiches').update({
      senha_atual:  senha.num,
      preferencial: senha.preferencial
    }).eq('id', guiche.id);

    await supabase.from('relatorio').insert({
      num:          senha.num,
      guiche_id:    guiche.id,
      nome_guiche:  guiche.nome,
      atendente:    guiche.atendente || usuario.nome,
      preferencial: senha.preferencial,
      hora,
      data,
      criado_em: agora
    });

    const { data: filaAtual } = await supabase.from('fila').select('preferencial');
    const filaNormalQtd = (filaAtual || []).filter(s => !s.preferencial).length;
    const filaPrefQtd   = (filaAtual || []).filter(s =>  s.preferencial).length;

    await supabase.from('eventos').insert({
      tipo: 'nova_chamada',
      payload: JSON.stringify({
        num:          senha.num,
        guicheId:     guiche.id,
        nomeGuiche:   guiche.nome,
        atendente:    guiche.atendente || usuario.nome,
        preferencial: senha.preferencial,
        hora, filaNormalQtd, filaPrefQtd,
        modoAuto:     !!auto
      }),
      criado_em: agora
    });

    return res.json({
      ok: true,
      guicheEscolhido: guiche.nome,
      modoAuto: !!auto
    });

  } catch (e) {
    console.error('Erro chamar:', e.message);
    return res.status(500).json({ ok: false, erro: e.message });
  }
};
