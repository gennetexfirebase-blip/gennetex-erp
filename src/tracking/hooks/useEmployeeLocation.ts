import { useLiveEmployees } from './useLiveEmployees';
export function useEmployeeLocation(id: string | undefined, enabled: boolean) {
  const result = useLiveEmployees(enabled && !!id, id);
  return { point: result.employees.find(p => p.employee_id === id), error: result.error, loading: result.loading };
}
