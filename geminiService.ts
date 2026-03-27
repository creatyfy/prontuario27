import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptionConfig, TranscriptionTemplate, ConclusionType, DocumentTemplate } from "./types";

const MEDICAL_VOCABULARY = `
Termos médicos para correção: Losartana, Atenolol, Metformina, Glifage, Anlodipino, Hidroclorotiazida, Selozok, Enalapril, Sinvastatina, Rosuvastatina, Atorvastatina, Pantoprazol, Omeprazol, Levotiroxina, Puran T4, Euthyrox, Jardiance, Forxiga, Victoza, Ozempic, Trulicity, Januvia, Galvus, Amoxicilina, Azitromicina, Ciprofloxacino, Ceftriaxona, Clavulin, Dipirona, Paracetamol, Ibuprofeno, Nimesulida, Cetoprofeno, Diclofenaco, Prednisona, Dexametasona, Hidrocortisona, Fluoxetina, Sertralina, Escitalopram, Citalopram, Paroxetina, Venlafaxina, Desvenlafaxina, Duloxetina, Amitriptilina, Nortriptilina, Clomipramina, Imipramina, Lítio, Quetiapina, Risperidona, Olanzapina, Aripiprazol, Haloperidol, Clozapina, Carbamazepina, Valproato, Depakene, Depakote, Fenitoína, Fenobarbital, Gardenal, Lamotrigina, Topiramato, Gabapentina, Pregabalina, Levetiracetam, Keppra, Oxcarbazepina, Trileptal, Vigabatrina, Lacosamida, Perampanel, Enteossuximida, Zonisamida, Diazepam, Clonazepam, Rivotril, Alprazolam, Lorazepam, Midazolam, Zolpidem, Eszopiclona, Melatonina, Donepezila, Galantamina, Rivastigmina, Memantina, Beta-interferon, Natalizumabe, Tysabri, Fingolimode, Gilenya, Teriflunomida, Aubagio, Dimetilfumarato, Tecfidera, Ocrelizumabe, Ocrevus, Alemtuzumabe, Lemtrada, Cladribina, Mavenclad, Ofatumumabe, Kesimpta.

Sintomas: dor, dor leve, dor moderada, dor forte, dor intensa, dor aguda, dor crônica, dor em queimação, dor em pontada, dor em pressão, dor latejante, dor em choque, dor em peso, dor em cólica, dor contínua, dor intermitente, piora à noite, piora de manhã, piora ao esforço, piora em repouso, melhora com repouso, melhora com movimento, melhora com calor, melhora com gelo, piora com frio, irradia, sem irradiação, início súbito, início gradual, início recente, longa data, recorrente, primeira vez, crises, em surtos, constante, progressivo, estável, flutuante, piorando, melhorando, sem melhora, sem mudança, associado a febre, sem febre, calafrios, sudorese, sudorese noturna, fadiga, cansaço, astenia, fraqueza, fraqueza geral, fraqueza focal, queda, tropeços, desequilíbrio, vertigem, tontura, pré-síncope, síncope, desmaio, palpitações, dor no peito, aperto no peito, falta de ar, dispneia, dispneia aos esforços, ortopneia, dispneia paroxística noturna, tosse, tosse seca, tosse produtiva, expectoração, hemoptise, coriza, congestionão nasal, dor de garganta, rouquidão, chiado, sibilos, febre baixa, febre alta, náusea, vômitos, vômitos em jato, diarreia, constipação, prisão de ventre, dor abdominal, distensão abdominal, azia, pirose, refluxo, plenitude, saciedade precoce, perda de apetite, anorexia, aumento do apetite, polifagia, perda de peso, ganho de peso, sede, polidipsia, urina frequente, polaciúria, urgência urinária, disúria, ardor ao urinar, hematúria, incontinência, retornou urinária, noctúria, dor lombar, dor pélvica, corrimento, sangramento, mestreuação irregular, amenorreia, menorragia, dismenorreia, dor na relação, dispareunia, redução de libido, impotência, ejaculação precoce, dor testicular, nódulo, caroço, aumento de volume, edema, inchaço, edema de pernas, câimbras, espasmos, rigidez, tremor, tremor em repouso, tremor de ação, tremor postura, abalos, mioclonias, formigamento, parestesia, dormência, hipoestesia, alodinia, hiperestesia, choque elétrico, queimação, sensação de peso, sensação de aperto, sensação de falta de ar, sensação de nó na garganta, cefaleia, dor de cabeça, enxaqueca, aura, fotofobia, fonofobia, osmofobia, náusea na cefaleia, cefaleia em trovoada, cefaleia matinal, cefaleia noturna, piora ao tossir, piora ao esforço, dor facial, neuralgia, dor ocular, olho vermelho, visão turva, visão dupla, diplopia, perda visual, escotoma, fotopsias, moscas volantes, dor ao mover os olhos, zumbido, tinnitus, perda auditiva, otalgia, plenitude auricular, vertigem rotatória, instabilidade, ataxia, dificuldade para andar, marcha instável, quedas, fraqueza de perna, fraqueza de braço, mão fraca, pé caído, dificuldade para subir escadas, dificuldade para levantar, lentidão, bradicinesia, rigidez muscular, distonia, movimentos involuntários, tique, coreia, hemibalismo, paralisia, paresia, dormência em hemicorpo, assimetria facial, boca torta, fala enrolada, disartria, afasia, dificuldade para falar, dificuldade para entender, engasgos, disfagia, tosse ao comer, sialorreia, salivação excessiva, voz anasalada, voz fraca, rouquidão persistente, soluços, perda de equilíbrio, sensação de desmaio, confusão, desorientação, sonolência, insônia, sono não reparador, hipersonia, apneia, ronco, pesadelos, sonambulismo, agitação noturna, ansiedade, crise de ansiedade, pânico, irritabilidade, humor deprimido, tristeza, anedonia, falta de energia, culpa, desesperança, pensamentos intrusivos, ruminação, estresse, luto, trauma, medo, nervosismo, tremor por ansiedade, dificuldade de concentração, atenção reduzida, esquecimento, falhas de memória, amnésia recente, desatenção, lentificação, desorganização, confusão mental, “brain fog”, alteração de comportamento, apatia, agressividade, impulsividade, alucinações, delírios, paranoia, convulsão, crise convulsiva, crise focal, crise generalizada, perda de consciência, olhar fixo, automatismos, mordedura de língua, incontinência na crise, confusão pós-crise, cefaleia pós-crise, dor muscular pós-crise, desmaio com convulsão, síncope convulsiva, dor cervical, rigidez de nuca, febre com cefaleia, fotofobia com febre, vômitos com cefaleia, dor nas costas, dor articular, artralgia, mialgia, dor difusa, dor em pontos, hipersensibilidade, fibromialgia, rigidez matinal, edema articular, calor local, rubor, lençol de pele, rash, manchas, urticária, prurido, coceira, icterícia, pele amarela, palidez, cianose, sangramento fácil, hematomas, epistaxe, gengivorragia, queda de cabelo, unhas fracas, feridas, úlceras, aftas, boca seca, olho seco, intolerância ao calor, intolerância ao frio, sudorese excessiva, tremor de frio, calafrios, edema facial, inchaço de pálpebras, dor ao urinar, dor ao evacuar, sangue nas fezes, fezes pretas, fezes claras, vômito com sangue, dor ao respirar, dor pleurítica, dor nas costelas, dor no ombro, dor no braço, dor na perna, dor no joelho, dor no tornozelo, dor no punho, dor no ombro ao movimento, limitação de movimento, perda de força, perda de sensibilidade, queda de objetos, câimbra noturna, espasticidade, sensação de choque na coluna, dor neuropática, dor nociceptiva, dor mista, febre após viagem, contato doente, alergia, reação alérgica, intolerância medicamentosa, efeito colateral, melhora com remédio, piora com remédio, aderência irregular, esqueci dose, interrompeu remédio, uso contínuo, dose aumentada, dose reduzida, automedicação, uso de analgésico, uso de anti-inflamatório, uso de antibiótico, uso de corticoide, uso de benzodiazepínico, uso de antidepressivo, uso de antiepiléptico, uso de antipsicótico, uso de anti-hipertensivo, uso de hipoglicemiante, uso de anticoagulante, uso de AAS, uso de estatina, uso de suplemento, álcool, tabagismo, ex-tabagista, nunca fumou, drogas ilícitas, cafeína, energético, sono irregular, sedentarismo, atividade física, dieta ruim, dieta balanceada, estresse no trabalho, sobrecarga, dor por esforço, acidente, queda recente, trauma, cirurgia recente, internação recente, infecção recente, vacina recente, histórico familiar, pai, mãe, irmão, irmã, avó, avô, filho, filha, esposa, marido, companheiro, acompanhante, cuidador, vizinho, amigo, colega, professor, estudante, médico, enfermeiro, fisioterapeuta, psicólogo, terapeuta ocupacional, nutricionista, farmacêutico, paciente, adolescente, criança, adulto, idoso, gestante, puérpera, recém-nascido, morador, residente, trabalhador, aposentado, desempregado, autônomo, agricultor, motorista, professor(a), dona de casa, estudante, vendedor(a), auxiliar, diarista, cuidadora, sem escolaridade, ensino fundamental, ensino médio, superior, mora sozinho, mora com família, mora com filhos, mora com cônjuge, apoio familiar, sem apoio, dependente, independente, usa benglala, usa andador, usa cadeira de rodas, quedas frequentes, risco de queda, precisa ajuda, precisa acompanhante, limitações, incapacidade, retorno, primeira consulta, seguimento, teleconsulta, urgência, emergência, encaminhado, referência, contrarreferência.

Sinais Clínicos (Exame Físico): estado geral bom, estado geral regular, estado geral grave, consciente, alerta, sonolento, obnubilado, confuso, desorientado, agitado, cooperativo, não cooperativo, Glasgow 15, Glasgow reduzido, fala preservada, disartria, afasia, voz rouca, voz hipofônica, fácies de dor, fácies parkinsoniana, cianose, palidez, icterícia, sudorese, desidratação, edema, edema periférico, edema facial, linfonodos aumentados, tiroide aumentada, perda ponderal evidente, obesidade, marcha normal, marcha antálgica, marcha atáxica, marcha parkinsoniana, marcha espástica, marcha em steppage, instabilidade postural, Romberg positivo, Romberg negativo, queda à prova, nistagmo, nistagmo horizontal, nistagmo vertical, nistagmo rotatório, pupilas isocóricas, anisocoria, pupilas fotorreagentes, reflexo fotomotor ausente, ptose, estrabismo, paresia ocular, diplopia ao exame, papiledema, fundoscopia alterada, acuidade visual reduzida, campo visual alterado, face assimétrica, desvio de rima, paresia facial central, paresia facial periférica, língua desviada, fasciculações de língua, disartria bulbar, reflexo nauseoso reduzido, disfagia ao teste, fraqueza de trapézio, atrofia muscular, hipertrofia, fasciculações, tônus normal, hipertonia, hipotonia, rigidez plástica, rigidez em roda denteada, espasticidade, clônus, clônus sustentado, tremor de repouso, tremor postural, tremor de intenção, mioclonias, coreia, distonia, tique, bradicinesia, acinesia, prova dedo-nariz alterada, prova calcanhar-joelho alterada, disdiadococinesia, dismetria, assinergia, ataxia troncular, sinal de Babinski, Babinski bilateral, Hoffman, sinal de Tromner, sinal de Wartenberg, força 5/5, força 4/5, força 3/5, força 2/5, hemiparesia, monoparesia, paraparesia, tetraparesia, plegia, queda do pé, queda do punho, prova de Mingazzini positiva, prova de Barré positiva, drift pronador, reflexos normais, hiperreflexia, hiporreflexia, arreflexia, patelar exaltado, aquileu abolido, reflexo cutâneo abdominal ausente, reflexo plantar em extensão, sensibilidade preservada, hipoestesia, anestesia, alodinia ao toque, hiperestesia, alteração vibratória, alteração proprioceptiva, nível sensitivo, parestesia ao estímulo, sinal de Lhermitte referido, teste de Lasègue positivo, Brudzinski positivo, Kernig positivo, rigidez de nuca, sinal de meninge, dor à palpação, ponto gatilho, Tinel positivo, Phalen positivo, sinal de Froment, sinal de Waddell, sinal de Spurling, amplitude reduzida, limitação de ADM, contratura, deformatidade articular, derrame articular, crepitação, calor local, rubor local, sopro carotídeo, pulso regular, pulso irregular, pulso fino, pulso cheio, extremidades frias, enchimento capilar lento, turgor reduzido, PA elevada, PA baixa, taquicardia, bradicardia, febril ao toque, afebril, taquipneia, uso de musculatura acessória, tiragem, sibilos, roncos, estertores, murmúrio vesicular reduzido, expansibilidade reduzida, percussão maciça, percussão timpânica, sopro cardíaco, bulhas normofonéticas, B3 presente, B4 presente, atrito pericárdico, edema de membros inferiores, turgência jugular, hepatomegalia, hepatojugular positivo, abdome doloroso, defesa abdominal, rigidez abdominal, Blumberg positivo, Murphy positivo, Giordano positivo, ascite, macicez móvel, ruídos hidroaéreos aumentados, ruídos reduzidos, massa palpável, hérnia, dor em fossa ilíaca, dor epigástrica, dor hipocôndrio, toque doloroso, sangue ao toque, próstata aumentada, lesões cutâneas, rash maculopapular, petéquias, púrpura, livedo, úlceras, escaras, equimoses, hematomas, sinais de picada, edema assimétrico, empastamento de panturrilha, Homans (pouco específico), sinais de TVP, sopro femoral, presumidamente reduzidos, dor à compressão torácica, dor à palpação costal, cifose, escoliose, dor paravertebral, gatilhos miofasciais, teste de FABER positivo, teste de Trendelenburg, sinal de Ortolani, sinal de Barlow, sinal de McMurray, Lachman positivo, gaveta anterior, gaveta posterior, instabilidade ligamentar, crepitação patelar, edema de joelho, derrame patelar, sinal da tecla, rigidez articular, limitação funcional, teste cognitivo alterado, desatenção, lentificação psicomotora, memória imediata reduzida, apraxia, agnosia, negligência, alteração de julgamento, afeto embotado, labilidade emocional, humor deprimido, ansiedade evidente, disautonomia ortostática, hipotensão ortostática, taquicardia postural, pele fria e úmida, sudorese assimétrica, pupilas anormais, boca seca, olhos secos.
`;

