// uniform-data.js

export const backgroundImages = {
  officer: '/assets/images/uniforms/ba_officers_uniform.png',
  enlisted: '/assets/images/uniforms/ba_enlisted_uniform.png',
};

export const ranks = [
  { name: 'Major', category: 'officer', imageKey: '/assets/images/ranks/maj.png' },
  { name: 'Captain', category: 'officer', imageKey: '/assets/images/ranks/capt.png' },
  { name: 'Lieutenant', category: 'officer', imageKey: '/assets/images/ranks/lt.png' },
  { name: 'Second_Lieutenant', category: 'officer', imageKey: '/assets/images/ranks/2lt.png' },
  { name: 'Acting_Second_Lieutenant', category: 'officer', imageKey: '/assets/images/ranks/act_2lt.png' },
  { name: 'Warrant_Officer_Class_1', category: 'enlisted', imageKey: '/assets/images/ranks/wo1.png' },
  { name: 'Warrant_Officer_Class_2', category: 'enlisted', imageKey: '/assets/images/ranks/wo2.png' },
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

export const groupToImageMap = {
  '16CSMR': '/assets/images/groups/16csmr.png',
  '16CSMR_IC': '/assets/images/groups/16csmr.png',
  '16CSMR_2IC': '/assets/images/groups/16csmr.png'
};

const lanyardGroupsConfig = {
  '/assets/images/lanyards/lightblue_and_maroon_lanyard.png': [
    'Coy_IC', 'Coy_2IC', 'Coy_Sergeant_Major'
  ],
  '/assets/images/lanyards/red_lanyard.png': [
    '1_Platoon_IC', '1_Platoon_2IC', '1-1_Section_IC', '1-1_Section_2IC', '1-1_Section',
    '1-2_Section_IC', '1-2_Section_2IC', '1-2_Section', '1-3_Section_IC', '1-3_Section_2IC', '1-3_Section'
  ],
  '/assets/images/lanyards/green_lanyard.png': [
    '2_Platoon_IC', '2_Platoon_2IC', '2-1_Section_IC', '2-1_Section_2IC', '2-1_Section',
    '2-2_Section_IC', '2-2_Section_2IC', '2-2_Section', '2-3_Section_IC', '2-3_Section_2IC', '2-3_Section'
  ],
  '/assets/images/lanyards/black_lanyard.png': [
    '3_Platoon_IC', '3_Platoon_2IC', '3-1_Section_IC', '3-1_Section_2IC', '3-1_Section',
    '3-2_Section_IC', '3-2_Section_2IC', '3-2_Section', 'FSG_HQ_IC', 'FSG_HQ_2IC',
    'Fire_Support_Group_IC', 'Fire_Support_Group_2IC', 'Fire_Support_Group'
  ],
  '/assets/images/lanyards/black_lanyard.png': [
    '4-1_Section_IC', '4-1_Section_2IC', '4-1_Section'
  ],
  '/assets/images/lanyards/black_lanyard.png': [
    '13AASR_IC', '13AASR_2IC', '13AASR'
  ],
  '/assets/images/lanyards/black_lanyard.png': [
    '16CSMR_IC', '16CSMR_2IC', '16CSMR'
  ],
  '/assets/images/lanyards/black_lanyard.png': [
    '216_Para_Signals_IC', '216_Para_Signals_2IC', '216_Para_Signals'
  ],
  '/assets/images/lanyards/black_and_olive_lanyard.png': [
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
  { name: '1st Class Marksman', imageKey: '/assets/images/qualifications/1st_class_marksman.png', restrictedRanks: ['Warrant_Officer_Class_2', 'Warrant_Officer_Class_1', ...officerRanks] },
  { name: 'CMT', imageKey: '/assets/images/qualifications/cmt.png', restrictedRanks: [] },
  { name: 'FTCC', imageKey: '/assets/images/qualifications/ftcc.png', restrictedRanks: [] },
  { name: 'Paratrooper', imageKey: '/assets/images/qualifications/paratrooper.png', restrictedRanks: [] },
  { name: 'PCBC', imageKey: '/assets/images/qualifications/pcbc.png', restrictedRanks: [] },
  { name: 'PSBC', imageKey: '/assets/images/qualifications/psbc.png', restrictedRanks: [] },
  { name: 'SCBC', imageKey: '/assets/images/qualifications/scbc.png', restrictedRanks: [] },
  { name: 'Sniper', imageKey: '/assets/images/qualifications/sniper.png', restrictedRanks: ['Warrant_Officer_Class_2', 'Warrant_Officer_Class_1', ...officerRanks] },
  { name: 'Sharpshooter', imageKey: '/assets/images/qualifications/sharpshooter.png', restrictedRanks: ['Warrant_Officer_Class_2', 'Warrant_Officer_Class_1', ...officerRanks] }
  
];

// Qualifications to Image Mapping
export const qualificationToImageMap = Object.fromEntries(
  qualifications.map(qualification => [qualification.name, qualification.imageKey])
);

export const awards = [
  { 
    name: "Meritorious Service Medal", 
    imageKey: "/assets/images/ribbons/meritorious_service_medal.png",
    tooltipImage: "/assets/images/medals/meritorious_service_medal.png",
    tooltipText: "<center><b>Meritorious Service Medal</b></center><br>Awarded to Troopers with the rank of JNCO or above who have previously received the Long Service and Good Conduct Medal. Presented in recognition of sustained reliability, professionalism, and dedication on and off the battlefield over a prolonged period, with consistent performance of duties to the highest standard."
  },
  { 
    name: "Most Valuable Soldier", 
    imageKey: "/assets/images/ribbons/most_valuable_soldier.png",
    tooltipImage: "/assets/images/medals/most_valuable_soldier.png",
    tooltipText: "<center><b>Most Valuable Soldier</b></center><br>Awarded to the soldier who produces the goods when it counts. The soldier who holds the objective, makes the final shot or who just presents themselves as the one the team could not have done without."
  },
  { 
    name: "Mention in Dispatches with Four Oak Leaves", 
    imageKey: "/assets/images/ribbons/mention_in_dispatches_5.png",
    tooltipImage: "/assets/images/medals/mention_in_dispatches.png",
    tooltipText: "<center><b>5 x Mention in Dispatches</b></center><br>Awarded five times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  },
  { 
    name: "Mention in Dispatches with Three Oak Leaves", 
    imageKey: "/assets/images/ribbons/mention_in_dispatches_4.png",
    tooltipImage: "/assets/images/medals/mention_in_dispatches.png",
    tooltipText: "<center><b>4 x Mention in Dispatches</b></center><br>Awarded four times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  },
  { 
    name: "Mention in Dispatches with Two Oak Leaves", 
    imageKey: "/assets/images/ribbons/mention_in_dispatches_3.png",
    tooltipImage: "/assets/images/medals/mention_in_dispatches.png",
    tooltipText: "<center><b>3 x Mention in Dispatches</b></center><br>Awarded three times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  },
  { 
    name: "Mention in Dispatches with Oak Leaf", 
    imageKey: "/assets/images/ribbons/mention_in_dispatches_2.png",
    tooltipImage: "/assets/images/medals/mention_in_dispatches.png",
    tooltipText: "<center><b>2 x Mention in Dispatches</b></center><br>Awarded two times for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  },
  { 
    name: "Mention in Dispatches", 
    imageKey: "/assets/images/ribbons/mention_in_dispatches_1.png",
    tooltipImage: "/assets/images/medals/mention_in_dispatches.png",
    tooltipText: "<center><b>Mention in Dispatches</b></center><br>Awarded for bravery, selfless service and dedication to task during an engagement with the enemy or in a dangerous situation."
  },
  { 
    name: "Significant Effort Gold", 
    imageKey: "/assets/images/ribbons/significant_effort_gold.png",
    tooltipImage: "/assets/images/medals/significant_effort_gold.png",
    tooltipText: "<center><b>Significant Effort Gold</b></center><br>Awarded for continued significant and outstanding effort to making 16AA better as a whole."
  },
  { 
    name: "Significant Effort", 
    imageKey: "/assets/images/ribbons/significant_effort.png",
    tooltipImage: "/assets/images/medals/significant_effort.png",
    tooltipText: "<center><b>Significant Effort</b></center><br>Awarded to those who are making a significant effort to making 16AA better as a whole."
  },
  { 
    name: "Long Service and Good Conduct Medal with Two Silver Clasps", 
    imageKey: "/assets/images/ribbons/long_service_medal_10_years.png",
    tooltipImage: "/assets/images/medals/long_service_medal_10_years.png",
    tooltipText: "<center><b>Long Service and Good Conduct Medal with Two Silver Clasps</b></center><br>Awarded to Troopers who have been members of 16AA for more than ten years while proven to be valuable assets to the unit through effort and commitment."
  },
  { 
    name: "Long Service and Good Conduct Medal with Silver Clasp", 
    imageKey: "/assets/images/ribbons/long_service_medal_5_years.png",
    tooltipImage: "/assets/images/medals/long_service_medal_5_years.png",
    tooltipText: "<center><b>Long Service and Good Conduct Medal with Silver Clasp</b></center><br>Awarded to Troopers who have been members of 16AA for more than five years while proven to be valuable assets to the unit through effort and commitment."
  },
  { 
    name: "Long Service and Good Conduct Medal", 
    imageKey: "/assets/images/ribbons/long_service_medal.png",
    tooltipImage: "/assets/images/medals/long_service_medal.png",
    tooltipText: "<center><b>Long Service and Good Conduct Medal</b></center><br>Awarded to Troopers who have been members of 16AA for more than two years while proven to be valuable assets to the unit through effort and commitment."
  },
  { 
    name: "Mission Maker First Class", 
    imageKey: "/assets/images/ribbons/mission_maker_first_class.png",
    tooltipImage: "/assets/images/medals/mission_maker_first_class.png",
    tooltipText: "center><b>Mission Maker First Class</b></center><br>Awarded to Troopers that have worked on the creation of a third Operation."
  },
  { 
    name: "Mission Maker Second Class", 
    imageKey: "/assets/images/ribbons/mission_maker_second_class.png",
    tooltipImage: "/assets/images/medals/mission_maker_second_class.png",
    tooltipText: "<center><b>Mission Maker Second Class</b></center><br>Awarded to Troopers that have worked on the creation of a second Operation."
  },
  { 
    name: "Mission Maker Third Class", 
    imageKey: "/assets/images/ribbons/mission_maker_third_class.png",
    tooltipImage: "/assets/images/medals/mission_maker_third_class.png",
    tooltipText: "<center><b>Mission Maker Third Class</b></center><br>Awarded to Troopers that have worked on a series of missions that were used in an Operation."
  },
  { 
    name: "Technical Excellence", 
    imageKey: "/assets/images/ribbons/technical_excellence.png",
    tooltipImage: "/assets/images/medals/technical_excellence.png",
    tooltipText: "<center><b>Technical Excellence</b></center><br>Awarded to members of REME who have made outstanding contributions for an extended period of time to the technical aspects of the unit. This award recognises those who have worked tirelessly behind the scenes on tasks such as server & forum maintenance and administration, troubleshooting technical issues, and ensuring overall smooth day-to-day operations."
  },
  { 
    name: "RRO Excellence", 
    imageKey: "/assets/images/ribbons/rro_excellence.png",
    tooltipImage: "/assets/images/medals/rro_excellence.png",
    tooltipText: "<center><b>RRO Excellence Award</b></center><br>Awarded to troopers that have shown an excellent level of dedication and have worked tirelessly in RRO to raise the standard of the unit."
  },
  { 
    name: "Recruiter Medal", 
    imageKey: "/assets/images/ribbons/recruiter_medal.png",
    tooltipImage: "/assets/images/medals/recruiter_medal.png",
    tooltipText: "<center><b>Recruiter Medal</b></center><br>Awarded to Troopers that have contributed significantly to the Recruitment efforts of 16AA."
  },
  { 
    name: "Esprit de Corps with Gold Clasp", 
    imageKey: "/assets/images/ribbons/esprit_de_corps_gold.png",
    tooltipImage: "/assets/images/medals/esprit_de_corps_gold.png",
    tooltipText: "<center><b>Esprit de Corps with Gold Clasp</b></center><br>Awarded to troopers who demonstrate sustained commitment to promoting camaraderie, fostering a positive atmosphere, and consistently exemplifying teamwork while upholding the highest standards of the unit’s values."
  },
  { 
    name: "Esprit de Corps", 
    imageKey: "/assets/images/ribbons/esprit_de_corps.png",
    tooltipImage: "/assets/images/medals/esprit_de_corps.png",
    tooltipText: "<center><b>Esprit de Corps</b></center><br>Awarded to troopers who promote camaraderie and a positive atmosphere, while consistently encouraging teamwork and upholding the unit’s values."
  },
  { 
    name: "Citation with Four Oak Leaves", 
    imageKey: "/assets/images/ribbons/citation_5.png",
    tooltipImage: "/assets/images/medals/citation.png",
    tooltipText: "<center><b>5 x Citations</b></center><br>Awarded five times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  },
  { 
    name: "Citation with Three Oak Leaves", 
    imageKey: "/assets/images/ribbons/citation_4.png",
    tooltipImage: "/assets/images/medals/citation.png",
    tooltipText: "<center><b>4 x Citations</b></center><br>Awarded four times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  },
  { 
    name: "Citation with Two Oak Leaves", 
    imageKey: "/assets/images/ribbons/citation_3.png",
    tooltipImage: "/assets/images/medals/citation.png",
    tooltipText: "<center><b>3 x Citations</b></center><br>Awarded three times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  },
  { 
    name: "Citation with Oak Leaf", 
    imageKey: "/assets/images/ribbons/citation_2.png",
    tooltipImage: "/assets/images/medals/citation.png",
    tooltipText: "<center><b>2 x Citations</b></center><br>Awarded two times for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  },
  { 
    name: "Citation", 
    imageKey: "/assets/images/ribbons/citation_1.png",
    tooltipImage: "/assets/images/medals/citation.png",
    tooltipText: "<center><b>Citation</b></center><br>Awarded for conspicuous attention to duty on and off the battlefield. Issued at the discretion of the OC."
  }
];
