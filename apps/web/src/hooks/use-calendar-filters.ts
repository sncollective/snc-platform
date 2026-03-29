import { useState, useEffect, useCallback } from "react";

import { DEFAULT_EVENT_TYPE_LABELS } from "@snc/shared";

import { fetchEventTypes } from "../lib/calendar.js";
import { fetchProjects } from "../lib/project.js";
import { apiGet } from "../lib/fetch-utils.js";

// ── Public Types ──

export interface EventTypeOption {
  readonly value: string;
  readonly label: string;
}

export interface CreatorOption {
  readonly id: string;
  readonly name: string;
}

export interface ProjectOption {
  readonly id: string;
  readonly name: string;
}

export interface UseCalendarFiltersOptions {
  readonly creatorId?: string;
  readonly includeCreatorFilter?: boolean;
}

export interface UseCalendarFiltersReturn {
  readonly eventTypeFilter: string;
  readonly setEventTypeFilter: (value: string) => void;
  readonly creatorFilter: string;
  readonly handleCreatorChange: (value: string) => void;
  readonly projectFilter: string;
  readonly setProjectFilter: (value: string) => void;
  readonly eventTypeOptions: readonly EventTypeOption[];
  readonly creatorOptions: readonly CreatorOption[];
  readonly projectOptions: readonly ProjectOption[];
}

// ── Public API ──

/** Manage calendar filter state and filter option lists. */
export function useCalendarFilters(options: UseCalendarFiltersOptions = {}): UseCalendarFiltersReturn {
  const { creatorId, includeCreatorFilter = false } = options;

  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [creatorFilter, setCreatorFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");

  const [eventTypeOptions, setEventTypeOptions] = useState<EventTypeOption[]>([]);
  const [creatorOptions, setCreatorOptions] = useState<CreatorOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);

  // ── Fetch event types (once) ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchEventTypes();
        setEventTypeOptions(
          res.items.map((et) => ({ value: et.slug, label: et.label })),
        );
      } catch {
        // Fallback to default labels
        setEventTypeOptions(
          Object.entries(DEFAULT_EVENT_TYPE_LABELS).map(([slug, label]) => ({
            value: slug,
            label,
          })),
        );
      }
    };
    void load();
  }, []);

  // ── Fetch creator options (main page only, once) ──
  useEffect(() => {
    if (!includeCreatorFilter) return;

    const load = async () => {
      try {
        const res = await apiGet<{ items: { id: string; displayName: string }[] }>("/api/creators");
        setCreatorOptions(res.items.map((c) => ({ id: c.id, name: c.displayName })));
      } catch (e) {
        console.warn("Failed to load creator filter options", e instanceof Error ? e.message : String(e));
      }
    };
    void load();
  }, [includeCreatorFilter]);

  // ── Fetch project options (re-fetches when creator filter or creatorId changes) ──
  useEffect(() => {
    const effectiveCreator = creatorId ?? creatorFilter;
    const params: Record<string, string> = { completed: "false" };
    if (effectiveCreator) params.creatorId = effectiveCreator;

    const load = async () => {
      try {
        const res = await fetchProjects(params);
        setProjectOptions(res.items.map((p) => ({ id: p.id, name: p.name })));
      } catch (e) {
        console.warn("Failed to load project filter options", e instanceof Error ? e.message : String(e));
      }
    };
    void load();
  }, [creatorId, creatorFilter]);

  // ── Creator filter handler (resets project filter) ──
  const handleCreatorChange = useCallback((value: string) => {
    setCreatorFilter(value);
    setProjectFilter("");
  }, []);

  return {
    eventTypeFilter,
    setEventTypeFilter,
    creatorFilter,
    handleCreatorChange,
    projectFilter,
    setProjectFilter,
    eventTypeOptions,
    creatorOptions,
    projectOptions,
  };
}
