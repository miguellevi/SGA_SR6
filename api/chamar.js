const { supabase } = require('../lib/supabase');
const { verificarAuth, somenteCoord } = require('./_auth');

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

  // Conta atendimentos de hoje por guichê
  const hoje = new Date().toLocaleDateString('pt-BR');
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

  // 1º tenta guichê livre (sem senha atual)
  const livres = comContagem.filter(g => !g.senha_atual);
  if (livres.length > 0) {
    return livres.sort((a, b) => a.atendimentos - b.atendimentos)[0];
  }

  // 2º todos ocupados — pega o com menos atendimentos
  return comContagem.sort((a, b) => a.atendimentos - b.atendimentos)[0];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const usuario = await verificarAuth(req);
    if (!somenteCoord(usuario, res)) return;

    const { guicheId, auto, senhaId, senhaNum } = req.body || {};

    let senha = null;

    // 1. Se informou ID da senha específico
    if (senhaId) {
      const { data: filaItem } = await supabase.from('fila').select('*').eq('id', senhaId).single();
      if (filaItem) {
        senha = filaItem;
      }
    }

    // 2. Se informou número da senha (ex: "P002", "005")
    if (!senha && senhaNum) {
      const numTrim = String(senhaNum).trim().toUpperCase();
      const { data: filaList } = await supabase.from('fila').select('*');
      senha = (filaList || []).find(s => s.num && s.num.toUpperCase() === numTrim);
    }

    // 3. Caso padrão: Pega próxima senha da fila (preferencial primeiro)
    if (!senha && !senhaId && !senhaNum) {
      const { data: fila } = await supabase.from('fila').select('*')
        .order('preferencial', { ascending: false })
        .order('criado_em',    { ascending: true })
        .limit(1);

      if (!fila || fila.length === 0) return res.json({ ok: false, erro: 'Fila vazia. Não há senhas aguardando atendimento.' });
      senha = fila[0];
    }

    if (!senha) {
      return res.json({ ok: false, erro: 'A senha selecionada não foi encontrada na fila de espera.' });
    }

    // Determina o guichê destino
    let guiche;
    if (auto || !guicheId) {
      // Modo automático — sistema escolhe
      guiche = await selecionarGuicheAuto();
      if (!guiche) return res.json({ ok: false, erro: 'Nenhum guichê ativo no momento. Peça aos atendentes para selecionar seus guichês.' });
    } else {
      // Modo manual — coordenador escolheu
      const { data } = await supabase.from('guiches').select('*').eq('id', guicheId).single();
      if (!data) return res.json({ ok: false, erro: 'Guichê inválido' });
      guiche = data;
    }

    // Remove da fila
    await supabase.from('fila').delete().eq('id', senha.id);

    const hora  = new Date().toLocaleTimeString('pt-BR');
    const agora = new Date().toISOString();

    // Atualiza guichê
    await supabase.from('guiches').update({
      senha_atual:  senha.num,
      preferencial: senha.preferencial
    }).eq('id', guiche.id);

    // Registra no relatório
    await supabase.from('relatorio').insert({
      num:          senha.num,
      guiche_id:    guiche.id,
      nome_guiche:  guiche.nome,
      atendente:    guiche.atendente || usuario.nome,
      preferencial: senha.preferencial,
      hora,
      data: new Date().toLocaleDateString('pt-BR'),
      criado_em: agora
    });

    // Fila atualizada para broadcast
    const { data: filaAtual } = await supabase
      .from('fila')
      .select('*')
      .order('preferencial', { ascending: false })
      .order('criado_em', { ascending: true });

    const filaList = filaAtual || [];
    const filaNormalQtd = filaList.filter(s => !s.preferencial).length;
    const filaPrefQtd   = filaList.filter(s =>  s.preferencial).length;

    // Publica evento Realtime
    await supabase.from('eventos').insert({
      tipo: 'nova_chamada',
      payload: JSON.stringify({
        num:          senha.num,
        guicheId:     guiche.id,
        nomeGuiche:   guiche.nome,
        atendente:    guiche.atendente || usuario.nome,
        preferencial: senha.preferencial,
        hora,
        filaNormalQtd,
        filaPrefQtd,
        fila:         filaList,
        modoAuto:     !!auto,
        escolhidaManualmente: Boolean(senhaId || senhaNum)
      }),
      criado_em: agora
    });

    return res.json({
      ok: true,
      senha: senha.num,
      preferencial: senha.preferencial,
      tipo_label: senha.tipo_label,
      guicheEscolhido: guiche.nome,
      guicheId: guiche.id,
      modoAuto: !!auto
    });

  } catch (e) {
    console.error('Erro chamar:', e.message);
    return res.status(500).json({ ok: false, erro: e.message });
  }
};
