import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { Star, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface CustomerReviewFormProps {
  orderId: string;
  conviteId?: string;
  onNavigateToView: (view: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm' | 'customer-area' | 'avaliar', id?: string) => void;
}

export function CustomerReviewForm({ orderId, conviteId, onNavigateToView }: CustomerReviewFormProps) {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any | null>(null);
  const [invite, setInvite] = useState<any | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetails() {
      setError(null);
      if (!orderId && !conviteId) {
        setLoading(false);
        return;
      }
      try {
        if (orderId) {
          const orderRef = doc(db, 'ecom_orders', orderId);
          const snap = await getDoc(orderRef);
          if (snap.exists()) {
            setOrder(snap.data());
          } else {
            setError('Pedido não encontrado no ateliê. Verifique o código em seu e-mail.');
          }
        } else if (conviteId) {
          const inviteRef = doc(db, 'ecom_review_invitations', conviteId);
          const snap = await getDoc(inviteRef);
          if (snap.exists()) {
            setInvite(snap.data());
          } else {
            setError('Convite de avaliação não localizado ou expirado.');
          }
        }
      } catch (err: any) {
        console.error('Error fetching review details:', err);
        setError('Ocorreu um erro ao carregar as informações necessárias para avaliar.');
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [orderId, conviteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError('Por favor, escreva um comentário sobre sua experiência.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const name = order?.customerInfo?.name || invite?.customerName || 'Cliente do Ateliê';
      const email = order?.customerInfo?.email || invite?.customerEmail || '';

      await addDoc(collection(db, 'ecom_reviews'), {
        orderId: orderId || '',
        customerName: name,
        customerEmail: email,
        comment: comment.trim(),
        rating,
        status: 'Pendente',
        origem: orderId ? 'Pedido' : 'Manual',
        invitationId: conviteId || null,
        createdAt: new Date().toISOString()
      });

      // Update manual invitation if respondido
      if (conviteId) {
        try {
          const inviteRef = doc(db, 'ecom_review_invitations', conviteId);
          await updateDoc(inviteRef, {
            status: 'Respondida',
            updatedAt: new Date().toISOString()
          });
        } catch (inviteErr) {
          console.warn('Failed to mark invitation as Respondida:', inviteErr);
        }
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error('Error saving review:', err);
      setError('Não foi possível registrar seu depoimento no momento. Tente novamente mais tarde.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-paper flex flex-col items-center justify-center p-6">
        <Loader2 className="w-12 h-12 text-brand-wood animate-spin mb-4" />
        <p className="text-gray-500 font-serif">Carregando informações da sua avaliação...</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-brand-paper flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md bg-white p-8 rounded-2xl border border-brand-wood/10 shadow-lg"
        >
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-6" />
          <h2 className="text-3xl font-serif text-brand-ink mb-4">Depoimento Registrado!</h2>
          <p className="text-gray-650 leading-relaxed mb-6">
            Olá, <span className="font-bold">{order?.customerInfo?.name || invite?.customerName}</span>! Agradecemos imensamente por compartilhar sua avaliação. 
            Como cada obra é única, seu carinho motiva o artista a se dedicar ainda mais. 
            Seu comentário foi recebido e em breve poderá ser exposto em nosso carrossel de depoimentos.
          </p>
          <button
            onClick={() => onNavigateToView('landing')}
            className="px-6 py-3 bg-brand-wood text-white font-bold rounded-lg hover:bg-brand-wood/90 transition-all font-sans cursor-pointer h-[44px]"
          >
            Voltar ao Ateliê
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-paper py-12 px-6 flex flex-col items-center">
      <div className="w-full max-w-xl">
        <button
          onClick={() => onNavigateToView('landing')}
          className="mb-8 flex items-center gap-2 text-gray-500 hover:text-brand-wood text-sm transition-colors cursor-pointer outline-none"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Ateliê
        </button>

        {error && !order && !invite ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-xl text-center font-sans shadow-sm">
            <p className="font-semibold text-base">{error}</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-brand-wood/10 shadow-lg p-8"
          >
            <div className="text-center pb-6 border-b border-gray-100 mb-6">
              <span className="text-xs uppercase tracking-wider font-semibold text-brand-wood">Pós-venda</span>
              <h1 className="text-3xl font-serif text-brand-ink mt-1">Como foi sua experiência?</h1>
              {orderId ? (
                <p className="text-gray-500 text-xs mt-2 font-mono">Pedido: {orderId}</p>
              ) : (
                <p className="text-gray-500 text-xs mt-2 font-mono">Depoimento de: {invite?.customerName}</p>
              )}
            </div>

            {order && (
              <div className="bg-brand-paper p-4 rounded-xl mb-6">
                <p className="text-xs text-brand-wood font-bold uppercase tracking-wider mb-2">Sua Obra Adquirida:</p>
                <ul className="text-sm text-gray-650 space-y-1">
                  {order.items?.map((item: any, idx: number) => (
                    <li key={idx} className="flex justify-between font-sans">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-450">Qtd: {item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-brand-ink mb-2">
                  Selecione sua nota de satisfação:
                </label>
                <div id="star-selector" className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(null)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          star <= (hoveredRating ?? rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-gray-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-3 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {rating === 5 ? 'Excelente!' : rating === 4 ? 'Muito bom' : rating === 3 ? 'Bom' : rating === 2 ? 'Regular' : 'Ruim'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-brand-ink mb-2">
                  Deixe seu depoimento ou comentário sobre o atendimento e obviedade da obra:
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={5}
                  placeholder="Escreva como o produto chegou, se gostou do acabamento, do envio, etc. Seu comentário inspira outros colecionadores!"
                  className="w-full rounded-xl border border-gray-200 p-4 text-sm text-brand-ink focus:border-brand-wood focus:ring-1 focus:ring-brand-wood/20 outline-none transition-all resize-none"
                  maxLength={1500}
                  required
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-gray-400">Máximo: 1500 caracteres</span>
                  <span className="text-[10px] text-gray-400 font-mono">{comment.length}/1500</span>
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-850 p-3 rounded-xl text-xs font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-brand-wood hover:bg-brand-wood/90 text-white font-bold py-3.5 px-6 rounded-xl transition-all cursor-pointer disabled:opacity-50 h-[48px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando Depoimento...
                  </>
                ) : (
                  'Enviar Depoimento de Avaliação'
                )}
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
