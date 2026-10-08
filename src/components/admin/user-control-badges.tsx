import { funnelStageLabel, funnelStageTone, planStateLabel, type FunnelStage, type PlanState, type StageTone } from "@/lib/user-control";

const toneClasses: Record<StageTone, string> = {
  slate: "bg-[#eef1f6] text-[#4a5871]",
  amber: "bg-[#fff4e6] text-[#9a5800]",
  sky: "bg-[#e8f4ff] text-[#1f5f9e]",
  violet: "bg-[#f0edff] text-[#5141b6]",
  green: "bg-[#e6f8f3] text-[#08735f]",
  red: "bg-[#fff0f2] text-[#b7293a]",
};

const planStateClasses: Record<PlanState, string> = {
  not_selected: "text-[#68758a]",
  pending_payment: "text-[#9a5800]",
  trial: "text-[#1f5f9e]",
  paying: "text-[#08735f]",
  expired: "text-[#b7293a]",
  locked: "text-[#b7293a]",
};

export function StageBadge({ stage }: { stage: FunnelStage }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${toneClasses[funnelStageTone[stage]]}`}>
      {funnelStageLabel[stage]}
    </span>
  );
}

export function PlanStateBadge({ state }: { state: PlanState }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold ${planStateClasses[state]}`}>
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {planStateLabel[state]}
    </span>
  );
}
