import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { tipoId } = req.body;

  const { data: tipo } = await supabase
    .from('tipos_senha')
    .select('*')
    .eq('id', tipoId)
    .eq('ativo', true)
    .single();

  if (!tipo) return res.json({ ok: false, erro: 'Tipo inválido' });

  // Incrementa contador atomicamente via RPC
  const campo = tipo.preferencial ? 'contador_pref' : 'contador_normal';
  const { data: cfg } = await supabase.rpc('incrementar_contador', { campo_nome: campo });

  const novoValor = cfg;
  const num = tipo.preferencial
    ? `P${String(novoValor).padStart(3, '0')}`
    : String(novoValor).padStart(3, '0');

  // Insere na fila
  await supabase.from('fila').insert({
    num,
    tipo_label: tipo.label,
    preferencial: tipo.preferencial,
    criado_em: new Date().toISOString()
  });

  // Busca posição na fila
  const { count } = await supabase
    .from('fila')
    .select('*', { count: 'exact', head: true })
    .eq('preferencial', tipo.preferencial);

  return res.json({
    ok: true,
    num,
    tipo: tipo.label,
    preferencial: tipo.preferencial,
    posicao: count || 1
  });
}
