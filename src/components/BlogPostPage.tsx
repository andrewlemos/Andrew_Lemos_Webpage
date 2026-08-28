import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, auth } from '../firebase';
import { where, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { BlogPost } from '../types';
import { Calendar, ArrowLeft, ArrowRight, Share2, Clock, BookOpen, ChevronRight, Home } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { motion } from 'motion/react';
import { ensureRobustUrl } from '../App';

interface BlogPostPageProps {
  slug: string;
  onNavigateToView: (view: any, id?: string) => void;
}

export const BlogPostPage: React.FC<BlogPostPageProps> = ({ slug, onNavigateToView }) => {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user?.email === 'andrewfmlemos@gmail.com');
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);

    // Query for the specific slug: if the logged user is not the admin, must be published
    const q = isAdmin
      ? query(
          collection(db, 'ecom_blog_posts'),
          where('slug', '==', slug),
          limit(1)
        )
      : query(
          collection(db, 'ecom_blog_posts'),
          where('slug', '==', slug),
          where('published', '==', true),
          limit(1)
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        setPost({ id: docSnap.id, ...docSnap.data() } as BlogPost);
      } else {
        setPost(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar artigo por slug:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [slug]);

  // Load other published posts as suggestions, skipping current one
  useEffect(() => {
    const qRelated = query(
      collection(db, 'ecom_blog_posts'),
      where('published', '==', true),
      limit(4)
    );

    const unsubscribeRelated = onSnapshot(qRelated, (snapshot) => {
      const relatedData: BlogPost[] = [];
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as BlogPost;
        if (data.slug !== slug) {
          relatedData.push(data);
        }
      });
      setRelatedPosts(relatedData.slice(0, 3));
    });

    return () => unsubscribeRelated();
  }, [slug]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getShareUrl = () => {
    const isDevOrInternal = typeof window !== 'undefined' && (window.location.origin.includes('localhost') || window.location.origin.includes('run.app'));
    const origin = isDevOrInternal ? 'https://andrewlemos.com' : (window.location.origin || 'https://andrewlemos.com');
    return `${origin}/blog/${slug}`;
  };

  const handleCopyLink = () => {
    const shareUrl = getShareUrl();
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!post) return;
    const shareUrl = getShareUrl();
    const text = `${post.title}\n\nConfira este artigo no Blog do Ateliê Andrew Lemos:\n${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareFacebook = () => {
    const shareUrl = getShareUrl();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer,width=600,height=450');
  };

  const calculateReadTime = (content: string) => {
    const words = content.trim().split(/\s+/).length;
    const wordsPerMinute = 200; // avg adult read speed
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min de leitura`;
  };

  return (
    <div className="pt-28 pb-24 bg-brand-paper min-h-screen">
      {/* Breadcrumb / Navigation bar */}
      <div className="max-w-4xl mx-auto px-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
            <button onClick={() => onNavigateToView('landing')} className="hover:text-brand-wood transition-colors flex items-center gap-1 cursor-pointer">
              <Home className="w-3.5 h-3.5" /> Início
            </button>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <button onClick={() => onNavigateToView('blog')} className="hover:text-brand-wood transition-colors cursor-pointer">
              Blog
            </button>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-brand-wood font-semibold truncate max-w-[150px] sm:max-w-[300px]">
              {post ? post.title : 'Artigo'}
            </span>
          </div>

          <button
            onClick={() => onNavigateToView('blog')}
            className="text-xs uppercase font-bold text-gray-500 hover:text-brand-wood transition-colors flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Feed
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="w-10 h-10 border-4 border-brand-wood/20 border-t-brand-wood rounded-full animate-spin"></div>
          <p className="text-sm text-gray-400 font-medium">Carregando conteúdo do artigo...</p>
        </div>
      ) : !post ? (
        <div className="max-w-md mx-auto text-center py-20 bg-white border border-brand-wood/10 rounded-3xl p-8 shadow-sm">
          <AlertCircleIcon className="w-12 h-12 stroke-[1] mx-auto text-brand-wood/40 mb-4" />
          <h3 className="font-serif text-xl text-brand-ink mb-2">Artigo não encontrado</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            O artigo solicitado não existe ou pode ter sido removido pelo administrador.
          </p>
          <button
            onClick={() => onNavigateToView('blog')}
            className="bg-brand-wood hover:bg-brand-wood-dark text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer"
          >
            Ver Outros Artigos
          </button>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto px-6"
        >
          {/* Post Header Card */}
          <div className="bg-white rounded-[2rem] border border-brand-wood/10 shadow-sm overflow-hidden mb-12">
            
            {/* LARGE FEATURED IMAGE */}
            <div className="w-full aspect-[21/9] sm:aspect-[21/10] overflow-hidden bg-brand-paper border-b border-brand-wood/5 relative">
              {post.imageUrl ? (
                <img src={ensureRobustUrl(post.imageUrl)} alt={post.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-brand-paper flex items-center justify-center">
                  <BookOpen className="w-16 h-16 text-gray-200" />
                </div>
              )}
            </div>

            <div className="p-6 sm:p-10">
              {/* Metadata row */}
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-gray-400 mb-6 pb-4 border-b border-brand-wood/5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-brand-paper text-brand-wood px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border border-brand-wood/10">
                    <Calendar className="w-3 h-3 text-brand-wood" />
                    {formatDate(post.publishedAt || post.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {calculateReadTime(post.content)}
                  </span>
                </div>
                
                {/* Social Share Buttons (WhatsApp, Facebook, Copy Link) */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider hidden sm:inline mr-1">Compartilhar:</span>
                  
                  {/* WhatsApp */}
                  <button
                    onClick={handleShareWhatsApp}
                    title="Compartilhar no WhatsApp"
                    className="p-2 rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-all cursor-pointer flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.079-2.07-.492-1.636-.679-2.701-2.348-2.782-2.458-.083-.11-1.393-1.854-1.393-3.536 0-1.682.879-2.51 1.192-2.855.313-.344.685-.431.914-.431.229 0 .459.002.661.012.213.01.498-.08.778.594.288.694.981 2.399 1.066 2.572.086.173.143.376.029.605-.115.229-.172.373-.344.575-.172.202-.363.451-.518.605-.172.172-.352.359-.151.705.201.345.895 1.478 1.922 2.393 1.321 1.176 2.435 1.54 2.781 1.712.345.172.546.144.747-.087.202-.23 0.863-1.006 1.093-1.351.23-.345.46-.288.776-.172.316.115 2.011.948 2.356 1.121.345.173.575.259.661.403.086.145.086.834-.058 1.239z"/>
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.891.528 3.66 1.447 5.174L2 22l4.97-1.305A9.957 9.957 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.167c-1.682 0-3.265-.487-4.606-1.325l-.33-.207-3.054.802.815-2.977-.227-.361A8.136 8.136 0 0 1 3.833 12c0-4.503 3.664-8.167 8.167-8.167 4.503 0 8.167 3.664 8.167 8.167 0 4.503-3.664 8.167-8.167 8.167z"/>
                    </svg>
                  </button>

                  {/* Facebook */}
                  <button
                    onClick={handleShareFacebook}
                    title="Compartilhar no Facebook"
                    className="p-2 rounded-full bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2] hover:text-white transition-all cursor-pointer flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </button>

                  {/* Copy Link */}
                  <button
                    onClick={handleCopyLink}
                    title="Copiar link permanente"
                    className="px-3 py-1.5 rounded-full bg-brand-paper hover:bg-brand-wood hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer text-gray-600 text-xs font-semibold border border-brand-wood/10"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {copiedLink ? 'Copiado!' : 'Copiar Link'}
                  </button>
                </div>
              </div>

              {/* Title & Summary */}
              <h1 className="font-serif text-3xl sm:text-4xl text-brand-ink mb-4 leading-tight font-medium">
                {post.title}
              </h1>
              <p className="text-gray-500 italic text-sm md:text-base leading-relaxed border-l-2 border-brand-wood/20 pl-4 mb-8">
                {post.summary}
              </p>

              {/* RENDERED MARKDOWN CONTENT */}
              <div className="border-t border-brand-wood/5 pt-8 max-w-none text-brand-ink">
                <MarkdownRenderer content={post.content} variant="blog" />
              </div>
            </div>
          </div>

          {/* Related/Explore Posts Section */}
          {relatedPosts.length > 0 && (
            <div className="mt-16 pt-8 border-t border-brand-wood/10">
              <h3 className="font-serif text-2xl text-brand-ink mb-6">Gostou desse conteúdo? Veja mais</h3>
              
              <div className="grid gap-6 sm:grid-cols-3">
                {relatedPosts.map((relatedPost) => (
                  <div
                    key={relatedPost.id}
                    onClick={() => onNavigateToView('blog-post', relatedPost.slug)}
                    className="bg-white rounded-2xl border border-brand-wood/10 overflow-hidden cursor-pointer hover:border-brand-wood/30 hover:shadow transition-all flex flex-col group h-full"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-brand-paper relative">
                      {relatedPost.imageUrl && (
                        <img src={ensureRobustUrl(relatedPost.imageUrl)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      )}
                    </div>
                    <div className="p-4 flex flex-col justify-between flex-grow">
                      <div>
                        <span className="text-[9px] font-bold text-brand-wood font-mono block mb-1">
                          {formatDate(relatedPost.publishedAt || relatedPost.createdAt)}
                        </span>
                        <h4 className="font-serif text-xs sm:text-sm text-brand-ink group-hover:text-brand-wood transition-colors font-medium line-clamp-2">
                          {relatedPost.title}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-brand-wood flex items-center gap-0.5 mt-3 group-hover:underline">
                        Ler Artigo <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

// Simple alert circle replacement icon to avoid complex imports if omitted
const AlertCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
