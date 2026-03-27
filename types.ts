export type PaymentMethod = 'PIX' | 'Dinheiro' | 'Cartão Crédito' | 'Cartão Débito' | 'Convênio' | 'Pendente' | 'Múltiplo';
export type ConsultationMode = 'Presencial' | 'Online';
export type AppointmentType = 'consulta' | 'retorno' | 'cortesia' | 'EM' | 'bloqueio';
export type UserRole = 'doctor' | 'secretary' | 'admin';
export type PriceTable = 'Particular' | 'Social' | 'Cortesia' | string;

export interface SplitPayment {
  method: PaymentMethod;
  value: number;
}

export interface Appointment {
  id: string;
  time: string;
  patientName: string;
  phone?: string;
  cpf?: string; // Novo campo CPF
  age?: string;
  birthDate?: string; // Data de nascimento YYYY-MM-DD
  cityState?: string;
  additionalPhone?: string;
  priceTable: PriceTable;
  expectedValue: number; 
  paidValue?: number;
  paymentMethod?: PaymentMethod;
  splitPayments?: SplitPayment[]; // Pagamentos fracionados
  paymentDate?: string;
  mode: ConsultationMode;
  confirmed: boolean;
  confirmationRequestSent?: boolean; // Solicitação de Confirmação Enviada
  reminderSent?: boolean; // Lembrete Antecipado
  preConsultSent?: boolean; // Lembrete Pré-Consulta (Dia)
  postConsultSent?: boolean; // Pós-Consulta
  type: AppointmentType;
  period: 'matutino' | 'vespertino';
  returnMonth?: string;
  returnYear?: string;
  status: 'agendado' | 'check-in' | 'atendido' | 'cancelado';
  date: string; // YYYY-MM-DD
  notes?: string;
  locationId?: string;
  duration?: number;
}

export interface Expense {
  id: string;
  description: string;
  category: 'Aluguel' | 'Salários' | 'Impostos' | 'Materiais' | 'Marketing' | 'Outros';
  value: number;
  date: string;
  status: 'pago' | 'pendente';
}

export interface WaitlistPatient {
  id: string;
  name: string;
  phone: string;
  city?: string;
  type: AppointmentType;
  priceTable?: PriceTable; // Campo adicionado
  preferredPeriod?: 'matutino' | 'vespertino' | 'qualquer';
  notes?: string;
  addedAt: string;
}

export interface PatientCRM {
  id: string;
  name: string;
  phone: string;
  returnDate: string; // MM/YY
  lastConsultDate?: string;
  type: AppointmentType;
  followUpStatus: {
    '1m': boolean;
    '3m': boolean;
    '6m': boolean;
  };
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  weekday: string;
  appointments: Appointment[];
  checklist: ChecklistItem[];
  dailyScheme?: DailySchemeItem[]; // Esquema específico para este dia
}

export interface ChecklistItem {
  id: string;
  task: string;
  completed: boolean;
}

export interface ScriptItem {
  category: 'Lembretes' | 'Pós-Consulta' | 'Financeiro' | 'Administrativo' | 'Objeções';
  trigger: string;
  content: string;
}

export interface LocationSchedule {
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda...
  start: string;
  end: string;
  active: boolean;
}

export interface LocationInfo {
  id: string;
  name: string;
  address: string;
  mapLink: string;
  observations?: string; // Novo campo de observações (ex: estacionamento)
  color: string; // Cor do local (Hex)
  slotDuration: number; // Duração da consulta específica deste local
  schedule: LocationSchedule[]; // Configuração de dias/horários
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  username: string; // Para login/identificação visual
  role: UserRole;
  password: string;
  permissions?: string[]; // IDs das abas permitidas
  doctorName?: string; // Perfil: Nome que aparece na clínica
  specialty?: string; // Perfil: Especialidade do médico
  isMaster?: boolean; // Identificador de conta mestre do sistema
  parentId?: string; // ID do médico proprietário (para secretárias)
}

export interface FollowUpRule {
  amount: number;
  unit: 'days' | 'weeks' | 'months';
}

export interface PatientTag {
  id: string;
  name: string;
  color: string;
  followUpRules?: FollowUpRule[]; // Regras específicas por etiqueta
}

export interface ConsultationTypeConfig {
  id: string;
  name: string;
  defaultValue: number;
  category: AppointmentType;
  requiresFollowUp: boolean; // Novo campo
  followUpRules?: FollowUpRule[]; // Configuração dinâmica de follow-up
  isHighlighted?: boolean; // Se deve destacar na agenda
  highlightIcon?: string; // Classe FontAwesome (ex: fa-star)
  highlightColor?: string; // Cor do ícone
}

export interface SecretaryInfoItem {
  id: string;
  title: string;
  content: string;
}

export interface ChecklistTask {
  id: string;
  task: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'specific';
  dayOfWeek?: number; // 0-6
  dayOfMonth?: number; // 1-31
  date?: string; // YYYY-MM-DD
}

export interface ConfirmationConfig {
  reminderDaysBefore: number; // Ex: 2 dias antes
  confirmDaysBefore: number; // Ex: 1 dia antes
  sameDayReminder: boolean; // Lembrete no dia
  sameDayPostConsult: boolean; // Pós-consulta no dia
  customMessage?: string;
  customChecklist?: ChecklistTask[]; // Checklist com periodicidade
  waitlistReminderDays?: number; // Configuração para revalidação da lista de espera
  dailySchemes?: DayScheme[]; // Novo campo para esquema de tipos de consulta
}

