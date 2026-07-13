import db from './index';

/**
 * 种子数据脚本
 * 插入演示数据用于开发调试
 */
function seed(): void {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  console.log('开始插入种子数据...');

  // ========================================
  // 1. 插入标签
  // ========================================
  const tagInsert = db.prepare(`
    INSERT OR IGNORE INTO tags (name, color, created_at) VALUES (?, ?, ?)
  `);

  const tagsData = [
    ['唐代', '#dc2626', now],
    ['宋代', '#2563eb', now],
    ['政治', '#16a34a', now],
    ['经济', '#ca8a04', now],
    ['军事', '#9333ea', now],
    ['人物传记', '#0891b2', now],
    ['地理', '#ea580c', now],
  ];

  const insertTags = db.transaction(() => {
    for (const [name, color, createdAt] of tagsData) {
      tagInsert.run(name, color, createdAt);
    }
  });
  insertTags();

  const tags = db.prepare('SELECT id, name FROM tags').all() as Array<{ id: number; name: string }>;
  const tagMap = new Map(tags.map((t) => [t.name, t.id]));

  console.log(`  已插入 ${tags.length} 个标签`);

  // ========================================
  // 2. 插入史料
  // ========================================
  const materialInsert = db.prepare(`
    INSERT INTO materials (
      title, original_text, converted_text, punctuated_text, final_text,
      ocr_confidence, status, source_db, source_book, source_author,
      source_version, source_volume, credibility, file_path, file_type,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const materialsData = [
    // ---- 1. 宋史·王安石传 节选 ----
    {
      title: '宋史·王安石传（节选）',
      original_text: '王安石字介甫撫州臨川人安石少好讀書一過目終身不忘其屬文動筆如飛初若不經意既成見者皆服其精妙友生曾鞏攜以示歐陽修修為之延譽擢進士上第簽書淮南判官舊制秩滿許獻文求試館職安石獨不求調鄞縣知縣起堤堰決陂塘為水陸之利貸谷與民出息以償俾新陳相易邑人便之',
      converted_text: '王安石字介甫，抚州临川人。安石少好读书，一过目终身不忘。其属文动笔如飞，初若不经意，既成，见者皆服其精妙。友生曾巩携以示欧阳修，修为之延誉。擢进士上第，签书淮南判官。旧制，秩满许献文求试馆职，安石独不求。调鄞县知县，起堤堰，决陂塘，为水陆之利；贷谷与民，出息以偿，俾新陈相易，邑人便之。',
      punctuated_text: '王安石，字介甫，抚州临川人。安石少好读书，一过目终身不忘。其属文动笔如飞，初若不经意，既成，见者皆服其精妙。友生曾巩携以示欧阳修，修为之延誉。擢进士上第，签书淮南判官。旧制，秩满许献文求试馆职，安石独不求。调鄞县知县，起堤堰，决陂塘，为水陆之利；贷谷与民，出息以偿，俾新陈相易，邑人便之。',
      final_text: '王安石，字介甫，抚州临川人。安石少好读书，一过目终身不忘。其属文动笔如飞，初若不经意，既成，见者皆服其精妙。友生曾巩携以示欧阳修，修为之延誉。擢进士上第，签书淮南判官。旧制，秩满许献文求试馆职，安石独不求。调鄞县知县，起堤堰，决陂塘，为水陆之利；贷谷与民，出息以偿，俾新陈相易，邑人便之。',
      status: 'published',
      source_db: '二十四史',
      source_book: '宋史',
      source_author: '脱脱',
      source_version: '至正本',
      source_volume: '卷三百二十七·列传第八十六',
      credibility: 'primary',
      tags: ['宋代', '政治', '人物传记'],
    },
    // ---- 2. 资治通鉴 节选（贞观元年太宗论治） ----
    {
      title: '资治通鉴·唐纪八（节选：太宗论治道）',
      original_text: '貞觀元年太宗謂侍臣曰正主御邪臣不能致理正臣事邪主亦不能致理惟君臣同德則海內安朕雖不明幸逢公等冀使天下義安魏徵對曰君之所以明者兼聽也君之所以暗者偏信也堯舜氏辟四門明四目達四聰雖有共鯀不能塞也秦二世隱藏其身以信趙高天下潰叛而不得聞梁武帝信朱异而侯景舉兵向闕竟不得知隋煬帝偏信虞世基而諸賊攻城剽掠亦不得知',
      converted_text: '贞观元年，太宗谓侍臣曰："正主御邪臣，不能致理；正臣事邪主，亦不能致理。惟君臣同德，则海内安。朕虽不明，幸逢公等，冀使天下乂安。"魏徵对曰："君之所以明者，兼听也；君之所以暗者，偏信也。尧、舜氏辟四门，明四目，达四聪，虽有共、鲧，不能塞也。秦二世隐藏其身，以信赵高，天下溃叛而不得闻。梁武帝信朱异，而侯景举兵向阙，竟不得知。隋炀帝偏信虞世基，而诸贼攻城剽掠，亦不得知。',
      punctuated_text: '贞观元年，太宗谓侍臣曰："正主御邪臣，不能致理；正臣事邪主，亦不能致理。惟君臣同德，则海内安。朕虽不明，幸逢公等，冀使天下乂安。"魏徵对曰："君之所以明者，兼听也；君之所以暗者，偏信也。尧、舜氏辟四门，明四目，达四聪，虽有共、鲧，不能塞也。秦二世隐藏其身，以信赵高，天下溃叛而不得闻。梁武帝信朱异，而侯景举兵向阙，竟不得知。隋炀帝偏信虞世基，而诸贼攻城剽掠，亦不得知。"',
      final_text: '贞观元年，太宗谓侍臣曰："正主御邪臣，不能致理；正臣事邪主，亦不能致理。惟君臣同德，则海内安。朕虽不明，幸逢公等，冀使天下乂安。"魏徵对曰："君之所以明者，兼听也；君之所以暗者，偏信也。尧、舜氏辟四门，明四目，达四聪，虽有共、鲧，不能塞也。秦二世隐藏其身，以信赵高，天下溃叛而不得闻。梁武帝信朱异，而侯景举兵向阙，竟不得知。隋炀帝偏信虞世基，而诸贼攻城剽掠，亦不得知。"',
      status: 'published',
      source_db: '编年史',
      source_book: '资治通鉴',
      source_author: '司马光',
      source_version: '四部丛刊本',
      source_volume: '卷一百九十二·唐纪八',
      credibility: 'primary',
      tags: ['唐代', '政治', '人物传记'],
    },
    // ---- 3. 续资治通鉴长编 节选（熙宁变法） ----
    {
      title: '续资治通鉴长编（节选：熙宁二年设制置三司条例司）',
      original_text: '熙寧二年二月庚子以王安石參知政事甲子設制置三司條例司掌經畫邦計議變舊法以通天下之利初安石對帝言今所以未舉事者凡以財用不足故也故臣以理财為方今先務未敢輒言者恐未能當上意也上曰朕自即位以來屢有人言於朕以為理財為先朕今欲修理财之法以佐國用未知何道而可安石對曰誠能理财則不以賦稅而國用足',
      converted_text: '熙宁二年二月庚子，以王安石参知政事。甲子，设制置三司条例司，掌经画邦计，议变旧法以通天下之利。初，安石对帝言："今所以未举事者，凡以财用不足故也，故臣以理财为方今先务。未敢輒言者，恐未能当上意也。"上曰："朕自即位以来，屡有人言于朕，以为理财为先。朕今欲修理财之法，以佐国用，未知何道而可？"安石对曰："诚能理财，则不以赋税而国用足。"',
      punctuated_text: '熙宁二年二月庚子，以王安石参知政事。甲子，设制置三司条例司，掌经画邦计，议变旧法以通天下之利。初，安石对帝言："今所以未举事者，凡以财用不足故也，故臣以理财为方今先务。未敢辄言者，恐未能当上意也。"上曰："朕自即位以来，屡有人言于朕，以为理财为先。朕今欲修理财之法，以佐国用，未知何道而可？"安石对曰："诚能理财，则不以赋税而国用足。"',
      final_text: '熙宁二年二月庚子，以王安石参知政事。甲子，设制置三司条例司，掌经画邦计，议变旧法以通天下之利。初，安石对帝言："今所以未举事者，凡以财用不足故也，故臣以理财为方今先务。未敢辄言者，恐未能当上意也。"上曰："朕自即位以来，屡有人言于朕，以为理财为先。朕今欲修理财之法，以佐国用，未知何道而可？"安石对曰："诚能理财，则不以赋税而国用足。"',
      status: 'published',
      source_db: '编年史',
      source_book: '续资治通鉴长编',
      source_author: '李焘',
      source_version: '四库全书本',
      source_volume: '熙宁二年',
      credibility: 'primary',
      tags: ['宋代', '政治', '经济'],
    },
    // ---- 4. 旧唐书·魏征传 节选 ----
    {
      title: '旧唐书·魏征传（节选）',
      original_text: '魏徵字玄成鉅鹿曲城人也後徙家相州之內黃父長賢北齊屯留令徵少孤貧落拓有大志不事生業出家為道士好讀書多所通涉見天下漸亂尤屬意縱橫之說大業末武陽郡丞元寶藏舉兵應李密召徵為典書記密每見寶藏之疏未嘗不稱善既而密敗徵隨密來降至京師',
      converted_text: '魏徵，字玄成，鉅鹿曲城人也。后徙家相州之内黄。父长贤，北齐屯留令。徵少孤贫，落拓有大志，不事生业，出家为道士。好读书，多所通涉，见天下渐乱，尤属意纵横之说。大业末，武陽郡丞元宝藏举兵应李密，召徵为典书记。密每见宝藏之疏，未尝不称善。既而密败，徵随密来降，至京师。',
      punctuated_text: '魏徵，字玄成，鉅鹿曲城人也。后徙家相州之内黄。父长贤，北齐屯留令。徵少孤贫，落拓有大志，不事生业，出家为道士。好读书，多所通涉，见天下渐乱，尤属意纵横之说。大业末，武陽郡丞元宝藏举兵应李密，召徵为典书记。密每见宝藏之疏，未尝不称善。既而密败，徵随密来降，至京师。',
      final_text: '魏徵，字玄成，鉅鹿曲城人也。后徙家相州之内黄。父长贤，北齐屯留令。徵少孤贫，落拓有大志，不事生业，出家为道士。好读书，多所通涉，见天下渐乱，尤属意纵横之说。大业末，武陽郡丞元宝藏举兵应李密，召徵为典书记。密每见宝藏之疏，未尝不称善。既而密败，徵随密来降，至京师。',
      status: 'published',
      source_db: '二十四史',
      source_book: '旧唐书',
      source_author: '刘昫',
      source_version: '明嘉靖闻人诠刻本',
      source_volume: '卷七十一·列传第二十一',
      credibility: 'primary',
      tags: ['唐代', '政治', '人物传记'],
    },
    // ---- 5. 新唐书·魏征传 节选 ----
    {
      title: '新唐书·魏征传（节选）',
      original_text: '魏徵字玄成魏州曲城人少孤落魄棄貲産不營有大志通貫書術隋亂詭為道士武陽郡丞元寶藏舉兵應李密召為典書記密每見寶藏疏未嘗不稱善或薦於密召為文學參軍掌記室及密敗與密俱來京師',
      converted_text: '魏徵，字玄成，魏州曲城人。少孤，落魄，弃貲产不营，有大志，通贯书术。隋乱，诡为道士。武陽郡丞元宝藏举兵应李密，召为典书记。密每见宝藏疏，未尝不称善。或荐于密，召为文学参军，掌记室。及密败，与密俱来京师。',
      punctuated_text: '魏徵，字玄成，魏州曲城人。少孤，落魄，弃貲产不营，有大志，通贯书术。隋乱，诡为道士。武陽郡丞元宝藏举兵应李密，召为典书记。密每见宝藏疏，未尝不称善。或荐于密，召为文学参军，掌记室。及密败，与密俱来京师。',
      final_text: '魏徵，字玄成，魏州曲城人。少孤，落魄，弃貲产不营，有大志，通贯书术。隋乱，诡为道士。武陽郡丞元宝藏举兵应李密，召为典书记。密每见宝藏疏，未尝不称善。或荐于密，召为文学参军，掌记室。及密败，与密俱来京师。',
      status: 'published',
      source_db: '二十四史',
      source_book: '新唐书',
      source_author: '欧阳修、宋祁',
      source_version: '南宋嘉祐本',
      source_volume: '卷九十七·列传第二十二',
      credibility: 'primary',
      tags: ['唐代', '政治', '人物传记'],
    },
  ];

  const materialTagInsert = db.prepare(`
    INSERT OR IGNORE INTO material_tags (material_id, tag_id) VALUES (?, ?)
  `);

  const insertMaterials = db.transaction(() => {
    for (const m of materialsData) {
      const result = materialInsert.run(
        m.title,
        m.original_text,
        m.converted_text,
        m.punctuated_text,
        m.final_text,
        0.95,
        m.status,
        m.source_db,
        m.source_book,
        m.source_author,
        m.source_version,
        m.source_volume,
        m.credibility,
        null,
        null,
        now,
        now
      );
      const materialId = Number(result.lastInsertRowid);
      for (const tagName of m.tags) {
        const tagId = tagMap.get(tagName);
        if (tagId) {
          materialTagInsert.run(materialId, tagId);
        }
      }
    }
  });
  insertMaterials();

  const materials = db.prepare('SELECT id, title FROM materials').all() as Array<{ id: number; title: string }>;
  console.log(`  已插入 ${materials.length} 条史料`);

  // ========================================
  // 3. 插入实体
  // ========================================
  const entityInsert = db.prepare(`
    INSERT INTO entities (name, type, description, aliases, metadata, confidence, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const entitiesData = [
    {
      name: '王安石',
      type: 'person',
      description: '北宋著名政治家、思想家、文学家、改革家，"唐宋八大家"之一。字介甫，号半山，抚州临川人。熙宁年间主导变法，史称"王安石变法"或"熙宁变法"。',
      aliases: JSON.stringify(['介甫', '王介甫', '半山', '王半山', '临川先生', '荆公']),
      metadata: JSON.stringify({ birthYear: 1021, deathYear: 1086, dynasty: '北宋' }),
    },
    {
      name: '司马光',
      type: 'person',
      description: '北宋政治家、史学家、文学家，主持编纂《资治通鉴》。字君实，号迂叟，世称涑水先生。与王安石在变法问题上持对立立场。',
      aliases: JSON.stringify(['君实', '司马君实', '涑水先生', '温国公']),
      metadata: JSON.stringify({ birthYear: 1019, deathYear: 1086, dynasty: '北宋' }),
    },
    {
      name: '欧阳修',
      type: 'person',
      description: '北宋政治家、文学家，"唐宋八大家"之一。字永叔，号醉翁、六一居士。曾为王安石延誉，后在变法问题上与王安石有分歧。',
      aliases: JSON.stringify(['永叔', '欧阳永叔', '醉翁', '六一居士']),
      metadata: JSON.stringify({ birthYear: 1007, deathYear: 1072, dynasty: '北宋' }),
    },
    {
      name: '苏轼',
      type: 'person',
      description: '北宋文学家、书法家、画家，"唐宋八大家"之一。字子瞻，号东坡居士。反对王安石变法中的激进措施，也反对司马光尽废新法。',
      aliases: JSON.stringify(['子瞻', '苏子瞻', '东坡', '东坡居士', '苏东坡']),
      metadata: JSON.stringify({ birthYear: 1037, deathYear: 1101, dynasty: '北宋' }),
    },
    {
      name: '宋神宗',
      type: 'person',
      description: '北宋第六位皇帝，名赵顼。在位期间支持王安石变法，推行熙宁新法。',
      aliases: JSON.stringify(['赵顼', '赵顼', '熙宁帝']),
      metadata: JSON.stringify({ birthYear: 1048, deathYear: 1085, reignPeriod: '1068-1085' }),
    },
    {
      name: '魏征',
      type: 'person',
      description: '唐朝初年著名政治家、思想家、文学家和史学家，以直言敢谏著称。字玄成，先后被封为钜鹿县男、郑国公。',
      aliases: JSON.stringify(['玄成', '魏玄成', '郑国公', '魏郑公', '魏徵']),
      metadata: JSON.stringify({ birthYear: 580, deathYear: 643, dynasty: '唐朝' }),
    },
    {
      name: '唐太宗',
      type: 'person',
      description: '唐朝第二位皇帝，名李世民。开创"贞观之治"，是中国历史上著名的明君。善于纳谏，重用魏征等贤臣。',
      aliases: JSON.stringify(['李世民', '唐太宗', '太宗皇帝', '秦王', '天可汗']),
      metadata: JSON.stringify({ birthYear: 598, deathYear: 649, reignPeriod: '626-649', dynasty: '唐朝' }),
    },
    {
      name: '开封',
      type: 'place',
      description: '北宋都城，又称东京、汴京、汴梁。是当时世界上最大的城市之一。',
      aliases: JSON.stringify(['东京', '汴京', '汴梁', '大梁']),
      metadata: JSON.stringify({ latitude: 34.8, longitude: 114.3, type: '都城' }),
    },
    {
      name: '临川',
      type: 'place',
      description: '王安石故乡，今江西省抚州市临川区。',
      aliases: JSON.stringify(['抚州临川', '抚州']),
      metadata: JSON.stringify({ province: '江西', modernName: '抚州市临川区' }),
    },
    {
      name: '熙宁变法',
      type: 'event',
      description: '北宋神宗熙宁年间（1068-1077年），王安石在宋神宗支持下推行的一系列新法，包括青苗法、免役法、方田均税法、农田水利法、市易法等。',
      aliases: JSON.stringify(['王安石变法', '熙宁新法', '熙丰新法']),
      metadata: JSON.stringify({ startYear: 1069, endYear: 1085, location: '开封' }),
    },
    {
      name: '元祐更化',
      type: 'event',
      description: '宋哲宗元祐年间（1086-1094年），司马光等旧党掌权后废除王安石新法的政治事件。',
      aliases: JSON.stringify(['元祐旧党执政', '废新法']),
      metadata: JSON.stringify({ startYear: 1086, endYear: 1094, location: '开封' }),
    },
    {
      name: '青苗法',
      type: 'event',
      description: '王安石变法的重要措施之一。规定在青黄不接时，官府向农民贷款或借粮，秋收后偿还并加收利息。旨在抑制民间高利贷，增加政府收入。',
      aliases: JSON.stringify(['常平新法', '常平仓法']),
      metadata: JSON.stringify({ year: 1069, type: '经济改革' }),
    },
  ];

  const insertEntities = db.transaction(() => {
    for (const e of entitiesData) {
      entityInsert.run(
        e.name,
        e.type,
        e.description,
        e.aliases,
        e.metadata,
        0.9,
        now,
        now
      );
    }
  });
  insertEntities();

  const entities = db.prepare('SELECT id, name FROM entities').all() as Array<{ id: number; name: string }>;
  const entityMap = new Map(entities.map((e) => [e.name, e.id]));
  console.log(`  已插入 ${entities.length} 个实体`);

  // ========================================
  // 4. 插入实体关系
  // ========================================
  const relationInsert = db.prepare(`
    INSERT INTO relations (source_id, target_id, type, description, confidence, source_material_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const relationsData = [
    { source: '王安石', target: '宋神宗', type: '君臣', description: '王安石受宋神宗重用，主持熙宁变法', confidence: 0.95 },
    { source: '司马光', target: '宋神宗', type: '君臣', description: '司马光曾为宋神宗翰林学士，后因反对新法离朝', confidence: 0.95 },
    { source: '王安石', target: '司马光', type: '政治对立', description: '王安石与司马光在变法问题上立场尖锐对立，是北宋新旧党争的核心人物', confidence: 0.98 },
    { source: '欧阳修', target: '王安石', type: '政治同僚', description: '欧阳修早年为王安石延誉，后在变法问题上产生分歧', confidence: 0.9 },
    { source: '苏轼', target: '欧阳修', type: '师承', description: '欧阳修为嘉祐二年科举主考官，赏识苏轼并予以擢拔', confidence: 0.95 },
    { source: '苏轼', target: '王安石', type: '政论分歧', description: '苏轼上书反对新法中的激进措施，后因"乌台诗案"被贬', confidence: 0.92 },
    { source: '王安石', target: '熙宁变法', type: '主导', description: '王安石于熙宁二年任参知政事，主导推行一系列新法', confidence: 0.99 },
    { source: '司马光', target: '元祐更化', type: '主导', description: '元祐元年司马光拜相，全面废除王安石新法', confidence: 0.99 },
    { source: '王安石', target: '青苗法', type: '创制', description: '王安石在鄞县试行常平新法经验基础上，于熙宁二年推行青苗法', confidence: 0.95 },
    { source: '司马光', target: '青苗法', type: '反对', description: '司马光坚决反对青苗法，认为其名为济民、实为取利', confidence: 0.93 },
    { source: '苏轼', target: '青苗法', type: '批评', description: '苏轼批评青苗法执行中官吏强行摊派，加重百姓负担', confidence: 0.9 },
    { source: '王安石', target: '开封', type: '活动地点', description: '王安石在开封任参知政事、同中书门下平章事，推行变法', confidence: 0.95 },
    { source: '王安石', target: '临川', type: '籍贯', description: '王安石为抚州临川人', confidence: 0.99 },
    { source: '魏征', target: '唐太宗', type: '谏臣', description: '魏征为唐太宗重要谏臣，先后进谏二百余事', confidence: 0.99 },
    { source: '唐太宗', target: '魏征', type: '重用', description: '唐太宗以魏征为谏议大夫、秘书监，深为信任', confidence: 0.99 },
    { source: '司马光', target: '王安石', type: '著述评论', description: '司马光在其《与王介甫书》中系统批评王安石变法', confidence: 0.9 },
    { source: '宋神宗', target: '熙宁变法', type: '发起', description: '宋神宗即位后决意改革，亲自发起并全力支持熙宁变法', confidence: 0.98 },
  ];

  const insertRelations = db.transaction(() => {
    const material1Id = entityMap.get('宋史·王安石传（节选）')
      ? undefined
      : materials[0]?.id;
    // 关联到第一条史料（宋史·王安石传）
    const refMaterialId = materials.find((m) => m.title.includes('宋史'))?.id;

    for (const r of relationsData) {
      const sourceId = entityMap.get(r.source);
      const targetId = entityMap.get(r.target);
      if (sourceId && targetId) {
        relationInsert.run(
          sourceId,
          targetId,
          r.type,
          r.description,
          r.confidence,
          refMaterialId || null,
          now
        );
      }
    }
  });
  insertRelations();

  const relations = db.prepare('SELECT COUNT(*) as count FROM relations').get() as { count: number };
  console.log(`  已插入 ${relations.count} 条关系`);

  // ========================================
  // 5. 插入史料-实体关联
  // ========================================
  const materialEntityInsert = db.prepare(`
    INSERT OR IGNORE INTO material_entities (material_id, entity_id, mention_text)
    VALUES (?, ?, ?)
  `);

  // 为每条史料关联相应的实体
  const materialEntityMap: Record<string, Array<{ entity: string; mention: string }>> = {
    '宋史·王安石传（节选）': [
      { entity: '王安石', mention: '王安石' },
      { entity: '欧阳修', mention: '欧阳修' },
      { entity: '临川', mention: '临川' },
    ],
    '资治通鉴·唐纪八（节选：太宗论治道）': [
      { entity: '唐太宗', mention: '太宗' },
      { entity: '魏征', mention: '魏徵' },
    ],
    '续资治通鉴长编（节选：熙宁二年设制置三司条例司）': [
      { entity: '王安石', mention: '王安石' },
      { entity: '宋神宗', mention: '帝' },
      { entity: '熙宁变法', mention: '议变旧法' },
    ],
    '旧唐书·魏征传（节选）': [
      { entity: '魏征', mention: '魏徵' },
      { entity: '唐太宗', mention: '太宗' },
    ],
    '新唐书·魏征传（节选）': [
      { entity: '魏征', mention: '魏徵' },
      { entity: '唐太宗', mention: '太宗' },
    ],
  };

  const insertMaterialEntities = db.transaction(() => {
    for (const material of materials) {
      const mappings = materialEntityMap[material.title];
      if (mappings) {
        for (const mapping of mappings) {
          const entityId = entityMap.get(mapping.entity);
          if (entityId) {
            materialEntityInsert.run(material.id, entityId, mapping.mention);
          }
        }
      }
    }
  });
  insertMaterialEntities();

  const materialEntities = db.prepare('SELECT COUNT(*) as count FROM material_entities').get() as { count: number };
  console.log(`  已插入 ${materialEntities.count} 条史料-实体关联`);

  // ========================================
  // 6. 插入示例文档
  // ========================================
  const docInsert = db.prepare(`
    INSERT INTO documents (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)
  `);

  const citationInsert = db.prepare(`
    INSERT INTO document_citations (document_id, material_id, citation_mark, created_at) VALUES (?, ?, ?, ?)
  `);

  const insertDocument = db.transaction(() => {
    const docResult = docInsert.run(
      '王安石变法史料分析初稿',
      `# 王安石变法史料分析\n\n## 一、王安石其人\n\n王安石（1021-1086），字介甫，抚州临川人，北宋著名政治家、思想家、文学家。其属文"动笔如飞，初若不经意，既成，见者皆服其精妙"。友生曾巩携其文以示欧阳修，欧阳修为之延誉[1]。\n\n## 二、变法背景\n\n宋神宗即位后，面临"财用不足"的困局。熙宁二年（1069年），王安石被任命为参知政事，随即设立制置三司条例司，作为变法的核心机构[2]。王安石对宋神宗言："今所以未举事者，凡以财用不足故也，故臣以理财为方今先务。"神宗回应愿"修理财之法，以佐国用"，王安石则提出"诚能理财，则不以赋税而国用足"的著名论断[2]。\n\n## 三、主要新法\n\n### 青苗法\n\n青苗法是王安石变法中最具代表性的经济措施之一。该法源于王安石早年在鄞县任知县时的实践经验——"贷谷与民，出息以偿，俾新陈相易，邑人便之"[1]。熙宁二年正式推行，规定在青黄不接时官府向农民贷款或借粮，秋收后偿还并加收利息。\n\n## 四、新旧党争\n\n变法引发了激烈的政治争论。司马光坚决反对新法，与王安石形成尖锐对立。苏轼虽也批评新法执行中的问题，但立场较为温和，既反对激进变法，也反对尽废新法。\n\n## 五、版本对比示例\n\n魏征传记在《旧唐书》与《新唐书》中的记载存在差异：旧唐书记其"父长贤，北齐屯留令。徵少孤贫，落拓有大志，不事生业，出家为道士。好读书，多所通涉"[3]；新唐书则简化为"少孤，落魄，弃貲产不营，有大志，通贯书术"[4]。两相比较，新唐书行文更为简练，而旧唐书保留了更多细节。\n`,
      now,
      now
    );
    const docId = Number(docResult.lastInsertRowid);

    // 关联引用
    const materialCitations = [
      { title: '宋史·王安石传（节选）', mark: '[1]' },
      { title: '续资治通鉴长编（节选：熙宁二年设制置三司条例司）', mark: '[2]' },
      { title: '旧唐书·魏征传（节选）', mark: '[3]' },
      { title: '新唐书·魏征传（节选）', mark: '[4]' },
    ];

    for (const citation of materialCitations) {
      const materialId = materials.find((m) => m.title === citation.title)?.id;
      if (materialId) {
        citationInsert.run(docId, materialId, citation.mark, now);
      }
    }
  });
  insertDocument();

  const documents = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
  const citations = db.prepare('SELECT COUNT(*) as count FROM document_citations').get() as { count: number };
  console.log(`  已插入 ${documents.count} 篇文档，${citations.count} 条引用`);

  console.log('种子数据插入完成！');
}

// 执行种子数据插入
try {
  seed();
} catch (error) {
  console.error('种子数据插入失败：', error);
  process.exit(1);
}

// 退出
process.exit(0);