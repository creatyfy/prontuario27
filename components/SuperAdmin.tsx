
import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types';
import { useConfirm } from '../ConfirmContext';

interface SuperAdminProps {
  users: UserAccount[];
  onUpdateUsers: (newUsers: UserAccount[]) => void;
  onLogout: () => void;
}

const SuperAdmin: React.FC<SuperAdminProps> = ({ users, onUpdateUsers, onLogout }) => {
  const [editingUser, setEditingUser] = useState<Partial<UserAccount> | null>(null);
  const confirm = useConfirm();

  const validatePassword = (pwd: string) => {
    if (!pwd) return false;
    const hasMinLength = pwd.length >= 9;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    return hasMinLength && hasUpper && hasNumber && hasSpecial;
  };

  const handleSave = () => {
    if (editingUser?.username && editingUser?.password) {
      if (!validatePassword(editingUser.password)) {
        confirm({
          type: 'alert',
          title: 'Erro de Segurança',
          message: 'A senha deve conter no mínimo 9 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial.'
        });
        return;
      }

      const newUser: UserAccount = {
        id: editingUser.id || `u-${Date.now()}`,
        name: editingUser.name || 'Novo Usuário',
        username: editingUser.username,
        role: editingUser.role || 'secretary',
        password: editingUser.password,
        permissions: editingUser.permissions || (editingUser.role === 'secretary' ? ['agenda', 'pacientes', 'crm', 'scripts'] : ['agenda', 'pacientes', 'crm', 'scripts', 'documentos', 'parceiros', 'orcamentos', 'administracao', 'configuracoes']),
        doctorName: editingUser.doctorName,
        specialty: editingUser.specialty,
        parentId: editingUser.parentId
      };

      const newUsersList = editingUser.id 
        ? users.map(u => u.id === newUser.id ? newUser : u)
        : [...users, newUser];

      onUpdateUsers(newUsersList);
      setEditingUser(null);
    }
  };

  const handleDelete = (id: string) => {
    confirm({
      title: 'Excluir Usuário',
      message: 'Tem certeza que deseja remover este usuário? Se for um médico, seus sub-usuários vinculados perderão o acesso.',
      confirmLabel: 'Excluir Permanentemente',
      onConfirm: () => {
        // Se for médico, remove ele e os filhos
        const updated = users.filter(u => u.id !== id && u.parentId !== id);
        onUpdateUsers(updated);
      }
    });
  };

  // Médicos (Contas Principais)
  const doctors = users.filter(u => u.role === 'doctor');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12 border-b border-slate-800 pb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-indigo-400">Master Console</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Gestão de Contas e Hierarquias Médicas</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setEditingUser({ role: 'doctor', permissions: [] })}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl transition-all"
            >
              Adicionar Novo Médico
            </button>
            <button 
              onClick={onLogout}
              className="bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all"
            >
              Encerrar Sessão
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-800/50 p-6 rounded-[32px] border border-slate-700">
             <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Contas Médicas</p>
             <p className="text-3xl font-black text-white">{doctors.length}</p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-[32px] border border-slate-700">
             <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Colaboradores (Sub-contas)</p>
             <p className="text-3xl font-black text-white">{users.filter(u => u.role === 'secretary').length}</p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-[32px] border border-slate-700">
             <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Total Usuários</p>
             <p className="text-3xl font-black text-indigo-400">{users.length}</p>
          </div>
        </div>

        <div className="space-y-8">
          {doctors.length === 0 ? (
            <div className="bg-slate-800/30 rounded-[40px] border border-slate-800 p-20 text-center text-slate-500 italic">
               Nenhum médico cadastrado no sistema.
            </div>
          ) : doctors.map(doc => (
            <div key={doc.id} className="bg-slate-800/30 rounded-[40px] border border-slate-800 overflow-hidden shadow-lg">
              {/* Card do Médico */}
              <div className="bg-slate-800/60 px-8 py-6 flex justify-between items-center border-b border-slate-700">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black">
                    {doc.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">{doc.name}</h3>
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{doc.doctorName || 'Perfil Clínico Não Definido'} • {doc.specialty || 'Sem Especialidade'}</p>
                    <p className="text-[9px] text-slate-500 font-mono mt-1">Login: {doc.username}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setEditingUser({ role: 'secretary', parentId: doc.id, permissions: ['agenda', 'pacientes', 'crm', 'scripts'] })}
                    className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all"
                  >
                    + Novo Sub-usuário
                  </button>
                  <button onClick={() => setEditingUser(doc)} className="text-slate-400 hover:text-white p-2 bg-slate-700/50 rounded-xl transition-all"><i className="fa-solid fa-pen-to-square"></i></button>
                  <button onClick={() => handleDelete(doc.id)} className="text-red-400 hover:text-white p-2 bg-red-900/30 rounded-xl transition-all"><i className="fa-solid fa-trash-can"></i></button>
                </div>
              </div>

              {/* Sub-usuários (Secretárias) */}
              <div className="px-8 py-4 bg-slate-900/40">
                <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-4 ml-2">Equipe Vinculada</h4>
                <div className="space-y-2">
                  {users.filter(u => u.parentId === doc.id).map(sub => (
                    <div key={sub.id} className="flex justify-between items-center p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 group hover:border-indigo-500/50 transition-all">
                      <div className="flex items-center gap-3">
                        <i className="fa-solid fa-user-gear text-slate-600 text-xs"></i>
                        <div>
                          <p className="text-sm font-black text-slate-300 uppercase leading-none">{sub.name}</p>
                          <p className="text-[9px] text-slate-500 font-mono">login: {sub.username}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setEditingUser(sub)} className="text-indigo-400 hover:text-indigo-300 p-2"><i className="fa-solid fa-pen"></i></button>
                         <button onClick={() => handleDelete(sub.id)} className="text-red-400 hover:text-red-300 p-2"><i className="fa-solid fa-trash"></i></button>
                      </div>
                    </div>
                  ))}
                  {users.filter(u => u.parentId === doc.id).length === 0 && (
                    <p className="text-[9px] text-slate-600 italic ml-2">Nenhum sub-usuário para este médico.</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-slate-900 rounded-[48px] w-full max-w-xl p-10 border border-slate-800 shadow-2xl animate-in zoom-in-95">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 border-b border-slate-800 pb-4">
                {editingUser.id ? 'Editar Conta' : editingUser.role === 'doctor' ? 'Nova Conta Médica' : 'Nova Sub-conta'}
              </h2>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                 <div className="col-span-2">
                    <label className="block text-[9px] font-black text-slate-500 uppercase ml-2 mb-2">Nome Completo</label>
                    <input 
                      type="text" 
                      className="w-full p-4 rounded-2xl bg-slate-800 border-none font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editingUser.name || ''}
                      onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase ml-2 mb-2">Login (Usuário)</label>
                    <input 
                      type="text" 
                      className="w-full p-4 rounded-2xl bg-slate-800 border-none font-black text-indigo-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editingUser.username || ''}
                      onChange={e => setEditingUser({...editingUser, username: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase ml-2 mb-2">Senha</label>
                    <input 
                      type="text" 
                      className="w-full p-4 rounded-2xl bg-slate-800 border-none font-black text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="9 chars, 1 Maj, 1 Num, 1 Esp."
                      value={editingUser.password || ''}
                      onChange={e => setEditingUser({...editingUser, password: e.target.value})}
                    />
                 </div>

                 {editingUser.role === 'doctor' ? (
                   <>
                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase ml-2 mb-2">Nome do Médico (Perfil)</label>
                        <input 
                          type="text" 
                          className="w-full p-4 rounded-2xl bg-slate-800 border-none font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Ex: Dr. Fulano de Tal"
                          value={editingUser.doctorName || ''}
                          onChange={e => setEditingUser({...editingUser, doctorName: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase ml-2 mb-2">Especialidade (Perfil)</label>
                        <input 
                          type="text" 
                          className="w-full p-4 rounded-2xl bg-slate-800 border-none font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Ex: Cardiologista"
                          value={editingUser.specialty || ''}
                          onChange={e => setEditingUser({...editingUser, specialty: e.target.value})}
                        />
                    </div>
                   </>
                 ) : (
                   <div className="col-span-2 bg-indigo-900/20 p-4 rounded-2xl border border-indigo-500/30">
                      <p className="text-[10px] font-black text-indigo-400 uppercase text-center">Vinculado ao Médico ID: {editingUser.parentId}</p>
                   </div>
                 )}
              </div>

              <div className="flex gap-4">
                 <button onClick={() => setEditingUser(null)} className="flex-1 py-5 text-slate-500 font-black uppercase text-xs hover:text-slate-300 transition-colors">Cancelar</button>
                 <button onClick={handleSave} className="flex-[2] py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-3xl font-black uppercase text-sm shadow-2xl transition-all">Salvar Usuário</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;
