export type BoneStatus = 'unassessed' | 'healthy' | 'moderate' | 'critical';
export type SensorType = 'QUS' | 'EMG';
export type SuitLayerMode = 'full' | 'xray' | 'exploded';
export type FormQuality = 'optimal' | 'poor';

export interface StatusColorPalette {
  healthy: string;
  moderate: string;
  critical: string;
  unassessed: string;
}

export const DEFAULT_STATUS_COLORS: StatusColorPalette = {
  healthy: '#10B981',
  moderate: '#F59E0B',
  critical: '#EF4444',
  unassessed: '#A8B0BA',
};

export interface BoneDatasetEntry {
  boneId: string;
  weaknessPercent?: number | null;
  sosMs?: number | null;
  buaDbMhz?: number | null;
  bmdGcm2?: number | null;
  tScore?: number | null;
  zScore?: number | null;
  fractureRisk?: string;
  colorHex?: string;
  detailsEn?: string;
  detailsAr?: string;
  measurementDate?: string;
}

export interface BoneSegment {
  id: string;
  nameEn: string;
  nameAr: string;
  regionEn: string;
  regionAr: string;
  boneCountLabelEn: string;
  boneCountLabelAr: string;
  focusTarget: [number, number, number];
  normalSosRange: string;
  anatomyDetailsEn: string;
  anatomyDetailsAr: string;
  microgravityRiskEn: string;
  microgravityRiskAr: string;
  sensorIds: string[];
  recommendedExerciseId: string;
  weaknessPercent: number | null;
  status: BoneStatus;
  sosMs: number | null;
  buaDbMhz: number | null;
  bmdGcm2: number | null;
  tScore: number | null;
  zScore: number | null;
  fractureRisk: string | null;
  colorHexOverride: string | null;
  detailsEn: string | null;
  detailsAr: string | null;
  measurementDate: string | null;
}

export interface SuitSensor {
  id: string;
  code: string;
  type: SensorType;
  nameEn: string;
  nameAr: string;
  zoneEn: string;
  zoneAr: string;
  purposeEn: string;
  purposeAr: string;
  samplingRateHz: number;
  position: [number, number, number];
  normal: [number, number, number];
  targetBoneIds: string[];
}

export interface EmgMuscleGroup {
  index: number;
  key: string;
  muscleGroup: string;
  nameAr: string;
  channels: number;
  boneIds: string[];
  basePos: [number, number, number];
  normal: [number, number, number];
}

export interface ExerciseProtocol {
  id: string;
  nameEn: string;
  nameAr: string;
  deviceEn: string;
  deviceAr: string;
  kinematicMode: 'squat' | 'heel_raise' | 'deadlift' | 'hip_abduction' | 'bicep_curl' | 'overhead_press';
  cadenceSec: number;
  sets: number;
  repsPerSet: number;
  defaultLoadKg: number;
  cuesEn: string[];
  cuesAr: string[];
  targetEmgIds: string[];
}

export interface ExerciseRecommendation {
  exerciseId: string;
  exerciseNameEn: string;
  exerciseNameAr: string;
  deviceEn: string;
  deviceAr: string;
  rationaleEn: string;
  rationaleAr: string;
  targetLoadKg: number;
  sets: number;
  reps: number;
  targetEmgSensors: SuitSensor[];
  source: 'local' | 'gemini';
}

export interface EmgChannelReading {
  sensorId: string;
  code: string;
  muscleGroup: string;
  nameAr: string;
  activationPercent: number;
  peakMicroVolts: number;
  thresholdMet: boolean;
}

export interface EmgEvaluationResult {
  isCorrect: boolean;
  emgScore: number;
  meanActivationPercent: number;
  bilateralSymmetryPercent: number;
  verdictEn: string;
  verdictAr: string;
  feedbackEn: string[];
  feedbackAr: string[];
  channelReadings: EmgChannelReading[];
}

export const BONE_DEFINITIONS: Omit<
  BoneSegment,
  | 'weaknessPercent'
  | 'status'
  | 'sosMs'
  | 'buaDbMhz'
  | 'bmdGcm2'
  | 'tScore'
  | 'zScore'
  | 'fractureRisk'
  | 'colorHexOverride'
  | 'detailsEn'
  | 'detailsAr'
  | 'measurementDate'
