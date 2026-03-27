import React from 'react';
import { UserAccount } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: UserAccount;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, user, onLogout }) => {
  const allMenuItems = [
    { id: 'agenda', icon: 'fa-calendar-days', label: 'Agenda' },
    { id: 'pacientes', icon: 'fa-hospital-user', label: 'Pacientes' },
    { id: 'crm', icon: 'fa-users-gear', label: 'CRM/Follow-up' },
    { id: 'scripts', icon: 'fa-comments', label: 'Secretaria' },
    { id: 'documentos', icon: 'fa-folder-open', label: 'Documentos' },
    { id: 'escalas_novas', icon: 'fa-gauge-high', label: 'Escalas Novas' },
    { id: 'parceiros', icon: 'fa-address-book', label: 'Contatos Parceiros' },
    { id: 'orcamentos', icon: 'fa-file-invoice-dollar', label: 'Orçamentos' },
    { id: 'administracao', icon: 'fa-chart-line', label: 'Caixa' },
    { id: 'configuracoes', icon: 'fa-sliders', label: 'Configurações' },
  ];

  // Filtragem baseada em permissões ou role de acesso total
  const visibleMenuItems = allMenuItems.filter(item => {
    // Admin e Médico têm acesso total a tudo
    if (user.role === 'admin' || user.role === 'doctor') return true;
    // Outros usuários dependem do array de permissões
    return user.permissions?.includes(item.id);
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 antialiased text-slate-900">
      <nav className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-xl border-t border-slate-200 flex justify-around p-1 md:relative md:w-60 md:flex-col md:border-r md:border-t-0 md:justify-start md:p-4 z-50 shadow-2xl md:shadow-none">
        <div className="hidden md:flex items-center gap-3 mb-6 px-3 py-2">
          <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
            <i className="fa-solid fa-brain text-xl"></i>
          </div>
          <div>
            <h1 className="font-black text-slate-800 tracking-tighter text-xl leading-none">NeuroClinic</h1>
            <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mt-1">
                {user.role === 'admin' ? 'Administrador' : user.role === 'doctor' ? 'Médico' : 'Secretaria'}
            </p>
          </div>
        </div>

        <div className="flex md:flex-col w-full gap-0.5 md:gap-1.5 overflow-x-auto md:overflow-x-visible no-scrollbar">
          {visibleMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col md:flex-row items-center gap-1 md:gap-4 p-2.5 md:px-3 md:py-2.5 rounded-xl transition-all duration-300 flex-1 md:flex-none min-w-[70px] md:min-w-0 ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <i className={`fa-solid ${item.icon} text-lg md:text-base`}></i>
              <span className="text-[9px] md:text-[13px] font-bold tracking-tight text-center md:text-left">{item.label}</span>
            </button>
          ))}
        </div>

        <button 
          onClick={onLogout}
          className="hidden md:flex items-center gap-4 p-3 mt-auto rounded-xl text-slate-400 hover:bg-red-600 hover:text-white transition-all font-bold text-sm"
        >
          <i className="fa-solid fa-right-from-bracket"></i>
          Sair
        </button>
      </nav>

      <main className={`flex-1 ${activeTab === 'agenda' ? 'p-0' : 'p-3 md:p-8 lg:p-10 pb-24 md:pb-10 overflow-y-auto'} overflow-x-hidden`}>
        <div className={`${activeTab === 'agenda' ? '' : 'max-w-screen-2xl mx-auto'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;