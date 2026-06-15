import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  Search, 
  Filter, 
  X, 
  Minus, 
  Plus, 
  Trash2, 
  Truck, 
  ArrowRight, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  AlertCircle,
  Lock
} from 'lucide-react';
import { db, auth, setDoc, collection, query, onSnapshot, orderBy, handleFirestoreError, OperationType, addDoc } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { EcomProduct, CartItem, EcomCustomer } from '../types';

// Helper to handle Google Drive image links and path conversion
const ensureRobustUrl = (url: string) => {
  if (!url) return '';
  let processedUrl = url.trim();

  if (processedUrl.includes('drive.google.com')) {
    const fileDMatch = processedUrl.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
    if (fileDMatch && fileDMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
    }
    const queryIdMatch = processedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (queryIdMatch && queryIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${queryIdMatch[1]}`;
    }
  }

  if ((processedUrl.startsWith('http://') || processedUrl.startsWith('https://')) && !processedUrl.includes('/arquivos/')) {
    return processedUrl;
  }

  if (processedUrl.includes('/arquivos/')) {
    try {
      const parts = processedUrl.split('/arquivos/');
      if (parts.length >= 2) {
        processedUrl = `/arquivos/${parts.slice(1).join('/arquivos/')}`;
      }
    } catch (e) {}
  }

  if (!processedUrl.startsWith('http') && !processedUrl.includes('/') && (
    processedUrl.endsWith('.jpg') || 
    processedUrl.endsWith('.jpeg') || 
    processedUrl.endsWith('.png') || 
    processedUrl.endsWith('.webp') ||
    processedUrl.endsWith('.gif') ||
    processedUrl.endsWith('.PNG') ||
    processedUrl.endsWith('.JPG') ||
    processedUrl.endsWith('.JPEG')
  )) {
    processedUrl = `/arquivos/${processedUrl}`;
  }

  if (processedUrl.startsWith('/arquivos/') || processedUrl.startsWith('arquivos/')) {
    const filename = processedUrl.replace(/^\/?arquivos\//, '');
    let decoded = filename;
    try {
      decoded = decodeURIComponent(filename);
    } catch (e) {}

    const lower = decoded.toLowerCase();
    if (lower === 'capa_curso_udemy_game.jpeg') {
      return `https://raw.githubusercontent.com/andrewlemos/Andrew_Lemos_Webpage/main/public/arquivos/${encodeURIComponent(decoded)}?v=${Date.now()}`;
    }

    if (
      lower === 'favicon.png' ||
      lower === 'ico.png' ||
      lower === 'banner andrew.png' ||
      lower === 'dreamina_course_thumbnail.jpeg'
    ) {
      return `/arquivos/${encodeURIComponent(decoded)}`;
    } else {
      return `https://cdn.jsdelivr.net/gh/andrewlemos/Andrew_Lemos_Webpage@16eec916efc1342685e03616e5222f2ee1b1c784/public/arquivos/${encodeURIComponent(decoded)}`;
    }
  }

  return processedUrl;
};