const EXAM_LIBRARY = `
BIBLIOTECA DE EXAMES PARA NORMALIZAÇÃO:
LABORATORIAIS: Hemograma completo (HC, CBC), Hemoglobina (Hb), Hematócrito (Ht), Eritrócitos (Hemácias, RBC), Leucócitos totais (WBC, Leucograma), Plaquetas (PLT), VCM (MCV), HCM (MCH), CHCM (MCHC), RDW, Reticulócitos, Neutrófilos segmentados, Neutrófilos bastonetes (Bastões), Linfócitos (Lymphs), Monócitos (Monos), Eosinófilos (Eos), Basófilos (Basos), Tempo de Protrombina (TP, PT), INR, TTPa (aPTT), Fibrinogênio (Fator I), D-dímero, Antitrombina III, Proteína C, Proteína S, Glicemia de jejum, Glicemia casual, Glicemia pós-prandial (GPP), Curva glicêmica (TOTG, OGTT), Hemoglobina glicada (HbA1c), Insulina basal, Peptídeo C, HOMA-IR, Ureia (BUN), Creatinina sérica, Clearance de creatinina (ClCr), Taxa de filtração glomerular (TFG, eGFR), Ácido úrico, Sódio (Na⁺), Potássio (K⁺), Cloro (Cl⁻), Cálcio total/iônico, Magnésio (Mg²⁺), Fósforo (Fosfato), AST (TGO), ALT (TGP), Fosfatase alcalina (FA, ALP), Gama-GT (GGT), Bilirrubina total/direta/indireta, Albumina, Proteínas totais, Colesterol total, HDL-colesterol, LDL-colesterol, Triglicerídeos, Colesterol não-HDL, Apolipoproteína A1/B, Lipoproteína(a), TSH, T4 livre/total, T3 livre/total, Anti-TPO, Anti-Tg, TRAb, PCR, PCR-us, VHS, Procalcitonina, Ferritina, Ferro sérico, Transferrina, Saturação de transferrina, Vitamina B12, Ácido fólico, Vitamina D 25-OH, Paratormônio (PTH), Creatinoquinase total (CK, CPK), CK-MB, Troponina I/T, Mioglobina, BNP, NT-proBNP, Lactato sérico, Amônia plasmática, FAN (ANA), Fator reumatoide (FR), Anti-CCP, Complemento C3/C4, Anti-dsDNA, Anti-Sm, Anti-Ro (SSA), Anti-La (SSB), ANCA, Anticardiolipina, EAS (Urina tipo I), Proteinúria 24h, Microalbuminúria, ACR, Urocultura, Parasitológico (EPF), Coprocultura, Sangue oculto, Calprotectina fecal, Cortisol, ACTH, Prolactina, Testosterona, Estradiol, Progesterona, FSH, LH, Beta-hCG, PSA total/livre, CA-125, CA-15-3, CA-19-9, CEA, Alfa-fetoproteína, HIV, Carga viral HIV, CD4/CD8, HBsAg, Anti-HBs/HBc/HCV, VDRL, FTA-ABS, Toxoplasmose, CMV, Epstein-Barr, Líquor (LCR) - citologia/proteínas/glicose/lactato/Bandas oligoclonais, Gasometria.
COMPLEXOS (IMAGEM, FISIOLOGIA E OUTROS): Radiografia de tórax, Radiografia de abdome simples, Radiografia de abdome agudo, Radiografia de coluna cervical, Radiografia de coluna torácica, Radiografia de coluna lombar, Radiografia de coluna total, Radiografia de bacia, Radiografia de quadril, Radiografia de joelho, Radiografia de tornozelo, Radiografia de pé, Radiografia de mão, Radiografia de punho, Radiografia de ombro, Radiografia de cotovelo, Radiografia de crânio, Radiografia de seios da face, Radiografia panorâmica odontológica, Radiografia de ATM, Esofagograma contrastado, Seriografia esofagogastroduodenal, Trânsito intestinal, Enema opaco, Urografia excretora, Cistografia, Uretrocistografia miccional, Histerossalpingografia, Mamografia convencional, Mamografia digital, Tomossíntese mamária, Ultrassonografia abdominal total, Ultrassonografia abdominal superior, Ultrassonografia pélvica, Ultrassonografia transvaginal, Ultrassonografia obstétrica, Ultrassonografia morfológica fetal, Ultrassonografia com Doppler colorido, Ultrassonografia Doppler de carótidas, Ultrassonografia Doppler vertebral, Ultrassonografia Doppler arterial de membros inferiores, Ultrassonografia Doppler venosa de membros inferiores, Ultrassonografia Doppler renal, Ultrassonografia de tireoide, Ultrassonografia de mamas, Ultrassonografia testicular, Ultrassonografia escrotal com Doppler, Ultrassonografia de próstata transretal, Ultrassonografia musculoesquelética, Ultrassonografia de partes moles, Ultrassonografia endocavitária, Ecocardiograma transtorácico, Ecocardiograma transesofágico, Ecocardiograma com Doppler, Ecocardiograma com contraste, Ecocardiograma de estresse farmacológico, Eletrocardiograma de repouso, Eletrocardiograma de alta resolução, Teste ergométrico convencional, Teste ergométrico com imagem, Teste cardiopulmonar de exercício, Holter 24 horas, Holter 48 horas, Monitorização ambulatorial da pressão arterial, Tilt test, Estudo eletrofisiológico cardíaco invasivo, Cardioversão elétrica programada, Cintilografia miocárdica de perfusão, Cintilografia miocárdica com estresse, Cintilografia óssea trifásica, Cintilografia renal dinâmica, Cintilografia renal estática, Cintilografia pulmonar de ventilação, Cintilografia pulmonar de perfusão, PET-CT oncológico, PET-CT neurológico, PET-CT cardíaco, Tomografia computadorizada de crânio, Tomografia computadorizada de tórax, Tomografia computadorizada de abdome, Tomografia computadorizada de pelve, Tomografia computadorizada de coluna cervical, Tomografia computadorizada de coluna torácica, Tomografia computadorizada de coluna lombar, Tomografia computadorizada de seios da face, Tomografia computadorizada de ossos temporais, Tomografia computadorizada cardíaca, Angiotomografia de coronárias, Angiotomografia cerebral, Angiotomografia de vasos cervicais, Angiotomografia de aorta, Angiotomografia pulmonar, Ressonância magnética de encéfalo, Ressonância magnética de hipófise, Ressonância magnética de coluna cervical, Ressonância magnética de coluna torácica, Ressonância magnética de coluna lombar, Ressonância magnética de joelho, Ressonância magnética de ombro, Ressonância magnética de quadril, Ressonância magnética de tornozelo, Ressonância magnética de pelve, Ressonância magnética de abdome, Ressonância magnética de fígado com contraste, Ressonância magnética de vias biliares, Ressonância magnética de próstata multiparamétrica, Ressonância magnética cardíaca, Ressonância magnética funcional cerebral, Angiorressonância cerebral, Angiorressonância de vasos cervicais, Angiorressonância de aorta, Angiorressonância renal, Densitometria óssea por DEXA, DEXA corporal total, Elastografia hepática por FibroScan, Elastografia hepática por USG, Elastografia mamária, Elastografia de tireoide, Espirometria, Prova de função pulmonar completa, Capacidade de difusão pulmonar, Teste de broncoprovocação, Polissonografia completa, Poligrafia respiratória domiciliar, Oximetria noturna contínua, Capnografia, Eletroencefalograma de rotina, Eletroencefalograma com privação de sono, Eletroencefalograma prolongado, Vídeo-eletroencefalograma, Potenciais evocados visuais, Potenciais evocados auditivos, Potenciais evocados somatossensitivos, Eletroneuromiografia, Estudo de condução nervosa motora, Estudo de condução nervosa sensitiva, Teste de fibra única, Eletromiografia de superfície, Audiometria tonal liminar, Audiometria vocal, Impedanciometria, Emissões otoacústicas evocadas, Potencial evocado auditivo de tronco encefálico, Videonistagmografia, Eletronistagmografia, Prova calórica computadorizada, Posturografia dinâmica computadorizada, Endoscopia digestiva alta, Colonoscopia, Retossigmoidoscopia, Enteroscopia, Cápsula endoscópica, Broncoscopia flexível, Broncoscopia rígida, Laringoscopia direta, Nasofibrolaringoscopia, Cistoscopia, Ureteroscopia, Histeroscopia diagnóstica, Artroscopia diagnóstica, Videolaparoscopia diagnóstica, Manometria esofágica, pHmetria esofágica de 24 horas, Manometria anorretal, Estudo urodinâmico completo, Fluxometria urinária, Videourodinâmica, Termografia infravermelha médica, Tomografia de coerência óptica, Retinografia digital, Angiografia fluoresceínica, Angiografia por indocianina verde, Campimetria computadorizada, Fluoroscopia dinâmica, Videofluoroscopia da deglutição, Baropodometria eletrônica, Bioimpedância elétrica segmentar, Avaliação de composição corporal por BIA, Avaliação cardiopulmonar integrada por imagem.
`;

