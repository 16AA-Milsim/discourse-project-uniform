// uniform-data.js
import getURL from "discourse-common/lib/get-url";

// ---------- helpers ----------
const u = (p) => getURL(p);
const deepFreeze = (o) => (Object.freeze(o), Object.values(o).forEach(v => v && typeof v === "object" && !Object.isFrozen(v) && deepFreeze(v)), o);

const rankAreas = {
  // BA rank regions
  officerCollar: [
    { x: 80, y: 18, width: 100, height: 52 },
    { x: 520, y: 18, width: 80, height: 47 },
  ],
  wo2Sleeve: [
    { x: 15, y: 495, width: 45, height: 60 },
    { x: 635, y: 495, width: 45, height: 58 },
  ],
  csgtSleeve: [
    { x: 38, y: 195, width: 52, height: 110 },
    { x: 607, y: 193, width: 60, height: 105 },
  ],
  ssgtSleeve: [
    { x: 38, y: 195, width: 52, height: 110 },
    { x: 607, y: 193, width: 58, height: 102 },
  ],
  sgtSleeve: [
    { x: 38, y: 210, width: 52, height: 90 },
    { x: 607, y: 208, width: 60, height: 85 },
  ],
  cplSleeve: [
    { x: 38, y: 210, width: 52, height: 75 },
    { x: 607, y: 208, width: 60, height: 72 },
  ],
  lcplSleeve: [
    { x: 40, y: 215, width: 52, height: 55 },
    { x: 607, y: 208, width: 58, height: 55 },
  ],
  // RAF rank regions
  sqnldrSleeve: [
    { x: 16, y: 588, width: 120, height: 56 },
    { x: 556, y: 592, width: 118, height: 58 },
  ],
  fltltSleeve: [
    { x: 16, y: 596, width: 120, height: 54 },
    { x: 556, y: 602, width: 118, height: 54 },
  ],
  fgoffSleeve: [
    { x: 16, y: 600, width: 120, height: 40 },
    { x: 556, y: 604, width: 118, height: 42 },
  ],
  pltoffSleeve: [
    { x: 16, y: 600, width: 120, height: 40 },
    { x: 556, y: 604, width: 118, height: 42 },
  ]
};

const rank = (name, category, key, tipKey, tipText, areas, service = "BA") => ({
  name,
  category,         // "officer" | "enlisted"
  service,          // "BA" | "RAF"
  imageKey: u(`/assets/images/ranks/${key}.png`),
  tooltipImage: u(`/assets/images/tooltip_rankimages/${tipKey}.jpg`),
  tooltipText: tipText,
  tooltipAreas: areas,
});

const lanyardCfg = (image, groups, tipImage, tipText) => ({
  imageKey: u(`/assets/images/lanyards/${image}`),
  groups,
  tooltipImage: u(`/assets/images/tooltip_lanyardimages/${tipImage}`),
  tooltipText: tipText,
});

const qual = (name, key, restrictedRanks, tipImg, tipText, areas, serviceVariants = {}) => ({
  name,
  imageKey: u(`/assets/images/qualifications/${key}.png`),
  restrictedRanks,
  tooltipImage: u(`/assets/images/tooltip_qualificationimages/${tipImg}`),
  tooltipText: tipText,
  tooltipAreas: areas,
  serviceVariants, // e.g. { RAF: u('/assets/images/qualifications/paratrooper_raf.png') }
});

const award = (name, ribbonFile, medalFile, tipText) => ({
  name,
  imageKey: u(`/assets/images/ribbons/${ribbonFile}`),
  tooltipImage: u(`/assets/images/medals/${medalFile}`),
  tooltipText: tipText,
});

// ---------- backgrounds ----------
export const backgroundImages = deepFreeze({
  officer: u(`/assets/images/uniforms/ba_officers_uniform.png`),
  enlisted: u(`/assets/images/uniforms/ba_enlisted_uniform.png`),
  rafOfficer: u(`/assets/images/uniforms/raf_officers_uniform.png`),
  rafEnlisted: u(`/assets/images/uniforms/raf_enlisted_uniform.png`),
});

