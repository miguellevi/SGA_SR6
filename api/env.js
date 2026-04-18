// Retorna as variáveis públicas do Supabase como JS
// (apenas ANON KEY — nunca expõe a SERVICE KEY)
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    window.__SGA_SUPABASE_URL__  = "${process.env.SUPABASE_URL}";
    window.__SGA_SUPABASE_ANON__ = "${process.env.SUPABASE_ANON_KEY}";
  `);
}
