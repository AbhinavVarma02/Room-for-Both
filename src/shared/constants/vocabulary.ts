// Controlled vocabularies. We keep matching deterministic by comparing enumerated values,
// never free text, so a category exclusion or dealbreaker can be checked exactly.

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const FORMATS = ["popup", "shelf", "cohosted_event"] as const;
export type Format = (typeof FORMATS)[number];

export const FORMAT_LABELS: Record<Format, string> = {
  popup: "One-day pop-up",
  shelf: "Curated shelf placement",
  cohosted_event: "Co-hosted event",
};

export const SECTORS = [
  "beauty_personal_care",
  "food_beverage",
  "apparel_accessories",
  "home_lifestyle",
  "books_media",
  "wellness",
  "arts_crafts",
  "other",
] as const;
export type Sector = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  beauty_personal_care: "Beauty & personal care",
  food_beverage: "Food & beverage",
  apparel_accessories: "Apparel & accessories",
  home_lifestyle: "Home & lifestyle",
  books_media: "Books & media",
  wellness: "Wellness",
  arts_crafts: "Arts & crafts",
  other: "Other",
};

export const PRODUCT_CATEGORIES = [
  "skincare",
  "cosmetics",
  "fragrance",
  "candles_home_scent",
  "apparel",
  "jewelry_accessories",
  "books_print",
  "stationery",
  "home_decor",
  "ceramics_tableware",
  "packaged_food",
  "coffee_tea",
  "alcoholic_beverages",
  "nonalcoholic_beverages",
  "supplements",
  "cbd_hemp",
  "plants",
  "pet_goods",
  "toys_games",
  "art_prints",
  "tech_accessories",
  "vintage_resale",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  skincare: "Skincare",
  cosmetics: "Cosmetics",
  fragrance: "Fragrance",
  candles_home_scent: "Candles & home scent",
  apparel: "Apparel",
  jewelry_accessories: "Jewelry & accessories",
  books_print: "Books & print",
  stationery: "Stationery",
  home_decor: "Home décor",
  ceramics_tableware: "Ceramics & tableware",
  packaged_food: "Packaged food",
  coffee_tea: "Coffee & tea",
  alcoholic_beverages: "Alcoholic beverages",
  nonalcoholic_beverages: "Non-alcoholic beverages",
  supplements: "Supplements",
  cbd_hemp: "CBD & hemp",
  plants: "Plants",
  pet_goods: "Pet goods",
  toys_games: "Toys & games",
  art_prints: "Art & prints",
  tech_accessories: "Tech accessories",
  vintage_resale: "Vintage & resale",
};

export const OBJECTIVES = [
  "new_customers",
  "cultural_relevance",
  "product_trial",
  "community_building",
  "content_creation",
  "wholesale_lead",
] as const;
export type Objective = (typeof OBJECTIVES)[number];

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  new_customers: "Reach new customers",
  cultural_relevance: "Cultural relevance",
  product_trial: "Product trial",
  community_building: "Community building",
  content_creation: "Content creation",
  wholesale_lead: "Wholesale lead",
};

export const HOST_GOALS = [
  "partner_fee_income",
  "foot_traffic",
  "community_programming",
  "new_audience",
  "fresh_assortment",
] as const;
export type HostGoal = (typeof HOST_GOALS)[number];

export const HOST_GOAL_LABELS: Record<HostGoal, string> = {
  partner_fee_income: "Partner fee income",
  foot_traffic: "Foot traffic",
  community_programming: "Community programming",
  new_audience: "New audience",
  fresh_assortment: "Fresh assortment",
};

export const VENUE_CATEGORIES = [
  "bookstore",
  "cafe",
  "art_gallery",
  "clothing_boutique",
  "record_store",
  "yoga_studio",
  "plant_shop",
  "wine_bar",
  "gift_shop",
] as const;
export type VenueCategory = (typeof VENUE_CATEGORIES)[number];

// The label doubles as the text we send to Qloo's tag search; the tag ID itself is always
// resolved at runtime and never hardcoded.
export const VENUE_CATEGORY_LABELS: Record<VenueCategory, string> = {
  bookstore: "Bookstore",
  cafe: "Cafe",
  art_gallery: "Art gallery",
  clothing_boutique: "Clothing boutique",
  record_store: "Record store",
  yoga_studio: "Yoga studio",
  plant_shop: "Plant shop",
  wine_bar: "Wine bar",
  gift_shop: "Gift shop",
};

export const GUEST_DEALBREAKERS = ["alcohol_on_premises", "exclusivity_required"] as const;
export type GuestDealbreaker = (typeof GUEST_DEALBREAKERS)[number];

export const GUEST_DEALBREAKER_LABELS: Record<GuestDealbreaker, string> = {
  alcohol_on_premises: "No venues serving alcohol during the activation",
  exclusivity_required: "No exclusivity clauses",
};

export const GUEST_CRITERIA = ["lower_outlay", "fewer_guest_staff_hours", "more_customer_facing_hours"] as const;
export type GuestCriterion = (typeof GUEST_CRITERIA)[number];

export const HOST_CRITERIA = ["higher_fee", "fewer_host_staff_hours"] as const;
export type HostCriterion = (typeof HOST_CRITERIA)[number];

export const CRITERION_LABELS: Record<GuestCriterion | HostCriterion, string> = {
  lower_outlay: "Lower total outlay",
  fewer_guest_staff_hours: "Fewer guest staff hours",
  more_customer_facing_hours: "More customer-facing hours",
  higher_fee: "Higher partner fee",
  fewer_host_staff_hours: "Fewer host staff hours",
};

export const SEED_KINDS = [
  "brand",
  "artist",
  "book",
  "movie",
  "tv_show",
  "podcast",
  "person",
  "place",
  "destination",
  "videogame",
] as const;
export type SeedKind = (typeof SEED_KINDS)[number];

export const SEED_KIND_LABELS: Record<SeedKind, string> = {
  brand: "Brand",
  artist: "Music artist",
  book: "Book",
  movie: "Film",
  tv_show: "TV show",
  podcast: "Podcast",
  person: "Person",
  place: "Place",
  destination: "Destination",
  videogame: "Video game",
};

// Documented Qloo entity type URNs (docs.qloo.com, Insights API filter.type enum).
export const SEED_KIND_TO_QLOO_TYPE: Record<SeedKind, string> = {
  brand: "urn:entity:brand",
  artist: "urn:entity:artist",
  book: "urn:entity:book",
  movie: "urn:entity:movie",
  tv_show: "urn:entity:tv_show",
  podcast: "urn:entity:podcast",
  person: "urn:entity:person",
  place: "urn:entity:place",
  destination: "urn:entity:destination",
  videogame: "urn:entity:videogame",
};

/**
 * Which other cultural domain gives a natural collaboration theme for a venue category. The same
 * domain is queried from both sides (the guest's references and the venue's own Qloo entity), so the
 * two result lists can be compared item by item. Categories without an entry use taste tags.
 */
export const CROSS_DOMAIN_BY_VENUE: Partial<Record<VenueCategory, { type: string; title: string; noun: string }>> = {
  bookstore: { type: "urn:entity:book", title: "Co-curated reading list", noun: "books" },
  record_store: { type: "urn:entity:artist", title: "Listening session pairing", noun: "music artists" },
  cafe: { type: "urn:entity:podcast", title: "Conversation series pairing", noun: "podcasts" },
};
