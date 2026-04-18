import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const [{ data: guiches }, { data: fila }, { data: tipos }, { data: config }] = await Promise.all([
    supabase.from('guiches').select('*').order('id'),
    supabase.from('fila').select('*').order('criado_em'),
    supabase.from('tipos_senha').select('*').eq('ativo', true).order('id'),
    supabase.from('config').select('*').single()
  ]);

  const filaNormal = (fila || []).filter(s => !s.preferencial);
  const filaPref   = (fila || []).filter(s => s.preferencial);

  res.json({
    guiches:    guiches || [],
    filaNormalQtd: filaNormal.length,
    filaPrefQtd:   filaPref.length,
    tiposSenha: tipos || [],
    contadorNormal:     config?.contador_normal     || 0,
    contadorPref:       config?.contador_pref       || 0,
    contadorBaseNormal: config?.contador_base_normal || 0,
    contadorBasePref:   config?.contador_base_pref   || 0
  });
}
