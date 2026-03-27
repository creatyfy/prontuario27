import { DaySchedule, ChecklistItem, Appointment, PatientCRM, ScriptItem, LocationInfo, WaitlistPatient, ClinicConfig, UserAccount, SpecialistPartner, ExamPartner, Budget, UtilityDocument, ChecklistTask, ConclusionType } from './types';

export const DEFAULT_CONCLUSION_TYPES: ConclusionType[] = [
  {
    id: 'concl-default',
    name: 'Padrão (Especialista Sênior)',
    prompt: `ROLE: Atue como um Médico Sênior Especialista em Documentação Clínica e Codificação Diagnóstica (CID-10).
INPUT 1 (CONTEXTO): Uma transcrição completa de uma consulta médica real, contendo diálogos, dúvidas do paciente e relatos vagos.
INPUT 2 (DITADO FINAL - PRIORIDADE MÁXIMA): O áudio/texto que acabo de gravar, onde o médico dita suas decisões soberanas.
OBJETIVO: Sintetizar o Input 2 (Decisão do Médico) utilizando o Input 1 (Contexto) apenas como suporte técnico.
REGRAS DE OURO:
SOBERANIA DO DITADO: Se houver contradição entre a conversa da consulta e o ditado final, o Ditado Final vence sempre. O médico tem a palavra final.
EXTRAÇÃO TÉCNICA: Use o Contexto para buscar a grafia correta de medicamentos, nomes de exames citados e detalhes cronológicos que o médico pode ter omitido no ditado rápido.
INTELIGÊNCIA CID-10: Converta descrições clínicas em códigos CID-10 precisos. Se o médico disser "Hipertensão", retorne "I10: Hipertensão essencial (primária)".
ESTRUTURAÇÃO RÍGIDA: Normalize a saída em dois blocos Markdown:
## hd (Lista de diagnósticos)
## condutas (Plano terapêutico, receitas e orientações).
ESTILO: Linguagem técnica médica, sem redundâncias, pronto para colagem em prontuário eletrônico de alta performance.`
  },
  {
    id: 'concl-soap',
    name: 'Modelo SOAP Completo',
    prompt: `Atue as Especialista Médico. Use o INPUT 1 (Transcrição) e o INPUT 2 (Ditado Final) para gerar uma nota SOAP. 
O Ditado Final tem soberania absoluta sobre as decisões clínicas.
Extraia grafias e termos técnicos do INPUT 1.
Formate em:
## Subjetivo
## Objetivo
## Avaliação (Com CID-10)
## Plano`
  }
];

