import { describe, it, expect } from 'vitest';
import { generateEmbedding, cosineSimilarity, EMBEDDING_DIMENSION } from '../vector';
import { generateFieldMetadata, describeWebField } from '../ai';
import { matchField, isNonPersonalEntityField } from '../matcher';
import { PersonalField, FieldSignals } from '../../types';

function createSignals(overrides: Partial<FieldSignals>): FieldSignals {
  return {
    inputType: 'text',
    name: '',
    id: '',
    placeholder: '',
    labelText: '',
    ariaLabel: '',
    ariaLabelledBy: '',
    autocomplete: '',
    surroundingText: '',
    cleanNameKeyword: '',
    cleanIdKeyword: '',
    ...overrides
  };
}

describe('Local Vector Embedding Engine', () => {
  it('generates a 128-dimensional dense vector', () => {
    const vec = generateEmbedding("User's given first name for personal identification");
    expect(vec).toBeInstanceOf(Array);
    expect(vec.length).toBe(EMBEDDING_DIMENSION);
    expect(vec.every(n => typeof n === 'number' && !isNaN(n))).toBe(true);
  });

  it('normalizes vector to unit length (L2 norm ≈ 1.0)', () => {
    const vec = generateEmbedding("Candidate family surname for official job application records");
    const sumSq = vec.reduce((sum, v) => sum + v * v, 0);
    const norm = Math.sqrt(sumSq);
    expect(norm).toBeGreaterThan(0.98);
    expect(norm).toBeLessThan(1.02);
  });

  it('returns all zeros for empty or whitespace-only strings', () => {
    const emptyVec = generateEmbedding("");
    expect(emptyVec.every(v => v === 0)).toBe(true);

    const spaceVec = generateEmbedding("   ");
    expect(spaceVec.every(v => v === 0)).toBe(true);
  });

  it('is completely deterministic for identical inputs', () => {
    const text = "LinkedIn member profile URL for career networking";
    const vec1 = generateEmbedding(text);
    const vec2 = generateEmbedding(text);
    expect(vec1).toEqual(vec2);
  });

  it('handles punctuation, casing, and special characters gracefully', () => {
    const vecA = generateEmbedding("first-name (required)!");
    const vecB = generateEmbedding("first name required");
    const similarity = cosineSimilarity(vecA, vecB);
    expect(similarity).toBeGreaterThan(0.85);
  });
});

describe('Cosine Similarity', () => {
  it('computes 1.0 for identical vectors', () => {
    const vec = generateEmbedding("Personal telephone or mobile phone number");
    expect(cosineSimilarity(vec, vec)).toBe(1.0);
  });

  it('computes 0 for zero or undefined vectors', () => {
    const vec = generateEmbedding("Some field content");
    const zeroVec = new Array(EMBEDDING_DIMENSION).fill(0);

    expect(cosineSimilarity(vec, zeroVec)).toBe(0);
    expect(cosineSimilarity(undefined, vec)).toBe(0);
    expect(cosineSimilarity(vec, undefined)).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2])).toBe(0); // Mismatched dimension
  });

  it('is symmetric: cosineSimilarity(a, b) === cosineSimilarity(b, a)', () => {
    const vecA = generateEmbedding("Electronic mail address");
    const vecB = generateEmbedding("Email contact inbox");
    expect(cosineSimilarity(vecA, vecB)).toBe(cosineSimilarity(vecB, vecA));
  });
});

describe('Semantic Concept Separation', () => {
  it('yields high similarity for equivalent personal name concepts', () => {
    const firstNameDesc = generateEmbedding("Candidate's given first name for personal identification");
    const givenNameDesc = generateEmbedding("Forename or given first name of applicant");
    const sim = cosineSimilarity(firstNameDesc, givenNameDesc);

    expect(sim).toBeGreaterThanOrEqual(0.70);
  });

  it('strongly separates personal names from code repositories and projects', () => {
    const firstNameDesc = generateEmbedding("Candidate's given first name for personal identification and identity");
    const repoDesc = generateEmbedding("Git code repository, project name, or software package identifier");
    const sim = cosineSimilarity(firstNameDesc, repoDesc);

    // Must be well below the matching threshold (0.72)
    expect(sim).toBeLessThan(0.40);
  });

  it('strongly separates personal names from databases and infrastructure', () => {
    const surnameDesc = generateEmbedding("Candidate's family surname or last name for official records");
    const dbDesc = generateEmbedding("Database table, schema, backend host, or server infrastructure name");
    const sim = cosineSimilarity(surnameDesc, dbDesc);

    expect(sim).toBeLessThan(0.35);
  });

  it('strongly separates emails from entertainment/media tracks', () => {
    const emailDesc = generateEmbedding("Personal or business email address for contact and communications");
    const mediaDesc = generateEmbedding("Media title, playlist name, music track, or audio artist");
    const sim = cosineSimilarity(emailDesc, mediaDesc);

    expect(sim).toBeLessThan(0.35);
  });

  it('strongly separates phone numbers from code repositories', () => {
    const phoneDesc = generateEmbedding("Contact telephone or mobile phone number");
    const repoDesc = generateEmbedding("Git repository project package codebase branch");
    const sim = cosineSimilarity(phoneDesc, repoDesc);

    expect(sim).toBeLessThan(0.30);
  });
});

