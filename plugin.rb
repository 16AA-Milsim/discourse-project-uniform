# name: discourse-project-uniform
# about: Discourse Project Uniform
# version: 0.9.0
# authors: OpenAI & Darojax
# url: https://github.com/16AA-Milsim/discourse-project-uniform

require "digest"

enabled_site_setting :discourse_project_uniform_enabled

add_admin_route "discourse_project_uniform.title", "discourse-project-uniform"
register_asset "stylesheets/canvas-tooltip.scss"

after_initialize do
  # Precompute a combined cache key so asset URLs change whenever the plugin
  # version or any tracked image asset is updated. This keeps client caches hot
  # while still busting them automatically when new art is deployed.
  plugin = Discourse.plugins.find { |p| p.name == "discourse-project-uniform" }

  image_cache_digest = begin
    plugin_path = plugin&.path
    images_path = plugin_path ? File.join(plugin_path, "public", "images") : nil

    if images_path && Dir.exist?(images_path)
      digest = Digest::SHA1.new
      Dir[File.join(images_path, "**", "*")].sort.each do |path|
        next unless File.file?(path)
        stat = File.stat(path)
        relative = path.delete_prefix("#{images_path}/")
        digest.update(relative)
        digest.update(stat.size.to_s)
        digest.update(stat.mtime.to_i.to_s)
      end
      digest.hexdigest
    end
  rescue => e
    Rails.logger.warn("[discourse-project-uniform] cache digest error: #{e.message}")
    nil
  end

  project_uniform_cache_key = begin
    parts = [plugin&.metadata&.version, image_cache_digest].compact
    parts.any? ? parts.join("-") : nil
  end

  # Expose plugin version to JS via Site serializer (safe across Discourse versions)
  add_to_serializer(:site, :project_uniform_version) do
    plugin&.metadata&.version
  end

  add_to_serializer(:site, :project_uniform_cache_key) do
    project_uniform_cache_key
  end

  # Safer to keep custom routes inside after_initialize
  Discourse::Application.routes.append do
    get "/admin/plugins/discourse-project-uniform" => "admin/site_settings#index",
        constraints: StaffConstraint.new,
        defaults: { filter: "discourse project uniform" }
  end
end
