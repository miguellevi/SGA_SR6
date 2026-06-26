// ─── lib/horario.js ───────────────────────────────────────────────────────────
// Garante horário correto de Fortaleza (UTC-3) independente de onde o
// código rodar (servidor Vercel pode estar em UTC, UTC+0, etc).

function agoraFortaleza() {
  // Pega o horário UTC atual e aplica o fuso de Fortaleza manualmente
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza' }));
}

function horaFortaleza() {
  return new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza' });
}

function dataFortaleza() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
}

function isoFortaleza() {
  // ISO string mas representando o horário de Fortaleza
  return agoraFortaleza().toISOString();
}

module.exports = { agoraFortaleza, horaFortaleza, dataFortaleza, isoFortaleza };
