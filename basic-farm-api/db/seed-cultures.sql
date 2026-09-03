-- Real reference data (crop taxonomy), not test/fake data — safe for
-- production. Farmers pick these from a dropdown when creating a parcel.
-- Idempotent: safe to re-run, existing rows are left untouched.

INSERT INTO plots.cultures (label, slug) VALUES ('Wheat', 'wheat') RETURNING id \gset cul1_
INSERT INTO plots.cultures (label, slug) VALUES ('Corn', 'corn') RETURNING id \gset cul2_
INSERT INTO plots.cultures (label, slug) VALUES ('Barley', 'barley') RETURNING id \gset cul3_
INSERT INTO plots.cultures (label, slug) VALUES ('Sunflower', 'sunflower') RETURNING id \gset cul4_
INSERT INTO plots.cultures (label, slug) VALUES ('Rapeseed', 'rapeseed') RETURNING id \gset cul5_
INSERT INTO plots.cultures (label, slug) VALUES ('Grapevine', 'grapevine') RETURNING id \gset cul6_
INSERT INTO plots.cultures (label, slug) VALUES ('Apple trees', 'apple-trees') RETURNING id \gset cul7_
INSERT INTO plots.cultures (label, slug) VALUES ('Market garden vegetables', 'market-garden-vegetables') RETURNING id \gset cul8_
INSERT INTO plots.cultures (label, slug) VALUES ('Pasture', 'pasture') RETURNING id \gset cul9_
INSERT INTO plots.cultures (label, slug) VALUES ('Fallow', 'fallow') RETURNING id \gset cul10_

INSERT INTO plots.culture_translations (culture_id, locale, label, slug) VALUES
  (:'cul1_id', 'en', 'Wheat', 'wheat'),
  (:'cul1_id', 'es', 'Trigo', 'trigo'),
  (:'cul1_id', 'fr', 'Blé', 'ble'),
  (:'cul1_id', 'it', 'Grano', 'grano'),
  (:'cul1_id', 'pt', 'Trigo', 'trigo'),

  (:'cul2_id', 'en', 'Corn', 'corn'),
  (:'cul2_id', 'es', 'Maíz', 'maiz'),
  (:'cul2_id', 'fr', 'Maïs', 'mais'),
  (:'cul2_id', 'it', 'Mais', 'mais'),
  (:'cul2_id', 'pt', 'Milho', 'milho'),

  (:'cul3_id', 'en', 'Barley', 'barley'),
  (:'cul3_id', 'es', 'Cebada', 'cebada'),
  (:'cul3_id', 'fr', 'Orge', 'orge'),
  (:'cul3_id', 'it', 'Orzo', 'orzo'),
  (:'cul3_id', 'pt', 'Cevada', 'cevada'),

  (:'cul4_id', 'en', 'Sunflower', 'sunflower'),
  (:'cul4_id', 'es', 'Girasol', 'girasol'),
  (:'cul4_id', 'fr', 'Tournesol', 'tournesol'),
  (:'cul4_id', 'it', 'Girasole', 'girasole'),
  (:'cul4_id', 'pt', 'Girassol', 'girassol'),

  (:'cul5_id', 'en', 'Rapeseed', 'rapeseed'),
  (:'cul5_id', 'es', 'Colza', 'colza'),
  (:'cul5_id', 'fr', 'Colza', 'colza'),
  (:'cul5_id', 'it', 'Colza', 'colza'),
  (:'cul5_id', 'pt', 'Colza', 'colza'),

  (:'cul6_id', 'en', 'Grapevine', 'grapevine'),
  (:'cul6_id', 'es', 'Viña', 'vina'),
  (:'cul6_id', 'fr', 'Vigne', 'vigne'),
  (:'cul6_id', 'it', 'Vigneto', 'vigneto'),
  (:'cul6_id', 'pt', 'Vinha', 'vinha'),

  (:'cul7_id', 'en', 'Apple trees', 'apple-trees'),
  (:'cul7_id', 'es', 'Manzanos', 'manzanos'),
  (:'cul7_id', 'fr', 'Pommiers', 'pommiers'),
  (:'cul7_id', 'it', 'Meli', 'meli'),
  (:'cul7_id', 'pt', 'Macieiras', 'macieiras'),

  (:'cul8_id', 'en', 'Market garden vegetables', 'market-garden-vegetables'),
  (:'cul8_id', 'es', 'Horticultura', 'horticultura'),
  (:'cul8_id', 'fr', 'Maraîchage', 'maraichage'),
  (:'cul8_id', 'it', 'Orticoltura', 'orticoltura'),
  (:'cul8_id', 'pt', 'Horticultura', 'horticultura'),

  (:'cul9_id', 'en', 'Pasture', 'pasture'),
  (:'cul9_id', 'es', 'Pasto', 'pasto'),
  (:'cul9_id', 'fr', 'Pâturage', 'paturage'),
  (:'cul9_id', 'it', 'Pascolo', 'pascolo'),
  (:'cul9_id', 'pt', 'Pastagem', 'pastagem'),

  (:'cul10_id', 'en', 'Fallow', 'fallow'),
  (:'cul10_id', 'es', 'Barbecho', 'barbecho'),
  (:'cul10_id', 'fr', 'Jachère', 'jachere'),
  (:'cul10_id', 'it', 'Maggese', 'maggese'),
  (:'cul10_id', 'pt', 'Pousio', 'pousio');
