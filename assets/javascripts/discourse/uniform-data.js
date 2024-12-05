// uniform-data.js

export const ranks = [
  { name: 'Major', category: 'officer', imageKey: 'project_uniform_maj_rank' },
  { name: 'Captain', category: 'officer', imageKey: 'project_uniform_capt_rank' },
  { name: 'Lieutenant', category: 'officer', imageKey: 'project_uniform_lt_rank' },
  { name: 'Second_Lieutenant', category: 'officer', imageKey: 'project_uniform_2lt_rank' },
  { name: 'Acting_Second_Lieutenant', category: 'officer', imageKey: 'project_uniform_act_2lt_rank' },
  { name: 'Warrant_Officer_Class_1', category: 'enlisted', imageKey: 'project_uniform_wo1_rank' },
  { name: 'Warrant_Officer_Class_2', category: 'enlisted', imageKey: 'project_uniform_wo2_rank' },
  { name: 'Colour_Sergeant', category: 'enlisted', imageKey: 'project_uniform_csgt_rank' },
  { name: 'Staff_Sergeant', category: 'enlisted', imageKey: 'project_uniform_ssgt_rank' },
  { name: 'Sergeant', category: 'enlisted', imageKey: 'project_uniform_sgt_rank' },
  { name: 'Corporal', category: 'enlisted', imageKey: 'project_uniform_cpl_bdr_rank' },
  { name: 'Lance_Corporal', category: 'enlisted', imageKey: 'project_uniform_lcpl_lbdr_rank' },
  { name: 'Private', category: 'enlisted', imageKey: 'project_uniform_pte_rank' },
  { name: 'Recruit', category: 'enlisted', imageKey: 'project_uniform_rec_rank' }
];

// Derived Data
export const officerRanks = ranks.filter(rank => rank.category === 'officer').map(rank => rank.name);
export const enlistedRanks = ranks.filter(rank => rank.category === 'enlisted').map(rank => rank.name);

// Rank to Image Mapping
export const rankToImageMap = Object.fromEntries(
  ranks.map(rank => [rank.name, rank.imageKey])
);

export const lanyardGroups = [
  { name: '1_Platoon_IC', imageKey: 'project_uniform_1_platoon_lanyard' },
  { name: '1_Platoon_2IC', imageKey: 'project_uniform_1_platoon_lanyard' },
  { name: '1-1_Section', imageKey: 'project_uniform_1_platoon_lanyard' },
  { name: '1-2_Section', imageKey: 'project_uniform_1_platoon_lanyard' },
  { name: '1-3_Section', imageKey: 'project_uniform_1_platoon_lanyard' },
  { name: 'Fire_Support_Group_IC', imageKey: 'project_uniform_fsg_lanyard' },
  { name: 'Fire_Support_Group_2IC', imageKey: 'project_uniform_fsg_lanyard' },
  { name: 'Fire_Support_Group', imageKey: 'project_uniform_fsg_lanyard' }
];

// Lanyard to Image Mapping
export const lanyardToImageMap = Object.fromEntries(
  lanyardGroups.map(group => [group.name, group.imageKey])
);

export const qualifications = [
  { name: 'Paratrooper', imageKey: 'project_uniform_paratrooper_qualification', restrictedRanks: [] },
  { name: 'Sniper', imageKey: 'project_uniform_sniper_qualification', restrictedRanks: ['Warrant_Officer_Class_2', 'Warrant_Officer_Class_1', ...officerRanks] },
  { name: 'Sharpshooter', imageKey: 'project_uniform_sharpshooter_qualification', restrictedRanks: ['Warrant_Officer_Class_2', 'Warrant_Officer_Class_1', ...officerRanks] },
  { name: '1st Class Marksman', imageKey: 'project_uniform_1st_class_marksman_qualification', restrictedRanks: ['Warrant_Officer_Class_2', 'Warrant_Officer_Class_1', ...officerRanks] }
];

// Qualifications to Image Mapping
export const qualificationToImageMap = Object.fromEntries(
  qualifications.map(qualification => [qualification.name, qualification.imageKey])
);

export const awards = [
  { name: "Meritorious Service Medal", imageKey: "project_uniform_meritorious_service_medal" },
  { name: "Most Valuable Soldier", imageKey: "project_uniform_most_valuable_soldier" },
  { name: "Mention in Dispatches with Four Oak Leaves", imageKey: "project_uniform_mention_in_dispatches_5" },
  { name: "Mention in Dispatches with Three Oak Leaves", imageKey: "project_uniform_mention_in_dispatches_4" },
  { name: "Mention in Dispatches with Two Oak Leaves", imageKey: "project_uniform_mention_in_dispatches_3" },
  { name: "Mention in Dispatches with Oak Leaf", imageKey: "project_uniform_mention_in_dispatches_2" },
  { name: "Mention in Dispatches", imageKey: "project_uniform_mention_in_dispatches_1" },
  { name: "Significant Effort Gold", imageKey: "project_uniform_significant_effort_gold" },
  { name: "Significant Effort", imageKey: "project_uniform_significant_effort" },
  { name: "Long Service and Good Conduct Medal with Two Silver Clasps", imageKey: "project_uniform_long_service_10_years" },
  { name: "Long Service and Good Conduct Medal with Silver Clasp", imageKey: "project_uniform_long_service_5_years" },
  { name: "Long Service and Good Conduct Medal", imageKey: "project_uniform_long_service" },
  { name: "Mission Maker First Class", imageKey: "project_uniform_mission_maker_first_class" },
  { name: "Mission Maker Second Class", imageKey: "project_uniform_mission_maker_second_class" },
  { name: "Mission Maker Third Class", imageKey: "project_uniform_mission_maker_third_class" },
  { name: "Technical Excellence", imageKey: "project_uniform_technical_excellence" },
  { name: "RRO Excellence", imageKey: "project_uniform_rro_excellence" },
  { name: "Recruiter Medal", imageKey: "project_uniform_recruiter_medal" },
  { name: "Esprit de Corps with Gold Clasp", imageKey: "project_uniform_esprit_de_corps_gold" },
  { name: "Esprit de Corps", imageKey: "project_uniform_esprit_de_corps" },
  { name: "Citation with Four Oak Leaves", imageKey: "project_uniform_citation_5" },
  { name: "Citation with Three Oak Leaves", imageKey: "project_uniform_citation_4" },
  { name: "Citation with Two Oak Leaves", imageKey: "project_uniform_citation_3" },
  { name: "Citation with Oak Leaf", imageKey: "project_uniform_citation_2" },
  { name: "Citation", imageKey: "project_uniform_citation_1" } 
];