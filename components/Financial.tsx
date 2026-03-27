import React, { useState } from 'react';
import { DaySchedule, PaymentMethod, Appointment } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface FinancialProps {
  data: DaySchedule[];
}

const Financial: React.FC<FinancialProps> = ({ data }) => {
  const [selectedMonth, setSelectedMonth] = useState('10');
  const [methodFilter, setMethodFilter] = useState<string[]>(['all']);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const allAppointments = data.flatMap(d => d.appointments);
  
  // Adjusted for YYYY-MM-DD format
  const getWeekOfMonth = (dateStr: string) => {
    const parts = dateStr.split('-');
    const day = parts.length === 3 ? Number(parts[2]) : Number(dateStr.split('/')[0]); // Fallback for legacy format if any
    if (day <= 7) return 'Semana 1 (01-07)';
    if (day <= 14) return 'Semana 2 (08-14)';
    if (day <= 21) return 'Semana 3 (15-21)';
    return 'Semana 4 (22+)';
  };

  // Adjusted date splitting to support both ISO (YYYY-MM-DD) and legacy formats
  const filteredApts = allAppointments.filter(a => {
    let m = "";
    if (a.date.includes('-')) {
      m = a.date.split('-')[1];
    } else {
      m = a.date.split('/')[1];
    }
    const matchesDate = m === selectedMonth;
    // Check payment method, including splits
    let matchesMethod = false;
    if (methodFilter.includes('all')) {
        matchesMethod = true;
    } else {
        if (a.splitPayments && a.splitPayments.length > 0) {
            matchesMethod = a.splitPayments.some(sp => methodFilter.includes(sp.method));
        } else {
            matchesMethod = methodFilter.includes(a.paymentMethod as string);
        }
    }

    const matchesWeek = !selectedWeek || getWeekOfMonth(a.date) === selectedWeek;
    return a.status === 'atendido' && matchesDate && matchesMethod && matchesWeek;
  });

  const totalRevenue = filteredApts.reduce((acc, apt) => acc + (apt.paidValue || 0), 0);
  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

  // Garantindo que Cartão Débito está na lista
  const paymentMethods: PaymentMethod[] = ['PIX', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito', 'Convênio'];
  
  const totalsByMethod = paymentMethods.map(method => {
    let total = 0;
    let count = 0;

    filteredApts.forEach(a => {
        if (a.splitPayments && a.splitPayments.length > 0) {
            const splits = a.splitPayments.filter(sp => sp.method === method);
            if (splits.length > 0) {
                total += splits.reduce((acc, sp) => acc + sp.value, 0);
                count++;
            }
        } else if (a.paymentMethod === method) {
            total += (a.paidValue || 0);
            count++;
        }
    });

    return {
      method,
      total,
      count
    };
  }).filter(t => t.total > 0 || (methodFilter.includes(t.method as string) && !methodFilter.includes('all')));

  const weeks = ['Semana 1 (01-07)', 'Semana 2 (08-14)', 'Semana 3 (15-21)', 'Semana 4 (22+)'];
  const weeklySummary = weeks.map(week => {
    const weekApts = allAppointments.filter(a => {
      let m = "";
      if (a.date.includes('-')) {
        m = a.date.split('-')[1];
      } else {
        m = a.date.split('/')[1];
      }
      
      let matchesMethod = false;
      if (methodFilter.includes('all')) {
          matchesMethod = true;
      } else {
          if (a.splitPayments && a.splitPayments.length > 0) {
              matchesMethod = a.splitPayments.some(sp => methodFilter.includes(sp.method));
          } else {
              matchesMethod = methodFilter.includes(a.paymentMethod as string);
          }
      }

      return a.status === 'atendido' && 
      m === selectedMonth && 
      getWeekOfMonth(a.date) === week &&
      matchesMethod;
    });
    return {
      week,
      total: weekApts.reduce((acc, a) => acc + (a.paidValue || 0), 0),
      count: weekApts.length
    };
  });

  return (
    <div className="space-y-8 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Fluxo de Caixa</h2>
          <p className="text-slate-500 font-medium">Análise financeira detalhada por período</p>
        </div>
        
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          {selectedWeek && (
            <button 
              onClick={() => setSelectedWeek(null)}
              className="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"
            >
              <i className="fa-solid fa-xmark"></i> Limpar Semana
            </button>
          )}
          <select 
            value={selectedMonth} 
            onChange={e => { setSelectedMonth(e.target.value); setSelectedWeek(null); }}
            className="bg-slate-50 border-none rounded-xl text-xs font-black p-2 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="01">Janeiro</option>
            <option value="02">Fevereiro</option>
            <option value="03">Março</option>
            <option value="04">Abril</option>
            <option value="05">Maio</option>
            <option value="06">Junho</option>
            <option value="07">Julho</option>
            <option value="08">Agosto</option>
            <option value="09">Setembro</option>
            <option value="10">Outubro</option>
            <option value="11">Novembro</option>
            <option value="12">Dezembro</option>
          </select>
          <div className="flex bg-slate-50 p-1 rounded-xl gap-1">
             <button 
               onClick={() => setMethodFilter(['all'])}
               className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${methodFilter.includes('all') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}
             >
               Todos
             </button>
             {paymentMethods.map(m => {
               const isSel = methodFilter.includes(m as string);
               return (
                 <button 
                   key={m} 
                   onClick={() => {
                     let next;
                     if (methodFilter.includes('all')) {
                       next = [m as string];
                     } else if (isSel) {
                       next = methodFilter.filter(x => x !== m);
                       if (next.length === 0) next = ['all'];
                     } else {
                       next = [...methodFilter, m as string];
                       if (next.length === paymentMethods.length) next = ['all'];
                     }
                     setMethodFilter(next);
                   }}
                   className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${isSel && !methodFilter.includes('all') ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}
                 >
                   {m}
                 </button>
               );
             })}
          </div>
        </div>
      </header>

      {/* Destaque Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 blur-3xl rounded-full"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">
            {selectedWeek ? `Total ${selectedWeek}` : 'Total Consolidado'}
          </p>
          <p className="text-4xl font-black tracking-tighter">R$ {totalRevenue.toLocaleString('pt-BR')}</p>
          <div className="mt-4 flex items-center gap-2">
            <i className="fa-solid fa-users text-indigo-400 text-xs"></i>
            <span className="text-[10px] font-black text-slate-300 uppercase">{filteredApts.length} Atendimentos</span>
          </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-5 gap-4">
          {paymentMethods.map((method, idx) => {
            const methodData = totalsByMethod.find(t => t.method === method) || { total: 0, count: 0 };
            const isFilterActive = methodFilter.includes('all') || methodFilter.includes(method as string);
            return (
              <div key={method} className={`bg-white p-5 rounded-[32px] border transition-all ${isFilterActive ? 'border-indigo-600 ring-2 ring-indigo-50 shadow-md' : 'border-slate-200 opacity-50'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{method}</p>
                <p className="text-lg font-black text-slate-800">R$ {methodData.total.toLocaleString('pt-BR')}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">{methodData.count} Transações</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Resumo Semanal Interativo */}
        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-8 flex flex-col">
          <h3 className="font-black text-slate-800 uppercase tracking-tighter text-sm mb-8 flex items-center gap-2">
            <i className="fa-solid fa-calendar-week text-indigo-600"></i>
            Desempenho por Semana
          </h3>
          <div className="space-y-4 flex-1">
            {weeklySummary.map((item, idx) => (
              <button 
                key={item.week} 
                onClick={() => setSelectedWeek(selectedWeek === item.week ? null : item.week)}
                className={`w-full text-left p-4 rounded-3xl border-2 transition-all group ${
                  selectedWeek === item.week 
                  ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                  : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className={`text-xs font-black ${selectedWeek === item.week ? 'text-indigo-700' : 'text-slate-800'}`}>{item.week}</p>
                    <p className="text-[10px] font-bold text-slate-400">{item.count} atendimentos</p>
                  </div>
                  <p className="text-sm font-black text-indigo-600">R$ {item.total.toLocaleString('pt-BR')}</p>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-500" 
                    style={{ width: `${(item.total / (totalRevenue || 1)) * 100}%` }}
                  ></div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-6 text-center italic">Clique em uma semana para ver os detalhes na tabela ao lado</p>
        </div>

        {/* Tabela de Pacientes do Mês/Semana */}
        <div className="lg:col-span-2 bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <h3 className="font-black text-slate-800 uppercase tracking-tighter text-sm flex items-center gap-2">
              <i className="fa-solid fa-list-check text-indigo-600"></i>
              {selectedWeek ? `Pacientes da ${selectedWeek}` : 'Detalhamento Mensal'}
            </h3>
            {selectedWeek && (
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">Filtrado por Semana</span>
            )}
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Data</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Paciente</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">Pagamento</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Valor Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredApts.length > 0 ? filteredApts.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{apt.date.split('-').reverse().join('/')}</td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-slate-800 uppercase leading-none mb-1">{apt.patientName}</p>
                      <div className="flex gap-1">
                        <span className="text-[8px] font-black text-indigo-500 uppercase">{apt.type}</span>
                        <span className="text-[8px] font-bold text-slate-300">•</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase">{apt.priceTable}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {(apt.splitPayments && apt.splitPayments.length > 0) ? (
                            apt.splitPayments.map((sp, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full ${sp.method === 'PIX' ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
                                    <span className="text-[9px] font-black text-slate-600 uppercase">
                                        {sp.method}: {sp.value}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${apt.paymentMethod === 'PIX' ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
                                <span className="text-[9px] font-black text-slate-600 uppercase">
                                {apt.paymentMethod}
                                </span>
                            </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-800 text-xs">
                      R$ {apt.paidValue?.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="p-20 text-center opacity-30">
                      <i className="fa-solid fa-folder-open text-4xl mb-4"></i>
                      <p className="font-bold italic">Nenhum dado encontrado para os filtros.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gráficos de Visualização */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
          <h3 className="font-black text-slate-800 mb-8 uppercase tracking-tighter flex items-center gap-3">
            <i className="fa-solid fa-chart-bar text-indigo-600"></i>
            Volume Diário de Receita
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.map(d => ({ 
                date: d.date, 
                total: d.appointments.filter(a => {
                   let m = "";
                   if (a.date.includes('-')) {
                     m = a.date.split('-')[1];
                   } else {
                     m = a.date.split('/')[1];
                   }
                   
                   let matchesMethod = false;
                   if (methodFilter.includes('all')) {
                        matchesMethod = true;
                   } else {
                        if (a.splitPayments && a.splitPayments.length > 0) {
                            matchesMethod = a.splitPayments.some(sp => methodFilter.includes(sp.method));
                        } else {
                            matchesMethod = methodFilter.includes(a.paymentMethod as string);
                        }
                   }

                   return a.status === 'atendido' && (selectedMonth === m) && matchesMethod;
                }).reduce((acc, a) => acc + (a.paidValue || 0), 0) 
              }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="total" fill="#4f46e5" radius={[8, 8, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col items-center">
          <h3 className="font-black text-slate-800 mb-8 uppercase tracking-tighter self-start">Mix de Pagamentos</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={totalsByMethod.map(t => ({ name: t.method, value: t.total }))} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value">
                  {totalsByMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {totalsByMethod.map((item, idx) => (
              <div key={item.method} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                <span className="text-[10px] font-black text-slate-500 uppercase">{item.method}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Financial;