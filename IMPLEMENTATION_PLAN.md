# 🎯 PLANO DE STANDARDIZAÇÃO FRONTEND

## Visão Geral

Este documento define o plano detalhado para standardizar o frontend da aplicação financeira, garantindo coesão, coerência e estética replicável.

**Objetivo Final**: Um sistema visual consistente onde:
- ✅ Todos os botões seguem o mesmo padrão com responsividade ao tema
- ✅ Efeitos de hover/click minimalistas e padronizados
- ✅ Cores de categorias responsivas à paleta selecionada
- ✅ Transições suaves e timing consistente
- ✅ Acessibilidade mantida

---

## FASE 1: FUNDAÇÃO DO SISTEMA DE CORES

### 1.1 Atualizar `categoryColors.ts`

**Mudança 1: Corrigir ColorPalette Type**
```typescript
// ANTES
export type ColorPalette = 'vivid' | 'pastel' | 'earth' | 'ocean' | 'sunset'

// DEPOIS
export type ColorPalette = 'vivid' | 'pastel' | 'ocean'
```

**Mudança 2: Expandir para 20 cores por paleta com harmonia visual**

Paleta **Vivid** (energética, alta saturação):
```
Primary shades (reds): #ef4444, #f87171, #fca5a5
Secondary shades (oranges): #f97316, #fb923c, #fbcfe8
Tertiary (yellows): #f59e0b, #fbbf24, #fce7f3
Greens: #22c55e, #86efac, #dcfce7
Cyans: #06b6d4, #67e8f9, #cffafe
Blues: #3b82f6, #93c5fd, #dbeafe
Purples: #8b5cf6, #d8b4fe, #f3e8ff
Pinks: #d946ef, #f0abfc, #fce7f3
Grays: #6b7280, #9ca3af, #d1d5db
Dark: #374151, #1f2937, #111827
```

Paleta **Pastel** (suave, verde como principal):
```
Emerald shades: #047857, #10b981, #6ee7b7
Lime shades: #7c3aed, #a78bfa, #ddd6fe
Teal shades: #14b8a6, #2dd4bf, #ccfbf1
Sky shades: #0284c7, #0ea5e9, #bae6fd
Green shades: #15803d, #4ade80, #bbf7d0
Cyan shades: #0891b2, #06b6d4, #a5f3fc
Purple shades: #6d28d9, #a855f7, #e9d5ff
Blue shades: #1e40af, #3b82f6, #bfdbfe
Rose shades: #be185d, #ec4899, #fbcfe8
Neutral: #4b5563, #9ca3af, #e5e7eb
```

Paleta **Ocean** (fria, blues dominantes):
```
Navy shades: #082f49, #0c4a6e, #1e3a8a
Blue-slate: #0369a1, #0284c7, #0ea5e9
Cyan shades: #06b6d4, #14b8a6, #2dd4bf
Sky shades: #bfdbfe, #93c5fd, #60a5fa
Teal shades: #0891b2, #164e63, #164e63
Indigo: #1e1b4b, #312e81, #3730a3
Emerald: #047857, #059669, #10b981
Water: #67e8f9, #a5f3fc, #cffafe
Gray-blue: #475569, #64748b, #cbd5e1
Dark: #1e293b, #0f172a, #020617
```

**Mudança 3: Atualizar getCategoryColor() e getCategoryColorForPalette()**

```typescript
export function getCategoryColor(
  categoryIndex: number,
  palette: ColorPalette
): string {
  const colors = categoryColorPalettes[palette]
  return colors[categoryIndex % colors.length]
}

export function getCategoryColorForPalette(
  originalColor: string,
  targetPalette: ColorPalette
): string {
  // Buscar em qual índice a cor original está na paleta vivid
  const vividColors = categoryColorPalettes.vivid
  const index = vividColors.findIndex(c => c.toLowerCase() === originalColor.toLowerCase())
  
  // Se encontrou, mapear para a paleta alvo no mesmo índice
  if (index !== -1) {
    return categoryColorPalettes[targetPalette][index % categoryColorPalettes[targetPalette].length]
  }
  
  // Fallback: retornar a cor original (para categorias com cor customizada)
  return originalColor
}
```

---

### 1.2 Atualizar `ThemeContext.tsx`

**Adicionar CSS Variables Extras**:

```typescript
// Adicionar ao objeto themes[newTheme]
'--color-hover': (lighter version of bg-secondary),
'--color-focus': (stronger color for focus rings),
'--color-disabled': (grayed out),
'--color-active': (darker/highlighted),
'--transition-fast': '200ms',
'--transition-normal': '300ms',
```

**Exemplo para mono-dark**:
```typescript
'mono-dark': {
  // ... cores existentes
  '--color-hover': '#2a2a2a',
  '--color-focus': '#505050',
  '--color-disabled': '#5a5a5a',
  '--color-active': '#0f0f0f',
  '--transition-fast': '200ms',
  '--transition-normal': '300ms',
}
```

---