// Clinic configuration defaults
export const DEFAULT_CONFIG: ClinicConfig = {
  doctorName: 'Dr. Omar Gurrola Arambula',
  specialty: 'Neurologista Clínico',
  startHour: '08:00',
  endHour: '18:00',
  confirmationConfig: {
    reminderDaysBefore: 2,
    confirmDaysBefore: 1,
    sameDayReminder: true,
    sameDayPostConsult: true,
    waitlistReminderDays: 7, // Valor padrão de 7 dias
    customChecklist: [
      { id: 'def1', task: "Enviar lista de pacientes para recepção", frequency: 'daily' },
      { id: 'def2', task: "Confirmar horários do dia seguinte", frequency: 'daily' },
      { id: 'def3', task: "Verificar pagamentos pendentes", frequency: 'daily' },
      { id: 'def4', task: "Realizar buscas orgânicas Google", frequency: 'daily' }
    ]
  },
  secretaryInfo: [], // Inicialização da nova lista
  defaultFollowUpRules: [
    { amount: 1, unit: 'months' },
    { amount: 3, unit: 'months' },
    { amount: 6, unit: 'months' }
  ],
  transcriptionConfig: {
    model: 'flash-3',
    templates: [
      {
        id: 'tpl-geral',
        name: 'Geral / Padrão',
        sections: [
          { id: 'identificacao', label: 'Identificação', prompt: 'Formato: texto corrido. Incluir APENAS se mencionado explicitamente na transcrição ou no histórico: - Nome (ou iniciais), idade, sexo, profissão/ocupação, procedência, escolaridade. - Detalhes pessoais (ex.: “neta Ana”, “torcedor do time X”) SOMENTE se ditos. - Contexto opcional (ex.: “mora com a filha”, “baixa escolaridade”) SOMENTE se dito.', enabled: true, order: 1 },
          { id: 'historia_social', label: 'História Social', prompt: 'Formato: texto corrido. Incluir APENAS se mencionado explicitamente: - condições de vida/moradia, conjugal, escolaridade, suporte familiar. - capacidade para atividades de vida diária (AVDs) e limitações funcionais, se citadas.', enabled: true, order: 2 },
          { id: 'queixa', label: 'Queixa Principal', prompt: 'Formato: texto corrido. Incluir APENAS a queixa/motivo explicitamente dito. Ao final desta seção, deixe UMA linha em branco (uma quebra de linha) e pare. NÃO crie outras seções.', enabled: true, order: 3 },
          { id: 'hda', label: 'História da Doença Atual (HDA)', prompt: 'OBJETIVO: Produzir História da Doença Atual (HDA) COMPLETA, CRONOLÓGICA, DETALHADA e DENSAMENTE DESCRITIVA, preservando integralmente todas as informações explícitas nas fontes autorizadas. NÃO resumir. NÃO condensar. NÃO abstrair. FONTES PERMITIDAS: TRANSCRIÇÃO e ANOTAÇÕES da consulta atual; HISTÓRICO PRÉVIO somente quando confirmado ou necessário para coerência temporal sem conflito. REGRAS ABSOLUTAS: 1) Não transformar descrições ricas em termos genéricos. 2) Não criar negações se não foi explicitamente dito. 3) Não completar lacunas temporais por inferência. 4) Não resumir múltiplos eventos em uma frase única. 5) Preservar expressões relevantes do paciente. 6) Se não houver conteúdo suficiente para ROS, OMITIR a seção inteira. FORMATO: Respeitar exatamente os títulos abaixo. Entre seções usar EXATAMENTE: ---BLOCO_SEPARATOR---. HDA deve ter preferencialmente 3 a 6 parágrafos estruturados. Manter linha do tempo clara. Estrutura obrigatória em camadas: 🔹 P1 — One-liner + Linha do Tempo Objetiva (Idade, Sexo, Motivo; início, modo de instalação, evolução detalhada, eventos intermediários, motivo atual, condutas já realizadas e resposta). 🔹 P2 — Caracterização detalhada do(s) sintoma(s) principal(is) (OLDCARTS: Início, Localização, Duração, Características, Fatores de piora/melhora, Irradiação, Padrão temporal, Intensidade). 🔹 P3 — Contexto Clínico Expandido (Fatores de risco, exposições, comorbidades, medicamentos, episódios prévios, impacto funcional detalhado: Sono, Trabalho, AVDs, Marcha/equilíbrio; Repercussão emocional, Expectativas/medos). 🔹 P4 — Curso em Serviço / Estado Atual (se aplicável: Condutas, Exames, Resposta, Estado atual).', enabled: true, order: 4 },
          { id: 'ros_focal', label: 'ROS Focal', prompt: 'CONDICIONAL: Gerar somente se ROS foi explicitamente realizado (flag/botão ativado), OU houver revisão de sistemas claramente descrita na transcrição/anotações. Formato: lista organizada por sistemas mencionados. Cada item deve ser texto corrido detalhado. Regras: Incluir apenas sistemas explicitamente mencionados. Não criar sistemas não citados. Não criar negações automáticas. Se apenas um sistema foi revisado, listar somente aquele. Se não houver ROS explícito, OMITIR toda a seção.', enabled: true, order: 5 },
          { id: 'pregressa', label: 'História Pregressa', prompt: 'OBJETIVO: Gerar registro histórico COMPLETO e DETALHADO. Imprimir subtítulo “História pregressa:” somente se houver dado explícito. Formato: lista numerada detalhada. 1. Antecedentes patológicos e comorbidades (Nome, tempo/data, forma, gravidade/controle, tratamento, especialista, complicações). 2. Internações (Motivo, data, local, duração, desfecho). 3. Cirurgias (Tipo, data, indicação, complicações). 4. Traumatismos (Tipo/local, data, sequela). 5. Alergias medicamentosas (Nome, reação, gravidade, contexto. Não escrever “sem alergias”). 6. Hábitos tóxicos e estilo de vida (Tabagismo, Etilismo, Drogas, Alimentação, Sono, Atividade física). 7. História vacinal (Vacinas, datas, orientações). 8. História gineco-obstétrico (Gesta/para/abortos, complicações, menopausa/ciclo, contraceptivo). Omitir subitens sem dados.', enabled: true, order: 6 },
          { id: 'med_uso', label: 'Medicações e Suplemento em Uso Contínuo', prompt: 'Formato: lista detalhada. Para cada item: Nome completo, Dose/concentração, Forma farmacêutica, Posologia completa, Indicação, Tempo de uso. Regras: Não inventar dados, não agrupar medicamentos.', enabled: true, order: 7 },
          { id: 'med_previo', label: 'Medicamentos de Uso Prévio Relevantes', prompt: 'Formato: lista detalhada. Para cada item: Nome, Dose/posologia, Período, Motivo de suspensão, Resposta clínica. Apenas se houver relevância clínica explícita.', enabled: true, order: 8 },
          { id: 'familiar', label: 'História Familiar', prompt: 'Formato: lista detalhada. Para cada item: Parente, Condição/doença, Idade de início/óbito, Complicações. Organizar: 1º grau → 2º grau → demais. Não criar negações.', enabled: true, order: 9 },
          { id: 'evolucao', label: 'Evolução Médica', prompt: 'CONDICIONAL: Gerar somente se for acompanhamento E houver dados intervalares. Texto corrido detalhado (máx 300 palavras). Conteúdo: Evolução de sintomas, novos sintomas, intercorrências, adesão, efeitos adversos, ajustes, exames, impacto funcional, necessidades fisiológicas, preocupações. Não reutilizar dados do histórico sem confirmação.', enabled: true, order: 10 },
          { id: 'fisico', label: 'SEÇÃO 1) Exame Físico', prompt: 'Formato: texto corrido com subtítulos APENAS para sistemas explicitamente mencionados. Sugestão de subtítulos (use apenas se houver conteúdo explícito): - Estado geral - Nível de consciência/Comportamento - HEENT - Cardiovascular - Respiratório - Abdome - Músculo-esquelético - Neurológico (subdividir se houver: pares cranianos, motor, sensitivo, coordenação, marcha, reflexos) - Pele - Outros. Regras: - Incluir apenas achados explicitamente descritos. - Se houver comparação com consulta anterior (“melhorou/piorou”), registrar apenas se isso foi dito explicitamente. - Se existirem achados quantitativos (ex.: força 4/5, escala, medidas), incluir exatamente. - Não inventar normalidade.', enabled: true, order: 11 },
          { id: 'antropometria', label: 'SEÇÃO 2) Dados Antropométricos', prompt: 'Formato: lista. Incluir SOMENTE se valores explícitos existirem: - Peso: ___ kg - Altura: ___ cm - IMC: ___ kg/m² (calcular apenas se peso e altura existirem; caso contrário omitir IMC). Regras: - Não inventar valores. - Não estimar IMC sem dados completos.', enabled: true, order: 12 },
          { id: 'sinais_vitais', label: 'SEÇÃO 3) Sinais Vitais', prompt: 'Formato: lista. Incluir SOMENTE se valores explícitos existirem: - PA Sistólica: ___ mmHg - PA Diastólica: ___ mmHg - Temperatura: ___ °C - Frequência cardíaca: ___ bpm - Frequência respiratória: ___ irpm - Saturação O2: ___ % - Glicemia capilar: ___ mg/dL. Regras: - Capturar sinais vitais mencionados em QUALQUER parte da transcrição (mesmo fora do “exame físico”). - Preservar exatamente números e unidades. - Não preencher itens ausentes.', enabled: true, order: 13 },
          { id: 'exames', label: 'SEÇÃO 4) Resultado de Exames', prompt: 'Objetivo: consolidar exames citados/lidos e manter longitudinalidade quando aplicável. Formato: - Lista com um item por exame, sempre que possível com DATA + NOME. - LABORATORIAIS: dentro do item, registrar parâmetros em texto corrido separados por “ // ” (com valores e unidades). Se a data estiver explícita, incluir. - IMAGEM/OUTROS: item com data, nome e descrição/impressão SOMENTE se explícita (não interpretar). Regras: - Incluir apenas exames explicitamente mencionados (transcrição ou histórico conforme regras). - Longitudinalidade: manter exames prévios relevantes (do histórico) + novos exames citados na consulta, sempre com data quando disponível. - Se o médico leu um exame parcialmente, registrar apenas o que foi lido explicitamente. - Não criar “opiniões breves” que não foram ditas; só registrar impressões se foram verbalizadas.', enabled: true, order: 14 },
          { id: 'hipoteses', label: 'SEÇÃO 5) Hipóteses Diagnósticas', prompt: 'Formato: lista. Regra: Incluir apenas diagnósticos/hipóteses explicitamente mencionados. Ordenação: 1) Diagnósticos já estabelecidos e relevantes do histórico (se confirmados ou mantidos como contexto explícito) 2) Hipóteses relacionadas à HDA/evolução atual. Formato de cada item: - CID-10: descrição. Somente incluir CID-10 se ele foi explicitamente citado ou já está registrado no histórico e não conflita com a consulta atual. Não inventar CID-10. Ao final, deixar uma linha em branco.', enabled: true, order: 15 },
          { id: 'conduta', label: 'SEÇÃO 6) Conduta e orientações', prompt: 'Gerar apenas subitens que tiverem conteúdo explícito: 1. Medicações Prescritas. Formato: lista. Incluir: nome, dose, posologia, duração se citada, via se citada. Não inventar. 2. Orientações. Formato: lista. Incluir apenas orientações explicitamente dadas. 3. Exames Complementares. Formato: lista. Incluir apenas exames solicitados explicitamente na transcrição ou anotações. Regras: - Se um subitem não tiver conteúdo explícito, OMITIR o subitem (não escrever vazio). - Não criar plano padrão (retorno, sinais de alarme, etc.) se não foi dito.', enabled: true, order: 16 },
        ]
      }
    ],
    conclusionTypes: DEFAULT_CONCLUSION_TYPES,
    selectedConclusionTypeId: 'concl-default'
  },
  locations: [
    { 
      id: 'loc1',
      name: 'ONCOVITTA (Prédio Diimagem)', 
      address: 'Rua Rui Barbosa, 3360. Centro - Campo Grande - MS', 
      mapLink: 'https://maps.app.goo.gl/6aGmNrBsA2vBGV249',
      color: '#4f46e5', // Indigo
      slotDuration: 45,
      schedule: [
        { dayOfWeek: 1, start: '08:00', end: '12:00', active: true }, // Segunda
        { dayOfWeek: 2, start: '08:00', end: '18:00', active: true }, // Terça
        { dayOfWeek: 4, start: '08:00', end: '12:00', active: true }, // Quinta
        { dayOfWeek: 5, start: '08:00', end: '12:00', active: true }, // Sexta
      ]
    }
  ],
  tags: [
    { id: 'tag1', name: 'Esclerose Múltipla', color: '#ea580c' }, // Orange
    { id: 'tag2', name: 'Enxaqueca Crônica', color: '#7c3aed' }, // Violet
    { id: 'tag3', name: 'VIP / Prioridade', color: '#e11d48' }, // Rose
    { id: 'tag4', name: 'Mobilidade Reduzida', color: '#2563eb' } // Blue
  ],
  consultationTypes: [
    { id: 'ct1', name: 'Particular', defaultValue: 600, category: 'consulta', requiresFollowUp: true },
    { id: 'ct2', name: 'Social', defaultValue: 400, category: 'consulta', requiresFollowUp: true },
    { id: 'ct3', name: 'Cortesia', defaultValue: 0, category: 'cortesia', requiresFollowUp: false },
    { id: 'ct4', name: 'Retorno', defaultValue: 0, category: 'retorno', requiresFollowUp: false },
    { id: 'ct5', name: 'Procedimento', defaultValue: 800, category: 'EM', requiresFollowUp: true }
  ]
};

