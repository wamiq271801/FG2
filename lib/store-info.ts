/**
 * Static store/business information — not catalog data.
 * Single source of truth for address, contact and legal identity.
 */
export const storeInfo = {
  name: "Fusion Gadgets",
  legalName: "Fusion Gadgets",
  tagline:
    "Your trusted local store for electronics, home appliances, batteries & car accessories in Bahraich, UP.",
  founded: "2024",
  address: {
    line1: "Shop No. 3, K.B. Global Square",
    line2: "Bahraich",
    city: "Bahraich",
    state: "Uttar Pradesh",
    postcode: "271801",
    country: "India",
  },
  phone: "+91 88587 63010",
  whatsapp: "+91 88587 63010",
  email: "contact@fusiongadgets.in",
  supportEmail: "contact@fusiongadgets.in",
  hours: "Mon–Fri 9 AM–8 PM, Sat 10 AM–6 PM, Sun closed",
  gst: "",
  social: {
    instagram: "https://instagram.com/fusiongadgets",
    twitter: "https://twitter.com/fusiongadgets",
    youtube: "https://youtube.com/@fusiongadgets",
  },
  mapEmbed:
    "https://www.openstreetmap.org/export/embed.html?bbox=81.585%2C27.565%2C81.610%2C27.585&layer=mapnik&marker=27.5744%2C81.5989",
} as const;
