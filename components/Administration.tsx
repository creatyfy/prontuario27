import React, { useState, useMemo, useEffect } from 'react';
import { DaySchedule, Appointment, PaymentMethod, ClinicConfig } from '../types';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface AdministrationProps {
  agendaData: DaySchedule[];
  config: ClinicConfig;
}

const Administration: React.FC<AdministrationProps> = ({ agendaData, config }) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'custom'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Initialize with current month range
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  // Atualiza datas quando muda o mês/ano no modo mensal
  useEffect(() => {
    if (viewMode === 'monthly') {
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0);
      const startStr = start.toLocaleDateString('sv-SE'); // YYYY-MM-DD
      const endStr = end.toLocaleDateString('sv-SE');
      setStartDate(startStr);
      setEndDate(endStr);
    }
  }, [viewMode, selectedMonth, selectedYear]);

  const [typeFilter, setTypeFilter] = useState<'all' | 'paid' | 'return'>('all');
  const [methodFilter, setMethodFilter] = useState<string[]>(['all']);

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    patient: true,
    cpf: true,
    mode: true,
    location: true,
    method: true,
    value: true
  });

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

  const financialData = useMemo(() => {
    // Primeiro filtro de agendamentos no período
    const appointmentsInPeriod = agendaData.flatMap(day => 
      day.appointments.filter(a => a.status === 'atendido' && a.date >= startDate && a.date <= endDate)
    );

    // Expande pagamentos divididos em linhas separadas
    const allTransactions = appointmentsInPeriod.flatMap(a => {
        if (a.splitPayments && a.splitPayments.length > 0) {
            return a.splitPayments.map((sp, index) => ({
                id: `${a.id}_split_${index}`,
                originalId: a.id,
                date: a.date,
                time: a.time,
                patient: a.patientName,
                value: sp.value,
                method: sp.method,
                type: a.type,
                priceTable: a.priceTable,
                mode: a.mode,
                locationId: a.locationId,
                cpf: a.cpf,
                isSplit: true,
                splitIndex: index + 1,
                splitTotal: a.splitPayments!.length
            }));
        }
        return [{
            id: a.id,
            originalId: a.id,
            date: a.date,
            time: a.time,
            patient: a.patientName,
            value: a.paidValue || 0,
            method: a.paymentMethod || (a.type === 'retorno' ? 'Retorno' : 'Pendente'),
            type: a.type,
            priceTable: a.priceTable,
            mode: a.mode,
            locationId: a.locationId,
            cpf: a.cpf,
            isSplit: false,
            splitIndex: 0,
            splitTotal: 0
        }];
    }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    // Contagens baseadas em agendamentos únicos (originalId)
    const uniqueIds = new Set(appointmentsInPeriod.map(a => a.id));
    const payingIds = new Set(appointmentsInPeriod.filter(a => (a.paidValue || 0) > 0).map(a => a.id));
    const returnIds = new Set(appointmentsInPeriod.filter(a => a.type === 'retorno').map(a => a.id));

    const filteredIncomes = allTransactions.filter(i => {
      const matchType = typeFilter === 'all' ? true : typeFilter === 'paid' ? i.value > 0 : i.type === 'retorno';
      const matchMethod = methodFilter.includes('all') ? true : methodFilter.includes(i.method as string);
      return matchType && matchMethod;
    });

    const incomeTotal = allTransactions.reduce((acc, curr) => acc + curr.value, 0);
    
    // Análise de Métodos Simplificada (já que as transações estão expandidas)
    const methodAnalysis = ['PIX', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito'].map(method => {
      const items = allTransactions.filter(i => i.method === method);
      return {
        name: method,
        value: items.reduce((acc, i) => acc + i.value, 0),
        count: items.length
      };
    }).filter(m => m.count > 0 || m.value > 0);

    return { 
      filteredIncomes, 
      allTransactions, 
      uniqueCount: uniqueIds.size, 
      payingCount: payingIds.size, 
      returnCount: returnIds.size, 
      incomeTotal, 
      methodAnalysis 
    };
  }, [agendaData, startDate, endDate, typeFilter, methodFilter]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

  const getLocationName = (id?: string) => {
    if (!id) return '-';
    return config.locations.find(l => l.id === id)?.name || 'Local Desconhecido';
  };

  const handleExportCSV = () => {
    const data = financialData.filteredIncomes;
    if (data.length === 0) {
      alert("Nenhum dado para exportar com os filtros atuais.");
      return;
    }
    const headers = ["Data", "Hora", "Paciente", "CPF", "Procedimento", "Tabela", "Modalidade", "Local", "Forma Pagto", "Valor", "Observação"];
    const rows = data.map(i => {
      const obs = i.isSplit ? `Pagamento parcial ${i.splitIndex}/${i.splitTotal}` : "";
      return [
        i.date.split('-').reverse().join('/'),
        i.time,
        i.patient,
        i.cpf || "",
        i.type,
        i.priceTable,
        i.mode,
        getLocationName(i.locationId),
        i.method,
        i.value.toFixed(2).replace('.', ','),
        obs
      ];
    });
    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `caixa_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Gestão de Caixa</h2>
          <p className="text-slate-500 font-medium">Controle de volume e faturamento por período</p>
        </div>
        
        <div className="flex flex-col items-end gap-2">
           <div className="flex gap-2">
              <button 
                onClick={handleExportCSV}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-file-csv"></i> Baixar Planilha
              </button>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setViewMode('monthly')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Mensal
                  </button>
                  <button 
                    onClick={() => setViewMode('custom')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Personalizado
                  </button>
              </div>
           </div>

           {viewMode === 'monthly' ? (
             <div className="flex gap-2">
                <select 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-xl text-xs font-black p-2 outline-none uppercase cursor-pointer"
                >
                  {months.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                </select>
                <select 
                  value={selectedYear} 
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-xl text-xs font-black p-2 outline-none uppercase cursor-pointer"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
             </div>
           ) : (
             <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                <span className="text-[10px] font-black uppercase text-slate-400 pl-2">De</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="bg-slate-50 border-none rounded-xl text-xs font-black p-2 outline-none uppercase cursor-pointer"
                />
                <span className="text-[10px] font-black uppercase text-slate-400">Até</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="bg-slate-50 border-none rounded-xl text-xs font-black p-2 outline-none uppercase cursor-pointer"
                />
             </div>
           )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Faturamento Bruto</p>
          <p className="text-3xl font-black text-emerald-600">R$ {financialData.incomeTotal.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-indigo-600 p-8 rounded-[40px] text-white shadow-xl">
           <p className="text-[10px] font-black uppercase text-indigo-100 mb-1 tracking-widest">Total Atendimentos</p>
           <p className="text-3xl font-black">{financialData.uniqueCount}</p>
        </div>
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
           <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Total Pagantes</p>
           <p className="text-3xl font-black text-indigo-600">{financialData.payingCount}</p>
        </div>
        <div className="bg-amber-50 p-8 rounded-[40px] border border-amber-100 shadow-sm">
           <p className="text-[10px] font-black uppercase text-amber-600 mb-1 tracking-widest">Total Retornos</p>
           <p className="text-3xl font-black text-amber-700">{financialData.returnCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col items-center">
          <h3 className="font-black text-slate-800 mb-6 uppercase text-xs self-start tracking-widest">Faturamento por Método</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData.methodAnalysis}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                  {financialData.methodAnalysis.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col items-center">
          <h3 className="font-black text-slate-800 mb-6 uppercase text-xs self-start tracking-widest">Mix de Recebimentos</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={financialData.methodAnalysis} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value">
                  {financialData.methodAnalysis.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none'}} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between gap-4">
             <div className="flex flex-wrap gap-3">
               <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 gap-1">
                 <button onClick={() => setTypeFilter('all')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${typeFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Todos</button>
                 <button onClick={() => setTypeFilter('paid')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${typeFilter === 'paid' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Pagantes</button>
                 <button onClick={() => setTypeFilter('return')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${typeFilter === 'return' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Retornos</button>
               </div>
               
               <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 gap-1 flex-wrap">
                 <button 
                   onClick={() => setMethodFilter(['all'])} 
                   className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${methodFilter.includes('all') ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                 >
                   Todos Métodos
                 </button>
                 {['PIX', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito'].map(m => {
                   const isSelected = methodFilter.includes(m);
                   return (
                     <button 
                       key={m} 
                       onClick={() => {
                         let next;
                         if (methodFilter.includes('all')) {
                           next = [m];
                         } else if (isSelected) {
                           next = methodFilter.filter(x => x !== m);
                           if (next.length === 0) next = ['all'];
                         } else {
                           next = [...methodFilter, m];
                           if (next.length === 4) next = ['all'];
                         }
                         setMethodFilter(next);
                       }} 
                       className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${isSelected && !methodFilter.includes('all') ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                     >
                       {m}
                     </button>
                   );
                 })}
               </div>
             </div>
          </div>

          {/* Column Visibility Toggles */}
          <div className="px-8 py-3 bg-white border-b border-slate-50 flex items-center gap-4 overflow-x-auto">
             <span className="text-[9px] font-black uppercase text-slate-300 whitespace-nowrap">Exibir Colunas:</span>
             <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
               <input type="checkbox" checked={visibleColumns.date} onChange={() => toggleColumn('date')} className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3 border-slate-300" />
               <span className="text-[9px] font-bold text-slate-500 uppercase">Data/Hora</span>
             </label>
             <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
               <input type="checkbox" checked={visibleColumns.patient} onChange={() => toggleColumn('patient')} className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3 border-slate-300" />
               <span className="text-[9px] font-bold text-slate-500 uppercase">Paciente</span>
             </label>
             <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
               <input type="checkbox" checked={visibleColumns.cpf} onChange={() => toggleColumn('cpf')} className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3 border-slate-300" />
               <span className="text-[9px] font-bold text-slate-500 uppercase">CPF</span>
             </label>
             <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
               <input type="checkbox" checked={visibleColumns.mode} onChange={() => toggleColumn('mode')} className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3 border-slate-300" />
               <span className="text-[9px] font-bold text-slate-500 uppercase">Modalidade</span>
             </label>
             <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
               <input type="checkbox" checked={visibleColumns.location} onChange={() => toggleColumn('location')} className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3 border-slate-300" />
               <span className="text-[9px] font-bold text-slate-500 uppercase">Local</span>
             </label>
             <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
               <input type="checkbox" checked={visibleColumns.method} onChange={() => toggleColumn('method')} className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3 border-slate-300" />
               <span className="text-[9px] font-bold text-slate-500 uppercase">Forma Pagto</span>
             </label>
             <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
               <input type="checkbox" checked={visibleColumns.value} onChange={() => toggleColumn('value')} className="rounded text-indigo-600 focus:ring-indigo-500 w-3 h-3 border-slate-300" />
               <span className="text-[9px] font-bold text-slate-500 uppercase">Valor</span>
             </label>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {visibleColumns.date && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Data/Hora</th>}
                  {visibleColumns.patient && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Paciente</th>}
                  {visibleColumns.cpf && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">CPF</th>}
                  {visibleColumns.mode && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Modalidade</th>}
                  {visibleColumns.location && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Local</th>}
                  {visibleColumns.method && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Forma</th>}
                  {visibleColumns.value && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-right">Valor</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {financialData.filteredIncomes.map((inc) => (
                  <tr key={inc.id} className={`hover:bg-slate-50 transition-colors ${inc.type === 'retorno' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                    {visibleColumns.date && (
                      <td className="px-8 py-4">
                        <p className="text-[10px] font-black text-slate-500">{inc.date.split('-').reverse().join('/')}</p>
                        <p className="text-[8px] font-bold text-slate-300 uppercase">{inc.time}</p>
                      </td>
                    )}
                    {visibleColumns.patient && (
                      <td className="px-8 py-4">
                        <p className="text-xs font-black text-slate-800 uppercase leading-none">{inc.patient}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{inc.priceTable} • {inc.type}</p>
                        {inc.isSplit && (
                            <p className="text-[8px] text-indigo-500 font-bold italic mt-0.5">
                                Pagamento {inc.splitIndex}/{inc.splitTotal} (Fracionado)
                            </p>
                        )}
                      </td>
                    )}
                    {visibleColumns.cpf && (
                      <td className="px-8 py-4">
                        <p className="text-[9px] text-slate-500 font-mono font-bold">{inc.cpf || '-'}</p>
                      </td>
                    )}
                    {visibleColumns.mode && (
                      <td className="px-8 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${inc.mode === 'Online' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-white text-slate-500 border-slate-200'}`}>
                          {inc.mode || 'Presencial'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.location && (
                      <td className="px-8 py-4">
                        <p className="text-[9px] font-bold text-slate-600 uppercase truncate max-w-[150px]" title={getLocationName(inc.locationId)}>
                          {getLocationName(inc.locationId)}
                        </p>
                      </td>
                    )}
                    {visibleColumns.method && (
                      <td className="px-8 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${inc.value > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                          {inc.method}
                        </span>
                      </td>
                    )}
                    {visibleColumns.value && (
                      <td className={`px-8 py-4 text-right font-black text-sm ${inc.value > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        R$ {inc.value.toLocaleString('pt-BR')}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
};

export default Administration;