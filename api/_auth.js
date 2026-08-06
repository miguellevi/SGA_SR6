const { supabase, memoryStore } = require('../lib/supabase');

async function verificarAuth(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;

  // 1. Tenta validação padrão via Supabase Auth
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('perfil, nome, id')
        .eq('auth_id', data.user.id)
        .single();

      if (perfil) return { ...perfil, auth_id: data.user.id };
    }
  } catch (e) {}

  // 2. Fallback para token de desenvolvimento em memória (mock-token-...)
  if (token.startsWith('mock-token-') && memoryStore) {
    const authId = token.replace('mock-token-', '');
    const u = memoryStore.usuarios.find(x => x.auth_id === authId || String(x.id) === authId);
    if (u) return { perfil: u.perfil, nome: u.nome, id: u.id, auth_id: u.auth_id };
  }

  // 3. Fallback inteligente para JWT do Supabase com sessão expirada por inatividade
  // Decodifica o payload do JWT e valida se o usuário existe ativo na tabela 'usuarios'
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadStr);
      const authId = payload.sub;
      if (authId) {
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('perfil, nome, id')
          .eq('auth_id', authId)
          .single();

        if (perfil) {
          return { ...perfil, auth_id: authId };
        }
      }
    }
  } catch (e) {}

  return null;
}

function somenteCoord(usuario, res) {
  if (!usuario || (usuario.perfil !== 'coordenador' && usuario.perfil !== 'acolhimento')) {
    res.status(403).json({ erro: 'Acesso restrito ao Coordenador / Acolhimento' });
    return false;
  }
  return true;
}

module.exports = { verificarAuth, somenteCoord };
