import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ensureRobustUrl } from '../App';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: 'blog' | 'chat' | 'default';
  isDark?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '', 
  variant = 'default',
  isDark = false
}) => {
  const isChat = variant === 'chat';

  // Headings color: white/stone on dark, brand-ink on light
  const hColor = isDark ? "text-stone-100" : "text-brand-ink";
  // Paragraph/list color: light gray on dark, dark gray on light
  const pColor = isDark ? "text-stone-300" : "text-gray-600";
  // Link color: gold on dark, brand wood on light
  const linkColor = isDark ? "text-[#D4AF37] hover:text-yellow-300" : "text-brand-wood hover:underline";
  // Blockquote styles
  const bqStyles = isDark 
    ? "border-l-4 border-stone-700 italic pl-4 py-1 my-6 bg-stone-900/60 rounded text-stone-300"
    : "border-l-4 border-brand-wood/30 italic pl-4 py-1 my-6 bg-brand-paper rounded text-gray-650";

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({node, ...props}) => (
            <h1 className={isChat 
              ? `text-base font-serif font-bold mt-3 mb-1 border-b pb-1 border-stone-800 ${isDark ? 'text-stone-100' : 'text-brand-ink'}` 
              : `text-2xl sm:text-3xl font-serif ${hColor} mt-8 mb-4 font-bold border-b pb-2`} 
              {...props} 
            />
          ),
          h2: ({node, ...props}) => (
            <h2 className={isChat 
              ? `text-sm font-serif font-semibold mt-2 mb-1 ${isDark ? 'text-stone-200' : 'text-brand-ink'}` 
              : `text-xl sm:text-2xl font-serif ${hColor} mt-6 mb-3 font-semibold`} 
              {...props} 
            />
          ),
          h3: ({node, ...props}) => (
            <h3 className={isChat 
              ? `text-xs font-serif font-medium mt-2 mb-1 ${isDark ? 'text-stone-300' : 'text-brand-ink'}` 
              : `text-lg font-serif ${hColor} mt-4 mb-2 font-medium`} 
              {...props} 
            />
          ),
          p: ({node, ...props}) => (
            <p className={isChat 
              ? "leading-relaxed mb-3 font-normal" 
              : `${pColor} leading-relaxed text-sm sm:text-base mb-6 font-normal`} 
              {...props} 
            />
          ),
          ul: ({node, ...props}) => (
            <ul className={isChat 
              ? "list-disc pl-4 mt-1 mb-3 space-y-1" 
              : `list-disc pl-5 mt-2 mb-6 ${pColor} text-sm sm:text-base space-y-2`} 
              {...props} 
            />
          ),
          ol: ({node, ...props}) => (
            <ol className={isChat 
              ? "list-decimal pl-4 mt-1 mb-3 space-y-1" 
              : `list-decimal pl-5 mt-2 mb-6 ${pColor} text-sm sm:text-base space-y-2`} 
              {...props} 
            />
          ),
          li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
          blockquote: ({node, ...props}) => (
            <blockquote className={isChat 
              ? "border-l-2 border-stone-600 italic pl-3 py-0.5 my-3 bg-stone-900/40 rounded text-stone-300" 
              : bqStyles} 
              {...props} 
            />
          ),
          a: ({node, ...props}) => (
            <a className={isChat 
              ? "text-yellow-400 hover:underline font-semibold" 
              : `${linkColor} font-semibold`} 
              {...props} 
            />
          ),
          img: ({node, src, alt, ...props}) => (
            <div className="my-4 flex flex-col items-center">
              <img 
                src={ensureRobustUrl(src || '')} 
                alt={alt} 
                className="rounded-2xl max-h-[300px] object-cover border border-brand-wood/10" 
                referrerPolicy="no-referrer"
                {...props} 
              />
              {alt && <span className="text-[10px] text-gray-400 mt-1 italic font-sans">{alt}</span>}
            </div>
          ),
          // Clean table wrappers and styling
          table: ({node, ...props}) => (
            <div className={`overflow-x-auto my-6 border rounded-xl shadow-sm ${
              isDark ? 'border-stone-800 bg-stone-950/20' : 'border-stone-200 bg-white'
            }`}>
              <table className="w-full border-collapse text-left text-xs sm:text-sm" {...props} />
            </div>
          ),
          thead: ({node, ...props}) => (
            <thead className={isDark ? 'bg-stone-900/80' : 'bg-stone-100/80'} {...props} />
          ),
          tbody: ({node, ...props}) => <tbody {...props} />,
          tr: ({node, ...props}) => (
            <tr className={`border-b transition-colors ${
              isDark 
                ? 'border-stone-900 hover:bg-stone-900/30 odd:bg-stone-950/40 even:bg-stone-900/10' 
                : 'border-stone-200 hover:bg-stone-50/50 odd:bg-white even:bg-stone-50/30'
            }`} {...props} />
          ),
          th: ({node, ...props}) => (
            <th className={`px-4 py-3 font-semibold font-serif border-b ${
              isDark ? 'text-stone-100 border-stone-800' : 'text-neutral-800 border-stone-200'
            }`} {...props} />
          ),
          td: ({node, ...props}) => (
            <td className={`px-4 py-3 align-top leading-relaxed ${
              isDark ? 'text-stone-300' : 'text-gray-700'
            }`} {...props} />
          )
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
};
