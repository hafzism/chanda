'use client';

import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import {
  createEvaluationCase,
  deleteEvaluationCase,
  listEvaluationCases,
  listEvaluationRuns,
  runRetrievalEvaluation,
  type RetrievalEvaluationCase,
  type RetrievalEvaluationRun,
} from '../../lib/evaluations';
import { listKnowledge, type KnowledgeDocument } from '../../lib/knowledge';

export function RetrievalEvaluationPanel({
  canManage,
  workspaceId,
}: {
  canManage: boolean;
  workspaceId: string;
}) {
  const [cases, setCases] = useState<RetrievalEvaluationCase[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [runs, setRuns] = useState<RetrievalEvaluationRun[]>([]);
  const [question, setQuestion] = useState('');
  const [expectedDocumentId, setExpectedDocumentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const [nextCases, nextRuns, nextDocuments] = await Promise.all([
        listEvaluationCases(workspaceId),
        listEvaluationRuns(workspaceId),
        listKnowledge(workspaceId),
      ]);
      setCases(nextCases);
      setRuns(nextRuns);
      setDocuments(nextDocuments);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load retrieval evaluation.',
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => void load(), [load]);

  const eligibleDocuments = useMemo(
    () =>
      documents.filter(
        ({ isEnabled, status }) => isEnabled && status === 'ready',
      ),
    [documents],
  );
  const documentTitles = useMemo(
    () => new Map(documents.map(({ id, title }) => [id, title])),
    [documents],
  );
  const latestRun = runs[0];

  async function addCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || !expectedDocumentId) return;
    setSaving(true);
    setError(undefined);
    try {
      const created = await createEvaluationCase(workspaceId, {
        expectedDocumentId,
        question,
      });
      setCases((current) => [...current, created]);
      setQuestion('');
      setExpectedDocumentId('');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to add case.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeCase(caseId: string) {
    setError(undefined);
    try {
      await deleteEvaluationCase(workspaceId, caseId);
      setCases((current) => current.filter(({ id }) => id !== caseId));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to remove case.',
      );
    }
  }

  async function runSuite() {
    setRunning(true);
    setError(undefined);
    try {
      const run = await runRetrievalEvaluation(workspaceId);
      setRuns((current) => [run, ...current].slice(0, 10));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Evaluation failed.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="evaluation-panel">
      <header className="evaluation-header">
        <div>
          <span>Retrieval quality</span>
          <h2>Evidence benchmark</h2>
          <p>
            Test whether known support questions retrieve the expected source
            within the first five results.
          </p>
        </div>
        {canManage && (
          <button
            className="button primary-button"
            disabled={cases.length === 0 || running}
            onClick={() => void runSuite()}
            type="button"
          >
            {running ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <FlaskConical size={17} />
            )}
            {running ? 'Running cases…' : 'Run benchmark'}
          </button>
        )}
      </header>

      {error && (
        <div className="evaluation-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button aria-label="Reload evaluation" onClick={() => void load()}>
            <RefreshCw size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="evaluation-loading" aria-live="polite">
          <LoaderCircle className="spin" size={20} /> Loading benchmark…
        </div>
      ) : (
        <>
          {latestRun ? (
            <div className="evaluation-results">
              <div className="evaluation-score-grid">
                <Score
                  detail={`${latestRun.hitCount} of ${latestRun.caseCount} cases`}
                  label={`Hit@${latestRun.topK}`}
                  value={`${Math.round(latestRun.hitRate * 100)}%`}
                />
                <Score
                  detail="Rewards expected sources ranked nearer the top"
                  label="Mean reciprocal rank"
                  value={latestRun.meanReciprocalRank.toFixed(2)}
                />
                <Score
                  detail={`${latestRun.keywordOnlyCaseCount} keyword fallback`}
                  label="Hybrid coverage"
                  value={`${Math.round(
                    (latestRun.hybridCaseCount / latestRun.caseCount) * 100,
                  )}%`}
                />
              </div>
              <div className="evaluation-run-meta">
                Latest run {formatDate(latestRun.createdAt)} · Results are saved
                as an immutable snapshot.
              </div>
              <div className="evaluation-case-results">
                {latestRun.results.map((result) => (
                  <article key={result.id}>
                    {result.wasHit ? (
                      <CheckCircle2 className="evaluation-pass" size={19} />
                    ) : (
                      <AlertCircle className="evaluation-miss" size={19} />
                    )}
                    <div>
                      <strong>{result.question}</strong>
                      <span>
                        Expected: {result.expectedDocumentTitle} ·{' '}
                        {result.wasHit
                          ? `rank ${Math.round(1 / result.reciprocalRank)}`
                          : `not found in top ${latestRun.topK}`}
                      </span>
                      {!result.wasHit &&
                        result.retrievedDocumentIds.length > 0 && (
                          <small>
                            Retrieved:{' '}
                            {result.retrievedDocumentIds
                              .map(
                                (id) =>
                                  documentTitles.get(id) ?? 'Deleted source',
                              )
                              .join(', ')}
                          </small>
                        )}
                    </div>
                    <em>{result.retrievalMode}</em>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="evaluation-empty-result">
              <FlaskConical size={24} />
              <div>
                <strong>No benchmark run yet</strong>
                <p>
                  Add curated questions, then run them against live retrieval.
                </p>
              </div>
            </div>
          )}

          <div className="evaluation-suite">
            <div className="evaluation-suite-heading">
              <div>
                <span>Curated suite</span>
                <h3>Expected-source questions</h3>
              </div>
              <strong>{cases.length} / 20</strong>
            </div>

            {canManage && (
              <form
                className="evaluation-form"
                onSubmit={(event) => void addCase(event)}
              >
                <label>
                  <span>Customer question</span>
                  <input
                    maxLength={500}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="How long do I have to return an item?"
                    required
                    value={question}
                  />
                </label>
                <label>
                  <span>Expected source</span>
                  <select
                    onChange={(event) =>
                      setExpectedDocumentId(event.target.value)
                    }
                    required
                    value={expectedDocumentId}
                  >
                    <option value="">Choose an indexed source</option>
                    {eligibleDocuments.map(({ id, title }) => (
                      <option key={id} value={id}>
                        {title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button secondary-button"
                  disabled={saving || cases.length >= 20}
                  type="submit"
                >
                  {saving ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  Add case
                </button>
              </form>
            )}

            {eligibleDocuments.length === 0 && canManage && (
              <p className="evaluation-source-note">
                Add and finish indexing an enabled knowledge source before
                creating a benchmark case.
              </p>
            )}

            <div className="evaluation-cases">
              {cases.map((evaluationCase) => (
                <article key={evaluationCase.id}>
                  <div>
                    <strong>{evaluationCase.question}</strong>
                    <span>{evaluationCase.expectedDocumentTitle}</span>
                  </div>
                  {canManage && (
                    <button
                      aria-label={`Delete ${evaluationCase.question}`}
                      onClick={() => void removeCase(evaluationCase.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </article>
              ))}
              {cases.length === 0 && (
                <p className="evaluation-no-cases">
                  No curated questions yet. This suite stays empty until a
                  workspace owner or admin defines expected evidence.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Score({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
