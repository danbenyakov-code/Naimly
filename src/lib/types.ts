export type PlanId = "trial" | "basic" | "pro" | "premium";

export type SocialNetwork = "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "x" | "threads";

export type SocialLink = {
  network: SocialNetwork;
  url: string;
};

export type ServiceItem = {
  id: string;
  title: string;
  description: string;
  price?: string;
};

export type Testimonial = {
  id: string;
  name: string;
  text: string;
  rating: number;
};

export type CardFile = {
  id: string;
  title: string;
  url: string;
};

export type QuickActionType = "phone" | "whatsapp" | "email" | "website" | "waze" | "google_maps" | "save_contact" | "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube" | "calendar";

export type QuickAction = {
  id: string;
  type: QuickActionType;
  label: string;
  value: string;
};

export type SmartButtonAction = "url" | "phone" | "whatsapp" | "email" | "waze" | "google_maps" | "booking" | "image" | "menu";

export type SmartButton = {
  id: string;
  label: string;
  description: string;
  action: SmartButtonAction;
  value: string;
  imageUrl?: string;
};

export type CardWidgetType = "smart_buttons" | "services" | "gallery" | "video" | "testimonials" | "hours" | "files" | "contact_form";

export type CardWidget = {
  id: string;
  type: CardWidgetType;
  title: string;
  enabled: boolean;
};

export type ContactFormField = {
  id: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select" | "checkbox";
  required: boolean;
  options?: string[];
};

export type TrackingSettings = {
  googleAnalyticsId: string;
  googleTagManagerId: string;
  metaPixelId: string;
};

export type VCardSettings = {
  /** שם לתצוגה. כשריק — מורכב מפרטי ומשפחה. */
  fullName: string;
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  /** נייד — הטלפון הראשי בכרטיס איש הקשר. */
  phone: string;
  /** טלפון נוסף (קווי/משרד). */
  phoneSecondary: string;
  email: string;
  website: string;
  /** נשמר לתאימות. הכתובת המובנית היא cardAddress. */
  address: string;
  note: string;
  /** האם לצרף את הלוגו/תמונה לאיש הקשר. */
  includePhoto: boolean;
};

/** כתובת מובנית לניווט ולכרטיס איש הקשר. */
export type CardAddress = {
  country: string;
  city: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  note: string;
};

export type CardData = {
  id: string;
  userId: string;
  slug: string;
  businessName: string;
  ownerName: string;
  roleTitle: string;
  slogan: string;
  bio: string;
  ctaLabel: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  avatarUrl: string;
  coverUrl: string;
  logoUrl: string;
  logoShape: "circle" | "rounded" | "square";
  videoUrl: string;
  gallery: string[];
  files: CardFile[];
  primaryColor: string;
  accentColor: string;
  buttonColor: string;
  headingColor: string;
  bodyTextColor: string;
  /** מזהה מתוך src/lib/backgrounds.ts. נבדק מול הרישום בוולידציה. */
  backgroundPreset: string;
  template: "spotlight" | "clean" | "bold";
  isPublished: boolean;
  allowIndexing: boolean;
  seoTitle: string;
  seoDescription: string;
  socialImageUrl: string;
  areaServed: string;
  coverAlt: string;
  logoAlt: string;
  avatarAlt: string;
  socialLinks: SocialLink[];
  quickActions: QuickAction[];
  quickActionsLimit: 3 | 6 | 9;
  smartButtons: SmartButton[];
  widgets: CardWidget[];
  contactFormTitle: string;
  contactFormSuccessMessage: string;
  contactFormFields: ContactFormField[];
  galleryStyle: "grid" | "carousel";
  tracking: TrackingSettings;
  vcard: VCardSettings;
  /** כתובת מובנית. ממנה נבנים Waze, Maps וה-vCard. */
  cardAddress: CardAddress;
  services: ServiceItem[];
  testimonials: Testimonial[];
  businessHours: Array<{ day: string; hours: string }>;
  updatedAt: string;
};

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  interval: "month";
  description: string;
  badge?: string;
  features: string[];
  limits: { cards: number; galleryItems: number; analyticsDays: number; quickActions: 3 | 6 | 9; tracking: boolean };
};

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  role: "customer" | "admin";
  plan: PlanId;
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled";
  trialEndsAt?: string;
  demo: boolean;
};

export type AnalyticsSummary = {
  views: number;
  clicks: number;
  leads: number;
  contactSaves: number;
  conversionRate: number;
  daily: Array<{ date: string; views: number; clicks: number }>;
  actions: Array<{ label: string; value: number; percent: number }>;
};
