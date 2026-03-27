import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PatientMetadata, SloanContrastRecord, SDMTRecord, MMSERecord, SnellenRecord, FSSRecord } from '../types';
import { useConfirm } from '../ConfirmContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

interface NewScalesProps {
  patientMetadata: PatientMetadata;
  setPatientMetadata: (meta: PatientMetadata) => void;
  selectedPatientName?: string;
}

const SLOAN_LETTERS = ['C', 'D', 'H', 'K', 'N', 'O', 'R', 'S', 'V', 'Z'];
const SDMT_GLYPHS = ["●", "■", "▲", "◆", "★", "♥", "☀︎", "☁︎", "☂︎", "✈︎", "☎︎", "✉︎", "✂︎", "✎︎", "⌛︎", "⌚︎", "⚙︎", "⚑︎", "♻︎", "⚠︎", "♣", "♦", "♠"];

// Fix: Defined the COLORS constant used for chart rendering
const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

const MMSE_ITEMS = [
  { id: 'year', label: 'Que ano é este?', cat: 'Orientação Temporal' },
  { id: 'season', label: 'Em que estação do ano estamos?', cat: 'Orientação Temporal' },
  { id: 'month', label: 'Em que mês estamos?', cat: 'Orientação Temporal' },
  { id: 'date', label: 'Que dia do mês é hoje?', cat: 'Orientação Temporal' },
  { id: 'weekday', label: 'Em que dia da semana estamos?', cat: 'Orientação Temporal' },
  { id: 'state', label: 'Em que estado estamos?', cat: 'Orientação Espacial' },
  { id: 'city', label: 'Em que cidade estamos?', cat: 'Orientação Espacial' },
  { id: 'neighborhood', label: 'Em que bairro (ou bairro próximo) estamos?', cat: 'Orientação Espacial' },
  { id: 'local', label: 'Em que local estamos agora?', cat: 'Orientação Espacial' },
  { id: 'floor', label: 'Em que andar ou sala estamos?', cat: 'Orientação Espacial' },
  { id: 'word1', label: 'Repetir: Mesa', cat: 'Registro' },
  { id: 'word2', label: 'Repetir: Cadeira', cat: 'Registro' },
  { id: 'word3', label: 'Repetir: Caneta', cat: 'Registro' },
  { id: 'calc1', label: '100 - 7 = 93', cat: 'Atenção e Cálculo' },
  { id: 'calc2', label: '93 - 7 = 86', cat: 'Atenção e Cálculo' },
  { id: 'calc3', label: '86 - 7 = 79', cat: 'Atenção e Cálculo' },
  { id: 'calc4', label: '79 - 7 = 72', cat: 'Atenção e Cálculo' },
  { id: 'calc5', label: '72 - 7 = 65', cat: 'Atenção e Cálculo' },
  { id: 'recall1', label: 'Recordar: Mesa', cat: 'Evocação' },
  { id: 'recall2', label: 'Recordar: Cadeira', cat: 'Evocação' },
  { id: 'recall3', label: 'Recordar: Caneta', cat: 'Evocação' },
  { id: 'naming1', label: 'Nomear Relógio', cat: 'Linguagem' },
  { id: 'naming2', label: 'Nomear Caneta', cat: 'Linguagem' },
  { id: 'repeat', label: 'Repetir: "Nem aqui, nem ali, nem lá"', cat: 'Linguagem' },
  { id: 'cmd1', label: 'Comando: Pega papel com mão direita', cat: 'Linguagem' },
  { id: 'cmd2', label: 'Comando: Dobra ao meio', cat: 'Linguagem' },
  { id: 'cmd3', label: 'Comando: Coloca no chão', cat: 'Linguagem' },
  { id: 'read', label: 'Ler e executar: "FECHE OS OLHOS"', cat: 'Linguagem' },
  { id: 'write', label: 'Escrever uma frase completa', cat: 'Linguagem' },
  { id: 'copy', label: 'Copiar desenho dos pentágonos', cat: 'Linguagem' },
];

const FSS_ITEMS = [
  "Minha motivação é menor quando estou fadigado.",
  "O exercício físico me deixa fadigado.",
  "Eu me fadigo facilmente.",
  "A fadiga interfere no meu funcionamento físico.",
  "A fadiga me causa problemas frequentes.",
  "Minha fadiga impede significativamente a atividade física sustentada.",
  "A fadiga interfere com o exercício de deveres e responsabilidades.",
  "A fadiga é um dos meus sintomas mais incapacitantes.",
  "A fadiga interfere no trabalho, família ou vida social."
];

// Tamanhos da letra (mm) para distância de 1m conforme progressão LogMAR baseada na tabela enviada
const SLOAN_SIZES_MM_1M = [
  14.54, 11.64, 9.16, 7.27, 5.82, 4.58, 3.64, 2.91, 2.33, 1.82, 1.45, 1.16, 0.91, 0.73
];

const SNELLEN_LINES = [
  { label: '20/200', size1m: 14.54, size50cm: 7.27, size2m: 29.09 },
  { label: '20/100', size1m: 7.27, size50cm: 3.64, size2m: 14.54 },
  { label: '20/80',  size1m: 5.82, size50cm: 2.91, size2m: 11.64 },
  { label: '20/70',  size1m: 5.09, size50cm: 2.54, size2m: 10.18 },
  { label: '20/50',  size1m: 3.64, size50cm: 1.82, size2m: 7.27 },
  { label: '20/40',  size1m: 2.91, size50cm: 1.45, size2m: 5.82 },
  { label: '20/30',  size1m: 2.18, size50cm: 1.09, size2m: 4.36 },
  { label: '20/25',  size1m: 1.82, size50cm: 0.91, size2m: 3.64 },
  { label: '20/20',  size1m: 1.45, size50cm: 0.73, size2m: 2.91 }
];

