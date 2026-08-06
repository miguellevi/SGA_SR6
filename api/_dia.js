const { supabase, memoryStore } = require('../lib/supabase');

function obterDataHoje() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()); // Retorna "YYYY-MM-DD"
}

async function verificarEResetarViradaDia() {
  const hoje = obterDataHoje();

  try {
    // 1. Busca config atual
    const { data: config } = await supabase.from('config').select('*').eq('id', 1).single();

    const dataGravada = config?.data_ultima_emissao || (memoryStore?.config?.data_ultima_emissao);

    // Se é uma nova data diferente da última emissão/controle registrada
    if (dataGravada && dataGravada !== hoje) {
      console.log(`[virada_dia] Novo dia detectado (${hoje})! Anterior era (${dataGravada}). Resetando contadores para 001...`);

      // Zera contadores na tabela config
      try {
        await supabase.from('config').update({
          contador_normal: 0,
          contador_pref: 0,
          contador_base_normal: 0,
          contador_base_pref: 0,
          data_ultima_emissao: hoje
        }).eq('id', 1);
      } catch (err) {
        // Fallback caso a coluna ainda não exista no banco remoto
        await supabase.from('config').update({
          contador_normal: 0,
          contador_pref: 0,
          contador_base_normal: 0,
          contador_base_pref: 0
        }).eq('id', 1);
      }

      if (memoryStore && memoryStore.config) {
        memoryStore.config.contador_normal = 0;
        memoryStore.config.contador_pref = 0;
        memoryStore.config.contador_base_normal = 0;
        memoryStore.config.contador_base_pref = 0;
        memoryStore.config.data_ultima_emissao = hoje;
      }

      // Limpa senhas pendentes de dias anteriores da fila
      try {
        const inicioHoje = `${hoje}T00:00:00.000Z`;
        await supabase.from('fila').delete().lt('criado_em', inicioHoje);
      } catch (err) {}

      // Limpa senhas atuais dos guichês
      try {
        await supabase.from('guiches').update({ senha_atual: null }).neq('id', 0);
      } catch (err) {}

      // Emite evento Realtime avisando da virada de dia
      try {
        await supabase.from('eventos').insert({
          tipo: 'fila_resetada',
          payload: JSON.stringify({ viradaDia: true, data: hoje }),
          criado_em: new Date().toISOString()
        });
      } catch (err) {}

      return true;
    } else if (!dataGravada) {
      // Primeira inicialização da data
      try {
        await supabase.from('config').update({ data_ultima_emissao: hoje }).eq('id', 1);
      } catch (e) {}
      if (memoryStore && memoryStore.config) {
        memoryStore.config.data_ultima_emissao = hoje;
      }
    }
  } catch (e) {
    console.error('[virada_dia] Erro ao verificar virada de dia:', e.message);
  }
  return false;
}

module.exports = { obterDataHoje, verificarEResetarViradaDia };