// ---------- ranks ----------
export const ranks = deepFreeze([
  rank("Major", "officer", "maj", "maj", "<center><b>Major</b></center>", rankAreas.officerCollar),
  rank("Captain", "officer", "capt", "capt", "<center><b>Captain</b></center>", rankAreas.officerCollar),
  rank("Lieutenant", "officer", "lt", "lt", "<center><b>Lieutenant</b></center>", rankAreas.officerCollar),
  rank("Second_Lieutenant", "officer", "2lt", "2lt", "<center><b>Second Lieutenant</b></center>", rankAreas.officerCollar),
  rank("Warrant_Officer_Class_2", "enlisted", "wo2", "wo2", "<center><b>Warrant Officer Class 2</b></center>", rankAreas.wo2Sleeve),
  rank("Colour_Sergeant", "enlisted", "csgt", "csgt", "<center><b>Colour Sergeant</b></center>", rankAreas.csgtSleeve),
  rank("Staff_Sergeant", "enlisted", "ssgt", "ssgt", "<center><b>Staff Sergeant</b></center>", rankAreas.ssgtSleeve),
  rank("Sergeant", "enlisted", "sgt", "sgt", "<center><b>Sergeant</b></center>", rankAreas.sgtSleeve),
  rank("Corporal", "enlisted", "cpl", "cpl", "<center><b>Corporal</b></center>", rankAreas.cplSleeve),
  rank("Lance_Corporal", "enlisted", "lcpl", "lcpl", "<center><b>Lance Corporal</b></center>", rankAreas.lcplSleeve),

  rank("Squadron_Leader", "officer", "sqnldr", "sqnldr", "<center><b>Squadron Leader</b></center>", rankAreas.sqnldrSleeve, "RAF"),
  rank("Flight_Lieutenant", "officer", "fltlt", "fltlt", "<center><b>Flight Lieutenant</b></center>", rankAreas.fltltSleeve, "RAF"),
  rank("Flying_Officer", "officer", "fgoff", "fgoff", "<center><b>Flying Officer</b></center>", rankAreas.fgoffSleeve, "RAF"),
  rank("Pilot_Officer", "officer", "pltoff", "pltoff", "<center><b>Pilot Officer</b></center>", rankAreas.pltoffSleeve, "RAF"),
  rank("Flight_Sergeant_Aircrew", "enlisted", "fsacr", "fsacr", "<center><b>Flight Sergeant (Aircrew)</b></center>", rankAreas.ssgtSleeve, "RAF"),
  rank("Sergeant_Aircrew", "enlisted", "sacr", "sacr", "<center><b>Sergeant (Aircrew)</b></center>", rankAreas.sgtSleeve, "RAF"),
]);

export const officerRanks = deepFreeze(ranks.filter(r => r.category === "officer").map(r => r.name));
export const enlistedRanks = deepFreeze(ranks.filter(r => r.category === "enlisted").map(r => r.name));
export const rankToImageMap = deepFreeze(Object.fromEntries(ranks.map(r => [r.name, r.imageKey])));

// ---------- groups/images ----------
export const groupToImageMap = deepFreeze({
  "16CSMR": u(`/assets/images/groups/16csmr.png`),
  "16CSMR_IC": u(`/assets/images/groups/16csmr.png`),
  "16CSMR_2IC": u(`/assets/images/groups/16csmr.png`),
});

const csmrTooltip = deepFreeze({
  tooltipImage: u(`/assets/images/groups/ramc.png`),
  tooltipText:
    "<center><b>Royal Army Medical Corps</b></center><br>The collar badge worn by<br>members of 16 Close Support Medical Regiment.",
  tooltipAreas: [
    { x: 183, y: 27, width: 37, height: 35 },
    { x: 477, y: 27, width: 38, height: 35 },
  ],
});