const NewScales: React.FC<NewScalesProps> = ({ patientMetadata, setPatientMetadata, selectedPatientName }) => {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'sloan' | 'snellen' | 'sdmt' | 'mmse' | 'fss'>('sloan');

  // Sloan States
  const [sloanPhase, setSloanPhase] = useState<'calibration' | 'test' | 'summary'>('calibration');
  const [sloanCalibrationPx, setSloanCalibrationPx] = useState(250);
  const [sloanDistance, setSloanDistance] = useState('2m');
  const [sloanEye, setSloanEye] = useState<'OD' | 'OE' | 'OU'>('OU');
  const [sloanContrast, setSloanContrast] = useState(2.5);
  const [sloanLettersCorrect, setSloanLettersCorrect] = useState(0);
  const [sloanErrors, setSloanErrors] = useState(0);
  const [sloanCurrentLine, setSloanCurrentLine] = useState(0);
  const [sloanCurrentLetterInLine, setSloanCurrentLetterInLine] = useState(0);
  const [sloanTestLetters, setSloanTestLetters] = useState<string[]>([]);
  const [lastWorseningDetected, setLastWorseningDetected] = useState(false);

  // Snellen States
  const [snellenPhase, setSnellenPhase] = useState<'calibration' | 'test' | 'summary'>('calibration');
  const [snellenCalibrationPx, setSnellenCalibrationPx] = useState(250);
  const [snellenDistance, setSnellenDistance] = useState<'50cm' | '1m' | '2m'>('1m');
  const [snellenEye, setSnellenEye] = useState<'OD' | 'OE' | 'OU'>('OU');
  const [snellenCurrentLineIdx, setSnellenCurrentLineIdx] = useState(0);
  const [snellenCurrentLetterIdx, setSnellenCurrentLetterIdx] = useState(0);
  const [snellenErrors, setSnellenErrors] = useState(0);
  const [snellenTestLetters, setSnellenTestLetters] = useState<string[]>([]);
  const [lastSnellenAcuity, setLastSnellenAcuity] = useState('20/200');

  // SDMT States
  const [sdmtPhase, setSdmtPhase] = useState<'setup' | 'practice' | 'test' | 'summary'>('setup');
  const [sdmtMapping, setSdmtMapping] = useState<{ glyph: string, digit: number }[]>([]);
  const [sdmtCurrent, setSdmtCurrent] = useState<{ glyph: string, digit: number } | null>(null);
  const [sdmtCorrect, setSdmtCorrect] = useState(0);
  const [sdmtAttempts, setSdmtAttempts] = useState(0);
  const [sdmtTimer, setSdmtTimer] = useState(0);
  const [sdmtBins, setSdmtBins] = useState<number[]>([0, 0, 0, 0]);
  const [isSdmtPractice, setIsSdmtPractice] = useState(false);
  const sdmtTimerRef = useRef<any>(null);
  const sdmtStartTsRef = useRef<number>(0);
  
  const [lastSdmtWorsening, setLastSdmtWorsening] = useState(false);
  const [lastSdmtSignificant, setLastSdmtSignificant] = useState(false);

  // MMSE States
  const [mmsePhase, setMmsePhase] = useState<'setup' | 'test' | 'summary'>('setup');
  const [mmsePoints, setMmsePoints] = useState<Set<string>>(new Set());
  const [mmseSchooling, setMmseSchooling] = useState('9-11 anos');
  const [mmseFullscreen, setMmseFullscreen] = useState<'read' | 'copy' | null>(null);

  // FSS States
  const [fssPhase, setFssPhase] = useState<'setup' | 'test' | 'summary'>('setup');
  const [fssScores, setFssScores] = useState<number[]>(new Array(9).fill(1));

  // Histórico persistente anônimo (local)
  const [anonymousSloan, setAnonymousSloan] = useState<SloanContrastRecord[]>(() => {
    const saved = localStorage.getItem('neuroclinic_anonymous_sloan');
    return saved ? JSON.parse(saved) : [];
  });
  const [anonymousSDMT, setAnonymousSDMT] = useState<SDMTRecord[]>(() => {
    const saved = localStorage.getItem('neuroclinic_anonymous_sdmt');
    return saved ? JSON.parse(saved) : [];
  });
  const [anonymousMMSE, setAnonymousMMSE] = useState<MMSERecord[]>(() => {
    const saved = localStorage.getItem('neuroclinic_anonymous_mmse');
    return saved ? JSON.parse(saved) : [];
  });
  const [anonymousSnellen, setAnonymousSnellen] = useState<SnellenRecord[]>(() => {
    const saved = localStorage.getItem('neuroclinic_anonymous_snellen');
    return saved ? JSON.parse(saved) : [];
  });
  const [anonymousFSS, setAnonymousFSS] = useState<FSSRecord[]>(() => {
    const saved = localStorage.getItem('neuroclinic_anonymous_fss');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => localStorage.setItem('neuroclinic_anonymous_sloan', JSON.stringify(anonymousSloan)), [anonymousSloan]);
  useEffect(() => localStorage.setItem('neuroclinic_anonymous_sdmt', JSON.stringify(anonymousSDMT)), [anonymousSDMT]);
  useEffect(() => localStorage.setItem('neuroclinic_anonymous_mmse', JSON.stringify(anonymousMMSE)), [anonymousMMSE]);
  useEffect(() => localStorage.setItem('neuroclinic_anonymous_snellen', JSON.stringify(anonymousSnellen)), [anonymousSnellen]);
  useEffect(() => localStorage.setItem('neuroclinic_anonymous_fss', JSON.stringify(anonymousFSS)), [anonymousFSS]);

  const targetPatient = selectedPatientName || 'Modo Desenvolvimento (Sem Paciente)';

  // Sloan logic
  const sloanGroupedHistory = useMemo(() => {
    const history = selectedPatientName 
      ? (patientMetadata[selectedPatientName]?.sloanHistory || []) 
      : anonymousSloan;
      
    const groups: Record<string, any> = {};
    history.forEach(rec => {
      if (!groups[rec.date]) groups[rec.date] = { date: rec.date, OD: null, OE: null, AO: null, worsening: {} };
      const eyeKey = rec.eye === 'OU' ? 'AO' : rec.eye;
      groups[rec.date][eyeKey] = Math.max(groups[rec.date][eyeKey] || 0, rec.lettersCorrect);
      groups[rec.date].worsening[eyeKey] = rec.worsening || groups[rec.date].worsening[eyeKey];
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedPatientName, patientMetadata, anonymousSloan]);

  const sloanChartData = useMemo(() => {
    return [...sloanGroupedHistory].reverse().map(row => ({
      ...row,
      date: row.date.split('-').reverse().slice(0, 2).join('/')
    }));
  }, [sloanGroupedHistory]);

  const startSloanTest = () => {
    const letters = [];
    for (let i = 0; i < 70; i++) {
      letters.push(SLOAN_LETTERS[Math.floor(Math.random() * SLOAN_LETTERS.length)]);
    }
    setSloanTestLetters(letters);
    setSloanLettersCorrect(0);
    setSloanErrors(0);
    setSloanCurrentLine(0);
    setSloanCurrentLetterInLine(0);
    setSloanPhase('test');
    setLastWorseningDetected(false);
  };

  const handleSloanMiss = () => {
    const newErrors = sloanErrors + 1;
    setSloanErrors(newErrors);
    if (newErrors >= 3) finishSloan();
    else advanceSloan();
  };

  const advanceSloan = () => {
    if (sloanCurrentLetterInLine < 4) {
      setSloanCurrentLetterInLine(prev => prev + 1);
    } else {
      if (sloanCurrentLine < 13) {
        setSloanCurrentLine(prev => prev + 1);
        setSloanCurrentLetterInLine(0);
      } else {
        finishSloan();
      }
    }
  };

  const finishSloan = () => {
    const history = selectedPatientName ? (patientMetadata[selectedPatientName]?.sloanHistory || []) : anonymousSloan;
    const lastRecordForEye = history.find(r => r.eye === sloanEye && r.contrastLevel === sloanContrast);
    const isWorsening = lastRecordForEye ? (sloanLettersCorrect <= lastRecordForEye.lettersCorrect - 7) : false;
    setLastWorseningDetected(isWorsening);
    setSloanPhase('summary');
  };

  const saveSloan = () => {
    const newRecord: SloanContrastRecord = {
      id: `sloan-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      contrastLevel: sloanContrast,
      lettersCorrect: sloanLettersCorrect,
      eye: sloanEye,
      distance: sloanDistance,
      worsening: lastWorseningDetected
    };

    if (selectedPatientName) {
      const currentMeta = patientMetadata[selectedPatientName] || { tags: [] };
      setPatientMetadata({
        ...patientMetadata,
        [selectedPatientName]: { ...currentMeta, sloanHistory: [newRecord, ...(currentMeta.sloanHistory || [])] }
      });
      confirm({ type: 'alert', title: 'Sucesso', message: 'Resultado registrado no prontuário.' });
    } else {
      setAnonymousSloan([newRecord, ...anonymousSloan]);
      confirm({ type: 'alert', title: 'Salvo', message: 'Resultado salvo no histórico anônimo.' });
    }
    setSloanPhase('calibration');
  };

  // Snellen Logic
  const snellenHistory = useMemo(() => {
    return selectedPatientName 
      ? (patientMetadata[selectedPatientName]?.snellenHistory || []) 
      : anonymousSnellen;
  }, [selectedPatientName, patientMetadata, anonymousSnellen]);

  const startSnellenTest = () => {
    const letters = [];
    for (let i = 0; i < SNELLEN_LINES.length * 5; i++) {
        letters.push(SLOAN_LETTERS[Math.floor(Math.random() * SLOAN_LETTERS.length)]);
    }
    setSnellenTestLetters(letters);
    setSnellenCurrentLineIdx(0);
    setSnellenCurrentLetterIdx(0);
    setSnellenErrors(0);
    setLastSnellenAcuity('20/200');
    setSnellenPhase('test');
  };

  const handleSnellenHit = () => {
    setLastSnellenAcuity(SNELLEN_LINES[snellenCurrentLineIdx].label);
    advanceSnellen();
  };

  const handleSnellenMiss = () => {
    const newErrors = snellenErrors + 1;
    setSnellenErrors(newErrors);
    if (newErrors >= 3) {
        setSnellenPhase('summary');
    } else {
        advanceSnellen();
    }
  };

  const advanceSnellen = () => {
    if (snellenCurrentLetterIdx < 4) {
        setSnellenCurrentLetterIdx(prev => prev + 1);
    } else {
        if (snellenCurrentLineIdx < SNELLEN_LINES.length - 1) {
            setSnellenCurrentLineIdx(prev => prev + 1);
            setSnellenCurrentLetterIdx(0);
        } else {
            setSnellenPhase('summary');
        }
    }
  };

  const saveSnellen = () => {
    const newRecord: SnellenRecord = {
      id: `snellen-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      acuity: lastSnellenAcuity,
      eye: snellenEye,
      distance: snellenDistance
    };

    if (selectedPatientName) {
      const currentMeta = patientMetadata[selectedPatientName] || { tags: [] };
      setPatientMetadata({
        ...patientMetadata,
        [selectedPatientName]: { ...currentMeta, snellenHistory: [newRecord, ...(currentMeta.snellenHistory || [])] }
      });
      confirm({ type: 'alert', title: 'Sucesso', message: `Snellen registrado: ${lastSnellenAcuity}.` });
    } else {
      setAnonymousSnellen([newRecord, ...anonymousSnellen]);
      confirm({ type: 'alert', title: 'Salvo', message: 'Resultado salvo no histórico anônimo.' });
    }
    setSnellenPhase('calibration');
  };

  const snellenChartData = useMemo(() => {
    return [...snellenHistory].reverse().map(r => ({
      date: r.date.split('-').reverse().slice(0, 2).join('/'),
      val: 200 / parseInt(r.acuity.split('/')[1]) // LogMAR proxy
    }));
  }, [snellenHistory]);

  // SDMT logic
  const sdmtHistory = useMemo(() => {
    return selectedPatientName 
      ? (patientMetadata[selectedPatientName]?.sdmtHistory || []) 
      : anonymousSDMT;
  }, [selectedPatientName, patientMetadata, anonymousSDMT]);

  const sdmtChartData = useMemo(() => {
    return [...sdmtHistory].reverse().map(r => ({
      date: r.date.split('-').reverse().slice(0, 2).join('/'),
      score: r.correct
    }));
  }, [sdmtHistory]);

  const buildSDMTMapping = () => {
    const pool = [...SDMT_GLYPHS].sort(() => Math.random() - 0.5);
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
    const mapping = digits.map((d, i) => ({ glyph: pool[i], digit: d }));
    setSdmtMapping(mapping);
    return mapping;
  };

  const nextSDMTStimulus = (mapping: { glyph: string, digit: number }[]) => {
    const next = mapping[Math.floor(Math.random() * mapping.length)];
    setSdmtCurrent(next);
  };

  const startSDMTRun = (isPractice: boolean) => {
    const mapping = buildSDMTMapping();
    setIsSdmtPractice(isPractice);
    setSdmtCorrect(0);
    setSdmtAttempts(0);
    setSdmtBins([0, 0, 0, 0]);
    setSdmtTimer(isPractice ? 15 : 120);
    nextSDMTStimulus(mapping);
    
    sdmtStartTsRef.current = Date.now();
    setSdmtPhase(isPractice ? 'practice' : 'test');

    const duration = isPractice ? 15000 : 120000;
    const endTs = sdmtStartTsRef.current + duration;

    if (sdmtTimerRef.current) clearInterval(sdmtTimerRef.current);
    sdmtTimerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTs - now) / 1000));
      setSdmtTimer(remaining);
      if (remaining <= 0) finishSDMT();
    }, 100);
  };

  const registerSDMTAnswer = (digit: number) => {
    if (sdmtPhase !== 'practice' && sdmtPhase !== 'test') return;
    if (!sdmtCurrent) return;

    setSdmtAttempts(prev => prev + 1);
    const isCorrect = digit === sdmtCurrent.digit;
    if (isCorrect) {
      setSdmtCorrect(prev => prev + 1);
      if (!isSdmtPractice) {
        const elapsedS = (Date.now() - sdmtStartTsRef.current) / 1000;
        const binIdx = Math.min(3, Math.floor(elapsedS / 30));
        setSdmtBins(prev => {
          const next = [...prev];
          next[binIdx] += 1;
          return next;
        });
      }
    }
    nextSDMTStimulus(sdmtMapping);
  };

  const finishSDMT = () => {
    if (sdmtTimerRef.current) clearInterval(sdmtTimerRef.current);
    if (isSdmtPractice) {
        setSdmtPhase('setup');
    } else {
        const history = selectedPatientName 
          ? (patientMetadata[selectedPatientName]?.sdmtHistory || []) 
          : anonymousSDMT;
        const lastRecord = history[0];
        const worsening = lastRecord ? (sdmtCorrect <= lastRecord.correct - 4) : false;
        const significant = lastRecord ? (sdmtCorrect <= lastRecord.correct - 8) : false;
        setLastSdmtWorsening(worsening);
        setLastSdmtSignificant(significant);
        setSdmtPhase('summary');
    }
  };

  const cancelSDMTRun = () => {
    if (sdmtTimerRef.current) clearInterval(sdmtTimerRef.current);
    setSdmtPhase('setup');
  };

  const saveSDMT = () => {
    const accuracy = sdmtAttempts > 0 ? (sdmtCorrect / sdmtAttempts) * 100 : 0;
    const newRecord: SDMTRecord = {
      id: `sdmt-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      correct: sdmtCorrect,
      attempts: sdmtAttempts,
      accuracy,
      bins: sdmtBins,
      worsening: lastSdmtWorsening,
      significantWorsening: lastSdmtSignificant
    };

    if (selectedPatientName) {
      const currentMeta = patientMetadata[selectedPatientName] || { tags: [] };
      setPatientMetadata({
        ...patientMetadata,
        [selectedPatientName]: { ...currentMeta, sdmtHistory: [newRecord, ...(currentMeta.sdmtHistory || [])] }
      });
      confirm({ type: 'alert', title: 'Sucesso', message: 'Resultado registrado no prontuário.' });
    } else {
      setAnonymousSDMT([newRecord, ...anonymousSDMT]);
      confirm({ type: 'alert', title: 'Salvo', message: 'Resultado salvo no histórico anônimo.' });
    }
    setSdmtPhase('setup');
  };

  // MMSE Logic
  const mmseHistory = useMemo(() => {
    return selectedPatientName 
      ? (patientMetadata[selectedPatientName]?.mmseHistory || []) 
      : anonymousMMSE;
  }, [selectedPatientName, patientMetadata, anonymousMMSE]);

  const mmseChartData = useMemo(() => {
    return [...mmseHistory].reverse().map(r => ({
      date: r.date.split('-').reverse().slice(0, 2).join('/'),
      score: r.score
    }));
  }, [mmseHistory]);

  const toggleMMSEPoint = (id: string) => {
    setMmsePoints(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getMMSEInterpretation = (score: number, schooling: string): 'Normal' | 'Alterado' => {
    if (schooling === 'Analfabeto') return score >= 20 ? 'Normal' : 'Alterado';
    if (schooling === '1-4 anos') return score >= 25 ? 'Normal' : 'Alterado';
    if (schooling === '5-8 anos') return score >= 26 ? 'Normal' : 'Alterado';
    if (schooling === '9-11 anos') return score >= 28 ? 'Normal' : 'Alterado';
    if (schooling === 'Superior') return score >= 29 ? 'Normal' : 'Alterado';
    return score >= 24 ? 'Normal' : 'Alterado';
  };

  const saveMMSE = () => {
    const score = mmsePoints.size;
    const interpretation = getMMSEInterpretation(score, mmseSchooling);
    const newRecord: MMSERecord = {
      id: `mmse-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      score,
      schooling: mmseSchooling,
      interpretation
    };

    if (selectedPatientName) {
      const currentMeta = patientMetadata[selectedPatientName] || { tags: [] };
      setPatientMetadata({
        ...patientMetadata,
        [selectedPatientName]: { ...currentMeta, mmseHistory: [newRecord, ...(currentMeta.mmseHistory || [])] }
      });
      confirm({ type: 'alert', title: 'Sucesso', message: `MEEM salvo. Pontuação: ${score}.` });
    } else {
      setAnonymousMMSE([newRecord, ...anonymousMMSE]);
      confirm({ type: 'alert', title: 'Salvo', message: 'Resultado salvo no histórico anônimo.' });
    }
    setMmsePhase('setup');
    setMmsePoints(new Set());
  };

  // FSS Logic
  const fssHistory = useMemo(() => {
    return selectedPatientName 
      ? (patientMetadata[selectedPatientName]?.fssHistory || []) 
      : anonymousFSS;
  }, [selectedPatientName, patientMetadata, anonymousFSS]);

  const fssChartData = useMemo(() => {
    return [...fssHistory].reverse().map(r => ({
      date: r.date.split('-').reverse().slice(0, 2).join('/'),
      score: r.averageScore
    }));
  }, [fssHistory]);

  const updateFSSScore = (index: number, val: number) => {
    const next = [...fssScores];
    next[index] = val;
    setFssScores(next);
  };

  const saveFSS = () => {
    const total = fssScores.reduce((a, b) => a + b, 0);
    const avg = total / 9;
    const interpretation = avg >= 4 ? 'Fadiga Relevante' : 'Normal';

    const newRecord: FSSRecord = {
      id: `fss-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      scores: [...fssScores],
      totalScore: total,
      averageScore: avg,
      interpretation
    };

    if (selectedPatientName) {
      const currentMeta = patientMetadata[selectedPatientName] || { tags: [] };
      setPatientMetadata({
        ...patientMetadata,
        [selectedPatientName]: { ...currentMeta, fssHistory: [newRecord, ...(currentMeta.fssHistory || [])] }
      });
      confirm({ type: 'alert', title: 'FSS Salvo', message: `Média: ${avg.toFixed(2)}. Interpretação: ${interpretation}.` });
    } else {
      setAnonymousFSS([newRecord, ...anonymousFSS]);
      confirm({ type: 'alert', title: 'Salvo', message: 'Resultado salvo no histórico anônimo.' });
    }
    setFssPhase('setup');
    setFssScores(new Array(9).fill(1));
  };

  // chartColors used locally within the component
  const chartColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Novas Escalas Neurológicas</h2>
          <p className="text-indigo-600 font-black uppercase text-[11px] tracking-widest mt-1">{targetPatient}</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('sloan')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'sloan' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400'}`}>Teste de Sloan</button>
          <button onClick={() => setActiveTab('snellen')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'snellen' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400'}`}>Snellen</button>
          <button onClick={() => setActiveTab('sdmt')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'sdmt' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400'}`}>TSD Digital</button>
          <button onClick={() => setActiveTab('mmse')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'mmse' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400'}`}>Mini-Mental</button>
          <button onClick={() => setActiveTab('fss')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'fss' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400'}`}>FSS - Fadiga</button>
        </div>
      </header>

      {activeTab === 'sloan' ? (
        <div className="space-y-8">
          {sloanPhase === 'calibration' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="space-y-8">
                <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                    <i className="fa-solid fa-eye-low-vision text-indigo-600"></i> Teste de Sloan (LCLA)
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-medium text-slate-600 mb-4 uppercase tracking-tight">1. Calibração (Padronização por Cartão):</p>
                      <p className="text-[10px] text-slate-400 mb-4 uppercase font-bold">Ajuste o slider abaixo usando um cartão de crédito real como referência física para garantir tamanhos precisos em qualquer dispositivo.</p>
                      <div className="flex justify-center py-8 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="bg-slate-300 rounded-xl flex items-center justify-center text-slate-500 border border-slate-400 relative shadow-inner" style={{ width: `${sloanCalibrationPx}px`, height: `${sloanCalibrationPx * 0.63}px` }}>
                          <i className="fa-solid fa-credit-card text-4xl opacity-50"></i>
                          <span className="absolute -bottom-6 text-[8px] font-black uppercase text-slate-400">Padrão ISO: 85.6mm</span>
                        </div>
                      </div>
                      <input type="range" min="150" max="800" className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-10" value={sloanCalibrationPx} onChange={e => setSloanCalibrationPx(Number(e.target.value))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Distância do Teste</label>
                        <select value={sloanDistance} onChange={e => setSloanDistance(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 border-none font-black text-xs text-indigo-600 uppercase outline-none">
                          <option value="40cm">40 cm (Perto)</option>
                          <option value="50cm">50 cm</option>
                          <option value="1m">1 Metro</option>
                          <option value="2m">2 Metros (Padrão)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Nível de Contraste</label>
                        <select value={sloanContrast} onChange={e => setSloanContrast(Number(e.target.value))} className="w-full p-3 rounded-xl bg-slate-50 border-none font-black text-xs text-indigo-600 uppercase outline-none">
                          <option value="100">100% (Alto Contraste)</option>
                          <option value="2.5">2,5% (Padrão EM)</option>
                          <option value="1.25">1,25% (Padrão EM)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                       <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Olho Avaliado</label>
                       <div className="flex bg-slate-50 p-1 rounded-xl">
                          {['OD', 'OE', 'OU'].map(e => (
                            <button key={e} onClick={() => setSloanEye(e as any)} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${sloanEye === e ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>{e === 'OU' ? 'AO' : e}</button>
                          ))}
                       </div>
                    </div>
                    <button onClick={startSloanTest} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                      <i className="fa-solid fa-play"></i> Iniciar Teste (Máx 70 Letras)
                    </button>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                  <div className="flex justify-between items-center mb-6 px-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <i className="fa-solid fa-chart-line text-indigo-600"></i> Evolução de Acertos
                    </h4>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sloanChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 70]} tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} unit=" pts" />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                        <Line type="monotone" dataKey="OD" stroke="#3b82f6" strokeWidth={3} dot={{ r: 6, fill: '#3b82f6' }} connectNulls />
                        <Line type="monotone" dataKey="OE" stroke="#10b981" strokeWidth={3} dot={{ r: 6, fill: '#10b981' }} connectNulls />
                        <Line type="monotone" dataKey="AO" stroke="#6366f1" strokeWidth={3} dot={{ r: 6, fill: '#6366f1' }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-8 bg-slate-50 border-b border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Histórico de Performance (Letras Lidas)</h4>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Data</th>
                        <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase text-center border-x border-slate-50">OD</th>
                        <th className="px-8 py-5 text-[10px] font-black text-emerald-600 uppercase text-center border-r border-slate-50">OE</th>
                        <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase text-center">AO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sloanGroupedHistory.map(row => (
                        <tr key={row.date} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-5 text-xs font-bold text-slate-600">{row.date.split('-').reverse().join('/')}</td>
                          <td className="px-8 py-5 text-center font-black text-slate-800 border-x border-slate-50 relative">
                            {row.OD ?? '-'}
                            {row.worsening?.OD && <span className="absolute top-1 right-1 text-red-500 text-[8px] animate-pulse"><i className="fa-solid fa-triangle-exclamation"></i></span>}
                          </td>
                          <td className="px-8 py-5 text-center font-black text-slate-800 border-r border-slate-50 relative">
                            {row.OE ?? '-'}
                            {row.worsening?.OE && <span className="absolute top-1 right-1 text-red-500 text-[8px] animate-pulse"><i className="fa-solid fa-triangle-exclamation"></i></span>}
                          </td>
                          <td className="px-8 py-5 text-center font-black text-indigo-600 bg-indigo-50/20 relative">
                            {row.AO ?? '-'}
                            {row.worsening?.AO && <span className="absolute top-1 right-1 text-red-500 text-[8px] animate-pulse"><i className="fa-solid fa-triangle-exclamation"></i></span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {sloanPhase === 'test' && (
            <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-10 overflow-hidden">
              <div className="text-center space-y-20 w-full max-w-5xl">
                <div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-12 animate-pulse">Linha {sloanCurrentLine + 1} de 14 • Contraste {sloanContrast}% • {sloanDistance}</p>
                  <div className="flex gap-16 items-center justify-center">
                    {sloanTestLetters.slice(sloanCurrentLine * 5, (sloanCurrentLine * 5) + 5).map((char, idx) => (
                      <span key={idx} className={`font-black transition-all duration-300 ${idx === sloanCurrentLetterInLine ? 'scale-125' : 'opacity-0'}`} style={{ fontSize: `${sloanCurrentLine < SLOAN_SIZES_MM_1M.length ? SLOAN_SIZES_MM_1M[sloanCurrentLine] * (sloanDistance === '2m' ? 2 : 1) * (sloanCalibrationPx / 85.6) : 20}px`, color: `rgba(0,0,0,${sloanContrast / 100})`, fontFamily: 'serif' }}>{char}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-6 w-full max-w-2xl mx-auto">
                  <button onClick={handleSloanMiss} className="flex-1 py-12 bg-red-50 text-red-600 rounded-[40px] border-4 border-red-100 flex flex-col items-center justify-center gap-3 hover:bg-red-100 transition-all active:scale-95">
                    <i className="fa-solid fa-xmark text-4xl"></i>
                    <span className="font-black uppercase text-xs tracking-widest">ERRO ({sloanErrors}/3)</span>
                  </button>
                  <button onClick={() => { setSloanLettersCorrect(prev => prev + 1); advanceSloan(); }} className="flex-1 py-12 bg-emerald-50 text-emerald-600 rounded-[40px] border-4 border-emerald-100 flex flex-col items-center justify-center gap-3 hover:bg-emerald-100 transition-all active:scale-95">
                    <i className="fa-solid fa-check text-4xl"></i>
                    <span className="font-black uppercase text-xs tracking-widest">ACERTO ({sloanLettersCorrect})</span>
                  </button>
                </div>
              </div>
              <button onClick={() => setSloanPhase('calibration')} className="absolute top-10 left-10 text-slate-300 hover:text-slate-500 font-black uppercase text-[10px] flex items-center gap-2"><i className="fa-solid fa-times"></i> Cancelar Teste</button>
            </div>
          )}
          {sloanPhase === 'summary' && (
            <div className="bg-white p-16 rounded-[60px] border border-slate-200 shadow-2xl text-center space-y-12 max-w-2xl mx-auto animate-in zoom-in-95">
              <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto text-4xl shadow-inner animate-bounce ${lastWorseningDetected ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                <i className={`fa-solid ${lastWorseningDetected ? 'fa-triangle-exclamation' : 'fa-flag-checkered'}`}></i>
              </div>
              <div>
                <h4 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Avaliação Finalizada</h4>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Olho {sloanEye === 'OU' ? 'AO' : sloanEye} • {sloanDistance} • Contraste {sloanContrast}%</p>
                {lastWorseningDetected && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl animate-pulse">
                    <p className="text-red-600 font-black text-[10px] uppercase tracking-widest">ALERTA: PIORA CLINICAMENTE SIGNIFICATIVA (≈7 LETRAS)</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-8 py-10 border-y border-slate-100">
                <div><p className="text-6xl font-black text-indigo-600">{sloanLettersCorrect}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Letras Lidas (Máx 70)</p></div>
                <div><p className="text-6xl font-black text-red-400">{sloanErrors}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Erros</p></div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setSloanPhase('calibration')} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase text-xs hover:bg-slate-200 transition-all">Descartar</button>
                <button onClick={saveSloan} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Salvar no Histórico</button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'snellen' ? (
        <div className="space-y-8">
          {snellenPhase === 'calibration' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <div className="space-y-8">
                <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                    <i className="fa-solid fa-eye text-indigo-600"></i> Snellen Digital
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-medium text-slate-600 mb-4 uppercase tracking-tight">1. Calibração (Padronização por Cartão):</p>
                      <p className="text-[10px] text-slate-400 mb-4 uppercase font-bold">Ajuste o slider abaixo usando um cartão de crédito real como referência física.</p>
                      <div className="flex justify-center py-8 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="bg-slate-300 rounded-xl flex items-center justify-center text-slate-500 border border-slate-400 relative shadow-inner" style={{ width: `${snellenCalibrationPx}px`, height: `${snellenCalibrationPx * 0.63}px` }}>
                          <i className="fa-solid fa-credit-card text-4xl opacity-50"></i>
                        </div>
                      </div>
                      <input type="range" min="150" max="800" className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-10" value={snellenCalibrationPx} onChange={e => setSnellenCalibrationPx(Number(e.target.value))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Distância Real</label>
                        <select value={snellenDistance} onChange={e => setSnellenDistance(e.target.value as any)} className="w-full p-3 rounded-xl bg-slate-50 border-none font-black text-xs text-indigo-600 uppercase outline-none">
                          <option value="50cm">50 cm</option>
                          <option value="1m">1 Metro</option>
                          <option value="2m">2 Metros</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block">Olho Avaliado</label>
                        <div className="flex bg-slate-50 p-1 rounded-xl">
                          {['OD', 'OE', 'OU'].map(e => (
                            <button key={e} onClick={() => setSnellenEye(e as any)} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${snellenEye === e ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>{e === 'OU' ? 'AO' : e}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button onClick={startSnellenTest} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                      <i className="fa-solid fa-play"></i> Iniciar Teste de Acuidade
                    </button>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm h-64">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6">Evolução Acuidade</h4>
                    <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={snellenChartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                                <YAxis tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                                <Tooltip />
                                <Line type="monotone" dataKey="val" stroke="#4f46e5" strokeWidth={3} dot={{ r: 6, fill: '#4f46e5' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
              </div>
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-8 bg-slate-50 border-b border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Histórico de Acuidade Visual</h4>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Data</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Olho</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Acuidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {snellenHistory.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-5 text-xs font-bold text-slate-600">{row.date.split('-').reverse().join('/')}</td>
                          <td className="px-8 py-5 text-center font-black text-slate-800 uppercase">{row.eye === 'OU' ? 'AO' : row.eye}</td>
                          <td className="px-8 py-5 text-center font-black text-indigo-600">{row.acuity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {snellenPhase === 'test' && (
            <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-10 overflow-hidden">
              <div className="text-center space-y-20 w-full max-w-5xl">
                <div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-12 animate-pulse">Linha {SNELLEN_LINES[snellenCurrentLineIdx].label} • Distância {snellenDistance}</p>
                  <div className="flex gap-16 items-center justify-center">
                    <span className="font-black" style={{ 
                        fontSize: `${
                            (snellenDistance === '50cm' ? SNELLEN_LINES[snellenCurrentLineIdx].size50cm :
                             snellenDistance === '1m' ? SNELLEN_LINES[snellenCurrentLineIdx].size1m :
                             SNELLEN_LINES[snellenCurrentLineIdx].size2m) * (snellenCalibrationPx / 85.6)
                        }px`, 
                        fontFamily: 'serif' 
                    }}>
                        {snellenTestLetters[snellenCurrentLineIdx * 5 + snellenCurrentLetterIdx]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-6 w-full max-w-2xl mx-auto">
                  <button onClick={handleSnellenMiss} className="flex-1 py-12 bg-red-50 text-red-600 rounded-[40px] border-4 border-red-100 flex flex-col items-center justify-center gap-3 hover:bg-red-100 transition-all active:scale-95">
                    <i className="fa-solid fa-xmark text-4xl"></i>
                    <span className="font-black uppercase text-xs tracking-widest">ERRO ({snellenErrors}/3)</span>
                  </button>
                  <button onClick={handleSnellenHit} className="flex-1 py-12 bg-emerald-50 text-emerald-600 rounded-[40px] border-4 border-emerald-100 flex flex-col items-center justify-center gap-3 hover:bg-emerald-100 transition-all active:scale-95">
                    <i className="fa-solid fa-check text-4xl"></i>
                    <span className="font-black uppercase text-xs tracking-widest">ACERTO</span>
                  </button>
                </div>
              </div>
              <button onClick={() => setSnellenPhase('calibration')} className="absolute top-10 left-10 text-slate-300 hover:text-slate-500 font-black uppercase text-[10px] flex items-center gap-2"><i className="fa-solid fa-times"></i> Cancelar</button>
            </div>
          )}
          {snellenPhase === 'summary' && (
            <div className="bg-white p-16 rounded-[60px] border border-slate-200 shadow-2xl text-center space-y-12 max-w-2xl mx-auto animate-in zoom-in-95">
              <div className="w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto text-4xl shadow-inner animate-bounce bg-indigo-50 text-indigo-600">
                <i className="fa-solid fa-flag-checkered"></i>
              </div>
              <div>
                <h4 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Acuidade Alcançada</h4>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Olho {snellenEye === 'OU' ? 'AO' : snellenEye} • {snellenDistance}</p>
              </div>
              <div className="py-10 border-y border-slate-100">
                <p className="text-7xl font-black text-indigo-600">{lastSnellenAcuity}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Escala de Snellen</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setSnellenPhase('calibration')} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase text-xs hover:bg-slate-200 transition-all">Descartar</button>
                <button onClick={saveSnellen} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Salvar no Histórico</button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'sdmt' ? (
        <div className="space-y-8">
          {sdmtPhase === 'setup' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in duration-500">
              <div className="space-y-8">
                <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                    <i className="fa-solid fa-square-poll-vertical text-indigo-600"></i> TSD Digital
                  </h3>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase tracking-tight">O teste de Tarefa Símbolo-Dígito (TSD) avalia a velocidade de processamento cognitivo. O paciente deve associar o símbolo central ao número correspondente no mapa superior o mais rápido possível durante 120 segundos.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <button onClick={() => startSDMTRun(true)} className="w-full py-5 bg-white border-2 border-indigo-100 text-indigo-600 rounded-3xl font-black uppercase shadow-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                      <i className="fa-solid fa-graduation-cap"></i> Modo Prática (15s)
                    </button>
                    <button onClick={() => startSDMTRun(false)} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                      <i className="fa-solid fa-play"></i> Iniciar Teste Oficial (120s)
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><i className="fa-solid fa-chart-line text-indigo-500"></i> Evolução de Score TSD</h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sdmtChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} unit=" pts" />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                        <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-8 bg-slate-50 border-b border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Histórico de Performance TSD</h4>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Data</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Acertos</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Precisão</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Curva (30s)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sdmtHistory.sort((a,b) => b.date.localeCompare(a.date)).map(record => (
                        <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-5 text-xs font-bold text-slate-600">{record.date.split('-').reverse().join('/')}</td>
                          <td className="px-8 py-5 text-center font-black text-slate-800 relative">
                            {record.correct}
                            {record.significantWorsening && <span className="absolute top-1 right-1 text-red-600 text-[8px] animate-pulse" title="Mudança Clinicamente Significativa (≥8 pts)"><i className="fa-solid fa-triangle-exclamation"></i></span>}
                            {!record.significantWorsening && record.worsening && <span className="absolute top-1 right-1 text-amber-500 text-[8px]" title="Piora Progressiva (≥4 pts)"><i className="fa-solid fa-circle-exclamation"></i></span>}
                          </td>
                          <td className="px-8 py-5 text-center font-black text-indigo-600">{record.accuracy.toFixed(1)}%</td>
                          <td className="px-8 py-5">
                             <div className="flex justify-center gap-1">
                               {record.bins.map((b, i) => (
                                 <div key={i} className="w-4 bg-indigo-100 rounded-sm relative" style={{ height: '20px' }}>
                                    <div className="absolute bottom-0 left-0 w-full bg-indigo-500 rounded-sm" style={{ height: `${(b / Math.max(...record.bins, 1)) * 100}%` }}></div>
                                 </div>
                               ))}
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {(sdmtPhase === 'practice' || sdmtPhase === 'test') && (
            <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-between p-10 select-none">
              <div className="w-full max-w-5xl flex justify-between items-center mb-10">
                 <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-xl shadow-indigo-100">
                       <span className="text-[10px] font-black uppercase">Tempo</span>
                       <span className="text-3xl font-black">{sdmtTimer}s</span>
                    </div>
                    <div>
                       <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">{sdmtPhase === 'practice' ? 'Fase de Prática' : 'Teste TSD Oficial'}</h3>
                       <p className="text-[10px] text-indigo-500 font-bold uppercase mt-1">Toque no número correspondente ao símbolo central</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Atual</p>
                    <p className="text-4xl font-black text-slate-800">{sdmtCorrect}</p>
                 </div>
              </div>

              <div className="w-full max-w-5xl space-y-12">
                 {/* Mapeamento superior */}
                 <div className="grid grid-cols-9 gap-4">
                    {sdmtMapping.map((pair, idx) => (
                      <div key={idx} className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm">
                         <span className="text-4xl leading-none font-black text-slate-800">{pair.glyph}</span>
                         <div className="w-full h-px bg-slate-200"></div>
                         <span className="text-lg font-black text-indigo-600">{pair.digit}</span>
                      </div>
                    ))}
                 </div>

                 {/* Estímulo Central */}
                 <div className="flex justify-center">
                    <div className="w-64 h-64 bg-white border-4 border-indigo-600 rounded-[60px] flex items-center justify-center shadow-2xl animate-in zoom-in-50 duration-200">
                       <span className="text-9xl font-black text-slate-800 leading-none">{sdmtCurrent?.glyph}</span>
                    </div>
                 </div>

                 {/* Teclado Numérico */}
                 <div className="grid grid-cols-9 gap-4 max-w-4xl mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <button 
                        key={num}
                        onClick={() => registerSDMTAnswer(num)}
                        className="aspect-square rounded-[32px] bg-slate-50 border-2 border-slate-200 text-3xl font-black text-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:scale-105 active:scale-95 transition-all shadow-sm"
                      >
                        {num}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="mt-10">
                 <button onClick={cancelSDMTRun} className="text-slate-300 hover:text-red-500 font-black uppercase text-[10px] transition-colors"><i className="fa-solid fa-times mr-2"></i> Sair sem concluir</button>
              </div>
            </div>
          )}

          {sdmtPhase === 'summary' && (
            <div className="bg-white p-16 rounded-[60px] border border-slate-200 shadow-2xl text-center space-y-12 max-w-4xl mx-auto animate-in zoom-in-95">
              <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto text-4xl shadow-inner animate-bounce ${lastSdmtSignificant ? 'bg-red-50 text-red-600' : lastSdmtWorsening ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                <i className={`fa-solid ${lastSdmtSignificant ? 'fa-triangle-exclamation' : lastSdmtWorsening ? 'fa-circle-exclamation' : 'fa-check-double'}`}></i>
              </div>
              <div>
                <h4 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Resultados TSD Digital</h4>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Avaliação de Velocidade de Processamento Cognitivo</p>
                {lastSdmtSignificant ? (
                  <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl animate-pulse">
                    <p className="text-red-600 font-black text-[10px] uppercase tracking-widest">ALERTA: PIORA CLINICAMENTE SIGNIFICATIVA (≥8 PONTOS)</p>
                  </div>
                ) : lastSdmtWorsening ? (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <p className="text-amber-600 font-black text-[10px] uppercase tracking-widest">AVISO: PIORA PROGRESSIVA (≥4 PONTOS)</p>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-10 border-y border-slate-100">
                <div className="text-center">
                  <p className="text-6xl font-black text-indigo-600">{sdmtCorrect}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Acertos Totais</p>
                </div>
                <div className="text-center">
                  <p className="text-6xl font-black text-slate-800">{sdmtAttempts}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Itens Tentados</p>
                </div>
                <div className="text-center">
                  <p className="text-6xl font-black text-emerald-500">{((sdmtCorrect / Math.max(sdmtAttempts, 1)) * 100).toFixed(0)}%</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Precisão</p>
                </div>
              </div>

              <div className="space-y-6">
                 <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distribuição por Blocos (30s)</h5>
                 <div className="h-48 w-full max-w-md mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sdmtBins.map((val, idx) => ({ name: `${idx * 30}-${(idx + 1) * 30}s`, val }))}>
                        <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip cursor={{fill: 'transparent'}} />
                        <Bar dataKey="val" radius={[8, 8, 0, 0]}>
                           {sdmtBins.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setSdmtPhase('setup')} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase text-xs hover:bg-slate-200 transition-all">Descartar</button>
                <button onClick={saveSDMT} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Salvar no Histórico Permanente</button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'mmse' ? (
        // UI DO MINI-MENTAL (MEEM)
        <div className="space-y-8">
          {mmsePhase === 'setup' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in duration-500">
               <div className="space-y-8">
                 <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                     <i className="fa-solid fa-brain text-indigo-600"></i> Mini-Mental (MEEM)
                   </h3>
                   
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Escolaridade do Paciente</label>
                      <select 
                        className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-xs uppercase outline-none"
                        value={mmseSchooling}
                        onChange={e => setMmseSchooling(e.target.value)}
                      >
                         <option value="Analfabeto">Analfabeto</option>
                         <option value="1-4 anos">1 a 4 anos (Baixa)</option>
                         <option value="5-8 anos">5 a 8 anos (Média)</option>
                         <option value="9-11 anos">9 a 11 anos (Alta)</option>
                         <option value="Superior">Superior (11 anos)</option>
                      </select>
                      <p className="text-[9px] text-slate-400 font-bold uppercase italic">* O ponto de corte será ajustado automaticamente.</p>
                   </div>

                   <button onClick={() => setMmsePhase('test')} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                     <i className="fa-solid fa-check-to-slot"></i> Iniciar Avaliação (Checklist)
                   </button>
                 </div>

                 <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                   <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><i className="fa-solid fa-chart-line text-indigo-500"></i> Evolução Cognitiva MEEM</h4>
                   <div className="h-64 w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={mmseChartData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                         <XAxis dataKey="date" tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                         <YAxis domain={[0, 30]} tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} unit=" pts" />
                         <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                         <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5' }} />
                       </LineChart>
                     </ResponsiveContainer>
                   </div>
                 </div>
               </div>

               <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-8 bg-slate-50 border-b border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Histórico de Performance MEEM</h4>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Data</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Score</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Escolaridade</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {mmseHistory.sort((a,b) => b.date.localeCompare(a.date)).map(record => (
                        <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-5 text-xs font-bold text-slate-600">{record.date.split('-').reverse().join('/')}</td>
                          <td className="px-8 py-5 text-center font-black text-slate-800">{record.score}/30</td>
                          <td className="px-8 py-5 text-center text-[10px] font-bold text-slate-400 uppercase">{record.schooling}</td>
                          <td className="px-8 py-5 text-center">
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${record.interpretation === 'Normal' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                              {record.interpretation}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {mmseHistory.length === 0 && (
                        <tr><td colSpan={4} className="p-20 text-center text-slate-300 italic text-[10px] font-black uppercase tracking-widest">Sem registros</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {mmsePhase === 'test' && (
            <div className="fixed inset-0 z-[200] bg-white flex flex-col p-10 overflow-hidden">
               <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
                  <div className="flex justify-between items-center mb-10">
                     <div>
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">MEEM: Checklist de Pontuação</h3>
                        <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-1">Marque os itens que o paciente acertou</p>
                     </div>
                     <div className="bg-indigo-600 text-white px-8 py-4 rounded-3xl shadow-xl flex flex-col items-center">
                        <span className="text-[9px] font-black uppercase tracking-widest">Total Atual</span>
                        <span className="text-3xl font-black">{mmsePoints.size}/30</span>
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-4 no-scrollbar space-y-8 pb-20">
                     {Array.from(new Set(MMSE_ITEMS.map(i => i.cat))).map(category => (
                        <div key={category} className="space-y-4">
                           <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">{category}</h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {MMSE_ITEMS.filter(i => i.cat === category).map(item => (
                                 <div key={item.id} className="flex flex-col gap-2">
                                    <button 
                                       onClick={() => toggleMMSEPoint(item.id)}
                                       className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between text-left group ${mmsePoints.has(item.id) ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                                    >
                                       <span className={`text-[11px] font-bold uppercase leading-tight ${mmsePoints.has(item.id) ? 'text-indigo-900' : 'text-slate-500'}`}>{item.label}</span>
                                       <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${mmsePoints.has(item.id) ? 'bg-indigo-600 text-white' : 'bg-white border-2 border-slate-200'}`}>
                                          {mmsePoints.has(item.id) && <i className="fa-solid fa-check text-[10px]"></i>}
                                       </div>
                                    </button>
                                    {item.id === 'read' && (
                                       <div onClick={() => setMmseFullscreen('read')} className="p-10 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-inner cursor-pointer hover:bg-slate-50 transition-colors">
                                          <span className="text-6xl font-black text-slate-800 uppercase tracking-tighter text-center">FECHE OS OLHOS</span>
                                       </div>
                                    )}
                                    {item.id === 'copy' && (
                                       <div onClick={() => setMmseFullscreen('copy')} className="p-6 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-inner cursor-pointer hover:bg-slate-50 transition-colors">
                                          <svg width="180" height="120" viewBox="0 0 180 120" className="text-slate-800">
                                             <polygon points="30,40 50,20 80,20 100,40 90,70 40,70" fill="none" stroke="currentColor" strokeWidth="2" />
                                             <polygon points="85,50 105,30 135,30 155,50 145,80 95,80" fill="none" stroke="currentColor" strokeWidth="2" />
                                          </svg>
                                       </div>
                                    )}
                                 </div>
                              ))}
                           </div>
                        </div>
                     ))}
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex gap-4">
                     <button onClick={() => setMmsePhase('setup')} className="flex-1 py-5 text-slate-300 font-black uppercase text-[10px]">Cancelar</button>
                     <button onClick={() => setMmsePhase('summary')} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-700">Ver Resumo e Interpretação</button>
                  </div>
               </div>

               {mmseFullscreen && (
                 <div className="fixed inset-0 z-[300] bg-white flex flex-col items-center justify-center p-10 select-none animate-in fade-in duration-200">
                    <button onClick={() => setMmseFullscreen(null)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-500 font-black uppercase text-[10px] flex items-center gap-2">
                      <i className="fa-solid fa-times"></i> Fechar Tela Cheia
                    </button>
                    {mmseFullscreen === 'read' ? (
                       <span className="text-9xl font-black text-slate-800 uppercase tracking-tighter text-center px-10">FECHE OS OLHOS</span>
                    ) : (
                       <svg width="80%" height="60%" viewBox="0 0 180 120" className="text-slate-800 max-w-5xl">
                          <polygon points="30,40 50,20 80,20 100,40 90,70 40,70" fill="none" stroke="currentColor" strokeWidth="2" />
                          <polygon points="85,50 105,30 135,30 155,50 145,80 95,80" fill="none" stroke="currentColor" strokeWidth="2" />
                       </svg>
                    )}
                 </div>
               )}
            </div>
          )}

          {mmsePhase === 'summary' && (
             <div className="bg-white p-16 rounded-[60px] border border-slate-200 shadow-2xl text-center space-y-12 max-w-2xl mx-auto animate-in zoom-in-95">
                <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto text-4xl shadow-inner animate-bounce ${getMMSEInterpretation(mmsePoints.size, mmseSchooling) === 'Normal' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                   <i className={`fa-solid ${getMMSEInterpretation(mmsePoints.size, mmseSchooling) === 'Normal' ? 'fa-face-smile' : 'fa-triangle-exclamation'}`}></i>
                </div>
                <div>
                   <h4 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Resultado MEEM</h4>
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Baseado em Escolaridade: {mmseSchooling}</p>
                </div>

                <div className="grid grid-cols-2 gap-8 py-10 border-y border-slate-100">
                   <div>
                      <p className="text-6xl font-black text-indigo-600">{mmsePoints.size}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Pontos (Máx 30)</p>
                   </div>
                   <div className="flex flex-col items-center justify-center">
                      <span className={`px-6 py-2 rounded-full text-sm font-black uppercase tracking-tighter ${getMMSEInterpretation(mmsePoints.size, mmseSchooling) === 'Normal' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                         {getMMSEInterpretation(mmsePoints.size, mmseSchooling)}
                      </span>
                      <p className="text-[9px] font-black text-slate-300 uppercase mt-2">Classificação Clínica</p>
                   </div>
                </div>

                <div className="flex gap-4">
                   <button onClick={() => setMmsePhase('test')} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase text-xs hover:bg-slate-200 transition-all">Revisar Pontos</button>
                   <button onClick={saveMMSE} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Salvar em Prontuário</button>
                </div>
             </div>
          )}
        </div>
      ) : (
        // NOVO: UI DA ESCALA FSS (FADIGA)
        <div className="space-y-8">
          {fssPhase === 'setup' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in duration-500">
              <div className="space-y-8">
                <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                    <i className="fa-solid fa-battery-half text-indigo-600"></i> Fatigue Severity Scale (FSS)
                  </h3>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <p className="text-xs font-bold text-slate-600 leading-relaxed uppercase tracking-tight">Escala de 9 itens para avaliar a severidade da fadiga e seu impacto na vida diária. Cada item pontua de 1 (Discordo Totalmente) a 7 (Concordo Totalmente).</p>
                  </div>
                  <button onClick={() => setFssPhase('test')} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                    <i className="fa-solid fa-play"></i> Iniciar Avaliação FSS
                  </button>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><i className="fa-solid fa-chart-line text-indigo-500"></i> Evolução FSS (Média)</h4>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={fssChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                        <YAxis domain={[1, 7]} tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} unit=" pts" />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                        <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-8 bg-slate-50 border-b border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Histórico de Fadiga FSS</h4>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Data</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Soma</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Média</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {fssHistory.sort((a,b) => b.date.localeCompare(a.date)).map(record => (
                        <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-5 text-xs font-bold text-slate-600">{record.date.split('-').reverse().join('/')}</td>
                          <td className="px-8 py-5 text-center font-black text-slate-800">{record.totalScore}</td>
                          <td className="px-8 py-5 text-center font-black text-indigo-600">{record.averageScore.toFixed(2)}</td>
                          <td className="px-8 py-5 text-center">
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${record.interpretation === 'Normal' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                              {record.interpretation}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {fssHistory.length === 0 && (
                        <tr><td colSpan={4} className="p-20 text-center text-slate-300 italic text-[10px] font-black uppercase tracking-widest">Sem registros</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {fssPhase === 'test' && (
            <div className="fixed inset-0 z-[200] bg-white flex flex-col p-10 overflow-hidden">
              <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">FSS: Avaliação de Fadiga</h3>
                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-1">Selecione de 1 (Discordo) a 7 (Concordo) para cada item</p>
                  </div>
                  <div className="bg-indigo-600 text-white px-8 py-4 rounded-3xl shadow-xl flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest">Média Atual</span>
                    <span className="text-3xl font-black">{(fssScores.reduce((a,b)=>a+b,0)/9).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-4 no-scrollbar space-y-4 pb-20">
                  {FSS_ITEMS.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 p-6 rounded-[32px] border border-slate-200 space-y-4 transition-all">
                      <p className="text-xs font-black text-slate-700 uppercase tracking-tight leading-relaxed">{idx + 1}. {item}</p>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Discordo</span>
                        <div className="flex-1 flex justify-around">
                          {[1, 2, 3, 4, 5, 6, 7].map(num => (
                            <button 
                              key={num}
                              onClick={() => updateFSSScore(idx, num)}
                              className={`w-10 h-10 rounded-xl font-black text-xs transition-all border-2 ${fssScores[idx] === num ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-110' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-200'}`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                        <span className="text-[8px] font-black text-slate-400 uppercase">Concordo</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-slate-100 flex gap-4">
                  <button onClick={() => setFssPhase('setup')} className="flex-1 py-5 text-slate-300 font-black uppercase text-[10px]">Cancelar</button>
                  <button onClick={() => setFssPhase('summary')} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-700">Ver Resultado</button>
                </div>
              </div>
            </div>
          )}

          {fssPhase === 'summary' && (
            <div className="bg-white p-16 rounded-[60px] border border-slate-200 shadow-2xl text-center space-y-12 max-w-2xl mx-auto animate-in zoom-in-95">
              <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto text-4xl shadow-inner animate-bounce ${(fssScores.reduce((a,b)=>a+b,0)/9) >= 4 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <i className={`fa-solid ${(fssScores.reduce((a,b)=>a+b,0)/9) >= 4 ? 'fa-battery-empty' : 'fa-battery-full'}`}></i>
              </div>
              <div>
                <h4 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Resultado FSS</h4>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Avaliação de Severidade de Fadiga</p>
              </div>

              <div className="grid grid-cols-2 gap-8 py-10 border-y border-slate-100">
                <div>
                  <p className="text-6xl font-black text-indigo-600">{(fssScores.reduce((a,b)=>a+b,0)/9).toFixed(2)}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Média (Corte: 4.0)</p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <span className={`px-6 py-2 rounded-full text-sm font-black uppercase tracking-tighter ${(fssScores.reduce((a,b)=>a+b,0)/9) >= 4 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {(fssScores.reduce((a,b)=>a+b,0)/9) >= 4 ? 'Fadiga Relevante' : 'Normal'}
                  </span>
                  <p className="text-[9px] font-black text-slate-300 uppercase mt-2">Classificação Clínica</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setFssPhase('test')} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black uppercase text-xs hover:bg-slate-200 transition-all">Revisar Itens</button>
                <button onClick={saveFSS} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Salvar em Prontuário</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewScales;