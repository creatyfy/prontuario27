
import React, { createContext, useContext, useState } from 'react';

interface ModalOptions {
  type?: 'confirm' | 'alert' | 'prompt';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

const ConfirmContext = createContext<(options: ModalOptions) => void>(() => {});

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<ModalOptions | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const showConfirm = (options: ModalOptions) => {
    setModal(options);
    setPromptValue(options.defaultValue || '');
  };

  const handleConfirm = () => {
    if (modal?.onConfirm) modal.onConfirm(modal.type === 'prompt' ? promptValue : undefined);
    setModal(null);
  };

  const handleCancel = () => {
    if (modal?.onCancel) modal.onCancel();
    setModal(null);
  };

  return (
    <ConfirmContext.Provider value={showConfirm}>
      {children}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex flex-col items-center text-center mb-6">
               <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 ${
                 modal.title.toLowerCase().includes('excluir') || modal.title.toLowerCase().includes('remover') || modal.title.toLowerCase().includes('desmarcar') || modal.title.toLowerCase().includes('erro')
                 ? 'bg-red-50 text-red-500'
                 : 'bg-indigo-50 text-indigo-600'
               }`}>
                 <i className={`fa-solid ${
                   modal.type === 'alert' ? 'fa-circle-info' : 
                   modal.type === 'prompt' ? 'fa-pen-to-square' : 
                   'fa-triangle-exclamation'
                 } text-2xl`}></i>
               </div>
               <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{modal.title}</h3>
            </div>
            
            <p className="text-sm text-slate-600 font-medium mb-8 text-center leading-relaxed whitespace-pre-wrap">{modal.message}</p>
            
            {modal.type === 'prompt' && (
              <input 
                type="text" 
                autoFocus
                className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 outline-none mb-8 font-bold text-slate-800 transition-all text-center"
                value={promptValue}
                onChange={e => setPromptValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              />
            )}

            <div className="flex gap-4">
              {modal.type !== 'alert' && (
                <button 
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] hover:text-slate-600 transition-colors"
                >
                  {modal.cancelLabel || 'Cancelar'}
                </button>
              )}
              <button 
                type="button"
                onClick={handleConfirm}
                className={`flex-[2] py-4 rounded-2xl font-black shadow-xl uppercase transition-all active:scale-95 ${
                  modal.title.toLowerCase().includes('excluir') || 
                  modal.title.toLowerCase().includes('remover') || 
                  modal.title.toLowerCase().includes('desmarcar') || 
                  modal.title.toLowerCase().includes('erro')
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-100'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                }`}
              >
                {modal.confirmLabel || (modal.type === 'alert' ? 'Entendido' : 'Confirmar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => useContext(ConfirmContext);
