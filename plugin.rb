# name: Project Uniform
# about: Adds a placeholder image to the user's summary page
# version: 0.1
# authors: Daniel Frederiksen

enabled_site_setting :project_uniform_enabled

add_admin_route 'project_uniform.title', 'project-uniform'

Discourse::Application.routes.append do
  get '/admin/plugins/project-uniform' => 'admin/plugins#index', constraints: StaffConstraint.new
end
