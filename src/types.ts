export interface Product {
  id?: string;
  name: string;
  affiliateLink: string;
  imageUrl: string;
  category?: string;
  order?: number;
  createdAt: any;
}

export interface Arquivo {
  id?: string;
  title: string;
  category: string;
  img: string;
  order?: number;
  createdAt?: any;
  abouttext?: string;
  technique?: string;
  materials?: string;
  finish?: string;
  care?: string;
  dimensions?: string;
  year?: string;
  slug?: string;
}

export interface EcomProduct {
  id?: string;
  name: string;
  description: string;
  category: string;
  images: string[]; // multi image paths
  weight: number; // in kg
  height: number; // in cm
  width: number; // in cm
  length: number; // in cm
  stock: number;
  price: number;
  shippingType?: 'automatic' | 'quote';
  digitalPdfUrl?: string; // secure digital PDF URL for infoproduct eBooks/handouts
  createdAt?: any;
  slug?: string;
}

export interface CartItem extends EcomProduct {
  quantity: number;
}

export interface EcomOrder {
  id?: string;
  userId: string;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    cpf: string;
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    images: string[];
    weight: number;
    height: number;
    width: number;
    length: number;
  }[];
  shippingMethod: string;
  shippingServiceId?: string;
  shippingCost: number;
  subtotal: number;
  total: number;
  status: 'Aguardando pagamento' | 'Pago' | 'Separação' | 'Enviado' | 'Entregue' | 'Cancelado';
  refundedAmount?: number;
  refundStatus?: 'none' | 'partial' | 'total';
  refundNotes?: string;
  paymentId?: string;
  trackingCode?: string;
  melhorEnvioShipmentId?: string;
  melhorEnvioTrackingCode?: string;
  melhorEnvioStatus?: string;
  melhorEnvioStatusText?: string;
  melhorEnvioLabelUrl?: string;
  gateway?: string;
  gatewayError?: string;
  paymentUrl?: string;
  transparentPixCode?: string;
  transparentPixQrCodeBase64?: string;
  transparentBoletoBarcode?: string;
  transparentBoletoPdfUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface EcomCustomer {
  id?: string; // matches auth userId (uid)
  name: string;
  email: string;
  phone: string;
  cpf: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  complement: string;
  city: string;
  state: string;
  createdAt?: any;
}

export interface ShippingQuote {
  id?: string;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    cep: string;
    city: string;
    state: string;
    country: string;
  };
  productId: string;
  productName: string;
  productPrice: number;
  productImage?: string;
  quantity: number;
  notes?: string;
  status: 'Nova' | 'Em análise' | 'Respondida' | 'Finalizada';
  createdAt?: any;
  updatedAt?: any;
  response?: {
    shippingCost: number;
    carrier: string;
    deliveryTime: number;
    notes?: string;
    respondedAt?: any;
    paymentLinkGenerated?: boolean;
    orderId?: string;
  };
}

export interface PackagingSettings {
  extraHeight: number;
  extraWidth: number;
  extraLength: number;
  extraWeight: number;
}

export interface EcomReview {
  id?: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  comment: string;
  rating: number; // 1 to 5
  status: 'Pendente' | 'Aprovada' | 'Rejeitada';
  photoUrl?: string; // for future extension
  isFeatured?: boolean; // for future extension
  displayOrder?: number; // for future extension
  origem?: 'Pedido' | 'Manual';
  invitationId?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface EcomReviewInvitation {
  id?: string;
  customerName: string;
  customerEmail: string;
  status: 'Pendente' | 'Respondida';
  createdAt: any;
}

export interface EcomAbandonedCart {
  id?: string; // Cart ID stored in localStorage or generated
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    images: string[];
  }[];
  total: number;
  lastActive: string; // ISO Datetime format
  status: 'Ativo' | 'Abandonado' | 'Recuperado' | 'Expirado';
  sentMessages?: {
    type: 'msg_24h' | 'msg_48h' | 'msg_72h';
    sentAt: string; // ISO format
    couponCode?: string;
  }[];
  couponCode?: string | null;
  createdAt: string; // ISO format
  updatedAt?: any;
}