>[] = [
  {
    id: 'cranium',
    nameEn: 'Cranium & Mandible',
    nameAr: 'الجمجمة والفك السفلي',
    regionEn: 'Cephalic Vault',
    regionAr: 'الرأس',
    boneCountLabelEn: '22+6 cranial/auditory bones',
    boneCountLabelAr: '22+6 عظمة جمجمية',
    focusTarget: [0, 1.66, 0],
    normalSosRange: '1580–1635 m/s',
    anatomyDetailsEn: 'Dense cortical skull vault and mandible; exhibits mild cephalic fluid shift hypertrophy rather than resorption in orbit.',
    anatomyDetailsAr: 'قبو جمجمي قشري كثيف والفك السفلي؛ يظهر استقراراً عالياً نسبياً في انعدام الجاذبية.',
    microgravityRiskEn: 'Low trabecular loss; used as high-density baseline reference.',
    microgravityRiskAr: 'فقدان منخفض جداً؛ يُستخدم كمرجع أساسي للكثافة العالية.',
    sensorIds: ['qus-01'],
    recommendedExerciseId: 'ared-overhead-press',
  },
  {
    id: 'cervical-spine',
    nameEn: 'Cervical Spine (C1–C7)',
    nameAr: 'العمود الفقري العنقي (C1–C7)',
    regionEn: 'Neck Axis',
    regionAr: 'الرقبة',
    boneCountLabelEn: '7 cervical vertebrae',
    boneCountLabelAr: '7 فقرات عنقية',
    focusTarget: [0, 1.5, 0],
    normalSosRange: '1555–1610 m/s',
    anatomyDetailsEn: 'Seven articulating cervical vertebrae supporting cranial mass and spinal canal.',
    anatomyDetailsAr: 'سبع فقرات عنقية مفصلية تدعم الرأس والقناة الشوكية.',
    microgravityRiskEn: 'Spinal elongation (+3–5 cm) alters facet joint loading and paraspinal neck tone.',
    microgravityRiskAr: 'تمدد العمود الفقري يغير التحميل على المفاصل العنقية وتوتر العضلات.',
    sensorIds: ['qus-01', 'emg-cervical-r', 'emg-cervical-l'],
    recommendedExerciseId: 'ared-overhead-press',
  },
  {
    id: 'clavicle-scapula',
    nameEn: 'Clavicles & Scapulae',
    nameAr: 'الترقوة ولوح الكتف',
    regionEn: 'Shoulder Girdle',
    regionAr: 'حزام الكتف',
    boneCountLabelEn: '4 pectoral girdle bones',
    boneCountLabelAr: '4 عظام حزام الكتف',
    focusTarget: [0, 1.4, 0],
    normalSosRange: '1550–1605 m/s',
    anatomyDetailsEn: 'Bilateral S-curved clavicles and scapular blades anchoring upper-limb resistive motion.',
    anatomyDetailsAr: 'عظمتا الترقوة ولوحا الكتف اللتان تثبتان حركة الطرف العلوي.',
    microgravityRiskEn: 'Moderate loss if upper-body EVA restraint work decreases.',
    microgravityRiskAr: 'فقدان متوسط عند انخفاض تمارين المقاومة للجزء العلوي.',
    sensorIds: ['emg-deltoid-r', 'emg-deltoid-l', 'emg-pec-r', 'emg-pec-l'],
    recommendedExerciseId: 'ared-overhead-press',
  },
  {
    id: 'thoracic-cage',
    nameEn: 'Thoracic Spine (T1–T12), Ribs & Sternum',
    nameAr: 'القفص الصدري والفقرات الصدرية',
    regionEn: 'Thorax',
    regionAr: 'الصدر',
    boneCountLabelEn: '12 vertebrae + 24 ribs + sternum',
    boneCountLabelAr: '12 فقرة + 24 ضلعاً + القص',
    focusTarget: [0, 1.32, 0],
    normalSosRange: '1545–1600 m/s',
    anatomyDetailsEn: 'Protective costal cage housing cardiopulmonary organs and thoracic vertebral bodies.',
    anatomyDetailsAr: 'قفص ضلعي يحمي القلب والرئتين والفقرات الصدرية.',
    microgravityRiskEn: 'Gradual trabecular thinning under reduced axial gravity load.',
    microgravityRiskAr: 'ترقق تدريجي في التربيق العظمي بسبب غياب الحمل المحوري.',
    sensorIds: ['qus-01', 'emg-pec-r', 'emg-pec-l', 'emg-erector-r', 'emg-erector-l'],
    recommendedExerciseId: 'ared-deadlift',
  },
  {
    id: 'lumbar-spine',
    nameEn: 'Lumbar Spine (L1–L5)',
    nameAr: 'العمود الفقري القطني (L1–L5)',
    regionEn: 'Lower Back',
    regionAr: 'أسفل الظهر',
    boneCountLabelEn: '5 lumbar vertebrae',
    boneCountLabelAr: '5 فقرات قطنية',
    focusTarget: [0, 1.1, 0],
    normalSosRange: '1545–1595 m/s',
    anatomyDetailsEn: 'Primary axial weight-bearing vertebral column rich in metabolically active trabecular bone.',
    anatomyDetailsAr: 'العمود المحوري الرئيسي الحامل للوزن والغني بالعظم الإسفنجي.',
    microgravityRiskEn: 'High resorption (1.0–1.4%/month) in microgravity; elevates post-flight disc herniation risk.',
    microgravityRiskAr: 'معدل ارتشاف مرتفع (1.0–1.4% شهرياً) مما يرفع خطر الانزلاق بعد العودة.',
    sensorIds: ['qus-02', 'emg-erector-r', 'emg-erector-l', 'emg-abs-r', 'emg-abs-l'],
    recommendedExerciseId: 'ared-deadlift',
  },
  {
    id: 'pelvis',
    nameEn: 'Pelvic Girdle (Ilium, Sacrum & Coccyx)',
    nameAr: 'عظام الحوض والعجز',
    regionEn: 'Pelvic Ring',
    regionAr: 'الحوض',
    boneCountLabelEn: '2 hip bones + sacrum + coccyx',
    boneCountLabelAr: 'عظمتا الورك + العجز + العصعص',
    focusTarget: [0, 0.94, 0],
    normalSosRange: '1540–1590 m/s',
    anatomyDetailsEn: 'Mechanical bridge transferring spinal axial compression to bilateral femoral heads.',
    anatomyDetailsAr: 'جسر ميكانيكي ينقل الضغط المحوري من العمود الفقري إلى عظمي الفخذ.',
    microgravityRiskEn: 'Accelerated acetabular and sacral mineral depletion without ground reaction forces.',
    microgravityRiskAr: 'استنزاف متسارع للمعادن في الحوض والعجز لغياب قوى رد فعل الأرض.',
    sensorIds: ['qus-02', 'emg-glute-r', 'emg-glute-l'],
    recommendedExerciseId: 'ared-hip-abduction',
  },
  {
    id: 'humerus-right',
    nameEn: 'Right Humerus',
    nameAr: 'عظم العضد الأيمن',
    regionEn: 'Right Upper Arm',
    regionAr: 'الذراع اليمنى',
    boneCountLabelEn: '1 long bone',
    boneCountLabelAr: 'عظمة طويلة واحدة',
    focusTarget: [-0.23, 1.27, 0],
    normalSosRange: '1560–1615 m/s',
    anatomyDetailsEn: 'Upper arm cortical shaft connecting glenohumeral head to elbow condyles.',
    anatomyDetailsAr: 'العظم الطويل للذراع العلوية الواصل بين الكتف والمرفق.',
    microgravityRiskEn: 'Preserved when crew performs upper-body push/pull resistance training.',
    microgravityRiskAr: 'يحافظ على كثافته مع التمارين المقاومة المنتظمة للذراعين.',
    sensorIds: ['emg-deltoid-r', 'emg-biceps-r'],
    recommendedExerciseId: 'ared-bicep-curl',
  },
  {
    id: 'humerus-left',
    nameEn: 'Left Humerus',
    nameAr: 'عظم العضد الأيسر',
    regionEn: 'Left Upper Arm',
    regionAr: 'الذراع اليسرى',
    boneCountLabelEn: '1 long bone',
    boneCountLabelAr: 'عظمة طويلة واحدة',
    focusTarget: [0.23, 1.27, 0],
    normalSosRange: '1560–1615 m/s',
    anatomyDetailsEn: 'Left humeral shaft stabilized by deltoid, biceps brachii, and triceps.',
    anatomyDetailsAr: 'عظم العضد الأيسر المدعوم بالعضلة الدالية وذات الرأسين.',
    microgravityRiskEn: 'Mild loss if asymmetrical dominant-arm station tasks occur.',
    microgravityRiskAr: 'فقدان طفيف في حال عدم تماثل المهام اليدوية.',
    sensorIds: ['emg-deltoid-l', 'emg-biceps-l'],
    recommendedExerciseId: 'ared-bicep-curl',
  },
  {
    id: 'radius-ulna-right',
    nameEn: 'Right Radius, Ulna & Hand',
    nameAr: 'الساعد واليد اليمنى',
    regionEn: 'Right Forearm',
    regionAr: 'الساعد الأيمن',
    boneCountLabelEn: '2 forearm + 27 hand bones',
    boneCountLabelAr: 'عظمتا الساعد + 27 عظمة باليد',
    focusTarget: [-0.26, 0.98, 0.02],
    normalSosRange: '1565–1620 m/s',
    anatomyDetailsEn: 'Distal radius is a standard non-weight-bearing QUS diagnostic site.',
    anatomyDetailsAr: 'الطرف البعيد للكعبرة موقع قياسي للفحص بالموجات فوق الصوتية.',
    microgravityRiskEn: 'Low decline (~0.3%/month) during active station hardware manipulation.',
    microgravityRiskAr: 'انخفاض بطيء نسبياً بفضل استخدام اليدين المستمر داخل المحطة.',
    sensorIds: ['qus-03', 'emg-biceps-r'],
    recommendedExerciseId: 'ared-bicep-curl',
  },
  {
    id: 'radius-ulna-left',
    nameEn: 'Left Radius, Ulna & Hand',
    nameAr: 'الساعد واليد اليسرى',
    regionEn: 'Left Forearm',
    regionAr: 'الساعد الأيسر',
    boneCountLabelEn: '2 forearm + 27 hand bones',
    boneCountLabelAr: 'عظمتا الساعد + 27 عظمة باليد',
    focusTarget: [0.26, 0.98, 0.02],
    normalSosRange: '1565–1620 m/s',
    anatomyDetailsEn: 'Left distal forearm and carpal-metacarpal gripping complex.',
    anatomyDetailsAr: 'الساعد الأيسر ومجمع عظام الرسغ واليد.',
    microgravityRiskEn: 'Mild demineralization in prolonged orbital stays.',
    microgravityRiskAr: 'نقص تمعدن طفيف في المهمات الطويلة.',
    sensorIds: ['emg-biceps-l'],
    recommendedExerciseId: 'ared-bicep-curl',
  },
  {
    id: 'femur-right',
    nameEn: 'Right Femur (Head, Neck & Shaft)',
    nameAr: 'عظم الفخذ الأيمن (الرأس والعنق والجسم)',
    regionEn: 'Right Thigh',
    regionAr: 'الفخذ الأيمن',
    boneCountLabelEn: '1 primary femur',
    boneCountLabelAr: 'عظمة الفخذ الكبرى',
    focusTarget: [-0.11, 0.72, 0.01],
    normalSosRange: '1545–1600 m/s',
    anatomyDetailsEn: 'Largest weight-bearing bone; femoral neck trabeculae are mission-critical for hip fracture prevention.',
    anatomyDetailsAr: 'أكبر عظمة حاملة للوزن؛ عنق الفخذ هو الموقع الأهم لتقييم خطر الكسور.',
    microgravityRiskEn: 'Critical orbital hotspot: up to 1.5–2.0% BMD loss per month without heavy squats.',
    microgravityRiskAr: 'منطقة خطورة حرجة في الفضاء: فقدان يصل إلى 2% شهرياً بدون تمارين السكوات الثقيلة.',
    sensorIds: ['qus-04', 'emg-glute-r', 'emg-quad-r', 'emg-vastus-r', 'emg-bicepsfem-r', 'emg-semi-r'],
    recommendedExerciseId: 'ared-squat',
  },
  {
    id: 'femur-left',
    nameEn: 'Left Femur (Head, Neck & Shaft)',
    nameAr: 'عظم الفخذ الأيسر (الرأس والعنق والجسم)',
    regionEn: 'Left Thigh',
    regionAr: 'الفخذ الأيسر',
    boneCountLabelEn: '1 primary femur',
    boneCountLabelAr: 'عظمة الفخذ الكبرى',
    focusTarget: [0.11, 0.72, 0.01],
    normalSosRange: '1545–1600 m/s',
    anatomyDetailsEn: 'Left femoral neck and cortical diaphysis monitored for bilateral loading balance.',
    anatomyDetailsAr: 'عنق وجسم الفخذ الأيسر للمقارنة المتماثلة للتحميل الحركي.',
    microgravityRiskEn: 'Vulnerable to asymmetrical unloading if resistive stance favors dominant side.',
    microgravityRiskAr: 'عرضة لعدم تماثل التحميل إذا اعتمد الرائد على طرف واحد أثناء التمرين.',
    sensorIds: ['qus-05', 'emg-glute-l', 'emg-quad-l', 'emg-vastus-l', 'emg-bicepsfem-l', 'emg-semi-l'],
    recommendedExerciseId: 'ared-squat',
  },
  {
    id: 'patella-right',
    nameEn: 'Right Patella (Kneecap)',
    nameAr: 'الرضفة اليمنى (صابونة الركبة)',
    regionEn: 'Right Knee',
    regionAr: 'الركبة اليمنى',
    boneCountLabelEn: '1 sesamoid bone',
    boneCountLabelAr: 'عظمة سمسمانية',
    focusTarget: [-0.1, 0.5, 0.03],
    normalSosRange: '1540–1590 m/s',
    anatomyDetailsEn: 'Quadriceps tendon fulcrum enhancing knee extension torque.',
    anatomyDetailsAr: 'نقطة ارتكاز وتر العضلة الرباعية لتعزيز عزم مد الركبة.',
    microgravityRiskEn: 'Reflects quadriceps tendon disuse when knee flexion torque drops.',
    microgravityRiskAr: 'تتأثر بانخفاض شد العضلة الرباعية في انعدام الجاذبية.',
    sensorIds: ['emg-quad-r'],
    recommendedExerciseId: 'ared-squat',
  },
  {
    id: 'patella-left',
    nameEn: 'Left Patella (Kneecap)',
    nameAr: 'الرضفة اليسرى (صابونة الركبة)',
    regionEn: 'Left Knee',
    regionAr: 'الركبة اليسرى',
    boneCountLabelEn: '1 sesamoid bone',
    boneCountLabelAr: 'عظمة سمسمانية',
    focusTarget: [0.1, 0.5, 0.03],
    normalSosRange: '1540–1590 m/s',
    anatomyDetailsEn: 'Left sesamoid patellar tracking assembly under vastus lateralis load.',
    anatomyDetailsAr: 'الرضفة اليسرى تحت تأثير عضلات الفخذ الأمامية.',
    microgravityRiskEn: 'Moderate resorption accompanying quadriceps atrophy.',
    microgravityRiskAr: 'فقدان متوسط مصاحب لضمور عضلات الفخذ.',
    sensorIds: ['emg-quad-l'],
    recommendedExerciseId: 'ared-squat',
  },
  {
    id: 'tibia-right',
    nameEn: 'Right Tibia & Fibula',
    nameAr: 'الظنبوب والشظية اليمنى (الساق)',
    regionEn: 'Right Lower Leg',
    regionAr: 'الساق اليمنى',
    boneCountLabelEn: '2 lower-leg bones',
    boneCountLabelAr: 'عظمتا الساق',
    focusTarget: [-0.1, 0.3, 0.01],
    normalSosRange: '1550–1605 m/s',
    anatomyDetailsEn: 'Anterior-medial tibial cortex enables ultra-clean trans-tibial QUS speed-of-sound propagation.',
    anatomyDetailsAr: 'القشرة الأمامية للظنبوب تتيح قياساً دقيقاً جداً لسرعة الموجات فوق الصوتية.',
    microgravityRiskEn: 'Severe demineralization (1.5–1.8%/month) without high-impact heel-strike loading.',
    microgravityRiskAr: 'نقص تمعدن شديد لغياب صدمات المشي والجري على الأرض.',
    sensorIds: ['qus-06', 'emg-gastroc-r', 'emg-tibialis-r'],
    recommendedExerciseId: 'ared-calf-raise',
  },
  {
    id: 'tibia-left',
    nameEn: 'Left Tibia & Fibula',
    nameAr: 'الظنبوب والشظية اليسرى (الساق)',
    regionEn: 'Left Lower Leg',
    regionAr: 'الساق اليسرى',
    boneCountLabelEn: '2 lower-leg bones',
    boneCountLabelAr: 'عظمتا الساق',
    focusTarget: [0.1, 0.3, 0.01],
    normalSosRange: '1550–1605 m/s',
    anatomyDetailsEn: 'Left tibial shaft paired with medial gastrocnemius & tibialis anterior EMG patches.',
    anatomyDetailsAr: 'ساق اليسار المقترنة بحساسات عضلات السمانة ومقدمة الساق.',
    microgravityRiskEn: 'High cortical thinning risk on prolonged lunar/Mars transit.',
    microgravityRiskAr: 'خطر ترقق القشرة العظمية في المهمات الفضائية الطويلة.',
    sensorIds: ['qus-07', 'emg-gastroc-l', 'emg-tibialis-l'],
    recommendedExerciseId: 'ared-calf-raise',
  },
  {
    id: 'calcaneus-right',
    nameEn: 'Right Calcaneus & Foot',
    nameAr: 'عظم الكعب والقدم اليمنى',
    regionEn: 'Right Foot',
    regionAr: 'القدم اليمنى',
    boneCountLabelEn: '26 tarsal/metatarsal/phalangeal bones',
    boneCountLabelAr: '26 عظمة بالقدم والكعب',
    focusTarget: [-0.1, 0.08, 0.02],
    normalSosRange: '1535–1585 m/s',
    anatomyDetailsEn: '95% trabecular calcaneus serves as the gold-standard portable QUS sentinel site.',
    anatomyDetailsAr: 'عظم الكعب الإسفنجي (95%) يمثل المؤشر المبكر الذهبي لقياس الموجات فوق الصوتية.',
    microgravityRiskEn: 'Earliest and sharpest SOS/BUA deterioration in weightlessness.',
    microgravityRiskAr: 'أول وأسرع موقع يظهر تدهور الكثافة العظمية في انعدام الجاذبية.',
    sensorIds: ['qus-08', 'emg-gastroc-r', 'emg-tibialis-r'],
    recommendedExerciseId: 'ared-calf-raise',
  },
  {
    id: 'calcaneus-left',
    nameEn: 'Left Calcaneus & Foot',
    nameAr: 'عظم الكعب والقدم اليسرى',
    regionEn: 'Left Foot',
    regionAr: 'القدم اليسرى',
    boneCountLabelEn: '26 tarsal/metatarsal/phalangeal bones',
    boneCountLabelAr: '26 عظمة بالقدم والكعب',
    focusTarget: [0.1, 0.08, 0.02],
    normalSosRange: '1535–1585 m/s',
    anatomyDetailsEn: 'Left trabecular heel pad and forefoot plantar arch.',
    anatomyDetailsAr: 'الكعب الأيسر وقوس القدم الأخمصي.',
    microgravityRiskEn: 'Rapid trabecular loss when plantar ground forces are absent.',
    microgravityRiskAr: 'فقدان سريع للعظم الإسفنجي في غياب الضغط الأخمصي.',
    sensorIds: ['emg-gastroc-l', 'emg-tibialis-l'],
    recommendedExerciseId: 'ared-calf-raise',
  },
];

