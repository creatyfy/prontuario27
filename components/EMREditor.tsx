import React, { useState, useRef, useEffect, useMemo } from 'react';
import { formatMedicalRecord, finalizeTranscription, processDiagnosisFusion, generateMedicalDocument, processExamData, transcribeExamAudio, extractExamsFromFiles, generateReadbackText } from '../geminiService';
import { Appointment, ClinicConfig, PatientMetadata, PaymentMethod, ProcessedExamResult, EDSSRecord, NineHoleRecord, T25FWRecord, SloanContrastRecord } from '../types';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useConfirm } from '../ConfirmContext';

interface EMREditorProps {
  activePatientName?: string;
}

interface ResultSection {
  label: string;
  content: string;
}

const SLOAN_LETTERS = ['C', 'D', 'H', 'K', 'N', 'O', 'R', 'S', 'V', 'Z'];

const EMREditor: React.FC<EMREditorProps> = ({ activePatientName }) => {
  const confirm = useConfirm();
  const [transcription, setTranscription] = useState(() => localStorage.getItem('neuroclinic_temp_transcription') || '');
  const [livePreview, setLivePreview] = useState('');
  const [history, setHistory] = useState('');
  const [result, setResult] = useState(() => localStorage.getItem('neuroclinic_temp_result') || '');
  const [resultSections, setResultSections] = useState<ResultSection[]>(() => {
    const saved = localStorage.getItem('neuroclinic_temp_resultSections');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(activePatientName || null);
  const [activeRightTab, setActiveRightTab] = useState<'exames' | 'historico' | 'episodios' | 'arquivos' | 'transcricao' | 'teleconsulta' | 'escalas'>('historico');
  const [examsAlreadyTabulated, setExamsAlreadyTabulated] = useState(false);
  const [examSearchFilter, setExamSearchFilter] = useState('');
  
  const [globalAgenda, setGlobalAgenda] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem('neuroclinic_data');
    return saved ? JSON.parse(saved) : {};
  });
  const [globalMetadata, setGlobalMetadata] = useState<PatientMetadata>(() => {
    const saved = localStorage.getItem('neuroclinic_metadata');
    return saved ? JSON.parse(saved) : {};
  });
  const [clinicConfig, setClinicConfig] = useState<ClinicConfig | null>(() => {
    const saved = localStorage.getItem('neuroclinic_config');
    return saved ? JSON.parse(saved) : null;
  });

  const [recordingMode, setRecordingMode] = useState<'presencial' | 'teleconsulta'>('presencial');
  const [isRetorno, setIsRetorno] = useState(false);
  const [previousConsultationInfo, setPreviousConsultationInfo] = useState('');
  const [includeHDA, setIncludeHDA] = useState(false);
  const [includeROS, setIncludeROS] = useState(false);
  const [includeEM, setIncludeEM] = useState(false);
  const [includePhysical, setIncludePhysical] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'flash' | 'thinking' | 'pro'>('flash');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isContextSettingsOpen, setIsContextSettingsOpen] = useState(false);
  
  // Assistente de Documentos States
  const [docPrompt, setDocPrompt] = useState('');
  const [docFormat, setDocFormat] = useState('Markdown Rico');
  const [generatedDocs, setGeneratedDocs] = useState<string[]>([]);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [isTemplatesMenuOpen, setIsTemplatesMenuOpen] = useState(false);
  
  // NOVO: Estados para buscador de parceiros rápido
  const [isPartnerMenuOpen, setIsPartnerMenuOpen] = useState(false);
  const [partnerQuickSearch, setPartnerQuickSearch] = useState('');
  const [quickPartners, setQuickPartners] = useState<{specialists: any[], exams: any[]}>({specialists: [], exams: []});

  // Estados de Impressão
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [docToPrint, setDocToPrint] = useState<string | null>(null);
  const [printDateMode, setPrintDateMode] = useState<'none' | 'current' | 'multiple'>('current');
  const [printStartMonth, setPrintStartMonth] = useState(new Date().getMonth());
  const [printStartYear, setPrintStartYear] = useState(new Date().getFullYear());
  const [printMonthCount, setPrintMonthCount] = useState(1);
  const [printCopiesPerMonth, setPrintCopiesPerMonth] = useState(1);
  const [printCategory, setPrintCategory] = useState<string>('Receita');
  // Novos controles de estilo para impressão
  const [printFontSize, setPrintFontSize] = useState(16);
  const [printLineHeight, setPrintLineHeight] = useState(1.6);
  const [printIsBold, setPrintIsBold] = useState(false);
  const [printIsItalic, setPrintIsItalic] = useState(false);

  const [manualContext, setManualContext] = useState(() => localStorage.getItem('neuroclinic_temp_manualContext') || '');
  const [isContextFullscreen, setIsContextFullscreen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(clinicConfig?.transcriptionConfig?.templates[0]?.id || '');

  const [isNewConsultationMode, setIsNewConsultationMode] = useState(() => localStorage.getItem('neuroclinic_temp_isNewConsultMode') === 'true');
  const [newConsultationText, setNewConsultationText] = useState(() => localStorage.getItem('neuroclinic_temp_newConsultText') || '');
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutApt, setCheckoutApt] = useState<Appointment | null>(null);
  const [checkoutValue, setCheckoutValue] = useState('');
  const [checkoutPayment, setCheckoutPayment] = useState<PaymentMethod>('PIX');
  const [checkoutReturnMonth, setCheckoutReturnMonth] = useState('');
  const [checkoutReturnYear, setCheckoutReturnYear] = useState('');

  const [examInput, setExamInput] = useState(() => localStorage.getItem('neuroclinic_temp_examInput') || '');
  const [isProcessingExams, setIsProcessingExams] = useState(false);
  const [isDictatingExams, setIsDictatingExams] = useState(false);
  const [isTranscribingExam, setIsTranscribingExam] = useState(false);
  const [isExamChartVisible, setIsExamChartVisible] = useState(false);
  const [selectedChartMarkers, setSelectedChartMarkers] = useState<string[]>([]);
  const [patientExams, setPatientExams] = useState<Record<string, { laboratory: any[], complex: any[], historyTexts?: { id: string, date: string, text: string }[] }>>(() => {
    const saved = localStorage.getItem('neuroclinic_patient_exams');
    return saved ? JSON.parse(saved) : {};
  });

  const examRecorderRef = useRef<MediaRecorder | null>(null);
  const examChunksRef = useRef<Blob[]>([]);

  // Acompanhamento EM States
  const [selectedAcompanhamento, setSelectedAcompanhamento] = useState<'em' | null>(null);
  const [msFollowupData, setMsFollowupData] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem('neuroclinic_ms_followup');
    return saved ? JSON.parse(saved) : {};
  });

  // Atualizado para considerar livePreview durante a gravação
  const wordCount = useMemo(() => {
    const text = (transcription + " " + livePreview).trim();
    return text ? text.split(/\s+/).length : 0;
  }, [transcription, livePreview]);

  const [pastConsultations, setPastConsultations] = useState<{id: string, date: string, time: string, content: string, patientName?: string, paidValue?: string, paymentMethod?: string, returnDate?: string, category?: string}[]>(() => {
    const saved = localStorage.getItem('neuroclinic_past_consults');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedHistoryDoc, setSelectedHistoryDoc] = useState<{id: string, date: string, time: string, content: string, category?: string} | null>(null);
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string[]>(['Episódio Clínico']);

  const historyCategories = ['Episódio Clínico', 'Laudo', 'Receita', 'Encaminhamento', 'Pedido de Exame'];

  const yearsArr = useMemo(() => {
    const current = new Date().getFullYear();
    const arr = [];
    for (let i = 0; i <= 5; i++) arr.push((current + i).toString());
    return arr;
  }, []);

  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const [files, setFiles] = useState<{id: string, type: 'photo' | 'video' | 'file', url: string, name: string, date: string, extension?: string, mimeType?: string, isPatientUpload?: boolean, patientName?: string}[]>(() => {
    const saved = localStorage.getItem('neuroclinic_files');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecordingVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isPausedRecording, setIsPausedRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [audioMarkers, setAudioMarkers] = useState<number[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveSessionRef = useRef<any>(null);
  const activeLiveSessionRef = useRef<any>(null);

  const [diagnosisStatus, setDiagnosisStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [manualHypothesis, setManualHypothesis] = useState(() => localStorage.getItem('neuroclinic_temp_manualHypothesis') || '');
  const diagMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const diagChunksRef = useRef<Blob[]>([]);

  // Teleconsulta States
  const [teleStatus, setTeleStatus] = useState<'disconnected' | 'waiting' | 'connected'>('disconnected');
  const [teleMic, setTeleMic] = useState(true);
  const [teleCam, setTeleCam] = useState(true);
  const teleLocalVideoRef = useRef<HTMLVideoElement>(null);
  const teleRemoteStreamRef = useRef<MediaStream | null>(null);

  // Escalas States
  const [selectedScale, setSelectedScale] = useState<string | null>(null);
  const [selectedComparativeScales, setSelectedComparativeScales] = useState<string[]>([]);
  const [isEDSSChartVisible, setIsEDSSChartVisible] = useState(false);
  const [isEDSSHistoryVisible, setIsEDSSHistoryVisible] = useState(false);
  const [edssForm, setEdssForm] = useState({
    visual: 0, brainstem: 0, pyramidal: 0, cerebellar: 0, sensory: 0, bowel: 0, cerebral: 0, ambulation: '>=500_unrestricted'
  });

  // Novos estados para o Teste dos 9 Pinos
  const [nineHoleTrialTimes, setNineHoleTrialTimes] = useState({ rh1: 0, rh2: 0, lh1: 0, lh2: 0 });
  const [active9HPTTrial, setActive9HPTTrial] = useState<'rh1' | 'rh2' | 'lh1' | 'lh2' | null>(null);
  const [is9HPTTimerActive, setIs9HPTTimerActive] = useState(false);
  const [timerVal9HPT, setTimerVal9HPT] = useState(0);
  const timerRef9HPT = useRef<any>(null);
  const [is9HPTHistoryVisible, setIs9HPTHistoryVisible] = useState(false);
  const [is9HPTChartVisible, setIs9HPTChartVisible] = useState(false);

  // Novos estados para o Teste dos 25 Pés (T25FW)
  const [t25fwTrialTimes, setT25fwTrialTimes] = useState({ t1: 0, t2: 0 });
  const [activeT25FWTrial, setActiveT25FWTrial] = useState<'t1' | 't2' | null>(null);
  const [isT25FWTimerActive, setIsT25FWTimerActive] = useState(false);
  const [timerValT25FW, setTimerValT25FW] = useState(0);
  const timerRefT25FW = useRef<any>(null);
  const [isT25FWHistoryVisible, setIsT25FWHistoryVisible] = useState(false);
  const [isT25FWChartVisible, setIsT25FWChartVisible] = useState(false);

  // Novos estados para o Teste de Sloan (LCLA)
  const [sloanEye, setSloanEye] = useState<'OD' | 'OE' | 'OU'>('OU');
  const [sloanContrast] = useState(2.5); // 2.5% exactly as requested
  const [sloanCalibrationPx, setSloanCalibrationPx] = useState(250); // Width of credit card in px
  const [sloanDistance, setSloanDistance] = useState('40cm');
  const [sloanLettersCorrect, setSloanLettersCorrect] = useState(0);
  const [sloanErrors, setSloanErrors] = useState(0);
  const [sloanPhase, setSloanPhase] = useState<'calibration' | 'test' | 'summary'>('calibration');
  const [sloanCurrentLine, setSloanCurrentLine] = useState(0); // 0 to 9 (10 lines total)
  const [sloanCurrentLetterInLine, setSloanCurrentLetterInLine] = useState(0); // 0 to 4 (5 letters per line)
  const [sloanTestLetters, setSloanTestLetters] = useState<string[]>([]);
  const [isSloanFullScreen, setIsSloanFullScreen] = useState(false);
  const [isSloanHistoryVisible, setIsSloanHistoryVisible] = useState(false);
  const [isSloanChartVisible, setIsSloanChartVisible] = useState(false);

  // Novos estados para Salvamento com Menu de Categoria
  const [isSaveCategoryModalOpen, setIsSaveCategoryModalOpen] = useState(false);
  const [docPendingSave, setDocPendingSave] = useState<string | null>(null);

  // Estados para Extração de Arquivos (IA)
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isExtractingExams, setIsExtractingExams] = useState(false);
  const [extractedExamsResult, setExtractedExamsResult] = useState('');
  const [showExtractedModal, setShowExtractedModal] = useState(false);

  // Estados para Portal do Paciente
  const [isSharePortalModalOpen, setIsSharePortalModalOpen] = useState(false);
  const [shareExpiryHours, setShareExpiryHours] = useState(24);
  const [generatedPortalLink, setGeneratedPortalLink] = useState('');
  const [isEvolutionFullscreen, setIsEvolutionFullscreen] = useState(false);
  const newConsultationTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEvolutionFullscreen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const currentTemplate = useMemo(() => {
    return clinicConfig?.transcriptionConfig?.templates.find(t => t.id === selectedTemplateId);
  }, [clinicConfig, selectedTemplateId]);

  // NOVO: Lógica de filtro para buscador rápido de parceiros
  const filteredQuickPartners = useMemo(() => {
    const s = quickPartners.specialists.filter(p => 
        p.name.toLowerCase().includes(partnerQuickSearch.toLowerCase()) || 
        p.specialty.toLowerCase().includes(partnerQuickSearch.toLowerCase()) ||
        p.location.toLowerCase().includes(partnerQuickSearch.toLowerCase())
    );
    const e = quickPartners.exams.filter(p => 
        p.examName.toLowerCase().includes(partnerQuickSearch.toLowerCase()) || 
        p.location.toLowerCase().includes(partnerQuickSearch.toLowerCase())
    );
    return { specialists: s, exams: e };
  }, [quickPartners, partnerQuickSearch]);

  const copyPartnerInfoQuick = (p: any, type: 'specialist' | 'exam') => {
    let text = "";
    if (type === 'specialist') {
        text = `*Especialista:* ${p.name}\n*Especialidade:* ${p.specialty}\n*Contato:* ${p.phone}\n*Local:* ${p.location}`;
    } else {
        text = `*Exame:* ${p.examName}\n*Local:* ${p.location}\n*Contato:* ${p.contact}\n*Site:* ${p.website}`;
    }
    navigator.clipboard.writeText(text);
    confirm({ type: 'alert', title: 'Copiado', message: 'Dados do parceiro copiados para o assistente!' });
  };

  const FS_OPTIONS = {
    visual: [
      { v: 0, l: "0 — Normal" },
      { v: 1, l: "1 — Palidez de disco / Escotoma pequeno / AV 20/20-20/30" },
      { v: 2, l: "2 — Pior olho com AV 20/30–20/59" },
      { v: 3, l: "3 — Escotoma grande / ↓ moderada campos / AV 20/60–20/99" },
      { v: 4, l: "4 — ↓ acentuada campos / AV 20/100–20/200; (3)+melhor olho AV ≤20/60" },
      { v: 5, l: "5 — Pior olho AV <20/200; (4)+melhor olho AV ≤20/60" },
      { v: 6, l: "6 — (5) + melhor olho AV ≤20/60" }
    ],
    brainstem: [
      { v: 0, l: "0 — Normal" },
      { v: 1, l: "1 — Apenas sinais" },
      { v: 2, l: "2 — Nistagmo moderado / Limitação moderada EOM / Outra leve" },
      { v: 3, l: "3 — Nistagmo grave / Fraqueza EOM acentuada / Outros NC moderado" },
      { v: 4, l: "4 — Disartria acentuada / Outra acentuada" },
      { v: 5, l: "5 — Incapaz de deglutir ou falar" }
    ],
    pyramidal: [
      { v: 0, l: "0 — Normal" },
      { v: 1, l: "1 — Sinais anormais sem incapacidade" },
      { v: 2, l: "2 — Incapacidade mínima (BMRC 4 em 1–2 grupos)" },
      { v: 3, l: "3 — Para/hemi leve–moderada (BMRC 4 em ≥3 ou 3 em 1–2)" },
      { v: 4, l: "4 — Para/hemi acentuada; Tetraparesia moderada; Monoplegia" },
      { v: 5, l: "5 — Para/hemi acentuada; Tetraparesia acentuada" },
      { v: 6, l: "6 — Tetraplegia" }
    ],
    cerebellar: [
      { v: 0, l: "0 — Normal" },
      { v: 1, l: "1 — Apenas sinais" },
      { v: 2, l: "2 — Ataxia leve (membros) / Romberg moderado" },
      { v: 3, l: "3 — Ataxia troncal moderada / Ataxia membros moderada" },
      { v: 4, l: "4 — Ataxia marcha/tronco grave; Ataxia grave em 3–4 membros" },
      { v: 5, l: "5 — Incapaz de movimentos coordenados" }
    ],
    sensory: [
      { v: 0, l: "0 — Normal" },
      { v: 1, l: "1 — ↓ leve vibração/temp/figure-writing 1–2 membros" },
      { v: 2, l: "2 — ↓ leve tato/dor/pos or ↓ moderada vibração 1–2 membros" },
      { v: 3, l: "3 — ↓ moderada tato/dor/pos or perda essencial vibração 1–2 membros" },
      { v: 4, l: "4 — ↓ acentuada tato/dor 1–2; ↓ moderada tato/dor + acentuada prop >2" },
      { v: 5, l: "5 — Perda sensitiva ≥2 membros; ↓ mod tato/dor e/ou perda prop corpo" },
      { v: 6, l: "6 — Sensação essencialmente perdida abaixo da cabeça" }
    ],
    bowel: [
      { v: 0, l: "0 — Normal" },
      { v: 1, l: "1 — Hesitação urinária leve/urgência / obstipação" },
      { v: 2, l: "2 — Urgência moderada / incontinência rara / obstipação importante" },
      { v: 3, l: "3 — Incontinência frequente / sondagem intermitente / enemas" },
      { v: 4, l: "4 — Cateterização quase contínua" },
      { v: 5, l: "5 — Perda de função vesical" },
      { v: 6, l: "6 — Perda de função vesical e intestinal" }
    ],
    cerebral: [
      { v: 0, l: "0 — Normal" },
      { v: 1, l: "1 — Alteração humor / fadiga leve (não altera passo EDSS)" },
      { v: 2, l: "2 — Diminuição discreta mentação / fadiga mod-grave" },
      { v: 3, l: "3 — Diminuição moderada da mentação" },
      { v: 4, l: "4 — Diminuição acentuada da mentação" },
      { v: 5, l: "5 — Demência" }
    ]
  };

  const AMBULATION_OPTIONS = [
    { v: '>=500_unrestricted', l: '>= 500m sem restrição (FS <= 3)' },
    { v: '>=500_restricted', l: '>= 500m com restrição (Algum FS > 3)' },
    { v: '300-499', l: '300 - 499m sem auxílio' },
    { v: '200-299', l: '200 - 299m sem auxílio' },
    { v: '100-199', l: '100 - 199m sem auxílio' },
    { v: 'uni>=50', l: 'Auxílio Unilateral >= 50m' },
    { v: 'bi>=120', l: 'Auxílio Bilateral >= 120m' },
    { v: 'uni<50', l: 'Auxílio Unilateral < 50m' },
    { v: 'bi5-120', l: 'Auxílio Bilateral 5 - 120m' },
    { v: 'wc_self', l: 'Cadeira de rodas (propulsão própria)' },
    { v: 'wc_help', l: 'Cadeira de rodas (com auxílio)' },
    { v: 'bed_chair', l: 'Restrito ao leito/cadeira (comunicação/autocuidado OK)' },
    { v: 'bed_most', l: 'Restrito ao leito (quase todo o dia)' },
    { v: 'bed_comm_eat', l: 'Restrito ao leito (dependente para comer/falar)' },
    { v: 'bed_no_comm', l: 'Restrito ao leito (incapaz de comunicar/engolir)' }
  ];

  const medicalScales = [
    { id: 'edss', name: 'Expanded Disability Status Scale (EDSS)', category: 'Neuroimunologia' },
    { id: '9hpt', name: 'Teste dos 9 Pinos (9-Hole Peg Test)', category: 'Neuropsicologia / Motricidade' },
    { id: 't25fw', name: 'Teste dos 25 Pés (Timed 25-Foot Walk)', category: 'Mobilidade / Marcha' },
    { id: 'sloan', name: 'Contraste de Sloan (LCLA)', category: 'Neuro-Oftalmologia / EM' },
    { id: 'meem', name: 'Mini Exame do Estado Mental (MEEM)', category: 'Cognição' },
    { id: 'gds15', name: 'Escala de Depressão Geriátrica (GDS-15)', category: 'Geriátrico' },
    { id: 'phq9', name: 'Patient Health Questionnaire (PHQ-9)', category: 'Psiquiatria' },
  ];

  // Visualização de Arquivos Online
  const [viewingFile, setViewingFile] = useState<any>(null);
  const [viewingExamHistoryText, setViewingExamHistoryText] = useState<string | null>(null);
  const [viewingNote, setViewingNote] = useState<string | null>(null);

  const selectPatient = (n: string) => {
    setSelectedPatientName(n);
    const m = globalMetadata[n] || {};
    setHistory(`Identificação: ${n}, ${m.phone || 'N/I'}. \nCPF: ${m.cpf || 'N/I'}. \nNascimento: ${m.birthDate || 'N/I'}.`);
    setPatientSearch('');
    setSelectedFileIds([]); // Reseta seleção ao mudar paciente
  };

  useEffect(() => {
    if (activePatientName) {
      selectPatient(activePatientName);
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayData = globalAgenda[todayStr];
      if (todayData && todayData.appointments) {
        const inWaitingRoom = todayData.appointments.filter((a: Appointment) => a.status === 'check-in');
        if (inWaitingRoom.length > 0) {
          selectPatient(inWaitingRoom[0].patientName);
        }
      }
    }
  }, [activePatientName, globalMetadata, globalAgenda]);

  useEffect(() => {
    if (patientSearch.trim()) {
      const match = Object.keys(globalMetadata).find(name => name.toLowerCase() === patientSearch.toLowerCase().trim());
      if (match && match !== selectedPatientName) {
        selectPatient(match);
      }
    }
  }, [patientSearch, globalMetadata]);

  useEffect(() => { localStorage.setItem('neuroclinic_past_consults', JSON.stringify(pastConsultations)); }, [pastConsultations]);
  useEffect(() => { localStorage.setItem('neuroclinic_files', JSON.stringify(files)); }, [files]);
  useEffect(() => { localStorage.setItem('neuroclinic_data', JSON.stringify(globalAgenda)); }, [globalAgenda]);
  useEffect(() => { localStorage.setItem('neuroclinic_metadata', JSON.stringify(globalMetadata)); }, [globalMetadata]);
  useEffect(() => { localStorage.setItem('neuroclinic_patient_exams', JSON.stringify(patientExams)); }, [patientExams]);
  useEffect(() => { localStorage.setItem('neuroclinic_ms_followup', JSON.stringify(msFollowupData)); }, [msFollowupData]);

  // Persistência Temporária do Prontuário
  useEffect(() => {
    localStorage.setItem('neuroclinic_temp_transcription', transcription);
    localStorage.setItem('neuroclinic_temp_result', result);
    localStorage.setItem('neuroclinic_temp_resultSections', JSON.stringify(resultSections));
    localStorage.setItem('neuroclinic_temp_manualContext', manualContext);
    localStorage.setItem('neuroclinic_temp_newConsultText', newConsultationText);
    localStorage.setItem('neuroclinic_temp_isNewConsultMode', isNewConsultationMode.toString());
    localStorage.setItem('neuroclinic_temp_manualHypothesis', manualHypothesis);
  }, [transcription, result, resultSections, manualContext, newConsultationText, isNewConsultationMode, manualHypothesis]);

  // Effects to bind streams to video elements when they mount
  useEffect(() => {
    if (teleStatus !== 'disconnected' && streamRef.current && teleLocalVideoRef.current) {
        teleLocalVideoRef.current.srcObject = streamRef.current;
    }
  }, [teleStatus]);

  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  const targetPatientDisplay = useMemo(() => {
    const name = (selectedPatientName || activePatientName || '').trim();
    if (name === "." || name === "Selecione um paciente para iniciar") return "";
    return name;
  }, [selectedPatientName, activePatientName]);

  const currentMsData = useMemo(() => {
    const target = targetPatientDisplay;
    if (!target) return null;
    return msFollowupData[target] || {
      personal: { name: target, birthDate: '', sex: '', address: '', city: '', phone: '', email: '' },
      msInfo: { ageOnset: '', ageDiag: '', timeToTreatment: '' },
      relapses: [{}, {}, {}, {}, {}],
      comorbidities: { checked: [] as string[], other1: '', other2: '' },
      therapies: [{}, {}, {}, {}, {}],
      lab: { 
        date: ['', '', ''], 
        kappa: ['', '', ''], 
        aqp4: ['', '', ''], 
        mog: ['', '', ''], 
        bocs: ['', '', ''], 
        zoster: ['', '', ''] 
      },
      jcv: { ma: Array(10).fill(''), r: Array(10).fill('') },
      checklist: {
        'Data': Array(5).fill(''),
        'F. Hepático': Array(5).fill(''),
        'F. Renal': Array(5).fill(''),
        'Vit. D': Array(5).fill(''),
        'Progressão?': Array(5).fill(''),
        'Vacinas': Array(5).fill(''),
        'RM crânio': Array(5).fill(''),
        'RM coluna': Array(5).fill(''),
        'OCT': Array(5).fill(''),
        'PEV': Array(5).fill(''),
        'Neurofil.': Array(5).fill(''),
        'JCV': Array(5).fill(''),
        'Vit. B12': Array(5).fill(''),
        'Intensão engravidar': Array(5).fill(''),
        'Triagem Ca': Array(5).fill(''),
        'PPD ou IGRA': Array(5).fill(''),
        'HIV / hep B/C / sífilis': Array(5).fill(''),
        'Infecções recorrentes?': Array(5).fill('')
      },
      peg9: [{}, {}, {}, {}, {}],
      visual: [{}, {}, {}, {}, {}],
      walk25: [{}, {}, {}, {}, {}],
      sdmt: [{}, {}, {}, {}, {}],
      edss: [{}, {}, {}, {}, {}],
      biomarkers: {
        'RM – Anel paramagnético': Array(5).fill(''),
        'Atrofia Cerebral': Array(5).fill(''),
        'Atrofia medular': Array(5).fill(''),
        'Neurofilamentos': Array(5).fill(''),
        'OCT': Array(5).fill('')
      },
      progression: { date: Array(10).fill(''), sn: Array(10).fill('') }
    };
  }, [msFollowupData, targetPatientDisplay]);

  const updateMsData = (path: string, value: any) => {
    const target = targetPatientDisplay;
    if (!target) return;
    const newData = { ...msFollowupData };
    const patientData = JSON.parse(JSON.stringify(currentMsData));
    
    const keys = path.split('.');
    let cur = patientData;
    for (let i = 0; i < keys.length - 1; i++) {
        cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    
    newData[target] = patientData;
    setMsFollowupData(newData);
  };

  const activeAptForCheckout = useMemo(() => {
    const target = targetPatientDisplay;
    if (!target) return null;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayData = globalAgenda[todayStr];
    if (!todayData) return null;
    return todayData.appointments.find((a: Appointment) => a.patientName === target && a.status === 'check-in') || null;
  }, [targetPatientDisplay, globalAgenda]);

  const patientEpisodes = useMemo(() => {
    const target = targetPatientDisplay;
    if (!target) return [];
    return Object.values(globalAgenda)
      .flatMap((day: any) => day.appointments)
      .filter((a: Appointment) => a.patientName === target)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [targetPatientDisplay, globalAgenda]);

  const sanitizeValue = (val: any): string => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const handleProcessExams = async (specificText?: string) => {
    const targetPatient = targetPatientDisplay;
    if (!targetPatient) { 
      confirm({ type: 'alert', title: 'Atenção', message: "Por favor, identifique um paciente antes de processar exames." });
      return false; 
    }
    const textToProcess = specificText || examInput;
    if (!textToProcess.trim()) return false;

    setIsProcessingExams(true);
    try {
      const aiResult: ProcessedExamResult = await processExamData(textToProcess);
      
      if (aiResult.error === 'NO_DATE_FOUND') { 
        confirm({ type: 'alert', title: 'Data não identificada', message: "A IA necessita de datas para tabular (ex: 10/02/2025). Por favor, corrija o texto manual ou inclua a data." });
        return false; 
      }

      const currentStored = patientExams[targetPatient] || { laboratory: [], complex: [], historyTexts: [] };
      const mergedLabs = [...(currentStored.laboratory || [])];
      if (aiResult.laboratory) {
        aiResult.laboratory.forEach(newItem => {
          const eName = sanitizeValue(newItem.name).trim();
          const eValue = sanitizeValue(newItem.value).trim();
          const eDate = sanitizeValue(newItem.date).trim();
          const idx = mergedLabs.findIndex(l => String(l.name).toLowerCase() === eName.toLowerCase());
          if (idx !== -1) {
            mergedLabs[idx] = { ...mergedLabs[idx], values: { ...(mergedLabs[idx].values || {}), [eDate]: eValue } };
          } else {
            mergedLabs.push({ name: eName, values: { [eDate]: eValue } });
          }
        });
      }

      const mergedComplex = [...(currentStored.complex || [])];
      if (aiResult.complex) {
        aiResult.complex.forEach(newItem => {
          const isDuplicate = mergedComplex.some(c => 
            String(c.name).toLowerCase() === String(newItem.name).toLowerCase() && 
            String(c.date) === String(newItem.date)
          );
          if (!isDuplicate) {
            mergedComplex.push({ name: sanitizeValue(newItem.name), result: sanitizeValue(newItem.result), date: sanitizeValue(newItem.date) });
          }
        });
      }

      const updatedHistory = [{
        id: `et-${Date.now()}`,
        date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        text: textToProcess
      }, ...(currentStored.historyTexts || [])];

      const updatedAll = { 
        ...patientExams, 
        [targetPatient]: { 
          laboratory: mergedLabs, 
          complex: mergedComplex,
          historyTexts: updatedHistory
        } 
      };
      setPatientExams(updatedAll);
      if (!specificText) setExamInput(''); 
      setExamsAlreadyTabulated(true);
      confirm({ type: 'alert', title: 'Sucesso', message: 'Dados tabulados e salvos no histórico de exames!' });
      return true;
    } catch (error) {
      console.error(error);
      confirm({ type: 'alert', title: 'Falha técnica', message: "Não foi possível tabular os dados automaticamente." });
      return false;
    } finally { 
      setIsProcessingExams(false); 
    }
  };

  const startExamDictation = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } 
      });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      examChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) examChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        setIsTranscribingExam(true);
        const audioBlob = new Blob(examChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const b64 = (reader.result as string).split(',')[1];
            const text = await transcribeExamAudio(b64, 'audio/webm');
            if (text) setExamInput(prev => (prev.trim() + ' ' + text.trim()).trim());
          } catch (error) {
            console.error("Erro na transcrição:", error);
            alert("Erro ao transcrever áudio.");
          } finally {
            setIsTranscribingExam(false);
            stream.getTracks().forEach(t => t.stop());
          }
        };
      };
      examRecorderRef.current = mr; mr.start(1000); setIsDictatingExams(true);
    } catch (err) { alert("Microfone negado."); }
  };

  const stopExamDictation = () => { if (examRecorderRef.current && examRecorderRef.current.state === 'recording') { examRecorderRef.current.stop(); setIsDictatingExams(false); } };

  const currentPatientExams = useMemo(() => {
    const target = targetPatientDisplay;
    if (!target) return { laboratory: [], complex: [], historyTexts: [] };
    const data = patientExams[target] || { laboratory: [], complex: [], historyTexts: [] };
    return { laboratory: data.laboratory || [], complex: data.complex || [], historyTexts: data.historyTexts || [] };
  }, [targetPatientDisplay, patientExams]);

  const sortedLabDates = useMemo(() => {
    const dSet = new Set<string>();
    currentPatientExams.laboratory.forEach(l => { if (l.values) Object.keys(l.values).forEach(d => dSet.add(d)); });
    return Array.from(dSet).sort((a, b) => a.split('/').reverse().join('-').localeCompare(b.split('/').reverse().join('-')));
  }, [currentPatientExams]);

  const sortedComplexDates = useMemo(() => {
    const dSet = new Set<string>();
    currentPatientExams.complex.forEach(c => { if (c.date) dSet.add(c.date); });
    return Array.from(dSet).sort((a, b) => a.split('/').reverse().join('-').localeCompare(b.split('/').reverse().join('-')));
  }, [currentPatientExams]);

  const labMatrix = useMemo(() => {
    if (currentPatientExams.laboratory.length === 0) return [];
    return currentPatientExams.laboratory.map(l => ({ name: sanitizeValue(l.name), values: l.values || {} }));
  }, [currentPatientExams]);

  const complexMatrix = useMemo(() => {
    if (currentPatientExams.complex.length === 0) return [];
    const names = Array.from(new Set(currentPatientExams.complex.map(c => sanitizeValue(c.name)))).sort();
    return names.map(n => {
      const vals: Record<string, string> = {};
      sortedComplexDates.forEach(d => {
        const found = currentPatientExams.complex.find(c => sanitizeValue(c.name) === n && c.date === d);
        vals[d] = found ? found.result : '-';
      });
      return { name: n, values: vals };
    });
  }, [currentPatientExams, sortedComplexDates]);

  const chartData = useMemo(() => {
    if (sortedLabDates.length === 0 || labMatrix.length === 0) return [];
    const maximums: Record<string, number> = {};
    labMatrix.forEach(row => {
      let max = 0;
      Object.values(row.values).forEach(val => {
        const num = parseFloat(String(val).replace(',', '.').replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > max) max = num;
      });
      maximums[row.name] = max || 1;
    });
    return sortedLabDates.map(date => {
      const entry: any = { date };
      labMatrix.forEach(row => {
        const val = row.values[date];
        if (val !== '-') {
          const num = parseFloat(String(val).replace(',', '.').replace(/[^0-9.]/g, ''));
          if (!isNaN(num)) {
            entry[row.name] = Math.round((num / maximums[row.name]) * 100);
          }
        }
      });
      return entry;
    });
  }, [sortedLabDates, labMatrix]);

  const handleMarkSegment = () => {
    if (recordingStartTime) {
      const now = Date.now();
      const elapsed = now - recordingStartTime;
      setAudioMarkers(prev => [...prev, elapsed]);
    }
  };

  const startProfessionalSession = async () => {
    if (isRecordingAudio && !isPausedRecording) return;

    if (isPausedRecording && audioMediaRecorderRef.current) {
        audioMediaRecorderRef.current.resume();
        setIsPausedRecording(false);
        return;
    }

    setIsRecordingAudio(true); // Ativa imediatamente para feedback UI
    setLivePreview(""); // Limpa preview anterior

    try {
      let mixedStream: MediaStream;
      
      if (recordingMode === 'teleconsulta') {
          const micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1
            } 
          });
          // Solicita o compartilhamento de tela/aba com áudio.
          const displayStream = await navigator.mediaDevices.getDisplayMedia({ 
              video: true,
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
          });
          
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const micSource = audioCtx.createMediaStreamSource(micStream);
          const destination = audioCtx.createMediaStreamDestination();
          
          micSource.connect(destination);
          
          // Verifica se o usuário compartilhou o áudio da aba/sistema
          if (displayStream.getAudioTracks().length > 0) {
              const displaySource = audioCtx.createMediaStreamSource(displayStream);
              displaySource.connect(destination);
          } else {
              console.warn("Nenhum áudio de sistema/aba detectado. Certifique-se de marcar a opção 'Compartilhar áudio' ao selecionar a aba da teleconsulta.");
          }
          
          mixedStream = new MediaStream([...destination.stream.getAudioTracks()]);
          // Para o vídeo da captura de tela para economizar recursos, mantendo o áudio mixado
          displayStream.getVideoTracks().forEach(t => t.stop());
      } else {
          mixedStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1
            } 
          });
      }

      const mr = new MediaRecorder(mixedStream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      audioMediaRecorderRef.current = mr; 
      mr.start(1000);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: { 
          responseModalities: [Modality.AUDIO], 
          inputAudioTranscription: {}, 
          systemInstruction: `Rotule as falas como: Médico, Paciente, Acompanhante, Familiar, Terceiro/Equipe e Voz ao fundo. Se não tiver certeza do falante, use "Voz ao fundo". Apenas transcreva o que foi dito, sem transformar em prontuário ou concluir diagnósticos. Não apague falas; marque ruídos ou assuntos paralelos como "Voz ao fundo".` 
        },
        callbacks: {
          onopen: () => {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = ctx;
            const src = ctx.createMediaStreamSource(mixedStream);
            const proc = ctx.createScriptProcessor(4096, 1, 1);
            proc.onaudioprocess = (ev) => {
              if (isPausedRecording || !activeLiveSessionRef.current) return; 
              const inp = ev.inputBuffer.getChannelData(0);
              const i16 = new Int16Array(inp.length);
              for (let i = 0; i < inp.length; i++) i16[i] = inp[i] * 32768;
              const b = new Uint8Array(i16.buffer);
              const bin = String.fromCharCode(...b);
              activeLiveSessionRef.current.sendRealtimeInput({ media: { data: btoa(bin), mimeType: 'audio/pcm;rate=16000' } });
            };
            src.connect(proc); proc.connect(ctx.destination);
          },
          onmessage: async (m: LiveServerMessage) => { 
            if (m.serverContent?.inputTranscription) {
                setLivePreview(p => p + m.serverContent!.inputTranscription!.text + ' ');
            }
          },
          onerror: (e) => { console.error('Live Error:', e); setIsRecordingAudio(false); },
          onclose: () => { setIsRecordingAudio(false); }
        }
      });
      liveSessionRef.current = sessionPromise; 
      sessionPromise.then(s => { activeLiveSessionRef.current = s; }).catch(() => {});
      
      sessionPromise.catch(e => {
          console.error("Erro ao conectar à sessão live:", e);
          setIsRecordingAudio(false);
      });

      setIsPausedRecording(false);
      setRecordingStartTime(Date.now());
      setAudioMarkers([]);
    } catch (err) { 
        console.error(err);
        setIsRecordingAudio(false);
        alert('Falha ao iniciar áudio. Verifique as permissões de microfone e compartilhamento de tela.'); 
    }
  };

  const pauseProfessionalSession = () => {
    if (audioMediaRecorderRef.current && audioMediaRecorderRef.current.state === 'recording') {
        audioMediaRecorderRef.current.pause();
        setIsPausedRecording(true);
    }
  };

  const stopProfessionalSession = async () => {
    setIsRecordingAudio(false);
    setIsPausedRecording(false);
    setRecordingStartTime(null);
    setLoading(true);
    
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    if (liveSessionRef.current) { liveSessionRef.current.then((s: any) => s.close()); liveSessionRef.current = null; }
    activeLiveSessionRef.current = null;
    
    if (audioMediaRecorderRef.current) {
      audioMediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      audioMediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const b64 = (reader.result as string).split(',')[1];
          const finalTranscriptionText = await finalizeTranscription(b64, 'audio/webm');
          setTranscription(finalTranscriptionText);
          setLivePreview('');
          
          if (finalTranscriptionText.trim()) {
            await handleGenerateWithTranscription(finalTranscriptionText);
          } else {
            setLoading(false);
          }
        };
      };
      audioMediaRecorderRef.current.stop(); audioMediaRecorderRef.current = null;
    }
  };

  const handleStartDiagnosis = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: false, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } 
      });
      const mr = new MediaRecorder(s, { mimeType: 'audio/webm' });
      diagChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) diagChunksRef.current.push(e.data); };
      diagMediaRecorderRef.current = mr; mr.start(1000); setDiagnosisStatus('recording');
    } catch (err) { alert("Erro captura."); }
  };

  const handleFinishDiagnosisDictation = () => {
    if (diagMediaRecorderRef.current) {
      setDiagnosisStatus('processing');
      diagMediaRecorderRef.current.onstop = async () => {
        const b = new Blob(diagChunksRef.current, { type: 'audio/webm' });
        const r = new FileReader();
        r.readAsDataURL(b);
        r.onloadend = async () => {
          const b64 = (r.result as string).split(',')[1];
          const synthesis = await processDiagnosisFusion(b64, 'audio/webm', transcription, clinicConfig?.transcriptionConfig, manualHypothesis);
          setResult(p => p + "\n\n" + synthesis);
          setDiagnosisStatus('idle');
          setResultSections(parseResultToSections(result + "\n\n" + synthesis, selectedTemplateId));
        };
      };
      diagMediaRecorderRef.current.stop(); diagMediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  // Teleconsulta Handlers
  const startTeleCall = async () => {
    try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          } 
        });
        streamRef.current = s;
        setTeleStatus('waiting');
    } catch (err) {
        confirm({ type: 'alert', title: 'Erro de Mídia', message: 'Não foi possível acessar sua câmera ou microfone para a teleconsulta.' });
    }
  };

  const stopTeleCall = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setTeleStatus('disconnected');
    setTeleMic(true); setTeleCam(true);
  };

  const copyTeleLink = () => {
    const link = `https://tele.neuroclinic.pro/room/${Date.now()}`;
    navigator.clipboard.writeText(link);
    confirm({ type: 'alert', title: 'Link de Convite', message: 'Link da sala de teleconsulta copiado! Envie para o paciente via WhatsApp.' });
  };

  const performFinalSave = (contentToSave: string, category: string = 'Episódio Clínico') => {
    const target = targetPatientDisplay;
    if (!target) { alert("Erro crítico: Nenhum paciente vinculado a esta evolução."); return; }
    if (!contentToSave.trim() && !examInput.trim()) { setIsNewConsultationMode(false); return; }
    let finalContent = contentToSave;
    if (examInput.trim() && category === 'Episódio Clínico') { finalContent += `\n\n[DADOS DE EXAME INFORMADOS NESTA DATA]:\n${examInput}`; }
    const newPastConsult = { 
      id: `past-${Date.now()}`, 
      date: new Date().toLocaleDateString('pt-BR'), 
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 
      content: finalContent,
      patientName: target,
      category: category
    };
    setPastConsultations([newPastConsult, ...pastConsultations]);
    setNewConsultationText(''); setResult(''); setResultSections([]); setTranscription(''); setExamInput(''); setIsNewConsultationMode(false); setActiveRightTab('historico'); setExamsAlreadyTabulated(false); setManualHypothesis('');
    confirm({ type: 'alert', title: 'Salvo', message: "Prontuário salvo com sucesso!" });
  };

  const applyFormatting = (type: 'bold' | 'underline' | 'list' | 'number') => {
    const textarea = newConsultationTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = newConsultationText.substring(start, end);
    const before = newConsultationText.substring(0, start);
    const after = newConsultationText.substring(end);

    let newText = '';
    let newStart = start;
    let newEnd = end;

    if (type === 'bold') {
      newText = `${before}**${selectedText}**${after}`;
      newStart = start + 2;
      newEnd = end + 2;
    } else if (type === 'underline') {
      newText = `${before}__${selectedText}__${after}`;
      newStart = start + 2;
      newEnd = end + 2;
    } else if (type === 'list') {
      const lines = selectedText.length > 0 ? selectedText.split('\n') : [''];
      const formattedLines = lines.map(line => `• ${line}`);
      const joined = formattedLines.join('\n');
      newText = `${before}${joined}${after}`;
      newStart = start;
      newEnd = start + joined.length;
    } else if (type === 'number') {
      const lines = selectedText.length > 0 ? selectedText.split('\n') : [''];
      const formattedLines = lines.map((line, index) => `${index + 1}. ${line}`);
      const joined = formattedLines.join('\n');
      newText = `${before}${joined}${after}`;
      newStart = start;
      newEnd = start + joined.length;
    }

    setNewConsultationText(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }, 0);
  };

  const handleSimpleSave = () => {
    const target = targetPatientDisplay;
    if (!target) { alert("Erro crítico: Nenhum paciente vinculado a esta evolução."); return; }
    const finalResultStr = resultSections.length > 0 
      ? resultSections.map(s => `${s.label}:\n${s.content}`).join('\n\n')
      : result;
    const content = newConsultationText || finalResultStr;
    const examSection = resultSections.find(s => s.label.toLowerCase().includes('exame'));
    if (examSection && !examsAlreadyTabulated) {
      confirm({
        title: 'Exames Detectados',
        message: `Deseja tabular os exames na aba 'Exames IA' de ${target} antes de salvar o histórico definitivo?`,
        confirmLabel: 'Sim, Tabular e Salvar',
        cancelLabel: 'Apenas Salvar Texto',
        onConfirm: async () => { await handleProcessExams(examSection.content); performFinalSave(content, 'Episódio Clínico'); },
        onCancel: () => performFinalSave(content, 'Episódio Clínico')
      });
    } else {
      confirm({
        title: 'Salvar Evolução',
        message: `Confirmar registro de evolução para ${target}?`,
        onConfirm: () => performFinalSave(content, 'Episódio Clínico')
      });
    }
  };

  const handleOpenCheckout = () => { if (activeAptForCheckout) { setCheckoutApt(activeAptForCheckout); setCheckoutValue(activeAptForCheckout.expectedValue?.toString() || ''); setCheckoutPayment(activeAptForCheckout.paymentMethod || 'PIX'); setIsCheckoutOpen(true); } };

  const handleCheckoutSave = async () => {
    if (!checkoutApt) return;
    const finalResultStr = resultSections.length > 0 
      ? resultSections.map(s => `${s.label}:\n${s.content}`).join('\n\n')
      : result;
    const content = newConsultationText || finalResultStr;
    const examSection = resultSections.find(s => s.label.toLowerCase().includes('exame'));
    if (examSection && !examsAlreadyTabulated) {
        confirm({
            title: 'Exames no Checkout',
            message: 'Deseja tabular os exames antes de finalizar o atendimento?',
            confirmLabel: 'Tabular e Finalizar',
            cancelLabel: 'Apenas Finalizar',
            onConfirm: async () => { await handleProcessExams(examSection.content); executeCheckoutFinal(content); },
            onCancel: () => executeCheckoutFinal(content)
        });
    } else {
        executeCheckoutFinal(content);
    }
  };

  const executeCheckoutFinal = (content: string) => {
    if (!checkoutApt) return;
    const today = new Date().toISOString().split('T')[0];
    const updated = globalAgenda[today].appointments.map((a: Appointment) => a.id === checkoutApt.id ? { ...a, status: 'atendido', paidValue: parseFloat(checkoutValue.replace(',', '.')), paymentMethod: checkoutPayment, returnMonth: checkoutReturnMonth, returnYear: checkoutReturnYear, notes: (a.notes ? a.notes + '\n' : '') + content } : a);
    setGlobalAgenda({ ...globalAgenda, [today]: { ...globalAgenda[today], appointments: updated } });
    const newPastConsult = { 
        id: `p-${Date.now()}`, 
        date: new Date().toLocaleDateString('pt-BR'), 
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 
        content: content, 
        paidValue: checkoutValue, 
        paymentMethod: checkoutPayment, 
        returnDate: checkoutReturnMonth ? `${checkoutReturnMonth}/${checkoutReturnYear}` : 'N/I',
        patientName: targetPatientDisplay,
        category: 'Episódio Clínico'
    };
    setPastConsultations([newPastConsult, ...pastConsultations]);
    setNewConsultationText(''); setResult(''); setResultSections([]); setTranscription(''); setExamInput(''); setIsCheckoutOpen(false); setIsNewConsultationMode(false); setActiveRightTab('episodios'); setExamsAlreadyTabulated(false); setManualHypothesis('');
    confirm({ type: 'alert', title: 'Finalizado', message: "Atendimento finalizado com sucesso!" });
  };

  const startCamera = async (m: 'photo' | 'video') => {
    setCameraMode(m);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: m === 'video' ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } : false
      });
      streamRef.current = s; 
      setIsCameraActive(true);
    } catch (err) { alert("Câmera indisponível."); }
  };

  const stopCamera = () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); setIsCameraActive(false); setIsRecordingVideo(false); };

  const takePhoto = () => {
    if (videoRef.current && videoRef.current.readyState === 4) {
      const can = document.createElement('canvas'); 
      can.width = videoRef.current.videoWidth; 
      can.height = videoRef.current.videoHeight;
      can.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      saveFile('photo', can.toDataURL('image/jpeg'), `FOTO_${Date.now()}.jpg`); stopCamera();
    } else {
        alert("Aguarde a câmera carregar a imagem.");
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;
    videoChunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    mr.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
    mr.onstop = () => {
      const reader = new FileReader();
      reader.onloadend = () => saveFile('video', reader.result as string, `VIDEO_${Date.now()}.mp4`);
      reader.readAsDataURL(new Blob(videoChunksRef.current, { type: 'video/mp4' }));
    };
    mediaRecorderRef.current = mr; mr.start(1000); setIsRecordingVideo(true); 
  };

  const saveFile = (t: 'photo' | 'video' | 'file', u: string, n: string) => {
    const ext = n.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'pdf': 'application/pdf', 'mp4': 'video/mp4', 'webm': 'video/webm'
    };
    const mimeType = mimeMap[ext || ''] || (t === 'photo' ? 'image/jpeg' : t === 'video' ? 'video/mp4' : 'application/octet-stream');
    setFiles([{ id: `f-${Date.now()}`, type: t, url: u, name: n, extension: ext, date: new Date().toLocaleDateString('pt-BR'), mimeType, isPatientUpload: false, patientName: targetPatientDisplay } as any, ...files]);
  };

  const lastEvolutionContent = useMemo(() => {
    const target = targetPatientDisplay;
    if (!target) return null;
    return pastConsultations.find(c => c.patientName === target && c.category === 'Episódio Clínico')?.content || null;
  }, [targetPatientDisplay, pastConsultations]);

  const parseResultToSections = (text: string, templateId: string): ResultSection[] => {
    const template = clinicConfig?.transcriptionConfig?.templates.find(t => t.id === templateId);
    
    // Se usar o novo separador bloco separator
    if (text.includes('---BLOCO_SEPARATOR---')) {
      const parts = text.split('---BLOCO_SEPARATOR---');
      const sections: ResultSection[] = [];
      const templateLabels = template?.sections.filter(s => s.enabled).map(s => s.label) || [];
      
      parts.forEach((p, idx) => {
        const content = p.trim();
        if (!content) return;
        
        // Tenta achar o label no inicio do texto (ex: "HDA: ...")
        let label = templateLabels[idx] || `Seção ${idx + 1}`;
        const firstLine = content.split('\n')[0];
        const labelFound = templateLabels.find(l => firstLine.trim().startsWith(l + ":") || firstLine.trim().startsWith(l));
        if (labelFound) label = labelFound;

        sections.push({ label, content });
      });
      return sections;
    }

    if (!template) return [{ label: 'Conteúdo', content: text }];
    const labels = template.sections.filter(s => s.enabled).map(s => s.label);
    const sections: ResultSection[] = [];
    let currentLabel = "";
    let currentContent: string[] = [];
    const lines = text.split('\n');
    lines.forEach(line => {
        const foundLabel = labels.find(l => line.trim().startsWith(l + ":") || line.trim().startsWith("## " + l.toLowerCase()));
        if (foundLabel) {
            if (currentLabel) sections.push({ label: currentLabel, content: currentContent.join('\n').trim() });
            currentLabel = foundLabel;
            currentContent = [line.trim().substring(foundLabel.length + 1).trim()];
        } else {
            if (currentLabel) currentContent.push(line);
            else if (line.trim()) { currentLabel = "Identificação"; currentContent = [line.trim()]; }
        }
    });
    if (currentLabel) sections.push({ label: currentLabel, content: currentContent.join('\n').trim() });
    
    // Tratamento especial para blocos Markdown tipo ## hd
    if (sections.length === 1 && text.includes('##')) {
       const mdSections: ResultSection[] = [];
       const parts = text.split('## ');
       parts.forEach(p => {
          if(!p.trim()) return;
          const lines = p.split('\n');
          const title = lines[0].trim();
          const content = lines.slice(1).join('\n').trim();
          mdSections.push({ label: title.toUpperCase(), content });
       });
       return mdSections.length > 0 ? mdSections : sections;
    }

    return sections.length > 0 ? sections : [{ label: 'Conteúdo Gerado', content: text }];
  };

  const handleGenerate = async () => {
    if (!transcription.trim()) return;
    setLoading(true); 
    let fullContext = history;
    if (manualContext.trim()) { fullContext += `\n\n[CONTEXTO / OBSERVAÇÕES EXTERNAS]:\n${manualContext.trim()}`; }
    const generatedText = await formatMedicalRecord(transcription, fullContext, { 
      isRetorno, includeROS, includeEM, includePhysical, selectedModel,
      customConfig: clinicConfig?.transcriptionConfig, selectedTemplateId
    });
    setResult(generatedText);
    setResultSections(parseResultToSections(generatedText, selectedTemplateId));
    setExamsAlreadyTabulated(false);
    setLoading(false);
  };

  const handleGenerateWithTranscription = async (currentTranscription: string) => {
    let fullContext = history;
    if (manualContext.trim()) { fullContext += `\n\n[CONTEXTO / OBSERVAÇÕES EXTERNAS]:\n${manualContext.trim()}`; }
    const generatedText = await formatMedicalRecord(currentTranscription, fullContext, { 
      isRetorno, includeROS, includeEM, includePhysical, selectedModel,
      customConfig: clinicConfig?.transcriptionConfig, selectedTemplateId
    });
    setResult(generatedText);
    setResultSections(parseResultToSections(generatedText, selectedTemplateId));
    setExamsAlreadyTabulated(false);
    setLoading(false);
  };

  const handleReadback = async () => {
    const textToReadback = result || transcription || livePreview;
    if (!textToReadback) {
      confirm({ type: 'alert', title: 'Atenção', message: 'Não há conteúdo para ler.' });
      return;
    }

    setLoading(true);
    try {
      const readbackText = await generateReadbackText(textToReadback);
      
      const utterance = new SpeechSynthesisUtterance(readbackText);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.1;
      
      window.speechSynthesis.speak(utterance);

      utterance.onend = () => {
        confirm({
          title: 'Conferência de Pontos Críticos',
          message: 'Confirmado?',
          confirmLabel: 'Continuar',
          cancelLabel: 'Editar',
          onConfirm: () => {},
          onCancel: () => {}
        });
      };
    } catch (error) {
      console.error("Readback error:", error);
      confirm({ type: 'alert', title: 'Erro', message: 'Falha ao gerar pontos críticos.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetEscriba = () => {
    confirm({
        title: 'Reiniciar Sessão',
        message: 'Tem certeza que deseja limpar a transcrição e o prontuário atual para iniciar um novo atendimento?',
        confirmLabel: 'Sim, Reiniciar',
        onConfirm: () => { 
          setTranscription(''); 
          setResult(''); 
          setResultSections([]); 
          setLivePreview(''); 
          setGeneratedDocs([]);
          setExamsAlreadyTabulated(false); 
          setIsPausedRecording(false); 
          setDocPrompt('');
          setManualContext('');
          setNewConsultationText('');
          setExamInput('');
          setIsNewConsultationMode(false);
          setManualHypothesis('');
        }
    });
  };

  const copySectionsAsRichText = async (sections: ResultSection[]) => {
    let html = `<div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000;">`;
    let plainText = "";
    sections.forEach(s => {
        html += `<p style="margin-top: 12pt; margin-bottom: 3pt;"><strong>${s.label}:</strong></p>`;
        const lines = s.content.split('\n');
        let inList = false;
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) { if (inList) { html += `</ul>`; inList = false; } html += `<p style="margin-bottom: 6pt;">&nbsp;</p>`; }
            else if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
                if (!inList) { html += `<ul style="margin-top: 0; margin-bottom: 0;">`; inList = true; }
                html += `<li style="margin-left: 20px;">${trimmed.substring(1).trim()}</li>`;
            } else { if (inList) { html += `</ul>`; inList = false; } html += `<p style="margin-top: 0; margin-bottom: 6pt;">${trimmed}</p>`; }
        });
        if (inList) html += `</ul>`;
        plainText += `${s.label}:\n${s.content}\n\n`;
    });
    html += `</div>`;
    try {
        await navigator.clipboard.write([ new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plainText], { type: 'text/plain' }) }) ]);
        confirm({ type: 'alert', title: 'Copiado', message: "Conteúdo copiado com formatação de Word (negritos, listas e espaços preservados)!" });
    } catch (err) { await navigator.clipboard.writeText(plainText); alert('Copiado apenas como texto simples.'); }
  };

  const handleIncludeLastEvolution = () => {
    if (lastEvolutionContent) {
      setManualContext(prev => (prev.trim() + (prev.trim() ? "\n\n" : "") + "[ÚLTIMA EVOLUÇÃO]:\n" + lastEvolutionContent).trim());
      confirm({ type: 'alert', title: 'Incluído', message: "A última evolução foi adicionada ao quadro de contexto." });
    } else {
      confirm({ type: 'alert', title: 'Aviso', message: "Nenhuma evolução anterior encontrada para este paciente." });
    }
  };

  const handlePostProcessing = async () => {
    if (!docPrompt.trim()) return;
    setIsGeneratingDoc(true);
    try {
      let fullContext = history;
      if (manualContext.trim()) { fullContext += `\n\n[CONTEXTO / OBSERVAÇÕES EXTERNAS]:\n${manualContext.trim()}`; }
      
      const r = await generateMedicalDocument(docPrompt, transcription, fullContext, selectedModel, docFormat, clinicConfig?.documentTemplates || []);
      
      // Separar por blocos conforme solicitado
      const newDocs = r.split('---BLOCO_SEPARATOR---').map(b => b.trim()).filter(b => b);
      setGeneratedDocs(p => [...p, ...newDocs]); 
      setDocPrompt('');
    } catch (e) { 
      alert("Erro ao gerar documento."); 
    } finally { 
      setIsGeneratingDoc(false); 
    }
  };

  const handleOpenPrintModal = (doc: string) => {
    setDocToPrint(doc);
    setIsPrintModalOpen(true);
  };

  const executeFinalPrint = () => {
    if (!docToPrint) return;
    const target = targetPatientDisplay;
    if (!target) {
      confirm({ type: 'alert', title: 'Aviso', message: 'Nenhum paciente identificado para salvar o documento.' });
      return;
    }

    // Salvar no histórico de prontuário obrigatoriamente ao imprimir
    const newPastConsult = { 
      id: `doc-print-save-${Date.now()}`, 
      date: new Date().toLocaleDateString('pt-BR'), 
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 
      content: docToPrint,
      patientName: target,
      category: printCategory
    };
    setPastConsultations([newPastConsult, ...pastConsultations]);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const patientName = target;
    const doctorName = clinicConfig?.doctorName || "Médico Responsável";
    const specialty = clinicConfig?.specialty || "";
    const crm = clinicConfig?.crm || "";
    const rqe = clinicConfig?.rqe || "";
    const logo = clinicConfig?.logo || "";
    
    const loc = clinicConfig?.locations[0] || { name: "", address: "", phone: "", whatsapp: "", email: "", website: "" };
    
    const getFormattedDoc = (text: string) => text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>');

    const headerHtml = `
      <div class="header-content" style="position: relative; border-bottom: 2px solid #334155; padding-bottom: 15px; margin-bottom: 15px; min-height: 80px; display: flex; align-items: center; justify-content: center; width: 100%;">
        ${logo ? `<img src="${logo}" style="position: absolute; left: 0; top: 0; max-width: 80px; max-height: 80px;" />` : ''}
        <div style="text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #000; text-transform: uppercase;">${doctorName}</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #334155; font-weight: 700;">${specialty}</p>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">${crm ? `CRM ${crm}` : ''} ${rqe ? ` | RQE ${rqe}` : ''}</p>
        </div>
      </div>
    `;

    const footerHtml = `
      <div class="footer-content" style="border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; color: #64748b; text-align: center; width: 100%;">
        <p style="margin: 0; font-weight: 800; text-transform: uppercase;">${loc.name}</p>
        <p style="margin: 3px 0;">${loc.address}</p>
        <p style="margin: 3px 0;">
          ${loc.phone ? `Tel: ${loc.phone} ` : ''}
          ${loc.whatsapp ? `| WhatsApp: ${loc.whatsapp} ` : ''}
          ${loc.email ? `| Email: ${loc.email} ` : ''}
          ${loc.website ? `| Site: ${loc.website}` : ''}
        </p>
      </div>
    `;

    let pagesHtml = "";
    if (printDateMode === 'multiple') {
      for (let i = 0; i < printMonthCount; i++) {
        const targetDate = new Date(printStartYear, printStartMonth + i, 1);
        const dateStr = `${months[targetDate.getMonth()]} de ${targetDate.getFullYear()}`;
        for (let j = 0; j < printCopiesPerMonth; j++) {
          pagesHtml += `
            <div class="print-page">
              <table class="layout-table">
                <thead><tr><td><div class="header-spacer"></div></td></tr></thead>
                <tbody><tr><td>
                  <div class="doc-meta" style="font-size: 13px; font-weight: 700; margin-bottom: 20px; color: #000;">Paciente: ${patientName}</div>
                  <div class="doc-body" style="font-size: ${printFontSize}px; line-height: ${printLineHeight}; color: #334155; ${printIsBold ? 'font-weight: bold;' : ''} ${printIsItalic ? 'font-style: italic;' : ''}">${getFormattedDoc(docToPrint)}</div>
                  <div class="doc-date" style="margin-top: 40px; font-weight: 700; color: #1e293b; text-align: left;">Data: ${dateStr}</div>
                </td></tr></tbody>
                <tfoot><tr><td><div class="footer-spacer"></div></td></tr></tfoot>
              </table>
            </div>
          `;
        }
      }
    } else {
      const dateStr = printDateMode === 'current' ? new Date().toLocaleDateString('pt-BR') : "";
      pagesHtml = `
        <div class="print-page">
          <table class="layout-table">
            <thead><tr><td><div class="header-spacer"></div></td></tr></thead>
            <tbody><tr><td>
              <div class="doc-meta" style="font-size: 13px; font-weight: 700; margin-bottom: 20px; color: #000;">Paciente: ${patientName}</div>
              <div class="doc-body" style="font-size: ${printFontSize}px; line-height: ${printLineHeight}; color: #334155; ${printIsBold ? 'font-weight: bold;' : ''} ${printIsItalic ? 'font-style: italic;' : ''}">${getFormattedDoc(docToPrint)}</div>
              ${dateStr ? `<div class="doc-date" style="margin-top: 40px; font-weight: 700; color: #1e293b; text-align: left;">Data: ${dateStr}</div>` : ''}
            </td></tr></tbody>
            <tfoot><tr><td><div class="footer-spacer"></div></td></tr></tfoot>
          </table>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Documento Médico - ${patientName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            @page { size: A4; margin: 1.5cm; }
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; color: #000; }
            .print-page { page-break-after: always; }
            .print-page:last-child { page-break-after: auto; }
            .layout-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            
            /* Repeating header and footer logic */
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            
            .header-fixed { position: fixed; top: 0; left: 0; right: 0; height: 100px; }
            .footer-fixed { position: fixed; bottom: 0; left: 0; right: 0; height: 80px; }
            
            .header-spacer { height: 110px; }
            .footer-spacer { height: 90px; }

            .header-container { position: fixed; top: 0; left: 1.5cm; right: 1.5cm; height: 100px; display: flex; align-items: flex-end; }
            .footer-container { position: fixed; bottom: 0; left: 1.5cm; right: 1.5cm; height: 80px; display: flex; align-items: flex-start; }

            @media screen {
               .header-container, .footer-container { position: static; height: auto; margin-bottom: 20px; }
               .header-spacer, .footer-spacer { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">${headerHtml}</div>
          <div class="footer-container">${footerHtml}</div>
          ${pagesHtml}
          <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setIsPrintModalOpen(false);
    setDocToPrint(null);
  };

  const handleSaveDocToHistory = (doc: string, category: string) => {
    const target = targetPatientDisplay;
    if (!target) {
      confirm({ type: 'alert', title: 'Aviso', message: 'Nenhum paciente identificado para salvar o documento.' });
      return;
    }
    const newPastConsult = { 
      id: `doc-direct-save-${Date.now()}`, 
      date: new Date().toLocaleDateString('pt-BR'), 
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 
      content: doc,
      patientName: target,
      category: category
    };
    setPastConsultations([newPastConsult, ...pastConsultations]);
    confirm({ type: 'alert', title: 'Salvo em Prontuário', message: `Documento categorizado como "${category}" e salvo no histórico de ${target}!` });
  };

  // LÓGICA CALCULADORA EDSS (Baseada no algoritmo Neurostatus)
  const calculateEDSS = () => {
    const fs = { ...edssForm };
    const convertVisual = (v: number) => { const map: any = {1:1,2:2,3:2,4:3,5:3,6:4}; return map[v] || 0; };
    const convertBowel = (v: number) => { const map: any = {1:1,2:2,3:3,4:3,5:4,6:5}; return map[v] || 0; };
    
    const fsAdj = {
      visual: convertVisual(fs.visual),
      brainstem: fs.brainstem,
      pyramidal: fs.pyramidal,
      cerebellar: fs.cerebellar,
      sensory: fs.sensory,
      bowel: convertBowel(fs.bowel),
      cerebral: fs.cerebral,
    };

    const arrAdj = [fsAdj.visual, fsAdj.brainstem, fsAdj.pyramidal, fsAdj.cerebellar, fsAdj.sensory, fsAdj.bowel, fsAdj.cerebral];
    const maxFS = Math.max(...arrAdj);
    
    let score = 0;
    const amb = fs.ambulation;

    if (amb === '>=500_unrestricted' || amb === '>=500_restricted') {
      const count = (g: number) => arrAdj.filter(x => x === g).length;
      const anyGE = (g: number) => arrAdj.some(x => x >= g);
      const c1 = arrAdj.filter((x, i) => !(i === 6 && x === 1) && x === 1).length;
      const c2 = count(2);
      const c3 = count(3);

      if (arrAdj.every((x, i) => (i === 6 ? (x === 0 || x === 1) : x === 0))) score = 0;
      else if (c1 === 1 && c2 === 0 && c3 === 0 && !anyGE(4)) score = 1.0;
      else if (c1 > 1 && c2 === 0 && c3 === 0 && !anyGE(4)) score = 1.5;
      else if (c2 === 1 && c3 === 0 && !anyGE(4)) score = 2.0;
      else if (c2 === 2 && c3 === 0 && !anyGE(4)) score = 2.5;
      else if (c3 === 1 && c2 === 0 && !anyGE(4)) score = 3.0;
      else if ((c2 === 3 || c2 === 4) && c3 === 0 && !anyGE(4)) score = 3.0;
      else if (c3 === 1 && (c2 === 1 || c2 === 2) && !anyGE(4)) score = 3.5;
      else if (c2 >= 5 && !anyGE(4)) score = 3.5;
      else if (anyGE(4) && !anyGE(5)) {
        if (c3 >= 1 || c2 >= 2) score = 4.5;
        else score = 4.0;
      }
      else if (anyGE(5)) score = 5.0;
      else score = 3.5;

      if (amb === '>=500_restricted' && score < 2.0) score = 2.0;
      if (score > 5.0) score = 5.0;
    } else {
      const map: any = { '300-499': 4.5, '200-299': 5.0, '100-199': 5.5, 'uni>=50': 6.0, 'bi>=120': 6.0, 'uni<50': 6.5, 'bi5-120': 6.5, 'wc_self': 7.0, 'wc_help': 7.5, 'bed_chair': 8.0, 'bed_most': 8.5, 'bed_comm_eat': 9.0, 'bed_no_comm': 9.5 };
      score = map[amb] || 5.0;
      // Regra FS 5 em 300-499m
      if (amb === '300-499' && arrAdj.some(x => x >= 5)) score = 5.0;
    }

    // Regra de Piso: EDSS >= maior FS convertido
    if (score < maxFS) score = maxFS;
    
    // Teto de Segurança pela Ambulação
    const caps: any = { '>=500_unrestricted': 5.0, '>=500_restricted': 5.0, '300-499': 5.0, '200-299': 5.0, '100-199': 5.5, 'uni>=50': 6.0, 'bi>=120': 6.0, 'uni<50': 6.5, 'bi5-120': 6.5, 'wc_self': 7.0, 'wc_help': 7.5, 'bed_chair': 8.0, 'bed_most': 8.5, 'bed_comm_eat': 9.0, 'bed_no_comm': 9.5 };
    const cap = caps[amb] || 9.5;
    if (score > cap) score = cap;

    return score;
  };

  const handleSaveEDSS = () => {
    const name = targetPatientDisplay;
    if (!name) return;
    const score = calculateEDSS();
    const newRecord: EDSSRecord = { id: `edss-${Date.now()}`, date: new Date().toISOString().split('T')[0], score, fs: { ...edssForm as any }, ambulation: edssForm.ambulation };
    const currentMeta = globalMetadata[name] || { tags: [] };
    const updatedHistory = [newRecord, ...(currentMeta.edssHistory || [])].sort((a, b) => b.date.localeCompare(a.date));
    setGlobalMetadata({ ...globalMetadata, [name]: { ...currentMeta, edssHistory: updatedHistory } });
    confirm({ type: 'alert', title: 'EDSS Salvo', message: `Pontuação de ${score.toFixed(1)} registrada com sucesso para ${name}.` });
  };

  const edssChartData = useMemo(() => {
    const name = targetPatientDisplay;
    if (!name || !globalMetadata[name]?.edssHistory) return [];
    return [...globalMetadata[name].edssHistory]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ date: r.date.split('-').reverse().join('/'), score: r.score }));
  }, [targetPatientDisplay, globalMetadata]);

  // Lógica Cronômetro e Histórico para Teste dos 9 Pinos (9HPT)
  const toggle9HPTTimer = () => {
    if (is9HPTTimerActive) {
      clearInterval(timerRef9HPT.current);
      if (active9HPTTrial) {
        setNineHoleTrialTimes(prev => ({ ...prev, [active9HPTTrial]: timerVal9HPT / 1000 }));
      }
      setIs9HPTTimerActive(false);
      setActive9HPTTrial(null);
    } else {
      setTimerVal9HPT(0);
      setIs9HPTTimerActive(true);
      timerRef9HPT.current = setInterval(() => {
        setTimerVal9HPT(v => v + 10);
      }, 10);
    }
  };

  const handleSave9HPT = () => {
    const name = targetPatientDisplay;
    if (!name) return;
    const rightAvg = (nineHoleTrialTimes.rh1 + nineHoleTrialTimes.rh2) / 2;
    const leftAvg = (nineHoleTrialTimes.lh1 + nineHoleTrialTimes.lh2) / 2;
    
    const newRecord: NineHoleRecord = {
      id: `9hpt-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      rightTrial1: nineHoleTrialTimes.rh1,
      rightTrial2: nineHoleTrialTimes.rh2,
      rightAverage: rightAvg,
      leftTrial1: nineHoleTrialTimes.lh1,
      leftTrial2: nineHoleTrialTimes.lh2,
      leftAverage: leftAvg
    };

    const currentMeta = globalMetadata[name] || { tags: [] };
    const updatedHistory = [newRecord, ...(currentMeta.nineHoleHistory || [])].sort((a, b) => b.date.localeCompare(a.date));
    setGlobalMetadata({ ...globalMetadata, [name]: { ...currentMeta, nineHoleHistory: updatedHistory } });
    confirm({ type: 'alert', title: '9HPT Salvo', message: `Médias: Direita ${rightAvg.toFixed(2)}s | Esquerda ${leftAvg.toFixed(2)}s.` });
  };

  const nineHoleChartData = useMemo(() => {
    const name = targetPatientDisplay;
    if (!name || !globalMetadata[name]?.nineHoleHistory) return [];
    return [...globalMetadata[name].nineHoleHistory]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ 
        date: r.date.split('-').reverse().join('/'), 
        Direita: r.rightAverage, 
        Esquerda: r.leftAverage 
      }));
  }, [targetPatientDisplay, globalMetadata]);

  // Lógica Cronômetro e Histórico para Teste dos 25 Pés (T25FW)
  const toggleT25FWTimer = () => {
    if (isT25FWTimerActive) {
      clearInterval(timerRefT25FW.current);
      if (activeT25FWTrial) {
        setT25fwTrialTimes(prev => ({ ...prev, [activeT25FWTrial]: timerValT25FW / 1000 }));
      }
      setIsT25FWTimerActive(false);
      setActiveT25FWTrial(null);
    } else {
      setTimerValT25FW(0);
      setIsT25FWTimerActive(true);
      timerRefT25FW.current = setInterval(() => {
        setTimerValT25FW(v => v + 10);
      }, 10);
    }
  };

  const handleSaveT25FW = () => {
    const name = targetPatientDisplay;
    if (!name) return;
    const avg = (t25fwTrialTimes.t1 + t25fwTrialTimes.t2) / 2;
    
    const newRecord: T25FWRecord = {
      id: `t25fw-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      trial1: t25fwTrialTimes.t1,
      trial2: t25fwTrialTimes.t2,
      average: avg
    };

    const currentMeta = globalMetadata[name] || { tags: [] };
    const updatedHistory = [newRecord, ...(currentMeta.t25fwHistory || [])].sort((a, b) => b.date.localeCompare(a.date));
    setGlobalMetadata({ ...globalMetadata, [name]: { ...currentMeta, t25fwHistory: updatedHistory } });
    confirm({ type: 'alert', title: 'T25FW Salvo', message: `Média de caminhada: ${avg.toFixed(2)}s.` });
  };

  const t25fwChartData = useMemo(() => {
    const name = targetPatientDisplay;
    if (!name || !globalMetadata[name]?.t25fwHistory) return [];
    return [...globalMetadata[name].t25fwHistory]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ 
        date: r.date.split('-').reverse().join('/'), 
        Tempo: r.average 
      }));
  }, [targetPatientDisplay, globalMetadata]);

  // Lógica para Teste de Sloan (LCLA)
  const generateSloanSessionLetters = () => {
    const letters = [];
    for (let i = 0; i < 50; i++) {
      letters.push(SLOAN_LETTERS[Math.floor(Math.random() * SLOAN_LETTERS.length)]);
    }
    setSloanTestLetters(letters);
    setSloanLettersCorrect(0);
    setSloanErrors(0);
    setSloanCurrentLine(0);
    setSloanCurrentLetterInLine(0);
  };

  const startSloanTest = () => {
    generateSloanSessionLetters();
    setSloanPhase('test');
    setIsSloanFullScreen(true);
  };

  const handleSloanHit = () => {
    setSloanLettersCorrect(prev => prev + 1);
    advanceSloanLetter();
  };

  const handleSloanMiss = () => {
    const newErrors = sloanErrors + 1;
    setSloanErrors(newErrors);
    if (newErrors >= 3) {
      finishSloanTest();
    } else {
      advanceSloanLetter();
    }
  };

  const advanceSloanLetter = () => {
    if (sloanCurrentLetterInLine < 4) {
      setSloanCurrentLetterInLine(prev => prev + 1);
    } else {
      if (sloanCurrentLine < 9) {
        setSloanCurrentLine(prev => prev + 1);
        setSloanCurrentLetterInLine(0);
      } else {
        finishSloanTest();
      }
    }
  };

  const finishSloanTest = () => {
    setIsSloanFullScreen(false);
    setSloanPhase('summary');
  };

  const handleSaveSloan = () => {
    const name = targetPatientDisplay;
    if (!name) return;
    
    const currentMeta = globalMetadata[name] || { tags: [] };
    const history = currentMeta.sloanHistory || [];
    
    const lastSameTest = history.find(r => r.eye === sloanEye && r.contrastLevel === sloanContrast);
    const worsening = lastSameTest ? (sloanLettersCorrect <= lastSameTest.lettersCorrect - 7) : false;

    const newRecord: SloanContrastRecord = {
      id: `sloan-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      contrastLevel: sloanContrast,
      lettersCorrect: sloanLettersCorrect,
      eye: sloanEye,
      worsening
    };

    const updatedHistory = [newRecord, ...history].sort((a, b) => b.date.localeCompare(a.date));
    setGlobalMetadata({ ...globalMetadata, [name]: { ...currentMeta, sloanHistory: updatedHistory } });
    
    confirm({ 
      type: 'alert', 
      title: worsening ? 'Worsening Detectado' : 'Sloan Salvo', 
      message: worsening 
        ? `ALERTA: Piora clínica detectada (-${lastSameTest!.lettersCorrect - sloanLettersCorrect} letras). Score: ${sloanLettersCorrect}/50.`
        : `Score de ${sloanLettersCorrect}/50 letras registrado para o olho ${sloanEye} (${sloanContrast}% contraste).`
    });
    setSloanPhase('calibration');
  };

  const sloanChartData = useMemo(() => {
    const name = targetPatientDisplay;
    if (!name || !globalMetadata[name]?.sloanHistory) return [];
    return [...globalMetadata[name].sloanHistory]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ 
        date: r.date.split('-').reverse().join('/'), 
        Score: r.lettersCorrect,
        Contrast: `${r.contrastLevel}%`
      }));
  }, [targetPatientDisplay, globalMetadata]);

  const chartColors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Helper para renderizar texto com negritas visuais para Markdown Rico
  const renderFormattedDoc = (text: string) => {
    const formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br/>');
    return { __html: formatted };
  };

  const openSaveCategoryModal = (doc: string) => {
    setDocPendingSave(doc);
    setIsSaveCategoryModalOpen(true);
  };

  const handleSaveToCategory = (cat: string) => {
    if (docPendingSave) {
        handleSaveDocToHistory(docPendingSave, cat);
        setIsSaveCategoryModalOpen(false);
        setDocPendingSave(null);
    }
  };

  const handleExtractFromSelected = async () => {
    if (selectedFileIds.length === 0) return;
    const selectedFiles = files.filter(f => selectedFileIds.includes(f.id));
    
    // Filtra apenas imagens e PDFs suportados pelo Gemini
    const validFiles = selectedFiles.filter(f => 
        f.type === 'photo' || f.extension === 'pdf' || f.mimeType?.startsWith('image/') || f.mimeType === 'application/pdf'
    );

    if (validFiles.length === 0) {
        confirm({ type: 'alert', title: 'Erro de Formato', message: 'A IA só pode processar fotos e documentos PDF. Vídeos e outros arquivos não são suportados para extração de dados.' });
        return;
    }

    setIsExtractingExams(true);
    try {
        const payload = validFiles.map(f => ({
            data: f.url,
            mimeType: f.mimeType || (f.extension === 'pdf' ? 'application/pdf' : 'image/jpeg')
        }));
        
        const extracted = await extractExamsFromFiles(payload);
        setExtractedExamsResult(extracted);
        setShowExtractedModal(true);
    } catch (e) {
        console.error(e);
        confirm({ type: 'alert', title: 'Falha na IA', message: 'Ocorreu um erro ao tentar ler as informações dos arquivos selecionados.' });
    } finally {
        setIsExtractingExams(false);
    }
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFileIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleGeneratePortalLink = () => {
    if (!targetPatientDisplay) return;
    const expiry = Date.now() + (shareExpiryHours * 3600 * 1000);
    const pEnc = btoa(targetPatientDisplay);
    const link = `${window.location.origin}${window.location.pathname}?portal=1&p=${pEnc}&e=${expiry}`;
    setGeneratedPortalLink(link);
  };

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Escriba de Prontuário IA</h2>
          <p className="text-indigo-600 font-black uppercase text-[11px] tracking-widest mt-1">
            {targetPatientDisplay ? `Paciente Selecionado: ${targetPatientDisplay}` : 'Nenhum paciente selecionado para consulta'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleResetEscriba} className="bg-slate-100 text-slate-500 px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase border border-slate-200 hover:bg-slate-200 transition-all flex items-center gap-2">
            <i className="fa-solid fa-rotate-left"></i> Limpar Tudo
          </button>
          <button onClick={() => { setIsNewConsultationMode(true); setActiveRightTab('transcricao'); }} className="bg-emerald-50 text-white px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-2">
            <i className="fa-solid fa-file-circle-plus"></i> Iniciar Evolução
          </button>
          <div className="relative w-full md:w-64">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
              <i className="fa-solid fa-magnifying-glass text-slate-300 text-xs"></i>
              <input type="text" placeholder="Alterar paciente..." className="w-full bg-transparent border-none outline-none text-xs font-bold text-slate-600" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
            </div>
            {patientSearch.length >= 2 && (
              <div className="absolute top-full right-0 w-full bg-white shadow-2xl rounded-2xl border border-slate-100 mt-2 z-50 overflow-hidden divide-y divide-slate-50">
                {Object.keys(globalMetadata).filter(name => name.toLowerCase().includes(patientSearch.toLowerCase())).slice(0, 10).map(name => (
                  <button key={name} onClick={() => selectPatient(name)} className="w-full p-4 text-left hover:bg-indigo-50 flex items-center justify-between">
                    <div><p className="font-black text-slate-800 text-xs uppercase">{sanitizeValue(name)}</p></div>
                    <i className="fa-solid fa-plus text-indigo-400"></i>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={isNewConsultationMode ? "grid grid-cols-1 lg:grid-cols-2 gap-8" : "w-full"}>
        {isNewConsultationMode && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[40px] border border-emerald-100 shadow-xl shadow-emerald-50/50 overflow-y-auto max-h-[85vh] no-scrollbar space-y-8">
              {/* BLOCO: GUIA CLÍNICO DE APOIO */}
              {currentTemplate?.clinicalGuide && currentTemplate.clinicalGuide.length > 0 && (
                 <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-[32px] space-y-3 shadow-sm animate-in fade-in duration-300">
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                       <i className="fa-solid fa-clipboard-check"></i> Guia de Atendimento (Checklist)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                       {currentTemplate.clinicalGuide.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                             <div className="w-4 h-4 rounded-md bg-white border border-amber-200 flex items-center justify-center text-amber-500 flex-shrink-0">
                                <i className="fa-solid fa-check text-[8px]"></i>
                             </div>
                             <span className="leading-tight uppercase tracking-tight">{item}</span>
                          </div>
                       ))}
                    </div>
                 </div>
              )}
              <div className="flex justify-between items-center mb-4">
                <label className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest"><i className="fa-solid fa-pen-nib"></i> Evolução Clínica para {targetPatientDisplay || '...'}</label>
                <button onClick={() => setIsNewConsultationMode(false)} className="text-slate-300 hover:text-slate-500"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center ml-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nota de Evolução</p>
                  <div className="flex gap-1">
                    <button onClick={() => applyFormatting('bold')} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black hover:bg-slate-50 transition-all shadow-sm" title="Negrito">B</button>
                    <button onClick={() => applyFormatting('underline')} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black underline hover:bg-slate-50 transition-all shadow-sm" title="Sublinhado">U</button>
                    <button onClick={() => applyFormatting('list')} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black hover:bg-slate-50 transition-all shadow-sm" title="Lista">•</button>
                    <button onClick={() => applyFormatting('number')} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black hover:bg-slate-50 transition-all shadow-sm" title="Numeração">1.</button>
                    <div className="w-px bg-slate-200 h-4 mx-1"></div>
                    <button onClick={() => setIsEvolutionFullscreen(true)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm" title="Tela Cheia">
                      <i className="fa-solid fa-expand"></i>
                    </button>
                  </div>
                </div>
                <textarea 
                  ref={newConsultationTextareaRef}
                  className="w-full h-80 p-6 rounded-3xl bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-700 leading-loose shadow-inner" 
                  placeholder="Escreva aqui a evolução do paciente..." 
                  value={newConsultationText} 
                  onChange={(e) => setNewConsultationText(e.target.value)} 
                  autoFocus 
                />
              </div>
              <div className="mt-8 flex gap-4">
                 {activeAptForCheckout ? (
                   <button onClick={handleOpenCheckout} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><i className="fa-solid fa-cash-register"></i> Finalizar Atendimento e Salvar</button>
                 ) : (
                   <button onClick={handleSimpleSave} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black shadow-xl uppercase hover:bg-slate-900 transition-all flex items-center justify-center gap-2"><i className="fa-solid fa-floppy-disk"></i> Salvar no Prontuário do Paciente</button>
                 )}
              </div>
            </div>
          </div>
        )}

        {isEvolutionFullscreen && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-200" onClick={() => setIsEvolutionFullscreen(false)}>
            <div className="bg-white w-full h-full max-w-6xl rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <i className="fa-solid fa-expand"></i>
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Editor em Tela Cheia</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evolução de {targetPatientDisplay}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 mr-4 border-r border-slate-200 pr-4">
                    <button onClick={() => applyFormatting('bold')} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-black hover:bg-slate-50 transition-all shadow-sm" title="Negrito">B</button>
                    <button onClick={() => applyFormatting('underline')} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-black underline hover:bg-slate-50 transition-all shadow-sm" title="Sublinhado">U</button>
                    <button onClick={() => applyFormatting('list')} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-black hover:bg-slate-50 transition-all shadow-sm" title="Lista">•</button>
                    <button onClick={() => applyFormatting('number')} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-black hover:bg-slate-50 transition-all shadow-sm" title="Numeração">1.</button>
                  </div>
                  <button onClick={() => setIsEvolutionFullscreen(false)} className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
              <div className="flex-1 p-8 bg-white">
                <textarea 
                  className="w-full h-full p-8 rounded-[32px] bg-slate-50 border-none focus:ring-2 focus:ring-emerald-500 outline-none text-base font-medium text-slate-700 leading-relaxed shadow-inner resize-none" 
                  placeholder="Escreva aqui a evolução do paciente..." 
                  value={newConsultationText} 
                  onChange={(e) => setNewConsultationText(e.target.value)} 
                  autoFocus 
                />
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button onClick={() => setIsEvolutionFullscreen(false)} className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black shadow-lg uppercase hover:bg-emerald-700 transition-all flex items-center gap-2">
                  <i className="fa-solid fa-check"></i> Concluir Edição
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`flex flex-col h-full ${isExpanded ? 'fixed inset-4 z-[60] bg-white rounded-[40px] shadow-2xl' : 'min-h-[600px]'}`}>
          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm flex flex-col flex-1 overflow-hidden relative">
            <button onClick={() => setIsExpanded(!isExpanded)} className="absolute top-4 right-4 z-[70] bg-white p-3 rounded-full shadow-lg text-indigo-600 hover:scale-110 transition-all">
              <i className={`fa-solid ${isExpanded ? 'fa-compress' : 'fa-expand'}`}></i>
            </button>
            <div className="flex p-2 bg-slate-50 border-b border-slate-100 overflow-x-auto no-scrollbar">
               {[
                 { id: 'exames', label: 'Exames IA', icon: 'fa-microscope' },
                 { id: 'historico', label: 'Historico de Prontuário', icon: 'fa-book-medical' },
                 { id: 'episodios', label: 'Episódios de Prontuário', icon: 'fa-notes-medical' },
                 { id: 'arquivos', label: 'Arquivos', icon: 'fa-folder-open' },
                 { id: 'transcricao', label: 'Escriba IA', icon: 'fa-microphone-lines' },
                 { id: 'teleconsulta', label: 'Teleconsulta', icon: 'fa-video' },
                 { id: 'escalas', label: 'Escalas', icon: 'fa-square-poll-vertical' }
               ].map(tab => (
                 <button key={tab.id} onClick={() => setActiveRightTab(tab.id as any)} className={`flex-1 min-w-[90px] flex flex-col items-center justify-center py-3 rounded-2xl transition-all gap-1.5 ${activeRightTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                   <i className={`fa-solid ${tab.icon} text-sm`}></i>
                   <span className="text-[8px] font-black uppercase text-center px-1">{tab.label}</span>
                 </button>
               ))}
            </div>

            {activeRightTab === 'exames' ? (
              <div className="flex-1 bg-white p-8 overflow-y-auto space-y-8 no-scrollbar">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 space-y-4">
                    <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200 space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest flex items-center gap-2"><i className="fa-solid fa-plus-circle text-indigo-600"></i> Processar Novos Exames</h3>
                      </div>
                      <div className="relative">
                        <textarea className="w-full h-32 p-4 rounded-2xl bg-slate-50 border-none font-medium text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner resize-none" placeholder="Cole laudos ou digite resultados com datas aqui..." value={examInput} onChange={e => setExamInput(e.target.value)} />
                        <button onClick={isDictatingExams ? stopExamDictation : startExamDictation} className={`absolute bottom-4 right-4 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${isDictatingExams ? 'bg-red-50 text-white animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                          {isTranscribingExam ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className={`fa-solid ${isDictatingExams ? 'fa-stop' : 'fa-microphone'}`}></i>}
                        </button>
                      </div>
                      <button onClick={() => handleProcessExams()} disabled={isProcessingExams || !examInput.trim()} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {isProcessingExams ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>} Processar e Salvar no Histórico
                      </button>
                    </div>
                  </div>
                  <div className="xl:col-span-1 bg-slate-50 p-6 rounded-[32px] border border-slate-200 flex flex-col min-h-[250px]">
                    <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest flex items-center gap-2 mb-4">
                      <i className="fa-solid fa-clock-rotate-left text-indigo-600"></i> Histórico de Textos
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px] no-scrollbar">
                      {currentPatientExams.historyTexts?.map((h) => (
                        <div key={h.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all cursor-default">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[8px] font-black text-indigo-600 uppercase">{h.date}</span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setViewingExamHistoryText(h.text)} 
                                className="text-[7px] font-black text-indigo-600 hover:text-indigo-800 uppercase transition-colors flex items-center gap-1"
                                title="Visualizar Texto Completo"
                              >
                                <i className="fa-solid fa-eye"></i> Ver
                              </button>
                              <button 
                                onClick={() => setExamInput(h.text)} 
                                className="text-[7px] font-black text-slate-400 hover:text-indigo-600 uppercase transition-colors flex items-center gap-1"
                                title="Carregar no campo de processamento"
                              >
                                <i className="fa-solid fa-rotate"></i> Recarregar
                              </button>
                            </div>
                          </div>
                          <div onClick={() => setViewingExamHistoryText(h.text)} className="cursor-pointer">
                             <p className="text-[9px] text-slate-500 font-medium line-clamp-3 leading-relaxed whitespace-pre-wrap">{h.text}</p>
                          </div>
                        </div>
                      ))}
                      {(!currentPatientExams.historyTexts || currentPatientExams.historyTexts.length === 0) && (
                        <div className="flex flex-col items-center justify-center py-10 opacity-20 text-slate-400">
                          <i className="fa-solid fa-clock-rotate-left text-2xl mb-2"></i>
                          <p className="font-black uppercase text-[8px]">Sem histórico</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* BUSCADOR DE EXAMES */}
                {(labMatrix.length > 0 || complexMatrix.length > 0) && (
                  <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <i className="fa-solid fa-magnifying-glass text-slate-300 ml-2"></i>
                    <input 
                      type="text" 
                      placeholder="Pesquisar exames nas tabelas (ex: Hemoglobina)..." 
                      className="w-full bg-transparent border-none outline-none font-bold text-slate-600 text-sm placeholder:text-slate-300"
                      value={examSearchFilter}
                      onChange={e => setExamSearchFilter(e.target.value)}
                    />
                    {examSearchFilter && (
                      <button onClick={() => setExamSearchFilter('')} className="text-slate-300 hover:text-slate-500 p-1">
                        <i className="fa-solid fa-circle-xmark"></i>
                      </button>
                    )}
                  </div>
                )}

                {labMatrix.length > 0 && chartData.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <button onClick={() => setIsExamChartVisible(!isExamChartVisible)} className="w-full p-5 flex items-center justify-between bg-slate-50/50 hover:bg-slate-100 transition-colors">
                      <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-widest flex items-center gap-2"><i className="fa-solid fa-chart-line text-indigo-500"></i> Evolução de Marcadores (% Máximo)</h3>
                      <i className={`fa-solid ${isExamChartVisible ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400`}></i>
                    </button>
                    {isExamChartVisible && (
                      <div className="p-6 animate-in slide-in-from-top-4 duration-300">
                        <div className="mb-8 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Selecione os exames para visualizar no gráfico:</p>
                          <div className="flex flex-wrap gap-2">
                            {labMatrix.map(row => (
                              <button key={row.name} onClick={() => { const current = selectedChartMarkers; if(current.includes(row.name)) setSelectedChartMarkers(current.filter(n => row.name !== n)); else setSelectedChartMarkers([...current, row.name]); }} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all flex items-center gap-2 ${selectedChartMarkers.includes(row.name) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-200'}`}>
                                {selectedChartMarkers.includes(row.name) && <i className="fa-solid fa-check"></i>} {row.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="h-64 w-full">
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
                              {labMatrix.filter(row => selectedChartMarkers.length === 0 || selectedChartMarkers.includes(row.name)).map((row, idx) => (
                                <Line key={row.name} type="monotone" dataKey={row.name} stroke={chartColors[idx % chartColors.length]} strokeWidth={3} dot={{ r: 4 }} connectNulls />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {labMatrix.length > 0 && (
                  <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2"><i className="fa-solid fa-flask text-indigo-500 text-xs"></i><h4 className="font-black text-slate-800 uppercase text-[9px] tracking-widest">Matriz Laboratorial Acumulada</h4></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-white border-b border-slate-50"><th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase sticky left-0 bg-white z-10 border-r">Exame</th>{sortedLabDates.map(d => <th key={d} className="px-4 py-2 text-[8px] font-black text-slate-800 uppercase text-center min-w-[80px]">{d}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {labMatrix
                            .filter(row => row.name.toLowerCase().includes(examSearchFilter.toLowerCase()))
                            .map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors"><td className="px-4 py-1 text-[9px] font-black text-slate-700 uppercase sticky left-0 bg-white border-r">{row.name}</td>{sortedLabDates.map(d => <td key={d} className="px-4 py-1 text-[9px] font-bold text-indigo-600 text-center">{row.values[d] || '-'}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {complexMatrix.length > 0 && (
                  <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2"><i className="fa-solid fa-x-ray text-blue-500 text-xs"></i><h4 className="font-black text-slate-800 uppercase text-[9px] tracking-widest">Exames de Imagem e Complexos</h4></div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100"><th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase sticky left-0 bg-slate-50 z-10 border-r">Tipo de Exame</th>{sortedComplexDates.map(d => <th key={d} className="px-4 py-2 text-[8px] font-black text-slate-800 uppercase text-center min-w-[250px]">{d}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {complexMatrix
                            .filter(row => row.name.toLowerCase().includes(examSearchFilter.toLowerCase()))
                            .map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors"><td className="px-4 py-1 text-[9px] font-black text-slate-700 uppercase sticky left-0 bg-white border-r">{row.name}</td>{sortedComplexDates.map(d => ( <td key={d} className="px-4 py-1 text-[9px] text-slate-600 font-medium leading-relaxed max-w-[400px]">{row.values[d] || '-'}</td> ))}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {labMatrix.length === 0 && complexMatrix.length === 0 && !isProcessingExams && (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20 text-slate-400"><i className="fa-solid fa-microscope text-5xl mb-4"></i><p className="font-black uppercase text-xs tracking-widest">Nenhum exame tabulado no histórico.</p></div>
                )}
              </div>
            ) : activeRightTab === 'episodios' ? (
              <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
                <div className="p-8 border-b border-slate-100 bg-white flex justify-between items-center"><h3 className="font-black text-slate-800 uppercase text-sm">Cronologia do Prontuário</h3></div>
                <div className="flex-1 p-8 overflow-y-auto space-y-6">
                  {patientEpisodes.length > 0 ? patientEpisodes.map((h, idx) => (
                    <div key={idx} className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{h.date.split('-').reverse().join('/')} - {h.time}</span><p className="font-black text-slate-800 uppercase mt-1">{sanitizeValue(h.type)}</p></div>
                        <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full ${h.status === 'atendido' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{h.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50">
                        <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pagamento</p><p className="text-xs font-bold text-slate-600 uppercase">{sanitizeValue(h.paymentMethod)} • R$ {h.paidValue?.toLocaleString('pt-BR') || '0,00'}</p></div>
                        <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Previsão Retorno</p><p className="text-xs font-bold text-slate-600 uppercase">{h.returnMonth || 'N/I'} {h.returnYear}</p></div>
                      </div>
                      {h.notes && <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 italic whitespace-pre-wrap">"{sanitizeValue(h.notes)}"</div>}
                    </div>
                  )) : <div className="h-full flex flex-col items-center justify-center text-slate-300 p-10"><i className="fa-solid fa-notes-medical text-4xl mb-4 opacity-30"></i><p className="font-black uppercase text-xs">Sem históricos registrados.</p></div>}
                </div>
              </div>
            ) : activeRightTab === 'arquivos' ? (
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-50" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const dtFiles = e.dataTransfer.files; if (dtFiles && dtFiles.length > 0) { Array.from(dtFiles).forEach((f: File) => { const r = new FileReader(); r.onloadend = () => saveFile('file', r.result as string, f.name); r.readAsDataURL(f); }); } }} >
                 <div className="p-8 bg-white border-b border-slate-100 flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-2">
                       <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Repositório de Arquivos</h3>
                       <div className="flex gap-2">
                          <button 
                            onClick={() => { setGeneratedPortalLink(''); setIsSharePortalModalOpen(true); }}
                            className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-100 transition-all border border-indigo-100 flex items-center gap-2"
                          >
                             <i className="fa-solid fa-share-nodes"></i> Link p/ Paciente
                          </button>
                          {selectedFileIds.length > 0 && (
                             <button 
                                onClick={handleExtractFromSelected} 
                                disabled={isExtractingExams}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                             >
                                {isExtractingExams ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                                Extrair Dados IA ({selectedFileIds.length})
                             </button>
                          )}
                          <button onClick={() => selectedFileIds.length === files.length ? setSelectedFileIds([]) : setSelectedFileIds(files.map(f => f.id))} className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-all border border-slate-200">
                             {selectedFileIds.length === files.length ? 'Desmarcar Todos' : 'Selecionar Vários'}
                          </button>
                       </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <button onClick={() => startCamera('photo')} className="flex flex-col items-center gap-2 p-4 bg-indigo-50 text-indigo-600 rounded-[24px] border border-indigo-100 hover:bg-indigo-100 transition-all"><i className="fa-solid fa-camera"></i><span className="text-[8px] font-black uppercase">Foto</span></button>
                      <button onClick={() => startCamera('video')} className="flex flex-col items-center gap-2 p-4 bg-red-50 text-red-600 rounded-[24px] border border-red-100 hover:bg-red-100 transition-all"><i className="fa-solid fa-video"></i><span className="text-[8px] font-black uppercase">Vídeo</span></button>
                      <label className="flex flex-col items-center gap-2 p-4 bg-emerald-50 text-emerald-600 rounded-[24px] border border-indigo-100 cursor-pointer hover:bg-emerald-100 transition-all"><input type="file" className="hidden" multiple onChange={(e) => { const selFiles = e.target.files; if (selFiles) { Array.from(selFiles).forEach((f: File) => { const r = new FileReader(); r.onloadend = () => saveFile('file', r.result as string, f.name); r.readAsDataURL(f); }); } }} /><i className="fa-solid fa-upload"></i><span className="text-[8px] font-black uppercase">Upload</span></label>
                    </div>
                 </div>
                 {isCameraActive && ( <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4"><div className="relative w-full max-w-2xl aspect-video bg-black rounded-[40px] overflow-hidden shadow-2xl"><video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video><div className="absolute bottom-8 left-0 w-full flex justify-center gap-6"><button onClick={stopCamera} className="bg-white/20 text-white w-14 h-14 rounded-full border border-white/30 transition-all"><i className="fa-solid fa-times"></i></button><button onClick={cameraMode === 'photo' ? takePhoto : isRecording ? () => mediaRecorderRef.current?.stop() : startVideoRecording} className={`w-20 h-20 rounded-full border-4 ${isRecording ? 'bg-red-600 border-red-200' : 'bg-white border-red-200'}`}><i className={`fa-solid ${isRecording ? 'fa-stop text-white' : cameraMode === 'photo' ? 'fa-camera text-indigo-600' : 'fa-video text-red-600'} text-3xl`}></i></button></div></div></div> )}
                 <div className="flex-1 p-8 overflow-y-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {files.map(file => {
                        const isSelected = selectedFileIds.includes(file.id);
                        return (
                          <div 
                            key={file.id} 
                            onClick={() => toggleFileSelection(file.id)}
                            className={`bg-white p-3 rounded-3xl border shadow-sm relative group overflow-hidden h-full cursor-pointer transition-all ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-50' : 'border-slate-200'}`}
                          >
                             {/* Indicador de Seleção */}
                             <div className={`absolute top-4 left-4 w-5 h-5 rounded-full border-2 z-20 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/50 border-slate-300'}`}>
                                {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
                             </div>

                             {file.isPatientUpload && (
                               <div className="absolute top-4 right-4 bg-amber-500 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded shadow-sm z-20 animate-pulse">
                                 Paciente • {file.date}
                               </div>
                             )}

                             <div className="aspect-square bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden">
                                {file.extension === 'pdf' ? (
                                   <div className="flex flex-col items-center gap-2">
                                      <i className="fa-solid fa-file-pdf text-4xl text-red-400"></i>
                                      <span className="text-[7px] font-black uppercase text-slate-400">PDF Document</span>
                                   </div>
                                ) : (file.type === 'photo' || file.url.startsWith('data:image')) ? (
                                   <img src={file.url} className="w-full h-full object-cover" />
                                ) : (
                                   <i className="fa-solid fa-file text-4xl text-slate-300"></i>
                                )}
                             </div>
                             <div className="mt-3"><p className="text-[10px] font-black text-slate-800 uppercase truncate">{sanitizeValue(file.name)}</p></div>
                             <div className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3">
                                 <button onClick={(e) => { e.stopPropagation(); setViewingFile(file); }} className="bg-white text-indigo-600 px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm flex items-center gap-2">
                                     <i className="fa-solid fa-eye"></i> Visualizar
                                 </button>
                                 <a href={file.url} download={file.name} onClick={e => e.stopPropagation()} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm flex items-center gap-2">
                                     <i className="fa-solid fa-download"></i> Baixar
                                 </a>
                                 <button onClick={(e) => { e.stopPropagation(); setFiles(files.filter(f => f.id !== file.id)); setSelectedFileIds(selectedFileIds.filter(id => id !== file.id)); }} className="text-red-400 text-[9px] font-black uppercase hover:text-red-300 flex items-center gap-2">
                                     <i className="fa-solid fa-trash"></i> Excluir
                                 </button>
                             </div>
                          </div>
                        );
                      })}
                    </div>
                 </div>
              </div>
            ) : activeRightTab === 'historico' ? (
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                 {/* LINHA DO TEMPO HORIZONTAL (TIMELINE) */}
                 <div className="p-6 bg-slate-50 border-b border-slate-100 overflow-x-auto no-scrollbar">
                    <div className="flex items-center min-w-max px-4">
                       {pastConsultations
                         .filter(c => (!targetPatientDisplay || c.patientName === targetPatientDisplay) && historyCategoryFilter.includes(c.category || 'Episódio Clínico'))
                         .sort((a, b) => a.date.split('/').reverse().join('-').localeCompare(b.date.split('/').reverse().join('-')))
                         .map((c, idx, arr) => (
                           <React.Fragment key={c.id}>
                              <div 
                                onClick={() => setSelectedHistoryDoc(c)}
                                className="flex flex-col items-center cursor-pointer group relative"
                              >
                                 <div className={`w-4 h-4 rounded-full border-2 transition-all shadow-sm z-10 ${selectedHistoryDoc?.id === c.id ? 'bg-indigo-600 border-indigo-200 scale-125' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}></div>
                                 <div className="mt-2 text-center">
                                    <p className={`text-[8px] font-black uppercase whitespace-nowrap ${selectedHistoryDoc?.id === c.id ? 'text-indigo-600' : 'text-slate-400'}`}>{c.date}</p>
                                    <p className="text-[7px] font-bold text-slate-300 uppercase whitespace-nowrap">{c.category === 'Episódio Clínico' ? 'Consulta' : c.category || 'Episódio'}</p>
                                 </div>
                              </div>
                              {idx < arr.length - 1 && (
                                 <div className="w-16 h-0.5 bg-slate-200 mx-1 mb-6"></div>
                              )}
                           </React.Fragment>
                       ))}
                       {pastConsultations.filter(c => (!targetPatientDisplay || c.patientName === targetPatientDisplay) && historyCategoryFilter.includes(c.category || 'Episódio Clínico')).length === 0 && (
                          <div className="flex items-center gap-3 opacity-20">
                             <div className="w-4 h-4 rounded-full border-2 border-slate-300 bg-white"></div>
                             <div className="w-16 h-0.5 bg-slate-200"></div>
                             <div className="w-4 h-4 rounded-full border-2 border-slate-300 bg-white"></div>
                             <span className="text-[10px] font-black text-slate-400 uppercase ml-4">Sem histórico para exibir timeline</span>
                          </div>
                       )}
                    </div>
                 </div>

                 {/* FILTROS DE CATEGORIA DO HISTÓRICO */}
                 <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap gap-2">
                    {historyCategories.map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => {
                          if (historyCategoryFilter.includes(cat)) {
                             if (historyCategoryFilter.length > 1) setHistoryCategoryFilter(historyCategoryFilter.filter(c => c !== cat));
                          } else {
                             setHistoryCategoryFilter([...historyCategoryFilter, cat]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all border ${historyCategoryFilter.includes(cat) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200'}`}
                      >
                        {cat}
                      </button>
                    ))}
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 h-full divide-x divide-slate-100">
                    <div className="md:col-span-1 overflow-y-auto no-scrollbar bg-slate-50/30">
                       <div className="divide-y divide-slate-50">
                         {pastConsultations
                           .filter(c => (!targetPatientDisplay || c.patientName === targetPatientDisplay) && historyCategoryFilter.includes(c.category || 'Episódio Clínico'))
                           .map(c => (
                          <button key={c.id} onClick={() => setSelectedHistoryDoc(c)} className={`w-full p-6 text-left hover:bg-white transition-all ${selectedHistoryDoc?.id === c.id ? 'bg-white border-l-4 border-indigo-600' : ''}`}>
                             <p className="text-[11px] font-black text-slate-800">{sanitizeValue(c.date)}</p>
                             <div className="flex justify-between items-center mt-1">
                               <p className="text-[9px] font-bold text-slate-400 uppercase">{sanitizeValue(c.time)}</p>
                               <span className="text-[7px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">{c.category || 'Episódio'}</span>
                             </div>
                          </button>
                       ))}</div>
                    </div>
                    <div className="md:col-span-2 overflow-y-auto p-10 bg-white">
                       {selectedHistoryDoc ? (
                         <div className="space-y-6">
                           <div className="flex justify-between items-center">
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedHistoryDoc.category || 'Episódio Clínico'}</span>
                           </div>
                           <div className="text-slate-700 font-medium text-sm leading-[2.2] whitespace-pre-wrap">{sanitizeValue(selectedHistoryDoc.content)}</div>
                           <div className="pt-6 border-t border-slate-100 flex gap-2">
                             <button onClick={() => { copySectionsAsRichText([{ label: selectedHistoryDoc.category || 'Evolução', content: selectedHistoryDoc.content }]); }} className="bg-slate-50 text-slate-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm border border-slate-100 hover:bg-slate-100"><i className="fa-solid fa-copy mr-2"></i> Copiar Conteúdo</button>
                           </div>
                         </div>
                       ) : <div className="h-full flex flex-col items-center justify-center text-slate-200"><i className="fa-solid fa-file-medical text-4xl mb-4 opacity-10"></i><p className="text-[10px] font-black uppercase tracking-widest">Selecione um registro no histórico</p></div>}
                    </div>
                 </div>
              </div>
            ) : activeRightTab === 'transcricao' ? (
              <div className="flex-1 bg-[#f0f4f9] overflow-y-auto no-scrollbar relative p-6">
                <div className={`grid grid-cols-1 ${isExpanded ? 'xl:grid-cols-2' : 'xl:grid-cols-5'} gap-6 mb-6`}>
                  <div className={`${isExpanded ? '' : 'xl:col-span-2'} space-y-6`}>
                    <div className={`bg-white rounded-3xl p-6 shadow-sm border border-slate-100 transition-all ${isContextFullscreen ? 'fixed inset-4 z-[100] flex flex-col h-[95vh]' : ''}`}>
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[11px] font-black uppercase text-slate-800"><i className="fa-solid fa-clipboard-user text-indigo-500"></i> CONTEXTO</h4>
                        <div className="flex gap-2">
                          <button onClick={handleIncludeLastEvolution} className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">Incluir Última Evolução</button>
                          <button onClick={() => setIsContextFullscreen(!isContextFullscreen)} className="text-[9px] font-black px-2 py-1 rounded-lg border bg-slate-50 text-slate-600"><i className={`fa-solid ${isContextFullscreen ? 'fa-compress' : 'fa-expand'}`}></i></button>
                          <button onClick={() => setIsContextSettingsOpen(!isContextSettingsOpen)} className={`text-[9px] font-black px-2 py-1 rounded-lg border ${isContextSettingsOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}><i className="fa-solid fa-gear"></i></button>
                        </div>
                      </div>
                      {!isContextSettingsOpen && (
                        <div className={`space-y-4 flex-1 flex flex-col ${isContextFullscreen ? 'h-full' : ''}`}>
                          <div className="space-y-2 mb-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo de Estrutura</p>
                            <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-[10px] uppercase text-slate-700 focus:ring-1 focus:ring-indigo-300 cursor-pointer shadow-sm">
                              {clinicConfig?.transcriptionConfig?.templates.map(t => ( <option key={t.id} value={t.id}>{t.name}</option> ))}
                            </select>
                          </div>
                          <div className="space-y-2 flex-1 flex flex-col">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações / Contexto Externo</p>
                             <textarea 
                               className={`w-full p-4 rounded-xl bg-slate-50 border-none font-medium text-[11px] text-slate-600 resize-none outline-none focus:ring-1 focus:ring-indigo-300 shadow-inner flex-1 ${isContextFullscreen ? 'min-h-0' : 'h-40'}`}
                               placeholder="Cole evoluções de outros prontuários ou observações específicas aqui..." 
                               value={manualContext} 
                               onChange={e => setManualContext(e.target.value)} 
                             />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
                      {/* SELETOR DE MODO: PRESENCIAL VS TELECONSULTA */}
                      <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 gap-1 shadow-inner">
                        <button 
                          onClick={() => setRecordingMode('presencial')} 
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${recordingMode === 'presencial' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                          <i className="fa-solid fa-users"></i> Presencial
                        </button>
                        <button 
                          onClick={() => setRecordingMode('teleconsulta')} 
                          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${recordingMode === 'teleconsulta' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                          <i className="fa-solid fa-headset"></i> Teleconsulta
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={startProfessionalSession} 
                          className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase shadow-xl transition-all ${isRecordingAudio && !isPausedRecording ? 'bg-indigo-600 text-white animate-pulse' : 'bg-[#1e3a8a] text-white hover:bg-indigo-700'}`}
                        >
                          {isRecordingAudio && !isPausedRecording ? 'Sessão Ativa' : isPausedRecording ? 'Retomar Sessão' : 'Iniciar Sessão'}
                        </button>
                        {isRecordingAudio && !isPausedRecording && (
                          <button 
                            onClick={handleMarkSegment} 
                            className="px-4 py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                          >
                            <i className="fa-solid fa-bookmark"></i> Marcar trecho
                          </button>
                        )}
                        {isRecordingAudio && !isPausedRecording && (
                          <button 
                            onClick={pauseProfessionalSession} 
                            className="bg-amber-500 text-white px-4 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-amber-600 transition-all"
                          >
                            Pausar
                          </button>
                        )}
                      </div>
                      {isRecordingAudio && (
                        <button 
                          onClick={stopProfessionalSession} 
                          className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-red-600 transition-all"
                        >
                          Encerrar Sessão (Gerar Prontuário)
                        </button>
                      )}
                      <button onClick={handleResetEscriba} className="w-full py-3 bg-slate-100 text-slate-400 rounded-xl text-[9px] font-black uppercase border border-slate-200 hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                         <i className="fa-solid fa-rotate-left"></i> Limpar Sessão Escriba
                      </button>
                    </div>

                    {/* BLOCO: CONCLUSÃO FINAL */}
                    <div className="bg-[#f0f7ff] rounded-[32px] p-6 border border-indigo-100 space-y-4">
                       <h4 className="text-[11px] font-black uppercase text-indigo-800 tracking-widest flex items-center gap-2">
                          <i className="fa-solid fa-flag-checkered"></i> Conclusão Final
                       </h4>
                       
                       {/* NOVO CAMPO: HIPÓTESE MANUAL */}
                       <div className="space-y-2">
                         <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Hipótese Diagnóstica / Observações (Síntese)</label>
                         <textarea 
                           className="w-full p-4 rounded-2xl bg-white border border-indigo-100 font-medium text-[10px] text-slate-700 h-24 resize-none outline-none focus:ring-1 focus:ring-indigo-300 shadow-sm transition-all"
                           placeholder="Digite hipóteses or observações específicas que a IA deve priorizar e incluir na síntese..."
                           value={manualHypothesis}
                           onChange={e => setManualHypothesis(e.target.value)}
                         />
                       </div>

                       <div className="flex gap-2">
                          <button 
                             onClick={diagnosisStatus === 'recording' ? handleFinishDiagnosisDictation : handleStartDiagnosis} 
                             disabled={diagnosisStatus === 'processing' || !transcription} 
                             className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase shadow-lg transition-all ${diagnosisStatus === 'recording' ? 'bg-red-50 text-white animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'}`}
                          >
                             {diagnosisStatus === 'recording' ? 'Encerrar e Gerar Conclusão' : 'Conclusão Final (Iniciar Gravação)'}
                          </button>
                       </div>
                       {diagnosisStatus === 'processing' && (
                          <div className="flex items-center justify-center gap-2 text-indigo-600 animate-pulse">
                             <i className="fa-solid fa-circle-notch fa-spin"></i>
                             <span className="text-[9px] font-black uppercase">Sintetizando HD e Condutas...</span>
                          </div>
                       )}
                    </div>
                  </div>

                  <div className={`${isExpanded ? '' : 'xl:col-span-3'} space-y-6`}>
                    <div className="bg-white rounded-[40px] p-10 shadow-sm flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
                       <div className="flex flex-col items-center space-y-6 w-full">
                          {resultSections.length > 0 ? (
                             <div className="w-full space-y-6 max-h-[600px] overflow-y-auto pr-2 no-scrollbar pb-10">
                                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md p-4 rounded-2xl flex justify-between items-center border border-slate-100 shadow-md mb-4">
                                  <div className="flex gap-2">
                                    <button onClick={handleResetEscriba} className="bg-slate-100 text-slate-600 text-[9px] font-black px-4 py-2 rounded-xl hover:bg-slate-200 transition-all uppercase flex items-center gap-2 border border-slate-200"><i className="fa-solid fa-rotate-left"></i> Reiniciar / Novo</button>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => copySectionsAsRichText(resultSections)} className="bg-indigo-600 text-white text-[9px] font-black px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all uppercase flex items-center gap-2 shadow-lg"><i className="fa-solid fa-copy"></i> Copiar Tudo (Formatado Word)</button>
                                    <button onClick={handleReadback} disabled={loading} className="bg-emerald-500 text-white text-[9px] font-black px-4 py-2 rounded-xl hover:bg-emerald-600 transition-all uppercase flex items-center gap-2 shadow-lg"><i className="fa-solid fa-volume-high"></i> Ler pontos críticos (TTS)</button>
                                  </div>
                                </div>
                                {resultSections.map((sec, idx) => (
                                  <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3 group hover:border-indigo-200 transition-all">
                                    <div className="flex justify-between items-center">
                                      <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{sec.label}</h5>
                                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {(sec.label.toLowerCase().includes('exame') || sec.label.toLowerCase().includes('físico')) && (
                                           <button onClick={() => handleProcessExams(sec.content)} className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-2 py-1 rounded-lg border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all uppercase flex items-center gap-1">
                                             <i className="fa-solid fa-table"></i> Tabular Dados IA
                                           </button>
                                        )}
                                        <button onClick={() => copySectionsAsRichText([sec])} className="text-slate-400 hover:text-indigo-600 p-1 transition-colors" title="Copiar Seção">
                                          <i className="fa-solid fa-copy"></i>
                                        </button>
                                      </div>
                                    </div>
                                    <textarea className="w-full p-4 rounded-2xl bg-slate-50 border-none font-medium text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-300 resize-none leading-relaxed min-h-[80px]" value={sec.content} onChange={(e) => { const newSecs = [...resultSections]; newSecs[idx].content = e.target.value; setResultSections(newSecs); }} rows={sec.content.split('\n').length || 3} />
                                  </div>
                                ))}
                             </div>
                           ) : ( 
                              <div className="text-center space-y-6">
                                <div>
                                  <p className="text-6xl font-black text-slate-800">{wordCount}</p>
                                  <p className="text-[10px] font-black text-slate-400 uppercase mt-2">Palavras Transcritas</p>
                                </div>
                                {audioMarkers.length > 0 && (
                                  <div className="pt-6 border-t border-slate-100 w-full max-w-xs mx-auto">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Trechos Marcados</p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                      {audioMarkers.map((m, i) => (
                                        <span key={i} className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black border border-amber-100 flex items-center gap-1.5 shadow-sm">
                                          <i className="fa-solid fa-bookmark text-[8px]"></i>
                                          {new Date(m).toISOString().substr(14, 5)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div> 
                           )}
                       </div>
                       <div className="absolute bottom-0 left-0 w-full p-8 flex justify-end gap-2">
                          {resultSections.length > 0 ? <button onClick={handleSimpleSave} className="px-6 py-4 rounded-2xl font-black text-xs uppercase bg-white border border-slate-200 text-indigo-600 shadow-md hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"><i className="fa-solid fa-floppy-disk"></i> Salvar Evolução Corrigida</button> : <button onClick={handleGenerate} disabled={loading || !transcription} className={`px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl ${loading ? 'bg-slate-300' : 'bg-[#93c5fd] text-[#1e3a8a]'}`}>{loading ? 'TRABALHANDO...' : 'Gerar Prontuário'}</button>}
                       </div>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO: ASSISTENTE DE DOCUMENTOS (RODAPÉ EM LARGURA TOTAL) */}
                <div className="w-full space-y-6">
                    <div className="bg-white rounded-[40px] p-10 shadow-sm border border-indigo-100 space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h4 className="text-xl font-black uppercase text-indigo-600 tracking-tighter flex items-center gap-3">
                                    <i className="fa-solid fa-file-medical text-2xl"></i> Assistente de Documentos Médicos
                                </h4>
                                <p className="text-xs text-slate-500 font-medium mt-1">Gere receitas, atestados ou pedidos baseados na instrução e contexto clínico.</p>
                            </div>
                            <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase pl-2">Formato de Saída:</span>
                                <select 
                                    value={docFormat} 
                                    onChange={e => setDocFormat(e.target.value)}
                                    className="bg-white border-none text-[10px] font-black uppercase px-4 py-2 rounded-xl outline-none cursor-pointer text-indigo-600 shadow-sm"
                                >
                                    <option value="Markdown Rico">Markdown Rico</option>
                                    <option value="Formatado">Formatado</option>
                                    <option value="Compacto">Compacto</option>
                                    <option value="Texto Puro">Texto Puro</option>
                                </select>
                            </div>
                        </div>

                        {/* MENU DE UTILITÁRIOS: MODELOS E BUSCADOR DE PARCEIROS */}
                        <div className="flex flex-wrap gap-2">
                            {/* NOVO: MENU DESPLAZAVEL DE MODELOS PRONTOS */}
                            {clinicConfig?.documentTemplates && clinicConfig.documentTemplates.length > 0 && (
                                <div className="relative">
                                    <button 
                                        onClick={() => { setIsTemplatesMenuOpen(!isTemplatesMenuOpen); setIsPartnerMenuOpen(false); }}
                                        className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase text-indigo-700 hover:bg-indigo-100 transition-all shadow-sm"
                                    >
                                        <i className="fa-solid fa-tags"></i> Ver Modelos Prontos
                                        <i className={`fa-solid ${isTemplatesMenuOpen ? 'fa-chevron-up' : 'fa-chevron-down'} ml-1`}></i>
                                    </button>
                                    
                                    {isTemplatesMenuOpen && (
                                        <div className="absolute bottom-full left-0 mb-2 w-full md:w-[600px] bg-white rounded-3xl border border-slate-200 shadow-2xl z-[80] p-6 animate-in slide-in-from-bottom-2 duration-200 max-h-[400px] overflow-y-auto no-scrollbar">
                                            <div className="flex justify-between items-center mb-4">
                                                <h5 className="text-[11px] font-black uppercase text-slate-800 tracking-widest">Modelos Disponíveis</h5>
                                                <button onClick={() => setIsTemplatesMenuOpen(false)} className="text-slate-300 hover:text-slate-500"><i className="fa-solid fa-times"></i></button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {clinicConfig.documentTemplates.map(t => (
                                                    <button 
                                                        key={t.id}
                                                        onClick={() => {
                                                            setDocPrompt(prev => (prev.trim() + " " + t.keyword).trim());
                                                            setIsTemplatesMenuOpen(false);
                                                        }}
                                                        className="p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-indigo-300 hover:bg-white transition-all text-left group"
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded uppercase">{t.keyword}</span>
                                                            <span className="text-[8px] font-black text-slate-300 uppercase">{t.category}</span>
                                                        </div>
                                                        <p className="text-[10px] font-black text-slate-700 uppercase leading-none group-hover:text-indigo-600">{t.name}</p>
                                                        <p className="text-[8px] text-slate-400 font-medium line-clamp-1 mt-1 italic">{t.content}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* NOVO: BUSCADOR DE PARCEIROS RAPIDO */}
                            <div className="relative">
                                <button 
                                    onClick={() => {
                                        const s = localStorage.getItem('neuroclinic_partners');
                                        const e = localStorage.getItem('neuroclinic_exams');
                                        setQuickPartners({
                                            specialists: s ? JSON.parse(s) : [],
                                            exams: e ? JSON.parse(e) : []
                                        });
                                        setIsPartnerMenuOpen(!isPartnerMenuOpen);
                                        setIsTemplatesMenuOpen(false);
                                    }}
                                    className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase text-emerald-700 hover:bg-emerald-100 transition-all shadow-sm"
                                >
                                    <i className="fa-solid fa-address-book"></i> Buscar Parceiros
                                    <i className={`fa-solid ${isPartnerMenuOpen ? 'fa-chevron-up' : 'fa-chevron-down'} ml-1`}></i>
                                </button>
                                
                                {isPartnerMenuOpen && (
                                    <div className="absolute bottom-full left-0 mb-2 w-full md:w-[600px] bg-white rounded-3xl border border-slate-200 shadow-2xl z-[80] p-6 animate-in slide-in-from-bottom-2 duration-200 flex flex-col h-[450px]">
                                        <div className="flex justify-between items-center mb-4">
                                            <h5 className="text-[11px] font-black uppercase text-slate-800 tracking-widest">Contatos Parceiros</h5>
                                            <button onClick={() => setIsPartnerMenuOpen(false)} className="text-slate-300 hover:text-slate-500"><i className="fa-solid fa-times"></i></button>
                                        </div>
                                        
                                        <div className="relative mb-4">
                                            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                                            <input 
                                                type="text" 
                                                placeholder="Buscar por nome, especialidade ou local..."
                                                className="w-full pl-9 p-3 rounded-xl bg-slate-50 border-none font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                                                value={partnerQuickSearch}
                                                onChange={e => setPartnerQuickSearch(e.target.value)}
                                                autoFocus
                                            />
                                        </div>

                                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
                                            {/* Resultados de Especialistas */}
                                            {filteredQuickPartners.specialists.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Especialistas</p>
                                                    {filteredQuickPartners.specialists.map(p => (
                                                        <div key={p.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group">
                                                            <div className="overflow-hidden pr-2">
                                                                <p className="text-[10px] font-black text-slate-800 uppercase truncate">{p.name}</p>
                                                                <p className="text-[8px] font-bold text-indigo-600 uppercase mt-0.5">{p.specialty} • {p.location}</p>
                                                            </div>
                                                            <button 
                                                                onClick={() => copyPartnerInfoQuick(p, 'specialist')}
                                                                className="bg-white text-emerald-600 p-2 rounded-xl shadow-sm hover:bg-emerald-600 hover:text-white transition-all text-[10px]"
                                                                title="Copiar Dados"
                                                            >
                                                                <i className="fa-solid fa-copy"></i>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Resultados de Exames */}
                                            {filteredQuickPartners.exams.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Laboratórios e Exames</p>
                                                    {filteredQuickPartners.exams.map(p => (
                                                        <div key={p.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group">
                                                            <div className="overflow-hidden pr-2">
                                                                <p className="text-[10px] font-black text-slate-800 uppercase truncate">{p.examName}</p>
                                                                <p className="text-[8px] font-bold text-indigo-600 uppercase mt-0.5">{p.location}</p>
                                                            </div>
                                                            <button 
                                                                onClick={() => copyPartnerInfoQuick(p, 'exam')}
                                                                className="bg-white text-emerald-600 p-2 rounded-xl shadow-sm hover:bg-emerald-600 hover:text-white transition-all text-[10px]"
                                                                title="Copiar Dados"
                                                            >
                                                                <i className="fa-solid fa-copy"></i>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {filteredQuickPartners.specialists.length === 0 && filteredQuickPartners.exams.length === 0 && (
                                                <div className="text-center py-10 opacity-20">
                                                    <i className="fa-solid fa-address-book text-3xl mb-2"></i>
                                                    <p className="text-[10px] font-black uppercase">Nenhum parceiro encontrado</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="relative group">
                                <textarea 
                                    className="w-full h-40 p-8 rounded-[32px] bg-slate-50 border-2 border-transparent focus:border-indigo-100 font-medium text-sm text-slate-700 resize-none outline-none shadow-inner transition-all"
                                    placeholder="Digite seu comando aqui. Use as palavras-chave acima para inserir modelos prontos. Ex: 'Faz a receita do que combinamos e o encaminhamento pro cardio'"
                                    value={docPrompt}
                                    onChange={e => setDocPrompt(e.target.value)}
                                />
                                <div className="absolute bottom-6 right-6">
                                    <button 
                                        onClick={handlePostProcessing}
                                        disabled={isGeneratingDoc || !docPrompt.trim()}
                                        className={`px-10 py-5 rounded-[24px] font-black text-sm uppercase shadow-2xl transition-all flex items-center justify-center gap-3 ${isGeneratingDoc ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95'}`}
                                    >
                                        {isGeneratingDoc ? (
                                            <>
                                                <i className="fa-solid fa-spinner fa-spin"></i>
                                                Processando Documentos...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                                                Gerar Blocos de Documentos
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Exibição dos Documentos Gerados pelo Assistente (COLUNA ÚNICA) */}
                        {generatedDocs.length > 0 && (
                            <div className="pt-10 space-y-8 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex justify-between items-center border-t border-slate-100 pt-8">
                                    <h5 className="text-[11px] font-black uppercase text-indigo-600 tracking-widest">Documentos Gerados ({generatedDocs.length})</h5>
                                    <button onClick={() => setGeneratedDocs([])} className="text-10px font-black text-slate-300 hover:text-red-400 uppercase">Limpar Documentos</button>
                                </div>
                                <div className="grid grid-cols-1 gap-8">
                                    {generatedDocs.map((doc, dIdx) => (
                                        <div key={dIdx} className="bg-indigo-50/20 p-8 rounded-[40px] border border-indigo-100 shadow-sm space-y-4 group hover:bg-indigo-50/40 transition-all">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-black">
                                                        {dIdx + 1}
                                                    </div>
                                                    <h5 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Documento Processado</h5>
                                                </div>
                                                <div className="flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => handleOpenPrintModal(doc)} className="bg-slate-100 text-slate-600 text-[10px] font-black px-4 py-2 rounded-xl hover:bg-slate-200 transition-all uppercase flex items-center gap-2 border border-slate-200 shadow-sm">
                                                        <i className="fa-solid fa-print"></i> Imprimir
                                                    </button>
                                                    <button onClick={() => openSaveCategoryModal(doc)} className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-4 py-2 rounded-xl hover:bg-emerald-100 transition-all uppercase flex items-center gap-2 border border-emerald-100 shadow-sm">
                                                        <i className="fa-solid fa-floppy-disk"></i> Salvar em Prontuário
                                                    </button>
                                                    <button onClick={() => copySectionsAsRichText([{ label: 'Documento', content: doc }])} className="bg-indigo-600 text-white text-[10px] font-black px-5 py-2.5 rounded-xl uppercase shadow-lg flex items-center gap-2">
                                                        <i className="fa-solid fa-copy"></i> Copiar Bloco
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* ÁREA DE CONTEÚDO COM RENDEREIZAÇÃO DE NEGRITAS VISÍVEIS */}
                                            <div 
                                                contentEditable 
                                                onBlur={(e) => {
                                                    const newDocs = [...generatedDocs];
                                                    newDocs[dIdx] = e.currentTarget.innerText;
                                                    setGeneratedDocs(newDocs);
                                                }}
                                                className="bg-white p-8 rounded-[32px] text-sm font-medium text-slate-700 leading-loose shadow-inner border border-indigo-50 min-h-[200px] outline-none focus:ring-1 focus:ring-indigo-200 transition-all"
                                                dangerouslySetInnerHTML={docFormat === 'Markdown Rico' ? renderFormattedDoc(doc) : { __html: doc.replace(/\n/g, '<br/>') }}
                                            />
                                            <p className="text-[8px] text-slate-400 font-bold uppercase italic text-right">* Este bloco permite edição direta para ajustes finais.</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
              </div>
            ) : activeRightTab === 'teleconsulta' ? (
                <div className="flex-1 bg-slate-900 flex flex-col overflow-hidden">
                    <div className="p-6 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${teleStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : teleStatus === 'waiting' ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`}></div>
                            <h3 className="text-white font-black uppercase text-xs tracking-widest">
                                {teleStatus === 'connected' ? 'Em Chamada' : teleStatus === 'waiting' ? 'Aguardando Paciente...' : 'Teleconsulta Offline'}
                            </h3>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={copyTeleLink} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border border-slate-600">
                                <i className="fa-solid fa-link"></i> Copiar Link do Paciente
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 relative flex items-center justify-center p-8">
                        <div className="w-full max-w-4xl aspect-video bg-slate-800 rounded-[40px] border border-slate-700 shadow-2xl overflow-hidden relative group">
                            {teleStatus === 'disconnected' ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 space-y-6">
                                    <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center text-4xl">
                                        <i className="fa-solid fa-video-slash"></i>
                                    </div>
                                    <p className="font-black uppercase text-sm tracking-widest">Câmera Desconectada</p>
                                    <button onClick={startTeleCall} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-[24px] font-black uppercase shadow-xl transition-all">Conectar Agora</button>
                                </div>
                            ) : (
                                <>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                                        <i className="fa-solid fa-spinner fa-spin text-4xl mb-4"></i>
                                        <p className="font-black uppercase text-xs">Conectando ao paciente...</p>
                                    </div>
                                    <div className="absolute bottom-6 right-6 w-48 aspect-video bg-black rounded-2xl border-2 border-slate-600 shadow-2xl overflow-hidden z-20">
                                        <video ref={teleLocalVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!teleCam ? 'hidden' : ''}`}></video>
                                        {!teleCam && <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white"><i className="fa-solid fa-user"></i></div>}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {teleStatus !== 'disconnected' && (
                        <div className="p-8 bg-slate-800/80 backdrop-blur-xl border-t border-slate-700 flex justify-center gap-6">
                            <button onClick={() => setTeleMic(!teleMic)} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${teleMic ? 'bg-slate-700 text-white' : 'bg-red-50 text-white'}`}>
                                <i className={`fa-solid ${teleMic ? 'fa-microphone' : 'fa-microphone-slash'} text-xl`}></i>
                            </button>
                            <button onClick={() => setTeleCam(!teleCam)} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${teleCam ? 'bg-slate-700 text-white' : 'bg-red-50 text-white'}`}>
                                <i className={`fa-solid ${teleCam ? 'fa-video' : 'fa-video-slash'} text-xl`}></i>
                            </button>
                            <button onClick={() => confirm({ title: 'Encerrar Teleconsulta', message: 'Deseja realmente finalizar a chamada?', onConfirm: stopTeleCall })} className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-all">
                                <i className="fa-solid fa-phone-slash text-xl"></i>
                            </button>
                        </div>
                    )}
                </div>
            ) : activeRightTab === 'escalas' ? (
                <div className="flex-1 p-8 overflow-y-auto bg-slate-50 relative no-scrollbar">
                    {selectedScale === 'edss' ? (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300 pb-20">
                            <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm sticky top-0 z-10">
                               <div className="flex items-center gap-4">
                                  <button onClick={() => setSelectedScale(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 text-slate-500 transition-all"><i className="fa-solid fa-chevron-left"></i></button>
                                  <div>
                                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Cálculo de EDSS (Neurostatus)</h3>
                                     <p className="text-[10px] text-indigo-500 font-bold uppercase">Neuroimunologia • Esclerose Múltipla</p>
                                  </div>
                               </div>
                               <div className="flex flex-col items-end">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pontuação Calculada</p>
                                  <div className="bg-indigo-600 text-white px-6 py-2 rounded-2xl text-2xl font-black shadow-lg shadow-indigo-100 flex items-center gap-3">
                                      {calculateEDSS().toFixed(1)}
                                      <div className="w-px h-6 bg-white/20"></div>
                                      <button onClick={handleSaveEDSS} className="text-[10px] uppercase font-black hover:text-indigo-200 transition-colors">Salvar no Histórico</button>
                                  </div>
                               </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                               <div className="space-y-4">
                                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><i className="fa-solid fa-brain"></i> Sistemas Funcionais (FS)</h4>
                                  <div className="grid grid-cols-1 gap-4">
                                     {Object.entries(FS_OPTIONS).map(([fsKey, options]) => (
                                        <div key={fsKey} className="bg-white p-5 rounded-[28px] border border-slate-200 shadow-sm group hover:border-indigo-300 transition-all">
                                           <label className="text-[10px] font-black text-indigo-600 uppercase mb-3 block tracking-widest">{fsKey === 'bowel' ? 'Bowel & Bladder' : fsKey.charAt(0).toUpperCase() + fsKey.slice(1)}</label>
                                           <select 
                                              value={edssForm[fsKey as keyof typeof edssForm]} 
                                              onChange={(e) => setEdssForm({ ...edssForm, [fsKey]: Number(e.target.value) })}
                                              className="w-full bg-slate-50 border-none rounded-xl p-3 text-xs font-bold text-slate-700 cursor-pointer outline-none focus:ring-1 focus:ring-indigo-300"
                                           >
                                              {options.map(opt => <option key={opt.v} value={opt.v}>{opt.l}</option>)}
                                           </select>
                                        </div>
                                     ))}
                                  </div>
                               </div>

                               <div className="space-y-6">
                                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
                                     <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-person-walking"></i> Deambulação e Mobilidade</h4>
                                     <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
                                        {AMBULATION_OPTIONS.map(opt => (
                                           <button 
                                              key={opt.v} 
                                              onClick={() => setEdssForm({ ...edssForm, ambulation: opt.v })}
                                              className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3 ${edssForm.ambulation === opt.v ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-600 hover:border-slate-200'}`}
                                           >
                                              <div className={`w-3 h-3 rounded-full border ${edssForm.ambulation === opt.v ? 'bg-white border-white' : 'bg-transparent border-slate-300'}`}></div>
                                              <span className="text-xs font-bold uppercase leading-tight">{opt.l}</span>
                                           </button>
                                        ))}
                                     </div>
                                  </div>

                                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                                      <div className="flex justify-between items-center mb-6">
                                         <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-chart-line text-indigo-500"></i> Evolução Temporal</h4>
                                         <button onClick={() => setIsEDSSHistoryVisible(!isEDSSHistoryVisible)} className="text-[10px] font-black text-indigo-600 uppercase">Ver Histórico Tabular</button>
                                      </div>
                                      <div className="h-64 w-full">
                                         <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={edssChartData}>
                                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                               <XAxis dataKey="date" tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                                               <YAxis domain={[0, 10]} tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                                               <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                               <Line type="stepAfter" dataKey="score" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5' }} />
                                            </LineChart>
                                         </ResponsiveContainer>
                                      </div>
                                  </div>
                               </div>
                            </div>

                            {isEDSSHistoryVisible && (
                               <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm mt-6">
                                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                     <h4 className="text-xs font-black text-slate-800 uppercase">Histórico Detalhado</h4>
                                     <button onClick={() => setIsEDSSHistoryVisible(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times"></i></button>
                                  </div>
                                  <div className="overflow-x-auto">
                                     <table className="w-full text-left">
                                        <thead>
                                           <tr className="bg-white border-b border-slate-100">
                                              <th className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase">Data</th>
                                              <th className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase">Score</th>
                                              <th className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase">Ambulação</th>
                                              <th className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase text-center">Ação</th>
                                           </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                           {(globalMetadata[targetPatientDisplay]?.edssHistory || []).map(record => (
                                              <tr key={record.id} className="hover:bg-slate-50 transition-all">
                                                 <td className="px-6 py-1 text-xs font-bold text-slate-600">{record.date.split('-').reverse().join('/')}</td>
                                                 <td className="px-6 py-1"><span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black text-xs">{record.score.toFixed(1)}</span></td>
                                                 <td className="px-6 py-1 text-[10px] font-bold text-slate-500 uppercase">{AMBULATION_OPTIONS.find(o => o.v === record.ambulation)?.l || record.ambulation}</td>
                                                 <td className="px-6 py-1 text-center">
                                                    <button 
                                                      onClick={() => {
                                                         const target = targetPatientDisplay;
                                                         const updated = globalMetadata[target].edssHistory?.filter(r => r.id !== record.id);
                                                         setGlobalMetadata({ ...globalMetadata, [target]: { ...globalMetadata[target], edssHistory: updated } });
                                                      }} 
                                                      className="text-slate-300 hover:text-red-500 transition-colors"
                                                    >
                                                       <i className="fa-solid fa-trash-can"></i>
                                                    </button>
                                                 </td>
                                              </tr>
                                           ))}
                                        </tbody>
                                     </table>
                                  </div>
                               </div>
                            )}
                        </div>
                    ) : selectedScale === '9hpt' ? (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300 pb-20">
                            <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm sticky top-0 z-10">
                               <div className="flex items-center gap-4">
                                  <button onClick={() => setSelectedScale(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 text-slate-500 transition-all"><i className="fa-solid fa-chevron-left"></i></button>
                                  <div>
                                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Teste dos 9 Pinos (9HPT)</h3>
                                     <p className="text-[10px] text-indigo-500 font-bold uppercase">Motricidade Fina • Tempo em Segundos</p>
                                  </div>
                               </div>
                               <button onClick={handleSave9HPT} className="bg-indigo-600 text-white px-6 py-2 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all">Salvar Histórico</button>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm text-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cronômetro em Execução</p>
                                        <div className="text-6xl font-black text-slate-800 font-mono mb-6 tracking-tighter">
                                            {timerVal9HPT.toFixed(2)}<span className="text-2xl text-slate-400 ml-1">s</span>
                                        </div>
                                        <button 
                                            onClick={toggle9HPTTimer}
                                            className={`w-40 h-40 rounded-full border-8 transition-all flex flex-col items-center justify-center gap-2 mx-auto ${is9HPTTimerActive ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-xl'}`}
                                        >
                                            <i className={`fa-solid ${is9HPTTimerActive ? 'fa-stop' : 'fa-play'} text-4xl`}></i>
                                            <span className="text-[10px] font-black uppercase">{is9HPTTimerActive ? 'Parar' : 'Iniciar'}</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
                                            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center border-b pb-2">Mão Direita</h4>
                                            <div className="space-y-3">
                                                <button onClick={() => setActive9HPTTrial('rh1')} className={`w-full p-3 rounded-xl border-2 flex justify-between items-center transition-all ${active9HPTTrial === 'rh1' ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-600'}`}>
                                                    <span className="text-[9px] font-black uppercase">1ª Tentativa</span>
                                                    <span className="font-mono font-black">{nineHoleTrialTimes.rh1.toFixed(2)}s</span>
                                                </button>
                                                <button onClick={() => setActive9HPTTrial('rh2')} className={`w-full p-3 rounded-xl border-2 flex justify-between items-center transition-all ${active9HPTTrial === 'rh2' ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-600'}`}>
                                                    <span className="text-[9px] font-black uppercase">2ª Tentativa</span>
                                                    <span className="font-mono font-black">{nineHoleTrialTimes.rh2.toFixed(2)}s</span>
                                                </button>
                                                <div className="pt-2 border-t border-slate-100 flex justify-between items-center px-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">Média</span>
                                                    <span className="text-sm font-black text-indigo-600 italic">{((nineHoleTrialTimes.rh1 + nineHoleTrialTimes.rh2) / 2).toFixed(2)}s</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
                                            <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center border-b pb-2">Mão Esquerda</h4>
                                            <div className="space-y-3">
                                                <button onClick={() => setActive9HPTTrial('lh1')} className={`w-full p-3 rounded-xl border-2 flex justify-between items-center transition-all ${active9HPTTrial === 'lh1' ? 'border-emerald-600 bg-emerald-50 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-600'}`}>
                                                    <span className="text-[9px] font-black uppercase">1ª Tentativa</span>
                                                    <span className="font-mono font-black">{nineHoleTrialTimes.lh1.toFixed(2)}s</span>
                                                </button>
                                                <button onClick={() => setActive9HPTTrial('lh2')} className={`w-full p-3 rounded-xl border-2 flex justify-between items-center transition-all ${active9HPTTrial === 'lh2' ? 'border-emerald-600 bg-emerald-50 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-600'}`}>
                                                    <span className="text-[9px] font-black uppercase">2ª Tentativa</span>
                                                    <span className="font-mono font-black">{nineHoleTrialTimes.lh2.toFixed(2)}s</span>
                                                </button>
                                                <div className="pt-2 border-t border-slate-100 flex justify-between items-center px-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">Média</span>
                                                    <span className="text-sm font-black text-emerald-600 italic">{((nineHoleTrialTimes.lh1 + nineHoleTrialTimes.lh2) / 2).toFixed(2)}s</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-center text-[9px] text-slate-400 font-bold uppercase italic">* Clique em uma tentativa antes de iniciar o cronômetro para registrar automaticamente o tempo.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm h-fit">
                                        <div className="flex justify-between items-center mb-6">
                                           <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-chart-line text-indigo-500"></i> Evolução das Médias</h4>
                                           <button onClick={() => setIs9HPTHistoryVisible(!is9HPTHistoryVisible)} className="text-[10px] font-black text-indigo-600 uppercase">Ver Histórico Tabular</button>
                                        </div>
                                        <div className="h-64 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={nineHoleChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="date" tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} unit="s" />
                                                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="Direita" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} />
                                                    <Line type="monotone" dataKey="Esquerda" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {is9HPTHistoryVisible && (
                                        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-top-4">
                                            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                               <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Histórico de Performance</h4>
                                               <button onClick={() => setIs9HPTHistoryVisible(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times"></i></button>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-white border-b border-slate-100">
                                                            <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Data</th>
                                                            <th className="px-6 py-3 text-[10px] font-black text-indigo-600 uppercase text-center">Média Dir.</th>
                                                            <th className="px-6 py-3 text-[10px] font-black text-emerald-600 uppercase text-center">Média Esq.</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {(globalMetadata[targetPatientDisplay]?.nineHoleHistory || []).map(record => (
                                                            <tr key={record.id} className="hover:bg-slate-50 transition-all">
                                                                <td className="px-6 py-2 text-xs font-bold text-slate-600">{record.date.split('-').reverse().join('/')}</td>
                                                                <td className="px-6 py-2 text-center"><span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black text-xs font-mono">{record.rightAverage.toFixed(2)}s</span></td>
                                                                <td className="px-6 py-2 text-center"><span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-black text-xs font-mono">{record.leftAverage.toFixed(2)}s</span></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : selectedScale === 't25fw' ? (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300 pb-20">
                            <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm sticky top-0 z-10">
                               <div className="flex items-center gap-4">
                                  <button onClick={() => setSelectedScale(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 text-slate-500 transition-all"><i className="fa-solid fa-chevron-left"></i></button>
                                  <div>
                                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Teste dos 25 Pés (T25FW)</h3>
                                     <p className="text-[10px] text-indigo-500 font-bold uppercase">Mobilidade de Marcha • Tempo em Segundos</p>
                                  </div>
                               </div>
                               <button onClick={handleSaveT25FW} className="bg-indigo-600 text-white px-6 py-2 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all">Salvar Histórico</button>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm text-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cronômetro em Execução</p>
                                        <div className="text-6xl font-black text-slate-800 font-mono mb-6 tracking-tighter">
                                            {timerValT25FW.toFixed(2)}<span className="text-2xl text-slate-400 ml-1">s</span>
                                        </div>
                                        <button 
                                            onClick={toggleT25FWTimer}
                                            className={`w-40 h-40 rounded-full border-8 transition-all flex flex-col items-center justify-center gap-2 mx-auto ${isT25FWTimerActive ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-xl'}`}
                                        >
                                            <i className={`fa-solid ${isT25FWTimerActive ? 'fa-stop' : 'fa-play'} text-4xl`}></i>
                                            <span className="text-[10px] font-black uppercase">{isT25FWTimerActive ? 'Parar' : 'Iniciar'}</span>
                                        </button>
                                    </div>

                                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
                                        <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center border-b pb-2">Tentativas de Caminhada</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button onClick={() => setActiveT25FWTrial('t1')} className={`w-full p-4 rounded-xl border-2 flex justify-between items-center transition-all ${activeT25FWTrial === 't1' ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-600'}`}>
                                                <span className="text-[9px] font-black uppercase">1ª Ida/Volta</span>
                                                <span className="font-mono font-black">{t25fwTrialTimes.t1.toFixed(2)}s</span>
                                            </button>
                                            <button onClick={() => setActiveT25FWTrial('t2')} className={`w-full p-4 rounded-xl border-2 flex justify-between items-center transition-all ${activeT25FWTrial === 't2' ? 'border-indigo-600 bg-indigo-50 shadow-md' : 'border-slate-50 bg-slate-50 text-slate-600'}`}>
                                                <span className="text-[9px] font-black uppercase">2ª Ida/Volta</span>
                                                <span className="font-mono font-black">{t25fwTrialTimes.t2.toFixed(2)}s</span>
                                            </button>
                                        </div>
                                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center px-4">
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Média Final</span>
                                            <span className="text-2xl font-black text-indigo-600 italic">{((t25fwTrialTimes.t1 + t25fwTrialTimes.t2) / 2).toFixed(2)}s</span>
                                        </div>
                                    </div>
                                    <p className="text-center text-[9px] text-slate-400 font-bold uppercase italic">* Clique em uma tentativa antes de iniciar o cronômetro para registrar automaticamente o tempo.</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm h-fit">
                                        <div className="flex justify-between items-center mb-6">
                                           <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-chart-line text-indigo-500"></i> Evolução da Marcha</h4>
                                           <button onClick={() => setIsT25FWHistoryVisible(!isT25FWHistoryVisible)} className="text-[10px] font-black text-indigo-600 uppercase">Ver Histórico Tabular</button>
                                        </div>
                                        <div className="h-64 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={t25fwChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="date" tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} unit="s" />
                                                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                                                    <Line type="monotone" dataKey="Tempo" stroke="#4f46e5" strokeWidth={3} dot={{ r: 6, fill: '#4f46e5' }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {isT25FWHistoryVisible && (
                                        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-top-4">
                                            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                               <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Histórico de Marcha</h4>
                                               <button onClick={() => setIsT25FWHistoryVisible(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times"></i></button>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-white border-b border-slate-100">
                                                            <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Data</th>
                                                            <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-center">T1</th>
                                                            <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-center">T2</th>
                                                            <th className="px-6 py-3 text-[10px] font-black text-indigo-600 uppercase text-center">Média</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {(globalMetadata[targetPatientDisplay]?.t25fwHistory || []).map(record => (
                                                            <tr key={record.id} className="hover:bg-slate-50 transition-all">
                                                                <td className="px-6 py-2 text-xs font-bold text-slate-600">{record.date.split('-').reverse().join('/')}</td>
                                                                <td className="px-6 py-2 text-center text-xs text-slate-400 font-mono">{record.trial1.toFixed(2)}s</td>
                                                                <td className="px-6 py-2 text-center text-xs text-slate-400 font-mono">{record.trial2.toFixed(2)}s</td>
                                                                <td className="px-6 py-2 text-center"><span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black text-xs font-mono">{record.average.toFixed(2)}s</span></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : selectedScale === 'sloan' ? (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300 pb-20">
                            <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm sticky top-0 z-10">
                               <div className="flex items-center gap-4">
                                  <button onClick={() => { setSelectedScale(null); setSloanPhase('calibration'); }} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 text-slate-500 transition-all"><i className="fa-solid fa-chevron-left"></i></button>
                                  <div>
                                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Sloan Low Contrast (LCLA)</h3>
                                     <p className="text-[10px] text-indigo-500 font-bold uppercase">Contraste de 2,5% Exatamente</p>
                                  </div>
                               </div>
                               <button onClick={() => setIsSloanHistoryVisible(!isSloanHistoryVisible)} className="text-[10px] font-black text-indigo-600 uppercase">Ver Histórico</button>
                            </div>

                            {sloanPhase === 'calibration' ? (
                                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                                    <h4 className="text-center text-xs font-black uppercase tracking-widest text-slate-500">Configuração Inicial</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                        <div className="space-y-6">
                                            <p className="text-sm font-medium text-slate-600">1. Ajuste o tamanho da tela usando um cartão de crédito como referência:</p>
                                            <div className="flex justify-center py-4">
                                                <div 
                                                    className="bg-slate-300 rounded-xl flex items-center justify-center text-slate-500 border border-slate-400 relative"
                                                    style={{ 
                                                        width: `${sloanCalibrationPx}px`, 
                                                        height: `${sloanCalibrationPx * 0.63}px`
                                                    }}
                                                >
                                                    <i className="fa-solid fa-credit-card text-4xl"></i>
                                                    <span className="absolute bottom-2 text-[8px] font-black uppercase">Cartão Real</span>
                                                </div>
                                            </div>
                                            <input 
                                                type="range" min="100" max="600" step="1" 
                                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                value={sloanCalibrationPx}
                                                onChange={e => setSloanCalibrationPx(Number(e.target.value))}
                                            />
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-sm font-medium text-slate-600 mb-4">2. Defina os parâmetros do teste:</p>
                                                <div className="space-y-4">
                                                    <div className="flex bg-slate-50 p-3 rounded-2xl border border-slate-100 items-center justify-between">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">Distância</span>
                                                        <select value={sloanDistance} onChange={e => setSloanDistance(e.target.value)} className="bg-transparent font-black text-xs text-indigo-600 outline-none">
                                                            <option value="40cm">Perto (40cm)</option>
                                                            <option value="3m">Longe (3m)</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex bg-slate-50 p-3 rounded-2xl border border-slate-100 items-center justify-between">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">Olho</span>
                                                        <div className="flex gap-1">
                                                            {['OD', 'OE', 'OU'].map(e => (
                                                                <button key={e} onClick={() => setSloanEye(e as any)} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${sloanEye === e ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>{e}</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex bg-indigo-50 p-3 rounded-2xl border border-indigo-100 items-center justify-between">
                                                        <span className="text-[10px] font-black text-indigo-600 uppercase">Contraste</span>
                                                        <span className="font-black text-xs text-indigo-600 uppercase">2,5% (Fixo)</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={startSloanTest} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                                <i className="fa-solid fa-expand"></i> Iniciar em Tela Cheia
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : sloanPhase === 'test' ? (
                                <div className={`fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-10 ${isSloanFullScreen ? 'overflow-hidden' : ''}`}>
                                    <div className="flex flex-col items-center gap-20 w-full max-w-5xl">
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Linha {sloanCurrentLine + 1} de 10 • Letra {sloanCurrentLetterInLine + 1} de 5</p>
                                            <div className="flex gap-12 items-center justify-center">
                                                {sloanTestLetters.slice(sloanCurrentLine * 5, (sloanCurrentLine * 5) + 5).map((char, idx) => (
                                                    <span 
                                                        key={idx} 
                                                        className={`font-black font-serif transition-all ${idx === sloanCurrentLetterInLine ? 'text-slate-900 scale-125 ring-2 ring-indigo-200 ring-offset-8 rounded' : 'text-slate-200'}`}
                                                        style={{ 
                                                            fontSize: `${(10 - sloanCurrentLine) * (sloanCalibrationPx * 0.08)}px`,
                                                            filter: `opacity(${sloanContrast}%)`
                                                        }}
                                                    >
                                                        {char}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-6 w-full max-w-2xl">
                                            <button onClick={handleSloanMiss} className="flex-1 py-10 bg-red-50 text-red-600 rounded-[40px] border-4 border-red-100 flex flex-col items-center justify-center gap-3 hover:bg-red-100 transition-all">
                                                <i className="fa-solid fa-xmark text-4xl"></i>
                                                <span className="font-black uppercase text-xs">ERROU ({sloanErrors}/3)</span>
                                            </button>
                                            <button onClick={handleSloanHit} className="flex-1 py-10 bg-emerald-50 text-emerald-600 rounded-[40px] border-4 border-emerald-100 flex flex-col items-center justify-center gap-3 hover:bg-emerald-100 transition-all">
                                                <i className="fa-solid fa-check text-4xl"></i>
                                                <span className="font-black uppercase text-xs">ACERTOU ({sloanLettersCorrect})</span>
                                            </button>
                                        </div>
                                    </div>
                                    <button onClick={() => setSloanPhase('calibration')} className="absolute top-8 left-8 text-slate-300 hover:text-slate-500 font-black uppercase text-[10px]"><i className="fa-solid fa-times mr-2"></i> Cancelar Teste</button>
                                </div>
                            ) : (
                                <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm text-center space-y-8 animate-in zoom-in-95">
                                    <div>
                                        <h4 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Teste Finalizado</h4>
                                        <p className="text-slate-400 font-bold uppercase text-xs">Olho {sloanEye} • {sloanDistance} • 2,5% Contraste</p>
                                    </div>

                                    <div className="flex justify-center gap-12">
                                        <div className="text-center">
                                            <p className="text-5xl font-black text-indigo-600">{sloanLettersCorrect}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Letras Corretas</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-5xl font-black text-red-400">{sloanErrors}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Erros Totais</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-sm font-medium text-slate-600">
                                        Deseja salvar este resultado no histórico do paciente?
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <button onClick={() => setSloanPhase('calibration')} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-xs">Sair Sem Salvar</button>
                                        <button onClick={startSloanTest} className="py-4 bg-amber-50 text-amber-600 rounded-2xl font-black uppercase text-xs border border-amber-200">Repetir Teste</button>
                                        <button onClick={handleSaveSloan} className="py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-100">Sim, Salvar e Sair</button>
                                    </div>
                                </div>
                            )}

                            {isSloanHistoryVisible && (
                                <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-top-4 mt-8">
                                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Histórico de Performance LCLA</h4>
                                        <button onClick={() => setIsSloanHistoryVisible(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times"></i></button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-white border-b border-slate-100">
                                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Data</th>
                                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Olho</th>
                                                    <th className="px-6 py-3 text-[10px] font-black text-indigo-600 uppercase text-center">Score</th>
                                                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {(globalMetadata[targetPatientDisplay]?.sloanHistory || []).map(record => (
                                                    <tr key={record.id} className={`hover:bg-slate-50 transition-all ${record.worsening ? 'bg-red-50/50' : ''}`}>
                                                        <td className="px-6 py-2 text-xs font-bold text-slate-600">{record.date.split('-').reverse().join('/')}</td>
                                                        <td className="px-6 py-2 text-xs font-black text-indigo-500 uppercase">{record.eye}</td>
                                                        <td className="px-6 py-2 text-center"><span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black text-xs font-mono">{record.lettersCorrect}/50</span></td>
                                                        <td className="px-6 py-2 text-center">
                                                            {record.worsening ? (
                                                                <span className="text-[8px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded uppercase flex items-center gap-1"><i className="fa-solid fa-triangle-exclamation"></i> PIORA (−7)</span>
                                                            ) : (
                                                                <span className="text-[8px] font-black text-emerald-600 uppercase">Estável</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 uppercase mb-2 tracking-tighter flex items-center gap-3">
                                    <i className="fa-solid fa-square-poll-vertical text-indigo-600"></i> Escalas e Scores Clínicos
                                </h3>
                                <p className="text-xs text-slate-500 font-medium uppercase">Ferramentas de suporte à decision clínica e triagem para {targetPatientDisplay || '...'}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {medicalScales.map(scale => (
                                    <button 
                                        key={scale.id} 
                                        onClick={() => setSelectedScale(scale.id)} 
                                        className="bg-white p-8 rounded-[48px] border border-slate-200 shadow-sm hover:border-indigo-600 hover:shadow-xl hover:scale-[1.02] transition-all text-left group relative overflow-hidden h-48 flex flex-col justify-between"
                                    >
                                        <div className="absolute -top-4 -right-4 w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center transition-all group-hover:bg-indigo-50">
                                            <i className={`fa-solid ${scale.id === 'edss' ? 'fa-wheelchair' : scale.id === '9hpt' ? 'fa-hand-dots' : scale.id === 't25fw' ? 'fa-person-walking' : scale.id === 'sloan' ? 'fa-eye-low-vision' : scale.id === 'meem' ? 'fa-brain' : 'fa-face-smile'} text-slate-200 group-hover:text-indigo-200 text-2xl`}></i>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-indigo-500 uppercase mb-2 tracking-[0.2em]">{scale.category}</p>
                                            <h4 className="font-black text-slate-800 uppercase text-sm group-hover:text-indigo-600 leading-snug">{scale.name}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <span>Abrir Calculadora</span>
                                            <i className="fa-solid fa-arrow-right-long text-[8px] group-hover:translate-x-1 transition-transform"></i>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
          </div>
        </div>
      </div>

      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[48px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95">
              <h3 className="text-2xl font-black text-slate-800 mb-8 uppercase tracking-tighter text-center">Finalizar Atendimento</h3>
              <div className="space-y-6">
                <button onClick={handleCheckoutSave} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-lg shadow-xl uppercase hover:bg-indigo-700 transition-all">Confirmar e Salvar</button>
                <button onClick={() => setIsCheckoutOpen(false)} className="w-full py-2 text-slate-300 font-black uppercase text-xs">Cancelar</button>
              </div>
           </div>
        </div>
      )}

      {isPrintModalOpen && docToPrint !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
           <div className="bg-white rounded-[48px] w-full max-w-6xl p-8 md:p-10 shadow-2xl animate-in zoom-in-95 flex flex-col my-auto min-h-[95vh]">
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                <div>
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Pré-visualização de Impressão (A4)</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ajuste o conteúdo e formatação antes de gerar o arquivo final</p>
                </div>
                <button onClick={() => setIsPrintModalOpen(false)} className="text-slate-300 hover:text-slate-500 transition-colors"><i className="fa-solid fa-times text-2xl"></i></button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 flex-1">
                 {/* Coluna de Preview (A4 Simulado) */}
                 <div className="xl:col-span-3 overflow-y-auto max-h-[75vh] bg-slate-100 p-4 md:p-10 rounded-[40px] shadow-inner border border-slate-200">
                    <div className="bg-white w-full max-w-[210mm] mx-auto min-h-[297mm] shadow-xl p-[1.5cm] flex flex-col font-sans text-slate-900 relative transition-all">
                        
                        {/* Header Preview */}
                        <div className="border-bottom border-slate-700 pb-4 mb-6 flex items-center justify-center relative min-h-[80px]">
                            {clinicConfig?.logo && <img src={clinicConfig.logo} className="absolute left-0 top-0 max-w-[80px] max-h-[80px] object-contain" alt="Logo" />}
                            <div className="text-center">
                                <h1 className="text-xl font-black uppercase m-0">{clinicConfig?.doctorName}</h1>
                                <p className="text-sm font-bold text-slate-600 m-0 mt-1">{clinicConfig?.specialty}</p>
                                <p className="text-[11px] font-bold text-slate-400 m-0 mt-0.5">CRM {clinicConfig?.crm} {clinicConfig?.rqe ? `| RQE ${clinicConfig?.rqe}` : ''}</p>
                            </div>
                        </div>

                        {/* Patient Name Preview */}
                        <div className="mb-6 font-bold text-sm">
                            Paciente: {targetPatientDisplay || '_________________________________'}
                        </div>

                        {/* Body Preview (Editable Textarea) */}
                        <div className="flex-1">
                            <textarea 
                                className={`w-full h-full min-h-[550px] border-none font-medium text-slate-700 outline-none resize-none bg-transparent leading-relaxed`}
                                style={{ 
                                    fontSize: `${printFontSize}px`, 
                                    lineHeight: printLineHeight,
                                    fontWeight: printIsBold ? 'bold' : 'normal',
                                    fontStyle: printIsItalic ? 'italic' : 'normal'
                                }}
                                value={docToPrint}
                                onChange={(e) => setDocToPrint(e.target.value)}
                                placeholder="Conteúdo do documento..."
                            />
                        </div>

                        {/* Date Preview */}
                        <div className="mt-8 font-bold text-sm text-left">
                            Data: {printDateMode === 'current' ? new Date().toLocaleDateString('pt-BR') : printDateMode === 'multiple' ? `${months[printStartMonth]} de ${printStartYear}` : '___/___/______'}
                        </div>

                        {/* Footer Preview */}
                        <div className="border-t border-slate-200 pt-4 mt-10 text-center text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                            <p className="m-0 font-black">{clinicConfig?.locations[0]?.name}</p>
                            <p className="m-0 mt-1">{clinicConfig?.locations[0]?.address}</p>
                            <p className="m-0 mt-0.5">{clinicConfig?.locations[0]?.phone} {clinicConfig?.locations[0]?.whatsapp && `| ${clinicConfig?.locations[0]?.whatsapp}`} {clinicConfig?.locations[0]?.email && `| ${clinicConfig?.locations[0]?.email}`}</p>
                        </div>
                    </div>
                 </div>

                 {/* Coluna de Configuração e Estilo */}
                 <div className="xl:col-span-1 space-y-6 flex flex-col h-full">
                    <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 space-y-4">
                       <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-font"></i> Formatação de Texto</h4>
                       
                       <div className="space-y-3">
                          <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">Tamanho da Letra</label>
                                <span className="text-[10px] font-black text-indigo-600">{printFontSize}px</span>
                            </div>
                            <input 
                                type="range" min="10" max="24" step="1" 
                                className="w-full h-1.5 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                value={printFontSize}
                                onChange={e => setPrintFontSize(Number(e.target.value))}
                            />
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">Espaçamento Entre Linhas</label>
                                <span className="text-[10px] font-black text-indigo-600">{printLineHeight}</span>
                            </div>
                            <input 
                                type="range" min="1" max="2.5" step="0.1" 
                                className="w-full h-1.5 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                value={printLineHeight}
                                onChange={e => setPrintLineHeight(Number(e.target.value))}
                            />
                          </div>

                          <div className="flex gap-2">
                             <button 
                                onClick={() => setPrintIsBold(!printIsBold)}
                                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${printIsBold ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200'}`}
                             >
                                <i className="fa-solid fa-bold"></i> Negrito
                             </button>
                             <button 
                                onClick={() => setPrintIsItalic(!printIsItalic)}
                                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${printIsItalic ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200'}`}
                             >
                                <i className="fa-solid fa-italic"></i> Itálico
                             </button>
                          </div>
                       </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-sm">
                       <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-calendar-day"></i> Configuração de Data</h4>
                       <div className="flex bg-slate-50 p-1 rounded-2xl gap-1 border border-slate-100">
                          <button onClick={() => setPrintDateMode('none')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${printDateMode === 'none' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Sem Data</button>
                          <button onClick={() => setPrintDateMode('current')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${printDateMode === 'current' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Hoje</button>
                          <button onClick={() => setPrintDateMode('multiple')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${printDateMode === 'multiple' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>Múltiplas</button>
                       </div>

                       {printDateMode === 'multiple' && (
                          <div className="space-y-4 pt-2 animate-in slide-in-from-top-2">
                             <div className="grid grid-cols-2 gap-3">
                                <div>
                                   <label className="text-[8px] font-black text-slate-400 uppercase ml-2 mb-1 block">Mês Inicial</label>
                                   <select value={printStartMonth} onChange={e => setPrintStartMonth(Number(e.target.value))} className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-bold text-xs uppercase cursor-pointer">
                                      {months.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
                                   </select>
                                </div>
                                <div>
                                   <label className="text-[8px] font-black text-slate-400 uppercase ml-2 mb-1 block">Ano Inicial</label>
                                   <select value={printStartYear} onChange={e => setPrintStartYear(Number(e.target.value))} className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-bold text-xs uppercase cursor-pointer">
                                      {yearsArr.map(y => <option key={y} value={y}>{y}</option>)}
                                   </select>
                                </div>
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                                <div>
                                   <label className="text-[8px] font-black text-slate-400 uppercase ml-2 mb-1 block">Qtd. de Meses</label>
                                   <input type="number" min="1" max="12" value={printMonthCount} onChange={e => setPrintMonthCount(Number(e.target.value))} className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-bold text-xs" />
                                </div>
                                <div>
                                   <label className="text-[8px] font-black text-slate-400 uppercase ml-2 mb-1 block">Vias por Mês</label>
                                   <input type="number" min="1" max="5" value={printCopiesPerMonth} onChange={e => setPrintCopiesPerMonth(Number(e.target.value))} className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-100 font-bold text-xs" />
                                </div>
                             </div>
                          </div>
                       )}
                    </div>

                    <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 space-y-4">
                       <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-folder-open"></i> Destino no Histórico</h4>
                       <select value={printCategory} onChange={e => setPrintCategory(e.target.value)} className="w-full p-3.5 rounded-xl bg-white border border-emerald-100 font-black text-xs uppercase cursor-pointer shadow-sm">
                          {historyCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                       </select>
                    </div>

                    <div className="mt-auto pt-6 space-y-3">
                        <button 
                            onClick={executeFinalPrint}
                            className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <i className="fa-solid fa-print"></i>
                            Gerar Impressão Final
                        </button>
                        <p className="text-[9px] text-slate-400 font-bold uppercase text-center italic">* O documento será salvo automaticamente no histórico após imprimir.</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isSaveCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
           <div className="bg-white rounded-[48px] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95">
              <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter text-center">Salvar no Histórico</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase text-center mb-6 tracking-widest">Onde deseja arquivar este documento?</p>
              <div className="grid grid-cols-1 gap-3">
                 {historyCategories.map(cat => (
                    <button 
                      key={cat} 
                      onClick={() => handleSaveToCategory(cat)}
                      className="w-full py-4 bg-slate-50 border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 rounded-2xl font-black text-xs uppercase transition-all"
                    >
                       {cat}
                    </button>
                 ))}
              </div>
              <button onClick={() => setIsSaveCategoryModalOpen(false)} className="w-full mt-6 py-2 text-slate-300 font-black uppercase text-[10px]">Cancelar</button>
           </div>
        </div>
      )}

      {showExtractedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
           <div className="bg-white rounded-[48px] w-full max-w-2xl p-10 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Dados Extraídos dos Arquivos</h3>
                 <button onClick={() => setShowExtractedModal(false)} className="text-slate-300 hover:text-slate-500"><i className="fa-solid fa-times text-2xl"></i></button>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-4 tracking-widest">Confira e edite as informações extraídas antes de utilizar.</p>
              <textarea 
                 className="flex-1 w-full p-6 rounded-[32px] bg-slate-50 border-none font-medium text-sm text-slate-700 leading-loose shadow-inner outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                 value={extractedExamsResult}
                 onChange={e => setExtractedExamsResult(e.target.value)}
              />
              <div className="mt-8 flex gap-4">
                 <button onClick={() => setShowExtractedModal(false)} className="flex-1 py-4 text-slate-300 font-black uppercase text-[10px]">Fechar</button>
                 <button 
                    onClick={() => {
                       setExamInput(prev => (prev.trim() + (prev.trim() ? "\n\n" : "") + extractedExamsResult).trim());
                       setShowExtractedModal(false);
                       setActiveRightTab('exames');
                       confirm({ type: 'alert', title: 'Dados Carregados', message: 'As informações extraídas foram enviadas para a aba "Exames IA" para tabulação final.' });
                    }}
                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl uppercase hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                 >
                    <i className="fa-solid fa-table-list"></i> Enviar para Tabulação
                 </button>
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
                  <button onClick={handleGeneratePortalLink} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-indigo-700">Gerar Link p/ {targetPatientDisplay}</button>
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

      {viewingFile && (
         <div className="fixed inset-0 bg-slate-950/90 z-[100] flex flex-col items-center justify-center p-4">
            <button onClick={() => setViewingFile(null)} className="absolute top-8 right-8 text-white text-3xl hover:scale-110 transition-transform"><i className="fa-solid fa-times"></i></button>
            <div className="max-w-4xl max-h-[80vh] w-full flex items-center justify-center overflow-hidden">
               {viewingFile.url.startsWith('data:image') || viewingFile.type === 'photo' ? (
                  <img src={viewingFile.url} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" alt={viewingFile.name} />
               ) : viewingFile.type === 'video' ? (
                  <video src={viewingFile.url} controls className="max-w-full max-h-full rounded-2xl shadow-2xl" />
               ) : viewingFile.extension === 'pdf' ? (
                  <iframe src={viewingFile.url} className="w-full h-screen rounded-2xl shadow-2xl border-none" title={viewingFile.name}></iframe>
               ) : (
                  <div className="bg-white p-20 rounded-[40px] text-center max-w-md">
                     <i className="fa-solid fa-file-circle-question text-6xl text-slate-200 mb-6"></i>
                     <p className="font-black text-slate-800 uppercase tracking-tighter">Pré-visualização Indisponível</p>
                     <a href={viewingFile.url} download={viewingFile.name} className="mt-8 inline-block bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black uppercase shadow-xl hover:bg-indigo-700 transition-all">Baixar Arquivo</a>
                  </div>
               )}
            </div>
            <p className="text-white/60 mt-8 font-black uppercase tracking-[0.2em] text-[10px]">{viewingFile.name}</p>
         </div>
      )}

      {viewingExamHistoryText && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[48px] p-10 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Texto Original do Exame</h3>
                  <button onClick={() => setViewingExamHistoryText(null)} className="text-slate-300 hover:text-slate-500"><i className="fa-solid fa-xmark text-2xl"></i></button>
               </div>
               <div className="flex-1 overflow-y-auto bg-slate-50 p-8 rounded-[32px] text-sm font-medium text-slate-600 whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-100">
                  {viewingExamHistoryText}
               </div>
               <button onClick={() => setViewingExamHistoryText(null)} className="w-full mt-8 py-5 bg-indigo-600 text-white rounded-[24px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all">Fechar Visualização</button>
            </div>
         </div>
      )}

      {viewingNote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[48px] p-10 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Observação do Atendimento</h3>
                 <button onClick={() => setViewingNote(null)} className="text-slate-300 hover:text-slate-500"><i className="fa-solid fa-times text-xl"></i></button>
              </div>
              <div className="bg-slate-50 p-6 rounded-[32px] text-sm font-medium text-slate-600 whitespace-pre-wrap shadow-inner border border-slate-100">
                 {viewingNote}
              </div>
              <button onClick={() => setViewingNote(null)} className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-[24px] font-black uppercase">Fechar</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default EMREditor;