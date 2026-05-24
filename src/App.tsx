/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Instagram, 
  Facebook, 
  Youtube, 
  Mail, 
  ChevronRight, 
  ChevronLeft,
  Menu, 
  X, 
  Palette, 
  Brush, 
  Hammer, 
  PenTool, 
  ExternalLink,
  ArrowRight,
  MessageCircle,
  Send,
  Lock
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  updateDoc 
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

// --- Types ---

interface Product {
  id?: string;
  name: string;
  affiliateLink: string;
  imageUrl: string;
  createdAt: any;
}

// --- Components ---

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Início', href: '#home' },
    { name: 'Biografia', href: '#bio' },
    { name: 'Especialidades', href: '#expertise' },
    { name: 'Galeria', href: '#gallery' },
    { name: 'Mídia', href: '#publications' },
    { name: 'Aulas', href: '#classes' },
    { name: 'Cursos Online', href: '#online-courses' },
    { name: 'Produtos', href: '#products' },
    { name: 'Contato', href: '#contact' },
  ];

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 py-4",
      isScrolled ? "glass py-3 shadow-sm" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <a href="#home" className="flex items-center gap-2">
          <div className="h-10 md:h-12 flex items-center gap-2">
            <img 
              src="/arquivos/LOGO ANDREW.png" 
              alt="Andrew Lemos Logo" 
              className="h-full w-auto object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
              }}
            />
            
          </div>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href}
              className="text-sm font-medium tracking-wide hover:text-brand-wood transition-colors uppercase"
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 glass border-t border-brand-wood/10 flex flex-col p-6 gap-4 md:hidden"
          >
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-lg font-serif hover:text-brand-wood transition-colors"
              >
                {link.name}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen md:h-[95vh] lg:h-[90vh] flex items-center justify-center overflow-hidden bg-brand-paper pt-32 pb-16 md:py-0">
      <div className="absolute inset-0 z-0 opacity-10">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-8 md:gap-12 items-center z-10 w-full">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="flex flex-col justify-center"
        >
          <span className="inline-block text-brand-wood font-medium tracking-[0.2em] uppercase mb-2 md:mb-4 text-xs sm:text-sm">
            Artista Plástico & Escultor
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif leading-tight mb-4 md:mb-6">
            Andrew <br />
            <span className="italic text-brand-wood">Lemos</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-md mb-6 md:mb-8 leading-relaxed">
            Transformando madeira, clay e grafite em expressões vivas da natureza.
          </p>
          <div className="flex gap-4">
            <a 
              href="#gallery" 
              className="bg-brand-wood text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-medium hover:bg-brand-clay transition-all flex items-center gap-2 group shadow-lg shadow-brand-wood/20 text-sm sm:text-base"
            >
              Ver Obras
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a 
              href="#contact" 
              className="border border-brand-wood text-brand-wood px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-medium hover:bg-brand-wood hover:text-white transition-all text-sm sm:text-base"
            >
              Contato
            </a>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
          className="relative aspect-[4/5] md:aspect-square max-h-[35vh] sm:max-h-[45vh] md:max-h-[60vh] w-full max-w-xs md:max-w-none mx-auto mt-6 md:mt-0"
        >
          <div className="absolute -inset-4 border border-brand-wood/20 rounded-2xl rotate-3"></div>
          <div className="absolute -inset-4 border border-brand-wood/20 rounded-2xl -rotate-3"></div>
          <img 
            src="/arquivos/IMG_20230520_122543_345-1.jpg"
            alt="Andrew Lemos - Artista Plástico" 
            className="w-full h-full object-cover rounded-2xl shadow-2xl relative z-10"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </div>
    </section>
  );
};

