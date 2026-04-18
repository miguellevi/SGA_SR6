const { supabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { login, senha } = req.body;
    if (!login || !senha) return res.json({ ok: false, erro: 'Login e senha obrigatórios' });

    const email = `${login}@sga.local`;
    console.log('[login] tentativa:', email);

    // 1. Autentica no Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data?.user) {
      console.log('[login] auth falhou:', error?.message);
      return res.json({ ok: false, erro: 'Login ou senha incorretos' });
    }
    console.log('[login] auth ok, auth_id:', data.user.id);

    // 2. Busca perfil na tabela usuarios
    const { data: perfil, error: errPerfil } = await supabase
      .from('usuarios')
      .select('perfil, nome')
      .eq('auth_id', data.user.id)
      .single();

    console.log('[login] perfil encontrado:', JSON.stringify(perfil), 'erro:', errPerfil?.message);

    if (errPerfil || !perfil) {
      return res.json({
        ok: false,
        erro: `Usuário autenticado mas sem perfil na tabela usuarios. auth_id: ${data.user.id}`
      });
    }

    console.log('[login] sucesso, perfil:', perfil.perfil);

    return res.json({
      ok: true,
      token: data.session.access_token,
      perfil: perfil.perfil,
      nome: perfil.nome
    });

  } catch (e) {
    console.error('[login] erro inesperado:', e.message);
    return res.status(500).json({ ok: false, erro: 'Erro interno: ' + e.message });
  }
};
