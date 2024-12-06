// uniform-data.js

export const backgroundImages = {
  officer: '/assets/images/uniforms/ba_officers_uniform.png',
  enlisted: '/assets/images/uniforms/ba_enlisted_uniform.png',
};

export const beretImages = {
  recruit: '/assets/images/berets/recruit_beret.png',
  para: '/assets/images/berets/para_beret.png',
};

export const ranks = [
  { name: 'Major', category: 'officer', imageKey: '/assets/images/ranks/maj.png' },
  { name: 'Captain', category: 'officer', imageKey: '/assets/images/ranks/capt.png' },
  { name: 'Lieutenant', category: 'officer', imageKey: '/assets/images/ranks/lt.png' },
  { name: 'Second_Lieutenant', category: 'officer', imageKey: '/assets/images/ranks/2lt.png' },
  { name: 'Acting_Second_Lieutenant', category: 'officer', imageKey: '/assets/images/ranks/act_2lt.png' },
  { name: 'Warrant_Officer_Class 1', category: 'enlisted', imageKey: '/assets/images/ranks/wo1.png' },
  { name: 'Warrant_Officer_Class 2', category: 'enlisted', imageKey: '/assets/images/ranks/wo2.png' },
  { name: 'Colour_Sergeant', category: 'enlisted', imageKey: '/assets/images/ranks/csgt.png' },
  { name: 'Staff_Sergeant', category: 'enlisted', imageKey: '/assets/images/ranks/ssgt.png' },
  { name: 'Sergeant', category: 'enlisted', imageKey: '/assets/images/ranks/sgt.png' },
  { name: 'Corporal', category: 'enlisted', imageKey: '/assets/images/ranks/cpl.png' },
  { name: 'Lance_Corporal', category: 'enlisted', imageKey: '/assets/images/ranks/lcpl.png' },
  { name: 'Private', category: 'enlisted', imageKey: '/assets/images/ranks/pte.png' },
  { name: 'Recruit', category: 'enlisted', imageKey: '/assets/images/ranks/rec.png' }
];

// Derived Data
export const officerRanks = ranks.filter(rank => rank.category === 'officer').map(rank => rank.name);
export const enlistedRanks = ranks.filter(rank => rank.category === 'enlisted').map(rank => rank.name);

// Rank to Image Mapping
export const rankToImageMap = Object.fromEntries(
  ranks.map(rank => [rank.name, rank.imageKey])
);

const lanyardGroupsConfig = {
  '/assets/images/lanyards/hq_lanyard.png': [
    'Coy_IC', 'Coy_2IC', 'Coy_Sergeant_Major'
  ],
  '/assets/images/lanyards/1_platoon_lanyard.png': [
    '1_Platoon_IC', '1_Platoon_2IC', '1-1_Section_IC', '1-1_Section_2IC', '1-1_Section',
    '1-2_Section_IC', '1-2_Section_2IC', '1-2_Section', '1-3_Section_IC', '1-3_Section_2IC', '1-3_Section'
  ],
  '/assets/images/lanyards/2_platoon_lanyard.png': [
    '2_Platoon_IC', '2_Platoon_2IC', '2-1_Section_IC', '2-1_Section_2IC', '2-1_Section',
    '2-2_Section_IC', '2-2_Section_2IC', '2-2_Section', '2-3_Section_IC', '2-3_Section_2IC', '2-3_Section'
  ],
  '/assets/images/lanyards/fire_support_group_lanyard.png': [
    '3_Platoon_IC', '3_Platoon_2IC', '3-1_Section_IC', '3-1_Section_2IC', '3-1_Section',
    '3-2_Section_IC', '3-2_Section_2IC', '3-2_Section', 'FSG_HQ_IC', 'FSG_HQ_2IC',
    'Fire_Support_Group_IC', 'Fire_Support_Group_2IC', 'Fire_Support_Group'
  ],
  '/assets/images/lanyards/force_protection_lanyard.png': [
    '4-1_Section_IC', '4-1_Section_2IC', '4-1_Section'
  ],
  '/assets/images/lanyards/13_air_assault_support_regiment_lanyard.png': [
    '13AASR_IC', '13AASR_2IC', '13AASR'
  ],
  '/assets/images/lanyards/16_close_support_medical_regiment_lanyard.png': [
    '16CSMR_IC', '16CSMR_2IC', '16CSMR'
  ],
  '/assets/images/lanyards/216_para_signals_lanyard.png': [
    '216_Para_Signals_IC', '216_Para_Signals_2IC', '216_Para_Signals'
  ],
  '/assets/images/lanyards/fire_support_team_lanyard.png': [
    'Fire_Support_Team_IC', 'Fire_Support_Team_2IC', 'Fire_Support_Team'
  ]
};

