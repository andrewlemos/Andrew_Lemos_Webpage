import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EcomReview } from '../types';

export function ReviewCarousel() {
  const [reviews, setReviews] = useState<EcomReview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const q = query(collection(db, 'ecom_reviews'), where('status', '==', 'Aprovada'));
        const snap = await getDocs(q);
        const list: EcomReview[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as EcomReview);
        });

        // Safely sort in memory to avoid needing a Firestore composite index
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setReviews(list);
      } catch (err) {
        console.error('Failed to load approved reviews:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, []);

  // Auto-advance reviews
  useEffect(() => {
    if (reviews.length <= 1) return;
    const interval = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex, reviews.length]);

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev === 0 ? reviews.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev === reviews.length - 1 ? 0 : prev + 1));
  };

  // If loading or empty, do not render or take any layout space
  if (loading || reviews.length === 0) {
    return null;
  }

  const activeReview = reviews[currentIndex];

  // Variants for lateral slide transition
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 100 : -100,
      opacity: 0
    })
  };

  return (
    <section className="py-16 bg-[#FAF9F5] border-t border-brand-wood/10 overflow-hidden">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div className="flex justify-center mb-4">
          <Quote className="w-10 h-10 text-brand-wood/20 rotate-180" />
        </div>
        
        <h2 className="text-3xl md:text-4xl font-serif text-brand-ink mb-2">
          Depoimentos de Colecionadores
        </h2>
        <p className="text-gray-500 text-xs md:text-sm mb-12 uppercase tracking-widest font-semibold">
          O que dizem os clientes do Ateliê
        </p>

        {/* Carousel Container */}
        <div className="relative min-h-[220px] sm:min-h-[180px] flex items-center justify-center px-8 md:px-16 mb-8">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.25 }
              }}
              className="w-full flex flex-col items-center"
            >
              <div className="flex gap-1 mb-4 justify-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < activeReview.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                    }`}
                  />
                ))}
              </div>

              <p className="text-base md:text-lg text-brand-ink font-sans italic leading-relaxed max-w-2xl text-center mb-6">
                "{activeReview.comment}"
              </p>

              <div className="font-sans text-center">
                <span className="font-semibold text-brand-wood block text-sm">
                  {activeReview.customerName}
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block mt-1">
                  Adquirente do Ateliê
                </span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          {reviews.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-0 p-2 text-gray-400 hover:text-brand-wood transition-colors cursor-pointer outline-none select-none rounded-full border border-gray-100 bg-white hover:bg-gray-50 shadow-sm"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-0 p-2 text-gray-400 hover:text-brand-wood transition-colors cursor-pointer outline-none select-none rounded-full border border-gray-100 bg-white hover:bg-gray-50 shadow-sm"
                aria-label="Próximo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Direct Dot Indicators */}
        {reviews.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-4">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDirection(i > currentIndex ? 1 : -1);
                  setCurrentIndex(i);
                }}
                className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all duration-300 ${
                  i === currentIndex ? 'bg-brand-wood w-5' : 'bg-gray-200 hover:bg-gray-350'
                }`}
                aria-label={`Ir para slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