export const EMG_MUSCLE_GROUPS: EmgMuscleGroup[] = [
  {
    index: 1,
    key: 'quad',
    muscleGroup: 'Rectus Femoris',
    nameAr: 'الفخذ الأمامي',
    channels: 2,
    boneIds: ['femur-right', 'femur-left', 'patella-right', 'patella-left'],
    basePos: [0.105, 0.72, 0.072],
    normal: [0, 0, 1],
  },
  {
    index: 2,
    key: 'vastus',
    muscleGroup: 'Vastus Lateralis',
    nameAr: 'الفخذ الأمامي الوحشي',
    channels: 2,
    boneIds: ['femur-right', 'femur-left'],
    basePos: [0.155, 0.66, 0.028],
    normal: [1, 0, 0.3],
  },
  {
    index: 3,
    key: 'bicepsfem',
    muscleGroup: 'Biceps Femoris',
    nameAr: 'الفخذ الخلفي الوحشي',
    channels: 2,
    boneIds: ['femur-right', 'femur-left'],
    basePos: [0.135, 0.66, -0.068],
    normal: [0.3, 0, -1],
  },
  {
    index: 4,
    key: 'semi',
    muscleGroup: 'Semitendinosus',
    nameAr: 'الفخذ الخلفي الإنسي',
    channels: 2,
    boneIds: ['femur-right', 'femur-left'],
    basePos: [0.082, 0.65, -0.068],
    normal: [0, 0, -1],
  },
  {
    index: 5,
    key: 'gastroc',
    muscleGroup: 'Medial Gastrocnemius',
    nameAr: 'السمانة الخلفية الداخلية',
    channels: 2,
    boneIds: ['tibia-right', 'tibia-left', 'calcaneus-right', 'calcaneus-left'],
    basePos: [0.095, 0.38, -0.06],
    normal: [0, 0, -1],
  },
  {
    index: 6,
    key: 'tibialis',
    muscleGroup: 'Tibialis Anterior',
    nameAr: 'مقدمة الساق',
    channels: 2,
    boneIds: ['tibia-right', 'tibia-left', 'calcaneus-right', 'calcaneus-left'],
    basePos: [0.112, 0.36, 0.056],
    normal: [0, 0, 1],
  },
  {
    index: 7,
    key: 'glute',
    muscleGroup: 'Gluteus Maximus',
    nameAr: 'منطقة الأرداف',
    channels: 2,
    boneIds: ['pelvis', 'femur-right', 'femur-left'],
    basePos: [0.13, 0.93, -0.082],
    normal: [0.2, 0, -1],
  },
  {
    index: 8,
    key: 'erector',
    muscleGroup: 'Lumbar Erector Spinae',
    nameAr: 'أسفل الظهر',
    channels: 2,
    boneIds: ['lumbar-spine', 'thoracic-cage'],
    basePos: [0.065, 1.15, -0.092],
    normal: [0, 0, -1],
  },
  {
    index: 9,
    key: 'deltoid',
    muscleGroup: 'Deltoid',
    nameAr: 'الكتف',
    channels: 2,
    boneIds: ['clavicle-scapula', 'humerus-right', 'humerus-left'],
    basePos: [0.23, 1.43, 0.02],
    normal: [1, 0.2, 0],
  },
  {
    index: 10,
    key: 'biceps',
    muscleGroup: 'Biceps Brachii',
    nameAr: 'الذراع الأمامية',
    channels: 2,
    boneIds: ['humerus-right', 'humerus-left', 'radius-ulna-right', 'radius-ulna-left'],
    basePos: [0.265, 1.24, 0.042],
    normal: [0.6, 0, 0.8],
  },
  {
    index: 11,
    key: 'abs',
    muscleGroup: 'Rectus Abdominis & Obliques',
    nameAr: 'البطن والجذع',
    channels: 2,
    boneIds: ['lumbar-spine', 'thoracic-cage'],
    basePos: [0.068, 1.13, 0.11],
    normal: [0, 0, 1],
  },
];

