import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { 
  ArrowLeft, 
  CheckCircle, 
  Clock, 
  Award, 
  User, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  Lock, 
  CreditCard, 
  X, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle,
  Play
} from 'lucide-react';
import { 
  db, 
  auth, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc
} from '../firebase';
import { updateProfile, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Course, CourseModule, Lesson } from '../types';
import { ensureRobustUrl } from '../App';

interface CourseLandingPageProps {
  course: Course;
  onBack: () => void;
  currentUser: any | null;
  onNavigateToView: (view: any, id?: string) => void;
  modules: CourseModule[];
  lessons: Lesson[];
}

export const CourseLandingPage: React.FC<CourseLandingPageProps> = ({
  course,
  onBack,
  currentUser,
  onNavigateToView,
  modules,
  lessons
}) => {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  // Aggressive scroll reset to top on mount or course change
  useEffect(() => {
    const forceScrollToTop = () => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;

      // Find any element with scrollbars and reset its scrollTop
      const allElements = document.querySelectorAll("*");
      allElements.forEach((el) => {
        if (el.scrollTop > 0) {
          el.scrollTop = 0;
        }
      });
    };

    forceScrollToTop();

    // Use multiple delayed triggers to bypass late browser paint/layout adjustments
    const timer1 = setTimeout(forceScrollToTop, 10);
    const timer2 = setTimeout(forceScrollToTop, 50);
    const timer3 = setTimeout(forceScrollToTop, 150);
    const timer4 = setTimeout(forceScrollToTop, 300);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [course.id]);
  
  // Checkout & Auth form states
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
  const [instructorProfile, setInstructorProfile] = useState<any | null>(null);

  // Fetch instructor profile dynamically based on course instructorEmail or professor
  useEffect(() => {
    const email = course.instructorEmail || 'andrewfmlemos@gmail.com';
    const fetchInstructor = async () => {
      try {
        const snap = await getDoc(doc(db, 'lms_instructors', email));
        if (snap.exists()) {
          setInstructorProfile(snap.data());
        }
      } catch (err) {
        console.warn("[CourseLandingPage] Error fetching instructor profile:", err);
      }
    };
    fetchInstructor();
  }, [course.instructorEmail]);

  // Fetch ecom customer data if user is already logged in
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.displayName || '');
      setAuthEmail(currentUser.email || '');
      
      const fetchCustomerDetails = async () => {
        try {
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
          console.warn("[CourseLandingPage] Error fetching customer details:", err);
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
        const data = await response.json();
        if (!data.erro) {
          setStreet(data.logradouro || '');
          setNeighborhood(data.bairro || '');
          setCity(data.localidade || '');
          setState(data.uf || '');
        }
      } catch (err) {
        console.warn("Failed to lookup CEP:", err);
      } finally {
        setCepLoading(false);
      }
    }
  };

  // CPF formatter helper
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
      value = value.replace(/(\num)/, '$1');
      // Format simple mask 000.000.000-00
      if (value.length > 9) {
        value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      } else if (value.length > 6) {
        value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
      } else if (value.length > 3) {
        value = value.replace(/(\d{3})(\d{1,3})/, "$1.$2");
      }
      setCpf(value);
    }
  };

  // Toggle Accordions
  const toggleAccordion = (id: string) => {
    if (activeAccordion === id) {
      setActiveAccordion(null);
    } else {
      setActiveAccordion(id);
    }
  };

  // Handle Account Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError('Preencha e-mail e senha.');
      return;
    }
    setCheckoutProcessing(true);
    try {
      await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      // Success will trigger useEffect above to load data
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setAuthError('E-mail ou senha incorretos.');
      } else {
        setAuthError('Falha ao autenticar. Tente novamente.');
      }
    } finally {
      setCheckoutProcessing(false);
    }
  };

  // Handle Course Checkout Creation and redirects
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

      // 2. Formulate order details for e-learning purchase
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
          productId: course.id,
          name: course.title,
          price: course.price,
          quantity: 1,
          images: [course.imageUrl]
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

  const defaultPhoto = "https://drive.google.com/file/d/19eW-HQIP_VjSz5mQNI5EDB0L12BM-b99/view?usp=sharing";
  const defaultBio = "Com mais de uma década dedicada ao entalhe artístico, Andrew Lemos produz peças sob encomenda para colecionadores e ensina técnicas clássicas de escultura e marcenaria artística a milhares de alunos em todo o Brasil. Seu foco é desmistificar o entalhe técnico através de guias didáticos detalhados passo a passo.";
  
  const instructorName = instructorProfile?.name || course.professor || "Andrew Lemos";
  const instructorPhoto = instructorProfile?.photoUrl || defaultPhoto;
  const instructorBio = instructorProfile?.bio || defaultBio;

  return (
    <div className="space-y-16 py-6 pb-24 text-stone-300">
      {/* Back Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-stone-400 hover:text-[#D4AF37] transition-all group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Voltar para Vitrine de Cursos
        </button>
        <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-[#D4AF37]/20">
          Inscrições Abertas
        </span>
      </div>

      {/* Hero Presentation Section */}
      <div className="grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-block px-3.5 py-1 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25 rounded-full text-xs font-bold uppercase tracking-wider">
            {course.category}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-white leading-tight font-black tracking-tight text-left">
            {course.title}
          </h1>
          <p className="text-stone-400 text-sm md:text-base leading-relaxed font-sans text-left">
            {course.shortDescription || "Descubra as técnicas e segredos do entalhe e escultura tradicional com o mestre Andrew Lemos em aulas ricas de detalhes estruturados."}
          </p>

          <div className="flex flex-wrap gap-4 text-xs text-stone-300 font-semibold pt-2 justify-start">
            <span className="flex items-center gap-1.5 bg-[#131210] border border-stone-800 px-3.5 py-2.5 rounded-xl">
              <Clock className="w-4 h-4 text-[#D4AF37]" /> {course.duration || 10} horas de videoaulas
            </span>
            <span className="flex items-center gap-1.5 bg-[#131210] border border-stone-800 px-3.5 py-2.5 rounded-xl">
              <Award className="w-4 h-4 text-[#D4AF37]" /> Certificado Assinado
            </span>
            <span className="flex items-center gap-1.5 bg-[#131210] border border-stone-800 px-3.5 py-2.5 rounded-xl">
              <User className="w-4 h-4 text-[#D4AF37]" /> Mentor: {course.professor}
            </span>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-start">
            <a 
              href="#inscricao"
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-center rounded-2xl transition-all shadow-lg text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02]"
            >
              Garantir Minha Vaga • R$ {course.price.toFixed(2)}
            </a>
            <a 
              href="#conteudo"
              className="px-8 py-4 border border-stone-700 bg-[#131210]/30 hover:bg-[#1A1916]/80 text-stone-300 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 text-center font-extrabold rounded-2xl transition-all text-sm uppercase tracking-wider flex items-center justify-center"
            >
              Ver Cronograma de Aulas
            </a>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="aspect-video lg:aspect-square bg-[#131210] rounded-[2.5rem] overflow-hidden border border-stone-800 shadow-2xl relative flex items-center justify-center p-8 group">
            <img 
              src={ensureRobustUrl(course.imageUrl)} 
              alt={course.title} 
              className="max-w-full max-h-full object-contain rounded-2xl transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[2.5rem]">
              <div className="w-14 h-14 bg-[#D4AF37] rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110">
                <Play className="w-6 h-6 text-black fill-current ml-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Value Proposition / Bento grid info */}
      <div className="bg-[#131210]/80 rounded-[3rem] p-8 md:p-12 border border-stone-800 grid md:grid-cols-3 gap-8">
        <div className="space-y-3 bg-[#1C1B18]/50 p-6 rounded-2xl border border-stone-800/60 text-left">
          <div className="w-10 h-10 bg-emerald-950/40 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-bold">✓</div>
          <h3 className="font-serif font-bold text-white text-lg">Acesso Vitalício Imediato</h3>
          <p className="text-stone-400 text-xs leading-relaxed">
            Assista no celular, tablet ou computador quantas vezes quiser. Seu login nunca expira e você estuda no seu próprio ritmo.
          </p>
        </div>
        <div className="space-y-3 bg-[#1C1B18]/50 p-6 rounded-2xl border border-stone-800/60 text-left">
          <div className="w-10 h-10 bg-emerald-950/40 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-bold">✓</div>
          <h3 className="font-serif font-bold text-white text-lg">Suporte Técnico via Fotos</h3>
          <p className="text-stone-400 text-xs leading-relaxed">
            Você não estuda sozinho! Envie fotos e vídeos do progresso de suas peças direto na sala de aula para o feedback técnico do professor.
          </p>
        </div>
        <div className="space-y-3 bg-[#1C1B18]/50 p-6 rounded-2xl border border-stone-800/60 text-left">
          <div className="w-10 h-10 bg-emerald-950/40 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-bold">✓</div>
          <h3 className="font-serif font-bold text-white text-lg">MichelangelIA Integrado</h3>
          <p className="text-stone-400 text-xs leading-relaxed">
            Nossa IA exclusiva de contexto está disponível 24 horas por dia na sala de aula para tirar dúvidas sobre madeiras, ferramentas e afiação.
          </p>
        </div>
      </div>

      {/* Description complete markdown Section */}
      <div className="grid md:grid-cols-12 gap-12 items-start">
        <div className="md:col-span-7 space-y-6 text-left">
          <h2 className="text-2xl md:text-3xl font-serif text-white font-bold border-b border-stone-800 pb-2">
            Apresentação do Curso
          </h2>
          <div className="text-stone-300 text-xs md:text-sm leading-relaxed prose prose-invert prose-stone max-w-none">
            <MarkdownRenderer content={course.description} variant="blog" />
          </div>
        </div>

        {/* Course Syllabus / Curriculum detail */}
        <div id="conteudo" className="md:col-span-5 space-y-6 text-left">
          <h2 className="text-2xl md:text-3xl font-serif text-white font-bold border-b border-stone-800 pb-2 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#D4AF37]" /> Cronograma Curricular
          </h2>
          <p className="text-xs text-stone-500">Clique nos módulos para visualizar a lista completa de videoaulas inclusas.</p>
          
          <div className="space-y-3">
            {modules.filter(m => m.courseId === course.id).map((mod, index) => {
              const modLessons = lessons.filter(l => l.courseId === course.id && l.moduleId === mod.id);
              const isOpen = activeAccordion === mod.id;
              return (
                <div key={mod.id} className="border border-stone-800 rounded-2xl bg-[#131210] overflow-hidden transition-all shadow-md">
                  <button 
                    onClick={() => toggleAccordion(mod.id!)}
                    className="w-full p-4 text-left flex items-center justify-between font-serif font-bold text-sm text-stone-200 hover:bg-[#1A1916] transition-colors"
                  >
                    <span>Módulo {index + 1}: {mod.title}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[#D4AF37]" /> : <ChevronDown className="w-4 h-4 text-[#D4AF37]" />}
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-stone-800/80 bg-[#1A1916]/50 text-xs"
                      >
                        <div className="p-4 space-y-2.5">
                          <p className="text-stone-400 italic text-[11px] mb-2">{mod.description}</p>
                          {modLessons.length === 0 ? (
                            <p className="text-stone-500 text-[10px]">Nenhuma aula adicionada neste módulo ainda.</p>
                          ) : (
                            modLessons.map((lesson, lessonIdx) => (
                              <div key={lesson.id} className="flex items-center gap-2 text-stone-300 font-medium pl-1 py-1 border-b border-stone-900 last:border-0">
                                <Play className="w-3.5 h-3.5 text-[#D4AF37] fill-current flex-shrink-0" />
                                <span>Aula {lessonIdx + 1}: {lesson.title}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bio / About Instructor Section */}
      <div className="bg-[#131210] rounded-[3rem] border border-stone-800 p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center text-left">
        <div className="w-24 h-24 md:w-36 md:h-36 rounded-full overflow-hidden bg-stone-900 border border-stone-800 flex-shrink-0">
          <img 
            src={ensureRobustUrl(instructorPhoto)} 
            alt={instructorName} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="space-y-4">
          <div className="inline-block px-2.5 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Seu Instrutor / Escultor
          </div>
          <h3 className="font-serif font-bold text-2xl text-white">{instructorName}</h3>
          <p className="text-stone-400 text-xs leading-relaxed max-w-2xl">
            {instructorBio}
          </p>
        </div>
      </div>

      {/* EMBEDDED CONVERSION CHECKOUT / AUTH REGISTER FORM */}
      <div id="inscricao" className="max-w-4xl mx-auto">
        <div className="bg-[#131210] text-white rounded-[3rem] p-8 md:p-12 border border-stone-800/80 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow decorator */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative text-center max-w-2xl mx-auto mb-10 space-y-3">
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest block">Área de Compra Segura</span>
            <h2 className="font-serif text-3xl md:text-4xl font-bold">Faça Sua Matrícula Agora</h2>
            <p className="text-stone-400 text-xs md:text-sm">
              Preencha seu cadastro para criar sua Área do Aluno e acessar o curso imediatamente após a aprovação de pagamento via Mercado Pago.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start relative">
            {/* Left summary details card column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#1C1B18]/40 border border-stone-800 rounded-3xl p-6 space-y-4">
                <h3 className="font-serif text-lg font-bold text-white">Resumo do Pedido</h3>
                
                <div className="space-y-3 pt-2">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-stone-900 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center p-1 border border-stone-800">
                      <img src={ensureRobustUrl(course.imageUrl)} className="max-w-full max-h-full object-contain" alt="" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold leading-snug line-clamp-2 text-stone-100">{course.title}</h4>
                      <span className="text-[10px] text-stone-500 block">{course.category}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-stone-800 pt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-stone-400">
                    <span>Carga horária</span>
                    <span className="text-stone-200">{course.duration || 10}h de aulas</span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Plataforma</span>
                    <span className="text-stone-200">Área do Aluno Premium</span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Suporte Técnico</span>
                    <span className="text-stone-200">Avaliação de fotos inclusa</span>
                  </div>
                  <div className="flex justify-between text-stone-400">
                    <span>Taxas / Frete</span>
                    <span className="text-emerald-400 font-semibold">R$ 0,00 (Digital)</span>
                  </div>
                </div>

                <div className="border-t border-stone-800 pt-4 flex justify-between items-end">
                  <div>
                    <span className="text-[10px] text-stone-500 block uppercase font-bold">Total a Pagar</span>
                    <span className="text-2xl font-bold font-mono text-[#D4AF37]">R$ {course.price.toFixed(2)}</span>
                  </div>
                  <div className="text-[9px] text-stone-500 text-right max-w-[120px] leading-relaxed">
                    Acesso imediato e vitalício. Sem mensalidades.
                  </div>
                </div>

                <div className="bg-[#1A1916]/40 p-3.5 rounded-2xl border border-stone-800/80 flex items-center gap-3 text-[10px] text-stone-400 leading-normal">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                  <span>Garantia de 7 dias protegida. Compre com segurança total.</span>
                </div>
              </div>

              {/* Security/Guarantee Seal */}
              <div className="flex flex-col items-center justify-center p-4 bg-[#1C1B18]/25 border border-stone-800/60 rounded-3xl">
                <img 
                  src={ensureRobustUrl("https://drive.google.com/file/d/1lATMsJonpoCfn-Z3v2TYCJvhAHb0WLTr/view?usp=sharing")} 
                  alt="Selo de Garantia de 7 dias" 
                  className="max-h-56 object-contain w-auto mx-auto rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Right complete interactive checkout form */}
            <div className="lg:col-span-7 bg-[#1C1B18]/60 text-stone-300 rounded-3xl p-6 md:p-8 border border-stone-800 shadow-xl">
              {currentUser ? (
                // LOGGED-IN REGISTERED USER CHECKOUT VIEW
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  <div className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 p-4 rounded-2xl text-xs flex items-start gap-2.5">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5 text-emerald-200">Logado com Sucesso!</span>
                      <span>Sua matrícula será vinculada automaticamente ao e-mail <strong className="text-emerald-100">{currentUser.email}</strong>. Por favor, confirme seus dados de cobrança obrigatórios abaixo para prosseguir para o pagamento seguro.</span>
                    </div>
                  </div>

                  <h3 className="font-serif text-sm font-bold text-[#D4AF37] border-b border-stone-800 pb-2 pt-1">Dados de Faturamento (Obrigatório)</h3>

                  <div className="space-y-3 text-xs font-medium text-stone-300">
                    <div>
                      <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Nome Completo *</label>
                      <input 
                        type="text"
                        required
                        className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                        placeholder="Nome completo para emissão do certificado"
                        value={name}
                        onChange={e => setName(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Telefone / WhatsApp *</label>
                        <input 
                          type="tel"
                          required
                          className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                          placeholder="(11) 99999-9999"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">CPF *</label>
                        <input 
                          type="text"
                          required
                          className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                          placeholder="000.000.000-00"
                          value={cpf}
                          onChange={handleCpfChange}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">CEP *</label>
                        <input 
                          type="text"
                          required
                          className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                          placeholder="00000-000"
                          maxLength={9}
                          value={cep}
                          onChange={handleCepChange}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Endereço (Rua/Av) *</label>
                        <input 
                          type="text"
                          required
                          className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                          placeholder="Rua, Avenida, etc."
                          value={street}
                          onChange={e => setStreet(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Número *</label>
                        <input 
                          type="text"
                          required
                          className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                          placeholder="123"
                          value={number}
                          onChange={e => setNumber(e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Complemento</label>
                        <input 
                          type="text"
                          className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                          placeholder="Apto, Bloco, etc. (Opcional)"
                          value={complement}
                          onChange={e => setComplement(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Bairro *</label>
                        <input 
                          type="text"
                          required
                          className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                          placeholder="Centro"
                          value={neighborhood}
                          onChange={e => setNeighborhood(e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Cidade *</label>
                        <input 
                          type="text"
                          required
                          className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                          placeholder="Sua cidade"
                          value={city}
                          onChange={e => setCity(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Estado (UF) *</label>
                      <input 
                        type="text"
                        required
                        className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                        placeholder="Ex: SP, RJ, MG"
                        maxLength={2}
                        value={state}
                        onChange={e => setState(e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>

                  {checkoutError && (
                    <div className="text-[11px] text-red-400 bg-red-950/20 p-3 rounded-xl border border-red-900 font-semibold">
                      {checkoutError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={checkoutProcessing}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 hover:scale-[1.01]"
                  >
                    {checkoutProcessing ? 'Processando...' : `Confirmar Matrícula e Pagar R$ ${course.price.toFixed(2)} 🚀`}
                  </button>
                </form>
              ) : (
                // GUEST / UNAUTHENTICATED USER LANDING PAGE FORM WITH LOG-IN/SIGN-UP TABS
                <div className="space-y-6">
                  {/* Tabs select */}
                  <div className="grid grid-cols-2 bg-[#131210] p-1 rounded-xl text-xs font-bold text-stone-500 border border-stone-800/60">
                    <button
                      type="button"
                      onClick={() => { setAuthTab('register'); setAuthError(''); setCheckoutError(''); }}
                      className={`py-2.5 rounded-lg transition-colors cursor-pointer outline-none ${authTab === 'register' ? 'bg-[#1C1B18] text-[#D4AF37] border border-stone-800/80 shadow-md' : 'hover:text-stone-300'}`}
                    >
                      1. Criar Conta & Comprar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthTab('login'); setAuthError(''); setCheckoutError(''); }}
                      className={`py-2.5 rounded-lg transition-colors cursor-pointer outline-none ${authTab === 'login' ? 'bg-[#1C1B18] text-[#D4AF37] border border-stone-800/80 shadow-md' : 'hover:text-stone-300'}`}
                    >
                      2. Já tenho Conta
                    </button>
                  </div>

                  {authTab === 'login' ? (
                    // LOGIN TAB FORM
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="bg-[#1A1916] text-stone-300 border border-stone-800/80 p-4 rounded-2xl text-xs leading-relaxed">
                        Faça login utilizando seus dados cadastrais para carregar seus dados e prosseguir ao checkout de pagamento integrado do curso.
                      </div>
                      
                      <div className="space-y-3 text-xs font-medium text-stone-300">
                        <div>
                          <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Seu E-mail *</label>
                          <input 
                            type="email"
                            required
                            className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                            placeholder="seuemail@exemplo.com"
                            value={authEmail}
                            onChange={e => setAuthEmail(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Senha Secreta *</label>
                          <input 
                            type="password"
                            required
                            className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                            placeholder="Sua senha de acesso"
                            value={authPassword}
                            onChange={e => setAuthPassword(e.target.value)}
                          />
                        </div>
                      </div>

                      {authError && (
                        <div className="text-[11px] text-red-400 bg-red-950/20 p-3 rounded-xl border border-red-900 font-semibold">
                          {authError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={checkoutProcessing}
                        className="w-full py-4 rounded-2xl bg-stone-800 hover:bg-stone-750 text-white font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 border border-stone-700"
                      >
                        {checkoutProcessing ? 'Autenticando...' : 'Fazer Login & Prosseguir 🔐'}
                      </button>
                    </form>
                  ) : (
                    // REGISTER TAB FORM (FULL BILLING DATA REGISTRATION)
                    <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                      <h3 className="font-serif text-sm font-bold text-[#D4AF37] border-b border-stone-800 pb-2">1. Dados de Login e Acesso</h3>

                      <div className="space-y-3 text-xs font-medium text-stone-300">
                        <div>
                          <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Nome Completo *</label>
                          <input 
                            type="text"
                            required
                            className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                            placeholder="Nome para emissão do certificado"
                            value={name}
                            onChange={e => setName(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">E-mail para Acesso *</label>
                          <input 
                            type="email"
                            required
                            className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                            placeholder="Ex: seuemail@exemplo.com"
                            value={authEmail}
                            onChange={e => setAuthEmail(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Senha de Acesso *</label>
                            <input 
                              type="password"
                              required
                              className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                              placeholder="Mínimo 6 caracteres"
                              value={authPassword}
                              onChange={e => setAuthPassword(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Confirmar Senha *</label>
                            <input 
                              type="password"
                              required
                              className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                              placeholder="Repita a senha"
                              value={authConfirmPassword}
                              onChange={e => setAuthConfirmPassword(e.target.value)}
                            />
                          </div>
                        </div>

                        <h3 className="font-serif text-sm font-bold text-[#D4AF37] border-b border-stone-800 pb-2 pt-3">2. Dados de Faturamento Obrigatórios</h3>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Telefone / WhatsApp *</label>
                            <input 
                              type="tel"
                              required
                              className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                              placeholder="(11) 99999-9999"
                              value={phone}
                              onChange={e => setPhone(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">CPF *</label>
                            <input 
                              type="text"
                              required
                              className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                              placeholder="000.000.000-00"
                              value={cpf}
                              onChange={handleCpfChange}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-1">
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold text-ellipsis overflow-hidden whitespace-nowrap">CEP *</label>
                            <input 
                              type="text"
                              required
                              className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                              placeholder="00000-000"
                              maxLength={9}
                              value={cep}
                              onChange={handleCepChange}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Endereço (Rua/Av) *</label>
                            <input 
                              type="text"
                              required
                              className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                              placeholder="Rua, Avenida, etc."
                              value={street}
                              onChange={e => setStreet(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Número *</label>
                            <input 
                              type="text"
                              required
                              className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                              placeholder="123"
                              value={number}
                              onChange={e => setNumber(e.target.value)}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Complemento</label>
                            <input 
                              type="text"
                              className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                              placeholder="Apto, Bloco (Opcional)"
                              value={complement}
                              onChange={e => setComplement(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Bairro *</label>
                            <input 
                              type="text"
                              required
                              className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                              placeholder="Centro"
                              value={neighborhood}
                              onChange={e => setNeighborhood(e.target.value)}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Cidade *</label>
                            <input 
                              type="text"
                              required
                              className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                              placeholder="Sua cidade"
                              value={city}
                              onChange={e => setCity(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-500 uppercase tracking-wider block mb-1 font-semibold">Estado (UF) *</label>
                          <input 
                            type="text"
                            required
                            className="w-full p-3 rounded-xl border border-stone-800 bg-[#131210] text-stone-200 placeholder-stone-600 focus:bg-[#131210] outline-none focus:border-[#D4AF37] transition-all text-xs font-semibold"
                            placeholder="Ex: SP, RJ, MG"
                            maxLength={2}
                            value={state}
                            onChange={e => setState(e.target.value.toUpperCase())}
                          />
                        </div>
                      </div>

                      {checkoutError && (
                        <div className="text-[11px] text-red-400 bg-red-950/20 p-3 rounded-xl border border-red-900 font-semibold">
                          {checkoutError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={checkoutProcessing}
                        className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01]"
                      >
                        {checkoutProcessing ? 'Processando...' : 'Matricular Agora 🚀'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
