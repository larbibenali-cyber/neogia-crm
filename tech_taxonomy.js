// Taxonomie de normalisation des environnements techniques Neogia CRM
// Chaque entrée : alias (normalisé) -> { name: nom canonique affiché, category: clé de catégorie }

const CATEGORY = {
  CLOUD: 'cloud',
  DATA_PLATFORMS: 'data_platforms',
  DATA_ENGINEERING: 'data_engineering',
  BI: 'business_intelligence',
  ETL: 'etl',
  IA: 'ia',
  DEVOPS: 'devops',
  LANGAGES: 'langages',
  AUTRE: 'autre',
};

// table [ [nom canonique, categorie, [alias...]] ]
const TAXONOMY = [
  // Cloud
  ['AWS', CATEGORY.CLOUD, ['AWS', 'AMAZON WEB SERVICES']],
  ['Azure', CATEGORY.CLOUD, ['AZURE', 'MICROSOFT AZURE', 'AZURE.', 'ASURE']],
  ['GCP', CATEGORY.CLOUD, ['GCP', 'GOOGLE CLOUD PLATFORM', 'GOOGLE GCP']],

  // Data Platforms
  ['Databricks', CATEGORY.DATA_PLATFORMS, ['DATABRICKS', 'DATABRICK', 'AZURE DATABRICKS']],
  ['Snowflake', CATEGORY.DATA_PLATFORMS, ['SNOWFLAKE']],
  ['BigQuery', CATEGORY.DATA_PLATFORMS, ['BIGQUERY', 'BIG QUERY']],
  ['Azure Synapse', CATEGORY.DATA_PLATFORMS, ['SYNAPSE', 'AZURE SYNAPSE']],
  ['Redshift', CATEGORY.DATA_PLATFORMS, ['REDSHIFT', 'ATHENA']],
  ['SAP HANA', CATEGORY.DATA_PLATFORMS, ['SAP HANA', 'HANA']],
  ['SAP BW', CATEGORY.DATA_PLATFORMS, ['SAP BW']],

  // Data Engineering
  ['Spark', CATEGORY.DATA_ENGINEERING, ['SPARK', 'SPARKS', 'PYSPARK']],
  ['Airflow', CATEGORY.DATA_ENGINEERING, ['AIRFLOW', 'AIR FLOW']],
  ['dbt', CATEGORY.DATA_ENGINEERING, ['DBT']],
  ['Kafka', CATEGORY.DATA_ENGINEERING, ['KAFKA']],
  ['Scala', CATEGORY.DATA_ENGINEERING, ['SCALA']],
  ['Hadoop', CATEGORY.DATA_ENGINEERING, ['HADOOP', 'BIG DATA']],
  ['NiFi', CATEGORY.DATA_ENGINEERING, ['NIFI']],
  ['Azure Data Factory', CATEGORY.DATA_ENGINEERING, ['AZURE DATA FACTORY', 'AZURE DATAFACTORY', 'ADF', 'DATAFACTORY']],
  ['SQL', CATEGORY.DATA_ENGINEERING, ['SQL', 'T-SQL', 'TSQL']],
  ['SQL Server', CATEGORY.DATA_ENGINEERING, ['SQL SERVER', 'SQL SERVER 2014']],
  ['PL/SQL', CATEGORY.DATA_ENGINEERING, ['PL/SQL', 'PLSQL']],
  ['Alteryx', CATEGORY.DATA_ENGINEERING, ['ALTERYX']],
  ['Oracle', CATEGORY.DATA_ENGINEERING, ['ORACLE']],
  ['Data Gouvernance', CATEGORY.DATA_ENGINEERING, ['DATAGOUVERNANCE', 'DATA GOUVERNANCE']],
  ['Data Quality', CATEGORY.DATA_ENGINEERING, ['DATA QUALITY']],

  // Business Intelligence
  ['Power BI', CATEGORY.BI, ['POWER BI', 'POWERBI', 'PBI', 'POWER BI DESKTOP', 'POWER BI SERVICES', 'POWER BI SERVICE']],
  ['Tableau', CATEGORY.BI, ['TABLEAU', 'TABLEAU SOFTWARE']],
  ['Qlik', CATEGORY.BI, ['QLIK', 'QLIKVIEW', 'QLIK VIEW', 'QLIKSENSE', 'QLIK SENSE', 'QLIKSENS', 'QILK', 'QLIKSENSE.']],
  ['MicroStrategy', CATEGORY.BI, ['MICROSTRATEGY', 'MICROSOTRATEGY']],
  ['Cognos', CATEGORY.BI, ['COGNOS']],
  ['Looker', CATEGORY.BI, ['LOOKER']],
  ['SAP BO', CATEGORY.BI, ['SAP BO', 'BO', 'SAP BI']],
  ['Microsoft BI', CATEGORY.BI, ['MICROSOFT BI', 'MSBI', 'MCROSOFT BI', 'MICROSOFT LEGACY', 'MSBI FABRICS']],
  ['SSRS', CATEGORY.BI, ['SSRS']],
  ['SSAS', CATEGORY.BI, ['SSAS', 'AAS', 'ANALYSIS SERVICES', 'ASURE ANALYSIS SERVICES']],
  ['Kibana', CATEGORY.BI, ['KIBANA']],

  // ETL
  ['Talend', CATEGORY.ETL, ['TALEND', 'TALEND DI', 'TALEND CLOUD', 'TALEND ESB', 'TALEND.']],
  ['Informatica', CATEGORY.ETL, ['INFORMATICA', 'INFORMATICA POWERCENTER', 'INFORMATICA CLOUD', 'INFORMATICA MDM', 'INFORMATICA IDQ', 'AB INITO', 'AB INITIO']],
  ['DataStage', CATEGORY.ETL, ['DATASTAGE', 'DATA STAGE PX']],
  ['SSIS', CATEGORY.ETL, ['SSIS']],
  ['ODI', CATEGORY.ETL, ['ODI']],
  ['Genio', CATEGORY.ETL, ['GENIO', 'OTIC GENIO']],
  ['SAP BODS', CATEGORY.ETL, ['BODS', 'SAP BODS']],
  ['MuleSoft', CATEGORY.ETL, ['MULESOFT']],

  // IA
  ['Dataiku', CATEGORY.IA, ['DATAIKU']],
  ['LLM', CATEGORY.IA, ['LLM', 'LLMS']],
  ['RAG', CATEGORY.IA, ['RAG']],
  ['Vertex AI', CATEGORY.IA, ['VERTEX AI', 'VERTEXAI']],
  ['Azure AI', CATEGORY.IA, ['AZURE AI']],
  ['MLOps', CATEGORY.IA, ['MLOPS']],
  ['IA / Machine Learning', CATEGORY.IA, ['IA', 'INTELLIGENCE ARTIFICIELLE', 'MACHINE LEARNING', 'ML']],
  ['LangGraph', CATEGORY.IA, ['LANGGRAPH']],
  ['ADK', CATEGORY.IA, ['ADK']],

  // DevOps
  ['Docker', CATEGORY.DEVOPS, ['DOCKER', 'DOCKERS']],
  ['Kubernetes', CATEGORY.DEVOPS, ['KUBERNETES', 'KUBENETES']],
  ['Terraform', CATEGORY.DEVOPS, ['TERRAFORM']],
  ['GitLab CI/CD', CATEGORY.DEVOPS, ['GITLAB', 'GITLAB CI/CD', 'CI.CD', 'CI/CD']],
  ['Ansible', CATEGORY.DEVOPS, ['ANSIBLE']],

  // Langages & frameworks
  ['Python', CATEGORY.LANGAGES, ['PYTHON', 'PYTON']],
  ['Java', CATEGORY.LANGAGES, ['JAVA']],
  ['JavaScript', CATEGORY.LANGAGES, ['JAVASCRIPT', 'JAVA SCRIPT']],
  ['R', CATEGORY.LANGAGES, ['R']],
  ['C#', CATEGORY.LANGAGES, ['C#']],
  ['PHP', CATEGORY.LANGAGES, ['PHP']],
  ['Django', CATEGORY.LANGAGES, ['DJANGO']],
  ['React', CATEGORY.LANGAGES, ['REACT']],
  ['Angular', CATEGORY.LANGAGES, ['ANGULAR']],
  ['.NET', CATEGORY.LANGAGES, ['DOTNET', '.NET']],
  ['Spring Boot', CATEGORY.LANGAGES, ['SPRING BOOT']],
  ['Salesforce', CATEGORY.LANGAGES, ['SALESFORCE']],
  ['MongoDB', CATEGORY.LANGAGES, ['MONGODB', 'MANGO DB']],
  ['Pandas', CATEGORY.LANGAGES, ['PANDAS', 'PANDA']],
  ['NumPy', CATEGORY.LANGAGES, ['NUMPY', 'NUMPHY']],
  ['SAS', CATEGORY.LANGAGES, ['SAS']],
];

