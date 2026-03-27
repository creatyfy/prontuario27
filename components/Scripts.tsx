import React, { useState, useEffect, useMemo } from 'react';
import { SCRIPTS, INITIAL_SECRETARY_TASKS } from '../constants';
import { ScriptItem, UserRole, LocationInfo, DaySchedule, ClinicConfig, Appointment, ChecklistTask } from '../types';

interface ScriptsProps {
  role: UserRole;
  locations: LocationInfo[];
  agendaData?: Record<string, DaySchedule>;
  config?: ClinicConfig;
  onConfirmAppointment?: (date: string, aptId: string) => void;
  onUpdateAppointment?: (date: string, apt: Appointment) => void;
  onDeleteAppointment?: (date: string, aptId: string) => void;
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const Scripts: React.FC<ScriptsProps> = ({ role, locations, agendaData, config, onConfirmAppointment, onUpdateAppointment, onDeleteAppointment }) => {
  const [activeTab, setActiveTab] = useState<'scripts' | 'checklist' | 'info'>('scripts');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [scripts, setScripts] = useState<ScriptItem[]>(() => {
    const saved = localStorage.getItem('neuroclinic_scripts');
    return saved ? JSON.parse(saved) : SCRIPTS;
  });
  const [showAddScript, setShowAddScript] = useState(false);
  const [newScript, setNewScript] = useState<ScriptItem>({ category: 'Administrativo', trigger: '', content: '' });
  const [editingTarget, setEditingTarget] = useState<ScriptItem | null>(null);
  
  const [selectedChecklistDate, setSelectedChecklistDate] = useState(new Date());
  const [completedManualTasks, setCompletedManualTasks] = useState<string[]>([]);

  const categories = ['Todos', 'Lembretes', 'Pós-Consulta', 'Financeiro', 'Administrativo'];

  useEffect(() => {
    localStorage.setItem('neuroclinic_scripts', JSON.stringify(scripts));
  }, [scripts]);

  useEffect(() => {
    setCompletedManualTasks([]);
  }, [selectedChecklistDate]);

  const filteredScripts = activeCategory === 'Todos' 
    ? scripts 
    : scripts.filter(s => s.category === activeCategory);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    alert('Copiado!');
  };

  const handleSaveScript = () => {
    if (newScript.trigger && newScript.content) {
      if (editingTarget) {
         setScripts(scripts.map(s => s === editingTarget ? newScript : s));
         setEditingTarget(null);
      } else {
         setScripts([newScript, ...scripts]);
      }
      setShowAddScript(false);
      setNewScript({ category: 'Administrativo', trigger: '', content: '' });
    }
  };

  const handleEditScript = (script: ScriptItem) => {
     setNewScript({ ...script });
     setEditingTarget(script);
     setShowAddScript(true);
  };

  const handleDeleteScript = (script: ScriptItem) => {
     if (window.confirm('Tem certeza que deseja excluir este script?')) {
        setScripts(scripts.filter(s => s !== script));
     }
  };

  const dateRange = useMemo(() => {
    const dates = [];
    const today = new Date();
    for (let i = -10; i <= 10; i++) {
       const d = new Date(today);
       d.setDate(today.getDate() + i);
       dates.push(d);
    }
    return dates;
  }, []);

