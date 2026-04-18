-- ============================================================
-- Execute este SQL completo no Supabase SQL Editor
-- Corrige permissões e verifica o coordenador
-- ============================================================

-- 1. Verificar o que está nas tabelas
SELECT 'AUTH USERS:' as tabela, id::text, email as info FROM auth.users WHERE email = 'coordenador@sga.local'
UNION ALL
SELECT 'USUARIOS:', id::text, login || ' | perfil: ' || perfil FROM public.usuarios;

-- 2. Garantir que o service_role pode ler a tabela usuarios sem RLS
-- (o backend usa service_role que bypassa RLS, mas vamos confirmar)
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;

-- 3. Se o coordenador não aparecer na tabela usuarios, insere automaticamente
INSERT INTO public.usuarios (auth_id, nome, login, perfil)
SELECT id, 'Coordenador', 'coordenador', 'coordenador'
FROM auth.users
WHERE email = 'coordenador@sga.local'
ON CONFLICT (login) DO UPDATE SET perfil = 'coordenador';

-- 4. Confirma resultado final
SELECT id, nome, login, perfil FROM public.usuarios;
