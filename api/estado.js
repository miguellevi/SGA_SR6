const { supabase } = require('../lib/supabase');
const { verificarEResetarViradaDia } = require('./_dia');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    // 0. Verifica se virou o dia antes de devolver o estado
    await verificarEResetarViradaDia();

    const [{ data: guiches }, { data: fila }, { data: tipos }, { data: config }] = await Promise.all([
      supabase.from('guiches').select('*').order('id'),
      supabase.from('fila').select('*').order('preferencial', { ascending: false }).order('criado_em', { ascending: true }),
      supabase.from('tipos_senha').select('*').eq('ativo', true).order('id'),
      supabase.from('config').select('*').eq('id', 1).single()
    ]);

    const filaList = fila || [];
    const filaNormal = filaList.filter(s => !s.preferencial);
    const filaPref   = filaList.filter(s => s.preferencial);

    return res.json({
      guiches:            guiches || [],
      fila:               filaList,
      filaNormalQtd:      filaNormal.length,
      filaPrefQtd:        filaPref.length,
      tiposSenha:         tipos || [],
      contadorNormal:     config?.contador_normal      || 0,
      contadorPref:       config?.contador_pref        || 0,
      contadorBaseNormal: config?.contador_base_normal || 0,
      contadorBasePref:   config?.contador_base_pref   || 0
    });
  } catch (e) {
    console.error('Erro estado:', e.message);
    return res.status(500).json({ erro: e.message });
  }
};
