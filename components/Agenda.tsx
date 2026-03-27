import React, { useState, useMemo, useEffect } from 'react';
import { useConfirm } from '../ConfirmContext';
import { DaySchedule, Appointment, PaymentMethod, WaitlistPatient, ClinicConfig, LocationInfo, PatientMetadata, PatientTag, AppointmentType, PriceTable, SplitPayment, FollowUpRule } from '../types';

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const roundUpTo15 = (date: Date) => {
  const minutes = 15;
  const ms = 1000 * 60 * minutes;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
};

const formatHHMM = (date: Date) => {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

interface AgendaProps {
  data: Record<string, DaySchedule>;
  waitlist: WaitlistPatient[];
  config: ClinicConfig;
  patientMetadata: PatientMetadata;
  onUpdateConfig: (config: ClinicConfig) => void;
  setPatientMetadata: (meta: PatientMetadata) => void;
  onUpdateAppointment: (date: string, apt: Appointment) => void;
  onAddAppointment: (date: string, apt: Appointment) => void;
  onDeleteAppointment: (date: string, aptId: string) => void;
  onPromoteFromWaitlist: (patientId: string, date: string, apt: Appointment) => void;
  onAddToWaitlist: (patient: WaitlistPatient) => void;
  onRemoveFromWaitlist: (patientId: string) => void;
  onUpdateWaitlist?: (patient: WaitlistPatient) => void;
  onOpenPatientInfo?: (patientName: string) => void;
  onStartConsultation?: (patientName: string) => void;
  onUpdateDaySchedule?: (date: string, updates: Partial<DaySchedule>) => void;
}

const Agenda: React.FC<AgendaProps> = ({ 
  data, 
  waitlist, 
  config,
  patientMetadata,
  onUpdateConfig,
  setPatientMetadata,
  onUpdateAppointment, 
  onAddAppointment, 
  onDeleteAppointment,
  onPromoteFromWaitlist,
  onAddToWaitlist,
  onRemoveFromWaitlist,
  onUpdateWaitlist,
  onOpenPatientInfo,
  onStartConsultation,
  onUpdateDaySchedule
}) => {
  const [activeModal, setActiveModal] = useState<'none' | 'checkin' | 'checkout' | 'add' | 'settings' | 'add_waitlist' | 'edit_patient' | 'create_tag'>('none');
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [waitlistPatientToSchedule, setWaitlistPatientToSchedule] = useState<WaitlistPatient | null>(null);
  const confirm = useConfirm();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBookingDate, setSelectedBookingDate] = useState(new Date().toISOString().split('T')[0]);

  const [newWaitlist, setNewWaitlist] = useState<Partial<WaitlistPatient>>({ name: '', phone: '', city: '', type: 'consulta', notes: '' });
  const [waitlistUnifiedType, setWaitlistUnifiedType] = useState('Particular');
  const [appointmentTimeMode, setAppointmentTimeMode] = useState<'now' | 'defined'>('defined');
  const [viewMode, setViewMode] = useState<'cards' | 'grid'>('cards');
  const [waitPanelOpen, setWaitPanelOpen] = useState(false);
  const [waitPanelTab, setWaitPanelTab] = useState<'consultas' | 'retornos'>('consultas');

  // Estado para novo agendamento
  const [isManualTime, setIsManualTime] = useState(false);
  const [unifiedType, setUnifiedType] = useState('Particular');
  const [isBlocking, setIsBlocking] = useState(false); // Estado para Bloqueio
  
  // Estado para Bloqueio de Período
  const [blockEndTime, setBlockEndTime] = useState<string>('');

  // Estados para Calculadora no Checkin
  const [showCalc, setShowCalc] = useState(false);
  const [calcType, setCalcType] = useState<'acrescimo' | 'desconto'>('acrescimo');
  const [calcRate, setCalcRate] = useState<string>('');

  // Estados para múltiplos pagamentos no Checkin
  const [paymentInput, setPaymentInput] = useState<string>('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<PaymentMethod | null>(null);

  // Estado para busca de tags no checkout
  const [tagSearch, setTagSearch] = useState('');
  
  // Estados para Criação de Tag com Regras
  const [newTagData, setNewTagData] = useState<Partial<PatientTag>>({ name: '', color: '', followUpRules: [] });
  const [tempTagRule, setTempTagRule] = useState<{ amount: string, unit: 'days'|'weeks'|'months' }>({ amount: '1', unit: 'months' });
  const [enableNewTagProtocol, setEnableNewTagProtocol] = useState(false);

  const [newApt, setNewApt] = useState<Partial<Appointment>>({
    time: '',
    patientName: '',
    phone: '',
    cpf: '',
    age: '',
    cityState: '',
    additionalPhone: '',
    priceTable: 'Particular',
    expectedValue: 600,
    mode: 'Presencial',
    type: 'consulta',
    status: 'agendado',
    confirmed: false,
    notes: '',
    locationId: '',
    duration: 45 // Valor padrão inicial
  });

  // Atualiza newApt quando o tipo unificado muda
  useEffect(() => {
    if (isBlocking) return;
    
    // Busca na configuração dinâmica primeiro
    const selectedTypeConfig = config.consultationTypes?.find(t => t.name === unifiedType);
    
    if (selectedTypeConfig) {
       setNewApt(prev => ({
          ...prev,
          type: selectedTypeConfig.category,
          priceTable: selectedTypeConfig.name,
          expectedValue: selectedTypeConfig.defaultValue
       }));
    } else {
       // Fallback para hardcoded se não encontrar (segurança legado)
       if (unifiedType === 'Particular') {
         setNewApt(prev => ({ ...prev, type: 'consulta', priceTable: 'Particular', expectedValue: 600 }));
       } else if (unifiedType === 'Social') {
         setNewApt(prev => ({ ...prev, type: 'consulta', priceTable: 'Social', expectedValue: 400 }));
       } else if (unifiedType === 'Cortesia') {
         setNewApt(prev => ({ ...prev, type: 'cortesia', priceTable: 'Cortesia', expectedValue: 0 }));
       } else if (unifiedType === 'Retorno') {
         setNewApt(prev => ({ ...prev, type: 'retorno', priceTable: 'Particular', expectedValue: 0 }));
       }
    }
  }, [unifiedType, isBlocking, config.consultationTypes]);

  // Atualiza newWaitlist quando waitlistUnifiedType muda
  useEffect(() => {
    if (activeModal !== 'add_waitlist') return;
    
    const selectedTypeConfig = config.consultationTypes?.find(t => t.name === waitlistUnifiedType);
    
    if (selectedTypeConfig) {
       setNewWaitlist(prev => ({ ...prev, type: selectedTypeConfig.category, priceTable: selectedTypeConfig.name }));
    } else {
        // Fallback
        let type: AppointmentType = 'consulta';
        let priceTable: PriceTable = 'Particular';
        
        if (waitlistUnifiedType === 'Particular') {
          type = 'consulta'; priceTable = 'Particular';
        } else if (waitlistUnifiedType === 'Social') {
          type = 'consulta'; priceTable = 'Social';
        } else if (waitlistUnifiedType === 'Cortesia') {
          type = 'cortesia'; priceTable = 'Cortesia';
        } else if (waitlistUnifiedType === 'Retorno') {
          type = 'retorno'; priceTable = 'Particular';
        }
        setNewWaitlist(prev => ({ ...prev, type, priceTable }));
    }
  }, [waitlistUnifiedType, activeModal, config.consultationTypes]);

  const toggleBlockingMode = () => {
    if (!isBlocking) {
      // Ativar Bloqueio
      setIsBlocking(true);
      setNewApt(prev => ({ 
        ...prev, 
        patientName: 'BLOQUEIO ADMINISTRATIVO', 
        type: 'bloqueio', 
        phone: '-', 
        priceTable: 'Cortesia', 
        expectedValue: 0 
      }));
      setBlockEndTime('');
    } else {
      // Desativar Bloqueio
      setIsBlocking(false);
      setNewApt(prev => ({ 
        ...prev, 
        patientName: '', 
        type: 'consulta', 
        phone: '', 
        priceTable: 'Particular', 
        expectedValue: 600 
      }));
      setUnifiedType('Particular');
    }
  };

  const existingPatients = useMemo(() => {
    const names = new Set<string>();
    const patients: Partial<Appointment>[] = [];
    (Object.values(data) as DaySchedule[]).forEach(day => {
      day.appointments.forEach(apt => {
        if (!names.has(apt.patientName)) {
          names.add(apt.patientName);
          patients.push(apt);
        }
      });
    });
    return patients;
  }, [data]);

  const [patientSearch, setPatientSearch] = useState('');
  const filteredExistingPatients = useMemo(() => {
    if (patientSearch.length < 2) return [];
    return existingPatients.filter(p => p.patientName?.toLowerCase().includes(patientSearch.toLowerCase()));
  }, [existingPatients, patientSearch]);

  const yearsArr = useMemo(() => {
    const current = new Date().getFullYear();
    const arr = [];
    for (let i = 0; i <= 5; i++) arr.push((current + i).toString());
    return arr;
  }, []);

  // Helper para gerar slots baseados no local ativo (Agora suporta múltiplos períodos)
  const getSlotsForDay = (location: LocationInfo | undefined, dayIndex: number) => {
    if (!location || !location.schedule) return [];
    
    // Busca TODOS os agendamentos ativos para este dia (suporte a múltiplos turnos)
    const daySchedules = location.schedule.filter(s => s.dayOfWeek === dayIndex && s.active);
    if (daySchedules.length === 0) return [];

    let allSlots: string[] = [];
    const duration = location.slotDuration || 45;

    daySchedules.forEach(schedule => {
        const [startH, startM] = schedule.start.split(':').map(Number);
        const [endH, endM] = schedule.end.split(':').map(Number);
        
        let current = new Date();
        current.setHours(startH, startM, 0, 0);
        const endTime = new Date();
        endTime.setHours(endH, endM, 0, 0);

        while (current < endTime) {
          allSlots.push(current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
          current.setMinutes(current.getMinutes() + duration);
        }
    });
    
    // Remove duplicatas e ordena
    return [...new Set(allSlots)].sort();
  };

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); 
    start.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayIndex = d.getDay();
      
      const activeLocation = config.locations.find(loc => 
        loc.schedule && loc.schedule.some(s => s.dayOfWeek === dayIndex && s.active)
      );

      // Gerar slots livres para este dia específico
      const generatedSlots = getSlotsForDay(activeLocation, dayIndex);

      days.push({
        date: iso,
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        weekday: d.toLocaleDateString('pt-BR', { weekday: 'long' }),
        dayIndex,
        activeLocation,
        generatedSlots
      });
    }
    return days;
  }, [currentDate, config.locations]);

  const visibleWeekDays = useMemo(() => {
    return weekDays.filter(dayInfo => {
      const isWeekend = dayInfo.dayIndex === 0 || dayInfo.dayIndex === 6;
      if (!isWeekend) return true;

      // 1) Houver agenda configurada ativa para esse dia
      if (dayInfo.activeLocation) return true;

      // 2) Houver pelo menos um agendamento nesse dia na semana atual (status diferente de 'cancelado')
      const dayData = data[dayInfo.date];
      const hasAppointments = dayData && dayData.appointments.some(a => a.status !== 'cancelado');
      if (hasAppointments) return true;

      return false;
    });
  }, [weekDays, config.locations, data]);

  const visibleWeekDaysForGrid = useMemo(() => {
    return weekDays.filter(dayInfo => {
      const dayIndex = dayInfo.dayIndex;
      const isWeekend = (dayIndex === 0 || dayIndex === 6);
      if (!isWeekend) return true;

      const hasAnyAppointment = Boolean((data[dayInfo.date]?.appointments || []).some(a => a.status ? a.status !== 'cancelado' : true));
      const hasConfiguredSchedule = config.locations.some(loc => 
        loc.schedule && loc.schedule.some(s => s.dayOfWeek === dayIndex && s.active)
      );

      return hasConfiguredSchedule || hasAnyAppointment;
    });
  }, [weekDays, data, config.locations]);

  const hours = useMemo(() => {
    const h = [];
    for (let i = 7; i <= 20; i++) {
      for (let j = 0; j < 60; j += 15) {
        if (i === 20 && j > 0) break;
        h.push(`${i.toString().padStart(2, '0')}:${j.toString().padStart(2, '0')}`);
      }
    }
    return h;
  }, []);

  // Slots para o modal de agendamento (usa o local selecionado ou o padrão do dia)
  const availableTimeSlotsForModal = useMemo(() => {
    if (!selectedBookingDate) return [];
    const d = new Date(selectedBookingDate + 'T00:00:00');
    const dayIndex = d.getDay();
    
    // Tenta usar o local selecionado no modal, senão o local padrão do dia
    let loc = config.locations.find(l => l.id === newApt.locationId);
    if (!loc) {
        loc = config.locations.find(l => l.schedule && l.schedule.some(s => s.dayOfWeek === dayIndex && s.active));
    }
    
    return getSlotsForDay(loc, dayIndex);
  }, [selectedBookingDate, newApt.locationId, config.locations]);


  const SCHEME_UI = {
    pill: "border px-1.5 py-0.5 rounded-md",
    btn: "text-[11px] font-black px-1.5",
    count: "text-[10px] font-bold",
    abbrev: "text-[8px] font-semibold uppercase",
    gap: "gap-1"
  };

  const renderSchemeRow = (dayInfo: any) => (
    <div className={`bg-slate-50/80 p-0 border-b border-slate-100 flex flex-wrap ${SCHEME_UI.gap} justify-center`}>
      {config.consultationTypes?.map(type => {
        const dayData = data[dayInfo.date];
        const dayScheme = dayData?.dailyScheme;
        const globalScheme = (config.confirmationConfig?.dailySchemes || []).find(s => s.dayOfWeek === dayInfo.dayIndex);
        
        let count = 0;
        if (dayScheme) {
          count = dayScheme.find(i => i.type === type.name)?.count || 0;
        } else {
          count = globalScheme?.items.find(i => i.type === type.name)?.count || 0;
        }
        
        return (
          <div key={type.id} className={`flex items-center ${SCHEME_UI.gap} ${SCHEME_UI.pill} transition-all ${
              count > 0 ? 'bg-white border-slate-200' : 'bg-slate-100/50 border-transparent'
            }`}>
            <button 
              onClick={() => handleSchemeChange(dayInfo.date, dayInfo.dayIndex, type.name, count, -1)}
              className={`${SCHEME_UI.btn} text-slate-400 hover:text-red-500 transition-colors`}
            >-</button>
            <span className={`${SCHEME_UI.count} uppercase ${count > 0 ? 'text-slate-600' : 'text-slate-300'}`}>{count}</span>
            <button 
              onClick={() => handleSchemeChange(dayInfo.date, dayInfo.dayIndex, type.name, count, 1)}
              className={`${SCHEME_UI.btn} text-slate-400 hover:text-emerald-500 transition-colors`}
            >+</button>
            <span className={`${SCHEME_UI.abbrev} ml-0.5 ${count > 0 ? 'text-slate-400' : 'text-slate-300'}`}>{type.name.substring(0, 3)}</span>
          </div>
        );
      })}
      {(!(config.consultationTypes || []).length) && (
        <span className="text-[6px] font-bold text-slate-300 uppercase italic">Sem tipos</span>
      )}
    </div>
  );

  const getDayPeriodRange = (dayInfo: any) => {
    const loc = dayInfo.activeLocation;
    const dayData = data[dayInfo.date];
    const appointments = dayData?.appointments || [];
    
    let minStart = 24 * 60;
    let maxEnd = 0;
    let found = false;

    if (loc && loc.schedule) {
      const daySchedules = loc.schedule.filter((s: any) => s.dayOfWeek === dayInfo.dayIndex && s.active);
      daySchedules.forEach((s: any) => {
        const [sh, sm] = s.start.split(':').map(Number);
        const [eh, em] = s.end.split(':').map(Number);
        const start = sh * 60 + sm;
        const end = eh * 60 + em;
        if (start < minStart) minStart = start;
        if (end > maxEnd) maxEnd = end;
        found = true;
      });
    }

    appointments.forEach((apt: any) => {
      if (apt.status === 'cancelado') return;
      const [h, m] = apt.time.split(':').map(Number);
      const start = h * 60 + m;
      const end = start + (apt.duration || 45);
      if (start < minStart) minStart = start;
      if (end > maxEnd) maxEnd = end;
      found = true;
    });

    if (!found) return null;

    return {
      startMin: minStart,
      endMin: maxEnd,
      color: loc?.color || '#6366f1'
    };
  };

  const handleSaveAppointment = () => {
    // Lógica para Bloqueio de Período
    if (isBlocking && newApt.time && selectedBookingDate) {
       const slots = availableTimeSlotsForModal;
       const startIndex = slots.indexOf(newApt.time);
       let endIndex = blockEndTime ? slots.indexOf(blockEndTime) : startIndex;
       
       // Se o usuário selecionou final vazio ou anterior ao inicio, assume apenas o slot inicial
       if (endIndex < startIndex) endIndex = startIndex;

       const slotsToBlock = slots.slice(startIndex, endIndex + 1);
       
       let finalLocationId = newApt.locationId;
        if (!finalLocationId) {
           const d = new Date(selectedBookingDate + 'T00:00:00');
           const dayIndex = d.getDay();
           const defaultLoc = config.locations.find(loc => loc.schedule?.some(s => s.dayOfWeek === dayIndex && s.active));
           if (defaultLoc) finalLocationId = defaultLoc.id;
        }

       slotsToBlock.forEach(time => {
          // Verifica se já existe agendamento neste horário
          const isOccupied = data[selectedBookingDate]?.appointments.some(a => a.time === time && a.status !== 'cancelado');
          if (!isOccupied) {
             const apt: Appointment = {
                ...newApt as Appointment,
                time: time,
                id: `block-${Date.now()}-${time.replace(':','')}`,
                date: selectedBookingDate,
                period: parseInt(time.split(':')[0]) < 12 ? 'matutino' : 'vespertino',
                status: 'agendado',
                locationId: finalLocationId
             };
             onAddAppointment(selectedBookingDate, apt);
          }
       });

       setActiveModal('none');
       resetNewAptForm();
       return;
    }

    if (newApt.patientName && newApt.time && selectedBookingDate) {
      const isRetorno = newApt.type === 'retorno';
      
      let finalLocationId = newApt.locationId;
      if (!finalLocationId) {
         const d = new Date(selectedBookingDate + 'T00:00:00');
         const dayIndex = d.getDay();
         const defaultLoc = config.locations.find(loc => loc.schedule?.some(s => s.dayOfWeek === dayIndex && s.active));
         if (defaultLoc) finalLocationId = defaultLoc.id;
      }

      const apt: Appointment = {
        ...newApt as Appointment,
        id: `apt-${Date.now()}`,
        date: selectedBookingDate,
        expectedValue: isRetorno ? 0 : (newApt.expectedValue || 600),
        period: parseInt(newApt.time.split(':')[0]) < 12 ? 'matutino' : 'vespertino',
        status: 'agendado',
        locationId: finalLocationId
      };
      
      if (waitlistPatientToSchedule) {
        onPromoteFromWaitlist(waitlistPatientToSchedule.id, selectedBookingDate, apt);
        setWaitlistPatientToSchedule(null);
      } else {
        onAddAppointment(selectedBookingDate, apt);
      }

      // Salvar metadados do paciente (CPF e Telefone) se houver
      if (newApt.patientName) {
         const currentMeta = patientMetadata[newApt.patientName] || { tags: [] };
         setPatientMetadata({
            ...patientMetadata,
            [newApt.patientName]: {
               ...currentMeta,
               phone: newApt.phone || currentMeta.phone,
               cpf: newApt.cpf || currentMeta.cpf,
               birthDate: newApt.birthDate || currentMeta.birthDate
            }
         });
      }

      setActiveModal('none');
      resetNewAptForm();
    }
  };

  const handleSaveWaitlist = () => {
    if (newWaitlist.name && newWaitlist.phone) {
      if (newWaitlist.id && onUpdateWaitlist) {
         // Edição de item existente
         onUpdateWaitlist(newWaitlist as WaitlistPatient);
      } else {
         // Novo item
         onAddToWaitlist({
            id: `wait-${Date.now()}`,
            name: newWaitlist.name || '',
            phone: newWaitlist.phone || '',
            city: newWaitlist.city || '',
            type: newWaitlist.type || 'consulta',
            priceTable: newWaitlist.priceTable || 'Particular',
            notes: newWaitlist.notes || '',
            addedAt: new Date().toISOString()
         });
      }
      setActiveModal('none');
      setNewWaitlist({ name: '', phone: '', city: '', type: 'consulta', notes: '' });
      setPatientSearch('');
    }
  };

  const handleEditWaitlist = (p: WaitlistPatient) => {
      setNewWaitlist({ ...p });
      setWaitlistUnifiedType(p.priceTable || 'Particular'); 
      setActiveModal('add_waitlist');
  };

  const handleRemoveWaitlist = (id: string) => {
      confirm({
          title: 'Remover da Lista',
          message: 'Deseja remover este paciente da lista de espera?',
          confirmLabel: 'Sim, Remover',
          onConfirm: () => onRemoveFromWaitlist(id)
      });
  };

  const resetNewAptForm = () => {
    // Definir duração padrão com base no local atual ou padrão
    const defDuration = config.locations.find(l => l.id === (newApt.locationId || config.locations[0]?.id))?.slotDuration || 45;

    setNewApt({ 
        time: '', 
        patientName: '', 
        phone: '', 
        cpf: '', 
        age: '', 
        cityState: '', 
        additionalPhone: '', 
        priceTable: 'Particular', 
        expectedValue: 600, 
        mode: 'Presencial', 
        type: 'consulta', 
        status: 'agendado', 
        confirmed: false, 
        notes: '', 
        locationId: '',
        duration: defDuration
    });
    setUnifiedType('Particular');
    setWaitlistPatientToSchedule(null);
    setPatientSearch('');
    setIsManualTime(false);
    setAppointmentTimeMode('defined');
    setIsBlocking(false);
    setBlockEndTime('');
  };

  const fillFromExisting = (p: Partial<Appointment>) => {
    const meta = patientMetadata[p.patientName!] || {};
    setNewApt({
      ...newApt,
      patientName: p.patientName,
      phone: meta.phone || p.phone, // Prioriza metadados
      cpf: meta.cpf || p.cpf, // Preenche CPF se existir
      age: p.age,
      cityState: p.cityState,
      additionalPhone: p.additionalPhone,
      priceTable: p.priceTable,
      birthDate: meta.birthDate || p.birthDate
    });
    setPatientSearch('');
  };

  const fillWaitlistFromExisting = (p: Partial<Appointment>) => {
    const meta = patientMetadata[p.patientName!] || {};
    setNewWaitlist({
      ...newWaitlist,
      name: p.patientName,
      phone: meta.phone || p.phone,
      city: p.cityState
    });
    setPatientSearch('');
  };

  const startEncaixe = (p: WaitlistPatient) => {
    setWaitlistPatientToSchedule(p);
    
    // Tenta encontrar o valor na configuração baseado na tabela de preço salva ou no tipo
    let ev = 600;
    const configType = config.consultationTypes?.find(t => t.name === p.priceTable);
    if(configType) ev = configType.defaultValue;
    else if (p.priceTable === 'Social') ev = 400;
    else if (p.type === 'cortesia' || p.type === 'retorno') ev = 0;

    const defDuration = config.locations[0]?.slotDuration || 45;

    setNewApt({
      ...newApt,
      patientName: p.name,
      phone: p.phone,
      cityState: p.city,
      type: p.type,
      priceTable: p.priceTable || 'Particular',
      expectedValue: ev,
      notes: p.notes,
      duration: defDuration
    });

    if(p.priceTable) setUnifiedType(p.priceTable);
    else if(p.type === 'retorno') setUnifiedType('Retorno');
    else if(p.type === 'cortesia') setUnifiedType('Cortesia');
    else setUnifiedType('Particular');

    setSelectedBookingDate(new Date().toISOString().split('T')[0]);
    setIsManualTime(true); 
    setActiveModal('add');
  };

  const openPatientCard = () => {
    if (selectedApt && onOpenPatientInfo) {
      onOpenPatientInfo(selectedApt.patientName);
      setActiveModal('none');
    }
  };

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    confirm({
      type: 'alert',
      title: 'Copiado',
      message: 'Informação copiada com sucesso!'
    });
  };

  // Funções de pagamento (Split)
  const addPayment = () => {
    if (paymentInput && paymentMethodInput) {
        const val = parseFloat(paymentInput.replace(',', '.'));
        if (!isNaN(val) && val > 0) {
            const newSplit: SplitPayment = { method: paymentMethodInput, value: val };
            const currentSplits = selectedApt?.splitPayments || [];
            
            const updatedSplits = [...currentSplits, newSplit];
            const totalPaid = updatedSplits.reduce((acc, curr) => acc + curr.value, 0);
            
            // Define o método principal. Se houver mais de um pagamento, é 'Múltiplo'.
            const newMethod = updatedSplits.length > 1 ? 'Múltiplo' : updatedSplits[0].method;

            setSelectedApt({ 
                ...selectedApt!, 
                splitPayments: updatedSplits,
                paidValue: totalPaid,
                paymentMethod: newMethod
            });
            setPaymentInput('');
            setPaymentMethodInput(null);
        }
    }
  };

  const removePayment = (index: number) => {
      if (!selectedApt) return;
      const currentSplits = selectedApt.splitPayments || [];
      const updatedSplits = currentSplits.filter((_, i) => i !== index);
      const totalPaid = updatedSplits.reduce((acc, curr) => acc + curr.value, 0);
      
      let newMethod: PaymentMethod | undefined = selectedApt.paymentMethod;
      if (updatedSplits.length === 0) newMethod = undefined;
      else if (updatedSplits.length === 1) newMethod = updatedSplits[0].method;
      else newMethod = 'Múltiplo';

      setSelectedApt({
          ...selectedApt,
          splitPayments: updatedSplits,
          paidValue: totalPaid,
          paymentMethod: newMethod
      });
  };

  const applyCalculation = () => {
    if (!paymentInput || !calcRate) return;
    const base = parseFloat(paymentInput.replace(',', '.'));
    const rate = parseFloat(calcRate.replace(',', '.'));
    
    if (isNaN(base) || isNaN(rate)) return;

    let final = base;
    if (calcType === 'acrescimo') {
      final = base + (base * (rate / 100));
    } else {
      final = base - (base * (rate / 100));
    }

    setPaymentInput(final.toFixed(2).replace('.', ','));
    setShowCalc(false);
    setCalcRate('');
  };
  
  // Função para alternar tag do paciente selecionado
  const togglePatientTag = (tagId: string) => {
     if (!selectedApt) return;
     const currentTags = patientMetadata[selectedApt.patientName]?.tags || [];
     let newTags;
     if (currentTags.includes(tagId)) {
        newTags = currentTags.filter(t => t !== tagId);
     } else {
        newTags = [...currentTags, tagId];
     }
     
     setPatientMetadata({
        ...patientMetadata,
        [selectedApt.patientName]: {
           ...patientMetadata[selectedApt.patientName],
           tags: newTags
        }
     });
  };

  const handleCreateTag = () => {
    if (tagSearch.trim()) {
      // Cores disponíveis para novas tags aleatórias
      const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#ec4899', '#8b5cf6', '#f97316'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      setNewTagData({ name: tagSearch.trim(), color: randomColor, followUpRules: [] });
      setEnableNewTagProtocol(false);
      setTempTagRule({ amount: '1', unit: 'months' });
      
      // Close checkout modal momentarily or stack? Just change activeModal
      setActiveModal('create_tag');
    }
  };

  const handleConfirmCreateTag = () => {
     if (!newTagData.name) return;
     
     const tag: PatientTag = {
        id: `tag-${Date.now()}`,
        name: newTagData.name,
        color: newTagData.color || '#6366f1',
        followUpRules: enableNewTagProtocol ? newTagData.followUpRules : []
     };
     
     onUpdateConfig({
        ...config,
        tags: [...(config.tags || []), tag]
     });
     
     // Select tag
     if (selectedApt) {
        const currentMeta = patientMetadata[selectedApt.patientName] || { tags: [] };
        setPatientMetadata({
          ...patientMetadata,
          [selectedApt.patientName]: {
             ...currentMeta,
             tags: [...(currentMeta.tags || []), tag.id]
          }
        });
     }
     setTagSearch('');
     setActiveModal('checkout');
  };

  const handleAddTagRule = () => {
     if (Number(tempTagRule.amount) > 0) {
        setNewTagData(prev => ({
           ...prev,
           followUpRules: [...(prev.followUpRules || []), { amount: Number(tempTagRule.amount), unit: tempTagRule.unit }]
        }));
        setTempTagRule({ amount: '1', unit: 'months' });
     }
  };

  const handleRemoveTagRule = (index: number) => {
     setNewTagData(prev => ({
        ...prev,
        followUpRules: (prev.followUpRules || []).filter((_, i) => i !== index)
     }));
  };

  const isOverlapping = (a: Appointment, b: Appointment) => {
    const [ah, am] = a.time.split(':').map(Number);
    const aStart = ah * 60 + am;
    const aEnd = aStart + (a.duration || 45);

    const [bh, bm] = b.time.split(':').map(Number);
    const bStart = bh * 60 + bm;
    const bEnd = bStart + (b.duration || 45);

    return aStart < bEnd && bStart < aEnd;
  };

  const groupOverlappingEvents = (appointments: Appointment[]) => {
    const active = appointments.filter(a => a.status !== 'cancelado');
    const sorted = [...active].sort((a, b) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    });

    const clusters: Appointment[][] = [];
    let currentCluster: Appointment[] = [];
    let clusterEnd = 0;

    sorted.forEach(apt => {
      const [h, m] = apt.time.split(':').map(Number);
      const start = h * 60 + m;
      const end = start + (apt.duration || 45);

      if (currentCluster.length > 0 && start < clusterEnd) {
        currentCluster.push(apt);
        clusterEnd = Math.max(clusterEnd, end);
      } else {
        if (currentCluster.length > 0) clusters.push(currentCluster);
        currentCluster = [apt];
        clusterEnd = end;
      }
    });
    if (currentCluster.length > 0) clusters.push(currentCluster);

    return clusters.map(cluster => {
      const lanes: { end: number }[] = [];
      const positioned = cluster.map(apt => {
        const [h, m] = apt.time.split(':').map(Number);
        const start = h * 60 + m;
        const end = start + (apt.duration || 45);

        let laneIndex = 0;
        while (laneIndex < lanes.length && lanes[laneIndex].end > start) {
          laneIndex++;
        }

        if (laneIndex < lanes.length) {
          lanes[laneIndex].end = end;
        } else {
          lanes.push({ end });
        }

        return { ...apt, laneIndex };
      });

      return positioned.map(apt => ({ ...apt, laneCount: lanes.length }));
    });
  };

  const handleDesmarcar = (e: React.MouseEvent | null, date: string, id: string) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    confirm({
      title: 'Desmarcar Consulta',
      message: 'TEM CERTEZA? Deseja desmarcar este paciente e eliminar o agendamento permanentemente?',
      confirmLabel: 'Confirmar Exclusão',
      onConfirm: () => {
         onDeleteAppointment(date, id);
         setActiveModal('none');
         setSelectedApt(null);
      }
    });
  };

  const handleSchemeChange = (date: string, dayOfWeek: number, typeName: string, currentCount: number, delta: number) => {
    const newCount = Math.max(0, currentCount + delta);
    if (newCount === currentCount) return;
    
    const dayData = data[date];
    const globalScheme = (config.confirmationConfig?.dailySchemes || []).find(s => s.dayOfWeek === dayOfWeek);
    
    // Se não houver esquema específico do dia, começamos com o global
    let currentItems = dayData?.dailyScheme || globalScheme?.items || [];
    
    let nextItems = currentItems.map(i => ({ ...i }));
    const itemIdx = nextItems.findIndex(i => i.type === typeName);
    if (itemIdx > -1) {
      nextItems[itemIdx].count = newCount;
    } else {
      nextItems.push({ type: typeName, count: newCount });
    }
    
    if (onUpdateDaySchedule) {
      onUpdateDaySchedule(date, { dailyScheme: nextItems });
    }
  };

  const handleEditPatientDetails = (e: React.MouseEvent, apt: Appointment) => {
    e.stopPropagation();
    // Recupera dados do metadata
    const meta = patientMetadata[apt.patientName] || {};
    setSelectedApt({ ...apt, cpf: meta.cpf || apt.cpf, birthDate: meta.birthDate || apt.birthDate });
    setActiveModal('edit_patient');
  };

  const savePatientDetails = () => {
    if (selectedApt) {
        // Atualiza o agendamento atual
        onUpdateAppointment(selectedApt.date, selectedApt);
        
        // Atualiza metadados persistentes
        setPatientMetadata({
            ...patientMetadata,
            [selectedApt.patientName]: {
                ...patientMetadata[selectedApt.patientName],
                phone: selectedApt.phone,
                cpf: selectedApt.cpf,
                birthDate: selectedApt.birthDate
            }
        });
        setActiveModal('none');
    }
  };

  const isCheckinValid = selectedApt && 
    (selectedApt.paidValue !== undefined && selectedApt.paidValue > 0) && // Deve ter valor
    selectedApt.paymentMethod && 
    selectedApt.paymentMethod !== 'Pendente';

  const filteredTags = (config.tags || [])
    .filter(tag => tag.name.toLowerCase().includes(tagSearch.toLowerCase()))
    .slice(0, 10);

  // Inicializa splitPayments se houver valor pago mas lista vazia (migração legado)
  useEffect(() => {
      if (activeModal === 'checkin' && selectedApt && (selectedApt.splitPayments?.length === 0 || !selectedApt.splitPayments) && (selectedApt.paidValue || 0) > 0 && selectedApt.paymentMethod && selectedApt.paymentMethod !== 'Múltiplo') {
          setSelectedApt(prev => prev ? ({
              ...prev,
              splitPayments: [{ method: prev.paymentMethod!, value: prev.paidValue! }]
          }) : null);
      }
      // Limpa inputs
      setPaymentInput('');
      setPaymentMethodInput(null);
  }, [activeModal, selectedApt?.id]); // Roda quando modal abre ou id muda

  return (
    <div className="h-screen flex flex-col space-y-2 pb-0">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 -mx-4 px-4 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none">Agenda Médica</h2>
            <p className="text-[10px] text-slate-500 font-medium tracking-tight mt-0.5">{config.doctorName}</p>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
          
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-100 transition-colors">Hoje</button>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()-7); setCurrentDate(d); }} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-all"><i className="fa-solid fa-chevron-left text-[10px]"></i></button>
              <button type="button" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate()+7); setCurrentDate(d); }} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-all"><i className="fa-solid fa-chevron-right text-[10px]"></i></button>
            </div>
            <input type="date" className="bg-transparent border-none text-sm font-bold text-slate-700 p-1 outline-none cursor-pointer w-36" value={currentDate.toISOString().split('T')[0]} onChange={e => setCurrentDate(new Date(e.target.value))} />
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div className="hidden lg:flex items-center bg-slate-100/50 rounded-lg p-0.5 border border-slate-200">
            <button 
              type="button" 
              onClick={() => setViewMode('cards')} 
              className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${viewMode === 'cards' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Cards
            </button>
            <button 
              type="button" 
              onClick={() => setViewMode('grid')} 
              className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Grade
            </button>
          </div>

          <div className="flex gap-1">
            <button 
              type="button" 
              onClick={() => { setWaitPanelTab('consultas'); setWaitPanelOpen(true); }} 
              className="px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 flex items-center gap-1.5"
            >
              <i className="fa-solid fa-money-bill-wave"></i>
              <span>{waitlist.filter(p => p.type !== 'retorno').length}</span>
            </button>
            <button 
              type="button" 
              onClick={() => { setWaitPanelTab('retornos'); setWaitPanelOpen(true); }} 
              className="px-2 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all text-amber-600 bg-amber-50/50 hover:bg-amber-50 border border-amber-100 flex items-center gap-1.5"
            >
              <i className="fa-solid fa-rotate-left"></i>
              <span>{waitlist.filter(p => p.type === 'retorno').length}</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => { setNewWaitlist({ name: '', phone: '', city: '', type: 'consulta', notes: '' }); setWaitlistUnifiedType('Particular'); setPatientSearch(''); setActiveModal('add_waitlist'); }} className="bg-amber-500 text-white h-9 px-3 rounded-lg text-[10px] font-black shadow-sm hover:bg-amber-600 transition-all flex items-center gap-2 uppercase">
              <i className="fa-solid fa-hourglass-half"></i> <span className="hidden xl:inline">Lista de Espera</span>
            </button>
            <button type="button" onClick={() => { resetNewAptForm(); setSelectedBookingDate(new Date().toISOString().split('T')[0]); setActiveModal('add'); }} className="bg-indigo-600 text-white h-9 px-3 rounded-lg text-[10px] font-black shadow-sm hover:bg-indigo-700 transition-all flex items-center gap-2 uppercase">
              <i className="fa-solid fa-plus"></i> <span className="hidden xl:inline">Novo Agendamento</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 w-full">
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {visibleWeekDays.map((dayInfo) => {
              const day = data[dayInfo.date] || { date: dayInfo.date, appointments: [] };
              const headerColor = dayInfo.activeLocation ? dayInfo.activeLocation.color : '#f1f5f9';
              const headerTextColor = dayInfo.activeLocation ? '#ffffff' : '#94a3b8';
              
              // AGENDAMENTOS ATIVOS (REMOVE O QUE FOI FILTRADO NO DELETE)
              const occupiedTimes = new Set(day.appointments.map(a => a.time));
              const freeSlots = dayInfo.generatedSlots
                .filter(time => !occupiedTimes.has(time))
                .map(time => ({ type: 'slot', time } as const));
              
              const combinedItems = [
                ...day.appointments.map(a => ({ type: 'apt', data: a, time: a.time } as const)),
                ...freeSlots
              ].sort((a, b) => a.time.localeCompare(b.time));

              return (
                <div key={dayInfo.date} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[520px] lg:min-h-[calc(100vh-260px)] w-full">
                  <div 
                    className="p-1.5 border-b border-slate-100 text-center transition-colors"
                    style={{ backgroundColor: headerColor }}
                  >
                    <p className="text-[7px] font-black uppercase tracking-widest truncate" style={{ color: headerTextColor }}>{dayInfo.weekday}</p>
                    <p className="text-base font-black tracking-tighter leading-none my-0.5" style={{ color: headerTextColor }}>{dayInfo.label}</p>
                    {dayInfo.activeLocation && (
                      <p className="text-[6px] font-bold uppercase truncate" style={{ color: headerTextColor, opacity: 0.9 }}>
                        {dayInfo.activeLocation.name}
                      </p>
                    )}
                  </div>

                  {renderSchemeRow(dayInfo)}

                  <div className="p-1 space-y-1 flex-1 relative min-h-0 overflow-y-auto">
                    {combinedItems.length > 0 && (
                      <div style={dayInfo.activeLocation?.color ? { backgroundColor: hexToRgba(dayInfo.activeLocation.color, 0.12) } : {}} className="rounded-xl space-y-1 p-0.5">
                        {combinedItems.map((item, idx) => {
                      if (item.type === 'apt') {
                        const apt = item.data;
                        const patientTags = patientMetadata[apt.patientName]?.tags || [];
                        const isBlocked = apt.type === 'bloqueio';
                        const isCheckIn = apt.status === 'check-in';
                        const isAtendido = apt.status === 'atendido';

                        // Busca configuração do tipo de consulta para verificar destaque visual
                        const typeConfig = config.consultationTypes?.find(t => t.name === apt.priceTable);
                        
                        return (
                          <div key={apt.id} onClick={() => { if(!isBlocked) { 
                              // Carrega dados extras ao abrir
                              const meta = patientMetadata[apt.patientName] || {};
                              setSelectedApt({ ...apt, cpf: meta.cpf || apt.cpf, birthDate: meta.birthDate || apt.birthDate });
                              setShowCalc(false); 
                              setActiveModal(apt.status === 'agendado' ? 'checkin' : 'checkout'); 
                          } }} className={`p-1.5 rounded-lg border transition-all cursor-pointer group hover:scale-[1.01] relative ${
                            isAtendido 
                              ? 'bg-emerald-50 border-emerald-200' 
                              : isCheckIn 
                                ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300' 
                                : isBlocked 
                                  ? 'bg-slate-100 border-slate-200 opacity-70' 
                                  : 'bg-white border-slate-200'
                          }`}>
                            {apt.locationId && !isBlocked && (
                              <div className="absolute right-0 top-0 bottom-0 w-1 rounded-r-lg" style={{ backgroundColor: config.locations.find(l => l.id === apt.locationId)?.color || '#ccc' }}></div>
                            )}
                            {isCheckIn && (
                              <div className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[6px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm z-10 animate-pulse">
                                SALA DE ESPERA
                              </div>
                            )}
                            {isAtendido && (
                              <div className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[6px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm z-10">
                                ATENDIDO
                              </div>
                            )}
                            
                            <div className="flex justify-between items-start">
                               <div className="flex items-center gap-1 mb-1">
                                  <span className={`text-[6px] font-black px-1 rounded block w-fit ${isBlocked ? 'bg-slate-300 text-slate-600' : 'bg-slate-100 text-slate-800'}`}>{apt.time}</span>
                                  {apt.confirmed && !isBlocked && (
                                    <span className="text-[6px] font-black text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-100 flex items-center gap-0.5">
                                      <i className="fa-solid fa-check"></i> Conf.
                                    </span>
                                  )}
                                  {/* Destaque Visual do Tipo de Consulta */}
                                  {typeConfig?.isHighlighted && !isBlocked && (
                                    <span className="text-[7px] animate-pulse" style={{ color: typeConfig.highlightColor }}>
                                      <i className={`fa-solid ${typeConfig.highlightIcon}`}></i>
                                    </span>
                                  )}
                               </div>
                               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  {!isBlocked && (
                                    <button type="button" onClick={(e) => handleEditPatientDetails(e, apt)} className="text-slate-300 hover:text-indigo-600 text-[10px]">
                                      <i className="fa-solid fa-pen"></i>
                                    </button>
                                  )}
                                  <button type="button" onClick={(e) => handleDesmarcar(e, dayInfo.date, apt.id)} className="text-slate-300 hover:text-red-500 text-[10px] cursor-pointer p-1">
                                      <i className="fa-solid fa-trash-can"></i>
                                  </button>
                               </div>
                            </div>

                            <p className={`text-[9px] font-black text-slate-800 uppercase leading-none truncate`}>{apt.patientName}</p>
                            {apt.mode === 'Online' && !isBlocked && <span className="text-[6px] bg-blue-100 text-blue-600 px-1 rounded ml-1 font-bold">ON</span>}
                            
                            {/* Tags Indicator */}
                            {patientTags.length > 0 && !isBlocked && (
                               <div className="flex gap-1 mt-1 flex-wrap">
                                  {patientTags.map(tagId => {
                                     const tagDef = config.tags?.find(t => t.id === tagId);
                                     if (!tagDef) return null;
                                     return <div key={tagId} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tagDef.color }} title={tagDef.name}></div>
                                  })}
                               </div>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <div key={item.time} onClick={() => { resetNewAptForm(); setSelectedBookingDate(dayInfo.date); setNewApt({ ...newApt, time: item.time }); setActiveModal('add'); }} className="p-1 rounded-md border border-dashed border-slate-100 flex items-center justify-center text-[8px] font-black text-slate-200 hover:border-indigo-200 hover:text-indigo-300 cursor-pointer transition-all">
                            <span>{item.time}</span>
                            <i className="fa-solid fa-plus text-[8px] ml-1"></i>
                          </div>
                        );
                      }
                        })}
                      </div>
                    )}

                    <div 
                      className="flex-1 min-h-[60px] rounded-xl cursor-pointer hover:bg-slate-50/60 transition-colors"
                      onClick={() => {
                        resetNewAptForm();
                        setSelectedBookingDate(dayInfo.date);
                        setIsManualTime(true);
                        setNewApt(prev => ({ ...prev, locationId: dayInfo.activeLocation?.id || prev.locationId, time: '' }));
                        setActiveModal('add');
                      }}
                    />

                    {combinedItems.length === 0 && (
                      <div className="text-center py-10 opacity-30">
                        <i className="fa-regular fa-calendar-xmark text-2xl mb-2"></i>
                        <p className="text-[8px] font-bold uppercase">Sem Horários</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0">
            <div className="h-full overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <div className="w-full md:min-w-[calc(var(--days)*200px+80px)]" style={{ '--days': visibleWeekDaysForGrid.length } as any}>
                {/* Header fixo */}
                <div className="flex sticky top-0 z-30 bg-white border-b border-slate-100">
                  <div className="w-20 p-2 border-r border-slate-100 bg-slate-50 sticky left-0 z-40"></div>
                  <div className="grid grid-cols-1 md:grid-cols-[repeat(var(--days),minmax(200px,1fr))] flex-1">
                    {visibleWeekDaysForGrid.map(day => {
                      const dayApts = data[day.date]?.appointments || [];
                      const activeApts = dayApts.filter(a => a.status !== 'cancelado');
                      const consultas = activeApts.filter(a => a.type === 'consulta').length;
                      const retornos = activeApts.filter(a => a.type === 'retorno').length;
                      const encaixes = activeApts.filter(a => !['consulta', 'retorno', 'bloqueio'].includes(a.type)).length;
                      
                      const summary = [];
                      if (consultas > 0) summary.push(`Cons: ${consultas}`);
                      if (retornos > 0) summary.push(`Ret: ${retornos}`);
                      if (encaixes > 0) summary.push(`Enc: ${encaixes}`);

                      return (
                        <div key={day.date} className="flex-1 p-1 border-r border-slate-100 md:min-w-[180px] bg-white text-center">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">{day.weekday}</p>
                          <p className="text-xs font-black text-slate-800 tracking-tighter leading-none my-0.5">{day.label}</p>
                          {day.activeLocation && (
                            <p className="text-[6px] font-bold uppercase text-indigo-500 leading-none">{day.activeLocation.name}</p>
                          )}
                          {summary.length > 0 && (
                            <p className="text-[7px] font-bold text-slate-400 my-0.5 uppercase tracking-tighter leading-none">
                              {summary.join(' | ')}
                            </p>
                          )}
                          {renderSchemeRow(day)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Corpo da Grade */}
                <div className="flex relative">
                  {/* Coluna de Horas */}
                  <div className="w-20 bg-slate-50 border-r border-slate-100 sticky left-0 z-20">
                    {hours.map(hour => (
                      <div key={hour} className="h-[18px] flex items-center justify-center border-b border-slate-50 text-[9px] font-black text-slate-400">
                        {hour}
                      </div>
                    ))}
                  </div>

                  {/* Colunas de Dias */}
                  <div className="grid grid-cols-1 md:grid-cols-[repeat(var(--days),minmax(200px,1fr))] flex-1">
                    {visibleWeekDaysForGrid.map(day => {
                      const dayApts = data[day.date]?.appointments || [];
                      const activeApts = dayApts.filter(a => a.status !== 'cancelado');
                      const period = getDayPeriodRange(day);
                      return (
                        <div key={day.date} className="flex-1 border-r border-slate-50 relative md:min-w-[180px]">
                          {activeApts.length === 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 pointer-events-none">
                              <p className="text-[9px] font-bold text-slate-300 uppercase mb-2">Sem agendamentos neste período</p>
                              <button 
                                className="pointer-events-auto bg-white hover:bg-slate-50 text-slate-400 text-[8px] font-black px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-all"
                                onClick={() => {
                                  resetNewAptForm();
                                  setSelectedBookingDate(day.date);
                                  setActiveModal('add');
                                }}
                              >
                                <i className="fa-solid fa-plus mr-1"></i> AGENDAR
                              </button>
                            </div>
                          )}
                          {period && (
                            <div 
                              className="absolute left-2 right-2 rounded-2xl z-0 pointer-events-none"
                              style={{ 
                                top: `${(period.startMin - 7 * 60) * 1.2}px`, 
                                height: `${(period.endMin - period.startMin) * 1.2}px`,
                                backgroundColor: period.color,
                                opacity: 0.12
                              }}
                            />
                          )}
                          {/* Linhas de fundo */}
                          {hours.map(hour => (
                            <div 
                              key={hour} 
                              className="h-[18px] border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                              onClick={() => {
                                resetNewAptForm();
                                setSelectedBookingDate(day.date);
                                setNewApt(prev => ({ ...prev, time: hour }));
                                setActiveModal('add');
                              }}
                            ></div>
                          ))}

                          {/* Agendamentos */}
                          {groupOverlappingEvents(dayApts).flatMap(group => 
                            group.map((apt: any) => {
                              const [h, m] = apt.time.split(':').map(Number);
                              const startMinutes = h * 60 + m;
                              const timeStartMinutes = 7 * 60;
                              const pixelsPerMinute = 1.2;
                              
                              if (startMinutes < timeStartMinutes || startMinutes >= 20 * 60) return null;

                              const top = (startMinutes - timeStartMinutes) * pixelsPerMinute;
                              const duration = apt.duration || 45;
                              const height = duration * pixelsPerMinute;

                              const width = 100 / apt.laneCount;
                              const left = apt.laneIndex * width;

                              const typeConfig = config.consultationTypes?.find(t => t.name === apt.type);
                              const bgColor = typeConfig?.color || '#6366f1';
                              
                              return (
                                <div 
                                  key={apt.id}
                                  className="absolute rounded-md p-1 text-[11px] text-slate-800 shadow-sm overflow-hidden cursor-pointer hover:brightness-95 transition-all z-10 border-l-[3px]"
                                  style={{ 
                                    top: `${top}px`, 
                                    height: `${height}px`,
                                    width: `calc(${width}% - 4px)`,
                                    left: `calc(${left}% + 2px)`,
                                    backgroundColor: hexToRgba(bgColor, 0.15),
                                    borderLeftColor: bgColor,
                                    opacity: (apt.status as string) === 'faltou' ? 0.6 : 1,
                                  }}
                                  onClick={() => { setSelectedApt(apt); setActiveModal('checkin'); }}
                                >
                                  <div className="truncate leading-none font-black mb-0.5">{apt.time} - {apt.patientName}</div>
                                  <div className="text-[9px] opacity-60 truncate font-bold hidden sm:block">{apt.type}</div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {waitPanelOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-end p-4" onClick={() => setWaitPanelOpen(false)}>
          <div className="bg-white rounded-[40px] w-full max-w-md h-full max-h-[90vh] p-8 shadow-2xl animate-in slide-in-from-right overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                {waitPanelTab === 'consultas' ? (
                  <><i className="fa-solid fa-money-bill-wave text-emerald-500"></i> ESPERA: CONSULTAS</>
                ) : (
                  <><i className="fa-solid fa-rotate-left text-amber-500"></i> ESPERA: RETORNOS</>
                )}
              </h3>
              <button onClick={() => setWaitPanelOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              {waitlist.filter(p => waitPanelTab === 'consultas' ? p.type !== 'retorno' : p.type === 'retorno').map(p => {
                const daysOnList = Math.floor((new Date().getTime() - new Date(p.addedAt).getTime()) / (1000 * 3600 * 24));
                const limit = config.confirmationConfig?.waitlistReminderDays || 7;
                const isOverdue = daysOnList > limit;
                const insertionDate = new Date(p.addedAt).toLocaleDateString('pt-BR');

                return (
                  <div key={p.id} className={`rounded-2xl p-4 border flex justify-between items-center group relative ${isOverdue ? 'bg-red-50 border-red-200' : (waitPanelTab === 'consultas' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100')}`}>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/80 rounded-lg p-1 shadow-sm">
                        <button onClick={(e) => { e.stopPropagation(); handleEditWaitlist(p); }} className={`${waitPanelTab === 'consultas' ? 'text-indigo-500 hover:text-indigo-700' : 'text-amber-500 hover:text-amber-700'} p-1`} title="Ver/Editar"><i className="fa-solid fa-pen-to-square"></i></button>
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveWaitlist(p.id); }} className="text-red-400 hover:text-red-600 p-1" title="Remover"><i className="fa-solid fa-trash-can"></i></button>
                    </div>
                    <div className="overflow-hidden pr-2 flex-1 cursor-pointer" onClick={() => handleEditWaitlist(p)}>
                      <p className="text-xs font-black text-slate-800 uppercase leading-none truncate">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[9px] text-slate-400 uppercase truncate max-w-[80px]">{p.city || 'S/C'}</span>
                        <span className="text-[9px] text-slate-300">•</span>
                        <span className="text-[9px] font-black text-indigo-500 uppercase">Entrada: {insertionDate}</span>
                        <span className="text-[9px] text-slate-300">•</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-slate-500">{p.phone}</span>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(p.phone); }} 
                            className={`text-slate-300 ${waitPanelTab === 'consultas' ? 'hover:text-emerald-600' : 'hover:text-amber-600'} transition-colors p-0.5`}
                            title="Copiar Telefone"
                          >
                            <i className="fa-solid fa-copy text-[9px]"></i>
                          </button>
                        </div>
                      </div>
                      {isOverdue && (
                        <p className="text-[9px] font-black text-red-500 mt-1 flex items-center gap-1 animate-pulse">
                          <i className="fa-solid fa-triangle-exclamation"></i> Revalidar Interesse ({daysOnList} dias)
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={() => { startEncaixe(p); setWaitPanelOpen(false); }} className={`text-[9px] font-black bg-white ${waitPanelTab === 'consultas' ? 'text-emerald-600 hover:bg-emerald-600' : 'text-amber-600 hover:bg-amber-600'} px-4 py-2 rounded-xl shadow-sm hover:text-white transition-all`}>ENCAIXAR</button>
                  </div>
                );
              })}
              {waitlist.filter(p => waitPanelTab === 'consultas' ? p.type !== 'retorno' : p.type === 'retorno').length === 0 && (
                <div className="text-center py-20 opacity-20">
                  <i className="fa-solid fa-hourglass-empty text-4xl mb-4"></i>
                  <p className="font-black uppercase text-xs">Lista Vazia</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeModal === 'add_waitlist' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95">
              <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tighter">
                  {newWaitlist.id ? 'Editar / Ver Detalhes' : 'Adicionar à Lista de Espera'}
              </h3>
              <div className="space-y-4">
                 <div className="relative">
                    <input 
                      placeholder="Nome do Paciente" 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800"
                      value={newWaitlist.name} 
                      onChange={e => {
                        setNewWaitlist({...newWaitlist, name: e.target.value});
                        setPatientSearch(e.target.value);
                      }} 
                      autoFocus
                    />
                    {patientSearch.length > 1 && filteredExistingPatients.length > 0 && !newWaitlist.id && (
                      <div className="absolute top-full left-0 w-full bg-white shadow-2xl rounded-2xl border border-slate-100 mt-1 z-[110] overflow-hidden max-h-48 overflow-y-auto">
                        {filteredExistingPatients.map(p => (
                          <button type="button" key={p.id} onClick={() => fillWaitlistFromExisting(p)} className="w-full p-3 text-left hover:bg-indigo-50 border-b border-slate-50 last:border-0 flex justify-between items-center">
                            <span className="text-xs font-bold uppercase">{p.patientName}</span>
                            <span className="text-[9px] text-slate-400">{p.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <input 
                      placeholder="Telefone" 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800"
                      value={newWaitlist.phone} 
                      onChange={e => setNewWaitlist({...newWaitlist, phone: e.target.value})} 
                    />
                    <input 
                      placeholder="Cidade" 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800"
                      value={newWaitlist.city} 
                      onChange={e => setNewWaitlist({...newWaitlist, city: e.target.value})} 
                    />
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Tipo / Tabela</label>
                    <select 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-xs uppercase cursor-pointer" 
                      value={waitlistUnifiedType} 
                      onChange={e => setWaitlistUnifiedType(e.target.value)}
                    >
                      {config.consultationTypes && config.consultationTypes.length > 0 ? (
                        config.consultationTypes.map(t => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))
                      ) : (
                        <>
                          <option value="Particular">Particular</option>
                          <option value="Social">Tabela Social</option>
                          <option value="Cortesia">Cortesia</option>
                          <option value="Retorno">Retorno (Não Pago)</option>
                        </>
                      )}
                    </select>
                 </div>
                 <textarea 
                   placeholder="Observações..." 
                   className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 h-24"
                   value={newWaitlist.notes} 
                   onChange={e => setNewWaitlist({...newWaitlist, notes: e.target.value})} 
                 />
                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setActiveModal('none')} className="flex-1 py-4 text-slate-300 font-black uppercase text-[10px]">Cancelar</button>
                    <button type="button" onClick={handleSaveWaitlist} disabled={!newWaitlist.name} className="flex-[2] py-4 bg-amber-500 text-white rounded-2xl font-black shadow-xl uppercase hover:bg-amber-600">
                        {newWaitlist.id ? 'Salvar Alterações' : 'Adicionar à Lista'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeModal === 'add' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] w-full max-w-2xl p-10 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[95vh]">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Agendamento</h3>
               <button type="button" onClick={toggleBlockingMode} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isBlocking ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                 <i className="fa-solid fa-ban mr-2"></i> {isBlocking ? 'Bloqueio Ativo' : 'Bloquear Horário'}
               </button>
             </div>
             {!isBlocking ? (
               <div className="space-y-4">
                  <div className="flex gap-2 mb-2 bg-slate-50 p-1 rounded-2xl w-fit">
                    <button 
                      type="button" 
                      onClick={() => {
                        setAppointmentTimeMode('now');
                        const now = new Date();
                        const rounded = roundUpTo15(now);
                        setSelectedBookingDate(now.toISOString().split('T')[0]);
                        setNewApt(prev => ({ ...prev, time: formatHHMM(rounded) }));
                      }}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${appointmentTimeMode === 'now' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <i className="fa-solid fa-clock mr-2"></i> Agora (15 min)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setAppointmentTimeMode('defined')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${appointmentTimeMode === 'defined' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <i className="fa-solid fa-calendar-day mr-2"></i> Definir data/hora
                    </button>
                  </div>
                  <div className="relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Paciente (Busque ou digite)</label>
                    <input 
                      autoFocus 
                      type="text" 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-700 shadow-inner" 
                      value={newApt.patientName} 
                      onChange={e => {
                        setNewApt({ ...newApt, patientName: e.target.value });
                        setPatientSearch(e.target.value);
                      }} 
                    />
                    {filteredExistingPatients.length > 0 && (
                      <div className="absolute top-full left-0 w-full bg-white shadow-2xl rounded-2xl border border-slate-100 mt-1 z-[110] overflow-hidden max-h-48 overflow-y-auto">
                        {filteredExistingPatients.map(p => (
                          <button type="button" key={p.id} onClick={() => fillFromExisting(p)} className="w-full p-3 text-left hover:bg-indigo-50 border-b border-slate-50 last:border-0 flex justify-between items-center">
                            <span className="text-xs font-bold uppercase">{p.patientName}</span>
                            <span className="text-[9px] text-slate-400">{p.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Telefone Principal</label>
                      <input type="tel" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold shadow-inner" value={newApt.phone || ''} onChange={e => setNewApt({...newApt, phone: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Idade</label>
                      <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold shadow-inner" value={newApt.age || ''} onChange={e => setNewApt({...newApt, age: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">CPF</label>
                       <input type="text" placeholder="000.000.000-00" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold shadow-inner" value={newApt.cpf || ''} onChange={e => setNewApt({...newApt, cpf: e.target.value})} />
                    </div>
                    <div>
                       <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Cidade/Estado</label>
                       <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold shadow-inner" value={newApt.cityState || ''} onChange={e => setNewApt({...newApt, cityState: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Local de Consulta</label>
                      <select className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-xs uppercase cursor-pointer" value={newApt.locationId} onChange={e => setNewApt({...newApt, locationId: e.target.value})}>
                          <option value="">Selecione...</option>
                          {config.locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))}
                      </select>
                    </div>
                     <div className="flex flex-col">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Modo de Atendimento</label>
                      <div className="flex bg-slate-50 rounded-2xl p-1 h-full">
                        <button type="button" onClick={() => setNewApt({...newApt, mode: 'Presencial'})} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${newApt.mode === 'Presencial' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>PRESENCIAL</button>
                        <button type="button" onClick={() => setNewApt({...newApt, mode: 'Online'})} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${newApt.mode === 'Online' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>ONLINE</button>
                      </div>
                    </div>
                  </div>
                  <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Tipo / Tabela / Procedimento</label>
                      <select 
                        className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-xs uppercase cursor-pointer" 
                        value={unifiedType} 
                        onChange={e => setUnifiedType(e.target.value)}
                      >
                        {config.consultationTypes && config.consultationTypes.length > 0 ? (
                          config.consultationTypes.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                          ))
                        ) : (
                          <>
                            <option value="Particular">Particular</option>
                            <option value="Social">Tabela Social</option>
                            <option value="Cortesia">Cortesia</option>
                            <option value="Retorno">Retorno (Não Pago)</option>
                          </>
                        )}
                      </select>
                  </div>
                  <div>
                     <div className="flex justify-between items-center mb-1 pr-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 block tracking-widest">Data e Horário</label>
                        <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                           <span className="text-[8px] font-black text-slate-400 uppercase">Tempo:</span>
                           <input 
                             type="number" 
                             className="w-10 bg-transparent border-none font-black text-xs text-indigo-600 text-right p-0 focus:ring-0" 
                             value={newApt.duration || 45} 
                             onChange={e => setNewApt({...newApt, duration: Number(e.target.value)})}
                             step="5" min="5"
                           />
                           <span className="text-[8px] font-black text-indigo-600">min</span>
                        </div>
                     </div>
                     <div className="flex gap-4 items-start">
                       <input type="date" className="p-4 rounded-2xl bg-slate-50 border-none font-black text-xs cursor-pointer w-40" value={selectedBookingDate} onChange={e => setSelectedBookingDate(e.target.value)} />
                       <div className="flex-1">
                          {isManualTime ? (
                            <div className="flex gap-2 items-center">
                               <input type="time" autoFocus className="w-full p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 font-black text-lg text-center" value={newApt.time} onChange={e => setNewApt({...newApt, time: e.target.value})} />
                               <button type="button" onClick={() => setIsManualTime(false)} className="bg-slate-100 text-slate-400 p-4 rounded-2xl font-black text-xs uppercase"><i className="fa-solid fa-xmark"></i></button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                               {availableTimeSlotsForModal.map(time => {
                                  const isOccupied = data[selectedBookingDate]?.appointments.some(a => a.time === time);
                                  return (
                                    <button 
                                      type="button"
                                      key={time} 
                                      disabled={isOccupied}
                                      onClick={() => setNewApt({...newApt, time})} 
                                      className={`p-2 rounded-xl text-[10px] font-black border transition-all ${
                                        isOccupied 
                                        ? 'bg-slate-100 text-slate-300 border-slate-50 cursor-not-allowed line-through' 
                                        : newApt.time === time 
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                          : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'
                                      }`}
                                    >
                                      {time}
                                    </button>
                                  );
                               })}
                               <button type="button" onClick={() => { setIsManualTime(true); setNewApt({...newApt, time: ''}); }} className="p-2 rounded-xl text-[10px] font-black border border-dashed border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 uppercase">Outro</button>
                            </div>
                          )}
                       </div>
                     </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Observação (Opcional)</label>
                    <textarea className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold shadow-inner h-20 text-xs" value={newApt.notes || ''} onChange={e => setNewApt({...newApt, notes: e.target.value})} placeholder="Ex: Paciente com urgência..." />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => { setActiveModal('none'); resetNewAptForm(); }} className="flex-1 py-4 text-slate-300 font-black uppercase text-[10px]">Cancelar</button>
                    <button type="button" disabled={!newApt.patientName || !newApt.time} onClick={handleSaveAppointment} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase">Confirmar Agendamento</button>
                  </div>
               </div>
             ) : (
               <div className="space-y-6 bg-red-50 p-6 rounded-3xl border border-red-100">
                  <p className="text-center text-red-500 font-bold uppercase text-xs">Modo de Bloqueio de Agenda Ativado</p>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Motivo do Bloqueio</label>
                     <input type="text" className="w-full p-4 rounded-2xl bg-white border-none font-bold text-slate-700 shadow-inner" value={newApt.notes || ''} onChange={e => setNewApt({...newApt, notes: e.target.value})} placeholder="Ex: Férias, Congresso, Pessoal..." />
                  </div>
                  <div>
                     <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Data e Horário</label>
                     <div className="flex gap-4 items-center mb-4">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Dia:</label>
                        <input type="date" className="p-3 rounded-2xl bg-white border-none font-black text-xs cursor-pointer w-40 shadow-sm" value={selectedBookingDate} onChange={e => setSelectedBookingDate(e.target.value)} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">De (Início)</label>
                          <select className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm" value={newApt.time} onChange={e => setNewApt({...newApt, time: e.target.value})}>
                             <option value="">Selecione...</option>
                             {availableTimeSlotsForModal.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                       </div>
                       <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Até (Fim)</label>
                          <select className="w-full p-4 rounded-2xl bg-white border-none font-bold text-xs shadow-sm" value={blockEndTime} onChange={e => setBlockEndTime(e.target.value)}>
                             <option value="">Selecione...</option>
                             {availableTimeSlotsForModal.filter(t => !newApt.time || t >= (newApt.time || '')).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                       </div>
                     </div>
                     <p className="text-[9px] text-red-400 font-bold mt-2 text-center">Isso bloqueará todos os horários livres entre {newApt.time || '...'} e {blockEndTime || '...'}.</p>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => { setActiveModal('none'); resetNewAptForm(); }} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                    <button type="button" disabled={!newApt.time} onClick={handleSaveAppointment} className="flex-[2] py-4 bg-red-50 text-red-500 rounded-2xl font-black shadow-xl uppercase hover:bg-red-600">Confirmar Bloqueio</button>
                  </div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* Modal de Criação de Tag com Regras */}
      {activeModal === 'create_tag' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95">
              <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Criar Nova Etiqueta</h3>
              <div className="space-y-4">
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Nome da Etiqueta</label>
                    <input 
                      type="text" 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800 uppercase"
                      value={newTagData.name} 
                      onChange={e => setNewTagData({...newTagData, name: e.target.value})}
                    />
                 </div>
                 
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={enableNewTagProtocol} 
                          onChange={e => setEnableNewTagProtocol(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                        <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Definir Protocolo de Follow-up</span>
                    </label>

                    {enableNewTagProtocol && (
                       <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Regras de Contato</p>
                          <div className="flex gap-2">
                             <input 
                               type="number" 
                               className="w-16 p-2 rounded-lg bg-white border-none font-bold text-xs outline-none" 
                               value={tempTagRule.amount} 
                               onChange={e => setTempTagRule({ ...tempTagRule, amount: e.target.value })} 
                               min="1"
                             />
                             <select 
                               className="flex-1 p-2 rounded-lg bg-white border-none font-bold text-xs uppercase outline-none"
                               value={tempTagRule.unit}
                               onChange={e => setTempTagRule({ ...tempTagRule, unit: e.target.value as any })}
                             >
                               <option value="days">Dias</option>
                               <option value="weeks">Semanas</option>
                               <option value="months">Meses</option>
                             </select>
                             <button type="button" onClick={handleAddTagRule} className="bg-indigo-100 text-indigo-600 px-3 rounded-lg font-black text-xs hover:bg-indigo-600 hover:text-white transition-all">+</button>
                          </div>
                          <div className="space-y-1">
                             {(newTagData.followUpRules || []).map((rule, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white px-2 py-1 rounded-lg border border-slate-100">
                                   <span className="text-[9px] font-bold text-slate-600 uppercase">{rule.amount} {rule.unit === 'days' ? 'Dias' : rule.unit === 'weeks' ? 'Semanas' : 'Meses'}</span>
                                   <button type="button" onClick={() => handleRemoveTagRule(idx)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-times text-[10px]"></i></button>
                                </div>
                             ))}
                             {(newTagData.followUpRules || []).length === 0 && <p className="text-[8px] text-slate-400 italic text-center">Nenhuma regra definida</p>}
                          </div>
                       </div>
                    )}
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setActiveModal('checkout')} className="flex-1 py-4 text-slate-300 font-black uppercase text-[10px]">Voltar</button>
                    <button type="button" onClick={handleConfirmCreateTag} disabled={!newTagData.name} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase">Salvar Etiqueta</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeModal === 'edit_patient' && selectedApt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95">
              <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Editar Dados do Paciente</h3>
              <div className="space-y-4">
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Nome Completo</label>
                    <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800" value={selectedApt.patientName} onChange={e => setSelectedApt({...selectedApt, patientName: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Telefone</label>
                    <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800" value={selectedApt.phone || ''} onChange={e => setSelectedApt({...selectedApt, phone: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">CPF</label>
                    <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-800" value={selectedApt.cpf || ''} onChange={e => setSelectedApt({...selectedApt, cpf: e.target.value})} placeholder="000.000.000-00" />
                 </div>
                 <div className="pt-2 border-t border-slate-100">
                    <button type="button" onClick={(e) => handleDesmarcar(e, selectedApt.date, selectedApt.id)} className="w-full py-3 bg-red-50 text-red-500 rounded-xl text-[9px] font-black uppercase border border-red-100 hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                      <i className="fa-solid fa-trash-can"></i> Desmarcar Paciente (Excluir da Agenda)
                    </button>
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setActiveModal('none')} className="flex-1 py-4 text-slate-300 font-black uppercase text-[10px]">Cancelar</button>
                    <button type="button" onClick={savePatientDetails} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase">Salvar Alterações</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeModal === 'checkin' && selectedApt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-6">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Check-in Financeiro</p>
              <div className="flex gap-2">
                <button type="button" onClick={(e) => handleDesmarcar(e, selectedApt.date, selectedApt.id)} className="bg-red-50 hover:bg-red-100 text-red-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm border border-red-100 flex items-center gap-2">
                  <i className="fa-solid fa-trash-can"></i> Desmarcar
                </button>
                <button type="button" onClick={openPatientCard} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm">Ver Ficha</button>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block tracking-widest">Nome do Paciente</label>
              <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-slate-800 uppercase shadow-inner text-xl" value={selectedApt.patientName} onChange={e => setSelectedApt({...selectedApt, patientName: e.target.value.toUpperCase()})} />
            </div>
            
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-200 space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Dados de Cadastro</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Telefone</label>
                    <input type="text" className="w-full p-3 rounded-xl bg-white border border-slate-100 font-bold text-xs" value={selectedApt.phone || ''} onChange={e => setSelectedApt({...selectedApt, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-2">CPF</label>
                    <input type="text" className="w-full p-3 rounded-xl bg-white border border-slate-100 font-bold text-xs" value={selectedApt.cpf || ''} onChange={e => setSelectedApt({...selectedApt, cpf: e.target.value})} placeholder="CPF..." />
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Cidade/Estado</label>
                  <input type="text" className="w-full p-3 rounded-xl bg-white border border-slate-100 font-bold text-xs" value={selectedApt.cityState || ''} onChange={e => setSelectedApt({...selectedApt, cityState: e.target.value})} />
                </div>
                
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Observações</label>
                  <textarea className="w-full p-3 rounded-xl bg-white border border-slate-100 font-bold text-xs resize-none" rows={2} value={selectedApt.notes || ''} onChange={e => setSelectedApt({...selectedApt, notes: e.target.value})} placeholder="Observações do agendamento ou financeiro..." />
                </div>

                {selectedApt.locationId && (
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.locations.find(l => l.id === selectedApt.locationId)?.color || '#ccc' }}></div>
                     <span className="text-[9px] font-black uppercase text-indigo-700">
                        Local: {config.locations.find(l => l.id === selectedApt.locationId)?.name}
                     </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end px-2">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagamentos (Múltiplos)</p>
                </div>

                <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                    {(selectedApt.splitPayments || []).length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {selectedApt.splitPayments?.map((payment, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${payment.method === 'PIX' ? 'bg-emerald-400' : 'bg-indigo-400'}`}></div>
                                        <span className="text-[10px] font-bold text-slate-600 uppercase">{payment.method}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black text-slate-800">R$ {payment.value.toLocaleString('pt-BR')}</span>
                                        <button onClick={() => removePayment(idx)} className="text-slate-300 hover:text-red-500"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                                    </div>
                                </div>
                            ))}
                            <div className="p-3 bg-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-slate-500">Total Pago</span>
                                <span className="text-sm font-black text-slate-900">R$ {(selectedApt.paidValue || 0).toLocaleString('pt-BR')}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 text-center text-[10px] text-slate-400 italic">Nenhum pagamento adicionado.</div>
                    )}
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Adicionar Pagamento</p>
                        <button type="button" onClick={() => setShowCalc(!showCalc)} className="text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-1 hover:text-indigo-800 transition-colors">
                            <i className="fa-solid fa-calculator"></i> Calculadora
                        </button>
                    </div>
                    
                    {showCalc && (
                      <div className="bg-white p-4 rounded-[20px] border border-slate-100 animate-in slide-in-from-top-2 shadow-sm">
                         <div className="flex bg-slate-50 rounded-xl p-1 mb-3 border border-slate-100">
                            <button type="button" onClick={() => setCalcType('acrescimo')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${calcType === 'acrescimo' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>Acréscimo (+)</button>
                            <button type="button" onClick={() => setCalcType('desconto')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${calcType === 'desconto' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>Desconto (-)</button>
                         </div>
                         <div className="flex gap-2">
                           <input type="number" placeholder="%" className="flex-1 p-3 rounded-xl border border-slate-100 font-bold text-xs bg-slate-50" value={calcRate} onChange={e => setCalcRate(e.target.value)} />
                           <button type="button" onClick={applyCalculation} className="bg-emerald-500 text-white px-4 rounded-xl font-black text-[10px] uppercase shadow-sm hover:bg-emerald-600">Calcular</button>
                         </div>
                      </div>
                    )}

                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                        <input 
                            type="text" 
                            className="w-full p-3 pl-10 rounded-xl bg-white border-none font-black text-lg text-slate-800 shadow-inner placeholder:text-slate-200" 
                            placeholder="0,00"
                            value={paymentInput} 
                            onChange={e => setPaymentInput(e.target.value)} 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {['PIX', 'Dinheiro', 'Cartão Crédito', 'Cartão Débito'].map(method => (
                            <button 
                                key={method} 
                                type="button" 
                                onClick={() => setPaymentMethodInput(method as PaymentMethod)} 
                                className={`py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${paymentMethodInput === method ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-200'}`}
                            >
                                {method}
                            </button>
                        ))}
                    </div>
                    <button 
                        type="button" 
                        onClick={addPayment} 
                        disabled={!paymentInput || !paymentMethodInput}
                        className="w-full py-3 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase shadow-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Adicionar Valor
                    </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => { 
                      if(selectedApt && onStartConsultation) {
                          onUpdateAppointment(selectedApt.date, { ...selectedApt, status: 'check-in' });
                          if(selectedApt.cpf) {
                              const meta = patientMetadata[selectedApt.patientName] || { tags: [] };
                              setPatientMetadata({
                                  ...patientMetadata,
                                  [selectedApt.patientName]: { ...meta, cpf: selectedApt.cpf, phone: selectedApt.phone || meta.phone, birthDate: selectedApt.birthDate || meta.birthDate }
                              });
                          }
                          onStartConsultation(selectedApt.patientName);
                          setActiveModal('none');
                          setShowCalc(false);
                      }
                  }} 
                  className="w-full py-4 bg-emerald-500 text-white rounded-[32px] font-black text-sm shadow-xl uppercase transition-all hover:bg-emerald-600 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-stethoscope"></i> Iniciar Consulta Agora
                </button>
                <button 
                  type="button"
                  disabled={!isCheckinValid}
                  onClick={() => { 
                      if(selectedApt) {
                          onUpdateAppointment(selectedApt.date, { ...selectedApt, status: 'check-in' });
                          if(selectedApt.cpf) {
                              const meta = patientMetadata[selectedApt.patientName] || { tags: [] };
                              setPatientMetadata({
                                  ...patientMetadata,
                                  [selectedApt.patientName]: { ...meta, cpf: selectedApt.cpf, phone: selectedApt.phone || meta.phone, birthDate: selectedApt.birthDate || meta.birthDate }
                              });
                          }
                      }
                      setActiveModal('none'); 
                      setShowCalc(false); 
                  }} 
                  className={`w-full py-5 rounded-[32px] font-black text-lg shadow-xl uppercase transition-all ${isCheckinValid ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                  Confirmar Entrada
                </button>
              </div>
              
              <button type="button" onClick={() => { setActiveModal('none'); setShowCalc(false); }} className="w-full text-[10px] font-black text-slate-300 uppercase mt-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'checkout' && selectedApt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[48px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-6">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Resumo do Atendimento</p>
              <div className="flex gap-2">
                 <button type="button" onClick={(e) => handleDesmarcar(e, selectedApt.date, selectedApt.id)} className="bg-red-50 hover:bg-red-100 text-red-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm border border-red-100 flex items-center gap-2">
                   <i className="fa-solid fa-trash-can"></i> Desmarcar
                 </button>
                 <button type="button" onClick={openPatientCard} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm">Ver Ficha</button>
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-800 text-center uppercase mb-8 leading-tight">{selectedApt.patientName}</h3>
            
            <div className="space-y-6">
              {selectedApt.status === 'check-in' && (
                <button 
                  type="button"
                  onClick={() => {
                    if (selectedApt && onStartConsultation) {
                        onStartConsultation(selectedApt.patientName);
                        setActiveModal('none');
                    }
                  }}
                  className="w-full py-4 bg-emerald-500 text-white rounded-[32px] font-black text-sm shadow-xl uppercase transition-all hover:bg-emerald-600 flex items-center justify-center gap-2 mb-4"
                >
                  <i className="fa-solid fa-stethoscope"></i> Iniciar Atendimento (Ir ao Prontuário)
                </button>
              )}

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Etiquetar Paciente</p>
                  <div className="mb-3 relative">
                     <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                     <input type="text" placeholder="Buscar ou criar etiqueta..." className="w-full pl-8 p-3 rounded-xl bg-white border border-slate-100 text-xs font-bold" value={tagSearch} onChange={e => setTagSearch(e.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                     {filteredTags.map(tag => {
                        const currentTags = patientMetadata[selectedApt.patientName]?.tags || [];
                        const isSelected = currentTags.includes(tag.id);
                        return (
                          <button key={tag.id} type="button" onClick={() => togglePatientTag(tag.id)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all flex items-center gap-2 ${isSelected ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-100 border-transparent text-slate-400 opacity-60'}`}>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }}></div>
                            <span style={{ color: isSelected ? '#334155' : 'inherit' }}>{tag.name}</span>
                            {isSelected && <i className="fa-solid fa-check text-emerald-500 ml-1"></i>}
                          </button>
                        );
                     })}
                     {tagSearch && !filteredTags.some(t => t.name.toLowerCase() === tagSearch.toLowerCase()) && (
                       <button type="button" onClick={handleCreateTag} className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-indigo-100 text-indigo-600 border border-indigo-200 hover:bg-indigo-200">Criar "{tagSearch}"</button>
                     )}
                     {(config.tags || []).length === 0 && !tagSearch && <span className="text-[9px] text-slate-400 italic">Sem etiquetas</span>}
                  </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-slate-400 uppercase">Cidade/Estado</span>
                  <span className="font-bold text-slate-700">{selectedApt.cityState || 'N/I'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Telefone</span>
                  <div className="flex items-center gap-2">
                    <input className="font-black text-slate-700 text-xs bg-transparent border-none text-right w-32 focus:ring-0 p-0" value={selectedApt.phone || ''} onChange={e => setSelectedApt({...selectedApt, phone: e.target.value})} placeholder="-" />
                    <button type="button" onClick={() => copyToClipboard(selectedApt.phone || '')} className="text-indigo-600 hover:text-indigo-800"><i className="fa-solid fa-copy"></i></button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">CPF</span>
                  <input className="font-black text-slate-700 text-xs bg-transparent border-none text-right w-32 focus:ring-0 p-0" value={selectedApt.cpf || ''} onChange={e => setSelectedApt({...selectedApt, cpf: e.target.value})} placeholder="000.000.000-00" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase">Observações</label>
                   <textarea className="w-full p-3 mt-1 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 resize-none" rows={3} value={selectedApt.notes || ''} onChange={e => setSelectedApt({...selectedApt, notes: e.target.value})} placeholder="Adicionar observação..." />
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Valor Pago Total</span>
                    <span className="font-black text-emerald-600">R$ {selectedApt.paidValue?.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Método(s)</span>
                    <div className="text-right">
                        {(selectedApt.splitPayments || []).length > 0 ? (
                            selectedApt.splitPayments?.map((p, i) => (
                                <p key={i} className="text-[9px] font-black text-slate-700 uppercase">{p.method}: R$ {p.value}</p>
                            ))
                        ) : (
                            <span className="font-black text-slate-700 uppercase text-xs">{selectedApt.paymentMethod}</span>
                        )}
                    </div>
                  </div>
                  
                  <button type="button" onClick={() => setActiveModal('checkin')} className="w-full mt-3 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2">
                    <i className="fa-solid fa-pen-to-square"></i> Editar Pagamento / Voltar ao Check-in
                  </button>
                </div>
              </div>

              <div className="p-8 bg-amber-50 rounded-[40px] border border-amber-100 text-center">
                <label className="text-[10px] font-black text-amber-700 uppercase block mb-4 tracking-widest">Previsão Sugerida de Retorno</label>
                <div className="grid grid-cols-2 gap-4">
                  <select className="w-full p-4 rounded-2xl bg-white border-none shadow-sm font-black text-xs uppercase cursor-pointer" value={selectedApt.returnMonth || ""} onChange={e => setSelectedApt({...selectedApt, returnMonth: e.target.value})}>
                    <option value="">Mês</option>
                    {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select className="w-full p-4 rounded-2xl bg-white border-none shadow-sm font-black text-xs uppercase cursor-pointer" value={selectedApt.returnYear || ""} onChange={e => setSelectedApt({...selectedApt, returnYear: e.target.value})}>
                    <option value="">Ano</option>
                    {yearsArr.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {selectedApt.status !== 'atendido' && (
                <button type="button" onClick={() => { 
                    if(selectedApt) {
                        onUpdateAppointment(selectedApt.date, { ...selectedApt, status: 'atendido' }); 
                        if(selectedApt.cpf || selectedApt.phone || selectedApt.birthDate) {
                            const meta = patientMetadata[selectedApt.patientName] || { tags: [] };
                            setPatientMetadata({
                                ...patientMetadata,
                                [selectedApt.patientName]: { ...meta, cpf: selectedApt.cpf || meta.cpf, phone: selectedApt.phone || meta.phone, birthDate: selectedApt.birthDate || meta.birthDate }
                              });
                        }
                    }
                    setActiveModal('none'); 
                }} className="w-full mt-6 py-5 bg-emerald-500 text-white rounded-[32px] font-black text-lg shadow-xl shadow-emerald-100 uppercase hover:bg-emerald-600 transition-all">
                  Confirmar Atendimento Realizado
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;