describe('AI Metadata and Web Field Describers', () => {
  it('generates accurate fallback metadata for common personal fields', async () => {
    const nameMeta = await generateFieldMetadata('First Name', 'Alex');
    expect(nameMeta.category).toBe('Personal');
    expect(nameMeta.description.toLowerCase()).toContain('first name');

    const githubMeta = await generateFieldMetadata('GitHub', 'https://github.com/alex');
    expect(githubMeta.category).toBe('Job Applications');
    expect(githubMeta.description.toLowerCase()).toContain('github');

    const gpaMeta = await generateFieldMetadata('GPA', '3.9');
    expect(gpaMeta.category).toBe('Academic');
    expect(gpaMeta.description.toLowerCase()).toContain('grade');
  });

  it('generates descriptive web field text from signals', async () => {
    const repoSignals = createSignals({
      name: 'repository[name]',
      id: 'repo-name-input',
      placeholder: 'my-awesome-project',
      labelText: 'Repository name',
      cleanNameKeyword: 'repository name',
      cleanIdKeyword: 'repo name input'
    });

    const repoDesc = await describeWebField(repoSignals);
    expect(repoDesc.toLowerCase()).toMatch(/repo|git|software|project/);

    const nameSignals = createSignals({
      name: 'candidate_forename',
      id: 'fname',
      placeholder: 'Enter forename',
      labelText: 'Given forename',
      cleanNameKeyword: 'forename',
      cleanIdKeyword: 'fname'
    });

    const nameDesc = await describeWebField(nameSignals);
    expect(nameDesc.toLowerCase()).toMatch(/first name|given name|name/);
  });
});

describe('Vector Matching in Matcher Engine', () => {
  const vaultFields: PersonalField[] = [
    {
      id: 'f1',
      key: 'First Name',
      category: 'Personal',
      description: "Candidate's given first name for personal identification and job application.",
      embedding: generateEmbedding("Candidate's given first name for personal identification and job application."),
      values: [{ id: 'v1', label: 'Primary', value: 'Alex', isDefault: true }],
      updatedAt: Date.now()
    },
    {
      id: 'f2',
      key: 'Surname',
      category: 'Personal',
      description: "Candidate's family surname or last name for official records.",
      embedding: generateEmbedding("Candidate's family surname or last name for official records."),
      values: [{ id: 'v2', label: 'Primary', value: 'Morgan', isDefault: true }],
      updatedAt: Date.now()
    },
    {
      id: 'f3',
      key: 'Email',
      category: 'Personal',
      description: "Personal or business email address for contact and communications.",
      embedding: generateEmbedding("Personal or business email address for contact and communications."),
      values: [{ id: 'v3', label: 'Primary', value: 'alex@example.com', isDefault: true }],
      updatedAt: Date.now()
    }
  ];

  it('correctly matches a web input with unfamiliar wording via vector embedding', () => {
    const signals = createSignals({
      name: 'applicant_forename_entry',
      id: 'app_given_fn',
      labelText: 'Applicant Forename',
      cleanNameKeyword: 'forename entry',
      cleanIdKeyword: 'given fn'
    });

    const match = matchField('test-field-1', signals, {
      fields: vaultFields,
      userAliases: []
    });

    expect(match).not.toBeNull();
    expect(match?.matchedCanonicalKey).toBe('First Name');
    expect(match?.candidates[0].value).toBe('Alex');
  });

  it('rejects matching Repository Name to First Name or Surname via non-personal guard and vector separation', () => {
    const repoSignals = createSignals({
      name: 'repository_name',
      id: 'repo-name',
      placeholder: 'e.g. smartform-extension',
      labelText: 'Repository name',
      cleanNameKeyword: 'repository name',
      cleanIdKeyword: 'repo name'
    });

    expect(isNonPersonalEntityField(repoSignals)).toBe(true);

    const match = matchField('test-repo-field', repoSignals, {
      fields: vaultFields,
      userAliases: []
    });

    // Should NEVER match "First Name" or "Surname"
    expect(match).toBeNull();
  });

  it('rejects matching Project or Database inputs to user names', () => {
    const dbSignals = createSignals({
      name: 'cluster_hostname',
      id: 'db_host',
      placeholder: 'cluster-node-01',
      labelText: 'Database Cluster Hostname',
      cleanNameKeyword: 'cluster hostname',
      cleanIdKeyword: 'db host'
    });

    const match = matchField('test-db-field', dbSignals, {
      fields: vaultFields,
      userAliases: []
    });

    expect(match).toBeNull();
  });
});
