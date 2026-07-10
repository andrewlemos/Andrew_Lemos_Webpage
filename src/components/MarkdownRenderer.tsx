import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ensureRobustUrl } from '../App';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: 'blog' | 'chat' | 'default';
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '', 
  variant = 'default' 
}) => {
  const isChat = variant === 'chat';

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({node, ...props}) => (
            <h1 className={isChat 
              ? "text-base font-serif font-bold mt-3 mb-1 border-b pb-1 border-stone-800" 
              : "text-2xl sm:text-3xl font-serif text-brand-ink mt-8 mb-4 font-bold border-b pb-2"} 
              {...props} 
            />
          ),
          h2: ({node, ...props}) => (
            <h2 className={isChat 
              ? "text-sm font-serif font-semibold mt-2 mb-1" 
              : "text-xl sm:text-2xl font-serif text-brand-ink mt-6 mb-3 font-semibold"} 
              {...props} 
            />
          ),
          h3: ({node, ...props}) => (
            <h3 className={isChat 
              ? "text-xs font-serif font-medium mt-2 mb-1" 
              : "text-lg font-serif text-brand-ink mt-4 mb-2 font-medium"} 
              {...props} 
            />
          ),
          p: ({node, ...props}) => (
            <p className={isChat 
              ? "leading-relaxed mb-3 font-normal" 
              : "text-gray-600 leading-relaxed text-sm sm:text-base mb-6 font-normal"} 
              {...props} 
            />
          ),
          ul: ({node, ...props}) => (
            <ul className={isChat 
              ? "list-disc pl-4 mt-1 mb-3 space-y-1" 
              : "list-disc pl-5 mt-2 mb-6 text-gray-600 text-sm sm:text-base space-y-2"} 
              {...props} 
            />
          ),
          ol: ({node, ...props}) => (
            <ol className={isChat 
              ? "list-decimal pl-4 mt-1 mb-3 space-y-1" 
              : "list-decimal pl-5 mt-2 mb-6 text-gray-600 text-sm sm:text-base space-y-2"} 
              {...props} 
            />
          ),
          li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
          blockquote: ({node, ...props}) => (
            <blockquote className={isChat 
              ? "border-l-2 border-stone-600 italic pl-3 py-0.5 my-3 bg-stone-900/40 rounded text-stone-300" 
              : "border-l-4 border-brand-wood/30 italic pl-4 py-1 my-6 bg-brand-paper rounded text-gray-650"} 
              {...props} 
            />
          ),
          a: ({node, ...props}) => (
            <a className={isChat 
              ? "text-yellow-400 hover:underline font-semibold" 
              : "text-brand-wood hover:underline font-semibold"} 
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
          )
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </div>
  );
};
