import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "product" | "article";
  price?: number;
  currency?: string;
  availability?: "in stock" | "out of stock" | "preorder";
  brand?: string;
  category?: string;
}

const DEFAULT_TITLE = "VendX.space — The Future of Vending";
const DEFAULT_DESCRIPTION = "VendX — The Future of Vending";
const DEFAULT_IMAGE = "https://storage.googleapis.com/gpt-engineer-file-uploads/jmC80grCIAfqSg4OU9a3YuJAAmz2/social-images/social-1764551529104-ChatGPT Image Nov 30, 2025, 08_07_12 PM.png";

export const useSEO = ({
  title,
  description,
  image,
  url,
  type = "website",
  price,
  currency = "USD",
  availability,
  brand = "VendX",
  category,
}: SEOProps) => {
  useEffect(() => {
    const fullTitle = title ? `${title} | VendX Store` : DEFAULT_TITLE;
    const metaDescription = description || DEFAULT_DESCRIPTION;
    const metaImage = image || DEFAULT_IMAGE;
    const metaUrl = url || window.location.href;

    // Update document title
    document.title = fullTitle;

    // Helper to update or create meta tag
    const setMetaTag = (property: string, content: string, isName = false) => {
      const attribute = isName ? "name" : "property";
      let element = document.querySelector(`meta[${attribute}="${property}"]`);
      
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, property);
        document.head.appendChild(element);
      }
      
      element.setAttribute("content", content);
    };

    // Basic meta tags
    setMetaTag("description", metaDescription, true);

    // Open Graph tags
    setMetaTag("og:title", fullTitle);
    setMetaTag("og:description", metaDescription);
    setMetaTag("og:image", metaImage);
    setMetaTag("og:url", metaUrl);
    setMetaTag("og:type", type === "product" ? "product" : "website");
    setMetaTag("og:site_name", "VendX Store");

    // Twitter Card tags
    setMetaTag("twitter:card", "summary_large_image", true);
    setMetaTag("twitter:title", fullTitle, true);
    setMetaTag("twitter:description", metaDescription, true);
    setMetaTag("twitter:image", metaImage, true);
    setMetaTag("twitter:site", "@VendX", true);

    // Product-specific meta tags (Open Graph product)
    if (type === "product") {
      if (price !== undefined) {
        setMetaTag("product:price:amount", price.toFixed(2));
        setMetaTag("product:price:currency", currency);
        setMetaTag("og:price:amount", price.toFixed(2));
        setMetaTag("og:price:currency", currency);
      }
      
      if (availability) {
        setMetaTag("product:availability", availability);
      }
      
      if (brand) {
        setMetaTag("product:brand", brand);
      }
      
      if (category) {
        setMetaTag("product:category", category);
      }
    }

    // Cleanup function to reset to defaults when unmounting
    return () => {
      document.title = DEFAULT_TITLE;
      setMetaTag("description", DEFAULT_DESCRIPTION, true);
      setMetaTag("og:title", DEFAULT_TITLE);
      setMetaTag("og:description", DEFAULT_DESCRIPTION);
      setMetaTag("og:image", DEFAULT_IMAGE);
      setMetaTag("og:type", "website");
      setMetaTag("twitter:title", DEFAULT_TITLE, true);
      setMetaTag("twitter:description", DEFAULT_DESCRIPTION, true);
      setMetaTag("twitter:image", DEFAULT_IMAGE, true);
      
      // Remove product-specific tags
      const productTags = [
        "product:price:amount",
        "product:price:currency", 
        "og:price:amount",
        "og:price:currency",
        "product:availability",
        "product:brand",
        "product:category"
      ];
      
      productTags.forEach(tag => {
        const element = document.querySelector(`meta[property="${tag}"]`);
        if (element) {
          element.remove();
        }
      });
    };
  }, [title, description, image, url, type, price, currency, availability, brand, category]);
};

export default useSEO;