export const groupTooltipMap = deepFreeze(
  ["16CSMR", "16CSMR_IC", "16CSMR_2IC"].reduce((a, k) => ((a[k] = csmrTooltip), a), {})
);

// ---------- lanyards ----------
export const lanyardGroupsConfig = deepFreeze([
  lanyardCfg(
    "lightblue_and_maroon_lanyard.png",
    ["Coy_IC", "Coy_2IC", "Coy_Sergeant_Major"],
    "lightblue_and_maroon_lanyard.png",
    "<center><b>Lightblue & Maroon Lanyard</b></center><br>Description for Lightblue & Maroon Lanyard."
  ),
  lanyardCfg(
    "red_lanyard.png",
    [
      "1_Platoon_IC", "1_Platoon_2IC", "1-1_Section_IC", "1-1_Section_2IC", "1-1_Section",
      "1-2_Section_IC", "1-2_Section_2IC", "1-2_Section", "1-3_Section_IC", "1-3_Section_2IC", "1-3_Section",
    ],
    "red_dzf.png",
    "<center><b>1 Platoon</b></center><br>The airborne infantry platoons are the main paratrooper/ground infantry efforts of 16AA."
  ),
  lanyardCfg(
    "green_lanyard.png",
    [
      "2_Platoon_IC", "2_Platoon_2IC", "2-1_Section_IC", "2-1_Section_2IC", "2-1_Section",
      "2-2_Section_IC", "2-2_Section_2IC", "2-2_Section", "2-3_Section_IC", "2-3_Section_2IC", "2-3_Section",
    ],
    "green_lanyard.png",
    "<center><b>Green Lanyard</b></center><br>Description for Green Lanyard."
  ),
  lanyardCfg(
    "black_lanyard.png",
    [
      "3_Platoon_IC", "3_Platoon_2IC", "3-1_Section_IC", "3-1_Section_2IC", "3-1_Section",
      "3-2_Section_IC", "3-2_Section_2IC", "3-2_Section",
      "FSG_HQ_IC", "FSG_HQ_2IC", "Fire_Support_Group_IC", "Fire_Support_Group_2IC", "Fire_Support_Group",
      "4-1_Section_IC", "4-1_Section_2IC", "4-1_Section",
      "13AASR_IC", "13AASR_2IC", "13AASR",
      "16CSMR_IC", "16CSMR_2IC", "16CSMR",
      "216_Para_Signals_IC", "216_Para_Signals_2IC", "216_Para_Signals",
    ],
    "black_dzf.png",
    "<center><b>4 Platoon</b></center><br>The main combat services ground support element of 16AA, providing Fire support, Medical support, Logistics support and Explosive Ordnance Disposal service."
  ),
  lanyardCfg(
    "black_and_olive_lanyard.png",
    ["Fire_Support_Team_IC", "Fire_Support_Team_2IC", "Fire_Support_Team"],
    "black_and_olive_lanyard.png",
    "<center><b>Black and Olive Lanyard</b></center><br>Description for Black and Olive Lanyard."
  ),
]);

export const lanyardTooltipRegion = deepFreeze({ x: 548, y: 60, width: 30, height: 220 });

export const lanyardTooltipMap = deepFreeze(
  lanyardGroupsConfig.reduce((acc, cfg) => {
    cfg.groups.forEach((g) => {
      acc[g] = { tooltipImage: cfg.tooltipImage, tooltipText: cfg.tooltipText };
    });
    return acc;
  }, {})
);

export const lanyardGroups = deepFreeze(
  lanyardGroupsConfig.flatMap((cfg) => cfg.groups.map((name) => ({ name, imageKey: cfg.imageKey })))
);

export const lanyardToImageMap = deepFreeze(
  Object.fromEntries(lanyardGroups.map((g) => [g.name, g.imageKey]))
);

