import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";
import type { Service } from "@snc/shared";

import { useSession } from "../lib/auth.js";
import { fetchApiServer } from "../lib/api-server.js";
import { ServiceCard } from "../components/booking/service-card.js";
import { BookingForm } from "../components/booking/booking-form.js";
import listingStyles from "../styles/listing-page.module.css";
import styles from "./services.module.css";

export const Route = createFileRoute("/services")({
  loader: async (): Promise<Service[]> => {
    try {
      const data = (await fetchApiServer({
        data: "/api/services",
      })) as { services: Service[] };
      return data.services;
    } catch {
      return [];
    }
  },
  component: ServicesPage,
});

function ServicesPage(): React.ReactElement {
  const navigate = useNavigate();
  const session = useSession();

  const services = Route.useLoaderData();
  const [activeFormServiceId, setActiveFormServiceId] = useState<string | null>(null);
  const [successServiceId, setSuccessServiceId] = useState<string | null>(null);

  const handleRequestBooking = (serviceId: string) => {
    if (!session.data) {
      void navigate({ to: "/login" });
      return;
    }
    setSuccessServiceId(null);
    setActiveFormServiceId(serviceId);
  };

  const handleBookingSuccess = () => {
    setSuccessServiceId(activeFormServiceId);
    setActiveFormServiceId(null);
  };

  const handleBookingCancel = () => {
    setActiveFormServiceId(null);
  };

  return (
    <div className={styles.servicesPage}>
      <h1 className={listingStyles.heading}>Studio &amp; Label Services</h1>
      {services.length === 0 ? (
        <p className={listingStyles.status}>No services are currently available.</p>
      ) : (
        <div className={styles.serviceList}>
          {services.map((service) => (
            <div key={service.id} className={styles.serviceItem}>
              <ServiceCard
                service={service}
                onRequestBooking={handleRequestBooking}
              />
              {activeFormServiceId === service.id && (
                <div className={styles.formWrapper}>
                  <BookingForm
                    serviceId={service.id}
                    serviceName={service.name}
                    onSubmit={handleBookingSuccess}
                    onCancel={handleBookingCancel}
                  />
                </div>
              )}
              {successServiceId === service.id && (
                <div className={styles.successMessage} role="status">
                  Your booking request has been submitted. A cooperative member
                  will review it shortly.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