export interface DailySchemeItem {
  type: string; // Nome do tipo de consulta (ex: 'Particular', 'Retorno')
  count: number;
}

export interface DayScheme {
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda...
  items: DailySchemeItem[];
}

export interface TranscriptionSection {
  id: string;
  label: string;
  prompt: string;
  enabled: boolean;
  order: number;
}

export interface TranscriptionTemplate {
  id: string;
  name: string;
  sections: TranscriptionSection[];
  clinicalGuide?: string[];
}

export interface ConclusionType {
  id: string;
  name: string;
  prompt: string;
}

export interface TranscriptionConfig {
  model: 'flash-2.5' | 'flash-3' | 'pro-3' | 'thinking-3';
  templates: TranscriptionTemplate[];
  conclusionTypes?: ConclusionType[];
  selectedConclusionTypeId?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  category: 'Receita' | 'Atestado' | 'Orientação' | 'Outro';
  keyword: string;
  content: string;
}

export interface ClinicConfig {
  doctorName: string;
  specialty: string;
  crm?: string;
  rqe?: string;
  logo?: string;
  startHour: string; // "08:00"
  endHour: string; // "18:00"
  locations: LocationInfo[];
  tags: PatientTag[]; 
  consultationTypes: ConsultationTypeConfig[]; // Novo campo para tipos dinâmicos
  confirmationConfig: ConfirmationConfig; // Nova configuração
  secretaryInfo?: SecretaryInfoItem[]; // Nova lista de informações importantes
  defaultFollowUpRules?: FollowUpRule[]; // Regras padrão para pacientes sem etiqueta/programa
  transcriptionConfig?: TranscriptionConfig; // Configuração personalizada de IA
  documentTemplates?: DocumentTemplate[]; // Novos modelos de documentos prontos
}

export interface EDSSRecord {
  id: string;
  date: string;
  score: number;
  fs: {
    visual: number;
    brainstem: number;
    pyramidal: number;
    cerebellar: number;
    sensory: number;
    bowel: number;
    cerebral: number;
  };
  ambulation: string;
}

export interface NineHoleRecord {
  id: string;
  date: string;
  rightTrial1: number;
  rightTrial2: number;
  rightAverage: number;
  leftTrial1: number;
  leftTrial2: number;
  leftAverage: number;
}

export interface T25FWRecord {
  id: string;
  date: string;
  trial1: number;
  trial2: number;
  average: number;
}

export interface SloanContrastRecord {
  id: string;
  date: string;
  contrastLevel: number;
  lettersCorrect: number;
  eye: 'OD' | 'OE' | 'OU';
  worsening?: boolean;
  distance?: string;
}

export interface SDMTRecord {
  id: string;
  date: string;
  correct: number;
  attempts: number;
  accuracy: number;
  bins: number[]; // Acertos por blocos de 30s [0-30, 30-60, 60-90, 90-120]
  worsening?: boolean;
  significantWorsening?: boolean;
}

export interface MMSERecord {
  id: string;
  date: string;
  score: number;
  schooling: string;
  interpretation: 'Normal' | 'Alterado';
}

export interface SnellenRecord {
  id: string;
  date: string;
  acuity: string;
  eye: 'OD' | 'OE' | 'OU';
  distance: string;
}

export interface FSSRecord {
  id: string;
  date: string;
  scores: number[];
  totalScore: number;
  averageScore: number;
  interpretation: 'Normal' | 'Fadiga Relevante';
}

export interface PatientMetadata {
  [patientName: string]: {
    tags: string[]; 
    phone?: string; 
    cpf?: string; 
    birthDate?: string;
    notes?: string;
    edssHistory?: EDSSRecord[];
    nineHoleHistory?: NineHoleRecord[];
    t25fwHistory?: T25FWRecord[];
    sloanHistory?: SloanContrastRecord[];
    sdmtHistory?: SDMTRecord[];
    mmseHistory?: MMSERecord[];
    snellenHistory?: SnellenRecord[];
    fssHistory?: FSSRecord[];
    followUpEnabled?: boolean;
  }
}

export interface SpecialistPartner {
  id: string;
  specialty: string;
  name: string;
  phone: string;
  location: string;
}

export interface ExamPartner {
  id: string;
  examName: string;
  location: string;
  contact: string;
  website: string;
}

export interface BudgetItem {
  id: string;
  name: string;
  value: number;
}

export interface BudgetOption {
  id: string;
  method: string;
  total: number;
  details: string;
}

export interface Budget {
  id: string;
  procedureName: string;
  fees: BudgetItem[];
  medications: BudgetItem[];
  materials: BudgetItem[];
  options: BudgetOption[];
  notes: string;
  createdAt: string;
}

export type DocCategory = 'Texto' | 'Link' | 'Arquivo';

export interface UtilityDocument {
  id: string;
  title: string;
  category: DocCategory;
  description?: string;
  content: string; 
}

export interface ProcessedExamResult {
  laboratory: { name: string; value: string; date: string }[];
  complex: { name: string; result: string; date: string }[];
  error?: 'NO_DATE_FOUND';
}

export interface PatientFile {
  id: string;
  type: 'photo' | 'video' | 'file';
  url: string; // Base64 or Blob URL
  name: string;
  date: string;
  extension?: string;
  mimeType?: string;
  status: 'pending' | 'approved'; 
  isPatientUpload?: boolean;
  patientName?: string;
}