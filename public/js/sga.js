// ── sga.js — carregado em todas as páginas ──
// Suporta Supabase Realtime e polling fallback contínuo

const SUPABASE_URL = window.__SGA_SUPABASE_URL__ || '';
const SUPABASE_ANON = window.__SGA_SUPABASE_ANON__ || '';

let _sb = null;
if (SUPABASE_URL && SUPABASE_ANON && typeof supabase !== 'undefined') {
  try {
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  } catch (e) {
    console.warn('Supabase Realtime client init skipped:', e.message);
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
const SGA = {
  token:        localStorage.getItem('sga_token') || '',
  refreshToken: localStorage.getItem('sga_refresh_token') || '',
  perfil:       localStorage.getItem('sga_perfil') || '',
  nome:         localStorage.getItem('sga_nome')  || '',
  _lastStateHash: '',
  _pollingInterval: null,
  _heartbeatInterval: null,

  salvarSessao(token, perfil, nome, refreshToken = null) {
    this.token  = token || this.token;
    this.perfil = perfil || this.perfil;
    this.nome   = nome || this.nome;
    if (refreshToken) this.refreshToken = refreshToken;

    localStorage.setItem('sga_token',  this.token);
    localStorage.setItem('sga_perfil', this.perfil);
    localStorage.setItem('sga_nome',   this.nome);
    if (this.refreshToken) {
      localStorage.setItem('sga_refresh_token', this.refreshToken);
    }
  },

  limparSessao() {
    this.token = this.refreshToken = this.perfil = this.nome = '';
    localStorage.removeItem('sga_token');
    localStorage.removeItem('sga_refresh_token');
    localStorage.removeItem('sga_perfil');
    localStorage.removeItem('sga_nome');
  },

  // Tenta renovar a sessão silenciosamente caso o token tenha expirado por inatividade
  async renovarSessao() {
    if (_sb && _sb.auth) {
      try {
        if (this.refreshToken) {
          const { data, error } = await _sb.auth.refreshSession({ refresh_token: this.refreshToken });
          if (!error && data?.session) {
            this.salvarSessao(data.session.access_token, this.perfil, this.nome, data.session.refresh_token);
            return data.session.access_token;
          }
        }
        const { data: sessData } = await _sb.auth.getSession();
        if (sessData?.session?.access_token) {
          this.salvarSessao(sessData.session.access_token, this.perfil, this.nome, sessData.session.refresh_token);
          return sessData.session.access_token;
        }
      } catch (e) {
        console.warn('Falha na renovação da sessão:', e);
      }
    }
    return null;
  },

  // Fetch autenticado — inclui Bearer token automaticamente e auto-renova se expirar
  async fetch(url, opts = {}, retry = true) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      ...(opts.headers || {})
    };

    try {
      const resp = await fetch(url, {
        ...opts,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });

      const json = await resp.json().catch(() => ({ ok: false, erro: 'Resposta inválida' }));

      // Se deu erro de autorização ou acesso restrito e podemos tentar renovar
      if ((resp.status === 401 || resp.status === 403 || json.erro?.includes('restrito') || json.erro?.includes('expirado')) && retry) {
        const novoToken = await this.renovarSessao();
        if (novoToken) {
          return this.fetch(url, opts, false); // Tenta 1 vez novamente com token novo
        }
      }

      return json;
    } catch (err) {
      return { ok: false, erro: err.message || 'Falha de conexão com o servidor' };
    }
  },

  // Fetch público (sem auth)
  async get(url) {
    return fetch(url).then(r => r.json()).catch(() => ({ ok: false }));
  },

  // ── Realtime & Eventos ───────────────────────────────────────────────────────
  _listeners: {},

  on(evento, cb) {
    if (!this._listeners[evento]) this._listeners[evento] = [];
    this._listeners[evento].push(cb);
  },

  _emit(evento, payload) {
    (this._listeners[evento] || []).forEach(cb => {
      try { cb(payload); } catch(err) { console.error('Callback error on event', evento, err); }
    });
  },

  // Inicia escuta do canal Supabase Realtime na tabela "eventos" + polling de contingência
  iniciarRealtime() {
    if (_sb) {
      try {
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
      } catch (err) {
        console.warn('Realtime subscription error:', err);
      }
    }

    // Polling contínuo (a cada 2.5s) para garantir sincronização entre abas e painéis
    if (!this._pollingInterval) {
      this._pollingInterval = setInterval(async () => {
        try {
          const d = await this.get('/api/estado');
          const hash = JSON.stringify({
            fN: d.filaNormalQtd,
            fP: d.filaPrefQtd,
            fLen: (d.fila || []).length,
            g: (d.guiches || []).map(x => `${x.id}:${x.senha_atual}:${x.ativo}:${x.atendente}`).join('|')
          });
          if (hash !== this._lastStateHash) {
            this._lastStateHash = hash;
            this._emit('estado_sincronizado', d);
            this._emit('fila_atualizada', d);
          }
        } catch (e) {}
      }, 2500);
    }
  },

  // Carrega estado inicial via REST e dispara 'estado_inicial'
  async carregarEstado() {
    const d = await this.get('/api/estado');
    this._lastStateHash = JSON.stringify({
      fN: d.filaNormalQtd,
      fP: d.filaPrefQtd,
      fLen: (d.fila || []).length,
      g: (d.guiches || []).map(x => `${x.id}:${x.senha_atual}:${x.ativo}:${x.atendente}`).join('|')
    });
    this._emit('estado_inicial', d);
    return d;
  }
};

// Inicia escuta
SGA.iniciarRealtime();

// Monitor de Sessão Ativa & Auto-Keepalive (evita expiração por inatividade)
if (_sb && _sb.auth) {
  try {
    _sb.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) {
        SGA.salvarSessao(session.access_token, SGA.perfil, SGA.nome, session.refresh_token);
      }
    });
  } catch (e) {}
}

// Heartbeat a cada 10 minutos para renovar token e manter coordenador logado
if (!SGA._heartbeatInterval) {
  SGA._heartbeatInterval = setInterval(async () => {
    if (SGA.token && SGA.perfil) {
      await SGA.renovarSessao();
    }
  }, 10 * 60 * 1000);
}

window.SGA = SGA;