const QUS_PROBES: SuitSensor[] = [
  {
    id: 'qus-01',
    code: 'QUS-01',
    type: 'QUS',
    nameEn: 'Cervical / Thoracic Axial Ultrasound Array',
    nameAr: 'مصفوفة الموجات فوق الصوتية العنقية والصدرية',
    zoneEn: 'Upper Thorax & Cervical',
    zoneAr: 'الصدر العلوي والعنق',
    purposeEn: 'Captures axial acoustic velocity along T1–T12 and cervical facets.',
    purposeAr: 'يقيس سرعة الموجات الصوتية عبر الفقرات الصدرية والعنقية.',
    samplingRateHz: 2000,
    position: [0, 1.38, 0.115],
    normal: [0, 0, 1],
    targetBoneIds: ['thoracic-cage', 'cervical-spine', 'cranium'],
  },
  {
    id: 'qus-02',
    code: 'QUS-02',
    type: 'QUS',
    nameEn: 'Lumbar / Sacral Quantitative Ultrasound Probe',
    nameAr: 'حساس الموجات فوق الصوتية القطني والعجزي',
    zoneEn: 'Lumbar Spine (L1–L5)',
    zoneAr: 'أسفل الظهر والحوض',
    purposeEn: 'Monitors lumbar trabecular SOS and BUA attenuation.',
    purposeAr: 'يراقب سرعة الصوت والتوهين عريض النطاق في الفقرات القطنية.',
    samplingRateHz: 2000,
    position: [0, 1.04, 0.105],
    normal: [0, 0, 1],
    targetBoneIds: ['lumbar-spine', 'pelvis'],
  },
  {
    id: 'qus-03',
    code: 'QUS-03',
    type: 'QUS',
    nameEn: 'Right Distal Radius Ultrasound Transducer',
    nameAr: 'حساس الموجات فوق الصوتية للكعبرة اليمنى',
    zoneEn: 'Right Forearm Wrist Cuff',
    zoneAr: 'معصم الساعد الأيمن',
    purposeEn: 'Measures cortical distal radius density against orbital baseline.',
    purposeAr: 'يقيس كثافة الكعبرة البعيدة للمقارنة المرجعية.',
    samplingRateHz: 2500,
    position: [-0.355, 0.96, 0.04],
    normal: [-1, 0, 0.3],
    targetBoneIds: ['radius-ulna-right'],
  },
  {
    id: 'qus-04',
    code: 'QUS-04',
    type: 'QUS',
    nameEn: 'Right Femoral Trochanter Ultrasound Probe',
    nameAr: 'حساس الموجات فوق الصوتية لعنق الفخذ الأيمن',
    zoneEn: 'Right Greater Trochanter',
    zoneAr: 'الورك والفخذ الأيمن',
    purposeEn: 'Tracks high-risk femoral neck SOS & BUA loss during orbit.',
    purposeAr: 'يتتبع فقدان كثافة عنق الفخذ الأيمن بدقة عالية.',
    samplingRateHz: 2500,
    position: [-0.155, 0.86, 0.042],
    normal: [-1, 0, 0.25],
    targetBoneIds: ['femur-right'],
  },
  {
    id: 'qus-05',
    code: 'QUS-05',
    type: 'QUS',
    nameEn: 'Left Femoral Trochanter Ultrasound Probe',
    nameAr: 'حساس الموجات فوق الصوتية لعنق الفخذ الأيسر',
    zoneEn: 'Left Greater Trochanter',
    zoneAr: 'الورك والفخذ الأيسر',
    purposeEn: 'Paired left femoral neck QUS acoustic transducer.',
    purposeAr: 'حساس مقترن لعنق الفخذ الأيسر للمقارنة المتماثلة.',
    samplingRateHz: 2500,
    position: [0.155, 0.86, 0.042],
    normal: [1, 0, 0.25],
    targetBoneIds: ['femur-left'],
  },
  {
    id: 'qus-06',
    code: 'QUS-06',
    type: 'QUS',
    nameEn: 'Right Tibial Mid-Shaft Transducer',
    nameAr: 'حساس الموجات فوق الصوتية للظنبوب الأيمن',
    zoneEn: 'Right Anterior Tibia',
    zoneAr: 'الساق اليمنى',
    purposeEn: 'Quantifies cortical tibial shaft thickness and SOS.',
    purposeAr: 'يقيس سمك القشرة العظمية وسرعة الصوت في الساق اليمنى.',
    samplingRateHz: 2500,
    position: [-0.11, 0.34, 0.064],
    normal: [0, 0, 1],
    targetBoneIds: ['tibia-right'],
  },
  {
    id: 'qus-07',
    code: 'QUS-07',
    type: 'QUS',
    nameEn: 'Left Tibial Mid-Shaft Transducer',
    nameAr: 'حساس الموجات فوق الصوتية للظنبوب الأيسر',
    zoneEn: 'Left Anterior Tibia',
    zoneAr: 'الساق اليسرى',
    purposeEn: 'Quantifies cortical tibial shaft thickness on left leg.',
    purposeAr: 'يقيس سمك القشرة العظمية في الساق اليسرى.',
    samplingRateHz: 2500,
    position: [0.11, 0.34, 0.064],
    normal: [0, 0, 1],
    targetBoneIds: ['tibia-left'],
  },
  {
    id: 'qus-08',
    code: 'QUS-08',
    type: 'QUS',
    nameEn: 'Right Calcaneus Heel QUS Caliper',
    nameAr: 'حساس الموجات فوق الصوتية لعظم الكعب الأيمن',
    zoneEn: 'Right Heel / Calcaneus',
    zoneAr: 'الكعب الأيمن',
    purposeEn: 'Gold-standard trabecular BUA & SOS sentinel sensor.',
    purposeAr: 'المعيار الذهبي لقياس التوهين وسرعة الصوت في الكعب الإسفنجي.',
    samplingRateHz: 2500,
    position: [-0.11, 0.09, -0.05],
    normal: [-0.4, 0, -1],
    targetBoneIds: ['calcaneus-right'],
  },
];