const TRANSCRIPTION_PROMPT = `
Se houver dúvida, não chute. Use [inaudível] ou [duvidoso].

Você é um transcritor médico especializado em segurança do paciente e auditoria clínica. Sua tarefa é processar o áudio de uma consulta e transformá-lo em uma transcrição técnica estruturada, diarizada e fiel.

DIRETRIZES DE OPERAÇÃO:

1. DIARIZAÇÃO AMPLIADA:
Identifique e use obrigatoriamente estes rótulos para as falas:
[Médico], [Paciente], [Acompanhante], [Familiar], [Terceiro/Equipe], [Voz ao fundo].

2. TRATAMENTO DE CONTEÚDO (AUDITORIA):
Não apague conversas paralelas. Em vez disso, organize a saída em dois blocos:
- BLOCO A: "=== TRANSCRIÇÃO DA CONSULTA ==="
  Contém tudo que tem potencial clínico, queixas, exame físico, orientações e diálogos da consulta propriamente dita. Na dúvida se um trecho é relevante, MANTENHA-O aqui.
- BLOCO B: "=== TRECHOS PARALELOS / NÃO RELEVANTES (AUDITORIA) ==="
  Contém small talk puro, cumprimentos excessivos, comentários sobre o clima ou assuntos totalmente alheios à saúde que não agregam valor ao prontuário, mas que devem ser preservados para fins de auditoria.

3. PROIBIÇÃO DE "CORREÇÕES CRIATIVAS" (SEGURANÇA):
- NÃO complete frases interrompidas.
- Se um trecho for incompreensível, use estritamente [inaudível].
- NÃO invente doses, datas, nomes, diagnósticos ou valores que não foram ditos claramente.
- Se um termo médico ou nome de remédio estiver duvidoso, mantenha a grafia mais próxima do que foi ouvido e adicione [duvidoso] ao lado. Não troque a palavra por uma "provável".

4. VOCABULÁRIO E PADRONIZAÇÃO:
Use o vocabulário médico (${MEDICAL_VOCABULARY}) apenas para padronizar a grafia de termos claramente identificados (ex: "lozartana" -> "Losartana"). Nunca use a lista para "adivinhar" um termo que não foi pronunciado de forma reconhecível.

SAÍDA OBRIGATÓRIA:
=== TRANSCRIÇÃO DA CONSULTA ===
[Rótulo]: Texto...

=== TRECHOS PARALELOS / NÃO RELEVANTES (AUDITORIA) ===
[Rótulo]: Texto... (se houver)
`;