// ---------- qualifications ----------
export const leadershipQualificationsOrder = deepFreeze(["FTCC", "SCBC", "PSBC", "PCBC"]);
export const marksmanshipQualificationsOrder = deepFreeze(["1st Class Marksman", "Sharpshooter", "Sniper"]);
export const pilotQualificationsOrder = deepFreeze(["Junior Pilot", "Senior Pilot"]);

export const qualifications = deepFreeze([
  qual(
    "Senior Pilot",
    "seniorpilot",
    [],
    "seniorpilot.jpg",
    "<center><b>Senior Pilot</b></center><br>Awarded on the successful completion of the Advanced Flight Qualification. Trains the pilot in advanced flight on both fixed wing and rotary wing and can assume Pilot In Command duties.",
    [{ x: 450, y: 182, width: 74, height: 41 }]
  ),
  qual(
    "Junior Pilot",
    "juniorpilot",
    [],
    "juniorpilot.jpg",
    "<center><b>Junior Pilot</b></center><br>Awarded on the successful completion of the Basic Flight Qualification. Trains the pilot in basic rotary and fixed wing flight skills.",
    [{ x: 474, y: 182, width: 49, height: 41 }]
  ),
  qual(
    "1st Class Marksman",
    "1st_class_marksman",
    ["Warrant_Officer_Class_2", "Warrant_Officer_Class_1", ...officerRanks],
    "1stclassmarksman.jpg",
    "<center><b>1st Class Marksman</b></center><br>Awarded for scoring 110/120 or more on the Marksmanship Test. This is a requirement in order to carry the section marksman rifle.",
    [{ x: 10, y: 560, width: 46, height: 56 }]
  ),
  qual(
    "CMT",
    "cmt",
    [],
    "cmt.jpg",
    "<center><b>Combat Medical Technician (CMT)</b></center><br>Awarded on the successful completion of the Combat Medical Technician Course. Gives the individual knowledge in advanced treatment and medication.",
    [{ x: 10, y: 558, width: 42, height: 72 }]
  ),
  qual(
    "FTCC",
    "ftcc",
    [],
    "ftcc.jpg",
    "<center><b>FTCC</b></center><br>Fire Team Commanders Course.",
    [{ x: 192, y: 206, width: 30, height: 38 }]
  ),
  qual(
    "Paratrooper",
    "paratrooper",
    [],
    "paratrooper.jpg",
    "<center><b>Paratrooper</b></center><br>Awarded on the successful completion of the Third static line Parachute Combat Drop.",
    [{ x: 44, y: 116, width: 40, height: 50 }],
    { RAF: u(`/assets/images/qualifications/paratrooper_raf.png`) }
  ),
  qual(
    "PCBC",
    "pcbc",
    [],
    "pcbc.jpg",
    "<center><b>PCBC</b></center><br>Platoon Commanders Battle Course.",
    [{ x: 188, y: 206, width: 36, height: 38 }]
  ),
  qual(
    "PSBC",
    "psbc",
    [],
    "psbc.jpg",
    "<center><b>PSBC</b></center><br>Platoon Sergeants Battle Course.",
    [{ x: 188, y: 206, width: 36, height: 38 }]
  ),
  qual(
    "SCBC",
    "scbc",
    [],
    "scbc.jpg",
    "<center><b>SCBC</b></center><br>Section Commanders Battle Course.",
    [{ x: 188, y: 206, width: 36, height: 38 }]
  ),
  qual(
    "Sniper",
    "sniper",
    ["Warrant_Officer_Class_2", "Warrant_Officer_Class_1", ...officerRanks],
    "sniper.jpg",
    "<center><b>Sniper</b></center><br>Awarded on the successful completion of the Sniper Cadre. Trains the soldier in advanced marksmanship, concealment and operation of the L115A3 Sniper Rifle.",
    [{ x: 10, y: 560, width: 46, height: 56 }]
  ),
  qual(
    "Sharpshooter",
    "sharpshooter",
    ["Warrant_Officer_Class_2", "Warrant_Officer_Class_1", ...officerRanks],
    "sharpshooter.png",
    "<center><b>Sharpshooter</b></center><br>Awarded on the successful completion of the L129A1 Sharpshooter Course. Trains the soldier in a higher level of marksmanship with the L129A1 Section Marksman rifle.",
    [{ x: 10, y: 560, width: 46, height: 56 }]
  ),
]);