## FASE 2: COMPONENTES BASE

### 2.1 Novo `IconButton.tsx`

Componente especializado para ícones (edit, delete, close).

```typescript
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'neutral' | 'danger' | 'success'
  label?: string
}

export default function IconButton({
  icon,
  size = 'md',
  variant = 'neutral',
  label,
  className = '',
  ...props
}: IconButtonProps) {
  // Implementar com hover/active states minimalistas
  // Usar CSS variables para cores
  // Accessibilidade: aria-label={label}
}
```

**Características**:
- Hover: Background subtle (usando --color-hover)
- Active: Scale 0.95 (feedback tátil)
- Focus: Ring 2 (usando --color-focus)
- Transição: 200ms
- Variante danger usa --color-danger
- Sem padding excessivo (2px padding)

### 2.2 Atualizar `Button.tsx`

**Melhorias**:

1. **Remover cores hardcoded**:
   - ❌ `bg-secondary` → ✅ `bg-[var(--color-hover)]`
   - ❌ `focus:ring-accent-primary` → ✅ `focus:ring-[var(--color-focus)]`

2. **Adicionar Hover Effects**:
   ```
   primary: hover:scale-[1.02] hover:shadow-md
   outline: hover:bg-[var(--color-hover)] hover:border-[var(--color-focus)]
   danger: hover:scale-[1.02] hover:shadow-md
   ```

3. **Adicionar Active State**:
   ```
   active:scale-[0.98] active:shadow-sm
   ```

4. **Melhorar Transições**:
   ```
   transition-all duration-[var(--transition-fast)]
   ```

5. **Criar variante Ghost**:
   ```
   ghost: 'text-primary hover:bg-[var(--color-hover)]'
   ```

**Componente Atualizado**:
```typescript
// Implementação focada em:
// - Responsividade ao tema via CSS variables
// - Efeitos minimalistas (scale, shadow)
// - Timing consistente (200ms)
// - Acessibilidade melhorada
```

### 2.3 Atualizar `Input.tsx` e `Select.tsx`

**Mudanças Comuns**:

1. **Remover cores hardcoded**:
   - `bg-primary` → `bg-[var(--color-bg-primary)]`
   - `border-primary` → `border-[var(--color-border)]`
   - `placeholder-secondary` → `placeholder-[var(--color-text-secondary)]`

2. **Adicionar Hover Effect**:
   ```
   hover:border-[var(--color-focus)] hover:shadow-sm
   ```

3. **Melhorar Focus**:
   ```
   focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-opacity-50
   ```

4. **Disabled State**:
   ```
   disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--color-disabled)]
   ```

### 2.4 Atualizar `Modal.tsx`

**Adicionar Animação**:

```typescript
// Animação de entrada: scale + fade
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 }
}

// Usando transition:
// initial: hidden
// animate: visible (quando isOpen true)
// exit: hidden (quando isOpen false)
// transition: { duration: 0.3 }
```

### 2.5 Atualizar `Card.tsx`

**Adicionar Scale Transform**:

```typescript
// Clickable cards:
// hover:scale-[1.02] transition-all duration-200
// shadow-sm hover:shadow-md
```

---

## FASE 3: PÁGINAS

### 3.1 `Expenses.tsx`

**Mudanças Críticas**:

1. **Remover COLORS array** - substituir por:
   ```typescript
   import { categoryColorPalettes } from '@/utils/categoryColors'
   
   // Ao criar categoria:
   const randomIndex = Math.floor(Math.random() * 20)
   const randomColor = categoryColorPalettes.vivid[randomIndex]
   ```

2. **Ao gerar cor aleatória**: garantir que seja do índice, não da cor em si

3. **Usar getCategoryColorForPalette()** em renders

4. **Padronizar Edit/Delete buttons**: usar IconButton

5. **Adicionar hover effects aos inputs do modal**

### 3.2 `Incomes.tsx`

**Mesmas mudanças que Expenses.tsx**

### 3.3 `Categories.tsx`

**Mudanças**:

1. **Remover COLORS array**

2. **Seletor de cor**: mostrar as 20 cores da paleta vivid (como base)
   - Quando paleta mudar, as cores no seletor devem refletir na visualização
   - Mas a cor salva continua sendo do índice

3. **Replace Edit/Delete buttons com IconButton**

4. **Adicionar hover effects**

### 3.4 `IncomeCategories.tsx`

**Mesmas mudanças que Categories.tsx**

### 3.5 `Reports.tsx`

**Mudanças**:

1. **Atualizar imports**: remover tipos desatualizado de ColorPalette

2. **Verificar todos os getCategoryColorForPalette()** - devem estar corretos

3. **Adicionar hover effects nos charts**

### 3.6 `Dashboard.tsx`, `Investments.tsx`

**Verificação**:

1. Remover hardcoded colors
2. Usar CSS variables
3. Adicionar hover effects onde apropriado

---

## FASE 4: ESTILOS GLOBAIS

### 4.1 Atualizar `index.css`