const ALIAS_INDEX = new Map();
const CANONICAL_CATEGORY = new Map();
for (const [name, category, aliases] of TAXONOMY) {
  CANONICAL_CATEGORY.set(name, category);
  for (const alias of aliases) {
    ALIAS_INDEX.set(normalizeKey(alias), name);
  }
  ALIAS_INDEX.set(normalizeKey(name), name);
}

function normalizeKey(str) {
  return String(str)
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .replace(/[.'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Heuristique : ce token ressemble-t-il à une note/phrase plutôt qu'à un nom de technologie ?
const SENTENCE_MARKERS = /\b(demande|recherche|recherché|responsable|décide|décideurs|informé|indiqué|potentiel|projet|migration|équipe|equipe|semble|selon|environ|actuellement|bcp|beaucoup|congés|bonjour|cordialement|absent|rejoint|token|création|créatrice|valeur|idée|succès|initiative)\b/i;

function isProseLike(raw) {
  const t = String(raw).trim();
  if (!t) return true;
  if (/^\d+$/.test(t)) return true; // nombre seul
  if (t.length > 35) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 4) return true;
  if (/[:.]/.test(t) && words.length > 2) return true;
  if (SENTENCE_MARKERS.test(t)) return true;
  return false;
}

/**
 * Normalise un token brut d'environnement technique.
 * Retourne { name, category, custom, ignored } ou null si le token doit être ignoré (bruit / phrase).
 */
function normalizeTechToken(raw) {
  let t = String(raw).replace(/[()]/g, ' ').trim();
  t = t.replace(/^[-–•.]+/, '').trim();
  if (!t) return null;
  if (isProseLike(t)) return { ignored: true, raw: t };

  const key = normalizeKey(t);
  if (ALIAS_INDEX.has(key)) {
    const name = ALIAS_INDEX.get(key);
    return { name, category: CANONICAL_CATEGORY.get(name), custom: false, raw: t };
  }
  // Technologie non reconnue : on la conserve telle quelle (mise en forme "Title Case" légère)
  const cleaned = t.replace(/\s+/g, ' ').trim();
  const displayName = cleaned.length <= 5 ? cleaned.toUpperCase() : titleCase(cleaned);
  return { name: displayName, category: CATEGORY.AUTRE, custom: true, raw: t };
}

function titleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

module.exports = { normalizeTechToken, CATEGORY, TAXONOMY };