export interface ContextTriggers {
  isRetorno: boolean;
  includeROS: boolean;
  includeEM: boolean;
  includePhysical: boolean;
  selectedModel?: 'flash' | 'thinking' | 'pro';
  customConfig?: TranscriptionConfig;
  selectedTemplateId?: string;
}

/**
 * Extrai exames de múltiplos arquivos (Imagens ou PDFs)
 */
export async function extractExamsFromFiles(files: { data: string, mimeType: string }[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemPrompt = `Você é um Analista de Documentos Médicos de elite. 
Sua tarefa é ler os arquivos fornecidos (imagens ou PDFs) e extrair EXCLUSIVAMENTE informações sobre exames realizados.

FOCO DE EXTRAÇÃO:
1. Exames Principais: Laboratoriais (sangue/urina), Imagem (RM, TC, RX), Fisiológicos (ECG, EEG, ENMG), Ultrassonografia e outros.
2. Dados Obrigatórios: Data do exame e o Resultado/Valor encontrado.

DIRETRIZES:
- Use a biblioteca de normalização para corrigir nomes: ${EXAM_LIBRARY}
- Se o arquivo for uma imagem de um laudo, transcreva o sumário do resultado.
- Formate a saída como um texto técnico editável, agrupando por data.
- Não invente informações. Se não houver data legível, indique "Data não identificada".

EXEMPLO DE SAÍDA:
Exames em 10/02/2025:
- Hemoglobina: 14.2 g/dL
- Creatinina: 0.9 mg/dL

Exames em 15/01/2025:
- RM de Crânio: Sem evidência de novas lesões desmielinizantes.`;

  const parts = files.map(f => ({
    inlineData: {
      data: f.data.includes(',') ? f.data.split(',')[1] : f.data,
      mimeType: f.mimeType
    }
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-09-2025',
      contents: {
        parts: [
          ...parts,
          { text: systemPrompt }
        ]
      }
    });
    return response.text || "Nenhuma informação de exame identificada nos arquivos.";
  } catch (error) {
    console.error("File Extraction Error:", error);
    throw error;
  }
}

/**
 * Transcreve áudio de ditado de exames usando Gemini 3 Flash
 */
export async function transcribeExamAudio(audioData: string, mimeType: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: audioData,
              mimeType: mimeType,
            },
          },
          {
            text: "Você é um escriba médico de elite. Transcreva este áudio de ditado de resultados de exames para texto técnico. Corrija termos (ex: 'hb' vira 'Hemoglobina'). Retorne APENAS o texto puro."
          }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Erro na transcrição de áudio de exames:", error);
    throw error;
  }
}