const Biography = () => {
  return (
    <section id="bio" className="section-padding bg-white relative overflow-hidden">
      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-serif mb-4">Currículo Artístico-Biográfico</h2>
          <div className="w-24 h-1 bg-brand-wood mx-auto"></div>
        </motion.div>

        <div className="space-y-8 text-lg text-gray-700 leading-relaxed font-light">
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
          >
            <strong className="font-medium text-brand-ink">Andrew Filipe Moreira Lemos</strong>, artista plástico das áreas de Desenho, Pintura, Escultura, Entalhe, Modelagem e Produtor Digital, residente em Pirassununga/SP, é natural de Lorena/SP. Sua jornada artística começou cedo, em 1993, estudando pintura no ateliê de Leice Novaes.
          </motion.p>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
          >
            Em 2016, a arte retornou à sua vida de forma transformadora através do renomado escultor amazonense <strong className="font-medium text-brand-wood">Joe Alcantara</strong>, com quem se iniciou no entalhe e escultura em madeira. Desde então, Andrew tem dedicado sua vida a capturar a essência da natureza em suas obras.
          </motion.p>

          <div className="grid md:grid-cols-2 gap-8 my-12">
            <div className="bg-brand-paper p-8 rounded-2xl border border-brand-wood/10">
              <h3 className="text-xl font-serif mb-4 text-brand-wood">Reconhecimento Internacional</h3>
              <p className="text-base">Selecionado para compor o livro de arte iraniano <em className="italic">"Golden Bridge to the World of Art"</em> (2023) e a coletânea <em className="italic">"Dialogues of Colors"</em>, representando o Brasil.</p>
            </div>
            <div className="bg-brand-paper p-8 rounded-2xl border border-brand-wood/10">
              <h3 className="text-xl font-serif mb-4 text-brand-wood">Atuação Cultural</h3>
              <p className="text-base">Membro do Conselho de Cultura de Pirassununga (Artes Visuais) e premiado com o Notoriedade Artística em 2024 através da Lei Paulo Gustavo.</p>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="my-12 rounded-3xl overflow-hidden shadow-xl border border-brand-wood/10"
          >
            <img 
              src="/arquivos/Premio de Notoriedade Artística (1).png" 
              alt="Prêmio de Notoriedade Artística" 
              className="w-full h-auto"
              referrerPolicy="no-referrer"
            />
            <div className="bg-brand-paper p-4 text-center text-sm text-gray-500 italic">
              Certificado de Notoriedade Artística - Lei Paulo Gustavo (2024)
            </div>
          </motion.div>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            viewport={{ once: true }}
          >
            Com uma paixão profunda pela <strong className="font-medium text-brand-ink">fauna e flora</strong>, Andrew prioriza esses temas em suas obras autorais, utilizando técnicas tradicionais aliadas a uma visão contemporânea de difusão artística.
          </motion.p>
        </div>
      </div>
    </section>
  );
};