const EMG_SENSORS: SuitSensor[] = EMG_MUSCLE_GROUPS.flatMap((g) => {
  const num = String(g.index).padStart(2, '0');
  const mapBones = (side: 'right' | 'left') =>
    g.boneIds.filter((id) =>
      side === 'right' ? !id.endsWith('-left') : !id.endsWith('-right'),
    );

  return [
    {
      id: `emg-${g.key}-r`,
      code: `EMG-${num}R`,
      type: 'EMG' as const,
      nameEn: `${g.muscleGroup} (Right Ch)`,
      nameAr: `${g.nameAr} (يمين)`,
      zoneEn: `Right ${g.muscleGroup}`,
      zoneAr: `${g.nameAr} - الجانب الأيمن`,
      purposeEn: `Bipolar surface EMG channel capturing right ${g.muscleGroup} µV recruitment during ARED loading.`,
      purposeAr: `قناة تخطيط عضلي سطحي تقيس نشاط ${g.nameAr} الأيمن بالميكروفولت.`,
      samplingRateHz: 1500,
      position: [-g.basePos[0], g.basePos[1], g.basePos[2]],
      normal: [-g.normal[0], g.normal[1], g.normal[2]],
      targetBoneIds: mapBones('right'),
    },
    {
      id: `emg-${g.key}-l`,
      code: `EMG-${num}L`,
      type: 'EMG' as const,
      nameEn: `${g.muscleGroup} (Left Ch)`,
      nameAr: `${g.nameAr} (يسار)`,
      zoneEn: `Left ${g.muscleGroup}`,
      zoneAr: `${g.nameAr} - الجانب الأيسر`,
      purposeEn: `Bipolar surface EMG channel capturing left ${g.muscleGroup} µV recruitment for bilateral symmetry check.`,
      purposeAr: `قناة تخطيط عضلي سطحي تقيس نشاط ${g.nameAr} الأيسر للتحقق من التماثل.`,
      samplingRateHz: 1500,
      position: [g.basePos[0], g.basePos[1], g.basePos[2]],
      normal: [g.normal[0], g.normal[1], g.normal[2]],
      targetBoneIds: mapBones('left'),
    },
  ];
});

export const SUIT_SENSORS: SuitSensor[] = [...QUS_PROBES, ...EMG_SENSORS];

export const SENSOR_TYPE_META: Record<SensorType, { colorHex: string; label: string }> = {
  QUS: { colorHex: '#22d3ee', label: 'Ultrasound QUS' },
  EMG: { colorHex: '#c084fc', label: 'Surface EMG' },
};

export function getSensorCountsByType(sensors: SuitSensor[]) {
  const qus = sensors.filter((s) => s.type === 'QUS').length;
  const emg = sensors.filter((s) => s.type === 'EMG').length;
  return {
    total: sensors.length,
    QUS: qus,
    EMG: emg,
    EMG_GROUPS: EMG_MUSCLE_GROUPS.length,
  };
}

export const EXERCISE_PROTOCOLS: Record<string, ExerciseProtocol> = {
  'ared-squat': {
    id: 'ared-squat',
    nameEn: 'ARED Resistive Back Squat',
    nameAr: 'تمرين السكوات المقاوم على جهاز ARED',
    deviceEn: 'ARED Resistive Exercise Device',
    deviceAr: 'جهاز التمرين المقاوم المتقدم (ARED)',
    kinematicMode: 'squat',
    cadenceSec: 3.2,
    sets: 4,
    repsPerSet: 8,
    defaultLoadKg: 93,
    cuesEn: [
      'Descend to 90° knee flexion so Rectus Femoris & Vastus Lateralis EMG channels reach >= 72%.',
      'Engage Gluteus Maximus evenly across Left & Right EMG channels (>= 85% symmetry).',
      'Drive upward through heels to stimulate femoral neck & acetabular remodeling.',
    ],
    cuesAr: [
      'انزل إلى زاوية 90° في الركبة حتى تصل قنوات EMG للفخذ الأمامي إلى >= 72%.',
      'اشرك عضلات الأرداف بالتساوي بين اليمين واليسار (تماثل >= 85%).',
      'ادفع للأعلى من الكعبين لتحفيز إعادة بناء عنق الفخذ.',
    ],
    targetEmgIds: [
      'emg-quad-r',
      'emg-quad-l',
      'emg-vastus-r',
      'emg-vastus-l',
      'emg-bicepsfem-r',
      'emg-bicepsfem-l',
      'emg-glute-r',
      'emg-glute-l',
    ],
  },
  'ared-calf-raise': {
    id: 'ared-calf-raise',
    nameEn: 'ARED Weighted Heel-Raise & Calcaneal Impact',
    nameAr: 'تمرين رفع الكعب المقاوم على جهاز ARED',
    deviceEn: 'ARED Footplate & Calcaneal Piston',
    deviceAr: 'لوح القدم ومكبس التحميل العقبي ARED',
    kinematicMode: 'heel_raise',
    cadenceSec: 2.6,
    sets: 4,
    repsPerSet: 12,
    defaultLoadKg: 78,
    cuesEn: [
      'Press smoothly onto plantar balls until Medial Gastrocnemius EMG spikes above 75%.',
      'Control eccentric descent over 2 seconds to load tibial cortex and calcaneal trabeculae.',
      'Maintain balanced R/L ankle tracking without eversion drift.',
    ],
    cuesAr: [
      'اضغط بسلاسة على مشط القدم حتى يتجاوز نشاط عضلة السمانة 75%.',
      'تحكم في الهبوط البطئ لمدة ثانيتين لتحميل الظنبوب وعظم الكعب.',
      'حافظ على توازن الكاحلين الأيمن والأيسر دون ميلان.',
    ],
    targetEmgIds: ['emg-gastroc-r', 'emg-gastroc-l', 'emg-tibialis-r', 'emg-tibialis-l'],
  },
  'ared-deadlift': {
    id: 'ared-deadlift',
    nameEn: 'ARED Axial Lumbar Hinge & Deadlift',
    nameAr: 'تمرين الرفعة الميتة المحوري للفقرات القطنية',
    deviceEn: 'ARED Main Bar & Harness',
    deviceAr: 'البار الرئيسي وحزام الظهر ARED',
    kinematicMode: 'deadlift',
    cadenceSec: 3.4,
    sets: 3,
    repsPerSet: 8,
    defaultLoadKg: 88,
    cuesEn: [
      'Keep neutral lumbar lordosis while firing Erector Spinae & Rectus Abdominis brace.',
      'Drive hips forward via Gluteus Maximus and Hamstring contraction.',
      'Avoid asymmetrical torso twist that drops R/L symmetry below 82%.',
    ],
    cuesAr: [
      'حافظ على استقامة الظهر القطني مع شد عضلات البطن وباسطة العمود الفقري.',
      'ادفع الوركين للأمام باستخدام عضلات الأرداف والفخذ الخلفي.',
      'تجنب التفاف الجذع للحفاظ على تماثل التخطيط العضلي فوق 82%.',
    ],
    targetEmgIds: [
      'emg-erector-r',
      'emg-erector-l',
      'emg-abs-r',
      'emg-abs-l',
      'emg-glute-r',
      'emg-glute-l',
      'emg-bicepsfem-r',
      'emg-bicepsfem-l',
    ],
  },
  'ared-hip-abduction': {
    id: 'ared-hip-abduction',
    nameEn: 'ARED Multi-Planar Hip Loading & Abduction',
    nameAr: 'تمرين تحميل الحوض وتبعيد الورك المقاوم',
    deviceEn: 'ARED Pelvis Tether Assembly',
    deviceAr: 'حزام الحوض والورك المقاوم ARED',
    kinematicMode: 'hip_abduction',
    cadenceSec: 2.8,
    sets: 3,
    repsPerSet: 10,
    defaultLoadKg: 52,
    cuesEn: [
      'Stabilize iliac crest with core bracing while abducting femoral shaft.',
      'Target Gluteus Maximus & Quadriceps co-activation across R/L channels.',
    ],
    cuesAr: [
      'ثبّت الحوض بشد عضلات البطن أثناء حركة تبعيد الفخذ.',
      'استهدف تنشيط عضلات الأرداف والفخذ بشكل متناظر.',
    ],
    targetEmgIds: ['emg-glute-r', 'emg-glute-l', 'emg-quad-r', 'emg-quad-l', 'emg-abs-r', 'emg-abs-l'],
  },
  'ared-bicep-curl': {
    id: 'ared-bicep-curl',
    nameEn: 'ARED Forearm & Humeral Resistive Curl',
    nameAr: 'تمرين ثني الساعد المقاوم للذراعين',
    deviceEn: 'ARED Cable & Handgrip Station',
    deviceAr: 'محطة كابلات ومقبض اليد ARED',
    kinematicMode: 'bicep_curl',
    cadenceSec: 2.4,
    sets: 3,
    repsPerSet: 12,
    defaultLoadKg: 34,
    cuesEn: [
      'Flex smoothly through full elbow range so Biceps Brachii EMG exceeds 72%.',
      'Keep deltoid stabilization tight against microgravity drift.',
    ],
    cuesAr: [
      'اثنِ المرفق بمدى كامل حتى يتجاوز نشاط العضلة ذات الرأسين 72%.',
      'ثبّت الكتف لتقليل اهتزاز الذراع في انعدام الجاذبية.',
    ],
    targetEmgIds: ['emg-biceps-r', 'emg-biceps-l', 'emg-deltoid-r', 'emg-deltoid-l'],
  },
  'ared-overhead-press': {
    id: 'ared-overhead-press',
    nameEn: 'ARED Axial Overhead Shoulder Press',
    nameAr: 'تمرين الضغط العلوي للكتفين والعمود العنقي',
    deviceEn: 'ARED Overhead Resistance Frame',
    deviceAr: 'إطار المقاومة العلوي ARED',
    kinematicMode: 'overhead_press',
    cadenceSec: 2.8,
    sets: 3,
    repsPerSet: 10,
    defaultLoadKg: 46,
    cuesEn: [
      'Press vertically overhead engaging Deltoid & Rectus Abdominis stabilization.',
      'Maintain even R/L shoulder drive without cervical strain.',
    ],
    cuesAr: [
      'ادفع عمودياً للأعلى مع إشراك عضلات الكتف والجذع.',
      'حافظ على تساوي الدفع بين الكتفين الأيمن والأيسر.',
    ],
    targetEmgIds: ['emg-deltoid-r', 'emg-deltoid-l', 'emg-biceps-r', 'emg-biceps-l', 'emg-abs-r', 'emg-abs-l'],
  },
};

