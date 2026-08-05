const { supabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { tipoId } = req.body || {};

    const { data: tipo } = await supabase
      .from('tipos_senha').select('*').eq('id', tipoId).eq('ativo', true).single();

    if (!tipo) return res.json({ ok: false, erro: 'Tipo de atendimento inválido ou inativo' });

    const campo = tipo.preferencial ? 'contador_pref' : 'contador_normal';
    const { data: novoValor } = await supabase.rpc('incrementar_contador', { campo_nome: campo });

    const prefixo = tipo.prefixo !== undefined && tipo.prefixo !== null ? tipo.prefixo : (tipo.preferencial ? 'P' : '');
    const num = prefixo ? `${prefixo}${String(novoValor).padStart(3, '0')}` : String(novoValor).padStart(3, '0');
    const agora = new Date().toISOString();

    await supabase.from('fila').insert({
      num,
      tipo_label: tipo.label,
      preferencial: tipo.preferencial,
      criado_em: agora
    });

    const { data: filaAtual } = await supabase
      .from('fila')
      .select('*')
      .order('preferencial', { ascending: false })
      .order('criado_em', { ascending: true });

    const filaList = filaAtual || [];
    const filaNormalQtd = filaList.filter(s => !s.preferencial).length;
    const filaPrefQtd   = filaList.filter(s =>  s.preferencial).length;
    const posicao = tipo.preferencial ? filaPrefQtd : filaNormalQtd;

    await supabase.from('eventos').insert({
      tipo: 'fila_atualizada',
      payload: JSON.stringify({ filaNormalQtd, filaPrefQtd, fila: filaList, emitida: num }),
      criado_em: agora
    });

    return res.json({ ok: true, num, tipo: tipo.label, preferencial: tipo.preferencial, posicao });
  } catch (e) {
    console.error('Erro emitir:', e.message);
    return res.status(500).json({ ok: false, erro: e.message });
  }
};
