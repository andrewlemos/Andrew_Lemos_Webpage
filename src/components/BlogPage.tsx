import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, orderBy } from '../firebase';
import { where } from 'firebase/firestore';
import { BlogPost } from '../types';
import { Calendar, ArrowRight, BookOpen, ChevronRight, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface BlogPageProps {
  onNavigateToView: (view: any, id?: string) => void;
}

export const BlogPage: React.FC<BlogPageProps> = ({ onNavigateToView }) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch published blog posts
    const q = query(
      collection(db, 'ecom_blog_posts'),
      where('published', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData: BlogPost[] = [];
      snapshot.forEach((doc) => {
        postsData.push({ id: doc.id, ...doc.data() } as BlogPost);
      });
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar posts do blog:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="pt-28 pb-20 bg-brand-paper min-h-screen">
      {/* Header / Breadcrumb Section */}
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400 mb-4">
          <button onClick={() => onNavigateToView('landing')} className="hover:text-brand-wood transition-colors flex items-center gap-1 cursor-pointer">
            <Home className="w-3.5 h-3.5" /> Início
          </button>
          <ChevronRight className="w-3 h-3 text-gray-300" />
          <span className="text-brand-wood font-semibold">Blog</span>
        </div>

        <div className="max-w-3xl border-l-2 border-brand-wood/30 pl-6">
          <h1 className="text-4xl md:text-5xl font-serif text-brand-ink mb-4 tracking-tight">O Blog do Ateliê</h1>
          <p className="text-gray-500 leading-relaxed text-sm md:text-base">
            Descubra as reflexões, técnicas de entalhado em madeira, tutoriais de pintura e histórias dos bastidores da produção de obras exclusivas do artista Andrew Lemos.
          </p>
        </div>
      </div>

      {/* Main Blog Feed Container */}
      <div className="max-w-7xl mx-auto px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-4 border-brand-wood/20 border-t-brand-wood rounded-full animate-spin"></div>
            <p className="text-sm text-gray-400 font-medium">Carregando artigos exclusivos...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-20 bg-white border border-brand-wood/10 rounded-3xl p-8 shadow-sm">
            <BookOpen className="w-12 h-12 stroke-[1] mx-auto text-brand-wood/40 mb-4" />
            <h3 className="font-serif text-xl text-brand-ink mb-2">Novidades em breve</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Nosso blog está sendo preparado e em breve teremos artigos exclusivos sobre entalhes, técnicas e lançamentos. Fique atento!
            </p>
            <button
              onClick={() => onNavigateToView('landing')}
              className="bg-brand-wood hover:bg-brand-wood-dark text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              Voltar ao Início
            </button>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, idx) => (
              <motion.article 
                key={post.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                className="bg-white rounded-[2rem] overflow-hidden border border-brand-wood/10 hover:border-brand-wood/20 hover:shadow-xl transition-all duration-300 flex flex-col group h-full"
              >
                {/* Feature Image Wrapper */}
                <div 
                  className="aspect-video w-full overflow-hidden relative bg-brand-paper cursor-pointer"
                  onClick={() => {
                    window.location.hash = `#blog/${post.slug}`;
                  }}
                >
                  {post.imageUrl ? (
                    <img 
                      src={post.imageUrl} 
                      alt={post.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gray-50">
                      <BookOpen className="w-10 h-10 text-gray-200" />
                    </div>
                  )}
                  {/* Absolute date tag over image */}
                  <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3.5 py-1.5 rounded-full shadow-sm text-[10px] font-bold text-brand-wood flex items-center gap-1.5 border border-gray-100">
                    <Calendar className="w-3 h-3 text-brand-wood" />
                    {formatDate(post.publishedAt || post.createdAt)}
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-6 flex flex-col flex-grow">
                  <h2 
                    onClick={() => {
                      window.location.hash = `#blog/${post.slug}`;
                    }}
                    className="font-serif text-lg md:text-xl text-brand-ink mb-3 group-hover:text-brand-wood transition-colors leading-snug font-medium line-clamp-2 cursor-pointer"
                  >
                    {post.title}
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mb-6 flex-grow">
                    {post.summary}
                  </p>

                  <div className="pt-4 border-t border-brand-wood/5 flex items-center justify-between mt-auto">
                    <span className="text-[10px] text-gray-400 font-mono">/blog/{post.slug}</span>
                    <button
                      onClick={() => {
                        window.location.hash = `#blog/${post.slug}`;
                      }}
                      className="text-xs font-bold text-brand-wood hover:text-brand-wood-dark transition-colors inline-flex items-center gap-1 group/btn cursor-pointer"
                    >
                      Ler mais
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
