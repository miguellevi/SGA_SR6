import { supabase } from '../lib/supabase.js';
import { verificarAuth, somenteCoord } from './_auth.js';

export default async function handler(req, res) {
  const usuario = await verificarAuth(req);
  if (!somenteCoord(usuario, res)) return;

  // POST /api/admin?acao=resetar
  if (req.method === 'POST' && req.query.acao === 'resetar') {
    await supabase.from('fila').delete().neq('id', 0);
    await supabase.from('guiches').update({ senha_atual: null, preferencial: false });
    await supabase.from('config').update({
      contador_normal: (await supabase.from('config').select('contador_base_normal').single()).data?.contador_base_normal || 0,
      contador_pref:   (await supabase.from('config').select('contador_base_pref').single()).data?.contador_base_pref   || 0
    }).eq('id', 1);

    await supabase.from('eventos').insert({
      tipo: 'fila_resetada', payload: '{}', criado_em: new Date().toISOString()
    });
    return res.json({ ok: true });
  }

  // POST /api/admin?acao=contador
  if (req.method === 'POST' && req.query.acao === 'contador') {
    const { inicioNormal, inicioPref } = req.body;
    const n = parseInt(inicioNormal);
    const p = parseInt(inicioPref);
    if (isNaN(n) || isNaN(p) || n < 0 || p < 0)
      return res.json({ ok: false, erro: 'Valores inválidos' });

    const { data: fila } = await supabase.from('fila').select('preferencial');
    const temNormal = (fila || []).some(s => !s.preferencial);
    const temPref   = (fila || []).some(s => s.preferencial);

    await supabase.from('config').update({
      contador_base_normal: n,
      contador_base_pref:   p,
      ...(temNormal ? {} : { contador_normal: n }),
      ...(temPref   ? {} : { contador_pref:   p })
    }).eq('id', 1);

    await supabase.from('eventos').insert({
      tipo: 'contador_atualizado',
      payload: JSON.stringify({ baseNormal: n, basePref: p }),
      criado_em: new Date().toISOString()
    });
    return res.json({ ok: true });
  }

  return res.status(400).json({ erro: 'Ação inválida' });
}
