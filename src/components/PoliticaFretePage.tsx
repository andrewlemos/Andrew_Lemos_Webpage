import React from 'react';
import { ArrowLeft, Truck, Clock, MapPin, Search, AlertTriangle, ShieldAlert, Mail } from 'lucide-react';

interface PoliticaFretePageProps {
  onNavigateToView: (view: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm' | 'customer-area' | 'avaliar' | 'blog' | 'blog-post' | 'galeria-item' | 'vendas-item' | 'politica-devolucao' | 'politica-frete' | 'termos-de-uso' | 'politica-privacidade') => void;
}

export const PoliticaFretePage: React.FC<PoliticaFretePageProps> = ({ onNavigateToView }) => {
  return (
    <div id="politica-frete-view" className="min-h-screen bg-brand-paper py-16 px-6 md:py-24">
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
              Política de Frete
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs md:text-sm text-gray-500 font-mono mt-2">
              <span className="flex items-center gap-1.5 bg-brand-wood/5 px-3 py-1 rounded-full border border-brand-wood/10">
                Última atualização: Junho de 2026
              </span>
            </div>
          </div>

          <p className="text-gray-700 text-base md:text-lg leading-relaxed mb-8">
            Na <strong>Andrew Lemos Escultura e Desenho</strong>, cada peça é produzida com cuidado artesanal e enviada com o máximo de proteção para garantir que chegue em perfeitas condições ao destino.
          </p>

          <div className="space-y-8 text-gray-700 text-sm md:text-base leading-relaxed">
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-wood" />
                1. Área de Entrega
              </h2>
              <p className="mb-4">
                Realizamos envios para todo o território nacional.
              </p>
              <p>
                Caso haja interesse em envio internacional, o cliente deverá entrar em contato previamente para consulta de disponibilidade e custos.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand-wood" />
                2. Prazo de Produção
              </h2>
              <p className="mb-4">
                Produtos disponíveis em estoque serão preparados para envio após a confirmação do pagamento.
              </p>
              <p>
                Produtos personalizados ou produzidos sob encomenda possuem prazo de fabricação variável, informado na descrição do produto ou acordado previamente com o cliente.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-brand-wood" />
                3. Prazo de Entrega
              </h2>
              <p className="mb-4">
                O prazo de entrega depende da localidade do destinatário e da modalidade de transporte selecionada.
              </p>
              <p>
                Os prazos informados pelas transportadoras ou Correios são estimativas e podem sofrer alterações por fatores externos.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-brand-wood" />
                4. Rastreamento
              </h2>
              <p>
                Sempre que disponível, o cliente receberá informações para acompanhar o envio de seu pedido.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-brand-wood" />
                5. Endereço de Entrega
              </h2>
              <p className="mb-4">
                É responsabilidade do cliente fornecer corretamente os dados de entrega.
              </p>
              <p>
                A loja não se responsabiliza por atrasos ou devoluções causados por endereço incorreto ou incompleto informado no momento da compra.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-brand-wood" />
                6. Atrasos de Transporte
              </h2>
              <p>
                Eventuais atrasos decorrentes de greves, condições climáticas, problemas logísticos, restrições regionais ou outras situações fora do controle da loja não geram direito automático a indenizações.
              </p>
            </section>

            <section className="bg-brand-wood/5 border border-brand-wood/10 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand-wood" />
                7. Danos Durante o Transporte
              </h2>
              <p className="mb-4">
                Caso o produto chegue com avarias apresentadas na entrega, recomenda-se registrar imagens da embalagem e do produto e entrar em contato imediatamente através do e-mail:
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
      </div>
    </div>
  );
};
