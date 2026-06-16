import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, orderBy } from '../firebase';
import { EcomProduct, CartItem } from '../types';
import { ArrowLeft, Home, Calendar, ExternalLink, ShieldCheck, Heart, ShoppingBag, Truck, Tag, Info, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ensureRobustUrl } from '../App';
import { slugify } from './GalleryItemPage';

// Get the slug for an ecom product (database slug, or slugify name fallback, or ID fallback)
export function getProductSlug(p: EcomProduct): string {
  if (p.slug && p.slug.trim().length > 0) return p.slug.trim();
  if (p.name && p.name.trim().length > 0) return slugify(p.name);
  return p.id || "";
}

interface VendasItemPageProps {
  slug: string;
  onNavigateToView: (view: any, id?: string) => void;
}

export const VendasItemPage: React.FC<VendasItemPageProps> = ({ slug, onNavigateToView }) => {
  const [products, setProducts] = useState<EcomProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'ecom_products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const prodData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as EcomProduct[];
        setProducts(prodData);
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar obras à venda na página de detalhes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Find the current active product by matching the current slug or matching by ID
  const activeProduct = products.find(p => getProductSlug(p) === slug || p.id === slug);

  if (loading) {
    return (
      <div className="pt-28 pb-20 bg-brand-paper min-h-screen flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-brand-wood/20 border-t-brand-wood rounded-full animate-spin"></div>
        <p className="text-sm text-gray-400 font-medium">Carregando detalhes do produto...</p>
      </div>
    );
  }

  if (!activeProduct) {
    return (
      <div className="pt-28 pb-20 bg-brand-paper min-h-screen text-center flex flex-col justify-center items-center px-6">
        <div className="max-w-md bg-white border border-brand-wood/10 rounded-[2rem] p-8 shadow-sm">
          <h2 className="font-serif text-2xl text-brand-ink mb-2">Obra não encontrada</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            A obra da seção Vendas que você procura não foi localizada ou o link foi modificado.
          </p>
          <button
            onClick={() => onNavigateToView('landing')}
            className="bg-brand-wood hover:bg-brand-wood-dark text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Home className="w-4 h-4" /> Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  // Get related products in same category (excluding current item)
  const relatedProducts = products
    .filter(p => p.category === activeProduct.category && p.id !== activeProduct.id)
    .slice(0, 4);

  // If we don't have enough, fill in with any other products
  const suggestedProducts = relatedProducts.length > 0 
    ? relatedProducts 
    : products.filter(p => p.id !== activeProduct.id).slice(0, 4);

  // Add the current item to localStorage shopping cart
  const handleAddToCart = (directCheckout = false) => {
    if (activeProduct.stock <= 0) return;

    try {
      const saved = localStorage.getItem('ecom_cart');
      const cartItems: CartItem[] = saved ? JSON.parse(saved) : [];
      
      const existsIndex = cartItems.findIndex(item => item.id === activeProduct.id);
      if (existsIndex > -1) {
        const newQty = Math.min(activeProduct.stock, cartItems[existsIndex].quantity + 1);
        cartItems[existsIndex].quantity = newQty;
      } else {
        cartItems.push({
          ...activeProduct,
          quantity: 1
        } as CartItem);
      }

      localStorage.setItem('ecom_cart', JSON.stringify(cartItems));
      window.dispatchEvent(new Event('cart-updated'));

      if (directCheckout) {
        localStorage.setItem('ecom_open_cart', 'true');
        onNavigateToView('vendas');
      } else {
        setShowMessage(true);
        setTimeout(() => setShowMessage(false), 4000);
      }
    } catch (e) {
      console.error("Erro ao adicionar obra ao carrinho por localStorage:", e);
    }
  };

  const images = activeProduct.images && activeProduct.images.length > 0 
    ? activeProduct.images.map(url => ensureRobustUrl(url))
    : ['https://images.unsplash.com/photo-1549490349-8643362247b5?q=80&w=687'];

  const isOutOfStock = activeProduct.stock <= 0;

  return (
    <div className="pt-28 pb-20 bg-brand-paper min-h-screen">
      {/* Header / Breadcrumb Section */}
      <div className="max-w-7xl mx-auto px-6 mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400 mb-6">
          <button 
            onClick={() => onNavigateToView('landing')} 
            className="hover:text-brand-wood transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" /> Início
          </button>
          <span className="text-gray-300">/</span>
          <button 
            onClick={() => {
              onNavigateToView('vendas');
            }} 
            className="hover:text-brand-wood transition-colors cursor-pointer"
          >
            Loja Oficial
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-brand-wood font-semibold truncate max-w-[120px] md:max-w-xs">{activeProduct.name}</span>
        </div>

        <button 
          onClick={() => {
            onNavigateToView('vendas');
          }}
          className="group hover:text-brand-wood text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer text-brand-ink mb-6"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Voltar à Loja Oficial
        </button>
      </div>

      {/* Main Detail Grid */}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
        
        {/* Left Column - High-Res Image Display & Gallery */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-4 rounded-3xl border border-brand-wood/10 shadow-lg relative overflow-hidden aspect-square max-h-[600px] w-full flex items-center justify-center"
          >
            <img 
              src={images[activeImgIndex]} 
              alt={activeProduct.name}
              className="max-w-full max-h-full object-contain rounded-2xl select-text transition-transform duration-500 hover:scale-102"
              referrerPolicy="no-referrer"
            />
            
            {/* Category Indicator Badge */}
            <div className="absolute top-4 left-4 bg-brand-wood/95 text-white px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest pointer-events-none">
              {activeProduct.category}
            </div>
          </motion.div>

          {/* Thumbnails list */}
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto py-1 scrollbar-hide">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImgIndex(idx)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 bg-white p-1 flex-shrink-0 transition-all ${
                    idx === activeImgIndex ? 'border-brand-wood scale-102' : 'border-gray-200 hover:border-brand-clay'
                  }`}
                >
                  <img src={imgUrl} alt={`${activeProduct.name} view ${idx + 1}`} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer"/>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Product Buy Actions & Details */}
        <div className="lg:col-span-5 flex flex-col justify-start">
          <div className="space-y-6">
            <div>
              <span className="text-brand-clay font-medium block text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Peça Exclusiva do Ateliê
              </span>
              <h1 className="text-3xl md:text-4xl font-serif text-brand-ink tracking-tight mb-3">
                {activeProduct.name}
              </h1>
              <div className="h-1 w-16 bg-brand-wood/40 rounded-full"></div>
            </div>

            {/* Price block */}
            <div className="bg-brand-paper hover:bg-brand-paper border border-brand-wood/15 rounded-2xl p-5">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block mb-0.5">Valor da Obra</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-brand-ink font-serif">
                  R$ {activeProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-gray-400 font-medium">via MercadoPago Protegido</span>
              </div>

              {/* Stock Indicator */}
              <div className="mt-3 flex items-center gap-2">
                {isOutOfStock ? (
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                    Obra Indisponível (Esgotada)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Disponível — {activeProduct.stock} peças exclusivas
                  </span>
                )}
              </div>
            </div>

            {/* Complete Description */}
            <div className="space-y-3">
              <h3 className="font-serif text-md font-bold text-brand-ink flex items-center gap-1.5">
                <Info className="w-4 h-4 text-brand-wood" /> Descrição da Obra
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                {activeProduct.description || "Esta linda peça de arte foi modelada e refinada individualmente no Ateliê Andrew Lemos, agregando sofisticação, detalhes orgânicos e elegância cultural única para sua coleção."}
              </p>
            </div>

            {/* Technical characteristics */}
            <div className="space-y-3 pt-2">
              <h3 className="font-serif text-md font-bold text-brand-ink flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-clay" /> Informações Técnicas e Dimensões
              </h3>
              <div className="bg-white border border-gray-150 rounded-2xl p-4 grid grid-cols-2 gap-4 text-xs font-semibold text-brand-ink">
                <div>
                  <span className="text-gray-400 font-medium block">Dimensões (AxLxC):</span>
                  <span>{activeProduct.height}cm x {activeProduct.width}cm x {activeProduct.length}cm</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Peso Total:</span>
                  <span>{activeProduct.weight} kg</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Logística de Entrega:</span>
                  <span>
                    {activeProduct.shippingType === 'quote' 
                      ? "Frete sob Consulta (Transportadora Especializada)" 
                      : "Cálculo Automático via MelhorEnvio"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Certificação Artística:</span>
                  <span className="text-brand-wood flex items-center gap-1 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5" /> Assinado e Autentificado
                  </span>
                </div>
              </div>
            </div>

            {/* Add to Cart Actions */}
            <div className="pt-4 space-y-3">
              {!isOutOfStock ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAddToCart(false)}
                    className="w-full bg-white border border-brand-wood text-brand-wood py-3.5 rounded-full font-bold hover:bg-brand-paper hover:shadow-sm transition-all text-xs cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <ShoppingBag className="w-4 h-4" /> Adicionar ao Carrinho
                  </button>
                  <button
                    onClick={() => handleAddToCart(true)}
                    className="w-full bg-brand-wood text-white py-3.5 rounded-full font-bold hover:bg-brand-clay hover:shadow-lg hover:-translate-y-0.5 transition-all text-xs cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    Comprar Agora
                  </button>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-700 font-medium leading-relaxed">
                  Esta obra encontra-se esgotada atualmente no ateliê. Para encomendar uma obra similar personalizada ou tirar dúvidas diretamente com o mestre escultor, entre em contato via WhatsApp no botão de atendimento no rodapé.
                </div>
              )}

              {/* Toast Messages */}
              <AnimatePresence>
                {showMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center justify-between"
                  >
                    <span>Obra adicionada ao carrinho com sucesso!</span>
                    <button 
                      onClick={() => {
                        localStorage.setItem('ecom_open_cart', 'true');
                        onNavigateToView('vendas');
                      }}
                      className="text-brand-wood hover:underline text-[11px] font-bold"
                    >
                      Ir para Checkout →
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Works section */}
      {suggestedProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 border-t border-brand-wood/10 pt-16 mt-16">
          <div className="mb-10 text-left">
            <span className="text-xs uppercase tracking-widest text-[#B5A496] font-semibold">Descubra Mais Peças</span>
            <h2 className="text-3xl font-serif text-brand-ink font-bold mt-1">Obras de Arte Relacionadas</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {suggestedProducts.map((p) => {
              const isPOutOfStock = p.stock <= 0;
              const prodImg = p.images && p.images.length > 0 ? ensureRobustUrl(p.images[0]) : '';
              const detailSlug = getProductSlug(p);

              return (
                <div 
                  key={p.id} 
                  className="bg-white rounded-2xl overflow-hidden border border-brand-wood/5 flex flex-col hover:shadow-lg transition-all duration-300 group cursor-pointer"
                  onClick={() => onNavigateToView('vendas-item', detailSlug)}
                >
                  <div className="relative aspect-square bg-[#FAFAFA] flex items-center justify-center p-4 overflow-hidden min-h-[180px]">
                    {prodImg ? (
                      <img 
                        src={prodImg} 
                        alt={p.name} 
                        className="w-full h-full object-contain max-h-[90%] group-hover:scale-103 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-xs text-gray-400 font-mono">Sem Imagem</div>
                    )}
                    {isPOutOfStock && (
                      <span className="absolute top-3 left-3 bg-red-500 text-white text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shadow-sm z-10">
                        Esgotado
                      </span>
                    )}
                  </div>

                  <div className="p-4 flex flex-col flex-grow text-left">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider block mb-0.5">{p.category}</span>
                    <h4 className="font-serif text-md font-bold text-brand-ink leading-tight mb-2 truncate group-hover:text-brand-wood transition-colors">{p.name}</h4>
                    <div className="pt-3 border-t border-brand-wood/5 mt-auto flex items-center justify-between">
                      <span className="text-sm font-bold text-brand-ink font-mono">
                        R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-brand-wood font-bold group-hover:underline">Visualizar →</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
