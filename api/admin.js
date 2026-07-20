const { supabase } = require('../lib/supabase');
const { verificarAuth, somenteCoord } = require('./_auth');

module.exports = async function handler(req, res) {
  try {
    const usuario = await verificarAuth(req);
    if (!somenteCoord(usuario, res)) return;

    const { acao } = req.query;

    if (req.method === 'POST' && acao === 'resetar') {
      // Apaga fila
      await supabase.from('fila').delete().neq('id', 0);

      // Zera contadores — próxima senha será 001 e P001
      await supabase.from('config').update({
        contador_normal: 0,
        contador_pref:   0,
        contador_base_normal: 0,
        contador_base_pref:   0
      }).eq('id', 1);

      // Notifica em tempo real
      await supabase.from('eventos').insert({
        tipo: 'fila_resetada', payload: '{}', criado_em: new Date().toISOString()
      });
      return res.json({ ok: true });
    }

    if (req.method === 'POST' && acao === 'contador') {
      const { inicioNormal, inicioPref } = req.body;
      const n = parseInt(inicioNormal), p = parseInt(inicioPref);
      if (isNaN(n) || isNaN(p) || n < 0 || p < 0) return res.json({ ok: false, erro: 'Valores inválidos' });

      const { data: fila } = await supabase.from('fila').select('preferencial');
      const temNormal = (fila || []).some(s => !s.preferencial);
      const temPref   = (fila || []).some(s => s.preferencial);

      await supabase.from('config').update({
        contador_base_normal: n, contador_base_pref: p,
        ...(!temNormal ? { contador_normal: n } : {}),
        ...(!temPref   ? { contador_pref:   p } : {})
      }).eq('id', 1);

      await supabase.from('eventos').insert({
        tipo: 'contador_atualizado',
        payload: JSON.stringify({ baseNormal: n, basePref: p }),
        criado_em: new Date().toISOString()
      });
      return res.json({ ok: true });
    }

    return res.status(400).json({ erro: 'Ação inválida' });
  } catch (e) {
    console.error('Erro admin:', e.message);
    return res.status(500).json({ ok: false, erro: e.message });
  }
};
