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

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'student';
  avatarUrl?: string;
  purchasedProducts: string[]; // List of course IDs and apostila IDs
  status?: 'active' | 'blocked';
}

export interface Course {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  coverUrl: string;
  category: string;
  price: number;
  freeModules: string[]; // List of module IDs that are available as free preview
  rating?: number;
  duration?: string;
  status?: 'ativo' | 'breve' | 'desativado';
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  coverUrl?: string;
  order: number;
}

export interface Material {
  id: string;
  name: string;
  url: string;
  size: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl?: string;
  textContent?: string;
  materials?: Material[];
  downloadFiles?: Material[];
  order: number;
  duration?: string;
  quiz?: QuizQuestion[];
}

export interface Apostila {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  coverUrl: string;
  price: number;
  chapters: {
    id: string;
    title: string;
    content: string; // HTML or Markdown
  }[];
  status?: 'ativo' | 'breve' | 'desativado';
}

export interface Sale {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  productId: string;
  productTitle: string;
  productType: 'course' | 'apostila';
  pricePaid: number;
  couponUsed?: string;
  paymentMethod: 'credit_card' | 'pix' | 'boleto' | 'manual' | 'mercadopago';
  paymentStatus: 'approved' | 'pending' | 'failed';
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
  expiresAt: string;
  active: boolean;
}

export interface StudentProgress {
  studentId: string;
  lessonId: string;
  courseId: string;
  completed: boolean;
  completedAt?: string;
  favorited?: boolean;
  lastPosition?: number;
  watchTime?: number;
  lastAccessed?: string;
}

export interface SupportTicket {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  queryText: string;
  answerText?: string;
  answeredAt?: string;
  createdAt: string;
  imageUrl?: string;
  type?: 'question' | 'practical_work';
}

export interface Certificate {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  issuedAt: string;
  validationCode: string;
}

export interface SupportComment {
  id: string;
  lessonId: string;
  courseId: string;
  userName: string;
  userEmail: string;
  userRole: 'admin' | 'student';
  avatarUrl?: string;
  comment: string;
  createdAt: string;
  replies?: SupportComment[];
}