export const SAMPLE_DATASET: BoneDatasetEntry[] = [
  { boneId: 'cranium', weaknessPercent: 10, sosMs: 1605, buaDbMhz: 82, bmdGcm2: 1.24, tScore: 0.2, zScore: 0.3, fractureRisk: 'Low', detailsEn: 'Baseline cortical integrity preserved.' },
  { boneId: 'cervical-spine', weaknessPercent: 14, sosMs: 1582, buaDbMhz: 75, bmdGcm2: 1.12, tScore: -0.2, zScore: 0.0, fractureRisk: 'Low' },
  { boneId: 'clavicle-scapula', weaknessPercent: 12, sosMs: 1588, buaDbMhz: 77, bmdGcm2: 1.09, tScore: -0.1, zScore: 0.1, fractureRisk: 'Low' },
  { boneId: 'thoracic-cage', weaknessPercent: 16, sosMs: 1572, buaDbMhz: 72, bmdGcm2: 1.04, tScore: -0.5, zScore: -0.2, fractureRisk: 'Low' },
  { boneId: 'lumbar-spine', weaknessPercent: 28, sosMs: 1532, buaDbMhz: 62, bmdGcm2: 0.89, tScore: -1.6, zScore: -1.2, fractureRisk: 'Moderate', detailsEn: 'Mild microgravity trabecular thinning L1–L5.' },
  { boneId: 'pelvis', weaknessPercent: 24, sosMs: 1545, buaDbMhz: 65, bmdGcm2: 0.92, tScore: -1.3, zScore: -1.0, fractureRisk: 'Moderate' },
  { boneId: 'humerus-right', weaknessPercent: 11, sosMs: 1595, buaDbMhz: 79, bmdGcm2: 1.15, tScore: 0.1, zScore: 0.2, fractureRisk: 'Low' },
  { boneId: 'humerus-left', weaknessPercent: 13, sosMs: 1590, buaDbMhz: 77, bmdGcm2: 1.13, tScore: 0.0, zScore: 0.1, fractureRisk: 'Low' },
  { boneId: 'radius-ulna-right', weaknessPercent: 9, sosMs: 1602, buaDbMhz: 81, bmdGcm2: 1.18, tScore: 0.2, zScore: 0.3, fractureRisk: 'Low' },
  { boneId: 'radius-ulna-left', weaknessPercent: 10, sosMs: 1598, buaDbMhz: 80, bmdGcm2: 1.17, tScore: 0.1, zScore: 0.2, fractureRisk: 'Low' },
  { boneId: 'femur-right', weaknessPercent: 55, sosMs: 1468, buaDbMhz: 44, bmdGcm2: 0.71, tScore: -2.7, zScore: -2.2, fractureRisk: 'High', detailsEn: 'Priority ARED squat intervention required.' },
  { boneId: 'femur-left', weaknessPercent: 15, sosMs: 1585, buaDbMhz: 78, bmdGcm2: 1.07, tScore: -0.4, zScore: -0.1, fractureRisk: 'Low' },
  { boneId: 'patella-right', weaknessPercent: 22, sosMs: 1551, buaDbMhz: 67, bmdGcm2: 0.95, tScore: -1.1, zScore: -0.8, fractureRisk: 'Moderate' },
  { boneId: 'patella-left', weaknessPercent: 14, sosMs: 1579, buaDbMhz: 74, bmdGcm2: 1.05, tScore: -0.3, zScore: -0.1, fractureRisk: 'Low' },
  { boneId: 'tibia-right', weaknessPercent: 32, sosMs: 1518, buaDbMhz: 59, bmdGcm2: 0.84, tScore: -1.8, zScore: -1.4, fractureRisk: 'Moderate' },
  { boneId: 'tibia-left', weaknessPercent: 21, sosMs: 1554, buaDbMhz: 68, bmdGcm2: 0.96, tScore: -1.0, zScore: -0.7, fractureRisk: 'Moderate' },
  { boneId: 'calcaneus-right', weaknessPercent: 58, sosMs: 1459, buaDbMhz: 41, bmdGcm2: 0.68, tScore: -2.9, zScore: -2.4, fractureRisk: 'High', detailsEn: 'Sharp trabecular calcaneal SOS decline.' },
  { boneId: 'calcaneus-left', weaknessPercent: 39, sosMs: 1498, buaDbMhz: 52, bmdGcm2: 0.78, tScore: -2.5, zScore: -2.0, fractureRisk: 'High' },
];

export function statusFromWeakness(weaknessPercent: number | null): BoneStatus {
  if (weaknessPercent === null || weaknessPercent === undefined || Number.isNaN(weaknessPercent)) {
    return 'unassessed';
  }
  const v = Math.max(0, Math.min(100, weaknessPercent));
  if (v < 18) return 'healthy';
  if (v < 38) return 'moderate';
  return 'critical';
}

