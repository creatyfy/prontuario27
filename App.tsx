import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Agenda from './components/Agenda';
import PatientList from './components/PatientList';
import CRM from './components/CRM';
import Scripts from './components/Scripts';
import Documents from './components/Documents';
import Partners from './components/Partners';
import Exams from './components/Exams';
import Budgets from './components/Budgets';
import Administration from './components/Administration';
import Settings from './components/Settings';
import EMREditor from './components/EMREditor';
import SuperAdmin from './components/SuperAdmin';
import NewScales from './components/NewScales';
import PatientUploadPortal from './components/PatientUploadPortal';
import { ConfirmProvider } from './ConfirmContext';
import { DEFAULT_CONFIG, MOCK_DATA, DEFAULT_USERS, MOCK_WAITLIST } from './constants';
import { UserAccount, ClinicConfig, DaySchedule, PatientMetadata, WaitlistPatient, Appointment } from './types';

function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('neuroclinic_users');
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });
  
  const [activeTab, setActiveTab] = useState('agenda');
  const [clinicConfig, setClinicConfig] = useState<ClinicConfig>(() => {
    const saved = localStorage.getItem('neuroclinic_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  // Portal State
  const [portalMode, setPortalMode] = useState<{ active: boolean; patientName: string; expires: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const portal = params.get('portal');
    const pEnc = params.get('p');
    const exp = params.get('e');

    if (portal && pEnc && exp) {
       try {
         const name = atob(pEnc);
         setPortalMode({ active: true, patientName: name, expires: exp });
       } catch (e) {
         console.error("Portal Error", e);
       }
    }
  }, []);

  // Data States
  const [clinicData, setClinicData] = useState<Record<string, DaySchedule>>(() => {
    const saved = localStorage.getItem('neuroclinic_data');
    if (saved) return JSON.parse(saved);
    // Convert array to record
    return MOCK_DATA.reduce((acc, curr) => ({...acc, [curr.date]: curr}), {});
  });

  const [waitlist, setWaitlist] = useState<WaitlistPatient[]>(() => {
    const saved = localStorage.getItem('neuroclinic_waitlist');
    return saved ? JSON.parse(saved) : MOCK_WAITLIST;
  });

  const [patientMetadata, setPatientMetadata] = useState<PatientMetadata>(() => {
    const saved = localStorage.getItem('neuroclinic_metadata');
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedPatientCard, setSelectedPatientCard] = useState<string | undefined>(undefined);

  // Persistence Effects
  useEffect(() => localStorage.setItem('neuroclinic_users', JSON.stringify(users)), [users]);
  useEffect(() => localStorage.setItem('neuroclinic_config', JSON.stringify(clinicConfig)), [clinicConfig]);
  useEffect(() => localStorage.setItem('neuroclinic_data', JSON.stringify(clinicData)), [clinicData]);
  useEffect(() => localStorage.setItem('neuroclinic_waitlist', JSON.stringify(waitlist)), [waitlist]);
  useEffect(() => localStorage.setItem('neuroclinic_metadata', JSON.stringify(patientMetadata)), [patientMetadata]);

  // Handlers
  const handleLogin = (user: UserAccount) => setCurrentUser(user);
  const handleLogout = () => { setCurrentUser(null); setActiveTab('agenda'); };

  const updateAppointment = (date: string, apt: Appointment) => {
    setClinicData(prev => {
      const day = prev[date] || { date, weekday: new Date(date).toLocaleDateString('pt-BR', { weekday: 'long' }), appointments: [], checklist: [] };
      const newApts = day.appointments.some(a => a.id === apt.id)
        ? day.appointments.map(a => a.id === apt.id ? apt : a)
        : [...day.appointments, apt];
      return { ...prev, [date]: { ...day, appointments: newApts } };
    });
  };

  const addAppointment = (date: string, apt: Appointment) => {
    updateAppointment(date, apt);
  };

  const deleteAppointment = (date: string, aptId: string) => {
    setClinicData(prev => {
      const day = prev[date];
      if (!day) return prev;
      return {
        ...prev,
        [date]: {
          ...day,
          appointments: day.appointments.map(a => a.id === aptId ? { ...a, status: 'cancelado' as const } : a).filter(a => a.status !== 'cancelado')
        }
      };
    });
  };

  const confirmAppointment = (date: string, aptId: string) => {
    const day = clinicData[date];
    const apt = day?.appointments.find(a => a.id === aptId);
    if (apt) updateAppointment(date, { ...apt, confirmed: true });
  };

  const updateDaySchedule = (date: string, updates: Partial<DaySchedule>) => {
    setClinicData(prev => {
      const day = prev[date] || { date, weekday: new Date(date).toLocaleDateString('pt-BR', { weekday: 'long' }), appointments: [], checklist: [] };
      return { ...prev, [date]: { ...day, ...updates } };
    });
  };

  const addToWaitlist = (patient: WaitlistPatient) => setWaitlist([...waitlist, patient]);
  const removeFromWaitlist = (id: string) => setWaitlist(waitlist.filter(p => p.id !== id));
  const updateWaitlist = (patient: WaitlistPatient) => setWaitlist(prev => prev.map(p => p.id === patient.id ? patient : p));
  
  const promoteFromWaitlist = (patientId: string, date: string, apt: Appointment) => {
    addAppointment(date, apt);
    removeFromWaitlist(patientId);
  };

  const unifyPatients = (targetName: string, sourceName: string) => {
    // 1. Update all appointments
    const newData = { ...clinicData };
    Object.keys(newData).forEach(date => {
      newData[date].appointments = newData[date].appointments.map(apt => 
        apt.patientName === sourceName ? { ...apt, patientName: targetName } : apt
      );
    });
    setClinicData(newData);

    // 2. Update Waitlist
    setWaitlist(prev => prev.map(p => p.name === sourceName ? { ...p, name: targetName } : p));

    // 3. Merge Metadata
    const targetMeta = patientMetadata[targetName] || { tags: [] };
    const sourceMeta = patientMetadata[sourceName] || { tags: [] };
    
    // Create new metadata object to avoid mutation issues
    const newMeta = { ...patientMetadata };
    
    // Remove source key
    delete newMeta[sourceName];
    
    // Merge into target
    newMeta[targetName] = {
        ...targetMeta,
        tags: [...new Set([...(targetMeta.tags || []), ...(sourceMeta.tags || [])])],
        phone: targetMeta.phone || sourceMeta.phone,
        cpf: targetMeta.cpf || sourceMeta.cpf,
        birthDate: targetMeta.birthDate || sourceMeta.birthDate,
        notes: (targetMeta.notes || '') + (sourceMeta.notes ? '\n' + sourceMeta.notes : '')
    };
    setPatientMetadata(newMeta);
  };

  const deletePatient = (name: string) => {
    // Remove from Agenda
    const newData = { ...clinicData };
    Object.keys(newData).forEach(date => {
       newData[date].appointments = newData[date].appointments.filter(a => a.patientName !== name);
    });
    setClinicData(newData);
    
    // Remove from Waitlist
    setWaitlist(prev => prev.filter(p => p.name !== name));
    
    // Remove Metadata
    const newMeta = { ...patientMetadata };
    delete newMeta[name];
    setPatientMetadata(newMeta);
  };

  const openPatientInfo = (name: string) => {
    setSelectedPatientCard(name);
    setActiveTab('pacientes');
  };

  const handleStartConsultation = (name: string) => {
    setSelectedPatientCard(name);
    setActiveTab('prontuario');
  };

  if (portalMode?.active) {
    return (
      <PatientUploadPortal 
        patientName={portalMode.patientName} 
        expires={portalMode.expires} 
        clinicName={clinicConfig.doctorName || "NeuroClinic Pro"} 
      />
    );
  }

  if (!currentUser) {
    return (
      <ConfirmProvider>
        <Login onLogin={handleLogin} users={users} />
      </ConfirmProvider>
    );
  }

  if (currentUser.isMaster) {
    return (
       <ConfirmProvider>
          <SuperAdmin users={users} onUpdateUsers={setUsers} onLogout={handleLogout} />
       </ConfirmProvider>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'agenda':
        return <Agenda data={clinicData} waitlist={waitlist} config={clinicConfig} patientMetadata={patientMetadata} onUpdateConfig={setClinicConfig} setPatientMetadata={setPatientMetadata} onUpdateAppointment={updateAppointment} onAddAppointment={addAppointment} onDeleteAppointment={deleteAppointment} onPromoteFromWaitlist={promoteFromWaitlist} onAddToWaitlist={addToWaitlist} onRemoveFromWaitlist={removeFromWaitlist} onUpdateWaitlist={updateWaitlist} onOpenPatientInfo={openPatientInfo} onStartConsultation={handleStartConsultation} onUpdateDaySchedule={updateDaySchedule} />;
      case 'pacientes':
        return <PatientList agendaData={Object.values(clinicData)} config={clinicConfig} patientMetadata={patientMetadata} setPatientMetadata={setPatientMetadata} onSelectPatient={(p) => { setActiveTab('agenda'); }} onSelectPatientContext={setSelectedPatientCard} onStartConsultation={() => setActiveTab('prontuario')} selectedPatientName={selectedPatientCard} onUnifyPatients={unifyPatients} onDeletePatient={deletePatient} />;
      case 'crm':
        return <CRM agendaData={clinicData} config={clinicConfig} patientMetadata={patientMetadata} />;
      case 'scripts':
        return <Scripts role={currentUser.role} locations={clinicConfig.locations} agendaData={clinicData} config={clinicConfig} onConfirmAppointment={confirmAppointment} onUpdateAppointment={updateAppointment} onDeleteAppointment={deleteAppointment} />;
      case 'documentos':
        return <Documents />;
      case 'escalas_novas':
        return <NewScales patientMetadata={patientMetadata} setPatientMetadata={setPatientMetadata} selectedPatientName={selectedPatientCard} />;
      case 'parceiros':
        return <Partners />;
      case 'exames-geral':
        return <Exams />;
      case 'orcamentos':
        return <Budgets />;
      case 'administracao':
        return <Administration agendaData={Object.values(clinicData)} config={clinicConfig} />;
      case 'configuracoes':
        return <Settings config={clinicConfig} users={users} currentUser={currentUser} onUpdateConfig={setClinicConfig} onUpdateUsers={setUsers} />;
      case 'prontuario':
        return <EMREditor activePatientName={selectedPatientCard} />;
      default:
        return <Agenda data={clinicData} waitlist={waitlist} config={clinicConfig} patientMetadata={patientMetadata} onUpdateConfig={setClinicConfig} setPatientMetadata={setPatientMetadata} onUpdateAppointment={updateAppointment} onAddAppointment={addAppointment} onDeleteAppointment={deleteAppointment} onPromoteFromWaitlist={promoteFromWaitlist} onAddToWaitlist={addToWaitlist} onRemoveFromWaitlist={removeFromWaitlist} onUpdateWaitlist={updateWaitlist} onOpenPatientInfo={openPatientInfo} onStartConsultation={handleStartConsultation} onUpdateDaySchedule={updateDaySchedule} />;
    }
  };

  return (
    <ConfirmProvider>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} user={currentUser} onLogout={handleLogout}>
        {renderContent()}
      </Layout>
    </ConfirmProvider>
  );
}

export default App;
