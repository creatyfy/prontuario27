import React, { useState, useEffect } from 'react';
import { useConfirm } from '../ConfirmContext';
import { SpecialistPartner, ExamPartner } from '../types';
import { MOCK_PARTNERS, MOCK_EXAMS } from '../constants';

const Partners: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'specialists' | 'exams'>('specialists');
  const [searchTerm, setSearchTerm] = useState('');
  const confirm = useConfirm();
  
  // Estado para Especialistas
  const [specialists, setSpecialists] = useState<SpecialistPartner[]>(() => {
    const saved = localStorage.getItem('neuroclinic_partners');
    return saved ? JSON.parse(saved) : MOCK_PARTNERS;
  });
  const [newSpecialist, setNewSpecialist] = useState<Partial<SpecialistPartner>>({});

  // Estado para Exames
  const [exams, setExams] = useState<ExamPartner[]>(() => {
    const saved = localStorage.getItem('neuroclinic_exams');
    return saved ? JSON.parse(saved) : MOCK_EXAMS;
  });
  const [newExam, setNewExam] = useState<Partial<ExamPartner>>({});

  useEffect(() => {
    localStorage.setItem('neuroclinic_partners', JSON.stringify(specialists));
  }, [specialists]);

  useEffect(() => {
    localStorage.setItem('neuroclinic_exams', JSON.stringify(exams));
  }, [exams]);

  const handleAddSpecialist = () => {
    if (newSpecialist.name && newSpecialist.specialty) {
      setSpecialists([...specialists, { ...newSpecialist, id: `p-${Date.now()}` } as SpecialistPartner]);
      setNewSpecialist({});
    }
  };

  const handleDeleteSpecialist = (id: string) => {
    confirm({
      title: 'Remover Especialista',
      message: 'Tem certeza que deseja remover este colega da lista de parceiros?',
      confirmLabel: 'Remover',
      onConfirm: () => setSpecialists(specialists.filter(s => s.id !== id))
    });
  };

  const handleAddExam = () => {
    if (newExam.examName && newExam.location) {
      setExams([...exams, { ...newExam, id: `e-${Date.now()}` } as ExamPartner]);
      setNewExam({});
    }
  };

  const handleDeleteExam = (id: string) => {
    confirm({
      title: 'Remover Local de Exame',
      message: 'Tem certeza que deseja remover este laboratório parceiro?',
      confirmLabel: 'Remover',
      onConfirm: () => setExams(exams.filter(e => e.id !== id))
    });
  };

  const copySpecialist = (s: SpecialistPartner) => {
    const text = `*Indicação de Colega Especialista*\n\n*Especialidade:* ${s.specialty}\n*Profissional:* ${s.name}\n*Contato:* ${s.phone}\n*Local:* ${s.location}`;
    navigator.clipboard.writeText(text);
    confirm({
      type: 'alert',
      title: 'Copiado',
      message: 'Informações do especialista copiadas!'
    });
  };

  const copyExam = (e: ExamPartner) => {
    const text = `*Indicação de Exame*\n\n*Exame:* ${e.examName}\n*Local:* ${e.location}\n*Contato:* ${e.contact}\n*Site:* ${e.website}`;
    navigator.clipboard.writeText(text);
    confirm({
      type: 'alert',
      title: 'Copiado',
      message: 'Informações do exame copiadas!'
    });
  };

  const filteredSpecialists = specialists.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredExams = exams.filter(e => 
    e.examName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Contatos Parceiros</h2>
          <p className="text-slate-500 font-medium">Rede de referenciamento e exames</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button type="button" onClick={() => setActiveTab('specialists')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'specialists' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Colegas Especialistas</button>
          <button type="button" onClick={() => setActiveTab('exams')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'exams' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Exames e Labs</button>
        </div>
      </header>

      {/* Buscador Global para a aba ativa */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3">
        <i className="fa-solid fa-magnifying-glass text-slate-300 ml-2"></i>
        <input 
          type="text" 
          placeholder={`Buscar em ${activeTab === 'specialists' ? 'especialistas' : 'exames'}...`} 
          className="w-full bg-transparent border-none outline-none font-bold text-slate-600 text-sm placeholder:text-slate-300"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-slate-300 hover:text-slate-500 p-1">
            <i className="fa-solid fa-circle-xmark"></i>
          </button>
        )}
      </div>

      {activeTab === 'specialists' && (
        <div className="space-y-6">
          {/* Formulário de Adição */}
          <div className="bg-white p-6 rounded-[40px] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4">Adicionar Especialista</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-1">
                <input placeholder="Especialidade" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={newSpecialist.specialty || ''} onChange={e => setNewSpecialist({...newSpecialist, specialty: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <input placeholder="Nome do Especialista" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={newSpecialist.name || ''} onChange={e => setNewSpecialist({...newSpecialist, name: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <input placeholder="Telefone/Contato" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={newSpecialist.phone || ''} onChange={e => setNewSpecialist({...newSpecialist, phone: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <input placeholder="Local de Atendimento" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={newSpecialist.location || ''} onChange={e => setNewSpecialist({...newSpecialist, location: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <button type="button" onClick={handleAddSpecialist} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg hover:bg-indigo-700 transition-all">Salvar</button>
              </div>
            </div>
          </div>

          {/* Tabela de Listagem */}
          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Especialidade</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Nome</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Contato</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Local</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSpecialists.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-indigo-600 uppercase">{s.specialty}</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-800 uppercase">{s.name}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{s.phone}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{s.location}</td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button type="button" onClick={() => copySpecialist(s)} className="bg-emerald-100 text-emerald-600 p-2 rounded-lg hover:bg-emerald-200 transition-colors" title="Copiar Informações"><i className="fa-solid fa-copy"></i></button>
                      <button type="button" onClick={() => handleDeleteSpecialist(s.id)} className="bg-red-50 text-red-400 p-2 rounded-lg hover:bg-red-100 transition-colors" title="Remover"><i className="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                ))}
                {filteredSpecialists.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-300 italic text-xs">Nenhum colega encontrado com os filtros atuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'exams' && (
        <div className="space-y-6">
          {/* Formulário de Adição */}
          <div className="bg-white p-6 rounded-[40px] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4">Adicionar Exame/Lab</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-1">
                <input placeholder="Nome do Exame" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={newExam.examName || ''} onChange={e => setNewExam({...newExam, examName: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <input placeholder="Local/Laboratório" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={newExam.location || ''} onChange={e => setNewExam({...newExam, location: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <input placeholder="Contato" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={newExam.contact || ''} onChange={e => setNewExam({...newExam, contact: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <input placeholder="Site/Link" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={newExam.website || ''} onChange={e => setNewExam({...newExam, website: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <button type="button" onClick={handleAddExam} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg hover:bg-indigo-700 transition-all">Salvar</button>
              </div>
            </div>
          </div>

          {/* Tabela de Listagem */}
          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Exame</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Local</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Contato</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Site</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredExams.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-black text-slate-800 uppercase">{e.examName}</td>
                    <td className="px-6 py-4 text-xs font-bold text-indigo-600 uppercase">{e.location}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{e.contact}</td>
                    <td className="px-6 py-4 text-xs font-bold text-blue-500 underline truncate max-w-[150px]"><a href={`https://${e.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer">{e.website}</a></td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button type="button" onClick={() => copyExam(e)} className="bg-emerald-100 text-emerald-600 p-2 rounded-lg hover:bg-emerald-200 transition-colors" title="Copiar Informações"><i className="fa-solid fa-copy"></i></button>
                      <button type="button" onClick={() => handleDeleteExam(e.id)} className="bg-red-50 text-red-400 p-2 rounded-lg hover:bg-red-100 transition-colors" title="Remover"><i className="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                ))}
                {filteredExams.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-300 italic text-xs">Nenhum exame encontrado com os filtros atuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Partners;