// Default tasks for the secretary checklist
export const INITIAL_SECRETARY_TASKS: ChecklistTask[] = [
  { id: 'init1', task: "Enviar para as secretarias lista de pacientes", frequency: 'daily' },
  { id: 'init2', task: "Busca anônima 'neurologista campo grande MS' (Manhã)", frequency: 'daily' },
  { id: 'init3', task: "Busca anônima 'neurologista EM campo grande MS' (Tarde)", frequency: 'daily' },
  { id: 'init4', task: "Acompanhamento continuado (Follow-up 1s, 1m, 3m)", frequency: 'daily' },
  { id: 'init5', task: "Enviar mensagens para quem não agendou", frequency: 'daily' },
  { id: 'init6', task: "Enviar pós-consultas diariamente", frequency: 'daily' },
  { id: 'init7', task: "Conferência com a Contadora", frequency: 'weekly', dayOfWeek: 5 } // Ex: Toda Sexta
];

// Scripts for quick communication
export const SCRIPTS: ScriptItem[] = [
  { 
    category: 'Administrativo', 
    trigger: 'Dados para Agendamento', 
    content: 'PARA AGENDAMENTO DA CONSULTA, FAVOR CONFIRMAR OS SEGUINTES DADOS:🧠\n\nNome Completo:\nTelefone para Contato:\nIdade do Paciente:\nCidade/ Estado:\nTelefone Adicional:' 
  },
  { 
    category: 'Lembretes', 
    trigger: '1º Lembrete (2 dias antes)', 
    content: '📢Lembrete:📢\n🔹SUA CONSULTA SERÁ NA ONCOVITTA (mesmo predio da DIIMAGEM).\n🔹Endereço: Rua Rui Barbosa, 3360. Centro - Campo Grande - MS CEP 79002-369.\n\nIMPORTANTE SABER:\n🔹 COMO SE PREPARAR PARA UMA CONSULTA:\nhttps://neurologiaomar.com.br/como-se-preparar-para-uma-consulta-com-neurologista/' 
  },
  { 
    category: 'Lembretes', 
    trigger: 'Confirmação (1 dia antes)', 
    content: 'Bom dia! \nGostaríamos de confirmar sua consulta?\n🔹Paciente – [NOME]\n🔹Dia – [DATA] às [HORA] ⏰\n🔹Dr OMAR GURROLA (Neurologista Clínico)\nLocal de atendimento: ONCOVITTA (Mesmo predio da DIIMAGEM). Endereço: Rua Rui Barbosa, 3360. Centro - Campo Grande - MS CEP 79002-369 https://maps.app.goo.gl/EhnER9eVCguMzqiS6\n\n💢 SI POR ACASO NÃO PUDER COMPARECER NA CONSULTA, POR GENTILEZA, NOS AVISE. PARA QUE POSSAMOS DAR OPORTUNIDADE DE ATENDIMENTO PARA PESSOAS QUE TAMBÉM NECESSITEM DE CUIDADOS ESPECIAIS DO NOSSO MÉDICO ESPECIALISTA.' 
  },
  { 
    category: 'Pós-Consulta', 
    trigger: 'Pós-Consulta Oficial', 
    content: '❗Pós consulta do neurologista:❗\n\nOlá tudo bem? A aderência do seu tratamento é muito importante para melhora de seus sintomas, caso apresente alguma dúvida como (consulta/ tratamento/ medicação/agendamento de retorno) estamos à disposição, um ótimo dia!!\n\n❗FAVOR CASO PRECISE AGENDAR RETORNO DENTRO DO PERÍODO DOS 30 DIAS, LEMBRAR DE AGENDAR O RETORNO ANTECIPADAMENTE, POIS A AGENDA ATUALMENTE ESTÁ LIMITADA❗\n\n✅Seu feedback é importante para o Dr. Omar. Dá um click aqui⤵️: https://g.page/r/CQINFYyP4EN7EBM/review' 
  }
];