export interface EcomCoupon {
  id?: string; // Coupon code itself, e.g. "REC5-XXXX"
  code: string;
  discountPercent: number; // 5
  customerEmail: string;
  expiresAt: string; // ISO format
  used: boolean;
  cartId?: string;
  createdAt?: string;
}

export interface BlogPost {
  id?: string;
  title: string;
  slug: string;
  content: string;
  summary: string;
  imageUrl: string;
  published: boolean;
  publishedAt: any;
  createdAt: any;
  updatedAt?: any;
}

// ============================================================================
// LMS (E-learning Platform) Module Types
// ============================================================================

export interface Course {
  id?: string;
  title: string;
  description: string;
  shortDescription?: string;
  imageUrl: string;
  professor: string;
  category: string;
  price: number;
  status: 'Ativo' | 'Em breve' | 'Inativo';
  slug: string;
  metaTitle?: string;
  metaDescription?: string;
  duration?: number; // in hours
  hasCertificate: boolean;
  accessibilityType: 'lifetime' | 'subscription' | 'temporary';
  accessDurationDays?: number; // for temporary access
  instructorEmail?: string; // email of the course instructor
  createdAt?: any;
  updatedAt?: any;
}

export interface InstructorProfile {
  id?: string; // document id (typically email or uid)
  email: string;
  name: string;
  photoUrl: string;
  bio: string;
  createdAt?: any;
}

export interface CourseModule {
  id?: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
}

export interface LessonMaterial {
  name: string;
  url: string;
  type: 'pdf' | 'image' | 'link';
}

export interface Lesson {
  id?: string;
  courseId: string;
  moduleId: string;
  title: string;
  description: string;
  videoUrl: string; // Embed/streaming URL (e.g., YouTube, Vimeo)
  order: number;
  materials: LessonMaterial[];
  createdAt?: any;
}

export interface Enrollment {
  id?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  courseId: string;
  courseTitle: string;
  status: 'active' | 'expired' | 'canceled' | 'dropout';
  accessType: 'lifetime' | 'subscription' | 'temporary';
  expiresAt?: any; // Timestamp or ISO string
  createdAt?: any;
  updatedAt?: any;
}

export interface StudentProgress {
  id?: string; // composite key or auto
  userId: string;
  courseId: string;
  lessonId: string;
  completed: boolean;
  timeWatched?: number; // in seconds
  updatedAt: any;
}

export interface LessonCommentReply {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  text: string;
  createdAt: any;
  isAdmin?: boolean;
}

export interface LessonComment {
  id?: string;
  lessonId: string;
  courseId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  text: string;
  moderated: boolean;
  replies?: LessonCommentReply[];
  createdAt: any;
}

export interface SupportMessage {
  id?: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  receiverId: string; // 'admin' or specific userId
  courseId?: string;
  courseTitle?: string;
  subject: string;
  content: string;
  imageUrl?: string; // student's artwork submission
  read: boolean;
  createdAt: any;
}

export interface AffiliateProfile {
  id: string; // Matches auth userId
  email: string;
  name: string;
  code: string; // Referral tracking code
  commissionPercent: number;
  clicks: number;
  salesCount: number;
  totalCommission: number;
  status: 'Pendente' | 'Ativo' | 'Inativo';
  createdAt: any;
}

export interface AffiliateClick {
  id?: string;
  affiliateId: string;
  ip?: string;
  createdAt: any;
}

export interface CourseCertificate {
  id: string; // Unique validation code
  userId: string;
  userName: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  issuedAt: any;
}

export interface SystemNotification {
  id?: string;
  title: string;
  message: string;
  target: 'all' | 'course';
  courseId?: string;
  courseTitle?: string;
  createdAt: any;
}