  const dynamicTasks = useMemo(() => {
    if (!agendaData || !config?.confirmationConfig) return [];
    const tasks: any[] = [];
    const selectedDateStr = selectedChecklistDate.toISOString().split('T')[0];
    const { confirmDaysBefore, reminderDaysBefore, sameDayReminder, sameDayPostConsult } = config.confirmationConfig;
    
    const getTargetDateWithBusinessOffset = (offsetDays: number) => {
        let t = new Date(selectedChecklistDate);
        let added = 0;
        while (added < offsetDays) {
            t.setDate(t.getDate() + 1);
            if (t.getDay() !== 0 && t.getDay() !== 6) {
                added++;
            }
        }
        return t.toISOString().split('T')[0];
    };

    const reminderDateTarget = getTargetDateWithBusinessOffset(reminderDaysBefore);
    const dayScheduleReminder = agendaData[reminderDateTarget];
    if (dayScheduleReminder?.appointments) {
        dayScheduleReminder.appointments.forEach(apt => {
           if((apt.status === 'agendado' || apt.status === 'check-in') && apt.type !== 'bloqueio') {
               tasks.push({ type: 'reminder', text: `Enviar 1º Lembrete para ${apt.patientName} (${apt.time}) - Dia ${reminderDateTarget.split('-').reverse().join('/')}`, patientName: apt.patientName, contact: apt.phone || '', apt: apt, isDone: !!apt.reminderSent });
           }
        });
    }

    const confirmDateTarget = getTargetDateWithBusinessOffset(confirmDaysBefore);
    const dayScheduleConfirm = agendaData[confirmDateTarget];
    if (dayScheduleConfirm?.appointments) {
        dayScheduleConfirm.appointments.forEach(apt => {
           if((apt.status === 'agendado' || apt.status === 'check-in') && apt.type !== 'bloqueio') {
               tasks.push({ type: 'confirmation', text: `Enviar Confirmação Oficial para ${apt.patientName} (${apt.time}) - Dia ${confirmDateTarget.split('-').reverse().join('/')}`, patientName: apt.patientName, contact: apt.phone || '', apt: apt, isDone: !!apt.confirmationRequestSent });
           }
        });
    }

    const dayScheduleToday = agendaData[selectedDateStr];
    if (dayScheduleToday?.appointments) {
        dayScheduleToday.appointments.forEach(apt => {
           if(apt.type !== 'bloqueio') {
               // Ações de Fluxo (Removido Finalizar Atendimento e Confirmar Entrada conforme solicitado)
               if (apt.status === 'check-in') {
                   tasks.push({ type: 'check-out-action', text: `Paciente em espera: ${apt.patientName} (${apt.time})`, contact: apt.phone || '', apt: apt, isDone: false });
               }

               // Lembrete do Dia
               if (sameDayReminder && (apt.status === 'agendado' || apt.status === 'check-in')) {
                   tasks.push({ type: 'same-day', text: `Lembrete do Dia: ${apt.patientName} às ${apt.time}`, contact: apt.phone || '', apt: apt, isDone: !!apt.preConsultSent });
               }

               // Pós-Consulta
               if (sameDayPostConsult && apt.status === 'atendido') {
                   tasks.push({ type: 'post-consult', text: `Pós-Consulta: ${apt.patientName} (${apt.time})`, contact: apt.phone || '', apt: apt, isDone: !!apt.postConsultSent });
               }
           }
        });
    }
    
    return tasks;
  }, [agendaData, config, selectedChecklistDate]);

  const handleToggleTask = (task: any) => {
     if (!onUpdateAppointment) return;
     let updates: Partial<Appointment> = {};
     if (task.type === 'reminder') updates = { reminderSent: !task.isDone };
     if (task.type === 'same-day') updates = { preConsultSent: !task.isDone };
     if (task.type === 'post-consult') updates = { postConsultSent: !task.isDone };
     if (task.type === 'confirmation') updates = { confirmationRequestSent: !task.isDone };
     onUpdateAppointment(task.apt.date, { ...task.apt, ...updates });
  };

  const handleDesmarcarNoChecklist = (apt: Appointment) => {
    if (onDeleteAppointment && window.confirm(`Deseja desmarcar o paciente ${apt.patientName}? O horário será liberado imediatamente.`)) {
      onDeleteAppointment(apt.date, apt.id);
    }
  };

