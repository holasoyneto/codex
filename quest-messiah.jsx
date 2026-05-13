// CODEX · Quest · Messiah in Prophecy — 50 core prophecies
// Self-contained guided study tour. Registers itself in
// window.CODEX_QUESTS so the ⚔ QUESTS button in the status bar
// surfaces it. When run, it mounts a full-screen overlay React tree
// with a sidebar of all 50 cards, a main reading panel for the
// current card, a right-side "Debate Ready" panel, and a sticky
// bottom navigation bar. Progress persists to localStorage so the
// user resumes where they left off.

(function () {
  const CARDS = [
    { id:"prophecy_01", section:"The Promised Seed & Royal Lineage", number:1, title:"Seed of the Woman", ot_reference:"Genesis 3:15", nt_reference:"Galatians 4:4; Matthew 1:18", talmud_references:["Bereshit Rabbah 12:6"], commentary:"The first gospel promise: the offspring of the woman will crush the serpent's head.", common_objection:"This is just a general statement about humans vs. snakes, not about a specific Messiah.", comeback:"Bereshit Rabbah and early Jewish tradition see this as the ultimate victory over evil. Jesus' birth from a woman and victory over Satan (Luke 10:18; Colossians 2:15) fulfill it precisely." },
    { id:"prophecy_02", section:"The Promised Seed & Royal Lineage", number:2, title:"Descendant of Abraham", ot_reference:"Genesis 12:3; 22:18", nt_reference:"Matthew 1:1; Galatians 3:16", talmud_references:["Targum Onkelos on Genesis 22:18"], commentary:"All nations of the earth will be blessed through Abraham's seed.", common_objection:"This refers to the Jewish people as a whole, not one individual.", comeback:"Galatians 3:16 notes the singular “seed.” Jesus, as the descendant of Abraham, brought the blessing of salvation to every nation." },
    { id:"prophecy_03", section:"The Promised Seed & Royal Lineage", number:3, title:"Descendant of Isaac", ot_reference:"Genesis 17:19; 21:12", nt_reference:"Luke 3:34; Romans 9:7", talmud_references:["Bereshit Rabbah 53:7"], commentary:"The promised seed is through Isaac, not Ishmael.", common_objection:"This is just about the Jewish lineage.", comeback:"Paul explicitly applies it to the line of promise fulfilled in Jesus (Romans 9:7). Ancient rabbis affirmed the chosen line through Isaac." },
    { id:"prophecy_04", section:"The Promised Seed & Royal Lineage", number:4, title:"Descendant of Jacob (Israel)", ot_reference:"Genesis 28:14", nt_reference:"Matthew 1:2; Luke 3:34", talmud_references:["Bereshit Rabbah 69:3"], commentary:"All families of the earth blessed through Jacob's offspring.", common_objection:"Collective reference to Israel.", comeback:"Jesus is the singular descendant through whom the blessing reaches the Gentiles, as confirmed in the NT genealogies." },
    { id:"prophecy_05", section:"The Promised Seed & Royal Lineage", number:5, title:"From the Tribe of Judah", ot_reference:"Genesis 49:10", nt_reference:"Luke 3:33; Hebrews 7:14", talmud_references:["Sanhedrin 98b"], commentary:"The scepter shall not depart from Judah until Shiloh comes.", common_objection:"Shiloh is not clearly messianic.", comeback:"Sanhedrin 98b and ancient rabbis identify Shiloh as the Messiah. Jesus is from the tribe of Judah." },
    { id:"prophecy_06", section:"The Promised Seed & Royal Lineage", number:6, title:"Descendant of Jesse", ot_reference:"Isaiah 11:1", nt_reference:"Matthew 1:6; Luke 3:32", talmud_references:["Sanhedrin 98a"], commentary:"A shoot shall come forth from the stump of Jesse.", common_objection:"This is about a future Davidic king, not yet fulfilled.", comeback:"Jesus is the direct descendant of Jesse (David's father) and is called the Root of Jesse in the NT." },
    { id:"prophecy_07", section:"The Promised Seed & Royal Lineage", number:7, title:"Son of David – Eternal Throne", ot_reference:"2 Samuel 7:12-16; Psalm 132:11", nt_reference:"Matthew 1:1,6; Luke 1:32-33", talmud_references:["Sanhedrin 98a"], commentary:"God promises David an eternal throne through his descendant.", common_objection:"Jesus never sat on a literal throne in Jerusalem.", comeback:"The NT presents Jesus as the rightful heir (Luke 1:32-33). Talmudic sources affirm the Davidic Messiah; the full reign is at His return." },
    { id:"prophecy_08", section:"The Promised Seed & Royal Lineage", number:8, title:"Eternal Kingdom", ot_reference:"2 Samuel 7:13; Isaiah 9:7", nt_reference:"Luke 1:32-33", talmud_references:["Sanhedrin 98a"], commentary:"His kingdom will have no end.", common_objection:"No eternal earthly kingdom yet.", comeback:"The promise is for an everlasting dominion fulfilled ultimately in Jesus' eternal reign." },
    { id:"prophecy_09", section:"The Promised Seed & Royal Lineage", number:9, title:"Virgin Birth & Mighty God", ot_reference:"Isaiah 7:14; 9:6", nt_reference:"Matthew 1:23; John 8:58", talmud_references:["Ancient expectations of divine Davidic king"], commentary:"Immanuel — God with us; called Mighty God, Everlasting Father.", common_objection:"‘Almah’ simply means young woman, not virgin.", comeback:"The pre-Christian Septuagint translates it as ‘parthenos’ (virgin). Matthew and the early church understood it literally." },
    { id:"prophecy_10", section:"The Promised Seed & Royal Lineage", number:10, title:"Preexistent – From Everlasting", ot_reference:"Micah 5:2", nt_reference:"John 1:1-2; 8:58", talmud_references:["Targum Micah 5:2"], commentary:"Whose goings forth are from long ago, from the days of eternity.", common_objection:"This is about the ruler's ancient lineage, not pre-existence.", comeback:"Targum and rabbinic sources see eternal origins; Jesus claimed pre-existence (‘Before Abraham was, I am’)." },
    { id:"prophecy_11", section:"Birth & Forerunner", number:11, title:"Born in Bethlehem", ot_reference:"Micah 5:2", nt_reference:"Matthew 2:1-6; Luke 2:4-7", talmud_references:["Targum Micah 5:2"], commentary:"Ruler from Bethlehem, origins from ancient times.", common_objection:"Many people could be born in Bethlehem.", comeback:"Combined with virgin birth, Davidic line, and Daniel 9 timing — statistically unique to Jesus." },
    { id:"prophecy_12", section:"Birth & Forerunner", number:12, title:"Born of a Virgin", ot_reference:"Isaiah 7:14", nt_reference:"Matthew 1:18-25; Luke 1:26-35", talmud_references:["Isaiah 7 interpretive traditions"], commentary:"The virgin shall conceive and bear a son called Immanuel.", common_objection:"Not messianic; mistranslated.", comeback:"Pre-Christian LXX and the eyewitness Gospel accounts confirm the literal virgin birth." },
    { id:"prophecy_13", section:"Birth & Forerunner", number:13, title:"Called Out of Egypt", ot_reference:"Hosea 11:1", nt_reference:"Matthew 2:13-15", talmud_references:["Targum Hosea 11:1"], commentary:"“Out of Egypt I called my son.”", common_objection:"About the nation of Israel, not Messiah.", comeback:"Matthew applies it typologically to Jesus, just as Israel was a type of the Messiah." },
    { id:"prophecy_14", section:"Birth & Forerunner", number:14, title:"Preceded by a Messenger", ot_reference:"Isaiah 40:3; Malachi 3:1", nt_reference:"Matthew 3:1-3; John 1:23", talmud_references:["Targum Isaiah 40:3"], commentary:"A voice crying in the wilderness to prepare the way.", common_objection:"John the Baptist was not Elijah.", comeback:"Jesus identified John as the Elijah figure (Matthew 11:14). The Targum sees this as messianic preparation." },
    { id:"prophecy_15", section:"Birth & Forerunner", number:15, title:"Elijah-like Forerunner", ot_reference:"Malachi 4:5-6", nt_reference:"Matthew 11:13-14; 17:10-13", talmud_references:["Talmudic Elijah traditions"], commentary:"Elijah will come before the great day of the Lord.", common_objection:"Elijah never returned literally.", comeback:"Jesus stated John the Baptist fulfilled this role in the spirit and power of Elijah." },
    { id:"prophecy_16", section:"Ministry & Character", number:16, title:"Prophet Like Moses", ot_reference:"Deuteronomy 18:15-18", nt_reference:"John 6:14; Acts 3:22", talmud_references:["Sanhedrin 98a"], commentary:"God will raise up a prophet like Moses from among the brothers.", common_objection:"This is about any prophet, not the Messiah.", comeback:"Peter and the early church applied it directly to Jesus; Talmud links it to the messianic era." },
    { id:"prophecy_17", section:"Ministry & Character", number:17, title:"Anointed by the Spirit", ot_reference:"Isaiah 61:1-2", nt_reference:"Luke 4:16-21", talmud_references:["Targum Isaiah 61"], commentary:"The Spirit of the Lord is upon me to preach good news.", common_objection:"Isaiah spoke of himself or the nation.", comeback:"Jesus publicly read and declared this fulfilled in Himself." },
    { id:"prophecy_18", section:"Ministry & Character", number:18, title:"Ministry in Galilee", ot_reference:"Isaiah 9:1-2", nt_reference:"Matthew 4:12-17", talmud_references:[], commentary:"Galilee of the nations will see a great light.", common_objection:"Not specifically messianic.", comeback:"Matthew records Jesus beginning His ministry exactly there, bringing light to the Gentiles." },
    { id:"prophecy_19", section:"Ministry & Character", number:19, title:"Performs Miracles", ot_reference:"Isaiah 35:5-6", nt_reference:"Matthew 11:4-5", talmud_references:[], commentary:"The blind see, the lame walk, the deaf hear.", common_objection:"Many prophets performed miracles.", comeback:"Jesus performed these exact signs and pointed to them as evidence of His identity." },
    { id:"prophecy_20", section:"Ministry & Character", number:20, title:"Teaches in Parables", ot_reference:"Psalm 78:2", nt_reference:"Matthew 13:34-35", talmud_references:[], commentary:"I will open my mouth in parables.", common_objection:"David wrote about himself.", comeback:"Matthew states this was fulfilled in Jesus' teaching method." },
    { id:"prophecy_21", section:"Ministry & Character", number:21, title:"Rides on a Donkey", ot_reference:"Zechariah 9:9", nt_reference:"Matthew 21:1-11", talmud_references:["Sanhedrin 98a"], commentary:"Humble king, riding on a donkey.", common_objection:"Not a unique or messianic act.", comeback:"Sanhedrin 98a contrasts the donkey with the clouds of heaven; Jesus fulfilled the humble entry." },
    { id:"prophecy_22", section:"Ministry & Character", number:22, title:"Rejected Cornerstone", ot_reference:"Psalm 118:22-24", nt_reference:"Matthew 21:42; Acts 4:11", talmud_references:[], commentary:"The stone the builders rejected has become the cornerstone.", common_objection:"About the nation of Israel.", comeback:"Jesus applied this to Himself; the NT writers saw it fulfilled in His rejection." },
    { id:"prophecy_23", section:"Ministry & Character", number:23, title:"Zealous for God's House", ot_reference:"Psalm 69:9", nt_reference:"John 2:17", talmud_references:[], commentary:"Zeal for Your house will consume me.", common_objection:"David's personal experience.", comeback:"John records this as fulfilled when Jesus cleansed the Temple." },
    { id:"prophecy_24", section:"Ministry & Character", number:24, title:"New Covenant", ot_reference:"Jeremiah 31:31-34", nt_reference:"Luke 22:20; Hebrews 8:6-13", talmud_references:[], commentary:"A new covenant written on hearts.", common_objection:"Still future for Israel.", comeback:"Jesus instituted it at the Last Supper; Hebrews shows its fulfillment." },
    { id:"prophecy_25", section:"Ministry & Character", number:25, title:"Brings Justice & Healing", ot_reference:"Isaiah 42:1-7", nt_reference:"Matthew 12:15-21", talmud_references:["Targum Isaiah 42"], commentary:"My servant… will bring justice to the nations.", common_objection:"About the nation of Israel.", comeback:"Matthew quotes it directly of Jesus' gentle ministry and healing." },
    { id:"prophecy_26", section:"Betrayal & Suffering", number:26, title:"Betrayed by a Friend", ot_reference:"Psalm 41:9", nt_reference:"John 13:18-21", talmud_references:[], commentary:"Even my close friend… has lifted his heel against me.", common_objection:"David's personal betrayal.", comeback:"Jesus quoted this of Judas' betrayal." },
    { id:"prophecy_27", section:"Betrayal & Suffering", number:27, title:"Betrayed for 30 Pieces of Silver", ot_reference:"Zechariah 11:12-13", nt_reference:"Matthew 26:14-15", talmud_references:[], commentary:"They paid me thirty pieces of silver… thrown to the potter.", common_objection:"Coincidence or not messianic.", comeback:"Exact amount, timing, and disposal match Judas' betrayal precisely." },
    { id:"prophecy_28", section:"Betrayal & Suffering", number:28, title:"Psalm of the Cross", ot_reference:"Psalm 22:1-18", nt_reference:"Matthew 27:46; John 19:23-37", talmud_references:[], commentary:"My God, why have You forsaken me?… They pierced my hands and feet.", common_objection:"David describing his own suffering.", comeback:"Crucifixion details (unknown when written) match Jesus exactly." },
    { id:"prophecy_29", section:"Betrayal & Suffering", number:29, title:"Silent Before Accusers", ot_reference:"Isaiah 53:7", nt_reference:"Matthew 27:12-14", talmud_references:["Sanhedrin 98b"], commentary:"He was oppressed and afflicted, yet He did not open His mouth.", common_objection:"Isaiah 53 is about Israel.", comeback:"Sanhedrin 98b applies Isaiah 53 to the Messiah; Jesus remained silent before Pilate." },
    { id:"prophecy_30", section:"Betrayal & Suffering", number:30, title:"Despised and Rejected", ot_reference:"Isaiah 53:3", nt_reference:"John 1:11", talmud_references:["Sanhedrin 98b"], commentary:"He was despised and rejected by men.", common_objection:"About the nation.", comeback:"Sanhedrin 98b links it to Messiah; Jesus was rejected by His own people." },
    { id:"prophecy_31", section:"Betrayal & Suffering", number:31, title:"Pierced for Transgressions", ot_reference:"Isaiah 53:4-6; Zechariah 12:10", nt_reference:"John 19:34-37; 1 Peter 2:24", talmud_references:["Sukkah 52a; Sanhedrin 98b"], commentary:"Wounded for our transgressions… they will look on the one they pierced.", common_objection:"Isaiah 53 is Israel; Zechariah 12 is not messianic.", comeback:"Sukkah 52a applies Zechariah 12:10 to the slain Messiah ben Joseph; Sanhedrin 98b applies Isaiah 53 to Messiah." },
    { id:"prophecy_32", section:"Betrayal & Suffering", number:32, title:"Vicarious Suffering", ot_reference:"Isaiah 53:4-12", nt_reference:"1 Peter 2:24", talmud_references:["Sanhedrin 98b"], commentary:"He bore our griefs… by His wounds we are healed.", common_objection:"Collective suffering of Israel.", comeback:"Sanhedrin 98b and early rabbinic sources apply Isaiah 53 to the Messiah's atoning suffering." },
    { id:"prophecy_33", section:"Betrayal & Suffering", number:33, title:"Hands and Feet Pierced", ot_reference:"Psalm 22:16-18", nt_reference:"John 19:23-24", talmud_references:[], commentary:"They pierced my hands and feet… cast lots for my clothing.", common_objection:"Poetic language about David.", comeback:"Written centuries before Roman crucifixion; fulfilled literally in Jesus." },
    { id:"prophecy_34", section:"Betrayal & Suffering", number:34, title:"Given Vinegar to Drink", ot_reference:"Psalm 69:21", nt_reference:"John 19:28-29", talmud_references:[], commentary:"They gave me vinegar for my thirst.", common_objection:"David's lament.", comeback:"Jesus cried ‘I thirst’ and was given vinegar exactly as prophesied." },
    { id:"prophecy_35", section:"Betrayal & Suffering", number:35, title:"Numbered with Transgressors", ot_reference:"Isaiah 53:12", nt_reference:"Luke 23:32", talmud_references:["Sanhedrin 98b"], commentary:"He was numbered with the transgressors.", common_objection:"About Israel.", comeback:"Sanhedrin 98b applies it to Messiah; Jesus was crucified between two criminals." },
    { id:"prophecy_36", section:"Death, Resurrection & Exaltation", number:36, title:"Buried with the Rich", ot_reference:"Isaiah 53:9", nt_reference:"Matthew 27:57-60", talmud_references:["Sanhedrin 98b"], commentary:"Assigned a grave with the rich.", common_objection:"Isaiah 53 is the nation of Israel.", comeback:"Sanhedrin 98b applies Isaiah 53 to Messiah; fulfilled in Joseph of Arimathea's tomb." },
    { id:"prophecy_37", section:"Death, Resurrection & Exaltation", number:37, title:"No Bones Broken", ot_reference:"Exodus 12:46; Psalm 34:20", nt_reference:"John 19:31-36", talmud_references:[], commentary:"Not one of His bones will be broken.", common_objection:"Passover lamb imagery only.", comeback:"John records the soldiers did not break Jesus' legs — exact fulfillment." },
    { id:"prophecy_38", section:"Death, Resurrection & Exaltation", number:38, title:"Resurrection – No Corruption", ot_reference:"Psalm 16:8-11", nt_reference:"Acts 2:25-32", talmud_references:[], commentary:"You will not abandon my soul to Sheol or let Your Holy One see corruption.", common_objection:"About David himself.", comeback:"Peter shows David died and saw corruption; Jesus rose on the third day." },
    { id:"prophecy_39", section:"Death, Resurrection & Exaltation", number:39, title:"Ascends to Heaven", ot_reference:"Psalm 68:18", nt_reference:"Acts 1:9; Ephesians 4:8", talmud_references:[], commentary:"You ascended on high… leading captives.", common_objection:"About the Ark or general praise.", comeback:"Paul applies it directly to Jesus' ascension." },
    { id:"prophecy_40", section:"Death, Resurrection & Exaltation", number:40, title:"Seated at God's Right Hand", ot_reference:"Psalm 110:1", nt_reference:"Mark 16:19; Hebrews 1:3", talmud_references:["Sanhedrin 98a"], commentary:"Sit at My right hand until I make Your enemies a footstool.", common_objection:"About David or a priest.", comeback:"Jesus quoted it of Himself; Talmud applies Davidic throne language to Messiah." },
    { id:"prophecy_41", section:"Death, Resurrection & Exaltation", number:41, title:"Priest Like Melchizedek", ot_reference:"Psalm 110:4", nt_reference:"Hebrews 5-7", talmud_references:["Sanhedrin 98a"], commentary:"You are a priest forever in the order of Melchizedek.", common_objection:"About David.", comeback:"Hebrews shows Jesus fulfills the eternal priesthood." },
    { id:"prophecy_42", section:"Death, Resurrection & Exaltation", number:42, title:"Suffering Servant Exalted", ot_reference:"Isaiah 52:13-53:12", nt_reference:"Philippians 2:6-11", talmud_references:["Sanhedrin 98b"], commentary:"He will be exalted after His suffering.", common_objection:"Isaiah 53 is Israel.", comeback:"Sanhedrin 98b applies the entire Servant Song to Messiah; Jesus' humiliation then exaltation matches perfectly." },
    { id:"prophecy_43", section:"Death, Resurrection & Exaltation", number:43, title:"Daniel's 70 Weeks", ot_reference:"Daniel 9:24-27", nt_reference:"Luke 3:1; John 12:23", talmud_references:["Megillah 3a; rabbinic timing discussions"], commentary:"Messiah will be cut off after 69 weeks (483 years).", common_objection:"Wrong calendar or not about Messiah.", comeback:"The precise countdown from Artaxerxes' decree points to Jesus' ministry and death." },
    { id:"prophecy_44", section:"Death, Resurrection & Exaltation", number:44, title:"Brings Forgiveness – New Covenant", ot_reference:"Jeremiah 31:31-34", nt_reference:"Hebrews 9-10", talmud_references:[], commentary:"I will forgive their iniquity and remember their sin no more.", common_objection:"Still future for national Israel.", comeback:"Jesus inaugurated the New Covenant; Hebrews shows its current fulfillment." },
    { id:"prophecy_45", section:"Death, Resurrection & Exaltation", number:45, title:"Light to the Gentiles", ot_reference:"Isaiah 49:6", nt_reference:"Acts 13:47; Luke 2:32", talmud_references:["Targum Isaiah 49"], commentary:"I will make You a light for the nations.", common_objection:"About the nation of Israel.", comeback:"The Targum and NT apply it to the Messiah bringing salvation to Gentiles." },
    { id:"prophecy_46", section:"Death, Resurrection & Exaltation", number:46, title:"Everlasting Dominion", ot_reference:"Daniel 7:13-14", nt_reference:"Matthew 26:64", talmud_references:[], commentary:"One like a son of man coming with the clouds… everlasting dominion.", common_objection:"About the nation or angelic figure.", comeback:"Jesus quoted this of Himself before the Sanhedrin." },
    { id:"prophecy_47", section:"Death, Resurrection & Exaltation", number:47, title:"Intercedes for Sinners", ot_reference:"Isaiah 53:12", nt_reference:"Luke 23:34; Romans 8:34", talmud_references:["Sanhedrin 98b"], commentary:"He interceded for the transgressors.", common_objection:"About Israel.", comeback:"Sanhedrin 98b applies it to Messiah; Jesus prayed for His crucifiers." },
    { id:"prophecy_48", section:"Death, Resurrection & Exaltation", number:48, title:"“I AM” Declarations", ot_reference:"Exodus 3:14; Isaiah 43:10-11", nt_reference:"John 8:58", talmud_references:[], commentary:"Before Abraham was, I am.", common_objection:"Not a direct claim to deity.", comeback:"Jesus used the divine name ‘I AM’ (ego eimi) that caused the crowd to try to stone Him." },
    { id:"prophecy_49", section:"Death, Resurrection & Exaltation", number:49, title:"Victory Over Death", ot_reference:"Isaiah 25:8; Hosea 13:14", nt_reference:"1 Corinthians 15:54-57", talmud_references:[], commentary:"He will swallow up death forever.", common_objection:"Future national deliverance.", comeback:"Paul quotes it as fulfilled in Jesus' resurrection victory." },
    { id:"prophecy_50", section:"Death, Resurrection & Exaltation", number:50, title:"All Nations Blessed & Worship", ot_reference:"Psalm 72:17; Isaiah 11:10", nt_reference:"Revelation 5:9-14; Galatians 3:8", talmud_references:["Sanhedrin 98a"], commentary:"All nations will be blessed in Him; the Root of Jesse will be a banner.", common_objection:"Still future.", comeback:"The global worship of Jesus in Revelation fulfills the universal blessing promised." },
  ];

  const QUEST_ID = "messiah-50";
  const PROGRESS_KEY = `codex.quest.${QUEST_ID}.progress`;
  function loadProgress() {
    try { return { studied: [], lastIdx: 0, ...(JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null") || {}) }; }
    catch { return { studied: [], lastIdx: 0 }; }
  }
  function saveProgress(p) { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {} }

  // Group cards by section so the sidebar can collapse them.
  function groupBySection(cards) {
    const groups = [];
    let cur = null;
    for (const c of cards) {
      if (!cur || cur.section !== c.section) { cur = { section: c.section, cards: [] }; groups.push(cur); }
      cur.cards.push(c);
    }
    return groups;
  }

  // Split a multi-ref string ("Genesis 12:3; 22:18") into individual refs.
  function splitRefs(s) {
    if (!s) return [];
    return s.split(/;\s*/).map(x => x.trim()).filter(Boolean);
  }
  // Detect if a string lacks a book name (e.g. "22:18" alone) and inherit
  // from the previous ref's book. Used for the second part of "Genesis 12:3; 22:18".
  function expandRefs(refStr) {
    const parts = splitRefs(refStr);
    let lastBook = null;
    return parts.map(p => {
      if (/^\d/.test(p) && lastBook && /^\d/.test(p[0])) {
        // Pure chapter:verse form — prefix with last seen book
        return lastBook + " " + p;
      }
      const m = p.match(/^([1-3]?\s*[A-Za-z]+)/);
      if (m) lastBook = m[1].trim();
      return p;
    });
  }

  function RefLink({ children, onAfterJump }) {
    const ref = String(children).trim();
    const onClick = (e) => {
      e.preventDefault();
      if (window.codexJumpToRef) window.codexJumpToRef(ref);
      // Close the tour so the user actually sees the chapter we jumped to.
      // Position persists; they can re-launch via ⚔ QUESTS to resume.
      if (typeof onAfterJump === "function") onAfterJump();
    };
    return React.createElement(
      "a",
      { className: "cx-q-ref", href: "#", onClick, title: `Open ${ref} in the reader (closes tour — re-open from QUESTS to resume)` },
      ref
    );
  }

  function RefList({ refs, onAfterJump }) {
    const list = expandRefs(refs);
    return React.createElement(
      "span",
      { className: "cx-q-reflist" },
      ...list.flatMap((r, i) => i === 0 ? [React.createElement(RefLink, { key: i, onAfterJump }, r)]
        : [React.createElement("span", { key: `s${i}`, className: "cx-q-sep" }, " · "), React.createElement(RefLink, { key: i, onAfterJump }, r)]
      ),
    );
  }

  function QuestRunner({ onClose }) {
    const { useState, useEffect, useRef } = React;
    const [progress, setProgress] = useState(loadProgress);
    const [idx, setIdx] = useState(progress.lastIdx || 0);
    const [debateOpen, setDebateOpen] = useState(true);
    const [collapsed, setCollapsed] = useState(() => new Set());
    // Sidebar visibility — defaults open on desktop, closed as a drawer on
    // mobile/tablet. Tracked alongside live viewport width so the scrim
    // mounts correctly when the user resizes across the 880px breakpoint
    // (otherwise the initial useState snapshot is stale on resize).
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 880);
    const [vw, setVw] = useState(() => window.innerWidth);
    useEffect(() => {
      const onResize = () => setVw(window.innerWidth);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, []);

    // Persist progress whenever idx or studied changes
    useEffect(() => { saveProgress({ ...progress, lastIdx: idx }); }, [idx]);

    const card = CARDS[idx];
    const groups = groupBySection(CARDS);
    const studiedSet = new Set(progress.studied);
    const isStudied = studiedSet.has(card.id);

    const toggleStudied = () => {
      const next = new Set(studiedSet);
      if (next.has(card.id)) next.delete(card.id); else next.add(card.id);
      const np = { ...progress, studied: [...next], lastIdx: idx };
      setProgress(np); saveProgress(np);
    };
    const goNext = () => { if (idx < CARDS.length - 1) setIdx(i => i + 1); };
    const goPrev = () => { if (idx > 0) setIdx(i => i - 1); };
    const toggleSection = (s) => {
      const next = new Set(collapsed);
      if (next.has(s)) next.delete(s); else next.add(s);
      setCollapsed(next);
    };

    // ESC closes
    useEffect(() => {
      const onKey = (e) => {
        if (e.key === "Escape") onClose();
        else if (e.key === "ArrowRight") goNext();
        else if (e.key === "ArrowLeft") goPrev();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [idx]);

    const studiedCount = progress.studied.length;
    const isFinal = idx === CARDS.length - 1 && isStudied && studiedCount === CARDS.length;

    return React.createElement(
      "div",
      { className: `cx-q-overlay ${sidebarOpen ? "is-side-open" : ""}`, role: "dialog", "aria-label": "Side quest · Messiah in Prophecy" },
      // Header strip
      React.createElement("header", { className: "cx-q-head" },
        React.createElement("button", {
          className: "cx-q-side-toggle",
          onClick: () => setSidebarOpen(o => !o),
          "aria-label": sidebarOpen ? "Hide index" : "Show index",
          title: "Toggle index (≡)",
        }, "≡"),
        React.createElement("span", { className: "cx-q-tag" }, "SIDE QUEST"),
        React.createElement("h2", { className: "cx-q-title-bar" },
          React.createElement("span", { className: "cx-q-title-full" }, "Messiah in Prophecy · 50 Core Prophecies"),
          React.createElement("span", { className: "cx-q-title-short" }, "Messiah · 50"),
        ),
        React.createElement("span", { className: "cx-q-progress" }, `${studiedCount} / ${CARDS.length}`),
        React.createElement("button", {
          className: "cx-q-close",
          onClick: onClose,
          "aria-label": "Close tour (Esc)",
          title: "Close tour · Esc",
        }, "✕"),
      ),
      // Mobile/tablet sidebar scrim — covers main content while drawer is open
      sidebarOpen && vw < 880 ? React.createElement("div", {
        className: "cx-q-scrim",
        onClick: () => setSidebarOpen(false),
      }) : null,
      // Body grid
      React.createElement("div", { className: "cx-q-body" },
        // Left sidebar
        React.createElement("nav", { className: `cx-q-sidebar ${sidebarOpen ? "is-open" : ""}`, "aria-label": "Prophecy index" },
          ...groups.map((g, gi) =>
            React.createElement("section", { key: gi, className: `cx-q-sect ${collapsed.has(g.section) ? "is-collapsed" : ""}` },
              React.createElement("button", { className: "cx-q-sect-h", onClick: () => toggleSection(g.section), "aria-expanded": !collapsed.has(g.section) },
                React.createElement("span", { className: "cx-q-sect-arr" }, collapsed.has(g.section) ? "▸" : "▾"),
                React.createElement("span", { className: "cx-q-sect-name" }, g.section),
                React.createElement("span", { className: "cx-q-sect-count" }, g.cards.length),
              ),
              collapsed.has(g.section) ? null : React.createElement("ul", { className: "cx-q-list" },
                ...g.cards.map(c => {
                  const cIdx = CARDS.indexOf(c);
                  const studied = studiedSet.has(c.id);
                  const active = cIdx === idx;
                  return React.createElement("li", { key: c.id },
                    React.createElement("button", {
                      className: `cx-q-item ${active ? "is-active" : ""} ${studied ? "is-studied" : ""}`,
                      onClick: () => {
                        setIdx(cIdx);
                        if (vw < 880) setSidebarOpen(false);
                      },
                    },
                      React.createElement("span", { className: "cx-q-item-n" }, String(c.number).padStart(2, "0")),
                      React.createElement("span", { className: "cx-q-item-title" }, c.title),
                      React.createElement("span", { className: "cx-q-item-ref" }, c.ot_reference.split(";")[0]),
                      studied ? React.createElement("span", { className: "cx-q-item-check" }, "✓") : null,
                    ),
                  );
                }),
              ),
            )
          ),
        ),
        // Main panel
        React.createElement("main", { className: "cx-q-main" },
          isFinal ? React.createElement("div", { className: "cx-q-completion" },
            React.createElement("h1", null, "Tour Complete"),
            React.createElement("p", null, "You have now studied all 50 core messianic prophecies with their fulfillments and supporting Talmudic references. You are equipped to engage any discussion on the Messiah with clarity and textual depth."),
            React.createElement("button", { className: "cx-q-return", onClick: onClose }, "Return to Library"),
          ) : null,
          React.createElement("article", { className: "cx-q-card" },
            React.createElement("header", { className: "cx-q-card-h" },
              React.createElement("span", { className: "cx-q-card-num" }, String(card.number).padStart(2, "0")),
              React.createElement("span", { className: "cx-q-card-section" }, card.section),
            ),
            React.createElement("h1", { className: "cx-q-card-title" }, card.title),
            React.createElement("div", { className: "cx-q-card-refs" },
              React.createElement("div", { className: "cx-q-card-ref-row" },
                React.createElement("span", { className: "cx-q-ref-label" }, "OT"),
                React.createElement(RefList, { refs: card.ot_reference, onAfterJump: onClose }),
              ),
              React.createElement("div", { className: "cx-q-card-ref-row" },
                React.createElement("span", { className: "cx-q-ref-label" }, "NT"),
                React.createElement(RefList, { refs: card.nt_reference, onAfterJump: onClose }),
              ),
              card.talmud_references && card.talmud_references.length ?
                React.createElement("div", { className: "cx-q-card-ref-row" },
                  React.createElement("span", { className: "cx-q-ref-label" }, "Talmud"),
                  React.createElement("span", { className: "cx-q-talmud" }, card.talmud_references.join(" · ")),
                ) : null,
            ),
            React.createElement("p", { className: "cx-q-card-commentary" }, card.commentary),
          ),
          // Debate panel
          React.createElement("section", { className: `cx-q-debate ${debateOpen ? "is-open" : ""}` },
            React.createElement("button", { className: "cx-q-debate-toggle", onClick: () => setDebateOpen(o => !o) },
              React.createElement("span", { className: "cx-q-debate-arr" }, debateOpen ? "▾" : "▸"),
              "Debate Ready",
            ),
            debateOpen ? React.createElement("div", { className: "cx-q-debate-body" },
              React.createElement("div", { className: "cx-q-debate-block" },
                React.createElement("h4", null, "Common objection"),
                React.createElement("p", null, card.common_objection),
              ),
              React.createElement("div", { className: "cx-q-debate-block is-comeback" },
                React.createElement("h4", null, "Comeback"),
                React.createElement("p", null, card.comeback),
              ),
            ) : null,
          ),
        ),
      ),
      // Bottom nav
      React.createElement("footer", { className: "cx-q-foot" },
        React.createElement("button", { className: "cx-q-nav cx-q-prev", onClick: goPrev, disabled: idx === 0 }, "← Previous"),
        React.createElement("button", { className: `cx-q-nav cx-q-mark ${isStudied ? "is-on" : ""}`, onClick: toggleStudied },
          isStudied ? "✓ Studied · click to unmark" : "Mark as Studied",
        ),
        React.createElement("button", { className: "cx-q-nav cx-q-next", onClick: goNext, disabled: idx === CARDS.length - 1 }, "Next →"),
      ),
    );
  }

  function launch() {
    let host = document.getElementById("cx-quest-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "cx-quest-host";
      document.body.appendChild(host);
    }
    const root = ReactDOM.createRoot(host);
    const close = () => { root.unmount(); host.remove(); };
    root.render(React.createElement(QuestRunner, { onClose: close }));
  }

  // Register
  window.CODEX_QUESTS = window.CODEX_QUESTS || [];
  // Avoid double-registration on hot-reload
  const existingIdx = window.CODEX_QUESTS.findIndex(q => q.id === QUEST_ID);
  const entry = {
    id: QUEST_ID,
    glyph: "✦",
    title: "Messiah in Prophecy · 50 Core Prophecies",
    blurb: "Sequential study of OT prophecies and their NT fulfillments, with Talmudic references and ready-to-use debate refutations.",
    run: launch,
  };
  if (existingIdx >= 0) window.CODEX_QUESTS[existingIdx] = entry;
  else window.CODEX_QUESTS.push(entry);
})();