**Adicionar Keyframes**:

```css
@keyframes subtle-pulse {
  0%, 100% { opacity: 1 }
  50% { opacity: 0.8 }
}

@keyframes ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}
```

**Adicionar Utilities Customizadas**:

```css
.btn-hover-effect {
  @apply transition-all duration-200;
}

.card-hover {
  @apply hover:shadow-md hover:scale-[1.02] transition-all duration-200;
}

.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2;
}
```

---

## CHECKLIST DE IMPLEMENTAÇÃO

### ✅ Preparação
- [ ] Revisar análise completa (FRONTEND_ANALYSIS.md)
- [ ] Entender CSS variables atuais
- [ ] Familiarizar com Tailwind CSS customização

### 📝 Implementação Ordem Recomendada

#### Fase 1 (Colors) - 1-2 horas
- [ ] Atualizar categoryColors.ts (tipo + 20 cores)
- [ ] Testar com diferentes paletas
- [ ] Build check

#### Fase 2 (Components) - 2-3 horas
- [ ] Criar IconButton.tsx
- [ ] Atualizar Button.tsx (hover, active, colors)
- [ ] Atualizar Input.tsx (hover, colors)
- [ ] Atualizar Select.tsx (hover, colors)
- [ ] Atualizar Modal.tsx (animação)
- [ ] Atualizar Card.tsx (scale)
- [ ] Build check

#### Fase 3 (Pages) - 2-3 horas
- [ ] Expenses.tsx (remover COLORS, usar IconButton, hover)
- [ ] Incomes.tsx (mesmas mudanças)
- [ ] Categories.tsx (COLORS, IconButton, seletor)
- [ ] IncomeCategories.tsx (mesmas mudanças)
- [ ] Reports.tsx (verificar colors)
- [ ] Dashboard.tsx (verificar)
- [ ] Investments.tsx (verificar)
- [ ] Build check

#### Fase 4 (Globals) - 30 min
- [ ] Adicionar keyframes em index.css
- [ ] Adicionar utilities customizadas
- [ ] Build final

### ✔️ Testes
- [ ] Light theme - verificar contraste
- [ ] Dark theme - verificar contraste
- [ ] Vivid palette - cores vibrantes
- [ ] Pastel palette - cores suaves
- [ ] Ocean palette - cores frias
- [ ] Hover effects - smooth em desktop
- [ ] Mobile - sem hover, funcionalidade OK
- [ ] Keyboard navigation - focus rings visíveis
- [ ] Testes de acessibilidade

### 🚀 Deploy
- [ ] Build final sem erros
- [ ] Verificação visual completa
- [ ] Commit com mensagens descritivas

---

## PADRÕES A MANTER

### Minimalismo
- ❌ Sem animações excessivas
- ❌ Sem efeitos de brilho/glow
- ✅ Subtle transitions (200ms)
- ✅ Simple hover states (opacity, scale, shadow)

### Coesão
- ✅ Mesmo timing (200ms para rápido, 300ms para complexo)
- ✅ Mesma paleta de cores (nunca hardcoded)
- ✅ Padrão consistent (buttons parecem buttons)

### Responsividade
- ✅ Sempre usar CSS variables
- ✅ Nunca hardcoded colors (exceto em casos específicos)
- ✅ Testar light + dark
- ✅ Testar 3 paletas

---

## RISCOS E MITIGAÇÕES

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Quebrar funcionalidade | Alto | Fazer branch, build frequently |
| Colors não responsivos | Alto | Testar com 3 paletas |
| Performance | Médio | Usar CSS variables (native) |
| Acessibilidade | Médio | Testar keyboard + screen reader |
| Mobile UX | Médio | Remover hover em touch devices |

---

## PRÓXIMOS PASSOS

1. ✅ **Análise Completa** - FEITO (FRONTEND_ANALYSIS.md)
2. 🎯 **Revisar Plano** - Validar com requisitos
3. 🏗️ **Implementar Fase 1** - Colors system
4. 🎨 **Implementar Fase 2** - Components
5. 📄 **Implementar Fase 3** - Pages
6. 🌍 **Implementar Fase 4** - Globals
7. ✅ **Testar Completo** - Todas as combinações
8. 🚀 **Deploy** - Build final

---

## ESTIMATIVA FINAL

| Tarefa | Tempo | Status |
|--------|-------|--------|
| Fase 1 | 1-2h | Pendente |
| Fase 2 | 2-3h | Pendente |
| Fase 3 | 2-3h | Pendente |
| Fase 4 | 0.5-1h | Pendente |
| Testes | 1-2h | Pendente |
| **Total** | **7-12h** | |

**Tipo de Trabalho**: Refatoração Visual + UX Polish
**Complexidade**: Média (muitos arquivos, mas mudanças simples)
**Risco**: Baixo (sem lógica de negócio)

---

**Data**: Janeiro 2025
**Status**: Pronto para Implementação
**Aprovado por**: [Aguardando confirmação do usuário]