  const filteredManualTasks = useMemo(() => {
    const list = (config?.confirmationConfig?.customChecklist || INITIAL_SECRETARY_TASKS) as ChecklistTask[];
    return list.filter(t => {
      if (t.frequency === 'daily') return true;
      if (t.frequency === 'weekly') return t.dayOfWeek === selectedChecklistDate.getDay();
      if (t.frequency === 'monthly') return t.dayOfMonth === selectedChecklistDate.getDate();
      if (t.frequency === 'specific') return t.date === selectedChecklistDate.toISOString().split('T')[0];
      return false;
    });
  }, [config, selectedChecklistDate]);

  const handleCopyRoutineSummary = () => {
    const dateStr = selectedChecklistDate.toLocaleDateString('pt-BR');
    let summary = `📋 *RESUMO DA ROTINA - ${dateStr}*\n\n`;
    
    const doneAuto = dynamicTasks.filter(t => t.isDone).map(t => t.text);
    const pendingAuto = dynamicTasks.filter(t => !t.isDone).map(t => t.text);
    
    const doneManual = filteredManualTasks.filter(t => completedManualTasks.includes(t.id)).map(t => t.task);
    const pendingManual = filteredManualTasks.filter(t => !completedManualTasks.includes(t.id)).map(t => t.task);

    const allDone = [...doneAuto, ...doneManual];
    const allPending = [...pendingAuto, ...pendingManual];

    if (allDone.length > 0) {
      summary += `✅ *CONCLUÍDO:*\n`;
      allDone.forEach(text => summary += `- ${text}\n`);
      summary += `\n`;
    }

    if (allPending.length > 0) {
      summary += `⏳ *PENDENTE (O QUE FALTOU):*\n`;
      allPending.forEach(text => summary += `- ${text}\n`);
      summary += `\n`;
    }
    
    if (allDone.length === 0 && allPending.length === 0) {
      summary += `Nenhuma tarefa registrada para hoje.`;
    }

    navigator.clipboard.writeText(summary);
    alert('Resumo da rotina criado e copiado com sucesso!');
  };

