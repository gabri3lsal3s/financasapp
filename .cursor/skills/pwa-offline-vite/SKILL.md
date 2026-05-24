---
name: pwa-offline-vite
description: Configuração PWA com vite-plugin-pwa, manifest e UX offline. Use ao alterar SW, manifest ou comportamento instalável.
---

# Skill: PWA + Offline (Vite)

## Escopo e gatilhos

- `vite.config.ts` (`VitePWA`)
- `public/manifest.json`, ícones em `public/`
- `src/components/PwaUpdatePrompt.tsx`
- `src/components/OfflineSyncManager.tsx`, `NetworkStatusToast.tsx`

## Configuração Vite

```ts
VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  manifest: false, // manifest estático em public/manifest.json
  includeAssets: ['pwa-192x192.svg', 'pwa-512x512.svg', 'apple-touch-icon.svg'],
  workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'], ... },
  devOptions: { enabled: true },
})
```

## Manifest (`public/manifest.json`)

- `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `lang: "pt-BR"`.
- Ícones 192 e 512; `purpose: "any maskable"` no maior.
- Shortcuts para `/expenses`, `/incomes`, `/investments`.

## Offline-first (resumo)

1. Leitura: `offlineCache` + hooks.
2. Escrita sem rede: `offlineQueue` + IDs `offline-*`.
3. Sync no evento `online`.
4. Conflitos: `ConflictResolutionModal`.

## Mobile-first

- `safe-area-top` no header.
- CTAs com `min-h-12` em ações principais.
- Orientação `portrait` no manifest — respeitar em layouts densos.

## Anti-padrões

- Assumir que mutação POST é cacheada pelo Workbox (não cachear mutações Supabase).
- Desabilitar PWA em prod sem motivo.
- Ignorar prompt de atualização quando `registerType: 'autoUpdate'`.

## Referências

- `.cursor/rules/12-pwa-offline-first.mdc`
- `docs/ARCHITECTURE.md` (seção offline)
