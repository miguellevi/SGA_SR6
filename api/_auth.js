const { supabase } = require('../lib/supabase');

async function verificarAuth(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('perfil, nome, id')
    .eq('auth_id', data.user.id)
    .single();

  return perfil ? { ...perfil, auth_id: data.user.id } : null;
}

function somenteCoord(usuario, res) {
  if (!usuario || usuario.perfil !== 'coordenador') {
    res.status(403).json({ erro: 'Acesso restrito ao Coordenador' });
    return false;
  }
  return true;
}

module.exports = { verificarAuth, somenteCoord };
