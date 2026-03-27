
import React, { useState, useMemo, useEffect } from 'react';
import { useConfirm } from '../ConfirmContext';
import { DaySchedule, Appointment, ClinicConfig, PatientMetadata } from '../types';

interface PatientListProps {
  agendaData: DaySchedule[];
  config: ClinicConfig;
  patientMetadata: PatientMetadata;
  setPatientMetadata: (meta: PatientMetadata) => void;
  onSelectPatient: (patient: Partial<Appointment>) => void;
  onSelectPatientContext?: (name: string) => void;
  onStartConsultation: () => void;
  selectedPatientName?: string;
  onUnifyPatients?: (targetName: string, sourceName: string) => void;
  onDeletePatient?: (name: string) => void;
}

const PatientList: React.FC<PatientListProps> = ({ 
  agendaData, 
  config, 
  patientMetadata, 
  setPatientMetadata,
  onSelectPatient, 
  onSelectPatientContext,
  onStartConsultation, 
  selectedPatientName,
  onUnifyPatients,
  onDeletePatient
}) => {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [viewingPatient, setViewingPatient] = useState<string | null>(selectedPatientName || null);
  const [isEditing, setIsEditing] = useState(false);
  const confirm = useConfirm();
  
  // Estados para modo Unificação
  const [isUnifyMode, setIsUnifyMode] = useState(false);
  const [selectedForUnify, setSelectedForUnify] = useState<string[]>([]);
  
  // Estados para Portal do Paciente
  const [isSharePortalModalOpen, setIsSharePortalModalOpen] = useState(false);
  const [shareExpiryHours, setShareExpiryHours] = useState(24);
  const [generatedPortalLink, setGeneratedPortalLink] = useState('');

  // Estado para edição de ficha
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    cpf: '',
    birthDate: '',
    cityState: '',
    age: '',
    followUpEnabled: true
  });

  const calculateAge = (birthdayStr: string) => {
    if (!birthdayStr) return "";
    const birthDate = new Date(birthdayStr + 'T00:00:00');
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };

  useEffect(() => {
    if (editForm.birthDate) {
      const newAge = calculateAge(editForm.birthDate);
      setEditForm(prev => ({ ...prev, age: newAge }));
    }
  }, [editForm.birthDate]);

  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    agendaData.forEach(day => {
      day.appointments.forEach(apt => {
        if (apt.cityState && apt.cityState.trim()) {
           cities.add(apt.cityState.trim());
        }
      });
    });
    return Array.from(cities).sort();
  }, [agendaData]);

  const patients = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    agendaData.forEach(day => {
      day.appointments.forEach(apt => {
        const existing = map.get(apt.patientName) || [];
        map.set(apt.patientName, [...existing, apt]);
      });
    });
    
    return Array.from(map.entries()).map(([name, history]) => {
      const sortedHistory = history.sort((a, b) => b.date.localeCompare(a.date));
      const lastApt = sortedHistory[0];
      const meta = patientMetadata[name] || { tags: [] };

      const phone = meta.phone || lastApt.phone;
      const cpf = meta.cpf || lastApt.cpf;
      const birthDate = meta.birthDate || lastApt.birthDate;
      const displayAge = birthDate ? calculateAge(birthDate) : (lastApt.age || 'N/I');

      return {
        name,
        history: sortedHistory,
        lastApt: { ...lastApt, phone, cpf, birthDate, age: displayAge },
        tags: meta.tags || [],
        followUpEnabled: meta.followUpEnabled !== false
      };
    }).filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.lastApt.phone || '').includes(search);
      const matchesTag = tagFilter ? p.tags.includes(tagFilter) : true;
      const matchesCity = cityFilter ? p.lastApt.cityState === cityFilter : true;
      return matchesSearch && matchesTag && matchesCity;
    });
  }, [agendaData, search, tagFilter, cityFilter, patientMetadata]);

  const patientDetail = useMemo(() => {
    if (!viewingPatient) return null;
    return patients.find(p => p.name === viewingPatient);
  }, [patients, viewingPatient]);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    confirm({
      type: 'alert',
      title: 'Copiado',
      message: 'Telefone copiado com sucesso!'
    });
  };

  const startEdit = () => {
    if (patientDetail) {
      setEditForm({
        name: patientDetail.name,
        phone: patientDetail.lastApt.phone || '',
        cpf: patientDetail.lastApt.cpf || '',
        birthDate: patientDetail.lastApt.birthDate || '',
        cityState: patientDetail.lastApt.cityState || '',
        age: patientDetail.lastApt.age || '',
        followUpEnabled: patientDetail.followUpEnabled !== false
      });
      setIsEditing(true);
    }
  };

  const handleEditSave = () => {
    if (patientDetail && onUnifyPatients) {
       // Se o nome mudou, tratamos como unificação forçada (renomeação)
       if (editForm.name !== patientDetail.name) {
          confirm({
            title: 'Renomear Paciente',
            message: `Deseja alterar o nome de "${patientDetail.name}" para "${editForm.name}"? Isso atualizará todos os registros históricos.`,
            confirmLabel: 'Confirmar Alteração',
            onConfirm: () => {
               onUnifyPatients(editForm.name, patientDetail.name);
               setViewingPatient(editForm.name);
               if (onSelectPatientContext) onSelectPatientContext(editForm.name);
               saveMeta();
            }
          });
       } else {
         saveMeta();
       }
    }
  };

  const saveMeta = () => {
    setPatientMetadata({
      ...patientMetadata,
      [editForm.name]: {
         ...patientMetadata[editForm.name],
         phone: editForm.phone,
         cpf: editForm.cpf,
         birthDate: editForm.birthDate,
         followUpEnabled: editForm.followUpEnabled
      }
    });
    setIsEditing(false);
  };

  const handleUnifyAction = () => {
    if (selectedForUnify.length === 2 && onUnifyPatients) {
      const [p1, p2] = selectedForUnify;
      confirm({
        type: 'prompt',
        title: 'Unificar Pacientes',
        message: `Digite o NOME CORRETO final para unificar ${p1} e ${p2}:`,
        defaultValue: p1,
        onConfirm: (target) => {
          if (target) {
             if (target === p1) onUnifyPatients(p1, p2);
             else if (target === p2) onUnifyPatients(p2, p1);
             else {
                confirm({
                  type: 'alert',
                  title: 'Erro na Unificação',
                  message: 'O nome de destino deve ser um dos dois selecionados para manter a integridade.'
                });
                return;
             }
             setSelectedForUnify([]);
             setIsUnifyMode(false);
          }
        }
      });
    }
  };

  const toggleTag = (tagId: string) => {
    if (patientDetail) {
      const currentTags = patientMetadata[patientDetail.name]?.tags || [];
      const newTags = currentTags.includes(tagId) 
        ? currentTags.filter(t => t !== tagId) 
        : [...currentTags, tagId];
      
      setPatientMetadata({
         ...patientMetadata,
         [patientDetail.name]: {
            ...patientMetadata[patientDetail.name],
            tags: newTags
         }
      });
    }
  };

  const handleSetViewing = (name: string) => {
    setViewingPatient(name);
    if (onSelectPatientContext) onSelectPatientContext(name);
  };

  const handleGeneratePortalLink = () => {
    if (!viewingPatient) return;
    const expiry = Date.now() + (shareExpiryHours * 3600 * 1000);
    const pEnc = btoa(viewingPatient);
    const link = `${window.location.origin}${window.location.pathname}?portal=1&p=${pEnc}&e=${expiry}`;
    setGeneratedPortalLink(link);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">
            {viewingPatient ? 'Ficha do Paciente' : 'Base de Pacientes'}
          </h2>
          <p className="text-slate-500 font-medium tracking-tight">
            {viewingPatient ? viewingPatient : 'Listagem completa e histórico clínico'}
          </p>
        </div>
        <div className="flex gap-2">
           {!viewingPatient && (
             <button 
               type="button"
               onClick={() => { setIsUnifyMode(!isUnifyMode); setSelectedForUnify([]); }}
               className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isUnifyMode ? 'bg-amber-500 text-white shadow-lg' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}
             >
               <i className="fa-solid fa-object-group mr-2"></i> {isUnifyMode ? 'Cancelar Unificação' : 'Unificar Duplicados'}
             </button>
           )}
           {viewingPatient && (
             <div className="flex gap-2">
                <button type="button" onClick={() => { setGeneratedPortalLink(''); setIsSharePortalModalOpen(true); }} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center gap-2"><i className="fa-solid fa-share-nodes"></i> Compartilhar Link de Envio</button>
                <button type="button" onClick={() => { if(onDeletePatient) onDeletePatient(viewingPatient); setViewingPatient(null); }} className="text-red-600 font-black text-[10px] uppercase bg-red-50 px-4 py-2 rounded-xl border border-red-100 hover:bg-red-100 transition-colors">Excluir Cadastro</button>
                <button type="button" onClick={() => { setViewingPatient(null); setIsEditing(false); }} className="text-indigo-600 font-black text-[10px] uppercase bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">Voltar para lista</button>
             </div>
           )}
        </div>
      </header>

      {!viewingPatient ? (
        <>
          <div className="bg-white p-6 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input 
                type="text" 
                placeholder="Pesquisar por nome ou telefone..." 
                className="w-full pl-12 p-4 rounded-2xl bg-slate-50 border-none font-bold placeholder:text-slate-300"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <div className="w-full md:w-48">
               <select 
                 className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-600 text-xs uppercase cursor-pointer"
                 value={cityFilter}
                 onChange={e => setCityFilter(e.target.value)}
               >
                 <option value="">Todas Cidades</option>
                 {uniqueCities.map(city => (
                   <option key={city} value={city}>{city}</option>
                 ))}
               </select>
            </div>

            <div className="w-full md:w-48">
               <select 
                 className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-600 text-xs uppercase cursor-pointer"
                 value={tagFilter}
                 onChange={e => setTagFilter(e.target.value)}
               >
                 <option value="">Todas Etiquetas</option>
                 {(config.tags || []).map(tag => (
                   <option key={tag.id} value={tag.id}>{tag.name}</option>
                 ))}
               </select>
            </div>
          </div>

          {isUnifyMode && (
            <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-200 flex justify-between items-center animate-in slide-in-from-top-4">
               <div>
                  <p className="text-amber-800 font-black text-sm uppercase">Modo de Unificação Ativo</p>
                  <p className="text-amber-600 text-[10px] font-bold uppercase">Selecione 2 pacientes com nomes parecidos para mesclar seus históricos.</p>
               </div>
               {selectedForUnify.length === 2 && (
                  <button type="button" onClick={handleUnifyAction} className="bg-amber-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-amber-700">Mesclar Agora</button>
               )}
            </div>
          )}

          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {isUnifyMode && <th className="px-8 py-5 w-10"></th>}
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Paciente</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Telefone / CPF</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Cidade / Idade</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Etiquetas</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p, idx) => (
                  <tr key={idx} className={`hover:bg-slate-50 transition-colors cursor-pointer group ${selectedForUnify.includes(p.name) ? 'bg-amber-50' : ''}`} onClick={() => {
                     if(isUnifyMode) {
                        if(selectedForUnify.includes(p.name)) setSelectedForUnify(selectedForUnify.filter(n => n !== p.name));
                        else if(selectedForUnify.length < 2) setSelectedForUnify([...selectedForUnify, p.name]);
                     } else {
                        handleSetViewing(p.name);
                     }
                  }}>
                    {isUnifyMode && (
                      <td className="px-8 py-5">
                         <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedForUnify.includes(p.name) ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-200 bg-white'}`}>
                            {selectedForUnify.includes(p.name) && <i className="fa-solid fa-check text-xs"></i>}
                         </div>
                      </td>
                    )}
                    <td className="px-8 py-5">
                      <p className="font-black text-slate-800 uppercase text-sm leading-none">{p.name}</p>
                      <p className="text-[8px] font-bold text-indigo-400 mt-1 uppercase">Paciente Ativo</p>
                    </td>
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-2">
                         <p className="font-black text-slate-700 text-xs">{p.lastApt.phone || 'Sem Tel.'}</p>
                         <button onClick={(e) => { e.stopPropagation(); copyToClipboard(p.lastApt.phone || ''); }} className="text-slate-300 hover:text-indigo-600 transition-colors"><i className="fa-solid fa-copy text-[10px]"></i></button>
                       </div>
                       <p className="text-[9px] text-slate-400 font-mono mt-1">{p.lastApt.cpf || 'Sem CPF'}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-[10px] font-bold text-slate-600 uppercase">{p.lastApt.cityState || 'N/I'}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{p.lastApt.age} Anos</p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-wrap gap-1">
                        {p.tags.map(tagId => {
                          const tag = config.tags?.find(t => t.id === tagId);
                          if (!tag) return null;
                          return <div key={tagId} className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} title={tag.name}></div>;
                        })}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button onClick={(e) => { e.stopPropagation(); handleSetViewing(p.name); }} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Ver Ficha</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4">
           <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden">
                {isEditing ? (
                  <div className="space-y-4">
                    <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-xl" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} placeholder="Telefone" />
                      <input type="text" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" value={editForm.cpf} onChange={e => setEditForm({...editForm, cpf: e.target.value})} placeholder="CPF" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="date" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" value={editForm.birthDate} onChange={e => setEditForm({...editForm, birthDate: e.target.value})} />
                      <input type="text" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" value={editForm.cityState} onChange={e => setEditForm({...editForm, cityState: e.target.value})} placeholder="Cidade/Estado" />
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Permitir Follow-up Automático</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={editForm.followUpEnabled} 
                          onChange={e => setEditForm({...editForm, followUpEnabled: e.target.checked})} 
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => setIsEditing(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                      <button onClick={handleEditSave} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase">Salvar Dados</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button onClick={startEdit} className="absolute top-8 right-8 text-slate-300 hover:text-indigo-600"><i className="fa-solid fa-pen-to-square text-xl"></i></button>
                    <div className="flex items-center gap-6 mb-8">
                       <div className="w-24 h-24 bg-indigo-600 text-white rounded-[32px] flex items-center justify-center text-4xl font-black shadow-xl shadow-indigo-100">
                          {patientDetail?.name.charAt(0)}
                       </div>
                       <div>
                          <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{patientDetail?.name}</h3>
                          <div className="flex gap-2 mt-2">
                             {patientDetail?.tags.map(tagId => {
                               const tag = config.tags?.find(t => t.id === tagId);
                               return tag ? <span key={tagId} className="px-3 py-1 rounded-full text-[8px] font-black uppercase text-white shadow-sm" style={{ backgroundColor: tag.color }}>{tag.name}</span> : null;
                             })}
                          </div>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-8 border-t border-slate-100">
                       <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Telefone</p><p className="font-bold text-slate-700">{patientDetail?.lastApt.phone || 'N/I'}</p></div>
                       <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CPF</p><p className="font-bold text-slate-700">{patientDetail?.lastApt.cpf || 'N/I'}</p></div>
                       <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Idade</p><p className="font-bold text-slate-700">{patientDetail?.lastApt.age} Anos</p></div>
                       <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cidade</p><p className="font-bold text-slate-700">{patientDetail?.lastApt.cityState || 'N/I'}</p></div>
                       <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Follow-up</p>
                          <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${patientDetail?.followUpEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                             {patientDetail?.followUpEnabled ? 'Autorizado' : 'Bloqueado'}
                          </span>
                       </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                   <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Cronologia de Consultas</h4>
                   <button onClick={onStartConsultation} className="bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-2"><i className="fa-solid fa-stethoscope"></i> Iniciar Atendimento</button>
                </div>
                <div className="p-8 space-y-6">
                   {patientDetail?.history.map((h, i) => (
                      <div key={i} className="flex gap-6 relative group">
                         {i < (patientDetail?.history.length || 0) - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-100"></div>}
                         <div className={`w-6 h-6 rounded-full border-4 border-white shadow-sm flex-shrink-0 z-10 ${h.status === 'atendido' ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
                         <div className="flex-1 pb-6">
                            <div className="flex justify-between items-start">
                               <div>
                                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{h.date.split('-').reverse().join('/')} - {h.time}</p>
                                  <h5 className="font-black text-slate-800 uppercase text-xs mt-1">{h.priceTable} • {h.type}</h5>
                               </div>
                               <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${h.status === 'atendido' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{h.status}</span>
                            </div>
                            {h.notes && <div className="mt-3 p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 italic whitespace-pre-wrap">"{h.notes}"</div>}
                         </div>
                      </div>
                   ))}
                </div>
              </div>
           </div>
           
           <div className="space-y-6">
              <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                 <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><i className="fa-solid fa-tags text-indigo-600"></i> Gestão de Etiquetas</h4>
                 <div className="flex flex-wrap gap-2">
                    {config.tags?.map(tag => {
                       const isSelected = patientDetail?.tags.includes(tag.id);
                       return (
                          <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border ${isSelected ? 'bg-white border-slate-300 shadow-md scale-105' : 'bg-slate-50 border-transparent text-slate-400 opacity-60'}`}>
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }}></div>
                             <span style={{ color: isSelected ? '#334155' : 'inherit' }}>{tag.name}</span>
                          </button>
                       );
                    })}
                 </div>
              </div>
           </div>
        </div>
      )}

      {isSharePortalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Compartilhar Link de Envio</h3>
                <button onClick={() => setIsSharePortalModalOpen(false)} className="text-slate-300 hover:text-slate-500"><i className="fa-solid fa-times text-xl"></i></button>
             </div>
             <div className="space-y-6">
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-4">
                   <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-lg"><i className="fa-solid fa-hourglass-half"></i></div>
                   <div className="flex-1">
                      <p className="text-[10px] font-black text-indigo-700 uppercase">Tempo de Validade do Link</p>
                      <div className="flex items-center gap-2 mt-1">
                         <input 
                           type="number" 
                           className="w-16 bg-white border border-indigo-200 rounded-lg p-1 text-center font-black text-xs" 
                           value={shareExpiryHours} 
                           onChange={e => setShareExpiryHours(parseInt(e.target.value))}
                           min="1"
                         />
                         <span className="text-[10px] font-bold text-slate-500 uppercase">Horas</span>
                      </div>
                   </div>
                </div>

                {!generatedPortalLink ? (
                  <button onClick={handleGeneratePortalLink} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-indigo-700">Gerar Link p/ {viewingPatient}</button>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-top-2">
                     <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 break-all text-[10px] font-mono text-slate-600 leading-relaxed select-all">
                        {generatedPortalLink}
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => { navigator.clipboard.writeText(generatedPortalLink); alert('Link copiado!'); }} 
                          className="py-3 bg-white border border-indigo-200 text-indigo-600 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-50"
                        >Copiar Link</button>
                        <button 
                          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Olá! Por favor, utilize este link seguro para nos enviar as fotos ou PDFs dos seus exames: ${generatedPortalLink}`)}`, '_blank')} 
                          className="py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-emerald-600 flex items-center justify-center gap-2"
                        ><i className="fa-brands fa-whatsapp"></i> Mandar WhatsApp</button>
                     </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientList;