  return (
    <div className="space-y-8 pb-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div><h2 className="text-3xl font-black text-slate-800 tracking-tight">Gestão da Secretaria</h2><p className="text-slate-500 font-medium">Controle de tarefas e scripts</p></div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setActiveTab('scripts')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'scripts' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Respostas Rápidas</button>
          <button onClick={() => setActiveTab('checklist')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'checklist' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Checklist</button>
          <button onClick={() => setActiveTab('info')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'info' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Informações</button>
        </div>
      </header>

      {activeTab === 'info' && (
        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-8 min-h-[400px]">
           <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Informações do Médico</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(config?.secretaryInfo || []).map(info => (
                <div key={info.id} className="bg-slate-50 border border-slate-100 p-6 rounded-[32px] shadow-sm">
                   <h4 className="font-black text-slate-800 text-sm uppercase mb-3 border-b pb-2">{info.title}</h4>
                   <div className="text-xs text-slate-600 font-medium whitespace-pre-wrap">{info.content}</div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'scripts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4"><h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest">Scripts</h3><button onClick={() => { setEditingTarget(null); setNewScript({ category: 'Administrativo', trigger: '', content: '' }); setShowAddScript(true); }} className="bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Novo Script</button></div>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-100'}`}>{cat}</button>
                ))}
              </div>
              {filteredScripts.map((script, idx) => (
                <div key={idx} className="bg-white rounded-[40px] border border-slate-200 p-6 shadow-sm group">
                  <div className="flex justify-between items-start mb-3">
                      <span className="text-[8px] font-black uppercase bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">{script.category}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditScript(script)} className="text-slate-300 hover:text-indigo-600 p-1" title="Editar"><i className="fa-solid fa-pen"></i></button>
                          <button onClick={() => handleDeleteScript(script)} className="text-slate-300 hover:text-red-500 p-1" title="Excluir"><i className="fa-solid fa-trash"></i></button>
                          <button onClick={() => copyToClipboard(script.content)} className="text-slate-300 hover:text-indigo-600 p-1" title="Copiar"><i className="fa-solid fa-copy"></i></button>
                      </div>
                  </div>
                  <h4 className="font-black text-slate-800 mb-2 uppercase text-sm">{script.trigger}</h4>
                  <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-600 italic whitespace-pre-wrap">{script.content}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest ml-4">Endereços</h3>
            <div className="bg-white rounded-[40px] p-8 border border-slate-200 shadow-sm">
              {locations.map((loc, idx) => (
                <div key={idx} className="border-b border-slate-100 pb-6 mb-6 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-lg text-slate-800">{loc.name}</h4>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const text = `🧠 *INFORMAÇÕES DE ATENDIMENTO*\n\n📍 *Clínica:* ${loc.name}\n🏠 *Endereço:* ${loc.address}\n🗺️ *Link do Mapa:* ${loc.mapLink}${loc.observations ? `\n\n⚠️ *Observações:* ${loc.observations}` : ''}`;
                          copyToClipboard(text);
                        }} 
                        className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center justify-center" 
                        title="Copiar Informativo Completo"
                      >
                        <i className="fa-solid fa-copy"></i>
                      </button>
                      <a href={loc.mapLink} target="_blank" rel="noreferrer" className="bg-slate-50 text-slate-400 p-2.5 rounded-xl hover:text-indigo-600 transition-all border border-slate-100 flex items-center justify-center" title="Abrir no Google Maps">
                        <i className="fa-solid fa-location-arrow"></i>
                      </a>
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs font-bold leading-relaxed">{loc.address}</p>
                  {loc.observations && (<p className="mt-3 text-[10px] text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-100 font-medium">{loc.observations}</p>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'checklist' && (
        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Rotina da Secretaria</h3>
             <button 
               onClick={handleCopyRoutineSummary}
               className="bg-indigo-50 text-indigo-600 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-sm border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center gap-2"
             >
               <i className="fa-solid fa-clipboard-list"></i> Copiar Resumo da Rotina
             </button>
          </div>
          
          <div className="mb-8 overflow-x-auto pb-4">
             <div className="flex gap-2 w-max mx-auto">
                {dateRange.map(date => {
                   const isSelected = date.toDateString() === selectedChecklistDate.toDateString();
                   const isToday = date.toDateString() === new Date().toDateString();
                   return (<button key={date.toISOString()} onClick={() => setSelectedChecklistDate(date)} className={`flex flex-col items-center justify-center w-14 h-20 rounded-2xl border transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-110' : 'bg-white border-slate-100 text-slate-400'}`}><span className="text-[8px] font-black uppercase">{WEEKDAYS[date.getDay()].substring(0,3)}</span><span className="text-xl font-black my-1">{date.getDate()}</span>{isToday && <span className="w-1 h-1 rounded-full bg-emerald-400"></span>}</button>)
                })}
             </div>
          </div>
          <p className="text-center text-xs font-black uppercase text-indigo-600 mb-6 pb-4 border-b">Tarefas para {selectedChecklistDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>

          <div className="space-y-3 mb-8">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Automático</h4>
             {dynamicTasks.map((task, idx) => (
               <div key={`dyn-${idx}`} className={`flex items-center justify-between p-4 rounded-2xl border ${task.isDone ? 'bg-emerald-100 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                     { (task.type === 'check-out-action') ? (
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white bg-indigo-400`}>
                            <i className={`fa-solid fa-user-clock`}></i>
                         </div>
                     ) : (
                         <div onClick={() => handleToggleTask(task)} className={`w-8 h-8 rounded-full flex items-center justify-center text-white cursor-pointer ${task.isDone ? 'bg-emerald-600' : 'bg-slate-300'}`}><i className="fa-solid fa-check"></i></div>
                     )}
                     <p className={`text-xs font-bold ${task.isDone ? 'text-emerald-800 line-through' : 'text-slate-700'}`}>{task.text}</p>
                  </div>
                  <div className="flex gap-2">
                    { (task.type === 'confirmation') && (
                        <button 
                          onClick={() => onUpdateAppointment?.(task.apt.date, { ...task.apt, confirmed: !task.apt.confirmed })}
                          className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-sm border transition-all flex items-center gap-1.5 ${
                            task.apt.confirmed 
                              ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-600 hover:text-white' 
                              : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white'
                          }`}
                        >
                          <i className={`fa-solid ${task.apt.confirmed ? 'fa-calendar-xmark' : 'fa-calendar-check'}`}></i>
                          {task.apt.confirmed ? 'Desconfirmar' : 'Confirmar Presença'}
                        </button>
                    )}
                    <button 
                      onClick={() => { copyToClipboard(task.contact || ''); }} 
                      className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-100 border border-indigo-100 flex items-center gap-1.5"
                      title="Copiar Telefone"
                    >
                      <i className="fa-solid fa-copy"></i> TEL
                    </button>
                    <button 
                      onClick={() => handleDesmarcarNoChecklist(task.apt)}
                      className="text-[9px] font-black uppercase bg-red-50 text-red-500 px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-100 border border-red-100"
                    >
                      Desmarcar
                    </button>
                    <button 
                      onClick={() => { copyToClipboard('Olá...'); window.open(`https://wa.me/${task.contact.replace(/\D/g,'')}`, '_blank'); }} 
                      className="text-[9px] font-black uppercase bg-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50"
                    >
                      WhatsApp
                    </button>
                  </div>
               </div>
             ))}
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Manuais / Agendados</h4>
            {filteredManualTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <label className="flex items-center gap-4 cursor-pointer flex-1">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded text-indigo-600" 
                    checked={completedManualTasks.includes(t.id)}
                    onChange={() => {
                        setCompletedManualTasks(prev => 
                            prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                        );
                    }}
                  />
                  <div>
                    <span className={`text-xs font-bold ${completedManualTasks.includes(t.id) ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{t.task}</span>
                    <span className="text-[7px] font-black uppercase text-indigo-400 block">{t.frequency === 'daily' ? 'Diário' : t.frequency === 'weekly' ? 'Semanal' : t.frequency === 'monthly' ? 'Mensal' : 'Data Específica'}</span>
                  </div>
                </label>
              </div>
            ))}
            {filteredManualTasks.length === 0 && (<p className="text-center text-slate-300 font-bold italic py-4">Nenhuma tarefa manual prevista para este dia.</p>)}
          </div>
        </div>
      )}

      {/* MODAL NOVO/EDITAR SCRIPT */}
      {showAddScript && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tighter">{editingTarget ? 'Editar Script' : 'Novo Script de Resposta'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Categoria</label>
                <select 
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-sm outline-none"
                  value={newScript.category}
                  onChange={e => setNewScript({...newScript, category: e.target.value as any})}
                >
                  {categories.filter(c => c !== 'Todos').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Título do Script (Gatilho)</label>
                <input 
                  type="text" 
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold outline-none shadow-inner"
                  placeholder="Ex: Confirmação de Retorno"
                  value={newScript.trigger}
                  onChange={e => setNewScript({...newScript, trigger: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Conteúdo da Mensagem</label>
                <textarea 
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none font-medium h-40 text-sm outline-none shadow-inner resize-none"
                  placeholder="Olá! Gostaríamos de avisar que..."
                  value={newScript.content}
                  onChange={e => setNewScript({...newScript, content: e.target.value})}
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => { setShowAddScript(false); setEditingTarget(null); setNewScript({ category: 'Administrativo', trigger: '', content: '' }); }} className="flex-1 py-4 text-slate-300 font-black uppercase text-[10px] hover:text-slate-400">Cancelar</button>
                <button 
                  onClick={handleSaveScript} 
                  disabled={!newScript.trigger || !newScript.content}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase disabled:opacity-50 hover:bg-indigo-700 transition-all"
                >{editingTarget ? 'Salvar Alterações' : 'Salvar Script'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scripts;