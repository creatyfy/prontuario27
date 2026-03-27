import React, { useState, useEffect } from 'react';
import { useConfirm } from '../ConfirmContext';
import { ClinicConfig, UserAccount, LocationInfo, UserRole, LocationSchedule, PatientTag, ConsultationTypeConfig, SecretaryInfoItem, ChecklistTask, FollowUpRule, TranscriptionConfig, TranscriptionSection, TranscriptionTemplate, ConclusionType, DocumentTemplate } from '../types';

interface SettingsProps {
  config: ClinicConfig;
  users: UserAccount[];
  currentUser: UserAccount;
  onUpdateConfig: (newConfig: ClinicConfig) => void;
  onUpdateUsers: (newUsers: UserAccount[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ config, users, currentUser, onUpdateConfig, onUpdateUsers }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule' | 'users' | 'tags' | 'confirmation' | 'types' | 'info' | 'ai' | 'modelos'>('schedule');
  const [editingLocation, setEditingLocation] = useState<Partial<LocationInfo> | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<UserAccount> | null>(null);
  const [newTag, setNewTag] = useState<Partial<PatientTag>>({ name: '', color: '#6366f1', followUpRules: [] });
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newGuideItem, setNewGuideItem] = useState('');
  const confirm = useConfirm();
  
  // IA & Transcrição
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<TranscriptionSection | null>(null);
  const [editingConclusion, setEditingConclusion] = useState<ConclusionType | null>(null);

  // Modelos Prontos
  const [newDocTemplate, setNewDocTemplate] = useState<Partial<DocumentTemplate>>({ name: '', category: 'Receita', keyword: '', content: '' });

  // Sincronizar template selecionado ao abrir a aba
  useEffect(() => {
    if (activeTab === 'ai' && !selectedTemplateId && config.transcriptionConfig?.templates?.length) {
      setSelectedTemplateId(config.transcriptionConfig.templates[0].id);
    }
  }, [activeTab, config.transcriptionConfig]);

