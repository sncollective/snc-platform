import { createFileRoute } from "@tanstack/react-router";
import type React from "react";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { SimulcastDestinationManager } from "../../components/simulcast/simulcast-destination-manager.js";
import { apiGet, apiMutate } from "../../lib/fetch-utils.js";
import listingStyles from "../../styles/listing-page.module.css";
import pageHeadingStyles from "../../styles/page-heading.module.css";

// ── Route ──

export const Route = createFileRoute("/admin/simulcast")({
  head: () => ({ meta: [{ title: "Simulcast — S/NC" }] }),
  errorComponent: RouteErrorBoundary,
  component: SimulcastPage,
});

// ── API Callbacks ──

const fetchDestinations = async () =>
  apiGet<{ destinations: import("@snc/shared").SimulcastDestination[] }>("/api/simulcast");

const createDestination = async (input: import("@snc/shared").CreateSimulcastDestination) =>
  apiMutate("/api/simulcast", { method: "POST", body: input });

const updateDestination = async (id: string, input: import("@snc/shared").UpdateSimulcastDestination) =>
  apiMutate(`/api/simulcast/${id}`, { method: "PATCH", body: input });

const deleteDestination = async (id: string) =>
  apiMutate(`/api/simulcast/${id}`, { method: "DELETE" });

// ── Component ──

function SimulcastPage(): React.ReactElement {
  return (
    <div>
      <div className={pageHeadingStyles.heading}>
        <h1 className={pageHeadingStyles.title}>Simulcast</h1>
        <p className={pageHeadingStyles.subtitle}>
          Manage external RTMP destinations for S/NC TV simulcasting.
        </p>
      </div>

      <div className={listingStyles.heading}>
        <SimulcastDestinationManager
          fetchDestinations={fetchDestinations}
          createDestination={createDestination}
          updateDestination={updateDestination}
          deleteDestination={deleteDestination}
          variant="table"
        />
      </div>
    </div>
  );
}
