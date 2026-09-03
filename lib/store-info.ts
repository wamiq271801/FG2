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
  /** Same hours as the string above / the Contact page table, structured for
   *  reuse (e.g. schema.org openingHoursSpecification). Sunday is closed and
   *  intentionally has no entry. */
  openingHours: [
    {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "20:00",
    },
    { days: ["Saturday"], opens: "10:00", closes: "18:00" },
  ],
  /** Store coordinates — same marker position as mapEmbed and the Contact
   *  page's OpenStreetMap link (27.5744, 81.5989). */
  geo: { latitude: "27.5744", longitude: "81.5989" },
  gst: "",
  social: {
    instagram: "https://instagram.com/fusiongadgets",
    twitter: "https://twitter.com/fusiongadgets",
    youtube: "https://youtube.com/@fusiongadgets",
  },
  mapEmbed:
    "https://www.openstreetmap.org/export/embed.html?bbox=81.585%2C27.565%2C81.610%2C27.585&layer=mapnik&marker=27.5744%2C81.5989",
} as const;