// Mock clinical data
export const MOCK_DATA: DaySchedule[] = [
  {
    date: '2025-09-10',
    weekday: 'Quarta',
    checklist: [],
    appointments: [
      { 
        id: 'ex1', time: '08:00', patientName: 'CARLOS ALBERTO EXEMPLO', status: 'atendido', 
        paidValue: 600, paymentMethod: 'PIX', type: 'consulta', priceTable: 'Particular', 
        date: '2025-09-10', period: 'matutino', confirmed: true, mode: 'Presencial', 
        expectedValue: 600, age: '45', cityState: 'Campo Grande - MS', phone: '67999991111', 
        notes: 'Paciente with migraine history.', locationId: 'loc1'
      }
    ]
  }
];

export const CRM_PATIENTS: PatientCRM[] = [];
export const MOCK_WAITLIST: WaitlistPatient[] = [];

export const MOCK_PARTNERS: SpecialistPartner[] = [
  { id: '1', specialty: 'Neurocirurgia', name: 'Dr. Exemplo Cirurgião', phone: '(67) 99999-0000', location: 'Hospital da Unimed' },
  { id: '2', specialty: 'Psiquiatria', name: 'Dra. Exemplo Psiquiatra', phone: '(67) 98888-1111', location: 'Clínica da Mente' }
];

