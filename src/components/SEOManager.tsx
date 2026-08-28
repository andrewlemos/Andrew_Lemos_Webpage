import React, { useEffect, useState } from 'react';
import { db, collection, query, onSnapshot } from '../firebase';
import { where, limit, orderBy } from 'firebase/firestore';
import { BlogPost, EcomProduct, Arquivo } from '../types';
import { getWorkSlug } from './GalleryItemPage';

interface SEOManagerProps {
  currentView: 'landing' | 'vendas' | 'checkout-pay' | 'checkout-confirm' | 'customer-area' | 'avaliar' | 'blog' | 'blog-post' | 'galeria-item' | 'vendas-item' | 'politica-devolucao' | 'politica-frete' | 'termos-de-uso' | 'politica-privacidade' | 'lms-portal';
  blogSlug?: string;
  gallerySlug?: string;
  vendasSlug?: string;
}

export const SEOManager: React.FC<SEOManagerProps> = ({ currentView, blogSlug, gallerySlug, vendasSlug }) => {
  const [activePost, setActivePost] = useState<BlogPost | null>(null);
  const [activeWork, setActiveWork] = useState<Arquivo | null>(null);
  const [activeVendasProduct, setActiveVendasProduct] = useState<EcomProduct | null>(null);
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
      where('published', '==', true),
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

  // 1b. Fetch current gallery item details if in galeria-item view
  useEffect(() => {
    if (currentView !== 'galeria-item' || !gallerySlug) {
      setActiveWork(null);
      return;
    }

    const q = query(collection(db, 'arquivos'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let found: any = null;
      if (!snapshot.empty) {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Arquivo[];
        found = list.find(w => getWorkSlug(w) === gallerySlug);
      }
      
      if (!found) {
        const defaultWorks = [
          { title: 'Escultura em Madeira', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 18.06.49.jpeg' },
          { title: 'Entalhe em Madeira', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 17.34.07 - Copia.jpeg' },
          { title: 'Processo de Escultura', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 19.39.34 (1).jpeg' },
          { title: 'Obra em Madeira', category: 'Madeira', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.39 (1).jpeg' },
          { title: 'Desenho Realista', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.39.jpeg' },
          { title: 'Estudo de Grafite', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.40 (1).jpeg' },
          { title: 'Retrato em Grafite', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.40 (2) - Copia.jpeg' },
          { title: 'Anatomia Animal', category: 'Grafite', img: '/arquivos/WhatsApp Image 2025-03-01 at 20.11.40 (4).jpeg' },
          { title: 'Expressão em Grafite', category: 'Grafite', img: '/arquivos/Screenshot_20221018-195950_Instagram.jpg' },
          { title: 'Modelagem em Argila', category: 'Modelagem', img: '/arquivos/WhatsApp Image 2025-03-02 at 13.05.07 - Copia.jpeg' },
          { title: 'Escultura de Peixe I', category: 'Madeira', img: '/arquivos/peixe1.jpg' },
          { title: 'Escultura de Peixe II', category: 'Madeira', img: '/arquivos/peixe2.jpg' },
          { title: 'Escultura de Peixe III', category: 'Madeira', img: '/arquivos/peixe3.jpg' },
          { title: 'Escultura de Peixe IV', category: 'Madeira', img: '/arquivos/peixe4.jpg' },
          { title: 'Escultura de Peixe V', category: 'Madeira', img: '/arquivos/peixe5.jpg' },
          { title: 'Escultura de Peixe VI', category: 'Madeira', img: '/arquivos/peixe6.jpg' },
        ];
        found = defaultWorks.find(w => getWorkSlug(w) === gallerySlug);
      }

      setActiveWork(found || null);
    }, (err) => {
      console.error("SEOManager: Error loading gallery metadata:", err);
    });

    return () => unsubscribe();
  }, [currentView, gallerySlug]);

  // 1c. Fetch current active vendas product if in vendas-item view
  useEffect(() => {
    if (currentView !== 'vendas-item' || !vendasSlug) {
      setActiveVendasProduct(null);
      return;
    }

    const q = query(collection(db, 'ecom_products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let found: EcomProduct | null = null;
      if (!snapshot.empty) {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EcomProduct[];
        // find item by slug or id
        found = list.find(p => {
          const detailSlug = p.slug && p.slug.trim().length > 0 ? p.slug.trim() : (p.name ? p.name.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') : "");
          return detailSlug === vendasSlug || p.id === vendasSlug;
        }) || null;
      }
      setActiveVendasProduct(found);
    }, (err) => {
      console.error("SEOManager: Error loading active vendas product:", err);
    });

    return () => unsubscribe();
  }, [currentView, vendasSlug]);

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
    const isDevOrInternal = typeof window !== 'undefined' && (window.location.origin.includes('localhost') || window.location.origin.includes('run.app'));
    const origin = isDevOrInternal ? 'https://andrewlemos.com' : (window.location.origin || 'https://andrewlemos.com');
    return processed.startsWith('/') ? `${origin}${processed}` : `${origin}/${processed}`;
  };

  useEffect(() => {
    const isDevOrInternal = typeof window !== 'undefined' && (window.location.origin.includes('localhost') || window.location.origin.includes('run.app'));
    const origin = isDevOrInternal ? 'https://andrewlemos.com' : (window.location.origin || 'https://andrewlemos.com');
    let title = 'Andrew Lemos | Artista Plástico & Escultor';
    let description = 'Portfólio de Andrew Lemos, Artista Plástico e Escultor de madeiras nobres. Adquira peças exclusivas ou agende encomendas.';
    let imageUrl = 'https://lh3.googleusercontent.com/d/1iCZEIfCehjOGE167hfelsT2P7zD9DzOb';
    let currentUrl = `${origin}/${window.location.hash || ''}`;
    if (currentView === 'galeria-item' && gallerySlug) {
      currentUrl = `${origin}/galeria/${gallerySlug}`;
    } else if (currentView === 'vendas-item' && vendasSlug) {
      currentUrl = `${origin}/vendas/${vendasSlug}`;
    } else if (currentView === 'blog-post' && blogSlug) {
      currentUrl = `${origin}/blog/${blogSlug}`;
    } else if (currentView === 'blog') {
      currentUrl = `${origin}/blog`;
    }

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
    } else if (currentView === 'galeria-item' && activeWork) {
      title = `${activeWork.title} — Obra d'Arte por Andrew Lemos`;
      description = `Visualize a obra "${activeWork.title}" (${activeWork.category}) pelo artista plástico Andrew Lemos. Veja fotos em alta resolução, dimensões, processo artístico e como encomendar ou adquirir.`;
      imageUrl = getFullImageUrl(activeWork.img);
      currentUrl = `${origin}/galeria/${gallerySlug}`;

      // JSON-LD VisualArtwork Schema
      const artworkSchema = {
        '@context': 'https://schema.org',
        '@type': 'VisualArtwork',
        '@id': `${origin}/galeria/${gallerySlug}#artwork`,
        'name': activeWork.title,
        'image': imageUrl,
        'description': description,
        'artMedium': activeWork.category.toLowerCase().includes('madeira') ? 'Escultura em Madeira / Entalhe' : activeWork.category,
        'creator': {
          '@type': 'Person',
          'name': 'Andrew Lemos'
        }
      };
      schemas.push(artworkSchema);

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
            'name': 'Galeria',
            'item': `${origin}/#gallery`
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': activeWork.title,
            'item': currentUrl
          }
        ]
      };
      schemas.push(breadcrumbSchema);
    } else if (currentView === 'vendas-item' && activeVendasProduct) {
      title = `${activeVendasProduct.name} | Ateliê Andrew Lemos`;
      description = activeVendasProduct.description ? activeVendasProduct.description.substring(0, 160) : `Adquira a obra exclusiva "${activeVendasProduct.name}" esculpida em madeiras nobre, assinada e autografada pelo escultor Andrew Lemos.`;
      imageUrl = activeVendasProduct.images && activeVendasProduct.images.length > 0 ? getFullImageUrl(activeVendasProduct.images[0]) : imageUrl;
      currentUrl = `${origin}/vendas/${vendasSlug}`;

      // JSON-LD Product Schema conditionally based on active commercial status
      const isAvailableForSale = activeVendasProduct.price > 0 && activeVendasProduct.stock > 0;

      if (isAvailableForSale) {
        const productSchema = {
          '@context': 'https://schema.org',
          '@type': 'Product',
          '@id': `${origin}/vendas/${vendasSlug}#product`,
          'name': activeVendasProduct.name,
          'image': [imageUrl],
          'description': description,
          'offers': {
            '@type': 'Offer',
            'url': currentUrl,
            'priceCurrency': 'BRL',
            'price': activeVendasProduct.price,
            'availability': 'https://schema.org/InStock',
            'priceValidUntil': new Date(new Date().getFullYear() + 1, 11, 31).toISOString().split('T')[0]
          }
        };
        schemas.push(productSchema);
      } else {
        const artworkSchema = {
          '@context': 'https://schema.org',
          '@type': 'VisualArtwork',
          '@id': `${origin}/vendas/${vendasSlug}#artwork`,
          'name': activeVendasProduct.name,
          'image': [imageUrl],
          'description': description,
          'artMedium': activeVendasProduct.category || 'Escultura em Madeira / Design',
          'creator': {
            '@type': 'Person',
            'name': 'Andrew Lemos'
          }
        };
        schemas.push(artworkSchema);
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
            'name': 'Vendas',
            'item': `${origin}/#vendas`
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': activeVendasProduct.name,
            'item': currentUrl
          }
        ]
      };
      schemas.push(breadcrumbSchema);
    } else if (currentView === 'politica-devolucao') {
      title = 'Política de Devolução e Reembolso | Ateliê Andrew Lemos';
      description = 'Garantimos transparência total com nossa política de devolução, arrependimento e reembolso para peças de arte e esculturas artesanais sob medida.';
      currentUrl = `${origin}/politica-devolucao`;

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
            'name': 'Política de Devolução e Reembolso',
            'item': currentUrl
          }
        ]
      };
      schemas.push(breadcrumbSchema);
    } else if (currentView === 'politica-frete') {
      title = 'Política de Frete | Ateliê Andrew Lemos';
      description = 'Saiba mais sobre os nossos prazos de produção, prazos de entrega e cuidados de transporte para esculturas e entalhes em madeira artesanais.';
      currentUrl = `${origin}/politica-frete`;

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
            'name': 'Política de Frete',
            'item': currentUrl
          }
        ]
      };
      schemas.push(breadcrumbSchema);
    } else if (currentView === 'termos-de-uso') {
      title = 'Termos de Uso | Ateliê Andrew Lemos';
      description = 'Confira os Termos de Uso do site Ateliê Andrew Lemos. Regras sobre direitos autorais, obras sob encomenda e propriedade intelectual.';
      currentUrl = `${origin}/termos-de-uso`;

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
            'name': 'Termos de Uso',
            'item': currentUrl
          }
        ]
      };
      schemas.push(breadcrumbSchema);
    } else if (currentView === 'politica-privacidade') {
      title = 'Política de Privacidade | Ateliê Andrew Lemos';
      description = 'Conheça nossa política de privacidade e como protegemos os seus dados pessoais durante o uso do site e no processo de compras no Ateliê Andrew Lemos.';
      currentUrl = `${origin}/politica-privacidade`;

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
            'name': 'Política de Privacidade',
            'item': currentUrl
          }
        ]
      };
      schemas.push(breadcrumbSchema);
    }

    // Apply Meta Tags and Title updates
    document.title = title;

    // Dynamic Canonical Tag
    let canonicalElement = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement('link');
      canonicalElement.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.setAttribute('href', currentUrl);
    
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

  }, [currentView, activePost, activeWork, activeVendasProduct, featuredProducts, gallerySlug, vendasSlug]);

  return null; // Side-effect only component
};
