# SGA Acolhimento — Sistema de Gerenciamento de Atendimento
### Prefeitura de Fortaleza — Regional 6

![Vercel](https://img.shields.io/badge/Vercel-Deploy-black?logo=vercel)
![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-yellow?logo=javascript)

---

## 📋 Sobre o projeto

Sistema de gerenciamento de filas de atendimento desenvolvido para o setor de **Acolhimento** da Secretaria Regional 6 da Prefeitura de Fortaleza. Permite emissão de senhas, chamada por guichê, monitor em tempo real e relatórios de atendimento.

---

## 🖥️ Telas do sistema

| Tela | Acesso | Descrição |
|---|---|---|
| 📺 Monitor | `/monitor` | Painel para TV da sala de espera |
| 🎫 Emissão | `/emissao` | Totem de retirada de senhas |
| 🔑 Login | `/login` | Acesso para atendentes e coordenador |
| 🖥️ Operador | `/operador` | Painel do atendente no guichê |
| 👔 Coordenador | `/coordenador` | Painel de gestão completo |

---

## ⚙️ Tecnologias

- **Frontend:** HTML, CSS e JavaScript puro (Vanilla)
- **Backend:** Vercel Serverless Functions (Node.js)
- **Banco de dados:** Supabase (PostgreSQL)
- **Tempo real:** Supabase Realtime
- **Impressão:** `window.print()` com CSS de impressão 80mm
- **Áudio:** Web Audio API + arquivos MP3

---

## 🚀 Funcionalidades

### Coordenador
- ✅ Direcionar senhas para guichês manualmente
- ✅ Resetar fila (volta para senha 001)
- ✅ Configurar numeração inicial das senhas
- ✅ Relatórios por período (hoje, semana, mês, personalizado)
- ✅ Exportar relatório em CSV e PDF
- ✅ Gerenciar usuários (atendentes)
- ✅ Gerenciar tipos de senha
- ✅ Renomear guichês

### Operador
- ✅ Selecionar guichê ao logar
- ✅ Visualizar senha atual
- ✅ Finalizar atendimento
- ✅ Histórico de chamadas do dia

### Monitor (TV)
- ✅ Exibição da senha chamada em tempo real
- ✅ Chamada por voz com arquivos MP3
- ✅ Vídeos em loop (Cloudinary)
- ✅ Relógio e data em tempo real
- ✅ Status dos guichês

### Totem de Emissão
- ✅ Senha Normal e Preferencial
- ✅ Impressão automática ao clicar
- ✅ Retorno automático para tela inicial após 5 segundos
- ✅ Compatível com impressoras térmicas 80mm

---

## 🏗️ Estrutura do projeto

```
SGA_SR6/
├── api/                    # Funções serverless (Vercel)
│   ├── _auth.js            # Middleware de autenticação
│   ├── admin.js            # Resetar fila, configurar contadores
│   ├── chamar.js           # Chamar próxima senha
│   ├── dados.js            # Relatórios, usuários, tipos de senha
│   ├── emitir.js           # Emissão de senhas
│   ├── env.js              # Variáveis de ambiente para o frontend
│   ├── estado.js           # Estado geral da fila
│   ├── guiche.js           # Registrar, liberar, finalizar guichê
│   ├── login.js            # Autenticação
│   └── noticias.js         # Feed RSS de notícias
├── lib/
│   ├── supabase.js         # Cliente Supabase (server-side)
│   └── horario.js          # Helper de fuso horário (UTC-3 Fortaleza)
├── public/
│   ├── css/
│   │   └── style.css       # Estilos globais
│   ├── img/
│   │   ├── logo-colorida.png
│   │   └── logo-branca.png
│   ├── js/
│   │   └── sga.js          # Cliente Supabase + Realtime (frontend)
│   ├── sons/               # Arquivos MP3 para chamada de voz
│   │   ├── bipe.mp3
│   │   ├── senha.mp3
│   │   ├── guiche.mp3
│   │   ├── preferencial.mp3
│   │   └── 0-9.mp3
│   ├── videos/             # Vídeos informativos (opcional)
│   ├── coordenador.html
│   ├── emissao.html
│   ├── login.html
│   ├── monitor.html
│   └── operador.html
├── vercel.json             # Configuração de rotas do Vercel
└── package.json
```

---

## 🛠️ Configuração e Deploy

### Pré-requisitos
- Conta no [Vercel](https://vercel.com)
- Conta no [Supabase](https://supabase.com)
- Node.js instalado localmente (para desenvolvimento)

### 1. Supabase — Criar o banco de dados

1. Crie um novo projeto no Supabase
2. Acesse **SQL Editor** e execute o arquivo `SUPABASE_SCHEMA.sql`
3. Vá em **Authentication → Users** e crie o usuário coordenador:
   - Email: `coordenador@sga.local`
   - Senha: (defina uma senha forte)
4. Execute no SQL Editor:
```sql
INSERT INTO public.usuarios (auth_id, nome, login, perfil)
SELECT id, 'Coordenador', 'coordenador', 'coordenador'
FROM auth.users WHERE email = 'coordenador@sga.local';
```
5. Vá em **Database → Replication** e ative a tabela `eventos`

### 2. Vercel — Deploy

1. Conecte este repositório ao Vercel
2. Adicione as variáveis de ambiente em **Settings → Environment Variables**:

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Chave `service_role` do Supabase |
| `SUPABASE_ANON_KEY` | Chave `anon public` do Supabase |

3. O deploy é feito automaticamente a cada push na branch `main`

### 3. Desenvolvimento local

```bash
# Instalar dependências
npm install

# Instalar Vercel CLI
npm install -g vercel

# Rodar localmente
vercel dev
```

---

## 🖨️ Impressora térmica

Compatível com qualquer impressora térmica 80mm configurada como impressora padrão no Windows:
- ✅ Bematech MP 4200TH
- ✅ Daruma DR800

A impressão ocorre automaticamente via `window.print()` ao clicar no tipo de senha.

---

## 🔐 Credenciais padrão

```
Login: coordenador
Senha: (definida no Supabase Auth)
```

⚠️ **Altere a senha padrão após o primeiro acesso.**

---

## 📊 Fluxo de atendimento

```
Cidadão chega
      ↓
Totem (/emissao) — escolhe Normal ou Preferencial
      ↓
Impressora imprime o cupom automaticamente
      ↓
Cidadão aguarda na sala
      ↓
Coordenador (/coordenador) — chama a próxima senha
      ↓
Monitor (/monitor) — exibe a senha + guichê + voz
      ↓
Atendente (/operador) — atende e finaliza
```

---

## 📁 Arquivos de som (pasta public/sons/)

Os arquivos MP3 devem estar na pasta `public/sons/` com os seguintes nomes:

| Arquivo | Conteúdo |
|---|---|
| `bipe.mp3` | Sinal sonoro de alerta |
| `senha.mp3` | Voz: "Senha" |
| `guiche.mp3` | Voz: "Guichê" |
| `preferencial.mp3` | Voz: "Atendimento preferencial" |
| `0.mp3` a `9.mp3` | Voz: "Zero" a "Nove" |

---

## 📝 Licença

Desenvolvido para uso interno da **Prefeitura de Fortaleza — Secretaria Regional 6**.

---

*Desenvolvido com ❤️ para melhorar o atendimento ao cidadão.*
