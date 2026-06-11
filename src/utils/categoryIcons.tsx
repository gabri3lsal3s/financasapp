import React from 'react'
import { 
  Utensils, Car, Heart, Home, GraduationCap, Smile, ShoppingBag, 
  TrendingUp, Landmark, Award, Tag, Briefcase, Coffee, DollarSign,
  Gift, Percent, PiggyBank, Settings, Shield, ShoppingCart, User
} from 'lucide-react'

// Array de ícones disponíveis para facilitar a renderização no seletor da UI
export const AVAILABLE_ICONS = {
  Utensils: Utensils,
  Car: Car,
  Heart: Heart,
  Home: Home,
  GraduationCap: GraduationCap,
  Smile: Smile,
  ShoppingBag: ShoppingBag,
  TrendingUp: TrendingUp,
  Landmark: Landmark,
  Award: Award,
  Tag: Tag,
  Briefcase: Briefcase,
  Coffee: Coffee,
  DollarSign: DollarSign,
  Gift: Gift,
  Percent: Percent,
  PiggyBank: PiggyBank,
  Settings: Settings,
  Shield: Shield,
  ShoppingCart: ShoppingCart,
  User: User,
}

export function getCategoryIconName(name: string): string {
  const normalized = name.toLowerCase().trim()
  
  if (
    normalized.includes('aliment') || 
    normalized.includes('comer') || 
    normalized.includes('restaurante') || 
    normalized.includes('supermercado') || 
    normalized.includes('mercado') ||
    normalized.includes('padaria') ||
    normalized.includes('pizza') ||
    normalized.includes('lanche') ||
    normalized.includes('hamburguer') ||
    normalized.includes('bebida')
  ) {
    return 'Utensils'
  }
  
  if (
    normalized.includes('transp') || 
    normalized.includes('carro') || 
    normalized.includes('combustivel') || 
    normalized.includes('gasolina') || 
    normalized.includes('uber') || 
    normalized.includes('moto') || 
    normalized.includes('viagem') ||
    normalized.includes('taxi') ||
    normalized.includes('pedagio') ||
    normalized.includes('passagem') ||
    normalized.includes('oficina')
  ) {
    return 'Car'
  }
  
  if (
    normalized.includes('saude') || 
    normalized.includes('medico') || 
    normalized.includes('remedio') || 
    normalized.includes('farmacia') || 
    normalized.includes('hospital') || 
    normalized.includes('odonto') ||
    normalized.includes('dentista') ||
    normalized.includes('clinica') ||
    normalized.includes('exame') ||
    normalized.includes('terapia')
  ) {
    return 'Heart'
  }
  
  if (
    normalized.includes('morad') || 
    normalized.includes('casa') || 
    normalized.includes('aluguel') || 
    normalized.includes('condominio') || 
    normalized.includes('luz') || 
    normalized.includes('agua') || 
    normalized.includes('internet') || 
    normalized.includes('tel') ||
    normalized.includes('energia') ||
    normalized.includes('gas') ||
    normalized.includes('iptu') ||
    normalized.includes('reforma') ||
    normalized.includes('decor')
  ) {
    return 'Home'
  }
  
  if (
    normalized.includes('educa') || 
    normalized.includes('escola') || 
    normalized.includes('faculdade') || 
    normalized.includes('curso') || 
    normalized.includes('livro') || 
    normalized.includes('estudo') ||
    normalized.includes('mensalidade') ||
    normalized.includes('material escolar')
  ) {
    return 'GraduationCap'
  }
  
  if (
    normalized.includes('lazer') || 
    normalized.includes('cinema') || 
    normalized.includes('show') || 
    normalized.includes('festa') || 
    normalized.includes('bar') || 
    normalized.includes('pub') ||
    normalized.includes('hotel') ||
    normalized.includes('hospedagem') ||
    normalized.includes('clube') ||
    normalized.includes('game') ||
    normalized.includes('jogo') ||
    normalized.includes('stream') ||
    normalized.includes('netflix') ||
    normalized.includes('spotify') ||
    normalized.includes('academia') ||
    normalized.includes('esporte')
  ) {
    return 'Smile'
  }
  
  if (
    normalized.includes('compras') || 
    normalized.includes('vestuario') || 
    normalized.includes('roupa') || 
    normalized.includes('eletronico') || 
    normalized.includes('shopee') || 
    normalized.includes('amazon') ||
    normalized.includes('mercado livre') ||
    normalized.includes('shopping') ||
    normalized.includes('calcado') ||
    normalized.includes('acessorio') ||
    normalized.includes('presente')
  ) {
    return 'ShoppingBag'
  }
  
  if (
    normalized.includes('salario') || 
    normalized.includes('renda') || 
    normalized.includes('provento') || 
    normalized.includes('receita') || 
    normalized.includes('trabalho') ||
    normalized.includes('job') ||
    normalized.includes('freelancer') ||
    normalized.includes('faturamento') ||
    normalized.includes('comissao') ||
    normalized.includes('dividendos') ||
    normalized.includes('rendimento')
  ) {
    return 'TrendingUp'
  }
  
  if (
    normalized.includes('invest') || 
    normalized.includes('acao') || 
    normalized.includes('fundo') || 
    normalized.includes('poupanca') || 
    normalized.includes('aplicacao') ||
    normalized.includes('tesouro') ||
    normalized.includes('bolsa') ||
    normalized.includes('cripto') ||
    normalized.includes('banco')
  ) {
    return 'Landmark'
  }
  
  if (
    normalized.includes('premio') || 
    normalized.includes('bonus') || 
    normalized.includes('presente') ||
    normalized.includes('sorteio') ||
    normalized.includes('heranca')
  ) {
    return 'Award'
  }
  
  return 'Tag'
}

export function getCategoryIcon(name: string, size = 12, iconName?: string): React.ReactNode {
  const resolvedName = iconName || getCategoryIconName(name)
  
  const IconComponent = AVAILABLE_ICONS[resolvedName as keyof typeof AVAILABLE_ICONS] || Tag
  return <IconComponent size={size} />
}
