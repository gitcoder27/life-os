import {
  type RecurrenceDefinition,
  type RecurrenceRuleInput,
  type RecurringTaskCarryPolicy,
  formatFullRecurrenceSummary,
  formatCarryPolicyShort,
  isRecurring,
} from "../lib/recurrence";

type RecurrenceBadgeProps = {
  recurrence: RecurrenceDefinition | null | undefined;
  compact?: boolean;
};

export function RecurrenceBadge({ recurrence, compact = false }: RecurrenceBadgeProps) {
  if (!isRecurring(recurrence)) return null;

  const summary = formatFullRecurrenceSummary(recurrence!.rule);

  if (compact) {
    return (
      <span className="recurrence-badge recurrence-badge--compact" title={summary}>
        <span className="recurrence-badge__icon">↻</span>
      </span>
    );
  }

  return (
    <span className="recurrence-badge" title={summary}>
      <span className="recurrence-badge__icon">↻</span>
      <span className="recurrence-badge__text">{summary}</span>
    </span>
  );
}

type CarryPolicyBadgeProps = {
  policy: RecurringTaskCarryPolicy | null | undefined;
};

export function CarryPolicyBadge({ policy }: CarryPolicyBadgeProps) {
  if (!policy) return null;

  return (
    <span className="carry-policy-badge" title={`Carry policy: ${policy}`}>
      {formatCarryPolicyShort(policy)}
    </span>
  );
}

type RecurrenceInfoProps = {
  recurrence: RecurrenceDefinition | null | undefined;
  showCarryPolicy?: boolean;
};

export function RecurrenceInfo({ recurrence, showCarryPolicy = false }: RecurrenceInfoProps) {
  if (!isRecurring(recurrence)) return null;

  return (
    <span className="recurrence-info">
      <RecurrenceBadge recurrence={recurrence} />
      {showCarryPolicy && recurrence?.carryPolicy && (
        <CarryPolicyBadge policy={recurrence.carryPolicy} />
      )}
    </span>
  );
}
