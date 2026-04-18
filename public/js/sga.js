// ── sga.js — carregado em todas as páginas ──
// Substitui Socket.IO pelo Supabase Realtime

const SUPABASE_URL = window.__SGA_SUPABASE_URL__;
const SUPABASE_ANON = window.__SGA_SUPABASE_ANON__;

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth helpers ──────────────────────────────────────────────────────────────
const SGA = {
  token: localStorage.getItem('sga_token') || '',
  perfil: localStorage.getItem('sga_perfil') || '',
  nome:   localStorage.getItem('sga_nome')  || '',

  salvarSessao(token, perfil, nome) {
    this.token  = token;
    this.perfil = perfil;
    this.nome   = nome;
    localStorage.setItem('sga_token',  token);
    localStorage.setItem('sga_perfil', perfil);
    localStorage.setItem('sga_nome',   nome);
  },

  limparSessao() {
    this.token = this.perfil = this.nome = '';
    localStorage.removeItem('sga_token');
    localStorage.removeItem('sga_perfil');
    localStorage.removeItem('sga_nome');
  },

  // Fetch autenticado — inclui Bearer token automaticamente
  async fetch(url, opts = {}) {
    return fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...(opts.headers || {})
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(r => r.json());
  },

  // Fetch público (sem auth)
  async get(url) {
    return fetch(url).then(r => r.json());
  },

  // ── Realtime ────────────────────────────────────────────────────────────────
  // Listeners registrados: { evento: [callbacks] }
  _listeners: {},

  on(evento, cb) {
    if (!this._listeners[evento]) this._listeners[evento] = [];
    this._listeners[evento].push(cb);
  },

  _emit(evento, payload) {
    (this._listeners[evento] || []).forEach(cb => cb(payload));
  },

  // Inicia escuta do canal Supabase Realtime na tabela "eventos"
  iniciarRealtime() {
    _sb.channel('sga-eventos')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'eventos'
      }, ({ new: row }) => {
        try {
          const payload = JSON.parse(row.payload || '{}');
          this._emit(row.tipo, payload);
        } catch (e) {
          console.error('Realtime parse error', e);
        }
      })
      .subscribe();
  },

  // Carrega estado inicial via REST e dispara 'estado_inicial'
  async carregarEstado() {
    const d = await this.get('/api/estado');
    this._emit('estado_inicial', d);
    return d;
  }
};

// Auto-inicializa realtime e estado ao carregar
window.SGA = SGA;
