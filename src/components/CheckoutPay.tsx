import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CreditCard, 
  QrCode, 
  Barcode, 
  CheckCircle2, 
  ShieldCheck, 
  Copy, 
  Download,
  Clock,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { db, doc, onSnapshot } from '../firebase';
import { EcomOrder } from '../types';

// Helper functions for CRC16 calculation and valid static Pix code generation
const calculateCRC16 = (str: string): string => {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    const charCode = str.charCodeAt(c);
    crc ^= (charCode << 8);
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  let hex = crc.toString(16).toUpperCase();
  while (hex.length < 4) {
    hex = '0' + hex;
  }
  return hex;
};

const generatePixCode = (amount: number, key: string, name: string, city: string) => {
  const cleanKey = key.trim();
  const cleanName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .substring(0, 25)
    .trim() || 'Andrew Lemos';
  const cleanCity = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .substring(0, 15)
    .trim() || 'Rio de Janeiro';
  
  const amountStr = amount.toFixed(2);
  
  const f00 = "000201";
  const f01 = "010211";
  
  // Field 26 (Merchant Account Information)
  const gui = "0014br.gov.bcb.pix";
  const keyField = `01${String(cleanKey.length).padStart(2, '0')}${cleanKey}`;
  const f26 = `26${String(gui.length + keyField.length).padStart(2, '0')}${gui}${keyField}`;
  
  const f52 = "52040000";
  const f53 = "5303986";
  const f54 = `54${String(amountStr.length).padStart(2, '0')}${amountStr}`;
  const f58 = "5802BR";
  const f59 = `59${String(cleanName.length).padStart(2, '0')}${cleanName}`;
  const f60 = `60${String(cleanCity.length).padStart(2, '0')}${cleanCity}`;
  const f62 = "62070503***";
  const f63 = "6304";
  
  const rawPayload = f00 + f01 + f26 + f52 + f53 + f54 + f58 + f59 + f60 + f62 + f63;
  const crc = calculateCRC16(rawPayload);
  return rawPayload + crc;
};

