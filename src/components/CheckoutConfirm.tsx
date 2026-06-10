import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  Truck, 
  Package, 
  MapPin, 
  Calendar, 
  Printer, 
  ExternalLink,
  Copy,
  ArrowRight,
  TrendingUp,
  Clock
} from 'lucide-react';
import { db, doc, onSnapshot } from '../firebase';
import { EcomOrder } from '../types';
import { ensureRobustUrl } from '../App';

interface CheckoutConfirmProps {
  orderId: string;
  onNavigateToView: (view: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm', id?: string) => void;
}

export const CheckoutConfirm: React.FC<CheckoutConfirmProps> = ({ orderId, onNavigateToView }) => {
  const [order, setOrder] = useState<EcomOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Monitor order status in real time to show shipment updates dynamically!
  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = onSnapshot(doc(db, 'ecom_orders', orderId), (snapshot) => {
      if (snapshot.exists()) {
        setOrder({ id: snapshot.id, ...snapshot.data() } as EcomOrder);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error watching order:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId]);

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusSteps = [
    { label: 'Aguardando pagamento', desc: 'Aguardando validação do banco' },
    { label: 'Pago', desc: 'Pagamento aprovado com sucesso' },
    { label: 'Separação', desc: 'Embalando com cuidado de mestre' },
    { label: 'Enviado', desc: 'Obra coletada pela transportadora' },
    { label: 'Entregue', desc: 'Entregue no endereço cadastrado' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-paper flex items-center justify-center p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-wood border-t-transparent animate-speed-normal" />
          <p className="text-sm text-gray-500 font-semibold font-sans">Carregando detalhes do seu pedido...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-brand-paper flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl border shadow-xl max-w-sm space-y-4">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-serif font-bold text-xl text-brand-ink">Pedido Não Localizado</h3>
          <p className="text-gray-400 text-xs">O pedido informado não foi encontrado ou foi excluído permanentemente pelo administrador.</p>
          <button 
            onClick={() => onNavigateToView('vendas')}
            className="w-full bg-brand-wood text-white py-3 rounded-xl text-xs font-bold hover:bg-brand-clay transition-all cursor-pointer"
          >
            Ir para a Loja
          </button>
        </div>
      </div>
    );
  }

  // Find active step index
  const activeStepIdx = statusSteps.findIndex(step => step.label === order.status);

  return (
    <div className="bg-brand-paper min-h-screen py-16 px-6 font-sans">
      
      {/* BRAND HEADER CONNECTION */}
      <div className="max-w-3xl mx-auto mb-8 flex flex-col items-center justify-between gap-4 border-b border-brand-wood/10 pb-6">
        <a 
          href="#home" 
          onClick={(e) => { e.preventDefault(); onNavigateToView('vendas'); }}
          className="hover:opacity-80 transition-opacity"
        >
          <img 
            src={ensureRobustUrl("/arquivos/LOGO ANDREW.png")} 
            alt="Andrew Lemos Logo" 
            className="h-14 md:h-16 w-auto object-contain mx-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </a>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-clay">
          <span>Sacola</span>
          <span className="text-gray-300">/</span>
          <span>Pagamento Seguro</span>
          <span className="text-gray-300">/</span>
          <span className="text-brand-wood font-bold underline underline-offset-4 decoration-2">Confirmação</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* TOP GLORIOUS PANEL */}
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-brand-wood/5 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-2xl md:text-3xl text-brand-ink">Muito obrigado pela compra!</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">Seu pedido foi registrado e está sendo processado com carinho e cuidado de mestre.</p>
          </div>

          <div className="bg-brand-paper/50 rounded-2xl p-4 border max-w-md mx-auto grid grid-cols-2 gap-4 text-xs font-mono text-left text-brand-wood">
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold mb-0.5">Identificador Pedido</span>
              <span className="font-semibold text-brand-ink font-mono">{order.id}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-bold mb-0.5">Valor Pago</span>
              <span className="font-semibold text-brand-ink font-mono">R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* STATUS SHPIMENT PROGRESS STEP TRACKER */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-brand-wood/5 shadow-sm space-y-6">
          <h2 className="font-serif font-bold text-lg text-brand-ink flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-wood" />
            <span>Acompanhe o Status</span>
          </h2>

          <div className="relative pt-2 pl-4 md:pl-0">
            {/* Desktop visual line */}
            <div className="hidden md:block absolute left-8 top-12 right-8 h-1 bg-gray-100 rounded-full z-0">
              <div 
                className="h-full bg-brand-wood rounded-full transition-all duration-500" 
                style={{ width: `${(activeStepIdx / (statusSteps.length - 1)) * 100}%` }}
              />
            </div>

            <div className="grid md:grid-cols-5 gap-6 md:gap-4 relative z-10 flex-col md:flex-row">
              {statusSteps.map((step, idx) => {
                const isPassed = idx <= activeStepIdx;
                const isCurrent = idx === activeStepIdx;
                return (
                  <div key={idx} className="flex md:flex-col items-start md:items-center text-left md:text-center md:gap-2">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-sm shadow-xs transition-colors ${
                      isCurrent 
                        ? 'bg-brand-wood border-brand-wood text-white ring-4 ring-brand-wood/10' 
                        : isPassed 
                          ? 'bg-[#EBF7EE] border-emerald-300 text-emerald-600' 
                          : 'bg-white border-gray-200 text-gray-300'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="ml-3 md:ml-0 md:pt-1">
                      <div className={`font-bold text-xs ${isCurrent ? 'text-brand-wood' : isPassed ? 'text-brand-ink' : 'text-gray-300'}`}>
                        {step.label}
                      </div>
                      <div className="text-[10px] text-gray-400">{step.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SHIPMENT CODES AND SUTACO TRACKING */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-brand-wood/5 shadow-sm space-y-4">
          <h3 className="font-serif font-bold text-base text-brand-ink flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-wood" />
            <span>Envio & Código de Rastreamento</span>
          </h3>

          {order.trackingCode ? (
            <div className="bg-brand-paper/40 p-5 rounded-2xl border space-y-3">
              <p className="text-xs text-gray-500 font-semibold leading-normal">Seu pedido foi coletado e já está em trânsito! Utilize o identificador oficial abaixo para acompanhar o transporte nos Correios ou MelhorEnvio:</p>
              
              <div className="flex gap-2 max-w-sm">
                <input 
                  type="text" 
                  readOnly 
                  value={order.trackingCode} 
                  className="bg-white border text-center font-mono text-sm uppercase font-bold text-brand-ink flex-grow px-3 py-2 rounded-xl outline-none"
                />
                <button 
                  onClick={() => handleCopyToClipboard(order.trackingCode || '')}
                  className="bg-brand-wood hover:bg-brand-clay text-white text-xs font-semibold px-4 rounded-xl flex items-center gap-1 transition-all active:scale-95"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>

              <div className="pt-2">
                <a 
                  href={`https://melhorenvio.com.br/rastreamento?codigo=${order.trackingCode}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-brand-ink text-white px-4 py-2.5 rounded-xl hover:bg-brand-wood transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Rastrear no Portal Oficial do MelhorEnvio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-dashed text-xs text-gray-500 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500 animate-pulse flex-shrink-0" />
              <p className="leading-snug">Seu código de rastreamento está sendo gerado pela plataforma de frete do MelhorEnvio. Assim que a nota for faturada e enviada para coleta, o código aparecerá atualizado instantaneamente aqui nesta página!</p>
            </div>
          )}
        </div>

        {/* RECEIPT SUMMARY ORDER LIST DETAILS */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-brand-wood/5 shadow-sm space-y-4">
          <h3 className="font-serif font-bold text-base text-brand-ink flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-wood" />
            <span>Itens Comprados</span>
          </h3>

          <div className="space-y-3 pb-4">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex gap-4 pt-3 border-t first:border-0 border-gray-50 items-center justify-between text-xs">
                <div className="flex gap-2.5 items-center min-w-0">
                  <div className="bg-gray-100 flex items-center justify-center rounded-lg p-1 w-10 h-10 border flex-shrink-0">
                    {item.images && item.images.length > 0 ? (
                      <img 
                        src={ensureRobustUrl(item.images[0])} 
                        className="w-full h-full object-contain" 
                        alt="" 
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                  <span className="font-bold text-brand-wood font-mono">{item.quantity}x</span>
                  <span className="font-semibold text-brand-ink truncate max-w-[200px] sm:max-w-md">{item.name}</span>
                </div>
                <span className="font-mono text-gray-500 font-bold">
                  R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-1 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal Obras</span>
              <span className="font-mono">R$ {order.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Frete ({order.shippingMethod})</span>
              <span className="font-mono">R$ {order.shippingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-brand-ink font-bold text-sm pt-2 border-t">
              <span>Total Pago</span>
              <span className="font-mono text-brand-wood text-lg">R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* BOTTOM NAVIGATION ROUTING ACTIONS */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => onNavigateToView('vendas')}
            className="flex-grow bg-white text-brand-wood border border-brand-wood/20 py-4 rounded-full font-bold text-sm hover:bg-brand-paper hover:border-brand-wood transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>Voltar à Página Principal de Vendas</span>
          </button>
          <button 
            onClick={() => onNavigateToView('landing')}
            className="flex-grow bg-brand-wood hover:bg-brand-clay text-white py-4 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-wood/10"
          >
            <span>Voltar ao Portfolio Andrew</span>
          </button>
        </div>

      </div>
    </div>
  );
};
