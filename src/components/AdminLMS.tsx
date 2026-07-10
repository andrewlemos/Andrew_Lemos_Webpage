import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { 
  BookOpen, 
  Layers, 
  Play, 
  User, 
  Plus, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  DollarSign, 
  Users, 
  Send, 
  Bell, 
  TrendingUp, 
  MessageSquare, 
  Award, 
  Calendar,
  Layers2,
  FileText,
  AlertCircle
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
  deleteDoc,
  getDocs,
  where,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { 
  Course, 
  CourseModule, 
  Lesson, 
  Enrollment, 
  SupportMessage, 
  LessonComment, 
  AffiliateProfile, 
  SystemNotification,
  InstructorProfile 
} from '../types';
import { ensureRobustUrl } from '../App';

interface AdminLMSProps {
  currentUser?: any;
  isMasterAdmin?: boolean;
}

export const AdminLMS: React.FC<AdminLMSProps> = ({ currentUser, isMasterAdmin = false }) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'content' | 'enrollments' | 'messages' | 'comments' | 'affiliates' | 'reports' | 'notifications' | 'instructors' | 'ebooks'>('content');
  const [contentSubTab, setContentSubTab] = useState<'courses' | 'syllabus'>('courses');
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [isSavingEbook, setIsSavingEbook] = useState(false);
  const [isSavingModule, setIsSavingModule] = useState(false);
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  
  // Database States
  const [courses, setCourses] = useState<Course[]>([]);
  const [allModules, setAllModules] = useState<CourseModule[]>([]);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
  const [allSupportMessages, setAllSupportMessages] = useState<SupportMessage[]>([]);
  const [allComments, setAllComments] = useState<LessonComment[]>([]);
  const [allAffiliates, setAllAffiliates] = useState<AffiliateProfile[]>([]);
  
  // eBooks / Apostilas state & form
  const [ebooks, setEbooks] = useState<any[]>([]);
  const [showEbookForm, setShowEbookForm] = useState(false);
  const [editingEbook, setEditingEbook] = useState<any | null>(null);
  const [ebookForm, setEbookForm] = useState({
    name: '',
    description: '',
    price: 49.90,
    imageUrl: '',
    digitalPdfUrl: '',
    slug: ''
  });

  // Instructors States
  const [instructors, setInstructors] = useState<InstructorProfile[]>([]);
  const [myProfile, setMyProfile] = useState<InstructorProfile | null>(null);
  const [showInstructorForm, setShowInstructorForm] = useState(false);
  const [instructorForm, setInstructorForm] = useState<Partial<InstructorProfile>>({
    email: '', name: '', photoUrl: '', bio: ''
  });
  const [myProfileForm, setMyProfileForm] = useState<Partial<InstructorProfile>>({
    name: '', photoUrl: '', bio: ''
  });

  // Computed dynamic states
  const modules = isMasterAdmin ? allModules : allModules.filter(m => courses.some(c => c.id === m.courseId));
  const lessons = isMasterAdmin ? allLessons : allLessons.filter(l => courses.some(c => c.id === l.courseId));
  const enrollments = isMasterAdmin ? allEnrollments : allEnrollments.filter(e => courses.some(c => c.id === e.courseId));
  const supportMessages = isMasterAdmin ? allSupportMessages : allSupportMessages.filter(m => courses.some(c => c.id === m.courseId));
  const comments = isMasterAdmin ? allComments : allComments.filter(c => courses.some(co => co.id === c.courseId));
  const affiliates = allAffiliates;

  // Selection states for hierarchies
  const [selectedCourseForStructure, setSelectedCourseForStructure] = useState<Course | null>(null);
  const [selectedModuleForStructure, setSelectedModuleForStructure] = useState<CourseModule | null>(null);

  // Forms / Editing states
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState<Partial<Course>>({
    title: '', description: '', shortDescription: '', imageUrl: '', professor: 'Andrew Lemos',
    category: 'Entalhe', price: 199.00, status: 'Ativo', slug: '',
    duration: 10, hasCertificate: true, accessibilityType: 'lifetime',
    accessDurationDays: 30, metaTitle: '', metaDescription: ''
  });

  const [moduleForm, setModuleForm] = useState({ title: '', description: '', order: 1 });
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', videoUrl: '', order: 1 });
  const [materialForm, setMaterialForm] = useState({ name: '', url: '', type: 'pdf' as 'pdf' | 'image' | 'link' });
  const [lessonMaterials, setLessonMaterials] = useState<{ name: string; url: string; type: 'pdf' | 'image' | 'link' }[]>([]);

  // Manual Enrollment Form
  const [manualEnroll, setManualEnroll] = useState({
    userEmail: '', userName: '', courseId: '', accessType: 'lifetime' as 'lifetime' | 'subscription' | 'temporary',
    durationDays: 30
  });

  // Support Reply state
  const [respondingMessage, setRespondingMessage] = useState<SupportMessage | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');

  // Comment Reply state
  const [respondingComment, setRespondingComment] = useState<LessonComment | null>(null);
  const [adminCommentReplyText, setAdminCommentReplyText] = useState('');

  // Notification Broadcast Form
  const [broadcastNotif, setBroadcastNotif] = useState({ title: '', message: '', target: 'all' as 'all' | 'course', courseId: '' });

  // Affiliate Global settings & commissions tracking
  const [globalCommissionPercent, setGlobalCommissionPercent] = useState<number>(15);
  const [allCommissions, setAllCommissions] = useState<any[]>([]);

  // Load all LMS entities in Admin Panel
  useEffect(() => {
    if (!currentUser) return;

    const email = currentUser.email || "";

    // 1. Fetch instructors if master admin
    let unsubInstructors = () => {};
    if (isMasterAdmin) {
      unsubInstructors = onSnapshot(collection(db, 'lms_instructors'), (snap) => {
        setInstructors(snap.docs.map(d => ({ id: d.id, ...d.data() } as InstructorProfile)));
      }, (error) => {
        console.error("Erro ao monitorar instrutores:", error);
      });
    }

    // 2. Fetch current instructor profile
    const unsubMyProfile = onSnapshot(doc(db, 'lms_instructors', email), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as InstructorProfile;
        setMyProfile(data);
        setMyProfileForm({
          name: data.name || '',
          photoUrl: data.photoUrl || '',
          bio: data.bio || ''
        });
      } else if (isMasterAdmin) {
        // Create initial profile for Andrew Lemos if not exists
        const defaultAndrew = {
          email: 'andrewfmlemos@gmail.com',
          name: 'Andrew Lemos',
          photoUrl: 'https://drive.google.com/file/d/19eW-HQIP_VjSz5mQNI5EDB0L12BM-b99/view?usp=sharing',
          bio: 'Com mais de uma década dedicada ao entalhe artístico, Andrew Lemos produz peças sob encomenda para colecionadores e ensina técnicas clássicas de escultura e marcenaria artística a milhares de alunos em todo o Brasil.'
        };
        setDoc(doc(db, 'lms_instructors', 'andrewfmlemos@gmail.com'), defaultAndrew)
          .catch(err => console.error("Erro ao criar perfil mestre:", err));
      }
    });

    const unsubCourses = onSnapshot(collection(db, 'lms_courses'), (snap) => {
      const allCourses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
      const filtered = isMasterAdmin ? allCourses : allCourses.filter(c => c.instructorEmail === email);
      setCourses(filtered);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_courses');
    });

    const unsubModules = onSnapshot(query(collection(db, 'lms_modules'), orderBy('order', 'asc')), (snap) => {
      setAllModules(snap.docs.map(d => ({ id: d.id, ...d.data() } as CourseModule)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_modules');
    });

    const unsubLessons = onSnapshot(query(collection(db, 'lms_lessons'), orderBy('order', 'asc')), (snap) => {
      setAllLessons(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_lessons');
    });

    const unsubEnroll = onSnapshot(collection(db, 'lms_enrollments'), (snap) => {
      setAllEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_enrollments');
    });

    const unsubMessages = onSnapshot(query(collection(db, 'lms_messages'), orderBy('createdAt', 'desc')), (snap) => {
      setAllSupportMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_messages');
    });

    const unsubComments = onSnapshot(query(collection(db, 'lms_comments'), orderBy('createdAt', 'desc')), (snap) => {
      setAllComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as LessonComment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_comments');
    });

    const unsubAffiliates = onSnapshot(collection(db, 'lms_affiliates'), (snap) => {
      setAllAffiliates(snap.docs.map(d => ({ id: d.id, ...d.data() } as AffiliateProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lms_affiliates');
    });

    const unsubAffiliateSettings = onSnapshot(doc(db, 'lms_settings', 'affiliates'), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalCommissionPercent(docSnap.data().commissionPercent ?? 15);
      }
    }, (error) => {
      console.error("Erro ao monitorar configurações de comissão:", error);
    });

    const unsubCommissions = onSnapshot(collection(db, 'lms_commissions'), (snap) => {
      setAllCommissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Erro ao monitorar comissões no Admin:", error);
    });

    const unsubEbooks = onSnapshot(collection(db, 'ecom_products'), (snap) => {
      const allProds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filteredEbooks = allProds.filter((p: any) => p.category === 'Apostilas & E-books' || p.digitalPdfUrl);
      setEbooks(filteredEbooks);
    }, (error) => {
      console.error("Erro ao monitorar apostilas e e-books no LMS Admin:", error);
    });

    return () => {
      unsubInstructors();
      unsubMyProfile();
      unsubCourses();
      unsubModules();
      unsubLessons();
      unsubEnroll();
      unsubMessages();
      unsubComments();
      unsubAffiliates();
      unsubAffiliateSettings();
      unsubCommissions();
      unsubEbooks();
    };
  }, [currentUser, isMasterAdmin]);

  // Course CRUD Operations
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingCourse) return;
    if (!courseForm.title || !courseForm.slug) return;

    setIsSavingCourse(true);
    try {
      const courseId = editingCourse?.id || "curso-" + Math.random().toString(36).substr(2, 6);
      const docPayload: Course = {
        title: courseForm.title,
        description: courseForm.description || '',
        shortDescription: courseForm.shortDescription || '',
        imageUrl: courseForm.imageUrl || '',
        professor: editingCourse ? (editingCourse.professor || 'Andrew Lemos') : (isMasterAdmin ? (courseForm.professor || 'Andrew Lemos') : (myProfile?.name || 'Instrutor')),
        category: courseForm.category || 'Geral',
        price: Number(courseForm.price) || 0,
        status: courseForm.status as 'Ativo' | 'Em breve' | 'Inativo',
        slug: courseForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        duration: Number(courseForm.duration) || 0,
        hasCertificate: !!courseForm.hasCertificate,
        accessibilityType: courseForm.accessibilityType as 'lifetime' | 'subscription' | 'temporary',
        accessDurationDays: Number(courseForm.accessDurationDays) || 30,
        metaTitle: courseForm.metaTitle || '',
        metaDescription: courseForm.metaDescription || '',
        instructorEmail: editingCourse ? (editingCourse.instructorEmail || 'andrewfmlemos@gmail.com') : (isMasterAdmin ? (courseForm.instructorEmail || 'andrewfmlemos@gmail.com') : (currentUser?.email || 'andrewfmlemos@gmail.com')),
        updatedAt: new Date()
      };

      if (!editingCourse) {
        docPayload.createdAt = new Date();
      } else {
        docPayload.createdAt = editingCourse.createdAt || new Date();
      }

      await setDoc(doc(db, 'lms_courses', courseId), docPayload);
      
      // Reset Form
      setEditingCourse(null);
      setCourseForm({
        title: '', description: '', shortDescription: '', imageUrl: '', professor: 'Andrew Lemos',
        category: 'Entalhe', price: 199.00, status: 'Ativo', slug: '',
        duration: 10, hasCertificate: true, accessibilityType: 'lifetime',
        accessDurationDays: 30, metaTitle: '', metaDescription: ''
      });
      setShowCourseForm(false);
      alert("Curso salvo com sucesso!");
    } catch (err: any) {
      alert("Erro ao salvar curso: " + err.message);
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm("Deseja mesmo remover este curso? Todas as aulas e matrículas vinculadas podem perder referência.")) return;
    try {
      await deleteDoc(doc(db, 'lms_courses', courseId));
    } catch (err: any) {
      alert("Erro ao remover: " + err.message);
    }
  };

  // eBooks / Apostilas CRUD Operations
  const handleSaveEbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingEbook) return;
    if (!ebookForm.name || !ebookForm.digitalPdfUrl) {
      alert("Por favor, preencha o Nome e o Link do PDF da Apostila.");
      return;
    }

    setIsSavingEbook(true);
    try {
      const ebookId = editingEbook?.id || "ebook-" + Math.random().toString(36).substr(2, 6);
      const computedSlug = (ebookForm.slug || '').trim() || ebookForm.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      const docPayload = {
        name: ebookForm.name,
        description: ebookForm.description || '',
        category: 'Apostilas & E-books',
        images: ebookForm.imageUrl ? [ebookForm.imageUrl.trim()] : ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=600'],
        weight: 0.1,
        height: 1,
        width: 1,
        length: 1,
        stock: 999999, // unlimited digital stock
        price: Number(ebookForm.price) || 0,
        shippingType: 'automatic',
        digitalPdfUrl: ebookForm.digitalPdfUrl.trim(),
        slug: computedSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        createdAt: editingEbook?.createdAt || new Date()
      };

      await setDoc(doc(db, 'ecom_products', ebookId), docPayload);

      // Reset Form
      setEditingEbook(null);
      setEbookForm({
        name: '',
        description: '',
        price: 49.90,
        imageUrl: '',
        digitalPdfUrl: '',
        slug: ''
      });
      setShowEbookForm(false);
      alert("Apostila/E-book salvo com sucesso!");
    } catch (err: any) {
      alert("Erro ao salvar apostila: " + err.message);
    } finally {
      setIsSavingEbook(false);
    }
  };

  const handleDeleteEbook = async (ebookId: string) => {
    if (!window.confirm("Deseja mesmo remover esta Apostila/E-book?")) return;
    try {
      await deleteDoc(doc(db, 'ecom_products', ebookId));
      alert("Apostila removida com sucesso!");
    } catch (err: any) {
      alert("Erro ao remover: " + err.message);
    }
  };

  // Module CRUD
  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingModule) return;
    if (!selectedCourseForStructure || !moduleForm.title) return;

    setIsSavingModule(true);
    try {
      const modId = "mod-" + Math.random().toString(36).substr(2, 6);
      const mod: CourseModule = {
        courseId: selectedCourseForStructure.id!,
        title: moduleForm.title,
        description: moduleForm.description,
        order: Number(moduleForm.order) || 1
      };

      await setDoc(doc(db, 'lms_modules', modId), mod);
      setModuleForm({ title: '', description: '', order: (Number(moduleForm.order) || 1) + 1 });
      alert("Módulo adicionado com sucesso!");
    } catch (err: any) {
      alert("Erro ao adicionar módulo: " + err.message);
    } finally {
      setIsSavingModule(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!window.confirm("Deseja mesmo apagar este módulo?")) return;
    try {
      await deleteDoc(doc(db, 'lms_modules', moduleId));
    } catch (err: any) {
      alert("Erro ao deletar: " + err.message);
    }
  };

  // Lesson CRUD
  const handleAddMaterial = () => {
    if (!materialForm.name || !materialForm.url) return;
    setLessonMaterials([...lessonMaterials, { ...materialForm }]);
    setMaterialForm({ name: '', url: '', type: 'pdf' });
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingLesson) return;
    if (!selectedCourseForStructure || !selectedModuleForStructure || !lessonForm.title) return;

    setIsSavingLesson(true);
    try {
      const lesId = "les-" + Math.random().toString(36).substr(2, 6);
      const les: Lesson = {
        courseId: selectedCourseForStructure.id!,
        moduleId: selectedModuleForStructure.id!,
        title: lessonForm.title,
        description: lessonForm.description,
        videoUrl: lessonForm.videoUrl,
        order: Number(lessonForm.order) || 1,
        materials: lessonMaterials,
        createdAt: new Date()
      };

      await setDoc(doc(db, 'lms_lessons', lesId), les);
      setLessonForm({ title: '', description: '', videoUrl: '', order: (Number(lessonForm.order) || 1) + 1 });
      setLessonMaterials([]);
      alert("Aula adicionada com sucesso!");
    } catch (err: any) {
      alert("Erro ao salvar aula: " + err.message);
    } finally {
      setIsSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!window.confirm("Deseja deletar esta aula?")) return;
    try {
      await deleteDoc(doc(db, 'lms_lessons', lessonId));
    } catch (err) {
      alert("Erro ao deletar aula.");
    }
  };

  // Manual Enrollments
  const handleCreateManualEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEnroll.userEmail || !manualEnroll.courseId) return;

    try {
      // Find userId via email if possible, or use a hashed/custom ID
      const userEmailClean = manualEnroll.userEmail.trim().toLowerCase();
      let calculatedUid = "MANUAL-" + Math.random().toString(36).substr(2, 6).toUpperCase();

      const matchedCourse = courses.find(c => c.id === manualEnroll.courseId);
      if (!matchedCourse) return;

      const enrollId = "ENR-" + Math.random().toString(36).substr(2, 6).toUpperCase();
      const enroll: Enrollment = {
        id: enrollId,
        userId: calculatedUid,
        userEmail: userEmailClean,
        userName: manualEnroll.userName || userEmailClean.split('@')[0],
        courseId: manualEnroll.courseId,
        courseTitle: matchedCourse.title,
        status: 'active',
        accessType: manualEnroll.accessType,
        createdAt: new Date()
      };

      if (manualEnroll.accessType === 'temporary') {
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + (Number(manualEnroll.durationDays) || 30));
        enroll.expiresAt = expDate.toISOString();
      }

      await setDoc(doc(db, 'lms_enrollments', enrollId), enroll);
      setManualEnroll({ userEmail: '', userName: '', courseId: '', accessType: 'lifetime', durationDays: 30 });
      alert("Estudante matriculado e ativado com sucesso!");
    } catch (err: any) {
      alert("Erro ao matricular: " + err.message);
    }
  };

  const handleUpdateEnrollmentStatus = async (enrollId: string, newStatus: 'active' | 'canceled' | 'dropout') => {
    try {
      await updateDoc(doc(db, 'lms_enrollments', enrollId), {
        status: newStatus,
        updatedAt: new Date()
      });

      // Synchronize enrollment status with lms_commissions
      try {
        const q = query(collection(db, 'lms_commissions'), where('enrollmentId', '==', enrollId));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          for (const dDoc of qSnap.docs) {
            await updateDoc(doc(db, 'lms_commissions', dDoc.id), {
              enrollStatus: newStatus,
              updatedAt: new Date()
            });
          }
        }
      } catch (comErr) {
        console.warn("Could not sync commission document on enrollment status change:", comErr);
      }

      alert(`Status da matrícula alterado para: ${newStatus}`);
    } catch (err) {
      alert("Erro ao atualizar status.");
    }
  };

  const handleSaveAffiliateSettings = async (percent: number) => {
    try {
      await setDoc(doc(db, 'lms_settings', 'affiliates'), {
        commissionPercent: percent,
        updatedAt: new Date()
      }, { merge: true });
      alert("Configuração de comissão padrão de afiliados atualizada com sucesso!");
    } catch (err: any) {
      alert("Erro ao salvar configuração: " + err.message);
    }
  };

  // Support Inbox Responses
  const handleSendSupportReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingMessage || !adminReplyText.trim()) return;

    try {
      const msg: SupportMessage = {
        senderId: 'admin',
        senderName: 'Andrew Lemos (Ateliê)',
        senderEmail: 'andrewfmlemos@gmail.com',
        receiverId: respondingMessage.senderId,
        courseId: respondingMessage.courseId || null,
        courseTitle: respondingMessage.courseTitle || null,
        subject: `Re: ${respondingMessage.subject}`,
        content: adminReplyText.trim(),
        read: false,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'lms_messages'), msg);
      
      // Update original ticket status as read
      await updateDoc(doc(db, 'lms_messages', respondingMessage.id!), {
        read: true
      });

      setRespondingMessage(null);
      setAdminReplyText('');
      alert("Sua resposta profissional foi enviada com sucesso ao aluno!");
    } catch (err: any) {
      alert("Erro ao responder: " + err.message);
    }
  };

  // Comments Replies
  const handlePostCommentReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingComment || !adminCommentReplyText.trim()) return;

    try {
      const commentRef = doc(db, 'lms_comments', respondingComment.id!);
      const reply = {
        id: Math.random().toString(36).substr(2, 9),
        userId: 'admin',
        userName: 'Andrew Lemos (Mestre)',
        userEmail: 'andrewfmlemos@gmail.com',
        text: adminCommentReplyText.trim(),
        createdAt: new Date().toISOString(),
        isAdmin: true
      };

      const replies = respondingComment.replies || [];
      await updateDoc(commentRef, {
        replies: [...replies, reply]
      });

      setRespondingComment(null);
      setAdminCommentReplyText('');
      alert("Resposta postada na aula!");
    } catch (err) {
      alert("Erro ao responder comentário.");
    }
  };

  // Broadcast Broadcast notifications to students
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastNotif.title || !broadcastNotif.message) return;

    try {
      const selectedCourseObj = courses.find(c => c.id === broadcastNotif.courseId);
      const notif: SystemNotification = {
        title: broadcastNotif.title.trim(),
        message: broadcastNotif.message.trim(),
        target: broadcastNotif.target,
        courseId: broadcastNotif.courseId || null,
        courseTitle: selectedCourseObj?.title || null,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'lms_notifications'), notif);
      setBroadcastNotif({ title: '', message: '', target: 'all', courseId: '' });
      alert("Notificação transmitida e enviada a todos os alunos!");
    } catch (err: any) {
      alert("Erro ao disparar: " + err.message);
    }
  };

  // Adjust Affiliate properties
  const handleUpdateAffiliateStatus = async (affId: string, status: 'Ativo' | 'Inativo' | 'Pendente') => {
    try {
      await updateDoc(doc(db, 'lms_affiliates', affId), { status });
    } catch (err) {
      alert("Erro ao atualizar status de afiliado.");
    }
  };

  // Instructor handlers
  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.email) return;
    try {
      const email = currentUser.email;
      const updatedProfile = {
        email,
        name: myProfileForm.name || '',
        photoUrl: myProfileForm.photoUrl || '',
        bio: myProfileForm.bio || '',
        updatedAt: new Date()
      };
      await setDoc(doc(db, 'lms_instructors', email), updatedProfile, { merge: true });
      alert("Seu perfil foi atualizado com sucesso!");
    } catch (err: any) {
      alert("Erro ao salvar perfil: " + err.message);
    }
  };

  const handleSaveInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructorForm.email || !instructorForm.name) return;
    try {
      const targetEmail = instructorForm.email.trim().toLowerCase();
      const newInst = {
        email: targetEmail,
        name: instructorForm.name.trim(),
        photoUrl: instructorForm.photoUrl?.trim() || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        bio: instructorForm.bio?.trim() || '',
        createdAt: new Date()
      };
      await setDoc(doc(db, 'lms_instructors', targetEmail), newInst);
      setInstructorForm({ email: '', name: '', photoUrl: '', bio: '' });
      setShowInstructorForm(false);
      alert("Instrutor cadastrado com sucesso! Agora ele tem permissão para acessar o painel e gerenciar os próprios cursos.");
    } catch (err: any) {
      alert("Erro ao cadastrar instrutor: " + err.message);
    }
  };

  const handleDeleteInstructor = async (email: string) => {
    if (email === 'andrewfmlemos@gmail.com') {
      alert("Não é possível remover o administrador mestre!");
      return;
    }
    if (confirm(`Deseja mesmo remover as permissões do instrutor ${email}?`)) {
      try {
        await deleteDoc(doc(db, 'lms_instructors', email));
        alert("Instrutor removido!");
      } catch (err: any) {
        alert("Erro ao deletar: " + err.message);
      }
    }
  };

  // Generate metrics for Commercial Dashboard Reports
  const totalRevenue = enrollments.reduce((sum, enroll) => {
    const course = courses.find(c => c.id === enroll.courseId);
    return sum + (enroll.status === 'active' && course ? course.price : 0);
  }, 0);

  return (
    <div className="space-y-8">
      {/* Tab Navigation header */}
      <div className="flex flex-wrap border-b border-gray-100 gap-2 pb-2 text-xs font-semibold text-gray-500">
        <button 
          onClick={() => setActiveAdminTab('content')}
          className={`px-4 py-2.5 rounded-lg transition-colors ${activeAdminTab === 'content' ? 'bg-brand-wood text-white font-bold' : 'hover:bg-gray-100'}`}
        >
          Estrutura de Cursos 📚
        </button>
        <button 
          onClick={() => setActiveAdminTab('enrollments')}
          className={`px-4 py-2.5 rounded-lg transition-colors ${activeAdminTab === 'enrollments' ? 'bg-brand-wood text-white font-bold' : 'hover:bg-gray-100'}`}
        >
          Matrículas & Alunos 🎓
        </button>
        <button 
          onClick={() => setActiveAdminTab('messages')}
          className={`px-4 py-2.5 rounded-lg transition-colors ${activeAdminTab === 'messages' ? 'bg-brand-wood text-white font-bold animate-pulse' : 'hover:bg-gray-100'}`}
        >
          Avaliações & Mensagens 💬
        </button>
        <button 
          onClick={() => setActiveAdminTab('comments')}
          className={`px-4 py-2.5 rounded-lg transition-colors ${activeAdminTab === 'comments' ? 'bg-brand-wood text-white font-bold' : 'hover:bg-gray-100'}`}
        >
          Dúvidas das Aulas ❓
        </button>
        <button 
          onClick={() => setActiveAdminTab('affiliates')}
          className={`px-4 py-2.5 rounded-lg transition-colors ${activeAdminTab === 'affiliates' ? 'bg-brand-wood text-white font-bold' : 'hover:bg-gray-100'}`}
        >
          Afiliados 🤝
        </button>
        <button 
          onClick={() => setActiveAdminTab('reports')}
          className={`px-4 py-2.5 rounded-lg transition-colors ${activeAdminTab === 'reports' ? 'bg-brand-wood text-white font-bold' : 'hover:bg-gray-100'}`}
        >
          LMS Relatórios 📈
        </button>
        <button 
          onClick={() => setActiveAdminTab('notifications')}
          className={`px-4 py-2.5 rounded-lg transition-colors ${activeAdminTab === 'notifications' ? 'bg-brand-wood text-white font-bold' : 'hover:bg-gray-100'}`}
        >
          Avisos Gerais 📢
        </button>
        <button 
          onClick={() => setActiveAdminTab('instructors')}
          className={`px-4 py-2.5 rounded-lg transition-colors ${activeAdminTab === 'instructors' ? 'bg-brand-wood text-white font-bold' : 'hover:bg-gray-100'}`}
        >
          {isMasterAdmin ? 'Instrutores & Perfil 👤' : 'Meu Perfil 👤'}
        </button>
        <button 
          onClick={() => setActiveAdminTab('ebooks')}
          className={`px-4 py-2.5 rounded-lg transition-colors ${activeAdminTab === 'ebooks' ? 'bg-brand-wood text-white font-bold' : 'hover:bg-gray-100'}`}
        >
          Apostilas & E-books 📖
        </button>
      </div>

      {/* ==================================================================== */}
      {/* ADMIN SUBTAB 1: CURSOS & CONTENT (HIERARCHY MANAGEMENT)              */}
      {/* ==================================================================== */}
      {/* ==================================================================== */}
      {/* ADMIN SUBTAB 1: CURSOS & CONTENT (HIERARCHY MANAGEMENT)              */}
      {/* ==================================================================== */}
      {activeAdminTab === 'content' && (
        <div className="space-y-6">
          {/* Inner Subtab navigation */}
          <div className="flex gap-2 border-b pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            <button 
              onClick={() => { setContentSubTab('courses'); setShowCourseForm(false); }}
              className={`pb-2 px-1 border-b-2 transition-all ${contentSubTab === 'courses' ? 'text-brand-wood border-brand-wood' : 'border-transparent hover:text-gray-600'}`}
            >
              Vitrine & Configuração de Cursos 🖼️
            </button>
            <button 
              onClick={() => setContentSubTab('syllabus')}
              className={`pb-2 px-1 border-b-2 transition-all ${contentSubTab === 'syllabus' ? 'text-brand-wood border-brand-wood' : 'border-transparent hover:text-gray-600'}`}
            >
              Grade Curricular (Módulos & Aulas) 📋
            </button>
          </div>

          {/* SUBTAB CONTENT: COURSES VITRINE */}
          {contentSubTab === 'courses' && (
            <div className="space-y-6">
              {!showCourseForm ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white p-5 rounded-3xl border border-brand-wood/10 shadow-xs">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-brand-ink flex items-center gap-1.5">
                        <BookOpen className="w-5 h-5 text-brand-wood" /> Vitrine de Infoprodutos & Cursos
                      </h3>
                      <p className="text-gray-400 text-[10px] mt-0.5">Gerencie os cursos e as configurações de venda exibidas na plataforma.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setEditingCourse(null);
                        setCourseForm({
                          title: '', description: '', shortDescription: '', imageUrl: '', professor: 'Andrew Lemos',
                          category: 'Entalhe', price: 199.00, status: 'Ativo', slug: '',
                          duration: 10, hasCertificate: true, accessibilityType: 'lifetime',
                          accessDurationDays: 30, metaTitle: '', metaDescription: ''
                        });
                        setShowCourseForm(true);
                      }}
                      className="px-4 py-2.5 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Criar Novo Curso
                    </button>
                  </div>

                  {/* Course Cards Grid */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs text-gray-500 font-medium">
                    {courses.map((course) => (
                      <div key={course.id} className="bg-white rounded-3xl border border-brand-wood/10 overflow-hidden flex flex-col hover:shadow-md transition-all">
                        {/* Course Cover with Contain to avoid cropping */}
                        <div className="aspect-video bg-gray-900 flex items-center justify-center relative border-b overflow-hidden">
                          <img 
                            src={ensureRobustUrl(course.imageUrl)} 
                            alt={course.title} 
                            className="w-full h-full object-contain" 
                          />
                          <span className="absolute top-3 left-3 px-2.5 py-1 bg-brand-wood text-white rounded-full text-[9px] font-bold shadow-sm uppercase">
                            {course.category}
                          </span>
                          <span className={`absolute top-3 right-3 px-2.5 py-1 text-white rounded-full text-[9px] font-bold shadow-sm ${course.status === 'Ativo' ? 'bg-emerald-600' : course.status === 'Em breve' ? 'bg-amber-500' : 'bg-gray-500'}`}>
                            {course.status}
                          </span>
                        </div>

                        <div className="p-5 flex-grow flex flex-col space-y-3">
                          <h4 className="font-serif font-bold text-base text-brand-ink leading-tight">{course.title}</h4>
                          <p className="text-[10px] text-gray-400 line-clamp-3 leading-relaxed flex-grow">
                            {course.shortDescription || course.description || 'Nenhuma descrição cadastrada.'}
                          </p>

                          <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-[10px]">
                            <div>
                              <span className="block text-gray-400 text-[9px] uppercase tracking-wider">Instrutor</span>
                              <span className="font-bold text-brand-ink">{course.professor || 'Andrew Lemos'}</span>
                            </div>
                            <div className="text-right">
                              <span className="block text-gray-400 text-[9px] uppercase tracking-wider">Investimento</span>
                              <span className="font-mono font-bold text-brand-wood text-sm">R$ {course.price.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions footer */}
                        <div className="bg-gray-50 p-3.5 border-t flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setSelectedCourseForStructure(course);
                              setSelectedModuleForStructure(null);
                              setContentSubTab('syllabus');
                            }}
                            className="px-3 py-1.5 bg-brand-wood/10 hover:bg-brand-wood/20 text-brand-wood rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Montar Grade"
                          >
                            <Layers className="w-3.5 h-3.5" /> Grade
                          </button>
                          <button 
                            onClick={() => {
                              setEditingCourse(course);
                              setCourseForm({ ...course });
                              setShowCourseForm(true);
                            }}
                            className="px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-600 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Editar Metadados"
                          >
                            <Edit className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button 
                            onClick={() => handleDeleteCourse(course.id!)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all cursor-pointer"
                            title="Deletar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* SPACIOUS FULL-WIDTH COURSE FORM */
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-brand-wood/10 shadow-sm space-y-6">
                  <div className="flex justify-between items-center border-b pb-4">
                    <div>
                      <button 
                        onClick={() => setShowCourseForm(false)}
                        className="text-brand-wood hover:text-brand-ink font-bold flex items-center gap-1 transition-colors text-[10px] uppercase tracking-wider mb-1"
                      >
                        ← Voltar para a Vitrine
                      </button>
                      <h3 className="font-serif font-bold text-xl text-brand-ink">
                        {editingCourse ? `Editar Curso: ${editingCourse.title}` : 'Novo Curso de Artes & Ofícios'}
                      </h3>
                    </div>
                    <button 
                      onClick={() => setShowCourseForm(false)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveCourse} className="grid lg:grid-cols-12 gap-8 text-xs font-medium text-gray-600">
                    {/* Left fields column */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* Section 1: Identificação */}
                      <div className="space-y-4 bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
                        <h4 className="font-serif font-bold text-brand-wood text-sm border-b pb-1.5">1. Identificação Geral</h4>
                        
                        <div className="space-y-1">
                          <label className="text-gray-500 font-semibold">Título do Curso *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="Ex: Mestrado Prático em Escultura e Entalhe"
                            className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all text-xs"
                            value={courseForm.title}
                            onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-gray-500 font-semibold">Slug da URL (SEO) *</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: mestrado-escultura-entalhe"
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood font-mono text-[10px] outline-none transition-all"
                              value={courseForm.slug}
                              onChange={e => setCourseForm({ ...courseForm, slug: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-gray-500 font-semibold">Categoria / Especialidade *</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: Entalhe, Pintura, Desenho"
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all text-xs"
                              value={courseForm.category}
                              onChange={e => setCourseForm({ ...courseForm, category: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-gray-500 font-semibold">Professor / Mentor *</label>
                            <input 
                              type="text" 
                              required
                              disabled={!isMasterAdmin}
                              placeholder="Ex: Andrew Lemos"
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all text-xs disabled:bg-gray-50 disabled:text-gray-500"
                              value={isMasterAdmin ? (courseForm.professor || '') : (myProfile?.name || 'Instrutor')}
                              onChange={e => setCourseForm({ ...courseForm, professor: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-gray-500 font-semibold">Duração Estimada (Horas) *</label>
                            <input 
                              type="number" 
                              required
                              placeholder="Ex: 40"
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all font-mono"
                              value={courseForm.duration}
                              onChange={e => setCourseForm({ ...courseForm, duration: Number(e.target.value) })}
                            />
                          </div>
                        </div>

                        {isMasterAdmin && (
                          <div className="space-y-1">
                            <label className="text-gray-500 font-semibold">E-mail do Instrutor Associado (Acesso Exclusivo)</label>
                            <input 
                              type="email" 
                              placeholder="Ex: professor@exemplo.com"
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all text-xs"
                              value={courseForm.instructorEmail || 'andrewfmlemos@gmail.com'}
                              onChange={e => setCourseForm({ ...courseForm, instructorEmail: e.target.value })}
                            />
                          </div>
                        )}
                      </div>

                      {/* Section 2: Comercial */}
                      <div className="space-y-4 bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
                        <h4 className="font-serif font-bold text-brand-wood text-sm border-b pb-1.5">2. Comercial & Publicação</h4>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-gray-500 font-semibold">Preço do Curso (R$) *</label>
                            <input 
                              type="number" 
                              step="0.01"
                              required
                              placeholder="Ex: 297.00"
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all font-mono"
                              value={courseForm.price}
                              onChange={e => setCourseForm({ ...courseForm, price: Number(e.target.value) })}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-gray-500 font-semibold">Status de Publicação *</label>
                            <select 
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all text-xs"
                              value={courseForm.status}
                              onChange={e => setCourseForm({ ...courseForm, status: e.target.value as any })}
                            >
                              <option value="Ativo">Ativo (Visível na Vitrine)</option>
                              <option value="Em breve">Em Breve (Sem Vendas)</option>
                              <option value="Inativo">Inativo (Oculto)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-gray-500 font-semibold">Emitir Certificado? *</label>
                            <select 
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all text-xs"
                              value={courseForm.hasCertificate ? 'yes' : 'no'}
                              onChange={e => setCourseForm({ ...courseForm, hasCertificate: e.target.value === 'yes' })}
                            >
                              <option value="yes">Sim (Emissão automática)</option>
                              <option value="no">Não possui certificado</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-gray-500 font-semibold">Regra de Acesso Temporal *</label>
                            <select 
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all text-xs"
                              value={courseForm.accessibilityType}
                              onChange={e => setCourseForm({ ...courseForm, accessibilityType: e.target.value as any })}
                            >
                              <option value="lifetime">Vitalício (Acesso sem expiração)</option>
                              <option value="temporary">Temporário (Acesso por dias limitados)</option>
                              <option value="subscription">Assinatura Mensal/Anual</option>
                            </select>
                          </div>

                          {courseForm.accessibilityType === 'temporary' && (
                            <div className="space-y-1 animate-fade-in">
                              <label className="text-gray-500 font-semibold">Duração do Acesso (Dias) *</label>
                              <input 
                                type="number" 
                                required
                                placeholder="Ex: 365"
                                className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all font-mono"
                                value={courseForm.accessDurationDays}
                                onChange={e => setCourseForm({ ...courseForm, accessDurationDays: Number(e.target.value) })}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 3: Capa e SEO */}
                      <div className="space-y-4 bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
                        <h4 className="font-serif font-bold text-brand-wood text-sm border-b pb-1.5">3. Aparência & Otimização de Busca (SEO)</h4>
                        
                        <div className="space-y-1">
                          <label className="text-gray-500 font-semibold">Caminho da Imagem de Capa *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="Ex: /arquivos/Capa_curso_udemy_game.jpeg"
                            className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood font-mono text-[10px] outline-none transition-all"
                            value={courseForm.imageUrl}
                            onChange={e => setCourseForm({ ...courseForm, imageUrl: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-gray-500">Meta Title (SEO)</label>
                            <input 
                              type="text" 
                              placeholder="Título para aba do navegador e buscadores"
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all text-xs"
                              value={courseForm.metaTitle}
                              onChange={e => setCourseForm({ ...courseForm, metaTitle: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-gray-500">Meta Description (SEO)</label>
                            <input 
                              type="text" 
                              placeholder="Resumo sutil para indexação no Google"
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood outline-none transition-all text-xs"
                              value={courseForm.metaDescription}
                              onChange={e => setCourseForm({ ...courseForm, metaDescription: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Right description column */}
                    <div className="lg:col-span-5 flex flex-col space-y-6">
                      <div className="flex-grow flex flex-col bg-gray-50/50 p-5 rounded-2xl border border-gray-100 min-h-[400px]">
                        <h4 className="font-serif font-bold text-brand-wood text-sm border-b pb-1.5 mb-4">4. Ementa & Descrição do Curso</h4>
                        
                        <div className="flex-grow flex flex-col space-y-4">
                          <div className="space-y-1">
                            <label className="text-gray-500 font-semibold block">Descrição Resumida *</label>
                            <p className="text-[10px] text-gray-400">Texto conciso de 1-2 frases que aparecerá no card do curso na página inicial/vitrine.</p>
                            <textarea 
                              required
                              rows={2}
                              placeholder="Ex: Aprenda as principais técnicas de entalhe em madeira com formão e crie peças esculpidas incríveis!"
                              className="w-full p-3 rounded-xl border bg-white focus:border-brand-wood resize-none font-sans text-xs leading-relaxed outline-none transition-all h-20"
                              value={courseForm.shortDescription || ''}
                              onChange={e => setCourseForm({ ...courseForm, shortDescription: e.target.value })}
                            ></textarea>
                          </div>

                          <div className="space-y-1 flex-grow flex flex-col">
                            <label className="text-gray-500 font-semibold block">Texto Descritivo Completo (Suporta Markdown) *</label>
                            <textarea 
                              required
                              placeholder="Descreva a ementa do curso, as ferramentas necessárias, público-alvo, etc. Você pode utilizar negritos, listas, e títulos em Markdown!"
                              className="w-full flex-grow p-3 rounded-xl border bg-white focus:border-brand-wood resize-none font-sans text-xs leading-relaxed outline-none transition-all min-h-[120px]"
                              value={courseForm.description}
                              onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                            ></textarea>
                          </div>

                          {/* Dynamic live Markdown preview box */}
                          <div className="border border-brand-wood/10 rounded-xl overflow-hidden bg-white flex flex-col h-[200px]">
                            <div className="bg-brand-wood/10 px-3.5 py-1.5 text-brand-wood font-bold text-[10px] uppercase tracking-wider flex items-center justify-between border-b">
                              <span>Visualização em Tempo Real (Markdown)</span>
                              <span className="text-[8px] bg-brand-wood text-white px-1.5 py-0.5 rounded-full">Prose</span>
                            </div>
                            <div className="p-4 overflow-y-auto flex-grow text-xs leading-relaxed text-gray-700 bg-brand-paper/10 whitespace-pre-wrap font-sans prose prose-stone max-w-none">
                              <MarkdownRenderer content={courseForm.description || '_Comece a escrever acima para ver o texto estruturado aqui..._'} variant="blog" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex gap-3 bg-gray-50 p-4 rounded-2xl border">
                        <button 
                          type="submit"
                          className="flex-grow py-3 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                        >
                          {editingCourse ? 'Salvar Detalhes do Curso 💾' : 'Publicar Novo Curso 🚀'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setShowCourseForm(false)}
                          className="px-5 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* SUBTAB CONTENT: SYLLABUS BUILDER */}
          {contentSubTab === 'syllabus' && (
            <div className="grid lg:grid-cols-12 gap-8">
              
              {/* Left Selector & Modules list */}
              <div className="lg:col-span-5 space-y-6 text-xs text-gray-500 font-medium">
                <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs space-y-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-brand-ink flex items-center gap-1.5">
                      <Layers className="w-5 h-5 text-brand-wood" /> Grade de Módulos
                    </h3>
                    <p className="text-gray-400 text-[10px] mt-0.5">Defina a estrutura capitular do seu curso selecionado abaixo.</p>
                  </div>

                  {/* Course Dropdown Picker */}
                  <div className="space-y-1">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Selecionar Curso</label>
                    <select 
                      className="w-full p-2.5 rounded-xl border bg-gray-50 text-xs font-semibold text-brand-ink outline-none"
                      value={selectedCourseForStructure?.id || ''}
                      onChange={(e) => {
                        const matched = courses.find(c => c.id === e.target.value);
                        setSelectedCourseForStructure(matched || null);
                        setSelectedModuleForStructure(null);
                      }}
                    >
                      <option value="">-- Escolha um Curso --</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Module Cards */}
                  {selectedCourseForStructure && (
                    <div className="space-y-3 pt-3 border-t">
                      <h4 className="font-bold text-[10px] text-brand-wood uppercase tracking-wider flex items-center gap-1">
                        <Layers2 className="w-4 h-4" /> Módulos Cadastrados
                      </h4>
                      
                      <div className="space-y-2">
                        {modules.filter(m => m.courseId === selectedCourseForStructure.id).map((mod) => {
                          const isCurrentMod = selectedModuleForStructure?.id === mod.id;
                          return (
                            <div 
                              key={mod.id} 
                              onClick={() => setSelectedModuleForStructure(mod)}
                              className={`p-3.5 border rounded-xl cursor-pointer transition-all flex justify-between items-center ${isCurrentMod ? 'bg-brand-wood/5 border-brand-wood shadow-xs font-bold' : 'bg-gray-50/50 hover:bg-gray-50'}`}
                            >
                              <div>
                                <div className="text-brand-ink font-bold">Módulo {mod.order}: {mod.title}</div>
                                <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[200px]">{mod.description || 'Sem descrição'}</div>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteModule(mod.id!); }}
                                className="p-1.5 text-red-400 hover:text-red-600 rounded-lg transition-colors hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                        {modules.filter(m => m.courseId === selectedCourseForStructure.id).length === 0 && (
                          <p className="text-[10px] text-gray-400 italic py-2">Nenhum módulo cadastrado ainda.</p>
                        )}
                      </div>

                      {/* Add Module form */}
                      <form onSubmit={handleAddModule} className="p-4 border border-dashed rounded-2xl bg-brand-paper/20 space-y-3 mt-4">
                        <h5 className="font-bold text-[10px] text-brand-wood uppercase tracking-wider">Criar Novo Módulo</h5>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2 space-y-1">
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: Ferramentas Básicas"
                              className="w-full p-2 rounded-lg border bg-white text-xs"
                              value={moduleForm.title}
                              onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <input 
                              type="number" 
                              required
                              placeholder="Ordem"
                              className="w-full p-2 rounded-lg border bg-white font-mono text-xs text-center"
                              value={moduleForm.order}
                              onChange={e => setModuleForm({ ...moduleForm, order: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                        <input 
                          type="text"
                          placeholder="Resumo das lições do módulo..."
                          className="w-full p-2 rounded-lg border bg-white text-xs"
                          value={moduleForm.description}
                          onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })}
                        />
                        <button 
                          type="submit"
                          className="w-full py-2 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-lg text-[10px] transition-colors"
                        >
                          Adicionar Módulo
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side Lessons & Materials */}
              <div className="lg:col-span-7 space-y-6 text-xs text-gray-500 font-medium">
                {selectedCourseForStructure ? (
                  selectedModuleForStructure ? (
                    <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs space-y-6">
                      <div className="border-b pb-4 flex justify-between items-center">
                        <div>
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Módulo Selecionado</span>
                          <h3 className="font-serif font-bold text-lg text-brand-ink">Módulo {selectedModuleForStructure.order}: {selectedModuleForStructure.title}</h3>
                        </div>
                        <span className="text-[10px] bg-brand-wood/10 text-brand-wood px-2.5 py-1 rounded-full font-bold">
                          {lessons.filter(l => l.moduleId === selectedModuleForStructure.id).length} Aulas
                        </span>
                      </div>

                      {/* Lessons list */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-[10px] text-brand-wood uppercase tracking-wider flex items-center gap-1">
                          <Play className="w-4 h-4" /> Aulas Publicadas neste Módulo
                        </h4>

                        <div className="space-y-2">
                          {lessons.filter(l => l.moduleId === selectedModuleForStructure.id).map((les, lIdx) => (
                            <div key={les.id} className="p-3.5 border rounded-xl bg-gray-50/50 flex justify-between items-start gap-4 hover:bg-gray-50 transition-colors">
                              <div className="truncate">
                                <span className="font-bold text-brand-ink block text-xs truncate">Aula {les.order || (lIdx + 1)}: {les.title}</span>
                                <div className="text-[9px] text-gray-400 font-mono mt-0.5 truncate max-w-[400px]">
                                  {les.videoUrl ? `Vídeo: ${les.videoUrl}` : 'Sem Vídeo (Apenas Teórica)'} • {les.materials?.length || 0} Apostilas
                                </div>
                              </div>
                              <button 
                                onClick={() => handleDeleteLesson(les.id!)}
                                className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {lessons.filter(l => l.moduleId === selectedModuleForStructure.id).length === 0 && (
                            <p className="text-[10px] text-gray-400 italic">Nenhuma aula cadastrada neste módulo ainda.</p>
                          )}
                        </div>
                      </div>

                      {/* Form to add lesson */}
                      <form onSubmit={handleAddLesson} className="p-5 border rounded-2xl bg-gray-50/50 space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                          <h5 className="font-bold text-[10px] text-brand-wood uppercase tracking-wider">Publicar Nova Aula</h5>
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Suporta Apostila Teórica</span>
                        </div>
                        
                        <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-xl text-[10px] text-amber-900 leading-relaxed space-y-1">
                          <p>📚 <strong>Como cadastrar apostilas ou lições teóricas:</strong> Se esta aula for focada em disponibilizar manuais, e-books ou arquivos PDF (sem vídeo), você pode deixar o campo do link de vídeo em branco e anexar os arquivos diretamente no painel "Apostilas e Manuais Blindados" abaixo. O sistema ativará automaticamente o modo de leitura protegida no portal do aluno!</p>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3">
                          <div className="col-span-3 space-y-1">
                            <label className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Título da Aula *</label>
                            <input 
                              type="text" 
                              required
                              placeholder="Ex: Pegada Correta no Formão de Canto"
                              className="w-full p-2.5 rounded-lg border bg-white text-xs outline-none focus:border-brand-wood"
                              value={lessonForm.title}
                              onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-gray-400 uppercase tracking-widest font-bold block text-center">Ordem *</label>
                            <input 
                              type="number" 
                              required
                              placeholder="Nº"
                              className="w-full p-2.5 rounded-lg border bg-white font-mono text-xs text-center outline-none focus:border-brand-wood"
                              value={lessonForm.order}
                              onChange={e => setLessonForm({ ...lessonForm, order: Number(e.target.value) })}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Link de Incorporação de Vídeo (Vimeo/YouTube) <span className="text-gray-400 font-normal">(Opcional se houver Apostila)</span></label>
                          <input 
                            type="text" 
                            placeholder="Ex: https://player.vimeo.com/video/1234567"
                            className="w-full p-2.5 rounded-lg border bg-white font-mono text-xs outline-none focus:border-brand-wood"
                            value={lessonForm.videoUrl}
                            onChange={e => setLessonForm({ ...lessonForm, videoUrl: e.target.value })}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Conteúdo Escrito ou Instruções (Markdown) <span className="text-gray-400 font-normal">(Opcional)</span></label>
                          <textarea 
                            rows={3}
                            placeholder="Resumo teórico, dicas de segurança ou instruções da lição..."
                            className="w-full p-2.5 rounded-lg border bg-white text-xs outline-none focus:border-brand-wood resize-none leading-relaxed"
                            value={lessonForm.description}
                            onChange={e => setLessonForm({ ...lessonForm, description: e.target.value })}
                          ></textarea>
                        </div>

                        {/* Protected complementary materials */}
                        <div className="p-4 border rounded-xl bg-white space-y-3">
                          <h6 className="font-bold text-[10px] text-brand-wood uppercase tracking-wider flex items-center gap-1">
                            <FileText className="w-4 h-4" /> Apostilas e Manuais Blindados (Anti-Cópia)
                          </h6>
                          
                          <div className="space-y-2">
                            {lessonMaterials.map((m, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[10px] bg-gray-50 p-2 rounded-lg border font-medium">
                                <span className="font-bold text-gray-600 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5 text-emerald-500" /> {m.name} ({m.type.toUpperCase()})
                                </span>
                                <button 
                                  type="button"
                                  onClick={() => setLessonMaterials(lessonMaterials.filter((_, i) => i !== idx))}
                                  className="text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-dashed">
                            <input 
                              type="text" 
                              placeholder="Nome do PDF (Ex: Manual Técnico)"
                              className="p-2 border rounded-lg text-xs"
                              value={materialForm.name}
                              onChange={e => setMaterialForm({ ...materialForm, name: e.target.value })}
                            />
                            <input 
                              type="text" 
                              placeholder="Caminho do arquivo (Ex: /pdf/manual.pdf)"
                              className="p-2 border rounded-lg text-xs font-mono"
                              value={materialForm.url}
                              onChange={e => setMaterialForm({ ...materialForm, url: e.target.value })}
                            />
                            <button 
                              type="button"
                              onClick={handleAddMaterial}
                              className="px-3 py-2 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-lg text-[10px] transition-colors"
                            >
                              Anexar Apostila
                            </button>
                          </div>
                        </div>

                        <button 
                          type="submit"
                          className="w-full py-3 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-xl text-xs transition-colors shadow-md"
                        >
                          Publicar Nova Aula no Módulo
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="bg-white p-12 rounded-3xl border border-brand-wood/10 text-center max-w-md mx-auto">
                      <Layers className="w-8 h-8 text-brand-wood/40 mx-auto mb-3" />
                      <h4 className="font-serif font-bold text-brand-ink text-sm">Selecione um Módulo</h4>
                      <p className="text-gray-400 text-[10px] leading-relaxed mt-1">Clique em um dos módulos na lista lateral para visualizar suas aulas, reordenar vídeos e anexar as apostilas protegidas anti-download.</p>
                    </div>
                  )
                ) : (
                  <div className="bg-white p-12 rounded-3xl border border-brand-wood/10 text-center max-w-md mx-auto">
                    <BookOpen className="w-8 h-8 text-brand-wood/40 mx-auto mb-3" />
                    <h4 className="font-serif font-bold text-brand-ink text-sm">Organizar Grade Curricular</h4>
                    <p className="text-gray-400 text-[10px] leading-relaxed mt-1">Selecione um curso na lista lateral para cadastrar os módulos de aprendizado, ordenar as videoaulas e anexar as apostilas protegidas.</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN SUBTAB 2: ENROLLMENTS & MATRÍCULAS                             */}
      {/* ==================================================================== */}
      {activeAdminTab === 'enrollments' && (
        <div className="grid lg:grid-cols-12 gap-8 text-xs font-medium text-gray-600">
          
          {/* Manual Enrollment Trigger */}
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs h-fit">
            <h3 className="font-serif font-bold text-lg text-brand-ink mb-1">Matricular Aluno Manualmente</h3>
            <p className="text-gray-400 text-[10px] mb-4">Adicione acesso imediato a cursos para compras offline, bolsas ou permutas.</p>

            <form onSubmit={handleCreateManualEnrollment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-gray-500">Curso Vinculado</label>
                <select 
                  className="w-full p-2.5 rounded-xl border bg-gray-50 text-xs"
                  value={manualEnroll.courseId}
                  onChange={e => setManualEnroll({ ...manualEnroll, courseId: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-500">E-mail do Aluno *</label>
                <input 
                  type="email" 
                  required
                  placeholder="estudante@gmail.com"
                  className="w-full p-2.5 rounded-xl border bg-gray-50"
                  value={manualEnroll.userEmail}
                  onChange={e => setManualEnroll({ ...manualEnroll, userEmail: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-500">Nome do Aluno (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Nome Completo"
                  className="w-full p-2.5 rounded-xl border bg-gray-50"
                  value={manualEnroll.userName}
                  onChange={e => setManualEnroll({ ...manualEnroll, userName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-500">Validade</label>
                  <select 
                    className="w-full p-2.5 rounded-xl border bg-gray-50 text-[10px]"
                    value={manualEnroll.accessType}
                    onChange={e => setManualEnroll({ ...manualEnroll, accessType: e.target.value as any })}
                  >
                    <option value="lifetime">Vitalício</option>
                    <option value="temporary">Temporário</option>
                    <option value="subscription">Assinatura</option>
                  </select>
                </div>
                {manualEnroll.accessType === 'temporary' && (
                  <div className="space-y-1">
                    <label className="text-gray-500">Dias de Acesso</label>
                    <input 
                      type="number" 
                      className="w-full p-2.5 rounded-xl border bg-gray-50 font-mono"
                      value={manualEnroll.durationDays}
                      onChange={e => setManualEnroll({ ...manualEnroll, durationDays: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              <button 
                type="submit"
                className="w-full py-3 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-xl shadow-md"
              >
                Ativar Matrícula do Aluno
              </button>
            </form>
          </div>

          {/* List of current registrations */}
          <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
            <h3 className="font-serif font-bold text-lg text-brand-ink mb-1">Matrículas Ativas no Sistema</h3>
            <p className="text-gray-400 text-[10px] mb-4">Gerencie as inscrições, suspenda ou cancele acessos respeitando o prazo legal de 7 dias.</p>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {enrollments.map((enroll) => (
                <div key={enroll.id} className="p-4 border rounded-2xl bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="font-serif font-bold text-brand-ink text-sm">{enroll.courseTitle}</div>
                    <div className="text-[10px] text-gray-500 mt-1 font-mono">
                      {enroll.userName} ({enroll.userEmail}) • ID: {enroll.id}
                    </div>
                    <div className="text-[10px] text-brand-wood font-semibold mt-0.5">
                      Acesso: {enroll.accessType} {enroll.expiresAt && `(Expira: ${new Date(enroll.expiresAt).toLocaleDateString('pt-BR')})`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase ${enroll.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {enroll.status}
                    </span>
                    
                    {enroll.status === 'active' ? (
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => handleUpdateEnrollmentStatus(enroll.id!, 'canceled')}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[9px] font-bold"
                          title="Estornar / Cancelar Acesso"
                        >
                          Cancelar / Reembolsar
                        </button>
                        <button 
                          onClick={() => handleUpdateEnrollmentStatus(enroll.id!, 'dropout')}
                          className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-[9px] font-bold"
                          title="Marcar como evasão"
                        >
                          Evasão
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleUpdateEnrollmentStatus(enroll.id!, 'active')}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-[9px] font-bold"
                      >
                        Reativar Vaga
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {enrollments.length === 0 && (
                <p className="text-center py-12 text-gray-400">Nenhuma matrícula registrada na Academia de Artes.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN SUBTAB 3: MESSAGES & ARTWORK SUBMISSIONS                       */}
      {/* ==================================================================== */}
      {activeAdminTab === 'messages' && (
        <div className="grid lg:grid-cols-12 gap-8 text-xs font-medium text-gray-600">
          
          {/* Tickets inbox list */}
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
            <h3 className="font-serif font-bold text-lg text-brand-ink mb-4 flex items-center gap-1.5">📥 Caixa de Entrada do Ateliê</h3>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {supportMessages.filter(m => m.senderId !== 'admin').map((msg) => (
                <div 
                  key={msg.id} 
                  onClick={() => setRespondingMessage(msg)}
                  className={`p-3.5 border rounded-xl cursor-pointer transition-all flex items-start gap-3 justify-between ${respondingMessage?.id === msg.id ? 'bg-brand-wood/5 border-brand-wood' : 'bg-gray-50/50 hover:bg-gray-50'}`}
                >
                  <div className="truncate pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-ink truncate">{msg.senderName}</span>
                      {!msg.read && <span className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0" />}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5 font-mono truncate">{msg.subject}</div>
                    {msg.courseTitle && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mt-1 inline-block truncate">{msg.courseTitle}</span>}
                  </div>
                  {msg.imageUrl && (
                    <div className="w-10 h-10 rounded overflow-hidden border flex-shrink-0 bg-gray-100">
                      <img src={ensureRobustUrl(msg.imageUrl)} className="w-full h-full object-cover" alt="" />
                    </div>
                  )}
                </div>
              ))}
              {supportMessages.filter(m => m.senderId !== 'admin').length === 0 && (
                <p className="text-center py-12 text-gray-400">Nenhuma dúvida de aluno pendente.</p>
              )}
            </div>
          </div>

          {/* Detailed Response Area */}
          <div className="lg:col-span-7 space-y-6">
            {respondingMessage ? (
              <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs space-y-6">
                <div className="border-b pb-4">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Mensagem Enviada por</div>
                  <h4 className="font-serif font-bold text-xl text-brand-ink leading-tight">{respondingMessage.senderName} ({respondingMessage.senderEmail})</h4>
                  <div className="text-[10px] text-gray-400 font-mono mt-1">Data de Envio: {respondingMessage.createdAt?.toDate ? respondingMessage.createdAt.toDate().toLocaleString('pt-BR') : new Date(respondingMessage.createdAt).toLocaleString()}</div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border space-y-3">
                  <div className="font-bold text-sm text-brand-wood">{respondingMessage.subject}</div>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{respondingMessage.content}</p>
                  
                  {respondingMessage.imageUrl && (
                    <div className="border rounded-xl overflow-hidden bg-white p-2">
                      <div className="text-[9px] text-gray-400 font-bold uppercase mb-1">Trabalho Anexado pelo Aluno:</div>
                      <img src={ensureRobustUrl(respondingMessage.imageUrl)} className="max-h-72 object-contain mx-auto" alt="Submetido" />
                    </div>
                  )}
                </div>

                {/* Response Composer */}
                <form onSubmit={handleSendSupportReply} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-gray-500 ml-1">Responder como Mestre Andrew Lemos</label>
                    <textarea 
                      rows={4} 
                      required
                      placeholder="Escreva sua orientação artística, faça correções sobre a volumetria, sombras ou uso da ferramenta..."
                      className="w-full p-3 rounded-xl border bg-gray-50 resize-none leading-relaxed text-xs"
                      value={adminReplyText}
                      onChange={e => setAdminReplyText(e.target.value)}
                    ></textarea>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3.5 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5"
                  >
                    Enviar Orientação <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-brand-paper/30 border border-dashed p-16 rounded-[2.5rem] text-center max-w-md mx-auto">
                <MessageSquare className="w-10 h-10 text-brand-wood/40 mx-auto mb-3" />
                <h4 className="font-serif font-bold text-brand-ink">Central de Mentoria de Artes</h4>
                <p className="text-gray-400 text-[10px] leading-relaxed mt-1">Clique em uma mensagem recebida na lista à esquerda para analisar dúvidas de técnica de entalhe e inspecionar fotos de projetos de escultura dos alunos.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN SUBTAB 4: COMMENTS MODERATION                                 */}
      {/* ==================================================================== */}
      {activeAdminTab === 'comments' && (
        <div className="grid lg:grid-cols-12 gap-8 text-xs font-medium text-gray-600">
          
          {/* Feed of comments in classroom */}
          <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
            <h3 className="font-serif font-bold text-lg text-brand-ink mb-1">Moderação de Dúvidas das Aulas</h3>
            <p className="text-gray-400 text-[10px] mb-4">Analise, apague ou responda comentários de alunos feitos sob os vídeos.</p>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {comments.map((comment) => {
                const course = courses.find(c => c.id === comment.courseId);
                const lesson = lessons.find(l => l.id === comment.lessonId);
                return (
                  <div key={comment.id} className="p-3.5 border rounded-xl bg-gray-50/50 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-brand-ink">{comment.userName}</div>
                        <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                          {comment.createdAt?.toDate ? comment.createdAt.toDate().toLocaleString('pt-BR') : new Date(comment.createdAt).toLocaleString()}
                        </div>
                        {course && lesson && (
                          <div className="text-[9px] bg-brand-wood/10 text-brand-wood px-1.5 py-0.5 rounded mt-1 inline-block">
                            {course.title} • {lesson.title}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setRespondingComment(comment)}
                          className="px-2 py-1 bg-brand-wood text-white rounded-lg text-[9px] font-bold"
                        >
                          Responder
                        </button>
                        <button 
                          onClick={async () => {
                            if (window.confirm("Deseja deletar este comentário?")) {
                              await deleteDoc(doc(db, 'lms_comments', comment.id!));
                            }
                          }}
                          className="p-1 bg-red-50 text-red-600 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-gray-700 text-xs leading-relaxed">{comment.text}</p>
                  </div>
                );
              })}
              {comments.length === 0 && (
                <p className="text-center py-12 text-gray-400">Nenhum comentário registrado sob as aulas.</p>
              )}
            </div>
          </div>

          {/* Quick Reply Form to comments */}
          <div className="lg:col-span-6">
            {respondingComment ? (
              <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs space-y-4">
                <div className="border-b pb-3">
                  <h4 className="font-serif font-bold text-sm text-brand-ink">Respondendo Dúvida de {respondingComment.userName}</h4>
                  <p className="text-[10px] text-gray-400 italic mt-1">"{respondingComment.text}"</p>
                </div>

                <form onSubmit={handlePostCommentReply} className="space-y-3">
                  <textarea 
                    rows={4}
                    required
                    placeholder="Sua resposta de mestre que será visível para todos os matriculados..."
                    className="w-full p-3 rounded-xl border bg-gray-50 resize-none text-xs"
                    value={adminCommentReplyText}
                    onChange={e => setAdminCommentReplyText(e.target.value)}
                  ></textarea>

                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      className="flex-grow py-2.5 bg-brand-wood text-white font-bold rounded-lg"
                    >
                      Postar Resposta Pública
                    </button>
                    <button 
                      type="button"
                      onClick={() => setRespondingComment(null)}
                      className="px-4 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-brand-paper/30 border border-dashed p-16 rounded-[2.5rem] text-center max-w-sm mx-auto">
                <MessageSquare className="w-10 h-10 text-brand-wood/40 mx-auto mb-3" />
                <h4 className="font-serif font-bold text-brand-ink">Respostas Rápidas</h4>
                <p className="text-gray-400 text-[10px] mt-1">Dúvidas rápidas sob as aulas aparecem aqui. Responda para fomentar o debate artístico.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN SUBTAB 5: AFFILIATES APPROVALS & REVENUE SPLIT                 */}
      {/* ==================================================================== */}
      {activeAdminTab === 'affiliates' && (
        <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs text-xs font-medium text-gray-600">
          <h3 className="font-serif font-bold text-lg text-brand-ink mb-1">Gerenciamento do Canal de Afiliados</h3>
          <p className="text-gray-400 text-[10px] mb-6">Acompanhe cliques de indicação, vendas e defina comissões de repasse.</p>

          {/* Configuração de Porcentagem de Comissão de Afiliados */}
          <div className="mb-8 p-6 bg-stone-50 rounded-2xl border border-stone-200">
            <h4 className="font-serif font-bold text-sm text-brand-ink mb-1">Comissão Padrão de Afiliados (%)</h4>
            <p className="text-[10px] text-gray-500 mb-4">
              Defina a porcentagem do valor do curso vendido que será destinada à comissão dos afiliados. A nova porcentagem será aplicada a todas as vendas futuras referenciadas.
            </p>
            <div className="flex items-center gap-3 max-w-sm">
              <div className="relative flex-grow">
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  className="w-full p-2.5 pr-8 rounded-xl border bg-white text-gray-800 font-bold outline-none focus:border-brand-wood"
                  value={globalCommissionPercent}
                  onChange={(e) => setGlobalCommissionPercent(Number(e.target.value))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
              </div>
              <button
                onClick={() => handleSaveAffiliateSettings(globalCommissionPercent)}
                className="px-5 py-2.5 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Salvar Porcentagem
              </button>
            </div>
          </div>

          <h4 className="font-serif font-bold text-sm text-brand-ink mb-4">Parceiros Afiliados Registrados</h4>
          <div className="space-y-3">
            {affiliates.map((aff) => (
              <div key={aff.id} className="p-4 border rounded-2xl bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="font-bold text-brand-ink text-sm">{aff.name} ({aff.email})</div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Código de Indicação: <span className="font-mono font-bold text-brand-wood bg-brand-wood/10 px-2 py-0.5 rounded">{aff.code}</span> • Status: {aff.status}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 font-mono">
                    Cliques: {aff.clicks || 0} • Conversões: {aff.salesCount || 0} • Comissões Acumuladas: <span className="text-emerald-600 font-bold">R$ {(aff.totalCommission || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {aff.status === 'Pendente' ? (
                    <button 
                      onClick={() => handleUpdateAffiliateStatus(aff.id, 'Ativo')}
                      className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-[10px]"
                    >
                      Aprovar Afiliado
                    </button>
                  ) : aff.status === 'Ativo' ? (
                    <button 
                      onClick={() => handleUpdateAffiliateStatus(aff.id, 'Inativo')}
                      className="px-3 py-1.5 bg-red-50 text-red-600 font-bold rounded-lg text-[10px]"
                    >
                      Suspender Canal
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleUpdateAffiliateStatus(aff.id, 'Ativo')}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-600 font-bold rounded-lg text-[10px]"
                    >
                      Reativar Canal
                    </button>
                  )}
                </div>
              </div>
            ))}
            {affiliates.length === 0 && (
              <p className="text-center py-12 text-gray-400">Nenhum parceiro inscrito no programa de afiliados ainda.</p>
            )}
          </div>

          {/* Histórico de Comissões e Status de Liberação (10 Dias) */}
          <div className="mt-10 border-t border-brand-wood/10 pt-8">
            <h3 className="font-serif font-bold text-base text-brand-ink mb-1">Vendas Referenciadas e Crédito de Comissões</h3>
            <p className="text-gray-400 text-[10px] mb-4">
              As comissões são creditadas na conta do parceiro após 10 dias da compra, contanto que não tenha ocorrido desistência ou cancelamento da matrícula pelo comprador.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-500 font-medium min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Afiliado</th>
                    <th className="py-2.5 px-3">Comprador / Curso</th>
                    <th className="py-2.5 px-3">Preço / Comissão</th>
                    <th className="py-2.5 px-3">Data Compra</th>
                    <th className="py-2.5 px-3">Matrícula (Status)</th>
                    <th className="py-2.5 px-3 text-right">Comissão (Status)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allCommissions.map((com) => {
                    const created = com.createdAt?.toDate ? com.createdAt.toDate() : (com.createdAt ? new Date(com.createdAt) : new Date());
                    const daysDiff = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
                    const matchedEnroll = allEnrollments.find(e => e.id === com.enrollmentId);
                    const enrollStatus = matchedEnroll ? matchedEnroll.status : 'active';
                    
                    let statusLabel = "";
                    let statusClass = "";
                    let remainingText = "";

                    if (enrollStatus === 'canceled' || enrollStatus === 'dropout') {
                      statusLabel = "Cancelada (Desistência)";
                      statusClass = "bg-red-50 text-red-600 border-red-100";
                    } else if (daysDiff >= 10) {
                      statusLabel = "Liberada / Creditada";
                      statusClass = "bg-emerald-50 text-emerald-600 border-emerald-100";
                    } else {
                      statusLabel = "Aguardando (Pendente)";
                      statusClass = "bg-amber-50 text-amber-600 border-amber-100";
                      const remaining = 10 - daysDiff;
                      remainingText = `${remaining} ${remaining === 1 ? 'dia restante' : 'dias restantes'}`;
                    }

                    return (
                      <tr key={com.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-3 font-semibold text-brand-ink">
                          <div>{com.affiliateName}</div>
                          <div className="text-[10px] text-brand-wood font-mono">{com.affiliateCode}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-gray-800 font-semibold truncate max-w-[150px]">{com.buyerEmail}</div>
                          <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{com.courseTitle}</div>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <div className="text-gray-700">R$ {Number(com.price || 0).toFixed(2)}</div>
                          <div className="text-[10px] text-emerald-600 font-semibold">R$ {Number(com.commissionAmount || 0).toFixed(2)} ({com.commissionPercent}%)</div>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-gray-400">
                          {created.toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${
                            enrollStatus === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
                          }`}>
                            {enrollStatus === 'active' ? 'Ativa' : enrollStatus === 'canceled' ? 'Cancelada' : 'Desistência'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold ${statusClass}`}>
                              {statusLabel}
                            </span>
                            {remainingText && (
                              <span className="text-[9px] text-amber-500 font-bold mt-1 animate-pulse">{remainingText}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {allCommissions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-400 text-xs">
                        Nenhuma venda por afiliação registrada no sistema ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN SUBTAB 6: COMMERCIAL REPORTS & METRICS                         */}
      {/* ==================================================================== */}
      {activeAdminTab === 'reports' && (
        <div className="space-y-8 text-xs font-medium text-gray-600">
          
          {/* Bento-grid stats metrics cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Inscrições Totais</div>
              <div className="text-3xl font-bold font-mono text-brand-ink">{enrollments.length} Alunos</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Cursos Oferecidos</div>
              <div className="text-3xl font-bold font-mono text-brand-ink">{courses.length} Categorias</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs bg-emerald-50/50">
              <div className="text-xs text-emerald-800 font-medium uppercase tracking-wider mb-1">Faturamento Estimado</div>
              <div className="text-3xl font-bold font-mono text-emerald-600">R$ {totalRevenue.toFixed(2)}</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Afiliados Parceiros</div>
              <div className="text-3xl font-bold font-mono text-brand-ink">{affiliates.length} Ativos</div>
            </div>
          </div>

          {/* List of top courses */}
          <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
            <h3 className="font-serif font-bold text-lg text-brand-ink mb-4 flex items-center gap-1.5"><TrendingUp className="w-5 h-5 text-brand-wood" /> Desempenho e Vendas por Curso</h3>
            
            <div className="space-y-3">
              {courses.map((course) => {
                const sales = enrollments.filter(e => e.courseId === course.id && e.status === 'active').length;
                const revenue = sales * course.price;
                return (
                  <div key={course.id} className="p-4 border rounded-xl bg-gray-50/50 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-brand-ink text-sm">{course.title}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Preço: R$ {course.price.toFixed(2)}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-brand-ink">{sales} Matrículas</div>
                      <div className="text-emerald-600 font-bold">R$ {revenue.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN SUBTAB 7: BROADCAST NOTIFICATIONS GENERATOR                   */}
      {/* ==================================================================== */}
      {activeAdminTab === 'notifications' && (
        <div className="grid lg:grid-cols-12 gap-8 text-xs font-medium text-gray-600">
          
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs h-fit">
            <h3 className="font-serif font-bold text-lg text-brand-ink mb-1">Transmitir Aviso para Alunos</h3>
            <p className="text-gray-400 text-[10px] mb-4">Comunique lançamento de novas aulas, agendamento de transmissões ao vivo ou manutenção do servidor.</p>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div className="space-y-1">
                <label className="text-gray-500">Destinatário</label>
                <select 
                  className="w-full p-2.5 rounded-xl border bg-gray-50 text-xs"
                  value={broadcastNotif.target}
                  onChange={e => setBroadcastNotif({ ...broadcastNotif, target: e.target.value as any })}
                >
                  <option value="all">Todos os Alunos Matriculados</option>
                  <option value="course">Alunos de um Curso Específico</option>
                </select>
              </div>

              {broadcastNotif.target === 'course' && (
                <div className="space-y-1">
                  <label className="text-gray-500">Curso Específico</label>
                  <select 
                    className="w-full p-2.5 rounded-xl border bg-gray-50 text-xs"
                    value={broadcastNotif.courseId}
                    onChange={e => setBroadcastNotif({ ...broadcastNotif, courseId: e.target.value })}
                    required
                  >
                    <option value="">Selecione o Curso...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-gray-500">Título do Aviso *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Novo módulo de afiação publicado!"
                  className="w-full p-2.5 rounded-xl border bg-gray-50"
                  value={broadcastNotif.title}
                  onChange={e => setBroadcastNotif({ ...broadcastNotif, title: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-500">Texto Curto do Aviso *</label>
                <textarea 
                  rows={4} 
                  required
                  placeholder="Seja direto e estimulante. Alunos verão o alerta no dashboard."
                  className="w-full p-2.5 rounded-xl border bg-gray-50 resize-none leading-relaxed text-xs"
                  value={broadcastNotif.message}
                  onChange={e => setBroadcastNotif({ ...broadcastNotif, message: e.target.value })}
                ></textarea>
              </div>

              <button 
                type="submit"
                className="w-full py-3.5 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5"
              >
                Transmitir Aviso <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs text-center">
            <Bell className="w-12 h-12 text-brand-wood/40 mx-auto mb-3" />
            <h4 className="font-serif font-bold text-brand-ink">Central de Alertas Gerais</h4>
            <p className="text-gray-400 text-[10px] max-w-sm mx-auto leading-relaxed mt-1">Disparos de notificações aparecem instantaneamente para os alunos ativos na plataforma. Utilize esta ferramenta com moderação.</p>
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN SUBTAB 8: INSTRUCTORS & PROFILE MANAGEMENT                      */}
      {/* ==================================================================== */}
      {activeAdminTab === 'instructors' && (
        <div className="grid lg:grid-cols-12 gap-8 text-xs font-medium text-gray-600 animate-fadeIn">
          {/* Col 1: My Profile (All Instructors & Master Admin) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
              <h3 className="font-serif font-bold text-lg text-brand-ink mb-1">Meu Perfil de Instrutor</h3>
              <p className="text-gray-400 text-[10px] mb-4">Edite os dados que serão exibidos como suas informações de instrutor nas Landing Pages dos seus cursos.</p>

              <form onSubmit={handleSaveMyProfile} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-gray-500 font-semibold">Meu E-mail (Identificador)</label>
                  <input 
                    type="email" 
                    disabled
                    className="w-full p-2.5 rounded-xl border bg-gray-50 text-gray-400 cursor-not-allowed font-mono"
                    value={currentUser?.email || ''}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-500 font-semibold">Nome de Exibição *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Seu nome artístico ou profissional"
                    className="w-full p-2.5 rounded-xl border bg-gray-50"
                    value={myProfileForm.name || ''}
                    onChange={e => setMyProfileForm({ ...myProfileForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-500 font-semibold">URL da Foto do Instrutor *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="URL direta para a foto do instrutor (ex: Google Drive, Imgur, Unsplash)"
                    className="w-full p-2.5 rounded-xl border bg-gray-50 font-mono"
                    value={myProfileForm.photoUrl || ''}
                    onChange={e => setMyProfileForm({ ...myProfileForm, photoUrl: e.target.value })}
                  />
                  <p className="text-[9px] text-gray-400">Coleque uma URL de imagem pública. Se usar Google Drive, certifique-se de que o link está configurado para "Qualquer pessoa com o link".</p>
                </div>

                {myProfileForm.photoUrl && (
                  <div className="mt-2 flex items-center gap-3 bg-brand-paper p-3 rounded-xl border border-brand-wood/10">
                    <img 
                      src={ensureRobustUrl(myProfileForm.photoUrl)} 
                      alt="Preview" 
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover border border-brand-wood/25"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150";
                      }}
                    />
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold">Prévia da Foto</span>
                      <span className="text-[9px] text-emerald-600">Visualização ativa</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-gray-500 font-semibold">Minha Biografia / Resumo *</label>
                  <textarea 
                    rows={4} 
                    required
                    placeholder="Escreva sobre sua história, especialidades e conquistas artísticas."
                    className="w-full p-2.5 rounded-xl border bg-gray-50 resize-none leading-relaxed text-xs"
                    value={myProfileForm.bio || ''}
                    onChange={e => setMyProfileForm({ ...myProfileForm, bio: e.target.value })}
                  ></textarea>
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Salvar Meu Perfil
                </button>
              </form>
            </div>
          </div>

          {/* Col 2: Register Other Instructors (Only Master Admin) */}
          <div className="lg:col-span-6 space-y-6">
            {isMasterAdmin ? (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-brand-ink">Cadastrar Novo Instrutor</h3>
                      <p className="text-gray-400 text-[10px]">Conceda permissões de instrutor para novas pessoas se conectarem e gerenciarem cursos próprios.</p>
                    </div>
                    <button 
                      onClick={() => setShowInstructorForm(!showInstructorForm)}
                      className="p-1.5 bg-brand-wood/10 hover:bg-brand-wood text-brand-wood hover:text-white rounded-lg transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {showInstructorForm && (
                    <form onSubmit={handleSaveInstructor} className="space-y-4 mb-6 p-4 bg-brand-paper rounded-2xl border border-brand-wood/10">
                      <div className="space-y-1">
                        <label className="text-gray-500 font-semibold">E-mail do Novo Instrutor *</label>
                        <input 
                          type="email" 
                          required
                          placeholder="Ex: joao@entalhe.com"
                          className="w-full p-2.5 rounded-xl border bg-white font-mono"
                          value={instructorForm.email || ''}
                          onChange={e => setInstructorForm({ ...instructorForm, email: e.target.value })}
                        />
                        <p className="text-[9px] text-gray-400">Este e-mail deve corresponder à conta que o instrutor usará para logar.</p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-gray-500 font-semibold">Nome do Instrutor *</label>
                        <input 
                          type="text" 
                          required
                          placeholder="Ex: João Silva"
                          className="w-full p-2.5 rounded-xl border bg-white"
                          value={instructorForm.name || ''}
                          onChange={e => setInstructorForm({ ...instructorForm, name: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-gray-500 font-semibold">URL da Foto (Opcional)</label>
                        <input 
                          type="text" 
                          placeholder="URL da foto de perfil"
                          className="w-full p-2.5 rounded-xl border bg-white font-mono"
                          value={instructorForm.photoUrl || ''}
                          onChange={e => setInstructorForm({ ...instructorForm, photoUrl: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-gray-500 font-semibold">Biografia / Resumo (Opcional)</label>
                        <textarea 
                          rows={3} 
                          placeholder="Breve currículo do instrutor."
                          className="w-full p-2.5 rounded-xl border bg-white resize-none text-xs"
                          value={instructorForm.bio || ''}
                          onChange={e => setInstructorForm({ ...instructorForm, bio: e.target.value })}
                        ></textarea>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          type="submit"
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          Confirmar Cadastro
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setShowInstructorForm(false);
                            setInstructorForm({ email: '', name: '', photoUrl: '', bio: '' });
                          }}
                          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    <h4 className="font-semibold text-brand-ink">Instrutores Registrados ({instructors.length})</h4>
                    <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto pr-1">
                      {instructors.map(inst => (
                        <div key={inst.email} className="py-2.5 flex items-center justify-between gap-3 text-left">
                          <div className="flex items-center gap-3">
                            <img 
                              src={ensureRobustUrl(inst.photoUrl)} 
                              alt={inst.name} 
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-brand-wood/15"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150";
                              }}
                            />
                            <div>
                              <span className="font-bold text-gray-800 text-xs block">{inst.name}</span>
                              <span className="text-[10px] text-gray-400 font-mono block">{inst.email}</span>
                            </div>
                          </div>
                          {inst.email !== 'andrewfmlemos@gmail.com' && (
                            <button 
                              onClick={() => handleDeleteInstructor(inst.email)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all cursor-pointer"
                              title="Remover Permissões"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      {instructors.length === 0 && (
                        <p className="text-center text-gray-400 py-6">Nenhum instrutor cadastrado além do administrador mestre.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-brand-paper p-6 rounded-3xl border border-brand-wood/10 shadow-xs text-center flex flex-col items-center justify-center min-h-[300px]">
                <Award className="w-12 h-12 text-brand-wood/30 mb-3" />
                <h4 className="font-serif font-bold text-brand-ink text-sm">Acesso de Instrutor Ativo</h4>
                <p className="text-gray-400 text-[10px] max-w-sm leading-relaxed mt-1">Sua conta está devidamente habilitada. Você tem permissão total para gerenciar seus próprios cursos, módulos e aulas na aba lateral.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ADMIN SUBTAB 9: APOSTILAS & E-BOOKS DIGITAL PRODUCTS MANAGEMENT       */}
      {/* ==================================================================== */}
      {activeAdminTab === 'ebooks' && (
        <div className="space-y-6 text-xs font-medium text-gray-600 animate-fadeIn">
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
            <div>
              <h3 className="font-serif font-bold text-xl text-brand-ink">Apostilas & E-books Digitais 📖</h3>
              <p className="text-gray-400 text-[10px] mt-0.5">Cadastre, edite e gerencie as apostilas vendidas como infoprodutos individuais que serão abertas apenas dentro do leitor seguro da plataforma.</p>
            </div>
            <button 
              onClick={() => {
                setEditingEbook(null);
                setEbookForm({
                  name: '',
                  description: '',
                  price: 49.90,
                  imageUrl: '',
                  digitalPdfUrl: '',
                  slug: ''
                });
                setShowEbookForm(!showEbookForm);
              }}
              className="px-4 py-2.5 bg-brand-wood hover:bg-brand-ink text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {showEbookForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showEbookForm ? 'Fechar Form' : 'Nova Apostila'}
            </button>
          </div>

          {/* Form for creation / editing */}
          {showEbookForm && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-sm space-y-4"
            >
              <h4 className="font-serif font-bold text-base text-brand-ink border-b pb-2">
                {editingEbook ? `Editar Apostila: ${editingEbook.name}` : 'Cadastrar Nova Apostila / E-book'}
              </h4>

              <form onSubmit={handleSaveEbook} className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-gray-500 font-semibold">Nome da Apostila *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Guia Completo de Entalhe de Rostos"
                    value={ebookForm.name}
                    onChange={e => setEbookForm({ ...ebookForm, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-gray-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-500 font-semibold">Preço de Venda (R$) *</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    min="0"
                    placeholder="49.90"
                    value={ebookForm.price}
                    onChange={e => setEbookForm({ ...ebookForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl border bg-gray-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-500 font-semibold">URL do PDF Seguro *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Link seguro do PDF no drive ou bucket (Ex: https://.../apostila.pdf)"
                    value={ebookForm.digitalPdfUrl}
                    onChange={e => setEbookForm({ ...ebookForm, digitalPdfUrl: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-gray-50 font-mono"
                  />
                  <p className="text-[9px] text-gray-400">Este PDF será carregado diretamente no leitor protegido da Área do Aluno, impedindo download direto.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-500 font-semibold">URL da Imagem da Capa (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="URL de imagem para a capa do infoproduto"
                    value={ebookForm.imageUrl}
                    onChange={e => setEbookForm({ ...ebookForm, imageUrl: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-gray-50 font-mono"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-gray-500 font-semibold">Slug da URL (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="ex: guia-entalhe-rosto (deixe vazio para gerar do título)"
                    value={ebookForm.slug}
                    onChange={e => setEbookForm({ ...ebookForm, slug: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-gray-50 font-mono"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-gray-500 font-semibold">Descrição / Conteúdo Programático</label>
                  <textarea 
                    rows={4} 
                    placeholder="Descreva detalhadamente o que o aluno vai aprender nesta apostila, quantidade de páginas, etc."
                    value={ebookForm.description}
                    onChange={e => setEbookForm({ ...ebookForm, description: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-gray-50 resize-none text-xs leading-relaxed"
                  ></textarea>
                </div>

                <div className="md:col-span-2 flex gap-3 pt-2">
                  <button 
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> {editingEbook ? 'Salvar Alterações' : 'Criar Infoproduto'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowEbookForm(false);
                      setEditingEbook(null);
                    }}
                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* List of current eBooks */}
          <div className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-xs">
            <h4 className="font-serif font-bold text-base text-brand-ink mb-4">Apostilas Cadastradas ({ebooks.length})</h4>
            
            {ebooks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-12 h-12 text-brand-wood/25 mx-auto mb-2" />
                <p className="font-semibold">Nenhuma apostila ou e-book cadastrado no momento.</p>
                <p className="text-[10px] mt-0.5 text-gray-400">Clique em "Nova Apostila" acima para cadastrar seu primeiro infoproduto.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ebooks.map((ebook) => {
                  const coverImg = ebook.images && ebook.images[0] ? ebook.images[0] : "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=600";
                  return (
                    <div key={ebook.id} className="bg-brand-paper/40 rounded-2xl border border-brand-wood/10 overflow-hidden flex flex-col p-4 space-y-3">
                      <div className="aspect-video w-full rounded-xl overflow-hidden bg-gray-900 relative">
                        <img 
                          src={ensureRobustUrl(coverImg)} 
                          alt={ebook.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=600";
                          }}
                        />
                        <span className="absolute top-2 right-2 px-2.5 py-1 bg-brand-wood text-white rounded-full text-[9px] font-bold">
                          R$ {ebook.price.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex-grow text-left">
                        <h5 className="font-serif font-bold text-brand-ink text-sm leading-tight line-clamp-1">{ebook.name}</h5>
                        <p className="text-gray-400 text-[10px] line-clamp-2 mt-1 leading-relaxed">{ebook.description || 'Sem descrição cadastrada.'}</p>
                        <div className="mt-2.5 pt-2 border-t border-brand-wood/5 flex flex-col gap-1">
                          <span className="text-[9px] text-gray-400 flex items-center gap-1 font-mono">
                            <span className="font-semibold text-gray-500">PDF:</span> 
                            <span className="text-brand-wood truncate max-w-[150px]">{ebook.digitalPdfUrl}</span>
                          </span>
                          <span className="text-[9px] text-gray-400 flex items-center gap-1 font-mono">
                            <span className="font-semibold text-gray-500">Slug:</span> {ebook.slug}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-brand-wood/5">
                        <button 
                          onClick={() => {
                            setEditingEbook(ebook);
                            setEbookForm({
                              name: ebook.name,
                              description: ebook.description || '',
                              price: ebook.price,
                              imageUrl: ebook.images && ebook.images[0] ? ebook.images[0] : '',
                              digitalPdfUrl: ebook.digitalPdfUrl || '',
                              slug: ebook.slug || ''
                            });
                            setShowEbookForm(true);
                          }}
                          className="flex-1 py-2 bg-brand-wood/10 hover:bg-brand-wood text-brand-wood hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button 
                          onClick={() => handleDeleteEbook(ebook.id!)}
                          className="px-3 py-2 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
  );
};
