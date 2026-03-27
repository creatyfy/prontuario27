
import React, { useState, useEffect, useRef } from 'react';
import { useConfirm } from '../ConfirmContext';
import { UtilityDocument, DocCategory } from '../types';
import { MOCK_DOCUMENTS } from '../constants';

const Documents: React.FC = () => {
  const [docs, setDocs] = useState<UtilityDocument[]>(() => {
    const saved = localStorage.getItem('neuroclinic_documents');
    return saved ? JSON.parse(saved) : MOCK_DOCUMENTS;
  });
  const confirm = useConfirm();

  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [isAdding, setIsAdding] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<UtilityDocument>>({ category: 'Texto' });
  const [viewDoc, setViewDoc] = useState<UtilityDocument | null>(null);

  // Camera & File Upload States
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('neuroclinic_documents', JSON.stringify(docs));
  }, [docs]);

  // Cleanup camera on unmount or modal close
  useEffect(() => {
    if (!isAdding && stream) {
      stopCamera();
    }
  }, [isAdding]);

  useEffect(() => {
    if (showCamera && videoRef.current && !videoRef.current.srcObject) {
      startCamera();
    }
  }, [showCamera]);

  const categories: string[] = ['Todos', 'Texto', 'Link', 'Arquivo'];

  const filteredDocs = activeCategory === 'Todos' 
    ? docs 
    : docs.filter(d => d.category === activeCategory);

  const getIcon = (cat: DocCategory, title?: string) => {
    if (cat === 'Texto') return 'fa-file-lines text-indigo-500';
    if (cat === 'Link') return 'fa-link text-blue-500';
    if (cat === 'Arquivo') {
       if (title?.toLowerCase().includes('pdf')) return 'fa-file-pdf text-red-500';
       if (title?.toLowerCase().includes('xls') || title?.toLowerCase().includes('sheet')) return 'fa-table text-emerald-500';
       if (title?.toLowerCase().includes('doc')) return 'fa-file-word text-blue-700';
       if (title?.toLowerCase().includes('jpg') || title?.toLowerCase().includes('png') || title?.toLowerCase().includes('jpeg')) return 'fa-file-image text-purple-500';
       return 'fa-folder-open text-amber-500';
    }
    return 'fa-file text-slate-500';
  };

  const handleSave = () => {
    if (newDoc.title && newDoc.content && newDoc.category) {
      if (newDoc.id) {
        // Edit Mode
        setDocs(docs.map(d => d.id === newDoc.id ? { ...d, ...newDoc } as UtilityDocument : d));
      } else {
        // Create Mode
        const doc: UtilityDocument = {
          id: `doc-${Date.now()}`,
          title: newDoc.title,
          category: newDoc.category as DocCategory,
          description: newDoc.description || '',
          content: newDoc.content
        };
        setDocs([...docs, doc]);
      }
      closeModal();
    } else {
      confirm({
        type: 'alert',
        title: 'Campos Incompletos',
        message: 'Preencha o título e o conteúdo do documento.'
      });
    }
  };

  const closeModal = () => {
    setIsAdding(false);
    setNewDoc({ category: 'Texto' });
    stopCamera();
  };

  const handleDelete = (id: string) => {
    confirm({
      title: 'Excluir Documento',
      message: 'Tem certeza que deseja remover este documento?',
      confirmLabel: 'Excluir',
      onConfirm: () => setDocs(docs.filter(d => d.id !== id))
    });
  };

  const handleEdit = (doc: UtilityDocument) => {
    setNewDoc({ ...doc });
    setIsAdding(true);
  };

  const handleOpen = (doc: UtilityDocument) => {
    if (doc.category === 'Texto') {
      setViewDoc(doc);
    } else {
      let url = doc.content;
      // Check if it is a Data URL (Base64) or a web link
      if (!url.startsWith('data:') && !url.startsWith('http')) {
        url = 'https://' + url;
      }
      
      if (url.startsWith('data:')) {
         // Open base64 in new tab logic is tricky due to browser security, often better to download
         const win = window.open();
         if(win) {
             win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
         }
      } else {
         window.open(url, '_blank');
      }
    }
  };

  // Camera Functions
  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.error(err);
      confirm({ type: 'alert', title: 'Erro', message: 'Não foi possível acessar a câmera.' });
      setShowCamera(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setNewDoc({ ...newDoc, content: dataUrl });
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  // File Upload Function
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setNewDoc({ ...newDoc, content: reader.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const isDataUrl = (s?: string) => s?.startsWith('data:');

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Documentos Úteis</h2>
          <p className="text-slate-500 font-medium">Biblioteca de arquivos, links e textos</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                  activeCategory === cat ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setNewDoc({ category: 'Texto' }); setIsAdding(true); }}
            className="bg-indigo-600 text-white px-6 py-3.5 rounded-2xl text-xs font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-plus"></i> Novo Documento
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredDocs.map(doc => (
          <div
            key={doc.id}
            onClick={() => handleOpen(doc)}
            className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative flex flex-col justify-between h-full"
          >
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(doc);
                  }}
                  className="text-slate-300 hover:text-indigo-600 p-2 bg-white rounded-lg shadow-sm"
                >
                  <i className="fa-solid fa-pen"></i>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc.id);
                  }}
                  className="text-slate-300 hover:text-red-500 p-2 bg-white rounded-lg shadow-sm"
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
            </div>

            <div>
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                <i className={`fa-solid ${getIcon(doc.category, doc.title)} text-xl`}></i>
              </div>
              <h3 className="font-black text-slate-800 uppercase text-sm leading-tight mb-2 truncate pr-6">{doc.title}</h3>
              <p className="text-[10px] text-slate-400 font-medium line-clamp-2">{doc.description || 'Sem descrição'}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[8px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{doc.category}</span>
              <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-all"></i>
            </div>
          </div>
        ))}
        {filteredDocs.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-30">
            <i className="fa-solid fa-folder-open text-4xl mb-4"></i>
            <p className="font-black uppercase text-sm">Nenhum documento encontrado</p>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 max-h-[95vh] overflow-y-auto">
            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tighter">
                {newDoc.id ? 'Editar Documento' : 'Novo Documento'}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-2xl">
                {['Texto', 'Link', 'Arquivo'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewDoc({ ...newDoc, category: cat as DocCategory })}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase transition-all ${
                      newDoc.category === cat ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Título</label>
                <input
                  type="text"
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoc.title || ''}
                  onChange={e => setNewDoc({ ...newDoc, title: e.target.value })}
                  placeholder="Nome do documento..."
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Descrição</label>
                <input
                  type="text"
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newDoc.description || ''}
                  onChange={e => setNewDoc({ ...newDoc, description: e.target.value })}
                  placeholder="Breve descrição..."
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">
                  {newDoc.category === 'Link' ? 'URL do Link' : newDoc.category === 'Arquivo' ? 'Arquivo / URL' : 'Conteúdo do Texto'}
                </label>
                
                {newDoc.category === 'Texto' && (
                    <textarea
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-medium text-slate-800 h-32 resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newDoc.content || ''}
                      onChange={e => setNewDoc({ ...newDoc, content: e.target.value })}
                      placeholder="Digite o texto aqui..."
                    />
                )}

                {newDoc.category === 'Link' && (
                    <input
                      type="text"
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={newDoc.content || ''}
                      onChange={e => setNewDoc({ ...newDoc, content: e.target.value })}
                      placeholder="https://..."
                    />
                )}

                {newDoc.category === 'Arquivo' && (
                    <div className="space-y-3">
                        {!showCamera ? (
                            <>
                                {isDataUrl(newDoc.content) ? (
                                    <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                        <div className="w-10 h-10 bg-indigo-200 text-indigo-600 rounded-xl flex items-center justify-center">
                                            <i className="fa-solid fa-file-check"></i>
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className="text-[10px] font-bold text-indigo-800 uppercase">Arquivo Carregado</p>
                                            <p className="text-[8px] text-indigo-500 truncate">Dados prontos para salvar</p>
                                        </div>
                                        <button onClick={() => setNewDoc({...newDoc, content: ''})} className="text-red-400 hover:text-red-600 p-2"><i className="fa-solid fa-times"></i></button>
                                    </div>
                                ) : (
                                    <input
                                      type="text"
                                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                      value={newDoc.content || ''}
                                      onChange={e => setNewDoc({ ...newDoc, content: e.target.value })}
                                      placeholder="Cole uma URL ou use as opções abaixo..."
                                    />
                                )}

                                <div className="flex gap-2">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        onChange={handleFileUpload} 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <i className="fa-solid fa-upload"></i> Carregar do PC
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowCamera(true)}
                                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <i className="fa-solid fa-camera"></i> Tirar Foto
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="bg-black rounded-2xl overflow-hidden relative">
                                <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover"></video>
                                <div className="absolute bottom-2 left-0 w-full flex justify-center gap-4 p-2">
                                    <button onClick={stopCamera} className="bg-red-500 text-white w-10 h-10 rounded-full shadow-lg"><i className="fa-solid fa-times"></i></button>
                                    <button onClick={takePhoto} className="bg-white text-indigo-600 w-14 h-14 rounded-full border-4 border-indigo-200 shadow-lg flex items-center justify-center"><i className="fa-solid fa-camera text-xl"></i></button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-4 text-slate-300 font-black uppercase text-[10px]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!newDoc.title || !newDoc.content}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase hover:bg-indigo-700 disabled:opacity-50"
                >
                  {newDoc.id ? 'Salvar Alterações' : 'Criar Documento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-2xl p-10 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{viewDoc.title}</h3>
              <div className="flex gap-2">
                  <button type="button" onClick={() => { setViewDoc(null); handleEdit(viewDoc); }} className="text-slate-300 hover:text-indigo-600 p-2"><i className="fa-solid fa-pen"></i></button>
                  <button type="button" onClick={() => setViewDoc(null)} className="text-slate-300 hover:text-slate-600 p-2">
                    <i className="fa-solid fa-xmark text-2xl"></i>
                  </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <p className="text-slate-500 font-medium mb-6 italic">{viewDoc.description}</p>
              <div className="bg-slate-50 p-8 rounded-[32px] text-slate-700 font-medium whitespace-pre-wrap leading-relaxed shadow-inner">
                {viewDoc.content}
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(viewDoc.content);
                  confirm({ title: 'Copiado', message: 'Conteúdo copiado com sucesso!', type: 'alert' });
                }}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-indigo-700"
              >
                Copiar Texto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
