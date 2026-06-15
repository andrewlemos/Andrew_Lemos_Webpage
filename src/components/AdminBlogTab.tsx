import React, { useState, useEffect } from 'react';
import { 
  db, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  updateDoc 
} from '../firebase';
import { BlogPost, Arquivo } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  FileText, 
  Eye, 
  Image as ImageIcon, 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List, 
  Quote, 
  Link as LinkIcon, 
  Check, 
  AlertCircle 
} from 'lucide-react';

export const AdminBlogTab = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [published, setPublished] = useState(false);
  
  // UI helpers
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper to slugify title
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^\w\s-]/g, '') // remove special chars
      .replace(/\s+/g, '-') // replace spaces with dashes
      .replace(/--+/g, '-') // collapse consecutive dashes
      .trim();
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingId) {
      setSlug(generateSlug(val));
    }
  };

  // Load posts and portfolio works
  useEffect(() => {
    const qPosts = query(collection(db, 'ecom_blog_posts'), orderBy('createdAt', 'desc'));
    const unsubPosts = onSnapshot(qPosts, (snapshot) => {
      const postsData: BlogPost[] = [];
      snapshot.forEach((doc) => {
        postsData.push({ id: doc.id, ...doc.data() } as BlogPost);
      });
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao escutar artigos:", error);
      setLoading(false);
    });

    const qArquivos = query(collection(db, 'arquivos'), orderBy('order', 'asc'));
    const unsubArquivos = onSnapshot(qArquivos, (snapshot) => {
      const arquivosData: Arquivo[] = [];
      snapshot.forEach((doc) => {
        arquivosData.push({ id: doc.id, ...doc.data() } as Arquivo);
      });
      setArquivos(arquivosData);
    });

    return () => {
      unsubPosts();
      unsubArquivos();
    };
  }, []);

  // Show a message briefly
  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  // Format Helper
  const insertFormatting = (before: string, after: string = '') => {
    const textarea = document.getElementById('blog-content-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const replacement = before + selectedText + after;
    
    const newValue = text.substring(0, start) + replacement + text.substring(end);
    setContent(newValue);
    
    // Focus and reset selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 50);
  };

  const resetForm = () => {
    setTitle('');
    setSlug('');
    setSummary('');
    setContent('');
    setImageUrl('');
    setPublished(false);
    setEditingId(null);
    setIsFormOpen(false);
    setShowImageSelector(false);
  };

  const startEdit = (post: BlogPost) => {
    setEditingId(post.id || null);
    setTitle(post.title);
    setSlug(post.slug);
    setSummary(post.summary);
    setContent(post.content);
    setImageUrl(post.imageUrl);
    setPublished(post.published);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug || !content || !summary || !imageUrl) {
      alert("Por favor, preencha todos os campos fundamentais, incluindo a imagem.");
      return;
    }

    const postData = {
      title: title.trim(),
      slug: slug.trim(),
      summary: summary.trim(),
      content: content,
      imageUrl: imageUrl.trim(),
      published: published,
      updatedAt: serverTimestamp(),
      ...(editingId ? {} : { createdAt: serverTimestamp() }),
      ...(published && !editingId ? { publishedAt: serverTimestamp() } : {})
    };

    try {
      if (editingId) {
        // If changing published status to true and it wasn't published, set publishedAt
        const found = posts.find(p => p.id === editingId);
        if (published && found && !found.published) {
          (postData as any).publishedAt = serverTimestamp();
        }
        await updateDoc(doc(db, 'ecom_blog_posts', editingId), postData);
        triggerSuccess("Artigo atualizado com sucesso!");
      } else {
        // Check for slug collisions
        const collision = posts.some(p => p.slug === slug.trim());
        if (collision) {
          alert("Já existe um artigo com este link amigável (slug)! Escolha outro.");
          return;
        }

        await addDoc(collection(db, 'ecom_blog_posts'), postData);
        triggerSuccess("Artigo publicado/criado com sucesso!");
      }
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar artigo:", error);
      alert("Ocorreu um erro ao salvar o artigo. Verifique as permissões.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir permanentemente este artigo?")) {
      try {
        await deleteDoc(doc(db, 'ecom_blog_posts', id));
        triggerSuccess("Artigo excluído com sucesso!");
      } catch (error) {
        console.error("Erro ao excluir artigo:", error);
        alert("Falha ao excluir artigo.");
      }
    }
  };

  const togglePublishedInline = async (post: BlogPost) => {
    try {
      const isNowNewPublished = !post.published;
      const dataToUpdate: any = {
        published: isNowNewPublished,
        updatedAt: serverTimestamp()
      };
      if (isNowNewPublished && !post.publishedAt) {
        dataToUpdate.publishedAt = serverTimestamp();
      }
      await updateDoc(doc(db, 'ecom_blog_posts', post.id!), dataToUpdate);
      triggerSuccess(`Artigo ${isNowNewPublished ? 'publicado' : 'despublicado'} com sucesso!`);
    } catch (error) {
      console.error("Erro ao alternar status do artigo:", error);
    }
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="fixed bottom-6 right-6 bg-brand-wood text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg animate-fade-in z-[300]">
          <Check className="w-5 h-5" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div>
          <h3 className="text-lg font-serif text-brand-ink">Gerenciador de Artigos</h3>
          <p className="text-xs text-gray-500">Escreva, mude e publique conteúdos novos para o blog do Ateliê.</p>
        </div>
        {!isFormOpen && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-brand-wood hover:bg-brand-wood-dark text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo Artigo
          </button>
        )}
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-brand-wood/10 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <h4 className="font-serif text-xl text-brand-ink">
              {editingId ? 'Editar Artigo' : 'Criar Novo Artigo'}
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer uppercase tracking-wider"
            >
              Cancelar
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Título do Artigo *
                </label>
                <input
                  type="text"
                  placeholder="EX: Como esculpir madeira em casa para iniciantes"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-wood text-brand-ink font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Link Amigável (Slug / URL) *
                </label>
                <input
                  type="text"
                  placeholder="EX: como-esculpir-madeira"
                  value={slug}
                  onChange={(e) => setSlug(generateSlug(e.target.value))}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-wood text-brand-ink font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Resumo do Artigo (Summary) *
                </label>
                <textarea
                  placeholder="Escreva uma breve introdução de 1-2 linhas para aparecer nos cards da listagem..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-wood text-brand-ink h-24 resize-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Imagem de Destaque (URL) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="URL da imagem (ex: /arquivos/obras/...) ou selecione da galeria"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-wood text-brand-ink"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowImageSelector(!showImageSelector)}
                    className="bg-brand-paper hover:bg-gray-100 border border-gray-200 p-3 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-gray-600"
                    title="Selecionar Obra da Galeria existente"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Grid para selecionar imagem da galeria existente */}
                {showImageSelector && (
                  <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl max-h-40 overflow-y-auto space-y-2">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Mudar para imagem da Galeria:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {arquivos.map((arq) => (
                        <button
                          key={arq.id}
                          type="button"
                          onClick={() => {
                            setImageUrl(arq.img);
                            setShowImageSelector(false);
                          }}
                          className={`relative border-2 rounded-lg overflow-hidden group h-12 w-full transition-all cursor-pointer ${imageUrl === arq.img ? 'border-brand-wood shadow' : 'border-transparent hover:border-gray-300'}`}
                        >
                          <img src={arq.img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {imageUrl && (
                  <div className="mt-2 text-center bg-gray-50 rounded-xl p-2 border border-gray-200 flex items-center justify-center gap-4">
                    <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{imageUrl}</span>
                    <img src={imageUrl} alt="preview" className="w-12 h-10 object-cover rounded-lg border border-gray-150" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Status do Post</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {published ? 'PUBLICADO' : 'RASCUNHO'}
                  </span>
                </label>
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <input
                    type="checkbox"
                    id="published-checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="w-5 h-5 accent-brand-wood cursor-pointer"
                  />
                  <label htmlFor="published-checkbox" className="text-sm font-medium text-brand-ink cursor-pointer select-none">
                    Deseja publicar este artigo imediatamente no Blog público?
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Conteúdo do Artigo (Formatado em Markdown) *</span>
              <span className="text-[10px] text-brand-wood text-right">Formatação direta suportada</span>
            </label>
            
            {/* Formatting Toolbar */}
            <div className="flex items-center gap-1.5 p-2 bg-gray-100 rounded-xl border border-gray-200 overflow-x-auto">
              <button
                type="button"
                onClick={() => insertFormatting('**', '**')}
                className="p-2 hover:bg-white rounded-lg text-gray-600 hover:text-brand-ink transition-colors cursor-pointer text-xs flex items-center gap-1 font-bold"
                title="Negrito"
              >
                <Bold className="w-4 h-4" /> <span className="hidden sm:inline">Negrito</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('*', '*')}
                className="p-2 hover:bg-white rounded-lg text-gray-600 hover:text-brand-ink transition-colors cursor-pointer text-xs flex items-center gap-1 italic"
                title="Itálico"
              >
                <Italic className="w-4 h-4" /> <span className="hidden sm:inline">Itálico</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('# ', '\n')}
                className="p-2 hover:bg-white rounded-lg text-gray-600 hover:text-brand-ink transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Título 1"
              >
                <Heading1 className="w-4 h-4" /> <span className="hidden sm:inline">Tít 1</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('## ', '\n')}
                className="p-2 hover:bg-white rounded-lg text-gray-600 hover:text-brand-ink transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Título 2"
              >
                <Heading2 className="w-4 h-4" /> <span className="hidden sm:inline">Tít 2</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('- ', '\n')}
                className="p-2 hover:bg-white rounded-lg text-gray-600 hover:text-brand-ink transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Lista"
              >
                <List className="w-4 h-4" /> <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('> ', '\n')}
                className="p-2 hover:bg-white rounded-lg text-gray-600 hover:text-brand-ink transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Citação"
              >
                <Quote className="w-4 h-4" /> <span className="hidden sm:inline">Citação</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('[', '](https://url-aqui.com)')}
                className="p-2 hover:bg-white rounded-lg text-gray-600 hover:text-brand-ink transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Inserir Link"
              >
                <LinkIcon className="w-4 h-4" /> <span className="hidden sm:inline">Link</span>
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('![Descrição da Imagem](', ')')}
                className="p-2 hover:bg-white rounded-lg text-gray-600 hover:text-brand-ink transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Inserir Imagem"
              >
                <ImageIcon className="w-4 h-4" /> <span className="hidden sm:inline">Imagem</span>
              </button>
            </div>

            <textarea
              id="blog-content-textarea"
              placeholder="Escreva aqui todo o conteúdo do seu post. Use os botões acima ou use tags Markdown para formatação de texto..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-wood text-brand-ink h-[300px] leading-relaxed font-sans"
              required
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-3 border border-gray-200 hover:bg-gray-50 rounded-full text-sm font-semibold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-brand-wood hover:bg-brand-wood-dark text-white rounded-full text-sm font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Salvar Artigo
            </button>
          </div>
        </form>
      )}

      {/* Posts List */}
      <div className="bg-white rounded-3xl border border-brand-wood/10 shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lista de Artigos ({posts.length})</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Carregando artigos salvos...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-400 px-6">
            <FileText className="w-12 h-12 stroke-[1] mx-auto text-gray-300 mb-3" />
            <p className="font-serif text-lg text-brand-ink mb-1">Nenhum artigo publicado ainda</p>
            <p className="text-xs">Clique no botão "Novo Artigo" para começar.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {posts.map((post) => (
              <div key={post.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex gap-4 items-center min-w-0 flex-grow">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border">
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <FileText className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-brand-ink text-sm sm:text-base leading-snug truncate">
                        {post.title}
                      </h4>
                      <button
                        type="button"
                        onClick={() => togglePublishedInline(post)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer uppercase ${post.published ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                      >
                        {post.published ? 'Publicado' : 'Rascunho'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 font-mono truncate max-w-sm">/blog/{post.slug}</p>
                    <p className="text-xs text-gray-500 line-clamp-1 mt-1">{post.summary}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <a
                    href={`#blog/${post.slug}`}
                    className="p-2 border border-gray-150 hover:bg-gray-100 hover:text-brand-wood rounded-xl transition-all cursor-pointer text-gray-500"
                    title="Visualizar Artigo"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => startEdit(post)}
                    className="p-2 border border-gray-150 hover:bg-gray-100 hover:text-brand-wood rounded-xl transition-all cursor-pointer text-gray-500"
                    title="Editar Artigo"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(post.id!)}
                    className="p-2 border border-red-100 hover:bg-red-50 text-red-500 rounded-xl transition-all cursor-pointer"
                    title="Excluir Artigo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
