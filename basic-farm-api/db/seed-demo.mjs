// Seeds realistic demo data (farms, farmer accounts, published listings,
// a few candidate contacts) through the real API — not raw SQL — so every
// row goes through the exact same validation/slug-generation the app uses
// for real users. Safe to run against any environment; each farmer email
// is unique per run (timestamp suffix) so re-running just adds more.
//
// Usage: API_BASE=https://ag.cleverapps.io/api node db/seed-demo.mjs

const API_BASE = process.env.API_BASE || "http://localhost:3000/api";
const RUN_ID = Date.now().toString(36);

async function api(method, path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function categoryIdBySlug(slug) {
  const { categories } = await api("GET", "/jobs/categories?locale=en");
  const cat = categories.find((c) => c.canonical_slug === slug);
  if (!cat) throw new Error(`Category not found: ${slug} — run seed-categories.sql first`);
  return cat.id;
}

const FARMS = [
  {
    farmer: { firstName: "Camille", lastName: "Dubois", email: `camille.dubois.${RUN_ID}@example.com` },
    farm: {
      name: "Ferme des Tilleuls", countryCode: "FR", farmType: "viticulture",
      locality: "Aix-en-Provence", region: "Provence-Alpes-Côte d'Azur",
      contactEmail: "contact@fermedestilleuls.example", contactPhone: "+33 4 42 00 00 00",
      description: "Petite exploitation viticole familiale en Provence.",
    },
    listings: [
      { title: "Vendangeur / vendangeuse", category: "grape-harvest", language: "fr",
        description: "Recherche vendangeurs pour la récolte de septembre, hébergement possible sur place.",
        durationValue: 3, durationUnit: "week" },
      { title: "Ouvrier agricole polyvalent", category: "general-farm-labor", language: "fr",
        description: "Tâches variées : entretien des vignes, taille, travaux de saison.",
        durationValue: 6, durationUnit: "month" },
    ],
  },
  {
    farmer: { firstName: "Lucía", lastName: "Fernández", email: `lucia.fernandez.${RUN_ID}@example.com` },
    farm: {
      name: "Granja El Rocío", countryCode: "ES", farmType: "orchard",
      locality: "Jaén", region: "Andalucía",
      contactEmail: "info@granjaelrocio.example", contactPhone: "+34 953 000 000",
      description: "Explotación de olivar y frutales en Andalucía.",
    },
    listings: [
      { title: "Recolector/a de aceituna", category: "olive-harvest", language: "es",
        description: "Se busca personal para la recolección de aceituna, campaña de otoño.",
        durationValue: 2, durationUnit: "month" },
      { title: "Recolector/a de fruta de temporada", category: "seasonal-fruit-picking", language: "es",
        description: "Recolección de fruta de hueso en verano, turno de mañana.",
        durationValue: 4, durationUnit: "week" },
    ],
  },
  {
    farmer: { firstName: "Giulia", lastName: "Bianchi", email: `giulia.bianchi.${RUN_ID}@example.com` },
    farm: {
      name: "Azienda Agricola Il Bosco", countryCode: "IT", farmType: "viticulture",
      locality: "Siena", region: "Toscana",
      contactEmail: "info@ilbosco.example", contactPhone: "+39 0577 000000",
      description: "Azienda vitivinicola a conduzione familiare in Toscana.",
    },
    listings: [
      { title: "Operaio/a per la vendemmia", category: "grape-harvest", language: "it",
        description: "Cerchiamo personale per la vendemmia, vitto e alloggio inclusi.",
        durationValue: 3, durationUnit: "week" },
      { title: "Lavoro agricolo generico", category: "general-farm-labor", language: "it",
        description: "Mansioni varie in vigna e in cantina durante la stagione.",
        durationValue: 5, durationUnit: "month" },
    ],
  },
  {
    farmer: { firstName: "Mariana", lastName: "Silva", email: `mariana.silva.${RUN_ID}@example.com` },
    farm: {
      name: "Quinta do Vale Verde", countryCode: "PT", farmType: "mixed",
      locality: "Peso da Régua", region: "Douro",
      contactEmail: "geral@valeverde.example", contactPhone: "+351 254 000 000",
      description: "Quinta familiar no Douro, vinha e horta.",
    },
    listings: [
      { title: "Trabalhador/a para a vindima", category: "grape-harvest", language: "pt",
        description: "Precisa-se de trabalhadores para a vindima, alojamento disponível.",
        durationValue: 3, durationUnit: "week" },
      { title: "Plantação de hortaliças", category: "vegetable-planting", language: "pt",
        description: "Apoio na plantação e colheita de hortaliças ao longo da época.",
        durationValue: 4, durationUnit: "month" },
    ],
  },
  {
    farmer: { firstName: "Sean", lastName: "Murphy", email: `sean.murphy.${RUN_ID}@example.com` },
    farm: {
      name: "Green Valley Orchards", countryCode: "IE", farmType: "orchard",
      locality: "Armagh", region: "Ulster",
      contactEmail: "hello@greenvalleyorchards.example", contactPhone: "+44 28 0000 0000",
      description: "Family-run apple orchard in Northern Ireland.",
    },
    listings: [
      { title: "Apple picker", category: "apple-picking", language: "en",
        description: "Seasonal apple pickers needed for the autumn harvest, on-site accommodation available.",
        durationValue: 6, durationUnit: "week" },
      { title: "Tractor driver", category: "tractor-driving", language: "en",
        description: "Experienced tractor driver needed for general orchard work, valid licence required.",
        durationValue: 4, durationUnit: "month" },
    ],
  },
  {
    farmer: { firstName: "Emma", lastName: "Wilson", email: `emma.wilson.${RUN_ID}@example.com` },
    farm: {
      name: "Hillside Dairy Farm", countryCode: "GB", farmType: "livestock",
      locality: "Yorkshire Dales", region: "Yorkshire",
      contactEmail: "info@hillsidedairy.example", contactPhone: "+44 1900 000 000",
      description: "Family dairy farm in the Yorkshire Dales.",
    },
    listings: [
      { title: "Dairy farm assistant", category: "dairy-farm-work", language: "en",
        description: "Assistant needed for milking and general dairy duties, experience preferred.",
        durationValue: 1, durationUnit: "season" },
      { title: "Livestock care worker", category: "livestock-care", language: "en",
        description: "General livestock care, feeding, and animal welfare checks.",
        durationValue: 6, durationUnit: "month" },
    ],
  },
];

async function main() {
  console.log(`Seeding demo data against ${API_BASE} ...`);
  let farmCount = 0;
  let listingCount = 0;
  const publishedSlugs = [];

  for (const entry of FARMS) {
    await api("POST", "/core/auth/register", { ...entry.farmer, password: "DemoFarmer2026!" });
    const { token: authToken } = await api("POST", "/core/auth/login", {
      email: entry.farmer.email, password: "DemoFarmer2026!",
    });

    const { farm } = await api("POST", "/core/farms", entry.farm, authToken);
    farmCount++;

    for (const l of entry.listings) {
      const categoryId = await categoryIdBySlug(l.category);
      const { listing } = await api("POST", "/jobs/listings", {
        farmId: farm.id, categoryId, title: l.title, description: l.description,
        language: l.language, durationValue: l.durationValue, durationUnit: l.durationUnit,
      }, authToken);
      await api("PATCH", `/jobs/listings/${listing.id}`, { status: "published" }, authToken);
      listingCount++;
      publishedSlugs.push(listing.slug);
    }
    console.log(`  + ${farm.name} (${entry.listings.length} listings)`);
  }

  // A couple of candidate contact-form submissions, so the farmer dashboard
  // has something to show in "Contacts received".
  for (const slug of publishedSlugs.slice(0, 3)) {
    const { listing } = await api("GET", `/jobs/listings/${slug}`);
    await api("POST", `/jobs/listings/${listing.id}/contacts`, {
      contactType: "contact_form", candidateEmail: `candidate.${RUN_ID}@example.com`,
      message: "Bonjour, je suis intéressé(e) par cette offre, pourriez-vous me recontacter ?",
    }).catch((e) => console.warn(`  ! contact submission skipped: ${e.message}`));
  }

  console.log(`Done. Farms: ${farmCount}, listings: ${listingCount} (all published).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
