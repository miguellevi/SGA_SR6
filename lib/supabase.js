// ── lib/supabase.js ──────────────────────────────────────────────────────────
// Suporta conexão com Supabase real e fallback em memória caso variáveis
// de ambiente ainda não tenham sido configuradas no ambiente.

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

const hasRealSupabase = Boolean(supabaseUrl && supabaseKey && supabaseUrl.startsWith('http'));

// ── Banco em memória para fallback/sandbox ───────────────────────────────────
const memoryStore = {
  usuarios: [
    { id: 1, auth_id: 'user-coord-1', nome: 'Coordenador Regional 6', login: 'coordenador', perfil: 'coordenador', senha: 'admin' },
    { id: 2, auth_id: 'user-atend-1', nome: 'Atendente 1', login: 'atendente1', perfil: 'atendente', senha: '123' },
    { id: 3, auth_id: 'user-atend-2', nome: 'Atendente 2', login: 'atendente2', perfil: 'atendente', senha: '123' },
    { id: 4, auth_id: 'user-acolh-1', nome: 'Acolhimento Geral', login: 'acolhimento', perfil: 'acolhimento', senha: '123' }
  ],
  guiches: [
    { id: 1, nome: 'Guichê 1', atendente: 'Atendente 1', senha_atual: null, preferencial: false, ativo: true },
    { id: 2, nome: 'Guichê 2', atendente: 'Atendente 2', senha_atual: null, preferencial: false, ativo: true },
    { id: 3, nome: 'Guichê 3', atendente: null, senha_atual: null, preferencial: false, ativo: true },
    { id: 4, nome: 'Guichê 4', atendente: null, senha_atual: null, preferencial: false, ativo: false },
    { id: 5, nome: 'Guichê 5', atendente: null, senha_atual: null, preferencial: false, ativo: false },
    { id: 6, nome: 'Guichê 6', atendente: null, senha_atual: null, preferencial: false, ativo: false }
  ],
  fila: [
    { id: 1, num: 'P001', tipo_label: 'Idoso (Preferencial)', preferencial: true, criado_em: new Date(Date.now() - 15 * 60000).toISOString() },
    { id: 2, num: '001', tipo_label: 'Normal (Geral)', preferencial: false, criado_em: new Date(Date.now() - 12 * 60000).toISOString() },
    { id: 3, num: 'P002', tipo_label: 'Gestante (Preferencial)', preferencial: true, criado_em: new Date(Date.now() - 8 * 60000).toISOString() },
    { id: 4, num: '002', tipo_label: 'Normal (Geral)', preferencial: false, criado_em: new Date(Date.now() - 5 * 60000).toISOString() },
    { id: 5, num: '003', tipo_label: 'Normal (Geral)', preferencial: false, criado_em: new Date(Date.now() - 2 * 60000).toISOString() }
  ],
  tipos_senha: [
    { id: 1, label: 'Normal (Geral)', prefixo: '', preferencial: false, ativo: true },
    { id: 2, label: 'Idoso', prefixo: 'P', preferencial: true, ativo: true },
    { id: 3, label: 'Gestante / Lactante', prefixo: 'P', preferencial: true, ativo: true },
    { id: 4, label: 'PCD / Autista', prefixo: 'P', preferencial: true, ativo: true }
  ],
  config: {
    id: 1,
    contador_normal: 3,
    contador_pref: 2,
    contador_base_normal: 0,
    contador_base_pref: 0,
    data_ultima_emissao: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  },
  relatorio: [
    {
      id: 1,
      num: '001',
      guiche_id: 1,
      nome_guiche: 'Guichê 1',
      atendente: 'Atendente 1',
      preferencial: false,
      hora: new Date(Date.now() - 30 * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      data: new Date().toLocaleDateString('pt-BR'),
      criado_em: new Date(Date.now() - 30 * 60000).toISOString()
    }
  ],
  eventos: []
};

let nextId = 100;

// Query builder mock para modo fallback
function createMockQuery(tableName) {
  let action = 'select'; // 'select' | 'insert' | 'update' | 'delete'
  let insertData = null;
  let updateData = null;
  let filters = [];
  let sortOrders = [];
  let limitCount = null;
  let isSingle = false;
  let isHead = false;

  if (!memoryStore[tableName]) {
    memoryStore[tableName] = [];
  }

  const query = {
    select(fields, options) {
      if (action !== 'insert' && action !== 'update' && action !== 'delete') {
        action = 'select';
      }
      if (options?.head) isHead = true;
      return query;
    },
    insert(records) {
      action = 'insert';
      insertData = Array.isArray(records) ? records : [records];
      return query;
    },
    update(updates) {
      action = 'update';
      updateData = updates;
      return query;
    },
    delete() {
      action = 'delete';
      return query;
    },
    eq(col, val) {
      filters.push(item => {
        const itemVal = item[col];
        if (typeof val === 'boolean') {
          return Boolean(itemVal) === val;
        }
        return String(itemVal) === String(val);
      });
      return query;
    },
    neq(col, val) {
      filters.push(item => {
        const itemVal = item[col];
        if (typeof val === 'boolean') {
          return Boolean(itemVal) !== val;
        }
        return String(itemVal) !== String(val);
      });
      return query;
    },
    gte(col, val) {
      filters.push(item => item[col] >= val);
      return query;
    },
    lte(col, val) {
      filters.push(item => item[col] <= val);
      return query;
    },
    order(col, options = {}) {
      sortOrders.push({
        col,
        ascending: options.ascending !== false
      });
      return query;
    },
    limit(n) {
      limitCount = n;
      return query;
    },
    single() {
      isSingle = true;
      return query;
    },
    _execute() {
      if (action === 'insert') {
        const inserted = [];
        for (const rec of insertData || []) {
          const item = { id: rec.id || ++nextId, ...rec };
          memoryStore[tableName].push(item);
          inserted.push(item);
        }
        return { data: isSingle ? inserted[0] : inserted, error: null };
      }

      if (action === 'update') {
        let matched = memoryStore[tableName].filter(item => filters.every(f => f(item)));
        for (const item of matched) {
          Object.assign(item, updateData);
        }
        return {
          data: isSingle ? matched[0] : matched,
          error: null,
          select: () => query
        };
      }

      if (action === 'delete') {
        const matched = memoryStore[tableName].filter(item => filters.every(f => f(item)));
        const remaining = memoryStore[tableName].filter(item => !filters.every(f => f(item)));
        memoryStore[tableName] = remaining;
        return { data: matched, error: null };
      }

      // SELECT
      let res = [...memoryStore[tableName]];
      for (const f of filters) {
        res = res.filter(f);
      }

      if (sortOrders.length > 0) {
        res.sort((a, b) => {
          for (const { col, ascending } of sortOrders) {
            let va = a[col];
            let vb = b[col];
            if (va === vb) continue;
            if (va === null || va === undefined) return 1;
            if (vb === null || vb === undefined) return -1;
            if (typeof va === 'boolean' && typeof vb === 'boolean') {
              if (va === vb) continue;
              return ascending ? (va ? 1 : -1) : (va ? -1 : 1);
            }
            if (ascending) {
              if (va > vb) return 1;
              if (va < vb) return -1;
            } else {
              if (va < vb) return 1;
              if (va > vb) return -1;
            }
          }
          return 0;
        });
      }

      if (limitCount !== null) {
        res = res.slice(0, limitCount);
      }

      if (isHead) {
        return { count: res.length, data: null, error: null };
      }

      if (isSingle) {
        return { data: res[0] || null, error: res[0] ? null : { message: 'Not found' } };
      }

      return { data: res, count: res.length, error: null };
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(query._execute()).then(onFulfilled, onRejected);
    }
  };

  return query;
}

const mockSupabase = {
  from(tableName) {
    if (tableName === 'config' && !Array.isArray(memoryStore.config)) {
      return {
        select: () => ({
          eq: (col, val) => ({
            single: async () => ({ data: memoryStore.config, error: null })
          })
        }),
        update: (updates) => {
          Object.assign(memoryStore.config, updates);
          const res = { data: memoryStore.config, error: null };
          return {
            ...res,
            eq: () => ({
              ...res,
              then: (fn, err) => Promise.resolve(res).then(fn, err)
            }),
            then: (fn, err) => Promise.resolve(res).then(fn, err)
          };
        }
      };
    }
    return createMockQuery(tableName);
  },
  async rpc(fnName, args = {}) {
    if (fnName === 'incrementar_contador') {
      const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (memoryStore.config.data_ultima_emissao !== hoje) {
        memoryStore.config.contador_normal = 0;
        memoryStore.config.contador_pref = 0;
        memoryStore.config.contador_base_normal = 0;
        memoryStore.config.contador_base_pref = 0;
        memoryStore.config.data_ultima_emissao = hoje;
      }
      const campo = args.campo_nome;
      if (campo === 'contador_normal') {
        memoryStore.config.contador_normal = (memoryStore.config.contador_normal || 0) + 1;
        return { data: memoryStore.config.contador_normal, error: null };
      }
      if (campo === 'contador_pref') {
        memoryStore.config.contador_pref = (memoryStore.config.contador_pref || 0) + 1;
        return { data: memoryStore.config.contador_pref, error: null };
      }
    }
    return { data: 1, error: null };
  },
  auth: {
    async signInWithPassword({ email, password }) {
      const login = (email || '').replace('@sga.local', '').toLowerCase().trim();
      const user = memoryStore.usuarios.find(u => u.login.toLowerCase() === login);
      if (!user) {
        return { data: null, error: { message: 'Usuário não encontrado' } };
      }
      // Permite senhas padrão de forma flexível no modo de desenvolvimento/fallback
      const senhasValidas = [user.senha, 'admin', '123', '123456', 'coordenador', 'acolhimento', 'atendente'];
      if (!password || senhasValidas.includes(password) || user.senha === 'admin') {
        return {
          data: {
            user: { id: user.auth_id, email },
            session: { access_token: `mock-token-${user.auth_id}` }
          },
          error: null
        };
      }
      return { data: null, error: { message: 'Senha incorreta' } };
    },
    async getUser(token) {
      if (!token) return { data: { user: null }, error: { message: 'No token' } };
      const authId = token.replace('mock-token-', '');
      const user = memoryStore.usuarios.find(u => u.auth_id === authId) || memoryStore.usuarios[0];
      return {
        data: { user: { id: user.auth_id, email: `${user.login}@sga.local` } },
        error: null
      };
    },
    admin: {
      async createUser({ email, password }) {
        const id = `user-${Date.now()}`;
        return { data: { user: { id, email } }, error: null };
      },
      async deleteUser(authId) {
        return { data: true, error: null };
      }
    }
  }
};

let realSupabaseClient = null;
if (hasRealSupabase) {
  try {
    realSupabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    console.log('[Supabase] Conectado com sucesso ao Supabase remoto:', supabaseUrl);
  } catch (err) {
    console.warn('[Supabase] Falha ao inicializar cliente real, usando fallback:', err.message);
  }
}

// Cria proxy que direciona para cliente real quando disponível ou fallback
const supabase = realSupabaseClient || mockSupabase;

module.exports = {
  supabase,
  memoryStore,
  hasRealSupabase: Boolean(realSupabaseClient)
};
