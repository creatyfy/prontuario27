import React, { useState, useMemo, useRef } from 'react';
import { processExamData, transcribeExamAudio } from '../geminiService';
import { ProcessedExamResult } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Exams: React.FC = () => {
  const [examInput, setExamInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProcessedExamResult | null>(null);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsTranscribing(true);
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64Audio = (reader.result as string).split(',')[1];
            const transcribedText = await transcribeExamAudio(base64Audio, 'audio/webm');
            if (transcribedText) {
              setExamInput(prev => (prev.trim() + " " + transcribedText).trim());
            }
          } catch (error) {
            console.error("Erro na transcrição:", error);
            alert("Erro ao transcrever áudio.");
          } finally {
            setIsTranscribing(false);
            stream.getTracks().forEach(track => track.stop());
          }
        };
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleProcess = async () => {
    if (!examInput.trim()) return;
    setLoading(true);
    try {
      const data = await processExamData(examInput);
      
      if (data.error === 'NO_DATE_FOUND') {
        alert("Erro: Não foi encontrada nenhuma data no texto. Por favor, especifique a data de cada exame (ex: 10/02/2025) para que possamos organizar a tabela.");
        setResults(null);
      } else {
        setResults(data);
        if (data.laboratory) {
          setSelectedExams(data.laboratory.map(l => l.name));
        }
      }
    } catch (error) {
      console.error(error);
      alert("Erro técnico ao processar. Certifique-se de incluir datas válidas no texto.");
    } finally {
      setLoading(false);
    }
  };

  const labPivot = useMemo(() => {
    if (!results || !results.laboratory || results.laboratory.length === 0) return null;
    const dates = Array.from(new Set(results.laboratory.map(l => l.date))).sort((a, b) => {
      const partsA = (a as string).split('/').reverse().join('-');
      const partsB = (b as string).split('/').reverse().join('-');
      return partsA.localeCompare(partsB);
    });
    const names = Array.from(new Set(results.laboratory.map(l => l.name))).sort();
    const matrix = names.map(name => {
      const values: Record<string, string> = {};
      dates.forEach(date => {
        const found = results.laboratory.find(l => l.name === name && l.date === (date as string));
        values[date as string] = found ? found.value : '-';
      });
      return { name, values };
    });
    return { dates: dates as string[], matrix };
  }, [results]);

  const complexPivot = useMemo(() => {
    if (!results || !results.complex || results.complex.length === 0) return null;
    const dates = Array.from(new Set(results.complex.map(c => c.date))).sort((a, b) => {
      const partsA = (a as string).split('/').reverse().join('-');
      const partsB = (b as string).split('/').reverse().join('-');
      return partsA.localeCompare(partsB);
    });
    const names = Array.from(new Set(results.complex.map(c => c.name))).sort();
    const matrix = names.map(name => {
      const values: Record<string, string> = {};
      dates.forEach(date => {
        const found = results.complex.find(c => c.name === name && c.date === (date as string));
        values[date as string] = found ? found.result : '-';
      });
      return { name, values };
    });
    return { dates: dates as string[], matrix };
  }, [results]);

  const chartData = useMemo(() => {
    if (!labPivot) return [];
    const maxValues: Record<string, number> = {};
    labPivot.matrix.forEach(row => {
      let max = 0;
      Object.values(row.values).forEach(val => {
        const num = parseFloat(String(val).replace(',', '.').replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > max) max = num;
      });
      maxValues[row.name] = max || 1;
    });
    return labPivot.dates.map(date => {
      const entry: any = { date };
      labPivot.matrix.forEach(row => {
        const val = row.values[date];
        if (val !== '-') {
          const num = parseFloat(String(val).replace(',', '.').replace(/[^0-9.]/g, ''));
          if (!isNaN(num)) {
            entry[row.name] = Math.round((num / maxValues[row.name]) * 100);
          }
        }
      });
      return entry;
    });
  }, [labPivot]);

  const toggleExamSelection = (name: string) => {
    setSelectedExams(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const chartColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

  return (
    <div className="space-y-8 pb-20">
      <header>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Análise Comparativa de Exames</h2>
        <p className="text-slate-500 font-medium tracking-tight">Organização automática e tendências gráficas</p>
      </header>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[32px] flex flex-col md:flex-row gap-6 items-center">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0">
          <i className="fa-solid fa-lightbulb text-xl"></i>
        </div>
        <div>
          <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Como preencher para melhor resultado:</h4>
          <p className="text-xs text-amber-700 font-medium leading-relaxed italic">
            "Hemoglobina 14.5, Glicemia 98 e TSH 2.1 em 10/01/2025. <br/>
            Hemoglobina 13.8 e Glicemia 102 em 15/02/2025. <br/>
            Ressonância de crânio sem lesões em 20/02/2025."
          </p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
        <div className="relative">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-2 block tracking-widest">
            Escrever exames (Datas são obrigatórias)
          </label>
          <textarea
            className="w-full h-40 p-6 rounded-3xl bg-slate-50 border-none font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none shadow-inner"
            placeholder="Cole os laudos ou digite os valores indicando a data de cada um..."
            value={examInput}
            onChange={(e) => setExamInput(e.target.value)}
          />
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            className={`absolute bottom-6 right-6 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
              isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {isTranscribing ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>}
          </button>
        </div>

        <button
          onClick={handleProcess}
          disabled={loading || !examInput.trim()}
          className={`w-full py-4 rounded-2xl font-black text-sm uppercase shadow-xl transition-all flex items-center justify-center gap-3 ${
            loading ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {loading ? (
            <>
              <i className="fa-solid fa-circle-notch fa-spin"></i> Processando...
            </>
          ) : (
            <>
              <i className="fa-solid fa-chart-line"></i> Processar Dados e Gráficos
            </>
          )}
        </button>
      </div>

      {results && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Gráfico Comparativo Laboratorial (Com Toggle) */}
          {labPivot && chartData.length > 0 && (
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-8 transition-all">
              <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-chart-area text-indigo-500"></i> Evolução Percentual de Marcadores
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Escala de 0 a 100% (Normalizado pelo Máximo Identificado)</p>
                </div>
                <button 
                  onClick={() => setIsChartExpanded(!isChartExpanded)}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all flex items-center gap-2"
                >
                  <i className={`fa-solid ${isChartExpanded ? 'fa-compress' : 'fa-expand'}`}></i>
                  {isChartExpanded ? 'Recolher Gráfico' : 'Visualizar Gráfico'}
                </button>
              </div>

              {isChartExpanded && (
                <div className="animate-in slide-in-from-top-4 duration-300">
                  {/* Seletor de Exames para o Gráfico */}
                  <div className="mb-8 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Selecione os exames para visualizar no gráfico:</p>
                    <div className="flex flex-wrap gap-2">
                      {labPivot.matrix.map(row => (
                        <button 
                          key={row.name}
                          onClick={() => toggleExamSelection(row.name)}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all flex items-center gap-2 ${
                            selectedExams.includes(row.name) 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                            : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-200'
                          }`}
                        >
                          {selectedExams.includes(row.name) && <i className="fa-solid fa-check"></i>}
                          {row.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} 
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          domain={[0, 100]} 
                          tick={{fill: '#94a3b8', fontSize: 10}} 
                          axisLine={false}
                          tickLine={false}
                          unit="%"
                        />
                        <Tooltip 
                          contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} 
                          labelStyle={{fontWeight: 'bold', marginBottom: '4px'}}
                        />
                        <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                        {labPivot.matrix
                          .filter(row => selectedExams.includes(row.name))
                          .map((row, idx) => (
                          <Line 
                            key={row.name} 
                            type="monotone" 
                            dataKey={row.name} 
                            stroke={chartColors[idx % chartColors.length]} 
                            strokeWidth={3}
                            dot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                            activeDot={{ r: 7, strokeWidth: 0 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TABELA 1: EXAMES LABORATORIAIS */}
          {labPivot && (
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-flask text-indigo-500"></i> Matriz Laboratorial (Sangue, Urina, Líquor)
                </h3>
                <span className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded">Valores por Data</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase sticky left-0 bg-slate-50 z-10 border-r">Exame</th>
                      {labPivot.dates.map(date => (
                        <th key={date} className="px-6 py-4 text-[10px] font-black text-slate-800 uppercase text-center min-w-[120px]">{date}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {labPivot.matrix.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-black text-slate-700 uppercase sticky left-0 bg-white border-r">{row.name}</td>
                        {labPivot.dates.map(date => (
                          <td key={date} className="px-6 py-4 text-xs font-bold text-indigo-600 text-center">{row.values[date]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABELA 2: IMAGEM E COMPLEXOS (MATRIZ POR DATA) */}
          {complexPivot && (
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-x-ray text-blue-500"></i> Matriz de Imagem e Complexos (RM, TC, ECG, EEG)
                </h3>
                <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-2 py-1 rounded">Laudos Comparativos</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase sticky left-0 bg-slate-50 z-10 border-r">Tipo de Exame</th>
                      {complexPivot.dates.map(date => (
                        <th key={date} className="px-6 py-4 text-[10px] font-black text-slate-800 uppercase text-center min-w-[250px]">{date}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {complexPivot.matrix.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-black text-slate-700 uppercase sticky left-0 bg-white border-r">{row.name}</td>
                        {complexPivot.dates.map(date => (
                          <td key={date} className="px-6 py-4 text-[11px] text-slate-600 font-medium leading-relaxed max-w-[400px]">
                            {row.values[date]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!labPivot && !complexPivot && (
            <div className="p-20 text-center opacity-30 bg-white rounded-[40px] border border-slate-200 border-dashed">
              <i className="fa-solid fa-calendar-xmark text-4xl mb-4"></i>
              <p className="font-black uppercase text-sm">Nenhum dado com data válida identificado para tabular.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Exams;