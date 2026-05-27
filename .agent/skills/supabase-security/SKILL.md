---
name: supabase-security
description: Segurança com Supabase Auth, RLS, variáveis VITE_* e OWASP no SPA. Use ao implementar auth, políticas ou integrações sensíveis.
---

# Skill: Segurança da Informação (Supabase SPA)

## Limite

Nenhuma checklist substitui pentest ou revisão legal. Objetivo: **reduzir risco** no stack real (cliente + RLS).

## Princípios não negociáveis

### Confiança zero no cliente

- Todo input de formulário é não confiável até validado.
- Autorização real: **RLS** no Postgres, não só UI escondida.
- `ProtectedRoute` + flags de perfil são camada UX, não substituto de RLS.

### Chaves e segredos

| Variável | Onde |
|----------|------|
| `VITE_SUPABASE_URL` | Cliente (ok) |
| `VITE_SUPABASE_ANON_KEY` | Cliente (ok com RLS) |
| `service_role` | **Nunca** no frontend |
| API keys (Gemini, etc.) | Edge Function / backend — não `VITE_*` sem análise |

### Sessão

- Supabase Auth persiste sessão via SDK — não duplicar tokens em cache custom.
- `signOut` limpa estado em `AuthContext`.

## OWASP → âncoras neste projeto

| Categoria | Âncora |
|-----------|--------|
| Broken Access Control | RLS `auth.uid() = user_id`; políticas consultoria |
| Security Misconfiguration | RLS habilitado; env no Vercel |
| Injection | Queries parametrizadas do SDK; SQL só em migrations |
| Sensitive Data Exposure | `.select()` explícito; cache mínimo |
| XSS | React escapa por padrão; cuidado com `dangerouslySetInnerHTML` |

## Checklist rápido

- [ ] Nova tabela tem RLS e políticas para CRUD?
- [ ] Hook filtra por usuário autenticado?
- [ ] Resposta não inclui campos admin desnecessários?
- [ ] Chave secreta fora do bundle?

## Referências

- `.cursor/rules/06-security-supabase.mdc`
- `.cursor/rules/11-supabase-select-sanitization.mdc`
