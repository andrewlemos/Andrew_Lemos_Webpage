import React, { useEffect, useState } from 'react';
import { db, collection, query, onSnapshot } from '../firebase';
import { where, limit } from 'firebase/firestore';
import { BlogPost, EcomProduct } from '../types';

interface SEOManagerProps {
  currentView: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm' | 'customer-area' | 'avaliar' | 'blog' | 'blog-post';
  blogSlug?: string;
}

export const SEOManager: React.FC<SEOManagerProps> = ({ currentView, blogSlug }) => {
  const [activePost, setActivePost] = useState<BlogPost | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<EcomProduct[]>([]);

  // 1. Fetch current blog post details if in blog-post view
  useEffect(() => {
    if (currentView !== 'blog-post' || !blogSlug) {
      setActivePost(null);
      return;
    }

    const q = query(
      collection(db, 'ecom_blog_posts'),
      where('slug', '==', blogSlug),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActivePost({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as BlogPost);
      } else {
        setActivePost(null);
      }
    }, (err) => {
      console.error("SEOManager: Error loading blog post metadata:", err);
    });

    return () => unsubscribe();
  }, [currentView, blogSlug]);

  // 2. Fetch some products to enrich Product Schema markup
  useEffect(() => {
    const qProds = query(collection(db, 'ecom_products'), limit(5));
    const unsubscribe = onSnapshot(qProds, (snapshot) => {
      const prods: EcomProduct[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as EcomProduct);
      });
      setFeaturedProducts(prods);
    }, (err) => {
      console.error("SEOManager: Error fetching store products for schema:", err);
    });

    return () => unsubscribe();
  }, []);

  // Helper utility to update meta tags on the fly
  const setMetaTag = (nameOrProperty: string, content: string, isPropertyAttr = true) => {
    const attr = isPropertyAttr ? 'property' : 'name';
    let element = document.head.querySelector(`meta[${attr}="${nameOrProperty}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attr, nameOrProperty);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  };

  // Helper to resolve Drive / Local URLs
  const getFullImageUrl = (url: string) => {
    if (!url) return 'https://lh3.googleusercontent.com/d/1iCZEIfCehjOGE167hfelsT2P7zD9DzOb';
    let processed = url.trim();
    if (processed.includes('drive.google.com')) {
      const fileDMatch = processed.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
      if (fileDMatch && fileDMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
      }
      const queryIdMatch = processed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (queryIdMatch && queryIdMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${queryIdMatch[1]}`;
      }
    }
    if (processed.startsWith('http://') || processed.startsWith('https://')) {
      return processed;
    }
    const origin = window.location.origin || 'https://andrewlemos.com.br';
    return processed.startsWith('/') ? `${origin}${processed}` : `${origin}/${processed}`;
  };

  useEffect(() => {
    const origin = window.location.origin || 'https://andrewlemos.com.br';
    let title = 'Andrew Lemos | Artista Plástico & Escultor';
    let description = 'Portfólio de Andrew Lemos, Artista Plástico e Escultor de madeiras nobres. Adquira peças exclusivas ou agende encomendas.';
    let imageUrl = 'https://lh3.googleusercontent.com/d/1iCZEIfCehjOGE167hfelsT2P7zD9DzOb';
    let currentUrl = `${origin}/${window.location.hash || ''}`;

    // Schema definitions
    const schemas: any[] = [];

    // Base organization schema - always present
    const organizationSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      'name': 'Ateliê Andrew Lemos',
      'url': origin,
      'logo': 'https://lh3.googleusercontent.com/d/1iCZEIfCehjOGE167hfelsT2P7zD9DzOb',
      'description': 'Portfólio online e loja oficial de esculturas do artista plástico Andrew Lemos.',
      'contactPoint': {
        '@type': 'ContactPoint',
        'email': 'andrewfmlemos@gmail.com',
        'contactType': 'customer support'
      }
    };
    schemas.push(organizationSchema);

    // Website representation - always present
    const websiteSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      'name': 'Ateliê Andrew Lemos',
      'url': origin
    };
    schemas.push(websiteSchema);

    // Segment conditions
    if (currentView === 'blog-post' && activePost) {
      title = `${activePost.title} | Blog Andrew Lemos`;
      description = activePost.summary || activePost.content?.substring(0, 160) || description;
      imageUrl = getFullImageUrl(activePost.imageUrl);

      // BlogPosting Schema
      const blogPostingSchema = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        '@id': `${origin}/#blog-post/${activePost.slug}`,
        'headline': activePost.title,
        'image': [imageUrl],
        'datePublished': activePost.publishedAt ? (activePost.publishedAt.toDate ? activePost.publishedAt.toDate().toISOString() : new Date(activePost.publishedAt).toISOString()) : new Date().toISOString(),
        'description': activePost.summary,
        'author': {
          '@type': 'Person',
          'name': 'Andrew Lemos'
        },
        'publisher': {
          '@type': 'Organization',
          'name': 'Ateliê Andrew Lemos',
          'logo': {
            '@type': 'ImageObject',
            'url': 'https://lh3.googleusercontent.com/d/1iCZEIfCehjOGE167hfelsT2P7zD9DzOb'
          }
        },
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': currentUrl
        }
      };
      schemas.push(blogPostingSchema);

      // Breadcrumb Schema
      const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Início',
            'item': origin
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Blog',
            'item': `${origin}/#blog`
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': activePost.title,
            'item': currentUrl
          }
        ]
      };
      schemas.push(breadcrumbSchema);

    } else if (currentView === 'blog') {
      title = 'Blog do Ateliê | Andrew Lemos';
      description = 'Técnicas de entalhe em madeira, vídeos, segredos do ateliê e lições valiosas publicadas por Andrew Lemos.';
      
      // Breadcrumb Schema
      const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Início',
            'item': origin
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Blog',
            'item': currentUrl
          }
        ]
      };
      schemas.push(breadcrumbSchema);

    } else if (currentView === 'vendas') {
      title = 'Peças & Obras à Venda | Ateliê Andrew Lemos';
      description = 'Adquira peças de arte exclusivas esculpidas em madeiras nobres, ferramentas premium autografadas e envie com segurança direto do ateliê.';

      // Dynamic Product List schemas for Search Engine Carousel compatibility
      if (featuredProducts.length > 0) {
        featuredProducts.forEach((item) => {
          const prodUrl = `${origin}/#vendas`;
          const prodImg = item.images && item.images[0] ? getFullImageUrl(item.images[0]) : imageUrl;
          schemas.push({
            '@context': 'https://schema.org',
            '@type': 'Product',
            '@id': `${origin}/#product/${item.id}`,
            'name': item.name,
            'image': [prodImg],
            'description': item.description ? item.description.substring(0, 300) : 'Peça de arte artesanal esculpida em madeira de lei',
            'offers': {
              '@type': 'Offer',
              'url': prodUrl,
              'priceCurrency': 'BRL',
              'price': item.price,
              'availability': item.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              'priceValidUntil': new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0]
            }
          });
        });
      }

      // Breadcrumb Schema
      const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Início',
            'item': origin
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Loja Oficial / Vendas',
            'item': currentUrl
          }
        ]
      };
      schemas.push(breadcrumbSchema);
    }

    // Apply Meta Tags and Title updates
    document.title = title;
    
    // Core details
    setMetaTag('description', description, false);

    // Open Graph Tags (Facebook, WhatsApp, etc)
    setMetaTag('og:site_name', 'Ateliê Andrew Lemos');
    setMetaTag('og:type', currentView === 'blog-post' ? 'article' : 'website');
    setMetaTag('og:url', currentUrl);
    setMetaTag('og:title', title);
    setMetaTag('og:description', description);
    setMetaTag('og:image', imageUrl);
    setMetaTag('og:image:secure_url', imageUrl);
    setMetaTag('og:image:type', imageUrl.endsWith('.png') ? 'image/png' : 'image/jpeg');
    setMetaTag('og:image:width', '1200');
    setMetaTag('og:image:height', '630');

    // Twitter Card Tags
    setMetaTag('twitter:card', 'summary_large_image', false);
    setMetaTag('twitter:url', currentUrl, false);
    setMetaTag('twitter:title', title, false);
    setMetaTag('twitter:description', description, false);
    setMetaTag('twitter:image', imageUrl, false);

    // Inject JSON-LD Schema Script
    let scriptTag = document.getElementById('schema-jsonld') as HTMLScriptElement;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'schema-jsonld';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.text = JSON.stringify(schemas);

  }, [currentView, activePost, featuredProducts]);

  return null; // Side-effect only component
};
