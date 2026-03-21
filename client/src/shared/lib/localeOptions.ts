type SupportedValueKind = "currency" | "timeZone";

type SelectOption = {
  value: string;
  label: string;
};

const intlWithSupportedValues = Intl as typeof Intl & {
  supportedValuesOf?: (kind: SupportedValueKind) => string[];
};

function getSupportedValues(kind: SupportedValueKind) {
  return intlWithSupportedValues.supportedValuesOf?.(kind) ?? [];
}

function sortValues(values: Iterable<string>) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function buildOptions(values: string[], currentValue?: string) {
  const normalizedCurrentValue = currentValue?.trim();
  const uniqueValues = new Set(values);

  if (normalizedCurrentValue) {
    uniqueValues.add(normalizedCurrentValue);
  }

  return sortValues(uniqueValues).map<SelectOption>((value) => ({
    value,
    label: value,
  }));
}

const baseTimezoneValues = sortValues(new Set(["UTC", ...getSupportedValues("timeZone")]));
const baseCurrencyValues = sortValues(getSupportedValues("currency"));

export function getTimezoneOptions(currentValue?: string) {
  return buildOptions(baseTimezoneValues, currentValue);
}

export function getCurrencyOptions(currentValue?: string) {
  const normalizedCurrentValue = currentValue?.trim().toUpperCase();
  return buildOptions(baseCurrencyValues, normalizedCurrentValue);
}
