
import React from 'react';

const Marketing: React.FC = () => {
  const campaigns = [
    { name: 'Instagram - Primeiro Anúncio', status: 'Ativo', reach: '2.4k', conversions: 12, budget: 'R$ 20/dia' },
    { name: 'Instagram - Segundo Anúncio', status: 'Ativo', reach: '1.8k', conversions: 8, budget: 'R$ 15/dia' },
    { name: 'Doctoralia - Campanha Semanal', status: 'Pausado', reach: '500', conversions: 2, budget: 'Variável' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Marketing & Presença Digital</h2>
        <p className="text-slate-500">Monitoramento de tráfego e aquisição de pacientes</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fa-brands fa-instagram text-pink-600"></i>
            Campanhas Sociais
          </h3>
          <div className="space-y-4">
            {campaigns.map((camp, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-700">{camp.name}</p>
                  <p className="text-xs text-slate-500">{camp.budget} • {camp.reach} Alcance</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  camp.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {camp.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-2xl text-white shadow-lg">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <i className="fa-solid fa-ranking-star"></i>
            SEO & Google
          </h3>
          <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
            Lembrete diário: Realizar buscas em janela privada para reforçar autoridade orgânica em "Neurologista Campo Grande MS".
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
              <p className="text-[10px] uppercase font-bold text-indigo-300">Google Rank</p>
              <p className="text-xl font-bold">#2 Local</p>
            </div>
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
              <p className="text-[10px] uppercase font-bold text-indigo-300">Cliques/Mês</p>
              <p className="text-xl font-bold">142</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketing;
