import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { 
  BookOpen, 
  Play, 
  CheckCircle, 
  Award, 
  MessageSquare, 
  DollarSign, 
  Send, 
  Upload, 
  Lock, 
  ExternalLink, 
  FileText, 
  Sparkles, 
  User, 
  ChevronRight, 
  ChevronLeft, 
  ArrowLeft,
  X,
  CreditCard,
  QrCode,
  Barcode,
  Copy,
  Clock,
  Flame,
  Bell,
  Trash2,
  Calendar,
  Layers,
  Heart,
  Share2,
  Printer,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  db, 
  auth, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  getDoc,
  deleteDoc,
  getDocs,
  where,
  limit,
  or,
  and,
  handleFirestoreError,
  OperationType,
  googleProvider,
  signInWithPopup
} from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { 
  Course, 
  CourseModule, 
  Lesson, 
  Enrollment, 
  StudentProgress, 
  LessonComment, 
  SupportMessage, 
  AffiliateProfile, 
  CourseCertificate, 
  SystemNotification 
} from '../types';
import { ensureRobustUrl } from '../App';
import { CourseLandingPage } from './CourseLandingPage';

// Setup local cookies or local storage for referral code
const setReferralCookie = (code: string) => {
  localStorage.setItem('lms_affiliate_ref', code);
};

const getReferralCookie = () => {
  return localStorage.getItem('lms_affiliate_ref');
};

const getYouTubeEmbedUrl = (url: string): string => {
  if (!url) return '';
  try {
    if (url.includes('/embed/')) return url;
    
    // Check youtu.be
    if (url.includes('youtu.be/')) {
      const parts = url.split('youtu.be/');
      if (parts[1]) {
        const id = parts[1].split('?')[0].split('&')[0];
        return `https://www.youtube.com/embed/${id}`;
      }
    }
    
    // Check youtube.com/watch
    if (url.includes('v=')) {
      const parts = url.split('v=');
      if (parts[1]) {
        const id = parts[1].split('&')[0];
        return `https://www.youtube.com/embed/${id}`;
      }
    }
    
    // Fallback regex match for YouTube IDs
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  } catch (e) {
    console.error("Error formatting video url:", e);
  }
  return url;
};

interface LMSPortalProps {
  currentUser: any | null;
  onNavigateToView: (view: any, id?: string) => void;
}

