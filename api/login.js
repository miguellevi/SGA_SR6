import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { login, senha } = req.body;

  // Autentica via Supabase Auth (email = login@sga.local para simplificar)
  const email = `${login}@sga.local`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error || !data.user) {
    return res.json({ ok: false, erro: 'Login ou senha incorretos' });
  }

  // Busca perfil do usuário
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
}
