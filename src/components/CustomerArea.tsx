import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db 
} from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  User as UserIcon, 
  ShoppingBag, 
  LogOut, 
  Key, 
  MapPin, 
  CreditCard, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  ChevronRight, 
  Copy, 
  ExternalLink, 
  Lock, 
  Plus, 
  Eye, 
  EyeOff, 
  Grid,
  Info
} from 'lucide-react';
import { EcomOrder, EcomCustomer } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface CustomerAreaProps {
  onNavigateToView: (view: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm', id?: string) => void;
  initialEmail?: string;
}

export const CustomerArea: React.FC<CustomerAreaProps> = ({ onNavigateToView, initialEmail = '' }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<EcomCustomer | null>(null);
  const [orders, setOrders] = useState<EcomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');

  // Login & Register Form fields
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authEmail, setAuthEmail] = useState(initialEmail);
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Profile Form fields
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regCep, setRegCep] = useState('');
  const [regStreet, setRegStreet] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regComplement, setRegComplement] = useState('');
  const [regNeighborhood, setRegNeighborhood] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regState, setRegState] = useState('');

  // Toast / notification
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Monitor Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setAuthError('');
        // Load Profile
        await loadCustomerProfile(user.uid);
      } else {
        setProfile(null);
        setOrders([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Monitor orders for current logged-in customer in real-time
  useEffect(() => {
    if (!currentUser) return;
    setOrdersLoading(true);

    const q = query(
      collection(db, 'ecom_orders'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: EcomOrder[] = [];
      snapshot.forEach((orderDoc) => {
        fetchedOrders.push({ id: orderDoc.id, ...orderDoc.data() } as EcomOrder);
      });
      setOrders(fetchedOrders);
      setOrdersLoading(false);
    }, (error) => {
      setOrdersLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'ecom_orders');
    });

    return () => unsubscribe();
  }, [currentUser]);

  const loadCustomerProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'ecom_customers', uid));
      if (snap.exists()) {
        const customerData = snap.data() as EcomCustomer;
        setProfile(customerData);
        // populate form
        setRegName(customerData.name || '');
        setRegPhone(customerData.phone || '');
        setRegCpf(customerData.cpf || '');
        setRegCep(customerData.cep || '');
        setRegStreet(customerData.street || '');
        setRegNumber(customerData.number || '');
        setRegComplement(customerData.complement || '');
        setRegNeighborhood(customerData.neighborhood || '');
        setRegCity(customerData.city || '');
        setRegState(customerData.state || '');
      } else {
        setProfile(null);
      }
    } catch (e: any) {
      console.error("Erro ao carregar perfil do cliente:", e);
      handleFirestoreError(e, OperationType.GET, `ecom_customers/${uid}`);
    } finally {
      setLoading(false);
    }
  };

  // Cep auto-completar
  const handleCepLookup = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    setRegCep(cleanCep);
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (res.ok) {
          const apiData = await res.json();
          if (!apiData.erro) {
            setRegStreet(apiData.logradouro || '');
            setRegNeighborhood(apiData.bairro || '');
            setRegCity(apiData.localidade || '');
            setRegState(apiData.uf || '');
            setAuthError('');
          }
        }
      } catch (e) {
        console.warn("Erro ao buscar CEP de forma dinâmica:", e);
      }
    }
  };

  // Authentication Actions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Por favor, preencha o e-mail e a senha.');
      return;
    }
    setActionLoading(true);
    setAuthError('');

    try {
      await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      // Auto success loaded in state
    } catch (err: any) {
      console.error("Erro ao realizar login de cliente:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setAuthError('E-mail ou senha incorretos. Verifique suas credenciais de acesso.');
      } else if (err.code === 'auth/invalid-credential') {
        setAuthError('E-mail ou senha inválidos. Tente novamente.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('Endereço de e-mail inválido.');
      } else {
        setAuthError('Falha ao autenticar cliente: ' + (err.message || err.code));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSuccessMsg('');

    // Pre-validations
    if (!authEmail || !authPassword || !authConfirmPassword) {
      setAuthError('E-mail, senha e confirmação de senha são obrigatórios.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('A senha deve ter no mínimo 6 caracteres para garantir sua segurança.');
      return;
    }
    if (authPassword !== authConfirmPassword) {
      setAuthError('As senhas digitadas não coincidem.');
      return;
    }

    // Profile field validations
    if (!regName || !regPhone || !regCpf || !regCep || !regStreet || !regNumber || !regNeighborhood || !regCity || !regState) {
      setAuthError('Por favor, preencha todos os campos obrigatórios do seu perfil.');
      return;
    }

    setActionLoading(true);
    try {
      // 1. Create client Firebase Auth record
      const cred = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      const user = cred.user;

      // Update auth display name
      await updateProfile(user, { displayName: regName });

      // 2. Save profile details to Firestore
      const customerDoc: EcomCustomer = {
        name: regName.trim(),
        email: authEmail.trim(),
        phone: regPhone.trim(),
        cpf: regCpf.replace(/\D/g, '').trim(),
        cep: regCep.replace(/\D/g, '').trim(),
        street: regStreet.trim(),
        number: regNumber.trim(),
        complement: regComplement.trim(),
        neighborhood: regNeighborhood.trim(),
        city: regCity.trim(),
        state: regState.trim(),
        createdAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'ecom_customers', user.uid), customerDoc);
      } catch (e: any) {
        handleFirestoreError(e, OperationType.WRITE, `ecom_customers/${user.uid}`);
      }
      setProfile(customerDoc);
      setSuccessMsg('Cadastro criado com sucesso! Agora você está logado na Área de Cliente.');
    } catch (err: any) {
      console.error("Erro ao cadastrar cliente:", err);
      if (err.code === 'auth/email-already-in-use') {
        setAuthError('Este endereço de e-mail já está sendo utilizado. Por favor, acesse usando sua senha de cadastro.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('Por favor, especifique um endereço de e-mail válido.');
      } else {
        setAuthError('Erro ao registrar sua conta: ' + (err.message || err.code));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setAuthError('');
    setSuccessMsg('');

    if (!regName || !regPhone || !regCpf || !regCep || !regStreet || !regNumber || !regNeighborhood || !regCity || !regState) {
      setAuthError('Preencha todos os campos obrigatórios (*).');
      return;
    }

    setActionLoading(true);
    try {
      const customerDoc: EcomCustomer = {
        name: regName.trim(),
        email: currentUser.email || '',
        phone: regPhone.trim(),
        cpf: regCpf.replace(/\D/g, '').trim(),
        cep: regCep.replace(/\D/g, '').trim(),
        street: regStreet.trim(),
        number: regNumber.trim(),
        complement: regComplement.trim(),
        neighborhood: regNeighborhood.trim(),
        city: regCity.trim(),
        state: regState.trim(),
        createdAt: profile?.createdAt || new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'ecom_customers', currentUser.uid), customerDoc);
      } catch (e: any) {
        handleFirestoreError(e, OperationType.WRITE, `ecom_customers/${currentUser.uid}`);
      }
      setProfile(customerDoc);
      
      // Update display name
      await updateProfile(currentUser, { displayName: regName });

      setSuccessMsg('Dados cadastrais de entrega atualizados com sucesso!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error("Erro ao atualizar dados de entrega:", err);
      setAuthError('Erro ao atualizar cadastro: ' + (err.message || err.code));
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Auto handled
    } catch (e) {
      console.error("Falha ao deslogar:", e);
    }
  };

  const copyToClipboard = (text: string, orderId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOrderId(orderId);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  // Helper mapping tracking URLs
  const getTrackingUrl = (code: string) => {
    const clean = code.trim().toUpperCase();
    // Assuming standard Correios if length matches standard formats, otherwise generic Correios tracking
    return `https://rastreamento.correios.com.br/app/index.php?codigo=${clean}`;
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 bg-[#FAF9F5] px-4">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-wood border-t-transparent" />
        <p className="text-sm font-semibold text-gray-500 font-serif">Processando acesso seguro ao Ateliê Andrew Lemos...</p>
      </div>
    );
  }

  // LOGIN / SIGN UP SCREEN
  if (!currentUser) {
    return (
      <div className="min-h-[85vh] bg-[#FAF9F6] py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-gray-150 p-6 sm:p-10 shadow-xl space-y-8">
          
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 bg-brand-paper/20 text-brand-wood rounded-2xl">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-serif">
              Área do Cliente
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
              {isRegisterMode 
                ? 'Inscreva-se preenchendo seus dados para finalizar e-commerce compras, liberar notas e obter rastreios.' 
                : 'Acesse usando e-mail cadastrado em compras anteriores para verificar envios e liberar códigos.'
              }
            </p>
          </div>

          {authError && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 px-4 py-3.5 rounded-2xl text-[11px] sm:text-xs flex items-start gap-2.5 leading-relaxed">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
              <span>{authError}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-3.5 rounded-2xl text-[11px] sm:text-xs flex items-start gap-2.5 leading-relaxed">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* FORM */}
          <form className="space-y-5" onSubmit={isRegisterMode ? handleRegister : handleLogin}>
            
            {isRegisterMode && (
              <div className="space-y-4 border-b border-gray-100 pb-5">
                <h3 className="text-xs font-bold text-brand-wood uppercase tracking-wider mb-2">Dados Cadastrais de Entrega</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Nome Completo *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Andrew F. M. Lemos"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Telefone / WhatsApp *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="(21) 98765-4321"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">CPF *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="000.000.000-00"
                      value={regCpf}
                      onChange={e => setRegCpf(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">CEP *</label>
                    <input 
                      type="text" 
                      required
                      maxLength={9}
                      placeholder="20100-000"
                      value={regCep}
                      onChange={e => handleCepLookup(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Logradouro / Rua *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Av. Rio Branco"
                      value={regStreet}
                      onChange={e => setRegStreet(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Número *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="123"
                      value={regNumber}
                      onChange={e => setRegNumber(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Complemento</label>
                    <input 
                      type="text" 
                      placeholder="Apto 402"
                      value={regComplement}
                      onChange={e => setRegComplement(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Bairro *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Centro"
                      value={regNeighborhood}
                      onChange={e => setRegNeighborhood(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Cidade *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Rio de Janeiro"
                      value={regCity}
                      onChange={e => setRegCity(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Estado *</label>
                    <input 
                      type="text" 
                      required
                      maxLength={2}
                      placeholder="RJ"
                      value={regState}
                      onChange={e => setRegState(e.target.value.toUpperCase())}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-brand-wood uppercase tracking-wider">Credenciais de Acesso</h3>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">E-mail *</label>
                <input 
                  type="email" 
                  required
                  placeholder="seuemail@exemplo.com"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Senha de Acesso *</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required
                      placeholder="Mínimo 6 dígitos"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl pl-4 pr-10 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isRegisterMode && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Confirmar Senha *</label>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required
                      placeholder="Repita a senha"
                      value={authConfirmPassword}
                      onChange={e => setAuthConfirmPassword(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-brand-wood text-white py-4 rounded-full font-bold text-sm hover:bg-brand-clay hover:shadow-lg focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
            >
              {actionLoading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Configurando acesso seguro...</span>
                </>
              ) : (
                <span>{isRegisterMode ? 'Cadastrar e Fazer Login' : 'Entrar na Conta'}</span>
              )}
            </button>
          </form>

          <div className="border-t border-gray-100 pt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setAuthError('');
              }}
              className="text-xs text-brand-clay font-semibold hover:underline outline-none"
            >
              {isRegisterMode 
                ? 'Já tem uma conta cadastrada anteriormente? Faça login aqui' 
                : 'Não efetuou compras anteriores e quer criar sua senha? Cadastre-se'
              }
            </button>
          </div>

        </div>
      </div>
    );
  }

  // LOGGED-IN CUSTOMER DASHBOARD
  return (
    <div className="min-h-screen bg-[#FAF9F5] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* TOP BAR / GREETING */}
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-brand-paper/30 flex items-center justify-center text-brand-wood font-bold border border-brand-wood/10 self-center">
              {currentUser.displayName?.charAt(0).toUpperCase() || <UserIcon className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-xs text-gray-400">Logado com {currentUser.email}</p>
              <h2 className="text-lg font-bold text-gray-800 font-serif">
                Olá, {currentUser.displayName || 'Cliente Ateliê'}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <div className="text-xs bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full border border-amber-200.5 flex items-center gap-1.5">
              <span>● Área de Autoatendimento</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 p-2.5 rounded-2xl flex items-center gap-1.5 transition-all font-semibold outline-none cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Desconectar</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION TAB HEADERS */}
        <div className="flex gap-2.5 border-b border-gray-200 pb-0.5">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-5 py-3 text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 border-b-2 outline-none cursor-pointer ${
              activeTab === 'orders' 
                ? 'border-brand-wood text-brand-wood' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Acompanhar Meus Pedidos ({orders.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-3 text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2 border-b-2 outline-none cursor-pointer ${
              activeTab === 'profile' 
                ? 'border-brand-wood text-brand-wood' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Dados da Entrega</span>
          </button>
        </div>

        {authError && (
          <div className="bg-rose-50 border border-rose-100 text-rose-800 px-4 py-3.5 rounded-2xl text-xs flex items-start gap-2.5 my-4 leading-relaxed">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
            <span>{authError}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-3.5 rounded-2xl text-xs flex items-start gap-2.5 my-4 leading-relaxed">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB CONTENTS */}
        <div>
          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {ordersLoading ? (
                <div className="p-12 text-center bg-white border border-gray-150 rounded-3xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-wood border-t-transparent mx-auto mb-4" />
                  <p className="text-xs text-gray-400 font-medium font-serif">Sincronizando seus pedidos do banco de dados...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-white border border-gray-150 rounded-3xl p-12 text-center space-y-4 shadow-xs">
                  <div className="inline-flex p-4 bg-[#FAF9F5] text-gray-300 rounded-full">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-gray-700 font-serif">Nenhum pedido encontrado</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                    Você ainda não efetuou compras vinculadas a este e-mail, ou elas estão em processamento de criação inicial. Visite nossa loja de obras de arte e faça sua primeira aquisição!
                  </p>
                  <button
                    onClick={() => onNavigateToView('vendas')}
                    className="bg-brand-wood hover:bg-brand-clay text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer outline-none"
                  >
                    <span>Ir para Loja Virtual</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {orders.map((order) => {
                    const formattedDate = order.createdAt?.toDate 
                      ? order.createdAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

                    // Progress steps mapping
                    const steps = ['Aguardando pagamento', 'Pago', 'Separação', 'Enviado', 'Entregue'];
                    const currentStepIndex = steps.indexOf(order.status);
                    const isCancelled = order.status === 'Cancelado';

                    return (
                      <div 
                        key={order.id} 
                        className="bg-white border border-gray-150 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden space-y-5"
                      >
                        {/* HEADER DA VENDA */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-gray-800 font-mono select-all bg-[#FAF9F6] border border-gray-100 px-2 py-0.5 rounded-md">
                                {order.id}
                              </span>
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider uppercase ${
                                order.status === 'Pago' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' :
                                order.status === 'Enviado' ? 'bg-blue-50 text-blue-700 border border-blue-200/50' :
                                order.status === 'Entregue' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50' :
                                order.status === 'Cancelado' ? 'bg-rose-50 text-rose-700 border border-rose-200/50' :
                                'bg-amber-50 text-amber-700 border border-amber-200/50'
                              }`}>
                                {order.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 text-[10px] text-gray-400 font-mono">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formattedDate}</span>
                              <span>•</span>
                              <span>{order.items.length} {order.items.length === 1 ? 'item' : 'itens'}</span>
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-gray-400 block uppercase font-mono">Total Pago</span>
                            <span className="text-base font-bold text-[#8d6e63] font-mono">
                              R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* WORK REPRESENTS */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Obras deste Pedido</h4>
                          <div className="divide-y divide-gray-50 bg-[#FAF9F6] border border-gray-100 rounded-2xl px-4 py-2">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="py-2.5 flex items-center justify-between gap-4 font-sans text-xs">
                                <div className="font-semibold text-gray-700 flex items-center gap-2">
                                  <span>{item.name}</span>
                                  <span className="text-gray-400 font-normal font-mono">x{item.quantity}</span>
                                </div>
                                <span className="font-bold text-slate-600 font-mono text-[11px]">
                                  R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* INTERACTIVE TRACKER BAR */}
                        {!isCancelled && (
                          <div className="py-4 space-y-4">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estágio de Envio</h4>
                            
                            {/* Horizontal Line steps */}
                            <div className="relative flex justify-between items-center w-full select-none">
                              {/* Background Line */}
                              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-100 -translate-y-1/2 -z-10" />
                              
                              {/* Filled Progress Line */}
                              <div 
                                className="absolute top-1/2 left-0 h-0.5 bg-[#8d6e63] -translate-y-1/2 transition-all duration-500 -z-10"
                                style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                              />

                              {steps.map((stp, stepIdx) => {
                                const isCompleted = stepIdx <= currentStepIndex;
                                const isActive = stepIdx === currentStepIndex;

                                return (
                                  <div key={stp} className="flex flex-col items-center">
                                    <div className={`h-6 w-6 rounded-full border flex items-center justify-center transition-all ${
                                      isActive ? 'bg-amber-50 text-[#8d6e63] border-[#8d6e63] scale-110 shadow-sm font-bold' :
                                      isCompleted ? 'bg-[#8d6e63] text-white border-[#8d6e63]' :
                                      'bg-white text-gray-300 border-gray-150'
                                    }`}>
                                      {isCompleted ? (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      ) : (
                                        <span className="text-[9px]">{stepIdx + 1}</span>
                                      )}
                                    </div>
                                    <span className={`text-[8px] sm:text-[9px] font-bold mt-1.5 whitespace-nowrap text-center ${
                                      isActive ? 'text-brand-wood' :
                                      isCompleted ? 'text-gray-600' :
                                      'text-gray-300'
                                    }`}>
                                      {stp.replace('Aguardando pagamento', 'Confirmado')}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {isCancelled && (
                          <div className="bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-2xl flex items-center gap-2.5 text-xs">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 animate-bounce" />
                            <span><strong>Pedido Cancelado:</strong> Este pedido foi suspenso ou cancelado. Devoluções e reembolsos de pagamento são processados via suporte telefônico ou e-mail.</span>
                          </div>
                        )}

                        {/* SHIPPING & TRACKING METADATA */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100 text-xs">
                          <div className="space-y-1 bg-[#FAF9F6] border border-gray-100 rounded-2xl p-3">
                            <span className="text-[10px] text-gray-400 block font-mono uppercase tracking-wide">Endereço de Entrega</span>
                            <p className="font-semibold text-gray-700 leading-snug">
                              {order.customerInfo.street}, {order.customerInfo.number} {order.customerInfo.complement && `(${order.customerInfo.complement})`}
                            </p>
                            <p className="text-gray-500 text-[11px]">
                              {order.customerInfo.neighborhood} — CEP {order.customerInfo.cep} — {order.customerInfo.city}/{order.customerInfo.state}
                            </p>
                          </div>

                          <div className="space-y-2.5 bg-[#FAF9F6] border border-gray-100 rounded-2xl p-3 flex flex-col justify-between">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-gray-400 block font-mono uppercase tracking-wide">Rastreamento de Frete</span>
                              {order.trackingCode ? (
                                <div className="space-y-1.5 mt-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-gray-800 font-mono tracking-wider text-[11px] select-all uppercase">
                                      {order.trackingCode}
                                    </span>
                                    <button
                                      onClick={() => copyToClipboard(order.trackingCode || '', order.id || '')}
                                      className="text-brand-wood hover:text-brand-clay text-[9px] font-bold p-1 border border-brand-wood/10 rounded bg-white inline-flex items-center gap-1 transition-all cursor-pointer outline-none"
                                    >
                                      <Copy className="w-2.5 h-2.5" />
                                      <span>{copiedOrderId === order.id ? 'Copiado!' : 'Copiar'}</span>
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-gray-400">Transportadora: {order.shippingMethod}</p>
                                </div>
                              ) : (
                                <p className="text-[11px] text-gray-400 italic">Código de rastreio indisponível. Conectado ao processo de despacho.</p>
                              )}
                            </div>

                            {/* Tracking CTAs */}
                            {order.trackingCode && (
                              <div className="flex gap-2 w-full justify-end mt-1">
                                <a 
                                  href={getTrackingUrl(order.trackingCode)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-brand-wood hover:bg-brand-clay text-white px-3.5 py-1.5 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer outline-none"
                                >
                                  <span>Rastrear Obras</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* GENERAL ORDER-LEVEL ACTIONS FOOTER */}
                        {order.status === 'Aguardando pagamento' && (
                          <div className="bg-amber-50/60 border border-amber-200/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-amber-600 animate-pulse" />
                              <span className="text-xs font-bold text-amber-800">
                                Pagamento Pendente do Pedido
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                if (order.paymentUrl) {
                                  window.open(order.paymentUrl, '_blank');
                                } else {
                                  onNavigateToView('checkout-pay', order.id);
                                }
                              }}
                              className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-2 cursor-pointer outline-none shadow-xs hover:shadow-sm transition-all sm:self-center flex-shrink-0"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Concluir Pagamento do Pedido</span>
                            </button>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="bg-white border border-gray-150 rounded-3xl p-6 sm:p-8 shadow-xs">
              <div className="space-y-4 mb-6">
                <h3 className="text-base font-serif font-bold text-gray-800 flex items-center gap-1.5 border-b border-gray-100 pb-3">
                  <MapPin className="w-5 h-5 text-brand-wood" />
                  <span>Cadastrar Novo ou Alterar Endereço de Encomendas</span>
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Estes dados de entrega são carregados automaticamente ao iniciar compras na loja virtual se você estiver conectado com este e-mail. Isso acelera o checkout, dispensando o preenchimento manual repetitivo.
                </p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-450 uppercase tracking-wider block">Nome Completo do Destinatário *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Andrew F. M. Lemos"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-450 uppercase tracking-wider block">Telefone de Contato *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="(21) 98765-4321"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-450 uppercase tracking-wider block">CPF do Destinatário (para Emissão de Nota) *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="000.000.000-00"
                      value={regCpf}
                      onChange={e => setRegCpf(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-455 uppercase tracking-wider block">CEP *</label>
                    <input 
                      type="text" 
                      required
                      maxLength={9}
                      placeholder="20100-000"
                      value={regCep}
                      onChange={e => handleCepLookup(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-gray-450 uppercase tracking-wider block">Rua / Logradouro *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Rua das Madeiras Nobres"
                      value={regStreet}
                      onChange={e => setRegStreet(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-450 uppercase tracking-wider block">Número *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="45"
                      value={regNumber}
                      onChange={e => setRegNumber(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-450 uppercase tracking-wider block">Complemento</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Sala 44 / Bloco B"
                      value={regComplement}
                      onChange={e => setRegComplement(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-gray-450 uppercase tracking-wider block">Bairro *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Floresta Artística"
                      value={regNeighborhood}
                      onChange={e => setRegNeighborhood(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-455 uppercase tracking-wider block">Cidade *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Teresópolis"
                      value={regCity}
                      onChange={e => setRegCity(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-455 uppercase tracking-wider block">Estado (UF) *</label>
                    <input 
                      type="text" 
                      required
                      maxLength={2}
                      placeholder="RJ"
                      value={regState}
                      onChange={e => setRegState(e.target.value.toUpperCase())}
                      className="w-full bg-[#FAFAFA] border border-gray-150 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-wood outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-brand-wood hover:bg-brand-clay text-white py-4 rounded-full font-bold text-sm tracking-wide shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 outline-none"
                >
                  {actionLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Gravando perfil atualizado...
                    </span>
                  ) : (
                    <span>Atualizar Cadastro de Entrega</span>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