const Expertise = () => {
  const skills = [
    { title: 'Escultura & Entalhe', icon: Hammer, desc: 'Especialista em transformar madeira bruta em formas orgânicas detalhadas.' },
    { title: 'Desenho Realista', icon: PenTool, desc: 'Domínio de grafite e técnicas de luz e sombra para retratos e natureza.' },
    { title: 'Pintura', icon: Palette, desc: 'Exploração de cores e texturas em diversas superfícies e temáticas.' },
    { title: 'Modelagem', icon: Brush, desc: 'Criação tridimensional em argila e outros materiais maleáveis.' },
  ];

  return (
    <section id="expertise" className="section-padding bg-brand-paper">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="max-w-xl">
            <h2 className="text-4xl md:text-5xl font-serif mb-6">Especialidades Artísticas</h2>
            <p className="text-gray-600">Um conjunto diversificado de habilidades técnicas que permitem a transição fluida entre o 2D e o 3D.</p>
          </div>
          <div className="text-brand-wood font-serif italic text-xl">"Do Lápis ao Aço"</div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {skills.map((skill, idx) => (
            <motion.div 
              key={skill.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="w-14 h-14 bg-brand-paper rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-wood group-hover:text-white transition-colors">
                <skill.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-serif mb-3">{skill.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{skill.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Gallery = () => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const works = [
    // Trabalhos em Madeira
    { title: 'Escultura em Madeira', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 18.06.49.jpeg' },
    { title: 'Entalhe em Madeira', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 17.34.07 - Copia.jpeg' },
    { title: 'Processo de Escultura', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 19.39.34 (1).jpeg' },
    { title: 'Obra em Madeira', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.39 (1).jpeg' },
    
    // Desenhos em Grafite
    { title: 'Desenho Realista', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.39.jpeg' },
    { title: 'Estudo de Grafite', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.40 (1).jpeg' },
    { title: 'Retrato em Grafite', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.40 (2) - Copia.jpeg' },
    { title: 'Anatomia Animal', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.40 (4).jpeg' },
    { title: 'Expressão em Grafite', category: 'Grafite', img: '/arquivos/Screenshot_20221018-195950_Instagram.jpg' },
    
    // Modelagem
    { title: 'Modelagem em Argila', category: 'Modelagem', img: '/arquivos/WhatsApp Image 2025-03-02 at 13.05.07 - Copia.jpeg' },
    
    // Peixes (Trabalhos em Madeira)
    { title: 'Escultura de Peixe I', category: 'Madeira', img: '/arquivos/peixe1.jpg' },
    { title: 'Escultura de Peixe II', category: 'Madeira', img: '/arquivos/peixe2.jpg' },
    { title: 'Escultura de Peixe III', category: 'Madeira', img: '/arquivos/peixe3.jpg' },
    { title: 'Escultura de Peixe IV', category: 'Madeira', img: '/arquivos/peixe4.jpg' },
    { title: 'Escultura de Peixe V', category: 'Madeira', img: '/arquivos/peixe5.jpg' },
    { title: 'Escultura de Peixe VI', category: 'Madeira', img: '/arquivos/peixe6.jpg' },
  ];

  useEffect(() => {
    if (selectedIdx !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedIdx]);

  useEffect(() => {
    if (selectedIdx === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIdx(null);
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIdx]);

  const handleNext = () => {
    setSelectedIdx((prev) => (prev !== null && prev < works.length - 1 ? prev + 1 : 0));
  };

  const handlePrev = () => {
    setSelectedIdx((prev) => (prev !== null && prev > 0 ? prev - 1 : works.length - 1));
  };

  return (
    <section id="gallery" className="section-padding bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif mb-4">Galeria de Obras</h2>
          <p className="text-gray-500">Uma seleção de trabalhos autorais e encomendas recentes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {works.map((work, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              viewport={{ once: true }}
              onClick={() => setSelectedIdx(idx)}
              className="group relative overflow-hidden rounded-2xl aspect-[3/4] cursor-pointer shadow-sm hover:shadow-md transition-shadow"
            >
              <img 
                src={work.img} 
                alt={work.title} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6">
                <span className="text-brand-clay text-xs font-medium uppercase tracking-widest mb-1">{work.category}</span>
                <h3 className="text-white text-xl font-serif">{work.title}</h3>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button className="text-brand-wood font-medium flex items-center gap-2 mx-auto hover:gap-4 transition-all">
            Ver portfólio completo no Instagram <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 select-none"
            onClick={() => setSelectedIdx(null)}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedIdx(null)}
              className="absolute top-6 right-6 z-[110] text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Prev button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-4 md:left-8 z-[110] text-white/70 hover:text-white bg-white/10 hover:bg-white/25 p-3 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Image Container with high fidelity */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-[90vw] max-h-[80vh] flex flex-col items-center justify-center"
            >
              <img
                src={works[selectedIdx].img}
                alt={works[selectedIdx].title}
                className="max-w-[90vw] max-h-[75vh] md:max-h-[80vh] object-contain rounded-lg shadow-2xl select-text"
                referrerPolicy="no-referrer"
              />
              
              {/* Image Description Card below */}
              <div className="absolute -bottom-16 text-center text-white w-full pointer-events-none md:pointer-events-auto">
                <span className="text-brand-clay text-xs tracking-wider uppercase font-medium">
                  {works[selectedIdx].category}
                </span>
                <h3 className="text-lg md:text-xl font-serif mt-1">
                  {works[selectedIdx].title}
                </h3>
              </div>
            </motion.div>

            {/* Next button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 md:right-8 z-[110] text-white/70 hover:text-white bg-white/10 hover:bg-white/25 p-3 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Próxima"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Help text on desktop */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/40 text-xs hidden md:block select-none pointer-events-none font-mono">
              Use ← e → no teclado para navegar, ESC para fechar
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const YouTubeSection = () => {
  return (
    <section className="section-padding bg-brand-ink text-white overflow-hidden">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3 text-red-500 mb-6">
            <Youtube className="w-8 h-8" />
            <span className="font-medium tracking-widest uppercase text-sm">Canal YouTube</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-serif mb-8">Do Lápis ao Aço</h2>
          <p className="text-gray-400 text-lg mb-8 leading-relaxed">
            Compartilhando conhecimento e técnicas artísticas para democratizar o acesso à arte. Com mais de <span className="text-white font-medium">250 mil visualizações</span>, o canal é um ponto de encontro para aprendizes e entusiastas das artes plásticas.
          </p>
          <a 
            href="https://www.youtube.com/@DoL%C3%A1pisaoA%C3%A7o" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full transition-all"
          >
            Inscrever-se no Canal <ExternalLink className="w-4 h-4" />
          </a>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          <div className="aspect-video bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-white/10 group">
            <img 
              src="/arquivos/WhatsApp Image 2025-03-01 at 18.06.49.jpeg" 
              alt="YouTube Thumbnail" 
              className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2"></div>
              </div>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-wood/20 rounded-full blur-3xl"></div>
          <div className="absolute -top-6 -left-6 w-32 h-32 bg-red-600/10 rounded-full blur-3xl"></div>
        </motion.div>
      </div>
    </section>
  );
};

const ClassesSection = () => {
  const [leadData, setLeadData] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await addDoc(collection(db, 'leads'), {
        ...leadData,
        createdAt: serverTimestamp()
      });

      // Send automatic email via backend
      const res = await fetch('/api/send-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      });

      if (!res.ok) {
        let errorText = '';
        try {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            errorText = data.error || '';
          } catch {
            errorText = text ? (text.length > 200 ? text.substring(0, 200) + '...' : text) : '';
          }
        } catch {
          errorText = 'Erro de leitura do corpo da resposta.';
        }
        throw new Error(errorText || `Erro Servidor Vercel (Status ${res.status}): Não foi possível enviar o e-mail do manual no momento.`);
      }

      setIsSuccess(true);
      setLeadData({ name: '', email: '' });
    } catch (error: any) {
      console.error("Erro ao capturar lead:", error);
      setErrorMessage(error.message || "Ocorreu um erro ao processar seu cadastro. Por favor, tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="classes" className="section-padding bg-brand-paper">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif mb-4">Aulas Presenciais</h2>
          <p className="text-gray-500">Desenvolva suas habilidades com acompanhamento direto no ateliê.</p>
        </div>
        <div className="bg-white rounded-[3rem] overflow-hidden shadow-xl border border-brand-wood/5 grid md:grid-cols-2">
          <div className="p-12 md:p-20 flex flex-col justify-center">
            <h3 className="text-3xl font-serif mb-8 text-brand-wood">Ateliê em Pirassununga</h3>
            <ul className="space-y-6 mb-12">
              {[
                'Aulas Individuais ou em Dupla',
                'Arte 2D: Desenho Realista e Pirografia',
                'Arte 3D: Modelagem e Entalhe em Madeira',
                'Agendamento mensal - days e horários flexíveis'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="mt-1.5 w-5 h-5 rounded-full bg-brand-wood/10 flex items-center justify-center flex-shrink-0">
                    <ChevronRight className="w-3 h-3 text-brand-wood" />
                  </div>
                  <span className="text-gray-700 text-lg">{item}</span>
                </li>
              ))}
            </ul>
            
            <div className="bg-brand-paper/50 p-8 rounded-3xl border border-brand-wood/10">
              <h4 className="text-xl font-serif mb-4">Manual Gratuito</h4>
              <p className="text-sm text-gray-600 mb-6">
                Você deseja receber gratuitamente um manual de iniciação no Entalhe em Madeira? Basta preencher este cadastro e você receberá o guia em seu e-mail.
              </p>

              {isSuccess ? (
                <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-100 text-center text-sm">
                  Solicitação enviada! Verifique seu e-mail em instantes.
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-3">
                  {errorMessage && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-sm font-medium leading-relaxed">
                      {errorMessage}
                    </div>
                  )}
                  <input 
                    type="text" 
                    placeholder="Seu Nome" 
                    className="w-full p-3 rounded-xl border border-brand-wood/20 text-sm"
                    value={leadData.name}
                    onChange={e => setLeadData({...leadData, name: e.target.value})}
                    required
                  />
                  <input 
                    type="email" 
                    placeholder="Seu melhor e-mail" 
                    className="w-full p-3 rounded-xl border border-brand-wood/20 text-sm"
                    value={leadData.email}
                    onChange={e => setLeadData({...leadData, email: e.target.value})}
                    required
                  />
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-brand-wood text-white p-3 rounded-xl font-bold text-sm hover:bg-brand-clay transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enviando...' : 'Quero Receber o Manual'}
                  </button>
                </form>
              )}
            </div>

            <div className="mt-8">
              <a 
                href="#contact" 
                className="inline-block bg-brand-ink text-white px-10 py-5 rounded-full font-medium hover:bg-black transition-all text-center shadow-lg"
              >
                Garanta sua vaga presencial
              </a>
            </div>
          </div>
          <div className="relative h-[400px] md:h-auto">
            <img 
              src="/arquivos/Apresentação do Canal.jpg" 
              alt="Ateliê Andrew Lemos" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const OnlineCoursesSection = () => {
  const courses = [
    {
      title: 'Introdução ao Desenvolvimento de Games',
      platform: 'Udemy',
      price: 'Ver Preço na Udemy',
      img: '/arquivos/dreamina-2025-11-08-5018-Pixel art style course thumbnail for a c....jpeg',
      link: 'https://www.udemy.com/course/introducao-ao-desenvolvimento-de-games/?referralCode=1D6F524BD5BE69910E5D',
      desc: 'Dê seus primeiros passos no mundo da criação de jogos digitais com este curso introdutório completo.'
    }
  ];

  return (
    <section id="online-courses" className="section-padding bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif mb-4">Cursos Online</h2>
          <p className="text-gray-500">Aprenda no seu ritmo, de qualquer lugar do mundo.</p>
        </div>

        <div className="flex justify-center">
          {courses.map((course, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-md bg-brand-paper rounded-3xl overflow-hidden border border-brand-wood/5 flex flex-col h-full hover:shadow-xl transition-all"
            >
              <div className="relative aspect-video">
                <img 
                  src={course.img} 
                  alt={course.title} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-brand-wood shadow-sm">
                  {course.platform}
                </div>
              </div>
              <div className="p-8 flex flex-col flex-grow">
                <h3 className="text-xl font-serif mb-3 leading-tight">{course.title}</h3>
                <p className="text-gray-500 text-sm mb-6 flex-grow">{course.desc}</p>
                <div className="flex items-center justify-between mt-auto pt-6 border-t border-brand-wood/10">
                  <span className="text-sm font-bold text-brand-ink">{course.price}</span>
                  <a 
                    href={course.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-brand-wood font-medium flex items-center gap-2 hover:gap-3 transition-all"
                  >
                    Acessar Curso <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const RecommendedProductsSection = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
    });
    return () => unsubscribe();
  }, []);

  if (products.length === 0) return null;

  return (
    <section id="products" className="section-padding bg-brand-paper">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif mb-4">Produtos Recomendados</h2>
          <p className="text-gray-500">Materiais e ferramentas que utilizo e recomendo para sua jornada artística.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {products.map((product) => (
            <motion.div 
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-3xl overflow-hidden border border-brand-wood/5 flex flex-col h-full hover:shadow-xl transition-all"
            >
              <div className="relative aspect-square p-8">
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-8 flex flex-col flex-grow">
                <h3 className="text-xl font-serif mb-3 leading-tight">{product.name}</h3>
                <div className="flex items-center justify-between mt-auto pt-6 border-t border-brand-wood/10">
                  <a 
                    href={product.affiliateLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-brand-wood text-white px-6 py-3 rounded-full text-center font-medium hover:bg-brand-clay transition-all"
                  >
                    Ver na Loja
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const AdminDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'leads'>('products');
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', affiliateLink: '', imageUrl: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      // Apenas a conta andrewfmlemos@gmail.com gerencia produtos com sucesso
      if (u && u.email === 'andrewfmlemos@gmail.com') {
        setUser(u);
        setIsOpen(true);
      } else {
        setUser(null);
        setIsOpen(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const qProducts = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    });

    const qLeads = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubProducts();
      unsubLeads();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Erro no login:", error);
      if (error?.code === 'auth/unauthorized-domain') {
        alert(
          "Domínio Não Autorizado no Firebase Auth!\n\n" +
          `O domínio atual (${window.location.hostname}) não está na lista de domínios autorizados para autenticação.\n\n` +
          "Para corrigir:\n" +
          "1. Acesse o Console do Firebase (console.firebase.google.com)\n" +
          "2. Vá em no menu 'Authentication' -> aba 'Settings' -> seção 'Authorized domains'\n" +
          `3. Adicione o domínio '${window.location.hostname}' à lista.\n\n` +
          "Assim, o login com o Google passará a funcionar imediatamente!"
        );
      } else if (error?.code === 'auth/popup-blocked') {
        alert(
          "Popup Bloqueado pelo Navegador!\n\n" +
          "Por favor, permita popups neste site para conseguir fazer login com a sua conta Google."
        );
      } else {
        alert(
          "Erro ao fazer login via Google no Firebase:\n\n" + 
          (error?.message || error) + 
          "\n\nCertifique-se de que o provedor Google está ativado no painel Authentication do seu Firebase Console."
        );
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.affiliateLink || !formData.imageUrl) return;

    try {
      await addDoc(collection(db, 'products'), {
        ...formData,
        createdAt: serverTimestamp()
      });
      setFormData({ name: '', affiliateLink: '', imageUrl: '' });
      setIsAdding(false);
    } catch (error) {
      console.error("Erro ao adicionar produto:", error);
      alert("Erro ao adicionar produto. Verifique as permissões.");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Deseja realmente excluir este produto?")) {
      await deleteDoc(doc(db, 'products', id));
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (confirm("Deseja realmente excluir este lead?")) {
      await deleteDoc(doc(db, 'leads', id));
    }
  };

  if (!user) {
    return (
      <div className="fixed bottom-24 right-5 z-[90]">
        <button 
          onClick={handleLogin}
          className="bg-brand-paper/70 backdrop-blur-sm border border-brand-wood/10 text-brand-wood/30 hover:text-brand-wood/80 p-2 rounded-full shadow-sm hover:bg-brand-paper hover:shadow transition-all flex items-center justify-center cursor-pointer"
          title="Restrito"
        >
          <Lock className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-24 right-5 z-[90] flex flex-col gap-1.5 items-center">
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-brand-wood/80 backdrop-blur-sm text-white p-2 rounded-full shadow-sm hover:bg-brand-wood hover:scale-105 transition-all flex items-center justify-center cursor-pointer"
          title="Painel Administrador"
        >
          <Lock className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={handleLogout}
          className="bg-red-500/80 hover:bg-red-600/95 text-white text-[8px] px-2 py-0.5 rounded-full shadow-sm hover:scale-105 transition-all font-medium uppercase tracking-wider"
          title="Sair"
        >
          Sair
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-center bg-brand-paper">
          <div className="flex gap-6">
            <button 
              onClick={() => setActiveTab('products')}
              className={cn("text-2xl font-serif", activeTab === 'products' ? "text-brand-ink" : "text-gray-400")}
            >
              Produtos
            </button>
            <button 
              onClick={() => setActiveTab('leads')}
              className={cn("text-2xl font-serif", activeTab === 'leads' ? "text-brand-ink" : "text-gray-400")}
            >
              Leads ({leads.length})
            </button>
          </div>
          <div className="flex gap-4">
            {activeTab === 'products' && (
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className="bg-brand-wood text-white px-4 py-2 rounded-full text-sm"
              >
                {isAdding ? 'Cancelar' : 'Novo Produto'}
              </button>
            )}
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-500">
              Sair
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-6">
          {activeTab === 'products' ? (
            <>
              {isAdding && (
                <form onSubmit={handleSubmit} className="mb-12 bg-brand-paper/50 p-6 rounded-2xl border border-brand-wood/10">
                  <div className="grid gap-4">
                    <input 
                      type="text" 
                      placeholder="Nome do Produto" 
                      className="w-full p-3 rounded-xl border"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      required
                    />
                    <input 
                      type="url" 
                      placeholder="Link de Afiliado (https://...)" 
                      className="w-full p-3 rounded-xl border"
                      value={formData.affiliateLink}
                      onChange={e => setFormData({...formData, affiliateLink: e.target.value})}
                      required
                    />
                    <input 
                      type="text" 
                      placeholder="URL da Imagem (ou caminho /arquivos/...)" 
                      className="w-full p-3 rounded-xl border"
                      value={formData.imageUrl}
                      onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                      required
                    />
                    <button type="submit" className="bg-brand-wood text-white p-3 rounded-xl font-bold">
                      Salvar Produto
                    </button>
                  </div>
                </form>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {products.map(product => (
                  <div key={product.id} className="flex items-center gap-4 p-4 border rounded-2xl">
                    <img src={product.imageUrl} className="w-16 h-16 object-contain rounded-lg" alt="" />
                    <div className="flex-grow">
                      <h4 className="font-bold text-sm">{product.name}</h4>
                      <p className="text-xs text-gray-400 truncate max-w-[150px]">{product.affiliateLink}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteProduct(product.id!)}
                      className="text-red-400 hover:text-red-600 p-2"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {leads.map(lead => (
                <div key={lead.id} className="flex items-center justify-between p-4 border rounded-2xl bg-brand-paper/30">
                  <div>
                    <h4 className="font-bold">{lead.name}</h4>
                    <p className="text-sm text-brand-wood">{lead.email}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {lead.createdAt?.toDate().toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleDeleteLead(lead.id)}
                    className="text-red-400 hover:text-red-600 p-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {leads.length === 0 && (
                <p className="text-center text-gray-400 py-12">Nenhum lead capturado ainda.</p>
              )}
            </div>
          )}
        </div>
        <button 
          onClick={() => setIsOpen(false)} 
          className="p-4 text-center text-sm text-gray-400 border-t hover:bg-gray-100 transition-colors"
        >
          Fechar Painel
        </button>
      </div>
    </div>
  );
};

const Contact = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Encomenda de Obra');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSendContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus({ type: 'error', text: 'Por favor, preencha todos os campos obrigatórios (Nome, E-mail e Mensagem).' });
      return;
    }

    setIsSending(true);
    setStatus(null);

    try {
      const res = await fetch('/api/send-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim()
        })
      });

      if (res.ok) {
        setStatus({ type: 'success', text: 'Mensagem enviada com sucesso! Andrew responderá em breve.' });
        setName('');
        setEmail('');
        setMessage('');
      } else {
        let errorText = '';
        try {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            errorText = data.error || '';
          } catch {
            errorText = text ? (text.length > 200 ? text.substring(0, 200) + '...' : text) : '';
          }
        } catch {
          errorText = 'Erro de leitura do corpo da resposta.';
        }
        throw new Error(errorText || `Erro Servidor Vercel (Status ${res.status}): Não foi possível enviar a mensagem no momento. Tente novamente.`);
      }
    } catch (err: any) {
      console.error("Erro ao enviar contato:", err);
      setStatus({ type: 'error', text: err.message || 'Houve um problema de rede ou servidor ao enviar seu contato.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section id="contact" className="section-padding bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16">
          <div>
            <h2 className="text-4xl md:text-5xl font-serif mb-8">Vamos criar algo <span className="italic text-brand-wood">único</span>?</h2>
            <p className="text-gray-600 text-lg mb-12 leading-relaxed">
              Disponível para encomendas personalizadas, projetos de escultura, aulas e parcerias artísticas. Entre em contato para orçamentos ou dúvidas.
            </p>
            
            <div className="space-y-5">
              {/* Card E-mail */}
              <a 
                href="mailto:andrewfmlemos@gmail.com"
                className="flex items-center gap-6 p-4 rounded-3xl hover:bg-brand-paper transition-all group"
              >
                <div className="w-14 h-14 bg-brand-paper group-hover:bg-white rounded-2xl flex items-center justify-center text-brand-wood shadow-sm transition-colors border border-brand-wood/5">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">E-mail</div>
                  <div className="text-lg md:text-xl font-medium text-brand-ink group-hover:text-brand-wood transition-colors">andrewfmlemos@gmail.com</div>
                </div>
              </a>

              {/* Card Instagram */}
              <a 
                href="https://www.instagram.com/andrewlemos.art"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-6 p-4 rounded-3xl hover:bg-brand-paper transition-all group"
              >
                <div className="w-14 h-14 bg-brand-paper group-hover:bg-white rounded-2xl flex items-center justify-center text-brand-wood shadow-sm transition-colors border border-brand-wood/5">
                  <Instagram className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">Instagram</div>
                  <div className="text-lg md:text-xl font-medium text-brand-ink group-hover:text-brand-wood transition-colors">@andrewlemos.art</div>
                </div>
              </a>

              {/* Card WhatsApp */}
              <a 
                href="https://wa.me/5519998107110?text=Olá%20Andrew!%20Vi%20o%20seu%20portfólio%20e%20gostaria%20de%20conversar."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-6 p-4 rounded-3xl hover:bg-brand-paper transition-all group"
              >
                <div className="w-14 h-14 bg-brand-paper group-hover:bg-white rounded-2xl flex items-center justify-center text-brand-wood shadow-sm transition-colors border border-brand-wood/5">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">WhatsApp</div>
                  <div className="text-lg md:text-xl font-medium text-brand-ink group-hover:text-brand-wood transition-colors">(19) 99810-7110</div>
                </div>
              </a>
            </div>
          </div>

          <form onSubmit={handleSendContact} className="bg-brand-paper p-10 md:p-12 rounded-[2.5rem] space-y-6 shadow-sm border border-brand-wood/5">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500 ml-1">Nome *</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white border-none rounded-2xl p-4 focus:ring-2 focus:ring-brand-wood outline-none" 
                  placeholder="Seu nome" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500 ml-1">Email *</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white border-none rounded-2xl p-4 focus:ring-2 focus:ring-brand-wood outline-none" 
                  placeholder="seu@email.com" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500 ml-1">Assunto</label>
              <select 
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-white border-none rounded-2xl p-4 focus:ring-2 focus:ring-brand-wood outline-none appearance-none"
              >
                <option value="Encomenda de Obra">Encomenda de Obra</option>
                <option value="Aulas de Arte">Aulas de Arte</option>
                <option value="Parceria">Parceria</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500 ml-1">Mensagem *</label>
              <textarea 
                rows={4} 
                required
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-white border-none rounded-2xl p-4 focus:ring-2 focus:ring-brand-wood outline-none resize-none" 
                placeholder="Como posso ajudar?"
              ></textarea>
            </div>

            {status && (
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed", 
                status.type === 'success' ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
              )}>
                {status.text}
              </div>
            )}

            <button 
              type="submit"
              disabled={isSending}
              className="w-full bg-brand-ink text-white py-5 rounded-2xl font-medium hover:bg-brand-wood disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Enviando...
                </>
              ) : 'Enviar Mensagem'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-brand-paper border-t border-brand-wood/10 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-2">
            <Palette className="text-brand-wood w-6 h-6" />
            <span className="font-serif font-bold text-lg">Andrew Lemos</span>
          </div>
          <p className="text-gray-400 text-sm">© {new Date().getFullYear()} Andrew Lemos. Todos os direitos reservados.</p>
        </div>

        <div className="flex gap-6">
          {[
            { icon: Instagram, href: 'https://www.instagram.com/andrewlemos.art' },
            { icon: MessageCircle, href: 'https://wa.me/5519998107110?text=Olá%20Andrew!%20Vi%20o%20seu%20portfólio%20e%20gostaria%20de%20conversar.' },
            { icon: Youtube, href: 'https://www.youtube.com/@DoL%C3%A1pisaoA%C3%A7o' },
          ].map((social, i) => (
            <a 
              key={i} 
              href={social.href} 
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 rounded-full border border-brand-wood/20 flex items-center justify-center text-brand-wood hover:bg-brand-wood hover:text-white transition-all animate-fade-in"
            >
              <social.icon className="w-5 h-5" />
            </a>
          ))}
        </div>

        <div className="text-sm text-gray-400">
          Pirassununga, SP — Brasil
        </div>
      </div>
    </footer>
  );
};

const Publications = () => {
  const publications = [
    { title: 'Publicação em Livro de Arte', img: '/arquivos/Screenshot_20230425_211524_WhatsAppBusiness.jpg' },
    { title: 'Parabenização SUTACO', img: '/arquivos/Screenshot_20230606_194612_Instagram.jpg' },
    { title: 'Publicação em Jornal', img: '/arquivos/Screenshot_20230624_181044_Samsung Notes.jpg' },
  ];

  return (
    <section id="publications" className="section-padding bg-brand-paper">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif mb-4">Publicações e Mídia</h2>
          <p className="text-gray-500">Reconhecimento do trabalho em jornais, livros e mídias sociais.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {publications.map((pub, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="bg-white p-4 rounded-2xl shadow-sm border border-brand-wood/5"
            >
              <div className="aspect-[4/5] rounded-xl overflow-hidden mb-4">
                <img src={pub.img} alt={pub.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <h3 className="text-center font-serif text-brand-wood">{pub.title}</h3>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: 'Saudações, nobre entusiasta das artes! Eu sou MichelangelIA, seu mestre digital e guia neste vasto universo da criação. Em que posso iluminar sua jornada artística hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    const chatHistory = messages
      .filter((m, i) => !(i === 0 && m.role === 'model'))
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

    let responseText = "";
    let backendSuccess = false;

    // 1. Tenta se comunicar via Rota Segura do Backend (/api/chat) para proteger a chave de API
    try {
      const serverRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history: chatHistory }),
      });

      if (serverRes.ok) {
        const data = await serverRes.json();
        responseText = data.text;
        backendSuccess = true;
      } else if (serverRes.status !== 404) {
        const data = await serverRes.json().catch(() => ({}));
        throw new Error(data.error || `Erro de Servidor HTTP ${serverRes.status}`);
      }
    } catch (serverErr: any) {
      console.warn("Rota de chat do servidor falhou ou não existe. Usando fallback no cliente. Detalhes:", serverErr.message);
    }

    // 2. Fallback no cliente: Caso o servidor esteja offline ou em provedor estático puro sem Express (Vercel/Amplify)
    if (!backendSuccess) {
      try {
        const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("Chave do Gemini não encontrada. Defina GEMINI_API_KEY em Secrets (AI Studio) ou VITE_GEMINI_API_KEY no painel do Vercel/Amplify.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: [...chatHistory, { role: 'user', parts: [{ text: userMessage }] }],
          config: {
            systemInstruction: "Você é MichelangelIA, um mestre de artes erudito, apaixonado e inspirador. Você fala com elegância e autoridade sobre artes plásticas, escultura, entalhe, desenho e pintura. Seu objetivo é instruir e inspirar. Você deve agir e falar como um mestre de artes clássico. IMPORTANTE: Fale APENAS sobre assuntos relacionados a arte. Se o usuário perguntar sobre outros temas, gentilmente redirecione a conversa para o mundo das artes, dizendo que sua alma pertence apenas à criação e à beleza."
          }
        });

        responseText = response.text || "Minha alma está momentaneamente em silêncio, nobre aprendiz. Tente novamente em breve.";
      } catch (clientErr: any) {
        console.error("Erro no MichelangelIA (Client-side):", clientErr);
        const errorMsg = clientErr?.message || String(clientErr);
        responseText = `Desculpe, meus pensamentos se dispersaram (Erro: ${errorMsg}). Poderia repetir sua pergunta, caro entusiasta?`;
      }
    }

    setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    setIsLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-20 right-0 w-[350px] md:w-[400px] h-[500px] bg-white rounded-3xl shadow-2xl border border-brand-wood/10 flex flex-col overflow-hidden"
          >
            <div className="bg-brand-wood p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Brush className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold">MichelangelIA</h3>
                  <p className="text-xs text-white/70">Mestre de Artes</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-brand-paper/30">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                    m.role === 'user' ? "bg-brand-wood text-white rounded-tr-none" : "bg-white text-gray-700 rounded-tl-none border border-brand-wood/5"
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-brand-wood/5 flex gap-1">
                    <span className="w-1.5 h-1.5 bg-brand-wood/40 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-brand-wood/40 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-brand-wood/40 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-brand-wood/5 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Pergunte ao mestre..."
                className="flex-grow bg-brand-paper/50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-wood outline-none"
              />
              <button 
                onClick={sendMessage}
                disabled={isLoading}
                className="bg-brand-wood text-white p-3 rounded-xl hover:bg-brand-clay transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-brand-wood text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all active:scale-95 group"
      >
        {isOpen ? <X className="w-7 h-7" /> : <MessageCircle className="w-7 h-7 group-hover:rotate-12 transition-transform" />}
      </button>
    </div>
  );
};

export default function App() {
  return (
    <div className="min-h-screen selection:bg-brand-wood selection:text-white">
      <Navbar />
      <Hero />
      <Biography />
      <Expertise />
      <Gallery />
      <YouTubeSection />
      <Publications />
      <ClassesSection />
      <OnlineCoursesSection />
      <RecommendedProductsSection />
      <Contact />
      <Footer />
      <Chatbot />
      <AdminDashboard />
    </div>
  );
}
