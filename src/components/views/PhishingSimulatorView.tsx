import { CheckCircle2, MailPlus, ShieldCheck } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import type { AwarenessModule, PhishingCampaign } from '../../types/security';
import {
  calculateFunnelMetrics,
  validateCampaignInput,
  type CampaignDraftInput,
} from '../../utils/securityLogic';
import { PhishingFunnel3D } from '../scenes/PhishingFunnel3D';

interface PhishingSimulatorViewProps {
  campaigns: PhishingCampaign[];
  onLaunchCampaign: (campaign: PhishingCampaign) => void;
  modules: AwarenessModule[];
  onCompleteModule: (moduleId: string) => void;
  isSoftwareGl: boolean;
}

export function PhishingSimulatorView({
  campaigns,
  onLaunchCampaign,
  modules,
  onCompleteModule,
  isSoftwareGl,
}: PhishingSimulatorViewProps) {
  const [name, setName] = useState('');
  const [targetGroup, setTargetGroup] = useState('Engineering & DevOps');
  const [template, setTemplate] = useState('Urgent Identity Provider Re-Auth');
  const [recipientCount, setRecipientCount] = useState('150');
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CampaignDraftInput, string>>>({});
  const [launchFeedback, setLaunchFeedback] = useState<string | null>(null);

  const [activeModuleId, setActiveModuleId] = useState<string>(modules[1]?.id ?? modules[0].id);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<{ correct: boolean; message: string } | null>(null);

  const funnel = useMemo(() => calculateFunnelMetrics(campaigns), [campaigns]);
  const activeModule = modules.find((m) => m.id === activeModuleId) ?? modules[0];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLaunchFeedback(null);
    const parsedCount = Number(recipientCount);
    const validation = validateCampaignInput({
      name,
      targetGroup,
      template,
      recipientCount: parsedCount,
    });

    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setFormErrors({});
    const sent = Math.round(parsedCount);
    const opened = Math.round(sent * 0.68);
    const clicked = Math.max(2, Math.round(sent * 0.11));
    const reported = Math.round(sent * 0.48);

    const newCampaign: PhishingCampaign = {
      id: `camp-${Date.now()}`,
      name: name.trim(),
      targetGroup,
      template,
      sent,
      opened,
      clicked,
      reported,
      status: 'Active',
      launchedAt: '2026-11-17',
    };

    onLaunchCampaign(newCampaign);
    setName('');
    setLaunchFeedback(`Launched "${newCampaign.name}" to ${sent} sandbox recipients.`);
  };

  const handleCheckAnswer = () => {
    if (selectedChoice === null) return;
    const isCorrect = selectedChoice === activeModule.correctIndex;
    if (isCorrect) {
      onCompleteModule(activeModule.id);
      setQuizFeedback({
        correct: true,
        message: `Verified: ${activeModule.explanation}`,
      });
    } else {
      setQuizFeedback({
        correct: false,
        message: 'Incorrect mitigation choice. Review the scenario and try again.',
      });
    }
  };

  return (
    <section aria-labelledby="phishing-sim-heading" className="space-y-6">
      <div>
        <h1
          id="phishing-sim-heading"
          className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-slate-50"
        >
          Phishing Simulator & Awareness Training
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Build authorized security awareness simulations, analyze 3D delivery funnels, and complete response drills.
        </p>
      </div>

      {/* Split-Screen Campaign Builder (Left) + 3D Funnel Analytics (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Campaign Builder + Active Campaigns */}
        <div className="lg:col-span-6 flex flex-col gap-5 rounded-xl border border-slate-800/90 bg-[#0D1320] p-5">
          <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-slate-100">
            Simulation Campaign Builder
          </h2>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="camp-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Campaign Name
              </label>
              <input
                id="camp-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 OAuth Consent Audit"
                className="w-full rounded-lg border border-slate-700 bg-[#090D16] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
              />
              {formErrors.name && (
                <p role="alert" className="mt-1 text-xs text-[#EF4444]">
                  {formErrors.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="camp-group" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Target Cohort
                </label>
                <select
                  id="camp-group"
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#090D16] px-3 py-2 text-sm text-slate-100 focus:border-[#00F0FF] focus:outline-none"
                >
                  <option value="Engineering & DevOps">Engineering & DevOps</option>
                  <option value="Finance & Operations">Finance & Operations</option>
                  <option value="Security & IT Support">Security & IT Support</option>
                  <option value="Executive Leadership">Executive Leadership</option>
                </select>
              </div>

              <div>
                <label htmlFor="camp-count" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Recipient Count
                </label>
                <input
                  id="camp-count"
                  type="number"
                  min={5}
                  max={2500}
                  value={recipientCount}
                  onChange={(e) => setRecipientCount(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#090D16] px-3 py-2 text-sm font-mono text-slate-100 tabular-nums focus:border-[#00F0FF] focus:outline-none"
                />
                {formErrors.recipientCount && (
                  <p role="alert" className="mt-1 text-xs text-[#EF4444]">
                    {formErrors.recipientCount}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="camp-template" className="block text-xs font-medium text-slate-300 mb-1.5">
                Lure Scenario Template
              </label>
              <select
                id="camp-template"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#090D16] px-3 py-2 text-sm text-slate-100 focus:border-[#00F0FF] focus:outline-none"
              >
                <option value="Urgent Identity Provider Re-Auth">Urgent Identity Provider Re-Auth</option>
                <option value="PO Discrepancy Attachment">PO Discrepancy Attachment</option>
                <option value="OAuth Consent Scope Escalation">OAuth Consent Scope Escalation</option>
                <option value="MFA Push Recovery Prompt">MFA Push Recovery Prompt</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-[#00F0FF] px-4 py-2 text-sm font-semibold text-[#090D16] transition-colors hover:bg-[#38F5FF] whitespace-nowrap"
              >
                <MailPlus className="h-4 w-4" aria-hidden="true" />
                Launch Simulation
              </button>
              {launchFeedback && (
                <p className="text-xs font-medium text-[#10B981]" role="status">
                  {launchFeedback}
                </p>
              )}
            </div>
          </form>

          {/* Active Campaigns Summary Table */}
          <div className="border-t border-slate-800/80 pt-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-300">
              Recent Campaigns ({campaigns.length})
            </h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#090D16] px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100 truncate">{c.name}</p>
                    <p className="text-slate-400 truncate">
                      {c.targetGroup} · {c.template}
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <p className="text-[#00F0FF]">{c.sent} sent</p>
                    <p className="text-[#EF4444]">{c.clicked} clicked</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: 3D Conversion Funnel + Awareness Training Modules */}
        <div className="lg:col-span-6 flex flex-col gap-5 rounded-xl border border-slate-800/90 bg-[#0D1320] p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-slate-100">
                3D Phishing Delivery & Click Funnel
              </h2>
              <p className="text-xs text-slate-400">
                Aggregate conversion across {campaigns.length} simulated exercises
              </p>
            </div>
            <span className="font-mono text-xs text-slate-300 tabular-nums">
              {funnel.sent.toLocaleString()} Total Delivered
            </span>
          </div>

          <div className="h-[240px] w-full rounded-lg border border-slate-800/80 bg-[#0B101B]">
            <PhishingFunnel3D metrics={funnel} isSoftwareGl={isSoftwareGl} />
          </div>

          {/* 4-Metric Funnel Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-slate-800 bg-[#090D16] p-3">
              <p className="text-slate-400">Delivered</p>
              <p className="font-mono text-lg font-bold text-[#00F0FF] tabular-nums mt-0.5">
                {funnel.sent}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#090D16] p-3">
              <p className="text-slate-400">Opened</p>
              <p className="font-mono text-lg font-bold text-sky-300 tabular-nums mt-0.5">
                {funnel.openRatePct}%
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#090D16] p-3">
              <p className="text-slate-400">Reported</p>
              <p className="font-mono text-lg font-bold text-[#10B981] tabular-nums mt-0.5">
                {funnel.reportRatePct}%
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#090D16] p-3">
              <p className="text-slate-400">Clicked Lure</p>
              <p className="font-mono text-lg font-bold text-[#EF4444] tabular-nums mt-0.5">
                {funnel.clickRatePct}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Awareness Training Modules */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0D1320] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#10B981]" aria-hidden="true" />
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-slate-100">
              Interactive Awareness Training Modules
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {modules.filter((m) => m.completed).length} of {modules.length} modules completed
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Module Selector List */}
          <div className="lg:col-span-5 space-y-2">
            {modules.map((mod) => {
              const isSelected = mod.id === activeModule.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    setActiveModuleId(mod.id);
                    setSelectedChoice(null);
                    setQuizFeedback(null);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                      : 'border-slate-800 bg-[#090D16] hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{mod.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {mod.category} · {mod.durationMin} min
                    </p>
                  </div>
                  {mod.completed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#10B981] shrink-0">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Done
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-400 shrink-0">Start</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Training Assessment */}
          <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-[#090D16] p-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-[#00F0FF]">{activeModule.category}</p>
              <h3 className="text-sm font-semibold text-slate-100 mt-1">{activeModule.question}</h3>
            </div>

            <div className="space-y-2">
              {activeModule.options.map((opt, idx) => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                    selectedChoice === idx
                      ? 'border-[#00F0FF] bg-[#00F0FF]/10 text-slate-50'
                      : 'border-slate-800 bg-[#0D1320] text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name={`quiz-${activeModule.id}`}
                    checked={selectedChoice === idx}
                    onChange={() => setSelectedChoice(idx)}
                    className="accent-[#00F0FF]"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCheckAnswer}
                disabled={selectedChoice === null}
                className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#090D16] transition-colors hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-400 disabled:border disabled:border-slate-700 disabled:cursor-not-allowed"
              >
                Verify Mitigation Answer
              </button>

              {quizFeedback && (
                <p
                  role="status"
                  className={`text-xs font-medium ${
                    quizFeedback.correct ? 'text-[#10B981]' : 'text-[#EF4444]'
                  }`}
                >
                  {quizFeedback.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