export function resolveBoneColorHex(
  bone: Pick<BoneSegment, 'status' | 'colorHexOverride'>,
  palette: StatusColorPalette = DEFAULT_STATUS_COLORS,
): string {
  if (bone.colorHexOverride && /^#[0-9a-fA-F]{6}$/.test(bone.colorHexOverride)) {
    return bone.colorHexOverride.toUpperCase();
  }
  return (palette[bone.status] || palette.unassessed).toUpperCase();
}

export function applyDatasetToBones(entries: BoneDatasetEntry[]): BoneSegment[] {
  const byId = new Map<string, BoneDatasetEntry>();
  entries.forEach((e) => {
    if (e && e.boneId) byId.set(e.boneId, e);
  });

  return BONE_DEFINITIONS.map((def) => {
    const entry = byId.get(def.id);
    const weakness =
      entry && entry.weaknessPercent !== undefined && entry.weaknessPercent !== null && !Number.isNaN(Number(entry.weaknessPercent))
        ? Math.max(0, Math.min(100, Math.round(Number(entry.weaknessPercent))))
        : null;
    const status = statusFromWeakness(weakness);

    const sos =
      entry && entry.sosMs !== undefined && entry.sosMs !== null && !Number.isNaN(Number(entry.sosMs))
        ? Number(entry.sosMs)
        : weakness !== null
          ? Number((1625 - weakness * 2.85).toFixed(1))
          : null;
    const bua =
      entry && entry.buaDbMhz !== undefined && entry.buaDbMhz !== null && !Number.isNaN(Number(entry.buaDbMhz))
        ? Number(entry.buaDbMhz)
        : weakness !== null
          ? Number((86 - weakness * 0.74).toFixed(1))
          : null;
    const tScore =
      entry && entry.tScore !== undefined && entry.tScore !== null && !Number.isNaN(Number(entry.tScore))
        ? Number(entry.tScore)
        : weakness !== null
          ? Number((0.6 - weakness * 0.056).toFixed(2))
          : null;
    const zScore =
      entry && entry.zScore !== undefined && entry.zScore !== null && !Number.isNaN(Number(entry.zScore))
        ? Number(entry.zScore)
        : tScore !== null
          ? Number((tScore + 0.35).toFixed(2))
          : null;
    const bmd =
      entry && entry.bmdGcm2 !== undefined && entry.bmdGcm2 !== null && !Number.isNaN(Number(entry.bmdGcm2))
        ? Number(entry.bmdGcm2)
        : weakness !== null
          ? Number(Math.max(0.45, 1.32 - weakness * 0.011).toFixed(2))
          : null;
    const fractureRisk =
      entry?.fractureRisk ||
      (status === 'critical'
        ? 'High'
        : status === 'moderate'
          ? 'Moderate'
          : status === 'healthy'
            ? 'Low'
            : null);

    return {
      ...def,
      weaknessPercent: weakness,
      status,
      sosMs: sos,
      buaDbMhz: bua,
      bmdGcm2: bmd,
      tScore,
      zScore,
      fractureRisk,
      colorHexOverride: entry?.colorHex || null,
      detailsEn: entry?.detailsEn || null,
      detailsAr: entry?.detailsAr || null,
      measurementDate: entry?.measurementDate || (weakness !== null ? new Date().toISOString().slice(0, 10) : null),
    };
  });
}

export function upsertBoneWeaknessEntry(
  prev: BoneDatasetEntry[],
  boneId: string,
  weaknessPercent: number | null,
): BoneDatasetEntry[] {
  const existing = prev.find((e) => e.boneId === boneId);
  if (weaknessPercent === null) {
    if (!existing) return prev;
    const next = prev
      .map((e) => (e.boneId === boneId ? { ...e, weaknessPercent: null, sosMs: null, buaDbMhz: null, tScore: null, zScore: null, bmdGcm2: null } : e))
      .filter((e) => e.weaknessPercent !== null || Boolean(e.detailsEn || e.detailsAr));
    return next;
  }
  const clean = Math.max(0, Math.min(100, Math.round(weaknessPercent)));
  if (existing) {
    return prev.map((e) =>
      e.boneId === boneId
        ? {
            ...e,
            weaknessPercent: clean,
            sosMs: Number((1625 - clean * 2.85).toFixed(1)),
            buaDbMhz: Number((86 - clean * 0.74).toFixed(1)),
            tScore: Number((0.6 - clean * 0.056).toFixed(2)),
          }
        : e,
    );
  }
  return [
    ...prev,
    {
      boneId,
      weaknessPercent: clean,
      sosMs: Number((1625 - clean * 2.85).toFixed(1)),
      buaDbMhz: Number((86 - clean * 0.74).toFixed(1)),
      tScore: Number((0.6 - clean * 0.056).toFixed(2)),
    },
  ];
}

export function upsertBoneDetailsEntry(
  prev: BoneDatasetEntry[],
  boneId: string,
  patch: Partial<Omit<BoneDatasetEntry, 'boneId'>>,
): BoneDatasetEntry[] {
  const existing = prev.find((e) => e.boneId === boneId);
  if (existing) {
    return prev.map((e) => (e.boneId === boneId ? { ...e, ...patch } : e));
  }
  return [...prev, { boneId, ...patch }];
}

export function parseBoneDatasetInput(rawText: string): BoneDatasetEntry[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];
  const validIds = new Set(BONE_DEFINITIONS.map((b) => b.id));

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const results: BoneDatasetEntry[] = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const bid = String(item.boneId || item.id || '').trim();
      if (!validIds.has(bid)) continue;
      const wRaw = item.weaknessPercent ?? item.weakness;
      const w = wRaw !== undefined && wRaw !== null && !Number.isNaN(Number(wRaw))
        ? Math.max(0, Math.min(100, Math.round(Number(wRaw))))
        : null;
      results.push({
        boneId: bid,
        weaknessPercent: w,
        sosMs: item.sosMs ?? item.sos ?? null,
        buaDbMhz: item.buaDbMhz ?? item.bua ?? null,
        bmdGcm2: item.bmdGcm2 ?? item.bmd ?? null,
        tScore: item.tScore ?? null,
        zScore: item.zScore ?? null,
        fractureRisk: item.fractureRisk ?? undefined,
        colorHex: item.colorHex ?? undefined,
        detailsEn: item.detailsEn ?? item.details ?? undefined,
        detailsAr: item.detailsAr ?? undefined,
      });
    }
    return results;
  }

  const lines = trimmed.split(/\r?\n/);
  const results: BoneDatasetEntry[] = [];
  for (const line of lines) {
    const clean = line.trim();
    if (!clean || clean.toLowerCase().startsWith('boneid')) continue;
    const parts = clean.split(',').map((p) => p.trim());
    const bid = parts[0];
    if (!bid || !validIds.has(bid) || parts.length < 2) continue;
    const w = Number(parts[1]);
    if (Number.isNaN(w)) continue;
    const sos = parts[2] ? Number(parts[2]) : null;
    const bua = parts[3] ? Number(parts[3]) : null;
    const bmd = parts[4] ? Number(parts[4]) : null;
    const tScore = parts[5] ? Number(parts[5]) : null;
    const detailsEn = parts.slice(6).join(', ').trim() || undefined;
    results.push({
      boneId: bid,
      weaknessPercent: Math.max(0, Math.min(100, Math.round(w))),
      sosMs: sos !== null && !Number.isNaN(sos) ? sos : null,
      buaDbMhz: bua !== null && !Number.isNaN(bua) ? bua : null,
      bmdGcm2: bmd !== null && !Number.isNaN(bmd) ? bmd : null,
      tScore: tScore !== null && !Number.isNaN(tScore) ? tScore : null,
      detailsEn,
    });
  }
  return results;
}