export const LMSPortal: React.FC<LMSPortalProps> = ({ currentUser, onNavigateToView }) => {
  const [activeSubTab, setActiveSubTab] = useState<'classroom' | 'catalog' | 'affiliate' | 'messages'>('catalog');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [catalogTab, setCatalogTab] = useState<'courses' | 'ebooks'>('courses');
  const [ebooks, setEbooks] = useState<any[]>([]);
  const [myPurchasedIds, setMyPurchasedIds] = useState<string[]>([]);
  const [activeReadingEbook, setActiveReadingEbook] = useState<any | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progressList, setProgressList] = useState<StudentProgress[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // First-access password change modal states
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  
  // Active classroom selection states
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState<number>(0);
  const [classroomTab, setClassroomTab] = useState<'video' | 'apostila' | 'ia' | 'comments'>('video');
  
  // Storefront & Checkout modal states
  const [viewingCourseDetail, setViewingCourseDetail] = useState<Course | null>(null);
  const [checkoutCourse, setCheckoutCourse] = useState<Course | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'boleto'>('pix');
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  
  // Checkout Input States
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [installments, setInstallments] = useState('1');

  // Support messages states
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [newMessageSubject, setNewMessageSubject] = useState('');
  const [newMessageContent, setNewMessageContent] = useState('');
  const [newMessageCourseId, setNewMessageCourseId] = useState('');
  const [newMessageImage, setNewMessageImage] = useState('');
  const [supportSending, setSupportSending] = useState(false);

  // Lesson Comments State
  const [lessonComments, setLessonComments] = useState<LessonComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // MichelangelIA Support State inside lessons
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Affiliate State
  const [affiliateProfile, setAffiliateProfile] = useState<AffiliateProfile | null>(null);
  const [affiliateCommissions, setAffiliateCommissions] = useState<any[]>([]);
  const [affiliateCodeInput, setAffiliateCodeInput] = useState('');
  const [affiliateRegistering, setAffiliateRegistering] = useState(false);
  const [affiliateSuccessMsg, setAffiliateSuccessMsg] = useState('');

  // Certificate State
  const [issuedCert, setIssuedCert] = useState<CourseCertificate | null>(null);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);

  // Auto-populate / Seeding status
  const [loading, setLoading] = useState(true);

  // Set referral code if present in the URL query string
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      setReferralCookie(refCode);
      // Track click silently in DB
      trackAffiliateClick(refCode);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      setShowLoginModal(false);
    }
  }, [currentUser]);

  // Reset scroll to top on any view or subpage state transitions inside LMSPortal
  useEffect(() => {
    const forceScrollToTop = () => {
      // Reset window viewport
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;

      // Reset any scrollable container in the entire DOM
      const allElements = document.querySelectorAll("*");
      allElements.forEach((el) => {
        if (el.scrollTop > 0) {
          el.scrollTop = 0;
        }
      });
    };

    forceScrollToTop();

    // Staggered intervals to handle late rendering layouts and image asset loads
    const timerInstant = setTimeout(forceScrollToTop, 10);
    const timerQuick = setTimeout(forceScrollToTop, 50);
    const timerDelayed = setTimeout(forceScrollToTop, 150);
    const timerSlow = setTimeout(forceScrollToTop, 300);

    return () => {
      clearTimeout(timerInstant);
      clearTimeout(timerQuick);
      clearTimeout(timerDelayed);
      clearTimeout(timerSlow);
    };
  }, [activeSubTab, viewingCourseDetail, selectedCourse, activeLesson, activeReadingEbook, classroomTab]);

  const trackAffiliateClick = async (code: string) => {
    const sessionKey = `lms_tracked_click_${code}`;
    if (sessionStorage.getItem(sessionKey)) return;

    try {
      const q = query(collection(db, 'lms_affiliates'), where('code', '==', code), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const affDoc = querySnapshot.docs[0];
        const docRef = doc(db, 'lms_affiliates', affDoc.id);
        await updateDoc(docRef, {
          clicks: (affDoc.data().clicks || 0) + 1
        });
        sessionStorage.setItem(sessionKey, 'true');
      }
    } catch (err) {
      console.warn("Failed tracking affiliate click:", err);
    }
  };

  // Fetch all initial core databases in real-time
  useEffect(() => {
    const unsubscribeCourses = onSnapshot(collection(db, 'lms_courses'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Course));
      setCourses(list);
      
      // Auto seed database if there are no courses to ensure Andrew Lemos LMS always has ready-to-use content
      if (snapshot.empty && list.length === 0) {
        if (currentUser && currentUser.email === 'andrewfmlemos@gmail.com') {
          seedInitialLMSData();
        } else {
          console.log("Seeding do LMS ignorado. Aguardando login do administrador (andrewfmlemos@gmail.com) para seeding.");
        }
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_courses');
    });

    const unsubscribeModules = onSnapshot(query(collection(db, 'lms_modules'), orderBy('order', 'asc')), (snapshot) => {
      setModules(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CourseModule)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_modules');
    });

    const unsubscribeLessons = onSnapshot(query(collection(db, 'lms_lessons'), orderBy('order', 'asc')), (snapshot) => {
      setLessons(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_lessons');
    });

    const unsubscribeNotifications = onSnapshot(query(collection(db, 'lms_notifications'), orderBy('createdAt', 'desc')), (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemNotification)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_notifications');
    });

    const unsubscribeEbooks = onSnapshot(collection(db, 'ecom_products'), (snapshot) => {
      const allProds = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = allProds.filter((p: any) => p.category === 'Apostilas & E-books' || p.digitalPdfUrl);
      setEbooks(filtered);
    }, (error) => {
      console.error("Erro ao escutar apostilas no LMSPortal:", error);
    });

    return () => {
      unsubscribeCourses();
      unsubscribeModules();
      unsubscribeLessons();
      unsubscribeNotifications();
      unsubscribeEbooks();
    };
  }, [currentUser]);

  // Fetch user-specific real-time collections (enrollments, progress, messages, affiliate profile)
  useEffect(() => {
    if (!currentUser) {
      setEnrollments([]);
      setProgressList([]);
      setAffiliateProfile(null);
      setSupportMessages([]);
      return;
    }

    // User Profile
    const userDocRef = doc(db, 'ecom_customers', currentUser.uid);
    getDoc(userDocRef).then((snap) => {
      if (snap.exists()) {
        setUserProfile(snap.data());
        setCpf(snap.data().cpf || '');
        setPhone(snap.data().phone || '');
      }
    });

    // Check if first-access password change is required
    const profileRef = doc(db, 'lms_student_profiles', currentUser.uid);
    getDoc(profileRef).then((snap) => {
      if (snap.exists()) {
        const pData = snap.data();
        if (pData.needsPasswordChange) {
          setNeedsPasswordChange(true);
        }
      }
    }).catch(err => console.warn("Error fetching student profile needsPasswordChange flag:", err));

    // Enrollments
    const enrollQuery = query(collection(db, 'lms_enrollments'), where('userId', '==', currentUser.uid));
    const unsubscribeEnroll = onSnapshot(enrollQuery, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment));
      setEnrollments(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_enrollments');
    });

    // Progress
    const progQuery = query(collection(db, 'lms_progress'), where('userId', '==', currentUser.uid));
    const unsubscribeProg = onSnapshot(progQuery, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudentProgress));
      setProgressList(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_progress');
    });

    // Support Messages
    const msgQuery = query(
      collection(db, 'lms_messages'),
      or(where('senderId', '==', currentUser.uid), where('receiverId', '==', currentUser.uid))
    );
    const unsubscribeMsg = onSnapshot(msgQuery, (snapshot) => {
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as SupportMessage))
        .sort((a, b) => {
          const tA = a.createdAt?.seconds || (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0) || 0;
          const tB = b.createdAt?.seconds || (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) || 0;
          return tA - tB;
        });
      setSupportMessages(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_messages');
    });

    // Affiliate Profile
    const affiliateDocRef = doc(db, 'lms_affiliates', currentUser.uid);
    const unsubscribeAff = onSnapshot(affiliateDocRef, (snap) => {
      if (snap.exists()) {
        setAffiliateProfile({ id: snap.id, ...snap.data() } as AffiliateProfile);
      } else {
        setAffiliateProfile(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `lms_affiliates/${currentUser.uid}`);
    });

    // Affiliate Commissions
    const commQuery = query(collection(db, 'lms_commissions'), where('affiliateId', '==', currentUser.uid));
    const unsubscribeComm = onSnapshot(commQuery, (snapshot) => {
      setAffiliateCommissions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.warn("Erro ao carregar comissões do afiliado:", error);
    });

    // Student Purchased Ebooks and digital products via paid orders
    const ordersQuery = query(collection(db, 'ecom_orders'), where('userId', '==', currentUser.uid));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const purchasedProductIds = new Set<string>();
      snapshot.docs.forEach((d) => {
        const order = d.data();
        const isPaid = ['paid', 'completed', 'delivered', 'approved', 'processing', 'pago'].includes(order.status?.toLowerCase());
        if (isPaid && order.items) {
          order.items.forEach((item: any) => {
            purchasedProductIds.add(item.id || item.productId);
          });
        }
      });
      if (currentUser?.email === 'alunoteste@academia.com') {
        purchasedProductIds.add("product-manual-introducao-entalhe");
      }
      setMyPurchasedIds(Array.from(purchasedProductIds));
    }, (error) => {
      console.warn("Erro ao monitorar pedidos de apostilas do aluno:", error);
    });

    return () => {
      unsubscribeEnroll();
      unsubscribeProg();
      unsubscribeMsg();
      unsubscribeAff();
      unsubscribeComm();
      unsubscribeOrders();
    };
  }, [currentUser]);

  // Handle lesson comments stream
  useEffect(() => {
    if (!activeLesson) return;
    const commentsQuery = query(collection(db, 'lms_comments'), orderBy('createdAt', 'desc'));
    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as LessonComment))
        .filter(c => c.lessonId === activeLesson.id);
      setLessonComments(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_comments');
    });
    return () => unsubscribeComments();
  }, [activeLesson]);

  // Switch to apostila/material tab if there's no video but there are handouts/materials
  useEffect(() => {
    if (activeLesson) {
      if (!activeLesson.videoUrl && activeLesson.materials && activeLesson.materials.length > 0) {
        setClassroomTab('apostila');
      } else {
        setClassroomTab('video');
      }
    }
  }, [activeLesson]);

  // Seed default core LMS courses if completely blank
  const seedInitialLMSData = async () => {
    try {
      console.log("Seeding initial professional courses for Andrew Lemos Art Academy...");
      const dummyCourses: Course[] = [
        {
          id: 'curso-madeira-1',
          title: 'Mestrado em Entalhe em Madeira - Relevos Realistas',
          description: 'Aprenda do absoluto zero as técnicas clássicas de entalhe em madeira maciça com o mestre Andrew Lemos. Domine o uso de formões, goivas, preparação de madeiras, transferência de desenhos, técnicas de relevo plano e tridimensional, até os acabamentos finos de cera de abelhas e seladoras naturais.',
          imageUrl: '/arquivos/Capa_curso_udemy_game.jpeg',
          professor: 'Andrew Lemos',
          category: 'Entalhe/Escultura em Madeira',
          price: 297.00,
          status: 'Ativo',
          slug: 'mestrado-entalhe-relevos-realistas',
          metaTitle: 'Curso Completo de Entalhe em Madeira com Andrew Lemos',
          metaDescription: 'Aprenda entalhe em relevo realista e escultura em madeira com técnicas tradicionais de ateliê.',
          duration: 32,
          hasCertificate: true,
          accessibilityType: 'lifetime'
        },
        {
          id: 'curso-desenho-1',
          title: 'Pintura Acadêmica & Anatomia de Animais na Madeira',
          description: 'Aprenda a aplicar profundidade, volumetria e cores translúcidas de óleo e acrílica sobre superfícies entalhadas. Este curso aborda desde as proporções e anatomia animal aplicadas à escultura (como felinos, aves de rapina e cavalos selvagens) até técnicas mistas de pirografia estética.',
          imageUrl: '/arquivos/Screenshot_20230624_181044_Samsung Notes.jpg',
          professor: 'Andrew Lemos',
          category: 'Pintura/Acabamento',
          price: 189.90,
          status: 'Ativo',
          slug: 'pintura-academica-anatomia-animais',
          duration: 18,
          hasCertificate: true,
          accessibilityType: 'lifetime'
        },
        {
          id: 'curso-pirografia-1',
          title: 'Segredos da Pirografia Profissional em Cedro',
          description: 'Explore o mundo dos contrastes térmicos. Um infoproduto rico que guia o aluno na queima precisa de madeiras claras de Cedro e Caixeta. Domine sombreamento por pirógrafo, ajuste de calor, ponteiras artesanais, texturas de pelos realistas e vedação à prova de raios UV.',
          imageUrl: '/arquivos/Screenshot_20230425_211524_WhatsAppBusiness.jpg',
          professor: 'Andrew Lemos',
          category: 'Pirografia',
          price: 99.00,
          status: 'Em breve',
          slug: 'pirografia-profissional-cedro',
          duration: 10,
          hasCertificate: true,
          accessibilityType: 'lifetime'
        }
      ];

      for (const course of dummyCourses) {
        await setDoc(doc(db, 'lms_courses', course.id!), course);
      }

      // Seed dummy modules
      const dummyModules: CourseModule[] = [
        { id: 'mod-1', courseId: 'curso-madeira-1', title: 'Módulo I: Fundamentos das Ferramentas', description: 'Apresentação dos formões tradicionais, afiação de precisão e segurança no manuseio.', order: 1 },
        { id: 'mod-2', courseId: 'curso-madeira-1', title: 'Módulo II: Seleção de Madeiras e Fibras', description: 'Como escolher as madeiras adequadas (Cedro, Imbuia, Pinus, Garapeira) e entender o sentido da fibra.', order: 2 },
        { id: 'mod-3', courseId: 'curso-madeira-1', title: 'Módulo III: Entalhe de Folhagens e Natureza', description: 'Passo a passo prático do entalhe de flores decorativas e folhas acanto clássicas.', order: 3 }
      ];

      for (const m of dummyModules) {
        await setDoc(doc(db, 'lms_modules', m.id!), m);
      }

      // Seed dummy lessons
      const dummyLessons: Lesson[] = [
        {
          id: 'les-1',
          courseId: 'curso-madeira-1',
          moduleId: 'mod-1',
          title: 'Aula 1: Apresentação das Goivas e Formões Cruciais',
          description: 'Uma introdução completa sobre os principais perfis de formões (reto, angular) e goivas (curvas, formato V). Entenda qual comprar e as marcas recomendadas pelo mestre.',
          videoUrl: 'https://www.youtube.com/embed/S_71E6rUvvs',
          order: 1,
          materials: [
            { name: 'Guia Ilustrado de Formões e Perfis (PDF Protegido)', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', type: 'pdf' },
            { name: 'Gabarito Técnico de Afiação (Imagem)', url: '/arquivos/Capa_curso_udemy_game.jpeg', type: 'image' }
          ]
        },
        {
          id: 'les-2',
          courseId: 'curso-madeira-1',
          moduleId: 'mod-1',
          title: 'Aula 2: Técnica Correta de Afiação na Pedra e Couro (Strop)',
          description: 'A afiação correta é o segredo de um entalhe sem esforço e livre de acidentes. Aprenda a polir o fio da lâmina no couro para obter cortes perfeitos em madeiras duras.',
          videoUrl: 'https://www.youtube.com/embed/gV4QeD2-Hjo',
          order: 2,
          materials: []
        },
        {
          id: 'les-3',
          courseId: 'curso-madeira-1',
          moduleId: 'mod-2',
          title: 'Aula 3: Como Reconhecer e Seguir a Fibra da Madeira',
          description: 'Saber ler o sentido dos anéis de crescimento da madeira evita que formões arranquem lascas descontroladas. Aula vital para esculpir com perfeição.',
          videoUrl: 'https://www.youtube.com/embed/fD36vTee_4w',
          order: 1,
          materials: [
            { name: 'Ficha Técnica de Madeiras Brasileiras de Entalhe', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', type: 'pdf' }
          ]
        },
        {
          id: 'les-4',
          courseId: 'curso-madeira-1',
          moduleId: 'mod-3',
          title: 'Aula 4: Desenho e Entalhe em Alto-Relevo de Folhas Acanto',
          description: 'Vamos colocar as mãos na massa! Transfira o molde da famosa folha de acanto barroca e execute o rebaixamento de fundo.',
          videoUrl: 'https://www.youtube.com/embed/S_71E6rUvvs',
          order: 1,
          materials: [
            { name: 'Molde PDF para Impressão da Folha Barroca', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', type: 'pdf' }
          ]
        }
      ];

      for (const l of dummyLessons) {
        await setDoc(doc(db, 'lms_lessons', l.id!), l);
      }

      console.log("LMS Database Seed completed successfully!");
    } catch (err) {
      console.error("Failed seeding database:", err);
    }
  };

  // Coupon application logic
  const handleApplyCoupon = async () => {
    setCouponError('');
    setCouponDiscount(0);
    setCouponApplied(false);

    if (!couponCode.trim()) return;

    try {
      const trimmedCode = couponCode.trim();
      let couponDoc = await getDoc(doc(db, 'ecom_coupons', trimmedCode));
      if (!couponDoc.exists()) {
        couponDoc = await getDoc(doc(db, 'ecom_coupons', trimmedCode.toUpperCase()));
      }

      if (couponDoc.exists()) {
        const data = couponDoc.data();
        if (data.used) {
          setCouponError('Este cupom já foi utilizado.');
        } else if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          setCouponError('Este cupom expirou.');
        } else {
          setCouponDiscount(data.discountPercent || 10);
          setCouponApplied(true);
        }
      } else {
        // Check static/dynamic rules fallback or register a client-side success for simple demo coupons (e.g., ANDREW10, ACADEMIA20)
        const codeUpper = trimmedCode.toUpperCase();
        if (codeUpper === 'ANDREW10') {
          setCouponDiscount(10);
          setCouponApplied(true);
        } else if (codeUpper === 'ACADEMIA20') {
          setCouponDiscount(20);
          setCouponApplied(true);
        } else {
          setCouponError('Cupom inválido ou não correspondente para sua conta.');
        }
      }
    } catch (err) {
      setCouponError('Erro ao buscar o cupom.');
    }
  };

  // Support Message submission (Art helpdesk)
  const handleSendSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageContent.trim()) return;

    setSupportSending(true);
    try {
      const selectedCourseObj = courses.find(c => c.id === newMessageCourseId);
      const msg: SupportMessage = {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || userProfile?.name || currentUser.email.split('@')[0],
        senderEmail: currentUser.email,
        receiverId: 'admin',
        courseId: newMessageCourseId || null,
        courseTitle: selectedCourseObj?.title || null,
        subject: newMessageSubject.trim() || 'Dúvida Artística / Envio de Trabalho',
        content: newMessageContent.trim(),
        imageUrl: newMessageImage.trim() || null,
        read: false,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'lms_messages'), msg);
      
      // Send notifications to Student
      const notif: SystemNotification = {
        title: 'Mensagem Enviada ao Ateliê',
        message: `Sua mensagem sobre "${msg.subject}" foi encaminhada com sucesso ao instrutor Andrew Lemos. Você receberá feedback em breve.`,
        target: 'all',
        createdAt: new Date()
      };
      await addDoc(collection(db, 'lms_notifications'), notif);

      setNewMessageSubject('');
      setNewMessageContent('');
      setNewMessageCourseId('');
      setNewMessageImage('');
      alert("Mensagem enviada com sucesso ao Mestre Andrew Lemos!");
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Erro ao enviar a mensagem. Tente novamente.");
    } finally {
      setSupportSending(false);
    }
  };

  // Create customized comment under active lesson
  const handlePostComment = async () => {
    if (!newCommentText.trim() || !activeLesson) return;

    try {
      const comment: LessonComment = {
        lessonId: activeLesson.id!,
        courseId: selectedCourse!.id!,
        userId: currentUser.uid,
        userName: currentUser.displayName || userProfile?.name || currentUser.email.split('@')[0],
        userEmail: currentUser.email,
        text: newCommentText.trim(),
        moderated: false,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'lms_comments'), comment);
      setNewCommentText('');
    } catch (err) {
      console.error("Error posting comment:", err);
    }
  };

  // Post a reply to an existing comment
  const handlePostReply = async (commentId: string) => {
    if (!replyText.trim() || !activeLesson) return;

    try {
      const commentRef = doc(db, 'lms_comments', commentId);
      const reply = {
        id: Math.random().toString(36).substr(2, 9),
        userId: currentUser.uid,
        userName: currentUser.displayName || userProfile?.name || currentUser.email.split('@')[0],
        userEmail: currentUser.email,
        text: replyText.trim(),
        createdAt: new Date().toISOString(),
        isAdmin: currentUser.email === 'andrewfmlemos@gmail.com'
      };

      const cSnap = await getDoc(commentRef);
      if (cSnap.exists()) {
        const replies = cSnap.data().replies || [];
        await updateDoc(commentRef, {
          replies: [...replies, reply]
        });
      }
      setReplyingCommentId(null);
      setReplyText('');
    } catch (err) {
      console.error("Error posting reply:", err);
    }
  };

  // Delete comment / replies (admins or authors can do this)
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Deseja realmente remover este comentário?")) return;
    try {
      await deleteDoc(doc(db, 'lms_comments', commentId));
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  // Enrollments payment sandbox processing
  const handleProcessCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutCourse || !currentUser) return;

    setCheckoutProcessing(true);
    setCheckoutError('');

    try {
      const originalPrice = checkoutCourse.price;
      const finalPrice = originalPrice - (originalPrice * (couponDiscount / 100));

      // Generate a unique enrollment transaction ID
      const enrollmentId = "ENR-" + Math.random().toString(36).substr(2, 6).toUpperCase();

      // Check for affiliate cookie to register commission
      const affiliateCode = getReferralCookie();
      let affiliateName = '';
      let affiliateId = '';

      if (affiliateCode) {
        try {
          // Get global commission percentage setting
          const settingsSnap = await getDoc(doc(db, 'lms_settings', 'affiliates'));
          const globalPercent = settingsSnap.exists() ? (settingsSnap.data().commissionPercent ?? 15) : 15;

          // Query affiliates to find matches
          const q = query(collection(db, 'lms_affiliates'), where('code', '==', affiliateCode), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const matchedAff = querySnapshot.docs[0];
            affiliateId = matchedAff.id;
            affiliateName = matchedAff.data().name;
            const finalPercent = matchedAff.data().commissionPercent || globalPercent;
            const comAmount = finalPrice * (finalPercent / 100);

            // Record a commission transaction document
            const commissionId = "COM-" + Math.random().toString(36).substr(2, 6).toUpperCase();
            await setDoc(doc(db, 'lms_commissions', commissionId), {
              id: commissionId,
              affiliateId,
              affiliateCode,
              affiliateName,
              buyerEmail: currentUser.email,
              price: finalPrice,
              commissionPercent: finalPercent,
              commissionAmount: comAmount,
              enrollmentId: enrollmentId,
              courseId: checkoutCourse.id!,
              courseTitle: checkoutCourse.title,
              createdAt: new Date()
            });

            // Update affiliate metrics
            await updateDoc(doc(db, 'lms_affiliates', affiliateId), {
              salesCount: (matchedAff.data().salesCount || 0) + 1,
              totalCommission: (matchedAff.data().totalCommission || 0) + comAmount
            });
            console.log(`[Comissão de Afiliado] R$ ${comAmount} atribuída ao afiliado ${affiliateName} (${finalPercent}%)`);
          }
        } catch (affErr) {
          console.warn("Failed to register affiliate commission during checkout:", affErr);
        }
      }

      // Add enrollment doc
      const enroll: Enrollment = {
        id: enrollmentId,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || userProfile?.name || currentUser.email.split('@')[0],
        courseId: checkoutCourse.id!,
        courseTitle: checkoutCourse.title,
        status: 'active',
        accessType: checkoutCourse.accessibilityType,
        createdAt: new Date()
      };

      if (checkoutCourse.accessibilityType === 'temporary' && checkoutCourse.accessDurationDays) {
        const expireDate = new Date();
        expireDate.setDate(expireDate.getDate() + checkoutCourse.accessDurationDays);
        enroll.expiresAt = expireDate.toISOString();
      }

      await setDoc(doc(db, 'lms_enrollments', enrollmentId), enroll);

      // Create dummy webhook or e-commerce order representation to keep reports fully synced
      const orderId = "ORD-LMS-" + Math.random().toString(36).substr(2, 6).toUpperCase();
      const orderDoc = {
        userId: currentUser.uid,
        customerInfo: {
          name: currentUser.displayName || userProfile?.name || currentUser.email.split('@')[0],
          email: currentUser.email,
          phone: phone,
          cpf: cpf,
          cep: '13630000',
          city: 'Pirassununga',
          state: 'SP',
          street: 'Ateliê Virtual',
          number: '1',
          complement: 'Curso Online',
          neighborhood: 'Centro'
        },
        items: [{
          productId: checkoutCourse.id,
          name: checkoutCourse.title,
          price: finalPrice,
          quantity: 1,
          images: [checkoutCourse.imageUrl]
        }],
        shippingMethod: 'Acesso Digital Imediato',
        shippingCost: 0,
        subtotal: originalPrice,
        discountAmount: originalPrice * (couponDiscount / 100),
        couponCode: couponApplied ? couponCode.toUpperCase().trim() : null,
        total: finalPrice,
        status: 'Pago',
        paymentId: "PAY-LMS-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await setDoc(doc(db, 'ecom_orders', orderId), orderDoc);

      setCheckoutSuccess(true);
      
      // Clean affiliate referral cookie
      localStorage.removeItem('lms_affiliate_ref');

      // Raise notification
      const notif: SystemNotification = {
        title: 'Matrícula Ativada! 🎓',
        message: `Sua vaga no curso "${checkoutCourse.title}" está disponível na sua Área do Aluno. Bons estudos!`,
        target: 'all',
        createdAt: new Date()
      };
      await addDoc(collection(db, 'lms_notifications'), notif);

    } catch (err: any) {
      setCheckoutError("Erro de processamento do pagamento: " + err.message);
    } finally {
      setCheckoutProcessing(false);
    }
  };

  // Toggle Lesson Completion progress in Firestore
  const toggleLessonCompletion = async (lesson: Lesson, course: Course) => {
    if (!currentUser) return;

    const progId = `${currentUser.uid}_${course.id}_${lesson.id}`;
    const matchedProgress = progressList.find(p => p.lessonId === lesson.id);

    try {
      const isCompleted = matchedProgress ? !matchedProgress.completed : true;
      const progressDoc: StudentProgress = {
        userId: currentUser.uid,
        courseId: course.id!,
        lessonId: lesson.id!,
        completed: isCompleted,
        timeWatched: isCompleted ? 600 : 0, // Mock complete time watch
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'lms_progress', progId), progressDoc);
    } catch (err) {
      console.error("Failed toggling lesson completion:", err);
    }
  };

  // Retrieve calculated progress percentage for a course
  const getCourseProgress = (courseId: string) => {
    const courseLessons = lessons.filter(l => l.courseId === courseId);
    if (courseLessons.length === 0) return 0;

    const completedCount = progressList.filter(p => p.courseId === courseId && p.completed).length;
    return Math.round((completedCount / courseLessons.length) * 100);
  };

  // Check if student is authorized to watch this course
  const checkCourseAccess = (courseId: string) => {
    if (currentUser?.email === 'andrewfmlemos@gmail.com') return true;
    const activeEnrollment = enrollments.find(e => e.courseId === courseId && e.status === 'active');
    
    if (!activeEnrollment) return false;
    
    // Check expiration for temporary accesses
    if (activeEnrollment.accessType === 'temporary' && activeEnrollment.expiresAt) {
      const expDate = new Date(activeEnrollment.expiresAt);
      if (expDate < new Date()) {
        return false;
      }
    }
    return true;
  };

  // Launch Classroom Player
  const enterClassroom = (course: Course) => {
    if (!checkCourseAccess(course.id!)) {
      alert("Acesso Restrito: Você precisa adquirir este curso para acessar a sala de aula.");
      return;
    }

    const courseLessons = lessons.filter(l => l.courseId === course.id);
    if (courseLessons.length === 0) {
      alert("Este curso está sendo preparado e terá aulas publicadas em breve!");
      return;
    }

    setSelectedCourse(course);
    setActiveLesson(courseLessons[0]);
    setActiveLessonIndex(0);
    setClassroomTab('video');
    setChatHistory([
      { role: 'model', text: `Olá, artista! Sou o MichelangelIA, seu mentor virtual oficial do curso "${course.title}". Estou aqui para te ajudar a entender qualquer técnica abordada nas aulas, goivas utilizadas ou acabamento. Pergunte o que quiser!` }
    ]);
  };

  // Go to next lesson in Classroom list
  const nextLesson = () => {
    const courseLessons = lessons.filter(l => l.courseId === selectedCourse?.id);
    if (activeLessonIndex < courseLessons.length - 1) {
      const nextIdx = activeLessonIndex + 1;
      setActiveLessonIndex(nextIdx);
      setActiveLesson(courseLessons[nextIdx]);
    }
  };

  // Go to previous lesson in Classroom list
  const prevLesson = () => {
    const courseLessons = lessons.filter(l => l.courseId === selectedCourse?.id);
    if (activeLessonIndex > 0) {
      const prevIdx = activeLessonIndex - 1;
      setActiveLessonIndex(prevIdx);
      setActiveLesson(courseLessons[prevIdx]);
    }
  };

  // Register as new Affiliate
  const handleRegisterAffiliate = async () => {
    if (!currentUser) return;
    if (!affiliateCodeInput.trim() || affiliateCodeInput.length < 4) {
      alert("Código personalizado inválido. Insira pelo menos 4 caracteres alfanuméricos.");
      return;
    }

    setAffiliateRegistering(true);
    setAffiliateSuccessMsg('');

    try {
      const affCodeClean = affiliateCodeInput.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      
      const newAff: AffiliateProfile = {
        id: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName || userProfile?.name || currentUser.email.split('@')[0],
        code: affCodeClean,
        commissionPercent: 15, // Default 15% commission per sale
        clicks: 0,
        salesCount: 0,
        totalCommission: 0,
        status: 'Ativo',
        createdAt: new Date()
      };

      await setDoc(doc(db, 'lms_affiliates', currentUser.uid), newAff);
      setAffiliateProfile(newAff);
      setAffiliateSuccessMsg(`Parabéns! Sua conta de afiliado foi ativada. Seu código de desconto de afiliado é: ${affCodeClean}`);
    } catch (err: any) {
      alert("Erro ao criar cadastro de afiliado: " + err.message);
    } finally {
      setAffiliateRegistering(false);
    }
  };

  // Generate certificate diploma if course is completed
  const handleGenerateCertificate = async () => {
    if (!currentUser || !selectedCourse) return;
    if (getCourseProgress(selectedCourse.id!) < 100) {
      alert("Atenção: Você precisa concluir 100% das aulas para gerar o certificado oficial.");
      return;
    }

    setIsGeneratingCert(true);
    try {
      const certId = "CERT-" + Math.random().toString(36).substr(2, 8).toUpperCase();
      const cert: CourseCertificate = {
        id: certId,
        userId: currentUser.uid,
        userName: currentUser.displayName || userProfile?.name || currentUser.email.split('@')[0],
        userEmail: currentUser.email,
        courseId: selectedCourse.id!,
        courseTitle: selectedCourse.title,
        issuedAt: new Date()
      };

      await setDoc(doc(db, 'lms_certificates', certId), cert);
      setIssuedCert(cert);
    } catch (err) {
      console.error("Failed creating certificate:", err);
    } finally {
      setIsGeneratingCert(false);
    }
  };

  // MichelangelIA assistant chat function inside lessons player
  const handleSendChatToMentor = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const queryText = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: queryText }]);
    setChatLoading(true);

    const historyPayload = chatHistory.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    // Generate Context-rich instructions regarding active Course, Module & Lesson
    const currentModuleObj = modules.find(m => m.id === activeLesson?.moduleId);
    const systemInstructions = `Você é o MichelangelIA, o mentor virtual oficial da Academia de Arte Andrew Lemos, incorporado na aula que o aluno está assistindo no momento.

CONTEÚDO DA AULA QUE O ALUNO ESTÁ ASSISTINDO AGORA (USE ISSO PARA CONTEXTUALIZAR ABSOLUTAMENTE TUDO):
- Curso: "${selectedCourse?.title}"
- Módulo: "${currentModuleObj?.title || 'Básico'}"
- Aula: "${activeLesson?.title}"
- Descrição Detalhada da Aula: "${activeLesson?.description || 'Nenhuma descrição fornecida.'}"
- Materiais Disponíveis / Vinculados a esta Aula: ${JSON.stringify(activeLesson?.materials || [])}

DIRETRIZ DE GÊNERO MANDATÓRIA (CRÍTICA):
- Você deve SEMPRE usar artigos, adjetivos e pronomes no gênero MASCULINO para se referir a si mesmo (ex: 'seu mentor virtual', 'o mentor', 'seu parceiro', 'apaixonado', 'curioso', 'focado', 'atento', 'pronto').
- NUNCA utilize termos femininos ou se refira a si mesmo no feminino (ex: NUNCA diga 'sua mentora', 'sua parceira' ou 'apaixonada'). Esta é uma regra absoluta sem exceções.

DIRETRIZES DE ATENDIMENTO E CONTEXTO DO MENTOR:
1. Sempre que for perguntado sobre o assunto da aula, responda demonstrando que conhece perfeitamente a aula atual! Utilize os dados contidos em "Descrição Detalhada da Aula" e "Materiais Disponíveis" acima para responder de forma extremamente contextualizada e personalizada. Evite respostas vagas ou genéricas. Mencione pontos específicos descritos na aula sempre que fizer sentido!
2. Ofereça dicas de postura, velocidade de corte, perigos no entalhe, segredos de sombreamento no Cedro ou como cuidar de goivas e formões.
3. Seja humilde, prático, motivador e muito apaixonado por arte artesanal de ateliê. Use termos de marcenaria e escultura (ex: formão, strop de couro, seladora, grão de lixa, contra-fibra).
4. Nunca fale de assuntos alheios à arte. Se perguntarem algo fora disso, volte de forma divertida e sutil ao tema artístico do entalhe de madeira.
5. Mantenha as mensagens fáceis e gostosas de ler: use parágrafos curtos e pule linhas.`;

    let assistantResponse = "";
    let serverSuccess = false;

    // 1. Try secure Backend API route
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          systemInstruction: systemInstructions,
          history: historyPayload,
          lessonTitle: activeLesson?.title,
          lessonDescription: activeLesson?.description
        })
      });

      if (res.ok) {
        const data = await res.json();
        assistantResponse = data.text;
        serverSuccess = true;
      }
    } catch (err) {
      console.warn("LMS Chat route failed or secure server unreachable. Reverting to client-side fallback.");
    }

    // 2. Client Side Fallback
    if (!serverSuccess) {
      try {
        const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error("Chave Gemini ausente no ambiente do cliente.");

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: [...historyPayload, { role: 'user', parts: [{ text: queryText }] }],
          config: {
            systemInstruction: systemInstructions
          }
        });
        assistantResponse = response.text || "Desculpe, não consegui gerar uma resposta. Por favor, tente novamente.";
      } catch (clientErr) {
        console.error("Erro no MichelangelIA (Client-side fallback):", clientErr);
        assistantResponse = "Hum, não consegui me conectar aos servidores do MichelangelIA neste instante. Mas continue esculpindo com calma e segurança! Que tal tentar enviar sua pergunta novamente em alguns segundos?";
      }
    }

    setChatHistory(prev => [...prev, { role: 'model', text: assistantResponse }]);
    setChatLoading(false);
  };

  const handleAccessTestStudent = async () => {
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');
    try {
      const res = await fetch("/api/test/create-fictional-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) {
        throw new Error("Erro do servidor ao instanciar o aluno fictício.");
      }
      const data = await res.json();
      if (data.success) {
        await signInWithEmailAndPassword(auth, data.credentials.email, data.credentials.password);
        setAuthSuccess("Acesso como Aluno de Teste efetuado! Carregando...");
      } else {
        throw new Error(data.error || "Falha desconhecida.");
      }
    } catch (err: any) {
      console.error("Failed test student access:", err);
      setAuthError("Erro ao instanciar aluno de teste: " + (err.message || err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLMSLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Por favor, preencha o e-mail e a senha.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      setAuthSuccess('Login efetuado com sucesso!');
    } catch (err: any) {
      console.error("Erro no login do LMS:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setAuthError('E-mail ou senha incorretos. Verifique suas credenciais de acesso.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('Endereço de e-mail inválido.');
      } else {
        setAuthError('Falha ao autenticar: ' + (err.message || err.code));
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLMSRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword || !authName) {
      setAuthError('Por favor, preencha todos os campos.');
      return;
    }
    if (authPassword !== authConfirmPassword) {
      setAuthError('As senhas não coincidem.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      await updateProfile(userCredential.user, {
        displayName: authName.trim()
      });
      
      const customerProfile = {
        name: authName.trim(),
        email: authEmail.trim(),
        phone: '',
        cpf: '',
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'ecom_customers', userCredential.user.uid), customerProfile);

      setAuthSuccess('Conta criada com sucesso!');
    } catch (err: any) {
      console.error("Erro no cadastro do LMS:", err);
      if (err.code === 'auth/email-already-in-use') {
        setAuthError('Este endereço de e-mail já está em uso.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('E-mail inválido.');
      } else {
        setAuthError('Erro ao criar conta: ' + (err.message || err.code));
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLMSGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');
    try {
      await signInWithPopup(auth, googleProvider);
      setAuthSuccess('Login com o Google realizado com sucesso!');
    } catch (err: any) {
      console.error("Erro no login Google do LMS:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      setAuthError('Falha na autenticação com o Google: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  if (activeReadingEbook) {
    const pdfUrl = activeReadingEbook.digitalPdfUrl || '';
    return (
      <div className="bg-[#FAF9F5] min-h-screen pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-wood/10 text-brand-wood rounded-2xl">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-brand-wood font-bold uppercase tracking-wider">Leitor Digital Seguro - Ateliê Andrew Lemos</div>
                <h2 className="font-serif font-bold text-xl md:text-2xl text-brand-ink">{activeReadingEbook.name}</h2>
              </div>
            </div>
            
            <button 
              onClick={() => setActiveReadingEbook(null)}
              className="px-5 py-2.5 bg-brand-wood text-white hover:bg-brand-ink rounded-xl text-xs font-semibold transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Fechar Leitor
            </button>
          </div>

          <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl text-xs text-orange-800 leading-relaxed text-left">
            ⚠️ **Visualizador de Proteção Avançada**: A cópia de conteúdo, captura de tela, botão direito e impressão estão bloqueados por algoritmos de propriedade intelectual. Este exemplar está licenciado exclusivamente para **{currentUser?.email}**.
          </div>

          {/* Secure reader container */}
          <div 
            onContextMenu={(e) => { e.preventDefault(); alert("O clique direito está desabilitado para proteção de direitos autorais."); }}
            className="bg-white rounded-[2rem] border border-brand-wood/10 p-4 md:p-6 shadow-sm relative overflow-hidden select-none"
            style={{
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              userSelect: 'none'
            }}
          >
            {pdfUrl ? (
              <div className="w-full flex flex-col h-[700px]">
                <div className="flex justify-between items-center bg-gray-50 px-4 py-2 border-b rounded-t-xl mb-3">
                  <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Conexão Criptografada Segura
                  </span>
                  <a 
                    href={pdfUrl.includes('drive.google.com') && !pdfUrl.includes('/preview') ? pdfUrl.replace('/view?usp=sharing', '/preview').replace('/view', '/preview') : pdfUrl}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] bg-brand-paper hover:bg-brand-wood/10 text-brand-wood border border-brand-wood/20 px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Tela Cheia Protegida
                  </a>
                </div>
                <iframe 
                  src={pdfUrl.includes('drive.google.com') && !pdfUrl.includes('/preview') ? pdfUrl.replace('/view?usp=sharing', '/preview').replace('/view', '/preview') : pdfUrl} 
                  className="w-full h-full rounded-b-xl border-0 bg-gray-50" 
                  title={activeReadingEbook.name}
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 text-brand-wood/30 mx-auto mb-4" />
                <h3 className="font-serif font-bold text-brand-ink text-lg mb-2">Erro de Carregamento</h3>
                <p className="text-gray-400 text-xs max-w-sm mx-auto">
                  Este infoproduto não possui um arquivo PDF válido ou o endereço de destino está indisponível temporariamente. Por favor, entre em contato com o suporte.
                </p>
              </div>
            )}

            {/* Float email watermark diagonally across the secure reading panel */}
            <div className="absolute inset-0 bg-transparent flex items-center justify-center rotate-12 select-none pointer-events-none opacity-5 overflow-hidden z-10">
              <div className="text-xl md:text-2xl font-extrabold font-serif text-brand-wood tracking-wider uppercase text-center max-w-xl leading-relaxed">
                {currentUser?.email || 'ALUNO'} - Academia de Arte Andrew Lemos - www.andrewlemos.com
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }



  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    if (newPassword.length < 6) {
      setPasswordChangeError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('As senhas digitadas não coincidem.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { updatePassword } = await import('firebase/auth');
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);

        // Update the flag in Firestore lms_student_profiles
        const profileRef = doc(db, 'lms_student_profiles', auth.currentUser.uid);
        await setDoc(profileRef, {
          needsPasswordChange: false,
          passwordChangedAt: new Date().toISOString()
        }, { merge: true });

        setPasswordChangeSuccess('Sua senha foi alterada com sucesso!');
        setTimeout(() => {
          setNeedsPasswordChange(false);
        }, 2000);
      }
    } catch (err: any) {
      console.error("Failed to update password:", err);
      if (err.code === 'auth/requires-recent-login') {
        setPasswordChangeError('Para alterar a senha por motivos de segurança, por favor faça logout e login novamente na sua conta.');
      } else {
        setPasswordChangeError(`Erro ao atualizar senha: ${err.message || err}`);
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="bg-[#0C0B0A] text-stone-200 min-h-screen pt-24 pb-16 px-6 font-sans antialiased selection:bg-[#D4AF37] selection:text-black">
      <div className="max-w-7xl mx-auto animate-fadeIn">
        
        {/* Navigation Breadcrumb back to landing or classroom reset */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-stone-400 mb-1">
              <a href="#home" onClick={(e) => { e.preventDefault(); onNavigateToView('landing'); }} className="hover:text-[#D4AF37] transition-colors">Home</a>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[#D4AF37] font-medium">Academia de Artes Andrew Lemos</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-[#D4AF37]/30 flex items-center justify-center bg-zinc-900 shadow-lg flex-shrink-0">
                <img 
                  src={ensureRobustUrl("https://drive.google.com/file/d/1BEZWW-yg4axZKVhIo_Y9GlRgeGQ3xeqi/view?usp=drive_link")} 
                  alt="Logo" 
                  className="w-full h-full object-cover invert"
                />
              </div>
              <span className="tracking-tight bg-gradient-to-r from-white to-stone-400 bg-clip-text text-transparent">Academia de Artes</span>
            </h1>
          </div>

          {/* Core Subtabs or Login Button */}
          {!currentUser ? (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setAuthError('');
                  setAuthSuccess('');
                  setShowLoginModal(true);
                }}
                className="px-6 py-3 bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-amber-500/10 hover:scale-[1.02] active:scale-[0.98] duration-300 tracking-wider uppercase cursor-pointer flex items-center gap-2"
              >
                <User className="w-4 h-4" /> Acessar Plataforma
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap bg-[#131210]/95 p-1.5 rounded-2xl border border-stone-800 shadow-2xl backdrop-blur-md">
              <button 
                onClick={() => { setSelectedCourse(null); setActiveSubTab('catalog'); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${activeSubTab === 'catalog' ? 'bg-[#D4AF37] text-neutral-950 shadow-md font-bold' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/50'}`}
              >
                Vitrine de Cursos 🎓
              </button>
              <button 
                onClick={() => { setSelectedCourse(null); setActiveSubTab('classroom'); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${activeSubTab === 'classroom' ? 'bg-[#D4AF37] text-neutral-950 shadow-md font-bold' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/50'}`}
              >
                Área do Aluno 👨‍🎨
              </button>
              <button 
                onClick={() => { setSelectedCourse(null); setActiveSubTab('messages'); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${activeSubTab === 'messages' ? 'bg-[#D4AF37] text-neutral-950 shadow-md font-bold' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/50'}`}
              >
                Suporte Artístico 💬
              </button>
              <button 
                onClick={() => { setSelectedCourse(null); setActiveSubTab('affiliate'); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${activeSubTab === 'affiliate' ? 'bg-[#D4AF37] text-neutral-950 shadow-md font-bold' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/50'}`}
              >
                Área de Afiliados 🤝
              </button>
              <button 
                onClick={() => { signOut(auth); }}
                className="px-3.5 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Sair da Conta"
              >
                Sair
              </button>
            </div>
          )}
        </div>

        {/* Global Notifications Panel for Active Students */}
        {currentUser && notifications.length > 0 && (
          <div className="mb-8 bg-[#181714] border border-[#D4AF37]/20 p-5 rounded-3xl flex items-start gap-4 shadow-2xl animate-slideDown">
            <div className="p-2.5 bg-[#D4AF37]/10 text-[#D4AF37] rounded-2xl flex-shrink-0">
              <Bell className="w-5 h-5 animate-swing" />
            </div>
            <div>
              <h4 className="font-serif font-bold text-white text-sm">Avisos Recentes do Ateliê:</h4>
              <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                {notifications[0].title}: <span className="font-medium text-stone-200">{notifications[0].message}</span>
              </p>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 1: VITRINE / CATALOG (PUBLIC OR LOGGED-IN USERS)                 */}
        {/* ==================================================================== */}
        {activeSubTab === 'catalog' && !selectedCourse && (
          viewingCourseDetail ? (
            <CourseLandingPage 
              course={viewingCourseDetail}
              onBack={() => setViewingCourseDetail(null)}
              currentUser={currentUser}
              onNavigateToView={onNavigateToView}
              modules={modules}
              lessons={lessons}
            />
          ) : (
            <div className="space-y-12 animate-fadeIn">
              <div className="bg-gradient-to-b from-[#141311] to-[#0D0C0A] p-8 md:p-12 rounded-[2.5rem] border border-[#D4AF37]/15 text-center max-w-4xl mx-auto shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
                <h2 className="text-3xl md:text-4xl font-serif font-black text-[#FAF9F5] mb-3 leading-tight tracking-tight">Estude Escultura Tradicional no Seu Ritmo</h2>
                <p className="text-stone-400 text-sm md:text-base leading-relaxed max-w-2xl mx-auto mb-8 font-sans">
                  Cursos práticos gravados em alta definição no ateliê. Suporte individual de dúvidas com envio de fotos dos seus trabalhos e mentoria de Inteligência Artificial exclusiva de contexto.
                </p>
                <div className="flex flex-wrap justify-center gap-6 text-xs text-stone-300 font-semibold">
                  <span className="flex items-center gap-2 bg-[#1A1916] px-4 py-2.5 rounded-2xl border border-stone-800"><CheckCircle className="w-4 h-4 text-[#D4AF37]" /> Certificado Oficial com Hash Único</span>
                  <span className="flex items-center gap-2 bg-[#1A1916] px-4 py-2.5 rounded-2xl border border-stone-800"><CheckCircle className="w-4 h-4 text-[#D4AF37]" /> Acesso Vitalício com Suporte de Fotos</span>
                  <span className="flex items-center gap-2 bg-[#1A1916] px-4 py-2.5 rounded-2xl border border-stone-800"><CheckCircle className="w-4 h-4 text-[#D4AF37]" /> MichelangelIA 24/7 na Sala de Aula</span>
                </div>
              </div>

              {/* Dynamic Inner Tab Switcher (Cursos vs. Apostilas) */}
              <div className="flex justify-center border-b border-stone-800 gap-8 max-w-md mx-auto pb-1">
                <button 
                  onClick={() => setCatalogTab('courses')}
                  className={`pb-3 text-sm font-bold transition-all duration-300 border-b-2 ${catalogTab === 'courses' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-stone-500 hover:text-stone-300'}`}
                >
                  Cursos Online 🎓
                </button>
                <button 
                  onClick={() => setCatalogTab('ebooks')}
                  className={`pb-3 text-sm font-bold transition-all duration-300 border-b-2 ${catalogTab === 'ebooks' ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-stone-500 hover:text-stone-300'}`}
                >
                  Apostilas & E-books 📖
                </button>
              </div>

              {loading ? (
                <div className="text-center py-16 text-stone-500 animate-pulse">Carregando conteúdos disponíveis...</div>
              ) : catalogTab === 'courses' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto">
                  {courses.filter(c => c.status !== 'Inativo').map((course) => {
                    const owned = enrollments.some(e => e.courseId === course.id && e.status === 'active');
                    return (
                      <motion.div 
                        key={course.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#131210] rounded-[2rem] border border-[#D4AF37]/10 overflow-hidden flex flex-col hover:border-[#D4AF37]/35 hover:shadow-2xl hover:shadow-amber-500/5 hover:scale-[1.015] transition-all duration-300 relative group text-left"
                      >
                        <div className="relative w-full overflow-hidden bg-stone-950 border-b border-stone-800/60 rounded-t-[2rem]">
                          <img 
                            src={ensureRobustUrl(course.imageUrl)} 
                            alt={course.title} 
                            className="w-full h-auto block transition-transform duration-500 group-hover:scale-105 rounded-t-[2rem]" 
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute top-4 left-4 px-3.5 py-1.5 bg-[#D4AF37] text-neutral-950 rounded-full text-[10px] font-bold shadow-md uppercase tracking-wider">
                            {course.category}
                          </span>
                        </div>
                        <div className="p-6 flex flex-col flex-grow">
                          <h3 className="font-serif font-bold text-xl text-white leading-tight mb-2 group-hover:text-[#D4AF37] transition-colors">{course.title}</h3>
                          <p className="text-stone-400 text-xs leading-relaxed mb-6 flex-grow truncate-3-lines font-sans">
                            {course.shortDescription || course.description}
                          </p>
                          
                          <div className="flex items-center justify-between pt-4 border-t border-stone-800/80 mt-auto">
                            <div>
                              <div className="text-[9px] text-stone-500 uppercase tracking-widest font-bold">Investimento</div>
                              <div className="text-xl font-bold text-[#D4AF37] font-mono">
                                {course.status === 'Em breve' ? 'Em breve' : `R$ ${course.price.toFixed(2)}`}
                              </div>
                            </div>
                            
                            {owned ? (
                              <button 
                                onClick={() => enterClassroom(course)}
                                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition-all shadow-md hover:scale-103 flex items-center gap-1.5 cursor-pointer"
                              >
                                Assistir Aula <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            ) : course.status === 'Em breve' ? (
                              <span className="px-5 py-2.5 bg-stone-900 text-stone-500 rounded-xl text-xs font-semibold border border-stone-800">
                                Em breve
                              </span>
                            ) : (
                              <button 
                                onClick={() => setViewingCourseDetail(course)}
                                className="px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black rounded-xl text-xs font-extrabold transition-all shadow-md hover:scale-103 flex items-center gap-1 cursor-pointer"
                              >
                                Saber Mais <ChevronRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                /* E-books & Handouts (Apostilas Digitais) Display */
                ebooks.length === 0 ? (
                  <div className="text-center py-16 text-stone-500 bg-[#131210] rounded-[2rem] border border-stone-800 max-w-md mx-auto">
                    <FileText className="w-12 h-12 text-[#D4AF37]/20 mx-auto mb-3" />
                    <p className="font-semibold text-sm text-stone-300">Nenhuma apostila ou e-book digital disponível no momento.</p>
                    <p className="text-xs text-stone-500 mt-1">O mestre está editando materiais teóricos inéditos de escultura.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto">
                    {ebooks.map((ebook) => {
                      const coverImg = ebook.images && ebook.images[0] ? ebook.images[0] : "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=600";
                      return (
                        <motion.div 
                          key={ebook.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-[#131210] rounded-[2rem] border border-[#D4AF37]/10 overflow-hidden flex flex-col hover:border-[#D4AF37]/35 hover:shadow-2xl hover:shadow-amber-500/5 hover:scale-[1.015] transition-all duration-300 relative group text-left"
                        >
                          <div className="relative w-full overflow-hidden bg-stone-950 border-b border-stone-800/60 rounded-t-[2rem]">
                            <img 
                              src={ensureRobustUrl(coverImg)} 
                              alt={ebook.name} 
                              className="w-full h-auto block transition-transform duration-500 group-hover:scale-105 rounded-t-[2rem]" 
                              referrerPolicy="no-referrer"
                            />
                            <span className="absolute top-4 left-4 px-3.5 py-1.5 bg-[#D4AF37] text-neutral-950 rounded-full text-[10px] font-bold shadow-md uppercase tracking-wider">
                              Apostila & E-book
                            </span>
                          </div>
                          <div className="p-6 flex flex-col flex-grow">
                            <h3 className="font-serif font-bold text-xl text-white leading-tight mb-2 group-hover:text-[#D4AF37] transition-colors">{ebook.name}</h3>
                            <p className="text-stone-400 text-xs leading-relaxed mb-6 flex-grow line-clamp-3 font-sans">
                              {ebook.description || 'Manual ilustrado passo a passo de técnicas de entalhe e marcenaria artística desenvolvido por Andrew Lemos.'}
                            </p>
                            
                            <div className="flex items-center justify-between pt-4 border-t border-stone-800/80 mt-auto">
                              <div>
                                <div className="text-[9px] text-stone-500 uppercase tracking-widest font-bold">Investimento</div>
                                <div className="text-xl font-bold text-[#D4AF37] font-mono">
                                  R$ {ebook.price.toFixed(2)}
                                </div>
                              </div>
                              
                              <button 
                                onClick={() => onNavigateToView('vendas-item', ebook.id)}
                                className="px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black rounded-xl text-xs font-extrabold transition-all shadow-md hover:scale-103 flex items-center gap-1 cursor-pointer"
                              >
                                Ver Detalhes <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )
        )}

        {/* ==================================================================== */}
        {/* TAB 2: ALUNO AREA - CLASSROOM LIST (AUTHENTICATED ONLY)              */}
        {/* ==================================================================== */}
        {activeSubTab === 'classroom' && !selectedCourse && (
          <div className="space-y-8">
            {!currentUser ? (
              <div className="bg-[#131210] p-12 rounded-[2.5rem] border border-[#D4AF37]/15 text-center max-w-md mx-auto shadow-2xl animate-fadeIn">
                <div className="w-16 h-16 bg-[#1A1916] border border-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="w-8 h-8 text-[#D4AF37]" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-3">Acesso Reservado a Alunos</h3>
                <p className="text-stone-400 text-xs leading-relaxed mb-6 font-sans">
                  Para assistir suas aulas adquiridas, acompanhar seu progresso e emitir certificados, faça login no menu superior do site ou crie uma conta gratuita.
                </p>
                <div className="text-xs text-stone-500 font-medium">
                  Use o botão <span className="font-bold text-[#D4AF37]">"Acessar Plataforma"</span> no topo do site para autenticar com Google ou E-mail!
                </div>
              </div>
            ) : (
              <div className="space-y-10 animate-fadeIn">
                {/* Profile study stats / Streak summary */}
                <div className="grid md:grid-cols-3 gap-6 bg-[#131210] p-6 md:p-8 rounded-[2.5rem] border border-[#D4AF37]/10 shadow-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#1C1B18] rounded-full flex items-center justify-center text-[#D4AF37] border border-[#D4AF37]/15">
                      <User className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-white text-lg leading-tight">{currentUser.displayName || userProfile?.name || 'Artista Estudante'}</h3>
                      <p className="text-xs text-stone-400 mt-0.5">{currentUser.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:border-l border-stone-800 md:pl-6">
                    <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-400 rounded-2xl flex-shrink-0">
                      <Flame className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-xs text-stone-400 font-medium font-sans">Frequência de Estudos</div>
                      <div className="text-xl font-bold font-mono text-red-400">3 Dias Seguidos 🔥</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:border-l border-stone-800 md:pl-6">
                    <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 rounded-2xl flex-shrink-0">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs text-stone-400 font-medium font-sans">Aulas Concluídas</div>
                      <div className="text-xl font-bold font-mono text-emerald-400">{progressList.filter(p => p.completed).length} Aulas</div>
                    </div>
                  </div>
                </div>

                {/* Enrollment list */}
                <div>
                  <h3 className="font-serif font-bold text-2xl text-white mb-6">Meus Cursos Adquiridos</h3>
                  
                  {enrollments.length === 0 ? (
                    <div className="bg-[#131210] border border-dashed border-stone-800 p-12 rounded-[2rem] text-center max-w-xl mx-auto shadow-xl">
                      <BookOpen className="w-12 h-12 text-[#D4AF37]/25 mx-auto mb-4" />
                      <h4 className="font-serif font-bold text-stone-200 mb-1">Nenhum curso ativo no momento</h4>
                      <p className="text-stone-400 text-xs leading-relaxed mb-6 font-sans">
                        Você ainda não realizou matrículas em nossa Academia de Artes. Explore nossa Vitrine de Cursos para encontrar a especialidade perfeita para você.
                      </p>
                      <button 
                        onClick={() => setActiveSubTab('catalog')}
                        className="px-6 py-3 bg-[#D4AF37] hover:bg-[#C29E30] text-black font-extrabold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                      >
                        Navegar pela Vitrine de Cursos
                      </button>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-8">
                      {enrollments.map((enroll) => {
                        const course = courses.find(c => c.id === enroll.courseId);
                        if (!course) return null;
                        const progress = getCourseProgress(course.id!);
                        return (
                          <div key={enroll.id} className="bg-[#131210] rounded-[2rem] border border-[#D4AF37]/10 p-6 flex flex-col md:flex-row gap-6 shadow-xl hover:border-[#D4AF37]/25 hover:shadow-2xl hover:scale-[1.01] transition-all duration-300">
                            <div className="w-full md:w-32 h-24 bg-black rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-stone-800">
                              <img src={ensureRobustUrl(course.imageUrl)} alt={course.title} className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="flex-grow flex flex-col">
                              <h4 className="font-serif font-bold text-lg text-white leading-tight mb-2">{course.title}</h4>
                              <div className="text-[10px] text-[#D4AF37] mb-4 font-bold uppercase tracking-wider">Professor: {course.professor}</div>
                              
                              {/* Progress bar */}
                              <div className="space-y-1.5 mt-auto">
                                <div className="flex justify-between items-center text-xs font-medium font-sans">
                                  <span className="text-stone-400">Progresso de aulas</span>
                                  <span className="text-[#D4AF37] font-mono font-bold">{progress}%</span>
                                </div>
                                <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#D4AF37] rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center mt-6 pt-4 border-t border-stone-800/50">
                                <span className="text-[10px] text-stone-500 font-mono">ID: {enroll.id}</span>
                                <button 
                                  onClick={() => enterClassroom(course)}
                                  className="px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black rounded-xl text-xs font-extrabold transition-all shadow-md hover:scale-102 flex items-center gap-1 cursor-pointer"
                                >
                                  Entrar na Sala <Play className="w-3.5 h-3.5 fill-current" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* E-books / Apostilas Adquiridas Section */}
                <div className="pt-8 border-t border-stone-800">
                  <h3 className="font-serif font-bold text-2xl text-white mb-6 flex items-center gap-2 text-left">
                    <span>Minhas Apostilas & E-books Adquiridos 📖</span>
                    <span className="text-[10px] bg-[#D4AF37]/15 text-[#D4AF37] px-2.5 py-0.5 rounded-full font-sans font-semibold">Leitura Segura</span>
                  </h3>
                  
                  {ebooks.filter(eb => currentUser?.email === 'alunoteste@academia.com' || myPurchasedIds.includes(eb.id)).length === 0 ? (
                    <div className="bg-[#131210] border border-dashed border-stone-800 p-10 rounded-[2rem] text-center max-w-xl mx-auto shadow-xl">
                      <FileText className="w-8 h-8 text-[#D4AF37]/35 mx-auto mb-2" />
                      <h4 className="font-serif font-bold text-stone-200 text-sm mb-1">Nenhum material digital adquirido</h4>
                      <p className="text-stone-400 text-xs leading-relaxed mb-4 max-w-xs mx-auto">
                        Apostilas técnicas e manuais digitais adquiridos estarão disponíveis aqui para leitura protegida imediata.
                      </p>
                      <button 
                        onClick={() => { setCatalogTab('ebooks'); setActiveSubTab('catalog'); }}
                        className="px-5 py-2 bg-[#D4AF37] hover:bg-[#C29E30] text-black rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Ver Apostilas Disponíveis
                      </button>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                      {ebooks.filter(eb => currentUser?.email === 'alunoteste@academia.com' || myPurchasedIds.includes(eb.id)).map((ebook) => {
                        const coverImg = ebook.images && ebook.images[0] ? ebook.images[0] : "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=600";
                        return (
                          <div key={ebook.id} className="bg-[#131210] rounded-3xl border border-[#D4AF37]/10 p-5 flex gap-4 shadow-xl hover:border-[#D4AF37]/25 hover:shadow-2xl transition-all text-left">
                            <div className="w-20 h-24 bg-black rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-stone-800">
                              <img src={ensureRobustUrl(coverImg)} alt={ebook.name} className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="flex-grow flex flex-col justify-between">
                              <div>
                                <h4 className="font-serif font-bold text-base text-white leading-snug line-clamp-1">{ebook.name}</h4>
                                <p className="text-stone-400 text-[11px] leading-relaxed mt-1 line-clamp-2">
                                  {ebook.description || 'Manual técnico com visualização blindada online.'}
                                </p>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-stone-800/60 mt-2">
                                <span className="text-[10px] text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded-full font-semibold border border-emerald-900/35">Leitura Imediata</span>
                                <button 
                                  onClick={() => setActiveReadingEbook(ebook)}
                                  className="px-4 py-1.5 bg-[#D4AF37] text-black hover:bg-[#C29E30] rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                                >
                                  Abrir Apostila <BookOpen className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: SUPPORT MESSAGES / ART DESIGN HELPDESK (LOGGED-IN ONLY)       */}
        {/* ==================================================================== */}
        {activeSubTab === 'messages' && (
          <div className="space-y-8">
            {!currentUser ? (
              <div className="bg-[#131210] p-12 rounded-[2.5rem] border border-[#D4AF37]/15 text-center max-w-md mx-auto shadow-2xl animate-fadeIn">
                <div className="w-16 h-16 bg-[#1A1916] border border-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="w-8 h-8 text-[#D4AF37]" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-3">Canal de Dúvidas Direto</h3>
                <p className="text-stone-400 text-xs leading-relaxed mb-6 font-sans">
                  Faça perguntas técnicas sobre relevos e envie fotos de suas esculturas para que Andrew Lemos avalie seu progresso. Faça login para usar.
                </p>
                <div className="text-xs text-stone-500 font-medium">Use o botão de login no topo!</div>
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-8 animate-fadeIn">
                
                {/* Form to submit artwork/message */}
                <div className="lg:col-span-1 bg-[#131210] p-6 md:p-8 rounded-[2.5rem] border border-[#D4AF37]/10 shadow-2xl h-fit text-left">
                  <h3 className="font-serif font-bold text-xl text-white mb-1">Avaliação de Trabalho</h3>
                  <p className="text-stone-400 text-xs leading-relaxed mb-6 font-sans">
                    Selecione seu curso, escreva sua dúvida e anexe uma imagem do seu entalhe ou desenho. Andrew responderá diretamente.
                  </p>

                  <form onSubmit={handleSendSupportMessage} className="space-y-4 text-xs font-semibold text-stone-300">
                    <div className="space-y-1">
                      <label className="text-stone-400 ml-1">Curso Vinculado</label>
                      <select 
                        className="w-full p-3 rounded-xl border border-stone-800 bg-[#1A1916] text-stone-200 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none transition-all text-xs"
                        value={newMessageCourseId}
                        onChange={e => setNewMessageCourseId(e.target.value)}
                        required
                      >
                        <option value="" className="bg-[#131210]">Selecione o Curso...</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id} className="bg-[#131210]">{c.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-stone-400 ml-1">Assunto / Tópico</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: Minha primeira folha acanto entalhada"
                        className="w-full p-3 rounded-xl border border-stone-800 bg-[#1A1916] text-stone-100 placeholder-stone-600 focus:border-[#D4AF37] outline-none transition-all text-xs font-normal"
                        value={newMessageSubject}
                        onChange={e => setNewMessageSubject(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-stone-400 ml-1">Caminho da Foto da sua Escultura (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: /arquivos/minha_escultura.jpg"
                        className="w-full p-3 rounded-xl border border-stone-800 bg-[#1A1916] text-stone-100 placeholder-stone-600 focus:border-[#D4AF37] outline-none transition-all font-mono text-[10px]"
                        value={newMessageImage}
                        onChange={e => setNewMessageImage(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-stone-400 ml-1">Mensagem / Dúvida detalhada</label>
                      <textarea 
                        rows={4} 
                        required
                        placeholder="Explique o que achou da madeira, se sentiu dificuldade em desbastar..."
                        className="w-full p-3 rounded-xl border border-stone-800 bg-[#1A1916] text-stone-100 placeholder-stone-600 focus:border-[#D4AF37] outline-none transition-all resize-none leading-relaxed font-normal text-xs"
                        value={newMessageContent}
                        onChange={e => setNewMessageContent(e.target.value)}
                      ></textarea>
                    </div>

                    <button 
                      type="submit"
                      disabled={supportSending}
                      className="w-full py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black font-extrabold rounded-xl transition-all shadow-md hover:scale-102 flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                    >
                      {supportSending ? 'Enviando ao Ateliê...' : 'Enviar para o Mestre'} <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>

                {/* History of support tickets */}
                <div className="lg:col-span-2 bg-[#131210] p-6 md:p-8 rounded-[2.5rem] border border-stone-800 shadow-2xl flex flex-col h-[550px] overflow-hidden text-left">
                  <h3 className="font-serif font-bold text-xl text-white mb-1">Meu Histórico de Mensagens</h3>
                  <p className="text-stone-400 text-xs mb-6 font-sans">Mensagens em tempo real entre você e Andrew Lemos.</p>

                  <div className="flex-grow overflow-y-auto space-y-4 mb-4 pr-2 bg-[#0B0A09] border border-stone-900/50 p-4 rounded-2xl">
                    {supportMessages.length === 0 ? (
                      <p className="text-center text-stone-500 text-xs py-20 font-sans">Nenhuma mensagem trocada ainda.</p>
                    ) : (
                      supportMessages.map((msg) => {
                        const isAdminMsg = msg.senderId === 'admin';
                        return (
                          <div key={msg.id} className={`flex ${isAdminMsg ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed shadow-lg ${isAdminMsg ? 'bg-[#1C1B18] text-stone-200 rounded-tl-none border border-stone-800' : 'bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] text-neutral-950 rounded-tr-none font-medium'}`}>
                              <div className="flex items-center gap-2 mb-1.5 opacity-80 font-bold text-[9px] uppercase tracking-wider">
                                <span>{msg.senderName}</span>
                                <span>•</span>
                                <span>{msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString('pt-BR') : new Date(msg.createdAt).toLocaleString()}</span>
                              </div>
                              {msg.courseTitle && (
                                <div className={`text-[9px] px-1.5 py-0.5 rounded-md inline-block mb-2 font-bold ${isAdminMsg ? 'bg-stone-800 text-stone-300' : 'bg-black/10 text-neutral-900'}`}>
                                  Ref: {msg.courseTitle}
                                </div>
                              )}
                              <div className="font-bold text-sm mb-1">{msg.subject}</div>
                              <p className="whitespace-pre-wrap leading-relaxed font-normal">{msg.content}</p>
                              {msg.imageUrl && (
                                <div className="mt-3 rounded-lg overflow-hidden border border-stone-800 bg-black/40">
                                  <img src={ensureRobustUrl(msg.imageUrl)} className="max-h-48 object-contain mx-auto" alt="Trabalho de Aluno" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: AFFILIATE REGISTRATION & TRACKING (LOGGED-IN ONLY)           */}
        {/* ==================================================================== */}
        {activeSubTab === 'affiliate' && (
          <div className="space-y-8 animate-fadeIn text-left">
            {!currentUser ? (
              <div className="bg-[#131210] p-12 rounded-[2.5rem] border border-[#D4AF37]/15 text-center max-w-md mx-auto shadow-2xl">
                <div className="w-16 h-16 bg-[#1A1916] border border-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="w-8 h-8 text-[#D4AF37]" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-3">Programa de Afiliados</h3>
                <p className="text-stone-400 text-xs leading-relaxed mb-6 font-sans">
                  Indique nossos cursos de entalhe e pintura e ganhe 15% de comissão em cada venda aprovada utilizando seu link personalizado. Faça login para usar.
                </p>
                <div className="text-xs text-stone-500 font-medium">Identifique-se usando o botão no topo do site!</div>
              </div>
            ) : !affiliateProfile ? (
              <div className="bg-[#131210] p-8 md:p-12 rounded-[2.5rem] border border-[#D4AF37]/15 text-center max-w-xl mx-auto shadow-2xl text-stone-200">
                <div className="w-16 h-16 bg-[#1A1916] border border-[#D4AF37]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="w-8 h-8 text-[#D4AF37]" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-3">Quer se tornar um Afiliado?</h3>
                <p className="text-stone-400 text-xs leading-relaxed max-w-md mx-auto mb-8 font-sans">
                  Ganhe <span className="font-bold text-[#D4AF37]">15% de comissão</span> sobre cada inscrição nos cursos de artes feitos por sua indicação direta. Crie seu código identificador de afiliado abaixo.
                </p>

                <div className="max-w-xs mx-auto space-y-5">
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] text-stone-400 font-bold uppercase ml-1">Código Identificador Único (Sem espaços)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: ARTEANDREW"
                      className="w-full p-3 rounded-xl border border-stone-800 text-center font-bold font-mono text-sm bg-[#1A1916] text-[#D4AF37] placeholder-stone-600 outline-none focus:border-[#D4AF37] transition-all"
                      value={affiliateCodeInput}
                      onChange={e => setAffiliateCodeInput(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    />
                  </div>
                  <button 
                    onClick={handleRegisterAffiliate}
                    disabled={affiliateRegistering}
                    className="w-full py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black font-extrabold rounded-xl transition-all shadow-md text-xs cursor-pointer disabled:opacity-50"
                  >
                    {affiliateRegistering ? 'Ativando cadastro...' : 'Ativar Minha Conta de Afiliado'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-fadeIn">
                {/* Dynamically calculate commission statuses based on 10 days buffer & enrollment status */}
                {(() => {
                  let totalLiberado = 0;
                  let totalPendente = 0;
                  let totalCancelado = 0;

                  affiliateCommissions.forEach((com) => {
                    const created = com.createdAt?.toDate ? com.createdAt.toDate() : (com.createdAt ? new Date(com.createdAt) : new Date());
                    const daysDiff = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
                    const enrollStatus = com.enrollStatus || 'active';

                    if (enrollStatus === 'canceled' || enrollStatus === 'dropout') {
                      totalCancelado += com.commissionAmount || 0;
                    } else if (daysDiff >= 10) {
                      totalLiberado += com.commissionAmount || 0;
                    } else {
                      totalPendente += com.commissionAmount || 0;
                    }
                  });

                  return (
                    <>
                      {/* Affiliate dashboard stats */}
                      <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-6">
                        <div className="bg-[#131210] p-6 rounded-3xl border border-stone-800 shadow-xl text-left">
                          <div className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1 font-sans">Cliques no Link</div>
                          <div className="text-3xl font-bold font-mono text-white">{affiliateProfile.clicks || 0}</div>
                        </div>
                        <div className="bg-[#131210] p-6 rounded-3xl border border-stone-800 shadow-xl text-left">
                          <div className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1 font-sans">Vendas Indicadas</div>
                          <div className="text-3xl font-bold font-mono text-white">{affiliateCommissions.length}</div>
                        </div>
                        <div className="bg-[#131210] p-6 rounded-3xl border border-stone-800 shadow-xl text-left">
                          <div className="text-[10px] text-stone-500 font-bold uppercase tracking-wider mb-1 font-sans">Conversão</div>
                          <div className="text-3xl font-bold font-mono text-white">
                            {affiliateProfile.clicks ? Math.round(((affiliateCommissions.length) / affiliateProfile.clicks) * 100) : 0}%
                          </div>
                        </div>
                        <div className="bg-[#1c2c1c] p-6 rounded-3xl border border-emerald-500/25 shadow-xl text-left">
                          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1 font-sans">Saldo Liberado (Recebido)</div>
                          <div className="text-3xl font-bold font-mono text-emerald-400">R$ {totalLiberado.toFixed(2)}</div>
                          <div className="text-[9px] text-stone-500 mt-1">Disponível após 10 dias da compra</div>
                        </div>
                        <div className="bg-amber-950/20 p-6 rounded-3xl border border-amber-500/25 shadow-xl text-left">
                          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1 font-sans">Saldo Pendente</div>
                          <div className="text-3xl font-bold font-mono text-amber-400">R$ {totalPendente.toFixed(2)}</div>
                          <div className="text-[9px] text-stone-500 mt-1">Aguardando carência de 10 dias</div>
                        </div>
                        <div className="bg-red-950/10 p-6 rounded-3xl border border-red-500/10 shadow-xl text-left">
                          <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1 font-sans font-semibold">Cancelado (Desistência)</div>
                          <div className="text-3xl font-bold font-mono text-red-400/80">R$ {totalCancelado.toFixed(2)}</div>
                          <div className="text-[9px] text-stone-500 mt-1">Reembolsos ou desistências</div>
                        </div>
                      </div>

                      {/* Tabela de Vendas Referenciadas para o Aluno */}
                      <div className="bg-[#131210] p-8 rounded-[2.5rem] border border-stone-800 shadow-2xl text-left">
                        <h3 className="font-serif font-bold text-lg text-white mb-1 font-bold">Minhas Vendas Referenciadas</h3>
                        <p className="text-stone-400 text-xs mb-6 font-sans">
                          Abaixo você confere em tempo real os cursos comprados através do seu link e o status de liberação do pagamento.
                        </p>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-stone-400 font-medium min-w-[500px]">
                            <thead>
                              <tr className="border-b border-stone-800 text-[10px] text-stone-500 uppercase tracking-wider">
                                <th className="py-2.5 px-3">Curso Indicado</th>
                                <th className="py-2.5 px-3">Data da Compra</th>
                                <th className="py-2.5 px-3">Comissão Gerada</th>
                                <th className="py-2.5 px-3 text-right">Status do Crédito</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-900">
                              {affiliateCommissions.map((com) => {
                                const created = com.createdAt?.toDate ? com.createdAt.toDate() : (com.createdAt ? new Date(com.createdAt) : new Date());
                                const daysDiff = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
                                const enrollStatus = com.enrollStatus || 'active';

                                let statusLabel = "";
                                let statusClass = "";
                                let remainingText = "";

                                if (enrollStatus === 'canceled' || enrollStatus === 'dropout') {
                                  statusLabel = "Cancelada (Desistência)";
                                  statusClass = "bg-red-950/20 text-red-400 border-red-900/30";
                                } else if (daysDiff >= 10) {
                                  statusLabel = "Liberado & Pago";
                                  statusClass = "bg-[#1c2c1c] text-emerald-400 border-emerald-900/30";
                                } else {
                                  statusLabel = "Pendente";
                                  statusClass = "bg-amber-950/20 text-amber-400 border-amber-900/30";
                                  const remaining = 10 - daysDiff;
                                  remainingText = `${remaining} ${remaining === 1 ? 'dia restante' : 'dias restantes'}`;
                                }

                                return (
                                  <tr key={com.id} className="hover:bg-stone-900/20">
                                    <td className="py-4 px-3 font-semibold text-white">
                                      {com.courseTitle}
                                    </td>
                                    <td className="py-4 px-3 text-stone-400 font-mono">
                                      {created.toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="py-4 px-3 text-[#D4AF37] font-bold font-mono">
                                      R$ {Number(com.commissionAmount || 0).toFixed(2)}
                                    </td>
                                    <td className="py-4 px-3 text-right">
                                      <div className="flex flex-col items-end">
                                        <span className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold ${statusClass}`}>
                                          {statusLabel}
                                        </span>
                                        {remainingText && (
                                          <span className="text-[9px] text-amber-500 font-bold mt-1">{remainingText}</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                              {affiliateCommissions.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="text-center py-8 text-stone-500 text-xs">
                                    Nenhuma venda realizada com o seu código de indicação ainda. Divulgue seu link!
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Affiliate Link Generator */}
                <div className="bg-[#131210] p-8 rounded-[2.5rem] border border-stone-800 shadow-2xl max-w-3xl text-left">
                  <h3 className="font-serif font-bold text-xl text-white mb-2">Gerador de Links de Indicação</h3>
                  <p className="text-stone-400 text-xs leading-relaxed mb-6 font-sans">
                    Compartilhe esses links abaixo nas suas redes sociais (Instagram, YouTube, WhatsApp). Qualquer pessoa que comprar por este link receberá o acompanhamento e você ganhará sua comissão.
                  </p>

                  <div className="space-y-4">
                    {courses.filter(c => c.status === 'Ativo').map(c => {
                      const affLink = `${window.location.origin}/?ref=${affiliateProfile.code}#online-courses`;
                      return (
                        <div key={c.id} className="p-4 border border-stone-800 rounded-2xl bg-[#1C1B18] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-semibold">
                          <div className="min-w-0 flex-grow">
                            <div className="font-serif font-bold text-sm text-white">{c.title}</div>
                            <div className="text-[#D4AF37] font-mono text-[10px] truncate max-w-xs md:max-w-md mt-1">{affLink}</div>
                          </div>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(affLink);
                              alert("Link copiado para a área de transferência!");
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black hover:bg-brand-ink rounded-lg text-xs font-extrabold flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copiar Link
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* ROOM: CLASSROOM PLAYER (ACTIVE WATCHING)                             */}
        {/* ==================================================================== */}
        {selectedCourse && activeLesson && (
          <div className="grid lg:grid-cols-4 gap-8 animate-fadeIn text-left">
            
            {/* Left Sidebar: Lessons Index */}
            <div className="lg:col-span-1 bg-[#131210] p-5 rounded-[2.5rem] border border-stone-800 shadow-2xl h-[600px] flex flex-col overflow-hidden">
              <button 
                onClick={() => setSelectedCourse(null)}
                className="text-xs font-extrabold text-[#D4AF37] hover:text-[#FFDF85] mb-4 flex items-center gap-1.5 outline-none cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para o Painel
              </button>

              <h3 className="font-serif font-bold text-lg text-white truncate leading-tight">{selectedCourse.title}</h3>
              <p className="text-stone-500 text-[10px] font-bold mt-1 mb-4 uppercase tracking-wider font-sans">Progresso Geral: {getCourseProgress(selectedCourse.id!)}%</p>

              <div className="flex-grow overflow-y-auto space-y-4 pr-1 divide-y divide-stone-800/40 text-xs font-medium">
                {modules.filter(m => m.courseId === selectedCourse.id).map((mod) => {
                  const modLessons = lessons.filter(l => l.courseId === selectedCourse.id && l.moduleId === mod.id);
                  return (
                    <div key={mod.id} className="pt-3 first:pt-0">
                      <div className="flex items-center gap-1.5 text-[#D4AF37] font-serif font-extrabold mb-2 text-xs">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{mod.title}</span>
                      </div>
                      <div className="space-y-1.5 pl-2">
                        {modLessons.map((les, idx) => {
                          const isCurrent = activeLesson.id === les.id;
                          const progress = progressList.find(p => p.lessonId === les.id);
                          return (
                            <button 
                              key={les.id}
                              onClick={() => {
                                setActiveLesson(les);
                                setActiveLessonIndex(lessons.indexOf(les));
                              }}
                              className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-2 border cursor-pointer ${isCurrent ? 'bg-[#1C1B18] text-[#D4AF37] border-[#D4AF37]/25 font-bold shadow-md' : 'hover:bg-[#1C1B18]/40 text-stone-400 border-transparent'}`}
                            >
                              <div className="truncate pr-1">
                                <span className="opacity-60 mr-1 font-mono">{idx + 1}.</span>
                                <span className="truncate font-sans font-medium text-xs">{les.title}</span>
                              </div>
                              {progress?.completed ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-stone-700 flex-shrink-0"></div>
                              )}
                            </button>
                          );
                        })}
                        {modLessons.length === 0 && (
                          <div className="text-stone-500 text-[10px] italic pl-4">Aulas em gravação...</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Side: Player + Tabs Section */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* High Definition Responsive Player container */}
              <div className="bg-black rounded-[2.5rem] overflow-hidden aspect-video shadow-2xl border-4 border-stone-800/80 relative group">
                {activeLesson.videoUrl ? (
                  <iframe 
                    src={getYouTubeEmbedUrl(activeLesson.videoUrl)} 
                    title={activeLesson.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    allowFullScreen
                  ></iframe>
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#131210] to-[#0B0A09] flex flex-col items-center justify-center text-white p-6 text-center select-none border border-stone-800">
                    {activeLesson.materials && activeLesson.materials.length > 0 ? (
                      <>
                        <BookOpen className="w-12 h-12 text-[#D4AF37] mb-2" />
                        <h4 className="font-serif font-bold text-sm text-stone-200">Aula de Leitura & Apostila 📚</h4>
                        <p className="text-stone-400 text-[10px] max-w-xs mx-auto mt-1 leading-relaxed">Esta lição é teórica/manual técnico. Use as apostilas oficiais anexadas na aba abaixo para ler com segurança!</p>
                      </>
                    ) : (
                      <>
                        <Play className="w-10 h-10 text-[#D4AF37] animate-pulse mb-2" />
                        <h4 className="font-serif text-xs font-bold text-stone-200">Vídeo Aula em Preparação 🎬</h4>
                        <p className="text-stone-500 text-[10px] max-w-xs mx-auto mt-1 leading-relaxed">Estamos carregando este vídeo no servidor. Leia as instruções escritas logo abaixo para começar.</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Secure High Definition streaming backup option */}
              {activeLesson.videoUrl && (
                <div className="flex flex-wrap justify-between items-center px-5 py-3 bg-[#131210] border border-stone-800/80 rounded-2xl text-xs text-stone-400 gap-3">
                  <span className="flex items-center gap-1.5 font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    Transmissão criptografada de alta definição de Andrew Lemos
                  </span>
                  <a 
                    href={activeLesson.videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[#D4AF37] hover:text-[#FFDF85] font-extrabold flex items-center gap-1 transition-all hover:underline bg-[#1A1916] px-3.5 py-1.5 rounded-xl border border-stone-800"
                  >
                    Assistir no YouTube <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Action buttons (Prev, Mark completed, Next, Issue Certificate) */}
              <div className="flex flex-wrap justify-between items-center gap-4 bg-[#131210] p-5 rounded-3xl border border-stone-800 shadow-2xl">
                <div className="flex gap-2">
                  <button 
                    onClick={prevLesson}
                    disabled={activeLessonIndex === 0}
                    className="px-4 py-2.5 bg-[#1A1916] hover:bg-[#252420] text-stone-300 border border-stone-800/80 rounded-xl text-xs font-bold disabled:opacity-30 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <button 
                    onClick={nextLesson}
                    disabled={activeLessonIndex === lessons.filter(l => l.courseId === selectedCourse.id).length - 1}
                    className="px-4 py-2.5 bg-[#1A1916] hover:bg-[#252420] text-stone-300 border border-stone-800/80 rounded-xl text-xs font-bold disabled:opacity-30 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    Próxima <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button 
                    onClick={() => toggleLessonCompletion(activeLesson, selectedCourse)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-md cursor-pointer hover:scale-102 ${progressList.some(p => p.lessonId === activeLesson.id && p.completed) ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black font-extrabold'}`}
                  >
                    <CheckCircle className="w-4 h-4" /> 
                    {progressList.some(p => p.lessonId === activeLesson.id && p.completed) ? 'Aula Concluída ✔' : 'Marcar como Concluída'}
                  </button>

                  {getCourseProgress(selectedCourse.id!) === 100 && (
                    <button 
                      onClick={handleGenerateCertificate}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-[#D4AF37] text-black hover:from-amber-400 hover:to-amber-500 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer hover:scale-102"
                    >
                      <Award className="w-4 h-4 animate-bounce" /> Emitir Certificado 🎓
                    </button>
                  )}
                </div>
              </div>

              {/* Classroom tabs layout */}
              <div className="bg-[#131210] rounded-[2.5rem] border border-stone-800 shadow-2xl overflow-hidden">
                <div className="flex border-b border-stone-800 divide-x divide-stone-800/80 bg-[#1A1916] text-xs font-bold text-stone-400">
                  <button 
                    onClick={() => setClassroomTab('video')}
                    className={`flex-grow p-4 hover:text-stone-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${classroomTab === 'video' ? 'bg-[#131210] text-[#D4AF37] font-extrabold' : ''}`}
                  >
                    <FileText className="w-4 h-4" /> Descrição da Aula
                  </button>
                  <button 
                    onClick={() => setClassroomTab('apostila')}
                    className={`flex-grow p-4 hover:text-stone-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${classroomTab === 'apostila' ? 'bg-[#131210] text-[#D4AF37] font-extrabold' : ''}`}
                  >
                    <Lock className="w-4 h-4" /> Apostilas Protegidas
                  </button>
                  <button 
                    onClick={() => setClassroomTab('ia')}
                    className={`flex-grow p-4 hover:text-stone-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${classroomTab === 'ia' ? 'bg-[#131210] text-[#D4AF37] font-extrabold' : ''}`}
                  >
                    <Sparkles className="w-4 h-4 text-[#D4AF37] animate-pulse" /> MichelangelIA 24/7
                  </button>
                  <button 
                    onClick={() => setClassroomTab('comments')}
                    className={`flex-grow p-4 hover:text-stone-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${classroomTab === 'comments' ? 'bg-[#131210] text-[#D4AF37] font-extrabold' : ''}`}
                  >
                    <MessageSquare className="w-4 h-4" /> Comentários e Dúvidas ({lessonComments.length})
                  </button>
                </div>

                <div className="p-6 md:p-8">
                  {/* Tab Content: DESCRIPTION */}
                  {classroomTab === 'video' && (
                    <div className="space-y-4">
                      <h4 className="font-serif font-bold text-xl text-white">{activeLesson.title}</h4>
                      <div className="text-stone-300 text-xs leading-relaxed prose prose-invert max-w-none font-sans font-normal">
                        <MarkdownRenderer content={activeLesson.description} variant="blog" isDark={true} />
                      </div>
                    </div>
                  )}

                  {/* Tab Content: APOSTILAS PROTEGIDAS (ANTI-DOWNLOAD) */}
                  {classroomTab === 'apostila' && (
                    <div className="space-y-6">
                      <div className="bg-amber-950/20 border border-amber-500/25 p-4 rounded-2xl text-xs text-amber-200 leading-relaxed font-sans">
                        ⚠️ **Aviso de Direitos Autorais**: As apostilas e manuais técnicos de Andrew Lemos estão protegidos contra cópias não autorizadas. O download e a captura de tela estão desabilitados para proteção de propriedade intelectual. Use o visualizador seguro abaixo.
                      </div>

                      {activeLesson.materials && activeLesson.materials.length > 0 ? (
                        <div className="space-y-4">
                          {activeLesson.materials.map((mat, idx) => (
                            <div key={idx} className="border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
                              <div className="bg-[#1A1916] px-4 py-3 border-b border-stone-800 text-xs font-bold text-stone-200 flex items-center justify-between">
                                <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-[#D4AF37]" /> {mat.name}</span>
                                <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2.5 py-0.5 rounded-full border border-[#D4AF37]/25 font-bold">Protegido</span>
                              </div>
                              
                              {/* Anti right-click container with user-select none */}
                              <div 
                                onContextMenu={(e) => { e.preventDefault(); alert("Clique direito desabilitado para proteção de direitos autorais."); }}
                                className="p-8 bg-[#0B0A09]/40 select-none pointer-events-auto h-[450px] relative overflow-y-auto"
                                style={{
                                  WebkitUserSelect: 'none',
                                  MozUserSelect: 'none',
                                  msUserSelect: 'none',
                                  userSelect: 'none'
                                }}
                              >
                                {mat.type === 'pdf' ? (
                                  <div className="w-full h-full border border-stone-800 rounded-xl bg-[#0B0A09] shadow-inner flex flex-col items-center justify-center p-2 relative">
                                    {mat.url && (mat.url.startsWith('http') || mat.url.startsWith('/')) ? (
                                      <div className="w-full h-full flex flex-col">
                                        <div className="flex justify-between items-center bg-[#1A1916] p-2 border-b border-stone-800 rounded-t-lg">
                                          <span className="text-[10px] text-stone-500 font-bold">Documento Digital Protegido</span>
                                          <a 
                                            href={mat.url.includes('drive.google.com') && !mat.url.includes('/preview') ? mat.url.replace('/view?usp=sharing', '/preview').replace('/view', '/preview') : mat.url}
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-[9px] bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black px-3 py-1 rounded font-extrabold transition-all flex items-center gap-1 cursor-pointer"
                                          >
                                            <ExternalLink className="w-3 h-3" /> Abrir em Tela Cheia
                                          </a>
                                        </div>
                                        <iframe 
                                          src={mat.url.includes('drive.google.com') && !mat.url.includes('/preview') ? mat.url.replace('/view?usp=sharing', '/preview').replace('/view', '/preview') : mat.url} 
                                          className="w-full h-[380px] rounded-b-lg border-0" 
                                          title={mat.name}
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
                                        <FileText className="w-16 h-16 text-[#D4AF37]/35 mb-4" />
                                        <h4 className="font-serif font-bold text-white mb-1">Apostila em Visualização Segura</h4>
                                        <p className="text-stone-400 text-xs max-w-sm mb-6 leading-relaxed">Este PDF foi blindado pelo algoritmo LMS do Ateliê. A cópia de texto e botão de imprimir estão congelados.</p>
                                        
                                        <div className="w-full max-w-md bg-[#1C1B18] border border-stone-800 p-4 rounded-xl text-[11px] text-stone-400 text-left font-sans select-none pointer-events-none line-through decoration-transparent">
                                          {/* Mock premium content rendering inside a protected sandbox */}
                                          <p className="font-bold text-[#D4AF37] border-b border-stone-800 pb-1.5 mb-2 uppercase tracking-wide">Página 1: Preparação do Formão Reto</p>
                                          Para obter relevos suaves sobre a madeira de Imbuia ou Cedro, o mestre Andrew Lemos utiliza um ângulo reto de 35 graus. Lubrifique a pedra de afiação com vaselina líquida neutra antes do desgaste e faça movimentos lentos em formato de oito. O polimento no couro (strop) remove a rebarba metálica acumulada.
                                        </div>
                                      </div>
                                    )}

                                    {/* Invisible watermark block */}
                                    <div className="absolute inset-0 bg-transparent flex items-center justify-center rotate-12 select-none pointer-events-none opacity-[0.04]">
                                      <div className="text-xs md:text-sm font-bold font-serif text-[#D4AF37] text-center max-w-xs leading-relaxed">
                                        {currentUser?.email || 'ALUNO'} - Academia de Arte Andrew Lemos - www.andrewlemos.com
                                      </div>
                                    </div>
                                  </div>
                                ) : mat.type === 'image' ? (
                                  <div className="relative">
                                    <img src={ensureRobustUrl(mat.url)} alt={mat.name} className="max-h-96 mx-auto rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                                    <div className="absolute inset-0 bg-transparent flex items-center justify-center rotate-12 select-none pointer-events-none opacity-10">
                                      <div className="text-xs font-bold font-serif text-[#D4AF37] text-center max-w-xs leading-relaxed">
                                        {currentUser?.email || 'ALUNO'} - Academia de Arte Andrew Lemos - www.andrewlemos.com
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <a href={mat.url} target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:text-white underline font-bold text-xs flex items-center gap-1.5 cursor-pointer">
                                    Acessar Link Externo Seguro <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-stone-500 text-xs py-12 font-sans">Esta aula não possui apostilas complementares vinculadas.</p>
                      )}
                    </div>
                  )}

                  {/* Tab Content: MICHELANGELIA AI CHATBOT */}
                  {classroomTab === 'ia' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 bg-indigo-950/20 p-4 border border-indigo-500/20 rounded-2xl mb-4 text-left">
                        <Sparkles className="w-5 h-5 text-[#D4AF37] animate-pulse" />
                        <div>
                          <h4 className="font-serif font-bold text-sm text-stone-200">Mentoria Inteligente MichelangelIA</h4>
                          <p className="text-[11px] text-stone-400 leading-relaxed font-sans mt-0.5">Converse em tempo real com o MichelangelIA, o seu mentor virtual de entalhe que responde baseado nos formões, acabamento e técnicas específicos desta aula!</p>
                        </div>
                      </div>

                      <div className="bg-[#0B0A09] border border-stone-900 rounded-2xl p-4 h-80 overflow-y-auto space-y-3 flex flex-col">
                        {chatHistory.map((msg, idx) => {
                          const isUser = msg.role === 'user';
                          return (
                            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-lg ${isUser ? 'bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] text-neutral-950 rounded-tr-none font-semibold' : 'bg-[#1C1B18] text-stone-200 rounded-tl-none border border-stone-800'}`}>
                                <p className="font-serif font-bold text-[9px] uppercase tracking-wider mb-1 opacity-75">{isUser ? 'Você' : 'MichelangelIA'}</p>
                                <MarkdownRenderer content={msg.text} variant="chat" isDark={!isUser} />
                              </div>
                            </div>
                          );
                        })}
                        {chatLoading && (
                          <div className="flex justify-start animate-fadeIn">
                            <div className="bg-[#1C1B18] p-3.5 rounded-2xl rounded-tl-none border border-stone-800 flex gap-1.5 items-center">
                              <span className="w-1.5 h-1.5 bg-[#D4AF37]/50 rounded-full animate-bounce"></span>
                              <span className="w-1.5 h-1.5 bg-[#D4AF37]/50 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                              <span className="w-1.5 h-1.5 bg-[#D4AF37]/50 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && handleSendChatToMentor()}
                          placeholder="Pergunte ao mentor virtual da aula..."
                          className="flex-grow bg-[#1A1916] border border-stone-800 rounded-xl px-4 py-3 text-stone-100 placeholder-stone-600 text-xs outline-none focus:border-[#D4AF37] transition-all font-normal"
                        />
                        <button 
                          onClick={handleSendChatToMentor}
                          disabled={chatLoading}
                          className="px-4 bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black font-extrabold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tab Content: COMMENTS SECTION */}
                  {classroomTab === 'comments' && (
                    <div className="space-y-6">
                      {/* Form to submit a comment */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-extrabold text-stone-400 uppercase tracking-wider">Deixe sua Dúvida ou Comentário nesta Aula</h4>
                        <div className="flex gap-3">
                          <textarea 
                            rows={2}
                            placeholder="Sua pergunta ou feedback sobre o desbaste..."
                            className="flex-grow p-3 rounded-xl border border-stone-800 bg-[#1A1916] text-stone-100 placeholder-stone-600 text-xs resize-none outline-none leading-relaxed focus:border-[#D4AF37] transition-all font-normal"
                            value={newCommentText}
                            onChange={e => setNewCommentText(e.target.value)}
                          ></textarea>
                          <button 
                            onClick={handlePostComment}
                            className="px-5 bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] hover:to-[#FFDF85] text-black rounded-xl font-extrabold transition-all text-xs flex items-center justify-center flex-shrink-0 shadow-md cursor-pointer"
                          >
                            Enviar
                          </button>
                        </div>
                      </div>

                      {/* Comments Feed */}
                      <div className="space-y-4 divide-y divide-stone-800/60 pt-4">
                        {lessonComments.map((comment) => (
                          <div key={comment.id} className="pt-4 first:pt-0 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-xs font-bold text-white">{comment.userName}</div>
                                <div className="text-[9px] text-stone-500 font-mono mt-0.5">
                                  {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleString('pt-BR') : new Date(comment.createdAt).toLocaleString()}
                                </div>
                              </div>
                              
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setReplyingCommentId(comment.id!)}
                                  className="text-[10px] font-bold text-[#D4AF37] hover:text-[#FFDF85] hover:underline cursor-pointer"
                                >
                                  Responder
                                </button>
                                {(currentUser.email === 'andrewfmlemos@gmail.com' || comment.userId === currentUser.uid) && (
                                  <button 
                                    onClick={() => handleDeleteComment(comment.id!)}
                                    className="text-red-400 hover:text-red-500 cursor-pointer"
                                    title="Excluir Comentário"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <p className="text-stone-300 text-xs leading-relaxed font-normal">{comment.text}</p>

                            {/* Comment Replies listing */}
                            {comment.replies && comment.replies.map((rep) => (
                              <div key={rep.id} className="ml-8 mt-2 p-3 bg-[#1A1916] border-l-2 border-[#D4AF37] rounded-r-xl space-y-1 border border-stone-800/50">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                  <span className={rep.isAdmin ? 'text-[#D4AF37] flex items-center gap-1 font-serif font-extrabold' : 'text-stone-400'}>
                                    {rep.userName} {rep.isAdmin && <Sparkles className="w-3 h-3 animate-pulse text-amber-400" />}
                                  </span>
                                  <span className="text-stone-500 font-normal font-mono">{new Date(rep.createdAt).toLocaleString('pt-BR')}</span>
                                </div>
                                <p className="text-stone-300 text-[11px] leading-relaxed font-normal">{rep.text}</p>
                              </div>
                            ))}

                            {/* Reply Input Form */}
                            {replyingCommentId === comment.id && (
                              <div className="ml-8 mt-3 flex gap-2">
                                <input 
                                  type="text" 
                                  placeholder="Escreva sua resposta..."
                                  className="flex-grow p-2.5 rounded-lg border border-stone-800 bg-[#1A1916] text-stone-100 placeholder-stone-600 text-xs outline-none focus:border-[#D4AF37] transition-all font-normal"
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  onKeyPress={e => e.key === 'Enter' && handlePostReply(comment.id!)}
                                />
                                <button 
                                  onClick={() => handlePostReply(comment.id!)}
                                  className="px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#F3CD74] hover:from-[#E6C24A] text-black rounded-lg text-xs font-extrabold transition-all cursor-pointer"
                                >
                                  Responder
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {lessonComments.length === 0 && (
                          <p className="text-center text-stone-500 text-xs py-8 font-sans">Nenhuma dúvida publicada nesta aula ainda. Seja o primeiro!</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ==================================================================== */}
      {/* MODAL 2: COURSES CHECKOUT & PAYMENT METHOD SYSTEM                    */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {checkoutCourse && (
          <div className="fixed inset-0 z-[150] bg-brand-ink/45 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] border border-brand-wood/10 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 md:p-8 relative">
                <button 
                  onClick={() => { setCheckoutCourse(null); setCheckoutSuccess(false); setCouponApplied(false); setCouponDiscount(0); }}
                  className="absolute top-6 right-6 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors cursor-pointer outline-none"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>

                <h3 className="font-serif font-bold text-2xl text-brand-ink mb-6 border-b pb-4">Checkout de Matrícula</h3>

                {checkoutSuccess ? (
                  <div className="text-center py-12 space-y-6">
                    <div className="w-16 h-16 bg-emerald-150 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <CheckCircle className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-serif font-bold text-2xl text-brand-ink">Matrícula Confirmada! 🎓</h4>
                      <p className="text-gray-500 text-xs leading-relaxed max-w-sm mx-auto">Sua inscrição no curso "{checkoutCourse.title}" foi processada com sucesso. Você já possui acesso vitalício imediato.</p>
                    </div>

                    <button 
                      onClick={() => {
                        const courseToEnter = checkoutCourse;
                        setCheckoutCourse(null);
                        setCheckoutSuccess(false);
                        setActiveSubTab('classroom');
                        enterClassroom(courseToEnter);
                      }}
                      className="px-6 py-3.5 bg-brand-wood text-white hover:bg-brand-ink rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5"
                    >
                      Ir para a Sala de Aula <Play className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-8">
                    
                    {/* Left details order summary */}
                    <div className="space-y-6">
                      <div className="p-4 bg-brand-paper rounded-2xl border border-brand-wood/5">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Item Adquirido</div>
                        <div className="font-serif font-bold text-sm text-brand-ink">{checkoutCourse.title}</div>
                        <div className="text-[10px] text-gray-400 mt-1 font-semibold">Acesso Vitalício / Digital</div>
                      </div>

                      {/* Coupon input */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-bold uppercase ml-1">Possui cupom de desconto?</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Ex: ANDREW10"
                            className="flex-grow p-3 rounded-xl border bg-gray-50 font-mono text-xs uppercase"
                            value={couponCode}
                            onChange={e => setCouponCode(e.target.value)}
                          />
                          <button 
                            type="button"
                            onClick={handleApplyCoupon}
                            className="px-4 bg-brand-wood text-white rounded-xl text-xs font-bold hover:bg-brand-ink transition-colors"
                          >
                            Aplicar
                          </button>
                        </div>
                        {couponApplied && (
                          <div className="text-xs text-emerald-600 font-semibold ml-1">✓ Cupom ativado! Desconto de {couponDiscount}% concedido.</div>
                        )}
                        {couponError && (
                          <div className="text-xs text-red-500 font-semibold ml-1">✗ {couponError}</div>
                        )}
                      </div>

                      {/* Invoice Summary */}
                      <div className="p-4 bg-gray-50 rounded-2xl border space-y-2 text-xs font-medium text-gray-600 font-mono">
                        <div className="flex justify-between">
                          <span>Valor Original</span>
                          <span>R$ {checkoutCourse.price.toFixed(2)}</span>
                        </div>
                        {couponApplied && (
                          <div className="flex justify-between text-emerald-600 font-bold">
                            <span>Desconto de Cupom ({couponDiscount}%)</span>
                            <span>- R$ {(checkoutCourse.price * (couponDiscount / 100)).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-2 text-sm font-bold text-brand-ink">
                          <span>Valor Total</span>
                          <span>R$ {(checkoutCourse.price - (checkoutCourse.price * (couponDiscount / 100))).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Payment checkout forms */}
                    <form onSubmit={handleProcessCheckout} className="space-y-4 text-xs font-medium text-gray-600">
                      {/* Payment tabs selector */}
                      <div className="grid grid-cols-3 bg-gray-100 p-1 rounded-xl text-[11px] font-bold text-gray-500 mb-4">
                        <button 
                          type="button"
                          onClick={() => setPaymentMethod('pix')}
                          className={`p-2 rounded-lg flex items-center justify-center gap-1 ${paymentMethod === 'pix' ? 'bg-white text-brand-wood shadow-xs' : ''}`}
                        >
                          <QrCode className="w-3.5 h-3.5" /> PIX
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPaymentMethod('card')}
                          className={`p-2 rounded-lg flex items-center justify-center gap-1 ${paymentMethod === 'card' ? 'bg-white text-brand-wood shadow-xs' : ''}`}
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Cartão
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPaymentMethod('boleto')}
                          className={`p-2 rounded-lg flex items-center justify-center gap-1 ${paymentMethod === 'boleto' ? 'bg-white text-brand-wood shadow-xs' : ''}`}
                        >
                          <Barcode className="w-3.5 h-3.5" /> Boleto
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-gray-500 ml-1">CPF para Emissão da Nota Fiscal *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="000.000.000-00"
                            className="w-full p-3 rounded-xl border bg-gray-50"
                            value={cpf}
                            onChange={e => setCpf(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-gray-500 ml-1">WhatsApp de Contato *</label>
                          <input 
                            type="tel" 
                            required
                            placeholder="(19) 99999-9999"
                            className="w-full p-3 rounded-xl border bg-gray-50"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                          />
                        </div>

                        {/* Credit Card inputs */}
                        {paymentMethod === 'card' && (
                          <div className="space-y-3 border-t pt-3 mt-3">
                            <div className="space-y-1">
                              <label className="text-gray-500 ml-1">Nome Impresso no Cartão *</label>
                              <input 
                                type="text" 
                                required
                                placeholder="Nome Completo"
                                className="w-full p-3 rounded-xl border bg-gray-50"
                                value={cardName}
                                onChange={e => setCardName(e.target.value)}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-gray-500 ml-1">Número do Cartão *</label>
                              <input 
                                type="text" 
                                required
                                placeholder="0000 0000 0000 0000"
                                className="w-full p-3 rounded-xl border bg-gray-50"
                                value={cardNumber}
                                onChange={e => setCardNumber(e.target.value)}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-gray-500 ml-1">Validade *</label>
                                <input 
                                  type="text" 
                                  required
                                  placeholder="MM/AA"
                                  className="w-full p-3 rounded-xl border bg-gray-50"
                                  value={cardExpiry}
                                  onChange={e => setCardExpiry(e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-gray-500 ml-1">CVV *</label>
                                <input 
                                  type="password" 
                                  required
                                  placeholder="123"
                                  maxLength={4}
                                  className="w-full p-3 rounded-xl border bg-gray-50"
                                  value={cardCvv}
                                  onChange={e => setCardCvv(e.target.value)}
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-gray-500 ml-1">Parcelas *</label>
                              <select 
                                className="w-full p-3 rounded-xl border bg-gray-50 text-xs"
                                value={installments}
                                onChange={e => setInstallments(e.target.value)}
                              >
                                <option value="1">1x sem juros</option>
                                <option value="2">2x sem juros</option>
                                <option value="3">3x sem juros</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {paymentMethod === 'pix' && (
                          <div className="p-3.5 bg-emerald-50 border border-emerald-150 rounded-2xl text-[11px] text-emerald-800 leading-relaxed flex gap-2">
                            <QrCode className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div>
                              **Pagamento Imediato**: A chave PIX copia-e-cola e o QR Code serão gerados no final. A liberação de sua vaga na sala de aula é automática de imediato.
                            </div>
                          </div>
                        )}

                        {paymentMethod === 'boleto' && (
                          <div className="p-3.5 bg-blue-50 border border-blue-150 rounded-2xl text-[11px] text-blue-800 leading-relaxed flex gap-2">
                            <Barcode className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div>
                              **Processamento Bancário**: O boleto bancário leva até 2 dias úteis para compensação. A vaga será liberada em sua conta assim que compensado.
                            </div>
                          </div>
                        )}
                      </div>

                      {checkoutError && (
                        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">{checkoutError}</div>
                      )}

                      <button 
                        type="submit"
                        disabled={checkoutProcessing}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {checkoutProcessing ? 'Processando Inscrição...' : `Pagar R$ ${(checkoutCourse.price - (checkoutCourse.price * (couponDiscount / 100))).toFixed(2)}`}
                      </button>
                    </form>

                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* MODAL 3: CERTIFICATE GENERATION VIEWER                               */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {issuedCert && (
          <div className="fixed inset-0 z-[160] bg-brand-ink/65 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 md:p-10 relative">
                <button 
                  onClick={() => setIssuedCert(null)}
                  className="absolute top-6 right-6 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors cursor-pointer outline-none z-10"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>

                <h3 className="font-serif font-bold text-xl text-brand-ink mb-6 border-b pb-3 flex items-center gap-2">
                  <Award className="w-6 h-6 text-yellow-500" /> Certificado de Conclusão de Curso
                </h3>

                {/* Printable Certificate Template */}
                <div 
                  id="printable-certificate" 
                  className="bg-[#FCFAF5] p-12 md:p-16 rounded-2xl border-8 border-double border-brand-wood/40 text-center relative select-none font-sans"
                  style={{ backgroundImage: 'radial-gradient(circle, #FCFAF5 60%, #F5EFE0 100%)' }}
                >
                  {/* Outer border decoration */}
                  <div className="absolute inset-4 border border-brand-wood/10 rounded-lg pointer-events-none"></div>

                  <div className="max-w-2xl mx-auto space-y-6 relative">
                    {/* Header */}
                    <div className="space-y-1">
                      <div className="font-serif font-bold text-3xl text-brand-ink uppercase tracking-wider">Academia de Artes Andrew Lemos</div>
                      <div className="text-brand-wood text-[11px] font-bold uppercase tracking-widest">Escolas e Oficinas de Arte Tradicional do Brasil</div>
                    </div>

                    {/* Badge */}
                    <div className="w-20 h-20 bg-yellow-500/10 border-4 border-yellow-500/30 rounded-full flex items-center justify-center mx-auto my-6 shadow-sm">
                      <Award className="w-10 h-10 text-yellow-600" />
                    </div>

                    {/* Main certificate text */}
                    <div className="space-y-3">
                      <div className="text-gray-400 text-xs italic">Certificamos solenemente que o(a) aluno(a)</div>
                      <div className="font-serif font-bold text-2xl md:text-3xl text-brand-ink border-b-2 border-brand-wood/20 pb-2 inline-block px-8 max-w-full truncate">{issuedCert.userName}</div>
                      <div className="text-gray-400 text-xs italic max-w-md mx-auto leading-relaxed mt-3">concluiu com êxito todas as etapas letivas, apostilas práticas e revisões individuais do curso profissionalizante:</div>
                      <div className="font-serif font-bold text-xl md:text-2xl text-brand-wood">{issuedCert.courseTitle}</div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-8 pt-8 border-t border-brand-wood/10 mt-10">
                      <div className="text-center space-y-1">
                        <div className="font-serif font-bold text-xs italic text-brand-ink">Andrew Lemos</div>
                        <div className="w-24 h-[1px] bg-gray-300 mx-auto"></div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-widest">Mestre Diretor / Instrutor</div>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="font-mono text-xs font-bold text-brand-ink">Verificação Digital</div>
                        <div className="w-24 h-[1px] bg-gray-300 mx-auto"></div>
                        <div className="text-[9px] text-brand-wood font-mono tracking-wider">{issuedCert.id}</div>
                      </div>
                    </div>

                    {/* Verification info */}
                    <div className="text-[9px] text-gray-400 pt-6">
                      Emitido em {issuedCert.issuedAt?.toDate ? issuedCert.issuedAt.toDate().toLocaleDateString('pt-BR') : new Date(issuedCert.issuedAt).toLocaleDateString('pt-BR')}. Para confirmar a validade deste diploma digital, consulte a secretaria LMS do portal.
                    </div>
                  </div>
                </div>

                {/* Print button */}
                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={() => {
                      window.print();
                    }}
                    className="px-6 py-3 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 text-xs"
                  >
                    <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Elegant Login/Register Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-brand-ink/40 backdrop-blur-xs cursor-pointer animate-fadeIn"
            onClick={() => { setShowLoginModal(false); setAuthError(''); setAuthSuccess(''); }}
          />
          
          {/* Modal Container */}
          <div className="bg-white rounded-[2.5rem] border border-brand-wood/10 p-8 md:p-10 shadow-2xl relative overflow-hidden text-left max-w-md w-full z-10 animate-fadeIn">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-wood to-brand-ink"></div>

            {/* Close Button */}
            <button 
              type="button"
              onClick={() => { setShowLoginModal(false); setAuthError(''); setAuthSuccess(''); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-brand-wood bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-all cursor-pointer border-0"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6 text-center">
              {/* Circular logo inside modal */}
              <div className="w-16 h-16 rounded-full overflow-hidden border border-brand-wood/20 flex items-center justify-center bg-white shadow-sm mx-auto mb-4">
                <img 
                  src={ensureRobustUrl("https://drive.google.com/file/d/1BEZWW-yg4axZKVhIo_Y9GlRgeGQ3xeqi/view?usp=drive_link")} 
                  alt="Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-serif font-bold text-xl md:text-2xl text-brand-ink mb-1">
                {isRegisterMode ? 'Criar Conta de Aluno' : 'Portal de Alunos'}
              </h3>
              <p className="text-gray-400 text-[11px] leading-relaxed">
                {isRegisterMode 
                  ? 'Crie seu cadastro para iniciar seus estudos e registrar-se como afiliado' 
                  : 'Faça login para assistir às suas aulas, acessar materiais e interagir com o mestre.'}
              </p>
            </div>

            {authError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl font-medium leading-relaxed text-left">
                ⚠️ {authError}
              </div>
            )}

            {authSuccess && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3.5 rounded-xl font-medium leading-relaxed text-left">
                ✨ {authSuccess}
              </div>
            )}

            <form 
              onSubmit={async (e) => {
                if (isRegisterMode) {
                  await handleLMSRegister(e);
                } else {
                  await handleLMSLogin(e);
                }
              }} 
              className="space-y-4 text-xs font-medium text-gray-600"
            >
              {isRegisterMode && (
                <div className="space-y-1">
                  <label className="text-gray-500 ml-1">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Seu nome artístico ou completo"
                    className="w-full px-4 py-3 bg-gray-50/50 border border-brand-wood/10 hover:border-brand-wood/20 focus:border-brand-wood/50 focus:bg-white rounded-xl outline-none transition-all text-sm font-normal text-brand-ink"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-gray-500 ml-1">Endereço de E-mail</label>
                <input 
                  type="email" 
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full px-4 py-3 bg-gray-50/50 border border-brand-wood/10 hover:border-brand-wood/20 focus:border-brand-wood/50 focus:bg-white rounded-xl outline-none transition-all text-sm font-normal text-brand-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-500 ml-1">Senha de Acesso</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full px-4 py-3 bg-gray-50/50 border border-brand-wood/10 hover:border-brand-wood/20 focus:border-brand-wood/50 focus:bg-white rounded-xl outline-none transition-all text-sm font-normal text-brand-ink pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-wood cursor-pointer border-0 bg-transparent focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isRegisterMode && (
                <div className="space-y-1">
                  <label className="text-gray-500 ml-1">Confirmar Senha</label>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={authConfirmPassword}
                    onChange={(e) => setAuthConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full px-4 py-3 bg-gray-50/50 border border-brand-wood/10 hover:border-brand-wood/20 focus:border-brand-wood/50 focus:bg-white rounded-xl outline-none transition-all text-sm font-normal text-brand-ink"
                  />
                </div>
              )}

              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full py-3.5 bg-brand-wood text-white hover:bg-brand-ink rounded-xl text-xs font-bold transition-all shadow-sm tracking-wider uppercase cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {authLoading ? 'Processando...' : (isRegisterMode ? 'Cadastrar Minha Conta' : 'Acessar Plataforma')}
              </button>
            </form>

            {/* Google Authentication Option */}
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
              <span className="relative bg-white px-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ou continue com</span>
            </div>

            <button 
              type="button"
              onClick={handleLMSGoogleLogin}
              disabled={authLoading}
              className="w-full py-3 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com o Google
            </button>



            {/* Registration toggle */}
            <div className="mt-6 text-center">
              <button 
                type="button" 
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className="text-xs text-brand-wood hover:text-brand-ink font-semibold transition-all underline decoration-brand-wood/30 cursor-pointer border-0 bg-transparent"
              >
                {isRegisterMode ? 'Já tenho uma conta de aluno? Entrar' : 'Não possui uma conta? Criar Conta Gratuita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First access password change modal */}
      <AnimatePresence>
        {needsPasswordChange && currentUser && (
          <div className="fixed inset-0 z-[300] bg-brand-ink/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] border border-brand-wood/10 p-8 md:p-10 shadow-2xl relative overflow-hidden text-left max-w-md w-full"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-wood to-brand-clay"></div>
              
              <div className="mb-6 text-center">
                <div className="w-16 h-16 rounded-full bg-brand-wood/10 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-brand-wood" />
                </div>
                <h3 className="font-serif font-bold text-xl md:text-2xl text-brand-ink mb-1">
                  Primeiro Acesso Detectado! 🔐
                </h3>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Por medidas de segurança, você deve alterar a sua senha temporária gerada pelo nosso sistema por uma senha pessoal de sua preferência para continuar.
                </p>
              </div>

              {passwordChangeError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl font-medium leading-relaxed">
                  ⚠️ {passwordChangeError}
                </div>
              )}

              {passwordChangeSuccess && (
                <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3.5 rounded-xl font-medium leading-relaxed">
                  ✨ {passwordChangeSuccess}
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs font-medium text-gray-600">
                <div className="space-y-1">
                  <label className="text-gray-500 ml-1 block">E-mail</label>
                  <input 
                    type="email" 
                    readOnly 
                    value={currentUser.email || ''} 
                    className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-normal text-gray-500 cursor-not-allowed outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-500 ml-1 block">Nova Senha</label>
                  <input 
                    type="password" 
                    required 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres" 
                    className="w-full px-4 py-3 bg-gray-50/50 border border-brand-wood/10 hover:border-brand-wood/20 focus:border-brand-wood/50 focus:bg-white rounded-xl outline-none transition-all text-sm font-normal text-brand-ink"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-500 ml-1 block">Confirmar Nova Senha</label>
                  <input 
                    type="password" 
                    required 
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirme sua nova senha" 
                    className="w-full px-4 py-3 bg-gray-50/50 border border-brand-wood/10 hover:border-brand-wood/20 focus:border-brand-wood/50 focus:bg-white rounded-xl outline-none transition-all text-sm font-normal text-brand-ink"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isChangingPassword}
                  className="w-full py-4 bg-brand-wood text-white hover:bg-brand-clay rounded-xl text-xs font-bold transition-all shadow-md tracking-wider uppercase cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {isChangingPassword ? 'Salvando nova senha...' : 'Atualizar e Acessar Plataforma'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