interface CheckoutPayProps {
  orderId: string;
  onNavigateToView: (view: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm', id?: string) => void;
}

export const CheckoutPay: React.FC<CheckoutPayProps> = ({ orderId, onNavigateToView }) => {
  const [order, setOrder] = useState<EcomOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pix' | 'card' | 'boleto'>('pix');
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '', installments: '1' });
  const [errorMsg, setErrorMsg] = useState('');

  // Sincroniza em tempo real com o Firestore para carregar o pedido gerado pela rota
  useEffect(() => {
    if (!orderId) return;

    let attempts = 0;
    let notFoundTimeout: any = null;

    const unsubscribe = onSnapshot(doc(db, 'ecom_orders', orderId), (snapshot) => {
      if (snapshot.exists()) {
        if (notFoundTimeout) {
          clearTimeout(notFoundTimeout);
        }
        const orderData = { id: snapshot.id, ...snapshot.data() } as EcomOrder;
        setOrder(orderData);
        setErrorMsg('');
        setLoading(false);
        
        // Se o pedido já consta como "Pago" em tempo real (ex: pelo webhook), redireciona automaticamente para a tela de confirmação
        if (orderData.status === 'Pago' || orderData.status === 'Separação' || orderData.status === 'Enviado') {
          onNavigateToView('checkout-confirm', orderId);
        }
      } else {
        attempts++;
        // No primeiro snapshot, se não existir ainda, aguarda até 5 segundos para que o banco escreva o registro
        if (attempts === 1) {
          notFoundTimeout = setTimeout(() => {
            setErrorMsg('Nota fiscal ou pedido não localizado no banco de dados. Verifique a URL ou o status da compra.');
            setLoading(false);
          }, 5000);
        } else {
          // Se o timeout já expirou e ainda assim não há registro
          if (!notFoundTimeout) {
            setErrorMsg('Nota fiscal ou pedido não localizado no banco de dados.');
            setLoading(false);
          }
        }
      }
    }, (err) => {
      console.error("Error watching order:", err);
      setErrorMsg('Falha de conexão com o banco de dados. Tente atualizar a página.');
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (notFoundTimeout) {
        clearTimeout(notFoundTimeout);
      }
    };
  }, [orderId]);

  // Simulates copy to clipboard for copy-paste elements
  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Triggers mock webhook callback payment processing
  const executeSimulatedPayment = async (methodName: string) => {
    if (!order) return;
    setProcessing(true);
    setErrorMsg('');

    try {
      const paymentId = `PAY-SIM-${methodName.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const response = await fetch('/api/vendas/webhook-mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id || orderId,
          status: 'Pago',
          paymentId: paymentId
        })
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          // Webhook processed stock extraction and status adjustment successfully! 
          // Our realtime Firestore snap will witness state transition and redirect to the confirmation screen
        } else {
          alert(`Erro no gateway: ${resData.error}`);
          setProcessing(false);
        }
      } else {
        throw new Error('Falha HTTP ao registrar o webhook simulador do PagSeguro.');
      }
    } catch (err: any) {
      console.error("Payment simulator webhook failed:", err);
      setErrorMsg('Houve um erro processando o pagamento simulado. Tente novamente.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-paper flex items-center justify-center p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-wood border-t-transparent" />
          <p className="text-sm text-gray-500 font-semibold">Carregando ambiente seguro de pagamento...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !order) {
    return (
      <div className="min-h-screen bg-brand-paper flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border shadow-xl max-w-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="font-serif font-bold text-xl text-brand-ink">Pedido não encontrado</h3>
          <p className="text-gray-400 text-sm">{errorMsg || 'Verifique novamente o endereço de redirecionamento de compras do site.'}</p>
          <button 
            onClick={() => onNavigateToView('vendas')}
            className="w-full bg-brand-wood text-white py-3 rounded-xl text-xs font-bold hover:bg-brand-clay transition-all"
          >
            Voltar à Loja
          </button>
        </div>
      </div>
    );
  }

  const { customerInfo, items, subtotal, shippingCost, total } = order;
  const generatedPixString = generatePixCode(total, "andrewfmlemos@gmail.com", "Andrew Lemos", "Rio de Janeiro");

  return (
    <div className="bg-brand-paper min-h-screen py-12 px-6 font-sans">
      
      {/* REAL PAYMENT CORRECTION REDIRECT */}
      {order.paymentUrl && (
        <div className="max-w-4xl mx-auto mb-6 bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="font-serif font-bold text-sm text-emerald-800">Link de Pagamento Oficial Ativo</h4>
              <p className="text-xs text-emerald-700">
                Uma preferência real do Mercado Pago foi registrada com sucesso para esta compra.
              </p>
            </div>
          </div>
          <a 
            href={order.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 shadow-sm hover:shadow hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>Ir para o Mercado Pago Oficial</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* DIAGNOSTIC WARNING BANNER FOR CLIENT */}
      {order.gateway?.includes("Virtual") && (
        <div className="max-w-4xl mx-auto mb-6 bg-amber-50 border-2 border-amber-200 text-amber-900 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <h4 className="font-serif font-bold text-sm text-amber-800">Carrinho em Modo Teste / Simulação Virtual de Pagamento</h4>
              <p className="text-xs leading-relaxed text-amber-700">
                Você foi redirecionado para esta tela de sandbox local porque a integração real do <strong>Mercado Pago</strong> não está ativada.
              </p>
              {order.gatewayError && (
                <div className="bg-amber-100/50 p-3 rounded-2xl text-[10px] font-mono text-amber-800 mt-2 border border-amber-200/50">
                  <strong>Mensagem Diagnóstica Técnica:</strong> {order.gatewayError}
                </div>
              )}
              <div className="text-[11px] font-medium text-amber-800 pt-2 border-t border-amber-200/50 mt-2">
                <strong>💡 Como configurar e ativar pagamento REAL na sua loja:</strong>
                <ol className="list-decimal pl-4 mt-1 space-y-1">
                  <li>No painel da Vercel (ou do servidor onde fez o deploy), vá em <strong>Settings &gt; Environment Variables</strong>.</li>
                  <li>Adicione a variável de ambiente: <strong>MERCADOPAGO_ACCESS_TOKEN</strong></li>
                  <li>Preencha o valor com o seu Access Token de Produção obtido no painel de desenvolvedores do Mercado Pago (normalmente começa com <code className="bg-amber-200/50 px-1 rounded font-mono text-[10px]">APP_USR-...</code>).</li>
                  <li>Importante: <strong>Refaça o Deployment</strong> do seu projeto para que o servidor carregue a nova variável de ambiente.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto grid md:grid-cols-[1fr_360px] gap-8">
        
        {/* Column 1: Payment Method selector interface gateway */}
        <div className="space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-brand-wood/5 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl border border-emerald-100">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-serif font-bold text-lg text-brand-ink leading-tight">Checkout Seguro</h2>
                  <p className="text-[10px] uppercase text-gray-400 tracking-wider font-bold">Gateway Mercado Pago Integrado</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-medium">Total do Pedido</span>
                <span className="text-xl font-bold text-brand-wood font-mono">
                  R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* TAB INTERFACES TRIGGERS selectors */}
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => { if (!processing) setActiveTab('pix'); }}
                className={`py-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 border font-semibold text-xs transition-all cursor-pointer ${
                  activeTab === 'pix' 
                    ? 'border-brand-wood bg-brand-paper/20 text-brand-wood shadow-xs' 
                    : 'border-gray-100 hover:border-gray-200 text-gray-500 bg-white'
                }`}
              >
                <QrCode className="w-5 h-5" />
                <span>PIX</span>
              </button>
              <button 
                onClick={() => { if (!processing) setActiveTab('card'); }}
                className={`py-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 border font-semibold text-xs transition-all cursor-pointer ${
                  activeTab === 'card' 
                    ? 'border-brand-wood bg-brand-paper/20 text-brand-wood shadow-xs' 
                    : 'border-gray-100 hover:border-gray-200 text-gray-500 bg-white'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>Cartão</span>
              </button>
              <button 
                onClick={() => { if (!processing) setActiveTab('boleto'); }}
                className={`py-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 border font-semibold text-xs transition-all cursor-pointer ${
                  activeTab === 'boleto' 
                    ? 'border-brand-wood bg-brand-paper/20 text-brand-wood shadow-xs' 
                    : 'border-gray-100 hover:border-gray-200 text-gray-500 bg-white'
                }`}
              >
                <Barcode className="w-5 h-5" />
                <span>Boleto</span>
              </button>
            </div>

            {/* TAB CONTENT DETAILS */}
            <div className="pt-2 min-h-[220px]">
              
              {/* PIX VIEW */}
              {activeTab === 'pix' && (
                order.paymentUrl ? (
                  <div className="space-y-5 text-center flex flex-col items-center">
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-2xl text-[11px] leading-snug w-full text-left">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                      <span>Você selecionou o pagamento via <strong>PIX</strong> no Mercado Pago.</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed px-2">
                      Pague via PIX integrado do Mercado Pago e tenha aprovação imediata para liberação agilizada do estoque da sua obra. Clique no botão abaixo para abrir o checkout seguro.
                    </p>
                    <a 
                      href={order.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-full font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <QrCode className="w-5 h-5" />
                      <span>Ir pagar PIX Oficial no Mercado Pago</span>
                    </a>
                  </div>
                ) : (
                  <div className="space-y-5 text-center flex flex-col items-center">
                    <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2.5 rounded-2xl text-[11px] leading-snug w-full text-left font-sans">
                      <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
                      <span>Modo Simulação: Código de Pix de teste gerado nos padrões oficiais do Banco Central (EMV).</span>
                    </div>

                    <div className="p-3 bg-white border border-brand-wood/10 rounded-2xl flex items-center justify-center w-40 h-40 shadow-inner relative overflow-hidden">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(generatedPixString)}`}
                        alt="QR Code Pix"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="space-y-3 w-full text-left">
                      <p className="text-xs text-gray-400 text-center">Escaneie o QR Code acima ou copie a linha de transferência abaixo:</p>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={generatedPixString}
                          className="bg-[#FAFAFA] border border-gray-100 font-mono text-[10px] flex-grow text-gray-500 px-3 py-2.5 rounded-xl outline-none select-all"
                        />
                        <button 
                          onClick={() => handleCopyToClipboard(generatedPixString)}
                          className="bg-brand-wood text-white px-4 rounded-xl text-xs font-semibold hover:bg-brand-clay hover:scale-[1.03] transition-all flex items-center gap-1.5 shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>

                    <button 
                      disabled={processing}
                      onClick={() => executeSimulatedPayment('pix')}
                      className="w-full bg-emerald-600 text-white py-4 rounded-full font-bold text-sm hover:bg-emerald-700 hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {processing ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Verificando Transferência...
                        </span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          <span>Confirmar Pagamento Simulado</span>
                        </>
                      )}
                    </button>
                  </div>
                )
              )}

              {/* CARD PREVIEW FORM */}
              {activeTab === 'card' && (
                order.paymentUrl ? (
                  <div className="space-y-5 text-center flex flex-col items-center">
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-2xl text-[11px] leading-snug w-full text-left">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                      <span>Você selecionou o pagamento via <strong>Cartão de Crédito</strong> no Mercado Pago.</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed px-2">
                      Pague parcelado em até 3x sem juros no seu cartão com total segurança no ambiente integrado do Mercado Pago. Clique no botão abaixo para preencher os seus dados de pagamento.
                    </p>
                    <a 
                      href={order.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-full font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <CreditCard className="w-5 h-5" />
                      <span>Pagar com Cartão Oficial no Mercado Pago</span>
                    </a>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); executeSimulatedPayment('card'); }} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Número do Cartão *</label>
                      <input 
                        type="text" 
                        placeholder="0000 0000 0000 0000" 
                        required
                        value={cardData.number}
                        onChange={e => setCardData({...cardData, number: e.target.value.replace(/\D/g, "").replace(/(\d{4})/g, "$1 ").trim()})}
                        className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-brand-wood font-mono tracking-wider font-semibold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Nome do Titular *</label>
                      <input 
                        type="text" 
                        placeholder="Como impresso no cartão" 
                        required
                        value={cardData.name}
                        onChange={e => setCardData({...cardData, name: e.target.value.toUpperCase()})}
                        className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-brand-wood font-semibold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Validade *</label>
                        <input 
                          type="text" 
                          placeholder="MM/AA" 
                          required
                          maxLength={5}
                          value={cardData.expiry}
                          onChange={e => setCardData({...cardData, expiry: e.target.value.replace(/\D/g, "").replace(/^(\d{2})/, "$1/")})}
                          className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-brand-wood font-mono text-center font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Cód. SegurançaCVV *</label>
                        <input 
                          type="password" 
                          placeholder="123" 
                          required
                          maxLength={4}
                          value={cardData.cvv}
                          onChange={e => setCardData({...cardData, cvv: e.target.value.replace(/\D/g, "")})}
                          className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-brand-wood font-mono text-center font-bold"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Parcelas</label>
                      <select 
                        value={cardData.installments} 
                        onChange={e => setCardData({...cardData, installments: e.target.value})}
                        className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-brand-wood font-bold"
                      >
                        <option value="1">1x de R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Sem Juros</option>
                        <option value="2">2x de R$ {(total / 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Sem Juros</option>
                        <option value="3">3x de R$ {(total / 3).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Sem Juros</option>
                      </select>
                    </div>

                    <button 
                      type="submit" 
                      disabled={processing}
                      className="w-full bg-brand-wood text-white py-4 rounded-full font-bold text-sm hover:bg-brand-clay hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      {processing ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Processando Aprovação de Crédito...
                        </span>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          <span>Confirmar Pagamento Simulado</span>
                        </>
                      )}
                    </button>
                  </form>
                )
              )}

              {/* BOLETO STRINGS */}
              {activeTab === 'boleto' && (
                order.paymentUrl ? (
                  <div className="space-y-5 text-center flex flex-col items-center">
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-2xl text-[11px] leading-snug w-full text-left">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                      <span>Você selecionou o pagamento via <strong>Boleto Bancário</strong> no Mercado Pago.</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed px-2">
                      Gere o boleto bancário oficial do seu pedido de forma segura. A compensação do boleto pode levar de 1 a 2 dias úteis para atualização no estoque.
                    </p>
                    <a 
                      href={order.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-full font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Barcode className="w-5 h-5" />
                      <span>Gerar Boleto Oficial no Mercado Pago</span>
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4 text-center">
                    <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2.5 rounded-2xl text-[11px] leading-snug text-left">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Boletos levam de 1 a 2 dias úteis para compensação bancária e confirmação de estoque automática.</span>
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl flex flex-col gap-2 shadow-inner font-mono text-xs text-gray-600 text-left">
                      <span className="text-[10px] font-bold text-brand-wood uppercase tracking-wider">Código de Barras Boleto</span>
                      <span>34191.79001 01043.513184 91020.150008 7 934500000{Math.round(total)}</span>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleCopyToClipboard(`34191.79001 01043.513184 91020.150008 7 934500000${Math.round(total)}`)}
                        className="bg-gray-100 hover:bg-gray-200 text-slate-800 font-semibold text-xs px-4 py-3.5 rounded-xl flex-grow flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                        <span>{copied ? 'Copiado!' : 'Copiar Código'}</span>
                      </button>
                      <button 
                        onClick={() => alert("Simulação de PDF de Boleto gerado com sucesso!")}
                        className="bg-gray-100 hover:bg-gray-200 text-slate-800 font-semibold text-xs px-4 py-3.5 rounded-xl flex-grow flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Baixar PDF</span>
                      </button>
                    </div>

                    <button 
                      disabled={processing}
                      onClick={() => executeSimulatedPayment('boleto')}
                      className="w-full bg-brand-wood text-white py-4 rounded-full font-bold text-sm hover:bg-brand-clay hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer mt-6"
                    >
                      {processing ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Simulando Pagamento...
                        </span>
                      ) : (
                        <>
                          <Barcode className="w-5 h-5" />
                          <span>Pagar Boleto (Simulado Online)</span>
                        </>
                      )}
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Column 2: Order items summary card details panels */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-brand-wood/5 shadow-sm space-y-4">
            <h3 className="font-serif font-bold text-base text-brand-ink border-b pb-2">Resumo da Compra</h3>
            <div className="space-y-3 divide-y divide-gray-50">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-3 pt-3 first:pt-0 items-center justify-between">
                  <div className="flex gap-2.5 items-center min-w-0">
                    <span className="bg-brand-wood/10 text-brand-wood font-bold px-2 py-0.5 rounded-lg text-[10px] font-mono h-fit">
                      {item.quantity}x
                    </span>
                    <span className="text-xs font-semibold text-brand-ink truncate max-w-[150px]">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-500 font-mono">
                    R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span className="font-mono">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Serviço Frete</span>
                <span className="font-mono">R$ {shippingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-brand-ink font-bold text-sm pt-2 border-t">
                <span>Total Geral</span>
                <span className="font-mono text-brand-wood text-base">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50/70 p-5 rounded-3xl border border-brand-wood/5 space-y-3">
            <h4 className="font-serif font-bold text-xs text-brand-wood uppercase tracking-wider">Endereço Destinatário</h4>
            <div className="text-[11px] text-gray-500 leading-normal space-y-1 font-medium">
              <div className="font-bold text-brand-ink">{customerInfo.name}</div>
              <div>{customerInfo.street}, {customerInfo.number} {customerInfo.complement ? `(${customerInfo.complement})` : ''}</div>
              <div>{customerInfo.neighborhood} — CEP: {customerInfo.cep}</div>
              <div>{customerInfo.city}, {customerInfo.state}</div>
              <div className="pt-2 italic text-gray-400">Faremos o envio através de: {order.shippingMethod}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
