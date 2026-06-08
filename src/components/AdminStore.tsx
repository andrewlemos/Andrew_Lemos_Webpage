import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  X, 
  MapPin, 
  Mail, 
  Phone, 
  FileText, 
  Truck, 
  Calendar, 
  ShoppingBag,
  Package,
  Edit2,
  DollarSign,
  Layers
} from 'lucide-react';
import { db, collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, setDoc, auth } from '../firebase';
import { EcomProduct, EcomOrder, ShippingQuote, PackagingSettings } from '../types';
import { ensureRobustUrl } from '../App';

const formatAdminDate = (createdAt: any) => {
  if (!createdAt) return '---';
  if (typeof createdAt === 'string') return createdAt;
  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate().toLocaleString('pt-BR');
  }
  if (createdAt.seconds !== undefined) {
    return new Date(createdAt.seconds * 1000).toLocaleString('pt-BR');
  }
  return String(createdAt);
};

export const AdminStore = () => {
  const [products, setProducts] = useState<EcomProduct[]>([]);
  const [orders, setOrders] = useState<EcomOrder[]>([]);
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'orders' | 'quotes' | 'packaging'>('products');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<EcomOrder | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<ShippingQuote | null>(null);

  const [packagingSettings, setPackagingSettings] = useState<PackagingSettings>({
    extraHeight: 5,
    extraWidth: 5,
    extraLength: 10,
    extraWeight: 0.3
  });

  const [quoteResponse, setQuoteResponse] = useState({
    shippingCost: '',
    carrier: 'MelhorEnvio / Correios',
    deliveryTime: '',
    notes: ''
  });

  // Form states for new product
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Escultura em Madeira',
    imagesText: '', // multiple image lines
    price: '',
    weight: '',
    height: '',
    width: '',
    length: '',
    stock: '',
    shippingType: 'automatic'
  });

  // Load ecom products and orders from firestore in real time
  useEffect(() => {
    const qProds = query(collection(db, 'ecom_products'), orderBy('createdAt', 'desc'));
    const unsubProds = onSnapshot(qProds, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as EcomProduct[]);
    });

    const qOrders = query(collection(db, 'ecom_orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })) as EcomOrder[]);
    });

    const qQuotes = query(collection(db, 'ecom_quotes'), orderBy('createdAt', 'desc'));
    const unsubQuotes = onSnapshot(qQuotes, (snap) => {
      setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ShippingQuote[]);
    });

    const unsubPackaging = onSnapshot(doc(db, 'ecom_settings', 'packaging'), (snap) => {
      if (snap.exists()) {
        setPackagingSettings(snap.data() as PackagingSettings);
      } else {
        setDoc(doc(db, 'ecom_settings', 'packaging'), {
          extraHeight: 5,
          extraWidth: 5,
          extraLength: 10,
          extraWeight: 0.3
        }).catch(err => console.warn("Erro ao iniciar embalagem:", err));
      }
    });

    return () => {
      unsubProds();
      unsubOrders();
      unsubQuotes();
      unsubPackaging();
    };
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.stock) {
      alert("Por favor, preencha os campos obrigatórios (nome, preço e estoque).");
      return;
    }

    try {
      // Split URLs block into cleaned array strings
      const cleanedImages = formData.imagesText
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      const productPayload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category.trim(),
        images: cleanedImages.length > 0 ? cleanedImages : ['https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=687'],
        price: parseFloat(formData.price) || 0,
        weight: parseFloat(formData.weight) || 0.3,
        height: parseFloat(formData.height) || 12,
        width: parseFloat(formData.width) || 12,
        length: parseFloat(formData.length) || 18,
        stock: parseInt(formData.stock, 10) || 1,
        shippingType: formData.shippingType || 'automatic',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'ecom_products'), productPayload);
      setIsAdding(false);
      setFormData({
        name: '',
        description: '',
        category: 'Escultura em Madeira',
        imagesText: '',
        price: '',
        weight: '',
        height: '',
        width: '',
        length: '',
        stock: '',
        shippingType: 'automatic'
      });
    } catch (err: any) {
      console.error("Failed to add ecom product:", err);
      alert(`Erro: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (prodId: string) => {
    if (!window.confirm("Deseja realmente remover permanentemente este produto do catálogo da loja?")) return;
    try {
      await deleteDoc(doc(db, 'ecom_products', prodId));
    } catch (err: any) {
      console.error("Failed deleting product:", err);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'ecom_orders', orderId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
    } catch (err: any) {
      console.error("Failed to adjust order status:", err);
    }
  };

  const handleSaveTrackingCode = async (orderId: string, code: string) => {
    try {
      await updateDoc(doc(db, 'ecom_orders', orderId), {
        trackingCode: code.trim(),
        updatedAt: new Date().toISOString()
      });
      alert("Código de rastreamento salvo e atrelado ao pedido do cliente com sucesso!");
    } catch (err: any) {
      console.error("Failed saving tracking code:", err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Sub menu selectors */}
      <div className="flex border-b pb-1 gap-6 text-sm font-semibold flex-wrap">
        <button 
          onClick={() => setActiveSubTab('products')} 
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeSubTab === 'products' ? 'text-brand-wood border-b-2 border-brand-wood' : 'text-gray-400'
          }`}
        >
          Catálogo E-commerce ({products.length})
        </button>
        <button 
          onClick={() => setActiveSubTab('orders')} 
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeSubTab === 'orders' ? 'text-brand-wood border-b-2 border-brand-wood' : 'text-gray-400'
          }`}
        >
          Ordens & Vendas Realizadas ({orders.length})
        </button>
        <button 
          onClick={() => setActiveSubTab('quotes')} 
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeSubTab === 'quotes' ? 'text-brand-wood border-b-2 border-brand-wood' : 'text-gray-400'
          }`}
        >
          Cotações de Frete ({quotes.length})
        </button>
        <button 
          onClick={() => setActiveSubTab('packaging')} 
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeSubTab === 'packaging' ? 'text-brand-wood border-b-2 border-brand-wood' : 'text-gray-400'
          }`}
        >
          Configurações de Embalagem
        </button>
      </div>

      {activeSubTab === 'products' ? (
        // TAB - PRODUCTS CATALOGUE
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-xl text-brand-ink">Gerenciamento de Produtos</h3>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="bg-brand-wood text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-brand-clay transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-brand-wood/10"
            >
              {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isAdding ? 'Cancelar Cadastro' : 'Cadastrar Novo Produto'}</span>
            </button>
          </div>

          <AnimatePresence>
            {isAdding && (
              <motion.form 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreateProduct} 
                className="bg-gray-50/50 p-6 rounded-2xl border border-brand-wood/10 grid md:grid-cols-2 gap-4 text-xs overflow-hidden"
              >
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wider">Nome do Produto *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Escultura Cavalo Crioulo em Imbuia" 
                      required 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-white border rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-brand-wood outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wider">Descrição Detalhada</label>
                    <textarea 
                      placeholder="Descreva o tipo de madeira, técnicas utilizadas e detalhes artísticos..." 
                      rows={4}
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-white border rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-brand-wood outline-none font-medium resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wider">Preço Comercial (R$) *</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="Ex: 850.00" 
                        required 
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: e.target.value})}
                        className="w-full bg-white border rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-brand-wood outline-none font-semibold text-brand-ink"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wider">Qtd. Estoque *</label>
                      <input 
                        type="number" 
                        placeholder="Ex: 1" 
                        required 
                        value={formData.stock}
                        onChange={e => setFormData({...formData, stock: e.target.value})}
                        className="w-full bg-white border rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-brand-wood outline-none font-semibold text-brand-ink"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wider">Categoria do Catalogo</label>
                    <select 
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-white border rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-brand-wood outline-none font-bold"
                    >
                      <option value="Escultura em Madeira">Escultura em Madeira</option>
                      <option value="Entalhe">Entalhe</option>
                      <option value="Pintura">Pintura</option>
                      <option value="Desenho">Desenho</option>
                      <option value="Pirografia">Pirografia</option>
                      <option value="Ferramentas">Ferramentas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wider">Tipo de Frete</label>
                    <select 
                      value={formData.shippingType}
                      onChange={e => setFormData({...formData, shippingType: e.target.value})}
                      className="w-full bg-white border rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-brand-wood outline-none font-bold"
                    >
                      <option value="automatic">Frete Automático</option>
                      <option value="quote">Solicitar Cotação de Frete</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 flex flex-col justify-between">
                  <div>
                    <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wider">Imagens Múltiplas (Uma URL de imagem por linha) *</label>
                    <textarea 
                      placeholder="https://exemplo.com/imagem1.jpg&#10;https://exemplo.com/imagem2.jpg" 
                      rows={4}
                      value={formData.imagesText}
                      onChange={e => setFormData({...formData, imagesText: e.target.value})}
                      className="w-full bg-white border rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-brand-wood outline-none font-mono"
                    />
                  </div>

                  {/* Shipment specs elements */}
                  <div className="bg-white p-4 rounded-xl border space-y-2">
                    <span className="font-bold text-[10px] text-brand-wood uppercase tracking-wider block">Dimensões para cálculo de Frete (MelhorEnvio)</span>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Peso (kg)</label>
                        <input type="number" step="0.1" placeholder="0.3" value={formData.weight} onChange={e=>setFormData({...formData, weight:e.target.value})} className="w-full p-2 border rounded-lg text-center" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Alt. (cm)</label>
                        <input type="number" step="1" placeholder="11" value={formData.height} onChange={e=>setFormData({...formData, height:e.target.value})} className="w-full p-2 border rounded-lg text-center" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Larg. (cm)</label>
                        <input type="number" step="1" placeholder="11" value={formData.width} onChange={e=>setFormData({...formData, width:e.target.value})} className="w-full p-2 border rounded-lg text-center" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-0.5">Comp. (cm)</label>
                        <input type="number" step="1" placeholder="16" value={formData.length} onChange={e=>setFormData({...formData, length:e.target.value})} className="w-full p-2 border rounded-lg text-center" />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-brand-wood text-white py-3.5 rounded-xl font-bold hover:bg-brand-clay hover:shadow-md transition-all uppercase tracking-wider text-xs"
                  >
                    Salvar Produto no Catálogo de Vendas
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Grid display listing and stock edit fast triggers */}
          <div className="grid sm:grid-cols-2 gap-4">
            {products.map(p => {
              const mainImg = p.images && p.images.length > 0 ? p.images[0] : '';
              const isOutOfStock = p.stock <= 0;
              return (
                <div key={p.id} className="bg-white p-4 rounded-2xl border flex gap-4 hover:shadow-xs transition-shadow">
                  <div className="w-20 h-20 bg-gray-50 rounded-xl p-2.5 border overflow-hidden flex items-center justify-center flex-shrink-0">
                    {mainImg ? (
                      <img src={ensureRobustUrl(mainImg)} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : null}
                  </div>
                  
                  <div className="flex-grow min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-brand-ink truncate leading-tight">{p.name}</h4>
                        <button 
                          onClick={() => handleDeleteProduct(p.id!)}
                          className="text-gray-400 hover:text-red-500 p-1 rounded-full transition-colors ease-in-out"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-gray-450 text-[10px] uppercase font-bold mt-0.5 tracking-wider flex items-center gap-1.5 flex-wrap">
                        <span>{p.category}</span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                        <span className={`px-1.5 py-0.5 rounded-sm text-[8px] font-bold ${p.shippingType === 'quote' ? 'bg-amber-150 text-amber-800' : 'bg-blue-150 text-blue-800'}`}>
                          {p.shippingType === 'quote' ? 'Solicitar Cotação' : 'Frete Automático'}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t pt-2 mt-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block pb-0.5 leading-none">Preço Único</span>
                        <div className="flex items-center gap-0.5">
                          <span className="text-xs font-bold text-gray-500 font-serif">R$</span>
                          <input 
                            type="number" 
                            step="0.01"
                            defaultValue={p.price}
                            onBlur={async (e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                try {
                                  await updateDoc(doc(db, 'ecom_products', p.id!), { price: val });
                                } catch (err) {
                                  console.error("Erro ao atualizar preço do produto:", err);
                                }
                              }
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-20 text-left border rounded-md font-bold px-1 py-0.5 text-brand-wood font-mono text-xs bg-gray-50 focus:bg-white"
                          />
                        </div>
                      </div>

                      {/* Stock updating field */}
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400 block pb-0.5 leading-none">Estoque</span>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            value={p.stock} 
                            onChange={async (e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                await updateDoc(doc(db, 'ecom_products', p.id!), { stock: val });
                              }
                            }}
                            className={`w-12 text-center border rounded-md font-bold px-1 py-0.5 ${isOutOfStock ? 'text-rose-500 bg-rose-50 border-rose-200' : 'text-slate-800'}`}
                          />
                          <span className="text-[10px] font-medium text-gray-400 font-sans">un.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {products.length === 0 && (
              <p className="text-center text-gray-400 py-12 col-span-2">Nenhum produto cadastrado formalmente para o e-commerce "Vendas" ainda.</p>
            )}
          </div>
        </div>
      ) : activeSubTab === 'orders' ? (
        // TAB - ORDERS LIST
        <div className="space-y-4">
          <h3 className="font-serif font-bold text-xl text-brand-ink">Gerenciador de Pedidos</h3>
          
          <div className="space-y-3">
            {orders.map(order => {
              const statusColors: Record<string, string> = {
                'Aguardando pagamento': 'bg-amber-50 text-amber-800 border-amber-200',
                'Pago': 'bg-emerald-50 text-emerald-800 border-emerald-200',
                'Separação': 'bg-violet-50 text-violet-800 border-violet-200',
                'Enviado': 'bg-blue-50 text-blue-800 border-blue-200',
                'Entregue': 'bg-slate-100 text-slate-800 border-gray-200',
                'Cancelado': 'bg-rose-50 text-rose-800 border-rose-200'
              };

              return (
                <div 
                  key={order.id} 
                  className="bg-white p-5 rounded-2xl border hover:shadow-xs transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-medium"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brand-ink font-mono">{order.id}</span>
                      <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-600 font-bold">{order.customerInfo.name} ({order.customerInfo.email})</div>
                    <div className="text-[10px] text-gray-400 font-mono">Realizado em: {formatAdminDate(order.createdAt)}</div>
                  </div>

                  <div className="flex items-center gap-6 justify-between md:justify-end flex-wrap">
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block leading-none">Total</span>
                      <span className="font-bold text-brand-wood font-mono text-sm leading-none">
                        R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select 
                        value={order.status} 
                        onChange={(e) => handleUpdateStatus(order.id!, e.target.value)}
                        className="bg-gray-50 border rounded-lg p-2 font-bold focus:ring-1 focus:ring-brand-wood text-[10px] cursor-pointer"
                      >
                        <option value="Aguardando pagamento">Aguardando pagamento</option>
                        <option value="Pago">Pago (Aprovado)</option>
                        <option value="Separação">Separação</option>
                        <option value="Enviado">Enviado</option>
                        <option value="Entregue">Entregue</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>

                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="bg-brand-paper hover:bg-brand-wood/10 text-brand-wood px-3.5 py-2 rounded-lg font-bold transition-all text-[10px] cursor-pointer"
                      >
                        Ficha Completa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {orders.length === 0 && (
              <p className="text-center text-gray-400 py-12">Nenhum pedido efetuado no e-commerce.</p>
            )}
          </div>
        </div>
      ) : activeSubTab === 'quotes' ? (
        // TAB - QUOTES REQUESTS LIST
        <div className="space-y-4">
          <h3 className="font-serif font-bold text-xl text-brand-ink">Solicitações de Cotações de Frete</h3>
          
          <div className="space-y-3">
            {quotes.map(quote => {
              const statusColors: Record<string, string> = {
                'Nova': 'bg-amber-50 text-amber-800 border-amber-200',
                'Em análise': 'bg-blue-50 text-blue-800 border-blue-200',
                'Respondida': 'bg-emerald-50 text-emerald-800 border-emerald-200',
                'Finalizada': 'bg-slate-100 text-slate-800 border-gray-200',
              };

              return (
                <div 
                  key={quote.id} 
                  className="bg-white p-5 rounded-2xl border hover:shadow-xs transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-medium"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-brand-ink font-serif text-[13px]">{quote.productName}</span>
                      <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${statusColors[quote.status] || 'bg-gray-100 text-gray-600'}`}>
                        {quote.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-600 font-bold">Cliente: {quote.customerInfo.name} ({quote.customerInfo.email})</div>
                    <div className="text-[10px] text-gray-400 font-mono">Realizado em: {formatAdminDate(quote.createdAt)}</div>
                  </div>

                  <div className="flex items-center gap-6 justify-between md:justify-end flex-wrap">
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block leading-none">Qtd: {quote.quantity} | Valor Unitário</span>
                      <span className="font-bold text-brand-wood font-mono text-xs leading-none">
                        R$ {quote.productPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setSelectedQuote(quote);
                          setQuoteResponse({
                            shippingCost: quote.response?.shippingCost ? String(quote.response.shippingCost) : '',
                            carrier: quote.response?.carrier || 'MelhorEnvio / Correios',
                            deliveryTime: quote.response?.deliveryTime ? String(quote.response.deliveryTime) : '',
                            notes: quote.response?.notes || ''
                          });
                          // If status was New, transition it to 'Em análise' automatically to provide a realistic experience
                          if (quote.status === 'Nova') {
                            updateDoc(doc(db, 'ecom_quotes', quote.id!), { status: 'Em análise', updatedAt: new Date().toISOString() })
                              .catch(err => console.warn("Failed automatic transition to Em análise:", err));
                          }
                        }}
                        className="bg-brand-paper hover:bg-brand-wood/10 text-brand-wood px-3.5 py-2 rounded-lg font-bold transition-all text-[10px] cursor-pointer"
                      >
                        Avaliar & Responder
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {quotes.length === 0 && (
              <p className="text-center text-gray-400 py-12">Nenhuma solicitação de cotação de frete recebida ainda.</p>
            )}
          </div>
        </div>
      ) : (
        // TAB - GLOBAL PACKAGING SETTINGS
        <div className="space-y-4 max-w-xl bg-white p-6 rounded-2xl border">
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-xl text-brand-ink">Configurações de Embalagem Padrão</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Defina os acréscimos aplicados automaticamente às dimensões e ao peso real de cada peça antes de submeter a cotação logística aos Correios ou transportadoras.
            </p>
          </div>

          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await setDoc(doc(db, 'ecom_settings', 'packaging'), {
                  extraHeight: Number(packagingSettings.extraHeight),
                  extraWidth: Number(packagingSettings.extraWidth),
                  extraLength: Number(packagingSettings.extraLength),
                  extraWeight: Number(packagingSettings.extraWeight)
                });
                alert('Configurações de embalagem salvas e ativadas com sucesso!');
              } catch (err: any) {
                console.error("Erro ao salvar embalagem padrão:", err);
                alert(`Erro: ${err.message}`);
              }
            }}
            className="space-y-4 pt-2 text-xs"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide">Acréscimo de Altura (cm)</label>
                <input 
                  type="number" 
                  step="1"
                  required
                  value={packagingSettings.extraHeight}
                  onChange={e => setPackagingSettings({...packagingSettings, extraHeight: Number(e.target.value)})}
                  className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-1 focus:ring-brand-wood text-brand-ink"
                />
              </div>
              <div>
                <label className="block text-gray-550 font-bold mb-1.5 uppercase tracking-wide">Acréscimo de Largura (cm)</label>
                <input 
                  type="number" 
                  step="1"
                  required
                  value={packagingSettings.extraWidth}
                  onChange={e => setPackagingSettings({...packagingSettings, extraWidth: Number(e.target.value)})}
                  className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-1 focus:ring-brand-wood text-brand-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-550 font-bold mb-1.5 uppercase tracking-wide">Acréscimo de Comprimento (cm)</label>
                <input 
                  type="number" 
                  step="1"
                  required
                  value={packagingSettings.extraLength}
                  onChange={e => setPackagingSettings({...packagingSettings, extraLength: Number(e.target.value)})}
                  className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-1 focus:ring-brand-wood text-brand-ink"
                />
              </div>
              <div>
                <label className="block text-gray-550 font-bold mb-1.5 uppercase tracking-wide">Peso Adicional de Embalagem (kg)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={packagingSettings.extraWeight}
                  onChange={e => setPackagingSettings({...packagingSettings, extraWeight: Number(e.target.value)})}
                  className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-bold outline-none focus:ring-1 focus:ring-brand-wood text-brand-ink"
                />
              </div>
            </div>

            <button 
              type="submit"
              className="bg-brand-wood hover:bg-brand-clay text-white px-6 py-2.5 rounded-full font-bold transition-all w-full md:w-auto shadow-sm shadow-brand-wood/10 cursor-pointer text-xs"
            >
              Confirmar & Salvar Configurações
            </button>
          </form>
        </div>
      )}

      {/* Detail Modal overlay for orders panel */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSelectedOrder(null)} />
            
            <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[85vh] overflow-y-auto z-10 p-6 md:p-8 relative shadow-2xl text-xs font-sans">
              <button 
                onClick={() => setSelectedOrder(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-150 text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-6">
                <div>
                  <h3 className="font-serif font-bold text-lg text-brand-ink leading-tight">Gasto Geral Detalhado do Pedido</h3>
                  <span className="font-mono text-gray-400">{selectedOrder.id}</span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Delivery address details */}
                  <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
                    <span className="font-bold text-[10px] text-brand-wood uppercase tracking-wider block flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Endereço do Destinatário</span>
                    </span>
                    <div className="space-y-1 text-[11px] text-gray-600 font-medium">
                      <div className="font-bold text-brand-ink">{selectedOrder.customerInfo.name}</div>
                      <div>Cpf: {selectedOrder.customerInfo.cpf}</div>
                      <div>Rua {selectedOrder.customerInfo.street}, {selectedOrder.customerInfo.number} {selectedOrder.customerInfo.complement ? `(${selectedOrder.customerInfo.complement})` : ''}</div>
                      <div>Bairro: {selectedOrder.customerInfo.neighborhood} — CEP: {selectedOrder.customerInfo.cep}</div>
                      <div>{selectedOrder.customerInfo.city}, {selectedOrder.customerInfo.state}</div>
                    </div>
                  </div>

                  {/* Shipment codes setter */}
                  <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                    <span className="font-bold text-[10px] text-brand-wood uppercase tracking-wider block flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" />
                      <span>Restauração e Frete (MelhorEnvio)</span>
                    </span>
                    <div className="text-[11px] text-gray-600 font-medium">
                      <div>Transporte preferido: <span className="font-bold uppercase text-brand-wood">{selectedOrder.shippingMethod}</span></div>
                      <div className="mt-1">Custo: R$ {selectedOrder.shippingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Código de Rastreamento</label>
                      <div className="flex gap-1.5">
                        <input 
                          type="text" 
                          id={`track-code-input-${selectedOrder.id}`}
                          placeholder="Ex: ME-4828-9102" 
                          defaultValue={selectedOrder.trackingCode || ''}
                          className="bg-white border rounded-lg px-2.5 py-1.5 font-semibold text-[10px] flex-grow outline-none focus:ring-1 focus:ring-brand-wood"
                        />
                        <button 
                          onClick={() => {
                            const inputElem = document.getElementById(`track-code-input-${selectedOrder.id}`) as HTMLInputElement;
                            if (inputElem) {
                              handleSaveTrackingCode(selectedOrder.id!, inputElem.value);
                            }
                          }}
                          className="bg-brand-wood text-white px-3.5 rounded-lg font-bold hover:bg-brand-clay text-[9px] transition-all cursor-pointer"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <span className="font-bold text-[10px] text-brand-wood uppercase tracking-wider block flex items-center gap-1.5 mb-2">
                    <Package className="w-4 h-4" />
                    <span>Detalhes do Carrinho</span>
                  </span>

                  <div className="space-y-2 max-h-[140px] overflow-y-auto">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-[#FAFAFA] p-2.5 rounded-lg border gap-4">
                        <div className="min-w-0">
                          <span className="font-bold text-brand-wood">{item.quantity}x</span>{' '}
                          <span className="font-semibold text-brand-ink truncate inline-block max-w-[300px] align-middle">{item.name}</span>
                        </div>
                        <span className="font-mono text-gray-500 font-semibold flex-shrink-0">
                          R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3 mt-3 text-right space-y-1 bg-[#FAFAFA] p-3 rounded-xl border">
                    <div className="text-gray-450 font-medium">Subtotal Obras: R$ {selectedOrder.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-gray-450 font-medium">Custo Frete: R$ {selectedOrder.shippingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    <div className="text-sm font-bold text-brand-ink">Total Geral Pago: <span className="text-brand-wood font-mono text-base ml-1">R$ {selectedOrder.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail & Response Modal overlay for quotes panel */}
      <AnimatePresence>
        {selectedQuote && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSelectedQuote(null)} />
            
            <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[85vh] overflow-y-auto z-10 p-6 md:p-8 relative shadow-2xl text-xs font-sans">
              <button 
                onClick={() => setSelectedQuote(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-150 text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-6">
                <div>
                  <h3 className="font-serif font-bold text-lg text-brand-ink leading-tight">Cotação Especial de Frete</h3>
                  <span className="font-mono text-gray-450">ID: {selectedQuote.id}</span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Customer details info */}
                  <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
                    <span className="font-bold text-[10px] text-brand-wood uppercase tracking-wider block flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Dados do Cliente</span>
                    </span>
                    <div className="space-y-1 text-[11px] text-gray-600 font-medium">
                      <div className="font-bold text-brand-ink">{selectedQuote.customerInfo.name}</div>
                      <div>E-mail: {selectedQuote.customerInfo.email}</div>
                      <div>Telefone: {selectedQuote.customerInfo.phone}</div>
                      <div>CEP: {selectedQuote.customerInfo.cep}</div>
                      <div>Cidade/Estado: {selectedQuote.customerInfo.city}, {selectedQuote.customerInfo.state}</div>
                      <div>País: {selectedQuote.customerInfo.country}</div>
                    </div>
                  </div>

                  {/* Requested item details */}
                  <div className="bg-gray-50 p-4 rounded-xl border space-y-2 flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-[10px] text-brand-wood uppercase tracking-wider block flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        <span>Produto Solicitado</span>
                      </span>
                      <div className="mt-2 text-[11px] text-gray-600 font-medium space-y-0.5">
                        <div className="font-bold text-brand-ink">{selectedQuote.productName}</div>
                        <div>Preço unitário: R$ {selectedQuote.productPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div>Quantidade solicitada: <span className="font-mono font-bold text-brand-wood">{selectedQuote.quantity} un.</span></div>
                        {selectedQuote.notes && (
                          <div className="mt-2 text-xs italic bg-white p-2 border rounded-md">
                            " {selectedQuote.notes} "
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedQuote.productImage && (
                      <div className="h-12 w-full mt-2 rounded border overflow-hidden bg-slate-100 flex items-center justify-center p-1 self-end">
                        <img src={ensureRobustUrl(selectedQuote.productImage)} className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Response fields inputs */}
                <div className="border-t pt-4 space-y-4">
                  <span className="font-bold text-[10px] text-brand-wood uppercase tracking-wider block flex items-center gap-1.5">
                    <Truck className="w-4 h-4" />
                    <span>Formulário de Resposta e Proposta</span>
                  </span>

                  {selectedQuote.status === 'Respondida' || selectedQuote.status === 'Finalizada' ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 space-y-1.5">
                      <p className="font-bold text-sm">Esta proposta de frete já foi enviada!</p>
                      <div className="text-[11px] space-y-1 font-medium text-emerald-700">
                        <div>Transportadora: <b>{selectedQuote.response?.carrier}</b></div>
                        <div>Custo da logística: <b>R$ {selectedQuote.response?.shippingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b></div>
                        <div>Prazo de transporte: <b>{selectedQuote.response?.deliveryTime} dias úteis</b></div>
                        {selectedQuote.response?.notes && <div>Observações: <i>{selectedQuote.response?.notes}</i></div>}
                      </div>

                      {selectedQuote.response?.orderId && (
                        <div className="mt-3 pt-3 border-t border-emerald-200/50 flex align-middle justify-between">
                          <span className="font-semibold text-xs text-brand-ink">Código do pedido gerado associado:</span>
                          <span className="font-mono font-bold text-brand-ink bg-white px-2 py-0.5 border rounded">{selectedQuote.response.orderId}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!quoteResponse.shippingCost || !quoteResponse.carrier || !quoteResponse.deliveryTime) {
                          alert("Por favor preencha o custo, transportadora e prazo previstos.");
                          return;
                        }

                        try {
                          const resPayload = {
                            shippingCost: parseFloat(quoteResponse.shippingCost) || 0,
                            carrier: quoteResponse.carrier.trim(),
                            deliveryTime: parseInt(quoteResponse.deliveryTime, 10) || 5,
                            notes: quoteResponse.notes.trim()
                          };

                          // Call api to respond quote (this handles database, pending order creation & emailing in backend to guarantee 100% security)
                          const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
                          const responseMe = await fetch('/api/vendas/quotes/respond', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${idToken}`
                            },
                            body: JSON.stringify({
                              quoteId: selectedQuote.id,
                              responseValue: resPayload
                            })
                          });

                          if (responseMe.ok) {
                            const ansData = await responseMe.json();
                            alert(`Cotação respondida com sucesso! Pedido de checkout gerado: ${ansData.orderId}`);
                            setSelectedQuote(null);
                          } else {
                            const errBody = await responseMe.json();
                            throw new Error(errBody.error || 'Erro desconhecido na API');
                          }
                        } catch (err: any) {
                          console.error("Falha ao responder cotação:", err);
                          alert(`Falha ao responder cotação: ${err.message}`);
                        }
                      }}
                      className="space-y-3 font-medium"
                    >
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1">Custo do Frete (R$)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            required 
                            placeholder="Ex: 120.00" 
                            value={quoteResponse.shippingCost}
                            onChange={e => setQuoteResponse({...quoteResponse, shippingCost: e.target.value})}
                            className="bg-white border rounded-lg p-2 font-bold w-full outline-none focus:ring-1 focus:ring-brand-wood"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1">Transportadora</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="Ex: Jadlog" 
                            value={quoteResponse.carrier}
                            onChange={e => setQuoteResponse({...quoteResponse, carrier: e.target.value})}
                            className="bg-white border rounded-lg p-2 font-bold w-full outline-none focus:ring-1 focus:ring-brand-wood"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1">Prazo de Entrega (dias)</label>
                          <input 
                            type="number" 
                            required 
                            placeholder="Ex: 5" 
                            value={quoteResponse.deliveryTime}
                            onChange={e => setQuoteResponse({...quoteResponse, deliveryTime: e.target.value})}
                            className="bg-white border rounded-lg p-2 font-bold w-full outline-none focus:ring-1 focus:ring-brand-wood"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1 font-bold">Instruções ou Observações para o Cliente</label>
                        <textarea 
                          rows={2} 
                          placeholder="Cuidados, forma de embalagem reforçada para obra de arte, etc..." 
                          value={quoteResponse.notes}
                          onChange={e => setQuoteResponse({...quoteResponse, notes: e.target.value})}
                          className="bg-white border rounded-lg p-2 w-full outline-none focus:ring-1 focus:ring-brand-wood text-[11px]"
                        />
                      </div>

                      <button 
                        type="submit"
                        className="bg-brand-wood text-white px-5 py-3 rounded-xl font-bold hover:bg-brand-clay transition-all cursor-pointer w-full text-[11px] uppercase tracking-wider"
                      >
                        Salvar Proposta & Enviar E-mail ao Cliente
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
