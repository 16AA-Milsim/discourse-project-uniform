# name: project-uniform
# about: Adds a placeholder image to the user's summary page
# version: 0.1.0
# authors: Daniel Frederiksen

enabled_site_setting :project_uniform_enabled

add_admin_route 'project_uniform.title', 'project-uniform'

# Register all images
# Uniforms
register_asset "images/uniforms/ba_enlisted_uniform.png", :server_side
register_asset "images/uniforms/ba_officers_uniform.png", :server_side

# Ranks
register_asset "images/ranks/cpl.png", :server_side
register_asset "images/ranks/lcpl.png", :server_side
register_asset "images/ranks/sgt.png", :server_side

# Lanyards
register_asset "images/lanyards/1_platoon_lanyard.png", :server_side
register_asset "images/lanyards/fsg_lanyard.png", :server_side
register_asset "images/lanyards/16csmr_lanyard.png", :server_side

# Qualifications
register_asset "images/qualifications/1st_class_marksman.png", :server_side
register_asset "images/qualifications/paratrooper.png", :server_side
register_asset "images/qualifications/sniper.png", :server_side

# Ribbons
register_asset "images/ribbons/citation_1.png", :server_side
register_asset "images/ribbons/citation_2.png", :server_side
register_asset "images/ribbons/citation_3.png", :server_side
register_asset "images/ribbons/citation_4.png", :server_side
register_asset "images/ribbons/citation_5.png", :server_side
register_asset "images/ribbons/esprit_de_corps_gold.png", :server_side
register_asset "images/ribbons/esprit_de_corps.png", :server_side
register_asset "images/ribbons/long_service_medal_10_years.png", :server_side
register_asset "images/ribbons/long_service_medal_5_years.png", :server_side
register_asset "images/ribbons/long_service_medal.png", :server_side
register_asset "images/ribbons/mention_in_dispatches_1.png", :server_side
register_asset "images/ribbons/mention_in_dispatches_2.png", :server_side
register_asset "images/ribbons/mention_in_dispatches_3.png", :server_side
register_asset "images/ribbons/mention_in_dispatches_4.png", :server_side
register_asset "images/ribbons/mention_in_dispatches_5.png", :server_side
register_asset "images/ribbons/meritorious_service_medal.png", :server_side
register_asset "images/ribbons/mission_maker_first_class.png", :server_side
register_asset "images/ribbons/mission_maker_second_class.png", :server_side
register_asset "images/ribbons/mission_maker_third_class.png", :server_side
register_asset "images/ribbons/most_valuable_soldier.png", :server_side
register_asset "images/ribbons/recruiter_medal.png", :server_side
register_asset "images/ribbons/rro_excellence.png", :server_side
register_asset "images/ribbons/significant_effort_gold.png", :server_side
register_asset "images/ribbons/significant_effort.png", :server_side
register_asset "images/ribbons/technical_excellence.png", :server_side
register_asset "images/ribbons/white_ribbon.png", :server_side

Discourse::Application.routes.append do
  get '/admin/plugins/project-uniform' => 'admin/site_settings#index', constraints: StaffConstraint.new, defaults: { filter: 'project uniform' }
end
