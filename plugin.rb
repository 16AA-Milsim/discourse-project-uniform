# name: discourse-project-uniform
# about: Discourse Project Uniform
# version: 0.7.1
# authors: ChatGPT & Darojax
# url: https://github.com/16AA-Milsim/discourse-project-uniform

enabled_site_setting :discourse_project_uniform_enabled

add_admin_route "discourse_project_uniform.title", "discourse-project-uniform"
register_asset "stylesheets/canvas-tooltip.scss"

after_initialize do
  # Expose plugin version to JS via Site serializer (safe across Discourse versions)
  add_to_serializer(:site, :project_uniform_version) do
    Discourse.plugins.find { |p| p.name == "discourse-project-uniform" }&.metadata&.version
  end

  # Safer to keep custom routes inside after_initialize
  Discourse::Application.routes.append do
    get "/admin/plugins/discourse-project-uniform" => "admin/site_settings#index",
        constraints: StaffConstraint.new,
        defaults: { filter: "discourse project uniform" }
  end
end
