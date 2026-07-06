import React, { useState, useEffect } from 'react';
import { auth, db, collection, onSnapshot, query, orderBy } from '../firebase';
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
  
  // Auth states & Listening
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Billing details states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [cepLoading, setCepLoading] = useState(false);
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

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

  // Fetch ecom customer data if user is already logged in
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.displayName || '');
      setAuthEmail(currentUser.email || '');
      
      const fetchCustomerDetails = async () => {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const customerSnap = await getDoc(doc(db, 'ecom_customers', currentUser.uid));
          if (customerSnap.exists()) {
            const data = customerSnap.data();
            if (data.name) setName(data.name);
            if (data.phone) setPhone(data.phone);
            if (data.cpf) setCpf(data.cpf);
            if (data.cep) setCep(data.cep);
            if (data.street) setStreet(data.street);
            if (data.number) setNumber(data.number);
            if (data.complement) setComplement(data.complement);
            if (data.neighborhood) setNeighborhood(data.neighborhood);
            if (data.city) setCity(data.city);
            if (data.state) setState(data.state);
          }
        } catch (err) {
          console.warn("[VendasItemPage] Error fetching customer details:", err);
        }
      };
      fetchCustomerDetails();
    }
  }, [currentUser]);

  // Handle automatic CEP lookup
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setCep(rawValue);
    
    if (rawValue.length === 8) {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${rawValue}/json/`);
        const address = await response.json();
        if (!address.erro) {
          setStreet(address.logradouro || '');
          setNeighborhood(address.bairro || '');
          setCity(address.localidade || '');
          setState(address.uf || '');
        }
      } catch (err) {
        console.warn("CEP lookup failed:", err);
      } finally {
        setCepLoading(false);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError("Preencha e-mail e senha para fazer login.");
      return;
    }
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
    } catch (err: any) {
      setAuthError("E-mail ou senha incorretos.");
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');
    
    // Check validation fields
    const missingFields: string[] = [];
    if (!name.trim()) missingFields.push("Nome Completo");
    if (!authEmail.trim()) missingFields.push("E-mail");
    if (!phone.trim()) missingFields.push("Telefone");
    if (!cpf.trim()) missingFields.push("CPF");
    if (!cep.trim()) missingFields.push("CEP");
    if (!street.trim()) missingFields.push("Endereço");
    if (!number.trim()) missingFields.push("Número");
    if (!neighborhood.trim()) missingFields.push("Bairro");
    if (!city.trim()) missingFields.push("Cidade");
    if (!state.trim()) missingFields.push("Estado");

    if (!currentUser) {
      if (authTab === 'register') {
        if (!authPassword) {
          missingFields.push("Senha");
        } else if (authPassword.length < 6) {
          setCheckoutError("A senha de cadastro deve ter no mínimo 6 caracteres.");
          return;
        }
        if (authPassword !== authConfirmPassword) {
          setCheckoutError("As senhas digitadas não coincidem.");
          return;
        }
      } else {
        setCheckoutError("Por favor, faça login na sua conta clicando na aba correspondente antes de continuar.");
        return;
      }
    }

    if (missingFields.length > 0) {
      setCheckoutError(`Por favor, preencha os campos obrigatórios: ${missingFields.join(', ')}`);
      return;
    }

    setCheckoutProcessing(true);
    let activeUserId = currentUser?.uid;

    try {
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const { setDoc, doc } = await import('firebase/firestore');

      // 1. Create account dynamically if guest
      if (!activeUserId && authTab === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        const user = cred.user;
        await updateProfile(user, { displayName: name.trim() });
        
        // Save customer details
        const customerDoc = {
          name: name.trim(),
          email: authEmail.trim(),
          phone: phone.trim(),
          cpf: cpf.replace(/\D/g, '').trim(),
          cep: cep.replace(/\D/g, '').trim(),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: state.trim(),
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'ecom_customers', user.uid), customerDoc);
        activeUserId = user.uid;
      } else if (currentUser) {
        // Update user profile billing details to keep database perfectly updated
        const customerDoc = {
          name: name.trim(),
          email: authEmail.trim(),
          phone: phone.trim(),
          cpf: cpf.replace(/\D/g, '').trim(),
          cep: cep.replace(/\D/g, '').trim(),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: state.trim(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'ecom_customers', currentUser.uid), customerDoc);
      }

      // 2. Formulate order details for digital product purchase
      const orderData = {
        userId: activeUserId,
        customerInfo: {
          name: name.trim(),
          email: authEmail.trim(),
          phone: phone.trim(),
          cpf: cpf.replace(/\D/g, '').trim(),
          cep: cep.replace(/\D/g, '').trim(),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: state.trim()
        },
        items: [{
          id: activeProduct.id,
          productId: activeProduct.id,
          name: activeProduct.name,
          price: activeProduct.price,
          category: activeProduct.category,
          quantity: 1,
          images: images
        }],
        shippingMethod: 'Acesso Digital Imediato',
        shippingCost: 0,
        couponCode: null,
        cartId: null
      };

      const res = await fetch('/api/vendas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.orderId) {
          onNavigateToView('checkout-pay', data.orderId);
        } else {
          setCheckoutError(`Erro ao iniciar checkout: ${data.error || 'Erro desconhecido'}`);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setCheckoutError(`Erro no servidor: ${errData.error || 'Falha na conexão'}`);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setCheckoutError("Este e-mail já está cadastrado em nossa plataforma. Selecione a aba 'Já tenho conta' e faça o login para continuar.");
      } else {
        setCheckoutError(`Falha no checkout: ${err.message || err}`);
      }
    } finally {
      setCheckoutProcessing(false);
    }
  };

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

  if (activeProduct.category === 'Apostilas & E-books') {
    return (
      <div className="pt-28 pb-20 bg-[#FAF9F5] min-h-screen">
        {/* Breadcrumbs */}
        <div className="max-w-7xl mx-auto px-6 mb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#B5A496] mb-6">
            <button onClick={() => onNavigateToView('landing')} className="hover:text-brand-wood transition-colors flex items-center gap-1 cursor-pointer">
              <Home className="w-3.5 h-3.5" /> Início
            </button>
            <span className="text-gray-300">/</span>
            <button onClick={() => onNavigateToView('vendas')} className="hover:text-brand-wood transition-colors cursor-pointer">
              Apostilas Digitais
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-brand-wood font-semibold truncate max-w-xs">{activeProduct.name}</span>
          </div>

          <button 
            onClick={() => onNavigateToView('vendas')}
            className="group hover:text-brand-wood text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer text-brand-ink mb-6"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Voltar às Apostilas
          </button>
        </div>

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
          {/* Cover and details */}
          <div className="lg:col-span-7 space-y-8 text-left">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 bg-brand-wood/10 text-brand-wood text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-brand-wood/20">
                <Sparkles className="w-3.5 h-3.5" /> Apostila & E-book Digital
              </span>
              <h1 className="text-3xl md:text-5xl font-serif text-brand-ink tracking-tight font-bold">
                {activeProduct.name}
              </h1>
              <p className="text-md text-gray-500 leading-relaxed max-w-2xl font-medium">
                Desenvolva novas competências artísticas no seu próprio ritmo com o método consagrado da Academia de Artes Andrew Lemos.
              </p>
            </div>

            {/* Visual cover mockup */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-brand-wood/10 shadow-lg relative overflow-hidden flex items-center justify-center aspect-[4/3] max-h-[450px]">
              <img 
                src={images[0]} 
                alt={activeProduct.name}
                className="max-h-full max-w-full object-contain shadow-2xl rounded-xl transition-transform hover:scale-102"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Bento features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-brand-wood/5 shadow-sm text-left">
                <ShieldCheck className="w-6 h-6 text-brand-wood mb-3" />
                <h4 className="font-serif font-bold text-sm text-brand-ink mb-1">Acesso Vitalício</h4>
                <p className="text-xs text-gray-500 leading-relaxed font-semibold">Leitura digital livre, vitalícia e atualizações gratuitas.</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-brand-wood/5 shadow-sm text-left">
                <Sparkles className="w-6 h-6 text-brand-clay mb-3" />
                <h4 className="font-serif font-bold text-sm text-brand-ink mb-1">Material de Excelência</h4>
                <p className="text-xs text-gray-500 leading-relaxed font-semibold">Passo a passo rico ilustrado com fotos e técnicas consagradas.</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-brand-wood/5 shadow-sm text-left">
                <Truck className="w-6 h-6 text-brand-wood mb-3" />
                <h4 className="font-serif font-bold text-sm text-brand-ink mb-1">Entrega Imediata</h4>
                <p className="text-xs text-gray-500 leading-relaxed font-semibold">Sem frete ou espera. Receba o acesso no e-mail logo após aprovação.</p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-4 pt-4 border-t border-brand-wood/10">
              <h3 className="font-serif text-lg font-bold text-brand-ink flex items-center gap-2">
                <Info className="w-5 h-5 text-brand-wood" /> O que você irá aprender neste manual:
              </h3>
              <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                {activeProduct.description || "Material de formação autoral com as principais orientações, guias de ferramentas, técnicas de afiação e exercícios práticos."}
              </div>
            </div>
          </div>

          {/* Checkout & Price Card Column */}
          <div className="lg:col-span-5 text-left">
            <div className="sticky top-28 bg-white rounded-3xl border border-brand-wood/15 p-6 md:p-8 shadow-xl space-y-6">
              {/* Product brief info */}
              <div className="border-b border-brand-wood/10 pb-4">
                <span className="text-[10px] uppercase tracking-widest text-[#B5A496] font-bold block mb-1">Você está adquirindo:</span>
                <h3 className="font-serif font-bold text-lg text-brand-ink leading-tight">{activeProduct.name}</h3>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-3xl font-bold text-brand-ink font-serif">
                    R$ {activeProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">Taxa única • Sem mensalidades</span>
                </div>
              </div>

              {/* Secure Checkout Title */}
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Checkout 100% Seguro e Criptografado</span>
              </div>

              {/* Error messages */}
              {checkoutError && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs text-red-700 font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Login tab or register tabs if user is not logged in */}
              {!currentUser ? (
                <div className="space-y-4">
                  {/* Tab Selector */}
                  <div className="grid grid-cols-2 gap-2 bg-brand-paper p-1 rounded-xl border border-brand-wood/5">
                    <button
                      type="button"
                      onClick={() => { setAuthTab('register'); setCheckoutError(''); setAuthError(''); }}
                      className={`py-2 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                        authTab === 'register' ? 'bg-white text-brand-wood shadow-sm' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Criar Conta Aluno
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthTab('login'); setCheckoutError(''); setAuthError(''); }}
                      className={`py-2 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                        authTab === 'login' ? 'bg-white text-brand-wood shadow-sm' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Já tenho Conta
                    </button>
                  </div>

                  {authTab === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                      {authError && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-semibold">
                          {authError}
                        </div>
                      )}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">E-mail</label>
                        <input
                          type="email"
                          required
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2.5 text-sm font-semibold"
                          placeholder="seu@email.com"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Senha</label>
                        <input
                          type="password"
                          required
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2.5 text-sm font-semibold"
                          placeholder="Sua senha secreta"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-brand-wood text-white py-3.5 rounded-full font-bold hover:bg-brand-clay hover:shadow-lg transition-all text-xs cursor-pointer uppercase tracking-wider"
                      >
                        Acessar Minha Conta
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-emerald-600 tracking-wider font-bold block">Logado como:</span>
                    <span className="font-semibold text-emerald-900 text-sm">{currentUser.displayName || currentUser.email}</span>
                  </div>
                  <button 
                    onClick={() => auth.signOut()}
                    className="text-[10px] uppercase font-bold text-emerald-700 hover:underline"
                  >
                    Trocar Conta
                  </button>
                </div>
              )}

              {/* Standard checkout billing form if registered tab or logged in */}
              {(!currentUser && authTab === 'register') || currentUser ? (
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  <h4 className="font-serif text-xs font-bold text-brand-ink uppercase tracking-wider border-b border-gray-100 pb-2">
                    Informações Pessoais & Faturamento
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome Completo</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                        placeholder="Nome completo do titular"
                      />
                    </div>

                    {!currentUser && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">E-mail de Login</label>
                          <input
                            type="email"
                            required
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                            placeholder="seu@email.com"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Telefone</label>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                      </div>
                    )}

                    {currentUser && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Telefone</label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">CPF</label>
                        <input
                          type="text"
                          required
                          value={cpf}
                          onChange={(e) => setCpf(e.target.value)}
                          className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">CEP</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={cep}
                            onChange={handleCepChange}
                            maxLength={9}
                            className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold pr-8"
                            placeholder="00000-000"
                          />
                          {cepLoading && (
                            <span className="absolute right-2.5 top-2.5 w-3.5 h-3.5 border-2 border-brand-wood/20 border-t-brand-wood rounded-full animate-spin"></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Endereço</label>
                      <input
                        type="text"
                        required
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                        placeholder="Av, Rua, Logradouro"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Número</label>
                        <input
                          type="text"
                          required
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                          placeholder="Nº"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Complemento</label>
                        <input
                          type="text"
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                          className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                          placeholder="Apto, Bloco, etc."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bairro</label>
                        <input
                          type="text"
                          required
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          className="w-full bg-[#FAF9F5] border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                          placeholder="Bairro"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Cidade / UF</label>
                        <input
                          type="text"
                          required
                          value={city ? `${city} - ${state}` : ''}
                          readOnly
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-semibold text-gray-500 cursor-not-allowed"
                          placeholder="Preenchido por CEP"
                        />
                      </div>
                    </div>

                    {/* New account credentials password section if registration tab */}
                    {!currentUser && authTab === 'register' && (
                      <div className="bg-[#FAF9F5] p-4 rounded-2xl border border-brand-wood/10 space-y-3">
                        <span className="text-[10px] uppercase text-[#B5A496] font-bold tracking-wider block">Crie uma Senha para sua Área do Aluno:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Definir Senha</label>
                            <input
                              type="password"
                              required
                              value={authPassword}
                              onChange={(e) => setAuthPassword(e.target.value)}
                              className="w-full bg-white border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                              placeholder="Mínimo 6 dígitos"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Confirmar Senha</label>
                            <input
                              type="password"
                              required
                              value={authConfirmPassword}
                              onChange={(e) => setAuthConfirmPassword(e.target.value)}
                              className="w-full bg-white border border-gray-200 focus:border-brand-wood focus:ring-0 rounded-xl px-4 py-2 text-xs font-semibold"
                              placeholder="Confirmar"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={checkoutProcessing}
                    className="w-full bg-brand-wood hover:bg-brand-clay text-white py-4 rounded-full font-bold hover:shadow-lg transition-all text-xs cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2 mt-4"
                  >
                    {checkoutProcessing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        Processando Pedido...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" /> Finalizar e Ir para Pagamento
                      </>
                    )}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
