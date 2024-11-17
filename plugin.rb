# name: project-uniform
# about: Adds a placeholder image to the user's summary page
# version: 0.1.0
# authors: Daniel Frederiksen

enabled_site_setting :project_uniform_enabled

add_admin_route 'project_uniform.title', 'project-uniform'

register_asset "stylesheets/project-uniform.scss"

Discourse::Application.routes.append do
  get '/admin/plugins/project-uniform' => 'admin/site_settings#index', constraints: StaffConstraint.new, defaults: { filter: 'project uniform' }
end
