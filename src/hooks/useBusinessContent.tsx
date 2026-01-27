import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BusinessService {
  id: string;
  icon: string;
  title: string;
  description: string;
  features: string[];
  display_order: number;
  is_active: boolean;
}

export interface BusinessBenefit {
  id: string;
  icon: string;
  title: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

export interface BusinessTestimonial {
  id: string;
  name: string;
  role: string;
  location: string;
  quote: string;
  rating: number;
  is_featured: boolean;
  is_active: boolean;
}

export const useBusinessServices = () => {
  return useQuery({
    queryKey: ["business-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_services")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as BusinessService[];
    },
  });
};

export const useBusinessBenefits = () => {
  return useQuery({
    queryKey: ["business-benefits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_benefits")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as BusinessBenefit[];
    },
  });
};

export const useBusinessTestimonials = () => {
  return useQuery({
    queryKey: ["business-testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_testimonials")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BusinessTestimonial[];
    },
  });
};