/**
 * Organiza texto bruto de exames em formato estruturado JSON
 */
export async function processExamData(rawText: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Alterado para Flash 3 para máxima velocidade de resposta
  const model = 'gemini-3-flash-preview';
  
  const systemInstruction = `Você é um Escriba Digital de Alta Performance Especialista em Exames Médicos. Sua tarefa é extrair dados de textos brutos e estruturá-los em JSON de forma extremamente rápida.

REGRAS RÍGIDAS:
1. EXIGÊNCIA DE DATA: Identifique a data de realização no texto (ex: 10/02/2025). Se não houver data, retorne {"error": "NO_DATE_FOUND"}.
2. CATEGORIZAÇÃO:
   - "laboratory": Exames numéricos ou qualitativos simples (Sangue, Urina, etc).
   - "complex": Laudos e Imagens (RM, TC, RX, ECG, EEG, ENMG, USG, Endoscopia, etc).
3. NORMALIZAÇÃO: Use a biblioteca abaixo para corrigir e padronizar os nomes dos exames.
${EXAM_LIBRARY}
4. FORMATO: Retorne APENAS o JSON puro. Sem markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: `Processe agora os exames: ${rawText}`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            laboratory: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  value: { type: Type.STRING },
                  date: { type: Type.STRING, description: "DD/MM/AAAA" }
                },
                required: ["name", "value", "date"]
              }
            },
            complex: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  result: { type: Type.STRING },
                  date: { type: Type.STRING, description: "DD/MM/AAAA" }
                },
                required: ["name", "result", "date"]
              }
            },
            error: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text?.trim() || "";
    if (!text) throw new Error("Resposta vazia da IA.");
    return JSON.parse(text);
  } catch (error) {
    console.error("Erro no Processamento de Exames:", error);
    throw error;
  }
}

export async function formatMedicalRecord(transcription: string, history?: string, context?: ContextTriggers) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let modelName = 'gemini-3-flash-preview';
  let config: any = {
    temperature: 0,
  };

  // Prepend strict grounding rules to any system instruction
  const strictGroundingRule = `
Você é um ESCRIBA MÉDICO. Sua tarefa é gerar um PRONTUÁRIO DETALHADO (não resumido) a partir da TRANSCRIÇÃO DA CONSULTA e do HISTÓRICO PRÉVIO (se existir).

OBJETIVO: Gerar registro clínico COMPLETO e DETALHADO, preservando integralmente dados explícitos. NÃO resumir. NÃO inventar.

REGRAS ANTI-RESUMO (CRÍTICAS):
1) Não converter achados específicos em frases genéricas.
2) Não usar “normal”, “sem alterações”, “estável”, “afebril” ou “sem queixas” se isso não foi dito explicitamente.
3) Não criar negações de sintomas/achados se não foram explicitamente declaradas.
4) Não perder valores: qualquer número/unidade mencionado deve ser capturado.
5) Se a seção não tiver conteúdo explícito, OMITIR COMPLETAMENTE a seção (não deixar título vazio).