export const lanyardGroups = Object.entries(lanyardGroupsConfig).flatMap(([imageKey, names]) =>
  names.map(name => ({ name, imageKey }))
);

// Lanyard to Image Mapping
export const lanyardToImageMap = Object.fromEntries(
  lanyardGroups.map(group => [group.name, group.imageKey])
);

export const qualifications = [
  { name: 'Paratrooper', imageKey: '/assets/images/qualifications/paratrooper.png', restrictedRanks: [] },
  { name: 'Sniper', imageKey: '/assets/images/qualifications/sniper.png', restrictedRanks: ['Warrant Officer Class 2', 'Warrant Officer Class 1', ...officerRanks] },
  { name: 'Sharpshooter', imageKey: '/assets/images/qualifications/sharpshooter.png', restrictedRanks: ['Warrant Officer Class 2', 'Warrant Officer Class 1', ...officerRanks] },
  { name: '1st Class Marksman', imageKey: '/assets/images/qualifications/1st_class_marksman.png', restrictedRanks: ['Warrant Officer Class 2', 'Warrant Officer Class 1', ...officerRanks] }
];

// Qualifications to Image Mapping
export const qualificationToImageMap = Object.fromEntries(
  qualifications.map(qualification => [qualification.name, qualification.imageKey])
);

export const awards = [
  { name: "Meritorious Service Medal", imageKey: "/assets/images/ribbons/meritorious_service_medal.png" },
  { name: "Most Valuable Soldier", imageKey: "/assets/images/ribbons/most_valuable_soldier.png" },
  { name: "Mention in Dispatches with Four Oak Leaves", imageKey: "/assets/images/ribbons/mention_in_dispatches_5.png" },
  { name: "Mention in Dispatches with Three Oak Leaves", imageKey: "/assets/images/ribbons/mention_in_dispatches_4.png" },
  { name: "Mention in Dispatches with Two Oak Leaves", imageKey: "/assets/images/ribbons/mention_in_dispatches_3.png" },
  { name: "Mention in Dispatches with Oak Leaf", imageKey: "/assets/images/ribbons/mention_in_dispatches_2.png" },
  { name: "Mention in Dispatches", imageKey: "/assets/images/ribbons/mention_in_dispatches_1.png" },
  { name: "Significant Effort Gold", imageKey: "/assets/images/ribbons/significant_effort_gold.png" },
  { name: "Significant Effort", imageKey: "/assets/images/ribbons/significant_effort.png" },
  { name: "Long Service and Good Conduct Medal with Two Silver Clasps", imageKey: "/assets/images/ribbons/long_service_medal_10_years.png" },
  { name: "Long Service and Good Conduct Medal with Silver Clasp", imageKey: "/assets/images/ribbons/long_service_medal_5_years.png" },
  { name: "Long Service and Good Conduct Medal", imageKey: "/assets/images/ribbons/long_service_medal.png" },
  { name: "Mission Maker First Class", imageKey: "/assets/images/ribbons/mission_maker_first_class.png" },
  { name: "Mission Maker Second Class", imageKey: "/assets/images/ribbons/mission_maker_second_class.png" },
  { name: "Mission Maker Third Class", imageKey: "/assets/images/ribbons/mission_maker_third_class.png" },
  { name: "Technical Excellence", imageKey: "/assets/images/ribbons/technical_excellence.png" },
  { name: "RRO Excellence", imageKey: "/assets/images/ribbons/rro_excellence.png" },
  { name: "Recruiter Medal", imageKey: "/assets/images/ribbons/recruiter_medal.png" },
  { name: "Esprit de Corps with Gold Clasp", imageKey: "/assets/images/ribbons/esprit_de_corps_gold.png" },
  { name: "Esprit de Corps", imageKey: "/assets/images/ribbons/esprit_de_corps.png" },
  { name: "Citation with Four Oak Leaves", imageKey: "/assets/images/ribbons/citation_5.png" },
  { name: "Citation with Three Oak Leaves", imageKey: "/assets/images/ribbons/citation_4.png" },
  { name: "Citation with Two Oak Leaves", imageKey: "/assets/images/ribbons/citation_3.png" },
  { name: "Citation with Oak Leaf", imageKey: "/assets/images/ribbons/citation_2.png" },
  { name: "Citation", imageKey: "/assets/images/ribbons/citation_1.png" }
];
