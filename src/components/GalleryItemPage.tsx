import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, orderBy } from '../firebase';
import { Arquivo } from '../types';
import { ArrowLeft, MessageCircle, Home, Calendar, ExternalLink, Brush, Tag, ShieldCheck, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { ensureRobustUrl } from '../App';

// Helper to slugify titles
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // remove accents
    .replace(/[\u0300-\u036f]/g, '') // remove accented characters
    .replace(/[_\s]+/g, '-') // replace spaces and underscores with hyphens
    .replace(/[^\w\-]+/g, '') // remove remaining special chars except hyphens
    .replace(/\-\-+/g, '-') // remove duplicate hyphens
    .replace(/^-+/, '') // remove leading hyphens
    .replace(/-+$/, ''); // remove trailing hyphens
}

// Get the slug for a work (database slug, or slugify title fallback, or ID fallback)
export function getWorkSlug(work: { id?: string; title: string; slug?: string }): string {
  if (work.slug && work.slug.trim().length > 0) return work.slug.trim();
  if (work.title && work.title.trim().length > 0) return slugify(work.title);
  return work.id || "";
}

interface GalleryItemPageProps {
  slug: string;
  onNavigateToView: (view: any, id?: string) => void;
}

export const GalleryItemPage: React.FC<GalleryItemPageProps> = ({ slug, onNavigateToView }) => {
  const [works, setWorks] = useState<Arquivo[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultWorks: Arquivo[] = [
    { title: 'Escultura em Madeira', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 18.06.49.jpeg', order: 1 },
    { title: 'Entalhe em Madeira', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 17.34.07 - Copia.jpeg', order: 2 },
    { title: 'Processo de Escultura', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 19.39.34 (1).jpeg', order: 3 },
    { title: 'Obra em Madeira', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.39 (1).jpeg', order: 4 },
    { title: 'Desenho Realista', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.39.jpeg', order: 5 },
    { title: 'Estudo de Grafite', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.40 (1).jpeg', order: 6 },
    { title: 'Retrato em Grafite', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.40 (2) - Copia.jpeg', order: 7 },
    { title: 'Anatomia Animal', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.40 (4).jpeg', order: 8 },
    { title: 'Expressão em Grafite', category: 'Grafite', img: '/arquivos/Screenshot_20221018-195950_Instagram.jpg', order: 9 },
    { title: 'Modelagem em Argila', category: 'Modelagem', img: '/arquivos/WhatsApp Image 2025-03-02 at 13.05.07 - Copia.jpeg', order: 10 },
    { title: 'Escultura de Peixe I', category: 'Madeira', img: '/arquivos/peixe1.jpg', order: 11 },
    { title: 'Escultura de Peixe II', category: 'Madeira', img: '/arquivos/peixe2.jpg', order: 12 },
    { title: 'Escultura de Peixe III', category: 'Madeira', img: '/arquivos/peixe3.jpg', order: 13 },
    { title: 'Escultura de Peixe IV', category: 'Madeira', img: '/arquivos/peixe4.jpg', order: 14 },
    { title: 'Escultura de Peixe V', category: 'Madeira', img: '/arquivos/peixe5.jpg', order: 15 },
    { title: 'Escultura de Peixe VI', category: 'Madeira', img: '/arquivos/peixe6.jpg', order: 16 },
  ];

  useEffect(() => {
    const q = query(collection(db, 'arquivos'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setWorks(defaultWorks);
      } else {
        const worksData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Arquivo[];
        setWorks(worksData);
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar obras na página de detalhes:", error);
      setWorks(defaultWorks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Find the current active work by matching the current slug
  const activeWork = works.find(w => getWorkSlug(w) === slug);

  if (loading) {
    return (
      <div className="pt-28 pb-20 bg-brand-paper min-h-screen flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-brand-wood/20 border-t-brand-wood rounded-full animate-spin"></div>
        <p className="text-sm text-gray-400 font-medium">Carregando detalhes da obra...</p>
      </div>
    );
  }

  if (!activeWork) {
    return (
      <div className="pt-28 pb-20 bg-brand-paper min-h-screen text-center flex flex-col justify-center items-center px-6">
        <div className="max-w-md bg-white border border-brand-wood/10 rounded-[2rem] p-8 shadow-sm">
          <h2 className="font-serif text-2xl text-brand-ink mb-2">Obra Não Encontrada</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            A obra que você procura não foi localizada ou o link foi modificado.
          </p>
          <button
            onClick={() => onNavigateToView('landing')}
            className="bg-brand-wood hover:bg-brand-wood-dark text-white px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Home className="w-4 h-4" /> Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  // Get related works in same category (excluding current item)
  const relatedWorks = works
    .filter(w => w.category === activeWork.category && getWorkSlug(w) !== slug)
    .slice(0, 4);

  // If we don't have enough, fill in with any other works
  const suggestedWorks = relatedWorks.length > 0 
    ? relatedWorks 
    : works.filter(w => getWorkSlug(w) !== slug).slice(0, 4);

  // Dynamic values derived from category
  const getCategoryDetails = (category: string) => {
    const term = (category || "").toLowerCase();
    if (term.includes('madeira')) {
      return {
        technique: "Entalhe manual tradicional com goivas e formões em madeiras nobres.",
        materials: "Madeira maciça de Lei selecionada (Cedro, Imbuia, Peroba, jacarandá ou similar).",
        finish: "Tratamento protetor selador de alta qualidade com lustro em cera de abelhas 100% pura para evidenciar as fibras.",
        care: "Limpar apenas com flanela seca. Evitar exposição direta à umidade extrema ou raios solares constantes.",
        abouttext: "Esta obra esculpida em madeiras de lei de excelente procedência é fruto de dezenas de horas de um primoroso trabalho de entalhe manual. Cada detalhe, ranhura e textura foi esculpido individualmente com goivas e formões pelo mestre-escutor Andrew Lemos, revelando as formas orgânicas e os tons nativos da própria madeira. Uma peça artesanal exclusiva de tiragem única."
      };
    } else if (term.includes('grafite')) {
      return {
        technique: "Desenho realista feito à mão livre com grafites profissionais de alta densidade.",
        materials: "Papel artístico encorpado livre de ácido (Canson, Fabriano ou similar), grafite graduado do HB ao 9B.",
        finish: "Fixador protetor fosco especial contra amarelamento e ação nociva dos raios UV.",
        care: "Conservar sob vidro anti-reflexo e manter longe de umidade.",
        abouttext: "Uma representação rica em realismo e técnicas avançadas de sombreamento feita à mão livre pelo artista. Utilizando papéis de alta especificação técnica e grafites especiais profissionais, Andrew Lemos dá vida a contrastes profundos e texturas táteis extraordinárias que capturam o olhar e a sensibilidade do espectador."
      };
    } else if (term.includes('modelagem') || term.includes('argila')) {
      return {
        technique: "Escultura tridimensional modelada à mão livre.",
        materials: "Argila natural de alta pureza (Terracota ou Argila Cinza escolar/profissional).",
        finish: "Acabamento resinado ou vitrificado fosco e selagem contra poeira.",
        care: "Peça sensível a impactos. Limpar com espanador suave ou pincel macio seco.",
        abouttext: "Esta escultura tridimensional moldada manualmente representa os primeiros passos na criação de formas complexas e estudos anatômicos. A argila oferece maleabilidade e capacidade de registro de marcas orgânicas das mãos, unindo técnica rústica de modelagem clássica à sensibilidade moderna do artista."
      };
    } else {
      return {
        technique: "Técnica autoral mista desenvolvida artesanalmente no ateliê.",
        materials: "Materiais profissionais selecionados e insumos importados de alta durabilidade.",
        finish: "Camada protetora incolor fosca que garante estabilidade e proteção prolongada.",
        care: "Evitar contato direto com fontes excessivas de calor ou luz solar direta.",
        abouttext: "Uma peça artística única representativa da versatilidade criativa de Andrew Lemos. Desenhada ou produzida de forma independente com alto grau de refinamento manual, une materiais de excelente qualidade a traços clássicos, agregando sofisticação a qualquer ambiente."
      };
    }
  };

  const categoryDetails = getCategoryDetails(activeWork.category);
  const details = {
    technique: activeWork.technique || categoryDetails.technique,
    materials: activeWork.materials || categoryDetails.materials,
    finish: activeWork.finish || categoryDetails.finish,
    care: activeWork.care || categoryDetails.care,
    abouttext: activeWork.abouttext || categoryDetails.abouttext,
    dimensions: activeWork.dimensions || "Sob consulta (feita sob medida)",
    year: activeWork.year || "Recente (Artesanal)"
  };

  // Formulate custom Whatsapp outreach
  const whatsappUrl = `https://wa.me/5519998107110?text=Olá%20Andrew!%20Tenho%20interesse%20em%20saber%20mais%20sobre%20a%20obra%20"${encodeURIComponent(activeWork.title)}"%20(${activeWork.category})%20que%20vi%20na%20sua%20galeria.`;

  return (
    <div className="pt-28 pb-20 bg-brand-paper min-h-screen">
      {/* Header / Breadcrumb Section */}
      <div className="max-w-7xl mx-auto px-6 mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400 mb-6">
          <button 
            onClick={() => onNavigateToView('landing')} 
            className="hover:text-brand-wood transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" /> Início
          </button>
          <span className="text-gray-300">/</span>
          <button 
            onClick={() => {
              onNavigateToView('landing');
              setTimeout(() => {
                const elem = document.getElementById('gallery');
                if (elem) elem.scrollIntoView({ behavior: 'smooth' });
              }, 150);
            }} 
            className="hover:text-brand-wood transition-colors cursor-pointer"
          >
            Galeria
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-brand-wood font-semibold truncate max-w-[120px] md:max-w-xs">{activeWork.title}</span>
        </div>

        <button 
          onClick={() => {
            onNavigateToView('landing');
            setTimeout(() => {
              const elem = document.getElementById('gallery');
              if (elem) elem.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          className="group hover:text-brand-wood text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer text-brand-ink mb-6"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Voltar à Galeria
        </button>
      </div>

      {/* Main Detail Grid */}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
        
        {/* Left Column - High-Res Image Display */}
        <div className="lg:col-span-7 flex flex-col justify-start">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-4 rounded-3xl border border-brand-wood/10 shadow-lg relative overflow-hidden aspect-[3/4] md:max-h-[750px] w-full flex items-center justify-center group"
          >
            <img 
              src={ensureRobustUrl(activeWork.img)} 
              alt={activeWork.title}
              className="max-w-full max-h-full object-contain rounded-2xl select-text transition-transform duration-500 hover:scale-105"
              referrerPolicy="no-referrer"
            />
            {/* Pinterest / Social indicator */}
            <div className="absolute top-4 right-4 bg-brand-clay/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest pointer-events-none">
              {activeWork.category}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Work Details */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <span className="text-brand-clay font-medium block text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Obra de Arte Original ({activeWork.category})
              </span>
              <h1 className="text-3xl md:text-5xl font-serif text-brand-ink tracking-tight mb-4">
                {activeWork.title}
              </h1>
              <div className="h-1 w-16 bg-brand-wood/40 rounded-full"></div>
            </div>

            <div className="text-gray-600 space-y-4 leading-relaxed text-sm md:text-base">
              <p>{details.abouttext}</p>
            </div>

            {/* Technical specs block */}
            <div className="bg-brand-wood/5 border border-brand-wood/10 rounded-2xl p-6 space-y-4">
              <h3 className="font-serif text-brand-ink font-bold text-base flex items-center gap-2">
                <Brush className="w-4 h-4 text-brand-wood" /> Informações Técnicas
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                <div>
                  <span className="text-gray-400 block uppercase tracking-wider mb-0.5">Técnica aplicada</span>
                  <span className="text-brand-ink font-semibold">{details.technique}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase tracking-wider mb-0.5">Insumos/Materiais</span>
                  <span className="text-brand-ink font-semibold">{details.materials}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase tracking-wider mb-0.5">Acabamento final</span>
                  <span className="text-brand-ink font-semibold">{details.finish}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase tracking-wider mb-0.5">Cuidados recomendados</span>
                  <span className="text-brand-ink font-semibold">{details.care}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase tracking-wider mb-0.5">Dimensões da Obra</span>
                  <span className="text-brand-ink font-semibold">{details.dimensions}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase tracking-wider mb-0.5">Ano de Criação</span>
                  <span className="text-brand-ink font-semibold">{details.year}</span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase tracking-wider mb-0.5">Artista Responsável</span>
                  <span className="text-brand-ink font-semibold flex items-center gap-1">
                    Andrew Lemos
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block uppercase tracking-wider mb-0.5">Autenticidade</span>
                  <span className="text-brand-clay font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-clay" /> Assinada e Registrada
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {/* Primary Action - Consult via WhatsApp */}
            <a 
              href={whatsappUrl}
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full bg-brand-wood hover:bg-brand-wood-dark text-white p-4 rounded-2xl text-center font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer group"
            >
              <MessageCircle className="w-5 h-5 fill-current transition-transform group-hover:scale-110" />
              Solicitar Orçamento / Consultar Disponibilidade
            </a>

            <div className="text-center">
              <p className="text-[11px] text-gray-400 leading-relaxed font-mono">
                * As obras são feitas de forma totalmente manual. Encomendas personalizadas com dimensões específicas podem ser orçadas diretamente com o artista plástico.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Suggested / Related Works Section */}
      <div className="max-w-7xl mx-auto px-6 pt-12 border-t border-brand-wood/10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif text-brand-ink flex items-center gap-2">
              <Heart className="w-6 h-6 text-brand-clay" /> Obras Relacionadas
            </h2>
            <p className="text-xs md:text-sm text-gray-500">Inspire-se com outros trabalhos do artista criados na mesma categoria.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {suggestedWorks.map((work, idx) => {
            const itemSlug = getWorkSlug(work);
            return (
              <div 
                key={work.id || idx}
                onClick={() => onNavigateToView('galeria-item', itemSlug)}
                className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-brand-wood/10 hover:border-brand-wood/20 hover:shadow-lg transition-all duration-300 flex flex-col"
              >
                <div className="aspect-[3/4] overflow-hidden bg-brand-paper relative">
                  <img 
                    src={ensureRobustUrl(work.img)} 
                    alt={work.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-bold uppercase tracking-wider bg-brand-wood/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-1.5">
                      Detalhes da Obra <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
                <div className="p-4 flex flex-col justify-between flex-grow">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-clay mb-1 block">
                      {work.category}
                    </span>
                    <h3 className="font-serif text-brand-ink text-sm font-medium leading-snug line-clamp-2">
                      {work.title}
                    </h3>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
