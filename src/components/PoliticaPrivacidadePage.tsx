import React from 'react';
import { ArrowLeft, Key, Database, Share2, HelpCircle, Eye, Shield, Mail } from 'lucide-react';

interface PoliticaPrivacidadePageProps {
  onNavigateToView: (view: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm' | 'customer-area' | 'avaliar' | 'blog' | 'blog-post' | 'galeria-item' | 'vendas-item' | 'politica-devolucao' | 'politica-frete' | 'termos-de-uso' | 'politica-privacidade') => void;
}

export const PoliticaPrivacidadePage: React.FC<PoliticaPrivacidadePageProps> = ({ onNavigateToView }) => {
  return (
    <div id="politica-privacidade-view" className="min-h-screen bg-brand-paper py-16 px-6 md:py-24">
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
              Política de Privacidade
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs md:text-sm text-gray-500 font-mono mt-2">
              <span className="flex items-center gap-1.5 bg-brand-wood/5 px-3 py-1 rounded-full border border-brand-wood/10">
                Última atualização: Junho de 2026
              </span>
            </div>
          </div>

          <p className="text-gray-700 text-base md:text-lg leading-relaxed mb-8">
            A proteção das informações dos visitantes é uma prioridade para a <strong>Andrew Lemos Arte em Madeira</strong>.
          </p>

          <div className="space-y-8 text-gray-700 text-sm md:text-base leading-relaxed">
            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-brand-wood" />
                1. Dados Coletados
              </h2>
              <p className="mb-3">Podem ser coletados:</p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>Nome</li>
                <li>E-mail</li>
                <li>Telefone</li>
                <li>Endereço</li>
                <li>Informações necessárias para processamento de pedidos</li>
                <li>Dados estatísticos de navegação</li>
              </ul>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-wood" />
                2. Finalidade da Coleta
              </h2>
              <p className="mb-3 font-semibold">Os dados coletados são utilizados para:</p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>Atendimento ao cliente</li>
                <li>Processamento de compras</li>
                <li>Comunicação relacionada a pedidos</li>
                <li>Melhorias no funcionamento do site</li>
                <li>Segurança da plataforma</li>
              </ul>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-brand-wood" />
                3. Compartilhamento de Dados
              </h2>
              <p className="mb-4">
                Os dados não são vendidos ou comercializados.
              </p>
              <p className="mb-3 font-semibold">Poderão ser compartilhados apenas quando necessário para:</p>
              <ul className="list-disc pl-6 space-y-1.5">
                <li>Processamento de pagamentos</li>
                <li>Hospedagem e infraestrutura tecnológica</li>
                <li>Serviços de entrega</li>
                <li>Cumprimento de obrigações legais</li>
              </ul>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-brand-wood" />
                4. Cookies
              </h2>
              <p>
                O site poderá utilizar cookies para melhorar a experiência do usuário, analisar estatísticas de acesso e otimizar funcionalidades.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-brand-wood" />
                5. Segurança
              </h2>
              <p>
                São adotadas medidas técnicas razoáveis para proteger os dados armazenados contra acessos não autorizados.
              </p>
            </section>

            <section className="bg-white/50 border border-brand-wood/5 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-wood" />
                6. Direitos do Usuário
              </h2>
              <p>
                O usuário poderá solicitar atualização, correção ou exclusão de seus dados pessoais quando aplicável pela legislação vigente.
              </p>
            </section>

            <section className="bg-brand-wood/5 border border-brand-wood/10 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-serif font-bold text-brand-ink mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-brand-wood" />
                7. Contato
              </h2>
              <p className="mb-4">
                Dúvidas relacionadas à privacidade e proteção de dados podem ser enviadas para:
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
