-- Real reference data (job taxonomy), not test/fake data — safe for
-- production. Farmers pick these from a dropdown; they also drive the
-- generated category browse pages (one per locale x category).
-- Idempotent: safe to re-run, existing rows are left untouched.

INSERT INTO jobs.job_categories (label, slug) VALUES ('Apple picking', 'apple-picking') RETURNING id \gset cat1_
INSERT INTO jobs.job_categories (label, slug) VALUES ('Dairy farm work', 'dairy-farm-work') RETURNING id \gset cat2_
INSERT INTO jobs.job_categories (label, slug) VALUES ('General farm labor', 'general-farm-labor') RETURNING id \gset cat3_
INSERT INTO jobs.job_categories (label, slug) VALUES ('Grape harvest', 'grape-harvest') RETURNING id \gset cat4_
INSERT INTO jobs.job_categories (label, slug) VALUES ('Greenhouse work', 'greenhouse-work') RETURNING id \gset cat5_
INSERT INTO jobs.job_categories (label, slug) VALUES ('Livestock care', 'livestock-care') RETURNING id \gset cat6_
INSERT INTO jobs.job_categories (label, slug) VALUES ('Olive harvest', 'olive-harvest') RETURNING id \gset cat7_
INSERT INTO jobs.job_categories (label, slug) VALUES ('Packing house work', 'packing-house-work') RETURNING id \gset cat8_
INSERT INTO jobs.job_categories (label, slug) VALUES ('Seasonal fruit picking', 'seasonal-fruit-picking') RETURNING id \gset cat9_
INSERT INTO jobs.job_categories (label, slug) VALUES ('Sheep shearing', 'sheep-shearing') RETURNING id \gset cat10_
INSERT INTO jobs.job_categories (label, slug) VALUES ('Tractor driving', 'tractor-driving') RETURNING id \gset cat11_
INSERT INTO jobs.job_categories (label, slug) VALUES ('Vegetable planting', 'vegetable-planting') RETURNING id \gset cat12_