interface StorefrontProps {
  onBackToMain: () => void;
  onNavigateToView: (view: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm', id?: string) => void;
  userId?: string;
}

export const Storefront: React.FC<StorefrontProps> = ({ onBackToMain, onNavigateToView, userId }) => {
  const [products, setProducts] = useState<EcomProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart state persisted in localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('ecom_cart');
    return saved ? JSON.parse(saved) : [];
  });

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [priceRange, setPriceRange] = useState<number>(10000);
  const [maxPriceInDb, setMaxPriceInDb] = useState<number>(3000);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<EcomProduct | null>(null);
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);

  // Checkout form visual flow
  const [checkoutStep, setCheckoutStep] = useState<'browsing' | 'details' | 'submitting'>('browsing');

  // Persist fetched customer profile if logged in
  const [profileLoaded, setProfileLoaded] = useState<EcomCustomer | null>(null);
  const [useProfileAddress, setUseProfileAddress] = useState(true);

  // Customer details form
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });

  const [checkoutPassword, setCheckoutPassword] = useState('');
  const [checkoutConfirmPassword, setCheckoutConfirmPassword] = useState('');

  // Recovery Coupon System States
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');

  // Load customer profile if logged in
  useEffect(() => {
    if (!userId) {
      setProfileLoaded(null);
      return;
    }

    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(db, 'ecom_customers', userId));
        if (snap.exists()) {
          const profileData = snap.data() as EcomCustomer;
          setProfileLoaded(profileData);
          setCustomerInfo({
            name: profileData.name || '',
            email: profileData.email || '',
            phone: profileData.phone || '',
            cpf: profileData.cpf || '',
            cep: profileData.cep || '',
            street: profileData.street || '',
            number: profileData.number || '',
            complement: profileData.complement || '',
            neighborhood: profileData.neighborhood || '',
            city: profileData.city || '',
            state: profileData.state || ''
          });
        }
      } catch (err) {
        console.warn("Error fetching customer profile at checkout:", err);
      }
    };

    fetchProfile();
  }, [userId]);

  // Validate coupon inside checkout front-end side
  const handleApplyCoupon = async (code: string, customerEmailOverride?: string) => {
    setCouponError('');
    setCouponSuccess('');
    setAppliedCoupon(null);
    
    const targetCode = code.trim().toUpperCase();
    if (!targetCode) {
      setCouponError('Por favor, digite um código de cupom.');
      return;
    }

    try {
      const docRef = doc(db, 'ecom_coupons', targetCode);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setCouponError('Cupom inválido ou inexistente.');
        return;
      }

      const couponData = docSnap.data();

      if (couponData?.used) {
        setCouponError('Este cupom já foi utilizado.');
        return;
      }

      const expirationDate = new Date(couponData?.expiresAt);
      if (expirationDate < new Date()) {
        setCouponError('Este cupom já expirou.');
        return;
      }

      const targetEmail = customerEmailOverride || customerInfo.email;
      if (targetEmail && targetEmail.trim() && couponData?.customerEmail.toLowerCase() !== targetEmail.trim().toLowerCase()) {
        setCouponError('Este cupom pertence a outro cliente.');
        return;
      }

      setAppliedCoupon(couponData);
      setCouponSuccess(`Cupom ${targetCode} aplicado! Desconto de ${couponData?.discountPercent}% concedido.`);
    } catch (err: any) {
      console.error("Error applying coupon:", err);
      setCouponError('Erro ao validar o cupom.');
    }
  };

  // Load Recovery Cart from URL query Parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recoverCartId = params.get('recoverCartId');
    const urlCoupon = params.get('appliedCoupon');

    if (recoverCartId) {
      console.log("[Recuperação de Carrinho] Tentando recuperar carrinho:", recoverCartId);
      const fetchRecoveredCart = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'ecom_abandoned_carts', recoverCartId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && data.items && Array.isArray(data.items)) {
              const restoredItems: CartItem[] = data.items.map((it: any) => ({
                id: it.productId,
                name: it.name,
                price: Number(it.price),
                quantity: Number(it.quantity),
                images: it.images || [],
                category: 'Madeira',
                description: 'Obra de arte recuperada do carrinho.',
                weight: 1,
                height: 10,
                width: 10,
                length: 10,
                stock: it.stock !== undefined ? Number(it.stock) : 10
              }));
              
              setCart(restoredItems);
              localStorage.setItem('ecom_cart', JSON.stringify(restoredItems));
              
              setCustomerInfo(prev => ({
                ...prev,
                name: data.customerName || '',
                email: data.customerEmail || '',
                phone: data.customerPhone || ''
              }));

              localStorage.setItem('ecom_cart_recovery_id', recoverCartId);
              setIsCartOpen(true);
              setCheckoutStep('details');

              console.log("[Recuperação de Carrinho] Carrinho e dados restaurados com sucesso!");

              if (urlCoupon) {
                setCouponCodeInput(urlCoupon);
                handleApplyCoupon(urlCoupon, data.customerEmail || '');
              }
            }
          }
        } catch (err) {
          console.error("Restoring recovered cart failed:", err);
        }
      };
      
      fetchRecoveredCart();
    }
  }, [products]);

  // Dynamic Background capture of active/abandoned carts
  useEffect(() => {
    if (cart.length === 0 || !customerInfo.name.trim() || !customerInfo.email.trim()) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        let recoveryId = localStorage.getItem('ecom_cart_recovery_id');
        if (!recoveryId) {
          recoveryId = 'CRT-' + Math.random().toString(36).substring(2, 8).toUpperCase() + Date.now().toString(36).toUpperCase();
          localStorage.setItem('ecom_cart_recovery_id', recoveryId);
        }

        const cartDoc = {
          id: recoveryId,
          customerName: customerInfo.name.trim(),
          customerEmail: customerInfo.email.trim(),
          customerPhone: customerInfo.phone.trim(),
          items: cart.map(item => ({
            productId: item.id,
            name: item.name,
            price: Number(item.price),
            quantity: Number(item.quantity),
            images: item.images || []
          })),
          total: cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0),
          lastActive: new Date().toISOString(),
          status: 'Ativo',
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'ecom_abandoned_carts', recoveryId), cartDoc, { merge: true });
        console.log("[Recuperação de Carrinho] Carrinho sincronizado no Firestore.");
      } catch (err) {
        console.warn("Silent cart capture error:", err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [cart, customerInfo.name, customerInfo.email, customerInfo.phone]);

  // Shipping
  const [shippingCep, setShippingCep] = useState('');
  const [shippingServices, setShippingServices] = useState<any[]>([]);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<any | null>(null);
  const [shippingError, setShippingError] = useState('');
  const [checkoutValidationError, setCheckoutValidationError] = useState('');

  // Shipping Quote Form States
  const [isQuoteFormOpen, setIsQuoteFormOpen] = useState(false);
  const [quoteFormData, setQuoteFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cep: '',
    notes: '',
    quantity: 1
  });
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteSuccessMessage, setQuoteSuccessMessage] = useState('');
  const [resolvedCity, setResolvedCity] = useState('');
  const [resolvedState, setResolvedState] = useState('');

  // Handle looking up CEP automatically to resolve City and State
  const lookupCepForQuote = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (res.ok) {
          const data = await res.json();
          if (!data.erro) {
            setResolvedCity(data.localidade || '');
            setResolvedState(data.uf || '');
          }
        }
      } catch (err) {
        console.warn("Failed to auto-resolve CEP details via ViaCEP:", err);
      }
    }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setIsSubmittingQuote(true);
    setQuoteSuccessMessage('');

    try {
      await addDoc(collection(db, 'ecom_quotes'), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productPrice: selectedProduct.price,
        productImage: selectedProduct.images?.[0] || "",
        customerInfo: {
          name: quoteFormData.name.trim(),
          email: quoteFormData.email.trim(),
          phone: quoteFormData.phone.trim(),
          cep: quoteFormData.cep.replace(/\D/g, ""),
          notes: quoteFormData.notes.trim(),
          city: resolvedCity || "Não Auto-resolvido",
          state: resolvedState || "Não Auto-resolvido",
          country: "Brasil"
        },
        quantity: Number(quoteFormData.quantity) || 1,
        status: "Nova",
        createdAt: new Date().toISOString()
      });

      setQuoteSuccessMessage("Sua solicitação de cotação de frete foi registrada com sucesso! Nosso mestre avaliador entrará em contato por e-mail com as propostas de transporte o quanto antes.");
      setQuoteFormData({
        name: '',
        email: '',
        phone: '',
        cep: '',
        notes: '',
        quantity: 1
      });
      setResolvedCity('');
      setResolvedState('');
    } catch (err: any) {
      console.error("Erro ao enviar solicitação de cotação:", err);
      alert(`Falha ao registrar cotação: ${err.message || err}`);
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  // Save cart to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('ecom_cart', JSON.stringify(cart));
  }, [cart]);

  // Fetch e-commerce products in real time
  useEffect(() => {
    const q = query(collection(db, 'ecom_products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EcomProduct[];
      setProducts(prods);

      if (prods.length > 0) {
        const highestPrice = Math.max(...prods.map(p => p.price));
        setMaxPriceInDb(highestPrice);
        setPriceRange(highestPrice); // initialize to highest
      }
      setLoading(false);
    }, (error) => {
       console.error("Error monitoring ecom products:", error);
       setLoading(false);
       handleFirestoreError(error, OperationType.GET, 'ecom_products');
    });

    return () => unsubscribe();
  }, []);

  // Sync shipping CEP with details form CEP
  useEffect(() => {
    if (customerInfo.cep) {
      setShippingCep(customerInfo.cep);
    }
  }, [customerInfo.cep]);

  // Handle Cart Operations
  const addToCart = (product: EcomProduct) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        // limit by stock
        const newQty = Math.min(product.stock, exists.quantity + 1);
        return prev.map(item => item.id === product.id ? { ...item, quantity: newQty } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.stock) return item; // exceed stock
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  // MelhorEnvio Shipping API calculation
  const calculateShippingCost = async (cepToUse: string) => {
    const cleanedCep = cepToUse.replace(/\D/g, "");
    if (cleanedCep.length !== 8) {
      setShippingError('Por favor, informe um CEP válido com 8 dígitos.');
      return;
    }

    const hasQuoteItem = cart.some(item => item.shippingType === 'quote');
    if (hasQuoteItem) {
      setLoadingShipping(false);
      setShippingError('');
      setShippingServices([]);
      setSelectedShipping({
        id: 'quote',
        name: 'Frete sob consulta (Orçamento personalizado)',
        price: 0,
        delivery_time: 'A definir',
        company_name: 'Sob Consulta'
      } as any);
      return;
    }

    setLoadingShipping(true);
    setShippingError('');
    setShippingServices([]);
    setSelectedShipping(null);

    try {
      const mappedItems = cart.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        weight: item.weight || 0.3,
        height: item.height || 11,
        width: item.width || 11,
        length: item.length || 16,
        quantity: item.quantity
      }));

      const response = await fetch('/api/vendas/shipping/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cep: cleanedCep, items: mappedItems })
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success && Array.isArray(resData.services)) {
          setShippingServices(resData.services);
          // auto select cheapest
          if (resData.services.length > 0) {
            setSelectedShipping(resData.services[0]);
          }
        } else {
          setShippingError('Nenhum método de entrega retornado pelo transportador.');
        }
      } else {
        throw new Error('Falha HTTP calculando frete.');
      }
    } catch (err) {
      setShippingError('Impossível consultar frete de rede temporariamente. Usando fallback estimado.');
      // Fallback
      setShippingServices([
        { id: 'pac', name: 'PAC (Correios Estimadoizado)', price: 24.90, delivery_time: 8, company_name: 'Correios' },
        { id: 'sedex', name: 'SEDEX (Correios Estimadoizado)', price: 41.50, delivery_time: 3, company_name: 'Correios' }
      ]);
      setSelectedShipping({ id: 'pac', name: 'PAC (Correios Estimadoizado)', price: 24.90, delivery_time: 8, company_name: 'Correios' });
    } finally {
      setLoadingShipping(false);
    }
  };

  // Cep auto complete helper (ViaCEP)
  const lookupCep = async (targetCep: string) => {
    const cleaned = targetCep.replace(/\D/g, "");
    if (cleaned.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
        if (res.ok) {
          const data = await res.json();
          if (!data.erro) {
            setCustomerInfo(prev => ({
              ...prev,
              cep: cleaned,
              street: data.logradouro || '',
              neighborhood: data.bairro || '',
              city: data.localidade || '',
              state: data.uf || ''
            }));
            calculateShippingCost(cleaned);
          }
        }
      } catch (err) {
        console.warn("ViaCEP calculation request failed:", err);
      }
    }
  };

  // Submit checkout order to server
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    setCheckoutValidationError('');

    const missingFields: string[] = [];
    if (!customerInfo.name || !customerInfo.name.trim()) missingFields.push("Nome Completo");
    if (!customerInfo.email || !customerInfo.email.trim()) missingFields.push("E-mail");
    if (!customerInfo.phone || !customerInfo.phone.trim()) missingFields.push("Telefone (com DDD)");
    if (!customerInfo.cpf || !customerInfo.cpf.trim()) missingFields.push("CPF");
    if (!customerInfo.cep || !customerInfo.cep.trim()) missingFields.push("CEP");
    if (!customerInfo.street || !customerInfo.street.trim()) missingFields.push("Logradouro / Rua");
    if (!customerInfo.number || !customerInfo.number.trim()) missingFields.push("Número");
    if (!customerInfo.neighborhood || !customerInfo.neighborhood.trim()) missingFields.push("Bairro");
    if (!customerInfo.city || !customerInfo.city.trim() || !customerInfo.state || !customerInfo.state.trim()) {
      missingFields.push("Cidade/Estado (digite um CEP válido)");
    }
    if (!selectedShipping) {
      missingFields.push("Forma de Envio");
    }

    if (!userId) {
      if (!checkoutPassword) {
        missingFields.push("Senha para acesso posterior");
      } else if (checkoutPassword.length < 6) {
        const passErr = "A senha de cadastro deve ter no mínimo 6 caracteres.";
        setCheckoutValidationError(passErr);
        alert(passErr);
        return;
      }
      if (checkoutPassword !== checkoutConfirmPassword) {
        const passMatchErr = "As senhas digitadas não coincidem.";
        setCheckoutValidationError(passMatchErr);
        alert(passMatchErr);
        return;
      }
    }

    if (missingFields.length > 0) {
      const errorMsgText = missingFields.join(", ");
      setCheckoutValidationError(errorMsgText);
      alert(`Por favor, preencha todos os campos obrigatórios antes de finalizar:\n\n• ${missingFields.join('\n• ')}`);
      return;
    }

    setCheckoutStep('submitting');

    let activeUserId = userId;

    // 1. DYNAMIC REGISTRATION BEFORE PLACING ORDER
    if (!activeUserId) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, customerInfo.email.trim(), checkoutPassword);
        const user = cred.user;
        
        await updateProfile(user, { displayName: customerInfo.name.trim() });
        
        const customerDoc: EcomCustomer = {
          name: customerInfo.name.trim(),
          email: customerInfo.email.trim(),
          phone: customerInfo.phone.trim(),
          cpf: customerInfo.cpf.replace(/\D/g, '').trim(),
          cep: customerInfo.cep.replace(/\D/g, '').trim(),
          street: customerInfo.street.trim(),
          number: customerInfo.number.trim(),
          complement: (customerInfo.complement || "").trim(),
          neighborhood: customerInfo.neighborhood.trim(),
          city: customerInfo.city.trim(),
          state: customerInfo.state.trim(),
          createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'ecom_customers', user.uid), customerDoc);
        activeUserId = user.uid;
      } catch (authErr: any) {
        console.error("Auth creation at checkout failed:", authErr);
        let errorFriendly = "Falha ao criar sua conta de acesso. Por favor, verifique os dados ou tente novamente.";
        if (authErr.code === 'auth/email-already-in-use') {
          errorFriendly = "Este e-mail já está cadastrado em nosso sistema. Por favor, clique no botão 'Fazer Login' acima para entrar em sua conta antes de continuar a compra.";
        } else if (authErr.code === 'auth/invalid-email') {
          errorFriendly = "O e-mail especificado é inválido.";
        } else if (authErr.message) {
          errorFriendly = authErr.message;
        }
        alert(errorFriendly);
        setCheckoutValidationError(errorFriendly);
        setCheckoutStep('details');
        return;
      }
    }

    const hasQuoteItem = cart.some(item => item.shippingType === 'quote');
    if (hasQuoteItem) {
      try {
        const subtotalVal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const quoteDoc = {
          productId: "multi",
          productName: cart.map(item => `${item.quantity}x ${item.name}`).join(' + '),
          productPrice: subtotalVal,
          productImage: cart[0]?.images?.[0] || "",
          quantity: 1,
          customerInfo: {
            name: customerInfo.name.trim(),
            email: customerInfo.email.trim(),
            phone: customerInfo.phone.trim(),
            cep: customerInfo.cep.replace(/\D/g, ""),
            street: customerInfo.street.trim(),
            number: customerInfo.number.trim(),
            neighborhood: customerInfo.neighborhood.trim(),
            complement: (customerInfo.complement || "").trim(),
            city: customerInfo.city.trim(),
            state: customerInfo.state.trim(),
            cpf: customerInfo.cpf.trim(),
            country: "Brasil"
          },
          items: cart.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            images: item.images,
            weight: item.weight || 0.3,
            height: item.height || 11,
            width: item.width || 11,
            length: item.length || 16
          })),
          status: "Nova",
          userId: activeUserId || "guest",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'ecom_quotes'), quoteDoc);

        // Clear shopping cart
        setCart([]);
        localStorage.removeItem('ecom_cart');
        setCheckoutStep('browsing');
        setIsCartOpen(false);

        alert("Sua solicitação de orçamento de frete foi enviada com sucesso! O mestre Andrew avaliará seu CEP e enviará as propostas de transporte e o link de checkout no seu e-mail cadastrado.");
      } catch (err: any) {
        console.error("Erro ao registrar cotação do carrinho:", err);
        alert(`Falha ao registrar orçamento: ${err.message || err}`);
        setCheckoutStep('details');
      }
      return;
    }
    
    try {
      const orderData = {
        userId: activeUserId || 'guest',
        customerInfo,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          images: item.images,
          weight: item.weight || 0.3,
          height: item.height || 11,
          width: item.width || 11,
          length: item.length || 16
        })),
        shippingMethod: selectedShipping.name,
        shippingServiceId: selectedShipping.id,
        shippingCost: selectedShipping.price,
        couponCode: appliedCoupon ? appliedCoupon.id : null,
        cartId: localStorage.getItem('ecom_cart_recovery_id') || null
      };

      const response = await fetch('/api/vendas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          // Clear shopping cart
          setCart([]);
          localStorage.removeItem('ecom_cart');
          localStorage.removeItem('ecom_cart_recovery_id');
          setAppliedCoupon(null);
          setCouponCodeInput('');
          setCheckoutStep('browsing');
          setIsCartOpen(false);

          // Redirect browser to checkout payment gateway URL returned!
          if (resData.redirectUrl) {
            // Check if it's a relative path (our custom simulator)
            if (resData.redirectUrl.startsWith('/')) {
              // Extract path or hash
              const matchId = resData.redirectUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
              const orderId = matchId ? matchId[1] : resData.orderId;
              onNavigateToView('checkout-pay', orderId);
            } else {
              // Attempt to open the real Mercado Pago checkout securely in a new tab to bypass Iframe sandbox policies
              window.open(resData.redirectUrl, '_blank', 'noopener,noreferrer');
              
              // Open checkout summary page as fallback so user can see details and have a manual pay button
              onNavigateToView('checkout-pay', resData.orderId);
            }
          }
        } else {
          alert(`Erro: ${resData.error || "Erro desconhecido ao registrar o pedido"}`);
          setCheckoutStep('details');
        }
      } else {
        const errorText = await response.json().catch(() => ({ error: "Erro de Comunicação HTTP com o servidor." }));
        alert(`Erro de Servidor: ${errorText.error}`);
        setCheckoutStep('details');
      }
    } catch (err) {
      alert("Falha de rede ao tentar concretizar sua compra. Por favor, tente novamente.");
      setCheckoutStep('details');
    }
  };

  // Math totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = appliedCoupon ? (subtotal * (Number(appliedCoupon.discountPercent) / 100)) : 0;
  const grandTotal = subtotal + (selectedShipping ? selectedShipping.price : 0) - discountAmount;

  // Filter products by Search query, category option, and price range
  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category)))];
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    const matchesPrice = p.price <= priceRange;
    return matchesSearch && matchesCategory && matchesPrice;
  });

  return (
    <div className="bg-brand-paper min-h-screen font-sans">
      {/* Mini Store Header */}
      <header className="bg-white border-b border-brand-wood/10 sticky top-[68px] z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button 
            onClick={onBackToMain} 
            className="flex items-center gap-2 text-brand-wood hover:text-brand-clay font-medium transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Voltar ao Início</span>
          </button>
          
          <div className="flex items-center gap-4">
            <h1 className="font-serif text-2xl font-bold text-brand-ink hidden sm:block">
              Vendas <span className="text-brand-wood font-normal italic">Artesanais</span>
            </h1>
            <div className="h-4 w-px bg-brand-wood/20 hidden sm:block"></div>
            <p className="text-xs text-gray-400 hidden lg:block">Obras de arte originais, prontas para entrega diretamente de Pirassununga/SP</p>
          </div>

          {/* Cart Icon trigger */}
          <button 
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-2 bg-brand-wood text-white px-5 py-2.5 rounded-full hover:bg-brand-clay transition-all shadow-md shadow-brand-wood/10 relative"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="text-sm font-semibold sm:inline hidden">Carrinho</span>
            <span className="bg-white text-brand-wood text-[11px] font-bold px-2 py-0.5 rounded-full shadow-inner inline-block">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          </button>
        </div>
      </header>

      {/* Main Catalog View Container */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-[250px_1fr] gap-10">
          
          {/* Filters Sidebar Column */}
          <aside className="space-y-8 bg-white p-6 rounded-3xl border border-brand-wood/5 h-fit shadow-sm">
            <div>
              <h3 className="font-serif font-bold text-lg text-brand-ink mb-4">Filtrar Categoria</h3>
              <div className="flex flex-col gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-left text-sm px-3 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                      selectedCategory === cat 
                        ? 'bg-brand-wood text-white shadow-sm'
                        : 'text-gray-500 hover:bg-brand-paper hover:text-brand-wood'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-serif font-bold text-lg text-brand-ink mb-4">Preço Máximo</h3>
              <div className="space-y-2">
                <input 
                  type="range" 
                  min="0" 
                  max={Math.max(10, maxPriceInDb)} 
                  value={priceRange} 
                  onChange={(e) => setPriceRange(Number(e.target.value))}
                  className="w-full accent-brand-wood cursor-pointer bg-gray-200 rounded-lg appearance-none h-1.5"
                />
                <div className="flex justify-between text-xs text-brand-wood font-mono">
                  <span>R$ 0</span>
                  <span className="font-bold">R$ {priceRange.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-brand-wood/5 text-center">
              <p className="text-[11px] text-gray-400">Esculturas e Entalhes em Madeira Nobre Maciça, Peças Únicas e Colecionáveis.</p>
            </div>
          </aside>

          {/* Catalog Content Area */}
          <section className="space-y-8">
            {/* Search and statistics bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Pesquisar esculturas, quadros ou ferramentas..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-brand-wood/10 rounded-2xl outline-none focus:ring-2 focus:ring-brand-wood text-sm"
                />
              </div>
              <p className="text-xs text-brand-wood font-medium">Exibindo {filteredProducts.length} itens correspondentes</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin h-10 w-10 border-4 border-brand-wood border-t-transparent rounded-full" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-brand-wood/20 flex flex-col items-center justify-center p-8">
                <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="font-serif font-bold text-xl text-brand-ink mb-1">Nenhum produto correspondente</h3>
                <p className="text-gray-400 text-sm max-w-sm">Tente redefinir o controle de buscas para preços maiores, outra palavra chave, ou limpe a categoria selecionada.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.stock <= 0;
                  const firstImg = p.images && p.images.length > 0 ? ensureRobustUrl(p.images[0]) : '';
                  return (
                    <div 
                      key={p.id} 
                      className="bg-white rounded-3xl overflow-hidden border border-brand-wood/5 flex flex-col hover:shadow-xl transition-all duration-300 group"
                    >
                      {/* Product Card Image Wrapper */}
                      <div className="relative aspect-square bg-[#FAFAFA] flex items-center justify-center p-6 min-h-[250px] overflow-hidden">
                        {firstImg ? (
                          <img 
                            src={firstImg} 
                            alt={p.name} 
                            className="w-full h-full object-contain max-h-[90%] group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-xs text-gray-400 font-mono">Sem Imagem</div>
                        )}
                        
                        {/* Sold out / Stock Indicator Badges */}
                        <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
                          <span className="bg-brand-wood text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                            {p.category}
                          </span>
                          {isOutOfStock && (
                            <span className="bg-rose-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                              Esgotado
                            </span>
                          )}
                        </div>
                        
                        {/* Interactive quick view eye button on hover */}
                        <div className="absolute inset-0 bg-brand-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button 
                            onClick={() => {
                              setSelectedProduct(p);
                              setSelectedImgIndex(0);
                            }}
                            className="bg-white p-3.5 rounded-full text-brand-wood hover:scale-110 shadow-lg active:scale-95 transition-all text-sm font-semibold flex items-center gap-1"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Card details body card footer */}
                      <div className="p-6 flex flex-col flex-grow">
                        <h4 className="font-serif text-lg font-bold text-brand-ink mb-1 truncate leading-tight">{p.name}</h4>
                        <p className="text-gray-400 text-xs line-clamp-2 h-8 leading-normal mb-4">{p.description}</p>
                        
                        <div className="pt-4 border-t border-brand-wood/5 mt-auto flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest">Preço</span>
                            <span className="text-xl font-bold text-brand-ink family-serif">
                              R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <button 
                            disabled={isOutOfStock}
                            onClick={() => addToCart(p)}
                            className={`px-5 py-2.5 rounded-full text-xs font-semibold shadow-md cursor-pointer transition-all ${
                              isOutOfStock 
                                ? 'bg-gray-100 text-gray-400 shadow-none cursor-default'
                                : 'bg-brand-wood text-white hover:bg-brand-clay shadow-brand-wood/10 hover:-translate-y-0.5'
                            }`}
                          >
                            {isOutOfStock ? 'Esgotado' : 'Comprar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Slide-out Shopping Cart Drawer panel */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (checkoutStep !== 'submitting') setIsCartOpen(false); }}
              className="absolute inset-0 bg-brand-ink/60 backdrop-blur-xs" 
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex">
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.3 }}
                className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full"
              >
                {/* Header of Cart Panel */}
                <div className="p-6 border-b border-brand-wood/10 flex items-center justify-between bg-brand-paper/30">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-5 h-5 text-brand-wood" />
                    <h2 className="font-serif text-xl font-bold text-brand-ink">
                      {checkoutStep === 'details' ? 'Dados do Envio' : 'Seu Carrinho'}
                    </h2>
                  </div>
                  <button 
                    disabled={checkoutStep === 'submitting'}
                    onClick={() => {
                      if (checkoutStep === 'details') {
                        setCheckoutStep('browsing');
                        setCheckoutPassword('');
                        setCheckoutConfirmPassword('');
                      } else {
                        setIsCartOpen(false);
                      }
                    }}
                    className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 hover:text-black transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body scroll area */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center justify-center space-y-4">
                      <ShoppingCart className="w-12 h-12 text-gray-300" />
                      <div>
                        <h4 className="font-bold text-brand-ink">Seu carrinho está vazio</h4>
                        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Explore o portfólio artesanal e adicione algumas de suas esculturas favoritas ao carrinho.</p>
                      </div>
                    </div>
                  ) : checkoutStep === 'browsing' ? (
                    // STEP 1: BROWSING CART LIST
                    <div className="space-y-4 divide-y divide-brand-wood/5">
                      {cart.map((item) => (
                        <div key={item.id} className="flex gap-4 pt-4 first:pt-0">
                          <div className="w-16 h-16 bg-[#FAFAFA] rounded-xl flex items-center justify-center p-2 border border-brand-wood/5 flex-shrink-0">
                            {item.images && item.images.length > 0 ? (
                              <img src={ensureRobustUrl(item.images[0])} alt={item.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                            ) : null}
                          </div>

                          <div className="flex-grow min-w-0">
                            <h4 className="font-serif font-bold text-sm text-brand-ink truncate leading-tight">{item.name}</h4>
                            <p className="text-xs text-gray-400 mb-2 truncate">Cat: {item.category}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-brand-wood">
                                R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              
                              <div className="flex items-center gap-2 border border-brand-wood/15 rounded-full bg-[#FAFAFA] py-0.5 px-2">
                                <button onClick={() => updateQuantity(item.id!, -1)} className="p-1 text-gray-400 hover:text-brand-wood"><Minus className="w-3 h-3" /></button>
                                <span className="text-xs font-bold text-brand-ink px-1">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.id!, 1)} className="p-1 text-gray-400 hover:text-brand-wood"><Plus className="w-3 h-3" /></button>
                              </div>
                            </div>
                          </div>

                          <button 
                            onClick={() => removeFromCart(item.id!)}
                            className="text-red-400 hover:text-red-600 self-center p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      {/* Shipping calculation fields inside checkout Step 1 */}
                      <div className="pt-6 mt-6 border-t border-brand-wood/10 space-y-4">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-brand-wood" />
                          <h4 className="text-sm font-bold text-brand-ink uppercase tracking-wide">
                            {cart.some(item => item.shippingType === 'quote') ? 'Cotação de Frete Especial' : 'Cálculo de Frete (MelhorEnvio)'}
                          </h4>
                        </div>

                        {cart.some(item => item.shippingType === 'quote') && (
                          <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed font-sans">
                            🚚 <strong>Carrinho especial:</strong> O seu carrinho possui obra(s) com <strong>frete sob consulta</strong>. Para esses itens, o frete total de todos os produtos do pedido será cotado detalhadamente pelo mestre após o envio do formulário.
                          </div>
                        )}

                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="CEP (Ex: 13630-000)" 
                            value={shippingCep}
                            maxLength={9}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, "");
                              setShippingCep(v);
                              if (v.length === 8) {
                                calculateShippingCost(v);
                              }
                            }}
                            className="bg-brand-paper/50 flex-grow border border-brand-wood/10 px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-brand-wood outline-none"
                          />
                          <button 
                            onClick={() => calculateShippingCost(shippingCep)}
                            disabled={loadingShipping}
                            className="bg-brand-wood text-white px-5 rounded-xl text-xs font-bold hover:bg-brand-clay transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {loadingShipping ? 'Calculando...' : (cart.some(item => item.shippingType === 'quote') ? 'Ok' : 'Consultar')}
                          </button>
                        </div>

                        {cart.some(item => item.shippingType === 'quote') && selectedShipping && (
                          <div className="flex items-center justify-between p-3 border border-emerald-100 rounded-xl bg-emerald-50/50 text-[11px]">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              <div>
                                <div className="font-bold text-emerald-900">Orçamento Solicitado para este CEP</div>
                                <div className="text-[9px] text-emerald-700">Calculado para o CEP {shippingCep}</div>
                              </div>
                            </div>
                            <span className="font-bold text-emerald-800 text-[10px] bg-emerald-100/70 px-2 py-0.5 rounded shrink-0 uppercase tracking-wider font-mono">Sob Consulta</span>
                          </div>
                        )}

                        {shippingError && (
                          <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {shippingError}
                          </p>
                        )}

                        {shippingServices.length > 0 && (
                          <div className="space-y-2 max-h-[140px] overflow-y-auto">
                            {shippingServices.map((srv) => (
                              <label 
                                key={srv.id} 
                                className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer text-xs transition-colors ${
                                  selectedShipping?.id === srv.id 
                                    ? 'border-brand-wood bg-brand-paper/30' 
                                    : 'border-gray-100 hover:border-gray-200 bg-white'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input 
                                    type="radio" 
                                    name="shipping" 
                                    checked={selectedShipping?.id === srv.id} 
                                    onChange={() => setSelectedShipping(srv)} 
                                    className="accent-brand-wood cursor-pointer"
                                  />
                                  <div>
                                    <div className="font-bold text-brand-ink">{srv.name}</div>
                                    <div className="text-[10px] text-gray-400">Prazo: {srv.delivery_time} dias úteis</div>
                                  </div>
                                </div>
                                <span className="font-bold text-brand-wood text-sm">
                                  R$ {srv.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : checkoutStep === 'details' ? (
                    // STEP 2: DETAILS FORM
                    <form onSubmit={handleCheckoutSubmit} className="space-y-3 prose pr-1">
                      {!userId && (
                        <div className="bg-amber-50 text-amber-800 border border-amber-200 p-3 rounded-xl text-[11px] leading-snug flex items-center justify-between mb-3">
                          <span>Já é nosso cliente com conta cadastrada?</span>
                          <button 
                            type="button" 
                            onClick={() => onNavigateToView('customer-area')} 
                            className="text-[#8d6e63] font-bold hover:underline outline-none cursor-pointer text-[10px] uppercase tracking-wide flex-shrink-0 ml-2"
                          >
                            Fazer Login
                          </button>
                        </div>
                      )}

                      <div className="text-xs text-gray-400 border-b pb-2 mb-3 font-semibold uppercase tracking-wider">Identidade & Contato</div>
                      <input 
                        type="text" 
                        placeholder="Nome Completo *" 
                        required 
                        value={customerInfo.name} 
                        onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})}
                        className="w-full bg-[#FAFAFA] border border-gray-100 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-medium"
                      />
                      <input 
                        type="email" 
                        placeholder="E-mail *" 
                        required 
                        value={customerInfo.email} 
                        onChange={e => setCustomerInfo({...customerInfo, email: e.target.value})}
                        className="w-full bg-[#FAFAFA] border border-gray-100 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-medium"
                      />

                      {!userId && (
                        <div className="bg-brand-wood/5 border border-brand-wood/10 rounded-2xl p-4 space-y-3 my-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8d6e63] uppercase tracking-wider">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Crie sua senha de acesso</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-normal">
                            Defina uma senha para criar sua conta de acesso e poder entrar a qualquer momento na Área do Cliente para acompanhar suas compras.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="password" 
                              placeholder="Senha de Acesso *" 
                              required 
                              value={checkoutPassword} 
                              onChange={e => setCheckoutPassword(e.target.value)}
                              className="w-full bg-white border border-gray-200/60 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-medium"
                            />
                            <input 
                              type="password" 
                              placeholder="Confirmar Senha *" 
                              required 
                              value={checkoutConfirmPassword} 
                              onChange={e => setCheckoutConfirmPassword(e.target.value)}
                              className="w-full bg-white border border-gray-200/60 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-medium"
                            />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="text" 
                          placeholder="Telefone (com DDD) *" 
                          required 
                          value={customerInfo.phone} 
                          onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})}
                          className="w-full bg-[#FAFAFA] border border-gray-100 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-medium"
                        />
                        <input 
                          type="text" 
                          placeholder="CPF (apenas números) *" 
                          required 
                          value={customerInfo.cpf} 
                          onChange={e => setCustomerInfo({...customerInfo, cpf: e.target.value})}
                          className="w-full bg-[#FAFAFA] border border-gray-100 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-medium"
                        />
                      </div>

                      <div className="text-xs text-gray-400 border-b pb-2 pt-2 font-semibold uppercase tracking-wider">Logradouro do Destino</div>
                      
                      {profileLoaded && (
                        <div className="bg-[#FAF9F5] border border-brand-wood/10 rounded-xl p-3 mb-2 flex items-center justify-between text-xs transition-all select-none">
                          <div className="pr-3">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-brand-wood block">Endereço de Cadastro</span>
                            <span className="text-gray-500 block text-[10px] line-clamp-1">{profileLoaded.street}, {profileLoaded.number} — {profileLoaded.city}/{profileLoaded.state}</span>
                          </div>
                          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#8d6e63] shrink-0">
                            <input 
                              type="checkbox" 
                              checked={useProfileAddress}
                              onChange={(e) => {
                                setUseProfileAddress(e.target.checked);
                                if (e.target.checked) {
                                  // Restore profile address
                                  setCustomerInfo({
                                    ...customerInfo,
                                    cep: profileLoaded.cep || '',
                                    street: profileLoaded.street || '',
                                    number: profileLoaded.number || '',
                                    complement: profileLoaded.complement || '',
                                    neighborhood: profileLoaded.neighborhood || '',
                                    city: profileLoaded.city || '',
                                    state: profileLoaded.state || ''
                                  });
                                } else {
                                  // Clear address fields
                                  setCustomerInfo({
                                    ...customerInfo,
                                    cep: '',
                                    street: '',
                                    number: '',
                                    complement: '',
                                    neighborhood: '',
                                    city: '',
                                    state: ''
                                  });
                                }
                              }}
                              className="accent-brand-wood h-4 w-4 rounded"
                            />
                            <span className="text-[10px] tracking-wide uppercase">Usar Cadastro</span>
                          </label>
                        </div>
                      )}

                      {(!profileLoaded || !useProfileAddress) ? (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            <input 
                              type="text" 
                              placeholder="CEP *" 
                              required 
                              value={customerInfo.cep} 
                              onChange={e => {
                                setCustomerInfo({...customerInfo, cep: e.target.value});
                                if (e.target.value.replace(/\D/g, "").length === 8) {
                                  lookupCep(e.target.value);
                                }
                              }}
                              className="w-full bg-[#FAFAFA] border border-gray-100 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-semibold"
                            />
                            <input 
                              type="text" 
                              placeholder="Cidade *" 
                              required 
                              disabled
                              value={customerInfo.city} 
                              className="w-full bg-gray-50 border border-gray-100 px-4 py-2.5 rounded-xl text-xs outline-none col-span-2 text-gray-400"
                            />
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            <input 
                              type="text" 
                              placeholder="Logradouro / Rua *" 
                              required 
                              value={customerInfo.street} 
                              onChange={e => setCustomerInfo({...customerInfo, street: e.target.value})}
                              className="w-full bg-[#FAFAFA] border border-gray-100 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-medium col-span-3"
                            />
                            <input 
                              type="text" 
                              placeholder="Número *" 
                              required 
                              value={customerInfo.number} 
                              onChange={e => setCustomerInfo({...customerInfo, number: e.target.value})}
                              className="w-full bg-[#FAFAFA] border border-gray-100 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-medium col-span-2"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input 
                              type="text" 
                              placeholder="Bairro *" 
                              required 
                              value={customerInfo.neighborhood} 
                              onChange={e => setCustomerInfo({...customerInfo, neighborhood: e.target.value})}
                              className="w-full bg-[#FAFAFA] border border-gray-100 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-medium"
                            />
                            <input 
                              type="text" 
                              placeholder="Complemento (Apto, conj, etc)" 
                              value={customerInfo.complement} 
                              onChange={e => setCustomerInfo({...customerInfo, complement: e.target.value})}
                              className="w-full bg-[#FAFAFA] border border-gray-100 px-4 py-2.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-wood font-medium"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="bg-[#FAF9F5] border border-brand-wood/10 rounded-xl p-4 text-xs space-y-1 relative shadow-inner">
                          <span className="text-[9px] uppercase font-bold text-[#8d6e63] block tracking-wider font-mono">Endereço de Cadastro Confirmado</span>
                          <p className="font-bold text-gray-700 text-[11px] leading-snug">{customerInfo.street}, {customerInfo.number} {customerInfo.complement && `(${customerInfo.complement})`}</p>
                          <p className="text-gray-500 text-[10px]">{customerInfo.neighborhood} — CEP {customerInfo.cep} — {customerInfo.city}/{customerInfo.state}</p>
                        </div>
                      )}
                      {checkoutValidationError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2 mt-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500 animate-pulse" />
                          <div className="space-y-0.5">
                            <p className="font-bold text-[11px] uppercase tracking-wide">Faltam dados obrigatórios:</p>
                            <p className="font-medium text-rose-600 leading-relaxed">{checkoutValidationError}</p>
                          </div>
                        </div>
                      )}
                    </form>
                  ) : (
                    // STEP 3: SUBMITTING / PROCESSING
                    <div className="text-center py-20 flex flex-col items-center justify-center space-y-4">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-14 w-14 border-4 border-brand-wood border-t-transparent" />
                        <ShoppingCart className="w-5 h-5 text-brand-wood absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-lg text-brand-ink">Registrando Pedido...</h4>
                        <p className="text-xs text-gray-400 mt-1.5 max-w-[280px]">Estamos salvando sua nota no banco de dados e configurando a sessão segura do Mercado Pago Checkout em frações de segundos.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer totals payment button */}
                {cart.length > 0 && checkoutStep !== 'submitting' && (
                  <div className="p-6 border-t border-brand-wood/10 bg-[#FAFAFA] space-y-4">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-gray-500">
                        <span>Produtos</span>
                        <span>R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Frete ({selectedShipping?.name || 'Não selecionado'})</span>
                        <span>
                          {selectedShipping 
                            ? `R$ ${selectedShipping.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                            : 'CEP pendente'
                          }
                        </span>
                      </div>
                      {appliedCoupon && (
                        <div className="flex justify-between text-emerald-600 font-semibold bg-emerald-50/50 p-1.5 rounded border border-emerald-100/55 animate-fade-in">
                          <span>Desconto ({appliedCoupon.id} - 5% OFF)</span>
                          <span>- R$ {discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-brand-ink font-bold text-base pt-2 border-t">
                        <span>Total Geral</span>
                        <span className="text-lg">R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Recovery Coupon application container field */}
                    <div className="py-2.5 border-t border-b border-brand-wood/10 space-y-2">
                      <label className="block text-[10px] font-bold text-brand-dark uppercase tracking-wider">Cupom de Recuperação</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="DIGITE SEU CUPOM"
                          value={couponCodeInput}
                          onChange={(e) => setCouponCodeInput(e.target.value)}
                          className="flex-1 bg-white border border-brand-wood/10 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-brand-clay"
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyCoupon(couponCodeInput)}
                          className="bg-brand-wood hover:bg-brand-clay text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Aplicar
                        </button>
                      </div>
                      {couponError && <p className="text-[10px] text-red-600 font-semibold">{couponError}</p>}
                      {couponSuccess && <p className="text-[10px] text-emerald-600 font-semibold">{couponSuccess}</p>}
                    </div>

                    {checkoutStep === 'browsing' ? (
                      <button 
                        onClick={() => {
                          if (!selectedShipping) {
                            alert("Por favor, informe seu CEP e selecione uma das opções de transporte disponíveis!");
                            return;
                          }
                          setCheckoutStep('details');
                        }}
                        disabled={!selectedShipping}
                        className="w-full bg-brand-wood text-white py-4 rounded-full font-bold text-sm tracking-wide shadow-md shadow-brand-wood/15 hover:bg-brand-clay hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:-translate-y-0 disabled:shadow-none"
                      >
                        <span>Avançar para Identificação</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ) : (
                      <button 
                        onClick={handleCheckoutSubmit}
                        className="w-full bg-brand-ink text-white py-4 rounded-full font-bold text-sm tracking-wide shadow-lg hover:bg-brand-wood hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                      >
                        <span>{cart.some(item => item.shippingType === 'quote') ? 'Solicitar Orçamento de Frete' : 'Finalizar Compra / Pagar'}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Individual Product details page / Modal popup overlay */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto z-10 grid md:grid-cols-2 gap-8 p-6 md:p-10 relative shadow-2xl"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 text-gray-500 z-10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Grid 1: Galleries of multi images with thumbnails */}
              <div className="flex flex-col gap-4">
                <div className="relative aspect-square bg-[#FDFDFD] border border-gray-100 rounded-3xl p-6 flex items-center justify-center overflow-hidden min-h-[300px]">
                  {selectedProduct.images && selectedProduct.images.length > 0 ? (
                    <img 
                      src={ensureRobustUrl(selectedProduct.images[selectedImgIndex])} 
                      alt="" 
                      className="w-full h-full object-contain max-h-[85%]" 
                      referrerPolicy="no-referrer"
                    />
                  ) : null}

                  {selectedProduct.images && selectedProduct.images.length > 1 && (
                    <>
                      <button 
                        onClick={() => setSelectedImgIndex(prev => prev > 0 ? prev - 1 : selectedProduct.images.length - 1)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/70 backdrop-blur-xs hover:bg-white text-brand-ink pointer-events-auto border shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setSelectedImgIndex(prev => prev < selectedProduct.images.length - 1 ? prev + 1 : 0)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/70 backdrop-blur-xs hover:bg-white text-brand-ink pointer-events-auto border shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Thumbnails indicator list slider */}
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="flex flex-wrap gap-2.5">
                    {selectedProduct.images.map((imgUrl, thumbIdx) => (
                      <button 
                        key={thumbIdx}
                        onClick={() => setSelectedImgIndex(thumbIdx)}
                        className={`w-14 h-14 bg-gray-50 rounded-xl overflow-hidden border p-1 transition-all ${
                          selectedImgIndex === thumbIdx 
                            ? 'border-brand-wood scale-105 shadow-inner' 
                            : 'border-transparent hover:border-gray-200'
                        }`}
                      >
                        <img src={ensureRobustUrl(imgUrl)} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Grid 2: Descriptions technical specifications and checkout triggers */}
              <div className="flex flex-col h-full py-4 justify-between">
                <div>
                  <span className="bg-brand-paper border border-brand-wood/10 text-brand-wood text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm w-fit inline-block mb-3">
                    {selectedProduct.category}
                  </span>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-brand-ink leading-tight mb-2">{selectedProduct.name}</h3>
                  
                  <div className="flex items-baseline gap-2 mb-4 border-b border-brand-wood/5 pb-4">
                    <span className="text-2xl font-black text-brand-wood">
                      R$ {selectedProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-gray-400">À vista via PIX ou Cartão no checkout</span>
                  </div>

                  <p className="text-gray-500 text-xs sm:text-sm leading-relaxed mb-6 whitespace-pre-line pr-1 h-32 overflow-y-auto">
                    {selectedProduct.description}
                  </p>

                  {/* Technical Specifications Specs Grid details layout dimensions */}
                  <div className="bg-[#FAFAFA] rounded-2xl p-4 border border-gray-100 text-[11px] text-gray-500 grid grid-cols-2 gap-y-2 gap-x-4 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Peso líquido:</span>
                      <span className="font-bold text-brand-ink">{selectedProduct.weight || 0.3} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Altura:</span>
                      <span className="font-bold text-brand-ink">{selectedProduct.height || 11} cm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Largura:</span>
                      <span className="font-bold text-brand-ink">{selectedProduct.width || 11} cm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Comprimento:</span>
                      <span className="font-bold text-brand-ink">{selectedProduct.length || 16} cm</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-brand-wood/5 mt-auto">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Estoque atual:</span>
                    <span className={`font-bold ${selectedProduct.stock > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {selectedProduct.stock > 0 ? `${selectedProduct.stock} unidades disponíveis` : 'Sem estoque no momento'}
                    </span>
                  </div>

                  <button
                    disabled={selectedProduct.stock <= 0}
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className={`w-full py-4.5 rounded-2xl text-center font-bold text-sm shadow-md transition-all cursor-pointer ${
                      selectedProduct.stock <= 0 
                        ? 'bg-gray-100 text-gray-400 shadow-none cursor-default'
                        : 'bg-brand-wood text-white hover:bg-brand-clay shadow-brand-wood/15 hover:-translate-y-0.5'
                    }`}
                  >
                    {selectedProduct.stock > 0 
                      ? (selectedProduct.shippingType === 'quote' ? 'Adicionar ao Carrinho (Frete sob consulta)' : 'Adicionar ao Carrinho de Compras') 
                      : 'Produto Indisponível'
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shipping Quote Form Modal */}
      <AnimatePresence>
        {isQuoteFormOpen && selectedProduct && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsQuoteFormOpen(false);
                setQuoteSuccessMessage('');
              }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] w-full max-w-lg z-10 p-6 md:p-8 relative shadow-2xl font-sans"
            >
              <button 
                onClick={() => {
                  setIsQuoteFormOpen(false);
                  setQuoteSuccessMessage('');
                }}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 text-gray-500 z-10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {quoteSuccessMessage ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif font-bold text-lg text-brand-ink">Solicitação Enviada!</h3>
                  <p className="text-gray-500 text-xs leading-relaxed max-w-sm mx-auto">{quoteSuccessMessage}</p>
                  <button 
                    onClick={() => {
                      setIsQuoteFormOpen(false);
                      setQuoteSuccessMessage('');
                      setSelectedProduct(null);
                    }}
                    className="bg-brand-wood text-white px-6 py-2.5 rounded-full font-bold text-xs hover:bg-brand-clay transition-all cursor-pointer"
                  >
                    Entendido
                  </button>
                </div>
              ) : (
                <form onSubmit={handleQuoteSubmit} className="space-y-4 text-xs font-medium">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-brand-ink leading-tight">Solicitar Cotação de Envio</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Este item possui dimensões especiais e requer cotação personalizada</p>
                  </div>

                  <div className="bg-gray-50/70 p-3 rounded-xl border flex items-center gap-3">
                    {selectedProduct.images && selectedProduct.images.length > 0 && (
                      <img src={ensureRobustUrl(selectedProduct.images[0])} alt="" className="w-10 h-10 object-contain bg-white rounded border flex-shrink-0" referrerPolicy="no-referrer" />
                    )}
                    <div>
                      <div className="font-bold text-brand-ink text-[11px] truncate max-w-[250px]">{selectedProduct.name}</div>
                      <div className="font-bold text-brand-wood font-mono text-[10px]">R$ {selectedProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wide">Seu Nome Completo *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Ex: Andrew Lemos"
                        value={quoteFormData.name}
                        onChange={e => setQuoteFormData({...quoteFormData, name: e.target.value})}
                        className="w-full bg-[#FAFAFA] border rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-wood font-bold text-brand-ink"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wide">E-mail *</label>
                        <input 
                          type="email" 
                          required 
                          placeholder="Ex: seu@email.com"
                          value={quoteFormData.email}
                          onChange={e => setQuoteFormData({...quoteFormData, email: e.target.value})}
                          className="w-full bg-[#FAFAFA] border rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-wood font-bold text-brand-ink"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wide">Telefone *</label>
                        <input 
                          type="tel" 
                          required 
                          placeholder="Ex: (19) 99999-9999"
                          value={quoteFormData.phone}
                          onChange={e => setQuoteFormData({...quoteFormData, phone: e.target.value})}
                          className="w-full bg-[#FAFAFA] border rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-wood font-bold text-brand-ink"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wide">CEP Destino *</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="00000-000"
                          maxLength={9}
                          value={quoteFormData.cep}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2');
                            setQuoteFormData({...quoteFormData, cep: val});
                            if (val.replace(/\D/g, '').length === 8) {
                              lookupCepForQuote(val);
                            }
                          }}
                          className="w-full bg-[#FAFAFA] border rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-wood font-mono font-bold text-brand-ink"
                        />
                      </div>
                      <div className="text-[10px] text-gray-500 font-bold bg-[#FAFAFA] border rounded-xl px-4 py-2.5 h-[38px] flex items-center truncate text-brand-ink">
                        {resolvedCity ? `${resolvedCity} - ${resolvedState}` : 'Digite o CEP para localizar'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wide">Quantidade *</label>
                        <input 
                          type="number" 
                          min={1}
                          max={selectedProduct.stock}
                          required
                          value={quoteFormData.quantity}
                          onChange={e => setQuoteFormData({...quoteFormData, quantity: Math.max(1, parseInt(e.target.value, 10) || 1)})}
                          className="w-full bg-[#FAFAFA] border rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-wood font-bold text-brand-ink"
                        />
                      </div>
                      <div className="text-[10px] leading-snug flex items-center text-gray-400 font-medium font-bold">
                        Quantidade limite do estoque: {selectedProduct.stock} un.
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-400 font-bold mb-1 uppercase tracking-wide">Observações ou Dúvidas</label>
                      <textarea 
                        rows={2} 
                        placeholder="Ex: Gostaria de embalagem especial reforçada para presente, cuidados no manuseio, etc..."
                        value={quoteFormData.notes}
                        onChange={e => setQuoteFormData({...quoteFormData, notes: e.target.value})}
                        className="w-full bg-[#FAFAFA] border rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-wood text-[11px] text-brand-ink font-semibold"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmittingQuote || (quoteFormData.cep.replace(/\D/g, '').length !== 8)}
                    className="w-full bg-brand-wood text-white py-3.5 rounded-full font-bold text-xs uppercase tracking-wider hover:bg-brand-clay transition-all shadow-md shadow-brand-wood/10 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingQuote ? 'Enviando Solicitação...' : 'Confirmar & Solicitar Cotação'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
