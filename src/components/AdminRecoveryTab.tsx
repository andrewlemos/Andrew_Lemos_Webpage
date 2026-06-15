import React, { useState, useEffect } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc,
  doc,
  auth,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { EcomAbandonedCart, EcomCoupon } from '../types';
import { 
  ShoppingBag, 
  TrendingUp, 
  Coins, 
  Percent, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Play, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown,
  Gift
} from 'lucide-react';

export default function AdminRecoveryTab() {
  const [carts, setCarts] = useState<EcomAbandonedCart[]>([]);
  const [coupons, setCoupons] = useState<EcomCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'Ativo' | 'Abandonado' | 'Recuperado' | 'Expirado'>('all');
  
  // Triggers feedback state
  const [cronRunning, setCronRunning] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Subscribe to live Firestore updates
  useEffect(() => {
    let unsubscribeCarts: (() => void) | null = null;
    let unsubscribeCoupons: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      // Clean up previous listeners if auth state changes
      if (unsubscribeCarts) {
        unsubscribeCarts();
        unsubscribeCarts = null;
      }
      if (unsubscribeCoupons) {
        unsubscribeCoupons();
        unsubscribeCoupons = null;
      }

      if (!user || user.email !== 'andrewfmlemos@gmail.com') {
        setLoading(false);
        return;
      }

      const cartsQuery = query(collection(db, 'ecom_abandoned_carts'), orderBy('lastActive', 'desc'));
      unsubscribeCarts = onSnapshot(cartsQuery, (snapshot) => {
        const cartsData: EcomAbandonedCart[] = [];
        snapshot.forEach((doc) => {
          cartsData.push({ id: doc.id, ...doc.data() } as EcomAbandonedCart);
        });
        setCarts(cartsData);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'ecom_abandoned_carts');
        setLoading(false);
      });

      const couponsQuery = query(collection(db, 'ecom_coupons'));
      unsubscribeCoupons = onSnapshot(couponsQuery, (snapshot) => {
        const couponsData: EcomCoupon[] = [];
        snapshot.forEach((doc) => {
          couponsData.push({ id: doc.id, ...doc.data() } as EcomCoupon);
        });
        setCoupons(couponsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'ecom_coupons');
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCarts) unsubscribeCarts();
      if (unsubscribeCoupons) unsubscribeCoupons();
    };
  }, []);

  // KPIs Calculations
  const totalCarts = carts.length;
  // Carts are abandoned if they have at least one product, customer contact info, and status is "Abandonado" or "Expirado" or "Recuperado"
  const abandonedList = carts.filter(c => c.status !== 'Ativo');
  const totalAbandoned = abandonedList.length;
  const totalRecovered = carts.filter(c => c.status === 'Recuperado').length;
  
  const recoveredValue = carts
    .filter(c => c.status === 'Recuperado')
    .reduce((sum, c) => sum + (c.total || 0), 0);

  const conversionRate = totalAbandoned > 0 
    ? (totalRecovered / totalAbandoned) * 100 
    : 0;

  const couponsGenerated = coupons.length;
  const couponsUsed = coupons.filter(cp => cp.used).length;
  const couponsUsageRate = couponsGenerated > 0 
    ? (couponsUsed / couponsGenerated) * 100 
    : 0;

  // Filter & Search carts
  const filteredCarts = carts.filter(c => {
    const matchesSearch = 
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customerPhone.includes(searchQuery);
    
    const matchesStatus = activeFilter === 'all' || c.status === activeFilter;
    return matchesSearch && matchesStatus;
  });

  // Execute manual recovery email trigger
  const handleManualSend = async (cartId: string, step: 'msg_24h' | 'msg_48h' | 'msg_72h') => {
    const actionId = `${cartId}-${step}`;
    setActionLoading(actionId);
    try {
      const response = await fetch('/api/vendas/abandoned-carts/manual-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId, step })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao disparar e-mail.");
      }
      
      alert(data.message || "E-mail enviado com sucesso!");
    } catch (err: any) {
      alert(`Falha no envio do e-mail: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Run database sweep (Cron execution simulation)
  const triggerCartsSweep = async () => {
    setCronRunning(true);
    setCronResult(null);
    try {
      const response = await fetch('/api/vendas/abandoned-carts/cron', {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setCronResult(`Varredura concluída. Carrinhos processados na rotina: ${data.processedCount}`);
      } else {
        setCronResult(`Falha na varredura: ${data.error}`);
      }
    } catch (err: any) {
      setCronResult(`Erro de rede: ${err.message}`);
    } finally {
      setCronRunning(false);
      setTimeout(() => setCronResult(null), 8000);
    }
  };

  // Helper helper to clean up Brazilian telephone strings and assemble a quick wa.me prefill URL
  const getWhatsAppLink = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const standardCountryPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const prefillMessage = `Olá, ${name}! Aqui é o mestre Andrew Lemos do Ateliê Recomece. Vi que você salvou algumas obras exclusivas esculpidas em madeira em nosso site, mas não concluiu seu pedido. Gostaria de tirar alguma dúvida sobre o frete, entrega ou formas de pagamento? Estou à disposição para ajudar você a levar essas peças sob medida!`;
    return `https://wa.me/${standardCountryPhone}?text=${encodeURIComponent(prefillMessage)}`;
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-brand-wood/10 pb-5">
        <div>
          <h2 className="text-2xl font-serif text-brand-dark font-normal">Recuperação de Carrinhos Abandonados</h2>
          <p className="text-sm text-brand-wood/60">Monitore carrinhos, envie lembretes sequenciais com cupons automáticos e aumente suas vendas.</p>
        </div>
        
        {/* Run backend sweep */}
        <button
          onClick={triggerCartsSweep}
          disabled={cronRunning}
          className="flex items-center gap-2 px-4 py-2 border border-brand-wood/20 hover:border-brand-clay rounded-lg text-sm font-medium text-brand-wood hover:text-brand-clay bg-white transition-all shadow-sm disabled:opacity-50"
          id="btn-sweep-carts"
        >
          <RefreshCw className={`w-4 h-4 ${cronRunning ? 'animate-spin text-brand-clay' : ''}`} />
          <span>{cronRunning ? 'Varrendo Banco...' : 'Executar Varredura Agora'}</span>
        </button>
      </div>

      {/* Sweep Notifications Callback banner */}
      {cronResult && (
        <div className="p-4 bg-brand-sand/30 border border-brand-clay/20 text-brand-wood rounded-lg text-sm flex items-center gap-2 animate-fade-in" id="sweep-banner-result">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <span>{cronResult}</span>
        </div>
      )}

      {/* Dashboard KPI Decks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-xl border border-brand-wood/10 shadow-sm" id="kpi-total-abandoned">
          <div className="flex items-center justify-between text-brand-wood/60 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Carts Abandonados</span>
            <ShoppingBag className="w-5 h-5 text-gray-400" />
          </div>
          <div className="text-2xl font-serif text-brand-dark">{totalAbandoned}</div>
          <p className="text-[10px] text-brand-wood/40 mt-1">Varreduras elegíveis (&gt;= 24h)</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-xl border border-brand-wood/10 shadow-sm" id="kpi-recovered-count">
          <div className="flex items-center justify-between text-brand-wood/60 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Carrinhos Recuperados</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-serif text-emerald-600">{totalRecovered}</div>
          <p className="text-[10px] text-brand-wood/40 mt-1">Das compras salvas</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-xl border border-brand-wood/10 shadow-sm" id="kpi-recovered-value">
          <div className="flex items-center justify-between text-brand-wood/60 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Valor Recuperado</span>
            <Coins className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-serif text-brand-clay">
            {recoveredValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <p className="text-[10px] text-brand-wood/40 mt-1">Faturamento reavido</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-xl border border-brand-wood/10 shadow-sm" id="kpi-conv-rate">
          <div className="flex items-center justify-between text-brand-wood/60 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Taxa de Conversão</span>
            <TrendingUp className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-serif text-indigo-600">{conversionRate.toFixed(1)}%</div>
          <p className="text-[10px] text-brand-wood/40 mt-1">Média nacional e-com: ~2%</p>
        </div>

        {/* KPI 5 */}
        <div className="bg-white p-5 rounded-xl border border-brand-wood/10 shadow-sm" id="kpi-coupon-stats">
          <div className="flex items-center justify-between text-brand-wood/60 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cupons Ativos</span>
            <Gift className="w-5 h-5 text-pink-500" />
          </div>
          <div className="text-2xl font-serif text-brand-dark">
            {couponsUsed} <span className="text-sm font-sans text-brand-wood/40">/ {couponsGenerated}</span>
          </div>
          <p className="text-[10px] text-brand-wood/40 mt-1">Uso: {couponsUsageRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-xl border border-brand-wood/10 shadow-sm overflow-hidden" id="carts-table-card">
        {/* Table Filters Panel */}
        <div className="p-4 bg-brand-sand/5 border-b border-brand-wood/10 flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-brand-wood/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente, e-mail ou tel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-brand-wood/10 hover:border-brand-wood/20 focus:border-brand-clay rounded-lg text-sm bg-white focus:outline-none transition-colors"
              id="input-cart-search"
            />
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap items-center gap-1">
            {(['all', 'Ativo', 'Abandonado', 'Recuperado', 'Expirado'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeFilter === filter 
                    ? 'bg-brand-wood text-white shadow-sm' 
                    : 'text-brand-wood/60 hover:text-brand-dark hover:bg-brand-sand/10'
                }`}
                id={`filter-btn-${filter}`}
              >
                {filter === 'all' ? 'Ver Todos' : filter}
              </button>
            ))}
          </div>
        </div>

        {/* Loading display */}
        {loading ? (
          <div className="p-12 text-center text-brand-wood/50" id="loading-carts">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-clay mx-auto mb-3" />
            <p className="text-sm font-medium">Carregando carrinhos abandonados em tempo real...</p>
          </div>
        ) : filteredCarts.length === 0 ? (
          <div className="p-12 text-center text-brand-wood/40" id="empty-carts-search">
            <ShoppingBag className="w-12 h-12 text-brand-wood/25 mx-auto mb-3" />
            <p className="text-sm font-medium">Nenhum carrinho localizado para esta busca.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-sand/10 text-brand-dark/70 text-xs font-bold uppercase tracking-wider border-b border-brand-wood/10">
                  <th className="px-6 py-4">Cliente / Contato</th>
                  <th className="px-6 py-4">Obras no Carrinho</th>
                  <th className="px-6 py-4">Última Atividade</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Mensagens Automatizadas</th>
                  <th className="px-6 py-4 text-right">Recuperação Manual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-wood/10">
                {filteredCarts.map((cart) => {
                  const itemsCount = cart.items ? cart.items.reduce((sum, i) => sum + i.quantity, 0) : 0;
                  const hasSent24h = cart.sentMessages?.some(m => m.type === 'msg_24h');
                  const hasSent48h = cart.sentMessages?.some(m => m.type === 'msg_48h');
                  const hasSent72h = cart.sentMessages?.some(m => m.type === 'msg_72h');

                  return (
                    <tr key={cart.id} className="hover:bg-brand-sand/5 transition-colors text-sm" id={`cart-row-${cart.id}`}>
                      {/* Customer Info Column */}
                      <td className="px-6 py-4 space-y-1">
                        <div className="font-semibold text-brand-dark">{cart.customerName}</div>
                        <div className="text-xs text-brand-wood/60 flex items-center gap-1">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span>{cart.customerEmail}</span>
                        </div>
                        {cart.customerPhone && (
                          <div className="text-xs text-brand-wood/60 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 shrink-0" />
                            <span>{cart.customerPhone}</span>
                          </div>
                        )}
                      </td>

                      {/* Items Summaries Column */}
                      <td className="px-6 py-4">
                        <div className="max-w-[280px]">
                          <div className="font-semibold text-brand-clay text-sm">
                            {cart.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          <div className="text-xs text-brand-wood/60 font-medium">
                            {itemsCount} {itemsCount === 1 ? 'obra' : 'obras'}:
                          </div>
                          {/* List cart products thumbnails & name */}
                          <div className="mt-1 space-y-1 max-h-24 overflow-y-auto">
                            {cart.items?.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs text-brand-wood/70 bg-brand-sand/10 px-1.5 py-0.5 rounded border border-brand-wood/5">
                                <span className="font-bold text-brand-clay shrink-0">{item.quantity}x</span>
                                <span className="truncate">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Last Activity Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-brand-wood text-xs">
                          <Calendar className="w-4 h-4 text-brand-wood/40 shrink-0" />
                          <span>{new Date(cart.lastActive).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                          })}</span>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                          cart.status === 'Ativo' 
                            ? 'bg-blue-100 text-blue-800' 
                            : cart.status === 'Abandonado' 
                            ? 'bg-amber-100 text-amber-800' 
                            : cart.status === 'Recuperado' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {cart.status}
                        </span>
                        {cart.couponCode && cart.status === 'Abandonado' && (
                          <div className="mt-1 text-[10px] bg-amber-50 text-amber-800 border border-amber-200/50 rounded px-1.5 py-0.5 font-mono inline-block">
                            Cupom OFF: {cart.couponCode}
                          </div>
                        )}
                      </td>

                      {/* sent automated status indicator column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-4">
                          {/* 24h sent state */}
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-brand-wood/50 font-bold uppercase">24h Lembrete</span>
                            {hasSent24h ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-gray-300" />
                            )}
                          </div>

                          {/* 48h sent state */}
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-brand-wood/50 font-bold uppercase">48h Cupom</span>
                            {hasSent48h ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-gray-300" />
                            )}
                          </div>

                          {/* 72h sent state */}
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-brand-wood/50 font-bold uppercase">72h Final</span>
                            {hasSent72h ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-gray-300" />
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="px-6 py-4 text-right space-y-2">
                        {/* Send manual email step action drawer buttons */}
                        <div className="flex justify-end gap-1.5">
                          {/* Manual Send 24h Trigger */}
                          <button
                            onClick={() => handleManualSend(cart.id || '', 'msg_24h')}
                            disabled={actionLoading !== null || cart.status === 'Recuperado'}
                            title="Disparar Lembrete 24h por E-mail"
                            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                              hasSent24h 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-white text-brand-wood border-brand-wood/10 hover:border-brand-clay hover:bg-brand-sand/10'
                            } disabled:opacity-50`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>24h</span>
                          </button>

                          {/* Manual Send 48h Trigger */}
                          <button
                            onClick={() => handleManualSend(cart.id || '', 'msg_48h')}
                            disabled={actionLoading !== null || cart.status === 'Recuperado'}
                            title="Enviar Cupom 5% OFF por E-mail"
                            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                              hasSent48h 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-white text-brand-wood border-brand-wood/10 hover:border-brand-clay hover:bg-brand-sand/10'
                            } disabled:opacity-50`}
                          >
                            <Gift className="w-3.5 h-3.5" />
                            <span>48h</span>
                          </button>

                          {/* Manual Send 72h Trigger */}
                          <button
                            onClick={() => handleManualSend(cart.id || '', 'msg_72h')}
                            disabled={actionLoading !== null || cart.status === 'Recuperado'}
                            title="Enviar Aviso Exposição Final por E-mail"
                            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                              hasSent72h 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-white text-brand-wood border-brand-wood/10 hover:border-brand-clay hover:bg-brand-sand/10'
                            } disabled:opacity-50`}
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>72h</span>
                          </button>
                        </div>

                        {/* Open Direct WhatsApp Link */}
                        {cart.customerPhone && cart.status !== 'Recuperado' && (
                          <a
                            href={getWhatsAppLink(cart.customerPhone, cart.customerName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Chamar no WhatsApp</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