INSERT INTO jobs.job_category_translations (category_id, locale, label, slug) VALUES
  (:'cat1_id', 'en', 'Apple picking', 'apple-picking'),
  (:'cat1_id', 'es', 'Recolección de manzanas', 'recoleccion-de-manzanas'),
  (:'cat1_id', 'fr', 'Cueillette de pommes', 'cueillette-de-pommes'),
  (:'cat1_id', 'it', 'Raccolta delle mele', 'raccolta-delle-mele'),
  (:'cat1_id', 'pt', 'Colheita de maçãs', 'colheita-de-macas'),

  (:'cat2_id', 'en', 'Dairy farm work', 'dairy-farm-work'),
  (:'cat2_id', 'es', 'Trabajo en granja lechera', 'trabajo-en-granja-lechera'),
  (:'cat2_id', 'fr', 'Travail en ferme laitière', 'travail-en-ferme-laitiere'),
  (:'cat2_id', 'it', 'Lavoro in azienda lattiero-casearia', 'lavoro-in-azienda-lattiero-casearia'),
  (:'cat2_id', 'pt', 'Trabalho em quinta leiteira', 'trabalho-em-quinta-leiteira'),

  (:'cat3_id', 'en', 'General farm labor', 'general-farm-labor'),
  (:'cat3_id', 'es', 'Trabajo agrícola general', 'trabajo-agricola-general'),
  (:'cat3_id', 'fr', 'Travail agricole général', 'travail-agricole-general'),
  (:'cat3_id', 'it', 'Lavoro agricolo generico', 'lavoro-agricolo-generico'),
  (:'cat3_id', 'pt', 'Trabalho agrícola geral', 'trabalho-agricola-geral'),

  (:'cat4_id', 'en', 'Grape harvest', 'grape-harvest'),
  (:'cat4_id', 'es', 'Vendimia', 'vendimia'),
  (:'cat4_id', 'fr', 'Vendanges', 'vendanges'),
  (:'cat4_id', 'it', 'Vendemmia', 'vendemmia'),
  (:'cat4_id', 'pt', 'Vindima', 'vindima'),

  (:'cat5_id', 'en', 'Greenhouse work', 'greenhouse-work'),
  (:'cat5_id', 'es', 'Trabajo en invernadero', 'trabajo-en-invernadero'),
  (:'cat5_id', 'fr', 'Travail en serre', 'travail-en-serre'),
  (:'cat5_id', 'it', 'Lavoro in serra', 'lavoro-in-serra'),
  (:'cat5_id', 'pt', 'Trabalho em estufa', 'trabalho-em-estufa'),

  (:'cat6_id', 'en', 'Livestock care', 'livestock-care'),
  (:'cat6_id', 'es', 'Cuidado de ganado', 'cuidado-de-ganado'),
  (:'cat6_id', 'fr', 'Soin du bétail', 'soin-du-betail'),
  (:'cat6_id', 'it', 'Cura del bestiame', 'cura-del-bestiame'),
  (:'cat6_id', 'pt', 'Cuidado de gado', 'cuidado-de-gado'),

  (:'cat7_id', 'en', 'Olive harvest', 'olive-harvest'),
  (:'cat7_id', 'es', 'Recolección de aceitunas', 'recoleccion-de-aceitunas'),
  (:'cat7_id', 'fr', 'Récolte des olives', 'recolte-des-olives'),
  (:'cat7_id', 'it', 'Raccolta delle olive', 'raccolta-delle-olive'),
  (:'cat7_id', 'pt', 'Colheita de azeitona', 'colheita-de-azeitona'),

  (:'cat8_id', 'en', 'Packing house work', 'packing-house-work'),
  (:'cat8_id', 'es', 'Trabajo en almacén de envasado', 'trabajo-en-almacen-de-envasado'),
  (:'cat8_id', 'fr', 'Travail en station de conditionnement', 'travail-en-station-de-conditionnement'),
  (:'cat8_id', 'it', 'Lavoro in centro di confezionamento', 'lavoro-in-centro-di-confezionamento'),
  (:'cat8_id', 'pt', 'Trabalho em central de embalagem', 'trabalho-em-central-de-embalagem'),

  (:'cat9_id', 'en', 'Seasonal fruit picking', 'seasonal-fruit-picking'),
  (:'cat9_id', 'es', 'Recolección de fruta de temporada', 'recoleccion-de-fruta-de-temporada'),
  (:'cat9_id', 'fr', 'Cueillette de fruits saisonnière', 'cueillette-de-fruits-saisonniere'),
  (:'cat9_id', 'it', 'Raccolta di frutta stagionale', 'raccolta-di-frutta-stagionale'),
  (:'cat9_id', 'pt', 'Colheita de fruta sazonal', 'colheita-de-fruta-sazonal'),

  (:'cat10_id', 'en', 'Sheep shearing', 'sheep-shearing'),
  (:'cat10_id', 'es', 'Esquila de ovejas', 'esquila-de-ovejas'),
  (:'cat10_id', 'fr', 'Tonte des moutons', 'tonte-des-moutons'),
  (:'cat10_id', 'it', 'Tosatura delle pecore', 'tosatura-delle-pecore'),
  (:'cat10_id', 'pt', 'Tosquia de ovelhas', 'tosquia-de-ovelhas'),

  (:'cat11_id', 'en', 'Tractor driving', 'tractor-driving'),
  (:'cat11_id', 'es', 'Conducción de tractor', 'conduccion-de-tractor'),
  (:'cat11_id', 'fr', 'Conduite de tracteur', 'conduite-de-tracteur'),
  (:'cat11_id', 'it', 'Guida di trattore', 'guida-di-trattore'),
  (:'cat11_id', 'pt', 'Condução de trator', 'conducao-de-trator'),

  (:'cat12_id', 'en', 'Vegetable planting', 'vegetable-planting'),
  (:'cat12_id', 'es', 'Plantación de hortalizas', 'plantacion-de-hortalizas'),
  (:'cat12_id', 'fr', 'Plantation de légumes', 'plantation-de-legumes'),
  (:'cat12_id', 'it', 'Piantagione di ortaggi', 'piantagione-di-ortaggi'),
  (:'cat12_id', 'pt', 'Plantação de hortaliças', 'plantacao-de-hortalicas');