export const qualificationToImageMap = deepFreeze(
  Object.fromEntries(qualifications.map((q) => [q.name, q.imageKey]))
);

// ---------- awards ----------
export const awards = deepFreeze([
  award(
    "Meritorious Service Medal",
    "meritorious_service_medal.png",
    "meritorious_service_medal.png",
    "<center><b>Meritorious Service Medal</b></center><br>Awarded to Troopers with the rank of JNCO or above who have previously received the Long Service and Good Conduct Medal. Presented in recognition of sustained reliability, professionalism, and dedication on and off the battlefield over a prolonged period, with consistent performance of duties to the highest standard."
  ),
  award(
    "Most Valuable Soldier",
    "most_valuable_soldier.png",
    "most_valuable_soldier.png",
    "<center><b>Most Valuable Soldier</b></center><br>Awarded to the soldier who produces the goods when it counts. The soldier who holds the objective, makes the final shot or who just presents themselves as the one the team could not have done without."
  ),
  award(
    "Mention in Dispatches with Four Oak Leaves",
    "mention_in_dispatches_5.png",
    "mention_in_dispatches.png",
    "<center><b>5 x Mention in Dispatches</b></center><br>Awarded five times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  ),
  award(
    "Mention in Dispatches with Three Oak Leaves",
    "mention_in_dispatches_4.png",
    "mention_in_dispatches.png",
    "<center><b>4 x Mention in Dispatches</b></center><br>Awarded four times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  ),
  award(
    "Mention in Dispatches with Two Oak Leaves",
    "mention_in_dispatches_3.png",
    "mention_in_dispatches.png",
    "<center><b>3 x Mention in Dispatches</b></center><br>Awarded three times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  ),
  award(
    "Mention in Dispatches with Oak Leaf",
    "mention_in_dispatches_2.png",
    "mention_in_dispatches.png",
    "<center><b>2 x Mention in Dispatches</b></center><br>Awarded two times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  ),
  award(
    "Mention in Dispatches",
    "mention_in_dispatches_1.png",
    "mention_in_dispatches.png",
    "<center><b>Mention in Dispatches</b></center><br>Awarded for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  ),
  award(
    "Significant Effort Gold",
    "significant_effort_gold.png",
    "significant_effort_gold.png",
    "<center><b>Significant Effort Gold</b></center><br>Awarded for continued significant and outstanding effort to making 16AA better as a whole."
  ),
  award(
    "Significant Effort",
    "significant_effort.png",
    "significant_effort.png",
    "<center><b>Significant Effort</b></center><br>Awarded to those who are making a significant effort to making 16AA better as a whole."
  ),
  award(
    "Long Service and Good Conduct Medal with Two Silver Clasps",
    "long_service_medal_10_years.png",
    "long_service_medal_10_years.png",
    "<center><b>Long Service and Good Conduct Medal with Two Silver Clasps</b></center><br>Awarded to Troopers who have been members of 16AA for more than ten years while proven to be valuable assets to the unit through effort and commitment."
  ),
  award(
    "Long Service and Good Conduct Medal with Silver Clasp",
    "long_service_medal_5_years.png",
    "long_service_medal_5_years.png",
    "<center><b>Long Service and Good Conduct Medal with Silver Clasp</b></center><br>Awarded to Troopers who have been members of 16AA for more than five years while proven to be valuable assets to the unit through effort and commitment."
  ),
  award(
    "Long Service and Good Conduct Medal",
    "long_service_medal.png",
    "long_service_medal.png",
    "<center><b>Long Service and Good Conduct Medal</b></center><br>Awarded to Troopers who have been members of 16AA for more than two years while proven to be valuable assets to the unit through effort and commitment."
  ),
  award(
    "Mission Maker First Class",
    "mission_maker_first_class.png",
    "mission_maker_first_class.png",
    "<center><b>Mission Maker First Class</b></center><br>Awarded to Troopers that have worked on the creation of a third Operation."
  ),
  award(
    "Mission Maker Second Class",
    "mission_maker_second_class.png",
    "mission_maker_second_class.png",
    "<center><b>Mission Maker Second Class</b></center><br>Awarded to Troopers that have worked on the creation of a second Operation."
  ),
  award(
    "Mission Maker Third Class",
    "mission_maker_third_class.png",
    "mission_maker_third_class.png",
    "<center><b>Mission Maker Third Class</b></center><br>Awarded to Troopers that have worked on a series of missions that were used in an Operation."
  ),
  award(
    "Technical Excellence",
    "technical_excellence.png",
    "technical_excellence.png",
    "<center><b>Technical Excellence</b></center><br>Awarded to members of REME who have made outstanding contributions for an extended period of time to the technical aspects of the unit. This award recognises those who have worked tirelessly behind the scenes on tasks such as server & forum maintenance and administration, troubleshooting technical issues, and ensuring overall smooth day-to-day operations."
  ),
  award(
    "RRO Excellence",
    "rro_excellence.png",
    "rro_excellence.png",
    "<center><b>RRO Excellence Award</b></center><br>Awarded to troopers that have shown an excellent level of dedication and have worked tirelessly in RRO to raise the standard of the unit."
  ),
  award(
    "Recruiter Medal",
    "recruiter_medal.png",
    "recruiter_medal.png",
    "<center><b>Recruiter Medal</b></center><br>Awarded to Troopers that have contributed significantly to the Recruitment efforts of 16AA."
  ),
  award(
    "Esprit de Corps with Gold Clasp",
    "esprit_de_corps_gold.png",
    "esprit_de_corps_gold.png",
    "<center><b>Esprit de Corps with Gold Clasp</b></center><br>Awarded to troopers who demonstrate sustained commitment to promoting camaraderie, fostering a positive atmosphere, and consistently exemplifying teamwork while upholding the highest standards of the unit’s values."
  ),
  award(
    "Esprit de Corps",
    "esprit_de_corps.png",
    "esprit_de_corps.png",
    "<center><b>Esprit de Corps</b></center><br>Awarded to troopers who promote camaraderie and a positive atmosphere, while consistently encouraging teamwork and upholding the unit’s values."
  ),
  award(
    "Citation with Four Oak Leaves",
    "citation_5.png",
    "citation.png",
    "<center><b>5 x Citations</b></center><br>Awarded five times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  ),
  award(
    "Citation with Three Oak Leaves",
    "citation_4.png",
    "citation.png",
    "<center><b>4 x Citations</b></center><br>Awarded four times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  ),
  award(
    "Citation with Two Oak Leaves",
    "citation_3.png",
    "citation.png",
    "<center><b>3 x Citations</b></center><br>Awarded three times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  ),
  award(
    "Citation with Oak Leaf",
    "citation_2.png",
    "citation.png",
    "<center><b>2 x Citations</b></center><br>Awarded two times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  ),
  award(
    "Citation",
    "citation_1.png",
    "citation.png",
    "<center><b>Citation</b></center><br>Awarded for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  ),
]);

// ---------- final freeze ----------
deepFreeze(backgroundImages);
deepFreeze(groupToImageMap);
deepFreeze(groupTooltipMap);
deepFreeze(lanyardTooltipRegion);
deepFreeze(lanyardTooltipMap);
deepFreeze(lanyardGroups);
deepFreeze(lanyardToImageMap);
deepFreeze(leadershipQualificationsOrder);
deepFreeze(marksmanshipQualificationsOrder);
deepFreeze(qualificationToImageMap);