export function serializeDatasetToCsv(entries: BoneDatasetEntry[]): string {
  const header = 'boneId,weaknessPercent,sosMs,buaDbMhz,bmdGcm2,tScore,detailsEn';
  const rows = entries.map((e) =>
    [
      e.boneId,
      e.weaknessPercent ?? '',
      e.sosMs ?? '',
      e.buaDbMhz ?? '',
      e.bmdGcm2 ?? '',
      e.tScore ?? '',
      e.detailsEn ? e.detailsEn.replace(/,/g, ';') : '',
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

export function buildFallbackRecommendation(bone: BoneSegment, astronautWeightKg: number): ExerciseRecommendation {
  const protocol = EXERCISE_PROTOCOLS[bone.recommendedExerciseId] || EXERCISE_PROTOCOLS['ared-squat'];
  const sensorObjs = protocol.targetEmgIds
    .map((id) => SUIT_SENSORS.find((s) => s.id === id))
    .filter((s): s is SuitSensor => Boolean(s));

  const factor = Math.max(0.75, Math.min(1.25, astronautWeightKg / 74));
  const intensityScale = bone.status === 'critical' ? 0.92 : bone.status === 'moderate' ? 1.0 : 1.05;
  const targetLoadKg = Math.round(protocol.defaultLoadKg * factor * intensityScale);

  const weaknessText = bone.weaknessPercent !== null ? `${bone.weaknessPercent}% weakness` : 'Dataset Pending';
  return {
    exerciseId: protocol.id,
    exerciseNameEn: protocol.nameEn,
    exerciseNameAr: protocol.nameAr,
    deviceEn: protocol.deviceEn,
    deviceAr: protocol.deviceAr,
    rationaleEn: `Targeted ${protocol.nameEn} strengthens ${bone.nameEn} (${weaknessText}) with continuous EMG muscle recruitment verification.`,
    rationaleAr: `يستهدف تمرين ${protocol.nameAr} تقوية ${bone.nameAr} مع التحقق المستمر عبر حساسات التخطيط العضلي EMG.`,
    targetLoadKg,
    sets: protocol.sets,
    reps: protocol.repsPerSet,
    targetEmgSensors: sensorObjs,
    source: 'local',
  };
}

export function buildSimulatedEmgAttempt(
  bone: BoneSegment,
  exerciseId: string,
  formQuality: FormQuality,
): EmgChannelReading[] {
  const protocol = EXERCISE_PROTOCOLS[exerciseId] || EXERCISE_PROTOCOLS['ared-squat'];
  return protocol.targetEmgIds
    .map((id, idx) => {
      const s = SUIT_SENSORS.find((x) => x.id === id);
      if (!s) return null;
      const isLeft = s.code.endsWith('L');
      const baseActivation = formQuality === 'optimal' ? 84 - (idx % 3) * 3 : isLeft ? 69 - (idx % 2) * 3 : 49 + (idx % 2) * 2;
      const peakUv = Math.round(baseActivation * 6.4);
      return {
        sensorId: s.id,
        code: s.code,
        muscleGroup: s.nameEn.replace(/\s*\([^)]*\)/, ''),
        nameAr: s.nameAr,
        activationPercent: baseActivation,
        peakMicroVolts: peakUv,
        thresholdMet: baseActivation >= 70,
      };
    })
    .filter((x): x is EmgChannelReading => Boolean(x));
}

export function evaluateEmgSession(channelReadings: EmgChannelReading[]): EmgEvaluationResult {
  if (channelReadings.length === 0) {
    return {
      isCorrect: false,
      emgScore: 0,
      meanActivationPercent: 0,
      bilateralSymmetryPercent: 0,
      verdictEn: 'No active EMG channels recorded.',
      verdictAr: 'لم يتم تسجيل أي قنوات EMG.',
      feedbackEn: ['Connect target suit channels and repeat set.'],
      feedbackAr: ['تحقق من اتصال الحساسات وأعد التمرين.'],
      channelReadings: [],
    };
  }

  const meanAct = Math.round(
    channelReadings.reduce((acc, r) => acc + r.activationPercent, 0) / channelReadings.length,
  );
  const rightCh = channelReadings.filter((r) => r.code.endsWith('R'));
  const leftCh = channelReadings.filter((r) => r.code.endsWith('L'));
  const avgR = rightCh.length ? rightCh.reduce((a, b) => a + b.activationPercent, 0) / rightCh.length : meanAct;
  const avgL = leftCh.length ? leftCh.reduce((a, b) => a + b.activationPercent, 0) / leftCh.length : meanAct;
  const symmetry = Math.max(0, Math.min(100, Math.round(100 - Math.abs(avgR - avgL) * 1.1)));
  const isCorrect = meanAct >= 72 && symmetry >= 85;
  const emgScore = Math.min(100, Math.round(meanAct * 0.65 + symmetry * 0.35));

  return {
    isCorrect,
    emgScore,
    meanActivationPercent: meanAct,
    bilateralSymmetryPercent: symmetry,
    verdictEn: isCorrect
      ? 'EMG Re-Inspection Passed — Exercise Performed Correctly'
      : 'EMG Re-Inspection Failed — Incorrect / Asymmetric Exercise Execution',
    verdictAr: isCorrect
      ? 'نجح فحص التخطيط العضلي — التمرين مُنفذ بالطريقة الصحيحة'
      : 'تنبيه EMG — تنفيذ التمرين غير متماثل أو غير كافٍ',
    feedbackEn: isCorrect
      ? [
          `Mean muscle recruitment reached ${meanAct}% (>= 72% threshold).`,
          `Bilateral R/L symmetry measured ${symmetry}%, generating optimal osteogenic strain.`,
          'Bone dataset colors remain fixed to your uploaded QUS dataset.',
        ]
      : [
          `Primary right-side activation dropped to ${Math.round(avgR)}% (below 70% osteogenic target).`,
          `Bilateral symmetry dropped to ${symmetry}% — deepen range of motion symmetrically.`,
          'Re-run set cleanly before logging completion.',
        ],
    feedbackAr: isCorrect
      ? [
          `بلغ متوسط التفعيل العضلي ${meanAct}% (أعلى من الحد الأدنى 72%).`,
          `التماثل الجانبي ${symmetry}% يولّد إجهاداً عظمياً مثالياً.`,
          'ألوان العظام تبقى ثابتة حسب بيانات الفحص الأصلية.',
        ]
      : [
          `انخفض التفعيل العضلي إلى ${Math.round(avgR)}% (أقل من الحد المطلوب 70%).`,
          `التماثل الجانبي ${symmetry}% — يرجى تصحيح المدى الحركي بتوازن.`,
        ],
    channelReadings,
  };
}

/**
 * Calibrated QUS Speed-of-Sound (SOS) + Broadband Ultrasound Attenuation (BUA)
 * bone-density classifier and T-score stiffness index calculator.
 */
export function evaluateQusMeasurement(sos: number, bua: number): {
  prediction: 'Normal' | 'Osteopenia' | 'Osteoporosis';
  confidence: number;
  tScore: number;
  recommendation: string;
} {
  // Clinical stiffness index approximation from SOS (m/s) and BUA (dB/MHz)
  const sosNorm = (sos - 1545) / 42;
  const buaNorm = (bua - 68) / 14;
  const tScore = Number(Math.max(-4.5, Math.min(2.2, sosNorm * 0.95 + buaNorm * 0.85 - 0.55)).toFixed(2));

  let prediction: 'Normal' | 'Osteopenia' | 'Osteoporosis';
  let recommendation: string;
  let margin: number;

  if (tScore > -1.0) {
    prediction = 'Normal';
    margin = Math.min(1, Math.abs(tScore - -1.0) / 1.2);
    recommendation =
      'Maintain nominal ARED resistive schedule (45 min/day), 1,200 mg/day elemental calcium, and 800 IU Vitamin D3.';
  } else if (tScore > -2.5) {
    prediction = 'Osteopenia';
    margin = Math.min(1, Math.min(Math.abs(tScore - -1.0), Math.abs(tScore - -2.5)) / 0.9);
    recommendation =
      'Increase ARED lower-body axial squat & deadlift loading by +15%, verify bilateral EMG symmetry >= 85%, and schedule follow-up QUS in 14 days.';
  } else {
    prediction = 'Osteoporosis';
    margin = Math.min(1, Math.abs(tScore - -2.5) / 1.1);
    recommendation =
      'Flag for immediate Flight Surgeon review: suspend high-impact EVA stress until calcaneal/femoral loading protocol stabilizes T-score above -2.5.';
  }

  const confidence = Number((0.86 + margin * 0.12).toFixed(4));
  return { prediction, confidence, tScore, recommendation };
}
