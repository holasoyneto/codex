// Scripture data — Bible text fetched live from bible-api.com (public domain).
// This file holds: book canon, translation registry, and the hand-crafted
// panel content for John 1 used as a "seed" so the rich Talmud / Commentary
// / Gematria / Gnosis layer ships warm. Other passages generate via Oracle.

window.CODEX_DATA = {
  books: [
    { id:"gen",name:"Genesis",        testament:"OT", chapters:50 },
    { id:"exo",name:"Exodus",         testament:"OT", chapters:40 },
    { id:"lev",name:"Leviticus",      testament:"OT", chapters:27 },
    { id:"num",name:"Numbers",        testament:"OT", chapters:36 },
    { id:"deu",name:"Deuteronomy",    testament:"OT", chapters:34 },
    { id:"jos",name:"Joshua",         testament:"OT", chapters:24 },
    { id:"jdg",name:"Judges",         testament:"OT", chapters:21 },
    { id:"rut",name:"Ruth",           testament:"OT", chapters:4 },
    { id:"1sa",name:"I Samuel",       testament:"OT", chapters:31 },
    { id:"2sa",name:"II Samuel",      testament:"OT", chapters:24 },
    { id:"1ki",name:"I Kings",        testament:"OT", chapters:22 },
    { id:"2ki",name:"II Kings",       testament:"OT", chapters:25 },
    { id:"1ch",name:"I Chronicles",   testament:"OT", chapters:29 },
    { id:"2ch",name:"II Chronicles",  testament:"OT", chapters:36 },
    { id:"ezr",name:"Ezra",           testament:"OT", chapters:10 },
    { id:"neh",name:"Nehemiah",       testament:"OT", chapters:13 },
    { id:"est",name:"Esther",         testament:"OT", chapters:10 },
    { id:"job",name:"Job",            testament:"OT", chapters:42 },
    { id:"psa",name:"Psalms",         testament:"OT", chapters:150 },
    { id:"pro",name:"Proverbs",       testament:"OT", chapters:31 },
    { id:"ecc",name:"Ecclesiastes",   testament:"OT", chapters:12 },
    { id:"sng",name:"Song of Songs",  testament:"OT", chapters:8 },
    { id:"isa",name:"Isaiah",         testament:"OT", chapters:66 },
    { id:"jer",name:"Jeremiah",       testament:"OT", chapters:52 },
    { id:"lam",name:"Lamentations",   testament:"OT", chapters:5 },
    { id:"ezk",name:"Ezekiel",        testament:"OT", chapters:48 },
    { id:"dan",name:"Daniel",         testament:"OT", chapters:12 },
    { id:"hos",name:"Hosea",          testament:"OT", chapters:14 },
    { id:"jol",name:"Joel",           testament:"OT", chapters:3 },
    { id:"amo",name:"Amos",           testament:"OT", chapters:9 },
    { id:"oba",name:"Obadiah",        testament:"OT", chapters:1 },
    { id:"jon",name:"Jonah",          testament:"OT", chapters:4 },
    { id:"mic",name:"Micah",          testament:"OT", chapters:7 },
    { id:"nam",name:"Nahum",          testament:"OT", chapters:3 },
    { id:"hab",name:"Habakkuk",       testament:"OT", chapters:3 },
    { id:"zep",name:"Zephaniah",      testament:"OT", chapters:3 },
    { id:"hag",name:"Haggai",         testament:"OT", chapters:2 },
    { id:"zec",name:"Zechariah",      testament:"OT", chapters:14 },
    { id:"mal",name:"Malachi",        testament:"OT", chapters:4 },
    { id:"mat",name:"Matthew",        testament:"NT", chapters:28 },
    { id:"mrk",name:"Mark",           testament:"NT", chapters:16 },
    { id:"luk",name:"Luke",           testament:"NT", chapters:24 },
    { id:"jhn",name:"John",           testament:"NT", chapters:21 },
    { id:"act",name:"Acts",           testament:"NT", chapters:28 },
    { id:"rom",name:"Romans",         testament:"NT", chapters:16 },
    { id:"1co",name:"I Corinthians",  testament:"NT", chapters:16 },
    { id:"2co",name:"II Corinthians", testament:"NT", chapters:13 },
    { id:"gal",name:"Galatians",      testament:"NT", chapters:6 },
    { id:"eph",name:"Ephesians",      testament:"NT", chapters:6 },
    { id:"php",name:"Philippians",    testament:"NT", chapters:4 },
    { id:"col",name:"Colossians",     testament:"NT", chapters:4 },
    { id:"1th",name:"I Thessalonians",testament:"NT", chapters:5 },
    { id:"2th",name:"II Thessalonians",testament:"NT",chapters:3 },
    { id:"1ti",name:"I Timothy",      testament:"NT", chapters:6 },
    { id:"2ti",name:"II Timothy",     testament:"NT", chapters:4 },
    { id:"tit",name:"Titus",          testament:"NT", chapters:3 },
    { id:"phm",name:"Philemon",       testament:"NT", chapters:1 },
    { id:"heb",name:"Hebrews",        testament:"NT", chapters:13 },
    { id:"jas",name:"James",          testament:"NT", chapters:5 },
    { id:"1pe",name:"I Peter",        testament:"NT", chapters:5 },
    { id:"2pe",name:"II Peter",       testament:"NT", chapters:3 },
    { id:"1jn",name:"I John",         testament:"NT", chapters:5 },
    { id:"2jn",name:"II John",        testament:"NT", chapters:1 },
    { id:"3jn",name:"III John",       testament:"NT", chapters:1 },
    { id:"jud",name:"Jude",           testament:"NT", chapters:1 },
    { id:"rev",name:"Revelation",     testament:"NT", chapters:22 },
  ],

  // Translations exposed in the picker. KJV + WEB come from bible-api.com,
  // the rest from bolls.life (CORS-enabled, free, all public-domain).
  // Every chapter is cached in localStorage forever.
  translations: [
    // ── English (8) ───────────────────────────────────────────────────
    // Each translation: primary `source`/`apiId` + optional `mirrors` array
    // for fallback resilience. `bundle` is a pre-baked corpus path for the
    // app to fetch once and store entirely offline (Phase C). The loader
    // tries bundle → primary source → mirrors → friendly error.
    { id:"kjv",    name:"King James",        year:"1611", license:"Public Domain", glyph:"KJV",  lang:"EN",
      source:"bible-api", apiId:"kjv",
      mirrors:[{kind:"bolls", apiId:"KJV"}],
      bundle:"/data/bibles/kjv.json", offlinePriority:"must" },
    { id:"asv",    name:"American Standard", year:"1901", license:"Public Domain", glyph:"ASV",  lang:"EN",
      source:"bolls",     apiId:"ASV",
      mirrors:[{kind:"bible-api", apiId:"asv"}] },
    { id:"bsb",    name:"Berean Standard",   year:"2022", license:"Public Domain", glyph:"BSB",  lang:"EN",
      source:"bolls",     apiId:"BSB" },
    { id:"web",    name:"World English",     year:"2000", license:"Public Domain", glyph:"WEB",  lang:"EN",
      source:"bible-api", apiId:"web",
      mirrors:[{kind:"bolls", apiId:"WEB"}] },
    { id:"ylt",    name:"Young's Literal",   year:"1898", license:"Public Domain", glyph:"YLT",  lang:"EN", source:"bolls", apiId:"YLT" },
    { id:"esv",    name:"English Standard",  year:"2001", license:"Crossway",      glyph:"ESV",  lang:"EN", source:"bolls", apiId:"ESV" },
    { id:"nasb",   name:"New American Std.", year:"1995", license:"Lockman Foundation", glyph:"NASB", lang:"EN", source:"bolls", apiId:"NASB" },
    { id:"geneva", name:"Geneva",            year:"1599", license:"Public Domain", glyph:"GNV",  lang:"EN", source:"bolls", apiId:"GNV" },
    { id:"drb",    name:"Douay-Rheims",      year:"1899", license:"Public Domain", glyph:"DRB",  lang:"EN", source:"bolls", apiId:"DRB" },

    // ── Spanish ───────────────────────────────────────────────────────
    { id:"rv1960", name:"Reina-Valera",      year:"1960", license:"Public Domain", glyph:"RV60", lang:"ES", source:"bolls", apiId:"RV1960" },
    { id:"rv2004", name:"Reina-Valera Gómez", year:"2004", license:"Public Domain", glyph:"RV04", lang:"ES", source:"bolls", apiId:"RV2004" },
    { id:"nvi-es", name:"Nueva Versión Internacional", year:"2015", license:"Bíblica", glyph:"NVI", lang:"ES", source:"bolls", apiId:"NVI" },
    { id:"lbla",   name:"La Biblia de las Américas", year:"1997", license:"Lockman Foundation", glyph:"LBLA", lang:"ES", source:"bolls", apiId:"LBLA" },

    // ── German ────────────────────────────────────────────────────────
    { id:"lut",    name:"Luther",            year:"1912", license:"Public Domain", glyph:"LUT",  lang:"DE", source:"bolls", apiId:"LUT" },
    { id:"elb",    name:"Elberfelder",       year:"1871", license:"Public Domain", glyph:"ELB",  lang:"DE", source:"bolls", apiId:"ELB" },
    { id:"sch",    name:"Schlachter",        year:"1951", license:"Genfer Bibelgesellschaft", glyph:"SCH", lang:"DE", source:"bolls", apiId:"SCH" },
    { id:"sch2000",name:"Schlachter 2000",   year:"2000", license:"Genfer Bibelgesellschaft", glyph:"S00", lang:"DE", source:"bolls", apiId:"S00" },

    // ── Portuguese ────────────────────────────────────────────────────
    { id:"arc",    name:"Almeida Revista e Corrigida", year:"2009", license:"Public Domain", glyph:"ARC", lang:"PT", source:"bolls", apiId:"ARC09" },
    { id:"ara",    name:"Almeida Revista e Atualizada", year:"1993", license:"SBB", glyph:"ARA", lang:"PT", source:"bolls", apiId:"ARA" },
    { id:"nvi-pt", name:"Nova Versão Internacional", year:"2000", license:"Bíblica", glyph:"NVI", lang:"PT", source:"bolls", apiId:"NVIPT" },
    { id:"acf",    name:"Almeida Corrigida Fiel", year:"2011", license:"SBTB", glyph:"ACF", lang:"PT", source:"bolls", apiId:"ACF11" },

    // ── French ────────────────────────────────────────────────────────
    { id:"lsg",    name:"Louis Segond",      year:"1910", license:"Public Domain", glyph:"LSG", lang:"FR", source:"bolls", apiId:"FRLSG" },
    { id:"darby-fr",name:"Darby (Français)", year:"1890", license:"Public Domain", glyph:"DBY", lang:"FR", source:"bolls", apiId:"FRDBY" },
    { id:"nbs",    name:"Nouvelle Bible Segond", year:"2002", license:"Société Biblique Française", glyph:"NBS", lang:"FR", source:"bolls", apiId:"NBS" },
    { id:"bds",    name:"Bible du Semeur",   year:"2015", license:"Bíblica", glyph:"BDS", lang:"FR", source:"bolls", apiId:"BDS" },

    // ── Latin ─────────────────────────────────────────────────────────
    { id:"clementine", name:"Vulgata Clementina", year:"1592", license:"Public Domain", glyph:"VUL", lang:"LA", source:"bible-api", apiId:"clementine",
      mirrors:[{kind:"bolls", apiId:"VULG"}] },
    { id:"vulg",   name:"Vulgata Clementina (Bolls)", year:"1592", license:"Public Domain", glyph:"VLG", lang:"LA", source:"bolls", apiId:"VULG" },

    // ── Hebrew (Tanakh + DHNT for NT) ─────────────────────────────────
    { id:"wlc",    name:"Westminster Leningrad (Vowels)", year:"1010", license:"Public Domain", glyph:"WLC", lang:"HE", source:"bolls", apiId:"WLC" },
    { id:"wlca",   name:"Westminster (Vowels + Strong)", year:"1010", license:"Public Domain", glyph:"WLCa", lang:"HE", source:"bolls", apiId:"WLCa" },
    { id:"hac",    name:"Aleppo Codex (Tanah)", year:"930", license:"Public Domain", glyph:"ALP", lang:"HE", source:"bolls", apiId:"HAC" },
    { id:"dhnt",   name:"Delitzsch NT (Hebrew)", year:"1877", license:"Public Domain", glyph:"DHNT", lang:"HE", source:"bolls", apiId:"DHNT" },

    // ── Greek (NT + LXX OT) ───────────────────────────────────────────
    { id:"tisch",  name:"Tischendorf NT (Greek)", year:"1869", license:"Public Domain", glyph:"TISCH", lang:"EL", source:"bolls", apiId:"TISCH" },
    { id:"tr",     name:"Textus Receptus (Greek)", year:"1624", license:"Public Domain", glyph:"TR", lang:"EL", source:"bolls", apiId:"TR" },
    { id:"lxx",    name:"Septuagint (Greek OT)",  year:"-200", license:"Public Domain", glyph:"LXX", lang:"EL", source:"bolls", apiId:"LXX" },

    // ── Hindi ─────────────────────────────────────────────────────────
    // bolls.life only carries one Hindi translation as of 2026: HIOV (Hindi
    // Old Version, re-edited by Bible Society of India). Earlier registry
    // entries (HHBD, IRV-HIN, ERVHI) returned empty arrays — removed.
    { id:"hi-hiov", name:"Hindi (BSI Re-edit)", year:"2024", license:"Bible Society India", glyph:"HIOV", lang:"HI", source:"bolls", apiId:"HIOV" },
  ],

  // Default starting passage when the app boots cold.
  defaultPassage: { bookId:"jhn", chapter:1 },

  // Seed panel content for John 1 — for any other passage the right-rail
  // panels regenerate via window.claude.complete (cached in localStorage).
  seedPanels: {
    "jhn.1": {
      title: "The Prologue · ΛΟΓΟΣ",
      subtitle: "On the Word made flesh",
      talmud: [
        { ref:"b. Chagigah 12a", heading:"On the Light that preceded the Sun",
          body:"Rabbi Elazar taught: with the light created on the first day a man could see from one end of the world to the other. When the Holy One foresaw the deeds of the generation of Enosh and of the Flood, He hid that light away — and it is reserved for the righteous in the world to come.",
          tag:"or ha-ganuz · ‘the hidden light’" },
        { ref:"Targum Onkelos · Gen 1:1", heading:"The Memra (Word) as Creator",
          body:"Where the Hebrew reads ‘In the beginning God created,’ the Aramaic Targums repeatedly substitute ‘by His Memra’ — by His Word — the Holy One created. The same Memra walks in the Garden, speaks at Sinai, and gathers the exiles.",
          tag:"memra · מימרא" },
        { ref:"b. Berakhot 55a", heading:"Three keys held by the Holy One",
          body:"Rabbi Yochanan said: three keys the Holy One keeps in His own hand, and entrusts to no messenger — the key of rain, the key of the womb, and the key of the resurrection of the dead.",
          tag:"shalosh maftechot" },
        { ref:"Genesis Rabbah 1:1", heading:"Wisdom as Architect",
          body:"‘The Torah declares: I was the working tool of the Holy One, blessed be He.’ As an architect builds not from his own mind but from the plan, so the Holy One looked into the Torah and created the world.",
          tag:"be-reshit · ‘with wisdom’" },
      ],
      commentary: [
        { from:"Patristic", author:"Augustine, Tract. in Ioh. 1",
          body:"‘In the beginning was the Word.’ Not made, for through Him all things were made. The Greek Logos is at once Word, Reason, and Account — the eternal speech by which the Father utters Himself." },
        { from:"Reformation", author:"Calvin, Comm. on John",
          body:"John, in calling the Son ‘Word,’ does not so much give Him a new name as press home His eternity and His office: He is the Father’s mind made articulate." },
        { from:"Modern", author:"F. F. Bruce, Gospel of John",
          body:"The Prologue echoes Genesis 1:1, staking the claim that the same creative speech that called light from darkness has now become flesh and pitched its tent (ἐσκήνωσεν) among us." },
        { from:"Devotional", author:"Practical note",
          body:"Verses 12–13 are the hinge: ‘to as many as received Him.’ Reception is not bloodline, not effort of flesh, not the will of any other man. The new birth is sourced in God alone." },
      ],
      gematria: [
        { term:"λόγος",     translit:"lógos",   meaning:"Word, Reason",      value:373,  system:"Greek isopsephy" },
        { term:"Θεός",      translit:"Theós",   meaning:"God",               value:284,  system:"Greek isopsephy" },
        { term:"ζωή",       translit:"zōē",     meaning:"Life",              value:815,  system:"Greek isopsephy" },
        { term:"φῶς",       translit:"phōs",    meaning:"Light",             value:1500, system:"Greek isopsephy" },
        { term:"Ἰησοῦς",    translit:"Iēsoûs",  meaning:"Jesus",             value:888,  system:"Greek isopsephy" },
        { term:"Χριστός",   translit:"Christós",meaning:"Christ / Anointed", value:1480, system:"Greek isopsephy" },
        { term:"בְּרֵאשִׁית",translit:"bereshit",meaning:"In the beginning",  value:913,  system:"Mispar Hechrachi" },
        { term:"אֱלֹהִים",  translit:"Elohim",  meaning:"God (plural)",      value:86,   system:"Mispar Hechrachi" },
        { term:"אוֹר",       translit:"or",      meaning:"Light",             value:207,  system:"Mispar Hechrachi" },
        { term:"אֶחָד",     translit:"echad",   meaning:"One",               value:13,   system:"Mispar Hechrachi" },
        { term:"אַהֲבָה",   translit:"ahavah",  meaning:"Love",              value:13,   system:"Mispar Hechrachi" },
        { term:"מֶמְרָא",   translit:"memra",   meaning:"Word (Aramaic)",    value:281,  system:"Mispar Hechrachi" },
      ],
      gematriaNotes: [
        "‘Echad’ (One) and ‘Ahavah’ (Love) share value 13 — and 13 + 13 = 26, the value of יהוה (YHWH). God is one in love.",
        "Ἰησοῦς = 888, set against the beast 666 (Rev 13:18) — fullness against falling-short.",
        "λόγος (373) is a prime; φῶς (1500) is built on 3 × 500 — light refracted through the trinitarian three.",
      ],
      gnosis: [
        { sigil:"✶", title:"Pleroma · The Fullness",
          body:"Read v. 16 with the gnostics: ‘of his fullness (πληρώματος) have all we received.’ The Pleroma is not a place but a density — the unfallen wholeness from which every aeon and soul issues." },
        { sigil:"☉", title:"Logos as Demiurge & Reconciler",
          body:"Classical gnosis splits the creator from the Father. John refuses the split: the same Logos that ‘made all things’ is also ‘in the bosom of the Father.’" },
        { sigil:"𓂀", title:"The Inner Light (v. 9)",
          body:"‘The true light that lighteth every man.’ Every soul carries a seed of the Logos. Scripture is the mirror by which the seed recognises itself." },
        { sigil:"✺", title:"Hidden Light · Or ha-Ganuz",
          body:"The Talmudic light hidden in Genesis is, for the mystics, identical with the light John names in v. 5. It shines now only in fragments, but is reserved whole for the world to come." },
        { sigil:"⟁", title:"Tabernacle (ἐσκήνωσεν)",
          body:"v. 14 — ‘dwelt’ is literally ‘pitched his tent.’ The Greek hides a Hebrew pun: שָׁכַן (shakhan), the root of Shekinah. The Word makes flesh into a Holy of Holies." },
      ],
      crossRefs: [
        { ref:"Gen 1:1–3",    note:"‘In the beginning… let there be light.’" },
        { ref:"Prov 8:22–31", note:"Wisdom present at creation." },
        { ref:"Col 1:15–17",  note:"All things created through Him, hold together in Him." },
        { ref:"Heb 1:1–3",    note:"God has spoken to us in His Son." },
        { ref:"1 John 1:1–4", note:"‘That which was from the beginning…’" },
        { ref:"Rev 19:13",    note:"‘His name is called The Word of God.’" },
      ],
    },
  },
};