REGRA DE CAPTURA TOTAL (MUITO IMPORTANTE):
Antes de escrever, varrer TODA a transcrição para localizar:
- sinais vitais/antropometria citados em qualquer momento (mesmo fora do “exame físico”)
- achados físicos citados de forma dispersa
- exames mencionados ou lidos parcialmente
- hipóteses/diagnósticos citados em qualquer momento
- condutas, prescrições, orientações, pedidos de exames
Depois, organizar cada item na seção correta.

REGRAS DE SOBERANIA E FIDELIDADE:
1) Use APENAS informações explicitamente presentes na TRANSCRIÇÃO e/ou no HISTÓRICO. É proibido inferir, completar, “normalizar” ou inventar.
2) Exemplos presentes nas instruções servem SOMENTE para formato. Nunca use exemplos como se fossem dados do paciente.
3) Se um item/seção não tiver dado explícito, OMITA COMPLETAMENTE (não escreva “N/I”, “nega”, “sem queixas” se isso não foi dito).
4) NÃO RESUMA. Preserve detalhes. Se houver múltiplos achados/valores/medicações, liste todos.
5) Respeite estritamente a ordem e os títulos das seções fornecidos no MODELO selecionado. Se não estiver no modelo, não crie.
6) Use Markdown Rico. Entre cada seção use EXATAMENTE: ---BLOCO_SEPARATOR---

REGRAS TÉCNICAS ADICIONAIS:
- Separar claramente: Consulta atual (transcrição) e Histórico prévio (apenas se for acompanhamento e autorizado).
- Em caso de ambiguidade → OMITIR.
- Respeitar rigorosamente o formato exigido (texto corrido vs lista).
- Linguagem médica objetiva e técnica.
`;

  // Se houver configuração personalizada e um template selecionado
  if (context?.customConfig && context?.selectedTemplateId) {
    const c = context.customConfig;
    const template = c.templates.find(t => t.id === context.selectedTemplateId);
    
    if (template) {
      // Seleção de Modelo
      if (c.model === 'flash-2.5') modelName = 'gemini-2.5-flash-preview-09-2025';
      else if (c.model === 'flash-3') modelName = 'gemini-3-flash-preview';
      else if (c.model === 'pro-3') modelName = 'gemini-3-pro-preview';
      else if (c.model === 'thinking-3') {
          modelName = 'gemini-3-pro-preview';
          config.thinkingConfig = { thinkingBudget: 4000 };
      }

      const enabledSections = [...template.sections]
          .filter(s => s.enabled)
          .sort((a, b) => a.order - b.order);

      // CRITICAL UPDATE: Rigorous adherence to specific section prompts from settings
      const sectionInstructions = enabledSections.map(s => `[SEÇÃO: ${s.label}]\nINSTRUÇÃO OBRIGATÓRIA: ${s.prompt}`).join('\n\n');
      const formatInstructions = enabledSections.map(s => `${s.label}: ...`).join('\n---BLOCO_SEPARATOR---\n');

      config.systemInstruction = `${strictGroundingRule}

AGORA: organize a "TRANSCRICÃO DA CONSULTA" seguindo RIGOROSAMENTE o modelo de estrutura escolhido e as INSTRUÇÕES ESPECÍFICAS DE CADA SEÇÃO abaixo.

CONTEXTO DO ATENDIMENTO:
- Tipo de consulta: ${context?.isRetorno ? 'ACOMPANHAMENTO' : 'PRIMEIRA CONSULTA'}
- Fontes disponíveis: TRANSCRIÇÃO / ANOTAÇÕES / HISTÓRICO PRÉVIO
- ROS foi acionado? ${context?.includeROS ? 'SIM' : 'NÃO'}

REGRAS TÉCNICAS:
1. Para cada seção, utilize EXCLUSIVAMENTE a instrução (prompt) definida especificamente para ela no bloco "INSTRUÇÕES OBRIGATÓRIAS POR SEÇÃO".
2. Utilize Markdown Rico (negritos, listas, tabelas) para formatar cada bloco conforme solicitado nas instruções da seção.
3. Capture com precisão cirúrgica todos os detalhes de Exame Físico e Exames laboratoriais/complementares citados.
4. IMPORTANTE: Use obrigatoriamente o separador "---BLOCO_SEPARATOR---" entre cada seção do documento.
5. PROIBIÇÃO DE ALUCINAÇÃO: Não preencha lacunas com dados fictícios. Exemplos contidos nas instruções servem apenas de guia de formato.

INSTRUÇÕES OBRIGATÓRIAS POR SEÇÃO:
${sectionInstructions}

FORMATO DEFINITIVO DE SAÍDA (RESPEITE A ORDEM E OS TÍTULOS):
${formatInstructions}`;
    }
  }

  // Fallback se não houver template ou config personalizada válida
  if (!config.systemInstruction) {
    let contextualInstructions = "";

    if (context?.isRetorno) {
        contextualInstructions += `
        MODO: EVOLUÇÃO CLÍNICA (RE-AVALIAÇÃO).
        - Não use o formato HDA clássico de início/meio/fim.
        - Foque na EVOLUÇÃO comparativa com o 'Histórico Prévio'.
        - Destaque: adesão ao tratamento atual, melhora ou piora de sintomas conhecidos e eventos intercorrentes.
        `;
    } else {
        contextualInstructions += `
        MODO: ANAMNESE INICIAL.
        - Use o formato HDA (História da Doença Atual) clássico, detalhando cronologia e características dos novos sintomas.
        `;
    }

    if (context?.includeROS) {
        contextualInstructions += `
        INCLUSÃO: REVISÃO DE SISTEMAS (ROS) DETALHADA.
        - Execute uma varredura "da cabeça aos pés" na transcrição.
        - Separe achados positivos e negativos pertinentes.
        `;
    }

    if (context?.includeEM) {
        contextualInstructions += `
        INCLUSÃO: PROTOCOLO ESTRUTURADO DE ESCLEROSE MÚLTIPLA.
        Preencha obrigatoriamente itens como EDSS, DMT, Surtos e Ressonância.
        `;
    }

    config.systemInstruction = `${strictGroundingRule}

