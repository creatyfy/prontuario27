import React, { useState, useMemo } from 'react';
import { DaySchedule, Appointment, ClinicConfig, PatientMetadata } from '../types';

interface CRMProps {
  agendaData: Record<string, DaySchedule>;
  config: ClinicConfig;
  patientMetadata: PatientMetadata;
}

interface CRMPatientData {
  id: string;
  name: string;
  dateAdded: string;
  phone?: string;
  priceTable?: string;
  followUps: any[];
  isCurrent: boolean;
  hasOverdue: boolean;
}

const CRM: React.FC<CRMProps> = ({ agendaData, config, patientMetadata }) => {
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'retornos' | 'followup' | 'aniversario'>('retornos');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toLocaleDateString('pt-BR', { month: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleDateString('pt-BR', { month: 'long' }).slice(1));
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedAnivMonth, setSelectedAnivMonth] = useState<number>(new Date().getMonth());
  const [viewingNote, setViewingNote] = useState<string | null>(null);
  
  const [followupFilter, setFollowupFilter] = useState<'all' | 'current' | 'overdue'>('all');

  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const arr = [];
    for (let i = current - 5; i <= current + 40; i++) arr.push(i.toString());
    return arr;
  }, []);

  const calculateTargetDate = (startDate: Date, amount: number, unit: 'days' | 'weeks' | 'months') => {
    const d = new Date(startDate);
    d.setHours(12, 0, 0, 0);
    if (unit === 'days') d.setDate(d.getDate() + amount);
    if (unit === 'weeks') d.setDate(d.getDate() + (amount * 7));
    if (unit === 'months') d.setMonth(d.getMonth() + amount);
    return d;
  };

  const authorizedPatientNames = useMemo(() => {
    if (!agendaData) return new Set<string>();
    const allAppointments = (Object.values(agendaData) as DaySchedule[]).filter(day => day && day.appointments).flatMap(day => day.appointments);
    const names = new Set<string>();
    
    const patientHistory: Record<string, Appointment[]> = {};
    allAppointments.forEach(apt => {
        if (!apt || !apt.patientName) return;
        if (!patientHistory[apt.patientName]) patientHistory[apt.patientName] = [];
        patientHistory[apt.patientName].push(apt);
    });

    Object.entries(patientHistory).forEach(([patientName, history]) => {
        const meta = patientMetadata[patientName];
        if (meta && meta.followUpEnabled === false) return;

        const authorized = history.some(a => {
            if (a.status !== 'atendido') return false;
            if (meta && meta.followUpEnabled === true) return true;
            const typeConfig = config.consultationTypes?.find(t => t.name === a.priceTable);
            if (typeConfig) return typeConfig.requiresFollowUp;
            return true;
        });
        if (authorized) names.add(patientName);
    });
    return names;
  }, [agendaData, config.consultationTypes]);

  const groupedFollowUpList = useMemo(() => {
    if (!agendaData) return {};
    const allAppointments = (Object.values(agendaData) as DaySchedule[]).filter(day => day && day.appointments).flatMap(day => day.appointments);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); 
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);

    const patientHistory: Record<string, Appointment[]> = {};
    allAppointments.forEach(apt => {
        if (!apt || !apt.patientName) return;
        if (!patientHistory[apt.patientName]) patientHistory[apt.patientName] = [];
        patientHistory[apt.patientName].push(apt);
    });

    const groups: { [key: string]: CRMPatientData[] } = {};

    Object.entries(patientHistory).forEach(([patientName, history]) => {
        const pMeta = patientMetadata[patientName] || { tags: [] };
        if (pMeta.followUpEnabled === false) return;

        const authorizedApts = history.filter(a => {
            if (a.status !== 'atendido') return false;
            if (pMeta.followUpEnabled === true) return true;
            const typeConfig = config.consultationTypes?.find(t => t.name === a.priceTable);
            if (typeConfig) return typeConfig.requiresFollowUp;
            return true;
        });

        if (authorizedApts.length === 0) return;

        authorizedApts.sort((a, b) => new Date(b.date + 'T00:00:00').getTime() - new Date(a.date + 'T00:00:00').getTime());
        const latestApt = authorizedApts[0];
        const addedDate = new Date(latestApt.date + 'T00:00:00');
        
        let activeRules: any[] = [];
        let protocolName = '';

        const activeTag = (config.tags || []).find(t => pMeta.tags && pMeta.tags.includes(t.id) && t.followUpRules && t.followUpRules.length > 0);
        
        if (activeTag) {
            activeRules = activeTag.followUpRules!;
            protocolName = `Protocolo: ${activeTag.name}`;
        } else {
            const typeConfig = config.consultationTypes?.find(t => t.name === latestApt.priceTable);
            if (typeConfig && typeConfig.followUpRules && typeConfig.followUpRules.length > 0) {
                activeRules = typeConfig.followUpRules;
            } else {
                activeRules = config.defaultFollowUpRules && config.defaultFollowUpRules.length > 0
                    ? config.defaultFollowUpRules 
                    : [{ amount: 1, unit: 'months' }, { amount: 3, unit: 'months' }, { amount: 6, unit: 'months' }];
            }
            protocolName = 'Pacientes Sem Etiqueta (Geral)';
        }

        const followUps = activeRules.map(rule => {
            const targetDate = calculateTargetDate(addedDate, rule.amount, rule.unit as any);
            const isThisWeek = targetDate >= startOfWeek && targetDate <= endOfWeek;
            const isOverdue = targetDate < now && !isThisWeek;

            let labelUnit = '';
            if (rule.unit === 'days') labelUnit = rule.amount === 1 ? 'Dia' : 'Dias';
            else if (rule.unit === 'weeks') labelUnit = rule.amount === 1 ? 'Semana' : 'Semanas';
            else labelUnit = rule.amount === 1 ? 'Mês' : 'Meses';

            return {
                label: `${rule.amount} ${labelUnit}`,
                dateStr: targetDate.toLocaleDateString('pt-BR'),
                dateObj: targetDate,
                isCurrent: isThisWeek,
                isOverdue: isOverdue
            };
        });

        const isCurrent = followUps.some(f => f.isCurrent);
        const hasOverdue = followUps.some(f => f.isOverdue);

        if (filter && !patientName.toLowerCase().includes(filter.toLowerCase())) return;
        
        if (activeTab === 'followup') {
            if (followupFilter === 'current' && !isCurrent) return;
            if (followupFilter === 'overdue' && !hasOverdue) return;
        }

        const patientData: CRMPatientData = {
          id: latestApt.id,
          name: latestApt.patientName,
          dateAdded: latestApt.date,
          phone: latestApt.phone,
          priceTable: latestApt.priceTable,
          followUps,
          isCurrent,
          hasOverdue
        };

        if (!groups[protocolName]) groups[protocolName] = [];
        groups[protocolName].push(patientData);
    });

    return groups;
  }, [agendaData, filter, activeTab, followupFilter, config.consultationTypes, config.tags, config.defaultFollowUpRules, patientMetadata]);

  const returnListSimple = useMemo(() => {
     if (activeTab !== 'retornos' || !agendaData) return [];
     return (Object.values(agendaData) as DaySchedule[]).filter(day => day && day.appointments).flatMap(day => day.appointments)
        .filter(a => a.status === 'atendido' && a.returnMonth === selectedMonth && a.returnYear === selectedYear && (filter === '' || a.patientName.toLowerCase().includes(filter.toLowerCase())))
        .map(a => ({
            id: a.id,
            name: a.patientName,
            phone: a.phone,
            returnMonth: a.returnMonth,
            returnYear: a.returnYear,
            notes: a.notes
        }));
  }, [agendaData, selectedMonth, selectedYear, filter, activeTab]);

  const birthdayLists = useMemo(() => {
    if (activeTab !== 'aniversario' || !patientMetadata) return { month: [], week: [], today: [] };
    
    const now = new Date();
    const todayDay = now.getDate();
    const todayMonth = now.getMonth();
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);

    const monthList: any[] = [];
    const weekList: any[] = [];
    const todayList: any[] = [];

    Object.entries(patientMetadata).forEach(([name, metaData]) => {
      const meta = metaData as any;
      if (!meta || !meta.birthDate || !authorizedPatientNames.has(name)) return;
      
      const parts = meta.birthDate.split('-');
      if (parts.length < 3) return;

      const [year, month, day] = parts.map(Number);
      const bMonth = month - 1;
      const bDay = day;

      if (isNaN(bMonth) || isNaN(bDay)) return;

      const patientAniv = {
        name,
        phone: meta.phone || '',
        tags: meta.tags || [],
        day: bDay,
        month: bMonth,
        birthDate: meta.birthDate
      };

      if (bMonth === selectedAnivMonth) {
        monthList.push(patientAniv);
      }

      if (bMonth === todayMonth && bDay === todayDay) {
        todayList.push(patientAniv);
      }

      const yearsToCheck = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
      let inWeek = false;
      for(const y of yearsToCheck) {
          const aniv = new Date(y, bMonth, bDay);
          if (aniv >= startOfWeek && aniv <= endOfWeek) {
              inWeek = true;
              break;
          }
      }
      if (inWeek) {
        weekList.push(patientAniv);
      }
    });

    const sortFn = (a: any, b: any) => a.day - b.day;
    return {
      month: monthList.sort(sortFn),
      week: weekList.sort(sortFn),
      today: todayList.sort(sortFn)
    };
  }, [activeTab, patientMetadata, authorizedPatientNames, selectedAnivMonth]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copiado!');
  };

  const renderBirthdayCard = (p: any) => (
    <div key={p.name} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-black text-slate-800 text-xs uppercase leading-none">{p.name}</p>
          <p className="text-[9px] font-bold text-indigo-500 mt-1 uppercase">Dia {p.day}</p>
        </div>
        <button onClick={() => copyToClipboard(p.phone)} className="text-slate-300 hover:text-indigo-600 transition-colors p-1" title="Copiar Telefone">
          <i className="fa-solid fa-copy text-[10px]"></i>
        </button>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {p.tags && p.tags.map((tagId: string) => {
          const tag = config.tags?.find(t => t.id === tagId);
          if (!tag) return null;
          return <div key={tagId} className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} title={tag.name}></div>;
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <button 
          onClick={() => window.open(`https://wa.me/${(p.phone || '').replace(/\D/g,'')}`, '_blank')}
          className="flex-1 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all"
        >WhatsApp</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Fidelização Pro</h2>
          <p className="text-slate-500 font-medium tracking-tight">Gestão inteligente de recorrência e acompanhamento</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('retornos')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'retornos' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Previsões</button>
          <button onClick={() => setActiveTab('followup')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'followup' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Follow-up (Secretaria)</button>
          <button onClick={() => setActiveTab('aniversario')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'aniversario' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Aniversário</button>
        </div>
      </header>

      {activeTab === 'retornos' ? (
        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row gap-4 bg-slate-50/30">
            <input 
              type="text" placeholder="Nome do paciente..." 
              className="flex-1 p-4 rounded-2xl bg-white border-none shadow-inner font-bold placeholder:text-slate-300"
              value={filter} onChange={e => setFilter(e.target.value)}
            />
            <div className="flex gap-2">
              <select 
                value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="p-4 rounded-2xl bg-white border-none shadow-inner font-bold text-sm cursor-pointer"
              >
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select 
                value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                className="p-4 rounded-2xl bg-white border-none shadow-inner font-bold text-sm cursor-pointer"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Paciente (Pós-Checkout)</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Previsão</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returnListSimple.length > 0 ? returnListSimple.map(patient => (
                  <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6">
                      <p className="font-black text-slate-800 text-base uppercase leading-none">{patient.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{patient.phone || 'Sem Telefone'}</p>
                        <button onClick={() => copyToClipboard(patient.phone || '')} className="text-slate-300 hover:text-indigo-600 text-[10px]"><i className="fa-solid fa-copy"></i></button>
                        {patient.notes && (
                          <button 
                            onClick={() => setViewingNote(patient.notes || null)} 
                            className="text-amber-500 hover:text-amber-600 text-[10px]"
                            title="Ver Observações do Checkout"
                          >
                            <i className="fa-solid fa-circle-info"></i>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm">
                        {patient.returnMonth || 'Não Def.'} {patient.returnYear}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        className="bg-emerald-50 text-emerald-600 px-5 py-2.5 rounded-xl font-black text-[10px] hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100 uppercase"
                        onClick={() => window.open(`https://wa.me/${(patient.phone || '').replace(/\D/g,'')}`, '_blank')}
                      >WhatsApp</button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="p-20 text-center text-slate-300 italic">Nenhum retorno previsto para esta data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'aniversario' ? (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="bg-white p-6 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Calendário de Felicitações</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Pacientes ativos autorizados para contato.</p>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                 <span className="text-[10px] font-black text-slate-400 uppercase pl-2">Mês do Aniversário:</span>
                 <select 
                   value={selectedAnivMonth} 
                   onChange={e => setSelectedAnivMonth(Number(e.target.value))}
                   className="p-2 px-4 rounded-xl bg-white border-none shadow-sm font-black text-xs uppercase cursor-pointer outline-none"
                 >
                   {months.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
                 </select>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50/50 rounded-[40px] border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                 <div className="p-6 bg-white border-b border-slate-100 flex items-center gap-3">
                    <div className="w-2 h-8 bg-indigo-500 rounded-full"></div>
                    <h4 className="font-black text-slate-700 uppercase tracking-tighter text-sm">No Mês ({months[selectedAnivMonth]})</h4>
                    <span className="ml-auto bg-slate-100 text-slate-400 px-2 py-1 rounded-lg text-[8px] font-bold">{birthdayLists.month.length}</span>
                 </div>
                 <div className="p-4 space-y-3 overflow-y-auto max-h-[600px] flex-1">
                    {birthdayLists.month.map(renderBirthdayCard)}
                    {birthdayLists.month.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-[10px] py-20 uppercase">Nenhum aniversariante.</div>}
                 </div>
              </div>

              <div className="bg-slate-50/50 rounded-[40px] border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                 <div className="p-6 bg-white border-b border-slate-100 flex items-center gap-3">
                    <div className="w-2 h-8 bg-amber-500 rounded-full"></div>
                    <h4 className="font-black text-slate-700 uppercase tracking-tighter text-sm">Nesta Semana</h4>
                    <span className="ml-auto bg-amber-50 text-amber-600 px-2 py-1 rounded-lg text-[8px] font-bold">{birthdayLists.week.length}</span>
                 </div>
                 <div className="p-4 space-y-3 overflow-y-auto max-h-[600px] flex-1">
                    {birthdayLists.week.map(renderBirthdayCard)}
                    {birthdayLists.week.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-[10px] py-20 uppercase">Nenhum aniversariante.</div>}
                 </div>
              </div>

              <div className="bg-slate-50/50 rounded-[40px] border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                 <div className="p-6 bg-white border-b border-slate-100 flex items-center gap-3">
                    <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                    <h4 className="font-black text-slate-700 uppercase tracking-tighter text-sm">Hoje</h4>
                    <span className="ml-auto bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-[8px] font-bold">{birthdayLists.today.length}</span>
                 </div>
                 <div className="p-4 space-y-3 overflow-y-auto max-h-[600px] flex-1">
                    {birthdayLists.today.map(renderBirthdayCard)}
                    {birthdayLists.today.length === 0 && <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-[10px] py-20 uppercase">Nenhum aniversariante.</div>}
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-fit">
            <button 
              onClick={() => setFollowupFilter('all')}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${followupFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 hover:text-slate-600'}`}
            >Todos</button>
            <button 
              onClick={() => setFollowupFilter('current')}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${followupFilter === 'current' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:text-slate-600'}`}
            >Semana em Curso</button>
            <button 
              onClick={() => setFollowupFilter('overdue')}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${followupFilter === 'overdue' ? 'bg-red-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:text-slate-600'}`}
            >Atrasados</button>
          </div>
          
          {Object.keys(groupedFollowUpList).length > 0 ? Object.entries(groupedFollowUpList).map(([protocol, patients]: [string, any[]]) => {
             const maxCols = patients.reduce((max: number, p: any) => Math.max(max, p.followUps.length), 0);
             
             return (
                 <div key={protocol} className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2">
                    <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                       <div className="w-2 h-8 bg-indigo-500 rounded-full"></div>
                       <h3 className="font-black text-slate-700 uppercase tracking-tighter text-sm">{protocol}</h3>
                       <span className="bg-white text-slate-400 px-2 py-1 rounded-lg text-[8px] font-bold border border-slate-100">{patients.length} Pacientes</span>
                    </div>
                    <div className="overflow-x-auto p-4">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-4 px-4 text-[10px] font-black text-slate-400 uppercase">Paciente</th>
                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase">Data da Última Consulta</th>
                            {Array.from({ length: maxCols }).map((_, i) => (
                                <th key={i} className="pb-4 text-[10px] font-black text-slate-400 uppercase text-center w-32">
                                    {i + 1}º Contato
                                </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {patients.map((p: any) => (
                            <tr key={p.id} className={`hover:bg-slate-50 transition-all ${(p.isCurrent || p.hasOverdue) ? 'bg-indigo-50/20' : ''}`}>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-slate-700 text-xs uppercase">{p.name}</p>
                                  {p.isCurrent && <span className="text-[7px] font-black bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded uppercase">Urgente</span>}
                                  {p.hasOverdue && <span className="text-[7px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase ml-1">Atrasado</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">{p.phone || 'Sem Telefone'}</p>
                                  <button onClick={() => copyToClipboard(p.phone || '')} className="text-slate-300 hover:text-indigo-600 text-[10px]"><i className="fa-solid fa-copy"></i></button>
                                </div>
                              </td>
                              <td className="py-4">
                                <p className="text-[10px] font-black text-slate-400 uppercase">
                                  {new Date(p.dateAdded + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </p>
                              </td>
                              {Array.from({ length: maxCols }).map((_, idx) => {
                                 const followUp = p.followUps[idx];
                                 return (
                                   <td key={idx} className="py-4 text-center">
                                     {followUp ? (
                                       <>
                                         <p className="text-[8px] font-black text-indigo-400 uppercase tracking-tight mb-0.5">{followUp.label}</p>
                                         <p className={`text-[9px] font-black mb-1 ${followUp.isOverdue ? 'text-red-500' : followUp.isCurrent ? 'text-indigo-700' : 'text-slate-600'}`}>
                                           {followUp.dateStr}
                                         </p>
                                         <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500" />
                                       </>
                                     ) : (
                                       <span className="text-slate-200 text-[8px]">-</span>
                                     )}
                                   </td>
                                 );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                 </div>
             );
          }) : (
             <div className="p-20 text-center opacity-30 bg-white rounded-[40px] border border-slate-200 border-dashed">
                <i className="fa-solid fa-user-clock text-4xl mb-4"></i>
                <p className="font-bold uppercase text-sm">Nenhum paciente para acompanhamento com os filtros atuais.</p>
             </div>
          )}
        </div>
      )}

      {/* Modal de Observação */}
      {viewingNote !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                    <i className="fa-solid fa-comment-medical text-indigo-600"></i> Observações do Checkout
                 </h3>
                 <button onClick={() => setViewingNote(null)} className="text-slate-300 hover:text-slate-500"><i className="fa-solid fa-times text-xl"></i></button>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-xs font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                 {viewingNote || 'Nenhuma observação registrada.'}
              </div>
              <button onClick={() => setViewingNote(null)} className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase">Fechar</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default CRM;