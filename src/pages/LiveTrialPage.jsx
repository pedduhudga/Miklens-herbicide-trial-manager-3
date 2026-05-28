import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { initFirebase } from '../services/firebase.js';
import { fbGetById } from '../services/firebaseDB.js';

// ── helpers ──────────────────────────────────────────────────────────────────
function safeJson(str, def = []) {
  try { const v = JSON.parse(str); return v ?? def; } catch { return def; }
}
function fmtDate(d) {
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return d || '—';
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d || '—'; }
}
function calcWce(baseline, cover) {
  if (!baseline || baseline <= 0) return null;
  return Math.max(0, Math.min(100, ((baseline - cover) / baseline) * 100));
}

// ── Live Trial Page ───────────────────────────────────────────────────────────
export default function LiveTrialPage() {
  const { id } = useParams();
  const [trial, setTrial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) { setError('No trial ID in URL.'); setLoading(false); return; }

    // Try to load Firebase config from localStorage (set during app setup)
    let firebaseConfig = null;
    try {
      const saved = localStorage.getItem('appSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.firebaseConfig?.apiKey) firebaseConfig = parsed.firebaseConfig;
      }
    } catch { /* ignore */ }

    if (!firebaseConfig) {
      setError('Firebase not configured. Open the app, complete setup, then re-scan this QR.');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        initFirebase(firebaseConfig);
        const data = await fbGetById('trials', id);
        if (!data) throw new Error('Trial not found in database.');
        setTrial(data);
      } catch (e) {
        setError(e.message || 'Failed to load trial.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-emerald-700 font-semibold">Loading trial data…</p>
      </div>
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Could not load trial</h2>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    </div>
  );

  // ── Data ─────────────────────────────────────────────────────────────────
  const efficacy = safeJson(trial.EfficacyDataJSON, [])
    .sort((a, b) => (a.daa ?? 0) - (b.daa ?? 0));
  const photos = safeJson(trial.PhotoURLs, []);
  const aiData = safeJson(trial.AISummariesJSON, {});
  const baseline = parseFloat(efficacy[0]?.weedCover ?? 0) || 0;
  const latest = efficacy.length ? efficacy[efficacy.length - 1] : null;
  const finalWce = latest ? calcWce(baseline, parseFloat(latest.weedCover ?? 0)) : null;
  const isActive = trial.IsCompleted !== true && trial.IsCompleted !== 'true';

  // Per-trial field visibility — defaults all to true if not set
  const defaultShow = {
    showFormulationName: true, showInvestigatorName: true, showDate: true,
    showDosage: true, showLocation: true, showWeedSpecies: true,
    showReplication: true, showResult: true,
    showObservations: true, showPhotos: true, showAISummary: true,
  };
  const show = { ...defaultShow, ...safeJson(trial.LiveQRSettings, {}) };

  const statusColor = isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-6 text-white">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs bg-white/20 rounded-full px-3 py-0.5 font-semibold uppercase tracking-wide">
              Live Trial View
            </span>
            <span className={`text-xs rounded-full px-3 py-0.5 font-semibold ${isActive ? 'bg-emerald-400/40' : 'bg-white/20'}`}>
              {isActive ? 'Active' : 'Completed'}
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight mt-1">{trial.FormulationName || 'Unnamed Trial'}</h1>
          <p className="text-emerald-100 text-sm mt-1">
            {fmtDate(trial.Date)}{trial.Location ? ` · ${trial.Location}` : ''}
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* Trial Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Trial Details</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              ['Trial ID', trial.ID, true],
              ['Product', trial.FormulationName || '—', show.showFormulationName],
              ['Investigator', trial.InvestigatorName || '—', show.showInvestigatorName],
              ['Application Date', fmtDate(trial.Date), show.showDate],
              ['Dosage', trial.Dosage || '—', show.showDosage],
              ['Location', trial.Location || '—', show.showLocation],
              ['Target Weeds', trial.WeedSpecies || '—', show.showWeedSpecies],
              ['Replication', trial.Replication || '—', show.showReplication],
              ['Result', trial.Result || '—', show.showResult],
              ['Status', isActive ? 'Active' : 'Completed', true],
            ].filter(([, , visible]) => visible).map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-slate-400 font-semibold">{label}</p>
                <p className="text-slate-700 font-medium break-words">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Efficacy Summary */}
        {show.showObservations && efficacy.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Efficacy Summary</h2>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 font-semibold">Baseline Cover</p>
                <p className="text-2xl font-bold text-slate-800">{baseline}%</p>
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 font-semibold">Latest Cover</p>
                <p className="text-2xl font-bold text-slate-800">{latest?.weedCover ?? '—'}%</p>
              </div>
              <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 font-semibold">WCE</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {finalWce !== null ? `${finalWce.toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>

            {/* Observation timeline */}
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Observation Timeline</h3>
            <div className="space-y-2">
              {efficacy.map((obs, i) => {
                const cover = parseFloat(obs.weedCover ?? 0);
                const wce = i === 0 ? null : calcWce(baseline, cover);
                const species = (obs.weedDetails || []).map(w => w.species).filter(Boolean).join(', ');
                return (
                  <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
                    <div className="shrink-0 bg-teal-100 text-teal-700 rounded-lg px-2 py-1 text-xs font-bold">
                      DAA {obs.daa ?? 0}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-700 text-sm">{cover}% cover</span>
                        {wce !== null && (
                          <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
                            wce >= 80 ? 'bg-emerald-100 text-emerald-700' :
                            wce >= 50 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            WCE {wce.toFixed(1)}%
                          </span>
                        )}
                        {i === 0 && <span className="text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 font-semibold">Baseline</span>}
                      </div>
                      {species && <p className="text-xs text-slate-400 mt-0.5 truncate">{species}</p>}
                      {obs.notes && <p className="text-xs text-slate-400 mt-0.5 italic truncate">{obs.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Narrative */}
        {show.showAISummary && aiData.narrative && (
          <div className="bg-white rounded-2xl shadow-sm border border-violet-100 p-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span>🤖</span> AI Trial Narrative
            </h2>
            <p className="text-xs text-slate-400 mb-2">
              Generated {fmtDate(aiData.narrativeGeneratedAt)} · {aiData.narrativeObsCount} observations
            </p>
            <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans">
              {aiData.narrative}
            </pre>
          </div>
        )}

        {/* Photos */}
        {show.showPhotos && photos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Field Photos</h2>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((p, i) => {
                const src = p.url || p.fileData;
                if (!src) return null;
                return (
                  <div key={i} className="rounded-xl overflow-hidden border border-slate-100 aspect-square bg-slate-100">
                    <img
                      src={src}
                      alt={p.label || `Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {p.label && (
                      <p className="text-xs text-slate-500 text-center py-1 truncate px-1">{p.label}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 py-4">
          <p>Powered by <span className="font-semibold text-teal-600">Miklens Herbicide Trial Platform</span></p>
          <p className="mt-1">Trial ID: <span className="font-mono">{trial.ID}</span></p>
        </div>
      </div>
    </div>
  );
}
