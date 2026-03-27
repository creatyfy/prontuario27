
import React, { useState, useEffect } from 'react';
import { useConfirm } from '../ConfirmContext';
import { Budget, BudgetItem, BudgetOption } from '../types';
import { MOCK_BUDGETS } from '../constants';

const Budgets: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem('neuroclinic_budgets');
    return saved ? JSON.parse(saved) : MOCK_BUDGETS;
  });
  const confirm = useConfirm();

  const [isEditing, setIsEditing] = useState(false);
  
  // Estado do Formulário
  const [currentBudget, setCurrentBudget] = useState<Partial<Budget>>({
    procedureName: '',
    fees: [],
    medications: [],
    materials: [],
    options: [],
    notes: ''
  });

  // Estados temporários para inputs de adição
  const [tempFee, setTempFee] = useState({ name: '', value: '' });
  const [tempMed, setTempMed] = useState({ name: '', value: '' });
  const [tempMat, setTempMat] = useState({ name: '', value: '' });
  const [tempOpt, setTempOpt] = useState({ method: '', total: '', details: '' });

  useEffect(() => {
    localStorage.setItem('neuroclinic_budgets', JSON.stringify(budgets));
  }, [budgets]);

  // Cálculos
  const calculateBaseTotal = () => {
    const sumFees = (currentBudget.fees || []).reduce((acc, i) => acc + i.value, 0);
    const sumMeds = (currentBudget.medications || []).reduce((acc, i) => acc + i.value, 0);
    const sumMats = (currentBudget.materials || []).reduce((acc, i) => acc + i.value, 0);
    return sumFees + sumMeds + sumMats;
  };

  const baseTotal = calculateBaseTotal();

  // Helpers de Adição
  const addItem = (
    list: BudgetItem[], 
    setter: (l: BudgetItem[]) => void, 
    temp: { name: string, value: string }, 
    clearTemp: () => void
  ) => {
    if (temp.name && temp.value) {
      setter([...list, { id: Date.now().toString(), name: temp.name, value: Number(temp.value) }]);
      clearTemp();
    }
  };

  const removeItem = (list: BudgetItem[], setter: (l: BudgetItem[]) => void, id: string) => {
    setter(list.filter(i => i.id !== id));
  };

  const addOption = () => {
    if (tempOpt.method && tempOpt.total) {
      const newOptions = [...(currentBudget.options || []), { 
        id: Date.now().toString(), 
        method: tempOpt.method, 
        total: Number(tempOpt.total), 
        details: tempOpt.details 
      }];
      setCurrentBudget({ ...currentBudget, options: newOptions });
      setTempOpt({ method: '', total: '', details: '' });
    }
  };

  const saveBudget = () => {
    if (currentBudget.procedureName) {
      const newBudget: Budget = {
        id: currentBudget.id || `bg-${Date.now()}`,
        procedureName: currentBudget.procedureName,
        fees: currentBudget.fees || [],
        medications: currentBudget.medications || [],
        materials: currentBudget.materials || [],
        options: currentBudget.options || [],
        notes: currentBudget.notes || '',
        createdAt: new Date().toISOString().split('T')[0]
      };

      if (currentBudget.id) {
        setBudgets(budgets.map(b => b.id === newBudget.id ? newBudget : b));
      } else {
        setBudgets([...budgets, newBudget]);
      }
      setIsEditing(false);
      resetForm();
    } else {
      confirm({
        type: 'alert',
        title: 'Campo Obrigatório',
        message: 'Por favor, adicione pelo menos o nome do procedimento antes de salvar.'
      });
    }
  };

  const resetForm = () => {
    setCurrentBudget({ procedureName: '', fees: [], medications: [], materials: [], options: [], notes: '' });
    setTempFee({ name: '', value: '' });
    setTempMed({ name: '', value: '' });
    setTempMat({ name: '', value: '' });
    setTempOpt({ method: '', total: '', details: '' });
  };

  const deleteBudget = (id: string) => {
    confirm({
      title: 'Excluir Orçamento',
      message: 'Tem certeza que deseja apagar permanentemente este orçamento?',
      confirmLabel: 'Excluir',
      onConfirm: () => setBudgets(budgets.filter(b => b.id !== id))
    });
  };

  const copyBudget = (b: Budget) => {
    let text = `*ORÇAMENTO: ${b.procedureName.toUpperCase()}*\n\n`;
    
    if (b.fees.length > 0) {
      text += `*Taxas e Honorários:*\n`;
      b.fees.forEach(i => text += `- ${i.name}: R$ ${i.value.toFixed(2)}\n`);
    }
    if (b.medications.length > 0) {
      text += `\n*Medicamentos:*\n`;
      b.medications.forEach(i => text += `- ${i.name}: R$ ${i.value.toFixed(2)}\n`);
    }
    if (b.materials.length > 0) {
      text += `\n*Materiais:*\n`;
      b.materials.forEach(i => text += `- ${i.name}: R$ ${i.value.toFixed(2)}\n`);
    }

    text += `\n--------------------------------\n`;
    text += `*OPÇÕES DE PAGAMENTO:*\n`;
    b.options.forEach(o => {
      text += `\n🔹 *${o.method}*: R$ ${o.total.toFixed(2)}\n`;
      if (o.details) text += `   _${o.details}_\n`;
    });

    if (b.notes) {
      text += `\n*ORIENTAÇÕES:*\n${b.notes}`;
    }

    navigator.clipboard.writeText(text);
    confirm({
      type: 'alert',
      title: 'Copiado',
      message: 'Orçamento copiado para a área de transferência!'
    });
  };

  const printBudget = (b: Budget) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Orçamento - ${b.procedureName}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
              h1 { color: #4f46e5; border-bottom: 2px solid #eee; padding-bottom: 10px; }
              .section { margin-bottom: 20px; }
              .section-title { font-weight: bold; margin-bottom: 5px; text-transform: uppercase; font-size: 12px; color: #666; }
              .item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ccc; }
              .total-box { background: #f8fafc; padding: 15px; border-radius: 10px; margin-top: 20px; }
              .option { margin-bottom: 10px; }
              .option-title { font-weight: bold; font-size: 16px; }
              .notes { background: #fffbeb; padding: 15px; border-radius: 10px; margin-top: 20px; font-size: 14px; }
            </style>
          </head>
          <body>
            <h1>${b.procedureName}</h1>
            
            ${b.fees.length ? `
              <div class="section">
                <div class="section-title">Taxas e Honorários</div>
                ${b.fees.map(i => `<div class="item"><span>${i.name}</span><span>R$ ${i.value.toFixed(2)}</span></div>`).join('')}
              </div>
            ` : ''}

            ${b.medications.length ? `
              <div class="section">
                <div class="section-title">Medicamentos</div>
                ${b.medications.map(i => `<div class="item"><span>${i.name}</span><span>R$ ${i.value.toFixed(2)}</span></div>`).join('')}
              </div>
            ` : ''}

            ${b.materials.length ? `
              <div class="section">
                <div class="section-title">Materiais</div>
                ${b.materials.map(i => `<div class="item"><span>${i.name}</span><span>R$ ${i.value.toFixed(2)}</span></div>`).join('')}
              </div>
            ` : ''}

            <div class="total-box">
              <h3>Formas de Pagamento</h3>
              ${b.options.map(o => `
                <div class="option">
                  <div class="option-title">${o.method}: R$ ${o.total.toFixed(2)}</div>
                  <div>${o.details}</div>
                </div>
              `).join('')}
            </div>

            ${b.notes ? `
              <div class="notes">
                <strong>Orientações:</strong><br/>
                ${b.notes}
              </div>
            ` : ''}
            
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-8 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Orçamento de Procedimentos</h2>
          <p className="text-slate-500 font-medium">Crie e gerencie propostas financeiras detalhadas</p>
        </div>
        {!isEditing && (
          <button 
            type="button"
            onClick={() => { resetForm(); setIsEditing(true); }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-plus"></i> Novo Orçamento
          </button>
        )}
      </header>

      {isEditing ? (
        <div className="bg-white rounded-[40px] p-8 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
           <div className="flex justify-between items-center mb-6">
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Criar/Editar Orçamento</h3>
             <button type="button" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-xmark text-2xl"></i></button>
           </div>

           <div className="space-y-6">
              {/* Nome do Procedimento */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Nome do Procedimento</label>
                <input 
                  type="text" 
                  placeholder="Ex: Aplicação de Toxina Botulínica" 
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-lg"
                  value={currentBudget.procedureName}
                  onChange={e => setCurrentBudget({...currentBudget, procedureName: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna 1: Itens de Custo */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Taxas */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                    <h4 className="text-xs font-black text-indigo-600 uppercase mb-3">1. Taxas e Honorários</h4>
                    <div className="space-y-2 mb-3">
                      {currentBudget.fees?.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-xs font-bold text-slate-700">{item.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-900">R$ {item.value.toFixed(2)}</span>
                            <button type="button" onClick={() => removeItem(currentBudget.fees!, (l) => setCurrentBudget({...currentBudget, fees: l}), item.id)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input placeholder="Descrição (Ex: Sala)" className="flex-1 p-2 rounded-xl border-none text-xs" value={tempFee.name} onChange={e => setTempFee({...tempFee, name: e.target.value})} />
                      <input type="number" placeholder="Valor" className="w-24 p-2 rounded-xl border-none text-xs" value={tempFee.value} onChange={e => setTempFee({...tempFee, value: e.target.value})} />
                      <button type="button" onClick={() => addItem(currentBudget.fees!, (l) => setCurrentBudget({...currentBudget, fees: l}), tempFee, () => setTempFee({name:'', value:''}))} className="bg-indigo-600 text-white px-3 rounded-xl"><i className="fa-solid fa-plus"></i></button>
                    </div>
                  </div>

                  {/* Medicamentos */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                    <h4 className="text-xs font-black text-indigo-600 uppercase mb-3">2. Medicamentos</h4>
                    <div className="space-y-2 mb-3">
                      {currentBudget.medications?.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-xs font-bold text-slate-700">{item.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-900">R$ {item.value.toFixed(2)}</span>
                            <button type="button" onClick={() => removeItem(currentBudget.medications!, (l) => setCurrentBudget({...currentBudget, medications: l}), item.id)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input placeholder="Medicamento" className="flex-1 p-2 rounded-xl border-none text-xs" value={tempMed.name} onChange={e => setTempMed({...tempMed, name: e.target.value})} />
                      <input type="number" placeholder="Valor" className="w-24 p-2 rounded-xl border-none text-xs" value={tempMed.value} onChange={e => setTempMed({...tempMed, value: e.target.value})} />
                      <button type="button" onClick={() => addItem(currentBudget.medications!, (l) => setCurrentBudget({...currentBudget, medications: l}), tempMed, () => setTempMed({name:'', value:''}))} className="bg-indigo-600 text-white px-3 rounded-xl"><i className="fa-solid fa-plus"></i></button>
                    </div>
                  </div>

                  {/* Materiais */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                    <h4 className="text-xs font-black text-indigo-600 uppercase mb-3">3. Materiais</h4>
                    <div className="space-y-2 mb-3">
                      {currentBudget.materials?.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <span className="text-xs font-bold text-slate-700">{item.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-900">R$ {item.value.toFixed(2)}</span>
                            <button type="button" onClick={() => removeItem(currentBudget.materials!, (l) => setCurrentBudget({...currentBudget, materials: l}), item.id)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-trash"></i></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input placeholder="Material" className="flex-1 p-2 rounded-xl border-none text-xs" value={tempMat.name} onChange={e => setTempMat({...tempMat, name: e.target.value})} />
                      <input type="number" placeholder="Valor" className="w-24 p-2 rounded-xl border-none text-xs" value={tempMat.value} onChange={e => setTempMat({...tempMat, value: e.target.value})} />
                      <button type="button" onClick={() => addItem(currentBudget.materials!, (l) => setCurrentBudget({...currentBudget, materials: l}), tempMat, () => setTempMat({name:'', value:''}))} className="bg-indigo-600 text-white px-3 rounded-xl"><i className="fa-solid fa-plus"></i></button>
                    </div>
                  </div>

                </div>

                {/* Coluna 2: Totais e Opções */}
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Subtotal dos Itens</p>
                    <p className="text-3xl font-black">R$ {baseTotal.toFixed(2)}</p>
                    <p className="text-[9px] text-slate-500 mt-2">Use este valor base para criar as opções de pagamento abaixo.</p>
                  </div>

                  <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100">
                    <h4 className="text-xs font-black text-emerald-700 uppercase mb-3">Opções de Pagamento</h4>
                    <div className="space-y-3 mb-4">
                      {currentBudget.options?.map(opt => (
                        <div key={opt.id} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm relative group">
                          <button type="button" onClick={() => setCurrentBudget({...currentBudget, options: currentBudget.options?.filter(o => o.id !== opt.id)})} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><i className="fa-solid fa-times"></i></button>
                          <p className="text-xs font-black text-emerald-800 uppercase">{opt.method}</p>
                          <p className="text-lg font-black text-slate-800">R$ {opt.total.toFixed(2)}</p>
                          <p className="text-[9px] text-slate-500 italic leading-tight mt-1">{opt.details}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                       <input placeholder="Nome (Ex: À Vista)" className="w-full p-2 rounded-xl border-none text-xs" value={tempOpt.method} onChange={e => setTempOpt({...tempOpt, method: e.target.value})} />
                       <input type="number" placeholder="Valor Final" className="w-full p-2 rounded-xl border-none text-xs" value={tempOpt.total} onChange={e => setTempOpt({...tempOpt, total: e.target.value})} />
                       <input placeholder="Detalhes (Ex: Desconto de 5%)" className="w-full p-2 rounded-xl border-none text-xs" value={tempOpt.details} onChange={e => setTempOpt({...tempOpt, details: e.target.value})} />
                       <button type="button" onClick={addOption} className="w-full bg-emerald-600 text-white py-2 rounded-xl font-black text-xs uppercase hover:bg-emerald-700">Adicionar Opção</button>
                    </div>
                  </div>

                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Orientações (Max 500 carac.)</label>
                     <textarea 
                       maxLength={500}
                       className="w-full p-4 rounded-2xl bg-slate-50 border-none font-medium text-xs h-32 resize-none"
                       placeholder="Orientações pré e pós procedimento..."
                       value={currentBudget.notes}
                       onChange={e => setCurrentBudget({...currentBudget, notes: e.target.value})}
                     />
                     <p className="text-right text-[9px] text-slate-400 mt-1">{currentBudget.notes?.length || 0}/500</p>
                  </div>

                  <button type="button" onClick={saveBudget} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase hover:bg-indigo-700 transition-all">Salvar Orçamento</button>

                </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {budgets.map(budget => (
             <div key={budget.id} className="bg-white rounded-[40px] border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between h-full">
                <div>
                   <div className="flex justify-between items-start mb-4">
                      <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase px-2 py-1 rounded-lg">Orçamento</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button type="button" onClick={() => { setCurrentBudget(budget); setIsEditing(true); }} className="text-slate-300 hover:text-indigo-600" title="Editar"><i className="fa-solid fa-pen"></i></button>
                         <button type="button" onClick={() => deleteBudget(budget.id)} className="text-slate-300 hover:text-red-500" title="Excluir"><i className="fa-solid fa-trash"></i></button>
                      </div>
                   </div>
                   <h3 className="text-lg font-black text-slate-800 uppercase leading-tight mb-2">{budget.procedureName}</h3>
                   <div className="space-y-1 mb-4">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{budget.fees.length + budget.medications.length + budget.materials.length} itens inclusos</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{budget.options.length} opções de pagamento</p>
                   </div>
                </div>
                
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                   <button type="button" onClick={() => copyBudget(budget)} className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-100 transition-colors">
                     <i className="fa-solid fa-copy mr-1"></i> Copiar
                   </button>
                   <button type="button" onClick={() => printBudget(budget)} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-colors">
                     <i className="fa-solid fa-print mr-1"></i> Imprimir
                   </button>
                </div>
             </div>
           ))}
           {budgets.length === 0 && (
             <div className="col-span-full py-20 text-center opacity-30">
               <i className="fa-solid fa-file-invoice-dollar text-4xl mb-4"></i>
               <p className="font-black uppercase text-sm">Nenhum orçamento criado</p>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default Budgets;
