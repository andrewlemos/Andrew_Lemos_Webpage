import React from 'react';
import { ArrowLeft, RefreshCw, Undo2, ShieldCheck, Mail, Calendar } from 'lucide-react';

interface PoliticaDevolucaoPageProps {
  onNavigateToView: (view: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm' | 'customer-area' | 'avaliar' | 'blog' | 'blog-post' | 'galeria-item' | 'vendas-item' | 'politica-devolucao') => void;
}

export const PoliticaDevolucaoPage: React.FC<PoliticaDevolucaoPageProps> = ({ onNavigateToView }) => {
  return (
    <div id="politica-devolucao-view" className="min-h-screen bg-brand-paper py-16 px-6 md:py-24">
      <div className="max-w-4xl mx-auto">
        {/* Back navigation button */}
        <button
          onClick={() => onNavigateToView('landing')}
          className="mb-8 flex items-center gap-2 text-brand-wood hover:text-brand-ink transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium text-sm md:text-base">Voltar ao Início</span>
        </button>

        {/* Content Container */}
        <article className="bg-[#FAF9F5]/40 border border-brand-wood/10 rounded-3xl p-8 md:p-12 shadow-sm">
          {/* Header */}
          <div className="border-b border-brand-wood/10 pb-8 mb-10 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-brand-ink mb-4 tracking-tight leading-tight">
              Política de Devolução e Reembolso
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs md:text-sm text-gray-500 font-mono mt-2">
              <span className="flex items-center gap-1.5 bg-brand-wood/5 px-3 py-1 rounded-full border border-brand-wood/10">
                <Calendar className="w-4 h-4 text-brand-wood" />
                Última atualização: Junho de 2026
              </span>
              <span className="flex items-center gap-1.5 bg-brand-wood/5 px-3 py-1 rounded-full border border-brand-wood/10">
                <ShieldCheck className="w-4 h-4 text-brand-wood" />
                Pinterest Merchant Center Compliant
              </span>
            </div>
          </div>

          {/* Intro text */}
          <p className="text-gray-700 text-base md:text-lg leading-relaxed mb-8">
            Na <strong>Andrew Lemos Escultura e Desenho</strong>, cada obra é produzida artesanalmente, com atenção individual aos detalhes, utilizando técnicas tradicionais de escultura, entalhe, desenho e pirografia. Nosso objetivo é garantir total transparência e segurança aos clientes.
          </p>

          {/* Standard sections */}
          <div className="space-y-10 text-gray-700 text-sm md:text-base leading-relaxed">
            {/* Section 1 */}
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-brand-wood rounded-full inline-block"></span>
                Direito de Arrependimento
              </h2>
              <p className="mb-4">
                Conforme o Código de Defesa do Consumidor brasileiro, compras realizadas pela internet podem ser canceladas em até <strong>7 (sete) dias corridos</strong> após o recebimento do produto.
              </p>
              <p>
                Dentro desse prazo, o cliente poderá solicitar devolução e reembolso integral.
              </p>
            </section>

            {/* Section 2 */}
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-brand-wood rounded-full inline-block"></span>
                Condições para Devolução
              </h2>
              <p className="mb-4">
                Para que a devolução seja aprovada, o produto deverá:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Estar nas mesmas condições em que foi recebido.</li>
                <li>Não apresentar danos causados por uso inadequado.</li>
                <li>Ser devolvido com sua embalagem original sempre que possível.</li>
                <li>Estar acompanhado dos acessórios enviados.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-brand-wood rounded-full inline-block"></span>
                Produtos Personalizados
              </h2>
              <p>
                Obras produzidas sob encomenda, personalizadas ou desenvolvidas exclusivamente para um cliente poderão não ser elegíveis para devolução por arrependimento após o início da produção, exceto nos casos previstos pela legislação aplicável ou quando houver defeito de fabricação.
              </p>
            </section>

            {/* Section 4 */}
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-brand-wood rounded-full inline-block"></span>
                Produtos Danificados no Transporte
              </h2>
              <p className="mb-4">
                Caso o produto chegue danificado, o cliente deverá entrar em contato em até 7 dias após o recebimento enviando fotografias da embalagem e do produto para análise.
              </p>
              <p className="mb-4">
                Após a confirmação do problema, será oferecida uma das seguintes soluções:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Reembolso integral.</li>
                <li>Substituição da peça quando possível.</li>
                <li>Crédito para nova compra.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-brand-wood rounded-full inline-block"></span>
                Processo de Solicitação
              </h2>
              <p className="mb-4">
                Para iniciar uma solicitação de devolução ou reembolso, envie um e-mail para:
              </p>
              <div className="bg-brand-wood/5 border border-brand-wood/10 rounded-xl p-4 flex items-center gap-3 mb-4">
                <Mail className="w-5 h-5 text-brand-wood flex-shrink-0" />
                <a href="mailto:andrewlemos@outlook.com.br" className="font-mono text-brand-ink hover:underline break-all">
                  andrewlemos@outlook.com.br
                </a>
              </div>
              <p className="mb-2 font-semibold">Informando:</p>
              <ul className="list-decimal pl-6 space-y-1.5">
                <li>Nome completo.</li>
                <li>Número do pedido.</li>
                <li>Motivo da solicitação.</li>
                <li>Fotografias do produto quando necessário.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-brand-wood rounded-full inline-block"></span>
                Prazo de Análise
              </h2>
              <p>
                As solicitações serão analisadas em até <strong>5 dias úteis</strong> após o recebimento das informações necessárias.
              </p>
            </section>

            {/* Section 7 */}
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-brand-wood rounded-full inline-block"></span>
                Reembolso
              </h2>
              <p className="mb-4">
                Quando aprovado, o reembolso será realizado pelo mesmo método de pagamento utilizado na compra.
              </p>
              <p>
                O prazo para processamento poderá variar conforme a operadora de pagamento, banco ou administradora do cartão.
              </p>
            </section>

            {/* Section 8 */}
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-brand-wood rounded-full inline-block"></span>
                Frete de Devolução
              </h2>
              <p className="mb-4">
                Quando a devolução ocorrer por defeito, dano de transporte ou erro no envio, os custos de devolução serão integralmente cobertos pela loja.
              </p>
              <p>
                Nos casos de arrependimento dentro do prazo legal, o processo seguirá a legislação aplicável vigentes.
              </p>
            </section>

            {/* Section 9 */}
            <section className="bg-brand-wood/5 border border-brand-wood/10 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-brand-wood rounded-full inline-block"></span>
                Contato
              </h2>
              <p className="mb-4">
                Dúvidas relacionadas a devoluções, reembolsos ou trocas podem ser enviadas a qualquer momento para:
              </p>
              <div className="bg-white border border-brand-wood/10 rounded-xl p-4 inline-flex items-center gap-3">
                <Mail className="w-5 h-5 text-brand-wood flex-shrink-0" />
                <a href="mailto:andrewlemos@outlook.com.br" className="font-mono text-brand-ink hover:underline break-all">
                  andrewlemos@outlook.com.br
                </a>
              </div>
            </section>
          </div>
        </article>

        {/* Footer Navigation Link back to top or home */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={() => {
              onNavigateToView('landing');
            }}
            className="px-6 py-3 bg-brand-wood text-white rounded-full text-sm font-medium hover:bg-brand-ink transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
            Voltar para a Página Principal
          </button>
        </div>
      </div>
    </div>
  );
};
