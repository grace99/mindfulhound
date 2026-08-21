import { useQuery } from "@tanstack/react-query";
import { fetchReferenceValues, fetchSubtypes, type SubtypeRow } from "./reference";
import { isSupabaseConfigured } from "./supabase";

const options = { enabled: isSupabaseConfigured, staleTime: 10 * 60_000 } as const;

export function useCurrencies() {
  return useQuery<string[]>({
    queryKey: ["ref", "currency"],
    queryFn: () => fetchReferenceValues("currency"),
    ...options,
  });
}

export function useExpTypes() {
  return useQuery<string[]>({
    queryKey: ["ref", "exptyp"],
    queryFn: () => fetchReferenceValues("exp_type"),
    ...options,
  });
}

export function useLocations() {
  return useQuery<string[]>({
    queryKey: ["ref", "location"],
    queryFn: () => fetchReferenceValues("location"),
    ...options,
  });
}

export function useCountries() {
  return useQuery<string[]>({
    queryKey: ["ref", "country"],
    queryFn: () => fetchReferenceValues("country"),
    ...options,
  });
}

export function useSubtypes() {
  return useQuery<SubtypeRow[]>({
    queryKey: ["ref", "expsubtyp"],
    queryFn: fetchSubtypes,
    ...options,
  });
}
