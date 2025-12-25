/**
 * Central catalogue of uniforms, ranks, groups, qualifications, and awards used by the
 * Project Uniform renderer. Provides frozen metadata with tooltip geometry and asset paths.
 */
import { puPaths } from "discourse/plugins/discourse-project-uniform/discourse/lib/pu-utils";

// ---------- helpers ----------
// Recursively freezes nested objects to prevent accidental mutation.
const deepFreeze = (object) => {
  Object.freeze(object);
  Object.values(object).forEach((value) => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return object;
};

// Creates a tooltip rectangle descriptor for canvas hit testing.
const rect = (x, y, width, height) => ({ x, y, width, height });

const rankAreas = deepFreeze({
  // BA rank regions
  officerCollar: [rect(80, 18, 100, 52), rect(520, 18, 80, 47)],
  wo2Sleeve: [rect(15, 495, 45, 60), rect(635, 495, 45, 58)],
  csgtSleeve: [rect(38, 195, 52, 110), rect(607, 193, 60, 105)],
  ssgtSleeve: [rect(38, 195, 52, 110), rect(607, 193, 58, 102)],
  sgtSleeve: [rect(38, 210, 52, 90), rect(607, 208, 60, 85)],
  cplSleeve: [rect(38, 210, 52, 75), rect(607, 208, 60, 72)],
  lcplSleeve: [rect(40, 215, 52, 55), rect(607, 208, 58, 55)],
  ptegnrSleeve: [rect(38, 195, 52, 110), rect(607, 193, 60, 105)],
  // RAF rank regions
  sqnldrSleeve: [rect(16, 588, 120, 56), rect(556, 592, 118, 58)],
  fltltSleeve: [rect(16, 596, 120, 54), rect(556, 602, 118, 54)],
  fgoffSleeve: [rect(16, 600, 120, 40), rect(556, 604, 118, 42)],
  pltoffSleeve: [rect(16, 600, 120, 40), rect(556, 604, 118, 42)],
  officerCadetCollar: [rect(182, 12, 62, 60), rect(448, 12, 60, 60)],
});

// Builds a rank metadata object with associated asset and tooltip information.
const rank = (name, category, imageFile, tooltipFile, tipText, areas, service = "BA") => ({
  name,
  category,              // "officer" | "enlisted"
  service,               // "BA" | "RAF"
  imageKey: imageFile ? puPaths.rank(imageFile) : null,
  tooltipImage: tooltipFile ? puPaths.tooltipRank(tooltipFile) : null,
  tooltipText: tipText || "",
  tooltipAreas: areas ?? null,
});

// Builds a lanyard configuration with qualifying groups and tooltip content.
const lanyardCfg = (image, groups, tipImage, tipText) => ({
  imageKey: puPaths.lanyard(image),
  groups,
  tooltipImage: puPaths.tooltipLanyard(tipImage),
  tooltipText: tipText,
});

export const csaLeadershipOverrideByRibbonCount = deepFreeze({
  0: {
    imagePlacement: { x: 190, y: 208 },
    tooltipAreas: [rect(193, 212, 34, 31)],
  },
  1: {
    imagePlacement: { x: 191, y: 195 },
    tooltipAreas: [rect(194, 198, 34, 30)],
  },
  2: {
    imagePlacement: { x: 196, y: 194 },
    tooltipAreas: [rect(199, 197, 34, 31)],
  },
  3: {
    imagePlacement: { x: 196, y: 194 },
    tooltipAreas: [rect(199, 197, 34, 31)],
  },
});

export const csaLeadershipQualificationNames = Object.freeze([
  "FTCC",
  "SCBC",
  "CC",
  "Commander's Course",
  "PSBC",
  "PCBC",
]);

export const leadershipQualificationAliases = Object.freeze({
  "Commander's Course": "CC",
});

// Expands a CSA ribbon name into its leadership alias variants.
const csaAliasSet = (name) => [name, `${name}_IC`, `${name}_2IC`];

// CSA ribbons now support service-specific art variants (e.g., RAF vs BA).
// Describes a CSA ribbon including assets, tooltip content, and group qualifiers.
const csaRibbon = (name, ribbonFile, tooltipFile, tipText, serviceVariants = {}) => ({
  name,
  imageKey: puPaths.csaRibbon(ribbonFile),
  tooltipImage: puPaths.csaTooltip(tooltipFile),
  tooltipText: tipText,
  serviceVariants,
  qualifyingGroups: csaAliasSet(name),
});

// Constructs a qualification metadata object with tooltip placement variants.
const qual = (
  name,
  imageFile,
  restrictedRanks,
  tipImg,
  tipText,
  areas,
  serviceVariants = {},
  ribbonRowVariants = {},
  aliases = []
) => ({
  name,
  aliases,
  imageKey: puPaths.qual(imageFile),
  restrictedRanks,
  tooltipImage: puPaths.tooltipQual(tipImg),
  tooltipText: tipText,
  tooltipAreas: areas,
  serviceVariants,       // e.g. { RAF: puPaths.qual("paratrooper_raf__v2.png") }
  ribbonRowVariants,     // e.g. { 0: puPaths.qual("juniorpilot_pos0.png"), 1: ..., 2: ..., 3: ... }
});

const award = (name, ribbonFile, medalFile, tipText) => ({
  name,
  imageKey: puPaths.ribbon(ribbonFile),
  tooltipImage: puPaths.medal(medalFile),
  tooltipText: tipText,
});

// ---------- backgrounds ----------
export const backgroundImages = deepFreeze({
  officer: puPaths.uniform("ba_officers_uniform__v2.png"),
  enlisted: puPaths.uniform("ba_enlisted_uniform__v2.png"),
  rafOfficer: puPaths.uniform("raf_officers_uniform__v2.png"),
  rafEnlisted: puPaths.uniform("raf_enlisted_uniform__v2.png"),
  recruit: puPaths.uniform("recruit_combat_dress.png"),
});

// ---------- ranks ----------
export const ranks = deepFreeze([
  // BA Officers
  rank(
    "Major",
    "officer",
    "maj__v2.png",
    "maj__v2.jpg",
    "<center><b>Major</b></center><br>Senior company-grade officer. Typically commands a company.",
    rankAreas.officerCollar
  ),
  rank(
    "Captain",
    "officer",
    "capt__v2.png",
    "capt__v2.jpg",
    "<center><b>Captain</b></center><br>Experienced officer.<br>Typically Company Second-in-Command or commander of a specialist troop/platoon.",
    rankAreas.officerCollar
  ),
  rank(
    "Lieutenant",
    "officer",
    "lt__v2.png",
    "lt__v2.jpg",
    "<center><b>Lieutenant</b></center><br>Platoon Commander.<br>Responsible for leading platoon operations, mission planning, coordination and control.",
    rankAreas.officerCollar
  ),
  rank(
    "Second_Lieutenant",
    "officer",
    "2lt__v2.png",
    "2lt__v2.jpg",
    "<center><b>Second Lieutenant</b></center><br>Junior platoon commander.<br>Leads under mentorship,<br>focusing on fundamentals of command in the field.",
    rankAreas.officerCollar
  ),
  rank(
    "Acting_Second_Lieutenant",
    "officer",
    "2lt__v2.png",
    "2lt__v2.jpg",
    "<center><b>Acting Second Lieutenant</b></center><br>Probationary rank.<br>Leads a platoon pending confirmation of rank by passing the Platoon Commander's Battle Course (PCBC).",
    rankAreas.officerCollar
  ),

  // BA Warrant Officers & SNCOs
  rank(
    "Warrant_Officer_Class_2",
    "enlisted",
    "wo2__v2.png",
    "wo2__v2.jpg",
    "<center><b>Warrant Officer Class 2</b></center><br>Senior soldier, normally at<br>company level. Discipline, standards, drill and soldiering expertise.",
    rankAreas.wo2Sleeve
  ),
  rank(
    "Colour_Sergeant",
    "enlisted",
    "csgt__v2.png",
    "csgt__v2.jpg",
    "<center><b>Colour Sergeant</b></center><br>Senior NCO.<br>Typically Platoon Sergeant or Company Quartermaster Sergeant. Training, discipline, logistics and oversight.",
    rankAreas.csgtSleeve
  ),
  rank(
    "Staff_Sergeant",
    "enlisted",
    "ssgt__v2.png",
    "ssgt__v2.jpg",
    "<center><b>Staff Sergeant</b></center><br>Senior NCO.<br>Second-in-command of a troop or equivalent, or in key administrative and logistic appointments. Supervision, training and discipline.",
    rankAreas.ssgtSleeve
  ),
  rank(
    "Sergeant",
    "enlisted",
    "sgt__v2.png",
    "sgt__v2.jpg",
    "<center><b>Sergeant</b></center><br>Serves as Platoon Sergeant or<br>leads specialist teams. Training, discipline and tactical control.",
    rankAreas.sgtSleeve
  ),
  rank(
    "Acting_Sergeant",
    "enlisted",
    "sgt__v2.png",
    "sgt__v2.jpg",
    "<center><b>Acting Sergeant</b></center><br>Probationary rank undertaking Platoon Sergeant duties pending confirmation of rank by passing the Platoon Sergeants Battle Course.",
    rankAreas.sgtSleeve
  ),

  // BA JNCOs
  rank(
    "Corporal",
    "enlisted",
    "cpl__v2.png",
    "cpl__v2.jpg",
    "<center><b>Corporal</b></center><br>Commander of a section (7-12 soldiers), or a smaller specialised team. Responsible for leading, training, and tactical control.",
    rankAreas.cplSleeve
  ),
  rank(
    "Bombardier",
    "enlisted",
    "cpl__v2.png",
    "cpl__v2.jpg",
    "<center><b>Bombardier</b></center><br>Commands a gun detachment or leads a Fire Support Team. Responsible for crew direction, firing drills and effective weapon employment, or coordinating supporting fires and air assets.",
    rankAreas.cplSleeve
  ),
  rank(
    "Acting_Corporal",
    "enlisted",
    "cpl__v2.png",
    "cpl__v2.jpg",
    "<center><b>Acting Corporal</b></center><br>Junior NCO undertaking Corporal duties on a probationary basis pending confirmation of rank by passing the Section Commanders Battle Course (SCBC).",
    rankAreas.cplSleeve
  ),
  rank(
    "Acting_Bombardier",
    "enlisted",
    "cpl__v2.png",
    "cpl__v2.jpg",
    "<center><b>Acting Bombardier</b></center><br>Probationary Royal Artillery JNCO. Undertakes gun detachment command or Fire Support Team leadership duties<br>pending confirmation of rank by passing the Section Commander's Battle Course (SCBC).",
    rankAreas.cplSleeve
  ),
  rank(
    "Lance_Corporal",
    "enlisted",
    "lcpl__v2.png",
    "lcpl__v2.jpg",
    "<center><b>Lance Corporal</b></center><br>Fire team leader and junior commander. Assists the section commander with section control, routine tasks and<br>mentoring of privates.",
    rankAreas.lcplSleeve
  ),
  rank(
    "Lance_Bombardier",
    "enlisted",
    "lcpl__v2.png",
    "lcpl__v2.jpg",
    "<center><b>Lance Bombardier</b></center><br>Royal Artillery Junior JNCO. Second in command of a gun detachment, leads small teams, and develops leadership skills under supervision.",
    rankAreas.lcplSleeve
  ),
  rank(
    "Acting_Lance_Corporal",
    "enlisted",
    "lcpl__v2.png",
    "lcpl__v2.jpg",
    "<center><b>Acting Lance Corporal</b></center><br>Probationary junior JNCO undertaking fire team leadership duties pending confirmation of<br>rank by passing the<br>Fire Team Commanders Course (FTCC).",
    rankAreas.lcplSleeve
  ),
  rank(
    "Acting_Lance_Bombardier",
    "enlisted",
    "lcpl__v2.png",
    "lcpl__v2.jpg",
    "<center><b>Acting Lance Bombardier</b></center><br>Probationary Royal Artillery junior JNCO. Undertakes gun detachment 2IC or Fire Support Team duties pending confirmation of rank by passing the Fire Team Commander's Course (FTCC).",
    rankAreas.lcplSleeve
  ),

  // BA Privates
  rank(
    "Private",
    "enlisted",
    null,
    "pte__v2.jpg",
    "<center><b>Private</b></center><br>Trained soldier and core of<br>the platoon. Executes section-level tasks and drills.",
    rankAreas.ptegnrSleeve
  ),
  rank(
    "Gunner",
    "enlisted",
    null,
    "gnr__v2.jpg",
    "<center><b>Gunner</b></center><br>Royal Artillery private soldier. Operates guns, fire support systems and associated equipment, or serves as a member of a Fire Support Team.",
    rankAreas.ptegnrSleeve
  ),
  rank(
    "Recruit",
    "enlisted",
    null,
    "pte__v2.jpg",
    "<center><b>Recruit</b></center><br>New entrant undergoing basic training and induction. Not yet a fully trained soldier, progressing towards Private rank on completion of Phase 1 training.",
    rankAreas.ptegnrSleeve
  ),

  // RAF Officers
  rank(
    "Squadron_Leader",
    "officer",
    "sqnldr__v2.png",
    "sqnldr__v2.jpg",
    "<center><b>Squadron Leader</b></center><br>Officer Commanding within Joint Helicopter Command (JHC), attached to 16 Air Assault Brigade. Senior pilot responsible for operational direction, flying standards and overall leadership.",
    rankAreas.sqnldrSleeve,
    "RAF"
  ),
  rank(
    "Flight_Lieutenant",
    "officer",
    "fltlt__v2.png",
    "fltlt__v2.jpg",
    "<center><b>Flight Lieutenant</b></center><br>Normally second-in-command within Joint Helicopter Command (JHC), attached to 16 Air Assault Brigade. Senior pilot responsible for planning and tasking, and acting IC when required.",
    rankAreas.fltltSleeve,
    "RAF"
  ),
  rank(
    "Flying_Officer",
    "officer",
    "fgoff__v3.png",
    "fgoff__v3.jpg",
    "<center><b>Flying Officer</b></center><br>Experienced Pilot qualified for mission and flight lead duties. Executes sorties and mentors pilots.",
    rankAreas.fgoffSleeve,
    "RAF"
  ),
  rank(
    "Pilot_Officer",
    "officer",
    "pltoff__v2.png",
    "pltoff__v2.jpg",
    "<center><b>Pilot Officer</b></center><br>Executes tasked piloting sorties and aircrew duties.",
    rankAreas.pltoffSleeve,
    "RAF"
  ),
  rank(
    "Officer_Cadet",
    "officer",
    "offcdt__v2.png",
    "offcdt__v2.png",
    "<center><b>Officer Cadet</b></center><br>Officer-in-training within Joint Helicopter Command (JHC).<br>Undergoes initial officer training and supervised aircrew duties.",
    rankAreas.officerCadetCollar,
    "RAF"
  ),

  // RAF Aircrew NCOs
  rank(
    "Flight_Sergeant_Aircrew",
    "enlisted",
    "fsacr__v2.png",
    "fsacr__v2.png",
    "<center><b>Flight Sergeant Aircrew</b></center><br>Senior Joint Helicopter Command<br>NCO aircrew. Leads crew discipline, standards and mission execution.",
    rankAreas.ssgtSleeve,
    "RAF"
  ),
  rank(
    "Sergeant_Aircrew",
    "enlisted",
    "sacr__v2.png",
    "sacr__v2.png",
    "<center><b>Sergeant Aircrew</b></center><br>Joint Helicopter Command<br>NCO aircrew. Operates and manages onboard systems and crew tasks.",
    rankAreas.sgtSleeve,
    "RAF"
  ),
]);


export const officerRanks = deepFreeze(ranks.filter(r => r.category === "officer").map(r => r.name));
export const enlistedRanks = deepFreeze(ranks.filter(r => r.category === "enlisted").map(r => r.name));
export const rankToImageMap = deepFreeze(Object.fromEntries(ranks.map(r => [r.name, r.imageKey])));

// ---------- groups/images ----------
export const paraCollarImageEnlisted = puPaths.group("para__v2.png");
export const paraCollarImageOfficer = puPaths.group("para-officer__v2.png");

const PARA_TOOLTIP_TEXT = "<center><b>The Parachute Regiment</b></center><br>The airborne infantry of the British Army, skilled in rapid deployment by parachute or air assault to conduct high-intensity combat, humanitarian relief, and special operations worldwide.";

export const paraTooltipEnlisted = deepFreeze({
  tooltipImage: puPaths.group("para-tooltip__v2.png"),
  tooltipText: PARA_TOOLTIP_TEXT,
  tooltipAreas: [
    { x: 183, y: 30, width: 37, height: 35 },
    { x: 470, y: 27, width: 38, height: 35 },
  ],
});

export const paraTooltipOfficer = deepFreeze({
  tooltipImage: puPaths.group("para-tooltip-officer__v2.png"),
  tooltipText: PARA_TOOLTIP_TEXT,
  tooltipAreas: [
    { x: 183, y: 30, width: 37, height: 35 },
    { x: 470, y: 27, width: 38, height: 35 },
  ],
});

const csmrTooltip = deepFreeze({
  tooltipImage: puPaths.group("ramc__v2.png"),
  tooltipText:
    "<center><b>The Royal Army Medical Service</b></center><br>The British Army's unified corps responsible for providing medical support to personnel worldwide.",
  tooltipAreas: [
    { x: 183, y: 27, width: 37, height: 35 },
    { x: 477, y: 27, width: 38, height: 35 },
  ],
});

const rhaTooltip = deepFreeze({
  tooltipImage: puPaths.group("royal_artillery__v2.png"),
  tooltipText:
    "<center><b>The Royal Regiment of Artillery</b></center><br>The artillery arm of the British Army, responsible for providing firepower and battlefield surveillance using guns, rockets, missiles, and high-tech sensors",
  tooltipAreas: [
    { x: 190, y: 25, width: 37, height: 35 },
    { x: 465, y: 23, width: 38, height: 38 },
  ],
});

const groupConfigs = deepFreeze([
  { keys: ["16CSMR", "16CSMR_IC", "16CSMR_2IC"], image: "16csmr__v2.png", tooltip: csmrTooltip },
  { keys: ["7RHA", "7RHA_IC", "7RHA_2IC"], image: "7rha__v2.png", tooltip: rhaTooltip },
]);

export const groupToImageMap = deepFreeze(
  Object.fromEntries(
    groupConfigs.flatMap(({ keys, image }) =>
      keys.map((key) => [key, puPaths.group(image)])
    )
  )
);

export const groupToImageMapLC = deepFreeze(
  Object.fromEntries(
    Object.entries(groupToImageMap).map(([key, value]) => [key.toLowerCase(), value])
  )
);

const assignTooltips = (keys, tooltip) => keys.map((key) => [key, tooltip]);

export const groupTooltipMap = deepFreeze(
  Object.fromEntries(
    groupConfigs.flatMap(({ keys, tooltip }) => assignTooltips(keys, tooltip))
  )
);

export const groupTooltipMapLC = deepFreeze(
  Object.fromEntries(
    Object.entries(groupTooltipMap).map(([key, value]) => [key.toLowerCase(), value])
  )
);

// ---------- lanyards ----------
export const lanyardGroupsConfig = deepFreeze([
  lanyardCfg(
    "lightblue_and_maroon_lanyard__v2.png",
    ["Coy_IC", "Coy_2IC", "Coy_Sergeant_Major"],
    "hq_dzf__v2.png",
    "<center><b>Company HQ</b></center><br>A Company HQ is the command element of 16AA, providing leadership, coordination, and oversight of all platoons and attachments within the unit."
  ),
  lanyardCfg(
    "red_lanyard__v2.png",
    [
      "1_Platoon_IC", "1_Platoon_2IC", "1-1_Section_IC", "1-1_Section_2IC", "1-1_Section",
      "1-2_Section_IC", "1-2_Section_2IC", "1-2_Section", "1-3_Section_IC", "1-3_Section_2IC", "1-3_Section",
    ],
    "red_dzf__v2.png",
    "<center><b>1 Platoon</b></center><br>The airborne infantry platoons are the main paratrooper/ground infantry efforts of 16AA."
  ),
  lanyardCfg(
    "green_lanyard__v2.png",
    [
      "2_Platoon_IC", "2_Platoon_2IC", "2-1_Section_IC", "2-1_Section_2IC", "2-1_Section",
      "2-2_Section_IC", "2-2_Section_2IC", "2-2_Section", "2-3_Section_IC", "2-3_Section_2IC", "2-3_Section",
    ],
    "green_dzf__v2.png",
    "<center><b>2 Platoon</b></center><br>The airborne infantry platoons are the main paratrooper/ground infantry efforts of 16AA."
  ),
  lanyardCfg(
    "black_lanyard__v2.png",
    [
      "3_Platoon_IC", "3_Platoon_2IC", "3-1_Section_IC", "3-1_Section_2IC", "3-1_Section",
      "3-2_Section_IC", "3-2_Section_2IC", "3-2_Section",
      "Force_Protection_IC", "Force_Protection_2IC", "Force_Protection",
      "Reserves",
      "FSG_HQ_IC", "FSG_HQ_2IC", "Fire_Support_Group_IC", "Fire_Support_Group_2IC", "Fire_Support_Group",
      "4_Platoon_IC", "4_Platoon_2IC", 
      "4-1_Section_IC", "4-1_Section_2IC", "4-1_Section",
      "13AASR_IC", "13AASR_2IC", "13AASR",
      "16CSMR_IC", "16CSMR_2IC", "16CSMR",
      "216_Para_Signals_IC", "216_Para_Signals_2IC", "216_Para_Signals",
    ],
    "black_dzf__v2.png",
    "<center><b>4 Platoon</b></center><br>The main combat services ground support element of 16AA, providing Fire support, Medical support, Logistics support and Explosive Ordnance Disposal service."
  ),
  lanyardCfg(
    "black_and_olive_lanyard__v2.png",
    [],
    "black_and_olive_lanyard__v2.png",
    "<center><b>Black and Olive Lanyard</b></center><br>Description for Black and Olive Lanyard."
  ),
  lanyardCfg(
    "red_and_blue_lanyard__v2.png",
    ["7RHA_IC", "7RHA_2IC", "7RHA", "Fire_Support_Team_IC", "Fire_Support_Team_2IC", "Fire_Support_Team"],
    "red_and_blue_dzf__v2.png",
    "<center><b>7 Royal Horse Artillery</b></center><br>The dedicated artillery element of 16AA, delivering precision fires and Fire Support Teams to coordinate indirect and joint fires."
  ),
  lanyardCfg(
    "green_and_lightgrey_lanyard__v2.png",
    ["MI_IC", "MI_2IC", "MI"],
    "mi_dzf__v2.png",
    "<center><b>Military Intelligence</b></center><br>The intelligence element of 16AA, providing information, analysis, Zeus control and roleplay support for operations and planning."
  ),
]);

export const lanyardTooltipRegion = deepFreeze({ x: 548, y: 60, width: 30, height: 220 });

export const lanyardTooltipMap = deepFreeze(
  Object.fromEntries(
    lanyardGroupsConfig.flatMap((cfg) => {
      if (!cfg.groups.length) {
        return [];
      }
      const tooltip = { tooltipImage: cfg.tooltipImage, tooltipText: cfg.tooltipText };
      return cfg.groups.flatMap((groupName) => {
        const key = String(groupName || "");
        return [
          [key, tooltip],
          [key.toLowerCase(), tooltip],
        ];
      });
    })
  )
);

export const lanyardTooltipMapLC = deepFreeze(
  Object.fromEntries(
    Object.entries(lanyardTooltipMap).map(([key, value]) => [key.toLowerCase(), value])
  )
);

export const lanyardGroups = deepFreeze(
  lanyardGroupsConfig.flatMap((cfg) => cfg.groups.map((name) => ({ name, imageKey: cfg.imageKey })))
);

export const lanyardToImageMap = deepFreeze(
  Object.fromEntries(lanyardGroups.map((g) => [g.name, g.imageKey]))
);

export const lanyardToImageMapLC = deepFreeze(
  Object.fromEntries(lanyardGroups.map((g) => [g.name.toLowerCase(), g.imageKey]))
);

// ---------- qualifications ----------
export const leadershipQualificationsOrder = deepFreeze([
  "FTCC",
  "SCBC",
  "CC",
  "PSBC",
  "PCBC",
]);
export const marksmanshipQualificationsOrder = deepFreeze(["1st Class Marksman", "Sharpshooter", "Sniper"]);
export const pilotQualificationsOrder = deepFreeze(["Junior Pilot", "Senior Pilot"]);
export const ctmQualificationsOrder = deepFreeze(["CTM", "CTM Bronze", "CTM Silver", "CTM Gold"]);
export const ctmRenderDefaults = Object.freeze({
  basePlacement: Object.freeze({ x: 202, y: 222 }),
  rotationDegrees: 2,
  leaderAnchorOffset: Object.freeze({ x: 40, y: 16 }),
  plainVariantName: "CTM",
  plainVariantExtraYOffset: 2,
});


export const qualifications = deepFreeze([
  // --- Senior Pilot
  qual(
    "Senior Pilot",
    "seniorpilot2__v2.png",
    [],
    "seniorpilot__v2.jpg",
    "<center><b>Senior Pilot</b></center><br>Awarded on successful completion of the Advanced Flight Qualification. Trains the pilot in advanced fixed-wing and rotary-wing flight. Holder is qualified to assume Pilot-in-Command duties.",
    [{ x: 450, y: 182, width: 74, height: 41 }], // default/fallback
    {},
    {
      ribbonRowTooltipAreas: {
        0: [{ x: 450, y: 205, width: 74, height: 35 }],
        1: [{ x: 450, y: 194, width: 74, height: 35 }],
        2: [{ x: 449, y: 185, width: 72, height: 35 }],
        3: [{ x: 451, y: 176, width: 72, height: 35 }],
      },
      imagePlacementByRows: {
        0: { x: 446, y: 200 },
        1: { x: 446, y: 190 },
        2: { x: 443, y: 183 },
        3: { x: 446, y: 174 },
      }
    }
  ),

  // --- Junior Pilot
  qual(
    "Junior Pilot",
    "juniorpilot2__v2.png",
    [],
    "juniorpilot__v2.jpg",
    "<center><b>Junior Pilot</b></center><br>Awarded on successful completion of the Basic Flight Qualification. Trains core rotary and fixed-wing flight skills.",
    [{ x: 474, y: 182, width: 49, height: 41 }], // default/fallback
    {},
    {
      ribbonRowTooltipAreas: {
        0: [{ x: 470, y: 200, width: 49, height: 38 }],
        1: [{ x: 468, y: 194, width: 49, height: 35 }],
        2: [{ x: 469, y: 186, width: 49, height: 35 }],
        3: [{ x: 471, y: 177, width: 49, height: 35 }],
      },
      imagePlacementByRows: {
        0: { x: 467, y: 198 },
        1: { x: 465, y: 190 },
        2: { x: 467, y: 182 },
        3: { x: 466, y: 173 },
      }
    }
  ),
  qual(
    "1st Class Marksman",
    "1st_class_marksman__v2.png",
    ["Warrant_Officer_Class_2", "Warrant_Officer_Class_1", ...officerRanks],
    "1stclassmarksman__v2.jpg",
    "<center><b>1st Class Marksman</b></center><br>Awarded for scoring 110/120 or more on the Marksmanship Test. This is a requirement in order to carry the section marksman rifle.",
    [{ x: 10, y: 560, width: 46, height: 56 }]
  ),
  qual(
    "CMT",
    "cmt__v2.png",
    [],
    "cmt__v2.jpg",
    "<center><b>Combat Medical Technician (CMT)</b></center><br>Awarded on the successful completion of the Combat Medical Technician Course. Gives the individual knowledge in advanced treatment and medication.",
    [{ x: 10, y: 558, width: 42, height: 72 }]
  ),
  qual(
    "CTM Gold",
    "ctm_gold__v2.png",
    ["Warrant_Officer_Class_2", ...officerRanks],
    "ctmgold__v2.png",
    "<center><b>CTM Gold</b></center><br>Awarded on the successful completion of the Combat Team Medic course, with a Gold Grade. Gives the individual knowledge of basic triage and care under fire.",
    [{ x: 202, y: 222, width: 21, height: 20 }]
  ),
  qual(
    "CTM Silver",
    "ctm_silver__v2.png",
    ["Warrant_Officer_Class_2", ...officerRanks],
    "ctmsilver__v2.png",
    "<center><b>CTM Silver</b></center><br>Awarded on the successful completion of the Combat Team Medic course, with a Silver Grade. Gives the individual knowledge of basic triage and care under fire.",
    [{ x: 202, y: 222, width: 21, height: 20 }]
  ),
  qual(
    "CTM Bronze",
    "ctm_bronze__v2.png",
    ["Warrant_Officer_Class_2", ...officerRanks],
    "ctmbronze__v2.png",
    "<center><b>CTM Bronze</b></center><br>Awarded on the successful completion of the Combat Team Medic course, with a Bronze Grade. Gives the individual knowledge of basic triage and care under fire.",
    [{ x: 202, y: 222, width: 21, height: 20 }]
  ),
  qual(
    "CTM",
    "ctm__v2.png",
    ["Warrant_Officer_Class_2", ...officerRanks],
    "ctm__v2.jpg",
    "<center><b>Combat Team Medic (CTM)</b></center><br>Awarded on the successful completion of the Combat Team Medic course. Gives the individual knowledge of basic triage and care under fire.",
    [{ x: 202, y: 222, width: 18, height: 18 }]
  ),
  qual(
    "FTCC",
    "ftcc__v3.png",
    [],
    "ftcc__v2.jpg",
    "<center><b>Fire Team Commander's Course (FTCC)</b></center><br>Awarded on the successful completion of the FTCC course. Provides the upcoming commander with the knowledge required to command a fireteam.",
    [{ x: 172, y: 210, width: 42, height: 41 }]
  ),
  qual(
    "CC",
    "cc__v3.png",
    [],
    "cc__v2.png",
    "<center><b>Commander's Course (CC)</b></center><br>Awarded on the successful completion of the Commander's Course. Provides the commander with the knowledge and skills required to lead both a fireteam and a section in battle.",
    [{ x: 172, y: 210, width: 42, height: 41 }],
    {},
    {},
    ["Commander's Course"]
  ),
  qual(
    "ITC Instructor",
    "itc-instructor__v2.png",
    [],
    "itcinstructor__v2.png",
    "<center><b>ITC Instructor</b></center><br>Qualified Instructor of the Infantry Training Centre training team.",
    [{ x: 612, y: 120, width: 35, height: 64 }],
    { RAF: puPaths.qual("itc-instructor__v2.png") },
    {
      imagePlacementByRows: {
        default: { x: 617, y: 124 },
      }
    }
  ),
  qual(
    "Paratrooper",
    "paratrooper__v2.png",
    [],
    "paratrooper__v2.jpg",
    "<center><b>Paratrooper</b></center><br>Awarded on the successful completion of the Third static line Parachute Combat Drop or the successful completion of the Static Line Parachute Course.",
    [{ x: 44, y: 116, width: 40, height: 50 }],
    { RAF: puPaths.qual("paratrooper_raf__v2.png") }
  ),
  qual(
    "PCBC",
    "pcbc__v3.png",
    [],
    "pcbc__v2.jpg",
    "<center><b>Platoon Commander's Battle Course (PCBC)</b></center><br>Awarded on the successful completion of the PCBC course. Gives the senior commander the necessary skills and knowledge to lead a platoon.",
    [{ x: 172, y: 210, width: 42, height: 41 }]
  ),
  qual(
    "PSBC",
    "psbc__v3.png",
    [],
    "psbc__v2.jpg",
    "<center><b>Platoon Sergeant's Battle Course (PSBC)</b></center><br>Awarded on the successful completion of the PSBC course. Prepares the junior commander for the duties and responsibilities of a Platoon Sergeant and introduces them to the command of a full rifle platoon.",
    [{ x: 172, y: 210, width: 42, height: 41 }]
  ),
  qual(
    "SCBC",
    "scbc__v3.png",
    [],
    "scbc__v2.jpg",
    "<center><b>Section Commander's Battle Course (SCBC)</b></center><br>Awarded on the successful completion of the SCBC course. Teaches the individual the skills required to lead a section.",
    [{ x: 172, y: 210, width: 42, height: 41 }]
  ),
  qual(
    "Sniper",
    "sniper__v2.png",
    ["Warrant_Officer_Class_2", "Warrant_Officer_Class_1", ...officerRanks],
    "sniper__v2.jpg",
    "<center><b>Sniper</b></center><br>Awarded on the successful completion of the Sniper Cadre. Trains the soldier in advanced marksmanship, concealment and operation of the L115A3 Sniper Rifle.",
    [{ x: 10, y: 560, width: 46, height: 56 }]
  ),
  qual(
    "Sharpshooter",
    "sharpshooter__v2.png",
    ["Warrant_Officer_Class_2", "Warrant_Officer_Class_1", ...officerRanks],
    "sharpshooter__v2.png",
    "<center><b>Sharpshooter</b></center><br>Awarded on the successful completion of the L129A1 Sharpshooter Course. Trains the soldier in a higher level of marksmanship with the L129A1 Section Marksman rifle.",
    [{ x: 10, y: 560, width: 46, height: 56 }]
  ),
]);

export const qualificationToImageMap = deepFreeze(
  Object.fromEntries(
    qualifications.flatMap((q) => {
      const entries = [[q.name, q.imageKey]];
      (q.aliases || []).forEach((alias) => entries.push([alias, q.imageKey]));
      return entries;
    })
  )
);

export const qualificationsByNameLC = deepFreeze(
  Object.fromEntries(
    qualifications.flatMap((q) => {
      const entries = [[q.name.toLowerCase(), q]];
      (q.aliases || []).forEach((alias) => entries.push([alias.toLowerCase(), q]));
      return entries;
    })
  )
);

// ---------- CSA ribbons ----------
export const csaRibbons = deepFreeze([
  csaRibbon(
    "3LSR",
    "3lsr_ba__v3.png",
    "3lsr__v2.png",
    "<center><b>3 Logistics Support Regiment (3LSR)</b></center><br>Tests requested mods for technical issues before they reach the field.<br>Repairs and optimises 16AA addons when faults are discovered.<br>Proactively researches and recommends new mods to enhance operations.",
    { RAF: puPaths.csaRibbon("3lsr_raf__v3.png") }
  ),
  csaRibbon(
    "ITC",
    "itc_ba__v3.png",
    "itc__v2.png",
    "<center><b>Infantry Training Centre (ITC)</b></center><br>Maintains company-wide lesson plans and Home Rotation material.<br>Guides recruits through Phase 1 training to 16AA standards.<br>Provides foundational soldiering instruction across the unit.",
    { RAF: puPaths.csaRibbon("itc_raf__v3.png") }
  ),
  csaRibbon(
    "MEDIA",
    "media_ba__v3.png",
    "media__v2.png",
    "<center><b>Media Team</b></center><br>Produces promotional material that showcases 16AA activity.<br>Captures imagery and footage to support recruiting and morale.<br>Amplifies the unit’s presence across community channels.",
    { RAF: puPaths.csaRibbon("media_raf__v3.png") }
  ),
  csaRibbon(
    "REME",
    "reme_ba__v3.png",
    "reme__v2.png",
    "<center><b>Royal Electrical and Mechanical Engineers (REME)</b></center><br>Builds, maintains, and improves the 16AA website, TeamSpeak, and game servers.<br>Distributes the unit modpack and curates the repository.<br>Provides technical sustainment that keeps every deployment online.",
    { RAF: puPaths.csaRibbon("reme_raf__v3.png") }
  ),
  csaRibbon(
    "RLC",
    "rlc_ba__v3.png",
    "rlc__v2.png",
    "<center><b>Royal Logistics Corps (RLC)</b></center><br>Designs, enhances, and maintains 16AA missions.<br>Ensures critical equipment and logistics are ready for operations.<br>Delivers battlefield support that keeps sorties supplied.",
    { RAF: puPaths.csaRibbon("rlc_raf__v3.png") }
  ),
  csaRibbon(
    "RRO",
    "rro_ba__v3.png",
    "rro__v2.png",
    "<center><b>Recruitment and Retention Office</b></center><br>Runs recruiting campaigns and manages applicant outreach.<br>Handles applications, interviews, and onboarding of new members.<br>Maintains personnel files to track every soldier’s service.",
    { RAF: puPaths.csaRibbon("rro_raf__v3.png") }
  ),
]);

export const csaRibbonsByNameLC = deepFreeze(
  Object.fromEntries(csaRibbons.map((ribbon) => [ribbon.name.toLowerCase(), ribbon]))
);

export const csaRibbonGroupMapLC = deepFreeze(
  csaRibbons.reduce((acc, ribbon) => {
    ribbon.qualifyingGroups.forEach((group) => {
      acc[group.toLowerCase()] = ribbon;
    });
    return acc;
  }, {})
);

// ---------- awards ----------
export const awards = deepFreeze([
  award(
    "Meritorious Service Medal",
    "meritorious_service_medal__v2.png",
    "meritorious_service_medal__v2.png",
    "<center><b>Meritorious Service Medal</b></center><br>Awarded to Troopers with the rank of JNCO or above who have previously received the Long Service and Good Conduct Medal. Presented in recognition of sustained reliability, professionalism, and dedication on and off the battlefield over a prolonged period, with consistent performance of duties to the highest standard."
  ),
  award(
    "Most Valuable Soldier",
    "most_valuable_soldier__v2.png",
    "most_valuable_soldier__v2.png",
    "<center><b>Most Valuable Soldier</b></center><br>Awarded to the soldier who produces the goods when it counts. The soldier who holds the objective, makes the final shot or who just presents themselves as the one the team could not have done without."
  ),
  award(
    "Mention in Dispatches with Four Oak Leaves",
    "mention_in_dispatches_5__v2.png",
    "mention_in_dispatches__v2.png",
    "<center><b>5 x Mention in Dispatches</b></center><br>Awarded five times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  ),
  award(
    "Mention in Dispatches with Three Oak Leaves",
    "mention_in_dispatches_4__v2.png",
    "mention_in_dispatches__v2.png",
    "<center><b>4 x Mention in Dispatches</b></center><br>Awarded four times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  ),
  award(
    "Mention in Dispatches with Two Oak Leaves",
    "mention_in_dispatches_3__v2.png",
    "mention_in_dispatches__v2.png",
    "<center><b>3 x Mention in Dispatches</b></center><br>Awarded three times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  ),
  award(
    "Mention in Dispatches with Oak Leaf",
    "mention_in_dispatches_2__v2.png",
    "mention_in_dispatches__v2.png",
    "<center><b>2 x Mention in Dispatches</b></center><br>Awarded two times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  ),
  award(
    "Mention in Dispatches",
    "mention_in_dispatches_1__v2.png",
    "mention_in_dispatches__v2.png",
    "<center><b>Mention in Dispatches</b></center><br>Awarded for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  ),
  award(
    "Significant Effort Gold",
    "significant_effort_gold__v2.png",
    "significant_effort_gold__v2.png",
    "<center><b>Significant Effort Gold</b></center><br>Awarded for continued significant and outstanding effort to making 16AA better as a whole."
  ),
  award(
    "Significant Effort",
    "significant_effort__v2.png",
    "significant_effort__v2.png",
    "<center><b>Significant Effort</b></center><br>Awarded to those who are making a significant effort to making 16AA better as a whole."
  ),
  award(
    "Long Service and Good Conduct Medal with Two Silver Clasps",
    "long_service_medal_10_years__v2.png",
    "long_service_medal_10_years__v2.png",
    "<center><b>Long Service and Good Conduct Medal with Two Silver Clasps</b></center><br>Awarded to Troopers who have been members of 16AA for more than ten years while proven to be valuable assets to the unit through effort and commitment."
  ),
  award(
    "Long Service and Good Conduct Medal with Silver Clasp",
    "long_service_medal_5_years__v2.png",
    "long_service_medal_5_years__v2.png",
    "<center><b>Long Service and Good Conduct Medal with Silver Clasp</b></center><br>Awarded to Troopers who have been members of 16AA for more than five years while proven to be valuable assets to the unit through effort and commitment."
  ),
  award(
    "Long Service and Good Conduct Medal",
    "long_service_medal__v2.png",
    "long_service_medal__v2.png",
    "<center><b>Long Service and Good Conduct Medal</b></center><br>Awarded to Troopers who have been members of 16AA for more than two years while proven to be valuable assets to the unit through effort and commitment."
  ),
  award(
    "Mission Maker First Class",
    "mission_maker_first_class__v2.png",
    "mission_maker_first_class__v2.png",
    "<center><b>Mission Maker First Class</b></center><br>Awarded to Troopers that have worked on the creation of a third Operation."
  ),
  award(
    "Mission Maker Second Class",
    "mission_maker_second_class__v2.png",
    "mission_maker_second_class__v2.png",
    "<center><b>Mission Maker Second Class</b></center><br>Awarded to Troopers that have worked on the creation of a second Operation."
  ),
  award(
    "Mission Maker Third Class",
    "mission_maker_third_class__v2.png",
    "mission_maker_third_class__v2.png",
    "<center><b>Mission Maker Third Class</b></center><br>Awarded to Troopers that have worked on a series of missions that were used in an Operation."
  ),
  award(
    "Technical Excellence",
    "technical_excellence__v2.png",
    "technical_excellence__v2.png",
    "<center><b>Technical Excellence</b></center><br>Awarded to members of REME who have made outstanding contributions for an extended period of time to the technical aspects of the unit. This award recognises those who have worked tirelessly behind the scenes on tasks such as server & forum maintenance and administration, troubleshooting technical issues, and ensuring overall smooth day-to-day operations."
  ),
  award(
    "RRO Excellence Award",
    "rro_excellence__v2.png",
    "rro_excellence__v2.png",
    "<center><b>RRO Excellence Award</b></center><br>Awarded to troopers that have shown an excellent level of dedication and have worked tirelessly in RRO to raise the standard of the unit."
  ),
  award(
    "Recruiter Medal",
    "recruiter_medal__v2.png",
    "recruiter_medal__v2.png",
    "<center><b>Recruiter Medal</b></center><br>Awarded to Troopers that have contributed significantly to the Recruitment efforts of 16AA."
  ),
  award(
    "Esprit de Corps with Gold Clasp",
    "esprit_de_corps_gold__v2.png",
    "esprit_de_corps_gold__v2.png",
    "<center><b>Esprit de Corps with Gold Clasp</b></center><br>Awarded to troopers who demonstrate sustained commitment to promoting camaraderie, fostering a positive atmosphere, and consistently exemplifying teamwork while upholding the highest standards of the unit’s values."
  ),
  award(
    "Esprit de Corps",
    "esprit_de_corps__v2.png",
    "esprit_de_corps__v2.png",
    "<center><b>Esprit de Corps</b></center><br>Awarded to troopers who promote camaraderie and a positive atmosphere, while consistently encouraging teamwork and upholding the unit’s values."
  ),
  award(
    "Citation with Four Oak Leaves",
    "citation_5__v2.png",
    "citation__v2.png",
    "<center><b>5 x Citations</b></center><br>Awarded five times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  ),
  award(
    "Citation with Three Oak Leaves",
    "citation_4__v2.png",
    "citation__v2.png",
    "<center><b>4 x Citations</b></center><br>Awarded four times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  ),
  award(
    "Citation with Two Oak Leaves",
    "citation_3__v2.png",
    "citation__v2.png",
    "<center><b>3 x Citations</b></center><br>Awarded three times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  ),
  award(
    "Citation with Oak Leaf",
    "citation_2__v2.png",
    "citation__v2.png",
    "<center><b>2 x Citations</b></center><br>Awarded two times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  ),
  award(
    "Citation",
    "citation_1__v2.png",
    "citation__v2.png",
    "<center><b>Citation</b></center><br>Awarded for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  ),
]);

export const awardsByNameLC = deepFreeze(
  Object.fromEntries(awards.map((award) => [award.name.toLowerCase(), award]))
);
