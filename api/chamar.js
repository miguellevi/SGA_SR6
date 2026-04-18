import { supabase } from '../lib/supabase.js';
import { verificarAuth, somenteCoord } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const usuario = await verificarAuth(req);
  if (!somenteCoord(usuario, res)) return;

  const { guicheId } = req.body;

  // Pega próxima senha — preferencial tem prioridade
  const { data: fila } = await supabase
    .from('fila')
    .select('*')
    .order('preferencial', { ascending: false })
    .order('criado_em', { ascending: true })
    .limit(1);

  if (!fila || fila.length === 0) return res.json({ ok: false, erro: 'Fila vazia' });

  const senha = fila[0];

  // Busca guichê
  const { data: guiche } = await supabase
    .from('guiches')
    .select('*')
    .eq('id', guicheId)
    .single();

  if (!guiche) return res.json({ ok: false, erro: 'Guichê inválido' });

  // Remove da fila
  await supabase.from('fila').delete().eq('id', senha.id);

  const hora = new Date().toLocaleTimeString('pt-BR');
  const agora = new Date().toISOString();

  // Atualiza guichê
  await supabase.from('guiches').update({
    senha_atual:  senha.num,
    preferencial: senha.preferencial
  }).eq('id', guicheId);

  // Registra no relatório
  await supabase.from('relatorio').insert({
    num:          senha.num,
    guiche_id:    guicheId,
    nome_guiche:  guiche.nome,
    atendente:    guiche.atendente || usuario.nome,
    preferencial: senha.preferencial,
    hora,
    data:         new Date().toLocaleDateString('pt-BR'),
    criado_em:    agora
  });

  // Publica evento Realtime via tabela de eventos
  await supabase.from('eventos').insert({
    tipo: 'nova_chamada',
    payload: JSON.stringify({
      num:         senha.num,
      guicheId,
      nomeGuiche:  guiche.nome,
      atendente:   guiche.atendente || usuario.nome,
      preferencial: senha.preferencial,
      hora
    }),
    criado_em: agora
  });

  return res.json({ ok: true });
}
