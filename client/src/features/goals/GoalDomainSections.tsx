import type { GoalOverviewItem } from "../../shared/lib/api";
import { GoalCard } from "./GoalCard";

const domainDisplayNames: Record<string, string> = {
  health: "Vitalic Health",
  money: "Wealth Management",
  work_growth: "Professional Growth",
  home_admin: "Home & Life Admin",
  discipline: "Discipline & Focus",
  other: "General Pursuits",
};

const domainEmojis: Record<string, string> = {
  health: "♥",
  money: "💼",
  work_growth: "🧠",
  home_admin: "🏡",
  discipline: "🎯",
  other: "✦",
};

type DomainGroup = {
  domain: string;
  goals: GoalOverviewItem[];
};

function groupGoalsByDomain(goals: GoalOverviewItem[]): DomainGroup[] {
  const domainMap = new Map<string, GoalOverviewItem[]>();
  const domainOrder: string[] = [];

  for (const goal of goals) {
    const domain = goal.domain;
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
      domainOrder.push(domain);
    }
    domainMap.get(domain)!.push(goal);
  }

  return domainOrder.map((domain) => ({
    domain,
    goals: domainMap.get(domain)!,
  }));
}

export function GoalDomainSections({
  goals,
  selectedGoalId,
  onSelectGoal,
}: {
  goals: GoalOverviewItem[];
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
}) {
  const groups = groupGoalsByDomain(goals);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="ap-domain-sections stagger">
      {groups.map((group) => (
        <section key={group.domain} className="ap-domain-section">
          <div className="ap-domain-section__header">
            <h2 className="ap-domain-section__title">
              <span className="ap-domain-section__emoji">
                {domainEmojis[group.domain] ?? "✦"}
              </span>
              {domainDisplayNames[group.domain] ?? group.domain}
            </h2>
            <span className="ap-domain-section__count">
              {group.goals.length} Active {group.goals.length === 1 ? "Goal" : "Goals"}
            </span>
          </div>
          <div className="ap-domain-section__cards">
            {group.goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                selected={selectedGoalId === goal.id}
                onSelect={() => onSelectGoal(goal.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
