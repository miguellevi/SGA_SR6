const { supabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { login, senha } = req.body;
    if (!login || !senha) return res.json({ ok: false, erro: 'Login e senha obrigatórios' });

    const email = `${login}@sga.local`;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data.user) return res.json({ ok: false, erro: 'Login ou senha incorretos' });

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('perfil, nome')
      .eq('auth_id', data.user.id)
      .single();

    return res.json({
      ok: true,
      token: data.session.access_token,
      perfil: perfil?.perfil || 'atendente',
      nome: perfil?.nome || login
    });
  } catch (e) {
    console.error('Erro login:', e.message);
    return res.status(500).json({ ok: false, erro: 'Erro interno: ' + e.message });
  }
};
