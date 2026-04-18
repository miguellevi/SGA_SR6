-- ============================================================
-- PASSO 1: Verificar se o coordenador está na tabela usuarios
-- Execute esta query primeiro:
-- ============================================================
SELECT u.id, u.nome, u.login, u.perfil, u.auth_id, au.email
FROM public.usuarios u
JOIN auth.users au ON au.id = u.auth_id;

-- Se a query acima retornar vazio, execute o PASSO 2.
-- Se retornar o coordenador mas com perfil 'atendente', execute o PASSO 3.

-- ============================================================
-- PASSO 2: Descobrir o UUID do usuário no Auth e fazer o INSERT
-- ============================================================

-- 2a. Primeiro veja o UUID do usuário criado:
SELECT id, email FROM auth.users WHERE email = 'coordenador@sga.local';

-- 2b. Copie o UUID retornado e substitua abaixo:
INSERT INTO public.usuarios (auth_id, nome, login, perfil)
SELECT id, 'Coordenador', 'coordenador', 'coordenador'
FROM auth.users
WHERE email = 'coordenador@sga.local'
ON CONFLICT DO NOTHING;

-- ============================================================
-- PASSO 3: Corrigir perfil se estiver como 'atendente'
-- ============================================================
UPDATE public.usuarios
SET perfil = 'coordenador'
WHERE login = 'coordenador';

-- ============================================================
-- VERIFICAÇÃO FINAL: confirme que ficou correto
-- ============================================================
SELECT id, nome, login, perfil FROM public.usuarios;
