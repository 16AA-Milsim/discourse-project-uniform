# name: discourse-project-uniform
# about: Discourse Project Uniform
# version: 0.6.0
# authors: ChatGPT & Darojax
# url: https://github.com/16AA-Milsim/discourse-project-uniform

enabled_site_setting :discourse_project_uniform_enabled

add_admin_route 'discourse_project_uniform.title', 'discourse-project-uniform'
register_asset "stylesheets/canvas-tooltip.scss"

Discourse::Application.routes.append do
  get '/admin/plugins/discourse-project-uniform' => 'admin/site_settings#index', constraints: StaffConstraint.new, defaults: { filter: 'discourse project uniform' }
end
