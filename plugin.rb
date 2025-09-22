# name: discourse-project-uniform
# about: 16AA Project Uniform plugin
# version: 0.5.1
# authors: ChatGPT & Daniel Frederiksen
# url: https://github.com/16AA-Milsim/discourse-project-uniform

enabled_site_setting :project_uniform_enabled

add_admin_route 'project_uniform.title', 'discourse-project-uniform'
register_asset "stylesheets/canvas-tooltip.scss"
register_locale(:en, force_reload: true)
register_locale(:en_GB, force_reload: true)

Discourse::Application.routes.append do
  get '/admin/plugins/discourse-project-uniform' => 'admin/site_settings#index', constraints: StaffConstraint.new, defaults: { filter: 'discourse project uniform' }
end
