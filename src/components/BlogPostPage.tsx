import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, auth } from '../firebase';
import { where, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { BlogPost } from '../types';
import { Calendar, ArrowLeft, ArrowRight, Share2, Clock, BookOpen, ChevronRight, Home } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
            <button onClick={() => { window.location.hash = '#blog'; }} className="hover:text-brand-wood transition-colors cursor-pointer">
              Blog
            </button>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-brand-wood font-semibold truncate max-w-[150px] sm:max-w-[300px]">
              {post ? post.title : 'Artigo'}
            </span>
          </div>

          <button
            onClick={() => { window.location.hash = '#blog'; }}
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
            onClick={() => { window.location.hash = '#blog'; }}
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
                <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-brand-paper flex items-center justify-center">
                  <BookOpen className="w-16 h-16 text-gray-200" />
                </div>
              )}
            </div>

            <div className="p-6 sm:p-10">
              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-400 mb-6">
                <span className="bg-brand-paper text-brand-wood px-3SB py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-brand-wood" />
                  {formatDate(post.publishedAt || post.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  {calculateReadTime(post.content)}
                </span>
                
                <button
                  onClick={handleCopyLink}
                  className="ml-auto hover:text-brand-wood transition-colors flex items-center gap-1.5 cursor-pointer text-gray-500 text-xs font-bold"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {copiedLink ? 'Link copiado!' : 'Compartilhar'}
                </button>
              </div>

              {/* Title & Summary */}
              <h1 className="font-serif text-3xl sm:text-4xl text-brand-ink mb-4 leading-tight font-medium">
                {post.title}
              </h1>
              <p className="text-gray-500 italic text-sm md:text-base leading-relaxed border-l-2 border-brand-wood/20 pl-4 mb-8">
                {post.summary}
              </p>

              {/* RENDERED MARKDOWN CONTENT */}
              <div className="markdown-body border-t border-brand-wood/5 pt-8 prose max-w-none text-brand-ink">
                <ReactMarkdown
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-2xl sm:text-3xl font-serif text-brand-ink mt-8 mb-4 font-bold border-b pb-2" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl sm:text-2xl font-serif text-brand-ink mt-6 mb-3 font-semibold" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-serif text-brand-ink mt-4 mb-2 font-medium" {...props} />,
                    p: ({node, ...props}) => <p className="text-gray-600 leading-relaxed text-sm sm:text-base mb-6 font-normal" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 mt-2 mb-6 text-gray-600 text-sm sm:text-base space-y-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 mt-2 mb-6 text-gray-600 text-sm sm:text-base space-y-2" {...props} />,
                    li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-brand-wood/30 italic pl-4 py-1 my-6 bg-brand-paper rounded text-gray-650" {...props} />,
                    a: ({node, ...props}) => <a className="text-brand-wood hover:underline font-semibold" {...props} />,
                    img: ({node, ...props}) => (
                      <div className="my-8 flex flex-col items-center">
                        <img className="rounded-2xl max-h-[450px] object-cover border border-brand-wood/10" {...props} />
                        {props.alt && <span className="text-[10px] text-gray-400 mt-2 italic font-sans">{props.alt}</span>}
                      </div>
                    )
                  }}
                >
                  {post.content}
                </ReactMarkdown>
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
                    onClick={() => { window.location.hash = `#blog/${relatedPost.slug}`; }}
                    className="bg-white rounded-2xl border border-brand-wood/10 overflow-hidden cursor-pointer hover:border-brand-wood/30 hover:shadow transition-all flex flex-col group h-full"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-brand-paper relative">
                      {relatedPost.imageUrl && (
                        <img src={relatedPost.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
