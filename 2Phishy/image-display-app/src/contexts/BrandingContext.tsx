import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { SystemSettings } from "../types";

const DEFAULT_BRANDING: SystemSettings = {
  system_name: "2Phishy",
  institution_name: "2Phishy",
  logo_url: "/logo1.png",
  login_subtitle: "Please enter your credentials to log in",
  register_subtitle: "Please fill in your details to register",
  privacy_summary:
    "2Phishy collects account details, gameplay progress, quiz answers, assessment results, reports, and related learning analytics for academic research and system evaluation.",
  consent_text:
    "I accept the Privacy Policy and agree to participate in this thesis study. I understand that my data will be used for academic purposes.",
};

interface BrandingContextValue {
  branding: SystemSettings;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem("phishySystemBranding");
    if (!saved) return DEFAULT_BRANDING;

    try {
      return { ...DEFAULT_BRANDING, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_BRANDING;
    }
  });

  const refreshBranding = async () => {
    try {
      const nextBranding = await api.getSystemSettings();
      const mergedBranding = { ...DEFAULT_BRANDING, ...nextBranding };
      setBranding(mergedBranding);
      localStorage.setItem("phishySystemBranding", JSON.stringify(mergedBranding));
    } catch (error) {
      console.warn("Failed to refresh system branding:", error);
    }
  };

  useEffect(() => {
    refreshBranding();
  }, []);

  const value = useMemo(() => ({ branding, refreshBranding }), [branding]);

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const value = useContext(BrandingContext);
  if (!value) {
    throw new Error("useBranding must be used inside BrandingProvider");
  }
  return value;
};