Utilize o seguinte formato para organizar a informação médica, respeitando a estrutura do atendimento. Utilize Markdown Rico para formatação.
Use "---BLOCO_SEPARATOR---" entre as seções. 

IMPORTANTE: Seja extremamente atento e capture todos os exames laboratoriais, de imagem e achados de exame físico mencionados na consulta. Não perca dados técnicos nem omita laudos. 

INSTRUÇÕES DE CONTEXTO ATIVAS:
${contextualInstructions}

FORMATO DEFINITIVO DE SAÍDA:
Identificação: [Nome], [Idade]...
---BLOCO_SEPARATOR---
Queixa Principal: ...
---BLOCO_SEPARATOR---
História Pregressa: ...
---BLOCO_SEPARATOR---
Medicações em Uso: ...
---BLOCO_SEPARATOR---
${context?.isRetorno ? "Evolução Médica:" : "HDA:"} ...
---BLOCO_SEPARATOR---
Exame físico: [Detalhamento completo e rigoroso]
---BLOCO_SEPARATOR---
Exames Laboratoriais e Complementares: [Capture rigorosamente todos os resultados citados]
---BLOCO_SEPARATOR---
Hypotheses Diagnósticas: ...
---BLOCO_SEPARATOR---
Conduta e orientações: ...`;

    if (context?.selectedModel === 'pro') {
        modelName = 'gemini-3-pro-preview';
    } else if (context?.selectedModel === 'thinking') {
        modelName = 'gemini-3-pro-preview';
        config.thinkingConfig = { thinkingBudget: 4000 };
    } else {
        modelName = 'gemini-2.5-flash-preview-09-2025';
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `
        TRANSCRICÃO DA CONSULTA: ${transcription}
        HISTÓRICO: ${history || 'N/I'}
      `,
      config: config,
    });

    const text = response.text || "Erro no processamento.";
    return text.split('\\n').join('\n').replace(/\n\n\n+/g, '\n\n').trim();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao formatar prontuário.";
  }
}

export async function finalizeTranscription(audioData: string, mimeType: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          // Fix: Use inlineData instead of subtitleData for audio input
          { inlineData: { data: audioData, mimeType: mimeType } },
          { text: TRANSCRIPTION_PROMPT }
        ]
      },
      config: { temperature: 0.0 }
    });
    return response.text || "Erro ao gerar transcrição.";
  } catch (error) {
    console.error("Definitive Transcription Error:", error);
    return "Erro no processamento do áudio.";
  }
}

export async function processDiagnosisFusion(audioData: string, mimeType: string, consultationTranscription: string, config?: TranscriptionConfig, manualHypothesis?: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let systemPrompt = "";
  const selectedId = config?.selectedConclusionTypeId || 'concl-default';
  const conclusionType = config?.conclusionTypes?.find(c => c.id === selectedId);

  const strictGroundingRule = `
REGRA DE OURO (NÃO ALUCINAÇÃO): Baseie-se ESTRITAMENTE na INPUT 1, no áudio (INPUT 2) e nas observações manuais (INPUT 3) fornecidas abaixo. 
Não invente nomes de pacientes, não use exemplos dos prompts como se fossem dados reais.
Se não houver conduta ou HD citados pelo médico (Input 2 e Input 3), não invente.
IMPORTANTE: As OBSERVAÇÕES MANUAIS (Input 3) e o ÁUDIO (Input 2) têm soberania absoluta sobre a conversa da consulta (Input 1).
`;

  if (conclusionType) {
    systemPrompt = `${strictGroundingRule}\n\n${conclusionType.prompt}`;
  } else {
    // Default fallback
    systemPrompt = `${strictGroundingRule}
    ROLE: Atue como um Médico Sênior Especialista em Documentação Clínica e Codificação Diagnóstica (CID-10).
    INPUT 1 (CONTEXTO): Transcrição completa da consulta médica.
    INPUT 2 (DITADO FINAL - PRIORIDADE MÁXIMA): Áudio ditado pelo médico.
    INPUT 3 (OBSERVAÇÕES MANUAIS): Notas específicas escritas pelo médico.
    REGRAS: SOBERANIA DO DITADO E DAS NOTAS, EXTRAÇÃO TÉCNICA, INTELIGÊNCIA CID-10.
    SAÍDA: ## hd e ## condutas.`;
  }

  const parts: any[] = [
    { text: `INPUT 1 (CONTEXTO DA CONSULTA): ${consultationTranscription}` },
    { inlineData: { data: audioData, mimeType: mimeType } }
  ];

  if (manualHypothesis?.trim()) {
    parts.push({ text: `INPUT 3 (OBSERVAÇÕES/HIPÓTESES MANUAIS DO MÉDICO): ${manualHypothesis.trim()}` });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: { 
        systemInstruction: systemPrompt,
        temperature: 0.2 
      }
    });
    return response.text || "Erro na síntese.";
  } catch (error) {
    console.error("Diagnosis Fusion Error:", error);
    return "Erro ao processar síntese.";
  }
}

