import React from 'react';
import { ArrowLeft, BookOpen, Scale, HelpCircle, AlertCircle, Edit, ShieldCheck } from 'lucide-react';

interface TermosUsoPageProps {
  onNavigateToView: (view: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm' | 'customer-area' | 'avaliar' | 'blog' | 'blog-post' | 'galeria-item' | 'vendas-item' | 'politica-devolucao' | 'politica-frete' | 'termos-de-uso' | 'politica-privacidade') => void;
}

export const TermosUsoPage: React.FC<TermosUsoPageProps> = ({ onNavigateToView }) => {
  return (
    <div id="termos-uso-view" className="min-h-screen bg-brand-paper py-16 px-6 md:py-24">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => onNavigateToView('landing')}
          className="mb-8 flex items-center gap-2 text-brand-wood hover:text-brand-ink transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium text-sm md:text-base">Voltar ao Início</span>
        </button>

        <article className="bg-[#FAF9F5]/40 border border-brand-wood/10 rounded-3xl p-8 md:p-12 shadow-sm">
          <div className="border-b border-brand-wood/10 pb-8 mb-10 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-brand-ink mb-4 tracking-tight leading-tight">
              Termos de Uso
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs md:text-sm text-gray-500 font-mono mt-2">
              <span className="flex items-center gap-1.5 bg-brand-wood/5 px-3 py-1 rounded-full border border-brand-wood/10">
                Última atualização: Junho de 2026
              </span>
            </div>
          </div>

          <p className="text-gray-700 text-base md:text-lg leading-relaxed mb-8">
            Ao acessar e utilizar o site <strong>andrewlemos.com</strong>, o usuário concorda com os presentes Termos de Uso.
          </p>

          <div className="space-y-8 text-gray-700 text-sm md:text-base leading-relaxed">
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-wood" />
                1. Objeto
              </h2>
              <p>
                O site apresenta conteúdos relacionados à arte, escultura, entalhe em madeira, desenho, pirografia, portfólio profissional, artigos educativos e comercialização de obras artesanais.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-wood" />
                2. Propriedade Intelectual
              </h2>
              <p className="mb-4">
                Todo o conteúdo disponível no site, incluindo textos, fotografias, esculturas, desenhos, logotipos, imagens e materiais gráficos, é protegido pela legislação de direitos autorais.
              </p>
              <p>
                É proibida a reprodução, distribuição ou utilização comercial sem autorização prévia por escrito.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Edit className="w-5 h-5 text-brand-wood" />
                3. Produtos Artesanais
              </h2>
              <p>
                Por se tratar de obras produzidas artesanalmente, pequenas variações de cor, textura, veios da madeira, tonalidade e acabamento podem ocorrer naturalmente, sem caracterizar defeito.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-wood" />
                4. Responsabilidades do Usuário
              </h2>
              <p>
                O usuário compromete-se a utilizar o site de forma ética, legal e respeitosa, não realizando atividades que possam comprometer a segurança ou o funcionamento da plataforma.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-brand-wood" />
                5. Limitação de Responsabilidade
              </h2>
              <p>
                A Andrew Lemos Escultura e Desenho não se responsabiliza por prejuízos decorrentes do uso inadequado dos produtos adquiridos.
              </p>
            </section>

            <section className="bg-brand-wood/5 border border-brand-wood/10 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-brand-wood" />
                6. Alterações
              </h2>
              <p>
                Estes Termos de Uso poderão ser atualizados periodicamente para refletir mudanças operacionais, legais ou técnicas.
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
};