  // Novos estados para checklist avançado
  const [taskFrequency, setTaskFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'specific'>('daily');
  const [taskFreqValue, setTaskFreqValue] = useState<string>('');

  const [newConsultationType, setNewConsultationType] = useState<Partial<ConsultationTypeConfig>>({ name: '', defaultValue: 0, category: 'consulta', requiresFollowUp: true, followUpRules: [], isHighlighted: false, highlightIcon: 'fa-star', highlightColor: '#ef4444' });
  const [tempRuleAmount, setTempRuleAmount] = useState<string>('1');
  const [tempRuleUnit, setTempRuleUnit] = useState<'days'|'weeks'|'months'>('months');

  // Estados temporários para regras de tags
  const [tempTagRuleAmount, setTempTagRuleAmount] = useState<string>('1');
  const [tempTagRuleUnit, setTempTagRuleUnit] = useState<'days'|'weeks'|'months'>('months');
  const [enableTagProtocol, setEnableTagProtocol] = useState(false);

  // Estados temporários para regras padrão (Pacientes sem etiqueta)
  const [tempDefaultRuleAmount, setTempDefaultRuleAmount] = useState<string>('1');
  const [tempDefaultRuleUnit, setTempDefaultRuleUnit] = useState<'days'|'weeks'|'months'>('months');

  const [newInfoItem, setNewInfoItem] = useState<Partial<SecretaryInfoItem>>({ title: '', content: '' });

  const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#2563eb', '#475569'];
  const TAG_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#64748b', '#f97316', '#14b8a6'];
  const HIGHLIGHT_ICONS = ['fa-star', 'fa-circle-exclamation', 'fa-fire', 'fa-heart', 'fa-gem', 'fa-bolt', 'fa-crown'];
  const HIGHLIGHT_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#000000'];

  const MENU_OPTIONS = [
    { id: 'agenda', label: 'Agenda' },
    { id: 'pacientes', label: 'Pacientes' },
    { id: 'crm', label: 'CRM/Follow-up' },
    { id: 'scripts', label: 'Secretaria' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'parceiros', label: 'Contatos Parceiros' },
    { id: 'orcamentos', label: 'Orçamentos' },
    { id: 'administracao', label: 'Caixa' },
    { id: 'configuracoes', label: 'Configurações' },
  ];

  const visibleUsers = users.filter(u => u.parentId === currentUser.id);

  const validatePassword = (pwd: string) => {
    if (!pwd) return false;
    const hasMinLength = pwd.length >= 9;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    return hasMinLength && hasUpper && hasNumber && hasSpecial;
  };

  const handleSaveLocation = () => {
    if (editingLocation?.name && editingLocation?.address) {
      const newLoc: LocationInfo = {
        id: editingLocation.id || `loc-${Date.now()}`,
        name: editingLocation.name,
        address: editingLocation.address,
        mapLink: editingLocation.mapLink || '',
        observations: editingLocation.observations || '', 
        color: editingLocation.color || COLORS[0],
        slotDuration: editingLocation.slotDuration || 45,
        schedule: editingLocation.schedule || [],
        phone: editingLocation.phone || '',
        whatsapp: editingLocation.whatsapp || '',
        email: editingLocation.email || '',
        website: editingLocation.website || '',
      };
      const newLocations = editingLocation.id 
        ? config.locations.map(l => l.id === newLoc.id ? newLoc : l)
        : [...config.locations, newLoc];
      onUpdateConfig({ ...config, locations: newLocations });
      setEditingLocation(null);
    }
  };

  const handleScheduleChange = (dayIndex: number, action: 'toggle' | 'add' | 'remove' | 'update', indexOrField?: any, value?: any) => {
    if (!editingLocation) return;
    let newScheduleList = [...(editingLocation.schedule || [])];
    if (action === 'toggle') {
      const isActive = value;
      if (isActive) {
        const hasEntry = newScheduleList.some(s => s.dayOfWeek === dayIndex);
        if (!hasEntry) newScheduleList.push({ dayOfWeek: dayIndex, start: '08:00', end: '18:00', active: true });
      } else {
        newScheduleList = newScheduleList.filter(s => s.dayOfWeek !== dayIndex);
      }
    } else if (action === 'add') {
      newScheduleList.push({ dayOfWeek: dayIndex, start: '08:00', end: '12:00', active: true });
    } else if (action === 'remove') {
      const dayEntries = newScheduleList.filter(s => s.dayOfWeek === dayIndex);
      const entryToRemove = dayEntries[indexOrField as number];
      const realIndex = newScheduleList.indexOf(entryToRemove);
      if (realIndex > -1) newScheduleList.splice(realIndex, 1);
    } else if (action === 'update') {
      const dayEntries = newScheduleList.filter(s => s.dayOfWeek === dayIndex);
      const entryToUpdate = dayEntries[indexOrField.index as number];
      const realIndex = newScheduleList.indexOf(entryToUpdate);
      const field = indexOrField.field;
      if (realIndex > -1) newScheduleList[realIndex] = { ...newScheduleList[realIndex], [field]: value };
    }
    setEditingLocation({ ...editingLocation, schedule: newScheduleList });
  };

  const handleDeleteLocation = (id: string) => {
    confirm({
      title: 'Remover Local',
      message: 'Tem certeza que deseja remover este local de atendimento?',
      confirmLabel: 'Remover',
      onConfirm: () => {
        onUpdateConfig({ ...config, locations: config.locations.filter(l => l.id !== id) });
      }
    });
  };

  const handleSaveUser = () => {
    if (editingUser?.name && editingUser?.password) {
      if (!validatePassword(editingUser.password)) {
        confirm({
          type: 'alert',
          title: 'Senha Fraca',
          message: 'A senha deve ter no mínimo 9 caracteres, uma letra maiúscula, um número e um caractere especial.'
        });
        return;
      }

      const newUser: UserAccount = {
        id: editingUser.id || `user-${Date.now()}`,
        name: editingUser.name,
        username: editingUser.username || editingUser.name,
        role: editingUser.role || 'secretary',
        password: editingUser.password,
        permissions: editingUser.permissions || [],
        parentId: currentUser.id 
      };
      const newUsers = editingUser.id ? users.map(u => u.id === newUser.id ? newUser : u) : [...users, newUser];
      onUpdateUsers(newUsers);
      setEditingUser(null);
    }
  };

  const handleDeleteUser = (id: string) => {
    confirm({
      title: 'Remover Usuário',
      message: 'Tem certeza que deseja remover este colaborador da sua conta?',
      confirmLabel: 'Remover',
      onConfirm: () => onUpdateUsers(users.filter(u => u.id !== id))
    });
  };

  const handleAddTag = () => {
    if (newTag.name) {
      const tag: PatientTag = { 
        id: newTag.id || `tag-${Date.now()}`, 
        name: newTag.name, 
        color: newTag.color || TAG_COLORS[0],
        followUpRules: enableTagProtocol ? newTag.followUpRules : []
      };
      
      const newTags = newTag.id 
        ? config.tags.map(t => t.id === tag.id ? tag : t)
        : [...(config.tags || []), tag];

      onUpdateConfig({ ...config, tags: newTags });
      setNewTag({ name: '', color: TAG_COLORS[0], followUpRules: [] });
      setEnableTagProtocol(false);
    }
  };

  const handleEditTag = (tag: PatientTag) => {
     setNewTag(tag);
     setEnableTagProtocol(!!(tag.followUpRules && tag.followUpRules.length > 0));
  };

  const handleDeleteTag = (id: string) => {
    confirm({
      title: 'Remover Etiqueta',
      message: 'Deseja remover esta etiqueta? Pacientes que a utilizam não serão afetados nos demais dados.',
      confirmLabel: 'Remover',
      onConfirm: () => onUpdateConfig({ ...config, tags: (config.tags || []).filter(t => t.id !== id) })
    });
  };

  const handleAddTagRule = () => {
    if (tempTagRuleAmount && Number(tempTagRuleAmount) > 0) {
       const newRule: FollowUpRule = {
          amount: Number(tempTagRuleAmount),
          unit: tempTagRuleUnit
       };
       setNewTag(prev => ({
          ...prev,
          followUpRules: [...(prev.followUpRules || []), newRule]
       }));
       setTempTagRuleAmount('1');
    }
  };

  const removeTagRule = (index: number) => {
     setNewTag(prev => ({
        ...prev,
        followUpRules: (prev.followUpRules || []).filter((_, i) => i !== index)
     }));
  };

  const handleAddDefaultRule = () => {
    if (tempDefaultRuleAmount && Number(tempDefaultRuleAmount) > 0) {
       const newRule: FollowUpRule = {
          amount: Number(tempDefaultRuleAmount),
          unit: tempDefaultRuleUnit
       };
       const currentRules = config.defaultFollowUpRules || [{ amount: 1, unit: 'months' }, { amount: 3, unit: 'months' }, { amount: 6, unit: 'months' }];
       onUpdateConfig({
          ...config,
          defaultFollowUpRules: [...currentRules, newRule]
       });
       setTempDefaultRuleAmount('1');
    }
  };

  const handleRemoveDefaultRule = (index: number) => {
     const currentRules = config.defaultFollowUpRules || [{ amount: 1, unit: 'months' }, { amount: 3, unit: 'months' }, { amount: 6, unit: 'months' }];
     onUpdateConfig({
        ...config,
        defaultFollowUpRules: currentRules.filter((_, i) => i !== index)
     });
  };

  const updateScheme = (dayOfWeek: number, typeName: string, newCount: number) => {
    if (newCount < 0) return;
    const currentSchemes = config.confirmationConfig?.dailySchemes || [];
    let nextSchemes = [...currentSchemes];
    const schemeIdx = nextSchemes.findIndex(s => s.dayOfWeek === dayOfWeek);

    if (schemeIdx > -1) {
      const scheme = { ...nextSchemes[schemeIdx] };
      const items = [...scheme.items];
      const itemIdx = items.findIndex(i => i.type === typeName);
      if (itemIdx > -1) {
        items[itemIdx] = { ...items[itemIdx], count: newCount };
      } else {
        items.push({ type: typeName, count: newCount });
      }
      scheme.items = items;
      nextSchemes[schemeIdx] = scheme;
    } else {
      nextSchemes.push({
        dayOfWeek,
        items: [{ type: typeName, count: newCount }]
      });
    }

    onUpdateConfig({
      ...config,
      confirmationConfig: {
        ...config.confirmationConfig,
        dailySchemes: nextSchemes
      }
    });
  };

  const handleAddChecklist = () => {
    if (newChecklistItem.trim()) {
      const currentList = config.confirmationConfig.customChecklist || [];
      const newTask: ChecklistTask = {
        id: `task-${Date.now()}`,
        task: newChecklistItem.trim(),
        frequency: taskFrequency,
        dayOfWeek: taskFrequency === 'weekly' ? parseInt(taskFreqValue) : undefined,
        dayOfMonth: taskFrequency === 'monthly' ? parseInt(taskFreqValue) : undefined,
        date: taskFrequency === 'specific' ? taskFreqValue : undefined
      };
      onUpdateConfig({
        ...config,
        confirmationConfig: {
          ...config.confirmationConfig,
          customChecklist: [...currentList as any, newTask]
        }
      });
      setNewChecklistItem('');
      setTaskFreqValue('');
    }
  };

  const handleDeleteChecklist = (id: string) => {
    const currentList = config.confirmationConfig.customChecklist || [];
    onUpdateConfig({
      ...config,
      confirmationConfig: {
        ...config.confirmationConfig,
        customChecklist: (currentList as any).filter((t: ChecklistTask) => t.id !== id)
      }
    });
  };

  const handleAddRule = () => {
    if (tempRuleAmount && Number(tempRuleAmount) > 0) {
       const newRule: FollowUpRule = {
          amount: Number(tempRuleAmount),
          unit: tempRuleUnit
       };
       setNewConsultationType(prev => ({
          ...prev,
          followUpRules: [...(prev.followUpRules || []), newRule]
       }));
       setTempRuleAmount('1');
    }
  };

  const removeRule = (index: number) => {
     setNewConsultationType(prev => ({
        ...prev,
        followUpRules: (prev.followUpRules || []).filter((_, i) => i !== index)
     }));
  };

  const handleAddConsultationType = () => {
    if (newConsultationType.name) {
      const newType: ConsultationTypeConfig = { 
        id: `ct-${Date.now()}`, 
        name: newConsultationType.name, 
        defaultValue: Number(newConsultationType.defaultValue) || 0, 
        category: newConsultationType.category || 'consulta',
        requiresFollowUp: !!newConsultationType.requiresFollowUp,
        followUpRules: newConsultationType.followUpRules || [],
        isHighlighted: !!newConsultationType.isHighlighted,
        highlightIcon: newConsultationType.highlightIcon || 'fa-star',
        highlightColor: newConsultationType.highlightColor || '#ef4444'
      };
      onUpdateConfig({ ...config, consultationTypes: [...(config.consultationTypes || []), newType] });
      setNewConsultationType({ name: '', defaultValue: 0, category: 'consulta', requiresFollowUp: true, followUpRules: [], isHighlighted: false, highlightIcon: 'fa-star', highlightColor: '#ef4444' });
    }
  };

  const handleDeleteConsultationType = (id: string) => {
    confirm({
      title: 'Remover Tipo de Consulta',
      message: 'Tem certeza que deseja remover este tipo de atendimento?',
      confirmLabel: 'Remover',
      onConfirm: () => onUpdateConfig({ ...config, consultationTypes: (config.consultationTypes || []).filter(t => t.id !== id) })
    });
  };

  const handleAddInfoItem = () => {
    if (newInfoItem.title && newInfoItem.content) {
      const item: SecretaryInfoItem = { id: `info-${Date.now()}`, title: newInfoItem.title, content: newInfoItem.content };
      onUpdateConfig({ ...config, secretaryInfo: [...(config.secretaryInfo || []), item] });
      setNewInfoItem({ title: '', content: '' });
    }
  };

  const handleDeleteInfoItem = (id: string) => {
    confirm({
      title: 'Remover Informação',
      message: 'Deseja remover esta informação médica?',
      confirmLabel: 'Remover',
      onConfirm: () => onUpdateConfig({ ...config, secretaryInfo: (config.secretaryInfo || []).filter(i => i.id !== id) })
    });
  };

  const togglePermission = (id: string) => {
    if (!editingUser) return;
    const currentPermissions = editingUser.permissions || [];
    const newPermissions = currentPermissions.includes(id) 
      ? currentPermissions.filter(p => p !== id) 
      : [...currentPermissions, id];
    setEditingUser({ ...editingUser, permissions: newPermissions });
  };

  // IA Handlers (Refatorados para usar o modal de confirmação interno)
  const handleAddTemplate = () => {
    confirm({
      type: 'prompt',
      title: 'Novo Modelo',
      message: 'Nome do novo modelo de transcrição (ex: Alzheimer):',
      onConfirm: (name) => {
        if (name && config.transcriptionConfig) {
          const newTemplate: TranscriptionTemplate = {
            id: `tpl-${Date.now()}`,
            name,
            sections: [
              { id: 's1', label: 'Queixa Principal', prompt: 'Descreva a queixa identificada no áudio.', enabled: true, order: 1 },
              { id: 's2', label: 'HDA', prompt: 'História da doença atual conforme relatado.', enabled: true, order: 2 }
            ],
            clinicalGuide: []
          };
          onUpdateConfig({
            ...config,
            transcriptionConfig: {
              ...config.transcriptionConfig,
              templates: [...config.transcriptionConfig.templates, newTemplate]
            }
          });
          setSelectedTemplateId(newTemplate.id);
        }
      }
    });
  };

  const handleDeleteTemplate = (id: string) => {
    if (config.transcriptionConfig && config.transcriptionConfig.templates.length > 1) {
      confirm({
        title: 'Excluir Modelo',
        message: 'Deseja apagar permanentemente este modelo de transcrição?',
        confirmLabel: 'Excluir',
        onConfirm: () => {
          const nextTemplates = config.transcriptionConfig!.templates.filter(t => t.id !== id);
          onUpdateConfig({
            ...config,
            transcriptionConfig: { ...config.transcriptionConfig!, templates: nextTemplates }
          });
          setSelectedTemplateId(nextTemplates[0].id);
        }
      });
    } else {
      confirm({
        type: 'alert',
        title: 'Ação Bloqueada',
        message: 'Você deve manter pelo menos um modelo de transcrição.'
      });
    }
  };

  const handleAddSection = () => {
    if (selectedTemplateId && config.transcriptionConfig) {
      confirm({
        type: 'prompt',
        title: 'Nova Seção',
        message: 'Nome da nova seção (ex: Exame Mental):',
        onConfirm: (label) => {
          if (label) {
            const templates = config.transcriptionConfig!.templates.map(t => {
              if (t.id === selectedTemplateId) {
                const nextOrder = t.sections.length + 1;
                return {
                  ...t,
                  sections: [...t.sections, { id: `sec-${Date.now()}`, label, prompt: `Extraia informações detalhadas para a seção ${label}.`, enabled: true, order: nextOrder }]
                };
              }
              return t;
            });
            onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig!, templates } });
          }
        }
      });
    }
  };

  const handleToggleSection = (sectionId: string) => {
    if (!config.transcriptionConfig || !selectedTemplateId) return;
    const templates = config.transcriptionConfig.templates.map(t => {
      if (t.id === selectedTemplateId) {
        return {
          ...t,
          sections: t.sections.map(s => s.id === sectionId ? { ...s, enabled: !s.enabled } : s)
        };
      }
      return t;
    });
    onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig, templates } });
  };

  const handleMoveSection = (sectionId: string, direction: 'up' | 'down') => {
    if (!config.transcriptionConfig || !selectedTemplateId) return;
    const templates = config.transcriptionConfig.templates.map(t => {
      if (t.id === selectedTemplateId) {
        const list = [...t.sections].sort((a, b) => a.order - b.order);
        const index = list.findIndex(s => s.id === sectionId);
        if (direction === 'up' && index > 0) {
          [list[index - 1].order, list[index].order] = [list[index].order, list[index - 1].order];
        } else if (direction === 'down' && index < list.length - 1) {
          [list[index + 1].order, list[index].order] = [list[index].order, list[index + 1].order];
        }
        return { ...t, sections: list };
      }
      return t;
    });
    onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig, templates } });
  };

  const handleSaveSectionEdit = () => {
    if (editingSection && config.transcriptionConfig && selectedTemplateId) {
      const templates = config.transcriptionConfig.templates.map(t => {
        if (t.id === selectedTemplateId) {
          return {
            ...t,
            sections: t.sections.map(s => s.id === editingSection.id ? editingSection : s)
          };
        }
        return t;
      });
      onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig, templates } });
      setEditingSection(null);
    }
  };

  const handleAddGuideItem = () => {
    if (newGuideItem.trim() && selectedTemplateId && config.transcriptionConfig) {
      const templates = config.transcriptionConfig.templates.map(t => {
        if (t.id === selectedTemplateId) {
          return { ...t, clinicalGuide: [...(t.clinicalGuide || []), newGuideItem.trim()] };
        }
        return t;
      });
      onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig, templates } });
      setNewGuideItem('');
    }
  };

  const handleRemoveGuideItem = (idx: number) => {
    if (selectedTemplateId && config.transcriptionConfig) {
      const templates = config.transcriptionConfig.templates.map(t => {
        if (t.id === selectedTemplateId) {
          const next = [...(t.clinicalGuide || [])];
          next.splice(idx, 1);
          return { ...t, clinicalGuide: next };
        }
        return t;
      });
      onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig, templates } });
    }
  };

  // Conclusão Final Handlers
  const handleAddConclusionType = () => {
    confirm({
      type: 'prompt',
      title: 'Novo Tipo de Conclusão',
      message: 'Nome do modelo de conclusão (ex: Psiquiatria):',
      onConfirm: (name) => {
        if (name && config.transcriptionConfig) {
          const newConclusion: ConclusionType = {
            id: `concl-${Date.now()}`,
            name,
            prompt: `ROLE: Especialista Médico.\nINPUT 1: Contexto da consulta.\nINPUT 2: Ditado soberano.\nOBJETIVO: Gerar HD e Condutas.`
          };
          onUpdateConfig({
            ...config,
            transcriptionConfig: {
              ...config.transcriptionConfig,
              conclusionTypes: [...(config.transcriptionConfig.conclusionTypes || []), newConclusion]
            }
          });
        }
      }
    });
  };

  const handleSaveConclusionEdit = () => {
    if (editingConclusion && config.transcriptionConfig) {
      const conclusionTypes = (config.transcriptionConfig.conclusionTypes || []).map(c => 
        c.id === editingConclusion.id ? editingConclusion : c
      );
      onUpdateConfig({
        ...config,
        transcriptionConfig: { ...config.transcriptionConfig, conclusionTypes }
      });
      setEditingConclusion(null);
    }
  };

  const handleDeleteConclusionType = (id: string) => {
    if (config.transcriptionConfig && (config.transcriptionConfig.conclusionTypes || []).length > 1) {
       confirm({
         title: 'Excluir Tipo de Conclusão',
         message: 'Deseja apagar este modelo de síntese?',
         confirmLabel: 'Excluir',
         onConfirm: () => {
            const nextConclusions = config.transcriptionConfig!.conclusionTypes!.filter(c => c.id !== id);
            onUpdateConfig({
              ...config,
              transcriptionConfig: { ...config.transcriptionConfig!, conclusionTypes: nextConclusions, selectedConclusionTypeId: nextConclusions[0].id }
            });
         }
       });
    }
  };

  // Modelos Prontos Handlers
  const handleSaveDocTemplate = () => {
    if (newDocTemplate.name && newDocTemplate.content && newDocTemplate.keyword) {
      const template: DocumentTemplate = {
        id: newDocTemplate.id || `dt-${Date.now()}`,
        name: newDocTemplate.name,
        category: newDocTemplate.category as any,
        keyword: newDocTemplate.keyword,
        content: newDocTemplate.content
      };
      const templates = newDocTemplate.id 
        ? (config.documentTemplates || []).map(t => t.id === template.id ? template : t)
        : [...(config.documentTemplates || []), template];
      
      onUpdateConfig({ ...config, documentTemplates: templates });
      setNewDocTemplate({ name: '', category: 'Receita', keyword: '', content: '' });
    }
  };

  const handleEditDocTemplate = (t: DocumentTemplate) => {
    setNewDocTemplate(t);
  };

  const handleDeleteDocTemplate = (id: string) => {
    confirm({
      title: 'Excluir Modelo',
      message: 'Deseja apagar este modelo pronto?',
      confirmLabel: 'Excluir',
      onConfirm: () => onUpdateConfig({ ...config, documentTemplates: (config.documentTemplates || []).filter(t => t.id !== id) })
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateConfig({ ...config, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const currentTemplate = config.transcriptionConfig?.templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Configurações</h2>
          <p className="text-slate-500 font-medium tracking-tight mt-1">Personalize sua clínica e equipe</p>
        </div>
        <div className="w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-max">
            <button type="button" onClick={() => setActiveTab('schedule')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'schedule' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-50'}`}>Agenda & Locais</button>
            <button type="button" onClick={() => setActiveTab('types')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'types' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-50'}`}>Tipos & Valores</button>
            <button type="button" onClick={() => setActiveTab('tags')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'tags' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-50'}`}>Etiquetas</button>
            <button type="button" onClick={() => setActiveTab('confirmation')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'confirmation' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-50'}`}>Confirmações</button>
            <button type="button" onClick={() => setActiveTab('info')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'info' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-50'}`}>Informações Sec.</button>
            <button type="button" onClick={() => setActiveTab('ai')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'ai' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-50'}`}>IA & Transcrição</button>
            <button type="button" onClick={() => setActiveTab('modelos')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'modelos' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-50'}`}>Modelos Prontos</button>
            <button type="button" onClick={() => setActiveTab('users')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-50'}`}>Usuários</button>
            <button type="button" onClick={() => setActiveTab('profile')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-50'}`}>Perfil Médico</button>
          </div>
        </div>
      </header>

      <div className="transition-all duration-300">
        {activeTab === 'profile' && (
          <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm max-w-2xl mx-auto">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter flex items-center gap-3">
              <i className="fa-solid fa-user-doctor text-indigo-600"></i> Identificação Profissional
            </h3>
            <div className="space-y-6">
              <div className="flex flex-col items-center mb-6">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest self-start ml-2">Logomarca da Clínica</p>
                <div className="relative group w-32 h-32 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all hover:border-indigo-300">
                  {config.logo ? (
                    <img src={config.logo} alt="Logo Clínica" className="w-full h-full object-contain" />
                  ) : (
                    <i className="fa-solid fa-image text-3xl text-slate-200"></i>
                  )}
                  <label className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer gap-2">
                    <i className="fa-solid fa-camera text-xl"></i>
                    <span className="text-[8px] font-black uppercase tracking-widest">Alterar Logo</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  </label>
                </div>
                {config.logo && (
                  <button onClick={() => onUpdateConfig({...config, logo: undefined})} className="text-[9px] font-black text-red-400 uppercase mt-2 hover:text-red-600 transition-colors">Remover Logomarca</button>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block tracking-widest">Nome de Exibição</label>
                <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white transition-all font-bold text-slate-700 outline-none" value={config.doctorName} onChange={e => onUpdateConfig({ ...config, doctorName: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block tracking-widest">Especialidade</label>
                <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white transition-all font-bold text-slate-700 outline-none" value={config.specialty} onChange={e => onUpdateConfig({ ...config, specialty: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block tracking-widest">CRM</label>
                  <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white transition-all font-bold text-slate-700 outline-none" value={config.crm || ''} onChange={e => onUpdateConfig({ ...config, crm: e.target.value })} placeholder="Ex: 12345-MS" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block tracking-widest">RQE</label>
                  <input type="text" className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white transition-all font-bold text-slate-700 outline-none" value={config.rqe || ''} onChange={e => onUpdateConfig({ ...config, rqe: e.target.value })} placeholder="Ex: 6789" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'modelos' && (
          <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm max-w-5xl mx-auto">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Modelos de Documentos Prontos</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Crie bases para receitas, atestados e orientações vinculadas a palavras-chave.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 bg-slate-50 p-6 rounded-[28px] border border-slate-100 h-fit">
                <h4 className="text-xs font-black text-slate-700 uppercase mb-4">{newDocTemplate.id ? 'Editar Modelo' : 'Novo Modelo'}</h4>
                <div className="space-y-4">
                  <input type="text" placeholder="Nome do Modelo (ex: Receita Padrão)" className="w-full p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-bold text-xs outline-none" value={newDocTemplate.name} onChange={e => setNewDocTemplate({ ...newDocTemplate, name: e.target.value })} />
                  <select className="w-full p-3 rounded-xl bg-white border-none font-bold text-xs uppercase cursor-pointer outline-none" value={newDocTemplate.category} onChange={e => setNewDocTemplate({ ...newDocTemplate, category: e.target.value as any })}>
                    <option value="Receita">Receita</option>
                    <option value="Atestado">Atestado</option>
                    <option value="Orientação">Orientação</option>
                    <option value="Outro">Outro</option>
                  </select>
                  <div>
                    <label className="text-[8px] font-black text-indigo-600 uppercase ml-2 tracking-widest">Palavra-Chave (Para a IA)</label>
                    <input type="text" placeholder="ex: 'receita_base'" className="w-full p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-bold text-xs outline-none" value={newDocTemplate.keyword} onChange={e => setNewDocTemplate({ ...newDocTemplate, keyword: e.target.value })} />
                    <p className="text-[7px] text-slate-400 mt-1 ml-2">* Digite esta palavra no Assistente de Documentos para usar este modelo.</p>
                  </div>
                  <textarea placeholder="Conteúdo fixo do modelo..." className="w-full p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-medium text-xs h-40 resize-none outline-none" value={newDocTemplate.content} onChange={e => setNewDocTemplate({ ...newDocTemplate, content: e.target.value })} />
                  <button type="button" onClick={handleSaveDocTemplate} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Salvar Modelo</button>
                  {newDocTemplate.id && (
                    <button type="button" onClick={() => setNewDocTemplate({ name: '', category: 'Receita', keyword: '', content: '' })} className="w-full text-[9px] font-black text-slate-400 uppercase mt-2">Cancelar Edição</button>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 space-y-4">
                {(config.documentTemplates || []).map(t => (
                  <div key={t.id} className="bg-white border border-slate-100 p-6 rounded-[28px] shadow-sm relative group hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-black text-slate-800 text-sm uppercase">{t.name}</h4>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase tracking-tighter">{t.category}</span>
                          <span className="text-[8px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded uppercase tracking-tighter">Key: {t.keyword}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditDocTemplate(t)} className="text-slate-300 hover:text-indigo-600 p-1"><i className="fa-solid fa-pen"></i></button>
                        <button onClick={() => handleDeleteDocTemplate(t.id)} className="text-slate-300 hover:text-red-500 p-1"><i className="fa-solid fa-trash-can"></i></button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium whitespace-pre-wrap line-clamp-3 bg-slate-50 p-3 rounded-xl mt-3">"{t.content}"</p>
                  </div>
                ))}
                {(config.documentTemplates || []).length === 0 && (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[28px]">
                    <i className="fa-solid fa-file-invoice text-3xl mb-2"></i>
                    <p className="text-xs font-bold uppercase">Nenhum modelo cadastrado</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && config.transcriptionConfig && (
          <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm max-w-5xl mx-auto space-y-12">
            <div className="flex justify-between items-start">
               <div>
                 <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Modelos de IA & Transcrição</h3>
                 <p className="text-xs text-slate-500 font-medium mt-1">Crie estruturas personalizadas para diferentes quadros clínicos.</p>
               </div>
               <button onClick={handleAddTemplate} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                 <i className="fa-solid fa-plus-circle"></i> Novo Modelo
               </button>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
               <h4 className="text-xs font-black text-slate-700 uppercase mb-4 tracking-widest">Motor de Inteligência Artificial Global</h4>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'flash-2.5', label: 'Gemini 2.5 Flash', desc: 'Mais Rápido' },
                    { id: 'flash-3', label: 'Gemini 3 Flash', desc: 'Equilibrado' },
                    { id: 'pro-3', label: 'Gemini 3 Pro', desc: 'Precisão Alta' },
                    { id: 'thinking-3', label: 'Gemini 3 Thinking', desc: 'Raciocínio Profundo' }
                  ].map(m => (
                    <button 
                      key={m.id}
                      onClick={() => onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig!, model: m.id as any } })}
                      className={`p-4 rounded-2xl border-2 transition-all text-center ${config.transcriptionConfig?.model === m.id ? 'bg-white border-indigo-600 shadow-lg' : 'bg-white border-transparent hover:border-indigo-100'}`}
                    >
                       <p className={`text-[10px] font-black uppercase ${config.transcriptionConfig?.model === m.id ? 'text-indigo-600' : 'text-slate-600'}`}>{m.label}</p>
                       <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{m.desc}</p>
                    </button>
                  ))}
               </div>
            </div>

            {/* Gerenciamento de Modelos de Transcrição */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest px-2">Estrutura de Evolução Clínica</h4>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                 {config.transcriptionConfig.templates.map(t => (
                   <div key={t.id} className="relative group flex-shrink-0">
                      <button 
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-2 ${selectedTemplateId === t.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-100'}`}
                      >
                        {t.name}
                      </button>
                      {selectedTemplateId === t.id && config.transcriptionConfig!.templates.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center shadow-lg transition-transform hover:scale-110">
                          <i className="fa-solid fa-times"></i>
                        </button>
                      )}
                   </div>
                 ))}
              </div>

              {currentTemplate && (
                <div className="mt-4 space-y-10 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                     <div className="flex items-center gap-3">
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">{currentTemplate.name}</h4>
                        <button onClick={() => {
                          confirm({
                            type: 'prompt',
                            title: 'Renomear Modelo',
                            message: 'Novo nome do modelo:',
                            defaultValue: currentTemplate.name,
                            onConfirm: (name) => {
                              if(name) {
                                 const templates = config.transcriptionConfig!.templates.map(t => t.id === currentTemplate.id ? { ...t, name } : t);
                                 onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig!, templates } });
                              }
                            }
                          });
                        }} className="text-slate-300 hover:text-indigo-600"><i className="fa-solid fa-pen-to-square"></i></button>
                     </div>
                     <button onClick={handleAddSection} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl uppercase hover:bg-indigo-100 transition-all shadow-sm">+ Adicionar Seção</button>
                  </div>
                  <div className="space-y-3">
                    {[...currentTemplate.sections].sort((a,b) => a.order - b.order).map((s, idx, arr) => (
                      <div key={s.id} className={`p-5 rounded-3xl border transition-all ${s.enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1">
                                  <button onClick={() => handleMoveSection(s.id, 'up')} disabled={idx === 0} className="text-slate-300 hover:text-indigo-600 disabled:opacity-0"><i className="fa-solid fa-chevron-up text-[10px]"></i></button>
                                  <button onClick={() => handleMoveSection(s.id, 'down')} disabled={idx === arr.length - 1} className="text-slate-300 hover:text-indigo-600 disabled:opacity-0"><i className="fa-solid fa-chevron-down text-[10px]"></i></button>
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                     <h5 className="font-black text-slate-800 text-sm uppercase tracking-tight">{s.label}</h5>
                                     <button onClick={() => {
                                        confirm({
                                          type: 'prompt',
                                          title: 'Editar Seção',
                                          message: 'Editar nome da seção:',
                                          defaultValue: s.label,
                                          onConfirm: (label) => {
                                            if(label) {
                                               const templates = config.transcriptionConfig!.templates.map(t => {
                                                  if(t.id === selectedTemplateId) {
                                                     return { ...t, sections: t.sections.map(sec => sec.id === s.id ? { ...sec, label } : sec) };
                                                  }
                                                  return t;
                                               });
                                               onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig!, templates } });
                                            }
                                          }
                                        });
                                     }} className="text-slate-200 hover:text-indigo-400"><i className="fa-solid fa-pen text-[10px]"></i></button>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium mt-1 line-clamp-1 italic">"{s.prompt}"</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setEditingSection(s)} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-100 transition-all">Editar Prompt</button>
                                <button onClick={() => {
                                   confirm({
                                      title: 'Remover Seção',
                                      message: 'Deseja remover esta seção definitivamente?',
                                      confirmLabel: 'Sim, Remover',
                                      onConfirm: () => {
                                         const templates = config.transcriptionConfig!.templates.map(t => {
                                            if(t.id === selectedTemplateId) {
                                               return { ...t, sections: t.sections.filter(sec => sec.id !== s.id) };
                                            }
                                            return t;
                                         });
                                         onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig!, templates } });
                                      }
                                   });
                                }} className="bg-red-50 text-red-400 p-2 rounded-xl hover:bg-red-100"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={s.enabled} onChange={() => handleToggleSection(s.id)} className="sr-only peer" />
                                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                          </div>
                      </div>
                    ))}
                  </div>

                  {/* NOVO: GERENCIAMENTO DE GUIA CLÍNICO (CHECKLIST) */}
                  <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-6">
                      <div className="flex justify-between items-center px-2">
                        <h5 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-clipboard-list text-indigo-500"></i> Guia Clínico de Apoio (Checklist Visual)
                        </h5>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase ml-2">Adicione itens para aparecerem no topo da evolução (Ex: ALICIA FREDUSA).</p>
                      
                      <div className="flex gap-2">
                        <input 
                            type="text" 
                            className="flex-1 p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-bold text-xs outline-none shadow-sm"
                            placeholder="Ex: A – Aparecimento"
                            value={newGuideItem}
                            onChange={e => setNewGuideItem(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddGuideItem()}
                        />
                        <button onClick={handleAddGuideItem} className="bg-indigo-600 text-white px-6 rounded-xl font-black text-xs hover:bg-indigo-700 transition-all uppercase shadow-lg">Adicionar</button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         {(currentTemplate.clinicalGuide || []).map((item, idx) => (
                           <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center group animate-in slide-in-from-left-2">
                              <span className="text-[10px] font-bold text-slate-600 uppercase">{item}</span>
                              <button onClick={() => handleRemoveGuideItem(idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-times"></i></button>
                           </div>
                         ))}
                      </div>
                      {(currentTemplate.clinicalGuide || []).length === 0 && (
                          <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-300 italic text-[10px] font-black uppercase">Nenhum item no guia clínico</div>
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* NOVO MENU: TIPO DE CONCLUSÃO */}
            <div className="space-y-6 pt-8 border-t border-slate-100">
               <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Modelos de Conclusão Final (Soberania do Médico)</h4>
                  <button onClick={handleAddConclusionType} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl uppercase shadow-sm hover:bg-indigo-100">+ Criar Modelo Próprio</button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(config.transcriptionConfig.conclusionTypes || []).map(concl => (
                    <div key={concl.id} className={`p-6 rounded-[32px] border-2 transition-all flex flex-col justify-between ${config.transcriptionConfig?.selectedConclusionTypeId === concl.id ? 'bg-white border-indigo-600 shadow-xl' : 'bg-slate-50 border-transparent opacity-80'}`}>
                       <div>
                          <div className="flex justify-between items-start mb-3">
                             <h5 className={`font-black text-sm uppercase ${config.transcriptionConfig?.selectedConclusionTypeId === concl.id ? 'text-indigo-600' : 'text-slate-700'}`}>{concl.name}</h5>
                             <div className="flex gap-2">
                                <button onClick={() => setEditingConclusion(concl)} className="text-slate-300 hover:text-indigo-600"><i className="fa-solid fa-pen text-xs"></i></button>
                                {concl.id !== 'concl-default' && (
                                  <button onClick={() => handleDeleteConclusionType(concl.id)} className="text-slate-300 hover:text-red-500"><i className="fa-solid fa-trash-can text-xs"></i></button>
                                )}
                             </div>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium italic line-clamp-3 mb-4">"{concl.prompt}"</p>
                       </div>
                       <button 
                         onClick={() => onUpdateConfig({ ...config, transcriptionConfig: { ...config.transcriptionConfig!, selectedConclusionTypeId: concl.id } })}
                         className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${config.transcriptionConfig?.selectedConclusionTypeId === concl.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200'}`}
                       >
                         {config.transcriptionConfig?.selectedConclusionTypeId === concl.id ? 'Modelo Ativo' : 'Selecionar Modelo'}
                       </button>
                    </div>
                  ))}
               </div>
            </div>

            {editingSection && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                 <div className="bg-white rounded-[40px] w-full max-w-xl p-10 shadow-2xl animate-in zoom-in-95">
                    <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Editar Definição: {editingSection.label}</h3>
                    <div className="space-y-6">
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block tracking-widest">Prompt de Instrução para a IA</label>
                          <textarea 
                            className="w-full p-4 rounded-2xl bg-slate-50 border-none font-medium text-xs h-40 resize-none outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            value={editingSection.prompt}
                            onChange={e => setEditingSection({ ...editingSection, prompt: e.target.value })}
                          />
                       </div>
                       <div className="flex gap-4">
                          <button onClick={() => setEditingSection(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Descartar</button>
                          <button onClick={handleSaveSectionEdit} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase hover:bg-indigo-700">Salvar Prompt</button>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {editingConclusion && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                 <div className="bg-white rounded-[40px] w-full max-w-2xl p-10 shadow-2xl animate-in zoom-in-95">
                    <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Editar Modelo: {editingConclusion.name}</h3>
                    <div className="space-y-6">
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block tracking-widest">Instruções de Síntese (Ditado Final + Contexto)</label>
                          <textarea 
                            className="w-full p-4 rounded-2xl bg-slate-50 border-none font-medium text-xs h-60 resize-none outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                            value={editingConclusion.prompt}
                            onChange={e => setEditingConclusion({ ...editingConclusion, prompt: e.target.value })}
                            placeholder="Defina o ROLE, INPUT 1, INPUT 2 e REGRAS DE OURO..."
                          />
                       </div>
                       <div className="flex gap-4">
                          <button onClick={() => setEditingConclusion(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Descartar</button>
                          <button onClick={handleSaveConclusionEdit} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl uppercase hover:bg-indigo-700">Salvar Modelo de Conclusão</button>
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-8">
              <div>
                 <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Informações Importantes</h3>
                 <p className="text-xs text-slate-500 font-medium mt-1">Notas e definições médicas para consulta rápida da equipe.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="md:col-span-1 bg-slate-50 p-6 rounded-[28px] border border-slate-100 h-fit">
                  <h4 className="text-xs font-black text-slate-700 uppercase mb-4">Adicionar Nota</h4>
                  <div className="space-y-4">
                     <input type="text" className="w-full p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-bold text-xs outline-none" value={newInfoItem.title} onChange={e => setNewInfoItem({ ...newInfoItem, title: e.target.value })} placeholder="Título" />
                     <textarea className="w-full p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-medium text-xs h-32 resize-none outline-none" value={newInfoItem.content} onChange={e => setNewInfoItem({ ...newInfoItem, content: e.target.value })} placeholder="Conteúdo" />
                     <button type="button" onClick={handleAddInfoItem} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-xs uppercase shadow-lg shadow-indigo-100 active:scale-95 transition-all">Salvar Nota</button>
                  </div>
               </div>
               <div className="md:col-span-2 space-y-4">
                  {(config.secretaryInfo || []).map((item) => (
                    <div key={item.id} className="bg-white border border-slate-100 p-6 rounded-[28px] shadow-sm relative group hover:border-indigo-200 transition-all">
                       <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteInfoItem(item.id); }} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 md:opacity-0 group-hover:opacity-100 transition-opacity p-2"><i className="fa-solid fa-trash-can"></i></button>
                       <h4 className="font-black text-slate-800 text-sm uppercase mb-2 pr-8">{item.title}</h4>
                       <p className="text-xs text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                  {(config.secretaryInfo || []).length === 0 && (
                    <div className="h-48 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[28px]">
                       <i className="fa-solid fa-note-sticky text-3xl mb-2"></i>
                       <p className="text-xs font-bold uppercase">Nenhuma informação cadastrada</p>
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'confirmation' && (
          <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm max-w-5xl mx-auto">
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Fluxo de Confirmação</h3>
            <p className="text-xs text-slate-500 mb-8 font-medium">Automatize mensagens e tarefas rotineiras.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100">
                  <h4 className="text-xs font-black text-indigo-700 uppercase mb-4 flex items-center gap-2"><i className="fa-solid fa-bell"></i> Lembrete Antecipado</h4>
                  <div className="flex items-center gap-4">
                    <input type="number" className="w-20 p-4 rounded-2xl bg-white border-2 border-indigo-100 font-black text-center text-indigo-700 focus:border-indigo-400 outline-none" value={config.confirmationConfig?.reminderDaysBefore || 2} onChange={e => onUpdateConfig({...config, confirmationConfig: {...config.confirmationConfig, reminderDaysBefore: parseInt(e.target.value)}})} />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Dias Úteis Antes</span>
                  </div>
                </div>
                <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100">
                  <h4 className="text-xs font-black text-emerald-700 uppercase mb-4 flex items-center gap-2"><i className="fa-solid fa-check-double"></i> Confirmação Oficial</h4>
                  <div className="flex items-center gap-4">
                    <input type="number" className="w-20 p-4 rounded-2xl bg-white border-2 border-emerald-100 font-black text-center text-emerald-700 focus:border-emerald-400 outline-none" value={config.confirmationConfig?.confirmDaysBefore || 1} onChange={e => onUpdateConfig({...config, confirmationConfig: {...config.confirmationConfig, confirmDaysBefore: parseInt(e.target.value)}})} />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Dias Úteis Antes</span>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-slate-700 uppercase flex items-center gap-2"><i className="fa-solid fa-clock"></i> Tarefas do Mesmo Dia</h4>
                  <div className="space-y-3">
                     <label className="flex items-center gap-4 cursor-pointer group bg-white p-3 rounded-xl border border-transparent hover:border-indigo-100 transition-all">
                        <input 
                          type="checkbox" 
                          checked={config.confirmationConfig?.sameDayReminder} 
                          onChange={e => onUpdateConfig({...config, confirmationConfig: {...config.confirmationConfig, sameDayReminder: e.target.checked}})}
                          className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Lembrete Pré-Consulta</span>
                     </label>
                     <label className="flex items-center gap-4 cursor-pointer group bg-white p-3 rounded-xl border border-transparent hover:border-indigo-100 transition-all">
                        <input 
                          type="checkbox" 
                          checked={config.confirmationConfig?.sameDayPostConsult} 
                          onChange={e => onUpdateConfig({...config, confirmationConfig: {...config.confirmationConfig, sameDayPostConsult: e.target.checked}})}
                          className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">Pós-Consulta (Check-out)</span>
                     </label>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-inner">
                 <h4 className="text-xs font-black text-slate-800 uppercase mb-4 flex items-center gap-2"><i className="fa-solid fa-list-check text-indigo-600"></i> Gestão de Checklist</h4>
                 
                 <div className="space-y-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <input type="text" placeholder="Descreva a tarefa..." className="w-full p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-bold text-xs outline-none shadow-sm" value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)} />
                    
                    <div className="flex flex-wrap gap-2">
                      {['daily', 'weekly', 'monthly', 'specific'].map((f) => (
                        <button type="button" key={f} onClick={() => setTaskFrequency(f as any)} className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase transition-all ${taskFrequency === f ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-200'}`}>
                          {f === 'daily' ? 'Diária' : f === 'weekly' ? 'Semanal' : f === 'monthly' ? 'Mensal' : 'Específica'}
                        </button>
                      ))}
                    </div>

                    <div className="animate-in slide-in-from-top-2">
                      {taskFrequency === 'weekly' && (
                        <select className="w-full p-3 rounded-xl bg-white border-none font-bold text-xs uppercase shadow-sm cursor-pointer outline-none" value={taskFreqValue} onChange={e => setTaskFreqValue(e.target.value)}>
                          <option value="">Qual dia da semana?</option>
                          {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                      )}

                      {taskFrequency === 'monthly' && (
                        <input type="number" placeholder="Dia do Mês (1-31)" className="w-full p-3 rounded-xl bg-white border-none font-bold text-xs shadow-sm outline-none" value={taskFreqValue} onChange={e => setTaskFreqValue(e.target.value)} min="1" max="31" />
                      )}

                      {taskFrequency === 'specific' && (
                        <input type="date" className="w-full p-3 rounded-xl bg-white border-none font-bold text-xs shadow-sm outline-none cursor-pointer" value={taskFreqValue} onChange={e => setTaskFreqValue(e.target.value)} />
                      )}
                    </div>

                    <button type="button" onClick={handleAddChecklist} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-indigo-50 active:scale-95 transition-all">Adicionar Tarefa</button>
                 </div>

                 <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 no-scrollbar">
                    {((config.confirmationConfig?.customChecklist || []) as ChecklistTask[]).map((t) => (
                       <div key={t.id} className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-all">
                          <div>
                            <span className="text-xs font-bold text-slate-700 block mb-0.5">{t.task}</span>
                            <span className="text-[7px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded tracking-widest">
                              {t.frequency === 'daily' ? 'Diário' : t.frequency === 'weekly' ? `Semanal (${WEEKDAYS[t.dayOfWeek!]})` : t.frequency === 'monthly' ? `Mensal (Dia ${t.dayOfMonth})` : `Data: ${t.date?.split('-').reverse().join('/')}`}
                            </span>
                          </div>
                          <button type="button" onClick={() => handleDeleteChecklist(t.id)} className="text-slate-300 hover:text-red-500 p-2"><i className="fa-solid fa-trash-can"></i></button>
                       </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'types' && (
          <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-8">
              <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Tipos & Valores</h3><p className="text-xs text-slate-500 font-medium mt-1">Defina tabelas de preço e regras de acompanhamento.</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="md:col-span-1 bg-slate-50 p-6 rounded-[28px] border border-slate-100 h-fit">
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nome do Procedimento</label>
                        <input type="text" className="w-full p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-bold text-xs outline-none" value={newConsultationType.name} onChange={e => setNewConsultationType({ ...newConsultationType, name: e.target.value })} placeholder="Ex: Unimed Especial" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase ml-2 tracking-widest">Valor Sugerido (R$)</label>
                        <input type="number" className="w-full p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-bold text-xs outline-none" value={newConsultationType.defaultValue} onChange={e => setNewConsultationType({ ...newConsultationType, defaultValue: Number(e.target.value) })} placeholder="0.00" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase ml-2 tracking-widest">Categoria</label>
                        <select className="w-full p-3 rounded-xl bg-white border-none font-bold text-xs uppercase cursor-pointer outline-none" value={newConsultationType.category} onChange={e => setNewConsultationType({ ...newConsultationType, category: e.target.value as any })}>
                          <option value="consulta">Consulta Padrão</option>
                          <option value="retorno">Retorno</option>
                          <option value="cortesia">Cortesia</option>
                          <option value="EM">Procedimento Especial</option>
                        </select>
                     </div>
                     
                     <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                           <i className="fa-solid fa-wand-magic-sparkles text-indigo-500"></i> Destaque Visual na Agenda
                        </h4>
                        <label className="flex items-center gap-3 cursor-pointer group">
                           <input 
                             type="checkbox" 
                             checked={newConsultationType.isHighlighted} 
                             onChange={e => setNewConsultationType({ ...newConsultationType, isHighlighted: e.target.checked })}
                             className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                           />
                           <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest group-hover:text-indigo-600 transition-colors">Deseja destacar este tipo?</span>
                        </label>
                        
                        {newConsultationType.isHighlighted && (
                           <div className="animate-in slide-in-from-top-1 space-y-4 pt-2 border-t border-slate-50">
                              <div className="space-y-2">
                                 <p className="text-[8px] font-black text-slate-400 uppercase ml-1">Ícone Chamativo</p>
                                 <div className="flex gap-2 flex-wrap">
                                    {HIGHLIGHT_ICONS.map(icon => (
                                       <button 
                                          key={icon} 
                                          type="button" 
                                          onClick={() => setNewConsultationType({...newConsultationType, highlightIcon: icon})}
                                          className={`w-8 h-8 rounded-lg border transition-all flex items-center justify-center ${newConsultationType.highlightIcon === icon ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-indigo-200'}`}
                                       >
                                          <i className={`fa-solid ${icon} text-xs`}></i>
                                       </button>
                                    ))}
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <p className="text-[8px] font-black text-slate-400 uppercase ml-1">Cor do Destaque</p>
                                 <div className="flex gap-2 flex-wrap">
                                    {HIGHLIGHT_COLORS.map(color => (
                                       <button 
                                          key={color} 
                                          type="button" 
                                          onClick={() => setNewConsultationType({...newConsultationType, highlightColor: color})}
                                          className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${newConsultationType.highlightColor === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                                          style={{ backgroundColor: color }}
                                       />
                                    ))}
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>

                     <label className="flex items-center gap-3 p-3 bg-white rounded-xl cursor-pointer hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100">
                        <input 
                          type="checkbox" 
                          checked={newConsultationType.requiresFollowUp} 
                          onChange={e => setNewConsultationType({ ...newConsultationType, requiresFollowUp: e.target.checked })}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                        <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Requer Follow-up</span>
                     </label>

                     {newConsultationType.requiresFollowUp && (
                       <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-3">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Programa de Acompanhamento</p>
                          
                          <div className="flex gap-2">
                             <input 
                               type="number" 
                               className="w-16 p-2 rounded-lg bg-slate-50 border-none font-bold text-xs outline-none" 
                               value={tempRuleAmount} 
                               onChange={e => setTempRuleAmount(e.target.value)} 
                               min="1"
                             />
                             <select 
                               className="flex-1 p-2 rounded-lg bg-white border-none font-bold text-xs uppercase outline-none"
                               value={tempRuleUnit}
                               onChange={e => setTempRuleUnit(e.target.value as any)}
                             >
                               <option value="days">Dias</option>
                               <option value="weeks">Semanas</option>
                               <option value="months">Meses</option>
                             </select>
                             <button type="button" onClick={handleAddRule} className="bg-indigo-100 text-indigo-600 px-3 rounded-lg font-black text-xs hover:bg-indigo-600 hover:text-white transition-all">+</button>
                          </div>

                          <div className="space-y-1">
                             {(newConsultationType.followUpRules || []).map((rule, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded-lg">
                                   <span className="text-[9px] font-bold text-slate-600 uppercase">{rule.amount} {rule.unit === 'days' ? 'Dias' : rule.unit === 'weeks' ? 'Semanas' : 'Meses'}</span>
                                   <button type="button" onClick={() => removeRule(idx)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-times text-[10px]"></i></button>
                                </div>
                             ))}
                          </div>
                       </div>
                     )}

                     <button type="button" onClick={handleAddConsultationType} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-xs uppercase shadow-xl shadow-indigo-50 hover:bg-indigo-700 active:scale-95 transition-all">Salvar Tipo</button>
                  </div>
               </div>
               <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(config.consultationTypes || []).map((type) => (
                    <div key={type.id} className="bg-white border border-slate-100 p-5 rounded-[24px] shadow-sm hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between group">
                       <div>
                          <div className="flex justify-between items-start mb-2">
                             <p className="font-black text-slate-800 text-xs uppercase tracking-tight flex items-center gap-2">
                                {type.name}
                                {type.isHighlighted && <i className={`fa-solid ${type.highlightIcon}`} style={{ color: type.highlightColor }}></i>}
                             </p>
                             <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteConsultationType(type.id); }} className="text-slate-300 hover:text-red-500 transition-colors p-1"><i className="fa-solid fa-trash-can text-sm"></i></button>
                          </div>
                          <div className="flex gap-2 items-center">
                             <span className="text-[10px] font-black text-indigo-600">R$ {type.defaultValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                       </div>
                       <div className={`mt-3 pt-3 border-t border-slate-50 flex flex-col gap-2`}>
                          <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${type.requiresFollowUp ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                             <span className={`text-[8px] font-black uppercase tracking-widest ${type.requiresFollowUp ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {type.requiresFollowUp ? 'Acompanhamento Ativo' : 'Apenas Pontual'}
                             </span>
                          </div>
                          {type.requiresFollowUp && type.followUpRules && type.followUpRules.length > 0 && (
                             <div className="flex flex-wrap gap-1">
                                {type.followUpRules.map((r, i) => (
                                   <span key={i} className="text-[7px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                                      {r.amount} {r.unit === 'days' ? 'D' : r.unit === 'weeks' ? 'Sem' : 'Mes'}
                                   </span>
                                ))}
                             </div>
                          )}
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* NOVO: Esquema de Consultas por Dia */}
            <div className="mt-10 pt-10 border-t border-slate-100">
               <h4 className="text-sm font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-calendar-day text-indigo-600"></i> Esquema de Consultas por Dia
               </h4>
               <p className="text-[10px] text-slate-500 mb-6 font-bold uppercase">Defina a meta de atendimentos diários para cada tipo de consulta.</p>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {WEEKDAYS.map((day, dayIdx) => {
                     const scheme = (config.confirmationConfig?.dailySchemes || []).find(s => s.dayOfWeek === dayIdx);
                     return (
                        <div key={day} className="bg-slate-50 p-5 rounded-[32px] border border-slate-100">
                           <p className="text-[10px] font-black text-indigo-600 uppercase mb-3 tracking-widest">{day}</p>
                           <div className="space-y-3">
                              {(config.consultationTypes || []).map(type => {
                                 const item = scheme?.items.find(i => i.type === type.name);
                                 const count = item?.count || 0;
                                 return (
                                    <div key={type.id} className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm">
                                       <span className="text-[9px] font-bold text-slate-600 uppercase">{type.name}</span>
                                       <div className="flex items-center gap-3">
                                          <button 
                                            type="button"
                                            onClick={() => updateScheme(dayIdx, type.name, count - 1)}
                                            className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
                                          >-</button>
                                          <span className="text-xs font-black text-slate-800 w-4 text-center">{count}</span>
                                          <button 
                                            type="button"
                                            onClick={() => updateScheme(dayIdx, type.name, count + 1)}
                                            className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 transition-all"
                                          >+</button>
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'tags' && (
          <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-8">
              <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Etiquetas de Pacientes</h3><p className="text-xs text-slate-500 font-medium mt-1">Classifique seus pacientes e crie protocolos de acompanhamento.</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="md:col-span-1 bg-slate-50 p-6 rounded-[28px] border border-slate-100 h-fit">
                  <h4 className="text-xs font-black text-slate-700 uppercase mb-4">{newTag.id ? 'Editar Etiqueta' : 'Nova Etiqueta'}</h4>
                  <div className="space-y-4">
                     <input type="text" placeholder="Nome da etiqueta..." className="w-full p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-bold text-xs outline-none" value={newTag.name} onChange={e => setNewTag({ ...newTag, name: e.target.value })} />
                     <div className="flex gap-2.5 flex-wrap justify-center p-2 bg-white rounded-xl">
                        {TAG_COLORS.map(c => (
                          <button type="button" key={c} onClick={() => setNewTag({ ...newTag, color: c })} className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${newTag.color === c ? 'ring-4 ring-indigo-100 shadow-md' : ''}`} style={{ backgroundColor: c }} />
                        ))}
                     </div>

                     {/* Configuração de Protocolo de Follow-up na Etiqueta */}
                     <label className="flex items-center gap-3 p-3 bg-white rounded-xl cursor-pointer hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100">
                        <input 
                          type="checkbox" 
                          checked={enableTagProtocol} 
                          onChange={e => setEnableTagProtocol(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        />
                        <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Ativar Protocolo de Follow-up</span>
                     </label>

                     {enableTagProtocol && (
                       <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-3">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Programa por Etiqueta</p>
                          <div className="flex gap-2">
                             <input 
                               type="number" 
                               className="w-20 p-2 rounded-lg bg-slate-50 border-none font-bold text-xs outline-none" 
                               value={tempTagRuleAmount} 
                               onChange={e => setTempTagRuleAmount(e.target.value)} 
                               min="1"
                             />
                             <select 
                               className="flex-1 p-2 rounded-lg bg-slate-50 border-none font-bold text-xs uppercase outline-none"
                               value={tempTagRuleUnit}
                               onChange={e => setTempTagRuleUnit(e.target.value as any)}
                             >
                               <option value="days">Dias</option>
                               <option value="weeks">Semanas</option>
                               <option value="months">Meses</option>
                             </select>
                             <button type="button" onClick={handleAddTagRule} className="bg-indigo-100 text-indigo-600 px-3 rounded-lg font-black text-xs hover:bg-indigo-600 hover:text-white transition-all">+</button>
                          </div>
                          <div className="space-y-1">
                             {(newTag.followUpRules || []).map((rule, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded-lg">
                                   <span className="text-[9px] font-bold text-slate-600 uppercase">{rule.amount} {rule.unit === 'days' ? 'Dias' : rule.unit === 'weeks' ? 'Semanas' : 'Meses'}</span>
                                   <button type="button" onClick={() => removeTagRule(idx)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-times text-[10px]"></i></button>
                                </div>
                             ))}
                          </div>
                       </div>
                     )}

                     <button type="button" onClick={handleAddTag} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all">{newTag.id ? 'Salvar Configuração' : 'Criar Etiqueta'}</button>
                     {newTag.id && (
                        <button type="button" onClick={() => { setNewTag({ name: '', color: TAG_COLORS[0], followUpRules: [] }); setEnableTagProtocol(false); }} className="w-full text-[9px] font-black text-slate-400 uppercase mt-2">Cancelar Edição</button>
                     )}
                  </div>
               </div>
               <div className="md:col-span-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                    {(config.tags || []).map(tag => (
                      <div key={tag.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 group shadow-sm hover:border-indigo-100 transition-all text-center relative">
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id); }} className="absolute top-2 right-2 text-slate-200 hover:text-red-500 transition-colors z-10"><i className="fa-solid fa-circle-xmark"></i></button>
                        <button type="button" onClick={() => handleEditTag(tag)} className="w-full h-full flex flex-col items-center justify-center">
                            <div className="w-8 h-8 rounded-full shadow-inner mb-2" style={{ backgroundColor: tag.color }}></div>
                            <span className="font-black text-slate-700 text-[10px] uppercase leading-tight tracking-tighter">{tag.name}</span>
                            {tag.followUpRules && tag.followUpRules.length > 0 && (
                                <span className="mt-2 text-[7px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 uppercase">Protocolo Ativo</span>
                            )}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Configuração de Protocolo Padrão (Sem Etiqueta) */}
                  <div className="bg-slate-50 border border-slate-100 p-6 rounded-[32px] shadow-sm">
                     <h4 className="text-sm font-black text-slate-800 uppercase mb-4 flex items-center gap-2">
                       <i className="fa-solid fa-user-clock text-indigo-500"></i> Protocolo Padrão (Pacientes Sem Etiqueta)
                     </h4>
                     <p className="text-[10px] text-slate-500 font-bold mb-4">Defina as regras de follow-up para pacientes que não possuem etiquetas específicas.</p>
                     
                     <div className="flex gap-2 mb-4 max-w-md">
                        <input 
                          type="number" 
                          className="w-20 p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-bold text-xs outline-none" 
                          value={tempDefaultRuleAmount} 
                          onChange={e => setTempDefaultRuleAmount(e.target.value)} 
                          min="1"
                        />
                        <select 
                          className="flex-1 p-3 rounded-xl bg-white border-2 border-transparent focus:border-indigo-100 font-bold text-xs uppercase outline-none"
                          value={tempDefaultRuleUnit}
                          onChange={e => setTempDefaultRuleUnit(e.target.value as any)}
                        >
                          <option value="days">Dias</option>
                          <option value="weeks">Semanas</option>
                          <option value="months">Meses</option>
                        </select>
                        <button type="button" onClick={handleAddDefaultRule} className="bg-indigo-600 text-white px-4 rounded-xl font-black text-xs hover:bg-indigo-700 transition-all uppercase">Adicionar</button>
                     </div>

                     <div className="space-y-2">
                        {(config.defaultFollowUpRules || [{ amount: 1, unit: 'months' }, { amount: 3, unit: 'months' }, { amount: 6, unit: 'months' }]).map((rule, idx) => (
                           <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm max-w-md">
                              <span className="text-xs font-black text-slate-700 uppercase">{rule.amount} {rule.unit === 'days' ? 'Dias' : rule.unit === 'weeks' ? 'Semanas' : 'Meses'}</span>
                              <button type="button" onClick={() => handleRemoveDefaultRule(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm">
             <div className="flex justify-between items-start mb-8">
               <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Locais & Horários</h3><p className="text-xs text-slate-500 font-medium mt-1">Gerencie onde e quando os atendimentos ocorrem.</p></div>
               {!editingLocation && (
                 <button onClick={() => setEditingLocation({ name: '', address: '', color: COLORS[0], schedule: [] })} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                   <i className="fa-solid fa-plus"></i> Novo Local
                 </button>
               )}
             </div>

             {!editingLocation && (
               <div className="bg-amber-50 p-6 rounded-[32px] border border-amber-100 mb-8 flex items-center justify-between">
                  <div>
                     <h4 className="text-sm font-black text-amber-800 uppercase flex items-center gap-2">
                        <i className="fa-solid fa-hourglass-half"></i> Tempo de Validade da Lista de Espera
                     </h4>
                     <p className="text-[10px] text-amber-700/70 font-bold mt-1 max-w-md">
                        Define quantos dias um paciente pode permanecer na lista antes de exibir um alerta de revalidação.
                     </p>
                  </div>
                  <div className="flex items-center gap-2">
                     <input 
                       type="number" 
                       className="w-20 p-3 rounded-xl bg-white border-2 border-amber-200 font-black text-center text-amber-800 focus:border-amber-400 outline-none" 
                       value={config.confirmationConfig?.waitlistReminderDays || 7} 
                       onChange={e => onUpdateConfig({...config, confirmationConfig: {...config.confirmationConfig, waitlistReminderDays: parseInt(e.target.value)}})} 
                       min="1"
                     />
                     <span className="text-[10px] font-black text-amber-800 uppercase">Dias</span>
                  </div>
               </div>
             )}

             {editingLocation ? (
               <div className="animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                     <h4 className="font-black text-slate-800 uppercase text-sm">{editingLocation.id ? 'Editar Local' : 'Novo Local'}</h4>
                     <div className="flex gap-2">
                        <button onClick={() => setEditingLocation(null)} className="text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-transparent hover:border-slate-200 transition-all">Cancelar</button>
                        <button onClick={handleSaveLocation} className="bg-indigo-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl shadow-md hover:bg-indigo-700 transition-all">Salvar Local</button>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                     <div className="space-y-4">
                        <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Nome do Local</label>
                           <input type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={editingLocation.name} onChange={e => setEditingLocation({...editingLocation, name: e.target.value})} placeholder="Ex: Clínica Centro" />
                        </div>
                        <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Endereço Completo</label>
                           <input type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={editingLocation.address} onChange={e => setEditingLocation({...editingLocation, address: e.target.value})} placeholder="Rua..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                           <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Telefone</label>
                              <input type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={editingLocation.phone || ''} onChange={e => setEditingLocation({...editingLocation, phone: e.target.value})} placeholder="(67) 0000-0000" />
                           </div>
                           <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">WhatsApp</label>
                              <input type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={editingLocation.whatsapp || ''} onChange={e => setEditingLocation({...editingLocation, whatsapp: e.target.value})} placeholder="(67) 90000-0000" />
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">E-mail</label>
                              <input type="email" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={editingLocation.email || ''} onChange={e => setEditingLocation({...editingLocation, email: e.target.value})} placeholder="clinica@email.com" />
                           </div>
                           <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Site</label>
                              <input type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={editingLocation.website || ''} onChange={e => setEditingLocation({...editingLocation, website: e.target.value})} placeholder="www.clinica.com.br" />
                           </div>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Link do Google Maps</label>
                           <input type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={editingLocation.mapLink} onChange={e => setEditingLocation({...editingLocation, mapLink: e.target.value})} placeholder="https://maps..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                               <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Cor de Identificação</label>
                               <div className="flex gap-2 flex-wrap bg-slate-50 p-2 rounded-xl h-full content-center">
                                  {COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => setEditingLocation({...editingLocation, color: c})} className={`w-6 h-6 rounded-full transition-transform ${editingLocation.color === c ? 'scale-110 ring-2 ring-offset-1 ring-slate-300' : 'hover:scale-105'}`} style={{ backgroundColor: c }}></button>
                                  ))}
                               </div>
                            </div>
                            <div>
                               <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Duração (Minutos)</label>
                               <input type="number" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={editingLocation.slotDuration || 45} onChange={e => setEditingLocation({...editingLocation, slotDuration: Number(e.target.value)})} placeholder="45" step="5" min="5" />
                            </div>
                        </div>
                        <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Observações (Estacionamento/Ref.)</label>
                           <input type="text" className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-xs" value={editingLocation.observations || ''} onChange={e => setEditingLocation({...editingLocation, observations: e.target.value})} placeholder="Ex: Estacionamento conveniado na rua lateral..." />
                        </div>
                     </div>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                     <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest mb-4">Configuração de Horários</h4>
                     <div className="space-y-4">
                        {WEEKDAYS.map((day, dayIndex) => {
                           const daySchedules = (editingLocation.schedule || []).filter(s => s.dayOfWeek === dayIndex);
                           const isActive = daySchedules.length > 0;

                           return (
                             <div key={day} className={`p-4 rounded-2xl border transition-all ${isActive ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-100/50 border-transparent opacity-60'}`}>
                                <div className="flex justify-between items-center mb-3">
                                   <label className="flex items-center gap-3 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                        checked={isActive}
                                        onChange={(e) => handleScheduleChange(dayIndex, 'toggle', null, e.target.checked)}
                                      />
                                      <span className={`text-xs font-black uppercase ${isActive ? 'text-indigo-900' : 'text-slate-500'}`}>{day}</span>
                                   </label>
                                   {isActive && (
                                      <button onClick={() => handleScheduleChange(dayIndex, 'add')} className="text-[9px] font-black uppercase text-indigo-500 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg">+ Turno</button>
                                   )}
                                </div>
                                {isActive && (
                                   <div className="space-y-2 pl-7">
                                      {daySchedules.map((schedule, idx) => (
                                         <div key={idx} className="flex items-center gap-2">
                                            <input type="time" className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold" value={schedule.start} onChange={e => handleScheduleChange(dayIndex, 'update', {index: idx, field: 'start'}, e.target.value)} />
                                            <span className="text-slate-300 font-bold">-</span>
                                            <input type="time" className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold" value={schedule.end} onChange={e => handleScheduleChange(dayIndex, 'update', {index: idx, field: 'end'}, e.target.value)} />
                                            <button onClick={() => handleScheduleChange(dayIndex, 'remove', idx)} className="text-red-400 hover:text-red-600 p-1"><i className="fa-solid fa-trash-can text-xs"></i></button>
                                         </div>
                                      ))}
                                   </div>
                                )}
                             </div>
                           );
                        })}
                     </div>
                  </div>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {config.locations.map(loc => (
                    <div key={loc.id} className="bg-white border border-slate-100 p-6 rounded-[28px] hover:border-indigo-200 hover:shadow-md transition-all group relative">
                       <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingLocation(loc)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors"><i className="fa-solid fa-pen"></i></button>
                          <button onClick={() => handleDeleteLocation(loc.id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors"><i className="fa-solid fa-trash"></i></button>
                       </div>
                       <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: loc.color }}>
                             <i className="fa-solid fa-location-dot"></i>
                          </div>
                          <div>
                             <h4 className="font-black text-slate-800 uppercase text-sm leading-none">{loc.name}</h4>
                             <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase truncate max-w-[200px]">{loc.address}</p>
                          </div>
                       </div>
                       <div className="mt-4 flex flex-wrap gap-1">
                          {WEEKDAYS.map((d, i) => {
                             const hasDay = loc.schedule?.some(s => s.dayOfWeek === i && s.active);
                             return (
                               <div key={i} className={`w-6 h-6 rounded-lg flex items-center justify-center text-[8px] font-black uppercase ${hasDay ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-300'}`}>
                                  {d.substring(0, 1)}
                               </div>
                             );
                          })}
                       </div>
                    </div>
                  ))}
               </div>
             )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-200 shadow-sm">
             <div className="flex justify-between items-start mb-8">
               <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Gestão de Usuários</h3><p className="text-xs text-slate-500 font-medium mt-1">Controle de acesso da equipe.</p></div>
               {!editingUser && (
                 <button onClick={() => setEditingUser({ role: 'secretary', permissions: ['agenda', 'pacientes', 'crm', 'scripts'] })} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                   <i className="fa-solid fa-user-plus"></i> Novo Usuário
                 </button>
               )}
             </div>

             {editingUser ? (
               <div className="max-w-xl mx-auto bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                  <h4 className="font-black text-slate-800 uppercase text-sm mb-6">{editingUser.id ? 'Editar Usuário' : 'Novo Usuário'}</h4>
                  <div className="space-y-4">
                     <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Nome Completo</label>
                        <input type="text" className="w-full p-3 rounded-xl bg-white border-none font-bold text-xs" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Login</label>
                           <input type="text" className="w-full p-3 rounded-xl bg-white border-none font-bold text-xs" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} />
                        </div>
                        <div>
                           <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Senha</label>
                           <input type="text" className="w-full p-3 rounded-xl bg-white border-none font-bold text-xs" placeholder={editingUser.id ? '(Manter atual)' : 'Senha forte'} value={editingUser.password} onChange={e => setEditingUser({...editingUser, password: e.target.value})} />
                        </div>
                     </div>
                     <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Permissões de Acesso</label>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-2">
                           {MENU_OPTIONS.map(opt => (
                              <label key={opt.id} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg">
                                 <input 
                                   type="checkbox" 
                                   className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                   checked={(editingUser.permissions || []).includes(opt.id)}
                                   onChange={() => togglePermission(opt.id)}
                                 />
                                 <span className="text-[10px] font-bold text-slate-600 uppercase">{opt.label}</span>
                              </label>
                           ))}
                        </div>
                     </div>
                     <div className="flex gap-2 pt-4">
                        <button onClick={() => setEditingUser(null)} className="flex-1 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                        <button onClick={handleSaveUser} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg">Salvar Acesso</button>
                     </div>
                  </div>
               </div>
             ) : (
               <div className="space-y-4">
                  {visibleUsers.map(user => (
                    <div key={user.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex justify-between items-center group hover:border-indigo-100 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                             <i className={`fa-solid ${user.role === 'admin' ? 'fa-user-shield' : 'fa-user'}`}></i>
                          </div>
                          <div>
                             <h4 className="font-black text-slate-800 uppercase text-xs">{user.name}</h4>
                             <p className="text-[9px] text-slate-400 font-mono">login: {user.username}</p>
                          </div>
                       </div>
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingUser(user)} className="p-2 text-indigo-400 hover:text-indigo-600 bg-indigo-50 rounded-lg"><i className="fa-solid fa-pen"></i></button>
                          <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-red-400 hover:text-red-600 bg-red-50 rounded-lg"><i className="fa-solid fa-trash"></i></button>
                       </div>
                    </div>
                  ))}
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;