export const MOCK_EXAMS: ExamPartner[] = [
  { id: '1', examName: 'Ressonância Magnética', location: 'Diimagem', contact: '(67) 3333-3333', website: 'www.diimagem.com.br' },
  { id: '2', examName: 'Eletroneuromiografia', location: 'Clínica Samari', contact: '(67) 3444-4444', website: 'www.clinicasamari.com.br' }
];

export const MOCK_BUDGETS: Budget[] = [
  {
    id: 'b1',
    procedureName: 'Infiltração de Pontos Gatilho (Botox)',
    createdAt: '2025-10-15',
    fees: [
      { id: 'f1', name: 'Taxa de Sala', value: 150 },
      { id: 'f2', name: 'Honorários Médicos', value: 800 }
    ],
    medications: [
      { id: 'm1', name: 'Toxina Botulínica (Frasco 100UI)', value: 1200 },
      { id: 'm2', name: 'Lidocaína 2%', value: 30 }
    ],
    materials: [
      { id: 'mt1', name: 'Kit Infiltração (Seringas/Agulhas)', value: 50 },
      { id: 'mt2', name: 'Luvas Estéreis e Campos', value: 20 }
    ],
    options: [
      { id: 'o1', method: 'À Vista (PIX/Dinheiro)', total: 2100, details: 'Desconto especial para pagamento imediato.' },
      { id: 'o2', method: 'Cartão de Crédito (até 3x)', total: 2250, details: 'Parcelamento em 3x de R$ 750,00 sem juros.' }
    ],
    notes: 'Procedimento realizado em consultório.'
  }
];

export const MOCK_DOCUMENTS: UtilityDocument[] = [];

export const DEFAULT_USERS: UserAccount[] = [
  { id: 'u0', name: 'Administrador', username: 'administrador', role: 'admin', password: 'Neuroclinic.15', permissions: ['agenda', 'pacientes', 'crm', 'scripts', 'documentos', 'parceiros', 'orcamentos', 'administracao', 'configuracoes'] },
  { id: 'u1', name: 'Dr. Omar', username: 'doctor', role: 'doctor', password: 'Mexico.15', permissions: ['agenda', 'pacientes', 'crm', 'scripts', 'documentos', 'parceiros', 'orcamentos', 'administracao', 'configuracoes'] },
  { id: 'u2', name: 'Secretária', username: 'secretary', role: 'secretary', password: 'Mexico.00', permissions: ['agenda', 'pacientes', 'crm', 'scripts', 'documentos', 'parceiros', 'orcamentos'] }
];