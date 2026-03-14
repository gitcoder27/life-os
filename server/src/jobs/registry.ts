export interface JobDefinition {
  name: string;
  schedule: string;
  description: string;
}

export function getRegisteredJobs(): JobDefinition[] {
  return [];
}