export async function generateMedicalDocument(prompt: string, transcription: string, history: string, selectedModel: string = 'flash', format: string = 'Markdown Rico', customTemplates: DocumentTemplate[] = []) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let modelName = 'gemini-3-flash-preview';
  if (selectedModel === 'pro') modelName = 'gemini-3-pro-preview';
  
  const templatesContext = customTemplates.length > 0 
    ? `\n\nMODELOS PERSONALIZADOS DO USUÁRIO:\n${customTemplates.map(t => `Palavra-Chave: "${t.keyword}" | Nome: "${t.name}" | Conteúdo base: ${t.content}`).join('\n---\n')}`
    : '';

  const SYSTEM_INSTRUCTION = `Você é um assistente médico de elite, focado em DOCUMENTAÇÃO CLÍNICA SEGURA.

DADOS DE ENTRADA:
1. INSTRUÇÕES DO MÉDICO: Sua ordem principal (ex: "receita losartana cardio, solicitar rx torax").
2. CONTEXTO CLÍNICO UNIFICADO (SUPORTE): Contém Resumo (Passado: ${history}) e Transcrição (Presente: ${transcription}).${templatesContext}

-> REGRAS DE MODELOS PERSONALIZADOS: Se a INSTRUÇÃO DO MÉDICO contiver uma das "Palavras-Chave" listadas nos MODELOS PERSONALIZADOS, você DEVE utilizar o "Conteúdo base" desse modelo para estruturar o documento correspondente, adaptando apenas os dados do paciente se necessário. Você pode combinar múltiplos modelos em um mesmo documento se múltiplas palavras-chave forem fornecidas.

-> USE este contexto para enriquecer justificativas e CIDs.
-> IMPORTANTE: Se o contexto estiver VAZIO ou insuficiente, NÃO TRAVE. Gere os documentos baseando-se EXCLUSIVAMENTE na instruções do médico. Para justificativas faltantes, use termos genéricos como "Investigação diagnóstica" ou "A critério médico".

REGRAS CRÍTICAS DE OPERAÇÃO:
1. TÍTULOS COPIÁVEIS (OBRIGATÓRIO): A primeira linha de TODO bloco gerado DEVE ser o título em CAIXA ALTA (ex: RECEITA MÉDICA). O usuário precisa copiar isso.
2. POSOLOGIA INTELIGENTE: Interprete "1-0-1" (manhã/noite). Se omitido a duração do tratamento sempre use "Uso contínuo".
3. TAG DE ESPECIALIDADE: Se a instrução mencionar uma especialidade ao lado do remédio (ex: "Losartana cardio"), adicione: "(Resp: Especialista)".
4. MENSAGEM DE SEGURANÇA: Adicione nas receitas: "Em caso de piora ou novos sintomas pode entrar em contato e procure o PS."
5. SEPARADOR: Use estritamente: ---BLOCO_SEPARATOR--- entre blocos de documentos differentes.
6. FORMATO SOLICITADO: ${format}.
   - "Markdown Rico": Com negritos e listas visuais.
   - "Formatado": Pronto para Word/E-mail.
   - "Compacto": Sem espaços vazios, economizando papel.
   - "Texto Puro": Apenas as letras, sem formatação.

ESTRUTURA DE SAÍDA POR BLOCO (EXEMPLOS):

=== RECEITA ===
RECEITA MÉDICA E ORIENTAÇÕES
1. **[Medicamento]** ([Dose]) [Se houver tag: (Resp: Especialista)] -------------------------- [Uso]
   Tomar [Qtd] [Via] [Horário].
(Repita numeração).
ORIENTAÇÕES:
1. [Orientações mencionadas].
2. [Lista de exames pedidos abaixo, encaminhamentos feitos e outros documentos feitos assim como outras orientaçoes].
3. "Em caso de piora dos sintomas ou reações, procure pronto-socorro."
RETORNO: [Data].

=== EXAMES LABORATORIAIS ===
SOLICITAÇÃO DE EXAMES LABORATORIAIS
Exames solicitados:
• [Nome do Exame]
Justificativa: [Extraída do CONTEXTO ou "Investigação diagnóstica"]. Hipótese: [CID-10 ou deixar em branco].

=== EXAMES DE IMAGEM/OUTROS (UM POR BLOCO) ===
SOLICITAÇÃO DE EXAME
Exame: [Nome Completo]
Objetivo: [Justificativa do CONTEXTO ou "Avaliação clínica"].
Hipótese Diagnóstica: [CID-10 ou em branco].
Detalhes: [Lado, contraste - se informado].

=== RELATÓRIOS/ENCAMINHAMENTOS ===
ENCAMINHAMENTO MÉDICO / RELATÓRIO
Ao colega especialista em [Especialidade].
Paciente: [Nome no Contexto ou "______"].
CID-10 Principal: [Código].
Resumo do Caso: [Síntese do CONTEXTO ou "Paciente encaminhado para avaliação especializada"].
Solicitação: [O que foi pedido na instrução].
Atenciosamente, [Assinatura].

=== ATESTADO ===
ATESTADO MÉDICO
Atesto que o paciente foi atendido... Afastamento: [Dias]. CID [Código].

=== ORIENTAÇÕES ESPECÍFICAS ===
ORIENTAÇÕES MÉDICAS - [TEMA]
1. [Orientação educativa 1]
2. [Orientação educativa 2]
(Gere apenas se o médico pedir explicitamente um tema educativo).

FLUXO DE PENSAMENTO:
1. Leia a INSTRUÇÃO DO MÉDICO: ${prompt} (Prioridade Máxima).
2. Tente usar o CONTEXTO para preencher detalhes. Se não houver contexto, use placeholders genéricos.
3. GARANTA que o título seja a primeira linha do bloco.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `GERAR DOCUMENTOS BASEADOS NA INSTRUÇÃO: ${prompt}`,
      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.2 },
    });
    return response.text || "Erro ao gerar documento.";
  } catch (error) {
    console.error("Document Generation Error:", error);
    return "Erro no serviço de documentos.";
  }
}

/**
 * Gera um texto curto para leitura em voz alta (readback) com itens críticos
 */
export async function generateReadbackText(texto: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = `Você é um assistente de conferência médica. Sua tarefa é extrair um texto curto e direto para leitura em voz alta (readback) contendo apenas os itens críticos da consulta.

REGRAS OBRIGATÓRIAS:
1. NUNCA invente informação.
2. NUNCA complete frases.
3. Se não encontrar dado no texto, escreva "N/I".
4. Preserve indicação de quem falou (Paciente, Acompanhante, etc.) quando existir.
5. Use exatamente as palavras que aparecem no texto original.

FORMATO FIXO DO RETORNO (SEMPRE IGUAL):
CONFIRMAÇÃO (READ-BACK)
Diagnóstico/Hipótese: ...
Sintomas novos/piora: ...
Medicações/ajustes: ...
Eventos adversos/alertas: ...
Exames/condutas: ...
Plano/retorno: ...`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: texto,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0,
      }
    });
    return response.text || "Não foi possível gerar o resumo para leitura.";
  } catch (error) {
    console.error("Readback Generation Error:", error);
    return "Erro ao gerar texto de conferência.";
  }
}
