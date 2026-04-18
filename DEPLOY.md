# SGA Acolhimento Online — Guia de Deploy
## Vercel + Supabase

---

## VISÃO GERAL

```
Usuário (navegador)
        │
        ▼
    Vercel (API Routes + HTML estático)
        │
        ▼
    Supabase (PostgreSQL + Auth + Realtime)
```

---

## PASSO 1 — Supabase: criar o banco de dados

1. Acesse https://supabase.com e faça login
2. Clique em **New Project**
3. Escolha um nome (ex: `sga-acolhimento`) e uma senha forte
4. Aguarde o projeto ser criado (~2 minutos)

### 1.1 Executar o Schema

1. No painel do Supabase, clique em **SQL Editor** (menu lateral)
2. Clique em **New query**
3. Cole TODO o conteúdo do arquivo `SUPABASE_SCHEMA.sql`
4. Clique em **Run** (ou Ctrl+Enter)
5. Verifique se aparece "Success" em verde

### 1.2 Ativar Realtime na tabela eventos

1. Vá em **Database → Replication** no menu lateral
2. Encontre a tabela `eventos`
3. Ative o toggle ao lado dela
4. Isso já foi feito pelo SQL, mas confirme que está ativado

### 1.3 Criar o usuário Coordenador

1. Vá em **Authentication → Users** no menu lateral
2. Clique em **Add user → Create new user**
3. Email: `coordenador@sga.local`
4. Password: (escolha uma senha forte)
5. Marque **Auto Confirm User**
6. Clique em **Create User**
7. Copie o **UUID** que aparece na lista de usuários

8. Volte no **SQL Editor** e execute:
```sql
insert into public.usuarios (auth_id, nome, login, perfil)
values ('COLE_O_UUID_AQUI', 'Coordenador', 'coordenador', 'coordenador');
```

### 1.4 Copiar as chaves do Supabase

1. Vá em **Settings → API** no menu lateral
2. Copie e salve (vai precisar no Passo 3):
   - **Project URL** → ex: `https://xyzxyz.supabase.co`
   - **anon public** → chave longa começando com `eyJ...`
   - **service_role** → chave longa (NUNCA exponha esta publicamente)

---

## PASSO 2 — Preparar o projeto para o Vercel

### 2.1 Instalar o Node.js e o Vercel CLI

Se ainda não tiver o Node.js instalado:
- Baixe em https://nodejs.org (versão LTS)

Instale o Vercel CLI:
```
npm install -g vercel
```

### 2.2 Adicionar a logo

Coloque o arquivo da logo em:
```
sga-online/
  public/
    img/
      logo.png   ← copie a logo aqui
```

### 2.3 Instalar dependências

Abra o terminal (Prompt de Comando) na pasta `sga-online`:
```
cd sga-online
npm install
```

---

## PASSO 3 — Deploy no Vercel

### 3.1 Fazer login no Vercel

```
vercel login
```
Escolha **Continue with Email** e siga as instruções.

### 3.2 Configurar as variáveis de ambiente

```
vercel env add SUPABASE_URL
```
→ Cole o **Project URL** do Supabase

```
vercel env add SUPABASE_SERVICE_KEY
```
→ Cole a chave **service_role**

```
vercel env add SUPABASE_ANON_KEY
```
→ Cole a chave **anon public**

Quando perguntar o ambiente, selecione: **Production, Preview, Development**

### 3.3 Fazer o deploy

```
vercel --prod
```

Aguarde o deploy terminar. Ao final aparecerá a URL do seu sistema, algo como:
```
✅ Production: https://sga-acolhimento.vercel.app
```

---

## PASSO 4 — Acessar o sistema

| Tela | Endereço |
|------|----------|
| 📺 Monitor | `https://seu-app.vercel.app/monitor` |
| 🎫 Emissão | `https://seu-app.vercel.app/emissao` |
| 🔑 Login   | `https://seu-app.vercel.app/login`   |
| 👔 Coordenador | após login com coordenador |
| 🖥️ Operador | após login com atendente |

**Login padrão do coordenador:**
```
Login: coordenador
Senha: (a que você definiu no passo 1.3)
```

---

## PASSO 5 — Criar atendentes

1. Acesse o sistema como Coordenador
2. Vá na aba **Usuários**
3. Clique em **+ Novo usuário**
4. Preencha nome, login, senha e perfil **Atendente**

---

## ATUALIZAÇÕES FUTURAS

Para atualizar o sistema após modificar os arquivos:
```
cd sga-online
vercel --prod
```
Leva menos de 1 minuto para entrar no ar.

---

## DOMÍNIO PERSONALIZADO (opcional)

Para usar um endereço próprio (ex: `sga.prefeitura.com.br`):
1. No painel do Vercel, vá em **Settings → Domains**
2. Clique em **Add Domain**
3. Siga as instruções para apontar o DNS

---

## RESOLUÇÃO DE PROBLEMAS

**"Erro ao conectar ao banco"**
→ Verifique se as variáveis de ambiente estão corretas no Vercel
→ Vá em Vercel → Settings → Environment Variables

**"Login incorreto"**
→ Confirme que o usuário foi criado no Supabase Auth E na tabela `usuarios`

**"Monitor não atualiza em tempo real"**
→ Confirme que Realtime está ativado na tabela `eventos` no Supabase

**Ver logs de erro:**
```
vercel logs https://seu-app.vercel.app
```
