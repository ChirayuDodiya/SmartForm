/**
 * Local Semantic Vector Embedding & Cosine Similarity Engine.
 * Generates 128-dimensional dense semantic vectors locally on-device without network calls.
 */

export const EMBEDDING_DIMENSION = 128;

// Curated semantic concept clusters that anchor key dimensions
const CONCEPT_CLUSTERS: Record<string, number> = {
  // Cluster 0: Personal First Names & Given Names
  'first': 0, 'given': 0, 'forename': 0, 'fname': 0, 'firstname': 0,

  // Cluster 1: Surnames & Family Names
  'surname': 1, 'last': 1, 'family': 1, 'second': 1, 'lname': 1, 'lastname': 1, 'maiden': 1, 'patronymic': 1,

  // Cluster 2: Full Name, Person & Identity
  'name': 2, 'fullname': 2, 'complete': 2, 'legal': 2, 'person': 2, 'human': 2,
  'identity': 2, 'applicant': 2, 'candidate': 2, 'individual': 2, 'personal': 2,

  // Cluster 3: Email & Messaging
  'email': 3, 'mail': 3, 'electronic': 3, 'gmail': 3, 'inbox': 3, 'mailbox': 3,
  'correspondence': 3, 'newsletter': 3, 'outlook': 3, 'yahoo': 3,

  // Cluster 4: Phone & Telecom
  'phone': 4, 'mobile': 4, 'telephone': 4, 'cell': 4, 'cellular': 4,
  'sms': 4, 'tel': 4, 'whatsapp': 4, 'hotline': 4, 'dial': 4,

  // Cluster 5: Location & Address
  'address': 5, 'street': 5, 'city': 5, 'state': 5, 'zip': 5,
  'postal': 5, 'country': 5, 'residence': 5, 'apartment': 5, 'province': 5, 'location': 5,

  // Cluster 6: Job & Professional
  'job': 6, 'career': 6, 'employment': 6, 'employer': 6, 'position': 6,
  'experience': 6, 'role': 6, 'company': 6, 'salary': 6,

  // Cluster 7: Documents & Resume
  'resume': 7, 'cv': 7, 'portfolio': 7, 'transcript': 7, 'certificate': 7, 'diploma': 7, 'document': 7,

  // Cluster 8: Academic & Education
  'academic': 8, 'university': 8, 'college': 8, 'degree': 8, 'gpa': 8,
  'grade': 8, 'school': 8, 'graduation': 8, 'major': 8, 'education': 8, 'score': 8,

  // Cluster 9: Code Repository & Software Projects
  'repo': 9, 'repository': 9, 'project': 9, 'package': 9, 'branch': 9,
  'commit': 9, 'git': 9, 'software': 9, 'codebase': 9, 'version': 9,

  // Cluster 10: Database & Infrastructure Systems
  'database': 10, 'table': 10, 'schema': 10, 'column': 10, 'sql': 10,
  'server': 10, 'host': 10, 'hostname': 10, 'cluster': 10, 'endpoint': 10,

  // Cluster 11: Media, Music & Audio
  'song': 11, 'music': 11, 'playlist': 11, 'artist': 11, 'album': 11,
  'track': 11, 'spotify': 11, 'youtube': 11, 'video': 11, 'audio': 11,

  // Cluster 12: Web & Digital Presence Links
  'website': 12, 'url': 12, 'homepage': 12, 'domain': 12, 'blog': 12,
  'link': 12, 'social': 12, 'twitter': 12, 'handle': 12, 'linkedin': 12, 'github': 12
};

/**
 * 32-bit FNV-1a hash function for subword n-gram distribution.
 */
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Generates a normalized 128-dimensional dense vector embedding from a text string.
 */
export function generateEmbedding(text: string): number[] {
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);
  if (!text || !text.trim()) {
    return vector;
  }

  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return vector;

  const words = clean.split(' ').filter(w => w.length > 0);

  // 1. Concept Cluster Projection (dims 0..64: 13 clusters × 5 slots)
  for (const word of words) {
    let clusterId = CONCEPT_CLUSTERS[word];
    if (clusterId === undefined && word.endsWith('s') && CONCEPT_CLUSTERS[word.slice(0, -1)] !== undefined) {
      clusterId = CONCEPT_CLUSTERS[word.slice(0, -1)];
    }

    if (clusterId !== undefined) {
      const baseDim = clusterId * 5;
      vector[baseDim] += 4.0; // Primary anchor dimension for the entire semantic concept
      const subDim = baseDim + (fnv1a(word) % 4) + 1;
      vector[subDim] += 1.5; // Fine-grained variation within concept
    }
  }

  // 2. Subword Character 3-Gram Hashing (distributed across dims 65..127)
  const OPEN_DIM_START = 65;
  const OPEN_DIM_COUNT = 63;

  for (const word of words) {
    const padded = `^${word}$`;
    for (let i = 0; i <= padded.length - 3; i++) {
      const trigram = padded.substring(i, i + 3);
      const hash = fnv1a(trigram);
      const dim = OPEN_DIM_START + (hash % OPEN_DIM_COUNT);
      const sign = (hash & 0x80000000) === 0 ? 1 : -1;
      vector[dim] += sign * 0.5;
    }
  }

  // 3. Word-level hashing to distribute across remaining open dimensions
  for (const word of words) {
    const hash = fnv1a(word);
    const dim = OPEN_DIM_START + (hash % OPEN_DIM_COUNT);
    vector[dim] += 1.0;
  }

  // 4. L2 Normalization (unit length)
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    sumSq += vector[i] * vector[i];
  }

  const magnitude = Math.sqrt(sumSq);
  if (magnitude > 0) {
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      vector[i] = Number((vector[i] / magnitude).toFixed(6));
    }
  }

  return vector;
}

/**
 * Computes Cosine Similarity between two embedding vectors.
 * Returns a score between 0.0 (completely dissimilar) and 1.0 (identical).
 */
export function cosineSimilarity(vecA: number[] | undefined, vecB: number[] | undefined): number {
  if (!vecA || !vecB || vecA.length !== EMBEDDING_DIMENSION || vecB.length !== EMBEDDING_DIMENSION) {
    return 0;
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  if (denominator === 0) return 0;

  const similarity = dotProduct / denominator;
  return Math.max(0, Math.min(1, Number(similarity.toFixed(4))));
}
